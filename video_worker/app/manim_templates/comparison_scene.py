from __future__ import annotations

from manim import (
    DOWN,
    LEFT,
    RIGHT,
    UP,
    DashedLine,
    FadeIn,
    Line,
    Scene,
    Text,
    VGroup,
    config,
)
from manim.utils.rate_functions import smooth

from ._common import add_background, safe_fit, safe_mathtex, section_label, wrap_text_lines
from ._style import (
    DIM,
    ERROR_COLOR,
    FONT_SIZE_BODY,
    FONT_SIZE_SMALL,
    FORMULA_SCALE,
    SUCCESS_COLOR,
    TEXT_COLOR,
)


class ComparisonScene(Scene):
    """Side-by-side comparison — e.g. correct vs incorrect or method A vs B."""

    def __init__(
        self,
        left_title: str,
        left_content: str,
        right_title: str,
        right_content: str,
        left_is_correct: bool = True,
        **kwargs,
    ) -> None:
        super().__init__(**kwargs)
        self._left_title = left_title
        self._left_content = left_content
        self._right_title = right_title
        self._right_content = right_content
        self._left_correct = left_is_correct

    def construct(self) -> None:
        add_background(self)

        sec = section_label("Сравнение")
        self.play(FadeIn(sec, shift=DOWN * 0.1), rate_func=smooth, run_time=0.35)

        left_color = SUCCESS_COLOR if self._left_correct else ERROR_COLOR
        right_color = ERROR_COLOR if self._left_correct else SUCCESS_COLOR

        lt = Text(self._left_title, color=left_color, font_size=FONT_SIZE_BODY)
        rt = Text(self._right_title, color=right_color, font_size=FONT_SIZE_BODY)

        lc = safe_mathtex(self._left_content, scale=FORMULA_SCALE * 0.85, color=left_color)
        rc = safe_mathtex(self._right_content, scale=FORMULA_SCALE * 0.85, color=right_color)

        half_w = config.frame_width * 0.42

        left_col = VGroup(lt, lc).arrange(DOWN, buff=0.5)
        safe_fit(left_col, max_w=half_w, max_h=config.frame_height * 0.6)
        left_col.move_to(LEFT * config.frame_width * 0.22 + DOWN * 0.1)

        right_col = VGroup(rt, rc).arrange(DOWN, buff=0.5)
        safe_fit(right_col, max_w=half_w, max_h=config.frame_height * 0.6)
        right_col.move_to(RIGHT * config.frame_width * 0.22 + DOWN * 0.1)

        divider = DashedLine(
            UP * config.frame_height * 0.35,
            DOWN * config.frame_height * 0.35,
            color=DIM,
            stroke_width=2,
            dash_length=0.15,
        )

        self.play(FadeIn(divider), rate_func=smooth, run_time=0.4)
        self.play(
            FadeIn(left_col, shift=RIGHT * 0.2),
            rate_func=smooth,
            run_time=0.8,
        )
        self.wait(0.5)
        self.play(
            FadeIn(right_col, shift=LEFT * 0.2),
            rate_func=smooth,
            run_time=0.8,
        )
        self.wait(3.0)
