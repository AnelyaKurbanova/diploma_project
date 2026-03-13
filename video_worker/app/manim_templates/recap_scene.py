from __future__ import annotations

from typing import Iterable

from manim import (
    DOWN,
    LEFT,
    RIGHT,
    UP,
    FadeIn,
    Scene,
    Text,
    VGroup,
    config,
)
from manim.animation.composition import LaggedStart
from manim.utils.rate_functions import smooth

from ._common import add_background, safe_fit, section_label, wrap_text_lines
from ._style import DIM, FONT_SIZE_BODY, FONT_SIZE_SMALL, SUCCESS_COLOR, TEXT_COLOR


class RecapScene(Scene):
    """Quick review of prerequisite concepts as a bullet list with checkmarks."""

    def __init__(self, items: Iterable[str], **kwargs) -> None:
        super().__init__(**kwargs)
        self._items = list(items)

    def construct(self) -> None:
        add_background(self)

        sec = section_label("Вспомним")
        self.play(FadeIn(sec, shift=DOWN * 0.1), rate_func=smooth, run_time=0.35)

        rows: list[VGroup] = []
        for item_text in self._items:
            check = Text("✓", color=SUCCESS_COLOR, font_size=FONT_SIZE_BODY)
            wrapped = wrap_text_lines(item_text, max_chars=45)
            label = Text(wrapped, color=TEXT_COLOR, font_size=FONT_SIZE_SMALL, line_spacing=1.3)
            row = VGroup(check, label).arrange(RIGHT, buff=0.3, aligned_edge=UP)
            rows.append(row)

        group = VGroup(*rows).arrange(DOWN, aligned_edge=LEFT, buff=0.45)
        safe_fit(group, max_w=config.frame_width * 0.85, max_h=config.frame_height * 0.7)
        group.move_to(self.camera.frame_center + DOWN * 0.1)

        self.play(
            LaggedStart(
                *[FadeIn(r, shift=RIGHT * 0.2) for r in rows],
                lag_ratio=0.35,
                rate_func=smooth,
            ),
            run_time=max(1.5, len(rows) * 0.6),
        )
        self.wait(2.5)
