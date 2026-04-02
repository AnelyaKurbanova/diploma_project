from __future__ import annotations

from typing import Iterable

from manim import (
    DOWN,
    UP,
    FadeIn,
    Indicate,
    MathTable,
    Scene,
    config,
)
from manim.utils.rate_functions import smooth

from ._common import add_background, safe_fit, section_label
from ._style import DIM, FONT_SIZE_SMALL, FORMULA_COLOR, HIGHLIGHT_COLOR, TEXT_COLOR


class TableScene(Scene):
    """Display data in a tabular format with optional row highlighting."""

    def __init__(
        self,
        headers: Iterable[str],
        rows: Iterable[Iterable[str]],
        highlight_row: int = -1,
        **kwargs,
    ) -> None:
        super().__init__(**kwargs)
        self._headers = list(headers)
        self._rows = [list(r) for r in rows]
        self._highlight_row = highlight_row

    def construct(self) -> None:
        add_background(self)

        sec = section_label("Таблица")
        self.play(FadeIn(sec, shift=DOWN * 0.1), rate_func=smooth, run_time=0.35)

        all_rows = [self._headers] + self._rows

        table = MathTable(
            all_rows,
            include_outer_lines=True,
            line_config={"stroke_width": 1.5, "color": DIM},
            element_to_mobject_config={"color": TEXT_COLOR, "font_size": FONT_SIZE_SMALL},
        )
        table.get_horizontal_lines().set_color(DIM)
        table.get_vertical_lines().set_color(DIM)

        for j in range(len(self._headers)):
            entry = table.get_entries((1, j + 1))
            entry.set_color(FORMULA_COLOR)

        safe_fit(table, max_w=config.frame_width * 0.9, max_h=config.frame_height * 0.75)
        table.move_to(self.camera.frame_center + DOWN * 0.1)

        self.play(FadeIn(table), rate_func=smooth, run_time=1.2)

        if 0 <= self._highlight_row < len(self._rows):
            row_idx = self._highlight_row + 2
            entries = [table.get_entries((row_idx, j + 1)) for j in range(len(self._headers))]
            for e in entries:
                e.set_color(HIGHLIGHT_COLOR)
            self.play(*[Indicate(e, color=HIGHLIGHT_COLOR) for e in entries], run_time=0.8)

        self.wait(3.0)
