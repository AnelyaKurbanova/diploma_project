from __future__ import annotations

from typing import Iterable

from manim import (
    DOWN,
    UP,
    Circumscribe,
    FadeIn,
    FadeOut,
    Flash,
    MathTex,
    ReplacementTransform,
    Scene,
    Text,
    TransformMatchingTex,
    config,
)
from manim.utils.rate_functions import smooth

from ._common import add_background, safe_fit, section_label
from ._style import (
    ACCENT,
    DIM,
    FINAL_RESULT_SCALE,
    FORMULA_COLOR,
    FORMULA_SCALE,
    HIGHLIGHT_COLOR,
    PREV_STEP_COLOR,
)


class DerivationScene(Scene):
    def __init__(self, steps: Iterable[str], **kwargs) -> None:
        super().__init__(**kwargs)
        self._steps = list(steps)

    def _make_formula(self, latex: str):
        try:
            mob = MathTex(latex)
        except Exception:
            mob = Text(latex)
        mob.scale(FORMULA_SCALE)
        max_w = config.frame_width * 0.88
        if mob.width > max_w:
            mob.scale_to_fit_width(max_w)
        return mob

    def construct(self) -> None:  # type: ignore[override]
        if not self._steps:
            return

        add_background(self)

        sec = section_label("Вывод")
        self.play(FadeIn(sec, shift=DOWN * 0.1), rate_func=smooth, run_time=0.35)

        total = len(self._steps)

        counter = Text(f"1 / {total}", color=DIM, font_size=24)
        counter.to_edge(DOWN, buff=0.4)
        self.play(FadeIn(counter), run_time=0.3)

        current = self._make_formula(self._steps[0])
        current.set_color(FORMULA_COLOR)
        current.move_to(self.camera.frame_center)

        self.play(FadeIn(current, shift=UP * 0.2), rate_func=smooth, run_time=0.8)
        self.wait(0.8)

        for i, step in enumerate(self._steps[1:], start=2):
            next_tex = self._make_formula(step)
            next_tex.set_color(FORMULA_COLOR)
            next_tex.move_to(self.camera.frame_center)

            self.play(
                current.animate.set_color(PREV_STEP_COLOR).set_opacity(0.85),
                rate_func=smooth,
                run_time=0.25,
            )

            new_counter = Text(f"{i} / {total}", color=DIM, font_size=24)
            new_counter.to_edge(DOWN, buff=0.4)

            if isinstance(current, MathTex) and isinstance(next_tex, MathTex):
                self.play(
                    TransformMatchingTex(current, next_tex),
                    ReplacementTransform(counter, new_counter),
                    rate_func=smooth,
                    run_time=1.2,
                )
            else:
                self.play(
                    ReplacementTransform(current, next_tex),
                    ReplacementTransform(counter, new_counter),
                    rate_func=smooth,
                    run_time=1.0,
                )

            counter = new_counter
            next_tex.set_color(FORMULA_COLOR)
            current = next_tex
            self.wait(0.8)

        self.play(
            current.animate.scale(FINAL_RESULT_SCALE)
            .move_to(self.camera.frame_center)
            .set_color(HIGHLIGHT_COLOR),
            rate_func=smooth,
            run_time=0.8,
        )
        safe_fit(current)
        self.play(
            Circumscribe(current, color=ACCENT, buff=0.2, fade_out=True),
            run_time=1.0,
        )
        self.play(Flash(current, color=ACCENT, flash_radius=0.6), run_time=0.5)
        self.wait(1.5)
