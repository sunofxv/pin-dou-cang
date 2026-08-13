import json, csv
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(r"E:\workbuddy\拼豆豆仓\outputs\anime_girl_50x50_v1")
CELL = 20
LABEL = 36
BOMW = 320

grid = json.loads((OUT / "grid.json").read_text(encoding="utf-8"))
pal = {}
for row in csv.DictReader(open(r"C:\Users\木子\.workbuddy\skills\pindou-skill\palettes\mard_221.csv", encoding="utf-8")):
    pal[row["code"]] = row

W, H = grid["size"]
cells = grid["cells"]
bom = grid["bom"]

cw = LABEL + W * CELL + BOMW
ch = LABEL + H * CELL
img = Image.new("RGB", (cw, ch), "white")
d = ImageDraw.Draw(img)

try:
    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 14)
    cfont = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", max(8, int(CELL * 0.42)))
except Exception:
    font = ImageFont.load_default()
    cfont = font

def lum(hexs):
    h = hexs.lstrip("#")
    r, g, b = int(h[0:2],16), int(h[2:4],16), int(h[4:6],16)
    return (0.299*r + 0.587*g + 0.114*b) / 255.0

# cells + codes
for r in range(H):
    for c in range(W):
        code = cells[r][c]
        if code is None:
            continue
        p = pal[code]
        x = LABEL + c * CELL
        y = LABEL + r * CELL
        d.rectangle([x, y, x+CELL-1, y+CELL-1], fill=p["hex"])
        fill = "#000" if lum(p["hex"]) > 0.55 else "#fff"
        d.text((x + CELL/2, y + CELL/2), code, fill=fill, font=cfont, anchor="mm")

# grid lines
gcol = "#D0D0D0"
for c in range(W+1):
    x = LABEL + c*CELL
    d.line([x, LABEL, x, LABEL + H*CELL], fill=gcol, width=1)
for r in range(H+1):
    y = LABEL + r*CELL
    d.line([LABEL, y, LABEL + W*CELL, y], fill=gcol, width=1)

# col / row labels
for c in range(W):
    d.text((LABEL + c*CELL + CELL/2, LABEL - 8), str(c+1), fill="#444", font=font, anchor="mb")
for r in range(H):
    d.text((LABEL - 8, LABEL + r*CELL + CELL/2), str(r+1), fill="#444", font=font, anchor="rm")

# BOM panel
bx = LABEL + W*CELL + 20
ty = LABEL + 22 + 4
d.text((bx, ty), f"色号清单 (共 {len(bom)} 色 · {grid['bead_count']} 颗豆)", fill="#222", font=font)
lh = 30
sw = 24
for i, b in enumerate(bom):
    yy = ty + 26 + i*lh
    d.rectangle([bx, yy-sw+2, bx+sw, yy+2], fill=b["hex"], outline="#888")
    name = pal.get(b["code"], {}).get("name_zh", "")
    label = f"{b['code']}  ×{b['count']}" + (f"  · {name}" if name else "")
    d.text((bx + sw + 12, yy), label, fill="#222", font=font, anchor="lm")

img.save(OUT / "pattern_preview.png")
print("saved", OUT / "pattern_preview.png", img.size)
