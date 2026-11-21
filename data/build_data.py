#!/usr/bin/env python3
# Builds Argus data files from the Fieldwatch signature export and the
# Nordic Bluetooth numbers database. Usage:
#   python3 -I build_data.py <fieldwatch-signatures-v2.json> <company_ids.json> <out_dir>
import json
import sys

BLE_KINDS = {"NAME_GLOB", "NAME_CONTAINS", "SERVICE_UUID", "MANUFACTURER_ID", "MANUFACTURER_DATA", "SERVICE_DATA"}

# Extra signatures for Russia, not in Fieldwatch.
EXTRA = [
	{
		"id": "argus-yandex",
		"name": "Yandex",
		"kind": "HOME",
		"matchAny": True,
		"notes": "Yandex device (Alice smart speaker, Yandex Station, or other Yandex gear). Bluetooth company ID 2309 is Yandex Services AG. Model names often start with YNDX.",
		"attention": "",
		"rules": [
			{"k": "MANUFACTURER_ID", "c": 2309},
			{"k": "NAME_GLOB", "t": "YNDX*"},
			{"k": "NAME_GLOB", "t": "Yandex*"},
			{"k": "NAME_CONTAINS", "t": "Яндекс"},
		],
	},
]


def compact_rule(r):
	out = {"k": r["kind"]}
	if r.get("text"):
		out["t"] = r["text"]
	if r.get("companyId"):
		out["c"] = r["companyId"]
	if r.get("dataPrefixHex"):
		out["p"] = r["dataPrefixHex"].replace(":", "").replace(" ", "").upper()
	return out


def main():
	sig_path, comp_path, out_dir = sys.argv[1], sys.argv[2], sys.argv[3]
	src = json.load(open(sig_path, encoding="utf-8"))
	fleets = []
	for f in src["fleets"]:
		if not f.get("enabled", True):
			continue
		rules = []
		for r in f["rules"]:
			if not r.get("enabled", True):
				continue
			if r["kind"] not in BLE_KINDS:
				continue
			if r.get("radio") == "WIFI":
				continue
			rules.append(compact_rule(r))
		if not rules:
			continue
		fleets.append({
			"id": f["id"],
			"name": f["name"],
			"kind": f.get("kind") or "OTHER",
			"matchAny": f.get("matchAny", True),
			"notes": f.get("notes", ""),
			"attention": f.get("attentionNote", ""),
			"rules": rules,
		})
	fleets.extend(EXTRA)
	with open(out_dir + "/signatures.js", "w", encoding="utf-8") as fh:
		fh.write("// Generated from Fieldwatch signature catalog v" + str(src.get("catalogVersion")) + " (MIT, Off Grid Pete LLC) plus Argus extras.\n")
		fh.write("window.ARGUS_SIGNATURES = ")
		json.dump(fleets, fh, ensure_ascii=False, separators=(",", ":"))
		fh.write(";\n")
	comps = json.load(open(comp_path, encoding="utf-8"))
	table = {str(c["code"]): c["name"] for c in comps}
	with open(out_dir + "/companies.js", "w", encoding="utf-8") as fh:
		fh.write("// Bluetooth SIG company identifiers, from Nordic Semiconductor bluetooth-numbers-database (BSD-3-Clause).\n")
		fh.write("window.ARGUS_COMPANIES = ")
		json.dump(table, fh, ensure_ascii=False, separators=(",", ":"))
		fh.write(";\n")
	print("fleets", len(fleets), "rules", sum(len(f["rules"]) for f in fleets), "companies", len(table))


if __name__ == "__main__":
	main()
