import Foundation
import Network

// Serves the bundled web app (www/) on http://localhost:PORT so the page is a
// secure context with a stable origin (storage, cache and clipboard all work).
final class LocalServer {
	static let port: UInt16 = 52317
	private var listener: NWListener?
	var onReady: (() -> Void)?
	private(set) var isReady = false
	private let queue = DispatchQueue(label: "argus.server")
	private let root: URL = Bundle.main.bundleURL.appendingPathComponent("www", isDirectory: true)

	var baseURL: URL {
		return URL(string: "http://localhost:\(LocalServer.port)/")!
	}

	func start() {
		if listener != nil { return }
		do {
			let params = NWParameters.tcp
			params.allowLocalEndpointReuse = true
			params.requiredInterfaceType = .loopback
			let l = try NWListener(using: params, on: NWEndpoint.Port(rawValue: LocalServer.port)!)
			l.newConnectionHandler = { [weak self] conn in
				self?.handle(conn)
			}
			l.stateUpdateHandler = { [weak self] state in
				switch state {
				case .ready:
					DispatchQueue.main.async {
						self?.isReady = true
						self?.onReady?()
					}
				case .failed, .cancelled:
					DispatchQueue.main.async { self?.isReady = false }
					self?.listener?.cancel()
					self?.listener = nil
				default:
					break
				}
			}
			l.start(queue: queue)
			listener = l
		} catch {
			listener = nil
		}
	}

	private func handle(_ conn: NWConnection) {
		conn.start(queue: queue)
		receive(conn, buffer: Data())
	}

	private func receive(_ conn: NWConnection, buffer: Data) {
		conn.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, isComplete, error in
			guard let self = self else { return }
			var buf = buffer
			if let d = data { buf.append(d) }
			if let range = buf.range(of: Data("\r\n\r\n".utf8)) {
				let head = String(decoding: buf.subdata(in: 0..<range.lowerBound), as: UTF8.self)
				self.respond(conn, head: head)
				return
			}
			if isComplete || error != nil || buf.count > 1_000_000 {
				conn.cancel()
				return
			}
			self.receive(conn, buffer: buf)
		}
	}

	private func respond(_ conn: NWConnection, head: String) {
		let first = head.components(separatedBy: "\r\n").first ?? ""
		let parts = first.components(separatedBy: " ")
		var path = parts.count > 1 ? parts[1] : "/"
		if let q = path.firstIndex(of: "?") { path = String(path[..<q]) }
		path = path.removingPercentEncoding ?? path
		if path == "/" || path.isEmpty { path = "/index.html" }
		let clean = path.split(separator: "/").filter { $0 != ".." && $0 != "." }.joined(separator: "/")
		let file = root.appendingPathComponent(clean)
		var status = "200 OK"
		var body = Data()
		var type = "application/octet-stream"
		if file.path.hasPrefix(root.path), let d = try? Data(contentsOf: file) {
			body = d
			type = LocalServer.mime(file.pathExtension.lowercased())
		} else {
			status = "404 Not Found"
			body = Data("Not found".utf8)
			type = "text/plain"
		}
		var header = "HTTP/1.1 \(status)\r\n"
		header += "Content-Type: \(type)\r\n"
		header += "Content-Length: \(body.count)\r\n"
		header += "Cache-Control: no-cache\r\n"
		header += "Connection: close\r\n\r\n"
		var out = Data(header.utf8)
		out.append(body)
		conn.send(content: out, completion: .contentProcessed { _ in
			conn.cancel()
		})
	}

	static func mime(_ ext: String) -> String {
		switch ext {
		case "html": return "text/html; charset=utf-8"
		case "js": return "text/javascript; charset=utf-8"
		case "css": return "text/css; charset=utf-8"
		case "json", "webmanifest": return "application/json"
		case "svg": return "image/svg+xml"
		case "png": return "image/png"
		case "jpg", "jpeg": return "image/jpeg"
		default: return "application/octet-stream"
		}
	}
}
