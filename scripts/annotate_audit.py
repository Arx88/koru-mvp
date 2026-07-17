#!/usr/bin/env python3
"""
Annotate Koru chat app screenshots to highlight visual overlap bugs.
"""
from PIL import Image, ImageDraw, ImageFont
import os

OUT_DIR = "/home/z/my-project/download/screenshots/annotated"
os.makedirs(OUT_DIR, exist_ok=True)

def load_font(size):
    for path in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    ]:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()

def annotate(path, out_name, regions, label_lines):
    img = Image.open(path).convert("RGBA")
    W, H = img.size
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    font_big = load_font(max(20, W // 40))
    font_small = load_font(max(14, W // 60))

    for r in regions:
        x1, y1, x2, y2 = r["box"]
        color = r["color"]
        for off in range(4):
            d.rectangle([x1 - off, y1 - off, x2 + off, y2 + off], outline=color + (255,))
        label = r["label"]
        if label:
            try:
                tw, th = d.textbbox((0, 0), label, font=font_small)[2:]
            except Exception:
                tw, th = d.textlength(label, font=font_small), font_small.size
            pad = 6
            if r.get("label_pos") == "bottom":
                ly = y2 + 6
            else:
                ly = y1 - th - pad - 6
            d.rectangle([x1, ly, x1 + tw + pad * 2, ly + th + pad], fill=color + (255,))
            d.text((x1 + pad, ly + pad / 2), label, fill=(255, 255, 255, 255), font=font_small)

    out = Image.alpha_composite(img, overlay).convert("RGB")

    header_h = max(60, H // 12)
    header = Image.new("RGBA", (W, header_h), (20, 20, 20, 230))
    hd = ImageDraw.Draw(header)
    hd.text((12, 8), out_name, fill=(255, 255, 255, 255), font=font_big)
    y = 8 + font_big.size + 4
    for line in label_lines:
        hd.text((12, y), line, fill=(255, 220, 220, 255), font=font_small)
        y += font_small.size + 2
    header = header.crop((0, 0, W, y + 8))

    final = Image.new("RGB", (W, H + header.size[1]), (0, 0, 0))
    final.paste(header.convert("RGB"), (0, 0))
    final.paste(out, (0, header.size[1]))

    out_path = os.path.join(OUT_DIR, out_name)
    final.save(out_path, "PNG", optimize=True)
    print(f"wrote {out_path} ({final.size})")


RED = (220, 40, 40)
ORANGE = (255, 140, 0)
YELLOW = (255, 220, 0)
BLUE = (60, 140, 255)
GREEN = (40, 200, 80)
PURPLE = (170, 60, 220)

# audit-01-2s.png
img1 = Image.open("/home/z/my-project/download/screenshots/audit-01-2s.png")
W1, H1 = img1.size
annotate(
    "/home/z/my-project/download/screenshots/audit-01-2s.png",
    "audit-01-2s-ANNOTATED.png",
    regions=[
        {"box": (int(W1*0.06), int(H1*0.04), int(W1*0.30), int(H1*0.32)),
         "color": RED, "label": "KORU #1 (background illustration)", "label_pos": "top"},
        {"box": (int(W1*0.12), int(H1*0.36), int(W1*0.88), int(H1*0.45)),
         "color": BLUE, "label": "USER bubble", "label_pos": "top"},
        {"box": (int(W1*0.04), int(H1*0.46), int(W1*0.96), int(H1*0.97)),
         "color": RED, "label": "WORKING PANEL (full bottom, no input bar!)", "label_pos": "top"},
        {"box": (int(W1*0.06), int(H1*0.48), int(W1*0.22), int(H1*0.58)),
         "color": RED, "label": "KORU #2 (avatar)", "label_pos": "bottom"},
        {"box": (int(W1*0.20), int(H1*0.58), int(W1*0.80), int(H1*0.74)),
         "color": RED, "label": "KORU #3 (illustration in panel)", "label_pos": "bottom"},
        {"box": (int(W1*0.08), int(H1*0.82), int(W1*0.92), int(H1*0.93)),
         "color": YELLOW, "label": "4 STATUS STEPS AT ONCE", "label_pos": "top"},
    ],
    label_lines=[
        "BUG 1: Koru mascot appears 3 times in same screen (background + panel avatar + panel illustration).",
        "BUG 2: Big working panel REPLACES the input bar at the bottom (no way to type new message).",
        "BUG 3: All 4 status steps shown simultaneously instead of revealing the current one.",
    ],
)

# audit-02-5s.png
img2 = Image.open("/home/z/my-project/download/screenshots/audit-02-5s.png")
W2, H2 = img2.size
annotate(
    "/home/z/my-project/download/screenshots/audit-02-5s.png",
    "audit-02-5s-ANNOTATED.png",
    regions=[
        {"box": (int(W2*0.06), int(H2*0.04), int(W2*0.30), int(H2*0.32)),
         "color": RED, "label": "KORU #1 (background)", "label_pos": "top"},
        {"box": (int(W2*0.12), int(H2*0.36), int(W2*0.88), int(H2*0.45)),
         "color": BLUE, "label": "USER bubble", "label_pos": "top"},
        {"box": (int(W2*0.04), int(H2*0.46), int(W2*0.96), int(H2*0.97)),
         "color": RED, "label": "WORKING PANEL (no input bar!)", "label_pos": "top"},
        {"box": (int(W2*0.06), int(H2*0.48), int(W2*0.22), int(H2*0.58)),
         "color": RED, "label": "KORU #2 (avatar)", "label_pos": "bottom"},
        {"box": (int(W2*0.20), int(H2*0.58), int(W2*0.80), int(H2*0.74)),
         "color": RED, "label": "KORU #3 (illustration)", "label_pos": "bottom"},
        {"box": (int(W2*0.08), int(H2*0.82), int(W2*0.92), int(H2*0.93)),
         "color": YELLOW, "label": "4 STATUS STEPS AT ONCE", "label_pos": "top"},
    ],
    label_lines=[
        "Same layout as 2s. Progress bar now ~80%. Motivational text changed to 'Aca estamos, dale que sale.'",
        "BUG 1,2,3 still present. Progress bar advanced but UI structure unchanged.",
    ],
)

# audit-03-10s.png
img3 = Image.open("/home/z/my-project/download/screenshots/audit-03-10s.png")
W3, H3 = img3.size
annotate(
    "/home/z/my-project/download/screenshots/audit-03-10s.png",
    "audit-03-10s-ANNOTATED.png",
    regions=[
        {"box": (int(W3*0.06), int(H3*0.04), int(W3*0.30), int(H3*0.32)),
         "color": RED, "label": "KORU #1 (background)", "label_pos": "top"},
        {"box": (int(W3*0.12), int(H3*0.36), int(W3*0.88), int(H3*0.45)),
         "color": BLUE, "label": "USER bubble", "label_pos": "top"},
        {"box": (int(W3*0.04), int(H3*0.46), int(W3*0.96), int(H3*0.97)),
         "color": RED, "label": "WORKING PANEL (no input bar!)", "label_pos": "top"},
        {"box": (int(W3*0.06), int(H3*0.48), int(W3*0.22), int(H3*0.58)),
         "color": RED, "label": "KORU #2 (avatar)", "label_pos": "bottom"},
        {"box": (int(W3*0.20), int(H3*0.58), int(W3*0.80), int(H3*0.74)),
         "color": RED, "label": "KORU #3 (illustration)", "label_pos": "bottom"},
        {"box": (int(W3*0.08), int(H3*0.82), int(W3*0.92), int(H3*0.93)),
         "color": YELLOW, "label": "4 STATUS STEPS AT ONCE", "label_pos": "top"},
    ],
    label_lines=[
        "BUG 4: Progress bar appears REGRESSED to ~40% (was ~80% at 5s). Random/non-monotonic.",
        "Motivational text changed AGAIN to 'Tu paciencia se nota. Gracias.'",
        "All previous bugs still present. UI flickers between unrelated motivational quotes.",
    ],
)

# audit-04-20s.png
img4 = Image.open("/home/z/my-project/download/screenshots/audit-04-20s.png")
W4, H4 = img4.size
annotate(
    "/home/z/my-project/download/screenshots/audit-04-20s.png",
    "audit-04-20s-ANNOTATED.png",
    regions=[
        {"box": (int(W4*0.02), int(H4*0.01), int(W4*0.98), int(H4*0.06)),
         "color": PURPLE, "label": "TOP BAR (dark navy, search field)", "label_pos": "bottom"},
        {"box": (int(W4*0.04), int(H4*0.07), int(W4*0.96), int(H4*0.13)),
         "color": BLUE, "label": "USER bubble", "label_pos": "top"},
        {"box": (int(W4*0.12), int(H4*0.15), int(W4*0.96), int(H4*0.27)),
         "color": ORANGE, "label": "ASSISTANT bubble (text + KORU avatar)", "label_pos": "top"},
        {"box": (int(W4*0.02), int(H4*0.15), int(W4*0.11), int(H4*0.22)),
         "color": RED, "label": "KORU avatar", "label_pos": "bottom"},
        {"box": (int(W4*0.04), int(H4*0.28), int(W4*0.96), int(H4*0.62)),
         "color": RED, "label": "COMPARISON CARD ('TU COMPARACION / COMPARATIVA')", "label_pos": "top"},
        {"box": (int(W4*0.04), int(H4*0.63), int(W4*0.96), int(H4*0.70)),
         "color": ORANGE, "label": "SMALLER CARD 'Ver 6 fuentes'", "label_pos": "top"},
        {"box": (int(W4*0.02), int(H4*0.91), int(W4*0.98), int(H4*0.98)),
         "color": GREEN, "label": "INPUT BAR (now visible)", "label_pos": "top"},
    ],
    label_lines=[
        "GOOD: Input bar is back; assistant text + comparison card render normally.",
        "BUG 5: VLM detected 2 assistant bubbles with IDENTICAL text ('Te deje una comparativa...')",
        "      -> either duplicated render or the card is mistakenly wrapped in an assistant bubble.",
        "BUG 6: Background gradient changed from blue->purple to dark navy (inconsistent theme).",
    ],
)

# Reference image
imgR = Image.open("/home/z/my-project/upload/pasted_image_1784151610784.png")
WR, HR = imgR.size
annotate(
    "/home/z/my-project/upload/pasted_image_1784151610784.png",
    "reference-ANNOTATED.png",
    regions=[
        {"box": (int(WR*0.20), int(HR*0.05), int(WR*0.55), int(HR*0.30)),
         "color": RED, "label": "KORU #1 (background illustration)", "label_pos": "top"},
        {"box": (int(WR*0.45), int(HR*0.06), int(WR*0.96), int(HR*0.13)),
         "color": BLUE, "label": "USER bubble 'Como salio inglaterra'", "label_pos": "top"},
        {"box": (int(WR*0.12), int(HR*0.16), int(WR*0.96), int(HR*0.24)),
         "color": ORANGE, "label": "INLINE status bubble 'Buscando en la web'", "label_pos": "top"},
        {"box": (int(WR*0.02), int(HR*0.16), int(WR*0.11), int(HR*0.23)),
         "color": RED, "label": "KORU #2 (avatar)", "label_pos": "bottom"},
        {"box": (int(WR*0.12), int(HR*0.24), int(WR*0.96), int(HR*0.28)),
         "color": ORANGE, "label": "SUBTEXT 'Consultando fuentes ahora...'", "label_pos": "top"},
        {"box": (int(WR*0.04), int(HR*0.30), int(WR*0.96), int(HR*0.85)),
         "color": RED, "label": "BIG WORKING PANEL (DUPLICATES the inline bubble above!)", "label_pos": "top"},
        {"box": (int(WR*0.06), int(HR*0.55), int(WR*0.94), int(HR*0.72)),
         "color": YELLOW, "label": "3 STATUS STEPS AT ONCE", "label_pos": "top"},
        {"box": (int(WR*0.02), int(HR*0.88), int(WR*0.98), int(HR*0.96)),
         "color": GREEN, "label": "INPUT BAR", "label_pos": "top"},
    ],
    label_lines=[
        "REFERENCE = the bug the user is reporting. CRITICAL OVERLAP:",
        "  * Inline status bubble 'Buscando en la web' + subtext 'Consultando fuentes ahora...'",
        "  * BIG working panel below ALSO says 'Buscando...' with progress bar + status steps.",
        "  => 2 representations of the SAME searching state stacked on top of each other.",
        "  => Koru mascot appears TWICE (background + inline avatar).",
        "  => 3 status steps shown simultaneously instead of just the active one.",
    ],
)

print("DONE")
