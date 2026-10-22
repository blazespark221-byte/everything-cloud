"""Paper textures for the sketchbook look: a speckled grain overlay and a faint graph grid.

Usage: python tools/textures.py   (writes assets/grain.png and assets/grid.png)
"""
import os
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1920, 1080
rng = np.random.default_rng(11)

# grain: soft fibre blotches plus fine speckle, as dark/light alpha over any ground
coarse = gaussian_filter(rng.standard_normal((H, W)), 6)
coarse /= np.abs(coarse).max()
fine = gaussian_filter(rng.standard_normal((H, W)), 0.7)
fine /= np.abs(fine).max()
v = coarse * 0.6 + fine * 0.4
dark = np.clip(v, 0, 1)
light = np.clip(-v, 0, 1)
rgba = np.zeros((H, W, 4), dtype=np.uint8)
# dark specks in warm brown, light specks in white, both low alpha
mask = v > 0
rgba[..., 0] = np.where(mask, 70, 255)
rgba[..., 1] = np.where(mask, 55, 255)
rgba[..., 2] = np.where(mask, 40, 250)
rgba[..., 3] = (np.where(mask, dark * 40, light * 34)).astype(np.uint8)
Image.fromarray(rgba, "RGBA").save(os.path.join(ROOT, "assets", "grain.png"), optimize=True)

# grid: 64 px graph paper in pale blue, lines a little uneven
grid = np.zeros((H, W, 4), dtype=np.uint8)
grid[..., 0], grid[..., 1], grid[..., 2] = 120, 160, 205
alpha = np.zeros((H, W))
for x in range(32, W, 64):
    alpha[:, x : x + 2] = 1
for y in range(28, H, 64):
    alpha[y : y + 2, :] = 1
wobble = 0.65 + 0.35 * gaussian_filter(rng.random((H, W)), 3) / 0.5
alpha = np.clip(alpha * wobble, 0, 1)
grid[..., 3] = (alpha * 70).astype(np.uint8)
Image.fromarray(grid, "RGBA").save(os.path.join(ROOT, "assets", "grid.png"), optimize=True)
print("ok")
