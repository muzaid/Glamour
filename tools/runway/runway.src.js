/* Try the Look. — Runway (vanilla JS custom element). Generated catalog is inlined below. */
(() => {
  "use strict";
  const CATALOG = __CATALOG__;
  const BAG_KEY = "runway-styling-bag-v3";
  const STORE_HOST = "nike-makknzjs.myshopify.com";
  const RM = matchMedia("(prefers-reduced-motion: reduce)");
  const reduced = () => RM.matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const money = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  const isInt = (n) => Number.isSafeInteger(n);
  const raf2 = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));

  /* ------------------------------------------------------------ Bag */
  const Bag = {
    entries: [], catalog: null, byVariant: new Map(), toastTimer: 0,
    load() {
      try {
        const raw = JSON.parse(localStorage.getItem(BAG_KEY) || "[]");
        this.entries = (Array.isArray(raw) ? raw : []).filter((e) => e && isInt(e.id) && isInt(e.quantity) && e.quantity >= 1 && e.quantity <= 20).slice(0, 50);
      } catch { this.entries = []; }
    },
    save() { try { localStorage.setItem(BAG_KEY, JSON.stringify(this.entries)); } catch { /* storage unavailable */ } },
    async getCatalog() {
      if (this.catalog) return this.catalog;
      let c;
      try { c = CATALOG; } catch { throw new Error("The product list could not load."); }
      const ok = c && Array.isArray(c.items) && c.items.every((it) => typeof it.id === "string" && typeof it.name === "string" && Number.isFinite(it.price) && it.price >= 0 &&
        Array.isArray(it.variants) && it.variants.every((v) => isInt(v.id) && typeof v.a === "boolean" && Array.isArray(v.o) && v.o.every((o) => typeof o === "string")));
      if (!ok) throw new Error("The product list is unavailable.");
      this.catalog = c;
      for (const it of c.items) for (const v of it.variants) this.byVariant.set(v.id, { item: it, variant: v });
      return c;
    },
    async add(items) {
      await this.getCatalog();
      for (const { id } of items) { const m = this.byVariant.get(id); if (!m || !m.variant.a) throw new Error("Please choose an available size."); }
      for (const { id, quantity } of items) {
        const ex = this.entries.find((e) => e.id === id);
        if (ex) ex.quantity = Math.min(20, ex.quantity + (quantity || 1));
        else if (this.entries.length < 50) this.entries.push({ id, quantity: quantity || 1 });
      }
      this.save(); this.render();
      this.toast(items.length > 1 ? "Look saved to your styling bag" : "Piece saved to your styling bag");
    },
    remove(id) { this.entries = this.entries.filter((e) => e.id !== id); this.save(); this.render(); },
    count() { return this.entries.reduce((n, e) => n + e.quantity, 0); },
    toast(msg) {
      const el = document.getElementById("bag-status"); if (!el) return;
      el.textContent = msg; el.classList.add("is-on");
      clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => el.classList.remove("is-on"), 2500);
    },
    render() {
      document.querySelectorAll("[data-cart-count]").forEach((el) => { el.textContent = String(this.count()); });
      const list = document.getElementById("bag-items"), total = document.getElementById("bag-total"), exp = document.getElementById("export-bag");
      if (!list) return;
      list.replaceChildren();
      const rows = this.entries.map((e) => ({ e, m: this.byVariant.get(e.id) })).filter((r) => r.m);
      if (!rows.length) {
        const p = document.createElement("p"); p.className = "bag-note"; p.textContent = "Your styling bag is empty. Choose a size beside a piece to save it."; list.append(p);
        total.textContent = ""; exp.disabled = true; return;
      }
      let sum = 0;
      for (const { e, m } of rows) {
        const url = new URL(m.item.url);
        if (url.hostname !== STORE_HOST) throw new Error("Unexpected product link");
        sum += m.item.price * e.quantity;
        const row = document.createElement("div"); row.className = "bag-row";
        const img = document.createElement("img"); img.src = m.item.image; img.alt = m.item.name; img.width = 60; img.height = 80; img.loading = "lazy";
        const info = document.createElement("div");
        const h = document.createElement("h3"); h.textContent = m.item.name;
        const p = document.createElement("p"); p.textContent = `Size ${m.variant.o[0]} · Quantity ${e.quantity} · ${money(m.item.price)}`;
        const a = document.createElement("a"); a.href = url.href; a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = "View original piece ↗";
        info.append(h, p, a);
        const rm = document.createElement("button"); rm.type = "button"; rm.textContent = "×"; rm.setAttribute("aria-label", `Remove ${m.item.name}`);
        rm.addEventListener("click", () => this.remove(e.id));
        row.append(img, info, rm); list.append(row);
      }
      total.textContent = `Reference subtotal ${money(sum)}`;
      exp.disabled = false;
    },
    exportText() {
      const lines = this.entries.map((e) => this.byVariant.get(e.id)).filter(Boolean).map((m, i) => `${m.item.name} · Size ${m.variant.o[0]} · Quantity ${this.entries[i].quantity}\n${m.item.url}`);
      return ["RUNWAY — STYLING SHORTLIST", "Reference prices; no order or payment has been placed.", "", ...lines].join("\n\n");
    },
  };

  function initBagUi() {
    Bag.load();
    Bag.getCatalog().then(() => Bag.render()).catch(() => Bag.render());
    const dlg = document.getElementById("bag-dialog");
    document.getElementById("open-bag")?.addEventListener("click", async () => {
      try { await Bag.getCatalog(); } catch { /* render shows empty */ }
      Bag.render(); if (!dlg.open) dlg.showModal();
    });
    document.getElementById("close-bag")?.addEventListener("click", () => dlg.close());
    dlg?.addEventListener("click", (ev) => {
      const r = dlg.getBoundingClientRect();
      if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) dlg.close();
    });
    document.getElementById("export-bag")?.addEventListener("click", () => {
      if (!Bag.entries.length) return;
      const url = URL.createObjectURL(new Blob([Bag.exportText()], { type: "text/plain;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = "runway-outfit-shortlist.txt"; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  /* ------------------------------------------------------------ Section */
  const SHEET_VARS = ["--rw-panel", "--rw-text", "--rw-muted", "--rw-line", "--rw-accent", "--rw-on-accent", "--rw-btn-bg", "--rw-btn-fg", "--rw-btn-radius", "--rw-pill-radius", "--rw-bar-r", "--rw-thumb-radius", "--rw-pt-size", "--rw-price", "--rw-opt", "--rw-ease", "--rw-ease-sheet", "--rw-ease-spring"];
  const FEEL = { balanced: { K: 95, lag: 0.04 } };

  class RunwaySection extends HTMLElement {
    connectedCallback() { if (!this._init) { this._init = true; this.setup(); } }
    disconnectedCallback() { this.teardown(); }

    q(s, root = this) { return root.querySelector(s); }
    qa(s, root = this) { return [...root.querySelectorAll(s)]; }

    setup() {
      this.n = 6; this.N = this.n * Math.ceil(8 / this.n);
      const feel = FEEL[this.dataset.feel] || FEEL.balanced;
      this.K = feel.K; this.C = 2 * Math.sqrt(this.K);
      this.speed = Number(this.dataset.speed) || 5000;
      this.stage = this.q("[data-rw-stage]"); this.actors = this.q("[data-rw-actors]");
      this.heroes = this.qa("[data-rw-hero]"); this.ticks = this.qa("[data-rw-tick]"); this.panels = this.qa("[data-rw-panel]");
      this.live = this.q("[data-rw-live]"); this.piecesLabel = this.q("[data-rw-pieces]");
      this.lb = this.q("[data-rw-lb]"); this.lbStage = this.q("[data-rw-lb-stage]");
      this.timers = new Set(); this.listeners = [];
      this.index = 0; this.start = reduced() ? 0 : 1.15;
      this.target = 0; this.cur = -this.start; this.vel = 0;
      this.still = false; this.dragging = false; this.playing = false; this.engaged = false; this.panelHover = false; this.zoomed = false;
      this.visible = false; this.rafId = 0; this.lastT = 0; this.vh = 0; this.vw = 0; this.mode = "";
      this.classList.add("rw--js");

      // Clone originals into the extra ring slots.
      const originals = this.qa("[data-rw-model]", this.actors);
      for (let a = this.n; a < this.N; a++) {
        const c = originals[a % this.n].cloneNode(true);
        c.dataset.index = String(a); c.setAttribute("data-rw-clone", "");
        c.querySelectorAll("img").forEach((im) => { im.loading = "lazy"; im.classList.remove("is-decoded"); });
        this.actors.append(c);
      }
      this.bodies = this.qa("[data-rw-model]", this.actors).map((el, a) => ({ el, a, look: a % this.n, w: 0, x: -this.start, g: -this.start, v: 0, trip: false, from: 0, lastGoal: null, blur: -1, settled: false }));
      this.qa("img[data-model-image]").forEach((im) => this.decode(im));
      this.feet();

      this.measure();
      this.setIndex(0, true);
      this.bindEvents();
      this.setupCursor();
      this.observe();
      if (this.dataset.autoplay === "true" && !reduced() && !(window.Shopify && window.Shopify.designMode)) this.play(true);
    }

    teardown() {
      cancelAnimationFrame(this.rafId); cancelAnimationFrame(this.cursorRaf || 0);
      for (const t of this.timers) clearTimeout(t);
      clearTimeout(this.autoTimer); clearTimeout(this.resizeTimer);
      this.io?.disconnect(); this.revealIo?.disconnect(); this.ro?.disconnect();
      for (const [t, ev, fn, o] of this.listeners) t.removeEventListener(ev, fn, o);
      this.closeSheet(true); this.sheetHost?.remove();
    }
    on(t, ev, fn, o) { t.addEventListener(ev, fn, o); this.listeners.push([t, ev, fn, o]); }
    later(fn, ms) { const id = setTimeout(() => { this.timers.delete(id); fn(); }, ms); this.timers.add(id); return id; }

    decode(im) {
      const done = () => im.classList.add("is-decoded");
      if (im.decode) im.decode().then(done).catch(() => { if (im.naturalWidth) done(); else im.addEventListener("load", done, { once: true }); });
      else if (im.complete) done(); else im.addEventListener("load", done, { once: true });
    }

    /* Feet detection: shift art so the soles touch the floor line. */
    feet() {
      this.heroes.forEach((hero) => {
        const src = hero.dataset.probe, look = Number(hero.dataset.index);
        const img = new Image(); img.crossOrigin = "anonymous"; img.decoding = "async";
        img.onload = () => {
          try {
            const w = 48, h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w));
            const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
            const g = cv.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h);
            const d = g.getImageData(0, 0, w, h).data;
            let last = -1;
            for (let y = h - 1; y >= 0 && last < 0; y--) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 40) { last = y; break; }
            if (last < 0) return;
            const foot = clamp((h - 1 - last) / h, 0, 0.4).toFixed(4);
            hero.style.setProperty("--rw-foot", foot);
            this.bodies.filter((b) => b.look === look).forEach((b) => b.el.style.setProperty("--rw-foot", foot));
          } catch { /* tainted canvas: keep offset 0 */ }
        };
        img.src = src;
      });
    }

    /* ---------------------------------------------------------- Measure */
    headerHeight() {
      let h = 0;
      document.querySelectorAll(".shopify-section-group-header-group, #shopify-section-header, #shopify-section-announcement-bar").forEach((el) => {
        if (el.contains(this)) return;
        const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
        if (cs.display !== "none" && cs.visibility !== "hidden") h += r.height;
      });
      return h;
    }
    measure() {
      const mobile = innerWidth <= 749;
      const mode = mobile ? (this.dataset.mstyle || "classic") : (this.dataset.style || "ring");
      if (mode !== this.mode) { if (!mobile) this.closeSheet(true); this.mode = mode; this.bodies.forEach((b) => { b.lastGoal = null; }); }
      this.mobile = mobile;
      let frameH;
      if (!mobile) frameH = Math.max(380, innerHeight - this.headerHeight());
      else {
        if (!this.vh || this.vw !== innerWidth || Math.abs(innerHeight - this.vh) >= 160) { this.vh = innerHeight; this.vw = innerWidth; }
        frameH = this.vh * clamp(Number(this.dataset.mheightVh) || 109, 50, 120) / 100;
      }
      this.style.setProperty("--rw-frame-h", `${Math.round(frameH)}px`);
      const r = this.stage.getBoundingClientRect();
      this.W = r.width; this.H = r.height;
      const ring = this.mode === "ring";
      this.fs = ring ? 1.08 : 1;
      this.modelH = ring ? Math.max(200, Math.round((this.H - 34 - 18) / 1.08)) : Math.max(200, Math.round(this.H - (mobile ? 24 : 36) - 18));
      this.stage.style.setProperty("--rw-model-h", `${this.modelH}px`);
      this.stage.style.setProperty("--rw-fs", String(this.fs));
      const hx = ring ? 0.5 * this.W : (mobile ? 0.3 : 0.4) * this.W, hy = ring ? 34 : (mobile ? 22 : 36);
      this.stage.style.setProperty("--rw-hx", `${hx}px`); this.stage.style.setProperty("--rw-hy", `${hy}px`);
      this.style.setProperty("--rw-ax", `${this.W ? ((hx / this.W) * 100).toFixed(2) : 40}%`);
      this.bodies.forEach((b) => { b.w = b.el.offsetWidth || this.modelH * 0.5625; });
      this.unit = ring ? Math.max(mobile ? 90 : 120, 0.3 * this.W) : Math.max(90, this.W * (mobile ? 0.32 : 0.125) * 1.6);
      if (this.zoomed) this.fitPopup();
      this.renderAll(); this.kick();
    }

    /* ---------------------------------------------------------- Render */
    put(s, x, bottom, scale, opacity, blur, z) {
      const half = (s.w * scale) / 2;
      if (x + half < -4 || x - half > this.W + 4) opacity = 0;
      const st = s.el.style;
      st.transform = `translate3d(${x.toFixed(2)}px,${(-bottom).toFixed(2)}px,0) translateX(-50%) scale(${scale.toFixed(4)})`;
      st.opacity = opacity.toFixed(3); st.zIndex = String(z);
      st.visibility = opacity < 0.01 ? "hidden" : "visible";
      st.pointerEvents = opacity < 0.5 ? "none" : "";
      const b = this.dataset.blur === "true" ? Math.round(blur * 10) / 10 : 0;
      if (b !== s.blur) { s.blur = b; st.filter = b > 0.05 ? `blur(${b}px)` : ""; }
    }
    renderAll() { if (!this.W) return; if (this.mode === "ring") this.renderRing(); else this.renderClassic(); }
    renderRing() {
      const W = this.W, H = this.H, m = this.mobile, cx = 0.5 * W, R = (m ? 0.72 : 0.62) * W, P = (m ? 1.9 : 1.65) * W;
      const floor = H - 34, horizon = 0.36 * H, step = (2 * Math.PI) / this.N;
      for (const s of this.bodies) {
        let phi = ((s.a - this.cur) * step) % (2 * Math.PI);
        if (phi > Math.PI) phi -= 2 * Math.PI; if (phi <= -Math.PI) phi += 2 * Math.PI;
        const z = R * (1 - Math.cos(phi)), persp = P / (P + z), sl = Math.abs(phi) / step;
        const scale = persp * (1 + (this.fs - 1) * clamp(1 - sl, 0, 1));
        const x = cx + R * Math.sin(phi) * persp;
        const feet = horizon + (floor - horizon) * persp;
        const blur = sl <= 1 ? 1.8 * sl : Math.min(1.8 + (sl - 1) * 2, 6.5);
        let op = clamp((Math.cos(phi) + 0.55) / 0.3, 0, 1);
        if (this.still && sl < 0.02) op = 0;
        this.put(s, x, H - feet, scale, op, blur, Math.round(scale * 1000));
      }
    }
    wrapN(v) { const N = this.N; return ((v % N) + N) % N; }
    renderClassic() {
      const W = this.W, m = this.mobile;
      const c = m ? { ax: 0.3, ay: 22, sx: 0.32, sy: 22, sr: 0.76, ex: 0.55, d: 4 } : { ax: 0.4, ay: 36, sx: 0.125, sy: 58, sr: 0.76, ex: 0.38, d: 5 };
      for (const s of this.bodies) {
        const goal = this.wrapN(s.a - this.target);
        let k = s.x, e = -1;
        if (s.trip) {
          const u = clamp(Math.abs(s.x - s.from) / (Math.abs(goal - s.from) || 1), 0, 1);
          if (goal > s.from) { if (u < 0.5) e = 2 * u * 1.4; else k = goal + 2 * (1 - u); }
          else { if (u < 0.5) k = s.from + 2 * u; else e = 2 * (1 - u) * 1.4; }
        } else if (k < 0) e = Math.min(-k, 1.4);
        if (e >= 0) {
          this.put(s, W * (c.ax - c.ex * e), c.ay - 22 * e, 1 + 0.14 * e, Math.max(0, 1 - 1.05 * e), 4 * Math.min(e, 1), 1100);
        } else {
          let op = k <= c.d - 1 ? 1 - 0.13 * k : Math.max(0, 0.61 * (c.d - k));
          if (this.still && Math.abs(k) < 0.02) op = 0;
          this.put(s, W * (c.ax + c.sx * k), c.ay + c.sy * k, Math.pow(c.sr, k), op, Math.min(0.9 * k, 3.2), 1000 - Math.round(10 * k));
        }
      }
    }

    /* ---------------------------------------------------------- Loop */
    kick() {
      if (this.rafId || !this.visible || document.hidden) return;
      this.lastT = 0;
      this.rafId = requestAnimationFrame((t) => this.frame(t));
    }
    frame(t) {
      this.rafId = 0;
      const dt = this.lastT ? Math.min(0.034, (t - this.lastT) / 1000) : 1 / 60;
      this.lastT = t;
      let settled;
      if (reduced()) {
        this.cur = this.target; this.vel = 0;
        for (const s of this.bodies) { const g = this.wrapN(s.a - this.target); s.x = s.g = g; s.v = 0; s.trip = false; s.lastGoal = g; }
        settled = !this.dragging;
      } else if (this.mode === "ring") {
        const h = dt / 3;
        for (let i = 0; i < 3; i++) { const acc = -this.K * (this.cur - this.target) - this.C * this.vel; this.vel += acc * h; this.cur += this.vel * h; }
        settled = Math.abs(this.cur - this.target) <= 0.0005 && Math.abs(this.vel) <= 0.0005;
        if (settled) { this.cur = this.target; this.vel = 0; }
      } else settled = this.stepClassic(dt);
      if (settled && !this.dragging) { if (!this.still) this.setStill(true); }
      else if (this.still) this.setStill(false);
      this.renderAll();
      if (!settled || this.dragging) this.kick();
    }
    stepClassic(dt) {
      let all = true;
      for (const s of this.bodies) {
        const goal = this.wrapN(s.a - this.target);
        if (s.lastGoal !== null && Math.abs(goal - s.lastGoal) > this.N / 2) { s.trip = true; s.from = s.x; }
        s.lastGoal = goal;
        const tau = this.dragging ? 0.016 : s.trip ? 0.1 : 0.03 + 0.04 * Math.min(goal, 4);
        s.g += (goal - s.g) * (1 - Math.exp(-dt / tau));
        const h = dt / 3;
        for (let i = 0; i < 3; i++) { const acc = -this.K * (s.x - s.g) - this.C * s.v; s.v += acc * h; s.x += s.v * h; }
        if (s.trip && Math.abs(s.x - goal) < 0.02) { s.trip = false; }
        const done = !s.trip && Math.abs(s.x - goal) <= 0.0006 && Math.abs(s.v) <= 0.0006;
        if (done) { s.x = s.g = goal; s.v = 0; } else all = false;
      }
      return all;
    }
    setStill(v) { this.still = v; this.classList.toggle("rw--still", v); }

    /* ---------------------------------------------------------- Index */
    rank(a) {
      if (this.mode === "ring") { let k = Math.round(a - this.target) % this.N; if (k > this.N / 2) k -= this.N; if (k < -this.N / 2) k += this.N; return k; }
      return this.wrapN(Math.round(a - this.target));
    }
    setIndex(i, silent = false) {
      const prev = this.index;
      this.index = i;
      const lim = this.mode === "ring" ? 2 : 3;
      for (const s of this.bodies) {
        const k = this.rank(s.a), on = k !== 0 && Math.abs(k) <= lim;
        const hit = s.el.querySelector(".rw__hit"); if (hit) hit.tabIndex = on ? 0 : -1;
        if (on) s.el.removeAttribute("aria-hidden"); else s.el.setAttribute("aria-hidden", "true");
      }
      this.kick();
      if (silent && i === prev && this._started) return;
      const first = !this._started; this._started = true;
      if (!first && i === prev) return;
      if (!first) { this.closePopup(); if (this.mobile) this.closeSheet(); }
      this.style.setProperty("--rw-progress", ((i + 1) / this.n).toFixed(3));
      this.heroes.forEach((h, j) => {
        h.classList.toggle("is-on", j === i); h.classList.toggle("was", j === prev && j !== i);
        if (j === i) h.removeAttribute("aria-hidden"); else h.setAttribute("aria-hidden", "true");
        const z = h.querySelector(".rw__zoom"); if (z) z.tabIndex = j === i ? 0 : -1;
      });
      if (!first && !reduced()) { this.stage.classList.remove("is-sweep"); void this.stage.offsetWidth; this.stage.classList.add("is-sweep"); }
      if (!first && this.live) this.live.textContent = this.heroes[i]?.dataset.label || "";
      this.ticks.forEach((t, j) => { t.setAttribute("aria-current", j === i ? "true" : "false"); t.classList.toggle("is-past", j < i); });
      this.panels.forEach((p, j) => { p.hidden = j !== i; if (!first) p.classList.remove("is-in"); });
      if (!first) { void this.panels[i].offsetWidth; this.panels[i].classList.add("is-in"); }
      if (this.piecesLabel) {
        this.piecesLabel.textContent = this.panels[i].querySelector("template[data-rw-pieces-text]")?.content.textContent.trim() || "";
        if (!first) { this.piecesLabel.classList.remove("is-swap"); void this.piecesLabel.offsetWidth; this.piecesLabel.classList.add("is-swap"); }
      }
      this.clearHot();
      this.restartBar();
    }
    moveTo(T) { this.target = T; this.setStill(false); this.setIndex(((T % this.n) + this.n) % this.n); this.kick(); }
    next() { this.moveTo(Math.round(this.target) + 1); }
    prev() { this.moveTo(Math.round(this.target) - 1); }
    go(i) { let d = (((i - this.index) % this.n) + this.n) % this.n; if (d > this.n / 2) d -= this.n; this.moveTo(Math.round(this.target) + d); }

    /* ---------------------------------------------------------- Autoplay */
    play(on) {
      this.playing = on;
      this.classList.toggle("is-playing", on);
      this.q("[data-rw-auto]")?.setAttribute("aria-pressed", on ? "true" : "false");
      this.restartBar();
    }
    restartBar() {
      clearTimeout(this.autoTimer);
      this.ticks.forEach((t) => t.classList.remove("is-run"));
      if (!this.playing) return;
      const t = this.ticks[this.index]; if (t) { void t.offsetWidth; t.classList.add("is-run"); }
      this.autoTimer = setTimeout(() => {
        if (this.playing && this.visible && !this.dragging && !document.hidden && !this.panelHover && !this.zoomed && !this.engaged) this.next();
        else this.restartBar();
      }, this.speed);
    }
    engage() { this.engaged = true; if (this.playing) this.play(false); }

    /* ---------------------------------------------------------- Observers */
    observe() {
      this.io = new IntersectionObserver((es) => { for (const e of es) { this.visible = e.isIntersecting; if (this.visible) this.kick(); } }, { threshold: 0 });
      this.io.observe(this);
      if (reduced()) this.classList.add("is-revealed");
      else {
        this.revealIo = new IntersectionObserver((es) => {
          if (es.some((e) => e.isIntersecting)) { this.revealIo.disconnect(); raf2(() => this.classList.add("is-revealed")); }
        }, { threshold: 0, rootMargin: "0px 0px -22% 0px" });
        this.revealIo.observe(this);
      }
      this.ro = new ResizeObserver(() => this.measure()); this.ro.observe(this.stage);
      this.on(window, "resize", () => { clearTimeout(this.resizeTimer); this.resizeTimer = setTimeout(() => this.measure(), 120); });
      this.on(document, "visibilitychange", () => { if (!document.hidden) { this.kick(); this.restartBar(); } });
    }

    /* ---------------------------------------------------------- Events */
    bindEvents() {
      const st = this.stage;
      this.on(st, "pointerdown", (e) => this.onDown(e));
      this.on(st, "pointermove", (e) => this.onMove(e));
      this.on(st, "pointerup", (e) => this.onUp(e));
      this.on(st, "pointercancel", (e) => this.onUp(e));
      this.on(st, "click", (e) => { if (performance.now() < (this.suppressUntil || 0)) { e.preventDefault(); e.stopPropagation(); } }, true);
      this.wheelAcc = 0; this.wheelLock = 0;
      this.on(st, "wheel", (e) => {
        if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
        e.preventDefault();
        if (performance.now() < this.wheelLock) return;
        this.wheelAcc += e.deltaX;
        if (Math.abs(this.wheelAcc) > 45) { if (this.wheelAcc > 0) this.next(); else this.prev(); this.wheelAcc = 0; this.wheelLock = performance.now() + 520; }
      }, { passive: false });
      this.on(st, "keydown", (e) => {
        if (e.target !== st) return;
        if (e.key === "ArrowRight") { e.preventDefault(); this.next(); } else if (e.key === "ArrowLeft") { e.preventDefault(); this.prev(); }
      });
      this.on(this, "keydown", (e) => { if (e.key === "Escape") this.onEscape(); });
      this.on(this, "click", (e) => this.onClick(e));
      this.on(this, "change", (e) => this.onChange(e));
      const panel = this.q(".rw__panel");
      this.on(panel, "pointerenter", (e) => { if (e.pointerType === "mouse") this.panelHover = true; });
      this.on(panel, "pointerleave", (e) => { if (e.pointerType === "mouse") { this.panelHover = false; this.restartBar(); } });
      this.on(panel, "click", (e) => { if (e.target.closest("button,a,input,select,label")) this.engage(); }, true);
      this.on(panel, "pointerover", (e) => { if (e.pointerType !== "mouse") return; const c = e.target.closest("[data-rw-card]"); if (c) this.hot(Number(c.dataset.rwCard)); });
      this.on(panel, "pointerout", (e) => { if (e.pointerType !== "mouse") return; const c = e.target.closest("[data-rw-card]"); if (c && !c.contains(e.relatedTarget)) this.clearHot(); });
      this.qa("[data-rw-picker]").forEach((p) => this.syncPicker(p, true));
    }
    onDown(e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      this.drag = { x: e.clientX, y: e.clientY, t: this.target, id: e.pointerId, samples: [{ x: e.clientX, time: performance.now() }], active: false, dead: false };
    }
    onMove(e) {
      const d = this.drag; if (!d || d.id !== e.pointerId || d.dead) return;
      if (e.pointerType === "mouse" && !(e.buttons & 1)) { this.onUp(e); return; }
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (!d.active) {
        if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { d.dead = true; return; }
        if (Math.abs(dx) > 8 && Math.abs(dx) > 1.2 * Math.abs(dy)) { d.active = true; this.dragging = true; this.classList.add("is-dragging"); try { this.stage.setPointerCapture(e.pointerId); } catch { /* ignore */ } this.setStill(false); }
        else return;
      }
      d.samples.push({ x: e.clientX, time: performance.now() }); if (d.samples.length > 6) d.samples.shift();
      this.target = d.t - dx / this.unit;
      this.kick();
    }
    onUp(e) {
      const d = this.drag; this.drag = null;
      if (!d || !d.active) return;
      this.dragging = false; this.classList.remove("is-dragging");
      try { this.stage.releasePointerCapture(d.id); } catch { /* ignore */ }
      const f = d.samples[0], l = d.samples[d.samples.length - 1];
      const vx = l.time > f.time ? (l.x - f.x) / (l.time - f.time) : 0;
      const dx = (e.clientX ?? l.x) - d.x, sign = -1, from = Math.round(d.t);
      if (this.mobile) {
        if (Math.abs(dx) > 30 || Math.abs(vx) > 0.3) this.moveTo(from + sign * (dx > 0 ? 1 : -1)); else this.moveTo(from);
      } else {
        let i = Math.round(this.target + (sign * vx * 160) / this.unit);
        if (i === from && Math.abs(vx) > 0.3) i = from + sign * Math.sign(vx);
        this.moveTo(clamp(i, from - 2, from + 2));
      }
      this.suppressUntil = performance.now() + 60;
    }
    onEscape() {
      if (this.openSheetCard) { const btn = this.openSheetCard.querySelector("[data-rw-add]"); this.closeSheet(); btn?.focus(); return; }
      if (this.zoomed) this.closePopup();
    }
    onClick(e) {
      const t = e.target;
      const c = (s) => t.closest(s);
      if (c("[data-rw-pick-close]")) { const card = this.cardOf(c("[data-rw-pick-close]")); this.closePicker(card); return; }
      if (c("[data-rw-zoom-close]")) { this.closePopup(); return; }
      if (this.zoomed && (t === this.lbStage || t === this.lb)) { this.closePopup(); return; }
      if (c("[data-rw-zoom]")) { this.openPopup(); return; }
      if (c("[data-rw-next]")) { this.next(); return; }
      if (c("[data-rw-prev]")) { this.prev(); return; }
      const tick = c("[data-rw-tick]"); if (tick) { this.go(Number(tick.dataset.rwTick)); return; }
      if (c("[data-rw-auto]")) { if (!this.playing) this.engaged = false; this.play(!this.playing); return; }
      const pin = c("[data-rw-pin]"); if (pin) { this.engage(); this.hot(Number(pin.dataset.rwPin), true); return; }
      const hit = c("[data-rw-go]");
      if (hit) {
        const s = this.bodies.find((b) => b.el.contains(hit)); const k = s ? this.rank(s.a) : 0;
        if (k !== 0 && Math.abs(k) < 6) this.moveTo(Math.round(this.target) + k); else this.openPopup();
        return;
      }
      const conf = c("[data-rw-confirm]"); if (conf) { this.confirm(this.cardOf(conf)); return; }
      const add = c("[data-rw-add]"); if (add) { this.togglePicker(this.cardOf(add)); return; }
      if (c("[data-rw-all]")) { this.addAll(); }
    }
    onChange(e) {
      const p = e.target.closest("[data-rw-picker]"); if (!p) return;
      this.engage(); this.syncPicker(p);
    }
    cardOf(el) {
      const card = el.closest("[data-rw-card]"); if (card) return card;
      const p = el.closest("[data-rw-picker]"); return p ? this.qa("[data-rw-card]").find((c) => c._picker === p) : null;
    }

    /* ---------------------------------------------------------- Hot linking */
    clearHot() { this.qa(".is-hot").forEach((el) => el.classList.remove("is-hot")); }
    hot(n, scroll = false) {
      this.clearHot();
      const scope = this.zoomed ? this.lbStage : this.heroes[this.index];
      scope?.querySelector(`[data-rw-pin="${n}"]`)?.classList.add("is-hot");
      const card = this.panels[this.index].querySelector(`[data-rw-card="${n}"]`);
      if (!card) return;
      card.classList.add("is-hot");
      if (scroll) this.reveal(card);
    }
    reveal(card) {
      const list = card.closest(".rw__items"), behavior = reduced() ? "auto" : "smooth";
      if (list && list.scrollWidth > list.clientWidth + 1) list.scrollTo({ left: card.getBoundingClientRect().left - list.getBoundingClientRect().left + list.scrollLeft - 20, behavior });
      else if (list && list.scrollHeight > list.clientHeight + 1) list.scrollTo({ top: card.offsetTop - list.offsetTop - 12, behavior });
      else { const r = card.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight - 140) window.scrollBy({ top: r.top - 0.3 * innerHeight, behavior }); }
    }

    /* ---------------------------------------------------------- Pickers */
    pickerOf(card) { return card._picker || card.querySelector("[data-rw-picker]"); }
    variantsOf(p) { try { return JSON.parse(p.querySelector("[data-rw-variants]").textContent); } catch { return []; } }
    syncPicker(p, initial = false) {
      const card = this.cardOf(p) || p.closest("[data-rw-card]");
      if (card && !card._picker) card._picker = p;
      const variants = this.variantsOf(p);
      const groups = [...p.querySelectorAll(".rw__opt")];
      const sel = groups.map((g) => g.querySelector("input:checked")?.value ?? null);
      const match = variants.find((v) => v.a && v.o.every((o, i) => o === sel[i]));
      groups.forEach((g, gi) => g.querySelectorAll(".rw__pill").forEach((pill) => {
        const val = pill.querySelector("input").value;
        const ok = variants.some((v) => v.a && v.o[gi] === val && v.o.every((o, j) => j === gi || o === sel[j]));
        pill.classList.toggle("is-unavailable", !ok);
      }));
      const btn = p.querySelector("[data-rw-confirm]"), label = p.querySelector("[data-rw-confirm-label]");
      if (btn) btn.disabled = !match;
      if (label) label.textContent = match ? label.dataset.add : (this.dataset.msgSoldout || "Sold out");
      if (card) { card.dataset.selected = match ? String(match.id) : ""; if (!initial) card.dataset.touched = "1"; }
    }
    togglePicker(card) {
      if (!card || card.classList.contains("is-added")) return;
      if (card.classList.contains("is-picking")) this.closePicker(card); else this.openPicker(card, true);
    }
    openPicker(card, focus) {
      const p = this.pickerOf(card); if (!p) return;
      if (this.mobile) { this.openSheet(card); }
      else { p.hidden = false; this.reveal(card); }
      card.classList.add("is-picking");
      card.querySelector("[data-rw-add]")?.setAttribute("aria-expanded", "true");
      if (focus) (p.querySelector("input:checked") || p.querySelector("input"))?.focus({ preventScroll: true });
    }
    closePicker(card) {
      if (!card) return;
      if (this.openSheetCard === card) { this.closeSheet(); return; }
      const p = this.pickerOf(card); if (p) p.hidden = true;
      card.classList.remove("is-picking");
      const add = card.querySelector("[data-rw-add]"); if (add && !card.classList.contains("is-added")) add.setAttribute("aria-expanded", "false");
    }
    async confirm(card) {
      if (!card || card.classList.contains("is-added") || card.classList.contains("is-loading")) return;
      card.dataset.touched = "1";
      const id = Number(card.dataset.selected); if (!id) return;
      const panel = card.closest("[data-rw-panel]"), msg = panel.querySelector("[data-rw-msg]");
      msg.textContent = "";
      card.classList.add("is-loading");
      try { await Bag.add([{ id, quantity: 1 }]); this.markAdded(card); this.checkComplete(panel); }
      catch { card.classList.remove("is-loading"); msg.textContent = this.dataset.msgError; }
    }
    markAdded(card) {
      card.classList.remove("is-loading");
      this.closePicker(card);
      card.classList.remove("is-picking"); card.classList.add("is-added");
      const add = card.querySelector("[data-rw-add]");
      if (add) { add.setAttribute("aria-label", add.dataset.addedLabel); add.removeAttribute("aria-expanded"); }
      if (this.mobile && !reduced() && navigator.vibrate) { try { navigator.vibrate(12); } catch { /* ignore */ } }
    }
    checkComplete(panel) {
      const cards = [...panel.querySelectorAll("[data-rw-card]")];
      if (cards.length >= 2 && cards.every((c) => c.classList.contains("is-added"))) { panel.classList.add("is-complete"); panel.querySelector("[data-rw-msg]").textContent = ""; }
    }
    async addAll() {
      const panel = this.panels[this.index], cta = panel.querySelector("[data-rw-all]"), msg = panel.querySelector("[data-rw-msg]");
      if (panel.classList.contains("is-complete") || cta.classList.contains("is-loading")) return;
      msg.textContent = "";
      const cards = [...panel.querySelectorAll("[data-rw-card]")].filter((c) => !c.classList.contains("is-added"));
      const ready = cards.filter((c) => c.dataset.variantId || (c.dataset.touched === "1" && Number(c.dataset.selected)));
      const pending = cards.filter((c) => !ready.includes(c));
      if (ready.length) {
        cta.classList.add("is-loading"); ready.forEach((c) => c.classList.add("is-loading"));
        try { await Bag.add(ready.map((c) => ({ id: Number(c.dataset.variantId || c.dataset.selected), quantity: 1 }))); ready.forEach((c) => this.markAdded(c)); }
        catch { ready.forEach((c) => c.classList.remove("is-loading")); msg.textContent = this.dataset.msgError; }
        cta.classList.remove("is-loading");
      }
      if (pending.length) {
        (this.mobile ? pending.slice(0, 1) : pending).forEach((c) => this.openPicker(c, false));
        this.reveal(pending[0]);
        msg.textContent = (this.dataset.msgChoose || "Pick a size for: [items]").replace("[items]", pending.map((c) => c.dataset.title).join(", "));
      }
      this.checkComplete(panel);
    }

    /* ---------------------------------------------------------- Phone size sheet */
    ensureHost() {
      if (this.sheetHost) return this.sheetHost;
      const host = document.createElement("div"); host.className = "rw-sheet-host";
      const scrim = document.createElement("button"); scrim.className = "rw__pick-scrim"; scrim.setAttribute("data-rw-pick-close", ""); scrim.tabIndex = -1; scrim.setAttribute("aria-hidden", "true");
      host.append(scrim);
      host.addEventListener("click", (e) => this.onClick(e));
      host.addEventListener("change", (e) => this.onChange(e));
      host.addEventListener("keydown", (e) => { if (e.key === "Escape") this.onEscape(); });
      document.body.append(host);
      this.sheetHost = host; return host;
    }
    openSheet(card) {
      if (this.openSheetCard && this.openSheetCard !== card) this.closeSheet();
      const host = this.ensureHost(), p = this.pickerOf(card);
      const cs = getComputedStyle(this);
      SHEET_VARS.forEach((v) => host.style.setProperty(v, cs.getPropertyValue(v)));
      host.style.fontFamily = cs.fontFamily; host.style.color = cs.color;
      card._picker = p; p._home = card;
      host.append(p); p.hidden = false;
      host.classList.add("is-open"); this.classList.add("rw--picking");
      this.openSheetCard = card;
    }
    closeSheet(all = false) {
      const card = this.openSheetCard;
      if (card) {
        const p = card._picker;
        p.hidden = true; card.append(p);
        card.classList.remove("is-picking");
        const add = card.querySelector("[data-rw-add]"); if (add && !card.classList.contains("is-added")) add.setAttribute("aria-expanded", "false");
      }
      this.openSheetCard = null;
      this.sheetHost?.classList.remove("is-open"); this.classList.remove("rw--picking");
      if (all) this.qa("[data-rw-card]").forEach((c) => { if (c._picker && c._picker.parentElement !== c) c.append(c._picker); });
    }

    /* ---------------------------------------------------------- View-look popup */
    openPopup() {
      if (this.zoomed) return;
      const hero = this.heroes[this.index]; if (!hero) return;
      this.engage(); this.clearHot();
      const wrap = document.createElement("div"); wrap.className = "rw__lb-model";
      const shadow = hero.querySelector(".rw__shadow").cloneNode(true);
      const fig = hero.querySelector(".rw__figure").cloneNode(true);
      fig.querySelector(".rw__zoom")?.remove();
      fig.querySelectorAll(".rw__pin").forEach((p) => { p.tabIndex = 0; });
      fig.querySelectorAll("img").forEach((im) => { im.loading = "eager"; im.classList.add("is-decoded"); });
      const foot = hero.style.getPropertyValue("--rw-foot"); if (foot) wrap.style.setProperty("--rw-foot", foot);
      wrap.append(shadow, fig);
      this.lbStage.replaceChildren(wrap);
      this.q("[data-rw-lb-kicker]").textContent = `${this.lb.dataset.word || "Look"} ${String(this.index + 1).padStart(2, "0")}`;
      this.q("[data-rw-lb-name]").textContent = hero.dataset.name || "";
      this.zoomed = true; this.fitPopup();
      this.classList.add("rw--zoom"); this.lb.setAttribute("aria-hidden", "false");
      if (!reduced()) {
        const a = hero.querySelector(".rw__figure").getBoundingClientRect(), b = fig.getBoundingClientRect();
        if (a.height && b.height) {
          wrap.style.transformOrigin = "0 100%"; wrap.style.transition = "none";
          wrap.style.transform = `translate3d(${a.left - b.left}px,${a.bottom - b.bottom}px,0) scale(${a.height / b.height})`;
          void wrap.offsetWidth; wrap.style.transition = ""; wrap.style.transform = "";
        }
      }
      this.q("[data-rw-zoom-close]").focus({ preventScroll: true });
    }
    fitPopup() {
      const wrap = this.lbStage.querySelector(".rw__lb-model"); if (!wrap) return;
      const r = this.lbStage.getBoundingClientRect();
      const h = Math.max(160, Math.min(r.height, r.width / 0.5625));
      wrap.style.setProperty("--rw-model-h", `${Math.round(h)}px`);
      wrap.querySelectorAll("img").forEach((im) => { im.sizes = `${Math.round(h * 0.5625)}px`; });
    }
    closePopup() {
      if (!this.zoomed) return;
      const wrap = this.lbStage.querySelector(".rw__lb-model"), hero = this.heroes[this.index];
      const hadFocus = this.lb.contains(document.activeElement);
      if (wrap && hero && !reduced()) {
        const fig = wrap.querySelector(".rw__figure"), a = hero.querySelector(".rw__figure").getBoundingClientRect(), b = fig.getBoundingClientRect();
        if (a.height && b.height) { wrap.style.transformOrigin = "0 100%"; wrap.style.transform = `translate3d(${a.left - b.left}px,${a.bottom - b.bottom}px,0) scale(${a.height / b.height})`; }
      }
      this.zoomed = false; this.classList.remove("rw--zoom"); this.lb.setAttribute("aria-hidden", "true");
      this.clearHot();
      this.later(() => { if (!this.zoomed) this.lbStage.replaceChildren(); }, 950);
      if (hadFocus) this.stage.focus({ preventScroll: true });
      this.restartBar();
    }

    /* ---------------------------------------------------------- Custom cursor */
    setupCursor() {
      const el = this.q("[data-rw-cursor]");
      if (!matchMedia("(hover: hover) and (pointer: fine)").matches) { el?.remove(); return; }
      this.classList.add("rw--cursor");
      const cur = { x: 0, y: 0, tx: 0, ty: 0, on: false };
      const tick = () => {
        const f = reduced() ? 1 : 0.18;
        cur.x += (cur.tx - cur.x) * f; cur.y += (cur.ty - cur.y) * f;
        el.style.transform = `translate3d(${cur.x}px,${cur.y}px,0)`;
        this.cursorRaf = Math.hypot(cur.tx - cur.x, cur.ty - cur.y) > 0.2 ? requestAnimationFrame(tick) : 0;
      };
      this.on(this.stage, "pointermove", (e) => {
        if (e.pointerType !== "mouse") return;
        const r = this.stage.getBoundingClientRect(); cur.tx = e.clientX - r.left; cur.ty = e.clientY - r.top;
        if (!cur.on) { cur.on = true; cur.x = cur.tx; cur.y = cur.ty; el.classList.add("is-on"); }
        const t = e.target;
        el.classList.toggle("is-view", !this.dragging && !!t.closest?.(".rw__hero.is-on .rw__zoom"));
        el.classList.toggle("is-link", !this.dragging && !!t.closest?.(".rw__pin, .rw__hit"));
        if (!this.cursorRaf) this.cursorRaf = requestAnimationFrame(tick);
      });
      this.on(this.stage, "pointerleave", () => { cur.on = false; el.classList.remove("is-on", "is-link", "is-view"); });
    }
  }

  initBagUi();
  if (!customElements.get("runway-section")) customElements.define("runway-section", RunwaySection);
})();
