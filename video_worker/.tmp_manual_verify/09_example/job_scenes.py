from __future__ import annotations

from video_worker.app.manim_templates import (
    ComparisonScene, CoordinateScene, DefinitionsScene, DerivationScene, ExampleScene, FormulaBuildScene, FractionVisualScene, GeometryScene, GoalScene, HookScene, KeyPointScene, NumberLineScene, PlotScene, QuizScene, RecapScene, StepByStepScene, SummaryScene, TableScene, TitleScene, TransitionScene, WarningScene,
)

class JobScene00(ExampleScene):
    def __init__(self, **kwargs):
        super().__init__(problem='Реши пример с длинным условием и несколькими преобразованиями без пропусков шагов', steps=['\\frac{(x^2-9)}{(x-3)}', '=\\frac{(x-3)(x+3)}{(x-3)}', '=x+3', '\\text{при }x\\neq 3'], **kwargs)

