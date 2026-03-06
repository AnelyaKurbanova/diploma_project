from __future__ import annotations

from typing import Iterable, Mapping

from manim import (
    DOWN,
    UP,
    Arrow,
    Create,
    Dot,
    FadeIn,
    NumberPlane,
    Scene,
    Text,
    VGroup,
    config,
)
from manim.utils.rate_functions import smooth

from ._common import add_background, safe_fit, section_label
from ._style import DIM, FONT_SIZE_SMALL, FORMULA_COLOR, HIGHLIGHT_COLOR, TEXT_COLOR


class CoordinateScene(Scene):
    """Points and optional vectors on a coordinate plane."""

    def __init__(
        self,
        x_range: Iterable[float] = (-5, 5, 1),
        y_range: Iterable[float] = (-4, 4, 1),
        points: Iterable[Mapping[str, object]] | None = None,
        vectors: Iterable[Mapping[str, object]] | None = None,
        **kwargs,
    ) -> None:
        super().__init__(**kwargs)
        self._x_range = list(x_range)
        self._y_range = list(y_range)
        self._points = list(points or [])
        self._vectors = list(vectors or [])

    def construct(self) -> None:
        add_background(self)

        sec = section_label("Координатная плоскость")
        self.play(FadeIn(sec, shift=DOWN * 0.1), rate_func=smooth, run_time=0.35)

        plane = NumberPlane(
            x_range=self._x_range,
            y_range=self._y_range,
            x_length=config.frame_width * 0.75,
            y_length=config.frame_height * 0.7,
            background_line_style={"stroke_color": DIM, "stroke_opacity": 0.3, "stroke_width": 1},
            axis_config={"color": DIM, "stroke_width": 2},
        )
        plane.move_to(self.camera.frame_center + DOWN * 0.1)
        self.play(Create(plane), rate_func=smooth, run_time=1.0)

        for pt in self._points:
            x = float(pt.get("x", 0))
            y = float(pt.get("y", 0))
            label_str = str(pt.get("label", f"({x},{y})"))
            dot = Dot(plane.c2p(x, y), color=FORMULA_COLOR, radius=0.1)
            lbl = Text(label_str, color=FORMULA_COLOR, font_size=FONT_SIZE_SMALL - 4)
            lbl.next_to(dot, UP + DOWN * 0.0, buff=0.2)
            lbl.next_to(dot, UP, buff=0.2)
            self.play(FadeIn(dot, scale=1.5), FadeIn(lbl), rate_func=smooth, run_time=0.5)

        for vec in self._vectors:
            x1 = float(vec.get("x1", 0))
            y1 = float(vec.get("y1", 0))
            x2 = float(vec.get("x2", 1))
            y2 = float(vec.get("y2", 1))
            label_str = str(vec.get("label", ""))
            arrow = Arrow(
                plane.c2p(x1, y1),
                plane.c2p(x2, y2),
                color=HIGHLIGHT_COLOR,
                stroke_width=3,
                buff=0,
            )
            self.play(Create(arrow), rate_func=smooth, run_time=0.6)
            if label_str:
                lbl = Text(label_str, color=HIGHLIGHT_COLOR, font_size=FONT_SIZE_SMALL - 4)
                lbl.next_to(arrow.get_center(), UP, buff=0.15)
                self.play(FadeIn(lbl), run_time=0.3)

        self.wait(2.5)
