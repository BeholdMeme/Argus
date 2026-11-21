// Argus — Bluetooth LE scanning (Web Bluetooth requestLEScan, works in the Bluefy browser).
"use strict";
(function (A) {
	const Scan = A.Scan = { running: false, scan: null, packets: 0, startedAt: null, lastPacket: 0 };
	A.devices = new Map();

	const HIST = 40;
	const SEG_GAP = 30000;
	const STAMP_M = 8;
	const STAMP_FAST_M = 18;

	Scan.support = () => {
		const bt = navigator.bluetooth;
		if (!bt) return "none";
		if (typeof bt.requestLEScan !== "function") return "noscan";
		return "ok";
	};

	Scan.start = async () => {
		if (Scan.running) return true;
		const sup = Scan.support();
		if (sup !== "ok") {
			A.emit("scan-error", sup);
			return false;
		}
		const bt = navigator.bluetooth;
		try {
			if (typeof bt.getAvailability === "function") {
				const ok = await bt.getAvailability();
				if (!ok) {
					A.emit("scan-error", "off");
					return false;
				}
			}
		} catch (e) {
			// continue
		}
		bt.removeEventListener("advertisementreceived", onAdv);
		bt.addEventListener("advertisementreceived", onAdv);
		let scan = null;
		const tries = [
			{ acceptAllAdvertisements: true, keepRepeatedDevices: true },
			{ acceptAllAdvertisements: true },
		];
		let lastErr = null;
		for (const opt of tries) {
			try {
				scan = await bt.requestLEScan(opt);
				break;
			} catch (e) {
				lastErr = e;
			}
		}
		if (!scan) {
			A.emit("scan-error", (lastErr && lastErr.name) ? (lastErr.name + ": " + lastErr.message) : "failed");
			return false;
		}
		Scan.scan = scan;
		Scan.running = true;
		Scan.startedAt = Date.now();
		A.emit("scan", true);
		return true;
	};

	Scan.stop = () => {
		try {
			if (Scan.scan && Scan.scan.active !== false) Scan.scan.stop();
		} catch (e) {
			// ignore
		}
		Scan.scan = null;
		Scan.running = false;
		A.emit("scan", false);
	};

	function mapToObj(m, keyFn) {
		const out = {};
		if (!m) return out;
		try {
			m.forEach((dv, k) => {
				out[keyFn(k)] = A.hex(A.bytes(dv));
			});
		} catch (e) {
			// ignore
		}
		return out;
	}

	function onAdv(ev) {
		const dev = ev.device || {};
		const id = dev.id || (ev.name ? ("name:" + ev.name) : null);
		if (!id) return;
		const rssi = (typeof ev.rssi === "number" && ev.rssi !== 127) ? ev.rssi : null;
		const name = ev.name || dev.name || "";
		const uuids = (ev.uuids || []).map(A.uuidKey);
		const mfg = mapToObj(ev.manufacturerData, (k) => String(k | 0));
		const svc = mapToObj(ev.serviceData, A.uuidKey);
		Scan.ingest({ id: id, name: name, rssi: rssi, txPower: ev.txPower, appearance: ev.appearance, uuids: uuids, mfg: mfg, svc: svc, at: Date.now() });
	}

	// Ingest one advertisement (also used by the demo and tests).
	Scan.ingest = (p) => {
		const now = p.at || Date.now();
		Scan.packets++;
		Scan.lastPacket = now;
		let d = A.devices.get(p.id);
		const isNew = !d;
		if (!d) {
			d = {
				id: p.id,
				name: "",
				firstSeen: now,
				lastSeen: now,
				count: 0,
				rssi: null,
				rssiMax: null,
				uuids: new Set(),
				mfg: {},
				svc: {},
				hist: [],
				segs: [[now, now]],
				trail: [],
				best: null,
				sigs: [],
				kind: null,
				rid: null,
				ridTrail: [],
				tracker: null,
			};
			A.devices.set(p.id, d);
		}
		d.count++;
		if (p.name) d.name = p.name;
		if (p.txPower != null) d.txPower = p.txPower;
		if (p.appearance != null) d.appearance = p.appearance;
		let changed = isNew;
		for (const u of p.uuids || []) {
			if (!d.uuids.has(u)) {
				d.uuids.add(u);
				changed = true;
			}
		}
		for (const k in (p.mfg || {})) {
			if (d.mfg[k] !== p.mfg[k]) changed = true;
			d.mfg[k] = p.mfg[k];
		}
		for (const k in (p.svc || {})) {
			if (d.svc[k] !== p.svc[k]) changed = true;
			d.svc[k] = p.svc[k];
		}
		// presence segments for the timeline
		const seg = d.segs[d.segs.length - 1];
		if (now - seg[1] > SEG_GAP) d.segs.push([now, now]);
		else seg[1] = now;
		if (d.segs.length > 60) d.segs.splice(0, d.segs.length - 60);
		d.lastSeen = now;
		if (p.rssi != null) {
			d.rssi = p.rssi;
			d.rssiS = (d.rssiS == null) ? p.rssi : ((d.rssiS * 0.7) + (p.rssi * 0.3));
			if (d.rssiMax == null || p.rssi > d.rssiMax) d.rssiMax = p.rssi;
			d.hist.push([now, p.rssi]);
			if (d.hist.length > HIST) d.hist.shift();
		}
		// Remote ID
		if (d.svc.FFFA) {
			const before = d.rid;
			d.rid = A.Decode.remoteId(d.svc.FFFA, d.rid);
			if (d.rid && d.rid.lat != null) {
				const lt = d.ridTrail[d.ridTrail.length - 1];
				if (!lt || A.dist(lt.lat, lt.lon, d.rid.lat, d.rid.lon) > 3) {
					d.ridTrail.push({ lat: d.rid.lat, lon: d.rid.lon, at: now, alt: d.rid.alt });
					if (d.ridTrail.length > 2000) d.ridTrail.shift();
				}
			}
			if (d.rid && (!before || before.uasId !== d.rid.uasId)) changed = true;
		}
		if (changed) {
			d.sigs = A.Sig.match(d);
			d.kind = d.sigs.length ? d.sigs[0].kind : null;
			if (d.rid && !d.kind) d.kind = "DRONE";
			d.company = companyName(d);
		}
		d.tracker = A.Decode.trackerState(d);
		d.popup = A.Decode.isPopup(d);
		d.nameOnly = !!d.name && !Object.keys(d.mfg).length && !Object.keys(d.svc).length;
		// GPS stamps (where the PHONE was when this radio was heard)
		const f = A.Geo.fresh();
		if (f && p.rssi != null) {
			const lt = d.trail[d.trail.length - 1];
			const moved = lt ? A.dist(lt.lat, lt.lon, f.lat, f.lon) : Infinity;
			if (!lt || moved >= STAMP_M || (moved >= STAMP_FAST_M && now - lt.at < 30000)) {
				d.trail.push({ lat: f.lat, lon: f.lon, at: now, rssi: p.rssi });
				if (d.trail.length > 500) d.trail.splice(0, 100);
			} else if (p.rssi > lt.rssi) {
				lt.rssi = p.rssi;
			}
			if (!d.best || p.rssi > d.best.rssi || (now - d.best.at > 600000 && p.rssi >= d.best.rssi - 3)) {
				d.best = { rssi: p.rssi, lat: f.lat, lon: f.lon, at: now };
			}
		}
		if (isNew) A.emit("device-new", d);
		A.emit("adv", d);
	};

	function companyName(d) {
		const c = window.ARGUS_COMPANIES || {};
		for (const k in d.mfg) {
			if (c[k]) return c[k];
		}
		return "";
	}

	// Display label (custom label > advertised name > signature > maker).
	A.label = (d) => {
		const labels = A.Store.get("labels", {});
		if (labels[d.id]) return labels[d.id];
		if (d.rid && d.rid.uasId) return (d.rid.maker ? (d.rid.maker + " drone ") : "Drone ") + A.mask(d.rid.uasId);
		if (d.name) return d.name;
		if (d.sigs && d.sigs.length) return d.sigs[0].name;
		if (d.company) return d.company + " " + A.t("dev.device");
		return A.t("dev.unknown");
	};

	// Privacy mode hides identifiers on screen and in screenshots.
	A.mask = (s) => {
		if (!A.Store.get("privacy", false)) return s;
		const v = String(s || "");
		if (v.length <= 4) return "••••";
		return v.substring(0, 2) + "••••" + v.substring(v.length - 2);
	};

	A.isMine = (d) => A.Store.get("mine", []).indexOf(d.id) >= 0;
	A.isWatched = (d) => A.Store.get("watched", []).indexOf(d.id) >= 0;
	A.toggleList = (key, id) => {
		const list = A.Store.get(key, []);
		const i = list.indexOf(id);
		if (i >= 0) list.splice(i, 1);
		else list.push(id);
		A.Store.set(key, list);
		return i < 0;
	};

	// Re-run signatures after the library changes.
	Scan.rematch = () => {
		for (const d of A.devices.values()) {
			d.sigs = A.Sig.match(d);
			d.kind = d.sigs.length ? d.sigs[0].kind : ((d.rid) ? "DRONE" : null);
		}
	};
})(window.Argus);
