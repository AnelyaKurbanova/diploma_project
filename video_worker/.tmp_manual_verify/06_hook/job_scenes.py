from __future__ import annotations

from video_worker.app.manim_templates import (
    ComparisonScene, CoordinateScene, DefinitionsScene, DerivationScene, ExampleScene, FormulaBuildScene, FractionVisualScene, GeometryScene, GoalScene, HookScene, KeyPointScene, NumberLineScene, PlotScene, QuizScene, RecapScene, StepByStepScene, SummaryScene, TableScene, TitleScene, TransitionScene, WarningScene,
)

class JobScene00(HookScene):
    def __init__(self, **kwargs):
        super().__init__(text='Можно ли решить большую задачу быстрее, если сначала увидеть скрытую структуру и только потом подставлять числа?', **kwargs)

