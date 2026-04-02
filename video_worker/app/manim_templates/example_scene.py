from __future__ import annotations

from typing import Iterable

from manim import (
    DOWN,
    LEFT,
    RIGHT,
    UP,
    FadeIn,
    FadeOut,
    MathTex,
    Scene,
    Text,
    VGroup,
    config,
)
from manim.animation.composition import LaggedStart
from manim.utils.rate_functions import smooth

from ._common import add_background, safe_fit, safe_mathtex, section_label, wrap_text_lines
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


class ExampleScene(Scene):
    """Worked example: show a problem statement, then reveal solution steps one by one."""

    def __init__(self, problem: str, steps: Iterable[str], **kwargs) -> None:
        super().__init__(**kwargs)
        self._problem = problem
        self._steps = list(steps)

    def construct(self) -> None:
        add_background(self)

        sec = section_label("Пример")
        self.play(FadeIn(sec, shift=DOWN * 0.1), rate_func=smooth, run_time=0.35)

        wrapped = wrap_text_lines(self._problem, max_chars=48)
        problem_text = Text(wrapped, color=HIGHLIGHT_COLOR, font_size=FONT_SIZE_BODY, line_spacing=1.3)
        safe_fit(problem_text, max_w=config.frame_width * 0.85)
        problem_text.to_edge(UP, buff=0.9)

        self.play(FadeIn(problem_text, shift=DOWN * 0.2), rate_func=smooth, run_time=0.8)
        self.wait(1.0)

        step_mobs: list[VGroup] = []
        for i, step_latex in enumerate(self._steps):
            num = Text(f"{i + 1}.", color=DIM, font_size=FONT_SIZE_SMALL)
            formula = safe_mathtex(step_latex, scale=FORMULA_SCALE * 0.85, color=FORMULA_COLOR)
            safe_fit(formula, max_w=config.frame_width * 0.72)
            row = VGroup(num, formula).arrange(RIGHT, buff=0.3, aligned_edge=UP)
            step_mobs.append(row)

        steps_group = VGroup(*step_mobs).arrange(DOWN, aligned_edge=LEFT, buff=0.4)
        safe_fit(steps_group, max_w=config.frame_width * 0.88, max_h=config.frame_height * 0.55)
        steps_group.move_to(self.camera.frame_center + DOWN * 0.3)

        for mob in step_mobs:
            self.play(FadeIn(mob, shift=RIGHT * 0.2), rate_func=smooth, run_time=0.7)
            self.wait(0.6)

        self.wait(2.0)
