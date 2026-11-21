// Argus — sessions ("sits"), debrief, AI export, compare two sessions, and exports.
"use strict";
(function (A) {
	const SS = A.Session = { cur: null };

	SS.begin = (name) => {
		SS.cur = { id: A.uid(), name: name || ("Session " + A.fmtDate(Date.now())), start: Date.now(), end: null, alerts: [] };
		A.Store.set("curSession", SS.cur.id);
		return SS.cur;
	};

	SS.ensure = () => SS.cur || SS.begin();

	function devSummary(d, hideFn) {
		const keep = (p) => p && !hideFn(p.lat, p.lon);
		return {
			id: d.id,
			name: d.name,
			label: A.label(d),
			sigs: (d.sigs || []).map((f) => f.name),
			kind: d.kind,
			company: d.company || "",
			first: d.firstSeen,
			last: d.lastSeen,
			count: d.count,
			rssiMax: d.rssiMax,
			rssi: d.rssi,
			uuids: Array.from(d.uuids),
			mfg: d.mfg,
			svc: d.svc,
			segs: d.segs,
			best: keep(d.best) ? d.best : null,
			trail: d.trail.filter(keep),
			rid: d.rid,
			ridTrail: d.ridTrail,
			moving: A.Alerts.moving.has(d.id),
			mine: A.isMine(d),
			watched: A.isWatched(d),
			tracker: d.tracker ? d.tracker.state : null,
		};
	}

	SS.snapshot = (forExport) => {
		const s = SS.ensure();
		const hideFn = forExport ? A.Geo.hidden : (() => false);
		return {
			id: s.id,
			name: s.name,
			start: s.start,
			end: s.end || Date.now(),
			app: "Argus " + A.VERSION,
			pathM: Math.round(A.Geo.pathM),
			path: A.Geo.path.filter((p) => !hideFn(p.lat, p.lon)),
			alerts: s.alerts.map((a) => Object.assign({}, a)).filter((a) => a.lat == null || !hideFn(a.lat, a.lon)),
			devices: Array.from(A.devices.values()).filter((d) => !(forExport && A.isMine(d))).map((d) => devSummary(d, hideFn)),
		};
	};

	SS.save = async () => {
		if (!SS.cur) return;
		await A.Store.putSession(SS.snapshot(false));
	};

	SS.end = async () => {
		if (!SS.cur) return;
		SS.cur.end = Date.now();
		await SS.save();
	};

	// Start a fresh session: save the old one, clear devices and path.
	SS.fresh = async () => {
		await SS.end();
		A.devices.clear();
		A.Geo.path = [];
		A.Geo.pathM = 0;
		A.Alerts.list = [];
		A.Alerts.unread = 0;
		A.Alerts.reset();
		SS.begin();
		A.emit("session");
	};

	// ---------- debrief ----------
	SS.debrief = (s) => {
		const L = [];
		const dur = (s.end || Date.now()) - s.start;
		const devs = s.devices || [];
		L.push(A.t("db.title") + ": " + s.name);
		L.push(A.fmtDate(s.start) + " → " + A.fmtDate(s.end || Date.now()) + " (" + A.fmtDur(dur) + ")");
		L.push(A.t("db.path") + ": " + A.fmtDist(s.pathM || 0));
		L.push(A.t("db.devices") + ": " + devs.length + " · " + A.t("db.identified") + ": " + devs.filter((d) => d.sigs.length).length);
		const byKind = {};
		for (const d of devs) {
			if (!d.kind) continue;
			byKind[d.kind] = (byKind[d.kind] || 0) + 1;
		}
		const kinds = Object.keys(byKind).sort((a, b) => ((A.KINDS[a] || A.KINDS.OTHER).prio - (A.KINDS[b] || A.KINDS.OTHER).prio));
		if (kinds.length) {
			L.push("");
			L.push(A.t("db.classes") + ":");
			for (const k of kinds) L.push("  " + A.kindLabel(k) + ": " + byKind[k]);
		}
		const attention = devs.filter((d) => ["FINDER", "DRONE", "HACKING", "LAW_ENFORCEMENT", "SURVEILLANCE", "MILITARY"].indexOf(d.kind) >= 0 && !d.mine);
		if (attention.length) {
			L.push("");
			L.push(A.t("db.attention") + ":");
			for (const d of attention.slice(0, 40)) {
				L.push("  • " + d.label + " [" + d.sigs.join(", ") + "] " + A.t("db.seen") + " " + A.fmtDur(d.last - d.first) + ", max " + d.rssiMax + " dBm" + (d.moving ? (" · " + A.t("flt.moving")) : "") + (d.tracker === "SEPARATED" ? (" · " + A.t("db.separated")) : ""));
				if (d.rid && d.rid.uasId) L.push("     " + A.t("db.drone") + " " + d.rid.uasId + ((d.rid.opLat != null) ? (" · " + A.t("db.pilot") + " " + d.rid.opLat.toFixed(5) + "," + d.rid.opLon.toFixed(5)) : ""));
			}
		}
		const moving = devs.filter((d) => d.moving && !d.mine);
		if (moving.length) {
			L.push("");
			L.push(A.t("flt.moving") + ": " + moving.map((d) => d.label).join(", "));
		}
		const longest = devs.filter((d) => !d.mine).sort((a, b) => ((b.last - b.first) - (a.last - a.first))).slice(0, 8);
		if (longest.length) {
			L.push("");
			L.push(A.t("db.longest") + ":");
			for (const d of longest) L.push("  " + d.label + " — " + A.fmtDur(d.last - d.first));
		}
		if ((s.alerts || []).length) {
			L.push("");
			L.push(A.t("tab.alerts") + " (" + s.alerts.length + "):");
			for (const a of s.alerts.slice(0, 60)) L.push("  " + A.fmtClock(a.at) + " " + a.title + (a.body ? (" — " + a.body) : ""));
		}
		L.push("");
		L.push(A.t("db.note"));
		return L.join("\n");
	};

	SS.aiPrompt = (s) => {
		const head = [
			"You are helping me review a Bluetooth LE field log from Argus, a receive-only scanner on an iPhone (Bluefy browser).",
			"Facts about the tool: receive-only, no connections, no Wi-Fi visibility on iPhone, device IDs are per-browser and many radios rotate addresses.",
			"RSSI is loudness, not distance. GPS points are MY phone's position when a radio was heard, not the radio's position (except drone Remote ID, which broadcasts its own GPS).",
			"Signature matches are pattern hypotheses, not identity. Please: summarize what stands out, list anything that may have followed me, flag trackers / drones / pentest tools, say what is probably normal background, and suggest what to check next. Be honest about uncertainty.",
			"",
			"=== DEBRIEF ===",
			SS.debrief(s),
			"",
			"=== DEVICES (label | signatures | maker | first | last | max dBm | moving | tracker) ===",
		];
		const rows = (s.devices || []).filter((d) => !d.mine).sort((a, b) => ((b.last - b.first) - (a.last - a.first))).slice(0, 150).map((d) =>
			[d.label, d.sigs.join("/"), d.company, A.fmtClock(d.first), A.fmtClock(d.last), d.rssiMax, d.moving ? "yes" : "", d.tracker || ""].join(" | "));
		return head.concat(rows).join("\n");
	};

	// Compare two sessions: same device = same ID, or same name + same top signature.
	SS.compare = (a, b) => {
		const key = (d) => d.id;
		const soft = (d) => (d.name ? (d.name + "|" + (d.sigs[0] || "")) : null);
		const bIds = new Map(b.devices.map((d) => [key(d), d]));
		const bSoft = new Map(b.devices.filter(soft).map((d) => [soft(d), d]));
		const both = [];
		const onlyA = [];
		const usedB = new Set();
		for (const d of a.devices) {
			if (d.mine) continue;
			let m = bIds.get(key(d));
			if (!m && soft(d)) m = bSoft.get(soft(d));
			if (m && !usedB.has(m.id)) {
				both.push([d, m]);
				usedB.add(m.id);
			} else onlyA.push(d);
		}
		const onlyB = b.devices.filter((d) => !d.mine && !usedB.has(d.id));
		const L = [];
		L.push(A.t("cmp.title") + ": \"" + a.name + "\" ↔ \"" + b.name + "\"");
		L.push(A.t("cmp.both") + ": " + both.length + " · " + A.t("cmp.onlyA") + ": " + onlyA.length + " · " + A.t("cmp.onlyB") + ": " + onlyB.length);
		const pick = (list) => list.filter((d) => d.sigs.length || d.name).slice(0, 40);
		L.push("");
		L.push(A.t("cmp.both") + ":");
		for (const p of both.filter((x) => x[0].sigs.length || x[0].name).slice(0, 60)) L.push("  • " + p[0].label + (p[0].sigs.length ? (" [" + p[0].sigs.join(", ") + "]") : ""));
		L.push("");
		L.push(A.t("cmp.onlyA") + ":");
		for (const d of pick(onlyA)) L.push("  • " + d.label + (d.sigs.length ? (" [" + d.sigs.join(", ") + "]") : ""));
		L.push("");
		L.push(A.t("cmp.onlyB") + ":");
		for (const d of pick(onlyB)) L.push("  • " + d.label + (d.sigs.length ? (" [" + d.sigs.join(", ") + "]") : ""));
		L.push("");
		L.push(A.t("cmp.note"));
		return L.join("\n");
	};

	// ---------- exports ----------
	const csvEsc = (v) => {
		const s = String(v == null ? "" : v);
		return /[",\n]/.test(s) ? ("\"" + s.replace(/"/g, "\"\"") + "\"") : s;
	};

	SS.csv = (s) => {
		const head = ["id", "label", "name", "signatures", "class", "maker", "first_seen", "last_seen", "packets", "rssi_max", "best_lat", "best_lon", "moving_with_you", "tracker", "uuids", "mfg", "svc", "drone_id", "drone_lat", "drone_lon", "pilot_lat", "pilot_lon"];
		const rows = [head.join(",")];
		for (const d of s.devices) {
			rows.push([d.id, d.label, d.name, d.sigs.join("; "), d.kind || "", d.company, new Date(d.first).toISOString(), new Date(d.last).toISOString(), d.count, d.rssiMax,
				d.best ? d.best.lat.toFixed(6) : "", d.best ? d.best.lon.toFixed(6) : "", d.moving ? "1" : "", d.tracker || "", d.uuids.join(" "),
				Object.keys(d.mfg).map((k) => k + ":" + d.mfg[k]).join(" "), Object.keys(d.svc).map((k) => k + ":" + d.svc[k]).join(" "),
				d.rid ? (d.rid.uasId || "") : "", (d.rid && d.rid.lat != null) ? d.rid.lat.toFixed(6) : "", (d.rid && d.rid.lon != null) ? d.rid.lon.toFixed(6) : "",
				(d.rid && d.rid.opLat != null) ? d.rid.opLat.toFixed(6) : "", (d.rid && d.rid.opLon != null) ? d.rid.opLon.toFixed(6) : ""].map(csvEsc).join(","));
		}
		return rows.join("\n");
	};

	SS.jsonl = (s) => s.devices.map((d) => JSON.stringify(d)).join("\n");

	const xmlEsc = (v) => A.esc(v);

	SS.gpx = (s) => {
		const L = ["<?xml version=\"1.0\" encoding=\"UTF-8\"?>", "<gpx version=\"1.1\" creator=\"Argus\" xmlns=\"http://www.topografix.com/GPX/1/1\">"];
		for (const d of s.devices) {
			if (d.best) L.push("<wpt lat=\"" + d.best.lat.toFixed(6) + "\" lon=\"" + d.best.lon.toFixed(6) + "\"><time>" + new Date(d.best.at).toISOString() + "</time><name>" + xmlEsc(d.label) + "</name><desc>" + xmlEsc((d.sigs.join(", ") || d.company) + " · max " + d.rssiMax + " dBm (phone position at strongest hear)") + "</desc></wpt>");
			if (d.rid && d.rid.lat != null) L.push("<wpt lat=\"" + d.rid.lat.toFixed(6) + "\" lon=\"" + d.rid.lon.toFixed(6) + "\"><name>" + xmlEsc("Drone " + (d.rid.uasId || "")) + "</name></wpt>");
			if (d.rid && d.rid.opLat != null) L.push("<wpt lat=\"" + d.rid.opLat.toFixed(6) + "\" lon=\"" + d.rid.opLon.toFixed(6) + "\"><name>" + xmlEsc("Pilot " + (d.rid.uasId || "")) + "</name></wpt>");
		}
		L.push("<trk><name>" + xmlEsc(s.name) + "</name><trkseg>");
		for (const p of s.path) L.push("<trkpt lat=\"" + p.lat.toFixed(6) + "\" lon=\"" + p.lon.toFixed(6) + "\"><time>" + new Date(p.at).toISOString() + "</time></trkpt>");
		L.push("</trkseg></trk>");
		for (const d of s.devices) {
			if (!d.ridTrail || d.ridTrail.length < 2) continue;
			L.push("<trk><name>" + xmlEsc("Drone " + ((d.rid && d.rid.uasId) || d.label)) + "</name><trkseg>");
			for (const p of d.ridTrail) L.push("<trkpt lat=\"" + p.lat.toFixed(6) + "\" lon=\"" + p.lon.toFixed(6) + "\"><time>" + new Date(p.at).toISOString() + "</time></trkpt>");
			L.push("</trkseg></trk>");
		}
		L.push("</gpx>");
		return L.join("\n");
	};

	SS.kml = (s) => {
		const L = ["<?xml version=\"1.0\" encoding=\"UTF-8\"?>", "<kml xmlns=\"http://www.opengis.net/kml/2.2\"><Document><name>" + xmlEsc(s.name) + "</name>"];
		if (s.path.length > 1) L.push("<Placemark><name>Path</name><LineString><coordinates>" + s.path.map((p) => p.lon.toFixed(6) + "," + p.lat.toFixed(6)).join(" ") + "</coordinates></LineString></Placemark>");
		for (const d of s.devices) {
			if (d.best) L.push("<Placemark><name>" + xmlEsc(d.label) + "</name><description>" + xmlEsc((d.sigs.join(", ") || d.company) + " · max " + d.rssiMax + " dBm") + "</description><Point><coordinates>" + d.best.lon.toFixed(6) + "," + d.best.lat.toFixed(6) + "</coordinates></Point></Placemark>");
			if (d.rid && d.rid.opLat != null) L.push("<Placemark><name>" + xmlEsc("Pilot " + (d.rid.uasId || "")) + "</name><Point><coordinates>" + d.rid.opLon.toFixed(6) + "," + d.rid.opLat.toFixed(6) + "</coordinates></Point></Placemark>");
			if (d.ridTrail && d.ridTrail.length > 1) L.push("<Placemark><name>" + xmlEsc("Drone " + ((d.rid && d.rid.uasId) || "")) + "</name><LineString><coordinates>" + d.ridTrail.map((p) => p.lon.toFixed(6) + "," + p.lat.toFixed(6)).join(" ") + "</coordinates></LineString></Placemark>");
		}
		L.push("</Document></kml>");
		return L.join("\n");
	};

	SS.fileBase = (s) => "argus-" + new Date(s.start).toISOString().substring(0, 16).replace(/[:T]/g, "-");
})(window.Argus);
