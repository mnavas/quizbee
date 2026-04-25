"""
Regenerate mobile splash screen with 'QuizBuilder' wordmark.
Output: mobile/assets/splash.png  (1284×2778)
"""
from PIL import Image, ImageDraw, ImageFont
import os

BASE_DIR = os.path.dirname(__file__)
ORANGE     = (245, 158, 11, 255)
WHITE      = (255, 255, 255, 255)
FONT_PATH  = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"
W, H       = 1284, 2778

# Load the icon (no text, square)
icon_src = Image.open(os.path.join(BASE_DIR, "media", "icon-512.png")).convert("RGBA")

img  = Image.new("RGBA", (W, H), ORANGE)
draw = ImageDraw.Draw(img)

# Logo group: icon + text, centered on screen
icon_size = 220   # px
icon_img  = icon_src.resize((icon_size, icon_size), Image.LANCZOS)

# Measure text at candidate sizes
text = "QuizBuilder"
gap  = 36          # space between icon and text
for font_size in range(160, 10, -1):
    font = ImageFont.truetype(FONT_PATH, font_size)
    tb   = font.getbbox(text)
    tw   = tb[2] - tb[0]
    th   = tb[3] - tb[1]
    if font_size <= 160:   # just use 160, it'll fit fine at this canvas width
        break

group_w = icon_size + gap + tw
group_h = max(icon_size, th)

gx = (W - group_w) // 2
gy = (H - group_h) // 2

# Paste icon
img.paste(icon_img, (gx, gy + (group_h - icon_size) // 2), icon_img)

# Draw text
text_x = gx + icon_size + gap
text_y = gy + (group_h - th) // 2 - tb[1]
draw.text((text_x, text_y), text, font=font, fill=WHITE)

out = os.path.join(BASE_DIR, "mobile", "assets", "splash.png")
img.convert("RGB").save(out, "PNG")
print(f"Saved {out} ({W}x{H})")
