from __future__ import annotations

from typing import Iterable, Mapping
import re

from manim import (
    DOWN,
    LEFT,
    RIGHT,
    UP,
    FadeIn,
    MathTex,
    Text,
    VGroup,
    Scene,
    config,
)
from manim.animation.composition import LaggedStart
from manim.utils.rate_functions import smooth

from ._style import FORMULA_COLOR, FORMULA_SCALE, PREV_STEP_COLOR

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


class DefinitionsScene(Scene):
    def __init__(
        self,
        items: Iterable[Mapping[str, str]],
        **kwargs,
    ) -> None:
        super().__init__(**kwargs)
        self._items = list(items)

    def construct(self) -> None:  # type: ignore[override]
        lines = []
        for item in self._items:
            label = item.get("label", "")
            value = item.get("value_latex", "")
            label_mobj = (
                Text(_latex_macros_to_unicode(f"{label}:")) if label else None
            )
            value_mobj = None
            if value:
                try:
                    value_mobj = MathTex(value).scale(FORMULA_SCALE)
                    value_mobj.set_color(FORMULA_COLOR)
                except Exception:
                    value_mobj = Text(value).scale(FORMULA_SCALE * 0.9)
                    value_mobj.set_color(FORMULA_COLOR)
            if label_mobj:
                label_mobj.scale(1.0)
                label_mobj.set_color(PREV_STEP_COLOR)

            if label_mobj and value_mobj:
                line_group = VGroup(label_mobj, value_mobj).arrange(
                    direction=RIGHT, buff=0.5
                )
            elif label_mobj:
                line_group = label_mobj
            elif value_mobj:
                line_group = value_mobj
            else:
                continue

            lines.append(line_group)

        group = VGroup(*lines).arrange(direction=DOWN, aligned_edge=LEFT, buff=0.6)
        max_width = config.frame_width * 0.92
        if group.width > max_width:
            group.scale_to_fit_width(max_width)
        group.move_to(self.camera.frame_center)

        # Elements appear one by one with LaggedStart
        self.play(
            LaggedStart(
                *[FadeIn(line) for line in lines],
                lag_ratio=0.35,
                rate_func=smooth,
            ),
            run_time=2.5,
        )

        # Subtle movement if static (avoid empty feel)
        if len(lines) >= 1:
            self.play(
                group.animate.shift(UP * 0.2),
                rate_func=smooth,
                run_time=1.0,
            )
            self.play(
                group.animate.shift(DOWN * 0.2),
                rate_func=smooth,
                run_time=1.0,
            )

        self.wait(3.5)
