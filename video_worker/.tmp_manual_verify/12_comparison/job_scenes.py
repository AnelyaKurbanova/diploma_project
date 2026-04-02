from __future__ import annotations

from video_worker.app.manim_templates import (
    ComparisonScene, CoordinateScene, DefinitionsScene, DerivationScene, ExampleScene, FormulaBuildScene, FractionVisualScene, GeometryScene, GoalScene, HookScene, KeyPointScene, NumberLineScene, PlotScene, QuizScene, RecapScene, StepByStepScene, SummaryScene, TableScene, TitleScene, TransitionScene, WarningScene,
)

class JobScene00(ComparisonScene):
    def __init__(self, **kwargs):
        super().__init__(left_title='Длинный заголовок правильного метода', left_content='\\frac{x^2-1}{x-1}=x+1,\\;x\\neq 1', right_title='Длинный заголовок ошибочного метода', right_content='\\frac{x^2-1}{x-1}=x-1', left_is_correct=True, **kwargs)

