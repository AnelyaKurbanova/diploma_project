from __future__ import annotations

from manim import (
    DOWN,
    LEFT,
    RIGHT,
    UP,
    Circumscribe,
    FadeIn,
    Flash,
    Line,
    Scene,
    Text,
    VGroup,
    Write,
    config,
)
from manim.utils.rate_functions import smooth, there_and_back

from ._common import add_background, latex_to_text, safe_fit
from ._style import ACCENT, DIM, FONT_SIZE_TITLE, FORMULA_COLOR, HIGHLIGHT_COLOR, TEXT_COLOR


class TitleScene(Scene):
    def __init__(self, title: str, **kwargs) -> None:
        super().__init__(**kwargs)
        self._title = title

    def construct(self) -> None:  # type: ignore[override]
        add_background(self)

        title_str = latex_to_text(self._title)
        title_text = Text(title_str, color=FORMULA_COLOR, font_size=FONT_SIZE_TITLE)
        safe_fit(title_text, max_w=config.frame_width * 0.82)
        title_text.move_to(self.camera.frame_center + UP * 0.6)

        deco_line_left = Line(
            start=title_text.get_center() + DOWN * 0.45,
            end=title_text.get_left() + DOWN * 0.45 + LEFT * 0.2,
            color=FORMULA_COLOR,
            stroke_width=3,
            stroke_opacity=0.6,
        )
        deco_line_right = Line(
            start=title_text.get_center() + DOWN * 0.45,
            end=title_text.get_right() + DOWN * 0.45 + RIGHT * 0.2,
            color=FORMULA_COLOR,
            stroke_width=3,
            stroke_opacity=0.6,
        )

        subtitle_text = Text("Математика просто", color=DIM, font_size=32)
        subtitle_text.move_to(title_text.get_center() + DOWN * 1.0)

        self.play(FadeIn(title_text, shift=UP * 0.3), rate_func=smooth, run_time=1.0)
        self.play(
            Write(deco_line_left),
            Write(deco_line_right),
            rate_func=smooth,
            run_time=0.7,
        )
        self.play(FadeIn(subtitle_text, shift=UP * 0.15), rate_func=smooth, run_time=0.7)

        self.wait(0.5)
        self.play(
            title_text.animate.scale(1.05),
            rate_func=there_and_back,
            run_time=0.6,
        )
        self.play(
            Circumscribe(title_text, color=ACCENT, fade_out=True, buff=0.15),
            run_time=1.0,
        )
        self.play(Flash(title_text, color=HIGHLIGHT_COLOR, flash_radius=0.4), run_time=0.4)
        self.wait(1.0)
