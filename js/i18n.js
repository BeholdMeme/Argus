// Argus — English / Russian text.
"use strict";
(function (A) {
	const en = {
		"u.s": "s", "u.m": "m", "u.h": "h",
		"st.idle": "Idle", "st.scan": "Scanning",
		"btn.start": "Start scan", "btn.stop": "Stop scan", "btn.pocket": "Pocket mode", "btn.close": "Close", "btn.copy": "Copy", "btn.share": "Save / share",
		"btn.done": "Done", "btn.save": "Save", "btn.details": "Details",
		"tab.live": "Live", "tab.map": "Map", "tab.hunt": "Hunt", "tab.alerts": "Alerts", "tab.reports": "Reports", "tab.settings": "Settings",
		"warn.bluefy": "Bluetooth scanning is not available in this browser. Open Argus in the Bluefy app.",
		"mute.on": "Sound off", "mute.off": "Sound on",
		"flt.search": "Search name, type, maker", "flt.btn": "Filters", "flt.all": "All", "flt.matched": "Identified", "flt.watched": "Watched", "flt.moving": "Moving with you",
		"flt.title": "Filters", "flt.presets": "Presets", "flt.classes": "Classes", "flt.conds": "Conditions", "flt.combine": "Combine", "flt.and": "All must match (AND)", "flt.or": "Any can match (OR)",
		"flt.hidemine": "Hide devices marked Mine", "flt.gone": "Keep showing devices that went quiet", "flt.savepreset": "Save as preset", "flt.presetname": "Preset name", "flt.none": "Showing everything",
		"fc.matched": "Identified", "fc.strong": "Strong signal", "fc.moving": "Moving with you", "fc.fresh": "New (last 5 min)", "fc.watched": "Watched", "fc.tracker": "Tracker away from owner",
		"pre.all": "Everything", "pre.trackers": "Trackers", "pre.followed": "Am I followed?", "pre.drones": "Drones", "pre.pentest": "Pentest gear", "pre.police": "Police & cameras", "pre.strongnew": "New & close",
		"view.list": "List", "view.hybrid": "List + signal graph", "view.timeline": "Timeline (15 min)", "view.class": "By class",
		"sort.rssi": "Strongest", "sort.recent": "Last heard", "sort.first": "Newest", "sort.time": "Longest nearby", "sort.name": "Name",
		"list.empty": "Tap Start scan. Keep Argus open and the screen on while scanning.", "list.waiting": "Listening… nothing matches the filter yet.",
		"grp.none": "Not identified",
		"bdg.moving": "with you", "bdg.sep": "away from owner", "bdg.mine": "mine",
		"dev.device": "device", "dev.unknown": "Unknown device", "dev.noid": "No name or ID broadcast", "dev.ago": "heard {t} ago",
		"d.rssi": "Signal", "d.seen": "Seen", "d.packets": "packets", "d.maker": "Maker (Bluetooth ID)", "d.id": "Browser ID", "d.yes": "yes", "d.no": "no",
		"d.tracker": "Tracker state", "d.sep": "SEPARATED from owner", "d.near": "near its owner", "d.places": "Heard at your places", "d.placesn": "places in 7 days",
		"d.best": "Your position at strongest hear", "d.mfg": "Maker data", "d.svc": "Service data", "d.nosig": "No signature matched. Use More… → Make signature to name it.",
		"sh.hunt": "Hunt", "sh.watch": "Watch", "sh.unwatch": "Unwatch", "sh.mine": "Mine", "sh.notmine": "Not mine", "sh.map": "Map", "sh.more": "More…",
		"sh.rename": "Rename", "sh.mksig": "Make signature from this", "sh.copy": "Copy details", "sh.ai": "Copy \"explain this\" prompt for an AI",
		"map.center": "Me", "map.save": "Save area offline", "map.cams": "Load cameras here", "map.where": "Dot = where YOU were when it was loudest, not its exact spot.",
		"map.nopos": "No position yet (needs GPS while it is heard).", "map.nocache": "This browser can't store map tiles.", "map.offline": "You are offline.",
		"map.toobig": "Area too big ({n} tiles, limit {l}). Zoom in.", "map.saving": "Saving map… {d}", "map.saved": "Saved {d} tiles ({f} failed).", "map.cleared": "Saved map tiles cleared.", "map.clear": "Clear saved map tiles",
		"base.osm": "Street", "base.topo": "Topo", "base.sat": "Satellite",
		"cam.camera": "Surveillance camera", "cam.speed": "Speed / traffic camera", "cam.alpr": "Plate reader (ALPR)",
		"cam.zoom": "Zoom in closer first.", "cam.loading": "Loading cameras from OpenStreetMap…", "cam.loaded": "Added {n} cameras ({t} saved).", "cam.fail": "Couldn't reach OpenStreetMap. Try again later.",
		"cam.count": "{n} cameras saved.", "cam.hint": "On the Map, zoom in and tap \"Load cameras here\" to download surveillance and speed cameras mapped in OpenStreetMap for that area. They are saved for offline use. You can also import a GeoJSON list.",
		"cam.import": "Import GeoJSON", "cam.clear": "Clear cameras",
		"radar.nomine": "All except Mine", "radar.count": "{n} devices", "radar.hint": "Center = you. Closer to center = louder signal (usually nearer). The angle is NOT a direction, just a fixed seat. ▲ getting louder, ▼ fading. Tap a dot, then Hunt.",
		"hunt.back": "‹ Back to radar", "hunt.peak": "Peak", "hunt.age": "Last heard", "hunt.reset": "Reset peak", "hunt.sound.on": "Clicks: on", "hunt.sound.off": "Clicks: off",
		"hunt.hint": "Walk slowly and turn in a circle. Your body blocks signal, so the number jumps when you face the device. Warmer dots = stronger. ★ = strongest spot.",
		"hunt.warmer": "warmer", "hunt.colder": "colder", "hunt.steady": "steady", "hunt.lost": "not hearing it",
		"hunt.w1": "Right here (within a meter or two)", "hunt.w2": "Very close", "hunt.w3": "Close — same room / few meters", "hunt.w4": "Nearby", "hunt.w5": "Far or blocked",
		"alerts.clear": "Clear", "alerts.empty": "No alerts yet.",
		"rep.current": "This session", "rep.debrief": "Debrief", "rep.ai": "AI export", "rep.export": "Export", "rep.save": "Save now", "rep.rename": "Rename", "rep.new": "New session",
		"rep.saved.h": "Saved sessions", "rep.cmphint": "Tick one to compare with this session, or two to compare them with each other.", "rep.compare": "Compare ticked",
		"rep.open": "Open", "rep.none": "No saved sessions yet.", "rep.saved": "Saved.", "rep.delete": "Delete", "rep.delq": "Delete this session?", "rep.newq": "Save this session and start a fresh one?",
		"rep.exphint": "Devices marked Mine and positions inside hidden Places are left out.",
		"db.title": "Debrief", "db.path": "Distance walked", "db.devices": "Devices", "db.identified": "identified", "db.classes": "By class", "db.attention": "Worth a look",
		"db.seen": "seen", "db.separated": "away from owner", "db.drone": "Drone", "db.pilot": "pilot at", "db.longest": "Longest nearby",
		"db.note": "Signature matches are patterns, not proof. RSSI is loudness, not distance. Positions are where this phone was.",
		"cmp.title": "Compare sessions", "cmp.both": "In both", "cmp.onlyA": "Only in first", "cmp.onlyB": "Only in second", "cmp.pick": "Tick one or two saved sessions.",
		"cmp.note": "Many radios change their address, so \"only in one\" does not prove a device was absent.",
		"set.lang": "Language", "set.gps": "Location (GPS)", "set.gps.on": "GPS on",
		"set.gps.hint": "Needed for the map, trails, Moving with you, tracker following, drone distance and the GPS-jump check. Turn off when sitting still or low on battery. The list, radar and Hunt meter still work.",
		"set.trackers": "Trackers and following", "set.drones": "Drones (Remote ID)", "set.other": "Other alerts", "set.howalert": "How alerts get your attention",
		"set.drones.hint": "Drones that broadcast Remote ID over Bluetooth show live on the map with their trail and pilot position. Wi-Fi-only Remote ID can't be heard on iPhone.",
		"set.display": "Display", "set.theme": "Theme", "th.dark": "Dark", "th.night": "Night (red)", "set.strong": "\"Strong\" means at least", "set.stale": "Drop from list after",
		"set.privacy": "Privacy mode (hide IDs and coordinates on screen)", "set.cameras": "Show known cameras on the map",
		"set.battery": "Battery", "set.slowui": "Slow screen updates (every 3 s)",
		"set.battery.hint": "The screen is the biggest drain. Use Pocket mode (black screen, scanning keeps going), turn brightness down, and turn GPS off when you are not moving. Set iPhone Auto-Lock to Never while scanning if the screen keeps locking.",
		"set.sigs": "Signature library", "sig.open": "Open library", "set.places": "Places", "set.cams": "Known cameras", "set.data": "Data", "set.check": "Bluetooth check", "set.about": "About",
		"al.tracker": "Separated tag staying with you (30 min, 3 places)", "al.places": "Tracker heard at 2 of your places (7 days)", "al.moving": "Any device moving with you",
		"al.movingmin": "…after following you for", "al.approach": "Device getting closer fast", "al.watch": "Watched device shows up",
		"al.dronenear": "Drone broadcasting within", "al.swarm": "Swarm: many new drones at once", "al.swarmn": "New drone IDs", "al.within": "within", "al.quiet": "Then stay quiet for",
		"al.droneclass": "Any drone or controller signal", "al.bookmark": "Bookmarked signatures (★ in the library)", "al.hack": "Hacking tools (Flipper, pentest boards)",
		"al.police": "Police / body cams / military gear", "al.surv": "Surveillance gear", "al.flood": "Bluetooth pairing / spam flood", "al.gps": "GPS jump or sudden loss (possible jamming / spoofing)",
		"al.beep": "Beep", "al.voice": "Speak it", "al.flash": "Flash the screen", "al.test": "Test alert",
		"pl.hint": "Save places like your home or hotel. Positions inside a hidden place are left out of exports and AI export.", "pl.add": "Add current location",
		"pl.name": "Name", "pl.radius": "Radius (m)", "pl.hide": "Hide this area in exports", "pl.home": "Home", "pl.hidden": "hidden", "pl.none": "No places saved.",
		"data.hint": "Everything stays on this phone. Nothing is uploaded.", "ignore.clear": "Clear Mine list", "watch.clear": "Clear Watch list", "pm.clear": "Clear tracker place memory",
		"ignore.count": "{n} devices marked Mine (ignored by alerts).", "ignore.q": "Clear the Mine list?", "watch.count": "{n} devices on the Watch list.",
		"demo.btn": "Demo data (see how it looks)", "demo.on": "Demo data running (fake devices + a fake drone).",
		"about.text": "Argus is a receive-only Bluetooth LE watcher. It only listens. It cannot see Wi-Fi on iPhone, and it does not guarantee that every tracker or device will be found. Do not rely on it where safety is at stake. Signature library from Fieldwatch by Off Grid Pete LLC (MIT).",
		"pocket.hint": "Double-tap to wake",
		"sig.title": "Signature library", "sig.new": "New signature", "sig.edit": "Edit signature", "sig.import": "Import file", "sig.export": "Export mine", "sig.custom": "custom",
		"sig.count": "{n} active signatures · {c} custom · {b} bookmarked for alerts", "sig.imported": "Imported {n} signatures.", "sig.badfile": "That file couldn't be read.",
		"sig.name": "Name", "sig.class": "Class", "sig.notes": "Notes", "sig.any": "Match if ANY rule hits (off = ALL rules)", "sig.rule": "Rule",
		"sig.text": "text / UUID", "sig.cid": "company ID", "sig.prefix": "hex prefix", "sig.need": "Give it a name and at least one rule.", "sig.saved": "Signature saved.",
		"sig.help": "Name rules use * as a wildcard and ignore case. Service UUID: 4 hex digits like FD5A. Company ID is decimal (Apple 76). Hex prefix is the start of the maker or service data.",
		"err.title": "Can't scan", "err.none": "This browser has no Web Bluetooth. Safari can't do it.", "err.noscan": "This browser has Web Bluetooth but not scanning (requestLEScan).",
		"err.off": "Bluetooth is off or not allowed.", "err.fail": "Scan failed:",
		"err.help": "Open Argus inside the Bluefy browser, allow Bluetooth when asked, and make sure Bluetooth is on in iPhone Settings.",
		"chk.scanning": "Scanning", "chk.bluefy": "Open this page in Bluefy to scan.",
		"gps.none": "This browser has no location.", "gps.wait": "Waiting for GPS…", "gps.denied": "Location was blocked. Allow it for Bluefy in iPhone Settings.",
		"wake.yes": "screen kept on", "wake.no": "not supported — set Auto-Lock to Never", "wake.released": "released",
		"toast.copied": "Copied.", "toast.copyfail": "Couldn't copy.", "toast.done": "Done.",
		"rid.height": "Height", "rid.pilot": "Pilot / controller",
		"a.watch.t": "Watched device: {n}", "a.watch.b": "Heard again at {r} dBm.", "a.watch.say": "Watched device. {n}",
		"a.bm.t": "Bookmarked: {s}",
		"a.trk.t": "Tracker may be following you", "a.trk.b": "{n} — away from its owner, heard for {m} min at {p} places.", "a.trk.say": "Warning. A tracker may be following you.",
		"a.pl.t": "Tracker seen at your places", "a.pl.b": "{n} was heard at {p} of your places in the last 7 days.", "a.pl.say": "A tracker was heard at more than one of your places.",
		"a.mov.t": "Moving with you: {n}", "a.mov.b": "Staying with you over {m}, now {r} dBm.", "a.mov.say": "A device is moving with you.",
		"a.ap.t": "Getting closer: {n}", "a.ap.b": "Signal jumped to {r} dBm.", "a.ap.say": "A device is getting closer.",
		"a.fl.pair": "Pairing flood", "a.fl.name": "Bluetooth name flood", "a.fl.b": "{c} new addresses in 10 s · {f} · about {r} dBm. A handheld spam tool can do this.",
		"a.dn.t": "Drone within {d}", "a.dn.b": "{n} is {m} away, height {a}.", "a.dn.say": "Drone nearby, {m} meters.",
		"a.sw.t": "Drone swarm", "a.sw.b": "{c} new drone IDs in {s} seconds.",
		"a.gps.t": "GPS jumped — possible spoofing", "a.gps.b": "Your position jumped {m} in {s} s. That is faster than any aircraft.",
		"a.gpsd.t": "GPS signal lost — possible jamming", "a.gpsd.b": "Accuracy suddenly dropped to ±{a} m.",
		"a.test.t": "Test alert", "a.test.b": "This is what an alert looks and sounds like.",
	};
	const KIND_EN = {
		FINDER: "Tracker / finder", DRONE: "Drone", HACKING: "Hacking tool", LAW_ENFORCEMENT: "Police", SURVEILLANCE: "Surveillance", MILITARY: "Military", CAMERA: "Camera",
		GLASSES: "Smart glasses", TWO_WAY: "Two-way radio", VEHICLE: "Vehicle", WEARABLE: "Wearable", HEALTH: "Health", AUDIO: "Audio", PHONE: "Phone / computer", LOCK: "Lock",
		BEACON: "Beacon", MESH: "Mesh network", HOME: "Home / smart device", THERMOSTAT: "Thermostat", SIGNAGE: "Sign / display", ISP: "Router / ISP", OTHER: "Other",
	};
	const KIND_RU = {
		FINDER: "Трекер / метка", DRONE: "Дрон", HACKING: "Хакерский инструмент", LAW_ENFORCEMENT: "Полиция", SURVEILLANCE: "Слежка", MILITARY: "Военное", CAMERA: "Камера",
		GLASSES: "Умные очки", TWO_WAY: "Рация", VEHICLE: "Автомобиль", WEARABLE: "Носимое", HEALTH: "Здоровье", AUDIO: "Аудио", PHONE: "Телефон / компьютер", LOCK: "Замок",
		BEACON: "Маяк", MESH: "Mesh-сеть", HOME: "Умный дом", THERMOSTAT: "Термостат", SIGNAGE: "Табло / экран", ISP: "Роутер / провайдер", OTHER: "Другое",
	};
	for (const k in KIND_EN) en["kind." + k] = KIND_EN[k];

	const ru = {
		"u.s": "с", "u.m": "м", "u.h": "ч",
		"st.idle": "Стоп", "st.scan": "Скан",
		"btn.start": "Начать скан", "btn.stop": "Остановить", "btn.pocket": "Карманный режим", "btn.close": "Закрыть", "btn.copy": "Копировать", "btn.share": "Сохранить / поделиться",
		"btn.done": "Готово", "btn.save": "Сохранить", "btn.details": "Подробно",
		"tab.live": "Эфир", "tab.map": "Карта", "tab.hunt": "Поиск", "tab.alerts": "Тревоги", "tab.reports": "Отчёты", "tab.settings": "Настройки",
		"warn.bluefy": "В этом браузере нет сканирования Bluetooth. Откройте Argus в приложении Bluefy.",
		"mute.on": "Звук выключен", "mute.off": "Звук включён",
		"flt.search": "Поиск: имя, тип, производитель", "flt.btn": "Фильтры", "flt.all": "Все", "flt.matched": "Опознанные", "flt.watched": "Под наблюдением", "flt.moving": "Движется с вами",
		"flt.title": "Фильтры", "flt.presets": "Шаблоны", "flt.classes": "Классы", "flt.conds": "Условия", "flt.combine": "Сочетание", "flt.and": "Все условия (И)", "flt.or": "Любое условие (ИЛИ)",
		"flt.hidemine": "Скрыть устройства «Моё»", "flt.gone": "Показывать затихшие устройства", "flt.savepreset": "Сохранить шаблон", "flt.presetname": "Название шаблона", "flt.none": "Показано всё",
		"fc.matched": "Опознано", "fc.strong": "Сильный сигнал", "fc.moving": "Движется с вами", "fc.fresh": "Новое (5 мин)", "fc.watched": "Под наблюдением", "fc.tracker": "Метка без владельца",
		"pre.all": "Всё", "pre.trackers": "Трекеры", "pre.followed": "За мной следят?", "pre.drones": "Дроны", "pre.pentest": "Хакерское", "pre.police": "Полиция и камеры", "pre.strongnew": "Новое и близко",
		"view.list": "Список", "view.hybrid": "Список + график сигнала", "view.timeline": "Хронология (15 мин)", "view.class": "По классам",
		"sort.rssi": "Сильнее", "sort.recent": "Недавние", "sort.first": "Новые", "sort.time": "Дольше рядом", "sort.name": "Имя",
		"list.empty": "Нажмите «Начать скан». Держите Argus открытым и экран включённым.", "list.waiting": "Слушаю… пока ничего не подходит под фильтр.",
		"grp.none": "Не опознано",
		"bdg.moving": "с вами", "bdg.sep": "без владельца", "bdg.mine": "моё",
		"dev.device": "устройство", "dev.unknown": "Неизвестное устройство", "dev.noid": "Нет имени и ID", "dev.ago": "слышно {t} назад",
		"d.rssi": "Сигнал", "d.seen": "Видно", "d.packets": "пакетов", "d.maker": "Производитель (Bluetooth ID)", "d.id": "ID в браузере", "d.yes": "да", "d.no": "нет",
		"d.tracker": "Состояние метки", "d.sep": "ОТДЕЛЕНА от владельца", "d.near": "рядом с владельцем", "d.places": "Слышно в ваших местах", "d.placesn": "мест за 7 дней",
		"d.best": "Ваше место при сильнейшем сигнале", "d.mfg": "Данные производителя", "d.svc": "Данные службы", "d.nosig": "Сигнатура не найдена. Ещё… → Создать сигнатуру.",
		"sh.hunt": "Искать", "sh.watch": "Следить", "sh.unwatch": "Не следить", "sh.mine": "Моё", "sh.notmine": "Не моё", "sh.map": "Карта", "sh.more": "Ещё…",
		"sh.rename": "Переименовать", "sh.mksig": "Создать сигнатуру", "sh.copy": "Копировать данные", "sh.ai": "Копировать запрос «объясни» для ИИ",
		"map.center": "Я", "map.save": "Сохранить карту", "map.cams": "Загрузить камеры", "map.where": "Точка = где были ВЫ при самом сильном сигнале, не точное место устройства.",
		"map.nopos": "Пока нет позиции (нужен GPS во время приёма).", "map.nocache": "Браузер не может хранить карту.", "map.offline": "Нет интернета.",
		"map.toobig": "Слишком большая область ({n} плиток, лимит {l}). Приблизьте.", "map.saving": "Сохраняю карту… {d}", "map.saved": "Сохранено {d} плиток ({f} ошибок).", "map.cleared": "Сохранённая карта удалена.", "map.clear": "Удалить сохранённую карту",
		"base.osm": "Улицы", "base.topo": "Рельеф", "base.sat": "Спутник",
		"cam.camera": "Камера наблюдения", "cam.speed": "Камера скорости", "cam.alpr": "Распознавание номеров",
		"cam.zoom": "Сначала приблизьте карту.", "cam.loading": "Загружаю камеры из OpenStreetMap…", "cam.loaded": "Добавлено камер: {n} (всего {t}).", "cam.fail": "OpenStreetMap недоступен. Попробуйте позже.",
		"cam.count": "Сохранено камер: {n}.", "cam.hint": "На карте приблизьте район и нажмите «Загрузить камеры» — камеры наблюдения и скорости из OpenStreetMap сохранятся для офлайна. Можно импортировать GeoJSON.",
		"cam.import": "Импорт GeoJSON", "cam.clear": "Удалить камеры",
		"radar.nomine": "Все, кроме «Моё»", "radar.count": "{n} устр.", "radar.hint": "Центр — вы. Ближе к центру — громче сигнал (обычно ближе). Угол — НЕ направление, просто постоянное место. ▲ громче, ▼ тише. Нажмите на точку, затем «Искать».",
		"hunt.back": "‹ Назад к радару", "hunt.peak": "Пик", "hunt.age": "Слышно", "hunt.reset": "Сбросить пик", "hunt.sound.on": "Щелчки: вкл", "hunt.sound.off": "Щелчки: выкл",
		"hunt.hint": "Идите медленно и поворачивайтесь. Тело глушит сигнал, поэтому число прыгает, когда вы лицом к устройству. Тёплые точки — сильнее. ★ — самое сильное место.",
		"hunt.warmer": "теплее", "hunt.colder": "холоднее", "hunt.steady": "ровно", "hunt.lost": "не слышно",
		"hunt.w1": "Прямо здесь (1–2 м)", "hunt.w2": "Очень близко", "hunt.w3": "Близко — та же комната", "hunt.w4": "Рядом", "hunt.w5": "Далеко или за преградой",
		"alerts.clear": "Очистить", "alerts.empty": "Тревог пока нет.",
		"rep.current": "Этот сеанс", "rep.debrief": "Сводка", "rep.ai": "Экспорт для ИИ", "rep.export": "Экспорт", "rep.save": "Сохранить", "rep.rename": "Переименовать", "rep.new": "Новый сеанс",
		"rep.saved.h": "Сохранённые сеансы", "rep.cmphint": "Отметьте один — сравнить с текущим, или два — сравнить их между собой.", "rep.compare": "Сравнить отмеченные",
		"rep.open": "Открыть", "rep.none": "Сохранённых сеансов нет.", "rep.saved": "Сохранено.", "rep.delete": "Удалить", "rep.delq": "Удалить этот сеанс?", "rep.newq": "Сохранить сеанс и начать новый?",
		"rep.exphint": "Устройства «Моё» и точки внутри скрытых мест не попадают в экспорт.",
		"db.title": "Сводка", "db.path": "Пройдено", "db.devices": "Устройства", "db.identified": "опознано", "db.classes": "По классам", "db.attention": "Стоит взглянуть",
		"db.seen": "видно", "db.separated": "без владельца", "db.drone": "Дрон", "db.pilot": "пилот в", "db.longest": "Дольше всего рядом",
		"db.note": "Совпадение сигнатуры — догадка, не доказательство. RSSI — громкость, не расстояние. Координаты — где был этот телефон.",
		"cmp.title": "Сравнение сеансов", "cmp.both": "В обоих", "cmp.onlyA": "Только в первом", "cmp.onlyB": "Только во втором", "cmp.pick": "Отметьте один или два сеанса.",
		"cmp.note": "Многие устройства меняют адрес, поэтому «только в одном» не доказывает отсутствие.",
		"set.lang": "Язык", "set.gps": "Местоположение (GPS)", "set.gps.on": "GPS включён",
		"set.gps.hint": "Нужен для карты, следов, «Движется с вами», трекеров, расстояния до дронов и проверки скачков GPS. Выключайте, когда стоите на месте или мало заряда. Список, радар и поиск работают без GPS.",
		"set.trackers": "Трекеры и слежка", "set.drones": "Дроны (Remote ID)", "set.other": "Другие тревоги", "set.howalert": "Как подавать тревогу",
		"set.drones.hint": "Дроны с Remote ID по Bluetooth видны на карте вживую — с маршрутом и позицией пилота. Remote ID только по Wi-Fi iPhone не слышит.",
		"set.display": "Экран", "set.theme": "Тема", "th.dark": "Тёмная", "th.night": "Ночная (красная)", "set.strong": "«Сильный» — не слабее", "set.stale": "Убирать из списка через",
		"set.privacy": "Режим приватности (скрыть ID и координаты)", "set.cameras": "Показывать камеры на карте",
		"set.battery": "Батарея", "set.slowui": "Медленное обновление экрана (3 с)",
		"set.battery.hint": "Больше всего тратит экран. Используйте карманный режим (чёрный экран, скан продолжается), уменьшите яркость, выключайте GPS, когда стоите. Если экран гаснет — поставьте Автоблокировку «Никогда».",
		"set.sigs": "Библиотека сигнатур", "sig.open": "Открыть библиотеку", "set.places": "Места", "set.cams": "Известные камеры", "set.data": "Данные", "set.check": "Проверка Bluetooth", "set.about": "О программе",
		"al.tracker": "Метка без владельца держится рядом (30 мин, 3 места)", "al.places": "Метка слышна в 2 ваших местах (7 дней)", "al.moving": "Любое устройство движется с вами",
		"al.movingmin": "…после того как сопровождает", "al.approach": "Устройство быстро приближается", "al.watch": "Появилось наблюдаемое устройство",
		"al.dronenear": "Дрон ближе чем", "al.swarm": "Рой: много новых дронов сразу", "al.swarmn": "Новых ID дронов", "al.within": "за", "al.quiet": "Потом молчать",
		"al.droneclass": "Любой сигнал дрона или пульта", "al.bookmark": "Отмеченные сигнатуры (★ в библиотеке)", "al.hack": "Хакерские устройства (Flipper и др.)",
		"al.police": "Полиция / нагрудные камеры / военное", "al.surv": "Оборудование слежки", "al.flood": "Флуд запросов сопряжения Bluetooth", "al.gps": "Скачок или потеря GPS (возможно глушение / подмена)",
		"al.beep": "Сигнал", "al.voice": "Голос", "al.flash": "Вспышка экрана", "al.test": "Проверить тревогу",
		"pl.hint": "Сохраните места — дом, гостиницу. Точки внутри скрытых мест не попадают в экспорт.", "pl.add": "Добавить текущее место",
		"pl.name": "Название", "pl.radius": "Радиус (м)", "pl.hide": "Скрывать в экспорте", "pl.home": "Дом", "pl.hidden": "скрыто", "pl.none": "Мест нет.",
		"data.hint": "Всё хранится только на этом телефоне. Ничего не отправляется.", "ignore.clear": "Очистить «Моё»", "watch.clear": "Очистить наблюдение", "pm.clear": "Очистить память мест трекеров",
		"ignore.count": "Устройств «Моё»: {n} (тревоги их игнорируют).", "ignore.q": "Очистить список «Моё»?", "watch.count": "Под наблюдением: {n}.",
		"demo.btn": "Демо-данные (посмотреть как выглядит)", "demo.on": "Демо запущено (ненастоящие устройства и дрон).",
		"about.text": "Argus — пассивный приёмник Bluetooth LE. Он только слушает. На iPhone он не видит Wi-Fi и не гарантирует обнаружение каждой метки. Не полагайтесь на него, когда на кону безопасность. Библиотека сигнатур — Fieldwatch, Off Grid Pete LLC (MIT).",
		"pocket.hint": "Двойное касание — выйти",
		"sig.title": "Библиотека сигнатур", "sig.new": "Новая сигнатура", "sig.edit": "Изменить сигнатуру", "sig.import": "Импорт файла", "sig.export": "Экспорт моих", "sig.custom": "своя",
		"sig.count": "Активных сигнатур: {n} · своих: {c} · с тревогой: {b}", "sig.imported": "Импортировано: {n}.", "sig.badfile": "Не удалось прочитать файл.",
		"sig.name": "Название", "sig.class": "Класс", "sig.notes": "Заметки", "sig.any": "Совпадение по ЛЮБОМУ правилу (выкл = ВСЕ)", "sig.rule": "Правило",
		"sig.text": "текст / UUID", "sig.cid": "ID компании", "sig.prefix": "hex-префикс", "sig.need": "Укажите название и хотя бы одно правило.", "sig.saved": "Сигнатура сохранена.",
		"sig.help": "В именах * — любой текст, регистр не важен. UUID службы — 4 hex-цифры, например FD5A. ID компании — десятичный (Apple 76). Hex-префикс — начало данных.",
		"err.title": "Скан невозможен", "err.none": "В этом браузере нет Web Bluetooth. Safari так не умеет.", "err.noscan": "Web Bluetooth есть, но без сканирования (requestLEScan).",
		"err.off": "Bluetooth выключен или запрещён.", "err.fail": "Ошибка скана:",
		"err.help": "Откройте Argus в браузере Bluefy, разрешите Bluetooth и проверьте, что Bluetooth включён в настройках iPhone.",
		"chk.scanning": "Скан", "chk.bluefy": "Откройте эту страницу в Bluefy.",
		"gps.none": "Нет доступа к местоположению.", "gps.wait": "Жду GPS…", "gps.denied": "Геолокация запрещена. Разрешите её для Bluefy в настройках iPhone.",
		"wake.yes": "экран не гаснет", "wake.no": "не поддерживается — поставьте Автоблокировку «Никогда»", "wake.released": "отключено",
		"toast.copied": "Скопировано.", "toast.copyfail": "Не удалось скопировать.", "toast.done": "Готово.",
		"rid.height": "Высота", "rid.pilot": "Пилот / пульт",
		"a.watch.t": "Наблюдаемое: {n}", "a.watch.b": "Снова слышно, {r} дБм.", "a.watch.say": "Наблюдаемое устройство. {n}",
		"a.bm.t": "Отмечено: {s}",
		"a.trk.t": "Возможно, за вами метка", "a.trk.b": "{n} — без владельца, слышна {m} мин в {p} местах.", "a.trk.say": "Внимание. Возможно, за вами следует метка.",
		"a.pl.t": "Метка в ваших местах", "a.pl.b": "{n} слышна в {p} ваших местах за 7 дней.", "a.pl.say": "Метка замечена в нескольких ваших местах.",
		"a.mov.t": "Движется с вами: {n}", "a.mov.b": "Сопровождает вас {m}, сейчас {r} дБм.", "a.mov.say": "Устройство движется вместе с вами.",
		"a.ap.t": "Приближается: {n}", "a.ap.b": "Сигнал вырос до {r} дБм.", "a.ap.say": "Устройство приближается.",
		"a.fl.pair": "Флуд сопряжения", "a.fl.name": "Флуд имён Bluetooth", "a.fl.b": "{c} новых адресов за 10 с · {f} · около {r} дБм. Так может делать спам-устройство.",
		"a.dn.t": "Дрон ближе {d}", "a.dn.b": "{n} в {m}, высота {a}.", "a.dn.say": "Дрон рядом, {m} метров.",
		"a.sw.t": "Рой дронов", "a.sw.b": "{c} новых дронов за {s} секунд.",
		"a.gps.t": "Скачок GPS — возможна подмена", "a.gps.b": "Позиция прыгнула на {m} за {s} с — быстрее любого самолёта.",
		"a.gpsd.t": "Потеря GPS — возможно глушение", "a.gpsd.b": "Точность резко упала до ±{a} м.",
		"a.test.t": "Проверка тревоги", "a.test.b": "Так выглядит и звучит тревога.",
	};
	for (const k in KIND_RU) ru["kind." + k] = KIND_RU[k];

	A.L = { en: en, ru: ru };
	A.lang = "en";

	A.t = (key, vars) => {
		let s = (A.L[A.lang] && A.L[A.lang][key]) || en[key] || key;
		if (vars) for (const k in vars) s = s.split("{" + k + "}").join(String(vars[k]));
		return s;
	};

	A.applyI18n = () => {
		document.documentElement.lang = A.lang;
		A.$$("[data-i18n]").forEach((el) => {
			el.textContent = A.t(el.getAttribute("data-i18n"));
		});
		A.$$("[data-i18n-ph]").forEach((el) => {
			el.placeholder = A.t(el.getAttribute("data-i18n-ph"));
		});
	};

	A.initLang = () => {
		const saved = A.Store.get("lang", null);
		A.lang = saved || (((navigator.language || "").toLowerCase().startsWith("ru")) ? "ru" : "en");
		A.applyI18n();
	};

	A.setLang = (l) => {
		A.lang = l;
		A.Store.set("lang", l);
		A.applyI18n();
		A.emit("scan", A.Scan.running);
		A.UI.renderLive(true);
	};
})(window.Argus);
