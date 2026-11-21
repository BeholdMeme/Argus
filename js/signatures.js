// Argus — signature library and matcher (Bluetooth LE rules from the Fieldwatch catalog).
"use strict";
(function (A) {
	// Class metadata. Colors follow a fixed palette so classes are easy to tell apart.
	A.KINDS = {
		FINDER: { color: "#ff3b6b", icon: "⌖", prio: 1 },
		DRONE: { color: "#ff9f1a", icon: "✈", prio: 2 },
		HACKING: { color: "#ff4dff", icon: "⚠", prio: 3 },
		LAW_ENFORCEMENT: { color: "#4da3ff", icon: "★", prio: 4 },
		SURVEILLANCE: { color: "#00d1ff", icon: "◉", prio: 5 },
		MILITARY: { color: "#9acd32", icon: "▲", prio: 6 },
		CAMERA: { color: "#38e0c8", icon: "▣", prio: 7 },
		GLASSES: { color: "#c084fc", icon: "◎", prio: 8 },
		TWO_WAY: { color: "#facc15", icon: "☏", prio: 9 },
		VEHICLE: { color: "#a3a3ff", icon: "⛟", prio: 10 },
		WEARABLE: { color: "#7dd3fc", icon: "⌚", prio: 11 },
		HEALTH: { color: "#f472b6", icon: "♥", prio: 12 },
		AUDIO: { color: "#86efac", icon: "♪", prio: 13 },
		PHONE: { color: "#cbd5e1", icon: "▯", prio: 14 },
		LOCK: { color: "#fbbf24", icon: "⚿", prio: 15 },
		BEACON: { color: "#fde68a", icon: "✦", prio: 16 },
		MESH: { color: "#93c5fd", icon: "⋈", prio: 17 },
		HOME: { color: "#bef264", icon: "⌂", prio: 18 },
		THERMOSTAT: { color: "#fca5a5", icon: "°", prio: 19 },
		SIGNAGE: { color: "#e5e7eb", icon: "▤", prio: 20 },
		ISP: { color: "#9ca3af", icon: "≋", prio: 21 },
		OTHER: { color: "#9ca3af", icon: "•", prio: 22 },
	};

	A.kindLabel = (k) => A.t("kind." + k);

	const Sig = A.Sig = {};

	function globRe(p) {
		const s = String(p).replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
		return new RegExp("^" + s + "$", "i");
	}

	function compileRule(r) {
		const k = r.k;
		if (k === "NAME_GLOB") {
			if (!r.t) return null;
			const re = globRe(r.t);
			return (d) => !!d.name && re.test(d.name);
		}
		if (k === "NAME_CONTAINS") {
			if (!r.t) return null;
			const needle = r.t.toLowerCase();
			return (d) => !!d.name && d.name.toLowerCase().indexOf(needle) >= 0;
		}
		if (k === "SERVICE_UUID") {
			if (!r.t) return null;
			const want = A.uuidKey(r.t);
			return (d) => d.uuids.has(want) || (want in d.svc);
		}
		if (k === "MANUFACTURER_ID") {
			const cid = r.c | 0;
			return (d) => (cid in d.mfg);
		}
		if (k === "MANUFACTURER_DATA") {
			const p = (r.p || "").toUpperCase();
			if (!p) return null;
			const cid = r.c | 0;
			return (d) => {
				for (const key in d.mfg) {
					if (cid !== 0 && (key | 0) !== cid) continue;
					if (d.mfg[key].startsWith(p)) return true;
				}
				return false;
			};
		}
		if (k === "SERVICE_DATA") {
			const p = (r.p || "").toUpperCase();
			const want = r.t ? A.uuidKey(r.t) : "";
			if (!p && !want) return null;
			return (d) => {
				if (want) {
					const v = d.svc[want];
					if (v == null) return false;
					return !p || v.startsWith(p);
				}
				for (const key in d.svc) {
					if (d.svc[key].indexOf(p) >= 0) return true;
				}
				return false;
			};
		}
		return null;
	}

	Sig.compile = () => {
		const builtIn = window.ARGUS_SIGNATURES || [];
		const custom = A.Store.get("customSigs", []);
		const disabled = new Set(A.Store.get("disabledSigs", []));
		const all = builtIn.map((f) => Object.assign({ builtIn: true }, f)).concat(custom.map((f) => Object.assign({ builtIn: false }, f)));
		Sig.all = all;
		Sig.byId = {};
		Sig.active = [];
		for (const f of all) {
			Sig.byId[f.id] = f;
			if (disabled.has(f.id)) continue;
			const tests = (f.rules || []).map(compileRule).filter(Boolean);
			if (!tests.length) continue;
			Sig.active.push({ f: f, tests: tests, any: f.matchAny !== false });
		}
		Sig.bookmarks = new Set(A.Store.get("bookmarkSigs", []));
	};

	// Returns array of fleet objects that match the device, sorted by class priority.
	Sig.match = (d) => {
		const out = [];
		for (const s of Sig.active) {
			let hit;
			if (s.any) {
				hit = false;
				for (const t of s.tests) {
					if (t(d)) {
						hit = true;
						break;
					}
				}
			} else {
				hit = true;
				for (const t of s.tests) {
					if (!t(d)) {
						hit = false;
						break;
					}
				}
			}
			if (hit) out.push(s.f);
		}
		out.sort((a, b) => ((A.KINDS[a.kind] || A.KINDS.OTHER).prio - (A.KINDS[b.kind] || A.KINDS.OTHER).prio));
		return out;
	};

	Sig.setDisabled = (id, off) => {
		const set = new Set(A.Store.get("disabledSigs", []));
		if (off) set.add(id);
		else set.delete(id);
		A.Store.set("disabledSigs", Array.from(set));
		Sig.compile();
	};

	Sig.setBookmark = (id, on) => {
		const set = new Set(A.Store.get("bookmarkSigs", []));
		if (on) set.add(id);
		else set.delete(id);
		A.Store.set("bookmarkSigs", Array.from(set));
		Sig.bookmarks = set;
	};

	Sig.addCustom = (f) => {
		const list = A.Store.get("customSigs", []);
		const i = list.findIndex((x) => x.id === f.id);
		if (i >= 0) list[i] = f;
		else list.push(f);
		A.Store.set("customSigs", list);
		Sig.compile();
	};

	Sig.removeCustom = (id) => {
		A.Store.set("customSigs", A.Store.get("customSigs", []).filter((x) => x.id !== id));
		Sig.compile();
	};

	// Suggest rules from an observed device ("create from device").
	Sig.suggest = (d) => {
		const rules = [];
		if (d.name) {
			const stem = d.name.replace(/[\s_-]*[0-9A-Fa-f]{2,}$/, "").trim();
			rules.push({ k: "NAME_GLOB", t: ((stem && stem !== d.name) ? (stem + "*") : d.name) });
		}
		for (const u of d.uuids) {
			if (u.length === 4) rules.push({ k: "SERVICE_UUID", t: u });
		}
		for (const c in d.mfg) {
			if ((c | 0) === 76) continue; // Apple id alone matches every Apple device
			rules.push({ k: "MANUFACTURER_ID", c: c | 0 });
		}
		return rules;
	};

	// Import Fieldwatch-format JSON (or Argus export). BLE rules only.
	Sig.importJson = (text) => {
		const data = JSON.parse(text);
		const fleets = Array.isArray(data) ? data : (data.fleets || []);
		let n = 0;
		const kinds = new Set(["NAME_GLOB", "NAME_CONTAINS", "SERVICE_UUID", "MANUFACTURER_ID", "MANUFACTURER_DATA", "SERVICE_DATA"]);
		const list = A.Store.get("customSigs", []);
		for (const f of fleets) {
			const rules = [];
			for (const r of (f.rules || [])) {
				const k = r.kind || r.k;
				if (!kinds.has(k)) continue;
				if (r.radio === "WIFI") continue;
				if (r.enabled === false) continue;
				const o = { k: k };
				const t = r.text || r.t;
				if (t) o.t = t;
				const c = r.companyId || r.c;
				if (c) o.c = c;
				const p = r.dataPrefixHex || r.p;
				if (p) o.p = String(p).replace(/[^0-9a-fA-F]/g, "").toUpperCase();
				rules.push(o);
			}
			if (!rules.length) continue;
			const id = "custom-" + (f.id || A.uid());
			const entry = { id: id, name: f.name || "Imported", kind: f.kind || "OTHER", matchAny: f.matchAny !== false, notes: f.notes || "", attention: f.attentionNote || f.attention || "", rules: rules };
			const i = list.findIndex((x) => x.id === id);
			if (i >= 0) list[i] = entry;
			else list.push(entry);
			n++;
		}
		A.Store.set("customSigs", list);
		Sig.compile();
		return n;
	};

	Sig.exportJson = () => {
		const custom = A.Store.get("customSigs", []);
		return JSON.stringify({
			format: "fieldwatch-signatures",
			formatVersion: 1,
			appVersion: "argus",
			fleets: custom.map((f) => ({
				id: f.id,
				name: f.name,
				enabled: true,
				matchAny: f.matchAny !== false,
				kind: f.kind,
				notes: f.notes || "",
				attentionNote: f.attention || "",
				rules: f.rules.map((r) => ({ kind: r.k, text: r.t || "", companyId: r.c || 0, dataPrefixHex: r.p || "", radio: "BLE", enabled: true })),
			})),
		}, null, "\t");
	};
})(window.Argus);
