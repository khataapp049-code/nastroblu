"""Build logo.png, nastroblu-logo.png, og-image.png from the circular badge."""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
BRAND = ASSETS / "brand"
DOWNLOAD = ROOT / "logo-download"
SRC = Path(
    r"C:\Users\kavya\.cursor\projects\c-Users-kavya-Downloads-nastroblu-20260905T054707Z-1-001"
    r"\assets\c__Users_kavya_AppData_Roaming_Cursor_User_workspaceStorage_"
    r"0e8c17da2d9954eec2b6a718eb804fc6_images_image-67ea8a22-f1f1-44f8-9fdb-1398308e58c4.png"
)


def is_backdrop(r: int, g: int, b: int) -> bool:
    if r < 55 and g < 55 and b < 55:
        return True
    if abs(r - 212) < 16 and abs(g - 212) < 16 and abs(b - 212) < 16:
        return True
    if abs(r - 176) < 22 and abs(g - 179) < 22 and abs(b - 180) < 22:
        return True
    return False


def extract_circle(src: Path) -> Image.Image:
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    pix = im.load()
    xs, ys = [], []
    for y in range(h):
        for x in range(w):
            r, g, b, _a = pix[x, y]
            if not is_backdrop(r, g, b):
                xs.append(x)
                ys.append(y)
    if not xs:
        raise SystemExit("Could not find the logo circle in the source image.")
    minx, maxx = min(xs), max(xs)
    miny, maxy = min(ys), max(ys)
    cx = (minx + maxx) / 2.0
    cy = (miny + maxy) / 2.0
    radius = min(maxx - minx, maxy - miny) / 2.0 * 0.995
    pad = 8
    left = max(0, int(math.floor(cx - radius - pad)))
    top = max(0, int(math.floor(cy - radius - pad)))
    right = min(w, int(math.ceil(cx + radius + pad)))
    bottom = min(h, int(math.ceil(cy + radius + pad)))
    crop = im.crop((left, top, right, bottom))
    cw, ch = crop.size
    lcx = cx - left
    lcy = cy - top
    mask = Image.new("L", (cw, ch), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse(
        (lcx - radius, lcy - radius, lcx + radius, lcy + radius),
        fill=255,
    )
    mask = mask.filter(ImageFilter.GaussianBlur(0.6))
    out = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    out.paste(crop, (0, 0))
    out.putalpha(mask)
    # Tight square around the circle
    box = (
        int(max(0, lcx - radius)),
        int(max(0, lcy - radius)),
        int(min(cw, lcx + radius + 1)),
        int(min(ch, lcy + radius + 1)),
    )
    return out.crop(box)


def fit_square(im: Image.Image, size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    im = im.convert("RGBA")
    im.thumbnail((size, size), Image.Resampling.LANCZOS)
    x = (size - im.width) // 2
    y = (size - im.height) // 2
    canvas.paste(im, (x, y), im)
    return canvas


def font(path: str, size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def make_og(badge: Image.Image) -> Image.Image:
    W, H = 1200, 630
    bg = (246, 240, 228, 255)
    wine = (74, 20, 32, 255)
    ink = (91, 83, 70, 255)
    img = Image.new("RGBA", (W, H), bg)
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, W, 14), fill=wine)
    draw.rectangle((0, H - 14, W, H), fill=wine)

    mark = fit_square(badge, 470)
    img.paste(mark, (70, (H - mark.height) // 2), mark)

    title = font(r"C:\Windows\Fonts\georgia.ttf", 72)
    sub = font(r"C:\Windows\Fonts\calibri.ttf", 32)
    tiny = font(r"C:\Windows\Fonts\calibri.ttf", 24)
    tx = 580
    draw.text((tx, 210), "Nastro Blu", font=title, fill=wine)
    draw.text((tx, 300), "Hyderabad  |  Naturally grown", font=sub, fill=ink)
    draw.text((tx, 350), "Eat better.", font=sub, fill=ink)
    draw.text((tx, 430), "nastroblu.in", font=tiny, fill=wine)
    return img.convert("RGB")


def save_png(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "PNG", optimize=True)
    print(f"saved {path}  {im.size} {im.mode}")


def main() -> None:
    badge = extract_circle(SRC)
    logo = fit_square(badge, 512)
    og = make_og(badge)

    save_png(logo, ASSETS / "logo.png")
    save_png(logo, BRAND / "nastroblu-logo.png")
    og.save(ASSETS / "og-image.png", "PNG", optimize=True)
    print(f"saved {ASSETS / 'og-image.png'}  {og.size} {og.mode}")

    DOWNLOAD.mkdir(parents=True, exist_ok=True)
    save_png(logo, DOWNLOAD / "logo.png")
    save_png(logo, DOWNLOAD / "nastroblu-logo.png")
    og.save(DOWNLOAD / "og-image.png", "PNG", optimize=True)
    print(f"saved {DOWNLOAD / 'og-image.png'}")

    desktop = Path.home() / "Desktop" / "nastroblu-logos"
    desktop.mkdir(parents=True, exist_ok=True)
    save_png(logo, desktop / "logo.png")
    save_png(logo, desktop / "nastroblu-logo.png")
    og.save(desktop / "og-image.png", "PNG", optimize=True)
    print(f"also copied to {desktop}")


if __name__ == "__main__":
    main()
