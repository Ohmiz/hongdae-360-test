#!/usr/bin/env python3
"""
Best-effort equirectangular panorama from a flat Hongdae concept screenshot.

Method:
  1. Assume the 1280x720 시안 was framed at ~80° HFOV / ~45° VFOV (16:9 chase-cam).
  2. Stamp the concept pixels into the forward angular window of a 2:1 equirectangular
     so a Three.js camera at ~45° vertical FOV (~80° horizontal at 16:9) matches the 시안.
  3. Fill the remaining sphere with palette-matched extensions: edge-extruded sides,
     neon strip accents behind, sky from top-row colors, ground from pavement.

Fidelity limits (honest):
  - Source is NOT a true panorama — left/right/behind are invented, not photographed.
  - Parallax / true 3D depth cannot appear when looking around.
  - UI chrome is baked into the 시안; it rides with the world texture.
  - Side/back continuity is stylistic, not architectural truth.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "concept-hongdae.jpg"
OUT = ROOT / "public" / "hongdae-equirect.jpg"
OUT_PREVIEW = ROOT / "public" / "hongdae-equirect-preview.jpg"

H_FOV = 80.0
V_FOV = 45.0
EQ_W = 4096
EQ_H = 2048


def sample_bilinear_grid(img: np.ndarray, xs: np.ndarray, ys: np.ndarray) -> np.ndarray:
    h, w = img.shape[:2]
    xs = np.clip(xs, 0, w - 1.001)
    ys = np.clip(ys, 0, h - 1.001)
    x0 = np.floor(xs).astype(np.int32)
    y0 = np.floor(ys).astype(np.int32)
    x1 = np.minimum(x0 + 1, w - 1)
    y1 = np.minimum(y0 + 1, h - 1)
    sx = (xs - x0)[..., None]
    sy = (ys - y0)[..., None]
    c00 = img[y0, x0].astype(np.float32)
    c10 = img[y0, x1].astype(np.float32)
    c01 = img[y1, x0].astype(np.float32)
    c11 = img[y1, x1].astype(np.float32)
    return c00 * (1 - sx) * (1 - sy) + c10 * sx * (1 - sy) + c01 * (1 - sx) * sy + c11 * sx * sy


def extend_colors(concept: np.ndarray, lon: np.ndarray, lat: np.ndarray) -> np.ndarray:
    h, w = concept.shape[:2]
    edge_x = np.where(lon < 0, 0, w - 1)
    v = (V_FOV / 2 - lat) / V_FOV
    ey = np.clip((v * (h - 1)).astype(np.int32), 0, h - 1)
    edge = concept[ey, edge_x].astype(np.float32)

    sky = concept[0 : max(1, h // 8), :].mean(axis=(0, 1)).astype(np.float32)
    ground = concept[int(h * 0.72) : int(h * 0.88), int(w * 0.3) : int(w * 0.7)].mean(
        axis=(0, 1)
    ).astype(np.float32)

    brick = np.array([168.0, 92.0, 78.0], dtype=np.float32)
    mint = np.array([120.0, 180.0, 165.0], dtype=np.float32)
    neon = np.array([255.0, 90.0, 110.0], dtype=np.float32)
    asphalt = np.array([145.0, 140.0, 138.0], dtype=np.float32)
    pink = np.array([210.0, 170.0, 175.0], dtype=np.float32)
    green = np.array([170.0, 185.0, 170.0], dtype=np.float32)
    cloud_c = np.array([250.0, 250.0, 255.0], dtype=np.float32)
    dark = np.array([40.0, 35.0, 45.0], dtype=np.float32)

    side_t = np.zeros_like(lon, dtype=np.float32)
    side_t = np.where(lon < -H_FOV / 2, np.minimum(1.0, (-H_FOV / 2 - lon) / 50.0), side_t)
    side_t = np.where(lon > H_FOV / 2, np.minimum(1.0, (lon - H_FOV / 2) / 50.0), side_t)

    # Sky band
    cloud = 0.15 * np.maximum(0.0, np.sin(lon * 0.08) * np.sin(lat * 0.2))
    sky_col = sky * (1 - cloud[..., None]) + cloud_c * cloud[..., None]

    # Ground band
    tile = 0.5 + 0.5 * np.sin(lon * 0.35) * np.sin(lat * 0.5)
    ground_col = (
        ground * 0.55
        + asphalt * 0.25
        + np.where(tile[..., None] > 0.5, pink, green) * 0.2
    )

    # Building band
    facade_phase = np.sin(lon * 0.12)
    facade = np.where(facade_phase[..., None] > 0, brick, mint)
    win = 0.65 + 0.35 * (0.5 + 0.5 * np.sin(lat * 1.8 + lon * 0.05))
    mid = facade * win[..., None]
    neon_mask = (np.abs(lat) < 12) & (np.abs(np.sin(lon * 0.2)) > 0.7)
    mid = np.where(neon_mask[..., None], mid * 0.55 + neon * 0.45, mid)
    mid = edge * (1 - side_t[..., None] * 0.85) + mid * (side_t[..., None] * 0.85)

    base = np.where(
        (lat > 18)[..., None],
        sky_col,
        np.where((lat < -28)[..., None], ground_col, mid),
    )

    behind = np.abs(((lon + 180) % 360) - 180)
    k = np.clip((behind - 110) / 70.0, 0, 1)
    base = base * (1 - 0.25 * k[..., None]) + dark * (0.25 * k[..., None])
    back_neon = (behind > 110) & (np.abs(lat) < 10) & (np.abs(np.sin(lon * 0.35)) > 0.85)
    base = np.where(back_neon[..., None], base * 0.4 + neon * 0.6, base)
    return np.clip(base, 0, 255)


def build() -> None:
    concept = np.array(Image.open(SRC).convert("RGB"))
    ch, cw = concept.shape[:2]

    xs = (np.arange(EQ_W) + 0.5) / EQ_W * 360.0 - 180.0
    ys = 90.0 - (np.arange(EQ_H) + 0.5) / EQ_H * 180.0
    lon, lat = np.meshgrid(xs, ys)

    u = (lon + H_FOV / 2) / H_FOV
    v = (V_FOV / 2 - lat) / V_FOV
    inside = (u >= 0.0) & (u <= 1.0) & (v >= 0.0) & (v <= 1.0)

    out = extend_colors(concept, lon, lat)

    if np.any(inside):
        px = sample_bilinear_grid(concept, u * (cw - 1), v * (ch - 1))
        edge_fade = np.minimum(
            np.minimum(u, 1 - u) / 0.04,
            np.minimum(v, 1 - v) / 0.06,
        )
        edge_fade = np.clip(edge_fade, 0, 1)
        blended = px * edge_fade[..., None] + out * (1 - edge_fade[..., None])
        out = np.where(inside[..., None], blended, out)

    img = Image.fromarray(out.astype(np.uint8), "RGB")
    img.save(OUT, quality=92, optimize=True)
    preview = img.resize((2048, 1024), Image.Resampling.LANCZOS)
    preview.save(OUT_PREVIEW, quality=88, optimize=True)
    print(f"Wrote {OUT} ({EQ_W}x{EQ_H})")
    print(f"Wrote {OUT_PREVIEW}")
    print(f"Forward stamp: HFOV={H_FOV}° VFOV={V_FOV}° from {SRC.name} ({cw}x{ch})")


if __name__ == "__main__":
    build()
