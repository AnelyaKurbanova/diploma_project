from __future__ import annotations

from manim import (
    DOWN,
    LEFT,
    RIGHT,
    UP,
    Create,
    FadeIn,
    Rectangle,
    Scene,
    Text,
    VGroup,
    config,
)
from manim.utils.rate_functions import smooth

from ._common import add_background, safe_fit, safe_mathtex, section_label
from ._style import (
    ACCENT,
    DIM,
    FONT_SIZE_BODY,
    FONT_SIZE_SMALL,
    FORMULA_COLOR,
    FORMULA_SCALE,
    HIGHLIGHT_COLOR,
    TEXT_COLOR,
)


class FractionVisualScene(Scene):
    """Visual fraction representation using divided rectangles."""

    def __init__(
        self,
        numerator: int = 1,
        denominator: int = 4,
        label: str = "",
        **kwargs,
    ) -> None:
        super().__init__(**kwargs)
        self._num = max(0, int(numerator))
        self._den = max(1, int(denominator))
        self._label = label

    def construct(self) -> None:
        add_background(self)

        sec = section_label("Дробь наглядно")
        self.play(FadeIn(sec, shift=DOWN * 0.1), rate_func=smooth, run_time=0.35)

        fraction_str = f"\\frac{{{self._num}}}{{{self._den}}}"
        if self._label:
            fraction_str = f"{self._label} = {fraction_str}"

        formula = safe_mathtex(fraction_str, scale=FORMULA_SCALE, color=FORMULA_COLOR)
        safe_fit(formula, max_w=config.frame_width * 0.6)
        formula.to_edge(UP, buff=1.0)
        self.play(FadeIn(formula, shift=DOWN * 0.15), rate_func=smooth, run_time=0.7)

        total_w = min(config.frame_width * 0.7, self._den * 0.8)
        cell_w = total_w / self._den
        cell_h = 1.2

        cells: list[Rectangle] = []
        for i in range(self._den):
            cell = Rectangle(width=cell_w, height=cell_h, stroke_color=DIM, stroke_width=2)
            if i < self._num:
                cell.set_fill(HIGHLIGHT_COLOR, opacity=0.5)
            else:
                cell.set_fill(DIM, opacity=0.08)
            cells.append(cell)

        grid = VGroup(*cells).arrange(RIGHT, buff=0)
        safe_fit(grid, max_w=config.frame_width * 0.85)
        grid.move_to(self.camera.frame_center + DOWN * 0.4)

        self.play(
            *[Create(c) for c in cells],
            rate_func=smooth,
            run_time=1.0,
        )

        filled = [c for i, c in enumerate(cells) if i < self._num]
        if filled:
            for c in filled:
                self.play(
                    c.animate.set_fill(HIGHLIGHT_COLOR, opacity=0.65),
                    rate_func=smooth,
                    run_time=0.3,
                )

        count_text = Text(
            f"{self._num} из {self._den} частей",
            color=TEXT_COLOR,
            font_size=FONT_SIZE_SMALL,
        )
        count_text.next_to(grid, DOWN, buff=0.45)
        self.play(FadeIn(count_text, shift=UP * 0.1), rate_func=smooth, run_time=0.5)

        self.wait(2.5)
