from __future__ import annotations

from video_worker.app.manim_templates import (
    ComparisonScene, CoordinateScene, DefinitionsScene, DerivationScene, ExampleScene, FormulaBuildScene, FractionVisualScene, GeometryScene, GoalScene, HookScene, KeyPointScene, NumberLineScene, PlotScene, QuizScene, RecapScene, StepByStepScene, SummaryScene, TableScene, TitleScene, TransitionScene, WarningScene,
)

class JobScene00(TableScene):
    def __init__(self, **kwargs):
        super().__init__(headers=['Шаг', 'Действие', 'Промежуточный результат'], rows=[['1', 'Упростить скобки', 'x^2+2x+1'], ['2', 'Вынести общий множитель', 'x(x+2)+1'], ['3', 'Проверить ОДЗ', 'x\\neq 0'], ['4', 'Подставить значение', '\\frac{25}{4}']], highlight_row=2, **kwargs)

