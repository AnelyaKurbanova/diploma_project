"""Shared visual style for Manim scenes (3Blue1Brown-inspired)."""

from manim import BLUE, YELLOW

# Consistent colors across all scenes
FORMULA_COLOR = BLUE  # main formulas
HIGHLIGHT_COLOR = YELLOW  # important numbers, final answer
PREV_STEP_COLOR = "#888888"  # previous steps (grey)

# Formula scale: target width ~6-8 units on manim's frame (default width 14.22)
FORMULA_SCALE = 1.6
FORMULA_SCALE_LARGE = 1.8  # for dominant center formula
FINAL_RESULT_SCALE = 1.5  # scale up for final answer highlight

# Graph: axes should occupy most of the frame
AXES_X_LENGTH = 10
AXES_Y_LENGTH = 6
