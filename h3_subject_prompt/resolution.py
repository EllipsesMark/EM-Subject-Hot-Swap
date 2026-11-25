"""Width and height from an aspect ratio and a megapixel target.

Copied from ComfyUI-EllipsesMark "Resolution Selector Ext - Grouped" so the
Hot Swap node stands alone. Same math: both sides stay on the ratio, land on
the pixel multiple, and neither drops below 256.
"""

import math

# Portrait, then its landscape flip, so each pair sits together in the menu.
ASPECT_RATIOS = {
    "1:1 (Square)": (1, 1),
    "3:4 (Standard Portrait)": (3, 4),
    "4:3 (Standard Format)": (4, 3),
    "4:5 (Canvas Portrait)": (4, 5),
    "5:4 (Canvas Format)": (5, 4),
    "2:3 (Medium Portrait)": (2, 3),
    "3:2 (Photo Format)": (3, 2),
    "9:16 (Tall Portrait)": (9, 16),
    "16:9 (Widescreen)": (16, 9),
    "9:18 (Extended Portrait)": (9, 18),
    "18:9 (Extended Widescreen)": (18, 9),
    "1:3 (Tall Panorama)": (1, 3),
    "3:1 (Panorama)": (3, 1),
    "21:9 (Ultrawide)": (21, 9),
}

DEFAULT_ASPECT = "16:9 (Widescreen)"
DEFAULT_MEGAPIXELS = 1.0
# MiniMax H3 latents want 32-pixel sides, like the dedicated writers' step.
MULTIPLE = 32

_MINIMUM = 256


def select_resolution(aspect_ratio, megapixels, multiple=MULTIPLE):
    """Return (width, height) on the aspect grid."""
    w_ratio, h_ratio = ASPECT_RATIOS.get(aspect_ratio, ASPECT_RATIOS[DEFAULT_ASPECT])
    total_pixels = float(megapixels) * 1024 * 1024
    scale = math.sqrt(total_pixels / (w_ratio * h_ratio))
    width = round(w_ratio * scale / multiple) * multiple
    height = round(h_ratio * scale / multiple) * multiple
    if width < _MINIMUM or height < _MINIMUM:
        step_w = multiple // math.gcd(w_ratio, multiple)
        step_h = multiple // math.gcd(h_ratio, multiple)
        k_step = step_w * step_h // math.gcd(step_w, step_h)
        min_k = math.ceil(max(_MINIMUM / w_ratio, _MINIMUM / h_ratio))
        k = math.ceil(min_k / k_step) * k_step
        width = w_ratio * k
        height = h_ratio * k
    return int(width), int(height)
