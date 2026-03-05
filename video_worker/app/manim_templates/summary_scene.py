from __future__ import annotations

import re

from manim import (
    DOWN,
    UP,
    MathTex,
    Text,
    Write,
    Scene,
    config,
)
from manim.utils.rate_functions import smooth

from ._style import (
    FORMULA_COLOR,
    FORMULA_SCALE_LARGE,
    HIGHLIGHT_COLOR,
    FINAL_RESULT_SCALE,
    PREV_STEP_COLOR,
)

_UNICODE_MACROS = {
    r"\pi": "π",
    r"\cdot": "·",
}


def _latex_macros_to_unicode(text: str) -> str:
    """Replace a small set of common LaTeX macros with Unicode equivalents."""
    for macro, ch in _UNICODE_MACROS.items():
        text = text.replace(macro, ch)
    text = re.sub(r"\\sqrt\{([^}]+)\}", r"√\1", text)
    return text


class SummaryScene(Scene):
    def __init__(self, final_latex: str, text: str, **kwargs) -> None:
        super().__init__(**kwargs)
        self._final_latex = final_latex
        self._text = text

    def construct(self) -> None:  # type: ignore[override]
        try:
            formula = MathTex(self._final_latex)
        except Exception:
            formula = Text(self._final_latex)

        formula.scale(FORMULA_SCALE_LARGE)
        max_width = config.frame_width * 0.92
        if formula.width > max_width:
            formula.scale_to_fit_width(max_width)

        # Large formula in center (BLUE), then highlight final result
        formula.set_color(FORMULA_COLOR)
        formula.move_to(self.camera.frame_center + UP * 0.3)
        self.play(Write(formula), rate_func=smooth, run_time=1.2)
        self.wait(0.3)

        # Final result: scale up, center, briefly highlight in YELLOW
        self.play(
            formula.animate.scale(FINAL_RESULT_SCALE).move_to(
                self.camera.frame_center
            ).set_color(HIGHLIGHT_COLOR),
            rate_func=smooth,
            run_time=1.0,
        )

        summary_text = _latex_macros_to_unicode(self._text)
        summary = Text(summary_text).scale(0.9)
        summary.set_color(PREV_STEP_COLOR)
        if summary.width > max_width:
            summary.scale_to_fit_width(max_width)
        summary.next_to(formula, direction=DOWN, buff=0.6)
        summary.set_opacity(0)
        self.add(summary)
        self.play(
            summary.animate.set_opacity(1),
            rate_func=smooth,
            run_time=1.0,
        )

        self.wait(2.5)
