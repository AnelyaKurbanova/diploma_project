from __future__ import annotations

import math
from typing import Any, Callable

from manim import (
    UP,
    DOWN,
    LEFT,
    Axes,
    Create,
    Dot,
    FadeIn,
    Indicate,
    MathTex,
    MoveAlongPath,
    Scene,
    Text,
    TracedPath,
    VGroup,
    config,
)
from manim.utils.rate_functions import smooth

from ._common import add_background, latex_to_text, safe_fit, safe_mathtex, section_label
from ._style import (
    AXES_X_LENGTH,
    AXES_Y_LENGTH,
    DIM,
    FORMULA_COLOR,
    FORMULA_SCALE,
    HIGHLIGHT_COLOR,
)


def _sample_y_range(
    func: Callable[[float], float],
    x_min: float,
    x_max: float,
    num_samples: int = 20,
    padding: float = 1.0,
) -> tuple[float, float]:
    if x_max <= x_min:
        return -5.0, 5.0
    step = (x_max - x_min) / max(1, num_samples - 1)
    ys: list[float] = []
    for i in range(num_samples):
        x = x_min + i * step
        try:
            y = func(x)
            if math.isfinite(y):
                ys.append(y)
        except (ValueError, ZeroDivisionError):
            pass
    if not ys:
        return -5.0, 5.0
    y_lo, y_hi = min(ys), max(ys)
    if y_lo == y_hi:
        y_lo -= padding
        y_hi += padding
    else:
        pad = (y_hi - y_lo) * 0.1 + padding
        y_lo -= pad
        y_hi += pad
    return y_lo, y_hi


def _eval_func_code(func_code: str) -> Callable[[float], float]:
    safe_globals: dict[str, Any] = {"math": math}
    try:
        obj = eval(func_code.strip(), safe_globals)
    except Exception:
        raise ValueError(f"Invalid func_code: {func_code!r}")
    if not callable(obj):
        raise ValueError(f"func_code must evaluate to a callable, got {type(obj)}")
    return obj  # type: ignore[return-value]


class PlotScene(Scene):
    def __init__(self, plot_type: str = "quadratic", **kwargs: Any) -> None:
        self._params = dict(kwargs)
        self._func_code = self._params.pop("func_code", None)
        if isinstance(self._func_code, str) and self._func_code.strip():
            self._plot_type = "custom"
        else:
            self._func_code = None
            self._plot_type = (str(plot_type) or "quadratic").strip().lower()
        super().__init__()

    def _get_x_bounds(self) -> tuple[float, float]:
        x_min = self._params.get("x_min", -5.0)
        x_max = self._params.get("x_max", 5.0)
        try:
            return float(x_min), float(x_max)
        except (TypeError, ValueError):
            return -5.0, 5.0

    def _make_func(self) -> Callable[[float], float]:
        if self._func_code:
            try:
                return _eval_func_code(self._func_code)
            except ValueError:
                pass
        if self._plot_type == "linear":
            slope = float(self._params.get("slope", 1.0))
            intercept = float(self._params.get("intercept", 0.0))
            return lambda x: slope * x + intercept
        if self._plot_type == "sine":
            amplitude = float(self._params.get("amplitude", 1.0))
            frequency = float(self._params.get("frequency", 1.0))
            return lambda x: amplitude * math.sin(frequency * x)
        if self._plot_type == "cosine":
            amplitude = float(self._params.get("amplitude", 1.0))
            frequency = float(self._params.get("frequency", 1.0))
            return lambda x: amplitude * math.cos(frequency * x)
        a = float(self._params.get("a", 1.0))
        b = float(self._params.get("b", 0.0))
        c = float(self._params.get("c", 0.0))
        return lambda x: a * x * x + b * x + c

    def _get_highlight_points(
        self, axes: Axes, func: Callable[[float], float]
    ) -> VGroup:
        group = VGroup()
        if self._plot_type != "quadratic":
            return group
        a = float(self._params.get("a", 1.0))
        b = float(self._params.get("b", 0.0))
        c = float(self._params.get("c", 0.0))
        x_min, x_max = self._get_x_bounds()
        if a == 0:
            return group
        try:
            d = b * b - 4 * a * c
            if d < 0:
                return group
            sqrt_d = math.sqrt(d)
            for x_root in ((-b - sqrt_d) / (2 * a), (-b + sqrt_d) / (2 * a)):
                if x_min <= x_root <= x_max:
                    point = axes.c2p(x_root, 0.0)
                    group.add(Dot(point, color=HIGHLIGHT_COLOR, radius=0.1))
        except Exception:
            pass
        return group

    def construct(self) -> None:  # type: ignore[override]
        add_background(self)

        sec = section_label("График")
        self.play(FadeIn(sec, shift=DOWN * 0.1), rate_func=smooth, run_time=0.35)

        x_min, x_max = self._get_x_bounds()
        if x_max <= x_min:
            x_min, x_max = -5.0, 5.0

        func = self._make_func()
        y_lo, y_hi = _sample_y_range(func, x_min, x_max)
        y_step = max((y_hi - y_lo) / 5, 0.5)

        axes = Axes(
            x_range=[x_min, x_max, 1],
            y_range=[y_lo, y_hi, y_step],
            x_length=AXES_X_LENGTH,
            y_length=AXES_Y_LENGTH,
            axis_config={"color": DIM, "stroke_width": 2},
            tips=False,
        )
        axes.move_to(self.camera.frame_center + DOWN * 0.15)

        curve = axes.plot(func, x_range=[x_min, x_max], color=FORMULA_COLOR, stroke_width=3)
        highlights = self._get_highlight_points(axes, func)
        area = None

        a_param = self._params.get("a", None)
        b_param = self._params.get("b", None)
        if a_param is not None and b_param is not None:
            try:
                a_val = float(a_param)
                b_val = float(b_param)
                if a_val > b_val:
                    a_val, b_val = b_val, a_val
                a_clamped = max(min(a_val, x_max), x_min)
                b_clamped = max(min(b_val, x_max), x_min)
                if b_clamped > a_clamped:
                    try:
                        area = axes.get_area(
                            curve,
                            x_range=(a_clamped, b_clamped),
                            color=HIGHLIGHT_COLOR,
                            opacity=0.35,
                        )
                    except Exception:
                        area = None
            except (TypeError, ValueError):
                area = None

        integral_latex = self._params.get("integral_latex", None)

        x_label = Text("x", color=DIM, font_size=20)
        y_label = Text("y", color=DIM, font_size=20)
        x_label.next_to(axes.x_axis.get_end(), DOWN, buff=0.15)
        y_label.next_to(axes.y_axis.get_end(), LEFT, buff=0.15)

        self.play(Create(axes), rate_func=smooth, run_time=1.0)
        self.play(FadeIn(x_label), FadeIn(y_label), run_time=0.3)
        self.wait(0.3)
        self.play(Create(curve), rate_func=smooth, run_time=1.5)

        dot = Dot(
            axes.c2p(x_min, func(x_min)),
            color=HIGHLIGHT_COLOR,
            radius=0.12,
        )
        trace = TracedPath(
            dot.get_center, stroke_color=FORMULA_COLOR, stroke_width=2.5
        )
        self.add(trace, dot)
        self.play(
            MoveAlongPath(dot, curve),
            rate_func=smooth,
            run_time=2.5,
        )

        if highlights:
            self.play(Create(highlights), rate_func=smooth, run_time=0.6)
            self.wait(0.5)

        if area is not None:
            area.set_fill(color=HIGHLIGHT_COLOR, opacity=0)
            self.add(area)
            self.play(
                area.animate.set_fill(opacity=0.45),
                rate_func=smooth,
                run_time=1.2,
            )

        if isinstance(integral_latex, str) and integral_latex.strip():
            label = safe_mathtex(integral_latex, scale=FORMULA_SCALE, color=FORMULA_COLOR)
            safe_fit(label, max_w=config.frame_width * 0.85)
            label.to_edge(UP, buff=0.5)
            self.play(FadeIn(label, shift=DOWN * 0.15), rate_func=smooth, run_time=0.6)
            if area is not None:
                self.play(Indicate(area), Indicate(label), run_time=0.8)

        self.wait(2.0)
