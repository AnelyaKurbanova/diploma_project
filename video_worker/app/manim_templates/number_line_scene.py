from __future__ import annotations

from typing import Iterable, Mapping

from manim import (
    DOWN,
    UP,
    Brace,
    Create,
    Dot,
    FadeIn,
    NumberLine,
    Scene,
    Text,
    VGroup,
    config,
)
from manim.utils.rate_functions import smooth

from ._common import add_background, safe_fit, section_label
from ._style import DIM, FONT_SIZE_SMALL, FORMULA_COLOR, HIGHLIGHT_COLOR, TEXT_COLOR


class NumberLineScene(Scene):
    """Number line with marked points and optional interval highlights."""

    def __init__(
        self,
        x_min: float = -5,
        x_max: float = 5,
        points: Iterable[Mapping[str, object]] | None = None,
        interval_start: float | None = None,
        interval_end: float | None = None,
        **kwargs,
    ) -> None:
        super().__init__(**kwargs)
        self._x_min = float(x_min)
        self._x_max = float(x_max)
        self._points = list(points or [])
        self._interval_start = interval_start
        self._interval_end = interval_end

    def construct(self) -> None:
        add_background(self)

        sec = section_label("Числовая прямая")
        self.play(FadeIn(sec, shift=DOWN * 0.1), rate_func=smooth, run_time=0.35)

        nl = NumberLine(
            x_range=[self._x_min, self._x_max, 1],
            length=config.frame_width * 0.78,
            color=DIM,
            include_numbers=True,
            numbers_to_include=list(range(int(self._x_min), int(self._x_max) + 1)),
            font_size=FONT_SIZE_SMALL,
            label_direction=DOWN,
        )
        nl.move_to(self.camera.frame_center)
        self.play(Create(nl), rate_func=smooth, run_time=1.0)

        if self._interval_start is not None and self._interval_end is not None:
            s = max(self._interval_start, self._x_min)
            e = min(self._interval_end, self._x_max)
            if e > s:
                start_pt = nl.n2p(s)
                end_pt = nl.n2p(e)
                brace = Brace(
                    VGroup(Dot(start_pt), Dot(end_pt)),
                    direction=UP,
                    color=HIGHLIGHT_COLOR,
                )
                brace_label = brace.get_text(f"[{s}, {e}]", font_size=FONT_SIZE_SMALL)
                brace_label.set_color(HIGHLIGHT_COLOR)
                self.play(FadeIn(brace), FadeIn(brace_label), rate_func=smooth, run_time=0.7)

        for pt_info in self._points:
            val = float(pt_info.get("value", 0))
            label_str = str(pt_info.get("label", ""))
            if val < self._x_min or val > self._x_max:
                continue
            dot = Dot(nl.n2p(val), color=FORMULA_COLOR, radius=0.12)
            self.play(FadeIn(dot, scale=1.5), rate_func=smooth, run_time=0.4)
            if label_str:
                lbl = Text(label_str, color=FORMULA_COLOR, font_size=FONT_SIZE_SMALL - 4)
                lbl.next_to(dot, UP, buff=0.25)
                self.play(FadeIn(lbl), run_time=0.3)

        self.wait(2.5)
