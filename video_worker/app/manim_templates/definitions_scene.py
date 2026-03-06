from __future__ import annotations

from typing import Iterable, Mapping

from manim import (
    DOWN,
    LEFT,
    RIGHT,
    UP,
    FadeIn,
    Line,
    MathTex,
    Scene,
    Text,
    VGroup,
    config,
)
from manim.animation.composition import LaggedStart
from manim.utils.rate_functions import smooth

from ._common import add_background, latex_to_text, safe_fit, section_label
from ._style import DIM, FORMULA_COLOR, FORMULA_SCALE, TEXT_COLOR


class DefinitionsScene(Scene):
    def __init__(
        self,
        items: Iterable[Mapping[str, str]],
        **kwargs,
    ) -> None:
        super().__init__(**kwargs)
        self._items = list(items)

    def construct(self) -> None:  # type: ignore[override]
        add_background(self)

        sec = section_label("Определения")
        self.play(FadeIn(sec, shift=DOWN * 0.1), rate_func=smooth, run_time=0.4)

        n_items = len(self._items)
        row_scale = min(FORMULA_SCALE, FORMULA_SCALE * (4 / max(n_items, 4)))

        rows: list[VGroup] = []
        for item in self._items:
            label = item.get("label", "")
            value = item.get("value_latex", "")

            label_mobj = None
            if label:
                label_mobj = Text(
                    latex_to_text(f"{label}:"),
                    color=DIM,
                    font_size=32,
                )

            value_mobj = None
            if value:
                try:
                    value_mobj = MathTex(value).scale(row_scale)
                    value_mobj.set_color(FORMULA_COLOR)
                except Exception:
                    value_mobj = Text(
                        latex_to_text(value), color=FORMULA_COLOR, font_size=36,
                    )

            accent = Line(
                UP * 0.3, DOWN * 0.3,
                color=FORMULA_COLOR,
                stroke_width=3,
                stroke_opacity=0.5,
            )

            parts = [accent]
            if label_mobj:
                parts.append(label_mobj)
            if value_mobj:
                parts.append(value_mobj)
            if len(parts) == 1:
                continue

            row = VGroup(*parts).arrange(direction=RIGHT, buff=0.35)
            rows.append(row)

        if not rows:
            return

        group = VGroup(*rows).arrange(direction=DOWN, aligned_edge=LEFT, buff=0.5)
        safe_fit(group, max_w=config.frame_width * 0.88, max_h=config.frame_height * 0.7)
        group.move_to(self.camera.frame_center + DOWN * 0.15)

        self.play(
            LaggedStart(
                *[FadeIn(row, shift=RIGHT * 0.3) for row in rows],
                lag_ratio=0.3,
                rate_func=smooth,
            ),
            run_time=2.2,
        )
        self.wait(3.0)
