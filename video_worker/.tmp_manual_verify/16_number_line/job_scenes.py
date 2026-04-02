from __future__ import annotations

from video_worker.app.manim_templates import (
    ComparisonScene, CoordinateScene, DefinitionsScene, DerivationScene, ExampleScene, FormulaBuildScene, FractionVisualScene, GeometryScene, GoalScene, HookScene, KeyPointScene, NumberLineScene, PlotScene, QuizScene, RecapScene, StepByStepScene, SummaryScene, TableScene, TitleScene, TransitionScene, WarningScene,
)

class JobScene00(NumberLineScene):
    def __init__(self, **kwargs):
        super().__init__(x_min=-8, x_max=8, points=[{'value': -3, 'label': 'A'}, {'value': 0, 'label': 'O'}, {'value': 5, 'label': 'B'}], interval_start=-3, interval_end=5, **kwargs)

