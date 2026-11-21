// Argus — startup, wiring, timers, pocket mode, wake lock, demo data.
"use strict";
(function (A) {
	A.VERSION = "1.0.0";
	const $ = A.$;

	// ---------- wake lock (keep screen on while scanning) ----------
	const Wake = A.Wake = { lock: null, state: "" };
	Wake.on = async () => {
		try {
			if (!("wakeLock" in navigator)) {
				Wake.state = A.t("wake.no");
				return;
			}
			Wake.lock = await navigator.wakeLock.request("screen");
			Wake.state = A.t("wake.yes");
			Wake.lock.addEventListener("release", () => {
				Wake.state = A.t("wake.released");
			});
		} catch (e) {
			Wake.state = A.t("wake.no");
		}
	};
	Wake.off = () => {
		try {
			if (Wake.lock) Wake.lock.release();
		} catch (e) {
			// ignore
		}
		Wake.lock = null;
	};
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible" && A.Scan.running) Wake.on();
		if (document.visibilityState === "hidden") A.Session.save();
	});

	// ---------- pocket mode: black screen, scanning continues ----------
	const P = A.Pocket = { on: false };
	P.enter = () => {
		P.on = true;
		$("#pocket").classList.remove("hidden");
		P.tick();
	};
	P.exit = () => {
		P.on = false;
		$("#pocket").classList.add("hidden");
	};
	P.tick = () => {
		if (!P.on) return;
		const now = Date.now();
		let fresh = 0;
		for (const d of A.devices.values()) if (now - d.lastSeen < 60000) fresh++;
		$("#pocket-info").textContent = (A.Scan.running ? "● " : "○ ") + fresh + " · " + A.fmtClock(now).substring(0, 5);
	};
	P.alert = (a) => {
		if (!P.on) return;
		const el = $("#pocket-alert");
		el.textContent = a.title;
		el.classList.remove("hidden");
		setTimeout(() => el.classList.add("hidden"), 15000);
	};

	// ---------- scan button ----------
	async function toggleScan() {
		A.unlockAudio();
		if (A.Scan.running) {
			A.Scan.stop();
			Wake.off();
			await A.Session.save();
			return;
		}
		A.Session.ensure();
		const ok = await A.Scan.start();
		if (ok) Wake.on();
	}

	A.on("scan", (on) => {
		const b = $("#btn-scan");
		b.textContent = on ? A.t("btn.stop") : A.t("btn.start");
		b.classList.toggle("danger", on);
		const st = $("#st-scan");
		st.textContent = on ? A.t("st.scan") : A.t("st.idle");
		st.classList.toggle("off", !on);
		st.classList.toggle("on", on);
	});

	A.on("scan-error", (why) => {
		const msg = {
			none: A.t("err.none"),
			noscan: A.t("err.noscan"),
			off: A.t("err.off"),
		}[why] || (A.t("err.fail") + " " + why);
		A.UI.modal(A.t("err.title"), "<p>" + A.esc(msg) + "</p><p class='hint'>" + A.t("err.help") + "</p>", [{ label: A.t("btn.close"), primary: true, fn: () => true }]);
	});

	A.on("gps", () => {
		const st = $("#st-gps");
		st.classList.toggle("off", !A.Geo.on);
		st.classList.toggle("on", A.Geo.on);
	});
	A.on("gps-error", (e) => {
		if (e && e.code === 1) A.toast(A.t("gps.denied"), 4000);
	});
	A.on("fix", (f) => {
		$("#st-gps").textContent = "GPS ±" + Math.round(f.acc);
	});

	// ---------- wiring ----------
	function bind() {
		A.$$("#tabs button").forEach((b) => b.addEventListener("click", () => A.UI.tab(b.getAttribute("data-tab"))));
		$("#btn-scan").addEventListener("click", toggleScan);
		$("#btn-mute").addEventListener("click", () => {
			A.Store.set("muted", !A.muted());
			if (A.muted() && window.speechSynthesis) window.speechSynthesis.cancel();
			applyMute();
			A.toast(A.muted() ? A.t("mute.on") : A.t("mute.off"));
		});
		$("#btn-pocket").addEventListener("click", P.enter);
		let lastTap = 0;
		$("#pocket").addEventListener("click", () => {
			const now = Date.now();
			if (now - lastTap < 400) P.exit();
			lastTap = now;
		});
		$("#flt-text").addEventListener("input", A.debounce((e) => {
			const F = A.UI.filter();
			F.text = e.target.value.trim();
			A.Store.set("filter", F);
			A.UI.renderLive(true);
		}, 250));
		$("#btn-filters").addEventListener("click", A.UI.openFilters);
		$("#view-sel").addEventListener("change", (e) => {
			A.setCfg("view", e.target.value);
			A.UI.renderLive(true);
		});
		$("#sort-sel").addEventListener("change", (e) => {
			A.setCfg("sort", e.target.value);
			A.UI.renderLive(true);
		});
		$("#list").addEventListener("click", (e) => {
			const row = e.target.closest(".row-dev");
			if (row) A.UI.openDevice(row.getAttribute("data-id"));
		});
		$("#banner").addEventListener("click", () => {
			const id = $("#banner").getAttribute("data-dev");
			$("#banner").classList.add("hidden");
			if (id && A.devices.get(id)) A.UI.openDevice(id);
			else A.UI.tab("alerts");
		});
		$("#alerts").addEventListener("click", (e) => {
			const row = e.target.closest(".row-alert");
			const id = row && row.getAttribute("data-dev");
			if (id && A.devices.get(id)) A.UI.openDevice(id);
		});
		$("#alerts-clear").addEventListener("click", () => {
			A.Alerts.list = [];
			A.Alerts.unread = 0;
			A.UI.renderAlerts();
			A.UI.badge();
		});
		// sheet
		$("#sh-close").addEventListener("click", A.UI.closeSheet);
		$("#sheet").addEventListener("click", (e) => {
			if (e.target.id === "sheet") A.UI.closeSheet();
		});
		$("#sh-hunt").addEventListener("click", () => A.Hunt.select(A.UI.sheetId));
		$("#sh-watch").addEventListener("click", () => {
			A.toggleList("watched", A.UI.sheetId);
			A.UI.renderSheet();
		});
		$("#sh-mine").addEventListener("click", () => {
			A.toggleList("mine", A.UI.sheetId);
			A.UI.renderSheet();
		});
		$("#sh-map").addEventListener("click", () => {
			const id = A.UI.sheetId;
			A.UI.closeSheet();
			A.Map.init();
			A.Map.focus(id);
		});
		$("#sh-more").addEventListener("click", A.UI.sheetMore);
		// map
		$("#map-center").addEventListener("click", A.Map.center);
		$("#map-show").addEventListener("change", () => A.Map.update(true));
		$("#map-save").addEventListener("click", A.Map.saveArea);
		$("#map-cams").addEventListener("click", A.Map.fetchCameras);
		$("#map-base").addEventListener("change", (e) => A.Map.setBase(e.target.value));
		// hunt
		$("#hunt-sound").addEventListener("click", A.Hunt.toggleSound);
		$("#hunt-reset").addEventListener("click", A.Hunt.resetPeak);
		$("#hunt-back").addEventListener("click", A.Hunt.back);
		$("#radar").addEventListener("click", A.Hunt.radarTap);
		$("#radar-show").addEventListener("change", A.Hunt.drawRadar);
		// reports
		$("#rep-debrief").addEventListener("click", () => {
			const s = A.Session.snapshot(false);
			A.UI.textModal(A.t("rep.debrief"), A.Session.debrief(s), A.Session.fileBase(s) + "-debrief.txt");
		});
		$("#rep-ai").addEventListener("click", () => {
			const s = A.Session.snapshot(true);
			A.UI.textModal(A.t("rep.ai"), A.Session.aiPrompt(s), A.Session.fileBase(s) + "-ai.txt");
		});
		$("#rep-export").addEventListener("click", () => A.UI.exportMenu(A.Session.snapshot(true)));
		$("#rep-save").addEventListener("click", async () => {
			await A.Session.save();
			A.toast(A.t("rep.saved"));
			A.UI.renderReports();
		});
		$("#rep-rename").addEventListener("click", () => {
			const s = A.Session.ensure();
			const v = prompt(A.t("rep.rename"), s.name);
			if (v) {
				s.name = v;
				A.UI.renderReports();
			}
		});
		$("#rep-new").addEventListener("click", async () => {
			if (!confirm(A.t("rep.newq"))) return;
			await A.Session.fresh();
			A.UI.renderReports();
		});
		$("#rep-compare").addEventListener("click", A.UI.compareSelected);
		$("#rep-list").addEventListener("click", (e) => {
			const b = e.target.closest("[data-sopen]");
			if (b) A.UI.openSaved(b.getAttribute("data-sopen"));
		});
		// settings
		A.$$("[data-lang]").forEach((b) => b.addEventListener("click", () => {
			A.setLang(b.getAttribute("data-lang"));
			A.UI.renderSettings();
		}));
		A.$$("[data-cfg]").forEach((el) => el.addEventListener("change", () => {
			const k = el.getAttribute("data-cfg");
			let v = (el.type === "checkbox") ? el.checked : el.value;
			if (el.getAttribute("data-num") != null) v = Number(v);
			A.setCfg(k, v);
			if (k === "theme") applyTheme();
			if (k === "cameras") A.Map.toggleCameras(v);
			if (k === "slowui") restartLoop();
		}));
		$("#set-gps").addEventListener("change", (e) => A.Geo.set(e.target.checked));
		$("#set-privacy").addEventListener("change", (e) => A.Store.set("privacy", e.target.checked));
		$("#ignore-clear").addEventListener("click", () => {
			if (!confirm(A.t("ignore.q"))) return;
			A.Store.set("mine", []);
			A.UI.renderSettings();
		});
		$("#watch-clear").addEventListener("click", () => {
			A.Store.set("watched", []);
			A.UI.renderSettings();
		});
		$("#sig-open").addEventListener("click", A.UI.openSignatures);
		$("#pl-add").addEventListener("click", A.UI.addPlace);
		$("#places-list").addEventListener("click", (e) => {
			const b = e.target.closest("[data-delplace]");
			if (b) {
				A.Geo.removePlace(b.getAttribute("data-delplace"));
				A.UI.renderSettings();
			}
		});
		$("#cam-import").addEventListener("click", () => A.UI.pickFile(".json,.geojson,application/json", async (text) => {
			try {
				const n = await A.Map.importCameras(text);
				A.toast(A.t("cam.loaded", { n: n, t: A.Map.cams.length }));
			} catch (e) {
				A.toast(A.t("sig.badfile"));
			}
			A.UI.renderSettings();
		}));
		$("#cam-clear").addEventListener("click", async () => {
			await A.Map.clearCameras();
			A.UI.renderSettings();
		});
		$("#tiles-clear").addEventListener("click", A.Map.clearTiles);
		$("#placemem-clear").addEventListener("click", () => {
			A.Store.set("placeMem", {});
			A.toast(A.t("toast.done"));
		});
		$("#demo-btn").addEventListener("click", () => {
			A.Demo.start();
			A.UI.tab("live");
		});
		$("#test-alert").addEventListener("click", () => {
			A.unlockAudio();
			A.Alerts.raise({ type: "test", level: "mid", title: A.t("a.test.t"), body: A.t("a.test.b"), say: A.t("a.test.t") });
		});
	}

	function applyMute() {
		const b = $("#btn-mute");
		b.textContent = A.muted() ? "🔇" : "🔊";
		b.classList.toggle("on", A.muted());
	}

	function applyTheme() {
		document.body.classList.toggle("night", A.cfg("theme") === "night");
	}

	// ---------- loops ----------
	let uiTimer = null;
	function uiLoop() {
		A.UI.renderLive(false);
		if (A.UI.current === "hunt") A.Hunt.render();
		if (A.UI.current === "map") A.Map.update(false);
		if (A.UI.sheetId && !$("#sheet").classList.contains("hidden")) A.UI.renderSheet();
		$("#st-count").textContent = countFresh();
		P.tick();
	}
	function countFresh() {
		const now = Date.now();
		const stale = A.cfg("stale") * 1000;
		let n = 0;
		for (const d of A.devices.values()) if (now - d.lastSeen < stale) n++;
		return n;
	}
	function restartLoop() {
		clearInterval(uiTimer);
		uiTimer = setInterval(uiLoop, A.cfg("slowui") ? 3000 : 1000);
	}

	function boot() {
		A.Sig.compile();
		A.initLang();
		applyTheme();
		bind();
		applyMute();
		A.Session.begin();
		A.UI.tab("live");
		A.$("#view-sel").value = A.cfg("view");
		A.$("#sort-sel").value = A.cfg("sort");
		A.$("#map-base").value = A.cfg("basemap");
		A.$("#flt-text").value = A.UI.filter().text || "";
		A.$("#about-ver").textContent = "Argus " + A.VERSION + " · " + window.ARGUS_SIGNATURES.length + " signatures";
		if (A.Store.get("gpsOn", true)) A.Geo.start();
		A.emit("scan", false);
		A.emit("gps");
		restartLoop();
		setInterval(A.Alerts.tick, 2000);
		setInterval(A.Hunt.soundTick, 50);
		setInterval(() => {
			if (A.devices.size) A.Session.save();
		}, 60000);
		if (A.Scan.support() !== "ok") {
			A.$("#bt-warn").classList.remove("hidden");
		}
		if ("serviceWorker" in navigator) {
			navigator.serviceWorker.register("sw.js").catch(() => {});
		}
	}

	// ---------- demo data (Settings → Demo) ----------
	const Demo = A.Demo = { timer: null };
	Demo.start = () => {
		if (Demo.timer) return;
		const c = A.Geo.fix || { lat: 55.7558, lon: 37.6173 };
		const devs = [
			{ id: "demo-airtag", rssi: -58, mfg: { 76: "1219" + "10".repeat(25) }, svc: {} },
			{ id: "demo-flipper", name: "Flipper Kirov", rssi: -66, uuids: ["3082"] },
			{ id: "demo-buds", name: "", rssi: -50, mfg: { 76: "071901" + "0E20" + "5585" + "11".repeat(20) } },
			{ id: "demo-tile", name: "Tile", rssi: -77, uuids: ["FEED"] },
			{ id: "demo-yandex", name: "YNDX-0001", rssi: -70, mfg: { 2309: "0102" } },
			{ id: "demo-watch", name: "Galaxy Watch5", rssi: -80, mfg: { 117: "4204" } },
		];
		let t = 0;
		Demo.timer = setInterval(() => {
			t++;
			for (const d of devs) {
				A.Scan.ingest({ id: d.id, name: d.name || "", rssi: d.rssi + Math.round((Math.random() * 8) - 4) + ((d.id === "demo-airtag") ? Math.round(Math.sin(t / 8) * 10) : 0), uuids: d.uuids || [], mfg: d.mfg || {}, svc: d.svc || {} });
			}
			// a drone circling ~150 m away with its pilot
			const ang = t / 20;
			const lat = c.lat + (Math.cos(ang) * 0.0013);
			const lon = c.lon + (Math.sin(ang) * 0.0022);
			A.Scan.ingest({ id: "demo-drone", name: "", rssi: -82, uuids: ["FFFA"], mfg: {}, svc: { FFFA: Demo.rid(lat, lon, c.lat + 0.0009, c.lon - 0.0012) } });
		}, 1000);
		A.toast(A.t("demo.on"));
	};
	Demo.stop = () => {
		clearInterval(Demo.timer);
		Demo.timer = null;
	};
	// Build a Remote ID FFFA payload with Basic ID + Location + System messages (message pack).
	Demo.rid = (lat, lon, olat, olon) => {
		const msg = () => new Uint8Array(25);
		const basic = msg();
		basic[0] = 0x02;
		basic[1] = (1 << 4) | 2;
		const id = "1581F5BKD225Q00A0001";
		for (let i = 0; i < id.length; i++) basic[2 + i] = id.charCodeAt(i);
		const loc = msg();
		loc[0] = 0x12;
		loc[1] = (2 << 4);
		loc[2] = 90;
		loc[3] = 40;
		const w32 = (b, o, v) => {
			b[o] = v & 255;
			b[o + 1] = (v >> 8) & 255;
			b[o + 2] = (v >> 16) & 255;
			b[o + 3] = (v >> 24) & 255;
		};
		w32(loc, 5, Math.round(lat * 1e7));
		w32(loc, 9, Math.round(lon * 1e7));
		const alt = Math.round((180 + 1000) * 2);
		loc[15] = alt & 255;
		loc[16] = alt >> 8;
		const h = Math.round((60 + 1000) * 2);
		loc[17] = h & 255;
		loc[18] = h >> 8;
		const sys = msg();
		sys[0] = 0x42;
		w32(sys, 2, Math.round(olat * 1e7));
		w32(sys, 6, Math.round(olon * 1e7));
		const pack = new Uint8Array(2 + 3 + (25 * 3));
		pack[0] = 0x0D;
		pack[1] = 7;
		pack[2] = 0xF2;
		pack[3] = 25;
		pack[4] = 3;
		pack.set(basic, 5);
		pack.set(loc, 30);
		pack.set(sys, 55);
		return A.hex(pack);
	};

	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
	else boot();
})(window.Argus);
