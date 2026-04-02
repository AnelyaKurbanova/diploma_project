from __future__ import annotations

from video_worker.app.manim_templates import (
    ComparisonScene, CoordinateScene, DefinitionsScene, DerivationScene, ExampleScene, FormulaBuildScene, FractionVisualScene, GeometryScene, GoalScene, HookScene, KeyPointScene, NumberLineScene, PlotScene, QuizScene, RecapScene, StepByStepScene, SummaryScene, TableScene, TitleScene, TransitionScene, WarningScene,
)

class JobScene00(TitleScene):
    def __init__(self, **kwargs):
        super().__init__(title='Очень длинный заголовок темы с дополнительным уточнением для проверки переноса строк и устойчивого масштабирования', **kwargs)

