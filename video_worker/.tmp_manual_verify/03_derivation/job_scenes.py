from __future__ import annotations

from video_worker.app.manim_templates import (
    ComparisonScene, CoordinateScene, DefinitionsScene, DerivationScene, ExampleScene, FormulaBuildScene, FractionVisualScene, GeometryScene, GoalScene, HookScene, KeyPointScene, NumberLineScene, PlotScene, QuizScene, RecapScene, StepByStepScene, SummaryScene, TableScene, TitleScene, TransitionScene, WarningScene,
)

class JobScene00(DerivationScene):
    def __init__(self, **kwargs):
        super().__init__(steps=['\\left(\\frac{x^2+2x+1}{x+1}\\right)^2', '=\\frac{(x+1)^4}{(x+1)^2}', '=(x+1)^2', '=x^2+2x+1', '=\\frac{1}{2}\\left(2x^2+4x+2\\right)', '=\\frac{1}{2}\\left((x+1)^2+(x+1)^2\\right)', '=x^2+2x+1'], **kwargs)

