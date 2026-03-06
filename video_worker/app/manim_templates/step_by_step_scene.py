from __future__ import annotations

from typing import Iterable

from manim import (
    DOWN,
    LEFT,
    RIGHT,
    UP,
    Circle,
    FadeIn,
    Scene,
    Text,
    VGroup,
    config,
)
from manim.utils.rate_functions import smooth

from ._common import add_background, safe_fit, section_label, wrap_text_lines
from ._style import (
    DIM,
    FONT_SIZE_BODY,
    FONT_SIZE_SMALL,
    FORMULA_COLOR,
    TEXT_COLOR,
)


class StepByStepScene(Scene):
    """Numbered procedural guide — each step shown with a circled number."""

    def __init__(self, title: str, steps: Iterable[str], **kwargs) -> None:
        super().__init__(**kwargs)
        self._title = title
        self._steps = list(steps)

    def construct(self) -> None:
        add_background(self)

        sec = section_label("Алгоритм")
        self.play(FadeIn(sec, shift=DOWN * 0.1), rate_func=smooth, run_time=0.35)

        heading = Text(self._title, color=TEXT_COLOR, font_size=FONT_SIZE_BODY)
        safe_fit(heading, max_w=config.frame_width * 0.82)
        heading.to_edge(UP, buff=0.85)
        self.play(FadeIn(heading, shift=DOWN * 0.15), rate_func=smooth, run_time=0.6)

        rows: list[VGroup] = []
        for i, step_text in enumerate(self._steps):
            circle = Circle(radius=0.22, color=FORMULA_COLOR, stroke_width=2.5, fill_opacity=0.15)
            circle.set_fill(FORMULA_COLOR)
            num = Text(str(i + 1), color=FORMULA_COLOR, font_size=20)
            num.move_to(circle.get_center())
            badge = VGroup(circle, num)

            wrapped = wrap_text_lines(step_text, max_chars=44)
            label = Text(wrapped, color=TEXT_COLOR, font_size=FONT_SIZE_SMALL, line_spacing=1.3)
            row = VGroup(badge, label).arrange(RIGHT, buff=0.35, aligned_edge=UP)
            rows.append(row)

        group = VGroup(*rows).arrange(DOWN, aligned_edge=LEFT, buff=0.4)
        safe_fit(group, max_w=config.frame_width * 0.88, max_h=config.frame_height * 0.6)
        group.move_to(self.camera.frame_center + DOWN * 0.15)

        for row in rows:
            self.play(FadeIn(row, shift=RIGHT * 0.2), rate_func=smooth, run_time=0.65)
            self.wait(0.5)

        self.wait(2.0)
