"""Build apps/web/public/runway/{index.html,runway.js} from data.py + styles.css + runway.src.js.
Usage: python3 tools/runway/generate.py <path to inter-600.woff2>"""
import base64, html, json, pathlib, sys
from data import A, SID, LOOKS, PRODUCTS, catalog

ROOT = pathlib.Path(__file__).resolve().parents[2]
HERE = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "apps/web/public/runway"
e = lambda s: html.escape(str(s), quote=True)
money = lambda n: f"${n:,.2f}"

ARROW_L = '<svg width="26" height="14" viewBox="0 0 26 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M25 7H1M7 1L1 7l6 6"/></svg>'
ARROW_R = '<svg width="26" height="14" viewBox="0 0 26 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 7h24M19 1l6 6-6 6"/></svg>'
PLUS = '<svg class="rw__i-plus" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><path d="M12 4v16M4 12h16"/></svg>'
CHECK = '<svg class="rw__i-check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12.5l5 5L19.5 7"/></svg>'
def spin(size, sw): return f'<svg class="rw__i-spin" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="{sw}" stroke-linecap="round" aria-hidden="true"><path d="M12 3a9 9 0 1 1-9 9"/></svg>'
CLOSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>'

def model_img(m, name):
    s640, s1080 = f"{A}model-{m}-640.webp", f"{A}original-look-{m}.webp"
    return (f'<img src="{s640}" srcset="{s640} 640w, {s1080} 1080w" sizes="(min-width: 1800px) 540px, (min-width: 750px) 420px, 320px" '
            f'loading="eager" decoding="async" width="1100" height="1956" draggable="false" data-model-image alt="{e(name)}">')

def body(i, name, m):
    return (f'<div class="rw__model" data-rw-model data-index="{i}" aria-hidden="true"><span class="rw__shadow"></span>'
            f'<div class="rw__figure" style="--rw-ar: 0.5625"><div class="rw__art">{model_img(m, name)}'
            f'<button class="rw__hit" data-rw-go="{i}" aria-label="Look {i+1}: {e(name)}" tabindex="-1"></button></div></div></div>')

def hero(i, name, m, pieces):
    pins = "".join(
        f'<button class="rw__pin" data-rw-pin="{n}" data-tip="{e(PRODUCTS[p][0])}" style="left:{l}%; top:{t}%; --pi:{n}" aria-label="{n}: {e(PRODUCTS[p][0])}" tabindex="-1"><span class="rw__pin-dot">{n}</span></button>'
        for n, (p, l, t, _) in enumerate(pieces, 1))
    return (f'<div class="rw__hero{" is-on" if i == 0 else ""}" data-rw-hero data-index="{i}" data-name="{e(name)}" data-label="Look {i+1}: {e(name)}" data-probe="{A}model-{m}-640.webp"'
            f'{'' if i == 0 else ' aria-hidden="true"'}><div class="rw__morph"><span class="rw__shadow"></span><div class="rw__figure" style="--rw-ar: 0.5625"><div class="rw__art">{model_img(m, name)}'
            f'<button class="rw__zoom" data-rw-zoom aria-label="View look: {e(name)}" tabindex="-1"></button><div class="rw__pins">{pins}</div></div></div></div></div>')

def item(key, n, pid, tag):
    name, vendor, price, legend, sizes, vids, img, h400, h160 = PRODUCTS[pid]
    url = f"https://nike-makknzjs.myshopify.com/products/{pid}"
    picker_id, opt = f"Picker-{SID}-look_{key}-{n}", f"Opt-{SID}-look_{key}-{n}-1"
    pills = "".join(f'<label class="rw__pill"><input type="radio" name="{opt}" value="{e(v)}" data-rw-option="0"{" checked" if k == 0 else ""}><span class="rw__pill-label">{e(v)}</span></label>' for k, v in enumerate(sizes))
    variants = json.dumps([{"id": vid, "a": True, "o": [o]} for vid, o in zip(vids, sizes)], separators=(",", ":"))
    tag_html = f'<span class="rw__tag"><span class="rw__tag-text">{e(tag)}</span></span>' if tag else ""
    return (f'<li class="rw__item" data-rw-card="{n}" style="--i:{n}" data-title="{e(name)}">{tag_html}'
            f'<a class="rw__media" href="{url}" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true"><img src="{A}{img}" loading="lazy" decoding="async" alt="" width="400" height="{h400}"><span class="rw__num">{n}</span></a>'
            f'<div class="rw__info"><span class="rw__type">{e(vendor)}</span><a class="rw__name" href="{url}" target="_blank" rel="noopener noreferrer">{e(name)}</a><span class="rw__price"><span>{money(price)}</span></span></div>'
            f'<button class="rw__add" data-rw-add aria-expanded="false" aria-controls="{picker_id}" aria-label="Add to bag: {e(name)}" data-added-label="Added to bag: {e(name)}">{PLUS}{CHECK}{spin(18, 1.5)}</button>'
            f'<div class="rw__picker" data-rw-picker id="{picker_id}" hidden>'
            f'<div class="rw__picker-head"><img src="{A}{img}" loading="lazy" decoding="async" alt="" width="160" height="{h160}"><div><span class="rw__picker-title">{e(name)}</span><span class="rw__picker-price">{money(price)}</span></div>'
            f'<button class="rw__pick-close" data-rw-pick-close aria-label="Close size picker">{CLOSE}</button></div>'
            f'<fieldset class="rw__opt"><legend class="rw__opt-name">{e(legend)}</legend><div class="rw__opt-values">{pills}</div></fieldset>'
            f'<button class="rw__confirm" data-rw-confirm><span data-rw-confirm-label data-add="Add to bag">Add to bag</span><span class="rw__sr"> — {e(name)}</span></button>'
            f'<script type="application/json" data-rw-variants>{variants}</script></div></li>')

def panel(i, key, name, pieces):
    items = "".join(item(key, n, p, tag) for n, (p, _, _, tag) in enumerate(pieces, 1))
    total = sum(PRODUCTS[p][2] for p, *_ in pieces)
    bundle = round(total * 0.9, 2)
    return (f'<div class="rw__look-panel{" is-in" if i == 0 else ""}" data-rw-panel="{i}"{"" if i == 0 else " hidden"}>'
            f'<div class="rw__mhead"><span class="rw__mhead-title">{e(name)}</span><span class="rw__label">3 pieces</span></div>'
            f'<ul class="rw__items" role="list">{items}</ul>'
            f'<div class="rw__bundle has-rule"><p class="rw__msg" data-rw-msg role="status" aria-live="polite"></p>'
            f'<div class="rw__bundle-row"><div class="rw__bundle-copy"><span class="rw__bundle-title">Complete the look</span><span class="rw__bundle-note">Bundle all 3 and save 10%</span></div>'
            f'<div class="rw__bundle-price"><s>{money(total)}</s><strong>{money(bundle)}</strong></div></div>'
            f'<button class="rw__cta" data-rw-all><span class="rw__cta-add">Add full look to bag</span><span class="rw__cta-m">Add full look — {money(bundle)}</span><span class="rw__cta-done">Full look in your bag</span>'
            f'<svg class="rw__i-arrow" width="22" height="12" viewBox="0 0 26 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 7h24M19 1l6 6-6 6"/></svg>{spin(16, 1.8)}</button></div>'
            f'<template data-rw-pieces-text>3 pieces</template></div>')

TOKENS = ("--rw-c-stage:#ffffff;--rw-c-panel:#ffffff;--rw-c-text:#151413;--rw-c-muted:#66625c;--rw-c-accent:#0e0e0e;--rw-c-on-accent:#ffffff;--rw-c-line:#c8c8c8;--rw-card:#DFDFDF;"
          "--rw-hf:var(--font-heading--family, inherit);--rw-hw:400;--rw-h-d:46px;--rw-h-m:24px;--rw-sub-d:12px;--rw-sub-m:12px;--rw-eyebrow-d:11px;--rw-eyebrow-m:10px;"
          "--rw-label-d:10px;--rw-label-m:9px;--rw-chip-d:17px;--rw-chip-m:18px;--rw-ph-d:18px;--rw-ph-m:16px;--rw-pt-size-d:13px;--rw-pt-size-m:12px;--rw-price-d:12px;--rw-price-m:12px;"
          "--rw-opt-d:11px;--rw-opt-m:11px;--rw-total-d:16px;--rw-total-m:16px;--rw-thumb-d:92px;--rw-thumb-m:62px;--rw-tag-top:18px;--rw-tag-left:0px;--rw-thumb-radius:0px;"
          "--rw-morph:900ms;--rw-bar-r:20px;--rw-panel-w:380px;--rw-panel-pad-d:32px;--rw-radius:0px;--rw-max:none;--rw-speed:5s;--rw-ax:40%;--rw-btn-radius:0px;--rw-pill-radius:30px;--rw-add-radius:20px")

def main():
    font = base64.b64encode(pathlib.Path(sys.argv[1]).read_bytes()).decode()
    css = (HERE / "styles.css").read_text().replace("__INTER__", f"data:font/woff2;base64,{font}")
    ticks = "".join(f'<button class="rw__tick" data-rw-tick="{i}" aria-current="{"true" if i == 0 else "false"}" aria-label="Look {i+1}: {e(n)}"><span class="rw__tick-bar"></span><span class="rw__tick-label">{i+1:02d}<span class="rw__tick-name">&nbsp;&nbsp;{e(n)}</span></span></button>' for i, (_, n, *_r) in enumerate(LOOKS))
    attrs = ('data-feel="balanced" data-blur="true" data-mblur="true" data-style="ring" data-mstyle="classic" data-fit="true" data-height-mode="original" data-height-vh="100" '
             'data-mheight-mode="custom" data-mheight-vh="109" data-reflect="false" data-autoplay="true" data-speed="5000" data-after-add="stay" data-bundle-code="" '
             'data-msg-choose="Pick a size for: [items]" data-msg-error="Couldn’t add to bag. Please try again." data-msg-soldout="Sold out"')
    page = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#ffffff">
<title>Try the Look — Runway</title>
<meta name="description" content="Six looks, styled head to toe. Explore the runway, isolate a look, and tap a pin to see the piece.">
<link rel="preload" as="image" href="{A}model-1-640.webp" fetchpriority="high">
<style>
{css}</style>
</head>
<body>
<header class="site-header shopify-section-group-header-group">
<a href="./" class="brand" aria-label="Runway home"><img src="{A}nike-logo.svg" width="68" height="24" alt="Nike"></a>
<nav aria-label="Main navigation"><a href="./">Home</a><a href="https://nike-makknzjs.myshopify.com/pages/nike-orbit" target="_blank" rel="noopener noreferrer">Nike Orbit</a><a href="https://nike-makknzjs.myshopify.com/pages/scene-rail" target="_blank" rel="noopener noreferrer">Hand Rail Pro</a><a href="./" aria-current="page">Runway</a></nav>
<button id="open-bag" aria-label="Open styling bag"><svg width="22" height="24" viewBox="0 0 24 26" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M4 8h16l1 16H3L4 8zM8 8V6a4 4 0 0 1 8 0v2"/></svg><span data-cart-count>0</span></button>
</header>
<main>
<runway-section id="Runway-{SID}" class="rw rw--add-icon rw--popup rw--list has-dividers has-border" {attrs} style="{TOKENS}">
<div class="rw__sticky"><div class="rw__grid">
<div class="rw__left">
<div class="rw__head"><div class="rw__intro"><h2 class="rw__title">Try the Look.</h2><p class="rw__sub">Six looks, styled head to toe. Tap a pin to see the piece.</p></div><span class="rw__sr" aria-live="polite" aria-atomic="true" data-rw-live></span></div>
<div class="rw__stage" data-rw-stage tabindex="0" role="region" aria-roledescription="carousel" aria-label="Try the Look. — use arrow keys or swipe to change look">
<div class="rw__actors" data-rw-actors>{"".join(body(i, n, m) for i, (_, n, m, *_r) in enumerate(LOOKS))}</div>
<div class="rw__heroes" data-rw-heroes>{"".join(hero(i, n, m, ps) for i, (_, n, m, _d, ps) in enumerate(LOOKS))}</div>
<span class="rw__sweep"></span>
<span class="rw__cursor" data-rw-cursor><span class="rw__cursor-in"><span class="rw__cursor-label rw__cursor-drag">Drag</span><span class="rw__cursor-label rw__cursor-view">View</span></span></span>
<span class="rw__walk"><span class="rw__walk-line"></span></span>
</div>
<div class="rw__controls">
<button class="rw__icon" data-rw-prev aria-label="Previous look">{ARROW_L}</button>
<div class="rw__ticks">{ticks}</div>
<button class="rw__icon rw__auto" data-rw-auto aria-pressed="false" aria-label="Autoplay"><svg class="rw__i-play" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg><svg class="rw__i-pause" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.5 4.5h3.5v15H6.5zM14 4.5h3.5v15H14z"/></svg></button>
<button class="rw__icon" data-rw-next aria-label="Next look">{ARROW_R}</button>
</div>
<div class="rw__lb" data-rw-lb data-word="Look" role="region" aria-label="View look" aria-hidden="true"><div class="rw__lb-stage" data-rw-lb-stage></div>
<div class="rw__lb-top"><p class="rw__lb-cap"><span class="rw__lb-kicker" data-rw-lb-kicker></span><span class="rw__lb-name" data-rw-lb-name></span></p><button class="rw__lb-close" data-rw-zoom-close aria-label="Close">{CLOSE}</button></div>
<p class="rw__lb-hint">Tap a dot to shop the piece</p></div>
</div>
<aside class="rw__panel has-rule"><div class="rw__panel-inner">
<div class="rw__panel-head"><h3 class="rw__panel-title">In this look</h3><span class="rw__label" data-rw-pieces></span></div>
{"".join(panel(i, k, n, ps) for i, (k, n, _m, _d, ps) in enumerate(LOOKS))}
</div></aside>
</div></div>
</runway-section>
</main>
<dialog id="bag-dialog" aria-labelledby="bag-title">
<div class="bag-heading"><h2 id="bag-title">Your styling bag</h2><button id="close-bag" aria-label="Close styling bag">×</button></div>
<p class="bag-note">A local outfit shortlist. No payment or order is collected here. Open a piece on the original demo to continue.</p>
<div id="bag-items"></div>
<p id="bag-total"></p>
<button id="export-bag">Download outfit shortlist</button>
</dialog>
<div id="bag-status" role="status" aria-live="polite"></div>
<script src="./runway.js" defer></script>
</body>
</html>
'''
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "index.html").write_text(page)
    js = (HERE / "runway.src.js").read_text().replace("__CATALOG__", json.dumps(catalog(), indent=1))
    (OUT / "runway.js").write_text(js)
    print("wrote", OUT / "index.html", len(page), "bytes;", OUT / "runway.js", len(js), "bytes")

if __name__ == "__main__":
    main()
