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
from manim.utils.rate_functions import smooth

from ._common import add_background, safe_fit, safe_mathtex, section_label, wrap_text_lines
from ._style import (
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
        problem_text = Text(
            wrapped,
            color=HIGHLIGHT_COLOR,
            font_size=FONT_SIZE_BODY,
            line_spacing=1.25,
        )
        safe_fit(problem_text, max_w=config.frame_width * 0.9)

        self.play(FadeIn(problem_text, shift=DOWN * 0.2), rate_func=smooth, run_time=0.8)
        self.wait(1.0)

        step_mobs: list[VGroup] = []
        n_steps = len(self._steps)
        # More steps => slightly smaller formulas and tighter spacing to prevent overlap.
        scale_factor = min(1.0, 6 / max(n_steps, 6))
        formula_scale = FORMULA_SCALE * 0.9 * scale_factor
        row_buff = 0.28 if n_steps >= 6 else 0.35
        col_buff = 0.22 if n_steps >= 6 else 0.3

        for i, step_latex in enumerate(self._steps):
            num = Text(f"{i + 1}.", color=DIM, font_size=FONT_SIZE_SMALL)
            formula = safe_mathtex(step_latex, scale=formula_scale, color=FORMULA_COLOR)
            safe_fit(formula, max_w=config.frame_width * 0.78)
            row = VGroup(num, formula).arrange(RIGHT, buff=col_buff, aligned_edge=UP)
            safe_fit(row, max_w=config.frame_width * 0.9)
            step_mobs.append(row)

        steps_group = VGroup(*step_mobs).arrange(DOWN, aligned_edge=LEFT, buff=row_buff)

        # Compose problem + steps as a single layout and fit it to the frame.
        content = VGroup(problem_text, steps_group).arrange(DOWN, aligned_edge=LEFT, buff=0.55)
        safe_fit(content, max_w=config.frame_width * 0.92, max_h=config.frame_height * 0.82)
        content.move_to(self.camera.frame_center + UP * 0.15)

        # Animate steps in; keep the final frame with content visible.
        for mob in step_mobs:
            self.play(FadeIn(mob, shift=RIGHT * 0.2), rate_func=smooth, run_time=0.6)
            self.wait(0.45)

        self.wait(2.0)
