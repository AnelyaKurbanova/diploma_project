from __future__ import annotations

from manim import (
    DOWN,
    UP,
    FadeIn,
    FadeOut,
    GrowFromCenter,
    Scene,
    Text,
    VGroup,
    config,
)
from manim.utils.rate_functions import smooth, there_and_back

from ._common import add_background, safe_fit, wrap_text_lines
from ._style import ACCENT, FONT_SIZE_HEADING, FONT_SIZE_TITLE, HIGHLIGHT_COLOR, TEXT_COLOR


class HookScene(Scene):
    """Attention-grabbing opening question or fact."""

    def __init__(self, text: str, **kwargs) -> None:
        super().__init__(**kwargs)
        self._text = text

    def construct(self) -> None:
        add_background(self)

        wrapped = wrap_text_lines(self._text, max_chars=40)
        hook = Text(wrapped, color=TEXT_COLOR, font_size=FONT_SIZE_HEADING, line_spacing=1.4)
        safe_fit(hook, max_w=config.frame_width * 0.82, max_h=config.frame_height * 0.5)
        hook.move_to(self.camera.frame_center + UP * 0.3)

        question_mark = Text("?", color=HIGHLIGHT_COLOR, font_size=96)
        question_mark.next_to(hook, DOWN, buff=0.5)

        self.play(FadeIn(hook, shift=UP * 0.3), rate_func=smooth, run_time=1.0)
        self.play(GrowFromCenter(question_mark), rate_func=smooth, run_time=0.6)

        self.play(
            question_mark.animate.scale(1.3),
            rate_func=there_and_back,
            run_time=0.8,
        )
        self.wait(1.5)

        self.play(
            FadeOut(VGroup(hook, question_mark), shift=UP * 0.3),
            rate_func=smooth,
            run_time=0.6,
        )
