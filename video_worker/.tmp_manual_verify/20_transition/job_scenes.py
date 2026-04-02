from __future__ import annotations

from video_worker.app.manim_templates import (
    ComparisonScene, CoordinateScene, DefinitionsScene, DerivationScene, ExampleScene, FormulaBuildScene, FractionVisualScene, GeometryScene, GoalScene, HookScene, KeyPointScene, NumberLineScene, PlotScene, QuizScene, RecapScene, StepByStepScene, SummaryScene, TableScene, TitleScene, TransitionScene, WarningScene,
)

class JobScene00(TransitionScene):
    def __init__(self, **kwargs):
        super().__init__(text='Переходим к самой важной части решения с более сложным примером', **kwargs)

