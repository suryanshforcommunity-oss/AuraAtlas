import os
from PIL import Image, ImageFilter
import numpy as np

src_path = r"C:\Users\shelk\.gemini\antigravity-ide\brain\0df50472-ecd7-4c28-8c90-cd00994d7b4e\.user_uploaded\media_1791604666976.jpg"
out_dir = r"c:\Users\shelk\Desktop\FleetSync\public"
os.makedirs(out_dir, exist_ok=True)

img = Image.open(src_path).convert("RGB")
arr = np.array(img, dtype=np.float32)

# Distance from pure white
dist = np.sqrt(np.sum((255.0 - arr) ** 2, axis=-1))

# High quality alpha extraction
alpha = np.clip(dist / 24.0, 0.0, 1.0)
alpha[dist < 5.0] = 0.0
alpha[dist > 36.0] = 1.0

# Decontaminate foreground
a_3d = np.repeat(alpha[..., np.newaxis], 3, axis=-1)
fg = np.zeros_like(arr)
mask = alpha > 0.01
fg[mask] = (arr[mask] - (1.0 - a_3d[mask]) * 255.0) / a_3d[mask]
fg = np.clip(fg, 0.0, 255.0)

# Identify pixels that are cyan vs slate/gray
# Cyan has high B and G, lower R (e.g., G > 160, B > 180, R < 120)
is_cyan = (fg[..., 1] > 150) & (fg[..., 2] > 170) & (fg[..., 0] < 140)

# Gray/slate has R, G, B relatively close to each other
diff_max_min = np.max(fg, axis=-1) - np.min(fg, axis=-1)
is_gray = (diff_max_min < 45) & (~is_cyan)

# Let's create dark-theme tuned foreground
fg_dark = np.copy(fg)

# In the text area (Y >= 650):
# "FLEET" is the left half (X < 535) and is gray
# "SYNC" is the right half (X >= 535) and is cyan
text_y = np.arange(arr.shape[0])[:, None] >= 650
fleet_text_mask = text_y & (np.arange(arr.shape[1])[None, :] < 535) & (alpha > 0.1)
sync_text_mask = text_y & (np.arange(arr.shape[1])[None, :] >= 535) & (alpha > 0.1)

# FLEET text: bright metallic white/silver for dark background
# [245, 250, 255]
fg_dark[fleet_text_mask] = np.array([245.0, 250.0, 255.0])

# SYNC text: luminous electric cyan [0, 235, 255]
fg_dark[sync_text_mask] = np.array([0.0, 235.0, 255.0])

# In the icon area (Y < 650):
icon_area = ~text_y
# Boost gray lines and hexagons to crisp silver-slate [180, 205, 225]
icon_gray = icon_area & is_gray & (alpha > 0.08)
# Preserve relative intensity but lift base from ~120 to ~200
lum = (fg[..., 0] * 0.3 + fg[..., 1] * 0.59 + fg[..., 2] * 0.11)
lum_norm = np.clip(lum / 160.0, 0.0, 1.2)

fg_dark[icon_gray, 0] = np.clip(185.0 * lum_norm[icon_gray], 130.0, 240.0)
fg_dark[icon_gray, 1] = np.clip(205.0 * lum_norm[icon_gray], 150.0, 250.0)
fg_dark[icon_gray, 2] = np.clip(225.0 * lum_norm[icon_gray], 170.0, 255.0)

# Cyan icon nodes: electric cyan [0, 240, 255]
icon_cyan = icon_area & is_cyan & (alpha > 0.08)
fg_dark[icon_cyan, 0] = 0.0
fg_dark[icon_cyan, 1] = 235.0
fg_dark[icon_cyan, 2] = 255.0

# Build final RGBA
rgba_dark = np.dstack([fg_dark, alpha * 255.0]).astype(np.uint8)
img_dark = Image.fromarray(rgba_dark, "RGBA")

# 1. Full vertical logo: crop bounding box with padding
# Overall bbox
y_all, x_all = np.where(alpha > 0.05)
ymin, ymax = y_all.min(), y_all.max()
xmin, xmax = x_all.min(), x_all.max()

pad = 30
crop_all = img_dark.crop((max(0, xmin - pad), max(0, ymin - pad), min(1024, xmax + pad), min(1024, ymax + pad)))
crop_all.save(os.path.join(out_dir, "logo.png"))
print("Saved logo.png", crop_all.size)

# 2. Icon only: crop icon bbox with padding to square
icon_crop = img_dark.crop((315, 235, 710, 655))
# Make square
w, h = icon_crop.size
max_dim = max(w, h)
sq_icon = Image.new("RGBA", (max_dim + 40, max_dim + 40), (0, 0, 0, 0))
sq_icon.paste(icon_crop, ((max_dim + 40 - w) // 2, (max_dim + 40 - h) // 2))
sq_icon.save(os.path.join(out_dir, "logo-icon.png"))
print("Saved logo-icon.png", sq_icon.size)

# 3. Horizontal logo: Icon on left, FLEETSYNC text on right
# Extract text crop
text_crop = img_dark.crop((xmin, 680, xmax, 784))
tw, th = text_crop.size
# Scale icon to match desired height
target_h = 160
icon_scaled = sq_icon.resize((target_h, target_h), Image.Resampling.LANCZOS)
text_scaled_w = int(tw * (target_h * 0.55 / th))
text_scaled_h = int(th * (target_h * 0.55 / th))
text_scaled = text_crop.resize((text_scaled_w, text_scaled_h), Image.Resampling.LANCZOS)

horiz_w = target_h + text_scaled_w + 30
horiz_img = Image.new("RGBA", (horiz_w, target_h), (0, 0, 0, 0))
horiz_img.paste(icon_scaled, (0, 0), icon_scaled)
text_y_offset = (target_h - text_scaled_h) // 2
horiz_img.paste(text_scaled, (target_h + 10, text_y_offset), text_scaled)
horiz_img.save(os.path.join(out_dir, "logo-horizontal.png"))
print("Saved logo-horizontal.png", horiz_img.size)

# 4. Favicon
favicon_32 = sq_icon.resize((32, 32), Image.Resampling.LANCZOS)
favicon_32.save(os.path.join(out_dir, "favicon.png"))
sq_icon.resize((192, 192), Image.Resampling.LANCZOS).save(os.path.join(out_dir, "logo-192.png"))
favicon_32.save(os.path.join(out_dir, "favicon.ico"), format="ICO")
print("Saved favicons")
