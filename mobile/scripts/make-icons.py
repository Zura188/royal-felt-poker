#!/usr/bin/env python3
"""Membuat ikon aplikasi Android (launcher) dan berkas splash dari nol.

Pemakaian:  python3 mobile/scripts/make-icons.py
Hasil:      mobile/assets/res/mipmap-*/(ic_launcher|ic_launcher_round|rf_icon_fg).png dan mobile/assets/splash.png
Butuh:      Pillow dan font DejaVu Sans Bold (untuk lambang sekop).
"""
import os
import sys
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'assets')
RES = os.path.join(OUT, 'res')
BG = (11, 61, 42)            # latar ikon adaptif (#0B3D2A), sama dengan rf_icon_bg di rf_colors.xml
SPLASH = (6, 23, 17)         # #061711
FELT_IN, FELT_OUT = (36, 156, 92), (10, 74, 46)
GOLD_HI, GOLD_LO = (255, 236, 150), (205, 148, 36)
FONTS = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
    'DejaVuSans-Bold.ttf',
]
M = 1024  # kanvas induk (di-downscale ke tiap ukuran)


def font(size):
    for f in FONTS:
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            continue
    sys.exit('Font DejaVu Sans Bold tidak ditemukan.')


def radial(size, c_in, c_out, cx=0.5, cy=0.38):
    """Gradasi radial sederhana (lebih terang di tengah-atas)."""
    img = Image.new('RGB', (size, size))
    px = img.load()
    maxd = (max(cx, 1 - cx) ** 2 + max(cy, 1 - cy) ** 2) ** 0.5 * size
    for y in range(size):
        for x in range(size):
            d = (((x - cx * size) ** 2 + (y - cy * size) ** 2) ** 0.5) / maxd
            t = min(1.0, d * 1.25)
            px[x, y] = tuple(int(c_in[i] + (c_out[i] - c_in[i]) * t) for i in range(3))
    return img


def vgrad(w, h, top, bottom):
    img = Image.new('RGB', (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        d.line([(0, y), (w, y)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return img


def art(with_bg, disc_ratio):
    """Gambar ikon di kanvas M x M: (latar) + piringan felt + cincin emas + sekop emas."""
    canvas = Image.new('RGBA', (M, M), BG + (255,) if with_bg else (0, 0, 0, 0))
    D = int(M * disc_ratio)
    x0 = (M - D) // 2
    y0 = (M - D) // 2
    # piringan felt
    felt = radial(D, FELT_IN, FELT_OUT).convert('RGBA')
    disc_mask = Image.new('L', (D, D), 0)
    ImageDraw.Draw(disc_mask).ellipse([0, 0, D - 1, D - 1], fill=255)
    # bayangan lembut di bawah piringan
    shadow = Image.new('RGBA', (M, M), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse([x0, y0 + int(D * 0.03), x0 + D, y0 + D + int(D * 0.03)], fill=(0, 0, 0, 120))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(D * 0.02)))
    canvas.paste(felt, (x0, y0), disc_mask)
    # cincin emas (luar tebal, dalam tipis)
    ring = Image.new('L', (M, M), 0)
    rd = ImageDraw.Draw(ring)
    w1 = max(2, int(D * 0.045))
    rd.ellipse([x0, y0, x0 + D - 1, y0 + D - 1], outline=255, width=w1)
    inset = int(D * 0.085)
    rd.ellipse([x0 + inset, y0 + inset, x0 + D - 1 - inset, y0 + D - 1 - inset], outline=255, width=max(1, int(D * 0.012)))
    gold = vgrad(M, M, GOLD_HI, GOLD_LO).convert('RGBA')
    canvas.paste(gold, (0, 0), ring)
    # sekop emas di tengah (bayangan dulu)
    f = font(int(D * 0.80))
    glyph = Image.new('L', (M, M), 0)
    ImageDraw.Draw(glyph).text((M // 2, int(M / 2 + D * 0.03)), '♠', font=f, fill=255, anchor='mm')
    sh = Image.new('RGBA', (M, M), (0, 0, 0, 0))
    sh.putalpha(glyph.point(lambda v: int(v * 0.55)))
    shifted = ImageChops.offset(sh, 0, int(D * 0.02))
    canvas.alpha_composite(shifted.filter(ImageFilter.GaussianBlur(D * 0.012)))
    spade_gold = vgrad(M, M, GOLD_HI, GOLD_LO).convert('RGBA')
    canvas.paste(spade_gold, (0, 0), glyph)
    return canvas


def mask_round(img, radius_ratio=None):
    s = img.size[0]
    m = Image.new('L', (s * 4, s * 4), 0)
    d = ImageDraw.Draw(m)
    if radius_ratio is None:
        d.ellipse([0, 0, s * 4 - 1, s * 4 - 1], fill=255)
    else:
        d.rounded_rectangle([0, 0, s * 4 - 1, s * 4 - 1], radius=int(s * 4 * radius_ratio), fill=255)
    m = m.resize((s, s), Image.LANCZOS)
    out = img.copy()
    out.putalpha(ImageChops.multiply(out.getchannel('A'), m))
    return out


def save(img, size, *parts):
    path = os.path.join(RES, *parts)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.resize((size, size), Image.LANCZOS).save(path, optimize=True)


def main():
    legacy = art(True, 0.80)           # ikon lama (tanpa topeng sistem)
    adaptive_fg = art(False, 0.58)     # lapisan depan ikon adaptif (zona aman 61%)
    legacy_sq = mask_round(legacy, 0.22)
    legacy_rd = mask_round(legacy, None)
    for dens, px, fg in [('mdpi', 48, 108), ('hdpi', 72, 162), ('xhdpi', 96, 216), ('xxhdpi', 144, 324), ('xxxhdpi', 192, 432)]:
        save(legacy_sq, px, f'mipmap-{dens}', 'ic_launcher.png')
        save(legacy_rd, px, f'mipmap-{dens}', 'ic_launcher_round.png')
        save(adaptive_fg, fg, f'mipmap-{dens}', 'rf_icon_fg.png')
    # splash: warna polos (jadi latar jendela saat aplikasi dibuka; diregangkan ke layar)
    Image.new('RGB', (64, 64), SPLASH).save(os.path.join(OUT, 'splash.png'), optimize=True)
    # pratinjau (tidak dipakai build)
    prev = Image.new('RGBA', (1180, 420), (40, 40, 48, 255))
    x = 20
    for img, sz in [(legacy_sq, 192), (legacy_rd, 192)]:
        prev.alpha_composite(img.resize((sz, sz), Image.LANCZOS), (x, 20)); x += sz + 20
    fg = adaptive_fg.resize((432, 432), Image.LANCZOS)
    bgc = Image.new('RGBA', (432, 432), BG + (255,))
    bgc.alpha_composite(fg)
    prev.alpha_composite(mask_round(bgc, None).resize((192, 192), Image.LANCZOS), (x, 20)); x += 212
    prev.alpha_composite(mask_round(bgc, 0.30).resize((192, 192), Image.LANCZOS), (x, 20)); x += 212
    prev.alpha_composite(legacy_sq.resize((96, 96), Image.LANCZOS), (20, 250)); prev.alpha_composite(legacy_sq.resize((48, 48), Image.LANCZOS), (140, 250))
    if len(sys.argv) > 1:
        prev.save(sys.argv[1])
    print('Ikon dibuat di', os.path.normpath(RES))


if __name__ == '__main__':
    main()
