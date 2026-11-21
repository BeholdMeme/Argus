# Argus

A receive-only Bluetooth LE watcher for iPhone. It listens, identifies what it hears, maps it, and warns you about trackers, drones, hacking tools and GPS tampering. Named after Argus Panoptes, the hundred-eyed giant nothing could hide from.

Built for use in Russia: English and Russian interface, OpenStreetMap maps (no Google or Yandex needed), offline map saving, and known-camera lists from OpenStreetMap.

Argus is a Bluetooth-only iPhone port of the ideas and signature library in [Fieldwatch](https://github.com/OffGridPete/Fieldwatch) by Off Grid Pete LLC (MIT).

## How it is built

No iPhone browser can scan for all nearby Bluetooth devices (Safari has no Web Bluetooth; Bluefy and WebBLE only connect to one picked device). So Argus is a small native app (`ios/`) that scans with CoreBluetooth and runs the Argus web app inside it. GitHub Actions builds an unsigned `Argus.ipa` on every change and publishes it to the [app release](https://github.com/BeholdMeme/Argus/releases/tag/app). You install it with SideStore using a normal (free) Apple ID.

## Install on iPhone (Windows PC, one time)

1. **iPhone:** install **LocalDevVPN** from the App Store, open it and tap **Connect** (allow the VPN).
2. **PC:** install **iTunes from apple.com** (not the Microsoft Store version) and open it once.
3. **PC:** install **iloader** (`iloader-windows-x64.msi`) from https://github.com/nab138/iloader/releases
4. Plug the iPhone in with a cable, tap **Trust**, and in iloader click **Refresh**, then sign in with your Apple ID (approve the code on the phone).
5. Click your iPhone's name, then **SideStore (Stable)**. Wait for "SideStore Installed!".
6. **iPhone Settings:** General → VPN & Device Management → trust your Apple ID; Privacy & Security → **Developer Mode** on → restart → Enable.
7. Open **LocalDevVPN** (Connect), then **SideStore** → Settings → sign in with the same Apple ID.
8. On the iPhone, open Safari: https://github.com/BeholdMeme/Argus/releases/download/app/Argus.ipa → download it.
9. In SideStore: **My Apps → +** → pick `Argus.ipa` from Downloads. Done: Argus is on your home screen.

**Every 7 days:** open LocalDevVPN (Connect), then SideStore → My Apps → **Refresh All**. No computer needed. Avoid iOS updates while travelling, because they can break the pairing and you'd need the PC again.

**Updating Argus:** download the new Argus.ipa again and install it the same way. Your data is kept.

The web version at https://beholdmeme.github.io/Argus/ opens in any browser for **Demo data** and saved reports, but it can't scan.

## What it does

**Live**
- Every Bluetooth LE device nearby, with signal strength, trend (▲ louder / ▼ fading), how long it has been around, and badges (watched, moving with you, tracker away from owner, drone).
- 240 signatures from the Fieldwatch catalog (trackers, drones, Flipper Zero and pentest boards, body cams, police gear, cameras, vehicles, wearables…), plus Russian extras (Yandex devices).
- Views: list, list + signal graph, 15-minute timeline, grouped by class.
- Filters: classes, identified, strong, moving with you, new, watched, tracker-away-from-owner; AND/OR; built-in and saved presets.
- Device detail: decoded advertisement (AirPods model and battery, Find My state, Samsung SmartTag state, Google Find Hub / Fast Pair, Microsoft, Eddystone, iBeacon, HomeKit, BTHome sensors, Remote ID), raw data, MGRS position, rename, Watch, Mine (ignore), make a signature from it, copy an "explain this" prompt for an AI.

**Map**
- Your walked path, and each device pinned where you were when you heard it loudest.
- **Drones broadcasting Remote ID move live on the map**, with their trail, height and speed, and the pilot's position.
- Street, topo and satellite maps. **Save area offline** stores map tiles on the phone.
- **Load cameras here** downloads surveillance, speed and plate-reader cameras mapped in OpenStreetMap for the area, saved for offline use. GeoJSON import is also supported.

**Hunt**
- Radar of everything around you: closer to the center means louder. Dots move in and out live. The angle is not a real direction, because one phone can't measure direction.
- Tap a dot, then Hunt, to lock on: a big signal meter, warmer/colder, Geiger clicks, and a heat trail on the map as you walk (★ marks the strongest spot).

**Alerts** (each can be switched on or off; beep, voice and screen flash)
- Separated tracker staying with you: 30 minutes, no gap over 20 minutes, 3 places 100 m apart (AirTag/Find My, Samsung SmartTag, Google Find Hub, DULT standard).
- Tracker heard at 2 of your places within 7 days.
- Any device moving with you (Fieldwatch's speed-aware gates).
- Device getting closer fast.
- Watched device appears; bookmarked signature appears.
- Drone within 100 m / 250 m / 500 m / 1 km; drone swarm (N new IDs in a time window); any drone signal.
- Hacking tools, police gear, surveillance gear.
- Bluetooth pairing / name spam flood.
- GPS jump or sudden loss (possible spoofing or jamming).

**Reports**
- Sessions are saved on the phone. Debrief summary, AI export prompt, and compare two sessions.
- Export CSV, JSONL, GPX, KML and JSON. Devices marked Mine and positions inside hidden Places are left out.

**Settings**
- English / Русский, dark or red night theme, privacy mode, GPS on/off, slow screen updates, signature library (enable, bookmark ★, create, import Fieldwatch JSON, export), Places, cameras, and data clearing.
- 🔊 button in the top bar mutes everything (alerts, voice, Geiger clicks).
- **Pocket mode**: black screen while scanning continues. Double-tap to wake.

## Limits (be honest with yourself)

- **No Wi-Fi.** iPhone doesn't let any app or web page scan Wi-Fi.
- **The screen must stay on with Argus open.** iPhone pauses scanning when the app is in the background. Use Pocket mode and low brightness, and set Auto-Lock to Never while scanning if the screen keeps locking.
- iPhone may hide some Apple advertisements, so AirTag detection can be weaker than on Android.
- Device IDs are per-browser, and many devices change their address every few minutes.
- Signal strength is loudness, not distance. Map pins are where **you** were, except drones, which broadcast their own GPS.
- Remote ID over Wi-Fi (and French Wi-Fi ID) can't be heard on iPhone.
- iPhone gives web pages no raw GPS data, so the spoofing check only catches impossible jumps and sudden loss.
- Argus does not guarantee that anything will be found. Don't rely on it where safety is at stake.

## Privacy

Everything stays on the phone (browser storage). Nothing is uploaded. The only network requests are the app files, map tiles and, when you ask, OpenStreetMap camera data.

## Files

- `index.html`, `css/`, `js/`: the app (plain JavaScript, no build step)
- `data/signatures.js`: BLE signatures generated from the Fieldwatch catalog by `data/build_data.py`
- `data/companies.js`: Bluetooth SIG company IDs (Nordic Semiconductor bluetooth-numbers-database)
- `data/fastpair.js`: Google Fast Pair model names (via Fieldwatch)
- `vendor/leaflet/`: Leaflet 1.9.4 map library
- `sw.js`: offline cache for the web version
- `js/native.js`: bridge to the native app (Bluetooth scanning, location, keep-awake, share)
- `ios/`: native iPhone shell (Swift, XcodeGen); `.github/workflows/ios.yml` builds the IPA

## License

MIT. See `LICENSE` and `NOTICE` for third-party terms.
