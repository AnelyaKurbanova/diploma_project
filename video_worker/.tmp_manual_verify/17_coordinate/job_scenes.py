from __future__ import annotations

from video_worker.app.manim_templates import (
    ComparisonScene, CoordinateScene, DefinitionsScene, DerivationScene, ExampleScene, FormulaBuildScene, FractionVisualScene, GeometryScene, GoalScene, HookScene, KeyPointScene, NumberLineScene, PlotScene, QuizScene, RecapScene, StepByStepScene, SummaryScene, TableScene, TitleScene, TransitionScene, WarningScene,
)

class JobScene00(CoordinateScene):
    def __init__(self, **kwargs):
        super().__init__(x_range=[-8, 8, 1], y_range=[-6, 6, 1], points=[{'x': -4, 'y': 3, 'label': 'P'}, {'x': 3, 'y': -2, 'label': 'Q'}], vectors=[{'x1': 0, 'y1': 0, 'x2': 5, 'y2': 4, 'label': 'v'}, {'x1': -2, 'y1': -1, 'x2': 2, 'y2': 3, 'label': 'u'}], **kwargs)

