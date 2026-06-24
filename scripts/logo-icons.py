# -*- coding: utf-8 -*-
"""
Genera los iconos PWA a partir del logo REAL (emblema dorado) sobre fondo azul
institucional. Recorta el emblema (sin el texto), elimina el fondo blanco y lo
centra dentro de la zona segura para iconos maskable.
Salida: carpeta indicada por argv[1] (preview) con icon-512/192, apple-touch-icon, favicon-32.
"""
import sys, os
from PIL import Image

SRC = os.path.join(os.path.dirname(__file__), '..', 'assets', 'mentes-brillantes-logo-dorado.jpeg')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', 'assets')
os.makedirs(OUT, exist_ok=True)

NAVY_TOP = (18, 46, 96)
NAVY_BOT = (8, 21, 48)

def cargar_emblema():
    img = Image.open(SRC).convert('RGBA')
    w, h = img.size
    # Recortar al emblema (parte superior); el texto ocupa ~38% inferior.
    emblema = img.crop((0, 0, w, int(h * 0.62)))
    px = emblema.load()
    ew, eh = emblema.size
    # Fondo blanco/gris -> transparente; dorado (coloreado) -> 100% opaco y vivo.
    for y in range(eh):
        for x in range(ew):
            r, g, b, a = px[x, y]
            mn = min(r, g, b); mx = max(r, g, b); sat = mx - mn
            if mn > 210 and sat < 24:        # fondo casi-blanco / gris claro
                px[x, y] = (r, g, b, 0)
            elif mn > 175 and sat < 45:      # halo tenue del JPEG -> desvanecer
                px[x, y] = (r, g, b, max(0, 255 - mn))
            else:                            # dorado/oscuro = emblema -> opaco
                px[x, y] = (r, g, b, 255)
    # Recortar al contenido real (bbox del canal alfa).
    bbox = emblema.getbbox()
    if bbox:
        emblema = emblema.crop(bbox)
    return emblema

def gradiente_navy(size):
    bg = Image.new('RGBA', (size, size), (0, 0, 0, 255))
    p = bg.load()
    for y in range(size):
        t = y / (size - 1)
        c = (round(NAVY_TOP[0] + (NAVY_BOT[0]-NAVY_TOP[0])*t),
             round(NAVY_TOP[1] + (NAVY_BOT[1]-NAVY_TOP[1])*t),
             round(NAVY_TOP[2] + (NAVY_BOT[2]-NAVY_TOP[2])*t), 255)
        for x in range(size):
            p[x, y] = c
    return bg

def hacer_icono(emblema, size, cobertura=0.66):
    bg = gradiente_navy(size)
    ew, eh = emblema.size
    escala = (size * cobertura) / max(ew, eh)
    nw, nh = max(1, round(ew*escala)), max(1, round(eh*escala))
    em = emblema.resize((nw, nh), Image.LANCZOS)
    bg.alpha_composite(em, ((size-nw)//2, (size-nh)//2))
    return bg.convert('RGBA')

emblema = cargar_emblema()
print('emblema recortado:', emblema.size)
for nombre, size, cob in [('icon-512.png',512,0.60), ('icon-192.png',192,0.60),
                          ('apple-touch-icon.png',180,0.62), ('favicon-32.png',32,0.80)]:
    ico = hacer_icono(emblema, size, cob)
    ico.save(os.path.join(OUT, nombre))
    print('[OK]', nombre, size)
print('Listo en', OUT)
