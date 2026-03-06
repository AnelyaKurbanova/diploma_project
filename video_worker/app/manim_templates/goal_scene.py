from __future__ import annotations

from manim import (
    Create,
    DOWN,
    FadeIn,
    FadeOut,
    Scene,
    Text,
    Underline,
    Write,
    config,
)
from manim.utils.rate_functions import smooth

from ._common import add_background, latex_to_text, safe_fit, section_label, wrap_text_lines
from ._style import DIM, FORMULA_COLOR, TEXT_COLOR


class GoalScene(Scene):
    def __init__(self, text: str, **kwargs) -> None:
        super().__init__(**kwargs)
        self._text = text

    def construct(self) -> None:  # type: ignore[override]
        add_background(self)

        sec = section_label("Цель")
        self.play(FadeIn(sec, shift=DOWN * 0.1), rate_func=smooth, run_time=0.4)

        clean = latex_to_text(self._text)
        wrapped = wrap_text_lines(clean, max_chars=45)

        goal = Text(wrapped, color=TEXT_COLOR, font_size=40, line_spacing=1.4)
        safe_fit(goal, max_w=config.frame_width * 0.82, max_h=config.frame_height * 0.55)
        goal.move_to(self.camera.frame_center)

        self.play(Write(goal), rate_func=smooth, run_time=1.8)

        ul = Underline(goal, color=FORMULA_COLOR, stroke_width=2.5, buff=0.2)
        self.play(Create(ul), rate_func=smooth, run_time=0.5)

        self.wait(2.2)
        self.play(
            FadeOut(goal, shift=DOWN * 0.2),
            FadeOut(ul, shift=DOWN * 0.2),
            rate_func=smooth,
            run_time=0.7,
        )
