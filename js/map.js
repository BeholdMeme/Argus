// Argus — live map: your path, where each radio was heard loudest, live drones + pilots,
// known cameras (OpenStreetMap), offline tile cache.
"use strict";
(function (A) {
	const M = A.Map = { map: null, ready: false, markers: new Map(), drones: new Map(), camLayer: null };
	const TILE_CACHE = "argus-tiles-v1";
	const MOSCOW = [55.7558, 37.6173];

	M.BASEMAPS = {
		osm: { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", max: 19, attr: "© OpenStreetMap contributors" },
		topo: { url: "https://a.tile.opentopomap.org/{z}/{x}/{y}.png", max: 17, attr: "© OpenStreetMap contributors, SRTM · © OpenTopoMap (CC-BY-SA)" },
		sat: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", max: 19, attr: "Tiles © Esri — Esri, Maxar, Earthstar Geographics" },
	};

	const hasCache = () => (typeof caches !== "undefined" && window.isSecureContext);

	async function tileSrc(url) {
		if (hasCache()) {
			try {
				const c = await caches.open(TILE_CACHE);
				const hit = await c.match(url);
				if (hit) return URL.createObjectURL(await hit.blob());
				if (!navigator.onLine) return null;
				const res = await fetch(url, { mode: "cors" });
				if (res.ok) {
					c.put(url, res.clone()).catch(() => {});
					return URL.createObjectURL(await res.blob());
				}
			} catch (e) {
				// fall back to plain image
			}
		}
		return navigator.onLine ? url : null;
	}

	const CachedLayer = L.TileLayer.extend({
		createTile: function (coords, done) {
			const img = document.createElement("img");
			img.alt = "";
			img.setAttribute("role", "presentation");
			const url = this.getTileUrl(coords);
			tileSrc(url).then((src) => {
				if (!src) {
					done(new Error("offline"), img);
					return;
				}
				img.onload = () => {
					if (src.startsWith("blob:")) setTimeout(() => URL.revokeObjectURL(src), 1000);
					done(null, img);
				};
				img.onerror = (e) => done(e, img);
				img.src = src;
			});
			return img;
		},
	});

	function makeBase(key) {
		const b = M.BASEMAPS[key] || M.BASEMAPS.osm;
		return new CachedLayer(b.url, { maxZoom: b.max, maxNativeZoom: b.max, attribution: b.attr, crossOrigin: true });
	}

	M.init = () => {
		if (M.ready) return;
		const el = A.$("#map");
		const last = A.Store.get("mapView", null);
		M.map = L.map(el, { zoomControl: false, attributionControl: true, preferCanvas: true }).setView(last ? last.c : MOSCOW, last ? last.z : 12);
		L.control.zoom({ position: "bottomright" }).addTo(M.map);
		L.control.scale({ metric: true, imperial: false, position: "bottomleft" }).addTo(M.map);
		M.base = makeBase(A.cfg("basemap")).addTo(M.map);
		M.pathLine = L.polyline([], { color: "#4da3ff", weight: 3, opacity: 0.8 }).addTo(M.map);
		M.me = L.circleMarker(MOSCOW, { radius: 7, color: "#fff", weight: 2, fillColor: "#4da3ff", fillOpacity: 1 });
		M.meAcc = L.circle(MOSCOW, { radius: 10, color: "#4da3ff", weight: 1, fillOpacity: 0.08 });
		M.devLayer = L.layerGroup().addTo(M.map);
		M.droneLayer = L.layerGroup().addTo(M.map);
		M.camLayer = L.layerGroup();
		if (A.cfg("cameras")) M.camLayer.addTo(M.map);
		M.map.on("moveend", () => A.Store.set("mapView", { c: [M.map.getCenter().lat, M.map.getCenter().lng], z: M.map.getZoom() }));
		M.map.on("popupopen", (e) => {
			const node = e.popup.getElement();
			if (!node) return;
			A.$$("[data-act]", node).forEach((b) => b.addEventListener("click", () => {
				const id = b.getAttribute("data-id");
				if (b.getAttribute("data-act") === "detail") A.UI.openDevice(id);
				if (b.getAttribute("data-act") === "hunt") A.Hunt.select(id);
			}));
		});
		M.ready = true;
		M.loadCameras();
		M.update(true);
	};

	M.setBase = (key) => {
		A.setCfg("basemap", key);
		if (!M.ready) return;
		M.map.removeLayer(M.base);
		M.base = makeBase(key).addTo(M.map);
		M.base.bringToBack();
	};

	M.center = () => {
		if (!M.ready) return;
		const f = A.Geo.fix;
		if (f) M.map.setView([f.lat, f.lon], Math.max(M.map.getZoom(), 16));
		else A.toast(A.t("gps.wait"));
	};

	M.focus = (id) => {
		const d = A.devices.get(id);
		if (!d) return;
		A.UI.tab("map");
		setTimeout(() => {
			M.map.invalidateSize();
			const p = (d.rid && d.rid.lat != null) ? [d.rid.lat, d.rid.lon] : (d.best ? [d.best.lat, d.best.lon] : null);
			if (p) {
				M.map.setView(p, 17);
				const mk = M.markers.get(id) || (M.drones.get(id) || {}).drone;
				if (mk) mk.openPopup();
			} else A.toast(A.t("map.nopos"));
		}, 60);
	};

	function show(d, mode) {
		if (A.isMine(d)) return false;
		if (mode === "matched") return d.sigs.length > 0;
		if (mode === "watched") return A.isWatched(d);
		if (mode === "moving") return A.Alerts.moving.has(d.id);
		return true;
	}

	function popupHtml(d) {
		const sig = d.sigs.length ? ("<div class='pp-sig'>" + A.esc(d.sigs.map((f) => f.name).join(", ")) + "</div>") : "";
		return "<div class='pp'><b>" + A.esc(A.label(d)) + "</b>" + sig +
			"<div>" + (d.rssi != null ? (d.rssi + " dBm · ") : "") + A.t("dev.ago", { t: A.fmtAgo(Date.now() - d.lastSeen) }) + "</div>" +
			(d.best ? ("<div class='pp-dim'>" + A.t("map.where") + "</div>") : "") +
			"<div class='pp-btns'><button data-act='detail' data-id='" + A.esc(d.id) + "'>" + A.t("btn.details") + "</button><button data-act='hunt' data-id='" + A.esc(d.id) + "'>" + A.t("sh.hunt") + "</button></div></div>";
	}

	M.update = (force) => {
		if (!M.ready) return;
		if (!force && !A.$("#tab-map").classList.contains("active")) return;
		const f = A.Geo.fix;
		if (f) {
			M.me.setLatLng([f.lat, f.lon]);
			M.meAcc.setLatLng([f.lat, f.lon]).setRadius(f.acc || 10);
			if (!M.map.hasLayer(M.me)) {
				M.meAcc.addTo(M.map);
				M.me.addTo(M.map);
				if (!A.Store.get("mapView", null)) M.map.setView([f.lat, f.lon], 16);
			}
		}
		M.pathLine.setLatLngs(A.Geo.path.map((p) => [p.lat, p.lon]));
		const mode = A.$("#map-show").value;
		const now = Date.now();
		const stale = A.cfg("stale") * 1000;
		const keep = new Set();
		for (const d of A.devices.values()) {
			if (!d.best || !show(d, mode)) continue;
			keep.add(d.id);
			const k = A.KINDS[d.kind];
			const color = k ? k.color : A.rssiColor(d.rssiMax);
			const fresh = (now - d.lastSeen) < stale;
			let mk = M.markers.get(d.id);
			if (!mk) {
				mk = L.circleMarker([d.best.lat, d.best.lon], { radius: k ? 8 : 5, weight: k ? 2 : 1, color: "#000", fillColor: color, fillOpacity: 0.9 });
				mk.bindPopup("");
				mk.addTo(M.devLayer);
				M.markers.set(d.id, mk);
			}
			mk.setLatLng([d.best.lat, d.best.lon]);
			mk.setStyle({ fillColor: color, fillOpacity: fresh ? 0.9 : 0.35, color: A.isWatched(d) ? "#fff" : "#000" });
			if (mk.isPopupOpen()) {
				// keep open popup content stable
			} else mk.setPopupContent(popupHtml(d));
		}
		for (const [id, mk] of M.markers) {
			if (!keep.has(id)) {
				M.devLayer.removeLayer(mk);
				M.markers.delete(id);
			}
		}
		updateDrones(now);
	};

	const droneIcon = L.divIcon({ className: "drone-ic", html: "✈", iconSize: [26, 26], iconAnchor: [13, 13] });
	const pilotIcon = L.divIcon({ className: "pilot-ic", html: "P", iconSize: [22, 22], iconAnchor: [11, 11] });

	function updateDrones(now) {
		const keep = new Set();
		for (const d of A.devices.values()) {
			const r = d.rid;
			if (!r || r.lat == null) continue;
			keep.add(d.id);
			let g = M.drones.get(d.id);
			if (!g) {
				g = {
					drone: L.marker([r.lat, r.lon], { icon: droneIcon }).bindPopup("").addTo(M.droneLayer),
					pilot: L.marker([r.lat, r.lon], { icon: pilotIcon }).bindPopup(""),
					link: L.polyline([], { color: "#ff9f1a", weight: 1.5, dashArray: "4 4" }),
					trail: L.polyline([], { color: "#ff9f1a", weight: 2.5, opacity: 0.8 }).addTo(M.droneLayer),
				};
				M.drones.set(d.id, g);
			}
			const old = (now - d.lastSeen) > 30000;
			g.drone.setLatLng([r.lat, r.lon]).setOpacity(old ? 0.4 : 1);
			const txt = "<div class='pp'><b>" + A.esc(A.label(d)) + "</b><div>" + A.esc(r.uaType || "") + " · " + A.esc(r.status || "") + "</div><div>" +
				((r.height != null) ? (A.t("rid.height") + " " + Math.round(r.height) + " m · ") : "") + ((r.speed != null) ? (r.speed.toFixed(1) + " m/s") : "") + "</div>" +
				"<div class='pp-dim'>" + A.t("dev.ago", { t: A.fmtAgo(now - d.lastSeen) }) + "</div>" +
				"<div class='pp-btns'><button data-act='detail' data-id='" + A.esc(d.id) + "'>" + A.t("btn.details") + "</button></div></div>";
			if (!g.drone.isPopupOpen()) g.drone.setPopupContent(txt);
			g.trail.setLatLngs(d.ridTrail.map((p) => [p.lat, p.lon]));
			if (r.opLat != null) {
				g.pilot.setLatLng([r.opLat, r.opLon]);
				if (!g.pilot.isPopupOpen()) g.pilot.setPopupContent("<b>" + A.t("rid.pilot") + "</b><br>" + A.esc(r.operatorId || r.uasId || ""));
				g.link.setLatLngs([[r.opLat, r.opLon], [r.lat, r.lon]]);
				if (!M.droneLayer.hasLayer(g.pilot)) {
					g.pilot.addTo(M.droneLayer);
					g.link.addTo(M.droneLayer);
				}
			}
		}
		for (const [id, g] of M.drones) {
			if (keep.has(id)) continue;
			[g.drone, g.pilot, g.link, g.trail].forEach((l) => M.droneLayer.removeLayer(l));
			M.drones.delete(id);
		}
	}

	// ---------- offline area ----------
	function lon2x(lon, z) {
		return Math.floor(((lon + 180) / 360) * Math.pow(2, z));
	}
	function lat2y(lat, z) {
		const r = lat * Math.PI / 180;
		return Math.floor(((1 - Math.log(Math.tan(r) + (1 / Math.cos(r))) / Math.PI) / 2) * Math.pow(2, z));
	}

	M.saveArea = async () => {
		if (!M.ready) return;
		if (!hasCache()) {
			A.toast(A.t("map.nocache"));
			return;
		}
		if (!navigator.onLine) {
			A.toast(A.t("map.offline"));
			return;
		}
		const b = M.map.getBounds();
		const z0 = M.map.getZoom();
		const base = M.BASEMAPS[A.cfg("basemap")] || M.BASEMAPS.osm;
		const zMax = Math.min(base.max, 17, z0 + 3);
		const jobs = [];
		for (let z = Math.max(3, z0 - 2); z <= zMax; z++) {
			const x0 = lon2x(b.getWest(), z);
			const x1 = lon2x(b.getEast(), z);
			const y0 = lat2y(b.getNorth(), z);
			const y1 = lat2y(b.getSouth(), z);
			for (let x = x0; x <= x1; x++) {
				for (let y = y0; y <= y1; y++) jobs.push(base.url.replace("{z}", z).replace("{x}", x).replace("{y}", y));
			}
		}
		const LIMIT = 1500;
		if (jobs.length > LIMIT) {
			A.toast(A.t("map.toobig", { n: jobs.length, l: LIMIT }), 4000);
			return;
		}
		const c = await caches.open(TILE_CACHE);
		let done = 0;
		let fail = 0;
		const note = A.$("#map-note");
		const worker = async () => {
			while (jobs.length) {
				const url = jobs.shift();
				try {
					const hit = await c.match(url);
					if (!hit) {
						const res = await fetch(url, { mode: "cors" });
						if (res.ok) await c.put(url, res);
						else fail++;
					}
				} catch (e) {
					fail++;
				}
				done++;
				if (done % 10 === 0) note.textContent = A.t("map.saving", { d: done });
			}
		};
		await Promise.all([worker(), worker(), worker()]);
		note.textContent = A.t("map.saved", { d: done - fail, f: fail });
		setTimeout(() => {
			note.textContent = "";
		}, 6000);
	};

	M.clearTiles = async () => {
		if (hasCache()) await caches.delete(TILE_CACHE);
		A.toast(A.t("map.cleared"));
	};

	// ---------- known cameras (OpenStreetMap surveillance + speed cameras) ----------
	M.cams = [];
	M.loadCameras = async () => {
		const list = await A.Store.kvGet("cameras");
		M.cams = list || [];
		M.drawCameras();
	};

	M.drawCameras = () => {
		if (!M.camLayer) return;
		M.camLayer.clearLayers();
		for (const c of M.cams) {
			const color = (c.kind === "speed") ? "#facc15" : ((c.kind === "alpr") ? "#ff4d4d" : "#38e0c8");
			L.circleMarker([c.lat, c.lon], { radius: 4, weight: 1, color: "#000", fillColor: color, fillOpacity: 0.85 })
				.bindPopup("<b>" + A.esc(A.t("cam." + c.kind)) + "</b>" + (c.note ? ("<br>" + A.esc(c.note)) : "") + "<div class='pp-dim'>OpenStreetMap</div>")
				.addTo(M.camLayer);
		}
	};

	M.toggleCameras = (on) => {
		A.setCfg("cameras", !!on);
		if (!M.ready) return;
		if (on) M.camLayer.addTo(M.map);
		else M.map.removeLayer(M.camLayer);
	};

	M.fetchCameras = async () => {
		if (!M.ready) return;
		if (M.map.getZoom() < 12) {
			A.toast(A.t("cam.zoom"));
			return;
		}
		const b = M.map.getBounds();
		const bb = [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()].map((v) => v.toFixed(5)).join(",");
		const q = "[out:json][timeout:25];(node[\"man_made\"=\"surveillance\"](" + bb + ");node[\"highway\"=\"speed_camera\"](" + bb + ");node[\"enforcement\"](" + bb + "););out body 3000;";
		const urls = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
		A.toast(A.t("cam.loading"));
		for (const u of urls) {
			try {
				const res = await fetch(u, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded" } });
				if (!res.ok) continue;
				const j = await res.json();
				const add = [];
				for (const e of (j.elements || [])) {
					if (e.lat == null) continue;
					const t = e.tags || {};
					let kind = "camera";
					if (t.highway === "speed_camera" || t.enforcement === "maxspeed") kind = "speed";
					if (/alpr|anpr|plate/i.test((t["surveillance:type"] || "") + " " + (t["camera:type"] || "") + " " + (t.surveillance || "") + " " + (t.description || ""))) kind = "alpr";
					const note = [t.operator, t["surveillance:zone"], t["camera:type"], t.description].filter(Boolean).join(" · ");
					add.push({ id: "osm" + e.id, lat: e.lat, lon: e.lon, kind: kind, note: note });
				}
				const map = new Map(M.cams.map((c) => [c.id, c]));
				add.forEach((c) => map.set(c.id, c));
				M.cams = Array.from(map.values());
				await A.Store.kvSet("cameras", M.cams);
				M.drawCameras();
				A.toast(A.t("cam.loaded", { n: add.length, t: M.cams.length }), 3500);
				return;
			} catch (e) {
				// try next mirror
			}
		}
		A.toast(A.t("cam.fail"));
	};

	M.importCameras = async (text) => {
		const j = JSON.parse(text);
		const feats = j.features || [];
		const map = new Map(M.cams.map((c) => [c.id, c]));
		let n = 0;
		for (const f of feats) {
			const g = f.geometry;
			if (!g || g.type !== "Point") continue;
			const p = f.properties || {};
			const kind = (/speed/i.test(p.kind || "")) ? "speed" : ((/alpr|flock|plate/i.test(p.kind || p.type || "")) ? "alpr" : "camera");
			const id = "imp" + (p.osmId || p.id || (g.coordinates[0].toFixed(6) + "," + g.coordinates[1].toFixed(6)));
			map.set(id, { id: id, lat: g.coordinates[1], lon: g.coordinates[0], kind: kind, note: p.name || p.operator || p.kind || "" });
			n++;
		}
		M.cams = Array.from(map.values());
		await A.Store.kvSet("cameras", M.cams);
		M.drawCameras();
		return n;
	};

	M.clearCameras = async () => {
		M.cams = [];
		await A.Store.kvSet("cameras", []);
		M.drawCameras();
	};

	M.tileLayer = makeBase;
})(window.Argus);
