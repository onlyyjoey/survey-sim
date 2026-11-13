// FilmCraft touch controls: CapCut / KineMaster-style phone and tablet controls on top of the
// FilmCraft editor. Original code for this copy (MIT OR Apache-2.0, like FilmCraft).
//
// Two parts:
//  1. A gesture layer. Finger input on the editor canvas is turned into precise mouse input
//     for the editor: tap = click, drag = drag, long-press = right-click (context menu),
//     pinch = zoom (timeline / monitors), two-finger drag = scroll, two-finger tap = undo,
//     three-finger tap = redo.
//  2. A CapCut-style phone layout: video on top, timeline below, one slim bar of buttons
//     (bottom in portrait, right side in landscape), a media drawer that slides in from the left
//     (tap a file to add it, or drag it onto the timeline), and everything else under "More".
//     Buttons drive the editor through its built-in `window.filmcraft` command API.
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
    home: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9h11v-9"/><path d="M10 19v-5h4v5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    up: '<path d="M6 14.5 12 8.5l6 6"/>',
    down: '<path d="M6 9.5l6 6 6-6"/>',
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

  // ------------------------------------------------------------------ time helpers
  const TICKS = 254016000000; // FilmCraft ticks per second
  const fmt = (ticks) => {
    const s = Math.max(0, Math.round((ticks || 0) / TICKS));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  };
  async function sequence() { try { return await exec("sequence.inspect"); } catch { return null; } }

  // ------------------------------------------------------------------ playback
  let playing = false;
  const playBtns = [];
  function setPlaying(p) {
    playing = !!p;
    for (const b of playBtns) { b.querySelector(".i").innerHTML = ico(playing ? "pause" : "play"); b.setAttribute("aria-label", playing ? "Pause" : "Play"); }
  }
  async function togglePlay() {
    const r = await run(null, () => req("ui.playback", { action: "toggle" }));
    if (r && typeof r.playing === "boolean") setPlaying(r.playing);
  }

  // ------------------------------------------------------------------ layout (simple phone layout or the full editor)
  let layout = store.get("layout", coarse ? "simple" : "pro");
  let side = null;                                   // panel open on the left, if any
  let bigVideo = store.get("bigVideo", false);
  const landscape = () => innerWidth > innerHeight;
  function phoneParams() {
    return {
      showHeader: false, showStatusBar: false,
      phoneLayout: side ? "panel:" + side : "video",
      videoShare: bigVideo ? 0.6 : landscape() ? 0.5 : 0.42,
      sideShare: landscape() ? 0.36 : 0.62,
    };
  }
  async function applyLayout(which, quiet) {
    layout = which;
    store.set("layout", which);
    document.body.classList.toggle("fct-simple", which === "simple");
    const p = which === "simple" ? phoneParams() : { showHeader: true, showStatusBar: true, workspace: "Editing" };
    await run(quiet ? null : which === "simple" ? "Simple layout" : "Full editor layout", () => req("ui.set", p));
  }
  async function setSide(name, label) {
    side = side === name ? null : name;
    syncStrip();
    if (layout !== "simple") { layout = "simple"; store.set("layout", "simple"); document.body.classList.add("fct-simple"); }
    await run(side ? label : null, () => req("ui.set", phoneParams()));
  }
  let relayoutT = 0;
  addEventListener("resize", () => {
    clearTimeout(relayoutT);
    relayoutT = setTimeout(() => { if (layout === "simple" && ready()) req("ui.set", phoneParams()).catch(() => {}); }, 250);
  });

  // ------------------------------------------------------------------ media: import, list, add to the timeline
  const thumbs = new Map(); // item name → image URL, for files picked on this device
  const picker = el("input", { type: "file", multiple: "", hidden: "" });
  async function makeThumb(file) {
    if (thumbs.has(file.name)) return;
    if (file.type.startsWith("image/")) { thumbs.set(file.name, URL.createObjectURL(file)); return; }
    if (!file.type.startsWith("video/") && !/\.(mov|mp4|m4v|mkv|webm)$/i.test(file.name)) return;
    try {
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      v.muted = true; v.playsInline = true; v.preload = "metadata"; v.src = url;
      await new Promise((ok, bad) => { v.onloadeddata = ok; v.onerror = bad; setTimeout(bad, 6000); });
      v.currentTime = Math.min(1, (v.duration || 2) / 3);
      await new Promise((ok) => { v.onseeked = ok; setTimeout(ok, 2000); });
      const c = document.createElement("canvas");
      const w = 240, h = Math.round(w * ((v.videoHeight || 9) / (v.videoWidth || 16)));
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(v, 0, 0, w, h);
      thumbs.set(file.name, c.toDataURL("image/jpeg", 0.7));
      URL.revokeObjectURL(url);
    } catch { /* no thumbnail; the tile shows its type */ }
  }
  picker.addEventListener("change", async () => {
    const files = Array.from(picker.files || []);
    picker.value = "";
    if (!files.length) return;
    toast(files.length === 1 ? "Importing " + files[0].name + "…" : "Importing " + files.length + " files…");
    const res = await run(null, () => call((f) => f.importFiles(files)));
    if (!res) return;
    files.forEach((f) => makeThumb(f).then(() => drawerOpen && renderMedia()));
    const ids = (res.items || []).map((x) => (x && typeof x === "object" ? (x.item ?? x.id) : x)).filter((x) => Number.isFinite(x));
    if (!ids.length) { toast((res.errors && res.errors[0]) || "Nothing could be imported", true); return; }
    const seqNow = await sequence();
    if (startNew || !seqNow) {
      startNew = false;
      const name = files.length === 1 ? files[0].name.replace(/\.[^.]+$/, "") : "My Video";
      const r = await run("New video started", () => exec("file.newSequence", { name, fromItems: ids }));
      if (r !== undefined) { hideStart(); if (layout === "simple") applyLayout("simple", true); }
      return;
    }
    toast(ids.length === 1 ? "Imported — tap it or drag it onto the timeline" : ids.length + " files imported");
    openDrawer();
  });
  const pick = () => { picker.accept = "video/*,image/*,audio/*,.mov,.mp4,.mkv,.webm,.mp3,.m4a,.wav"; picker.click(); };

  async function addAt(item, opts) {
    let seq = await sequence();
    if (!seq) {
      return run("Started a new video", () => exec("file.newSequence", { name: "My Video", fromItem: item.item }));
    }
    const base = { item: item.item, time: opts && opts.time != null ? opts.time : (seq.playhead || 0) };
    if (item.type === "Audio") base.track = "A1";
    else if (opts && opts.track != null) base.track = opts.track;
    base.insert = !(opts && opts.overwrite);
    try {
      await exec("timeline.place", base);
    } catch (e) {
      // e.g. a picture dropped on an audio track: try again on the default track
      delete base.track;
      try { await exec("timeline.place", base); } catch (e2) { toast(friendly(String(e2 && e2.message || e2)), true); return; }
    }
    toast("Added " + item.name);
    buzz(8);
  }

  function flatten(node, out, bin) {
    if (!node) return out;
    if (node.item != null) out.push({ ...node, bin });
    for (const c of node.children || []) flatten(c, out, node.item == null ? node.name : bin);
    return out;
  }

  // drawer
  const drawer = el("div", { id: "fct-drawer", class: "fct", role: "dialog", "aria-label": "Media" });
  const dHead = el("div", { class: "dh" });
  const dAdd = el("button", { type: "button", class: "dadd" }, ico("plus") + "<span>Add</span>");
  dAdd.addEventListener("click", pick);
  const dClose = el("button", { type: "button", class: "dx", "aria-label": "Close" }, ico("frameL"));
  dClose.addEventListener("click", () => closeDrawer());
  const dTabs = el("div", { class: "dtabs" });
  dHead.append(el("b", {}, "Media"), dAdd, dClose);
  const dList = el("div", { class: "dlist" });
  const dHint = el("div", { class: "dhint" }, "Tap to add at the playhead · drag onto the timeline");
  drawer.append(dHead, dTabs, dList, dHint);
  const dScrim = el("div", { id: "fct-dscrim", onclick: () => closeDrawer() });
  let drawerOpen = false, mediaFilter = store.get("mediaFilter", "all"), mediaItems = [];
  const FILTERS = [["all", "All"], ["video", "Video"], ["photo", "Photos"], ["audio", "Audio"], ["seq", "Projects"]];
  for (const [k, label] of FILTERS) {
    const b = el("button", { type: "button", "data-k": k }, label);
    b.addEventListener("click", () => { mediaFilter = k; store.set("mediaFilter", k); renderMedia(); });
    dTabs.appendChild(b);
  }
  const kindOf = (it) => it.type === "Sequence" ? "seq" : it.type === "Audio" ? "audio" : /\.(png|jpe?g|gif|webp|heic|avif|bmp|tiff?)$/i.test(it.name) || it.type === "Still" || it.type === "Image" ? "photo" : "video";
  async function refreshMedia() {
    const p = await (async () => { try { return await exec("project.inspect"); } catch { return null; } })();
    mediaItems = p ? flatten(p.root, [], "") : [];
    renderMedia();
  }
  function renderMedia() {
    for (const b of dTabs.children) b.classList.toggle("on", b.dataset.k === mediaFilter);
    dList.textContent = "";
    const list = mediaItems.filter((it) => mediaFilter === "all" ? true : kindOf(it) === mediaFilter);
    if (!list.length) {
      const empty = el("div", { class: "dempty" }, `<p>No ${mediaFilter === "all" ? "media" : FILTERS.find((f) => f[0] === mediaFilter)[1].toLowerCase()} yet.</p>`);
      const b = el("button", { type: "button", class: "fct-primary" }, "Add from your phone");
      b.addEventListener("click", pick);
      empty.appendChild(b);
      dList.appendChild(empty);
      return;
    }
    for (const it of list) {
      const k = kindOf(it);
      const tile = el("div", { class: "tile k-" + k, role: "button", tabindex: "0", "aria-label": it.name });
      const th = el("div", { class: "th" });
      const src = thumbs.get(it.name);
      if (src) th.style.backgroundImage = `url("${src}")`;
      else th.innerHTML = ico(k === "audio" ? "music" : k === "seq" ? "panels" : k === "photo" ? "media" : "play");
      if (it.duration && k !== "photo") th.appendChild(el("span", { class: "dur" }, fmt(it.duration)));
      tile.append(th, el("div", { class: "nm" }, it.name.replace(/</g, "&lt;")));
      bindTile(tile, it);
      dList.appendChild(tile);
    }
  }
  function openDrawer() {
    if (drawerOpen) { refreshMedia(); return; }
    drawerOpen = true;
    document.body.classList.add("fct-drawer-on");
    if (typeof syncStrip === "function") syncStrip();
    refreshMedia();
  }
  function closeDrawer() {
    drawerOpen = false;
    document.body.classList.remove("fct-drawer-on");
    if (typeof syncStrip === "function") syncStrip();
  }
  // swipe the drawer back to the left to close it
  {
    let x0 = null;
    drawer.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    drawer.addEventListener("touchmove", (e) => { if (x0 !== null && !dragging && x0 - e.touches[0].clientX > 60) { x0 = null; closeDrawer(); } }, { passive: true });
  }

  // drag a tile out of the drawer onto the timeline
  let dragging = null;
  const ghost = el("div", { id: "fct-ghost", class: "fct" });
  let ppp = 0;
  async function canvasPoint(cx, cy) {
    if (!ppp) { try { ppp = (await req("ui.inspect")).pixelsPerPoint || devicePixelRatio; } catch { ppp = devicePixelRatio; } }
    const r = canvas.getBoundingClientRect();
    const zoom = ppp / (devicePixelRatio || 1);
    return { x: (cx - r.left) / zoom, y: (cy - r.top) / zoom };
  }
  addEventListener("resize", () => { ppp = 0; });
  function bindTile(tile, it) {
    let s = null, timer = 0;
    const begin = (x, y) => {
      dragging = { it, x, y };
      ghost.innerHTML = tile.querySelector(".th").outerHTML;
      ghost.style.display = "block";
      moveGhost(x, y);
      tile.classList.add("lift");
      buzz(10);
    };
    const moveGhost = (x, y) => {
      ghost.style.transform = `translate(${x - 44}px, ${y - 30}px)`;
      // let the timeline show through once the finger leaves the drawer
      document.body.classList.toggle("fct-drawer-peek", x > drawer.getBoundingClientRect().right - 10);
    };
    const finish = async (x, y, cancelled) => {
      clearTimeout(timer);
      const d = dragging; dragging = null; s = null;
      ghost.style.display = "none";
      tile.classList.remove("lift");
      document.body.classList.remove("fct-drawer-peek");
      if (!d || cancelled) return;
      const r = canvas.getBoundingClientRect();
      if (x < drawer.getBoundingClientRect().right - 10 || x < r.left || x > r.right || y < r.top || y > r.bottom) return;
      closeDrawer();
      if (it.type === "Sequence") { await run("Opened " + it.name, () => exec("sequence.open", { item: it.item })); return; }
      let hit = null;
      try { hit = await req("ui.timeline.hit", await canvasPoint(x, y)); } catch { hit = null; }
      if (hit && hit.time != null && hit.hit !== "none") await addAt(it, { time: hit.time, track: hit.track, overwrite: hit.hit === "empty" });
      else await addAt(it);
    };
    tile.addEventListener("touchstart", (e) => {
      const t = e.touches[0];
      s = { x: t.clientX, y: t.clientY, moved: false };
      timer = setTimeout(() => { if (s && !dragging) begin(s.x, s.y); }, 280);
    }, { passive: true });
    tile.addEventListener("touchmove", (e) => {
      if (!s) return;
      const t = e.touches[0];
      const dx = t.clientX - s.x, dy = t.clientY - s.y;
      if (!dragging) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { clearTimeout(timer); s = null; return; } // scrolling the list
        if (dx > 12) begin(t.clientX, t.clientY);
        else return;
      }
      e.preventDefault();
      dragging.x = t.clientX; dragging.y = t.clientY;
      moveGhost(t.clientX, t.clientY);
    }, { passive: false });
    tile.addEventListener("touchend", (e) => {
      clearTimeout(timer);
      if (dragging) { e.preventDefault(); finish(dragging.x, dragging.y, false); return; }
      if (s && !s.moved) { e.preventDefault(); s = null; tap(); }
    });
    tile.addEventListener("touchcancel", () => finish(0, 0, true));
    tile.addEventListener("click", () => tap());
    const tap = () => {
      if (it.type === "Sequence") { run("Opened " + it.name, () => exec("sequence.open", { item: it.item })); closeDrawer(); return; }
      addAt(it);
    };
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
  const SCALES = [75, 100, 125, 150, 175, 200, 250, 300];
  async function uiSize(dir) {
    const info = await run(null, () => req("ui.inspect"));
    if (!info) return;
    ppp = 0;
    const cur = Math.round((info.pixelsPerPoint || devicePixelRatio || 1) * 100);
    const next = dir > 0 ? SCALES.find((v) => v > cur + 5) : [...SCALES].reverse().find((v) => v < cur - 5);
    if (!next) { toast(dir > 0 ? "Already the largest size" : "Already the smallest size"); return; }
    await run("Interface size " + next + "%", () => exec("prefs.set", { key: "appearance.uiScale", value: String(next) }));
  }
  let mode = "edit";
  async function setMode(m, label) {
    const r = await run(label || null, () => req("ui.set", { mode: m }));
    if (r !== undefined) { mode = m; syncTop(); }
  }
  const exportNow = () => setMode("export", "Export: pick a format, then Export");
  const backToEdit = () => setMode("edit");

  function moreSheet() {
    const t = (name, label, icon) => ({ label, icon, on: currentTool === name, run: () => setTool(name, label + " tool").then(syncStrip) });
    sheet("Edit", (s) => {
      grid(s, null, [
        { label: "Text", icon: "text", run: () => setTool("type", "Text: tap the video where the text goes") },
        { label: "Speed", icon: "speed", run: () => run(null, () => menu("clip.speedDuration")) },
        { label: "Volume", icon: "volume", run: () => run(null, () => menu("clip.audioGain")) },
        { label: "Transition", icon: "trans", run: () => run("Transition added", () => menu("sequence.applyVideoTransition")) },
        { label: "Freeze", icon: "freeze", run: () => run(null, () => menu("clip.frameHold")) },
        { label: "Duplicate", icon: "dup", run: () => run("Duplicated", () => menu("edit.duplicate")) },
        { label: "Delete gap", icon: "ripple", run: () => run("Deleted and closed the gap", () => menu("edit.rippleDelete")) },
        { label: "Redo", icon: "redo", run: () => run("Redo", () => menu("edit.redo")) },
        { label: "Copy", icon: "copy", run: () => run("Copied", () => menu("edit.copy")) },
        { label: "Paste", icon: "paste", run: () => run("Pasted at playhead", () => menu("edit.paste")) },
        { label: "Audio", icon: "music", run: () => { mediaFilter = "audio"; openDrawer(); } },
        { label: "Nest", icon: "nest", run: () => run(null, () => menu("clip.nest")) },
      ]);
      grid(s, "Timeline", [
        { label: "Fit timeline", icon: "zoomfit", run: () => run(null, () => menu("view.zoomToSequence")) },
        { label: "Go to start", icon: "start", run: () => run(null, () => menu("playhead.start")) },
        { label: "Mark in", icon: "inpt", run: () => run("In point set", () => menu("markers.markIn")) },
        { label: "Mark out", icon: "outpt", run: () => run("Out point set", () => menu("markers.markOut")) },
        { label: "Marker", icon: "marker", run: () => run("Marker added", () => menu("markers.add")) },
        { label: "Split all", icon: "split", run: () => run("Split all tracks", () => menu("sequence.addEditAllTracks")) },
      ]);
      grid(s, "Tools", [
        t("selection", "Select", "hand"), t("razor", "Blade", "split"), t("ripple", "Ripple", "ripple"),
        t("rolling", "Roll", "trans"), t("ratestretch", "Stretch", "speed"), t("slip", "Slip", "frameR"),
      ]);
      grid(s, "Project", [
        { label: "Export", icon: "export", run: exportNow },
        { label: "Back to edit", icon: "panels", run: backToEdit },
        { label: "Save", icon: "save", run: () => run(null, () => menu("file.save")) },
        { label: "Open project", icon: "media", run: () => run(null, () => menu("file.open")) },
        { label: "New video", icon: "plus", run: () => run(null, () => menu("file.newSequence")) },
      ]);
      grid(s, "Screen", [
        { label: layout === "simple" ? "Full editor" : "Simple layout", icon: "panels", run: () => applyLayout(layout === "simple" ? "pro" : "simple") },
        { label: bigVideo ? "Bigger timeline" : "Bigger video", icon: "panels", run: () => { bigVideo = !bigVideo; store.set("bigVideo", bigVideo); applyLayout("simple", true); } },
        { label: "Color", icon: "freeze", run: () => setSide("lumetricolor", "Color") },
        { label: "Sound", icon: "volume", run: () => setSide("essentialsound", "Sound") },
        { label: "Titles", icon: "text", run: () => setSide("essentialgraphics", "Titles") },
        { label: "Smaller UI", icon: "minus", keep: true, run: () => uiSize(-1) },
        { label: "Larger UI", icon: "plus", keep: true, run: () => uiSize(1) },
        { label: "Customize buttons", icon: "tools", run: () => customizeSheet() },
        { label: "Hide buttons", icon: "hide", run: () => setOn(false) },
        { label: "Gestures", icon: "help", run: () => helpSheet() },
      ]);
    });
  }
  function helpSheet() {
    sheet("Touch controls", (s) => {
      const ul = el("ul", { class: "fct-help" });
      for (const [g, d] of [
        ["Swipe from left", "Opens your media. Tap a file to add it at the playhead, or drag it onto the timeline"],
        ["Tap", "Select a clip, press a button, move the playhead"],
        ["Drag", "Move clips, trim their edges, drag the playhead"],
        ["Long-press", "Menu for whatever is under your finger"],
        ["Pinch", "Zoom the timeline or the video"],
        ["Two fingers", "Scroll the timeline"],
        ["2-finger tap", "Undo"],
        ["3-finger tap", "Redo"],
        ["Left buttons", "Edit, tools, and panels (Media, Effects, Adjust, Mixer, Levels) that open on the left. Tap a panel button again to close it"],
        ["⋯ More", "Speed, volume, transitions, color, export and everything else"],
      ]) ul.appendChild(el("li", {}, `<b>${g}</b><span>${d}</span>`));
      s.appendChild(ul);
      const ok = el("button", { type: "button", class: "fct-primary" }, "Got it");
      ok.addEventListener("click", () => { store.set("helped2", true); closeSheet(); });
      s.appendChild(ok);
    });
  }

  // ------------------------------------------------------------------ top bar: Home, the three modes, and the full menus
  const top = el("div", { id: "fct-top", class: "fct" });
  const tb = (id, html, label, fn) => { const b = el("button", { type: "button", "data-id": id, "aria-label": label }, html); b.addEventListener("click", fn); top.appendChild(b); return b; };
  const seg = el("div", { class: "seg" });
  top.appendChild(seg);
  for (const [m, label] of [["import", "Import"], ["edit", "Edit"], ["export", "Export"]]) {
    const b = el("button", { type: "button", "data-mode": m }, label);
    b.addEventListener("click", () => setMode(m));
    seg.appendChild(b);
  }
  top.appendChild(el("div", { class: "sp" }));
  tb("menu", ico("menu") + "<span>Menu</span>", "Menus", () => menuSheet([]));
  tb("home", ico("home"), "Home", () => showStart(true));
  function syncTop() { for (const b of seg.children) b.classList.toggle("on", b.dataset.mode === mode); }
  syncTop();

  // The editor's whole menu bar (File, Edit, Clip, Sequence…) as a drill-down sheet.
  async function menuSheet(path) {
    const items = await run(null, () => req("ui.menu.list"));
    if (!items) return;
    const under = items.filter((it) => it.path && it.path.length >= path.length && path.every((p, i) => it.path[i] === p));
    sheet(path.length ? path[path.length - 1] : "Menu", (s) => {
      if (path.length) {
        const back = el("button", { type: "button", class: "fct-back" }, ico("frameL") + "<span>" + (path.length > 1 ? path[path.length - 2] : "Menu") + "</span>");
        back.addEventListener("click", () => menuSheet(path.slice(0, -1)));
        s.appendChild(back);
      }
      const list = el("div", { class: "fct-menu" });
      const seen = new Set();
      for (const it of under) {
        if (it.path.length > path.length) {
          const sub = it.path[path.length];
          if (seen.has("/" + sub)) continue;
          seen.add("/" + sub);
          const b = el("button", { type: "button" }, `<span>${sub}</span>${ico("frameR")}`);
          b.addEventListener("click", () => menuSheet(path.concat(sub)));
          list.appendChild(b);
        } else if (path.length && it.path.length === path.length) {
          if (seen.has(it.id)) continue;
          seen.add(it.id);
          const mark = it.checked === true ? "✓ " : "";
          const b = el("button", { type: "button", class: it.enabled ? "" : "off" }, `<span>${mark}${String(it.label).replace(/</g, "&lt;")}</span>${it.shortcut ? `<kbd>${it.shortcut}</kbd>` : ""}`);
          if (it.enabled) b.addEventListener("click", () => { closeSheet(); run(null, () => req("ui.menu.invoke", { command: it.id })); });
          list.appendChild(b);
        }
      }
      // top level: the menus in their usual order
      if (!path.length) {
        const order = ["File", "Edit", "Clip", "Sequence", "Markers", "Graphics and Titles", "View", "Window", "Help"];
        const rank = (b) => { const i = order.indexOf(b.textContent.trim()); return i < 0 ? 99 : i; };
        const kids = Array.from(list.children).sort((a, b) => rank(a) - rank(b));
        kids.forEach((k) => list.appendChild(k));
      }
      s.appendChild(list);
    });
  }

  // ------------------------------------------------------------------ start screen: add files to begin
  const start = el("div", { id: "fct-start", class: "fct", role: "dialog", "aria-label": "Start" });
  start.innerHTML = `
    <div class="box">
      <img src="icon-192.png" alt="" width="64" height="64">
      <h1>New video</h1>
      <p>Pick videos, photos or music from your phone. They go on the timeline in the order you pick them.</p>
      <button type="button" class="fct-primary big" data-a="new">${ico("plus")}<span>Add videos &amp; photos</span></button>
      <div class="row2">
        <button type="button" data-a="open">${ico("media")}<span>Open project</span></button>
        <button type="button" data-a="recent">${ico("home")}<span>Recent projects</span></button>
      </div>
      <button type="button" class="back" data-a="back">Back to editing</button>
    </div>`;
  let startNew = false; // the next import starts a new video
  start.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-a]");
    if (!b) return;
    const a = b.dataset.a;
    if (a === "new") { startNew = true; pick(); }
    else if (a === "open") { hideStart(); run(null, () => menu("file.open")).then(() => setTimeout(checkStart, 1500)); }
    else if (a === "recent") { hideStart(); setMode("import"); }
    else if (a === "back") hideStart();
  });
  async function showStart(fromHome) {
    const seq = await sequence();
    start.querySelector(".back").hidden = !seq;
    start.querySelector("h1").textContent = seq && fromHome ? "Home" : "New video";
    document.body.classList.add("fct-start-on");
    closeDrawer(); closeSheet();
  }
  function hideStart() { startNew = false; document.body.classList.remove("fct-start-on"); }
  async function checkStart() {
    if (!ready()) return;
    const seq = await sequence();
    if (!seq && mode === "edit") showStart(false); else if (seq && !startNew) hideStart();
  }

  // ------------------------------------------------------------------ the strip (left side): one column, scrolls, order set in More ▸ Customize
  const bar = el("div", { id: "fct-bar", class: "fct", role: "toolbar", "aria-label": "Editing" });
  const strip = {};
  const sideBtn = (name, label, toast_) => () => setSide(name, toast_ || label);
  const BUTTONS = {
    play: { label: "Play", icon: "play", cls: "play", fn: togglePlay },
    split: { label: "Split", icon: "split", fn: () => run("Split", () => menu("sequence.addEdit")) },
    delete: { label: "Delete", icon: "trash", cls: "danger", fn: () => run("Deleted", () => menu("edit.clear")) },
    undo: { label: "Undo", icon: "undo", fn: () => run("Undo", () => menu("edit.undo")) },
    redo: { label: "Redo", icon: "redo", fn: () => run("Redo", () => menu("edit.redo")) },
    "t-selection": { label: "Select", icon: "hand", fn: () => setTool("selection", "Select").then(syncStrip) },
    "t-razor": { label: "Blade", icon: "split", fn: () => setTool("razor", "Blade: tap a clip to cut it").then(syncStrip) },
    "t-type": { label: "Text", icon: "text", fn: () => setTool("type", "Text: tap the video where the text goes").then(syncStrip) },
    "t-ripple": { label: "Ripple", icon: "ripple", fn: () => setTool("ripple", "Ripple trim").then(syncStrip) },
    "t-hand": { label: "Pan", icon: "hand", fn: () => setTool("hand", "Pan").then(syncStrip) },
    media: { label: "Media", icon: "media", cls: "hot", fn: () => (drawerOpen ? closeDrawer() : openDrawer()) },
    "p-effects": { label: "Effects", icon: "trans", fn: sideBtn("effects", "Effects", "Effects: drag one onto a clip") },
    "p-effectcontrols": { label: "Adjust", icon: "speed", fn: sideBtn("effectcontrols", "Adjust", "Adjust the selected clip") },
    "p-audiotrackmixer": { label: "Mixer", icon: "volume", fn: sideBtn("audiotrackmixer", "Audio mixer") },
    "p-audiometers": { label: "Levels", icon: "music", fn: sideBtn("audiometers", "Audio levels") },
    "p-lumetricolor": { label: "Color", icon: "freeze", fn: sideBtn("lumetricolor", "Color") },
    "p-essentialsound": { label: "Sound", icon: "volume", fn: sideBtn("essentialsound", "Sound") },
    "p-essentialgraphics": { label: "Titles", icon: "text", fn: sideBtn("essentialgraphics", "Titles") },
    speed: { label: "Speed", icon: "speed", fn: () => run(null, () => menu("clip.speedDuration")) },
    volume: { label: "Volume", icon: "volume", fn: () => run(null, () => menu("clip.audioGain")) },
    transition: { label: "Transition", icon: "trans", fn: () => run("Transition added", () => menu("sequence.applyVideoTransition")) },
    freeze: { label: "Freeze", icon: "freeze", fn: () => run(null, () => menu("clip.frameHold")) },
    duplicate: { label: "Duplicate", icon: "dup", fn: () => run("Duplicated", () => menu("edit.duplicate")) },
    deletegap: { label: "Del. gap", icon: "ripple", fn: () => run("Deleted and closed the gap", () => menu("edit.rippleDelete")) },
    copy: { label: "Copy", icon: "copy", fn: () => run("Copied", () => menu("edit.copy")) },
    paste: { label: "Paste", icon: "paste", fn: () => run("Pasted at playhead", () => menu("edit.paste")) },
    marker: { label: "Marker", icon: "marker", fn: () => run("Marker added", () => menu("markers.add")) },
    fit: { label: "Fit", icon: "zoomfit", fn: () => run(null, () => menu("view.zoomToSequence")) },
    frameback: { label: "−1 frame", icon: "frameL", fn: () => run(null, () => menu("playhead.stepBack")) },
    framefwd: { label: "+1 frame", icon: "frameR", fn: () => run(null, () => menu("playhead.stepForward")) },
    save: { label: "Save", icon: "save", fn: () => run(null, () => menu("file.save")) },
    export: { label: "Export", icon: "export", fn: () => exportNow() },
    more: { label: "More", icon: "more", fn: () => moreSheet() },
  };
  const DEFAULT_ORDER = ["play", "split", "delete", "undo", "redo", "t-selection", "t-razor", "t-type", "media", "p-effects", "p-effectcontrols", "p-audiotrackmixer", "p-audiometers", "speed", "volume", "transition", "more"];
  let order = (store.get("strip", null) || DEFAULT_ORDER).filter((id) => BUTTONS[id]);
  if (!order.includes("more")) order.push("more"); // always a way back to settings
  function renderStrip() {
    bar.textContent = "";
    for (const k of Object.keys(strip)) delete strip[k];
    playBtns.length = 0;
    for (const id of order) {
      const d = BUTTONS[id];
      const b = el("button", { type: "button", class: "fct-b " + (d.cls || ""), "data-id": id, "aria-label": d.label, title: d.label }, `<span class="i">${ico(d.icon)}</span><span class="l">${d.label}</span>`);
      b.addEventListener("click", () => { buzz(5); d.fn(); });
      bar.appendChild(b);
      strip[id] = b;
      if (id === "play") playBtns.push(b);
    }
    setPlaying(playing);
    syncStrip();
  }
  function syncStrip() {
    for (const [id, b] of Object.entries(strip)) {
      if (id.startsWith("t-")) b.classList.toggle("on", id === "t-" + currentTool);
      if (id.startsWith("p-")) b.classList.toggle("on", id === "p-" + side);
    }
    if (strip.media) strip.media.classList.toggle("on", drawerOpen);
  }
  function saveOrder() { store.set("strip", order); renderStrip(); }

  // More ▸ Customize buttons: show / hide each button and move it up or down
  function customizeSheet() {
    sheet("Customize buttons", (s) => {
      s.appendChild(el("p", { class: "fct-note" }, "Buttons run top to bottom on the left. Scroll the strip for the rest."));
      const list = el("div", { class: "fct-cust" });
      const draw = () => {
        list.textContent = "";
        const rows = order.concat(Object.keys(BUTTONS).filter((id) => !order.includes(id)));
        rows.forEach((id) => {
          const d = BUTTONS[id], on = order.includes(id), i = order.indexOf(id);
          const row = el("div", { class: "row" + (on ? "" : " off") });
          const tog = el("button", { type: "button", class: "tog" + (on ? " on" : ""), "aria-label": on ? "Hide " + d.label : "Show " + d.label }, on ? "✓" : "");
          tog.addEventListener("click", () => {
            if (id === "more") { toast("More always stays, so you can get back here"); return; }
            order = on ? order.filter((x) => x !== id) : order.concat(id);
            saveOrder(); draw();
          });
          const up = el("button", { type: "button", class: "mv", "aria-label": "Move " + d.label + " up" }, ico("up"));
          const dn = el("button", { type: "button", class: "mv", "aria-label": "Move " + d.label + " down" }, ico("down"));
          up.disabled = !on || i === 0; dn.disabled = !on || i === order.length - 1;
          up.addEventListener("click", () => { [order[i - 1], order[i]] = [order[i], order[i - 1]]; saveOrder(); draw(); });
          dn.addEventListener("click", () => { [order[i + 1], order[i]] = [order[i], order[i + 1]]; saveOrder(); draw(); });
          row.append(tog, el("span", { class: "ic" }, ico(d.icon)), el("span", { class: "nm" }, d.label), up, dn);
          list.appendChild(row);
        });
      };
      draw();
      s.appendChild(list);
      const reset = el("button", { type: "button", class: "fct-primary" }, "Reset to default");
      reset.addEventListener("click", () => { order = DEFAULT_ORDER.slice(); saveOrder(); draw(); });
      s.appendChild(reset);
    });
  }
  renderStrip();

  const toggle = el("button", { type: "button", id: "fct-toggle", class: "fct", "aria-label": "Show buttons" }, ico("more"));
  toggle.addEventListener("click", () => setOn(true));
  function setOn(on) {
    document.body.classList.toggle("fct-on", on);
    store.set("on", on);
  }

  document.body.append(top, bar, toggle, start, dScrim, drawer, ghost, scrim, toastEl, picker);
  const wantOn = qs.has("touch") ? qs.get("touch") !== "0" : store.get("on", coarse);
  setOn(!!wantOn);
  document.body.classList.toggle("fct-simple", layout === "simple");

  addEventListener("keydown", (e) => { if (e.code === "Space" && e.target === canvas) setPlaying(!playing); }, true);


  // ------------------------------------------------------------------ gesture layer
  // eframe reads touches as a single primary pointer, so on its own a long-press, pinch or
  // two-finger scroll would click or drag whatever is under the first finger. We catch finger
  // input on the canvas first (window, capture phase) and hand the editor the mouse input each
  // gesture means. Synthetic events are untrusted, so this layer lets them through.
  const SLOP = 9;          // px a finger may wander and still be a tap / long-press
  const LONG_MS = 460;     // hold time for a long-press (right-click)
  const MULTI_TAP_MS = 320;
  const EDGE = 22;         // px from the left edge where a swipe opens the media drawer
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
      g = { state: "pending", ids: [t.id], sx: t.x, sy: t.y, x: t.x, y: t.y, t0: performance.now(), fingers: 1, moved: false, edge: t.x - canvas.getBoundingClientRect().left < EDGE };
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
      if (g.edge && t.clientX - g.sx > 24 && Math.abs(t.clientY - g.sy) < t.clientX - g.sx) {
        // swipe in from the left edge: the media drawer
        clearTimeout(g.timer);
        g.state = "edge";
        openDrawer();
        return;
      }
      if (g.edge && Math.hypot(t.clientX - g.sx, t.clientY - g.sy) <= 24) return;
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


  // ------------------------------------------------------------------ start-up
  const startUp = () => {
    if (!ready()) { setTimeout(startUp, 400); return; }
    if (layout === "simple") applyLayout("simple", true);
    checkStart();
    if (coarse && !store.get("helped2", false)) setTimeout(() => { if (!document.body.classList.contains("fct-start-on")) helpSheet(); }, 700);
  };
  startUp();

  window.filmcraftTouch = { toast, setOn, help: helpSheet, layout: applyLayout, media: openDrawer };
})();
