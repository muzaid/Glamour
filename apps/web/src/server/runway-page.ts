import "server-only";
import type { Money, RunwayFeedLook, RunwayFeedPiece } from "@glamotion/contracts";

/**
 * Server-rendered "Try the Look." runway. Markup and class hooks match
 * public/runway/runway.{css,js}; every look, product, size and price comes
 * from the live catalog (runwayFeed), never from the client.
 */
const e = (s: unknown) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const money = (m: Money) => new Intl.NumberFormat("en-US", { style: "currency", currency: m.currency }).format(m.amountMinor / 100);
const jsonForScript = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
const plural = (n: number) => `${n} piece${n === 1 ? "" : "s"}`;
const NUM_WORDS = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];

const ARROW_L = '<svg width="26" height="14" viewBox="0 0 26 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M25 7H1M7 1L1 7l6 6"/></svg>';
const ARROW_R = '<svg width="26" height="14" viewBox="0 0 26 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 7h24M19 1l6 6-6 6"/></svg>';
const PLUS = '<svg class="rw__i-plus" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><path d="M12 4v16M4 12h16"/></svg>';
const CHECK = '<svg class="rw__i-check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12.5l5 5L19.5 7"/></svg>';
const spin = (size: number, sw: number) => `<svg class="rw__i-spin" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" aria-hidden="true"><path d="M12 3a9 9 0 1 1-9 9"/></svg>`;
const CLOSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>';
const BAG = '<svg width="22" height="24" viewBox="0 0 24 26" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M4 8h16l1 16H3L4 8zM8 8V6a4 4 0 0 1 8 0v2"/></svg>';

function modelImg(l: RunwayFeedLook, eager: boolean) {
  const srcset = l.imageLargeUrl ? ` srcset="${e(l.imageUrl)} 640w, ${e(l.imageLargeUrl)} 1080w" sizes="(min-width: 1800px) 540px, (min-width: 750px) 420px, 320px"` : "";
  return `<img src="${e(l.imageUrl)}"${srcset} loading="${eager ? "eager" : "lazy"}" decoding="async" width="1100" height="1956" draggable="false" data-model-image alt="${e(l.name)}">`;
}

const body = (l: RunwayFeedLook, i: number) =>
  `<div class="rw__model" data-rw-model data-index="${i}" aria-hidden="true"><span class="rw__shadow"></span>` +
  `<div class="rw__figure" style="--rw-ar: 0.5625"><div class="rw__art">${modelImg(l, i < 4)}` +
  `<button class="rw__hit" data-rw-go="${i}" aria-label="Look ${i + 1}: ${e(l.name)}" tabindex="-1"></button></div></div></div>`;

function hero(l: RunwayFeedLook, i: number) {
  const pins = l.pieces.map((p) =>
    `<button class="rw__pin" data-rw-pin="${p.n}" data-tip="${e(p.title)}" style="left:${p.left}%; top:${p.top}%; --pi:${p.n}" aria-label="${p.n}: ${e(p.title)}" tabindex="-1"><span class="rw__pin-dot">${p.n}</span></button>`).join("");
  return `<div class="rw__hero${i === 0 ? " is-on" : ""}" data-rw-hero data-index="${i}" data-name="${e(l.name)}" data-label="Look ${i + 1}: ${e(l.name)}" data-probe="${e(l.imageUrl)}"${i === 0 ? "" : ' aria-hidden="true"'}>` +
    `<div class="rw__morph"><span class="rw__shadow"></span><div class="rw__figure" style="--rw-ar: 0.5625"><div class="rw__art">${modelImg(l, i < 2)}` +
    `<button class="rw__zoom" data-rw-zoom aria-label="View look: ${e(l.name)}" tabindex="-1"></button><div class="rw__pins">${pins}</div></div></div></div></div>`;
}

function item(l: RunwayFeedLook, p: RunwayFeedPiece) {
  const url = `/shop/${encodeURIComponent(p.slug)}`;
  const pickerId = `Picker-${l.id}-${p.n}`, opt = `Opt-${l.id}-${p.n}`;
  const firstOk = Math.max(0, p.variants.findIndex((v) => v.available));
  const pills = p.variants.map((v, k) =>
    `<label class="rw__pill${v.available ? "" : " is-unavailable"}"><input type="radio" name="${opt}" value="${e(v.label)}" data-rw-option="0"${k === firstOk ? " checked" : ""}><span class="rw__pill-label">${e(v.label)}</span></label>`).join("");
  const variants = p.variants.map((v) => ({ id: v.id, a: v.available, o: [v.label] }));
  const media = (w: number) => p.imageUrl ? `<img src="${e(p.imageUrl)}" loading="lazy" decoding="async" alt="" width="${w}" height="${Math.round(w * 1.4)}">` : '<span class="rw__media-ph"></span>';
  const tag = p.tag ? `<span class="rw__tag"><span class="rw__tag-text">${e(p.tag)}</span></span>` : "";
  return `<li class="rw__item" data-rw-card="${p.n}" style="--i:${p.n}" data-title="${e(p.title)}">${tag}` +
    `<a class="rw__media" href="${url}" tabindex="-1" aria-hidden="true">${media(400)}<span class="rw__num">${p.n}</span></a>` +
    `<div class="rw__info"><span class="rw__type">${e(p.brandName)}</span><a class="rw__name" href="${url}">${e(p.title)}</a><span class="rw__price"><span>${money(p.price)}</span></span></div>` +
    `<button class="rw__add" data-rw-add aria-expanded="false" aria-controls="${pickerId}" aria-label="Add to bag: ${e(p.title)}" data-added-label="Added to bag: ${e(p.title)}">${PLUS}${CHECK}${spin(18, 1.5)}</button>` +
    `<div class="rw__picker" data-rw-picker id="${pickerId}" hidden>` +
    `<div class="rw__picker-head">${media(160)}<div><span class="rw__picker-title">${e(p.title)}</span><span class="rw__picker-price">${money(p.price)}</span></div>` +
    `<button class="rw__pick-close" data-rw-pick-close aria-label="Close size picker">${CLOSE}</button></div>` +
    `<fieldset class="rw__opt"><legend class="rw__opt-name">${e(p.optionName)}</legend><div class="rw__opt-values">${pills}</div></fieldset>` +
    `<button class="rw__confirm" data-rw-confirm><span data-rw-confirm-label data-add="Add to bag">Add to bag</span><span class="rw__sr"> — ${e(p.title)}</span></button>` +
    `<script type="application/json" data-rw-variants>${jsonForScript(variants)}</script></div></li>`;
}

function panel(l: RunwayFeedLook, i: number) {
  const currencies = new Set(l.pieces.map((p) => p.price.currency));
  const total = currencies.size === 1 ? money({ amountMinor: l.pieces.reduce((s, p) => s + p.price.amountMinor, 0), currency: l.pieces[0]!.price.currency }) : null;
  const count = plural(l.pieces.length);
  return `<div class="rw__look-panel${i === 0 ? " is-in" : ""}" data-rw-panel="${i}"${i === 0 ? "" : " hidden"}>` +
    `<div class="rw__mhead"><span class="rw__mhead-title">${e(l.name)}</span><span class="rw__label">${count}</span></div>` +
    `<ul class="rw__items" role="list">${l.pieces.map((p) => item(l, p)).join("")}</ul>` +
    `<div class="rw__bundle has-rule"><p class="rw__msg" data-rw-msg role="status" aria-live="polite"></p>` +
    `<div class="rw__bundle-row"><div class="rw__bundle-copy"><span class="rw__bundle-title">Complete the look</span><span class="rw__bundle-note">${l.pieces.length > 1 ? `All ${l.pieces.length} pieces, from` : "From"}</span></div>` +
    `<div class="rw__bundle-price">${total ? `<strong>${total}</strong>` : ""}</div></div>` +
    `<button class="rw__cta" data-rw-all><span class="rw__cta-add">Add full look to bag</span><span class="rw__cta-m">Add full look${total ? ` — ${total}` : ""}</span><span class="rw__cta-done">Full look in your bag</span>` +
    `<svg class="rw__i-arrow" width="22" height="12" viewBox="0 0 26 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 7h24M19 1l6 6-6 6"/></svg>${spin(16, 1.8)}</button></div>` +
    `<template data-rw-pieces-text>${count}</template></div>`;
}

const TOKENS = "--rw-c-stage:#ffffff;--rw-c-panel:#ffffff;--rw-c-text:#151413;--rw-c-muted:#66625c;--rw-c-accent:#0e0e0e;--rw-c-on-accent:#ffffff;--rw-c-line:#c8c8c8;--rw-card:#DFDFDF;" +
  "--rw-hf:var(--font-heading--family, inherit);--rw-hw:400;--rw-h-d:46px;--rw-h-m:24px;--rw-sub-d:12px;--rw-sub-m:12px;--rw-eyebrow-d:11px;--rw-eyebrow-m:10px;" +
  "--rw-label-d:10px;--rw-label-m:9px;--rw-chip-d:17px;--rw-chip-m:18px;--rw-ph-d:18px;--rw-ph-m:16px;--rw-pt-size-d:13px;--rw-pt-size-m:12px;--rw-price-d:12px;--rw-price-m:12px;" +
  "--rw-opt-d:11px;--rw-opt-m:11px;--rw-total-d:16px;--rw-total-m:16px;--rw-thumb-d:92px;--rw-thumb-m:62px;--rw-tag-top:18px;--rw-tag-left:0px;--rw-thumb-radius:0px;" +
  "--rw-morph:900ms;--rw-bar-r:20px;--rw-panel-w:380px;--rw-panel-pad-d:32px;--rw-radius:0px;--rw-max:none;--rw-speed:5s;--rw-ax:40%;--rw-btn-radius:0px;--rw-pill-radius:30px;--rw-add-radius:20px";

const ATTRS = 'data-feel="balanced" data-blur="true" data-mblur="true" data-style="ring" data-mstyle="classic" data-fit="true" data-height-mode="original" data-height-vh="100" ' +
  'data-mheight-mode="custom" data-mheight-vh="109" data-reflect="false" data-autoplay="true" data-speed="5000" data-after-add="stay" ' +
  'data-msg-choose="Pick a size for: [items]" data-msg-error="Couldn’t add to bag. Please try again." data-msg-soldout="Sold out" data-msg-signin="Sign in to add pieces to your bag."';

export function renderRunwayPage(looks: RunwayFeedLook[], viewer: { signedIn: boolean; bagCount: number }): string {
  const n = looks.length;
  const sub = `${NUM_WORDS[n] ?? n} look${n === 1 ? "" : "s"}, styled head to toe. Tap a pin to see the piece.`;
  const header = `<header class="site-header shopify-section-group-header-group">
<a href="/" class="brand" aria-label="GLAMOTION home">GLAM<span>O</span>TION</a>
<nav aria-label="Main navigation"><a href="/shop">Shop</a><a href="/try-on">Try-on</a><a href="/runway" aria-current="page">Runway</a></nav>
<a id="open-bag" href="/cart" aria-label="Open bag">${BAG}<span data-cart-count>${viewer.bagCount}</span></a>
</header>`;
  const section = n === 0
    ? `<section class="rw-empty"><div><h1>Try the Look.</h1><p>New looks are on their way. Check back soon.</p></div></section>`
    : `<runway-section id="Runway" class="rw rw--add-icon rw--popup rw--list has-dividers has-border" data-signed-in="${viewer.signedIn}" ${ATTRS} style="${TOKENS}">
<div class="rw__sticky"><div class="rw__grid">
<div class="rw__left">
<div class="rw__head"><div class="rw__intro"><h2 class="rw__title">Try the Look.</h2><p class="rw__sub">${e(sub)}</p></div><span class="rw__sr" aria-live="polite" aria-atomic="true" data-rw-live></span></div>
<div class="rw__stage" data-rw-stage tabindex="0" role="region" aria-roledescription="carousel" aria-label="Try the Look. — use arrow keys or swipe to change look">
<div class="rw__actors" data-rw-actors>${looks.map(body).join("")}</div>
<div class="rw__heroes" data-rw-heroes>${looks.map(hero).join("")}</div>
<span class="rw__sweep"></span>
<span class="rw__cursor" data-rw-cursor><span class="rw__cursor-in"><span class="rw__cursor-label rw__cursor-drag">Drag</span><span class="rw__cursor-label rw__cursor-view">View</span></span></span>
<span class="rw__walk"><span class="rw__walk-line"></span></span>
</div>
<div class="rw__controls">
<button class="rw__icon" data-rw-prev aria-label="Previous look">${ARROW_L}</button>
<div class="rw__ticks">${looks.map((l, i) => `<button class="rw__tick" data-rw-tick="${i}" aria-current="${i === 0}" aria-label="Look ${i + 1}: ${e(l.name)}"><span class="rw__tick-bar"></span><span class="rw__tick-label">${String(i + 1).padStart(2, "0")}<span class="rw__tick-name">&nbsp;&nbsp;${e(l.name)}</span></span></button>`).join("")}</div>
<button class="rw__icon rw__auto" data-rw-auto aria-pressed="false" aria-label="Autoplay"><svg class="rw__i-play" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg><svg class="rw__i-pause" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.5 4.5h3.5v15H6.5zM14 4.5h3.5v15H14z"/></svg></button>
<button class="rw__icon" data-rw-next aria-label="Next look">${ARROW_R}</button>
</div>
<div class="rw__lb" data-rw-lb data-word="Look" role="region" aria-label="View look" aria-hidden="true"><div class="rw__lb-stage" data-rw-lb-stage></div>
<div class="rw__lb-top"><p class="rw__lb-cap"><span class="rw__lb-kicker" data-rw-lb-kicker></span><span class="rw__lb-name" data-rw-lb-name></span></p><button class="rw__lb-close" data-rw-zoom-close aria-label="Close">${CLOSE}</button></div>
<p class="rw__lb-hint">Tap a dot to shop the piece</p></div>
</div>
<aside class="rw__panel has-rule"><div class="rw__panel-inner">
<div class="rw__panel-head"><h3 class="rw__panel-title">In this look</h3><span class="rw__label" data-rw-pieces></span></div>
${looks.map(panel).join("\n")}
</div></aside>
</div></div>
</runway-section>`;
  const preload = n ? `<link rel="preload" as="image" href="${e(looks[0]!.imageUrl)}" fetchpriority="high">` : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#ffffff">
<title>Try the Look — Runway · GLAMOTION</title>
<meta name="description" content="${e(sub)}">
<link rel="preload" as="font" type="font/woff2" href="/runway/inter-600.woff2" crossorigin>
${preload}
<link rel="stylesheet" href="/runway/runway.css">
</head>
<body>
${header}
<main>
${section}
</main>
<div id="bag-status" role="status" aria-live="polite"></div>
<script src="/runway/runway.js" defer></script>
</body>
</html>
`;
}
