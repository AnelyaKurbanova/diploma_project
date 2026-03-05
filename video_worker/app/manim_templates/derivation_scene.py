from __future__ import annotations

from typing import Iterable

from manim import (
    DOWN,
    FadeIn,
    FadeOut,
    MathTex,
    Scene,
    Text,
    TransformMatchingTex,
    FadeTransform,
    Brace,
    config,
)
from manim.utils.rate_functions import smooth

from ._style import (
    FORMULA_COLOR,
    FORMULA_SCALE,
    HIGHLIGHT_COLOR,
    FINAL_RESULT_SCALE,
    PREV_STEP_COLOR,
)


class DerivationScene(Scene):
    def __init__(self, steps: Iterable[str], **kwargs) -> None:
        super().__init__(**kwargs)
        self._steps = list(steps)

    def _scale_formula(self, mob):
        """Scale formula to use ~6-8 units width (large, dominant)."""
        mob.scale(FORMULA_SCALE)
        max_width = config.frame_width * 0.92
        if mob.width > max_width:
            mob.scale_to_fit_width(max_width)

    def construct(self) -> None:  # type: ignore[override]
        if not self._steps:
            return

        first = self._steps[0]
        try:
            current = MathTex(first)
        except Exception:
            current = Text(first)
        self._scale_formula(current)
        current.set_color(FORMULA_COLOR)
        current.move_to(self.camera.frame_center)
        self.play(
            current.animate.set_opacity(0),
            rate_func=smooth,
            run_time=0.01,
        )
        self.play(
            current.animate.set_opacity(1),
            rate_func=smooth,
            run_time=0.8,
        )
        self.wait(0.8)

        for step in self._steps[1:]:
            try:
                next_tex = MathTex(step)
            except Exception:
                next_tex = Text(step)
            self._scale_formula(next_tex)
            next_tex.move_to(self.camera.frame_center)

            # Previous step → grey (visual hierarchy)
            self.play(
                current.animate.set_color(PREV_STEP_COLOR).set_opacity(0.9),
                rate_func=smooth,
                run_time=0.2,
            )

            brace = None
            if isinstance(current, MathTex) and isinstance(next_tex, MathTex):
                brace = Brace(current, direction=DOWN, color=FORMULA_COLOR)
                brace.set_opacity(0.85)
                self.play(FadeIn(brace), rate_func=smooth, run_time=0.25)

            if isinstance(current, MathTex) and isinstance(next_tex, MathTex):
                self.play(
                    TransformMatchingTex(current, next_tex),
                    rate_func=smooth,
                    run_time=1.2,
                )
            else:
                self.play(
                    FadeTransform(current, next_tex),
                    rate_func=smooth,
                    run_time=1.0,
                )

            if brace is not None:
                self.play(FadeOut(brace), rate_func=smooth, run_time=0.15)

            next_tex.set_color(FORMULA_COLOR)
            self.play(
                next_tex.animate.set_opacity(1),
                rate_func=smooth,
                run_time=0.2,
            )
            current = next_tex
            self.wait(1.0)

        # Final answer: transform previous equation → center, scale up, highlight in YELLOW
        self.play(
            current.animate.scale(FINAL_RESULT_SCALE).move_to(
                self.camera.frame_center
            ).set_color(HIGHLIGHT_COLOR),
            rate_func=smooth,
            run_time=1.0,
        )
        self.wait(2.0)
