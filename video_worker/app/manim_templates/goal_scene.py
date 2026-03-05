from __future__ import annotations

import re

from manim import (
    Create,
    RIGHT,
    Scene,
    Text,
    Underline,
    VGroup,
    Write,
    config,
)
from manim.utils.rate_functions import smooth

from ._style import FORMULA_COLOR, FORMULA_SCALE


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


def _split_first_word(text: str) -> tuple[str, str]:
    """Split into first word and the rest (for keyword highlighting)."""
    stripped = text.strip()
    if not stripped:
        return "", ""
    parts = stripped.split(maxsplit=1)
    return (parts[0], parts[1] if len(parts) > 1 else "")


class GoalScene(Scene):
    def __init__(self, text: str, **kwargs) -> None:
        super().__init__(**kwargs)
        self._text = text

    def construct(self) -> None:  # type: ignore[override]
        first_word, rest = _split_first_word(_latex_macros_to_unicode(self._text))
        max_width = config.frame_width * 0.88

        if rest:
            # Hierarchy: keyword (BLUE) + explanation
            kw = Text(first_word, color=FORMULA_COLOR).scale(FORMULA_SCALE)
            rest_m = Text(rest).scale(FORMULA_SCALE * 0.95)
            goal = VGroup(kw, rest_m).arrange(direction=RIGHT, buff=0.25)
        else:
            goal = Text(first_word or self._text).scale(FORMULA_SCALE)
            goal.set_color(FORMULA_COLOR)

        if goal.width > max_width:
            goal.scale_to_fit_width(max_width)
        goal.move_to(self.camera.frame_center)

        self.play(Write(goal), rate_func=smooth, run_time=1.8)

        ul = Underline(goal, color=FORMULA_COLOR)
        self.play(Create(ul), rate_func=smooth, run_time=0.6)

        self.wait(2.2)
        self.play(
            goal.animate.set_opacity(0),
            ul.animate.set_opacity(0),
            rate_func=smooth,
            run_time=0.8,
        )
