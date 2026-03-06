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
    config,
)
from manim.utils.rate_functions import smooth

from ._common import add_background, safe_fit, safe_mathtex, section_label, wrap_text_lines
from ._style import (
    ACCENT,
    DIM,
    FONT_SIZE_BODY,
    FONT_SIZE_SMALL,
    FORMULA_COLOR,
    FORMULA_SCALE_LARGE,
    HIGHLIGHT_COLOR,
    TEXT_COLOR,
)


class KeyPointScene(Scene):
    """Highlight a single critical rule or formula inside a prominent box."""

    def __init__(self, title: str, formula_latex: str, explanation: str = "", **kwargs) -> None:
        super().__init__(**kwargs)
        self._title = title
        self._formula_latex = formula_latex
        self._explanation = explanation

    def construct(self) -> None:
        add_background(self)

        sec = section_label("Ключевое правило")
        self.play(FadeIn(sec, shift=DOWN * 0.1), rate_func=smooth, run_time=0.35)

        heading = Text(self._title, color=TEXT_COLOR, font_size=FONT_SIZE_BODY)
        safe_fit(heading, max_w=config.frame_width * 0.8)
        heading.move_to(self.camera.frame_center + UP * 2.0)
        self.play(FadeIn(heading, shift=DOWN * 0.15), rate_func=smooth, run_time=0.6)

        formula = safe_mathtex(self._formula_latex, scale=FORMULA_SCALE_LARGE, color=FORMULA_COLOR)
        safe_fit(formula, max_w=config.frame_width * 0.78, max_h=config.frame_height * 0.3)
        formula.move_to(self.camera.frame_center + UP * 0.3)

        box = RoundedRectangle(
            corner_radius=0.25,
            width=formula.width + 1.0,
            height=formula.height + 0.8,
            stroke_color=HIGHLIGHT_COLOR,
            stroke_width=3,
            fill_color=HIGHLIGHT_COLOR,
            fill_opacity=0.08,
        )
        box.move_to(formula.get_center())

        self.play(FadeIn(box), rate_func=smooth, run_time=0.4)
        self.play(FadeIn(formula, shift=UP * 0.15), rate_func=smooth, run_time=0.8)
        self.play(
            Circumscribe(formula, color=ACCENT, buff=0.2, fade_out=True),
            run_time=1.0,
        )
        self.play(Flash(formula, color=ACCENT, flash_radius=0.5), run_time=0.4)

        if self._explanation:
            wrapped = wrap_text_lines(self._explanation, max_chars=50)
            expl = Text(wrapped, color=DIM, font_size=FONT_SIZE_SMALL, line_spacing=1.3)
            safe_fit(expl, max_w=config.frame_width * 0.82)
            expl.next_to(box, DOWN, buff=0.5)
            self.play(FadeIn(expl, shift=UP * 0.1), rate_func=smooth, run_time=0.6)

        self.wait(2.5)
