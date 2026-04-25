"""
Regenerate all logo variants with 'QuizBuilder' text.
Extracts the icon portion from the existing logo and redraws the text.
"""
from PIL import Image, ImageDraw, ImageFont
import os

ORANGE = (245, 158, 11, 255)   # #f59e0b
WHITE  = (255, 255, 255, 255)
FONT_PATH = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"

BASE_DIR = os.path.dirname(__file__)

def make_logo(width, height, out_path):
    # Load source icon (icon-512 is clean, square, no text)
    icon_src = Image.open(os.path.join(BASE_DIR, "media", "icon-512.png")).convert("RGBA")

    # Create canvas
    img = Image.new("RGBA", (width, height), ORANGE)
    draw = ImageDraw.Draw(img)

    padding = int(height * 0.08)
    icon_h = height - padding * 2
    icon_w = icon_h

    # Paste icon on left
    icon = icon_src.resize((icon_w, icon_h), Image.LANCZOS)
    img.paste(icon, (padding, padding), icon)

    # Draw text — auto-fit font to available width
    text = "QuizBuilder"
    text_x = padding + icon_w + int(height * 0.10)
    max_text_w = width - text_x - padding

    font_size = int(height * 0.55)
    while font_size > 10:
        font = ImageFont.truetype(FONT_PATH, font_size)
        bbox = font.getbbox(text)
        if (bbox[2] - bbox[0]) <= max_text_w:
            break
        font_size -= 1

    bbox = font.getbbox(text)
    text_h = bbox[3] - bbox[1]
    text_y = (height - text_h) // 2 - bbox[1]

    draw.text((text_x, text_y), text, font=font, fill=WHITE)

    img = img.convert("RGB")
    img.save(out_path, "PNG")
    print(f"  Saved {out_path} ({width}x{height})")


print("Generating logos...")
# media/ variants
make_logo(750,  203, os.path.join(BASE_DIR, "media", "logo.png"))
make_logo(1200, 324, os.path.join(BASE_DIR, "media", "logo-1200.png"))

# root logo.png (same as media/logo.png)
make_logo(750,  203, os.path.join(BASE_DIR, "logo.png"))

# web/public copies
make_logo(750,  203, os.path.join(BASE_DIR, "web", "public", "logo.png"))
make_logo(1200, 324, os.path.join(BASE_DIR, "web", "public", "logo-1200.png"))

print("Done.")
