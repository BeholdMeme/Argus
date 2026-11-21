// Argus — alerts: watchlist, bookmarked signatures, classes, trackers (separated + places),
// Moving with you, pairing floods, drone perimeter and swarm, GPS jumps.
"use strict";
(function (A) {
	const AL = A.Alerts = { list: [], unread: 0 };

	const DEFAULTS = {
		al_tracker: true, al_places: true, al_moving: true, moving_min_m: 300,
		al_drone_near: true, drone_near_m: 250, al_drone_swarm: true, swarm_min: 5, swarm_win: 30, swarm_quiet: 2, al_drone_class: true,
		al_approach: false, al_hack: true, al_police: true, al_surv: false, al_bookmark: true, al_watch: true, al_flood: true, al_gps: true,
		snd_beep: true, snd_voice: true, snd_flash: true,
		strong: -70, stale: 60, view: "list", theme: "dark", slowui: false, basemap: "osm", cameras: true, sort: "rssi",
	};
	A.cfg = (k) => {
		const c = A.Store.get("cfg", {});
		return (k in c) ? c[k] : DEFAULTS[k];
	};
	A.setCfg = (k, v) => {
		const c = A.Store.get("cfg", {});
		c[k] = v;
		A.Store.set("cfg", c);
	};

	// ---------- raising ----------
	AL.raise = (a) => {
		a.id = a.id || A.uid();
		a.at = a.at || Date.now();
		const f = A.Geo.fresh();
		if (f && a.lat == null) {
			a.lat = f.lat;
			a.lon = f.lon;
		}
		AL.list.unshift(a);
		if (AL.list.length > 500) AL.list.pop();
		AL.unread++;
		if (A.Session.cur) A.Session.cur.alerts.push(a);
		if (A.cfg("snd_beep")) {
			const pat = (a.level === "high") ? [1200, 900, 1200] : [1000];
			pat.forEach((fq, i) => setTimeout(() => A.beep(fq, 140, 0.08), i * 180));
		}
		if (A.cfg("snd_voice")) A.speak(a.say || a.title);
		if (A.cfg("snd_flash")) A.flash();
		A.emit("alert", a);
	};

	// ---------- per-session memory ----------
	let seenOnce = new Set();
	let watchGone = new Map();
	let episodes = new Map();
	let movingRaised = new Set();
	let floodWin = [];
	let floodQuietUntil = 0;
	let ridFirst = new Map();
	let swarmMembers = new Set();
	let swarmQuietUntil = 0;
	let droneNearAt = new Map();

	AL.reset = () => {
		seenOnce = new Set();
		watchGone = new Map();
		episodes = new Map();
		movingRaised = new Set();
		floodWin = [];
		ridFirst = new Map();
		swarmMembers = new Set();
		droneNearAt = new Map();
	};

	function once(key) {
		if (seenOnce.has(key)) return false;
		seenOnce.add(key);
		return true;
	}

	// New-device hooks (flood + first sightings)
	A.on("device-new", (d) => {
		floodWin.push({ at: d.firstSeen, id: d.id, popup: false, nameOnly: false, rssi: d.rssi, d: d });
	});

	A.on("adv", (d) => {
		// refresh flood record flags (first packet may not carry everything)
		for (let i = floodWin.length - 1; i >= 0 && i >= floodWin.length - 60; i--) {
			const r = floodWin[i];
			if (r.id === d.id) {
				r.popup = d.popup;
				r.nameOnly = d.nameOnly;
				r.rssi = d.rssi;
				break;
			}
		}
		if (d.rid && d.rid.uasId && !ridFirst.has(d.rid.uasId)) ridFirst.set(d.rid.uasId, Date.now());
		classChecks(d);
	});

	function classChecks(d) {
		if (A.isMine(d)) return;
		const name = A.label(d);
		if (A.cfg("al_watch") && A.isWatched(d)) {
			const gone = watchGone.get(d.id);
			if (gone == null || gone === true) {
				watchGone.set(d.id, false);
				AL.raise({ type: "watch", level: "high", title: A.t("a.watch.t", { n: name }), body: A.t("a.watch.b", { r: d.rssi }), devId: d.id, say: A.t("a.watch.say", { n: name }) });
			}
		}
		if (!d.sigs || !d.sigs.length) return;
		if (A.cfg("al_bookmark")) {
			for (const f of d.sigs) {
				if (A.Sig.bookmarks.has(f.id) && once("bm:" + f.id + ":" + d.id)) {
					AL.raise({ type: "bookmark", level: "high", title: A.t("a.bm.t", { s: f.name }), body: name + " · " + d.rssi + " dBm", devId: d.id, say: f.name });
				}
			}
		}
		const k = d.kind;
		const map = { HACKING: "al_hack", LAW_ENFORCEMENT: "al_police", SURVEILLANCE: "al_surv", DRONE: "al_drone_class", MILITARY: "al_police" };
		const key = map[k];
		if (key && A.cfg(key) && once("class:" + d.id)) {
			const f = d.sigs[0] || { name: A.kindLabel(k), attention: "" };
			AL.raise({ type: "class", kind: k, level: (k === "HACKING") ? "high" : "mid", title: A.kindLabel(k) + ": " + f.name, body: (f.attention || f.notes || "") + " · " + d.rssi + " dBm", devId: d.id, say: A.kindLabel(k) + ". " + f.name });
		}
	}

	// ---------- periodic evaluation ----------
	AL.tick = () => {
		const now = Date.now();
		const stale = A.cfg("stale") * 1000;
		// watchlist: mark gone so a return alerts again
		for (const id of A.Store.get("watched", [])) {
			const d = A.devices.get(id);
			if (d && now - d.lastSeen > stale) watchGone.set(id, true);
		}
		trackerFollow(now);
		placeMemory(now);
		movingWithYou(now);
		flood(now);
		drones(now);
		if (AL.extraTick) AL.extraTick(now);
	};

	// Separated tag that stays with you: 30 min, no gap over 20 min, 3 spots 100 m apart.
	const FOLLOW_MS = 30 * 60000;
	const GAP_MS = 20 * 60000;
	function trackerFollow(now) {
		if (!A.cfg("al_tracker")) return;
		const f = A.Geo.fresh();
		for (const [k, ep] of episodes) {
			if (now - ep.last > GAP_MS) episodes.delete(k);
		}
		for (const d of A.devices.values()) {
			if (now - d.lastSeen > 15000) continue;
			if (!d.tracker) continue;
			if (A.isMine(d)) {
				episodes.delete(d.tracker.key);
				continue;
			}
			const key = d.tracker.key;
			if (d.tracker.state === "NEAR") {
				episodes.delete(key);
				continue;
			}
			let ep = episodes.get(key);
			if (!ep) {
				ep = { start: now, last: now, spots: [], raised: false, devId: d.id };
				episodes.set(key, ep);
			}
			ep.last = now;
			ep.devId = d.id;
			if (f && !ep.spots.some((s) => A.dist(s.lat, s.lon, f.lat, f.lon) < 100)) ep.spots.push({ lat: f.lat, lon: f.lon });
			if (!ep.raised && now - ep.start >= FOLLOW_MS && ep.spots.length >= 3) {
				ep.raised = true;
				const mins = Math.round((now - ep.start) / 60000);
				AL.raise({ type: "tracker", level: "high", title: A.t("a.trk.t"), body: A.t("a.trk.b", { n: A.label(d), m: mins, p: ep.spots.length }), devId: d.id, say: A.t("a.trk.say") });
			}
		}
	}
	AL.episodes = () => episodes;

	// Finder tag heard at 2+ of your places in the last 7 days (survives reloads).
	const DAY = 86400000;
	let pmSaveAt = 0;
	function placeMemory(now) {
		const f = A.Geo.fresh();
		if (!f) return;
		const mem = A.Store.get("placeMem", {});
		let dirty = false;
		for (const d of A.devices.values()) {
			if (now - d.lastSeen > 15000) continue;
			if (d.kind !== "FINDER" || A.isMine(d)) continue;
			const key = d.id;
			const rec = mem[key] || { name: A.label(d), places: [], raised: false };
			rec.places = rec.places.filter((p) => now - p.last < 7 * DAY);
			let p = rec.places.find((x) => A.dist(x.lat, x.lon, f.lat, f.lon) < 100);
			if (!p) {
				p = { lat: f.lat, lon: f.lon, first: now, last: now, hits: 0 };
				rec.places.push(p);
				if (rec.places.length > 8) rec.places.shift();
			}
			p.last = now;
			p.hits++;
			const counted = rec.places.filter((x) => x.hits >= 2);
			if (counted.length < 2) rec.raised = false;
			if (A.cfg("al_places") && counted.length >= 2 && !rec.raised) {
				rec.raised = true;
				AL.raise({ type: "places", level: "high", title: A.t("a.pl.t"), body: A.t("a.pl.b", { n: A.label(d), p: counted.length }), devId: d.id, say: A.t("a.pl.say") });
			}
			mem[key] = rec;
			dirty = true;
		}
		const keys = Object.keys(mem);
		if (keys.length > 400) {
			keys.sort((a, b) => (Math.max(...mem[a].places.map((p) => p.last), 0) - Math.max(...mem[b].places.map((p) => p.last), 0)));
			for (const k of keys.slice(0, keys.length - 400)) delete mem[k];
		}
		if (dirty && now - pmSaveAt > 10000) {
			pmSaveAt = now;
			A.Store.set("placeMem", mem);
		}
	}
	AL.placeCount = (d) => {
		const rec = A.Store.get("placeMem", {})[d.id];
		if (!rec) return 0;
		return rec.places.filter((x) => x.hits >= 2 && Date.now() - x.last < 7 * DAY).length;
	};

	// Moving with you (Fieldwatch gates, BLE only).
	AL.moving = new Set();
	function trailLen(t) {
		let m = 0;
		for (let i = 1; i < t.length; i++) m += A.dist(t[i - 1].lat, t[i - 1].lon, t[i].lat, t[i].lon);
		return m;
	}
	function bboxDiag(t) {
		let a = 90;
		let b = -90;
		let c = 180;
		let e = -180;
		for (const p of t) {
			a = Math.min(a, p.lat);
			b = Math.max(b, p.lat);
			c = Math.min(c, p.lon);
			e = Math.max(e, p.lon);
		}
		return A.dist(a, c, b, e);
	}
	AL.trailLen = trailLen;
	function movingWithYou(now) {
		const out = new Set();
		const f = A.Geo.fresh();
		if (f && A.Geo.pathM >= 45) {
			const spd = A.Geo.recentSpeed();
			const allowed = Math.max(50, spd * 15) + 25;
			for (const d of A.devices.values()) {
				if (A.isMine(d)) continue;
				if (now - d.lastSeen > 90000) continue;
				if (d.rssi == null || d.rssi < -75) continue;
				const t = d.trail;
				if (t.length < 2) continue;
				const len = trailLen(t);
				if (len < 27 || bboxDiag(t) < 27) continue;
				const loud = t.filter((p) => p.rssi >= -75).length;
				if (loud < (t.length * 2 / 3)) continue;
				const last = t[t.length - 1];
				if (A.dist(last.lat, last.lon, f.lat, f.lon) > allowed) continue;
				out.add(d.id);
				if (A.cfg("al_moving") && len >= A.cfg("moving_min_m") && !movingRaised.has(d.id)) {
					movingRaised.add(d.id);
					const lvl = (d.kind === "FINDER") ? "high" : "mid";
					AL.raise({ type: "moving", level: lvl, title: A.t("a.mov.t", { n: A.label(d) }), body: A.t("a.mov.b", { m: A.fmtDist(len), r: d.rssi }), devId: d.id, say: A.t("a.mov.say") });
				}
			}
		}
		AL.moving = out;
	}

	// Pairing / name floods: 10 s window, 10 popup addresses or 15 name-only addresses.
	function flood(now) {
		floodWin = floodWin.filter((r) => now - r.at <= 10000);
		if (!A.cfg("al_flood") || now < floodQuietUntil) return;
		const pop = floodWin.filter((r) => r.popup);
		const nam = floodWin.filter((r) => r.nameOnly && !r.popup);
		if (pop.length >= 10 || nam.length >= 15) {
			const set = (pop.length >= 10) ? pop : nam;
			const fams = Array.from(new Set(set.map((r) => A.Decode.popupFamily(r.d)).filter(Boolean)));
			const rs = set.map((r) => r.rssi).filter((x) => x != null).sort((a, b) => a - b);
			const med = rs.length ? rs[Math.floor(rs.length / 2)] : null;
			floodQuietUntil = now + 60000;
			const title = (pop.length >= 10) ? A.t("a.fl.pair") : A.t("a.fl.name");
			AL.raise({ type: "flood", level: "high", title: title, body: A.t("a.fl.b", { c: set.length, f: fams.join(", ") || "—", r: (med == null) ? "?" : med }), say: title });
		}
	}

	// Drones: perimeter (broadcasting inside N m) and swarm (N new IDs inside window).
	function drones(now) {
		const f = A.Geo.fresh();
		if (A.cfg("al_drone_near") && f) {
			const lim = A.cfg("drone_near_m");
			for (const d of A.devices.values()) {
				const r = d.rid;
				if (!r || r.lat == null || now - d.lastSeen > 15000) continue;
				const m = A.dist(f.lat, f.lon, r.lat, r.lon);
				const key = r.uasId || d.id;
				if (m <= lim && (!droneNearAt.has(key) || now - droneNearAt.get(key) > 600000)) {
					droneNearAt.set(key, now);
					AL.raise({ type: "drone-near", level: "high", title: A.t("a.dn.t", { d: A.fmtDist(lim) }), body: A.t("a.dn.b", { n: A.label(d), m: A.fmtDist(m), a: (r.height != null) ? (Math.round(r.height) + " m") : ((r.alt != null) ? (Math.round(r.alt) + " m GPS") : "?") }), devId: d.id, lat: r.lat, lon: r.lon, say: A.t("a.dn.say", { m: Math.round(m) }) });
				}
			}
		}
		if (A.cfg("al_drone_swarm") && now >= swarmQuietUntil) {
			const win = A.cfg("swarm_win") * 1000;
			const fresh = [];
			for (const [id, at] of ridFirst) {
				if (!swarmMembers.has(id) && now - at <= win) fresh.push(id);
			}
			if (fresh.length >= A.cfg("swarm_min")) {
				fresh.forEach((id) => swarmMembers.add(id));
				swarmQuietUntil = now + (A.cfg("swarm_quiet") * 60000);
				AL.raise({ type: "swarm", level: "high", title: A.t("a.sw.t"), body: A.t("a.sw.b", { c: fresh.length, s: A.cfg("swarm_win") }), say: A.t("a.sw.t") });
			}
		}
	}

	// Trend: mean RSSI of the last 5 s against 5–20 s ago. >0 = getting louder (closer).
	A.trend = (d) => {
		const now = Date.now();
		let a = 0;
		let na = 0;
		let b = 0;
		let nb = 0;
		for (const h of d.hist) {
			const age = now - h[0];
			if (age <= 5000) {
				a += h[1];
				na++;
			} else if (age <= 20000) {
				b += h[1];
				nb++;
			}
		}
		if (!na || !nb) return 0;
		return (a / na) - (b / nb);
	};

	// Approaching: a device not marked Mine got 15 dB louder within ~20 s and is now close.
	let approachAt = new Map();
	let approachGlobal = 0;
	function approaching(now) {
		if (!A.cfg("al_approach") || now - approachGlobal < 30000) return;
		for (const d of A.devices.values()) {
			if (A.isMine(d) || now - d.lastSeen > 5000 || d.rssi == null || d.rssi < -60) continue;
			if (A.trend(d) < 15) continue;
			if (approachAt.has(d.id) && now - approachAt.get(d.id) < 600000) continue;
			approachAt.set(d.id, now);
			approachGlobal = now;
			AL.raise({ type: "approach", level: "mid", title: A.t("a.ap.t", { n: A.label(d) }), body: A.t("a.ap.b", { r: d.rssi }), devId: d.id, say: A.t("a.ap.say") });
			break;
		}
	}
	AL.extraTick = approaching;

	A.on("gps-jump", (j) => {
		if (!A.cfg("al_gps")) return;
		AL.raise({ type: "gps", level: "high", title: A.t("a.gps.t"), body: A.t("a.gps.b", { m: A.fmtDist(j.meters), s: Math.round(j.seconds) }), lat: j.to.lat, lon: j.to.lon, say: A.t("a.gps.t") });
	});
	A.on("gps-degraded", (j) => {
		if (!A.cfg("al_gps")) return;
		AL.raise({ type: "gps", level: "mid", title: A.t("a.gpsd.t"), body: A.t("a.gpsd.b", { a: Math.round(j.to.acc) }), say: A.t("a.gpsd.t") });
	});
})(window.Argus);
