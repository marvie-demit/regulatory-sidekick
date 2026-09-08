from PIL import Image, ImageDraw, ImageFont

# Regulatory Sidekick app icon.
#
# The house brand is a WORDMARK only (components/brand/Brand.tsx) — there was no
# symbol to shrink down, so this is a letter mark built from the same materials:
# the coral the product uses for every primary action, and Georgia Bold, which
# globals.css already names as Fraunces's fallback. So the tab icon is set in
# the family the wordmark itself falls back to.
#
# Composition chosen by measuring, not taste: an earlier version put a coral
# band across the bottom of a teal tile, which spent a fifth of the height on
# decoration and left the R at 4% of pixels at 16px — mush. One ground colour
# and a letter at 78% reads at twice that.

CORAL = (216, 89, 58, 255)    # --coral #d8593a
TEAL  = (11, 42, 38, 255)     # --t9    #0b2a26
CREAM = (251, 247, 238, 255)  # --cream #fbf7ee

S = 512
APP = "C:/Users/marvi/Desktop/notjustanyqms/app"

def build(ground):
    # 4x supersample so the corners and the serif terminals stay smooth.
    s = S * 4
    r = int(S * 0.22) * 4
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=r, fill=ground)
    f = ImageFont.truetype("C:/Windows/Fonts/georgiab.ttf", int(s * 0.78))
    b = d.textbbox((0, 0), "R", font=f)
    w, h = b[2] - b[0], b[3] - b[1]
    d.text(((s - w) / 2 - b[0], (s - h) / 2 - b[1]), "R", font=f, fill=CREAM)
    return img.resize((S, S), Image.LANCZOS)

master = build(CORAL)
master.save(f"{APP}/favicon.ico", format="ICO",
            sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
master.save(f"{APP}/icon.png", format="PNG")
master.resize((180, 180), Image.LANCZOS).save(f"{APP}/apple-icon.png", format="PNG")
