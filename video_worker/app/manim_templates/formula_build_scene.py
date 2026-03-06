from __future__ import annotations

from typing import Iterable, Mapping

from manim import (
    DOWN,
    UP,
    Arrow,
    FadeIn,
    FadeOut,
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
    FONT_SIZE_SMALL,
    FORMULA_COLOR,
    FORMULA_SCALE,
    HIGHLIGHT_COLOR,
)


class FormulaBuildScene(Scene):
    """Build a formula piece by piece — each part appears with an annotation."""

    def __init__(self, parts: Iterable[Mapping[str, str]], **kwargs) -> None:
        super().__init__(**kwargs)
        self._parts = list(parts)

    def construct(self) -> None:
        add_background(self)

        sec = section_label("Формула по частям")
        self.play(FadeIn(sec, shift=DOWN * 0.1), rate_func=smooth, run_time=0.35)

        built_pieces: list = []
        center = self.camera.frame_center

        for part in self._parts:
            latex_str = part.get("latex", "")
            annotation = part.get("annotation", "")

            piece = safe_mathtex(latex_str, scale=FORMULA_SCALE, color=FORMULA_COLOR)
            safe_fit(piece, max_w=config.frame_width * 0.4)

            built_pieces.append(piece)
            formula_row = VGroup(*built_pieces).arrange(buff=0.15)
            safe_fit(formula_row, max_w=config.frame_width * 0.88)
            formula_row.move_to(center + UP * 0.3)

            piece.set_color(HIGHLIGHT_COLOR)
            self.play(FadeIn(piece, shift=UP * 0.2), rate_func=smooth, run_time=0.7)

            if annotation:
                note = Text(annotation, color=DIM, font_size=FONT_SIZE_SMALL)
                safe_fit(note, max_w=config.frame_width * 0.8)
                note.next_to(formula_row, DOWN, buff=0.55)

                arrow = Arrow(
                    note.get_top(),
                    piece.get_bottom() + DOWN * 0.05,
                    color=ACCENT,
                    stroke_width=2,
                    buff=0.1,
                    max_tip_length_to_length_ratio=0.15,
                )

                self.play(FadeIn(note), FadeIn(arrow), rate_func=smooth, run_time=0.5)
                self.wait(1.0)
                self.play(FadeOut(note), FadeOut(arrow), rate_func=smooth, run_time=0.3)

            self.play(piece.animate.set_color(FORMULA_COLOR), rate_func=smooth, run_time=0.3)

        self.wait(2.0)
