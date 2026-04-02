from __future__ import annotations

from video_worker.app.manim_templates import (
    ComparisonScene, CoordinateScene, DefinitionsScene, DerivationScene, ExampleScene, FormulaBuildScene, FractionVisualScene, GeometryScene, GoalScene, HookScene, KeyPointScene, NumberLineScene, PlotScene, QuizScene, RecapScene, StepByStepScene, SummaryScene, TableScene, TitleScene, TransitionScene, WarningScene,
)

class JobScene00(FractionVisualScene):
    def __init__(self, **kwargs):
        super().__init__(numerator=7, denominator=12, label='Семь двенадцатых долей фигуры', **kwargs)

