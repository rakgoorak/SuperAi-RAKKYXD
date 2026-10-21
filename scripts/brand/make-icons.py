"""Build app icons and in-app logo assets from the brand sheet (1254x1254 "SR" sheet).

Usage: python scripts/brand/make-icons.py <brand-sheet.webp|png>
Writes packages/desktop/assets/icon.{png,ico} and packages/studio/client/public/brand/*.png.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
sheet = Image.open(sys.argv[1]).convert("RGB")
if sheet.size != (1254, 1254):
    sheet = sheet.resize((1254, 1254), Image.LANCZOS)

BG = (2, 11, 18)  # sheet background behind the artwork
MARK_BOX = (300, 80, 960, 495)  # the large green "S" + white "R" with the blue orbit
WORD_BOX = (280, 500, 1000, 675)  # "SuperAi & RAKKYXD"


def keyed(img: Image.Image, feather: int = 28) -> Image.Image:
    """Remove the near-black background: alpha from distance to the background colour."""
    out = Image.new("RGBA", img.size)
    px, dst = img.load(), out.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b = px[x, y]
            d = max(abs(r - BG[0]), abs(g - BG[1]), abs(b - BG[2]))
            a = min(1.0, max(0.0, (d - 18) / 48))
            # Fade toward the crop edges so the logo's glow never ends in a hard rectangle.
            edge = min(x, y, img.width - 1 - x, img.height - 1 - y)
            a *= min(1.0, edge / feather)
            if a <= 0:
                dst[x, y] = (0, 0, 0, 0)
                continue
            # Un-blend the background so edges keep no dark fringe.
            c = [min(255, max(0, round((v - bv * (1 - a)) / a))) for v, bv in zip((r, g, b), BG)]
            dst[x, y] = (*c, round(a * 255))
    return out


def trimmed(img: Image.Image) -> Image.Image:
    return img.crop(img.getbbox())


mark = trimmed(keyed(sheet.crop(MARK_BOX)))
word = trimmed(keyed(sheet.crop(WORD_BOX), feather=6))


def tile(size: int, fill: float = 0.8) -> Image.Image:
    """Rounded near-black tile with a green-to-blue glow, like the sheet's default app icon."""
    s = size
    surface = Image.new("RGBA", (s, s))
    d = ImageDraw.Draw(surface)
    for y in range(s):
        t = y / (s - 1)
        d.line([(0, y), (s, y)], fill=(round(8 - 5 * t), round(22 - 11 * t), round(30 - 12 * t), 255))
    glow = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.ellipse((s * 0.02, s * 0.30, s * 0.62, s * 0.98), fill=(48, 244, 87, 46))  # green, lower left
    g.ellipse((s * 0.40, s * 0.05, s * 0.98, s * 0.70), fill=(0, 114, 251, 52))  # blue, upper right
    surface = Image.alpha_composite(surface, glow.filter(ImageFilter.GaussianBlur(s * 0.14)))
    m = mark.copy()
    scale = (s * fill) / max(m.size)
    m = m.resize((max(1, round(m.width * scale)), max(1, round(m.height * scale))), Image.LANCZOS)
    surface.alpha_composite(m, ((s - m.width) // 2, (s - m.height) // 2))
    radius = round(s * 0.225)
    mask = Image.new("L", (s * 4, s * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, s * 4 - 1, s * 4 - 1), radius * 4, fill=255)
    out = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    out.paste(surface, (0, 0), mask.resize((s, s), Image.LANCZOS))
    if s >= 48:  # thin rim: green at the lower left fading to blue at the upper right
        w = max(1, s // 170)
        green = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        ImageDraw.Draw(green).rounded_rectangle((w, w, s - 1 - w, s - 1 - w), radius, outline=(48, 244, 87, 120), width=w)
        blue = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        ImageDraw.Draw(blue).rounded_rectangle((w, w, s - 1 - w, s - 1 - w), radius, outline=(0, 114, 251, 140), width=w)
        fade = Image.linear_gradient("L").rotate(45).resize((s, s))
        out = Image.alpha_composite(out, Image.composite(green, blue, fade))
    return out


desktop = ROOT / "packages/desktop/assets"
public = ROOT / "packages/studio/client/public/brand"
desktop.mkdir(parents=True, exist_ok=True)
public.mkdir(parents=True, exist_ok=True)

tile(1024).save(desktop / "icon.png")
# Small sizes fill more of the tile so the letters stay legible.
frames = [tile(n, 0.92 if n <= 32 else 0.8) for n in (16, 24, 32, 48, 64, 128, 256)]
frames[-1].save(desktop / "icon.ico", sizes=[f.size for f in frames], append_images=frames[:-1])
tile(256).save(public / "app-icon.png")
tile(64).save(public / "favicon-64.png")
tile(32, 0.92).save(public / "favicon-32.png")
m = mark.copy()
m.thumbnail((320, 320), Image.LANCZOS)
m.save(public / "mark.png")
w = word.copy()
w.thumbnail((560, 560), Image.LANCZOS)
w.save(public / "wordmark.png")
# Installer artwork (NSIS): welcome/finish sidebar and page header, at 2x for high-DPI screens.
inst = ROOT / "installer/windows"
inst.mkdir(parents=True, exist_ok=True)
sw, sh = 328, 628
side = Image.new("RGBA", (sw, sh))
sd = ImageDraw.Draw(side)
for y in range(sh):
    t = y / (sh - 1)
    sd.line([(0, y), (sw, y)], fill=(round(8 - 6 * t), round(22 - 12 * t), round(32 - 14 * t), 255))
streaks = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))
st = ImageDraw.Draw(streaks)
st.polygon([(-40, 150), (60, 50), (90, 50), (-10, 150)], fill=(48, 244, 87, 120))  # green streak, top left
st.polygon([(sw - 90, sh - 40), (sw + 10, sh - 140), (sw + 40, sh - 140), (sw - 60, sh - 40)], fill=(0, 114, 251, 120))  # blue, bottom right
side = Image.alpha_composite(side, streaks.filter(ImageFilter.GaussianBlur(6)))
glow = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))
ImageDraw.Draw(glow).ellipse((20, 150, sw - 20, 380), fill=(0, 180, 150, 60))
side = Image.alpha_composite(side, glow.filter(ImageFilter.GaussianBlur(40)))
sm = mark.copy(); sm.thumbnail((sw - 56, 200), Image.LANCZOS)
side.alpha_composite(sm, ((sw - sm.width) // 2, 170))
swm = word.copy(); swm.thumbnail((sw - 70, 120), Image.LANCZOS)
side.alpha_composite(swm, ((sw - swm.width) // 2, 170 + sm.height + 28))
side.convert("RGB").save(inst / "sidebar.bmp")
hw, hh = 300, 114
head = Image.new("RGBA", (hw, hh), (255, 255, 255, 255))  # MUI page headers are white
hm = mark.copy(); hm.thumbnail((150, 86), Image.LANCZOS)
pad = Image.new("RGBA", (hm.width + 24, hm.height + 16), (10, 20, 28, 255))  # dark chip so the white "R" stays visible
mask = Image.new("L", pad.size, 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, pad.width - 1, pad.height - 1), 14, fill=255)
chip = Image.new("RGBA", pad.size, (0, 0, 0, 0)); chip.paste(pad, (0, 0), mask); chip.alpha_composite(hm, (12, 8))
head.alpha_composite(chip, (hw - chip.width - 14, (hh - chip.height) // 2))
head.convert("RGB").save(inst / "header.bmp")
print("mark", mark.size, "->", m.size, "| wordmark", word.size, "->", w.size)
