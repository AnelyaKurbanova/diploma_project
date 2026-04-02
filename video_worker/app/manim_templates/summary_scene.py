from __future__ import annotations

from manim import (
    DOWN,
    UP,
    Circumscribe,
    FadeIn,
    Flash,
    RoundedRectangle,
    Scene,
    Text,
    VGroup,
    Write,
    config,
)
from manim.utils.rate_functions import smooth, there_and_back

from ._common import add_background, latex_to_text, safe_fit, safe_mathtex, section_label, wrap_text_lines
from ._style import (
    ACCENT,
    DIM,
    FINAL_RESULT_SCALE,
    FONT_SIZE_SMALL,
    FORMULA_COLOR,
    FORMULA_SCALE_LARGE,
    HIGHLIGHT_COLOR,
    SUCCESS_COLOR,
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

        check = Text("✓", color=SUCCESS_COLOR, font_size=48)
        check.to_edge(UP, buff=0.8).to_edge(UP, buff=0.8)
        check.move_to(self.camera.frame_center + UP * 2.2)
        self.play(FadeIn(check, scale=0.5), rate_func=smooth, run_time=0.4)

        formula = safe_mathtex(self._final_latex, scale=FORMULA_SCALE_LARGE, color=FORMULA_COLOR)
        safe_fit(formula, max_w=config.frame_width * 0.82, max_h=config.frame_height * 0.35)
        formula.move_to(self.camera.frame_center + UP * 0.5)

        box = RoundedRectangle(
            corner_radius=0.2,
            width=formula.width + 0.8,
            height=formula.height + 0.6,
            stroke_color=HIGHLIGHT_COLOR,
            stroke_width=2.5,
            fill_color=HIGHLIGHT_COLOR,
            fill_opacity=0.06,
        )
        box.move_to(formula.get_center())

        self.play(FadeIn(box), rate_func=smooth, run_time=0.3)
        self.play(Write(formula), rate_func=smooth, run_time=1.2)
        self.wait(0.3)

        self.play(
            formula.animate.scale(FINAL_RESULT_SCALE).set_color(HIGHLIGHT_COLOR),
            box.animate.scale(FINAL_RESULT_SCALE),
            rate_func=smooth,
            run_time=0.8,
        )
        safe_fit(formula, max_w=config.frame_width * 0.88, max_h=config.frame_height * 0.4)

        self.play(
            Circumscribe(formula, color=ACCENT, buff=0.15, fade_out=True),
            run_time=0.8,
        )
        self.play(Flash(formula, color=ACCENT, flash_radius=0.5), run_time=0.4)

        summary_str = wrap_text_lines(latex_to_text(self._text), max_chars=50)
        summary = Text(summary_str, color=DIM, font_size=FONT_SIZE_SMALL, line_spacing=1.3)
        safe_fit(summary, max_w=config.frame_width * 0.85, max_h=config.frame_height * 0.25)
        summary.next_to(box, direction=DOWN, buff=0.45)

        combined = VGroup(box, formula, summary)
        if combined.height > config.frame_height * 0.85:
            combined.scale_to_fit_height(config.frame_height * 0.8)
            combined.move_to(self.camera.frame_center)

        self.play(FadeIn(summary, shift=UP * 0.15), rate_func=smooth, run_time=0.8)
        self.wait(3.0)
