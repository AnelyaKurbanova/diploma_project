from __future__ import annotations

from manim import (
    DOWN,
    UP,
    Cross,
    FadeIn,
    Flash,
    RoundedRectangle,
    Scene,
    Text,
    VGroup,
    config,
)
from manim.utils.rate_functions import smooth

from ._common import add_background, safe_fit, safe_mathtex, section_label, wrap_text_lines
from ._style import (
    DIM,
    ERROR_COLOR,
    FONT_SIZE_BODY,
    FONT_SIZE_SMALL,
    FORMULA_COLOR,
    FORMULA_SCALE,
    SUCCESS_COLOR,
    TEXT_COLOR,
    WARNING_COLOR,
)


class WarningScene(Scene):
    """Show a common mistake with red emphasis, then the correct approach in green."""

    def __init__(
        self,
        title: str,
        wrong_latex: str,
        correct_latex: str,
        explanation: str = "",
        **kwargs,
    ) -> None:
        super().__init__(**kwargs)
        self._title = title
        self._wrong_latex = wrong_latex
        self._correct_latex = correct_latex
        self._explanation = explanation

    def construct(self) -> None:
        add_background(self)

        sec = section_label("Частая ошибка")
        self.play(FadeIn(sec, shift=DOWN * 0.1), rate_func=smooth, run_time=0.35)

        heading = Text(self._title, color=WARNING_COLOR, font_size=FONT_SIZE_BODY)
        safe_fit(heading, max_w=config.frame_width * 0.82)
        heading.to_edge(UP, buff=0.85)
        self.play(FadeIn(heading, shift=DOWN * 0.15), rate_func=smooth, run_time=0.6)

        wrong = safe_mathtex(self._wrong_latex, scale=FORMULA_SCALE, color=ERROR_COLOR)
        safe_fit(wrong, max_w=config.frame_width * 0.78)
        wrong.move_to(self.camera.frame_center + UP * 0.3)

        wrong_box = RoundedRectangle(
            corner_radius=0.15,
            width=wrong.width + 0.8,
            height=wrong.height + 0.5,
            stroke_color=ERROR_COLOR,
            stroke_width=2.5,
            fill_opacity=0.05,
        )
        wrong_box.set_fill(ERROR_COLOR)
        wrong_box.move_to(wrong.get_center())

        self.play(FadeIn(wrong_box), FadeIn(wrong), rate_func=smooth, run_time=0.7)
        self.wait(0.5)

        cross = Cross(wrong, stroke_color=ERROR_COLOR, stroke_width=4)
        self.play(FadeIn(cross), run_time=0.5)
        self.play(Flash(wrong, color=ERROR_COLOR, flash_radius=0.4), run_time=0.3)
        self.wait(0.8)

        correct = safe_mathtex(self._correct_latex, scale=FORMULA_SCALE, color=SUCCESS_COLOR)
        safe_fit(correct, max_w=config.frame_width * 0.78)
        correct.move_to(self.camera.frame_center + DOWN * 1.2)

        correct_label = Text("✓ Правильно:", color=SUCCESS_COLOR, font_size=FONT_SIZE_SMALL)
        correct_label.next_to(correct, UP, buff=0.3)

        self.play(
            FadeIn(correct_label, shift=UP * 0.15),
            FadeIn(correct, shift=UP * 0.15),
            rate_func=smooth,
            run_time=0.8,
        )

        if self._explanation:
            wrapped = wrap_text_lines(self._explanation, max_chars=50)
            expl = Text(wrapped, color=DIM, font_size=FONT_SIZE_SMALL - 4, line_spacing=1.2)
            safe_fit(expl, max_w=config.frame_width * 0.82)
            expl.next_to(correct, DOWN, buff=0.4)
            self.play(FadeIn(expl, shift=UP * 0.1), rate_func=smooth, run_time=0.5)

        self.wait(2.5)
