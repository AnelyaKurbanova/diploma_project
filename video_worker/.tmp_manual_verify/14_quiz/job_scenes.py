from __future__ import annotations

from video_worker.app.manim_templates import (
    ComparisonScene, CoordinateScene, DefinitionsScene, DerivationScene, ExampleScene, FormulaBuildScene, FractionVisualScene, GeometryScene, GoalScene, HookScene, KeyPointScene, NumberLineScene, PlotScene, QuizScene, RecapScene, StepByStepScene, SummaryScene, TableScene, TitleScene, TransitionScene, WarningScene,
)

class JobScene00(QuizScene):
    def __init__(self, **kwargs):
        super().__init__(question='Если выражение уже упрощено, какое ограничение на переменную нужно проверить в самом конце?', answer_latex='x\\neq 0\\;\\text{и}\\;x\\neq 3', explanation='Нужно исключить значения, которые обращают знаменатели в ноль на любом этапе преобразований.', **kwargs)

