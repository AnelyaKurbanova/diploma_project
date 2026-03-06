from __future__ import annotations

from manim import (
    DOWN,
    UP,
    Circumscribe,
    FadeIn,
    FadeOut,
    Flash,
    Scene,
    Text,
    VGroup,
    config,
)
from manim.utils.rate_functions import smooth, there_and_back

from ._common import add_background, safe_fit, safe_mathtex, section_label, wrap_text_lines
from ._style import (
    ACCENT,
    DIM,
    FONT_SIZE_BODY,
    FONT_SIZE_SMALL,
    FORMULA_COLOR,
    FORMULA_SCALE,
    HIGHLIGHT_COLOR,
    SUCCESS_COLOR,
    TEXT_COLOR,
)


class QuizScene(Scene):
    """Pose a question, pause for thinking, then reveal the answer."""

    def __init__(self, question: str, answer_latex: str, explanation: str = "", **kwargs) -> None:
        super().__init__(**kwargs)
        self._question = question
        self._answer_latex = answer_latex
        self._explanation = explanation

    def construct(self) -> None:
        add_background(self)

        sec = section_label("Попробуй сам!")
        self.play(FadeIn(sec, shift=DOWN * 0.1), rate_func=smooth, run_time=0.35)

        wrapped = wrap_text_lines(self._question, max_chars=44)
        q_text = Text(wrapped, color=TEXT_COLOR, font_size=FONT_SIZE_BODY, line_spacing=1.3)
        safe_fit(q_text, max_w=config.frame_width * 0.82, max_h=config.frame_height * 0.35)
        q_text.move_to(self.camera.frame_center + UP * 1.0)

        self.play(FadeIn(q_text, shift=DOWN * 0.2), rate_func=smooth, run_time=0.8)

        thinking = Text("🤔  Подумай...", color=DIM, font_size=FONT_SIZE_SMALL)
        thinking.move_to(self.camera.frame_center)
        self.play(FadeIn(thinking), rate_func=smooth, run_time=0.5)
        self.wait(2.5)
        self.play(FadeOut(thinking), rate_func=smooth, run_time=0.3)

        answer = safe_mathtex(self._answer_latex, scale=FORMULA_SCALE, color=SUCCESS_COLOR)
        safe_fit(answer, max_w=config.frame_width * 0.82)
        answer.move_to(self.camera.frame_center + DOWN * 0.2)

        self.play(FadeIn(answer, shift=UP * 0.3), rate_func=smooth, run_time=0.8)
        self.play(
            Circumscribe(answer, color=ACCENT, buff=0.15, fade_out=True),
            run_time=0.8,
        )

        if self._explanation:
            wrapped_e = wrap_text_lines(self._explanation, max_chars=50)
            expl = Text(wrapped_e, color=DIM, font_size=FONT_SIZE_SMALL, line_spacing=1.2)
            safe_fit(expl, max_w=config.frame_width * 0.82)
            expl.next_to(answer, DOWN, buff=0.45)
            self.play(FadeIn(expl, shift=UP * 0.1), rate_func=smooth, run_time=0.5)

        self.wait(2.0)
