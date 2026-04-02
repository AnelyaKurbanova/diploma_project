from __future__ import annotations

from video_worker.app.manim_templates import (
    ComparisonScene, CoordinateScene, DefinitionsScene, DerivationScene, ExampleScene, FormulaBuildScene, FractionVisualScene, GeometryScene, GoalScene, HookScene, KeyPointScene, NumberLineScene, PlotScene, QuizScene, RecapScene, StepByStepScene, SummaryScene, TableScene, TitleScene, TransitionScene, WarningScene,
)

class JobScene00(PlotScene):
    def __init__(self, **kwargs):
        super().__init__(func_code='lambda x: (x**3 - 2*x**2 + x - 1)/(x**2 + 1)', x_min=-6.0, x_max=6.0, **kwargs)

