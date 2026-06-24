# -*- coding: utf-8 -*-
"""
Genera la imagen de compartir (Open Graph) 1200x630 para previsualizaciones en
WhatsApp/redes: emblema dorado real + título sobre azul institucional.
Salida: argv[1] (carpeta) / og-image.png
"""
import sys, os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'assets', 'mentes-brillantes-logo-dorado.jpeg')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'assets')
os.makedirs(OUT, exist_ok=True)
FONTS = 'C:/Windows/Fonts'

W, H = 1200, 630
NAVY_TOP = (16, 42, 86)
NAVY_BOT = (7, 18, 40)
GOLD = (214, 181, 94)
CREAM = (244, 232, 191)
WHITE = (255, 255, 255)

def font(name, size):
    try:
        return ImageFont.truetype(os.path.join(FONTS, name), size)
    except Exception:
        return ImageFont.load_default()

def emblema():
    img = Image.open(SRC).convert('RGBA')
    w, h = img.size
    em = img.crop((0, 0, w, int(h * 0.62)))
    px = em.load()
    ew, eh = em.size
    for y in range(eh):
        for x in range(ew):
            r, g, b, a = px[x, y]
            mn = min(r, g, b); sat = max(r, g, b) - mn
            if mn > 210 and sat < 24:
                px[x, y] = (r, g, b, 0)
            elif mn > 175 and sat < 45:
                px[x, y] = (r, g, b, max(0, 255 - mn))
            else:
                px[x, y] = (r, g, b, 255)
    bb = em.getbbox()
    return em.crop(bb) if bb else em

# Fondo gradiente navy
bg = Image.new('RGBA', (W, H), (0, 0, 0, 255))
p = bg.load()
for y in range(H):
    t = y / (H - 1)
    c = (round(NAVY_TOP[0]+(NAVY_BOT[0]-NAVY_TOP[0])*t),
         round(NAVY_TOP[1]+(NAVY_BOT[1]-NAVY_TOP[1])*t),
         round(NAVY_TOP[2]+(NAVY_BOT[2]-NAVY_TOP[2])*t), 255)
    for x in range(W):
        p[x, y] = c
draw = ImageDraw.Draw(bg)

# Marco dorado sutil
draw.rectangle([18, 18, W-19, H-19], outline=GOLD, width=2)

# Emblema a la izquierda
em = emblema()
eh_target = 330
scale = eh_target / em.size[1]
em = em.resize((round(em.size[0]*scale), eh_target), Image.LANCZOS)
ex = 95
ey = (H - em.size[1]) // 2
bg.alpha_composite(em, (ex, ey))

# Línea divisoria vertical dorada
div_x = ex + em.size[0] + 70
draw.line([(div_x, 150), (div_x, H-150)], fill=GOLD, width=2)

# Texto a la derecha
tx = div_x + 55
f_kicker = font('seguisb.ttf', 30)
f_title = font('segoeuib.ttf', 92)
f_sub = font('segoeui.ttf', 40)
f_foot = font('seguisb.ttf', 28)

draw.text((tx, 150), 'GIMNASIO EMOCIONAL', font=f_kicker, fill=GOLD)
draw.text((tx, 195), 'Mentes', font=f_title, fill=WHITE)
draw.text((tx, 290), 'Brillantes', font=f_title, fill=CREAM)
draw.text((tx, 410), 'Gestor de Programación', font=f_sub, fill=(203, 213, 225))
draw.text((tx, 470), 'Calendario mensual de actividades · 2026', font=f_foot, fill=GOLD)

bg.convert('RGB').save(os.path.join(OUT, 'og-image.png'), quality=92)
print('[OK] og-image.png', (W, H), 'en', OUT)
