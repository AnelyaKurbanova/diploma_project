from __future__ import annotations

from manim import (
    DOWN,
    UP,
    Circumscribe,
    FadeIn,
    Line,
    Scene,
    Text,
    VGroup,
    Write,
    config,
)
from manim.utils.rate_functions import smooth

from ._common import add_background, latex_to_text, safe_fit
from ._style import ACCENT, DIM, FORMULA_COLOR, TEXT_COLOR


class TitleScene(Scene):
    def __init__(self, title: str, **kwargs) -> None:
        super().__init__(**kwargs)
        self._title = title

    def construct(self) -> None:  # type: ignore[override]
        add_background(self)

        title_str = latex_to_text(self._title)
        title_text = Text(title_str, color=FORMULA_COLOR, font_size=56)
        safe_fit(title_text, max_w=config.frame_width * 0.82)
        title_text.move_to(self.camera.frame_center + UP * 0.6)

        deco_line = Line(
            start=title_text.get_left() + DOWN * 0.35,
            end=title_text.get_right() + DOWN * 0.35,
            color=FORMULA_COLOR,
            stroke_width=3,
            stroke_opacity=0.6,
        )

        subtitle_text = Text("Математика просто", color=DIM, font_size=32)
        subtitle_text.next_to(deco_line, DOWN, buff=0.45)

        self.play(FadeIn(title_text, shift=UP * 0.3), rate_func=smooth, run_time=1.0)
        self.play(
            Write(deco_line),
            rate_func=smooth,
            run_time=0.6,
        )
        self.play(FadeIn(subtitle_text, shift=UP * 0.15), rate_func=smooth, run_time=0.7)

        self.wait(0.4)
        self.play(
            Circumscribe(title_text, color=ACCENT, fade_out=True, buff=0.15),
            run_time=1.2,
        )
        self.wait(1.0)
