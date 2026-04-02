from __future__ import annotations

from video_worker.app.manim_templates import (
    ComparisonScene, CoordinateScene, DefinitionsScene, DerivationScene, ExampleScene, FormulaBuildScene, FractionVisualScene, GeometryScene, GoalScene, HookScene, KeyPointScene, NumberLineScene, PlotScene, QuizScene, RecapScene, StepByStepScene, SummaryScene, TableScene, TitleScene, TransitionScene, WarningScene,
)

class JobScene00(GoalScene):
    def __init__(self, **kwargs):
        super().__init__(text='Научиться уверенно применять длинный пошаговый алгоритм и не путать порядок действий даже в сложных примерах с несколькими выражениями', **kwargs)

