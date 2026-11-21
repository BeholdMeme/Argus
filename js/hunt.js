// Argus — Hunt: walk a Bluetooth radio down by loudness, with a heat trail on a map.
"use strict";
(function (A) {
	const H = A.Hunt = { id: null, peak: null, samples: [], sound: false, map: null, heat: null, me: null, peakMk: null };

	H.select = (id) => {
		if (H.id !== id) {
			H.id = id;
			H.peak = null;
			H.samples = [];
			const d0 = A.devices.get(id);
			if (d0 && d0.rssi != null) H.peak = { rssi: d0.rssi, at: d0.lastSeen, lat: null, lon: null };
			if (H.heat) H.heat.clearLayers();
			if (H.peakMk) {
				H.peakMk.remove();
				H.peakMk = null;
			}
		}
		A.UI.closeSheet();
		A.UI.tab("hunt");
		H.render();
	};

	A.on("adv", (d) => {
		if (d.id !== H.id || d.rssi == null) return;
		const now = Date.now();
		if (!H.peak || d.rssi > H.peak.rssi) H.peak = { rssi: d.rssi, at: now, lat: null, lon: null };
		const f = A.Geo.fresh();
		if (f) {
			if (H.peak.at === now) {
				H.peak.lat = f.lat;
				H.peak.lon = f.lon;
			}
			const last = H.samples[H.samples.length - 1];
			if (!last || A.dist(last.lat, last.lon, f.lat, f.lon) >= 2 || now - last.at > 5000) {
				H.samples.push({ lat: f.lat, lon: f.lon, rssi: d.rssi, at: now });
				if (H.samples.length > 3000) H.samples.shift();
				addHeat(H.samples[H.samples.length - 1]);
			} else if (d.rssi > last.rssi) {
				last.rssi = d.rssi;
			}
		}
	});

	function initMap() {
		if (H.map) return;
		H.map = L.map(A.$("#hunt-map"), { zoomControl: false, attributionControl: false }).setView([55.7558, 37.6173], 18);
		A.Map.tileLayer(A.cfg("basemap")).addTo(H.map);
		H.heat = L.layerGroup().addTo(H.map);
		H.me = L.circleMarker([0, 0], { radius: 6, color: "#fff", weight: 2, fillColor: "#4da3ff", fillOpacity: 1 });
	}

	function addHeat(s) {
		if (!H.map) return;
		const f = A.rssi01(s.rssi);
		L.circleMarker([s.lat, s.lon], { radius: 9, stroke: false, fillColor: A.heatColor(f), fillOpacity: 0.55 }).bindTooltip(s.rssi + " dBm").addTo(H.heat);
	}

	function words(r) {
		if (r == null) return "";
		if (r >= -45) return A.t("hunt.w1");
		if (r >= -60) return A.t("hunt.w2");
		if (r >= -72) return A.t("hunt.w3");
		if (r >= -85) return A.t("hunt.w4");
		return A.t("hunt.w5");
	}

	H.back = () => {
		H.id = null;
		H.render();
	};

	// ---------- Radar (all devices; radius = loudness, angle = fixed seat, NOT a direction) ----------
	let blips = [];
	H.drawRadar = () => {
		const cv = A.$("#radar");
		if (!cv || A.$("#radar-box").classList.contains("hidden")) return;
		const rect = cv.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;
		const W = Math.max(200, Math.round(rect.width));
		const Hh = W;
		if (cv.width !== W * dpr) {
			cv.width = W * dpr;
			cv.height = Hh * dpr;
			cv.style.height = Hh + "px";
		}
		const g = cv.getContext("2d");
		g.setTransform(dpr, 0, 0, dpr, 0, 0);
		g.clearRect(0, 0, W, Hh);
		const cx = W / 2;
		const cy = Hh / 2;
		const R = (W / 2) - 14;
		const night = document.body.classList.contains("night");
		const ring = night ? "rgba(255,60,60,0.35)" : "rgba(120,170,255,0.25)";
		g.strokeStyle = ring;
		g.fillStyle = night ? "#ff6b6b" : "#7a8aa0";
		g.font = "10px -apple-system, system-ui, sans-serif";
		g.lineWidth = 1;
		[-40, -60, -80, -100].forEach((db) => {
			const rad = Math.max(6, R * ((-30 - db) / 70));
			g.beginPath();
			g.arc(cx, cy, rad, 0, Math.PI * 2);
			g.stroke();
			g.fillText(db + "", cx + 3, cy - rad + 11);
		});
		g.beginPath();
		g.moveTo(cx - R, cy);
		g.lineTo(cx + R, cy);
		g.moveTo(cx, cy - R);
		g.lineTo(cx, cy + R);
		g.stroke();
		g.fillStyle = "#4da3ff";
		g.beginPath();
		g.arc(cx, cy, 5, 0, Math.PI * 2);
		g.fill();
		const now = Date.now();
		const stale = A.cfg("stale") * 1000;
		const mode = A.$("#radar-show").value;
		blips = [];
		const list = [];
		for (const d of A.devices.values()) {
			if (now - d.lastSeen > stale || d.rssiS == null) continue;
			if (mode === "matched" && !d.sigs.length) continue;
			if (mode !== "all" && A.isMine(d)) continue;
			if (mode === "moving" && !A.Alerts.moving.has(d.id)) continue;
			list.push(d);
		}
		list.sort((a, b) => ((a.sigs.length ? 1 : 0) - (b.sigs.length ? 1 : 0)));
		for (const d of list) {
			const rad = Math.max(8, Math.min(R, R * ((-30 - d.rssiS) / 70)));
			const ang = A.hash01(d.id) * Math.PI * 2;
			const x = cx + (Math.cos(ang) * rad);
			const y = cy + (Math.sin(ang) * rad);
			const k = A.KINDS[d.kind];
			const col = k ? k.color : A.rssiColor(d.rssi);
			const named = d.sigs.length > 0;
			const dim = (now - d.lastSeen) > 10000;
			g.globalAlpha = dim ? 0.35 : 1;
			if (named) {
				g.fillStyle = col;
				g.globalAlpha = (dim ? 0.15 : 0.25);
				g.beginPath();
				g.arc(x, y, 11, 0, Math.PI * 2);
				g.fill();
				g.globalAlpha = dim ? 0.35 : 1;
			}
			g.fillStyle = col;
			g.beginPath();
			g.arc(x, y, named ? 6 : 4, 0, Math.PI * 2);
			g.fill();
			if (A.isWatched(d)) {
				g.strokeStyle = "#fff";
				g.lineWidth = 2;
				g.beginPath();
				g.arc(x, y, 9, 0, Math.PI * 2);
				g.stroke();
				g.lineWidth = 1;
			}
			const tr = A.trend(d);
			if (Math.abs(tr) >= 4 && !dim) {
				g.fillStyle = (tr > 0) ? "#ff5a5a" : "#7ad7ff";
				g.font = "bold 11px system-ui";
				g.fillText((tr > 0) ? "▲" : "▼", x + 7, y + 4);
			}
			const loud = ["FINDER", "DRONE", "HACKING", "LAW_ENFORCEMENT", "SURVEILLANCE", "MILITARY", "CAMERA", "GLASSES"].indexOf(d.kind) >= 0;
			if (loud || A.isWatched(d) || (named && list.length <= 25)) {
				g.fillStyle = night ? "#ffb4b4" : "#e6edf6";
				g.font = "10px system-ui";
				const lab = A.label(d);
				const txt = (lab.length > 18) ? (lab.substring(0, 17) + "…") : lab;
				if (x > W * 0.6) {
					g.textAlign = "right";
					g.fillText(txt, x - 8, y - 6);
					g.textAlign = "left";
				} else g.fillText(txt, x + 8, y - 6);
			}
			g.globalAlpha = 1;
			blips.push({ x: x, y: y, id: d.id });
		}
		A.$("#radar-count").textContent = A.t("radar.count", { n: list.length });
	};

	H.radarTap = (ev) => {
		const cv = A.$("#radar");
		const r = cv.getBoundingClientRect();
		const x = ev.clientX - r.left;
		const y = ev.clientY - r.top;
		let best = null;
		let bd = 26;
		for (const b of blips) {
			const dd = Math.hypot(b.x - x, b.y - y);
			if (dd < bd) {
				bd = dd;
				best = b;
			}
		}
		if (best) A.UI.openDevice(best.id);
	};

	H.render = () => {
		const d = H.id ? A.devices.get(H.id) : null;
		A.$("#radar-box").classList.toggle("hidden", !!d);
		A.$("#hunt-box").classList.toggle("hidden", !d);
		if (!d) {
			H.drawRadar();
			return;
		}
		initMap();
		const now = Date.now();
		const age = now - d.lastSeen;
		const r = (d.rssiS == null) ? null : Math.round(d.rssiS);
		A.$("#hunt-name").textContent = A.label(d);
		A.$("#hunt-sig").textContent = (d.sigs.map((f) => f.name).join(", ") || d.company || "") + (A.isMine(d) ? (" · " + A.t("sh.mine")) : "");
		const lost = age > 8000;
		A.$("#hunt-rssi").textContent = (r == null || lost) ? "--" : r;
		A.$("#hunt-rssi").style.color = lost ? "#666" : A.rssiColor(r);
		const tr = A.trend(d);
		const te = A.$("#hunt-trend");
		if (lost) te.textContent = A.t("hunt.lost");
		else if (tr >= 3) te.textContent = "▲ " + A.t("hunt.warmer");
		else if (tr <= -3) te.textContent = "▼ " + A.t("hunt.colder");
		else te.textContent = "• " + A.t("hunt.steady");
		te.className = "hunt-trend " + ((tr >= 3) ? "up" : ((tr <= -3) ? "down" : ""));
		A.$("#hunt-bar").style.width = (lost ? 0 : (A.rssi01(r == null ? -100 : r) * 100)) + "%";
		A.$("#hunt-bar").style.background = A.rssiColor(r);
		A.$("#hunt-words").textContent = lost ? "" : words(r);
		A.$("#hunt-peak").textContent = H.peak ? (H.peak.rssi + " dBm · " + A.fmtAgo(now - H.peak.at)) : "--";
		A.$("#hunt-age").textContent = A.fmtAgo(age);
		A.$("#hunt-sound").textContent = A.t(H.sound ? "hunt.sound.on" : "hunt.sound.off");
		const f = A.Geo.fix;
		A.$("#hunt-map").classList.toggle("dim", !A.Geo.on);
		if (H.map && f) {
			H.me.setLatLng([f.lat, f.lon]);
			if (!H.map.hasLayer(H.me)) {
				H.me.addTo(H.map);
				H.map.setView([f.lat, f.lon], 19);
			}
			if (H.peak && H.peak.lat != null) {
				if (!H.peakMk) H.peakMk = L.marker([H.peak.lat, H.peak.lon], { icon: L.divIcon({ className: "peak-ic", html: "★", iconSize: [20, 20], iconAnchor: [10, 10] }) }).addTo(H.map);
				H.peakMk.setLatLng([H.peak.lat, H.peak.lon]);
			}
		}
	};

	H.invalidate = () => {
		if (H.map) setTimeout(() => H.map.invalidateSize(), 50);
	};

	H.resetPeak = () => {
		H.peak = null;
		if (H.peakMk) {
			H.peakMk.remove();
			H.peakMk = null;
		}
		H.render();
	};

	H.toggleSound = () => {
		H.sound = !H.sound;
		A.unlockAudio();
		H.render();
	};

	// Geiger clicks: faster when louder.
	let nextClick = 0;
	H.soundTick = () => {
		if (!H.sound || !H.id) return;
		const d = A.devices.get(H.id);
		if (!d || d.rssiS == null || Date.now() - d.lastSeen > 8000) return;
		const now = Date.now();
		if (now < nextClick) return;
		const f = A.rssi01(d.rssiS);
		A.beep(600 + (f * 1400), 30, 0.07);
		nextClick = now + Math.max(70, 1200 - (f * 1130));
	};
})(window.Argus);
