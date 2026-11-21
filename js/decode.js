// Argus — advertisement decoding: Remote ID (ASTM F3411), Apple Continuity, Find My,
// Samsung SmartTag, Google Find Hub / Fast Pair, DULT, Eddystone, Microsoft, BTHome, HomeKit.
"use strict";
(function (A) {
	const D = A.Decode = {};
	const MSG = 25;

	// ---------- Remote ID ----------
	const UA_TYPES = ["None", "Aeroplane", "Helicopter / multirotor", "Gyroplane", "Hybrid lift (VTOL)", "Ornithopter", "Glider", "Kite", "Free balloon", "Captive balloon", "Airship", "Free fall / parachute", "Rocket", "Tethered aircraft", "Ground obstacle", "Other"];
	const ID_TYPES = ["None", "Serial number (CTA-2063)", "CAA registration", "UTM assigned", "Specific session"];
	const STATUS = ["Undeclared", "On ground", "Airborne", "Emergency", "Remote ID failure"];
	const CTA = [
		["18179132", "Freefly Alta X Gen2"], ["1817913", "Freefly Astro"], ["181792", "Freefly Alta X"], ["181793", "Freefly Alta X broadcast kit"], ["1817", "Freefly"],
		["1914CL2D", "BRINC Lemur 2"], ["1914CR1D", "BRINC Responder"], ["1914", "BRINC"], ["1839FTD", "Teal 2"], ["1839", "Teal"],
		["1748C", "Autel"], ["1668B", "Skydio"], ["1581F", "DJI"], ["1701A", "Percepto"], ["1587A", "AgEagle"],
	];

	function ctaMaker(id) {
		const s = String(id || "").trim().toUpperCase();
		for (const p of CTA) {
			if (s.startsWith(p[0])) return p[1];
		}
		return "";
	}

	function ridMessages(b) {
		const start = (b.length >= 2 + MSG && b[0] === 0x0D) ? 2 : 0;
		if (start >= b.length) return [];
		const head = b[start];
		if ((head >> 4) === 0xF && start + 3 <= b.length) {
			const size = Math.max(MSG, b[start + 1]);
			const count = b[start + 2];
			const out = [];
			let i = start + 3;
			for (let n = 0; n < count; n++) {
				if (i + MSG > b.length) break;
				out.push(b.subarray(i, i + MSG));
				i += size;
			}
			return out;
		}
		const out = [];
		for (let i = start; i + MSG <= b.length; i += MSG) out.push(b.subarray(i, i + MSG));
		return out;
	}

	// Merge decoded Remote ID facts into prev (sticky: newer values win, missing keep old).
	D.remoteId = (hex, prev) => {
		const b = A.fromHex(hex);
		const r = Object.assign({}, prev || {});
		let any = false;
		for (const m of ridMessages(b)) {
			const type = m[0] >> 4;
			if (type === 0) {
				const idType = m[1] >> 4;
				const uaType = m[1] & 0x0F;
				const id = A.ascii(m, 2, 22);
				if (id) {
					r.uasId = id;
					r.idType = ID_TYPES[idType] || ("type " + idType);
					r.uaType = UA_TYPES[uaType] || ("type " + uaType);
					if (idType === 1) r.maker = ctaMaker(id);
					any = true;
				}
			} else if (type === 1) {
				const flags = m[1];
				const status = flags >> 4;
				const ew = (flags >> 1) & 1;
				const mult = flags & 1;
				const dir = m[2];
				const sh = m[3];
				let vr = m[4];
				if (vr > 127) vr -= 256;
				const lat = A.i32le(m, 5) * 1e-7;
				const lon = A.i32le(m, 9) * 1e-7;
				if (lat !== 0 || lon !== 0) {
					if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
						r.lat = lat;
						r.lon = lon;
					}
				}
				r.status = STATUS[status] || ("status " + status);
				r.heading = (dir === 255) ? null : ((dir + (ew ? 180 : 0)) % 360);
				r.speed = (sh === 255) ? null : ((mult === 0) ? (sh * 0.25) : ((sh * 0.75) + (255 * 0.25)));
				r.vspeed = vr * 0.5;
				const altGeo = A.u16le(m, 15);
				r.alt = (altGeo === 0) ? null : ((altGeo * 0.5) - 1000);
				const hgt = A.u16le(m, 17);
				r.height = (hgt === 0) ? null : ((hgt * 0.5) - 1000);
				r.at = Date.now();
				any = true;
			} else if (type === 3) {
				const t = A.ascii(m, 2, 25);
				if (t) r.selfId = t;
				any = true;
			} else if (type === 4) {
				const olat = A.i32le(m, 2) * 1e-7;
				const olon = A.i32le(m, 6) * 1e-7;
				if ((olat !== 0 || olon !== 0) && Math.abs(olat) <= 90 && Math.abs(olon) <= 180) {
					r.opLat = olat;
					r.opLon = olon;
				}
				const count = A.u16le(m, 10);
				if (count > 1) r.areaCount = count;
				any = true;
			} else if (type === 5) {
				const op = A.ascii(m, 2, 22);
				if (op) r.operatorId = op;
				any = true;
			} else if (type === 2) {
				r.auth = true;
				any = true;
			}
		}
		return any ? r : (prev || null);
	};

	// French Direct Remote ID is Wi-Fi only; not reachable on iPhone.

	// ---------- Apple ----------
	function appleTlvs(b) {
		const out = [];
		let i = 0;
		while (i + 2 <= b.length) {
			const type = b[i];
			const len = b[i + 1];
			if (len <= 0 || i + 2 + len > b.length) break;
			out.push({ type: type, data: b.subarray(i + 2, i + 2 + len) });
			i += 2 + len;
		}
		return out;
	}
	D.appleTlvs = (hex) => appleTlvs(A.fromHex(hex));

	const APPLE_TYPES = {
		0x02: "iBeacon", 0x03: "AirPrint", 0x05: "AirDrop", 0x06: "HomeKit", 0x07: "Proximity Pairing (AirPods / Beats)", 0x08: "Hey Siri",
		0x09: "AirPlay Target", 0x0A: "AirPlay Source", 0x0B: "Magic Switch (Watch)", 0x0C: "Handoff", 0x0D: "Instant Hotspot (looking)",
		0x0E: "Instant Hotspot (offering)", 0x0F: "Nearby Action", 0x10: "Nearby Info", 0x12: "Find My",
	};
	const CONTINUITY = new Set([0x05, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x10]);

	const AIRPODS = {
		0x0220: "AirPods (1st gen)", 0x0F20: "AirPods (2nd gen)", 0x1320: "AirPods (3rd gen)", 0x1920: "AirPods (4th gen)", 0x1C20: "AirPods 4",
		0x0E20: "AirPods Pro", 0x1420: "AirPods Pro (2nd gen)", 0x2420: "AirPods Pro 2 (USB-C)", 0x1F20: "AirPods Max", 0x2D20: "AirPods Max 2",
		0x0A20: "Beats Solo3", 0x0B20: "Powerbeats 3", 0x0C20: "Beats Studio Buds", 0x0D20: "Beats Fit Pro", 0x1020: "Powerbeats Pro",
		0x1120: "Beats Studio Buds +", 0x1220: "Beats Solo Pro", 0x1720: "Beats Flex", 0x1A20: "Beats Studio Pro", 0x1B20: "Beats Fit Pro",
		0x0520: "BeatsX", 0x0920: "Beats Studio3 Wireless", 0x1620: "Beats Studio Buds +", 0x2520: "Beats Solo 4", 0x2620: "Beats Solo Buds", 0x3820: "Beats 360",
	};
	const POD_STATUS = { 0x01: "One or both out of the case", 0x02: "Case open", 0x03: "Taken out / in-ear transition", 0x05: "One in ear", 0x09: "Both out, not in ear", 0x0B: "In-ear activity", 0x11: "Both in ear", 0x13: "Both in ear", 0x21: "One in ear (sharing?)", 0x51: "Both in case, lid open", 0x55: "Both in case, lid closed", 0x75: "In case" };
	const COLORS = ["White", "Black", "Red", "Blue", "Pink", "Gray", "Silver", "Gold", "Rose gold", "Space gray", "Dark blue", "Light blue", "Yellow"];
	const NEARBY_ACTION = { 0x01: "Apple TV setup", 0x04: "Mobile backup", 0x05: "Watch setup", 0x06: "Apple TV pair", 0x08: "Join this Wi-Fi?", 0x09: "iPhone / iPad setup", 0x0A: "Repair", 0x0B: "Speaker setup (HomePod)", 0x0C: "Apple Pay", 0x0D: "Audio device setup", 0x0F: "Call answered", 0x10: "Call ended", 0x13: "Password autofill", 0x14: "Companion link", 0x17: "Display setup" };
	const NEARBY_INFO = { 0x00: "activity unknown", 0x01: "activity reporting off", 0x03: "idle (screen locked)", 0x05: "audio playing, screen locked", 0x07: "active (screen on)", 0x09: "screen on, video playing", 0x0A: "Watch on wrist and unlocked", 0x0B: "recent interaction", 0x0D: "user is driving", 0x0E: "phone or FaceTime call" };
	const HK_CAT = { 0: "Bridged accessory", 1: "Other", 2: "Bridge", 3: "Fan", 4: "Garage door opener", 5: "Lighting", 6: "Lock", 7: "Outlet", 8: "Switch", 9: "Thermostat", 10: "Sensor", 11: "Security system", 12: "Door", 13: "Window", 14: "Window covering", 15: "Programmable switch", 16: "Range extender", 17: "IP camera", 19: "Air purifier", 20: "Heater", 21: "Air conditioner", 22: "Humidifier", 23: "Dehumidifier", 28: "Sprinkler", 29: "Faucet", 30: "Shower system" };

	function pct(n) {
		if (n <= 9) return (n * 10) + "%";
		if (n <= 14) return "100%";
		return "n/a";
	}

	function decodeApple(b, out) {
		for (const tlv of appleTlvs(b)) {
			const d = tlv.data;
			const name = APPLE_TYPES[tlv.type] || ("Apple type 0x" + tlv.type.toString(16));
			if (tlv.type === 0x07 && d.length >= 4) {
				const s = (d[0] === 0x01) ? 1 : 0;
				const model = (d[s] << 8) | d[s + 1];
				out.push(["Product", AIRPODS[model] || ("Apple audio 0x" + model.toString(16).padStart(4, "0"))]);
				if (d.length > s + 2) out.push(["Pod position", POD_STATUS[d[s + 2]] || ("status 0x" + d[s + 2].toString(16))]);
				if (d.length > s + 3) out.push(["Battery L / R", pct(d[s + 3] & 0x0F) + " / " + pct(d[s + 3] >> 4)]);
				if (d.length > s + 4) out.push(["Case battery", pct(d[s + 4] & 0x0F)]);
				if (d.length > s + 6) out.push(["Color", COLORS[d[s + 6]] || ("0x" + d[s + 6].toString(16))]);
			} else if (tlv.type === 0x12) {
				const st = d.length ? d[0] : 0;
				const maintained = (st & 0x04) !== 0;
				const batt = ["full", "medium", "low", "critical"][(st >> 6) & 3];
				if (d.length === 0x19) {
					out.push(["Find My", maintained ? ("Owner seen recently. Battery " + batt + ".") : "Owner NOT seen recently (separated). Broadcasting a key for the Find My network."]);
				} else if (d.length === 0x02) {
					out.push(["Find My", "Short form — usually a tag or device near its owner."]);
				} else {
					out.push(["Find My", "Find My advertisement, " + d.length + " bytes."]);
				}
			} else if (tlv.type === 0x0F && d.length) {
				const act = (d.length >= 2) ? d[1] : d[0];
				out.push(["Nearby Action", NEARBY_ACTION[act] || ("code 0x" + act.toString(16))]);
			} else if (tlv.type === 0x10 && d.length) {
				const act = d[0] & 0x0F;
				const hi = d[0] >> 4;
				const fl = (d.length > 1) ? d[1] : 0;
				const extra = [];
				if (hi & 1) extra.push("primary iCloud device");
				if (hi & 4) extra.push("AirDrop receiving on");
				if (fl & 4) extra.push("Wi-Fi on");
				if (fl & 1) extra.push("AirPods connected");
				out.push(["Apple device is", (NEARBY_INFO[act] || ("activity 0x" + act.toString(16))) + (extra.length ? (" · " + extra.join(", ")) : "")]);
			} else if (tlv.type === 0x08 && d.length >= 6) {
				const k = A.u16be(d, 4);
				const dev = { 2: "iPhone", 3: "iPad", 7: "HomePod", 9: "Mac", 10: "Watch" }[k] || ("class 0x" + k.toString(16));
				out.push(["Hey Siri", "A " + dev + " just heard a Siri trigger."]);
			} else if (tlv.type === 0x0E && d.length >= 6) {
				const batt = d[2];
				const cell = A.u16be(d, 3);
				const cellName = { 0: "4G", 6: "4G", 1: "1xRTT", 2: "GPRS", 3: "EDGE", 4: "3G", 5: "3G", 7: "LTE", 8: "5G" }[cell] || ("type " + cell);
				out.push(["Instant Hotspot", "Phone battery " + batt + "% · " + cellName + " · " + d[5] + "/5 bars"]);
			} else if (tlv.type === 0x06 && d.length >= 9) {
				const cat = A.u16le(d, 7);
				out.push(["HomeKit", (HK_CAT[cat] || ("category " + cat)) + (((d[0] & 1) === 0) ? " · paired" : " · not paired (setup mode)")]);
			} else if (tlv.type === 0x02 && d.length >= 21) {
				out.push(["iBeacon", A.hex(d.subarray(0, 16)) + " major " + A.u16be(d, 16) + " minor " + A.u16be(d, 18)]);
			} else {
				out.push(["Apple", name]);
			}
		}
	}

	function decodeMicrosoft(b, out) {
		if (b.length >= 2 && b[0] === 0x01) {
			const type = b[1] & 0x1F;
			const kind = { 1: "Xbox", 6: "iPhone", 7: "iPad", 8: "Android", 9: "Windows desktop", 11: "Windows phone", 12: "Linux", 13: "Windows IoT", 14: "Surface Hub", 15: "Windows laptop", 16: "Windows tablet" }[type] || ("type " + type);
			let share = "";
			if (b.length >= 3) share = ((b[2] & 0x1F) === 1) ? " · sharing with everyone nearby" : (((b[2] & 0x1F) === 0) ? " · sharing with my devices only" : "");
			let nm = "";
			if (b.length >= 11 && b.length <= 25 && (b[2] & 0x1F) === 1) {
				const s = A.ascii(b, 10, b.length);
				if (s) nm = " · name " + s;
			}
			out.push(["Microsoft Nearby Share", kind + share + nm]);
		} else if (b.length >= 1 && b[0] === 0x03) {
			out.push(["Microsoft Swift Pair", "In pairing mode — Windows will show a pair popup."]);
		}
	}

	function decodeFastPair(b, out) {
		if (b.length === 3) {
			const id = ((b[0] << 16) | (b[1] << 8) | b[2]) >>> 0;
			const key = id.toString(16).toUpperCase().padStart(6, "0");
			const nm = (window.ARGUS_FASTPAIR || {})[key];
			out.push(["Google Fast Pair", "In pairing mode."]);
			out.push(["Model", (nm ? (nm + " ") : "") + "(0x" + key + ")"]);
		} else if (b.length) {
			out.push(["Google Fast Pair", "Paired to an account (not in pairing mode)."]);
		}
	}

	function decodeEddystone(b, out) {
		if (!b.length) return;
		const f = b[0];
		if (f === 0x00 && b.length >= 18) out.push(["Eddystone-UID", A.hex(b.subarray(2, 12)) + " / " + A.hex(b.subarray(12, 18))]);
		else if (f === 0x10 && b.length >= 3) {
			const sch = ["http://www.", "https://www.", "http://", "https://"][b[2]] || "";
			const exp = [".com/", ".org/", ".edu/", ".net/", ".info/", ".biz/", ".gov/", ".com", ".org", ".edu", ".net", ".info", ".biz", ".gov"];
			let s = sch;
			for (let i = 3; i < b.length; i++) s += (b[i] < exp.length) ? exp[b[i]] : ((b[i] >= 32 && b[i] < 127) ? String.fromCharCode(b[i]) : "");
			out.push(["Eddystone-URL", s]);
		} else if (f === 0x20) out.push(["Eddystone-TLM", "telemetry"]);
		else if (f === 0x30) out.push(["Eddystone-EID", "rotating ID"]);
		else if (f === 0x40 || f === 0x41) out.push(["Google Find Hub", (f === 0x41) ? "SEPARATED from owner (unwanted-tracking mode)" : "normal mode, with owner"]);
	}

	function decodeSmartTag(b) {
		if (b.length < 13) return null;
		const frame = b[0];
		if ((frame & 0xF8) !== 0x10) return null;
		const st = frame & 0x07;
		const state = { 1: "Separated from owner", 2: "Separated from owner", 3: "Separated from owner, away more than 24 h", 4: "With owner", 5: "With owner", 6: "With owner" }[st] || null;
		const pid = A.hex(b.subarray(4, 12));
		const batt = ["Very low", "Low", "Medium", "Full"][b[12] & 3];
		return { state: state, separated: (st >= 1 && st <= 3), privacyId: pid, battery: batt };
	}

	const BTH = {
		0x01: ["Battery", 1, false, 1, "%"], 0x02: ["Temperature", 2, true, 0.01, "°C"], 0x03: ["Humidity", 2, false, 0.01, "%"], 0x04: ["Pressure", 3, false, 0.01, "hPa"],
		0x05: ["Illuminance", 3, false, 0.01, "lx"], 0x08: ["Dew point", 2, true, 0.01, "°C"], 0x0C: ["Voltage", 2, false, 0.001, "V"], 0x12: ["CO2", 2, false, 1, "ppm"],
		0x2E: ["Humidity", 1, false, 1, "%"], 0x45: ["Temperature", 2, true, 0.1, "°C"], 0x10: ["Power", 1, false, 1, ""], 0x11: ["Opening", 1, false, 1, ""],
		0x21: ["Motion", 1, false, 1, ""], 0x2D: ["Window", 1, false, 1, ""], 0x0D: ["PM2.5", 2, false, 1, "µg/m³"], 0x0E: ["PM10", 2, false, 1, "µg/m³"],
	};

	function decodeBthome(b, out) {
		if (!b.length) return;
		const info = b[0];
		if (info & 1) {
			out.push(["BTHome", "encrypted sensor"]);
			return;
		}
		let i = 1;
		const parts = [];
		while (i < b.length) {
			const spec = BTH[b[i]];
			if (!spec) break;
			const w = spec[1];
			if (i + 1 + w > b.length) break;
			let v = 0;
			for (let k = 0; k < w; k++) v |= b[i + 1 + k] << (8 * k);
			if (spec[2] && (v & (1 << ((8 * w) - 1)))) v -= (1 << (8 * w));
			parts.push(spec[0] + " " + (+(v * spec[3]).toFixed(2)) + spec[4]);
			i += 1 + w;
		}
		out.push(["BTHome sensor", parts.join(" · ") || "sensor data"]);
	}

	// Human-readable decode lines for the detail sheet: [[label, value], ...]
	D.fields = (d) => {
		const out = [];
		for (const cid in d.mfg) {
			const b = A.fromHex(d.mfg[cid]);
			const c = cid | 0;
			if (c === 0x004C) decodeApple(b, out);
			else if (c === 0x0006) decodeMicrosoft(b, out);
			else if (c === 0x0157 && b.length >= 22 && b[0] === 0xBE && b[1] === 0xAC) out.push(["AltBeacon", A.hex(b.subarray(2, 18)) + " " + A.u16be(b, 18) + "/" + A.u16be(b, 20)]);
		}
		for (const u in d.svc) {
			const b = A.fromHex(d.svc[u]);
			if (u === "FE2C") decodeFastPair(b, out);
			else if (u === "FEAA") decodeEddystone(b, out);
			else if (u === "FD5A") {
				const s = decodeSmartTag(b);
				if (s) out.push(["Samsung SmartTag", (s.state || "unknown state") + " · battery " + s.battery]);
			} else if (u === "FCB2" && b.length >= 2) out.push(["Unwanted-tracker standard (DULT)", ((b[1] & 1) === 0) ? "SEPARATED from owner" : "near owner"]);
			else if (u === "FCD2") decodeBthome(b, out);
			else if (u === "FD6F") out.push(["Exposure Notification", "COVID-era exposure beacon (rotating ID)."]);
		}
		if (d.rid) {
			const r = d.rid;
			if (r.uasId) out.push(["Drone ID", r.uasId + (r.maker ? (" · " + r.maker) : "")]);
			if (r.uaType) out.push(["Aircraft type", r.uaType]);
			if (r.status) out.push(["Drone status", r.status]);
			if (r.lat != null) out.push(["Drone position", r.lat.toFixed(6) + ", " + r.lon.toFixed(6)]);
			if (r.alt != null) out.push(["Altitude (GPS)", r.alt.toFixed(0) + " m"]);
			if (r.height != null) out.push(["Height above takeoff", r.height.toFixed(0) + " m"]);
			if (r.speed != null) out.push(["Speed", r.speed.toFixed(1) + " m/s" + ((r.heading != null) ? (" · heading " + r.heading + "°") : "")]);
			if (r.opLat != null) out.push(["Pilot / operator position", r.opLat.toFixed(6) + ", " + r.opLon.toFixed(6)]);
			if (r.operatorId) out.push(["Operator ID", r.operatorId]);
			if (r.selfId) out.push(["Pilot message", r.selfId]);
		}
		return out;
	};

	// Separated-from-owner state for tracker monitoring.
	// Returns { key, state: "SEPARATED"|"NEAR" } or null.
	D.trackerState = (d) => {
		if (d.svc.FD5A) {
			const s = decodeSmartTag(A.fromHex(d.svc.FD5A));
			if (s) {
				if (s.separated) return { key: "smarttag:" + s.privacyId, state: "SEPARATED" };
				if (s.state) return { key: "smarttag:" + s.privacyId, state: "NEAR" };
			}
		}
		let near = false;
		let sep = false;
		if (d.svc.FCB2) {
			const b = A.fromHex(d.svc.FCB2);
			if (b.length >= 2) {
				if ((b[1] & 1) === 0) sep = true;
				else near = true;
			}
		}
		if (d.svc.FEAA) {
			const b = A.fromHex(d.svc.FEAA);
			if (b.length && b[0] === 0x41) sep = true;
			if (b.length && b[0] === 0x40) near = true;
		}
		if (d.mfg[76] != null && !D.applePhone(d)) {
			for (const tlv of D.appleTlvs(d.mfg[76])) {
				if (tlv.type !== 0x12) continue;
				if (tlv.data.length === 0x02) near = true;
				else if (tlv.data.length === 0x19 && (tlv.data[0] & 0x04)) near = true;
				else if (tlv.data.length === 0x19) sep = true;
			}
		}
		if (near) return { key: "ble:" + d.id, state: "NEAR" };
		if (sep) return { key: "ble:" + d.id, state: "SEPARATED" };
		return null;
	};

	// An iPhone/Mac/iPad advertising Continuity is not a tag.
	D.applePhone = (d) => {
		if (d.name && /airtag/i.test(d.name)) return false;
		if (d.uuids.has("FD44") || d.svc.FD44 != null) return false;
		if (d.mfg[76] == null) return false;
		for (const tlv of D.appleTlvs(d.mfg[76])) {
			if (CONTINUITY.has(tlv.type)) return true;
		}
		return false;
	};

	// Advertisement that makes a phone show a pairing popup (flood detection).
	D.isPopup = (d) => {
		if (d.mfg[76] != null) {
			for (const tlv of D.appleTlvs(d.mfg[76])) {
				if (tlv.type === 0x07 || tlv.type === 0x0F) return true;
			}
		}
		if (d.svc.FE2C != null && d.svc.FE2C.length === 6) return true;
		if (d.mfg[6] != null && d.mfg[6].startsWith("03")) return true;
		if (d.mfg[117] != null && d.mfg[117].startsWith("0100")) return true; // Samsung Easy Setup style
		return false;
	};

	D.popupFamily = (d) => {
		if (d.mfg[76] != null) return "Apple";
		if (d.svc.FE2C != null) return "Google Fast Pair";
		if (d.mfg[6] != null) return "Microsoft Swift Pair";
		if (d.mfg[117] != null) return "Samsung";
		return "";
	};
})(window.Argus);
