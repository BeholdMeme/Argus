import UIKit
import WebKit
import CoreBluetooth
import CoreLocation

// Hosts the Argus web app and gives it what a browser can't on iPhone:
// full Bluetooth LE scanning (CoreBluetooth) and native location (CoreLocation).
final class WebViewController: UIViewController, WKScriptMessageHandler, WKUIDelegate, WKNavigationDelegate, CBCentralManagerDelegate, CLLocationManagerDelegate {
	private let server: LocalServer
	private var webView: WKWebView!
	private var central: CBCentralManager?
	private var wantScan = false
	private let location = CLLocationManager()
	private var wantLocation = false
	private var pending: [[String: Any]] = []
	private var flushTimer: Timer?
	private var loaded = false

	init(server: LocalServer) {
		self.server = server
		super.init(nibName: nil, bundle: nil)
	}

	required init?(coder: NSCoder) {
		fatalError("not used")
	}

	override var preferredStatusBarStyle: UIStatusBarStyle {
		return .lightContent
	}

	override func viewDidLoad() {
		super.viewDidLoad()
		view.backgroundColor = UIColor(red: 0.043, green: 0.059, blue: 0.078, alpha: 1)
		let config = WKWebViewConfiguration()
		config.allowsInlineMediaPlayback = true
		config.mediaTypesRequiringUserActionForPlayback = []
		config.websiteDataStore = WKWebsiteDataStore.default()
		let ucc = WKUserContentController()
		ucc.add(WeakHandler(self), name: "argusNative")
		ucc.addUserScript(WKUserScript(source: "window.ARGUS_NATIVE = true;", injectionTime: .atDocumentStart, forMainFrameOnly: true))
		config.userContentController = ucc
		webView = WKWebView(frame: view.bounds, configuration: config)
		webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
		webView.isOpaque = false
		webView.backgroundColor = view.backgroundColor
		webView.scrollView.backgroundColor = view.backgroundColor
		webView.scrollView.contentInsetAdjustmentBehavior = .never
		webView.scrollView.bounces = false
		webView.uiDelegate = self
		webView.navigationDelegate = self
		if #available(iOS 16.4, *) {
			webView.isInspectable = true
		}
		view.addSubview(webView)
		location.delegate = self
		location.desiredAccuracy = kCLLocationAccuracyBest
		location.distanceFilter = kCLDistanceFilterNone
		location.activityType = .fitness
		server.onReady = { [weak self] in
			self?.loadApp()
		}
		if server.isReady {
			loadApp()
		}
		DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
			self?.loadApp()
		}
	}

	private func loadApp() {
		if loaded { return }
		loaded = true
		webView.load(URLRequest(url: server.baseURL.appendingPathComponent("index.html")))
	}

	// MARK: - Messages from JavaScript

	func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
		guard let body = message.body as? [String: Any], let cmd = body["cmd"] as? String else { return }
		switch cmd {
		case "scanStart":
			wantScan = true
			if central == nil {
				central = CBCentralManager(delegate: self, queue: nil, options: [CBCentralManagerOptionShowPowerAlertKey: true])
			} else {
				startScanIfReady()
			}
			startFlush()
		case "scanStop":
			wantScan = false
			central?.stopScan()
		case "btState":
			if central == nil {
				central = CBCentralManager(delegate: self, queue: nil, options: [CBCentralManagerOptionShowPowerAlertKey: true])
			} else {
				sendBtState()
			}
		case "locStart":
			wantLocation = true
			startLocation()
		case "locStop":
			wantLocation = false
			location.stopUpdatingLocation()
		case "wake":
			UIApplication.shared.isIdleTimerDisabled = (body["on"] as? Bool) ?? false
		case "share":
			let name = (body["name"] as? String) ?? "argus.txt"
			let text = (body["text"] as? String) ?? ""
			share(name: name, text: text)
		case "openURL":
			if let s = body["url"] as? String, let u = URL(string: s) {
				UIApplication.shared.open(u)
			}
		default:
			break
		}
	}

	// MARK: - Bluetooth

	private func startScanIfReady() {
		guard let c = central, c.state == .poweredOn, wantScan else { return }
		if !c.isScanning {
			c.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: true])
		}
	}

	func centralManagerDidUpdateState(_ central: CBCentralManager) {
		sendBtState()
		startScanIfReady()
	}

	private func sendBtState() {
		guard let c = central else { return }
		var s = "unknown"
		switch c.state {
		case .poweredOn: s = "on"
		case .poweredOff: s = "off"
		case .unauthorized: s = "unauthorized"
		case .unsupported: s = "unsupported"
		case .resetting: s = "resetting"
		default: s = "unknown"
		}
		js("window.__argusBtState && window.__argusBtState(\(jsonString(s)))")
	}

	func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
		let r = RSSI.intValue
		if r == 127 || r == 0 { return }
		var o: [String: Any] = ["id": peripheral.identifier.uuidString, "rssi": r]
		if let n = advertisementData[CBAdvertisementDataLocalNameKey] as? String, !n.isEmpty {
			o["name"] = n
		} else if let n = peripheral.name, !n.isEmpty {
			o["name"] = n
		}
		if let tx = advertisementData[CBAdvertisementDataTxPowerLevelKey] as? NSNumber {
			o["tx"] = tx.intValue
		}
		if let m = advertisementData[CBAdvertisementDataManufacturerDataKey] as? Data, m.count >= 2 {
			let cid = Int(m[m.startIndex]) | (Int(m[m.startIndex + 1]) << 8)
			o["mfg"] = [String(cid): hex(m.dropFirst(2))]
		}
		if let sd = advertisementData[CBAdvertisementDataServiceDataKey] as? [CBUUID: Data] {
			var svc: [String: String] = [:]
			for (k, v) in sd { svc[k.uuidString] = hex(v) }
			o["svc"] = svc
		}
		var uuids: [String] = []
		if let u = advertisementData[CBAdvertisementDataServiceUUIDsKey] as? [CBUUID] { uuids += u.map { $0.uuidString } }
		if let u = advertisementData[CBAdvertisementDataOverflowServiceUUIDsKey] as? [CBUUID] { uuids += u.map { $0.uuidString } }
		if let u = advertisementData[CBAdvertisementDataSolicitedServiceUUIDsKey] as? [CBUUID] { uuids += u.map { $0.uuidString } }
		if !uuids.isEmpty { o["uuids"] = uuids }
		pending.append(o)
		if pending.count > 2000 { pending.removeFirst(pending.count - 2000) }
	}

	private func startFlush() {
		if flushTimer != nil { return }
		flushTimer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
			self?.flush()
		}
	}

	private func flush() {
		if pending.isEmpty { return }
		let batch = pending
		pending.removeAll()
		guard let data = try? JSONSerialization.data(withJSONObject: batch), let s = String(data: data, encoding: .utf8) else { return }
		js("window.__argusAdvBatch && window.__argusAdvBatch(\(s))")
	}

	private func hex<S: Sequence>(_ bytes: S) -> String where S.Element == UInt8 {
		return bytes.map { String(format: "%02X", $0) }.joined()
	}

	// MARK: - Location

	private func startLocation() {
		let status: CLAuthorizationStatus
		if #available(iOS 14.0, *) {
			status = location.authorizationStatus
		} else {
			status = CLLocationManager.authorizationStatus()
		}
		switch status {
		case .notDetermined:
			location.requestWhenInUseAuthorization()
		case .denied, .restricted:
			js("window.__argusLocError && window.__argusLocError(1, 'denied')")
		default:
			location.startUpdatingLocation()
		}
	}

	func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
		if wantLocation { startLocation() }
	}

	func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
		if wantLocation { startLocation() }
	}

	func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
		guard let l = locations.last, l.horizontalAccuracy >= 0 else { return }
		let o: [String: Any] = [
			"lat": l.coordinate.latitude,
			"lon": l.coordinate.longitude,
			"acc": l.horizontalAccuracy,
			"alt": l.altitude,
			"speed": l.speed,
			"heading": l.course,
			"ts": l.timestamp.timeIntervalSince1970 * 1000,
		]
		guard let data = try? JSONSerialization.data(withJSONObject: o), let s = String(data: data, encoding: .utf8) else { return }
		js("window.__argusLoc && window.__argusLoc(\(s))")
	}

	func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
		js("window.__argusLocError && window.__argusLocError(2, \(jsonString(error.localizedDescription)))")
	}

	// MARK: - Share files

	private func share(name: String, text: String) {
		let safe = name.replacingOccurrences(of: "/", with: "-")
		let url = FileManager.default.temporaryDirectory.appendingPathComponent(safe)
		do {
			try text.write(to: url, atomically: true, encoding: .utf8)
		} catch {
			return
		}
		let vc = UIActivityViewController(activityItems: [url], applicationActivities: nil)
		vc.popoverPresentationController?.sourceView = view
		vc.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
		present(vc, animated: true)
	}

	// MARK: - JS helpers

	private func js(_ code: String) {
		webView?.evaluateJavaScript(code, completionHandler: nil)
	}

	private func jsonString(_ s: String) -> String {
		if let d = try? JSONSerialization.data(withJSONObject: [s]), let t = String(data: d, encoding: .utf8) {
			return String(t.dropFirst().dropLast())
		}
		return "\"\""
	}

	// MARK: - alert / confirm / prompt

	func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
		let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
		a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
		present(a, animated: true)
	}

	func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
		let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
		a.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
		a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
		present(a, animated: true)
	}

	func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
		let a = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
		a.addTextField { tf in tf.text = defaultText }
		a.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(nil) })
		a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(a.textFields?.first?.text) })
		present(a, animated: true)
	}

	// Links to other sites open in Safari.
	func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
		if let u = navigationAction.request.url, navigationAction.targetFrame?.isMainFrame ?? true, navigationAction.navigationType == .linkActivated, u.host != "localhost" {
			UIApplication.shared.open(u)
			decisionHandler(.cancel)
			return
		}
		decisionHandler(.allow)
	}

	func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
		DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) { [weak self] in
			guard let self = self else { return }
			self.server.start()
			self.webView.load(URLRequest(url: self.server.baseURL.appendingPathComponent("index.html")))
		}
	}

	func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
		webView.reload()
	}
}

// Avoids a retain cycle between WKUserContentController and the controller.
final class WeakHandler: NSObject, WKScriptMessageHandler {
	weak var target: WKScriptMessageHandler?

	init(_ target: WKScriptMessageHandler) {
		self.target = target
	}

	func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
		target?.userContentController(userContentController, didReceive: message)
	}
}
