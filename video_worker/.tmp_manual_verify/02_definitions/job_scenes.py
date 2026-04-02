from __future__ import annotations

from video_worker.app.manim_templates import (
    ComparisonScene, CoordinateScene, DefinitionsScene, DerivationScene, ExampleScene, FormulaBuildScene, FractionVisualScene, GeometryScene, GoalScene, HookScene, KeyPointScene, NumberLineScene, PlotScene, QuizScene, RecapScene, StepByStepScene, SummaryScene, TableScene, TitleScene, TransitionScene, WarningScene,
)

class JobScene00(DefinitionsScene):
    def __init__(self, **kwargs):
        super().__init__(items=[{'label': 'Очень длинное определение первой величины', 'value_latex': 'a_n=\\frac{n^3+2n^2-5n+7}{n^2+1}'}, {'label': 'Очень длинное определение второй величины', 'value_latex': 'S_n=\\sum_{k=1}^{n}\\frac{2k+1}{k^2+k+1}'}, {'label': 'Третья величина', 'value_latex': '\\Delta=b^2-4ac'}], **kwargs)

