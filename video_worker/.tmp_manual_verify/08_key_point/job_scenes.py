from __future__ import annotations

from video_worker.app.manim_templates import (
    ComparisonScene, CoordinateScene, DefinitionsScene, DerivationScene, ExampleScene, FormulaBuildScene, FractionVisualScene, GeometryScene, GoalScene, HookScene, KeyPointScene, NumberLineScene, PlotScene, QuizScene, RecapScene, StepByStepScene, SummaryScene, TableScene, TitleScene, TransitionScene, WarningScene,
)

class JobScene00(KeyPointScene):
    def __init__(self, **kwargs):
        super().__init__(title='Ключевое правило преобразования выражений с несколькими уровнями скобок', formula_latex='\\frac{a^2-b^2}{a-b}=a+b\\quad (a\\neq b)', explanation='Сначала замечаем разность квадратов, затем сокращаем общий множитель и только после этого выполняем вычисления.', **kwargs)

