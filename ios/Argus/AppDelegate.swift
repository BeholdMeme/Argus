import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
	var window: UIWindow?
	let server = LocalServer()

	func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
		server.start()
		let win = UIWindow(frame: UIScreen.main.bounds)
		win.backgroundColor = UIColor(red: 0.043, green: 0.059, blue: 0.078, alpha: 1)
		win.rootViewController = WebViewController(server: server)
		win.makeKeyAndVisible()
		window = win
		return true
	}

	func applicationWillEnterForeground(_ application: UIApplication) {
		server.start()
	}
}
