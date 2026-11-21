// Argus — GPS, your path, speed, GPS-jump (spoofing) check, and saved Places.
"use strict";
(function (A) {
	const G = A.Geo = {
		on: false,
		fix: null, // { lat, lon, acc, at, speed }
		path: [], // [{lat, lon, at}]
		pathM: 0,
		watchId: null,
		lastGood: null,
		degraded: false,
	};

	const MAX_FIX_AGE = 30000;

	G.fresh = () => (G.on && G.fix && (Date.now() - G.fix.at) < MAX_FIX_AGE && G.fix.acc <= 100) ? G.fix : null;

	G.start = () => {
		if (!navigator.geolocation) {
			A.toast(A.t("gps.none"));
			return;
		}
		if (G.watchId != null) return;
		G.on = true;
		G.watchId = navigator.geolocation.watchPosition(onFix, onErr, { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 });
		A.emit("gps");
	};

	G.stop = () => {
		G.on = false;
		if (G.watchId != null) navigator.geolocation.clearWatch(G.watchId);
		G.watchId = null;
		A.emit("gps");
	};

	G.set = (on) => {
		A.Store.set("gpsOn", !!on);
		if (on) G.start();
		else G.stop();
	};

	function onErr(e) {
		A.emit("gps-error", e);
	}

	function onFix(p) {
		const c = p.coords;
		const f = { lat: c.latitude, lon: c.longitude, acc: c.accuracy, at: p.timestamp || Date.now(), speed: c.speed };
		checkJump(f);
		G.fix = f;
		if (f.acc <= 50) {
			const last = G.path[G.path.length - 1];
			if (!last) G.path.push({ lat: f.lat, lon: f.lon, at: f.at });
			else {
				const d = A.dist(last.lat, last.lon, f.lat, f.lon);
				if (d >= Math.max(5, f.acc * 0.5)) {
					G.path.push({ lat: f.lat, lon: f.lon, at: f.at });
					G.pathM += d;
					if (G.path.length > 20000) G.path.splice(0, 1000);
				}
			}
		}
		A.emit("fix", f);
	}

	// Possible GPS interference: a jump faster than any airliner, or sudden loss of accuracy.
	function checkJump(f) {
		const prev = G.lastGood;
		if (prev && f.acc < 100 && prev.acc < 100) {
			const dt = Math.max(0.5, (f.at - prev.at) / 1000);
			const d = A.dist(prev.lat, prev.lon, f.lat, f.lon);
			const v = d / dt;
			if (d > 1000 && v > 340) {
				A.emit("gps-jump", { from: prev, to: f, meters: d, seconds: dt });
			}
		}
		if (prev && prev.acc <= 30 && f.acc > 500 && (f.at - prev.at) < 120000) {
			if (!G.degraded) {
				G.degraded = true;
				A.emit("gps-degraded", { from: prev, to: f });
			}
		} else if (f.acc <= 50) {
			G.degraded = false;
		}
		if (f.acc < 100) G.lastGood = f;
	}

	// Recent speed over the last 2 minutes of path, clamped 0–40 m/s.
	G.recentSpeed = () => {
		const now = Date.now();
		let m = 0;
		let t0 = null;
		for (let i = G.path.length - 1; i > 0; i--) {
			const a = G.path[i];
			const b = G.path[i - 1];
			if (now - b.at > 120000) break;
			m += A.dist(a.lat, a.lon, b.lat, b.lon);
			t0 = b.at;
		}
		if (t0 == null) return 0;
		const s = (now - t0) / 1000;
		return Math.max(0, Math.min(40, m / Math.max(1, s)));
	};

	// ---- Saved Places (Home, Hotel...). hide = keep positions inside out of exports ----
	G.places = () => A.Store.get("places", []);
	G.savePlace = (name, radius, hide) => {
		const f = G.fix;
		if (!f) return false;
		const list = G.places();
		list.push({ id: A.uid(), name: name, lat: f.lat, lon: f.lon, r: radius || 150, hide: !!hide });
		A.Store.set("places", list);
		return true;
	};
	G.removePlace = (id) => A.Store.set("places", G.places().filter((p) => p.id !== id));
	G.placeAt = (lat, lon) => {
		if (lat == null) return null;
		for (const p of G.places()) {
			if (A.dist(lat, lon, p.lat, p.lon) <= p.r) return p;
		}
		return null;
	};
	G.hidden = (lat, lon) => {
		const p = G.placeAt(lat, lon);
		return !!(p && p.hide);
	};
})(window.Argus);
