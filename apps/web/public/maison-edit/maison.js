/* Maison Edit — Build Your Look. Canvas outfit compositor + shop UI. */
(() => {
  "use strict";
  const CDN = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/";
  const H = (file, w) => "https://images.higgs.ai/?default=1&output=webp&url=" + encodeURIComponent(CDN + file) + "&w=" + w + "&q=88";
  const MODEL = {
    base: "hf_20261113_132636_5eabfff6-e1ee-4368-b3a9-6582c1f1397b.png", t2: "hf_20261113_132720_0affdcfe-f56e-4943-a986-c2e87f5c57ff.png",
    t3: "hf_20261113_132720_f30c45fe-a7d7-4392-97f3-de87f324f3b2.png", k2: "hf_20261113_132721_9d39ba54-b830-4e1e-9076-1f45f5be7621.png",
    k3: "hf_20261113_132720_0986c806-cb61-488a-acf7-daa9d1c32adc.png", s2: "hf_20261113_132720_8c9da93a-bc4f-4496-957c-56cf9ac47131.png",
    s3: "hf_20261113_132719_dd94cd18-2c72-4272-a4d9-829761077f19.png", g2: "hf_20261113_132721_feb73af1-d27a-4122-848a-727dae3be59f.png",
    g3: "hf_20261113_132729_883f3a83-2c13-418d-a959-79708075153f.png",
  };
  const SHEET = H("hf_20261113_132845_faa91ba1-ab25-49d9-8de1-44b84b0d65f7.png", 1000);
  const ROOM = H("hf_20261113_132845_2fe30a71-4937-4877-b8df-92bba80bbabe.png", 1800);
  const TX = [44, 610, 1177], TY = [42, 611, 1180, 1749];
  const CATS = ["t", "k", "s", "g"];
  const CAT_TAB = { t: "Tops", k: "Bottoms", s: "Shoes", g: "Bags" };
  const CAT_RAIL = { t: "Tops", k: "Skirts", s: "Shoes", g: "Bags" };
  const CAT_WORDS = { t: "tops top", k: "bottoms skirts skirt", s: "shoes shoe", g: "bags bag accessories" };
  const REGION = { t: [0.07, 0.53], k: [0.32, 0.57], s: [0.53, 1], g: [0.45, 0.75] };
  const STYLIST = [
    ["Monochrome minimal", "t2 k1 s1 g1"], ["Wine romance", "t3 k3 s3 g3"], ["Weekend denim", "t1 k2 s2 g2"],
    ["Soft contrast", "t2 k3 s3 g2"], ["Campus cool", "t3 k2 s2 g3"],
  ].map(([name, keys]) => ({ name, keys: keys.split(" ") }));

  let cfg;
  try { cfg = JSON.parse(document.getElementById("maison-data").textContent); } catch { return; }
  const P = Object.fromEntries(cfg.pieces.map((p) => [p.key, p]));
  const STORE = Object.fromEntries(cfg.stores.map((s) => [s.key, s.name]));
  const money = (n) => "$" + n.toFixed(2);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  document.documentElement.style.setProperty("--sheet", `url("${SHEET}")`);

  /** Crop the product sheet with pure CSS. ch = visible source height. */
  const Y = { 400: "584%", 450: "519%", 537: "435.01%" };
  function crop(node, key, ch) {
    const p = P[key];
    node.style.backgroundSize = `333.46% ${Y[ch]}`;
    node.style.backgroundPosition = `${(TX[p.c] / (1744 - 523)) * 100}% ${((TY[p.r] + (537 - ch) / 2) / (2336 - ch)) * 100}%`;
    return node;
  }

  /* ---------------- State ---------------- */
  let look = { t: "t1", k: "k1", s: "s1", g: "g1" };
  const history = [];
  const saved = new Set(["k2"]);
  const filt = { cat: "All", store: null, saved: false, q: "" };

  /* ---------------- Markup ---------------- */
  const I = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    burger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 7h18M3 12h18M3 17h18"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-9.2-8.6C1.2 8.3 3 5 6.3 5c2 0 3.2 1.1 3.9 2.2.7.8 1.4.8 1.8 0C12.7 6.1 14 5 16 5c3.3 0 5.1 3.3 3.4 6.4C19 15.6 12 20 12 20z"/></svg>',
    undo: '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
    body: '<svg viewBox="0 0 24 24"><circle cx="12" cy="4.5" r="2.2"/><path d="M8 22l1.2-9-3.2-1.5L8 8h8l2 3.5-3.2 1.5L16 22M12 13v9"/></svg>',
    t: '<svg viewBox="0 0 24 24"><path d="M8 3l-5 3 2 5 2.5-1V21h9V10l2.5 1 2-5-5-3a4 4 0 0 1-8 0z"/></svg>',
    k: '<svg viewBox="0 0 24 24"><path d="M7 4h10l4 16H3L7 4zM7 7h10M10 7l-2 13M14 7l2 13M12 7v13"/></svg>',
    s: '<svg viewBox="0 0 24 24"><path d="M8 3h5v10l7 3c1 .5 1.5 1.5 1.5 2.5V20H3v-4l2-3V3h3z"/></svg>',
    g: '<svg viewBox="0 0 24 24"><path d="M4 9h16l-1.5 11h-13L4 9zM8.5 9V7a3.5 3.5 0 0 1 7 0v2"/></svg>',
    spark: '<svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/></svg>',
    ext: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    home: '<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/></svg>',
    explore: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>',
    outfits: '<svg viewBox="0 0 24 24"><path d="M12 6a2 2 0 1 1 2-2M12 6v2L3 15h18l-9-7"/></svg>',
    savedI: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
    profile: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  };
  const WORDMARK = {
    norra: '<span class="w-norra">NORRA</span>', lune: '<span class="w-lune">Lune&amp;Co</span>',
    meridian: '<span class="w-meridian">Meridian</span>', ode: '<span class="w-ode">ODE<br>STUDIO</span>',
  };
  const app = document.getElementById("app");
  app.innerHTML = `
<section class="left">
  <div class="brandrow"><div class="logo">MAISON EDIT</div><button class="burger" aria-label="Menu">${I.burger}</button></div>
  <div class="panel shop">
    <label class="search">${I.search}<input id="q" type="search" placeholder="Search for products, brands or styles..." aria-label="Search"></label>
    <nav class="tabs" id="tabs">${["All", "Tops", "Bottoms", "Shoes", "Bags", "Accessories"].map((t) => `<button data-tab="${t}"${t === "All" ? ' class="on"' : ""}>${t}</button>`).join("")}<span class="bar"></span></nav>
    <div class="scroll" id="scroll">
      <div class="hd"><h3>Shop by Store</h3><button class="link" id="seeAll">See all</button></div>
      <div class="stores">${cfg.stores.map((s) => `<button class="store" data-store="${s.key}" aria-label="${esc(s.name)}" aria-pressed="false">${WORDMARK[s.key] || esc(s.name)}</button>`).join("")}</div>
      <div class="hd"><h3 id="gridTitle">Popular in your style</h3><span class="count" id="count"></span></div>
      <div class="grid" id="grid"></div>
    </div>
    <nav class="tabbar" id="tabbar">
      <button data-nav="home">${I.home}Home</button><button data-nav="explore" class="on">${I.explore}Explore</button>
      <button data-nav="outfits">${I.outfits}Outfits</button><button data-nav="saved">${I.savedI}Saved</button><button data-nav="profile">${I.profile}Profile</button>
    </nav>
  </div>
</section>
<section class="stage" id="stage">
  <div id="ar" aria-hidden="true"><img alt="" src="${ROOM}" crossorigin="anonymous"><span class="br tl"></span><span class="br tr"></span><span class="br bl"></span><span class="br brr"></span><span class="scan"></span><span class="arl"><span class="dot"></span>AR preview · your room</span></div>
  <div id="figure">
    <div id="tt"><div class="side"></div><div class="face"></div>
      <svg viewBox="0 0 100 30" preserveAspectRatio="none"><ellipse id="ring" cx="50" cy="15" rx="41" ry="11" pathLength="300" vector-effect="non-scaling-stroke"/></svg>
      <div class="lbl"><span class="a l">⟲</span> 360° <span class="a r">⟳</span></div></div>
    <div id="shadow"></div>
    <div id="body" aria-label="Model — drag to rotate"><div id="spin"><canvas id="cOld" width="1000" height="1506" role="img" aria-label="Model wearing the current look"></canvas><canvas id="cNew" width="1000" height="1506" aria-hidden="true"></canvas></div></div>
    <div id="glint"></div>
  </div>
  <div class="rail" id="rail">
    <button data-act="undo" data-tip="Undo" aria-label="Undo">${I.undo}</button>
    <button data-act="body" data-tip="Size &amp; fit" aria-label="Size and fit">${I.body}</button>
    ${CATS.map((c) => `<button data-cat="${c}" aria-label="${CAT_RAIL[c]}">${I[c]}</button>`).join("")}
    <button data-act="stylist" data-tip="AI stylist · surprise me" aria-label="AI stylist · surprise me">${I.spark}</button>
  </div>
  <div class="strip" id="strip">${CATS.map((c) => `<button class="pt" data-cat="${c}"></button>`).join("")}</div>
  <div class="toggle" id="toggle"><span class="ind"></span><button data-mode="3d" class="on" aria-pressed="true">3D</button><button data-mode="ar" aria-pressed="false">AR</button></div>
</section>
<section class="right">
  <div class="panel look">
    <div class="lh"><span class="t">YOUR LOOK</span><span class="tot" id="total">$0.00</span></div>
    <div class="rows" id="rows">${CATS.map((c) => `<button class="lrow" data-cat="${c}"><span class="pt"></span><span class="info"><span class="st"></span><span class="nm"></span><span class="pr"></span></span><span class="chev">›</span></button>`).join("")}</div>
    <div class="fit"><div class="t">STYLE &amp; FIT</div>
      ${["Fits your size", "Matches your style", "Complements your body shape"].map((l, i) => `<div class="frow" data-fit="${i}"><svg class="chk" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7"/><path d="M4.8 8.3l2.1 2.1 4.3-4.6"/></svg><span class="lb">${l}</span><span class="i">ⓘ</span><span class="pc">0%</span><span class="bub"></span></div>`).join("")}
    </div>
    <button class="stl" id="stl"><span class="sweep"></span><span class="lbt">Shop the Look</span>${I.ext}<span class="badge">4</span></button>
  </div>
  <div class="panel rec"><h4>✦ Recommended for you</h4><div class="recs" id="recs"></div></div>
</section>`;

  /* ---------------- Toast ---------------- */
  const toastEl = document.getElementById("toast");
  let toastT = 0;
  function toast(msg, link) {
    toastEl.textContent = msg;
    if (link) { const a = el("a"); a.href = link.href; a.textContent = " " + link.text; toastEl.append(a); toastEl.style.pointerEvents = "auto"; } else toastEl.style.pointerEvents = "none";
    toastEl.classList.toggle("on", false); void toastEl.offsetWidth; toastEl.classList.add("on");
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.toggle("on", false), 1800);
  }

  /* ---------------- Compositor ---------------- */
  const W = 1000, HH = 1506;
  const cOld = $("#cOld"), cNew = $("#cNew"), xOld = cOld.getContext("2d"), xNew = cNew.getContext("2d");
  const off = document.createElement("canvas"); off.width = W; off.height = HH;
  const xOff = off.getContext("2d");
  const IMG = {}, MASK = {};
  const load = (src, cross) => new Promise((res, rej) => { const im = new Image(); if (cross) im.crossOrigin = "anonymous"; im.decoding = "async"; im.onload = () => res(im); im.onerror = rej; im.src = src; });
  /** Exact soft replacement: punch the region out, then add the masked variant (premultiplied lerp). */
  function draw(ctx, lk) {
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, W, HH);
    ctx.drawImage(IMG.base, 0, 0, W, HH);
    for (const cat of ["s", "k", "t", "g"]) {
      const key = lk[cat];
      if (key.endsWith("1")) continue;
      xOff.globalCompositeOperation = "source-over";
      xOff.clearRect(0, 0, W, HH);
      xOff.drawImage(MASK[key], 0, 0, W, HH);
      xOff.globalCompositeOperation = "source-in";
      xOff.drawImage(IMG[key], 0, 0, W, HH);
      ctx.globalCompositeOperation = "destination-out";
      ctx.drawImage(MASK[key], 0, 0, W, HH);
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(off, 0, 0);
    }
    ctx.globalCompositeOperation = "source-over";
  }
  const glint = $("#glint");
  let sweep = null, ready = false;
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  /** Sweep the new look in over the changed region(s); prev = state before this change. */
  function render(cats, prev) {
    if (!ready) return;
    if (sweep) { cancelAnimationFrame(sweep.raf); draw(xOld, prev); }
    draw(xNew, look);
    const top = Math.min(...cats.map((c) => REGION[c][0])), bot = Math.max(...cats.map((c) => REGION[c][1]));
    const t0 = performance.now();
    glint.classList.add("on");
    const step = (now) => {
      const t = Math.min(1, (now - t0) / 720), y = (top + (bot - top) * ease(t)) * 100;
      cNew.style.clipPath = `inset(0 0 ${100 - y}% 0)`;
      cOld.style.clipPath = `inset(${y}% 0 0 0)`;
      glint.style.top = y + "%";
      if (t < 1) { sweep.raf = requestAnimationFrame(step); return; }
      draw(xOld, look);
      cNew.style.clipPath = "inset(0 0 100% 0)"; cOld.style.clipPath = "none";
      glint.classList.toggle("on", false);
      sweep = null;
    };
    sweep = { raf: requestAnimationFrame(step) };
  }

  /* ---------------- UI sync ---------------- */
  const total = () => CATS.reduce((s, c) => s + P[look[c]].price, 0);
  let shownTotal = 0, totalRaf = 0;
  function countTotal() {
    const from = shownTotal, to = total(), t0 = performance.now(), out = $("#total");
    cancelAnimationFrame(totalRaf);
    const f = (now) => { const t = Math.min(1, (now - t0) / 600), v = from + (to - from) * (1 - Math.pow(1 - t, 3)); shownTotal = v; out.textContent = money(v); if (t < 1) totalRaf = requestAnimationFrame(f); else shownTotal = to; };
    totalRaf = requestAnimationFrame(f);
  }
  function scores() {
    const counts = {};
    CATS.forEach((c) => P[look[c]].tags.forEach((t) => { counts[t] = (counts[t] || 0) + 1; }));
    const most = Math.max(0, ...Object.values(counts));
    const style = Math.min(99, 56 + 9 * most);
    const body = 78 + (look.k === "k1" ? 14 : look.k === "k3" ? 10 : 6) + (look.s !== "s2" ? 4 : 0);
    return [100, style, body];
  }
  const NOTES = ["Size M fits your saved measurements", "Based on 4 pieces and your saved styles", "Mini length + knee height balance your frame"];
  const shownPc = [0, 0, 0];
  function syncFit() {
    const sc = scores();
    $$(".frow").forEach((row, i) => {
      row.querySelector(".bub").textContent = NOTES[i];
      setTimeout(() => row.classList.toggle("ok", sc[i] >= 80), i * 140);
      const pc = row.querySelector(".pc"), from = shownPc[i], to = sc[i], t0 = performance.now();
      const f = (now) => { const t = Math.min(1, (now - t0) / 600); const v = Math.round(from + (to - from) * (1 - Math.pow(1 - t, 3))); pc.textContent = v + "%"; if (t < 1) requestAnimationFrame(f); else shownPc[i] = to; };
      requestAnimationFrame(f);
    });
  }
  const replay = (n, cls) => { n.classList.toggle(cls, false); void n.offsetWidth; n.classList.add(cls); };
  function sync(changed = []) {
    CATS.forEach((c) => {
      const p = P[look[c]];
      const row = $(`.lrow[data-cat="${c}"]`);
      crop(row.querySelector(".pt"), p.key, 450);
      row.querySelector(".st").textContent = p.storeName;
      row.querySelector(".nm").textContent = p.name;
      row.querySelector(".pr").textContent = money(p.price);
      row.setAttribute("aria-label", `${CAT_RAIL[c]}: ${p.name}, ${money(p.price)}. Change`);
      const sb = $(`.strip button[data-cat="${c}"]`);
      crop(sb, p.key, 537); sb.setAttribute("aria-label", `${CAT_RAIL[c]}: ${p.name}`);
      $(`.rail button[data-cat="${c}"]`).dataset.tip = `${CAT_RAIL[c]} · ${p.name}`;
      if (changed.includes(c)) { replay(row.querySelector(".pt"), "swapIn"); replay(sb, "pop"); }
    });
    $("#rail [data-act=undo]").disabled = history.length === 0;
    $$(".card").forEach((cd) => { const worn = Object.values(look).includes(cd.dataset.key); cd.classList.toggle("worn", worn); });
    countTotal(); syncFit(); renderRecs();
  }
  function renderRecs() {
    const mood = P[look.t].tags[0];
    const worn = new Set(Object.values(look));
    const pool = cfg.pieces.filter((p) => !worn.has(p.key));
    const picks = [...pool.filter((p) => p.tags.includes(mood)), ...pool.filter((p) => !p.tags.includes(mood))].slice(0, 3);
    const box = $("#recs"); box.replaceChildren();
    for (const p of picks) {
      const b = el("button", "rcard", `<span class="pt"></span><span class="st">${esc(p.storeName)}</span><span class="nm">${esc(p.name)}</span><span class="pr">${money(p.price)}</span>`);
      b.dataset.key = p.key; crop(b.querySelector(".pt"), p.key, 450); b.setAttribute("aria-label", `Try on ${p.name}`);
      box.append(b);
    }
  }

  /* ---------------- Shop grid & filters ---------------- */
  function visible() {
    const q = filt.q.trim().toLowerCase();
    return cfg.pieces.filter((p) => {
      const cat = p.key[0];
      if (filt.cat !== "All" && CAT_TAB[cat] !== filt.cat) return false;
      if (filt.store && p.store !== filt.store) return false;
      if (filt.saved && !saved.has(p.key)) return false;
      if (q && !`${p.name} ${p.storeName} ${CAT_WORDS[cat]}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }
  function renderGrid() {
    const list = visible(), grid = $("#grid");
    $("#gridTitle").textContent = filt.saved ? "Saved pieces" : filt.store ? `${STORE[filt.store]} picks` : "Popular in your style";
    $("#count").textContent = `${list.length} item${list.length === 1 ? "" : "s"}`;
    grid.replaceChildren();
    if (!list.length) { grid.append(el("p", "empty", "No pieces match.")); }
    list.forEach((p, i) => {
      const cd = el("div", "card");
      cd.dataset.key = p.key; cd.style.animationDelay = i * 35 + "ms";
      cd.innerHTML = `<div class="thumb pt" role="button" tabindex="0" aria-label="Try on ${esc(p.name)}"><button class="heart${saved.has(p.key) ? " on" : ""}" aria-label="Save ${esc(p.name)}" aria-pressed="${saved.has(p.key)}">${I.heart}</button><span class="wtag">WEARING</span><span class="tryon">Try on</span></div><div class="meta"><span class="st">${esc(p.storeName)}</span><span class="nm">${esc(p.name)}</span><span class="pr">${money(p.price)}</span></div>`;
      crop(cd.querySelector(".thumb"), p.key, 400);
      cd.classList.toggle("worn", Object.values(look).includes(p.key));
      grid.append(cd);
    });
    $$(".store").forEach((s) => { s.classList.toggle("on", s.dataset.store === filt.store); s.setAttribute("aria-pressed", String(s.dataset.store === filt.store)); });
    $$("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === filt.cat));
    moveBar();
    $$("#tabbar button").forEach((b) => b.classList.toggle("on", filt.saved ? b.dataset.nav === "saved" : b.dataset.nav === "explore"));
  }
  function moveBar() {
    const on = $("#tabs button.on"), bar = $("#tabs .bar");
    if (on) { bar.style.left = on.offsetLeft + "px"; bar.style.width = on.offsetWidth + "px"; }
  }
  const setCat = (cat) => { filt.cat = cat; renderGrid(); };

  /* ---------------- Wearing ---------------- */
  function fly(src, cat) {
    if (!src) return;
    const a = src.getBoundingClientRect(), b = $(`.strip button[data-cat="${cat}"]`).getBoundingClientRect();
    if (!a.width || !b.width) return;
    const f = el("div", "fly");
    Object.assign(f.style, { left: a.left + "px", top: a.top + "px", width: a.width + "px", height: a.height + "px", backgroundSize: src.style.backgroundSize, backgroundPosition: src.style.backgroundPosition });
    document.body.append(f);
    f.animate([{ transform: "none", opacity: 1 }, { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${b.width / a.width}, ${b.height / a.height})`, opacity: 0.85 }],
      { duration: 600, easing: "cubic-bezier(.5,0,.2,1)", fill: "forwards" }).onfinish = () => f.remove();
    f.style.transformOrigin = "0 0";
  }
  function wear(key, opts = {}) {
    const cat = key[0];
    if (!P[key]) return;
    if (look[cat] === key) { if (opts.toast !== false) toast("Trying on · " + P[key].name); return; }
    const prev = { ...look };
    history.push(prev);
    look = { ...look, [cat]: key };
    render([cat], prev);
    sync([cat]);
    fly(opts.src, cat);
    if (opts.toast !== false) toast("Trying on · " + P[key].name);
  }
  const cycle = (cat, src) => wear(cat + ((Number(look[cat][1]) % 3) + 1), { src });
  function undo() {
    if (!history.length) return;
    const prev = { ...look };
    look = history.pop();
    const changed = CATS.filter((c) => prev[c] !== look[c]);
    if (changed.length) render(changed, prev);
    sync(changed);
    toast("Undo");
  }
  let stylistI = 0, stylistTimers = [];
  function stylist() {
    const L = STYLIST[stylistI++ % STYLIST.length];
    stylistTimers.forEach(clearTimeout);
    toast("AI stylist · " + L.name);
    L.keys.filter((k) => look[k[0]] !== k).forEach((k, i) => { stylistTimers.push(setTimeout(() => wear(k, { toast: false }), i * 520)); });
  }

  /* ---------------- Events ---------------- */
  $("#q").addEventListener("input", (e) => { filt.q = e.target.value; renderGrid(); });
  $("#tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) setCat(b.dataset.tab); });
  $("#seeAll").addEventListener("click", () => { filt.store = null; renderGrid(); });
  $(".stores").addEventListener("click", (e) => { const s = e.target.closest("[data-store]"); if (s) { filt.store = filt.store === s.dataset.store ? null : s.dataset.store; renderGrid(); } });
  $("#grid").addEventListener("click", (e) => {
    const h = e.target.closest(".heart");
    const cd = e.target.closest(".card");
    if (!cd) return;
    if (h) {
      const k = cd.dataset.key;
      if (saved.has(k)) saved.delete(k); else saved.add(k);
      h.classList.toggle("on", saved.has(k)); h.setAttribute("aria-pressed", String(saved.has(k)));
      if (filt.saved) renderGrid();
      return;
    }
    wear(cd.dataset.key, { src: cd.querySelector(".thumb") });
  });
  $("#grid").addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("thumb")) { e.preventDefault(); e.target.click(); } });
  $("#tabbar").addEventListener("click", (e) => {
    const b = e.target.closest("[data-nav]"); if (!b) return;
    if (b.dataset.nav === "home") { Object.assign(filt, { cat: "All", store: null, saved: false, q: "" }); $("#q").value = ""; renderGrid(); }
    else if (b.dataset.nav === "saved") { filt.saved = true; renderGrid(); }
    else if (b.dataset.nav === "outfits") stylist();
  });
  $("#rail").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.cat) { cycle(b.dataset.cat); setCat(CAT_TAB[b.dataset.cat]); return; }
    if (b.dataset.act === "undo") undo();
    else if (b.dataset.act === "body") toast("Size M · 165 cm · fit profile saved");
    else if (b.dataset.act === "stylist") stylist();
  });
  const strip = $("#strip"), rows = $("#rows");
  strip.addEventListener("click", (e) => { const b = e.target.closest("[data-cat]"); if (b) cycle(b.dataset.cat); });
  rows.addEventListener("click", (e) => { const r = e.target.closest(".lrow"); if (r) { cycle(r.dataset.cat, r.querySelector(".pt")); setCat(CAT_TAB[r.dataset.cat]); } });
  const hl = (cat, on) => { $(`.strip button[data-cat="${cat}"]`).classList.toggle("hl", on); $(`.lrow[data-cat="${cat}"]`).classList.toggle("hl", on); };
  for (const box of [strip, rows]) {
    box.addEventListener("pointerover", (e) => { const n = e.target.closest("[data-cat]"); if (n) hl(n.dataset.cat, true); });
    box.addEventListener("pointerout", (e) => { const n = e.target.closest("[data-cat]"); if (n && !n.contains(e.relatedTarget)) hl(n.dataset.cat, false); });
  }
  $("#recs").addEventListener("click", (e) => { const c = e.target.closest(".rcard"); if (c) wear(c.dataset.key, { src: c.querySelector(".pt") }); });

  /* 3D / AR */
  const toggle = $("#toggle"), ind = toggle.querySelector(".ind");
  const placeInd = () => { const on = toggle.querySelector("button.on"); ind.style.left = on.offsetLeft + "px"; ind.style.width = on.offsetWidth + "px"; };
  toggle.addEventListener("click", (e) => {
    const b = e.target.closest("[data-mode]"); if (!b) return;
    $$("button", toggle).forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", String(x === b)); });
    const ar = $("#ar"); const on = b.dataset.mode === "ar";
    if (on) { ar.classList.toggle("on", false); void ar.offsetWidth; }
    ar.classList.toggle("on", on); ar.setAttribute("aria-hidden", String(!on));
    placeInd();
  });

  /* Drag to rotate + turntable ring */
  const body = $("#body"), spin = $("#spin"), shadow = $("#shadow"), ring = $("#ring");
  let ry = 0, drag = null, vel = 0, dash = 0, springRaf = 0;
  const applyRy = () => { spin.style.setProperty("--ry", ry.toFixed(2) + "deg"); shadow.style.transform = `translate(calc(-50% + ${(-ry * 0.6).toFixed(1)}px), -50%) scaleX(${(1 - Math.abs(ry) / 180).toFixed(3)})`; };
  body.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, start: ry, last: e.clientX }; cancelAnimationFrame(springRaf); try { body.setPointerCapture(e.pointerId); } catch { /* ignore */ } });
  body.addEventListener("pointermove", (e) => { if (!drag) return; vel = e.clientX - drag.last; drag.last = e.clientX; ry = Math.max(-34, Math.min(34, drag.start + (e.clientX - drag.x) * 0.22)); applyRy(); });
  const release = () => { if (!drag) return; drag = null; const back = () => { ry *= 0.92; if (Math.abs(ry) < 0.05) ry = 0; applyRy(); if (ry) springRaf = requestAnimationFrame(back); }; springRaf = requestAnimationFrame(back); };
  body.addEventListener("pointerup", release); body.addEventListener("pointercancel", release);
  const ringLoop = () => { vel *= 0.9; dash -= 0.25 + Math.min(12, Math.abs(vel)) * 0.4; ring.style.strokeDashoffset = dash.toFixed(2); requestAnimationFrame(ringLoop); };
  requestAnimationFrame(ringLoop);

  /* Shop the Look: adds the four real variants to the shopper's bag (server-priced). */
  const stl = $("#stl");
  stl.addEventListener("click", async () => {
    const pieces = CATS.map((c) => P[look[c]]);
    if (!cfg.signedIn) { toast("Sign in to shop the look ·", { href: "/sign-in?next=/maison-edit", text: "Sign in" }); return; }
    let added = 0;
    for (const p of pieces) {
      if (!p.variantId) continue;
      try {
        const res = await fetch("/api/v1/cart/items", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ productVariantId: p.variantId, quantity: 1 }) });
        if (res.status === 401) { toast("Sign in to shop the look ·", { href: "/sign-in?next=/maison-edit", text: "Sign in" }); return; }
        if (res.ok) added++;
      } catch { /* offline */ }
    }
    if (!added) { toast("Couldn’t add to bag. Please try again."); return; }
    replay(stl, "go");
    const b = stl.getBoundingClientRect();
    $$(".lrow .pt").forEach((t, i) => {
      const a = t.getBoundingClientRect(); const f = el("div", "fly");
      Object.assign(f.style, { left: a.left + "px", top: a.top + "px", width: a.width + "px", height: a.height + "px", backgroundSize: t.style.backgroundSize, backgroundPosition: t.style.backgroundPosition, transformOrigin: "0 0" });
      document.body.append(f);
      f.animate([{ transform: "none", opacity: 1 }, { transform: `translate(${b.left + b.width / 2 - a.left}px, ${b.top + b.height / 2 - a.top}px) scale(.15)`, opacity: 0 }], { duration: 650, delay: i * 70, easing: "cubic-bezier(.5,0,.2,1)", fill: "forwards" }).onfinish = () => f.remove();
    });
    const badge = stl.querySelector(".badge"), lbl = stl.querySelector(".lbt");
    badge.textContent = String(added); badge.classList.add("on");
    lbl.textContent = "Added · view bag";
    setTimeout(() => { lbl.textContent = "Shop the Look"; }, 1600);
    toast(`${added} piece${added === 1 ? "" : "s"} added · ${money(pieces.filter((p) => p.variantId).reduce((s, p) => s + p.price, 0))}`);
  });

  /* ---------------- Init ---------------- */
  renderGrid(); sync(); placeInd(); applyRy();
  addEventListener("resize", () => { moveBar(); placeInd(); });
  if (document.fonts) document.fonts.ready.then(() => { moveBar(); placeInd(); });
  const masks = window.MAISON_MASKS || {};
  Promise.all([
    ...Object.entries(MODEL).map(([k, f]) => load(H(f, 1000), true).then((im) => { IMG[k] = im; })),
    ...Object.entries(masks).map(([k, uri]) => load(uri, false).then((im) => { MASK[k] = im; })),
  ]).then(() => {
    ready = true;
    draw(xOld, look); cNew.style.clipPath = "inset(0 0 100% 0)";
    document.body.classList.add("ready");
  }).catch(() => toast("The model photos could not load. Please refresh."));
})();
