// Argus — shared helpers.
"use strict";
window.Argus = window.Argus || {};
(function (A) {
	A.now = () => Date.now();

	// Tiny event bus.
	const handlers = {};
	A.on = (name, fn) => {
		(handlers[name] = handlers[name] || []).push(fn);
	};
	A.emit = (name, data) => {
		for (const fn of (handlers[name] || [])) {
			try {
				fn(data);
			} catch (e) {
				console.error(name, e);
			}
		}
	};

	A.$ = (sel, root) => (root || document).querySelector(sel);
	A.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

	A.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));

	A.bytes = (dv) => {
		if (!dv) return new Uint8Array(0);
		if (dv instanceof Uint8Array) return dv;
		if (dv instanceof ArrayBuffer) return new Uint8Array(dv);
		return new Uint8Array(dv.buffer, dv.byteOffset || 0, dv.byteLength);
	};

	A.hex = (u8) => {
		let s = "";
		for (let i = 0; i < u8.length; i++) s += (u8[i] < 16 ? "0" : "") + u8[i].toString(16);
		return s.toUpperCase();
	};

	A.fromHex = (h) => {
		const c = String(h || "").replace(/[^0-9a-fA-F]/g, "");
		const out = new Uint8Array(Math.floor(c.length / 2));
		for (let i = 0; i < out.length; i++) out[i] = parseInt(c.substr(i * 2, 2), 16);
		return out;
	};

	const BASE_TAIL = "00001000800000805F9B34FB";
	// Short form for Bluetooth base UUIDs ("FFFA"), else 32 hex chars, uppercase.
	A.uuidKey = (u) => {
		let h = String(u == null ? "" : u);
		if (typeof u === "number") h = u.toString(16).padStart(4, "0");
		h = h.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
		if (h.length === 4) return h;
		if (h.length === 8 && h.startsWith("0000")) return h.substring(4);
		if (h.length === 32 && h.startsWith("0000") && h.endsWith(BASE_TAIL)) return h.substring(4, 8);
		return h;
	};

	A.u16le = (b, i) => b[i] | (b[i + 1] << 8);
	A.u16be = (b, i) => (b[i] << 8) | b[i + 1];
	A.i32le = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24));
	A.u32le = (b, i) => (A.i32le(b, i) >>> 0);
	A.ascii = (b, from, to) => {
		let s = "";
		for (let i = from; i < Math.min(to, b.length); i++) {
			const c = b[i];
			if (c === 0) continue;
			s += (c >= 32 && c < 127) ? String.fromCharCode(c) : "";
		}
		return s.trim();
	};

	// Meters between two points.
	A.dist = (lat1, lon1, lat2, lon2) => {
		const R = 6371000;
		const toR = Math.PI / 180;
		const dLat = (lat2 - lat1) * toR;
		const dLon = (lon2 - lon1) * toR;
		const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2;
		return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
	};

	A.fmtDist = (m) => {
		if (m == null || !isFinite(m)) return "—";
		return (m < 1000) ? (Math.round(m) + " m") : ((m / 1000).toFixed(m < 10000 ? 2 : 1) + " km");
	};

	A.fmtAgo = (ms) => {
		if (ms == null) return "—";
		const s = Math.max(0, Math.round(ms / 1000));
		if (s < 60) return s + A.t("u.s");
		const m = Math.floor(s / 60);
		if (m < 60) return m + A.t("u.m");
		const h = Math.floor(m / 60);
		return h + A.t("u.h") + " " + (m % 60) + A.t("u.m");
	};

	A.fmtDur = (ms) => A.fmtAgo(ms);

	A.fmtClock = (ts) => {
		const d = new Date(ts);
		return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + ":" + String(d.getSeconds()).padStart(2, "0");
	};

	A.fmtDate = (ts) => {
		const d = new Date(ts);
		return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + " " + A.fmtClock(ts).substring(0, 5);
	};

	// Stable 0..1 from a string (radar seat, colors).
	A.hash01 = (s) => {
		let h = 2166136261;
		for (let i = 0; i < s.length; i++) {
			h ^= s.charCodeAt(i);
			h = Math.imul(h, 16777619);
		}
		return ((h >>> 0) % 100000) / 100000;
	};

	A.rssiColor = (r) => {
		if (r == null) return "#777";
		if (r >= -55) return "#3ddc84";
		if (r >= -70) return "#f5c542";
		if (r >= -85) return "#ff8c3a";
		return "#ff4d4d";
	};

	// 0..1 strength from dBm, -100 → 0, -30 → 1.
	A.rssi01 = (r) => Math.max(0, Math.min(1, ((r + 100) / 70)));

	A.heatColor = (f) => {
		// blue → green → yellow → red
		const stops = [[0, [40, 90, 255]], [0.35, [40, 220, 120]], [0.7, [255, 220, 40]], [1, [255, 50, 40]]];
		for (let i = 1; i < stops.length; i++) {
			if (f <= stops[i][0]) {
				const a = stops[i - 1];
				const b = stops[i];
				const k = ((f - a[0]) / (b[0] - a[0]));
				const c = a[1].map((v, j) => Math.round(v + ((b[1][j] - v) * k)));
				return "rgb(" + c.join(",") + ")";
			}
		}
		return "rgb(255,50,40)";
	};

	// Save or share a text file. Falls back to clipboard.
	A.saveText = async (name, text, mime) => {
		const type = mime || "text/plain";
		try {
			if (navigator.canShare && window.File) {
				const file = new File([text], name, { type: type });
				if (navigator.canShare({ files: [file] })) {
					await navigator.share({ files: [file], title: name });
					return "shared";
				}
			}
		} catch (e) {
			if (e && e.name === "AbortError") return "cancel";
		}
		try {
			const blob = new Blob([text], { type: type });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = name;
			document.body.appendChild(a);
			a.click();
			setTimeout(() => {
				URL.revokeObjectURL(url);
				a.remove();
			}, 2000);
			return "download";
		} catch (e) {
			// fall through
		}
		await A.copy(text);
		return "copied";
	};

	A.copy = async (text) => {
		try {
			await navigator.clipboard.writeText(text);
			A.toast(A.t("toast.copied"));
			return true;
		} catch (e) {
			const ta = document.createElement("textarea");
			ta.value = text;
			document.body.appendChild(ta);
			ta.select();
			try {
				document.execCommand("copy");
				A.toast(A.t("toast.copied"));
			} catch (e2) {
				A.toast(A.t("toast.copyfail"));
			}
			ta.remove();
			return false;
		}
	};

	let toastTimer = null;
	A.toast = (msg, ms) => {
		let el = A.$("#toast");
		if (!el) {
			el = document.createElement("div");
			el.id = "toast";
			document.body.appendChild(el);
		}
		el.textContent = msg;
		el.classList.add("show");
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => el.classList.remove("show"), ms || 2500);
	};

	// Sound. iOS needs a tap before audio can play: A.unlockAudio() on Start.
	let actx = null;
	A.unlockAudio = () => {
		try {
			if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
			if (actx.state === "suspended") actx.resume();
			const o = actx.createOscillator();
			const g = actx.createGain();
			g.gain.value = 0.0001;
			o.connect(g).connect(actx.destination);
			o.start();
			o.stop(actx.currentTime + 0.02);
		} catch (e) {
			// no audio
		}
	};

	A.muted = () => !!A.Store.get("muted", false);

	A.beep = (freq, ms, vol) => {
		if (!actx || A.muted()) return;
		try {
			const o = actx.createOscillator();
			const g = actx.createGain();
			o.type = "square";
			o.frequency.value = freq || 880;
			g.gain.value = (vol == null) ? 0.06 : vol;
			o.connect(g).connect(actx.destination);
			const t = actx.currentTime;
			g.gain.setValueAtTime(g.gain.value, t);
			g.gain.exponentialRampToValueAtTime(0.0001, t + ((ms || 120) / 1000));
			o.start(t);
			o.stop(t + ((ms || 120) / 1000) + 0.02);
		} catch (e) {
			// ignore
		}
	};

	A.click = () => A.beep(1800, 25, 0.05);

	A.speak = (text) => {
		try {
			if (!window.speechSynthesis || A.muted()) return;
			const u = new SpeechSynthesisUtterance(text);
			u.lang = (A.lang === "ru") ? "ru-RU" : "en-US";
			u.rate = 1.05;
			window.speechSynthesis.cancel();
			window.speechSynthesis.speak(u);
		} catch (e) {
			// ignore
		}
	};

	A.flash = () => {
		const el = document.createElement("div");
		el.className = "flash";
		document.body.appendChild(el);
		setTimeout(() => el.remove(), 700);
	};

	A.debounce = (fn, ms) => {
		let t = null;
		return (...args) => {
			clearTimeout(t);
			t = setTimeout(() => fn(...args), ms);
		};
	};

	A.uid = () => (Date.now().toString(36) + Math.random().toString(36).substring(2, 8));

	// ---- MGRS (WGS84) ----
	A.mgrs = (lat, lon) => {
		if (lat == null || lon == null || lat < -80 || lat > 84) return "";
		const a = 6378137;
		const f = 1 / 298.257223563;
		const k0 = 0.9996;
		const e2 = f * (2 - f);
		const ep2 = e2 / (1 - e2);
		let zone = Math.floor((lon + 180) / 6) + 1;
		if (lat >= 56 && lat < 64 && lon >= 3 && lon < 12) zone = 32;
		if (lat >= 72 && lat < 84) {
			if (lon >= 0 && lon < 9) zone = 31;
			else if (lon >= 9 && lon < 21) zone = 33;
			else if (lon >= 21 && lon < 33) zone = 35;
			else if (lon >= 33 && lon < 42) zone = 37;
		}
		const lon0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
		const phi = lat * Math.PI / 180;
		const lam = lon * Math.PI / 180;
		const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
		const T = Math.tan(phi) ** 2;
		const C = ep2 * Math.cos(phi) ** 2;
		const Aa = Math.cos(phi) * (lam - lon0);
		const M = a * ((1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 ** 3 / 256) * phi
			- (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * phi)
			+ (15 * e2 * e2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * phi)
			- (35 * e2 ** 3 / 3072) * Math.sin(6 * phi));
		let x = k0 * N * (Aa + (1 - T + C) * Aa ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * Aa ** 5 / 120) + 500000;
		let y = k0 * (M + N * Math.tan(phi) * (Aa * Aa / 2 + (5 - T + 9 * C + 4 * C * C) * Aa ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * Aa ** 6 / 720));
		if (lat < 0) y += 10000000;
		const bands = "CDEFGHJKLMNPQRSTUVWXX";
		const band = bands[Math.floor((lat + 80) / 8)];
		const set = ((zone - 1) % 6) + 1;
		const colSets = ["ABCDEFGH", "JKLMNPQR", "STUVWXYZ"];
		const col = colSets[(set - 1) % 3][Math.floor(x / 100000) - 1];
		const rowLetters = "ABCDEFGHJKLMNPQRSTUV";
		let rowIdx = Math.floor(y / 100000) % 20;
		if (set % 2 === 0) rowIdx = (rowIdx + 5) % 20;
		const row = rowLetters[rowIdx];
		const e = String(Math.floor(x % 100000)).padStart(5, "0");
		const n = String(Math.floor(y % 100000)).padStart(5, "0");
		return zone + band + " " + col + row + " " + e + " " + n;
	};
})(window.Argus);
