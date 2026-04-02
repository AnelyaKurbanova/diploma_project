from __future__ import annotations

from video_worker.app.manim_templates import (
    ComparisonScene, CoordinateScene, DefinitionsScene, DerivationScene, ExampleScene, FormulaBuildScene, FractionVisualScene, GeometryScene, GoalScene, HookScene, KeyPointScene, NumberLineScene, PlotScene, QuizScene, RecapScene, StepByStepScene, SummaryScene, TableScene, TitleScene, TransitionScene, WarningScene,
)

class JobScene00(GeometryScene):
    def __init__(self, **kwargs):
        super().__init__(shape='triangle', labels={'A': 'A', 'B': 'B', 'C': 'C', 'a': '12', 'b': '13', 'c': '5'}, title='Треугольник с длинным пояснением по сторонам и углам', **kwargs)

