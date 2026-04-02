from __future__ import annotations

from video_worker.app.manim_templates import (
    ComparisonScene, CoordinateScene, DefinitionsScene, DerivationScene, ExampleScene, FormulaBuildScene, FractionVisualScene, GeometryScene, GoalScene, HookScene, KeyPointScene, NumberLineScene, PlotScene, QuizScene, RecapScene, StepByStepScene, SummaryScene, TableScene, TitleScene, TransitionScene, WarningScene,
)

class JobScene00(RecapScene):
    def __init__(self, **kwargs):
        super().__init__(items=['Сначала упрощаем скобки и дроби', 'Потом приводим подобные члены', 'Только после этого подставляем значения', 'Проверяем ответ обратной подстановкой', 'Оцениваем, разумен ли полученный результат'], **kwargs)

