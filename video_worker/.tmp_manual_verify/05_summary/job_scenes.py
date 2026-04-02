from __future__ import annotations

from video_worker.app.manim_templates import (
    ComparisonScene, CoordinateScene, DefinitionsScene, DerivationScene, ExampleScene, FormulaBuildScene, FractionVisualScene, GeometryScene, GoalScene, HookScene, KeyPointScene, NumberLineScene, PlotScene, QuizScene, RecapScene, StepByStepScene, SummaryScene, TableScene, TitleScene, TransitionScene, WarningScene,
)

class JobScene00(SummaryScene):
    def __init__(self, **kwargs):
        super().__init__(final_latex='\\int_0^1\\frac{x^3+2x^2+1}{x^2+1}\\,dx=\\left[\\frac{x^2}{2}+2x-\\arctan x\\right]_0^1', text='Главная идея: разбиваем выражение на простые части и аккуратно считаем каждую часть отдельно, сохраняя порядок преобразований.', **kwargs)

