"""Exact data for the 'Try the Look.' runway recreation (from the brief + native-catalog.json)."""
A = "https://reel-ref-try-the-look.vercel.app/assets/"
SID = "template--28035983671601__the_runway_wdM8BG"
SHOP = "https://nike-makknzjs.myshopify.com/products/"

SHOE = [str(s) for s in range(40, 47)]
APP = ["S", "L", "M", "XL"]

# id: (name, vendor, price, legend, sizes, variant ids, image, h400, h160)
PRODUCTS = {
    "tatum-5-orbit-copy": ("Air Jordan 12 Retro", "Nikey | Password: 1", 149, "Shoe size", SHOE,
        [57015167025457, 57015167058225, 57015167090993, 57015167123761, 57015167156529, 57015167189297, 57015167222065], "source-tatum-5-orbit-copy.webp", 400, 160),
    "tshirt": ("Tshirt", "Nike", 199, "Size", APP, [56835911582001, 56835911614769, 56835911647537, 56835911680305], "source-tshirt.webp", 563, 225),
    "sweatshirt": ("Sweatshirt", "Nike", 199, "Size", APP, [56835806396721, 56835806429489, 56835806462257, 56835806495025], "source-sweatshirt.webp", 581, 232),
    "tatum-5-orbit": ("Tatum 5 Orbit", "Nikey | Password: 1", 149, "Shoe size", SHOE,
        [57015166730545, 57015166763313, 57015166796081, 57015166828849, 57015166861617, 57015166894385, 57015166927153], "source-tatum-5-orbit.webp", 400, 160),
    "hoodie-black": ("Hoodie Black", "Nike", 199, "Size", APP, [56836251681073, 56836251713841, 56836251746609, 56836251779377], "source-hoodie-black.webp", 536, 214),
    "sweatshirt-plus": ("Sweatshirt Plus", "Nike", 199, "Size", APP, [56836143743281, 56836143776049, 56836143808817, 56836143841585], "source-sweatshirt-plus.webp", 610, 244),
    "hoodie": ("Hoodie", "Nike", 199, "Size", APP, [56836002185521, 56836002218289, 56836002251057, 56836002283825], "source-hoodie.webp", 555, 222),
    "air-jordan-12-retro-copy": ("Luka 5", "Nikey | Password: 1", 149, "Shoe size", SHOE,
        [57015176364337, 57015176397105, 57015176429873, 57015176462641, 57015176495409, 57015176528177, 57015176560945], "source-air-jordan-12-retro-copy.webp", 400, 160),
}

# (key, name, model file no., description, [(product id, pin left %, pin top %, tag)])
LOOKS = [
    ("bndthK", "The City Edit", 1, "A charcoal knit and easy denim.", [("tatum-5-orbit-copy", 47, 27, None), ("tshirt", 48, 58, None), ("sweatshirt", 45, 96, None)]),
    ("XckgG6", "Gallery Opening", 5, "A clean white tee and relaxed denim.", [("tatum-5-orbit", 50, 28, None), ("hoodie-black", 48, 58, "New"), ("tshirt", 45, 88, None)]),
    ("rLfAhC", "Gallery Opening", 4, "Olive knitwear. A grounded palette.", [("sweatshirt-plus", 50, 28, None), ("tatum-5-orbit", 48, 58, "New"), ("tshirt", 45, 88, None)]),
    ("FKg67q", "Studio Day", 6, "Black, white and laid-back denim.", [("hoodie-black", 50, 28, None), ("tatum-5-orbit-copy", 48, 58, None), ("tshirt", 45, 88, None)]),
    ("8KREEE", "Studio Day", 3, "Burgundy layers. A tailored perspective.", [("sweatshirt", 50, 28, None), ("tatum-5-orbit", 48, 58, None), ("tshirt", 45, 88, None)]),
    ("N3bfm9", "Studio Day", 2, "A grey crew and your favourite denim.", [("hoodie", 50, 28, None), ("air-jordan-12-retro-copy", 48, 58, None), ("tshirt", 45, 88, None)]),
]

def catalog():
    return {
        "source": "https://nike-makknzjs.myshopify.com/pages/runway",
        "looks": [{"name": n, "description": d, "image": f"{A}original-look-{m}.webp", "products": [p[0] for p in ps]} for _, n, m, d, ps in LOOKS],
        "items": [{"id": pid, "name": v[0], "type": "From the original lookbook", "price": float(v[2]), "image": A + v[6], "sizes": v[4],
                   "variants": [{"id": vid, "a": True, "o": [o]} for vid, o in zip(v[5], v[4])], "url": SHOP + pid} for pid, v in PRODUCTS.items()],
    }
