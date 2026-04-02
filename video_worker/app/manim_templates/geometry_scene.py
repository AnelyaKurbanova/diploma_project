from __future__ import annotations

from typing import Iterable, Mapping

import math

from manim import (
    DOWN,
    LEFT,
    RIGHT,
    UP,
    Angle,
    Brace,
    Circle,
    Create,
    Dot,
    FadeIn,
    Line,
    Polygon,
    Scene,
    Text,
    VGroup,
    config,
)
from manim.utils.rate_functions import smooth

from ._common import add_background, safe_fit, section_label
from ._style import (
    ACCENT,
    DIM,
    FONT_SIZE_SMALL,
    FORMULA_COLOR,
    HIGHLIGHT_COLOR,
    TEXT_COLOR,
)


class GeometryScene(Scene):
    """Draw geometric shapes with labels and measurements.

    Supports: triangle, rectangle, circle.
    """

    def __init__(
        self,
        shape: str = "triangle",
        labels: Mapping[str, str] | None = None,
        title: str = "",
        **kwargs,
    ) -> None:
        super().__init__(**kwargs)
        self._shape = shape.lower().strip()
        self._labels = dict(labels or {})
        self._title = title

    def construct(self) -> None:
        add_background(self)

        sec = section_label("Геометрия")
        self.play(FadeIn(sec, shift=DOWN * 0.1), rate_func=smooth, run_time=0.35)

        if self._title:
            heading = Text(self._title, color=TEXT_COLOR, font_size=36)
            safe_fit(heading, max_w=config.frame_width * 0.8)
            heading.to_edge(UP, buff=0.85)
            self.play(FadeIn(heading, shift=DOWN * 0.15), rate_func=smooth, run_time=0.5)

        center = self.camera.frame_center + DOWN * 0.15

        if self._shape == "circle":
            self._draw_circle(center)
        elif self._shape == "rectangle":
            self._draw_rectangle(center)
        else:
            self._draw_triangle(center)

        self.wait(3.0)

    def _draw_triangle(self, center):
        A = center + UP * 1.5
        B = center + DOWN * 1.0 + LEFT * 1.8
        C = center + DOWN * 1.0 + RIGHT * 1.8
        tri = Polygon(A, B, C, color=FORMULA_COLOR, stroke_width=3)
        self.play(Create(tri), rate_func=smooth, run_time=1.0)

        verts = {"A": A, "B": B, "C": C}
        offsets = {"A": UP * 0.3, "B": DOWN * 0.3 + LEFT * 0.2, "C": DOWN * 0.3 + RIGHT * 0.2}
        for name, pos in verts.items():
            label_str = self._labels.get(name, name)
            dot = Dot(pos, color=HIGHLIGHT_COLOR, radius=0.07)
            lbl = Text(label_str, color=HIGHLIGHT_COLOR, font_size=FONT_SIZE_SMALL)
            lbl.next_to(pos, offsets[name], buff=0.15)
            self.play(FadeIn(dot), FadeIn(lbl), run_time=0.3)

        side_a = self._labels.get("a", "")
        if side_a:
            brace = Brace(Line(B, C), DOWN, color=DIM)
            brace_lbl = brace.get_text(side_a, font_size=FONT_SIZE_SMALL)
            brace_lbl.set_color(ACCENT)
            self.play(FadeIn(brace), FadeIn(brace_lbl), run_time=0.5)

    def _draw_rectangle(self, center):
        w = float(self._labels.get("width_val", 3))
        h = float(self._labels.get("height_val", 2))
        from manim import Rectangle

        rect = Rectangle(width=w, height=h, color=FORMULA_COLOR, stroke_width=3)
        rect.move_to(center)
        self.play(Create(rect), rate_func=smooth, run_time=1.0)

        w_label = self._labels.get("width", str(w))
        h_label = self._labels.get("height", str(h))

        brace_w = Brace(rect, DOWN, color=DIM)
        brace_w_lbl = brace_w.get_text(w_label, font_size=FONT_SIZE_SMALL)
        brace_w_lbl.set_color(ACCENT)

        brace_h = Brace(rect, RIGHT, color=DIM)
        brace_h_lbl = brace_h.get_text(h_label, font_size=FONT_SIZE_SMALL)
        brace_h_lbl.set_color(ACCENT)

        self.play(FadeIn(brace_w), FadeIn(brace_w_lbl), run_time=0.5)
        self.play(FadeIn(brace_h), FadeIn(brace_h_lbl), run_time=0.5)

    def _draw_circle(self, center):
        r = float(self._labels.get("radius_val", 1.5))
        circ = Circle(radius=r, color=FORMULA_COLOR, stroke_width=3)
        circ.move_to(center)
        self.play(Create(circ), rate_func=smooth, run_time=1.0)

        center_dot = Dot(center, color=HIGHLIGHT_COLOR, radius=0.07)
        radius_line = Line(center, center + RIGHT * r, color=ACCENT, stroke_width=2.5)
        r_label = self._labels.get("radius", f"r={r}")
        r_lbl = Text(r_label, color=ACCENT, font_size=FONT_SIZE_SMALL)
        r_lbl.next_to(radius_line, UP, buff=0.15)

        self.play(FadeIn(center_dot), Create(radius_line), run_time=0.6)
        self.play(FadeIn(r_lbl), run_time=0.3)
