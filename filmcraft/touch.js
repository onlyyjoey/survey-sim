// FilmCraft touch controls: CapCut / KineMaster-style phone and tablet controls on top of the
// FilmCraft editor. Original code for this copy (MIT OR Apache-2.0, like FilmCraft).
//
// Two parts:
//  1. A gesture layer. Finger input on the editor canvas is turned into precise mouse input
//     for the editor: tap = click, drag = drag, long-press = right-click (context menu),
//     pinch = zoom (timeline / monitors), two-finger drag = scroll, two-finger tap = undo,
//     three-finger tap = redo.
//  2. A docked toolbar with big buttons (split, delete, speed, volume, text, import, export…),
//     a jog strip for frame-accurate scrubbing, and a play rail in landscape. Buttons drive the
//     editor through its built-in `window.filmcraft` command API.
(() => {
  "use strict";

  const canvas = document.getElementById("filmcraft_canvas");
  if (!canvas) return;

  const qs = new URLSearchParams(location.search);
  const coarse = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  const store = {
    get(k, d) { try { const v = localStorage.getItem("fct." + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("fct." + k, JSON.stringify(v)); } catch { /* private mode */ } },
  };

  // ------------------------------------------------------------------ editor API helpers
  const api = () => window.filmcraft;
  const ready = () => !!(api() && window.filmcraftLoad && window.filmcraftLoad.readyMs);
  async function call(fn) {
    if (!ready()) { toast("FilmCraft is still loading…"); throw new Error("not ready"); }
    return fn(api());
  }
  const menu = (command, params) => call((f) => f.request("ui.menu.invoke", params ? { command, params } : { command }));
  const exec = (command, params) => call((f) => f.execute(command, params || {}));
  const req = (method, params) => call((f) => f.request(method, params || {}));
  const key = (k) => req("ui.key", { key: k });

  async function run(label, fn) {
    try {
      const r = await fn();
      if (label) toast(label);
      return r;
    } catch (e) {
      const msg = String((e && e.message) || e);
      if (msg !== "not ready") toast(friendly(msg), true);
      return undefined;
    }
  }
  function friendly(msg) {
    if (/no (clips? )?selected|selection|nothing selected/i.test(msg)) return "Tap a clip in the timeline first";
    if (/no ?sequence|NoSequence/i.test(msg)) return "Open or create a sequence first (tap Media)";
    return msg.length > 140 ? msg.slice(0, 140) + "…" : msg;
  }

  // ------------------------------------------------------------------ icons (original line art)
  const P = {
    play: '<path d="M8 5.5v13l10.5-6.5z"/>',
    pause: '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>',
    split: '<path d="M12 3v18"/><path d="M5 8l-2 4 2 4M19 8l2 4-2 4"/><path d="M8 7h-1.5M8 17H6.5M16 7h1.5M16 17h1.5"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/><path d="M10.5 11v5.5M13.5 11v5.5"/>',
    ripple: '<path d="M4.5 7h9M8 7V4.5h3V7M6 7l.8 9h5.4l.8-9"/><path d="M16 12h5M18.5 9.5 21 12l-2.5 2.5"/><path d="M4 20h16"/>',
    speed: '<path d="M4 16a8 8 0 1 1 16 0"/><path d="M12 16l4.5-5"/><circle cx="12" cy="16" r="1.2"/>',
    volume: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    freeze: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5"/>',
    dup: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
    text: '<path d="M5 6.5V5h14v1.5M12 5v14M9.5 19h5"/>',
    media: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M12 9v6M9 12h6"/>',
    music: '<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',
    trans: '<rect x="3" y="6" width="8" height="12" rx="1.5"/><rect x="13" y="6" width="8" height="12" rx="1.5"/><path d="M11 12h2"/><path d="M9 9.5 11 12l-2 2.5M15 9.5 13 12l2 2.5"/>',
    tools: '<path d="M5 3.5 10.5 9M3.5 5 9 10.5"/><path d="M14.5 14 20 19.5 19.5 20 14 14.5z"/><path d="M14 5.5l4.5 4.5-9 9H5v-4.5z"/>',
    panels: '<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M3.5 13h17M11 4v9"/>',
    undo: '<path d="M8 8H14a5 5 0 0 1 0 10H8"/><path d="M10.5 5 7.5 8l3 3"/>',
    redo: '<path d="M16 8H10a5 5 0 0 0 0 10h6"/><path d="M13.5 5l3 3-3 3"/>',
    export: '<path d="M12 15V4M8 7.5 12 3.5l4 4"/><path d="M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12"/>',
    more: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
    help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.8 9.6a2.3 2.3 0 1 1 3.3 2.1c-.7.4-1.1.9-1.1 1.7v.4"/><path d="M12 16.8v.2"/>',
    hand: '<path d="M8 12V6.5a1.5 1.5 0 0 1 3 0V11M11 10.5V5a1.5 1.5 0 0 1 3 0v6M14 10.5V6.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-.5a5.5 5.5 0 0 1-4.6-2.5L3.6 14a1.5 1.5 0 0 1 2.3-1.9L8 14"/>',
    hide: '<path d="M6 9l6 6 6-6"/>',
    frameL: '<path d="M14.5 6.5 9 12l5.5 5.5"/>',
    frameR: '<path d="M9.5 6.5 15 12l-5.5 5.5"/>',
    editL: '<path d="M6 6v12M17.5 6.5 11 12l6.5 5.5"/>',
    editR: '<path d="M18 6v12M6.5 6.5 13 12l-6.5 5.5"/>',
    start: '<path d="M5.5 5v14M18.5 6 10 12l8.5 6z"/>',
    zoomfit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    marker: '<path d="M7 3.5h10v11l-5 5-5-5z"/>',
    inpt: '<path d="M9 4H6v16h3"/><path d="M12 12h7M15.5 8.5 19 12l-3.5 3.5"/>',
    outpt: '<path d="M15 4h3v16h-3"/><path d="M5 12h7M8.5 8.5 12 12l-3.5 3.5"/>',
    copy: '<rect x="8" y="8" width="11" height="12" rx="1.5"/><path d="M5 16V5.5A1.5 1.5 0 0 1 6.5 4H15"/>',
    paste: '<rect x="5" y="5" width="14" height="15.5" rx="1.5"/><path d="M9 5V3.5h6V5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    nest: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><rect x="7.5" y="8.5" width="9" height="7" rx="1"/>',
    save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  };
  const ico = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${P[n] || ""}</svg>`;
  const el = (tag, attrs, html) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
    }
    if (html != null) e.innerHTML = html;
    return e;
  };

  // ------------------------------------------------------------------ feedback
  let toastTimer = 0;
  const toastEl = el("div", { id: "fct-toast", class: "fct", role: "status", "aria-live": "polite" });
  function toast(msg, isErr) {
    toastEl.textContent = msg;
    toastEl.classList.toggle("err", !!isErr);
    toastEl.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("on"), isErr ? 2600 : 1400);
  }
  function ring(x, y) {
    const r = el("div", { class: "fct-ring" });
    r.style.left = x + "px"; r.style.top = y + "px";
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 500);
  }
  const buzz = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch { /* not supported */ } };

  // ------------------------------------------------------------------ playback state
  let playing = false;
  const playBtns = [];
  function setPlaying(p) {
    playing = !!p;
    for (const b of playBtns) { b.innerHTML = ico(playing ? "pause" : "play"); b.setAttribute("aria-label", playing ? "Pause" : "Play"); }
  }
  async function togglePlay() {
    const r = await run(null, () => req("ui.playback", { action: "toggle" }));
    if (r && typeof r.playing === "boolean") setPlaying(r.playing);
  }

  // ------------------------------------------------------------------ import (CapCut style: picked media lands on the timeline)
  const picker = el("input", { type: "file", multiple: "", hidden: "" });
  let pickMode = "media";
  picker.addEventListener("change", async () => {
    const files = Array.from(picker.files || []);
    picker.value = "";
    if (!files.length) return;
    toast(files.length === 1 ? "Importing " + files[0].name + "…" : "Importing " + files.length + " files…");
    const res = await run(null, () => call((f) => f.importFiles(files)));
    if (!res) return;
    const ids = (res.items || []).map((x) => (x && typeof x === "object" ? (x.item ?? x.id) : x)).filter((x) => Number.isFinite(x));
    if (!ids.length) { toast((res.errors && res.errors[0]) || "Nothing could be imported", true); return; }
    let seq = null;
    try { seq = await exec("sequence.inspect"); } catch { seq = null; }
    if (!seq) {
      await run("Added to a new sequence", () => exec("file.newSequence", { name: "My Video", fromItems: ids }));
      return;
    }
    const opts = { items: ids, time: seq.duration || 0 };
    if (pickMode === "audio") opts.track = "A1";
    await run(ids.length === 1 ? "Added to the end of the timeline" : ids.length + " clips added to the timeline", () => exec("timeline.place", opts));
  });
  function pick(mode) {
    pickMode = mode;
    picker.accept = mode === "audio" ? "audio/*,.mp3,.m4a,.wav,.aac,.flac,.ogg" : "video/*,image/*,audio/*,.mov,.mp4,.mkv,.webm";
    picker.click();
  }

  // ------------------------------------------------------------------ sheets
  const scrim = el("div", { id: "fct-scrim", onclick: () => closeSheet() });
  let openSheetEl = null;
  function sheet(title, build) {
    closeSheet();
    const s = el("div", { class: "fct fct-sheet", role: "dialog", "aria-label": title });
    s.appendChild(el("div", { class: "grab" }));
    s.appendChild(el("h3", {}, title));
    build(s);
    document.body.appendChild(s);
    requestAnimationFrame(() => { scrim.classList.add("on"); s.classList.add("on"); });
    openSheetEl = s;
    // swipe down to close
    let y0 = null;
    s.addEventListener("touchstart", (e) => { y0 = s.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
    s.addEventListener("touchmove", (e) => { if (y0 !== null && e.touches[0].clientY - y0 > 70) { y0 = null; closeSheet(); } }, { passive: true });
  }
  function closeSheet() {
    scrim.classList.remove("on");
    const s = openSheetEl;
    openSheetEl = null;
    if (s) { s.classList.remove("on"); setTimeout(() => s.remove(), 250); }
  }
  function grid(parent, heading, items) {
    if (heading) parent.appendChild(el("h4", {}, heading));
    const g = el("div", { class: "fct-grid" });
    for (const it of items) {
      const b = el("button", { type: "button", class: it.on ? "on" : "" }, ico(it.icon) + `<span>${it.label}</span>`);
      b.addEventListener("click", () => { if (!it.keep) closeSheet(); it.run(); });
      g.appendChild(b);
    }
    parent.appendChild(g);
  }

  let currentTool = "selection";
  function setTool(name, label) {
    currentTool = name;
    return run(label, () => req("ui.set", { tool: name }));
  }
  function toolsSheet() {
    const t = (name, label, icon) => ({ label, icon, on: currentTool === name, run: () => setTool(name, label + " tool") });
    sheet("Tools", (s) => {
      grid(s, null, [
        t("selection", "Select", "hand"),
        t("razor", "Blade", "split"),
        t("ripple", "Ripple trim", "ripple"),
        t("rolling", "Roll", "trans"),
        t("ratestretch", "Stretch", "speed"),
        t("slip", "Slip", "frameR"),
        t("slide", "Slide", "editR"),
        t("hand", "Pan", "hand"),
        t("zoom", "Zoom", "zoomfit"),
        t("type", "Text", "text"),
        t("pen", "Pen", "tools"),
        t("rectangle", "Shape", "panels"),
      ]);
    });
  }
  function panelsSheet() {
    const w = (name, label, icon) => ({ label, icon, run: () => run(label + " layout", () => req("ui.set", { workspace: name })) });
    sheet("Layout", (s) => {
      grid(s, null, [
        w("Editing", "Editing", "panels"),
        w("Assembly", "Assembly", "media"),
        w("Vertical", "Vertical", "panels"),
        w("Color", "Color", "freeze"),
        w("Effects", "Effects", "trans"),
        w("Audio", "Audio", "music"),
        w("Captions and Graphics", "Titles", "text"),
        w("All Panels", "All panels", "panels"),
      ]);
      grid(s, "Interface size", [
        { label: "Smaller", icon: "minus", keep: true, run: () => uiSize(-1) },
        { label: "Larger", icon: "plus", keep: true, run: () => uiSize(1) },
        { label: "Auto", icon: "zoomfit", keep: true, run: () => run("Interface size: auto", () => exec("prefs.set", { key: "appearance.uiScale", value: "auto" })) },
      ]);
    });
  }
  // "UI Scale" preference: physical pixels per point, from a fixed list
  const SCALES = [75, 100, 125, 150, 175, 200, 250, 300];
  async function uiSize(dir) {
    const info = await run(null, () => req("ui.inspect"));
    if (!info) return;
    const cur = Math.round((info.pixelsPerPoint || devicePixelRatio || 1) * 100);
    const next = dir > 0 ? SCALES.find((v) => v > cur + 5) : [...SCALES].reverse().find((v) => v < cur - 5);
    if (!next) { toast(dir > 0 ? "Already the largest size" : "Already the smallest size"); return; }
    await run("Interface size " + next + "%", () => exec("prefs.set", { key: "appearance.uiScale", value: String(next) }));
  }
  function moreSheet() {
    sheet("More", (s) => {
      grid(s, "Clip", [
        { label: "Copy", icon: "copy", run: () => run("Copied", () => menu("edit.copy")) },
        { label: "Paste", icon: "paste", run: () => run("Pasted at playhead", () => menu("edit.paste")) },
        { label: "Duplicate", icon: "dup", run: () => run("Duplicated", () => menu("edit.duplicate")) },
        { label: "Freeze frame", icon: "freeze", run: () => run(null, () => menu("clip.frameHold")) },
        { label: "Nest", icon: "nest", run: () => run(null, () => menu("clip.nest")) },
        { label: "Select all", icon: "panels", run: () => run("All selected", () => menu("edit.selectAll")) },
      ]);
      grid(s, "Timeline", [
        { label: "Mark in", icon: "inpt", run: () => run("In point set", () => menu("markers.markIn")) },
        { label: "Mark out", icon: "outpt", run: () => run("Out point set", () => menu("markers.markOut")) },
        { label: "Marker", icon: "marker", run: () => run("Marker added", () => menu("markers.add")) },
        { label: "Fit timeline", icon: "zoomfit", run: () => run(null, () => menu("view.zoomToSequence")) },
        { label: "Go to start", icon: "start", run: () => run(null, () => menu("playhead.start")) },
        { label: "Split all tracks", icon: "split", run: () => run("Split all tracks", () => menu("sequence.addEditAllTracks")) },
      ]);
      grid(s, "Project", [
        { label: "Save", icon: "save", run: () => run(null, () => menu("file.save")) },
        { label: "Open project", icon: "media", run: () => run(null, () => menu("file.open")) },
        { label: "New sequence", icon: "plus", run: () => run(null, () => menu("file.newSequence")) },
        { label: "Gestures", icon: "help", run: () => helpSheet() },
      ]);
    });
  }
  function helpSheet() {
    sheet("Touch controls", (s) => {
      const ul = el("ul", { class: "fct-help" });
      for (const [g, d] of [
        ["Tap", "Click: select a clip, press a button, place the playhead"],
        ["Drag", "Move clips, trim edges, drag the playhead"],
        ["Long-press", "Right-click menu for anything under your finger"],
        ["Pinch", "Zoom the timeline or a monitor"],
        ["Two fingers", "Scroll the timeline and panels"],
        ["2-finger tap", "Undo"],
        ["3-finger tap", "Redo"],
        ["Jog strip", "Slide left/right to step frame by frame"],
        ["Bottom bar", "Swipe sideways for more tools"],
      ]) ul.appendChild(el("li", {}, `<b>${g}</b><span>${d}</span>`));
      s.appendChild(ul);
      s.appendChild(el("p", { style: "margin:14px 2px 0;color:var(--fct-dim);font-size:12px;line-height:1.4" },
        "Tip: turn your phone sideways for the most room. Hide the controls with the pill at the top right."));
      const ok = el("button", { type: "button", class: "fct-primary" }, "Got it");
      ok.addEventListener("click", () => { store.set("helped", true); closeSheet(); });
      s.appendChild(ok);
    });
  }

  // ------------------------------------------------------------------ toolbar
  const TOOLS = [
    { id: "split", label: "Split", icon: "split", hot: true, run: () => run("Split at playhead", () => menu("sequence.addEdit")) },
    { id: "delete", label: "Delete", icon: "trash", danger: true, run: () => run("Deleted", () => menu("edit.clear")) },
    { id: "ripple", label: "Delete gap", icon: "ripple", run: () => run("Deleted and closed the gap", () => menu("edit.rippleDelete")) },
    { id: "speed", label: "Speed", icon: "speed", run: () => run(null, () => menu("clip.speedDuration")) },
    { id: "volume", label: "Volume", icon: "volume", run: () => run(null, () => menu("clip.audioGain")) },
    { id: "trans", label: "Transition", icon: "trans", run: () => run("Transition added", () => menu("sequence.applyVideoTransition")) },
    { id: "text", label: "Text", icon: "text", run: () => setTool("type", "Text: tap the preview where the text goes") },
    "|",
    { id: "media", label: "Media", icon: "media", hot: true, run: () => pick("media") },
    { id: "audio", label: "Audio", icon: "music", run: () => pick("audio") },
    { id: "tools", label: "Tools", icon: "tools", run: toolsSheet },
    { id: "panels", label: "Layout", icon: "panels", run: panelsSheet },
    "|",
    { id: "undo", label: "Undo", icon: "undo", run: () => run("Undo", () => menu("edit.undo")) },
    { id: "redo", label: "Redo", icon: "redo", run: () => run("Redo", () => menu("edit.redo")) },
    { id: "export", label: "Export", icon: "export", hot: true, run: () => run("Export: pick a format, then Export", () => req("ui.set", { mode: "export" })) },
    { id: "more", label: "More", icon: "more", run: moreSheet },
    { id: "help", label: "Gestures", icon: "help", run: helpSheet },
  ];

  const dock = el("div", { id: "fct-dock", class: "fct" });
  const jogRow = el("div", { id: "fct-jogrow" });
  const playS = el("button", { type: "button", id: "fct-play-s", class: "fct-mini", "aria-label": "Play" });
  playS.addEventListener("click", togglePlay);
  playBtns.push(playS);
  const mini = (icon, label, fn) => { const b = el("button", { type: "button", class: "fct-mini", "aria-label": label, title: label }, ico(icon)); b.addEventListener("click", fn); return b; };
  const jog = el("div", { id: "fct-jog", role: "slider", "aria-label": "Jog: slide to step frames" }, '<div class="ticks"></div><div class="needle"></div><div class="lbl">◂ SLIDE TO SCRUB ▸</div>');
  jogRow.append(
    playS,
    mini("editL", "Previous edit", () => run(null, () => menu("playhead.prevEdit"))),
    jog,
    mini("editR", "Next edit", () => run(null, () => menu("playhead.nextEdit"))),
  );
  const bar = el("div", { id: "fct-bar", role: "toolbar", "aria-label": "Editing tools" });
  for (const t of TOOLS) {
    if (t === "|") { bar.appendChild(el("div", { class: "fct-sep" })); continue; }
    const b = el("button", { type: "button", class: "fct-tool" + (t.hot ? " hot" : "") + (t.danger ? " danger" : ""), "data-id": t.id }, ico(t.icon) + `<span>${t.label}</span>`);
    b.addEventListener("click", () => { buzz(5); t.run(); });
    bar.appendChild(b);
  }
  dock.append(jogRow, bar);

  // landscape rail (KineMaster-like): big play button with frame and edit stepping
  const rail = el("div", { id: "fct-rail", class: "fct" });
  const play = el("button", { type: "button", id: "fct-play", "aria-label": "Play" });
  play.addEventListener("click", togglePlay);
  playBtns.push(play);
  const pair = (...b) => { const p = el("div", { class: "pair" }); p.append(...b); return p; };
  const g1 = el("div", { class: "grp" });
  g1.append(
    pair(mini("undo", "Undo", () => run("Undo", () => menu("edit.undo"))), mini("redo", "Redo", () => run("Redo", () => menu("edit.redo")))),
    pair(mini("media", "Add media", () => pick("media")), mini("export", "Export", () => run("Export: pick a format, then Export", () => req("ui.set", { mode: "export" })))),
  );
  const g2 = el("div", { class: "grp" });
  g2.append(play);
  const g3 = el("div", { class: "grp" });
  g3.append(
    pair(mini("frameL", "Back one frame", () => run(null, () => menu("playhead.stepBack"))), mini("frameR", "Forward one frame", () => run(null, () => menu("playhead.stepForward")))),
    pair(mini("editL", "Previous edit", () => run(null, () => menu("playhead.prevEdit"))), mini("editR", "Next edit", () => run(null, () => menu("playhead.nextEdit")))),
  );
  rail.append(g1, g2, g3);
  setPlaying(false);

  const toggle = el("button", { type: "button", id: "fct-toggle", class: "fct" });
  function setOn(on) {
    document.body.classList.toggle("fct-on", on);
    toggle.innerHTML = on ? ico("hide") + "<span>Hide</span>" : ico("hand") + "<span>Touch</span>";
    toggle.setAttribute("aria-label", on ? "Hide touch controls" : "Show touch controls");
    store.set("on", on);
  }
  toggle.addEventListener("click", () => setOn(!document.body.classList.contains("fct-on")));

  document.body.append(dock, rail, toggle, scrim, toastEl, picker);
  const wantOn = qs.has("touch") ? qs.get("touch") !== "0" : store.get("on", coarse);
  setOn(!!wantOn);

  // keyboard: space still works through the editor; keep our play icon roughly in sync
  addEventListener("keydown", (e) => { if (e.code === "Space" && e.target === canvas) setPlaying(!playing); }, true);

  // ------------------------------------------------------------------ jog strip
  {
    let x0 = null, acc = 0, pending = 0, busy = false, lastX = 0, lastT = 0;
    const ticks = jog.querySelector(".ticks");
    const flush = async () => {
      if (busy || !pending) return;
      const n = pending; pending = 0; busy = true;
      try { await exec("playhead.step", { frames: n }); } catch (e) { if (String(e && e.message) !== "not ready") toast(friendly(String(e && e.message || e)), true); }
      busy = false;
      if (pending) flush();
    };
    const down = (x) => { x0 = lastX = x; lastT = performance.now(); acc = 0; jog.classList.add("on"); if (playing) { req("ui.playback", { action: "stop" }).then(() => setPlaying(false)).catch(() => {}); } };
    const move = (x) => {
      if (x0 === null) return;
      const now = performance.now();
      const dx = x - lastX;
      const v = Math.abs(dx) / Math.max(1, now - lastT); // px per ms
      lastX = x; lastT = now;
      // faster swipes move further (KineMaster-style jog acceleration)
      acc += dx * (v > 1.2 ? 4 : v > 0.5 ? 2 : 1);
      ticks.style.transform = `translateX(${((x - x0) % 8)}px)`;
      const step = 9; // px per frame at slow speed
      const n = Math.trunc(acc / step);
      if (n) { acc -= n * step; pending += n; flush(); }
    };
    const up = () => { x0 = null; jog.classList.remove("on"); ticks.style.transform = ""; };
    jog.addEventListener("touchstart", (e) => { e.preventDefault(); down(e.touches[0].clientX); }, { passive: false });
    jog.addEventListener("touchmove", (e) => { e.preventDefault(); move(e.touches[0].clientX); }, { passive: false });
    jog.addEventListener("touchend", up);
    jog.addEventListener("touchcancel", up);
    jog.addEventListener("mousedown", (e) => { down(e.clientX); const mm = (ev) => move(ev.clientX); const mu = () => { up(); removeEventListener("mousemove", mm); removeEventListener("mouseup", mu); }; addEventListener("mousemove", mm); addEventListener("mouseup", mu); });
  }

  // ------------------------------------------------------------------ gesture layer
  // eframe reads touches as a single primary pointer, so on its own a long-press, pinch or
  // two-finger scroll would click or drag whatever is under the first finger. We catch finger
  // input on the canvas first (window, capture phase) and hand the editor the mouse input each
  // gesture means. Synthetic events are untrusted, so this layer lets them through.
  const SLOP = 9;          // px a finger may wander and still be a tap / long-press
  const LONG_MS = 460;     // hold time for a long-press (right-click)
  const MULTI_TAP_MS = 320;
  let g = null;            // the current gesture

  const fire = (target, type, x, y, button, buttons) => {
    const init = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, screenX: x, screenY: y, button, buttons, pointerId: 1, pointerType: "mouse", isPrimary: true, view: window };
    const ev = type.startsWith("pointer") && typeof PointerEvent === "function" ? new PointerEvent(type, init) : new MouseEvent(type, init);
    target.dispatchEvent(ev);
  };
  const hover = (x, y, buttons = 0) => fire(document, "mousemove", x, y, 0, buttons);
  const press = (x, y, button = 0) => { hover(x, y); fire(canvas, "pointerdown", x, y, button, button === 2 ? 2 : 1); };
  const release = (x, y, button = 0) => { fire(document, "pointerup", x, y, button, 0); };
  const leave = () => { canvas.dispatchEvent(new MouseEvent("mouseleave", { bubbles: false, clientX: -1, clientY: -1 })); };
  const wheel = (x, y, dx, dy, ctrl) => {
    canvas.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, clientX: x, clientY: y, deltaX: dx, deltaY: dy, deltaMode: 0, ctrlKey: !!ctrl }));
  };

  const pt = (t) => ({ id: t.identifier, x: t.clientX, y: t.clientY });
  const find = (list, id) => { for (let i = 0; i < list.length; i++) if (list[i].identifier === id) return list[i]; return null; };
  const two = (e) => {
    const a = find(e.touches, g.ids[0]) || e.touches[0];
    const b = find(e.touches, g.ids[1]) || e.touches[1];
    if (!a || !b) return null;
    return { mx: (a.clientX + b.clientX) / 2, my: (a.clientY + b.clientY) / 2, d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) };
  };

  function longPress() {
    if (!g || g.state !== "pending") return;
    g.state = "long";
    buzz(12);
    ring(g.x, g.y);
    press(g.x, g.y, 2);
    release(g.x, g.y, 2);
  }

  function onStart(e) {
    if (e.target !== canvas && !g) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!g) {
      const t = pt(e.changedTouches[0]);
      g = { state: "pending", ids: [t.id], sx: t.x, sy: t.y, x: t.x, y: t.y, t0: performance.now(), fingers: 1, moved: false };
      g.timer = setTimeout(longPress, LONG_MS);
      return;
    }
    g.fingers = Math.max(g.fingers, e.touches.length);
    if (g.state === "pending" || g.state === "multi") {
      clearTimeout(g.timer);
      for (const t of e.changedTouches) if (g.ids.length < 2) g.ids.push(t.identifier);
      if (g.state === "pending") { g.state = "multi"; g.t0 = performance.now(); }
      const m = two(e);
      if (m) { g.mx = m.mx; g.my = m.my; g.d = m.d; }
    }
    // a second finger during a drag or after a long-press is ignored
  }

  function onMove(e) {
    if (!g) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (g.state === "pending") {
      const t = find(e.touches, g.ids[0]);
      if (!t) return;
      if (Math.hypot(t.clientX - g.sx, t.clientY - g.sy) > SLOP) {
        clearTimeout(g.timer);
        g.state = "drag";
        press(g.sx, g.sy, 0);
        g.x = t.clientX; g.y = t.clientY;
        hover(g.x, g.y, 1);
      }
    } else if (g.state === "drag") {
      const t = find(e.touches, g.ids[0]);
      if (!t) return;
      g.x = t.clientX; g.y = t.clientY;
      hover(g.x, g.y, 1);
    } else if (g.state === "multi") {
      const m = two(e);
      if (!m) return;
      const dx = m.mx - g.mx, dy = m.my - g.my, ratio = g.d > 0 ? m.d / g.d : 1;
      if (!g.moved && (Math.hypot(dx, dy) > 6 || Math.abs(m.d - g.d) > 8)) g.moved = true;
      if (g.moved) {
        hover(m.mx, m.my, 0);
        if (Math.abs(ratio - 1) > 0.002) wheel(m.mx, m.my, 0, -100 * Math.log(ratio), true);
        if (dx || dy) wheel(m.mx, m.my, -dx, -dy, false);
        g.mx = m.mx; g.my = m.my; g.d = m.d;
      }
    }
  }

  function onEnd(e) {
    if (!g) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const ended = Array.from(e.changedTouches).some((t) => t.identifier === g.ids[0]);
    if (g.state === "pending" && ended) {
      clearTimeout(g.timer);
      // a tap: a full click, dispatched inside this real touch event so iOS can raise the keyboard
      press(g.x, g.y, 0);
      release(g.x, g.y, 0);
      leave();
    } else if (g.state === "drag" && ended) {
      release(g.x, g.y, 0);
      leave();
      g.state = "done";
    }
    if (e.touches.length === 0) {
      if (g.state === "multi" && !g.moved && performance.now() - g.t0 < MULTI_TAP_MS + 200) {
        if (g.fingers >= 3) run("Redo", () => menu("edit.redo"));
        else run("Undo", () => menu("edit.undo"));
        buzz(8);
      }
      clearTimeout(g.timer);
      g = null;
    }
  }

  function onCancel(e) {
    if (!g) return;
    e.stopImmediatePropagation();
    clearTimeout(g.timer);
    if (g.state === "drag") { release(g.x, g.y, 0); leave(); }
    if (e.touches.length === 0) g = null;
  }

  addEventListener("touchstart", onStart, { capture: true, passive: false });
  addEventListener("touchmove", onMove, { capture: true, passive: false });
  addEventListener("touchend", onEnd, { capture: true, passive: false });
  addEventListener("touchcancel", onCancel, { capture: true, passive: false });

  // Real finger/pen pointer events would reach the editor as extra presses; the touch handlers
  // above already stand in for them.
  const swallowPointer = (e) => {
    if (!e.isTrusted || e.pointerType === "mouse") return;
    if (e.target === canvas || g) e.stopImmediatePropagation();
  };
  for (const t of ["pointerdown", "pointerup"]) addEventListener(t, swallowPointer, true);
  // Safari's own pinch events would zoom twice (and zoom the page)
  for (const t of ["gesturestart", "gesturechange", "gestureend"]) {
    addEventListener(t, (e) => { if (e.target === canvas) { e.preventDefault(); e.stopImmediatePropagation(); } }, { capture: true, passive: false });
  }
  // no double-tap page zoom anywhere
  document.addEventListener("dblclick", (e) => { if (e.target !== canvas) e.preventDefault(); }, { passive: false });

  // ------------------------------------------------------------------ first run
  const firstRun = () => {
    if (!ready()) { setTimeout(firstRun, 500); return; }
    if (coarse && !store.get("helped", false)) setTimeout(helpSheet, 600);
  };
  if (coarse) firstRun();

  window.filmcraftTouch = { toast, setOn, help: helpSheet };
})();
