import cv2
import numpy as np


# ── Label colour palette (BGR) ────────────────────────────────────────────────
_LABEL_COLOURS = {
    "overlay_defect":   (0,   80, 255),   # vivid orange-red
    "scratch":          (0,  255, 100),   # neon green
    "crack":            (0,  160, 255),   # amber
    "contamination":    (255, 180,  0),   # sky blue
    "overlay_shift":    (255,  50, 200),  # magenta
    "dead_die":         (100,  50, 255),  # purple-red
    "burn_mark":        (0,   80, 255),   # deep red
    "pattern_damage":   (0,  255, 200),   # cyan-green
}
_DEFAULT_COLOUR = (0, 230, 255)           # bright cyan fallback


def _get_colour(label: str):
    return _LABEL_COLOURS.get(label.lower(), _DEFAULT_COLOUR)


def create_annotation(
    image: np.ndarray,
    mask: np.ndarray,
    defects_list: list = None,
) -> np.ndarray:
    """
    Rich visual annotation map for U-Net segmentation output.

    Layers applied (bottom → top):
      1. Original image (65 %)  +  crimson damage fill (35 %)
      2. Warm probability heatmap tinted over the mask region
      3. Per-contour glowing outline (double-stroke for glow)
      4. Bounding box with corner ticks
      5. Label badge with ID, class name, and confidence %
      6. Legend panel (bottom-right corner)
      7. Scan-line / vignette header bar
    """
    if image is None:
        return np.zeros((512, 512, 3), dtype=np.uint8)

    h, w = image.shape[:2]
    result = image.copy().astype(np.float32)

    # ── 1. Damage-region fill ─────────────────────────────────────────────────
    mask_bin = (mask > 0).astype(np.uint8)

    if np.any(mask_bin):
        hazard = image.copy().astype(np.float32)
        hazard[mask_bin > 0] = [30, 40, 230]          # BGR crimson

        result = cv2.addWeighted(
            result.astype(np.uint8), 0.62,
            hazard.astype(np.uint8), 0.38, 0,
        ).astype(np.float32)

        # ── 2. Heatmap tint ──────────────────────────────────────────────────
        # Generate a soft heat density from the mask and blend it over result
        density = cv2.GaussianBlur(mask_bin.astype(np.float32), (21, 21), 10)
        density_norm = cv2.normalize(density, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
        heat_bgr = cv2.applyColorMap(density_norm, cv2.COLORMAP_INFERNO)
        mask3 = np.stack([mask_bin] * 3, axis=-1)
        result_u8 = result.astype(np.uint8)
        blended = cv2.addWeighted(result_u8, 0.75, heat_bgr, 0.25, 0)
        result = np.where(mask3, blended, result_u8).astype(np.float32)

    result = np.clip(result, 0, 255).astype(np.uint8)

    # ── Extract contours ──────────────────────────────────────────────────────
    contours, _ = cv2.findContours(mask_bin, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    legend_entries = []   # (colour, label_text) for legend panel

    for i, contour in enumerate(contours):
        area = cv2.contourArea(contour)
        if area < 8:
            continue

        # Pull metadata from defects_list if available
        label     = "overlay_defect"
        conf_val  = 0.87
        if defects_list and i < len(defects_list):
            d        = defects_list[i]
            label    = d.get("label", label)
            conf_val = float(d.get("confidence", conf_val))

        colour = _get_colour(label)

        # ── 3. Double-stroke glow outline ────────────────────────────────────
        # Outer glow (wider, dimmer)
        glow_col = tuple(min(255, int(c * 0.55)) for c in colour)
        cv2.drawContours(result, [contour], -1, glow_col, 5, cv2.LINE_AA)
        # Inner bright stroke
        cv2.drawContours(result, [contour], -1, colour,   2, cv2.LINE_AA)

        # ── 4. Bounding box with corner ticks ────────────────────────────────
        x, y, bw, bh = cv2.boundingRect(contour)
        x1, y1 = max(0, x),      max(0, y)
        x2, y2 = min(w, x + bw), min(h, y + bh)

        # Main box (thin)
        cv2.rectangle(result, (x1, y1), (x2, y2), colour, 1, cv2.LINE_AA)

        # Corner ticks (length = 8 px)
        tk = 8
        for cx_, cy_, dx, dy in [
            (x1, y1, 1, 1), (x2, y1, -1, 1),
            (x1, y2, 1, -1), (x2, y2, -1, -1),
        ]:
            cv2.line(result, (cx_, cy_), (cx_ + dx * tk, cy_), colour, 2, cv2.LINE_AA)
            cv2.line(result, (cx_, cy_), (cx_, cy_ + dy * tk), colour, 2, cv2.LINE_AA)

        # Centre crosshair
        cxc = (x1 + x2) // 2
        cyc = (y1 + y2) // 2
        cv2.line(result, (cxc - 6, cyc), (cxc + 6, cyc), colour, 1, cv2.LINE_AA)
        cv2.line(result, (cxc, cyc - 6), (cxc, cyc + 6), colour, 1, cv2.LINE_AA)

        # ── 5. Label badge ───────────────────────────────────────────────────
        disp_label = label.replace("_", " ").upper()
        badge_text = f"#{i+1}  {disp_label}  {int(conf_val * 100)}%"
        font       = cv2.FONT_HERSHEY_SIMPLEX
        fscale     = 0.38
        fthick     = 1
        (tw, th), baseline = cv2.getTextSize(badge_text, font, fscale, fthick)

        bx0 = x1
        by0 = max(0, y1 - th - baseline - 6)
        bx1 = min(w, bx0 + tw + 10)
        by1 = by0 + th + baseline + 6

        # Badge background (semi-opaque dark)
        badge_bg = result.copy()
        cv2.rectangle(badge_bg, (bx0, by0), (bx1, by1), (15, 15, 25), -1)
        result = cv2.addWeighted(result, 0.35, badge_bg, 0.65, 0)

        # Badge coloured left bar
        cv2.rectangle(result, (bx0, by0), (bx0 + 3, by1), colour, -1)

        # Text
        cv2.putText(
            result, badge_text,
            (bx0 + 6, by0 + th + 2),
            font, fscale, colour, fthick, cv2.LINE_AA,
        )

        legend_entries.append((colour, f"#{i+1} {disp_label}"))

    # ── 6. Legend panel (bottom-right) ───────────────────────────────────────
    if legend_entries:
        leg_font   = cv2.FONT_HERSHEY_SIMPLEX
        leg_fscale = 0.33
        leg_lh     = 18          # line height px
        leg_pad    = 8
        leg_w      = 180
        leg_h      = leg_pad * 2 + len(legend_entries) * leg_lh + 16

        lx0 = max(0, w - leg_w - 8)
        ly0 = max(0, h - leg_h - 8)
        lx1 = min(w, lx0 + leg_w)
        ly1 = min(h, ly0 + leg_h)

        # Background
        panel = result.copy()
        cv2.rectangle(panel, (lx0, ly0), (lx1, ly1), (12, 12, 20), -1)
        cv2.rectangle(panel, (lx0, ly0), (lx1, ly1), (60, 60, 80), 1)
        result = cv2.addWeighted(result, 0.25, panel, 0.75, 0)

        # Header
        cv2.putText(
            result, "DETECTED DEFECTS",
            (lx0 + leg_pad, ly0 + leg_pad + 10),
            leg_font, 0.30, (160, 160, 180), 1, cv2.LINE_AA,
        )

        for j, (col, txt) in enumerate(legend_entries):
            ty = ly0 + leg_pad + 18 + j * leg_lh
            # Colour dot
            cv2.circle(result, (lx0 + leg_pad + 4, ty + 4), 4, col, -1)
            cv2.putText(
                result, txt,
                (lx0 + leg_pad + 12, ty + 8),
                leg_font, leg_fscale, (220, 220, 230), 1, cv2.LINE_AA,
            )

    # ── 7. Header bar with model tag ─────────────────────────────────────────
    bar_h = 20
    header = result.copy()
    cv2.rectangle(header, (0, 0), (w, bar_h), (10, 10, 20), -1)
    result = cv2.addWeighted(result, 0.3, header, 0.7, 0)
    cv2.putText(
        result,
        "U-Net++ SEGMENTATION  |  AI OVERLAY DEFECT MAP",
        (8, bar_h - 5),
        cv2.FONT_HERSHEY_SIMPLEX, 0.30,
        (0, 210, 255), 1, cv2.LINE_AA,
    )
    # Scan-line accent
    cv2.line(result, (0, bar_h), (w, bar_h), (0, 180, 255), 1)

    return result
