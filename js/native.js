// Argus — bridge to the native iPhone app (CoreBluetooth + CoreLocation).
// Only active inside the Argus app; in a browser this file does nothing.
"use strict";
(function () {
	const h = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.argusNative;
	if (!h || !window.ARGUS_NATIVE) return;
	const post = (o) => {
		try {
			h.postMessage(o);
		} catch (e) {
			// ignore
		}
	};

	// ---------- Bluetooth: navigator.bluetooth.requestLEScan ----------
	const listeners = [];
	let btState = "unknown";
	const stateWaiters = [];
	window.__argusBtState = (s) => {
		btState = s;
		while (stateWaiters.length) stateWaiters.shift()(s);
	};

	function dv(hex) {
		const n = Math.floor((hex || "").length / 2);
		const b = new Uint8Array(n);
		for (let i = 0; i < n; i++) b[i] = parseInt(hex.substr(i * 2, 2), 16);
		return new DataView(b.buffer);
	}

	window.__argusAdvBatch = (list) => {
		for (const o of list) {
			const m = new Map();
			for (const k in (o.mfg || {})) m.set(Number(k), dv(o.mfg[k]));
			const s = new Map();
			for (const k in (o.svc || {})) s.set(k, dv(o.svc[k]));
			const ev = {
				device: { id: o.id, name: o.name || "" },
				name: o.name || "",
				rssi: o.rssi,
				txPower: (o.tx == null) ? null : o.tx,
				uuids: o.uuids || [],
				manufacturerData: m,
				serviceData: s,
			};
			for (const f of listeners) {
				try {
					f(ev);
				} catch (e) {
					console.error(e);
				}
			}
		}
	};

	const bluetooth = {
		native: true,
		getAvailability: () => new Promise((resolve) => {
			if (btState === "on") {
				resolve(true);
				return;
			}
			stateWaiters.push((s) => resolve(s === "on"));
			post({ cmd: "btState" });
			setTimeout(() => resolve(btState === "on"), 4000);
		}),
		requestLEScan: async () => {
			post({ cmd: "scanStart" });
			return {
				active: true,
				acceptAllAdvertisements: true,
				keepRepeatedDevices: true,
				stop() {
					this.active = false;
					post({ cmd: "scanStop" });
				},
			};
		},
		addEventListener: (name, fn) => {
			if (name === "advertisementreceived" && listeners.indexOf(fn) < 0) listeners.push(fn);
		},
		removeEventListener: (name, fn) => {
			const i = listeners.indexOf(fn);
			if (i >= 0) listeners.splice(i, 1);
		},
	};
	try {
		Object.defineProperty(navigator, "bluetooth", { value: bluetooth, configurable: true });
	} catch (e) {
		// ignore
	}

	// ---------- Location: navigator.geolocation ----------
	const watchers = new Map();
	let nextId = 1;
	let last = null;
	window.__argusLoc = (o) => {
		last = {
			coords: { latitude: o.lat, longitude: o.lon, accuracy: o.acc, altitude: o.alt, speed: (o.speed >= 0) ? o.speed : null, heading: (o.heading >= 0) ? o.heading : null, altitudeAccuracy: null },
			timestamp: o.ts || Date.now(),
		};
		for (const w of watchers.values()) {
			try {
				w.ok(last);
			} catch (e) {
				console.error(e);
			}
		}
	};
	window.__argusLocError = (code, msg) => {
		for (const w of watchers.values()) {
			if (w.err) w.err({ code: code, message: msg });
		}
	};
	const geolocation = {
		watchPosition: (ok, err) => {
			const id = nextId++;
			watchers.set(id, { ok: ok, err: err });
			if (watchers.size === 1) post({ cmd: "locStart" });
			if (last) setTimeout(() => ok(last), 0);
			return id;
		},
		clearWatch: (id) => {
			watchers.delete(id);
			if (!watchers.size) post({ cmd: "locStop" });
		},
		getCurrentPosition: (ok, err) => {
			if (last) {
				setTimeout(() => ok(last), 0);
				return;
			}
			const id = geolocation.watchPosition((p) => {
				geolocation.clearWatch(id);
				ok(p);
			}, err);
		},
	};
	try {
		Object.defineProperty(navigator, "geolocation", { value: geolocation, configurable: true });
	} catch (e) {
		// ignore
	}

	// ---------- Keep screen on ----------
	try {
		Object.defineProperty(navigator, "wakeLock", {
			value: {
				request: async () => {
					post({ cmd: "wake", on: true });
					return {
						released: false,
						release() {
							this.released = true;
							post({ cmd: "wake", on: false });
							return Promise.resolve();
						},
						addEventListener() {},
					};
				},
			},
			configurable: true,
		});
	} catch (e) {
		// ignore
	}

	// ---------- Share / save files ----------
	try {
		Object.defineProperty(navigator, "canShare", { value: (d) => !!(d && d.files && d.files.length), configurable: true });
		Object.defineProperty(navigator, "share", {
			value: async (d) => {
				const f = d && d.files && d.files[0];
				if (!f) return;
				const text = await f.text();
				post({ cmd: "share", name: f.name || "argus.txt", text: text });
			},
			configurable: true,
		});
	} catch (e) {
		// ignore
	}
})();
