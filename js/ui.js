// Argus — screens: tabs, Live views and filters, device sheet, alerts, reports, settings.
"use strict";
(function (A) {
	const UI = A.UI = { sheetId: null };
	const $ = A.$;

	// ---------- tabs ----------
	UI.tab = (name) => {
		A.$$("#tabs button").forEach((b) => b.classList.toggle("active", b.getAttribute("data-tab") === name));
		A.$$(".tab").forEach((s) => s.classList.toggle("active", s.id === "tab-" + name));
		UI.current = name;
		if (name === "map") {
			A.Map.init();
			setTimeout(() => {
				A.Map.map.invalidateSize();
				A.Map.update(true);
			}, 50);
		}
		if (name === "hunt") {
			A.Hunt.render();
			A.Hunt.invalidate();
		}
		if (name === "alerts") {
			A.Alerts.unread = 0;
			UI.renderAlerts();
		}
		if (name === "reports") UI.renderReports();
		if (name === "settings") UI.renderSettings();
		UI.badge();
	};

	UI.badge = () => {
		const b = $("#alert-badge");
		b.textContent = A.Alerts.unread;
		b.classList.toggle("hidden", !A.Alerts.unread);
	};

	// ---------- filters ----------
	const PRESETS = {
		all: { classes: [], conds: {}, combine: "and" },
		trackers: { classes: ["FINDER"], conds: {}, combine: "and" },
		followed: { classes: [], conds: { moving: true, tracker: true }, combine: "or" },
		drones: { classes: ["DRONE"], conds: {}, combine: "and" },
		pentest: { classes: ["HACKING"], conds: {}, combine: "and" },
		police: { classes: ["LAW_ENFORCEMENT", "SURVEILLANCE", "CAMERA", "MILITARY"], conds: {}, combine: "and" },
		strongnew: { classes: [], conds: { strong: true, fresh: true }, combine: "and" },
	};
	UI.filter = () => A.Store.get("filter", { classes: [], conds: {}, combine: "and", hideMine: true });

	function passes(d, F, now) {
		if (F.hideMine !== false && A.isMine(d)) return false;
		if (F.text) {
			const hay = (A.label(d) + " " + d.name + " " + (d.company || "") + " " + d.sigs.map((f) => f.name + " " + A.kindLabel(f.kind)).join(" ")).toLowerCase();
			if (hay.indexOf(F.text.toLowerCase()) < 0) return false;
		}
		const tests = [];
		if (F.classes && F.classes.length) tests.push(d.sigs.some((f) => F.classes.indexOf(f.kind) >= 0) || (d.rid && F.classes.indexOf("DRONE") >= 0));
		const c = F.conds || {};
		if (c.matched) tests.push(d.sigs.length > 0);
		if (c.strong) tests.push(d.rssi != null && d.rssi >= A.cfg("strong"));
		if (c.moving) tests.push(A.Alerts.moving.has(d.id));
		if (c.fresh) tests.push(now - d.firstSeen < 300000);
		if (c.watched) tests.push(A.isWatched(d));
		if (c.tracker) tests.push(!!(d.tracker && d.tracker.state === "SEPARATED"));
		if (!tests.length) return true;
		return (F.combine === "or") ? tests.some(Boolean) : tests.every(Boolean);
	}
	UI.passes = passes;

	UI.visible = () => {
		const now = Date.now();
		const F = UI.filter();
		const stale = A.cfg("stale") * 1000;
		const showGone = A.Store.get("showGone", false);
		const out = [];
		for (const d of A.devices.values()) {
			if (!showGone && now - d.lastSeen > stale) continue;
			if (!passes(d, F, now)) continue;
			out.push(d);
		}
		const sort = A.cfg("sort");
		const cmp = {
			rssi: (a, b) => ((b.rssiS == null ? -200 : b.rssiS) - (a.rssiS == null ? -200 : a.rssiS)),
			recent: (a, b) => (b.lastSeen - a.lastSeen),
			first: (a, b) => (b.firstSeen - a.firstSeen),
			time: (a, b) => ((b.lastSeen - b.firstSeen) - (a.lastSeen - a.firstSeen)),
			name: (a, b) => A.label(a).localeCompare(A.label(b)),
		}[sort] || ((a, b) => 0);
		out.sort((a, b) => {
			const ka = (A.isWatched(a) ? 0 : 1);
			const kb = (A.isWatched(b) ? 0 : 1);
			return (ka - kb) || cmp(a, b);
		});
		return out;
	};

	UI.openFilters = () => {
		const F = UI.filter();
		const kinds = Object.keys(A.KINDS);
		const chip = (k) => "<label class='chip'><input type='checkbox' data-fk='" + k + "'" + ((F.classes || []).indexOf(k) >= 0 ? " checked" : "") + "><span style='border-color:" + A.KINDS[k].color + "'>" + A.KINDS[k].icon + " " + A.esc(A.kindLabel(k)) + "</span></label>";
		const cond = (k) => "<label class='row'><input type='checkbox' data-fc='" + k + "'" + ((F.conds || {})[k] ? " checked" : "") + "> " + A.t("fc." + k) + "</label>";
		const pre = Object.keys(PRESETS).map((k) => "<button data-preset='" + k + "'>" + A.t("pre." + k) + "</button>").join("");
		const saved = A.Store.get("presets", []).map((p, i) => "<button data-upreset='" + i + "'>" + A.esc(p.name) + "</button>").join("");
		const html = "<h4>" + A.t("flt.presets") + "</h4><div class='controls wrap'>" + pre + saved + "</div>" +
			"<h4>" + A.t("flt.classes") + "</h4><div class='chips'>" + kinds.map(chip).join("") + "</div>" +
			"<h4>" + A.t("flt.conds") + "</h4>" + ["matched", "strong", "moving", "fresh", "watched", "tracker"].map(cond).join("") +
			"<div class='row'><span>" + A.t("flt.combine") + "</span><select id='f-comb'><option value='and'" + ((F.combine !== "or") ? " selected" : "") + ">" + A.t("flt.and") + "</option><option value='or'" + ((F.combine === "or") ? " selected" : "") + ">" + A.t("flt.or") + "</option></select></div>" +
			"<label class='row'><input type='checkbox' id='f-mine'" + ((F.hideMine !== false) ? " checked" : "") + "> " + A.t("flt.hidemine") + "</label>" +
			"<label class='row'><input type='checkbox' id='f-gone'" + (A.Store.get("showGone", false) ? " checked" : "") + "> " + A.t("flt.gone") + "</label>";
		const m = UI.modal(A.t("flt.title"), html, [
			{ label: A.t("flt.savepreset"), fn: () => {
				const name = prompt(A.t("flt.presetname"));
				if (!name) return false;
				const list = A.Store.get("presets", []);
				list.push(Object.assign({ name: name }, collect()));
				A.Store.set("presets", list);
				return true;
			} },
			{ label: A.t("btn.done"), primary: true, fn: () => {
				A.Store.set("filter", Object.assign(UI.filter(), collect()));
				UI.renderLive(true);
				return true;
			} },
		]);
		function collect() {
			return {
				classes: A.$$("[data-fk]", m).filter((x) => x.checked).map((x) => x.getAttribute("data-fk")),
				conds: A.$$("[data-fc]", m).reduce((o, x) => {
					if (x.checked) o[x.getAttribute("data-fc")] = true;
					return o;
				}, {}),
				combine: $("#f-comb", m).value,
				hideMine: $("#f-mine", m).checked,
			};
		}
		A.$$("[data-preset]", m).forEach((b) => b.addEventListener("click", () => {
			apply(PRESETS[b.getAttribute("data-preset")]);
		}));
		A.$$("[data-upreset]", m).forEach((b) => b.addEventListener("click", () => {
			apply(A.Store.get("presets", [])[b.getAttribute("data-upreset") | 0]);
		}));
		$("#f-gone", m).addEventListener("change", (e) => A.Store.set("showGone", e.target.checked));
		function apply(p) {
			A.$$("[data-fk]", m).forEach((x) => {
				x.checked = (p.classes || []).indexOf(x.getAttribute("data-fk")) >= 0;
			});
			A.$$("[data-fc]", m).forEach((x) => {
				x.checked = !!(p.conds || {})[x.getAttribute("data-fc")];
			});
			$("#f-comb", m).value = p.combine || "and";
		}
	};

	UI.filterSummary = () => {
		const F = UI.filter();
		const parts = [];
		if (F.classes && F.classes.length) parts.push(F.classes.map(A.kindLabel).join(", "));
		for (const k in (F.conds || {})) parts.push(A.t("fc." + k));
		if (!parts.length) return A.t("flt.none");
		return parts.join((F.combine === "or") ? " | " : " + ");
	};

	// ---------- Live list views ----------
	function rowHtml(d, now, view) {
		const k = A.KINDS[d.kind];
		const color = k ? k.color : "#3a4452";
		const sub = d.sigs.length ? d.sigs.slice(0, 3).map((f) => f.name).join(" · ") : (d.company || (d.uuids.size ? ("UUID " + Array.from(d.uuids).slice(0, 2).join(", ")) : A.t("dev.noid")));
		const r = (d.rssi == null) ? "—" : d.rssi;
		const tr = A.trend(d);
		const arrow = (tr >= 4) ? "<span class='tr up'>▲</span>" : ((tr <= -4) ? "<span class='tr down'>▼</span>" : "");
		const badges = [];
		if (A.isWatched(d)) badges.push("<span class='bdg w'>★</span>");
		if (A.Alerts.moving.has(d.id)) badges.push("<span class='bdg m'>" + A.t("bdg.moving") + "</span>");
		if (d.tracker && d.tracker.state === "SEPARATED") badges.push("<span class='bdg s'>" + A.t("bdg.sep") + "</span>");
		if (d.rid) badges.push("<span class='bdg d'>RID</span>");
		if (A.isMine(d)) badges.push("<span class='bdg'>" + A.t("bdg.mine") + "</span>");
		let extra = "";
		if (view === "timeline") extra = timelineHtml(d, now);
		if (view === "hybrid") extra = sparkHtml(d, now);
		const age = now - d.lastSeen;
		return "<div class='row-dev" + ((age > 15000) ? " old" : "") + "' data-id='" + A.esc(d.id) + "'>" +
			"<div class='kbar' style='background:" + color + "'>" + (k ? k.icon : "") + "</div>" +
			"<div class='main'><div class='t'>" + A.esc(A.label(d)) + " " + badges.join("") + "</div><div class='s'>" + A.esc(sub) + "</div>" + extra + "</div>" +
			"<div class='side'><div class='r' style='color:" + A.rssiColor(d.rssi) + "'>" + r + arrow + "</div><div class='a'>" + A.fmtAgo(age) + "</div></div></div>";
	}

	function timelineHtml(d, now) {
		const W = 15 * 60000;
		let s = "<div class='tl'>";
		for (const seg of d.segs) {
			const a = Math.max(seg[0], now - W);
			const b = Math.max(seg[1], a + 2000);
			if (b < now - W) continue;
			const left = ((a - (now - W)) / W) * 100;
			const width = Math.max(0.6, ((b - a) / W) * 100);
			s += "<i style='left:" + left.toFixed(2) + "%;width:" + width.toFixed(2) + "%'></i>";
		}
		return s + "</div>";
	}

	function sparkHtml(d, now) {
		if (d.hist.length < 2) return "<div class='spark'></div>";
		const t0 = d.hist[0][0];
		const span = Math.max(1, now - t0);
		const pts = d.hist.map((h) => (((h[0] - t0) / span) * 100).toFixed(1) + "," + (((-30 - h[1]) / 70) * 30).toFixed(1)).join(" ");
		return "<svg class='spark' viewBox='0 0 100 30' preserveAspectRatio='none'><polyline points='" + pts + "' /></svg>";
	}

	UI.renderLive = (force) => {
		if (!force && UI.current !== "live") return;
		const view = A.cfg("view");
		const list = UI.visible();
		const now = Date.now();
		const el = $("#list");
		$("#flt-summary").textContent = UI.filterSummary();
		let html = "";
		if (view === "class") {
			const groups = {};
			for (const d of list) {
				const key = d.kind || "_none";
				(groups[key] = groups[key] || []).push(d);
			}
			const keys = Object.keys(groups).sort((a, b) => ((A.KINDS[a] || { prio: 99 }).prio - (A.KINDS[b] || { prio: 99 }).prio));
			for (const k of keys) {
				html += "<div class='grp'>" + ((k === "_none") ? A.t("grp.none") : (A.KINDS[k].icon + " " + A.esc(A.kindLabel(k)))) + " <b>" + groups[k].length + "</b></div>";
				html += groups[k].slice(0, 150).map((d) => rowHtml(d, now, "list")).join("");
			}
		} else {
			html = list.slice(0, 300).map((d) => rowHtml(d, now, view)).join("");
			if (list.length > 300) html += "<div class='empty'>+" + (list.length - 300) + "</div>";
		}
		el.innerHTML = html;
		$("#list-empty").classList.toggle("hidden", list.length > 0);
		$("#list-empty").textContent = A.Scan.running ? A.t("list.waiting") : A.t("list.empty");
	};

	// ---------- device sheet ----------
	UI.openDevice = (id) => {
		const d = A.devices.get(id);
		if (!d) return;
		UI.sheetId = id;
		UI.renderSheet();
		$("#sheet").classList.remove("hidden");
	};

	UI.closeSheet = () => {
		$("#sheet").classList.add("hidden");
		UI.sheetId = null;
	};

	UI.renderSheet = () => {
		const d = A.devices.get(UI.sheetId);
		if (!d) return;
		const now = Date.now();
		$("#sh-title").textContent = A.label(d);
		const rows = [];
		const add = (k, v) => {
			if (v == null || v === "") return;
			rows.push("<tr><th>" + A.esc(k) + "</th><td>" + v + "</td></tr>");
		};
		let sigHtml = "";
		for (const f of d.sigs) {
			const k = A.KINDS[f.kind] || A.KINDS.OTHER;
			sigHtml += "<div class='sig' style='border-left-color:" + k.color + "'><b>" + k.icon + " " + A.esc(f.name) + "</b> <span class='dim'>" + A.esc(A.kindLabel(f.kind)) + "</span>" +
				(f.notes ? ("<div>" + A.esc(f.notes) + "</div>") : "") + (f.attention ? ("<div class='warn'>" + A.esc(f.attention) + "</div>") : "") + "</div>";
		}
		add(A.t("d.rssi"), (d.rssi == null ? "—" : (d.rssi + " dBm")) + " · max " + (d.rssiMax == null ? "—" : d.rssiMax) + ((d.txPower != null) ? (" · TX " + d.txPower) : ""));
		add(A.t("d.seen"), A.fmtClock(d.firstSeen) + " → " + A.fmtClock(d.lastSeen) + " (" + A.fmtDur(d.lastSeen - d.firstSeen) + ") · " + d.count + " " + A.t("d.packets"));
		add(A.t("d.maker"), A.esc(d.company));
		add(A.t("d.id"), "<span class='mono'>" + A.esc(A.mask(d.id)) + "</span>");
		if (A.Alerts.moving.has(d.id)) add(A.t("flt.moving"), A.t("d.yes") + " · " + A.fmtDist(A.Alerts.trailLen(d.trail)));
		if (d.tracker) add(A.t("d.tracker"), A.esc(A.t(d.tracker.state === "SEPARATED" ? "d.sep" : "d.near")));
		const pc = A.Alerts.placeCount(d);
		if (pc) add(A.t("d.places"), pc + " " + A.t("d.placesn"));
		if (d.best) add(A.t("d.best"), A.Store.get("privacy", false) ? "••" : ("<span class='mono'>" + d.best.lat.toFixed(5) + ", " + d.best.lon.toFixed(5) + "<br>MGRS " + A.mgrs(d.best.lat, d.best.lon) + "</span>"));
		for (const f of A.Decode.fields(d)) add(f[0], A.esc(f[1]));
		if (d.uuids.size) add("UUIDs", "<span class='mono'>" + A.esc(Array.from(d.uuids).join(" ")) + "</span>");
		for (const k in d.mfg) add(A.t("d.mfg") + " " + k + " (0x" + (k | 0).toString(16).padStart(4, "0") + ")", "<span class='mono wrapall'>" + A.esc(d.mfg[k]) + "</span>");
		for (const k in d.svc) add(A.t("d.svc") + " " + k, "<span class='mono wrapall'>" + A.esc(d.svc[k]) + "</span>");
		$("#sh-body").innerHTML = (sigHtml || ("<div class='dim'>" + A.t("d.nosig") + "</div>")) + "<table class='kv'>" + rows.join("") + "</table>" + sparkHtml(d, now).replace("class='spark'", "class='spark big'");
		$("#sh-watch").textContent = A.isWatched(d) ? A.t("sh.unwatch") : A.t("sh.watch");
		$("#sh-mine").textContent = A.isMine(d) ? A.t("sh.notmine") : A.t("sh.mine");
	};

	UI.deviceText = (d) => {
		const L = [A.label(d), (d.sigs.map((f) => f.name).join(", ") || "—")];
		for (const f of A.Decode.fields(d)) L.push(f[0] + ": " + f[1]);
		L.push("RSSI " + d.rssi + " / max " + d.rssiMax + " · " + A.fmtDur(d.lastSeen - d.firstSeen));
		if (d.company) L.push(d.company);
		if (d.uuids.size) L.push("UUIDs " + Array.from(d.uuids).join(" "));
		for (const k in d.mfg) L.push("mfg " + k + ": " + d.mfg[k]);
		for (const k in d.svc) L.push("svc " + k + ": " + d.svc[k]);
		return L.join("\n");
	};

	UI.sheetMore = () => {
		const d = A.devices.get(UI.sheetId);
		if (!d) return;
		const m = UI.modal(A.label(d), "<div class='controls col'>" +
			"<button id='mo-rename'>" + A.t("sh.rename") + "</button>" +
			"<button id='mo-sig'>" + A.t("sh.mksig") + "</button>" +
			"<button id='mo-copy'>" + A.t("sh.copy") + "</button>" +
			"<button id='mo-ai'>" + A.t("sh.ai") + "</button></div>", [{ label: A.t("btn.close"), fn: () => true }]);
		$("#mo-rename", m).onclick = () => {
			const v = prompt(A.t("sh.rename"), A.label(d));
			if (v == null) return;
			const labels = A.Store.get("labels", {});
			if (v.trim()) labels[d.id] = v.trim();
			else delete labels[d.id];
			A.Store.set("labels", labels);
			UI.closeModal(m);
			UI.renderSheet();
		};
		$("#mo-sig", m).onclick = () => {
			UI.closeModal(m);
			UI.editSignature(null, d);
		};
		$("#mo-copy", m).onclick = () => A.copy(UI.deviceText(d));
		$("#mo-ai", m).onclick = () => A.copy("Explain this Bluetooth LE advertisement heard by a receive-only scanner. What kind of device is it likely to be, and is it anything to worry about? Be honest about uncertainty.\n\n" + UI.deviceText(d));
	};

	// ---------- modal ----------
	UI.modal = (title, html, buttons) => {
		const wrap = document.createElement("div");
		wrap.className = "modal";
		wrap.innerHTML = "<div class='modal-in'><div class='sheet-head'><div class='sh-title'>" + A.esc(title) + "</div><button class='x'>✕</button></div><div class='modal-body'>" + html + "</div><div class='controls wrap modal-btns'></div></div>";
		const bar = $(".modal-btns", wrap);
		for (const b of (buttons || [])) {
			const btn = document.createElement("button");
			btn.textContent = b.label;
			if (b.primary) btn.className = "primary";
			btn.onclick = () => {
				if (b.fn() !== false) UI.closeModal(wrap);
			};
			bar.appendChild(btn);
		}
		$(".x", wrap).onclick = () => UI.closeModal(wrap);
		document.body.appendChild(wrap);
		return wrap;
	};
	UI.closeModal = (m) => m.remove();

	UI.textModal = (title, text, fileName) => {
		UI.modal(title, "<pre class='report'>" + A.esc(text) + "</pre>", [
			{ label: A.t("btn.copy"), fn: () => {
				A.copy(text);
				return false;
			} },
			{ label: A.t("btn.share"), fn: () => {
				A.saveText(fileName || "argus.txt", text, "text/plain");
				return false;
			} },
			{ label: A.t("btn.close"), primary: true, fn: () => true },
		]);
	};

	// ---------- alerts ----------
	UI.renderAlerts = () => {
		const L = A.Alerts.list;
		$("#alerts").innerHTML = L.map((a) => "<div class='row-alert lvl-" + (a.level || "mid") + "' data-dev='" + A.esc(a.devId || "") + "'><div class='t'>" + A.esc(a.title) + "</div><div class='s'>" + A.esc(a.body || "") + "</div><div class='a'>" + A.fmtClock(a.at) + "</div></div>").join("");
		$("#alerts-empty").classList.toggle("hidden", L.length > 0);
	};

	let bannerTimer = null;
	A.on("alert", (a) => {
		const b = $("#banner");
		b.innerHTML = "<b>" + A.esc(a.title) + "</b><span>" + A.esc(a.body || "") + "</span>";
		b.className = "banner lvl-" + (a.level || "mid");
		b.setAttribute("data-dev", a.devId || "");
		clearTimeout(bannerTimer);
		bannerTimer = setTimeout(() => b.classList.add("hidden"), (a.level === "high") ? 20000 : 8000);
		if (UI.current === "alerts") {
			A.Alerts.unread = 0;
			UI.renderAlerts();
		}
		UI.badge();
		A.Pocket.alert(a);
	});

	// ---------- reports ----------
	UI.renderReports = async () => {
		const s = A.Session.ensure();
		const nDev = A.devices.size;
		$("#rep-cur").innerHTML = "<div class='t'>" + A.esc(s.name) + "</div><div class='s'>" + A.fmtDate(s.start) + " · " + A.fmtDur(Date.now() - s.start) + " · " + nDev + " " + A.t("db.devices").toLowerCase() + " · " + A.fmtDist(A.Geo.pathM) + " · " + s.alerts.length + " " + A.t("tab.alerts").toLowerCase() + "</div>";
		const list = await A.Store.listSessions();
		const others = list.filter((x) => x.id !== s.id);
		$("#rep-list").innerHTML = others.length ? others.map((x) => "<div class='row-sess' data-sid='" + x.id + "'><label><input type='checkbox' data-cmp='" + x.id + "'></label><div class='main'><div class='t'>" + A.esc(x.name) + "</div><div class='s'>" + A.fmtDate(x.start) + " · " + A.fmtDur((x.end || x.start) - x.start) + " · " + x.devices + " · " + A.fmtDist(x.pathM) + "</div></div><button data-sopen='" + x.id + "'>" + A.t("rep.open") + "</button></div>").join("") : ("<div class='empty'>" + A.t("rep.none") + "</div>");
	};

	UI.exportMenu = (s) => {
		const base = A.Session.fileBase(s);
		UI.modal(A.t("rep.export"), "<p class='hint'>" + A.t("rep.exphint") + "</p>", [
			{ label: "CSV", fn: () => {
				A.saveText(base + ".csv", A.Session.csv(s), "text/csv");
				return false;
			} },
			{ label: "JSONL", fn: () => {
				A.saveText(base + ".jsonl", A.Session.jsonl(s), "application/json");
				return false;
			} },
			{ label: "GPX", fn: () => {
				A.saveText(base + ".gpx", A.Session.gpx(s), "application/gpx+xml");
				return false;
			} },
			{ label: "KML", fn: () => {
				A.saveText(base + ".kml", A.Session.kml(s), "application/vnd.google-earth.kml+xml");
				return false;
			} },
			{ label: "JSON", fn: () => {
				A.saveText(base + ".json", JSON.stringify(s), "application/json");
				return false;
			} },
			{ label: A.t("btn.close"), primary: true, fn: () => true },
		]);
	};

	UI.openSaved = async (id) => {
		const s = await A.Store.getSession(id);
		if (!s) return;
		UI.modal(s.name, "<p class='hint'>" + A.fmtDate(s.start) + " · " + (s.devices || []).length + " · " + A.fmtDist(s.pathM || 0) + "</p>", [
			{ label: A.t("rep.debrief"), fn: () => {
				UI.textModal(A.t("rep.debrief"), A.Session.debrief(s), A.Session.fileBase(s) + "-debrief.txt");
				return true;
			} },
			{ label: A.t("rep.ai"), fn: () => {
				UI.textModal(A.t("rep.ai"), A.Session.aiPrompt(s), A.Session.fileBase(s) + "-ai.txt");
				return true;
			} },
			{ label: A.t("rep.export"), fn: () => {
				UI.exportMenu(s);
				return true;
			} },
			{ label: A.t("rep.rename"), fn: async () => {
				const v = prompt(A.t("rep.rename"), s.name);
				if (!v) return false;
				s.name = v;
				await A.Store.putSession(s);
				UI.renderReports();
				return true;
			} },
			{ label: A.t("rep.delete"), fn: async () => {
				if (!confirm(A.t("rep.delq"))) return false;
				await A.Store.deleteSession(s.id);
				UI.renderReports();
				return true;
			} },
		]);
	};

	UI.compareSelected = async () => {
		const ids = A.$$("[data-cmp]").filter((x) => x.checked).map((x) => x.getAttribute("data-cmp"));
		let a = null;
		let b = null;
		if (ids.length === 1) {
			a = A.Session.snapshot(false);
			b = await A.Store.getSession(ids[0]);
		} else if (ids.length === 2) {
			a = await A.Store.getSession(ids[0]);
			b = await A.Store.getSession(ids[1]);
		} else {
			A.toast(A.t("cmp.pick"));
			return;
		}
		if (a && b) UI.textModal(A.t("cmp.title"), A.Session.compare(a, b), "argus-compare.txt");
	};

	// ---------- settings ----------
	UI.renderSettings = () => {
		A.$$("[data-cfg]").forEach((el) => {
			const k = el.getAttribute("data-cfg");
			const v = A.cfg(k);
			if (el.type === "checkbox") el.checked = !!v;
			else el.value = String(v);
		});
		$("#set-gps").checked = A.Geo.on;
		$("#set-privacy").checked = A.Store.get("privacy", false);
		$("#ignore-count").textContent = A.t("ignore.count", { n: A.Store.get("mine", []).length });
		$("#watch-count").textContent = A.t("watch.count", { n: A.Store.get("watched", []).length });
		$("#sig-count").textContent = A.t("sig.count", { n: A.Sig.active.length, c: A.Store.get("customSigs", []).length, b: A.Sig.bookmarks.size });
		$("#cam-count").textContent = A.t("cam.count", { n: A.Map.cams.length });
		const pl = A.Geo.places();
		$("#places-list").innerHTML = pl.map((p) => "<div class='row'><span>" + A.esc(p.name) + " · " + p.r + " m" + (p.hide ? (" · " + A.t("pl.hidden")) : "") + "</span><button data-delplace='" + p.id + "'>✕</button></div>").join("") || ("<div class='hint'>" + A.t("pl.none") + "</div>");
		A.$$("[data-lang]").forEach((b) => b.classList.toggle("on", b.getAttribute("data-lang") === A.lang));
		UI.btCheck();
	};

	UI.btCheck = () => {
		const sup = A.Scan.support();
		const L = [];
		L.push("Web Bluetooth: " + (navigator.bluetooth ? "yes" : "NO"));
		L.push("requestLEScan: " + ((sup === "ok") ? "yes" : "NO"));
		L.push(A.t("chk.scanning") + ": " + (A.Scan.running ? A.t("d.yes") : A.t("d.no")) + " · " + A.Scan.packets + " " + A.t("d.packets"));
		L.push("GPS: " + (A.Geo.fix ? ("±" + Math.round(A.Geo.fix.acc) + " m") : "—"));
		L.push("Service worker: " + (("serviceWorker" in navigator) ? "yes" : "no") + " · Cache: " + ((typeof caches !== "undefined") ? "yes" : "no"));
		L.push("Wake lock: " + (A.Wake.state || "—"));
		if (sup !== "ok") L.push(A.t("chk.bluefy"));
		$("#bt-check").textContent = L.join("\n");
	};

	// ---------- signature library ----------
	UI.openSignatures = () => {
		const html = "<input type='search' id='sg-q' placeholder='" + A.esc(A.t("flt.search")) + "'><div id='sg-list' class='sg-list'></div>";
		const m = UI.modal(A.t("sig.title"), html, [
			{ label: A.t("sig.new"), fn: () => {
				UI.editSignature(null, null);
				return true;
			} },
			{ label: A.t("sig.import"), fn: () => {
				UI.pickFile(".json,application/json", (text) => {
					try {
						const n = A.Sig.importJson(text);
						A.Scan.rematch();
						A.toast(A.t("sig.imported", { n: n }));
					} catch (e) {
						A.toast(A.t("sig.badfile"));
					}
				});
				return true;
			} },
			{ label: A.t("sig.export"), fn: () => {
				A.saveText("argus-signatures.json", A.Sig.exportJson(), "application/json");
				return false;
			} },
			{ label: A.t("btn.done"), primary: true, fn: () => {
				A.Scan.rematch();
				UI.renderSettings();
				return true;
			} },
		]);
		const disabled = new Set(A.Store.get("disabledSigs", []));
		const draw = () => {
			const q = $("#sg-q", m).value.toLowerCase();
			const byKind = {};
			for (const f of A.Sig.all) {
				if (q && (f.name + " " + f.notes + " " + A.kindLabel(f.kind)).toLowerCase().indexOf(q) < 0) continue;
				(byKind[f.kind] = byKind[f.kind] || []).push(f);
			}
			const keys = Object.keys(byKind).sort((a, b) => ((A.KINDS[a] || A.KINDS.OTHER).prio - (A.KINDS[b] || A.KINDS.OTHER).prio));
			let h = "";
			for (const k of keys) {
				const meta = A.KINDS[k] || A.KINDS.OTHER;
				h += "<div class='grp'>" + meta.icon + " " + A.esc(A.kindLabel(k)) + " <b>" + byKind[k].length + "</b></div>";
				for (const f of byKind[k].sort((a, b) => a.name.localeCompare(b.name))) {
					h += "<div class='sg-row'><label><input type='checkbox' data-sgon='" + A.esc(f.id) + "'" + (disabled.has(f.id) ? "" : " checked") + "></label>" +
						"<div class='main'><div class='t'>" + A.esc(f.name) + (f.builtIn ? "" : (" <span class='bdg'>" + A.t("sig.custom") + "</span>")) + "</div><div class='s'>" + A.esc(f.notes || "") + "</div></div>" +
						"<button class='star" + (A.Sig.bookmarks.has(f.id) ? " on" : "") + "' data-sgbm='" + A.esc(f.id) + "'>★</button>" +
						(f.builtIn ? "" : ("<button data-sgedit='" + A.esc(f.id) + "'>✎</button>")) + "</div>";
				}
			}
			$("#sg-list", m).innerHTML = h;
		};
		$("#sg-q", m).addEventListener("input", A.debounce(draw, 200));
		$("#sg-list", m).addEventListener("click", (e) => {
			const t = e.target;
			if (t.hasAttribute("data-sgbm")) {
				const id = t.getAttribute("data-sgbm");
				const on = !A.Sig.bookmarks.has(id);
				A.Sig.setBookmark(id, on);
				t.classList.toggle("on", on);
			} else if (t.hasAttribute("data-sgedit")) {
				UI.closeModal(m);
				UI.editSignature(A.Sig.byId[t.getAttribute("data-sgedit")], null);
			}
		});
		$("#sg-list", m).addEventListener("change", (e) => {
			const t = e.target;
			if (!t.hasAttribute("data-sgon")) return;
			const id = t.getAttribute("data-sgon");
			A.Sig.setDisabled(id, !t.checked);
			if (t.checked) disabled.delete(id);
			else disabled.add(id);
		});
		draw();
	};

	const RULE_KINDS = ["NAME_GLOB", "NAME_CONTAINS", "SERVICE_UUID", "MANUFACTURER_ID", "MANUFACTURER_DATA", "SERVICE_DATA"];
	UI.editSignature = (f, fromDev) => {
		const sig = f ? JSON.parse(JSON.stringify(f)) : { id: "custom-" + A.uid(), name: fromDev ? A.label(fromDev) : "", kind: "OTHER", matchAny: true, notes: "", attention: "", rules: fromDev ? A.Sig.suggest(fromDev) : [{ k: "NAME_GLOB", t: "" }] };
		const kindOpts = Object.keys(A.KINDS).map((k) => "<option value='" + k + "'" + ((sig.kind === k) ? " selected" : "") + ">" + A.esc(A.kindLabel(k)) + "</option>").join("");
		const ruleRow = (r, i) => "<div class='rule' data-ri='" + i + "'><select data-rk>" + RULE_KINDS.map((k) => "<option" + ((r.k === k) ? " selected" : "") + ">" + k + "</option>").join("") + "</select>" +
			"<input data-rt placeholder='" + A.esc(A.t("sig.text")) + "' value='" + A.esc(r.t || "") + "'><input data-rc type='number' placeholder='" + A.esc(A.t("sig.cid")) + "' value='" + (r.c || "") + "'><input data-rp placeholder='" + A.esc(A.t("sig.prefix")) + "' value='" + A.esc(r.p || "") + "'><button data-rdel='" + i + "'>✕</button></div>";
		const html = "<label>" + A.t("sig.name") + "<input id='se-name' value='" + A.esc(sig.name) + "'></label>" +
			"<label>" + A.t("sig.class") + "<select id='se-kind'>" + kindOpts + "</select></label>" +
			"<label>" + A.t("sig.notes") + "<input id='se-notes' value='" + A.esc(sig.notes || "") + "'></label>" +
			"<label class='row'><input type='checkbox' id='se-any'" + ((sig.matchAny !== false) ? " checked" : "") + "> " + A.t("sig.any") + "</label>" +
			"<div id='se-rules'>" + sig.rules.map(ruleRow).join("") + "</div><button id='se-add'>+ " + A.t("sig.rule") + "</button>" +
			"<p class='hint'>" + A.t("sig.help") + "</p>";
		const m = UI.modal(f ? A.t("sig.edit") : A.t("sig.new"), html, [
			...(f && !f.builtIn ? [{ label: A.t("rep.delete"), fn: () => {
				A.Sig.removeCustom(sig.id);
				A.Scan.rematch();
				return true;
			} }] : []),
			{ label: A.t("btn.save"), primary: true, fn: () => {
				const rules = A.$$(".rule", m).map((row) => {
					const r = { k: $("[data-rk]", row).value };
					const t = $("[data-rt]", row).value.trim();
					const c = parseInt($("[data-rc]", row).value, 10);
					const p = $("[data-rp]", row).value.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
					if (t) r.t = t;
					if (c) r.c = c;
					if (p) r.p = p;
					return r;
				}).filter((r) => r.t || r.c || r.p);
				if (!rules.length || !$("#se-name", m).value.trim()) {
					A.toast(A.t("sig.need"));
					return false;
				}
				A.Sig.addCustom({ id: sig.id, name: $("#se-name", m).value.trim(), kind: $("#se-kind", m).value, matchAny: $("#se-any", m).checked, notes: $("#se-notes", m).value.trim(), attention: sig.attention || "", rules: rules });
				A.Scan.rematch();
				A.toast(A.t("sig.saved"));
				return true;
			} },
		]);
		$("#se-add", m).onclick = () => {
			const box = $("#se-rules", m);
			box.insertAdjacentHTML("beforeend", ruleRow({ k: "NAME_GLOB" }, box.children.length));
		};
		$("#se-rules", m).addEventListener("click", (e) => {
			if (e.target.hasAttribute("data-rdel")) e.target.closest(".rule").remove();
		});
	};

	UI.pickFile = (accept, cb) => {
		const inp = document.createElement("input");
		inp.type = "file";
		inp.accept = accept;
		inp.onchange = () => {
			const f = inp.files && inp.files[0];
			if (!f) return;
			const r = new FileReader();
			r.onload = () => cb(String(r.result));
			r.readAsText(f);
		};
		inp.click();
	};

	UI.addPlace = () => {
		if (!A.Geo.fix) {
			A.toast(A.t("gps.wait"));
			return;
		}
		const html = "<label>" + A.t("pl.name") + "<input id='pl-n' value='" + A.esc(A.t("pl.home")) + "'></label><label>" + A.t("pl.radius") + "<select id='pl-r'><option>100</option><option selected>150</option><option>300</option><option>500</option></select></label><label class='row'><input type='checkbox' id='pl-h' checked> " + A.t("pl.hide") + "</label>";
		const m = UI.modal(A.t("pl.add"), html, [{ label: A.t("btn.save"), primary: true, fn: () => {
			A.Geo.savePlace($("#pl-n", m).value.trim() || "Place", parseInt($("#pl-r", m).value, 10), $("#pl-h", m).checked);
			UI.renderSettings();
			return true;
		} }]);
	};
})(window.Argus);
