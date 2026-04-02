from __future__ import annotations

from video_worker.app.manim_templates import (
    ComparisonScene, CoordinateScene, DefinitionsScene, DerivationScene, ExampleScene, FormulaBuildScene, FractionVisualScene, GeometryScene, GoalScene, HookScene, KeyPointScene, NumberLineScene, PlotScene, QuizScene, RecapScene, StepByStepScene, SummaryScene, TableScene, TitleScene, TransitionScene, WarningScene,
)

class JobScene00(WarningScene):
    def __init__(self, **kwargs):
        super().__init__(title='Типичная ошибка при сокращении дробей с длинным пояснением', wrong_latex='\\frac{x^2+2x}{x}=x+2x', correct_latex='\\frac{x^2+2x}{x}=x+2,\\;x\\neq 0', explanation='Сокращать можно только общий множитель, но нельзя сокращать слагаемые по отдельности внутри суммы.', **kwargs)

