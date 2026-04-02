from __future__ import annotations

from video_worker.app.manim_templates import (
    ComparisonScene, CoordinateScene, DefinitionsScene, DerivationScene, ExampleScene, FormulaBuildScene, FractionVisualScene, GeometryScene, GoalScene, HookScene, KeyPointScene, NumberLineScene, PlotScene, QuizScene, RecapScene, StepByStepScene, SummaryScene, TableScene, TitleScene, TransitionScene, WarningScene,
)

class JobScene00(FormulaBuildScene):
    def __init__(self, **kwargs):
        super().__init__(parts=[{'latex': 'S=\\frac{a_1+a_n}{2}\\cdot n', 'annotation': 'Базовая формула суммы арифметической прогрессии'}, {'latex': 'a_n=a_1+(n-1)d', 'annotation': 'Подставляем общий член через первый и разность'}, {'latex': 'S=\\frac{2a_1+(n-1)d}{2}\\cdot n', 'annotation': 'Получаем развернутый итоговый вид'}], **kwargs)

