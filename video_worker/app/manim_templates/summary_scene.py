from __future__ import annotations

from manim import (
    DOWN,
    UP,
    Circumscribe,
    FadeIn,
    MathTex,
    Scene,
    Text,
    VGroup,
    Write,
    config,
)
from manim.utils.rate_functions import smooth

from ._common import add_background, latex_to_text, safe_fit, section_label, wrap_text_lines
from ._style import (
    ACCENT,
    DIM,
    FINAL_RESULT_SCALE,
    FORMULA_COLOR,
    FORMULA_SCALE_LARGE,
    HIGHLIGHT_COLOR,
    TEXT_COLOR,
)


class SummaryScene(Scene):
    def __init__(self, final_latex: str, text: str, **kwargs) -> None:
        super().__init__(**kwargs)
        self._final_latex = final_latex
        self._text = text

    def construct(self) -> None:  # type: ignore[override]
        add_background(self)

        sec = section_label("Итог")
        self.play(FadeIn(sec, shift=DOWN * 0.1), rate_func=smooth, run_time=0.35)

        try:
            formula = MathTex(self._final_latex)
        except Exception:
            formula = Text(latex_to_text(self._final_latex), color=FORMULA_COLOR, font_size=40)

        formula.scale(FORMULA_SCALE_LARGE)
        safe_fit(formula, max_w=config.frame_width * 0.88, max_h=config.frame_height * 0.4)
        formula.set_color(FORMULA_COLOR)
        formula.move_to(self.camera.frame_center + UP * 0.8)

        self.play(Write(formula), rate_func=smooth, run_time=1.2)
        self.wait(0.3)

        self.play(
            formula.animate.scale(FINAL_RESULT_SCALE)
            .move_to(self.camera.frame_center + UP * 0.5)
            .set_color(HIGHLIGHT_COLOR),
            rate_func=smooth,
            run_time=0.8,
        )
        safe_fit(formula, max_w=config.frame_width * 0.88, max_h=config.frame_height * 0.4)

        self.play(
            Circumscribe(formula, color=ACCENT, buff=0.15, fade_out=True),
            run_time=1.0,
        )

        summary_str = wrap_text_lines(latex_to_text(self._text), max_chars=50)
        summary = Text(summary_str, color=DIM, font_size=30, line_spacing=1.3)
        safe_fit(summary, max_w=config.frame_width * 0.85, max_h=config.frame_height * 0.3)
        summary.next_to(formula, direction=DOWN, buff=0.5)

        combined = VGroup(formula, summary)
        if combined.height > config.frame_height * 0.85:
            combined.scale_to_fit_height(config.frame_height * 0.8)
            combined.move_to(self.camera.frame_center)

        self.play(FadeIn(summary, shift=UP * 0.15), rate_func=smooth, run_time=0.8)
        self.wait(2.5)
