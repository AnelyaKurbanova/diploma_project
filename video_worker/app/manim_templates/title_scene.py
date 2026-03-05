from __future__ import annotations

import re

from manim import (
    DOWN,
    UP,
    Rectangle,
    Scene,
    Text,
    VGroup,
    Write,
    config,
)
from manim.utils.rate_functions import smooth

from ._style import FORMULA_COLOR

# Soft gradient: dark blue to slightly lighter (single fill, no frame dependency)
_BG_DARK = "#0a1628"
_BG_LIGHT = "#1a2d4a"


_UNICODE_MACROS = {
    r"\pi": "π",
    r"\cdot": "·",
}


def _latex_macros_to_unicode(text: str) -> str:
    """Replace a small set of common LaTeX macros with Unicode equivalents."""
    for macro, ch in _UNICODE_MACROS.items():
        text = text.replace(macro, ch)
    # \sqrt{x} -> √x (simple inline style)
    text = re.sub(r"\\sqrt\{([^}]+)\}", r"√\1", text)
    return text


def _make_gradient_background() -> VGroup:
    """Soft gradient-like background (two rectangles for gradient effect)."""
    w, h = config.frame_width * 1.2, config.frame_height * 1.2
    r1 = Rectangle(width=w, height=h, fill_opacity=0.95)
    r1.set_fill(color=_BG_DARK)
    r1.set_stroke(opacity=0)
    r2 = Rectangle(width=w, height=h * 0.6, fill_opacity=0.4)
    r2.set_fill(color=_BG_LIGHT)
    r2.set_stroke(opacity=0)
    r2.next_to(r1.get_top(), DOWN, buff=0)
    return VGroup(r1, r2)


class TitleScene(Scene):
    def __init__(self, title: str, **kwargs) -> None:
        super().__init__(**kwargs)
        self._title = title

    def construct(self) -> None:  # type: ignore[override]
        # Soft gradient background (keep dark)
        bg = _make_gradient_background()
        bg.move_to(self.camera.frame_center)
        self.add(bg)

        # Hierarchy: title at top, subtitle below
        title_text = Text(_latex_macros_to_unicode(self._title))
        title_text.set_color(FORMULA_COLOR)
        max_width = config.frame_width * 0.85
        if title_text.width > max_width:
            title_text.scale_to_fit_width(max_width)
        title_text.scale(1.2)
        title_text.to_edge(UP, buff=0.8)

        subtitle_text = Text("Математика просто").scale(0.75)
        subtitle_text.next_to(title_text, DOWN, buff=0.6)

        self.add(title_text)
        title_text.set_opacity(0)
        self.play(
            title_text.animate.set_opacity(1),
            rate_func=smooth,
            run_time=1.0,
        )
        self.play(Write(subtitle_text), rate_func=smooth, run_time=0.9)
        self.wait(0.5)

        # Subtle camera movement: shift frame slightly up then back (content moves down then up)
        group = VGroup(title_text, subtitle_text)
        self.play(
            group.animate.shift(DOWN * 0.3),
            rate_func=smooth,
            run_time=1.0,
        )
        self.play(
            group.animate.shift(UP * 0.3),
            rate_func=smooth,
            run_time=1.0,
        )
        self.wait(1.0)
