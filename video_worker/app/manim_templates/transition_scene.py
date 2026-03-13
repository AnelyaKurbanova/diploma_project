from __future__ import annotations

from manim import (
    DOWN,
    LEFT,
    RIGHT,
    UP,
    FadeIn,
    FadeOut,
    Line,
    Scene,
    Text,
    Write,
    config,
)
from manim.utils.rate_functions import smooth

from ._common import add_background, safe_fit
from ._style import DIM, FONT_SIZE_HEADING, FORMULA_COLOR, TEXT_COLOR


class TransitionScene(Scene):
    """Short section divider between major lesson blocks."""

    def __init__(self, text: str, **kwargs) -> None:
        super().__init__(**kwargs)
        self._text = text

    def construct(self) -> None:
        add_background(self)

        msg = Text(self._text, color=TEXT_COLOR, font_size=FONT_SIZE_HEADING)
        safe_fit(msg, max_w=config.frame_width * 0.78)
        msg.move_to(self.camera.frame_center)

        line_left = Line(
            msg.get_left() + LEFT * 0.3,
            msg.get_left() + LEFT * 2.5,
            color=FORMULA_COLOR,
            stroke_width=2,
            stroke_opacity=0.5,
        )
        line_right = Line(
            msg.get_right() + RIGHT * 0.3,
            msg.get_right() + RIGHT * 2.5,
            color=FORMULA_COLOR,
            stroke_width=2,
            stroke_opacity=0.5,
        )

        self.play(FadeIn(msg, shift=UP * 0.2), rate_func=smooth, run_time=0.7)
        self.play(Write(line_left), Write(line_right), rate_func=smooth, run_time=0.5)
        self.wait(1.2)
        self.play(
            FadeOut(msg, shift=UP * 0.2),
            FadeOut(line_left),
            FadeOut(line_right),
            rate_func=smooth,
            run_time=0.5,
        )
