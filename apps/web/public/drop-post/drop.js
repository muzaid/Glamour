/* Arriving Tomorrow — mix-and-match drop post. Config (title, white cut-outs,
   colourway sequences) is rendered by the server into #drop-data. */
(() => {
  "use strict";
  const card = document.getElementById("card");
  const fit = () => {
    const s = Math.min(innerWidth, innerHeight);
    card.style.width = card.style.height = s + "px";
    card.style.fontSize = s / 100 + "px";
  };
  fit();
  addEventListener("resize", fit);

  let cfg = null;
  try { cfg = JSON.parse(document.getElementById("drop-data")?.textContent || "null"); } catch { cfg = null; }
  if (!cfg) return;
  const HEX = /^#[0-9a-f]{6}$/i;
  const okUrl = (u) => typeof u === "string" && (u.startsWith("/api/v1/catalog-media/") || u.startsWith("https://images.higgs.ai/?") || u.startsWith("https://reel-ref-try-the-look.vercel.app/assets/"));
  const clean = (r) => ({ img: okUrl(r && r.imageUrl) ? r.imageUrl : null, seq: (r && Array.isArray(r.colours) ? r.colours : []).filter((c) => c && HEX.test(c.hex)) });
  const live = document.getElementById("live");
  const rows = {
    top: { el: document.getElementById("top"), ...clean(cfg.top), i: 0, cur: null, label: "Top" },
    bot: { el: document.getElementById("bot"), ...clean(cfg.bottom), i: 0, cur: null, label: "Bottom" },
  };
  if (!rows.top.img || !rows.bot.img || !rows.top.seq.length || !rows.bot.seq.length) return;

  const cssUrl = (u) => `url("${u.replace(/["\\\n]/g, encodeURIComponent)}")`;
  function make(row) {
    const st = rows[row], c = st.seq[st.i];
    const g = document.createElement("div"); g.className = "g";
    const hov = document.createElement("div"); hov.className = "hov";
    const tint = document.createElement("div"); tint.className = "tint";
    tint.style.backgroundColor = c.hex;
    tint.style.setProperty("--m", cssUrl(st.img));
    const img = document.createElement("img");
    img.src = st.img; img.alt = ""; img.draggable = false; img.crossOrigin = "anonymous"; img.decoding = "async";
    hov.append(tint, img); g.append(hov);
    st.el.append(g);
    st.el.setAttribute("aria-label", `${st.label}: ${c.name}. Change colour`);
    return g;
  }
  const announce = () => { live.textContent = `${rows.top.seq[rows.top.i].name} top, ${rows.bot.seq[rows.bot.i].name} bottom`; };
  rows.top.cur = make("top");
  rows.bot.cur = make("bot");

  /* ---------- Slide transition (WAAPI) ---------- */
  function slide(row, dir, delay = 0, fromPct = 0) {
    const st = rows[row], n = st.seq.length;
    const sgn = row === "top" ? dir : -dir;
    st.i = (st.i + dir + n) % n;
    const old = st.cur;
    old.style.pointerEvents = "none";
    const nw = make(row);
    st.cur = nw;
    old.animate(
      [{ transform: `translateX(${fromPct}%) rotate(0)` }, { transform: `translateX(${-sgn * 150}%) rotate(${-sgn * 9}deg)` }],
      { duration: 520, easing: "cubic-bezier(.55,0,.75,.35)", fill: "forwards", delay },
    ).onfinish = () => old.remove();
    nw.animate([
      { offset: 0, transform: `translateX(${sgn * 150}%) rotate(${sgn * 10}deg)` },
      { offset: 0.42, transform: `translateX(${sgn * 150}%) rotate(${sgn * 10}deg)` },
      { offset: 0.78, transform: `translateX(${-sgn * 3}%) rotate(${-sgn * 3.5}deg)` },
      { offset: 0.9, transform: `translateX(${sgn * 0.8}%) rotate(${sgn * 1.4}deg)` },
      { offset: 1, transform: "none" },
    ], { duration: 1250, easing: "cubic-bezier(.2,.75,.3,1)", fill: "backwards", delay });
    announce();
  }
  let lastBoth = -Infinity;
  function both(dir) {
    const now = performance.now();
    if (now - lastBoth < 700) return;
    lastBoth = now;
    slide("top", dir, 0);
    slide("bot", dir, 110);
  }

  /* ---------- Idle tracking + autoplay ---------- */
  let last = performance.now();
  const touch = () => { last = performance.now(); };
  ["pointermove", "pointerdown", "click", "keydown"].forEach((t) => addEventListener(t, touch, { passive: true }));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  setInterval(() => {
    if (reduced.matches || document.hidden) return;
    const now = performance.now();
    if (now - last > 3500) { both(1); last = now - 1300; }
  }, 250);

  /* ---------- Arrows + keys ---------- */
  document.getElementById("prev").addEventListener("click", () => both(-1));
  document.getElementById("next").addEventListener("click", () => both(1));
  addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); both(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); both(-1); }
    else if ((e.key === "Enter" || e.key === " ") && e.target && e.target.classList && e.target.classList.contains("row")) {
      e.preventDefault(); slide(e.target.id === "top" ? "top" : "bot", 1);
    }
  });

  /* ---------- Single piece: tap or drag ---------- */
  for (const row of ["top", "bot"]) {
    const st = rows[row];
    let drag = null;
    st.el.addEventListener("pointerdown", (e) => {
      const g = e.target.closest(".g");
      if (!g || g !== st.cur || (e.pointerType === "mouse" && e.button !== 0)) return;
      drag = { id: e.pointerId, x: e.clientX, dx: 0, g, w: g.offsetWidth || 1 };
      try { g.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    });
    st.el.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag.dx = e.clientX - drag.x;
      const f = drag.dx / drag.w;
      drag.g.style.transform = `translateX(${f * 100}%) rotate(${f * 8}deg)`;
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const { g, dx, w } = drag; drag = null;
      try { g.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      if (Math.abs(dx) < 4) { g.style.transform = ""; slide(row, 1); return; }
      const p = (dx / w) * 100;
      if (Math.abs(dx) > 0.14 * w) {
        g.style.transform = "";
        slide(row, row === "top" ? -Math.sign(p) : Math.sign(p), 0, p);
        return;
      }
      const from = g.style.transform;
      g.style.transform = "";
      g.animate([{ transform: from }, { transform: "none" }], { duration: 450, easing: "cubic-bezier(.3,1.6,.5,1)" });
    };
    st.el.addEventListener("pointerup", end);
    st.el.addEventListener("pointercancel", (e) => {
      // The browser took over (e.g. vertical scroll): put the piece back, never treat it as a tap.
      if (!drag || e.pointerId !== drag.id) return;
      const g = drag.g; drag = null; g.style.transform = "";
    });
  }
})();
