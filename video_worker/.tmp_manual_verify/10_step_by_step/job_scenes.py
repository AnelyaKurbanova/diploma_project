from __future__ import annotations

from video_worker.app.manim_templates import (
    ComparisonScene, CoordinateScene, DefinitionsScene, DerivationScene, ExampleScene, FormulaBuildScene, FractionVisualScene, GeometryScene, GoalScene, HookScene, KeyPointScene, NumberLineScene, PlotScene, QuizScene, RecapScene, StepByStepScene, SummaryScene, TableScene, TitleScene, TransitionScene, WarningScene,
)

class JobScene00(StepByStepScene):
    def __init__(self, **kwargs):
        super().__init__(title='Подробный алгоритм решения задачи с длинными формулировками', steps=['Шаг 1: внимательно перепиши условие и выдели ключевые данные', 'Шаг 2: выбери подходящую формулу и объясни почему именно ее', 'Шаг 3: подставь значения и сократи выражение максимально аккуратно', 'Шаг 4: проверь знак, область допустимых значений и итоговую запись'], **kwargs)

