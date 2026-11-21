// Argus — storage. Small settings in localStorage, sessions and caches in IndexedDB.
"use strict";
(function (A) {
	const PREFIX = "argus.";
	const S = A.Store = {};
	const mem = {};

	S.get = (key, def) => {
		try {
			const raw = localStorage.getItem(PREFIX + key);
			if (raw == null) return (key in mem) ? mem[key] : def;
			return JSON.parse(raw);
		} catch (e) {
			return (key in mem) ? mem[key] : def;
		}
	};

	S.set = (key, val) => {
		mem[key] = val;
		try {
			localStorage.setItem(PREFIX + key, JSON.stringify(val));
		} catch (e) {
			// storage full or blocked; keep in memory
		}
	};

	// ---- IndexedDB key/value (stores: sessions, kv) ----
	let dbp = null;
	function db() {
		if (dbp) return dbp;
		dbp = new Promise((resolve) => {
			try {
				const req = indexedDB.open("argus", 1);
				req.onupgradeneeded = () => {
					const d = req.result;
					if (!d.objectStoreNames.contains("sessions")) d.createObjectStore("sessions", { keyPath: "id" });
					if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv");
				};
				req.onsuccess = () => resolve(req.result);
				req.onerror = () => resolve(null);
			} catch (e) {
				resolve(null);
			}
		});
		return dbp;
	}

	function tx(store, mode, fn) {
		return db().then((d) => new Promise((resolve) => {
			if (!d) {
				resolve(null);
				return;
			}
			try {
				const t = d.transaction(store, mode);
				const st = t.objectStore(store);
				const r = fn(st);
				t.oncomplete = () => resolve(r && "result" in r ? r.result : true);
				t.onerror = () => resolve(null);
				t.onabort = () => resolve(null);
			} catch (e) {
				resolve(null);
			}
		}));
	}

	S.putSession = (s) => tx("sessions", "readwrite", (st) => st.put(s));
	S.getSession = (id) => tx("sessions", "readonly", (st) => st.get(id));
	S.deleteSession = (id) => tx("sessions", "readwrite", (st) => st.delete(id));
	S.listSessions = () => tx("sessions", "readonly", (st) => st.getAll()).then((all) => (all || []).map((s) => ({
		id: s.id,
		name: s.name,
		start: s.start,
		end: s.end,
		devices: (s.devices || []).length,
		alerts: (s.alerts || []).length,
		pathM: s.pathM || 0,
	})).sort((a, b) => b.start - a.start));

	S.kvGet = (k) => tx("kv", "readonly", (st) => st.get(k));
	S.kvSet = (k, v) => tx("kv", "readwrite", (st) => st.put(v, k));
})(window.Argus);
