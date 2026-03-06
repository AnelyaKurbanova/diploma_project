from __future__ import annotations

import os
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Mapping


TEMPLATE_CLASS_BY_NAME = {
    "title": "TitleScene",
    "goal": "GoalScene",
    "definitions": "DefinitionsScene",
    "derivation": "DerivationScene",
    "plot": "PlotScene",
    "summary": "SummaryScene",
    "hook": "HookScene",
    "recap": "RecapScene",
    "key_point": "KeyPointScene",
    "example": "ExampleScene",
    "step_by_step": "StepByStepScene",
    "formula_build": "FormulaBuildScene",
    "comparison": "ComparisonScene",
    "warning": "WarningScene",
    "quiz": "QuizScene",
    "table": "TableScene",
    "number_line": "NumberLineScene",
    "coordinate": "CoordinateScene",
    "geometry": "GeometryScene",
    "fraction_visual": "FractionVisualScene",
    "transition": "TransitionScene",
}


def render_scenes(content_json: Mapping[str, Any], out_dir: Path) -> List[Path]:
    """Render all scenes described in content_json into mp4 files using Manim CLI.

    Returns a list of paths to the rendered mp4 files, ordered as in content_json.
    """

    out_dir.mkdir(parents=True, exist_ok=True)
    scenes = list(content_json.get("scenes") or [])

    script_path = out_dir / "job_scenes.py"
    script_path.write_text(_build_script_text(scenes), encoding="utf-8")

    rendered_paths: List[Path] = []
    for idx, scene in enumerate(scenes):
        template = scene.get("template")
        wrapper_class = f"JobScene{idx:02d}"
        output_basename = f"scene_{idx:02d}"

        cmd = [
            "manim",
            "-qh",
            "--disable_caching",
            "-o",
            output_basename,
            script_path.name,
            wrapper_class,
        ]
        env = os.environ.copy()
        package_root = Path(__file__).resolve().parents[2]
        env["PYTHONPATH"] = str(package_root) + os.pathsep + env.get("PYTHONPATH", "")
        proc = subprocess.run(
            cmd,
            cwd=out_dir,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
        if proc.returncode != 0:
            stderr = proc.stderr.decode("utf-8", errors="ignore")
            raise RuntimeError(
                f"Manim rendering failed for template '{template}' (scene {idx}): {stderr}"
            )

        expected_name = f"{output_basename}.mp4"
        videos_root = out_dir / "media" / "videos" / script_path.stem
        candidates = list(videos_root.rglob(expected_name))
        if not candidates:
            raise RuntimeError(
                f"Manim reported success but no output file '{expected_name}' "
                f"was found under {videos_root}"
            )

        rendered_paths.append(candidates[0])

    return rendered_paths


_ALL_IMPORTS = ", ".join(sorted(TEMPLATE_CLASS_BY_NAME.values()))


def _build_script_text(scenes: List[Mapping[str, Any]]) -> str:
    """Generate a Python script that defines per-job scene subclasses."""

    lines = [
        "from __future__ import annotations",
        "",
        "from video_worker.app.manim_templates import (",
        f"    {_ALL_IMPORTS},",
        ")",
        "",
    ]

    for idx, scene in enumerate(scenes):
        template = scene.get("template")
        data: Dict[str, Any] = dict(scene.get("data") or {})
        base_class = TEMPLATE_CLASS_BY_NAME.get(template)
        if base_class is None:
            raise ValueError(f"Unknown template '{template}' in content_json")

        wrapper_class = f"JobScene{idx:02d}"
        init_args = _build_init_args(template, data)

        lines.append(f"class {wrapper_class}({base_class}):")
        lines.append("    def __init__(self, **kwargs):")
        lines.append(f"        super().__init__({init_args}, **kwargs)")
        lines.append("")

    return "\n".join(lines) + "\n"


def _build_init_args(template: str, data: Dict[str, Any]) -> str:
    if template == "title":
        return f"title={data.get('title', '')!r}"
    if template == "goal":
        return f"text={data.get('text', '')!r}"
    if template == "definitions":
        items = data.get("items") or []
        return f"items={items!r}"
    if template == "derivation":
        steps = data.get("steps") or []
        return f"steps={steps!r}"
    if template == "plot":
        return _build_plot_args(data)
    if template == "summary":
        final_latex = data.get("final_latex", "")
        text = data.get("text", "")
        return f"final_latex={final_latex!r}, text={text!r}"
    if template == "hook":
        return f"text={data.get('text', '')!r}"
    if template == "recap":
        items = data.get("items") or []
        return f"items={items!r}"
    if template == "key_point":
        title = data.get("title", "")
        formula_latex = data.get("formula_latex", "")
        explanation = data.get("explanation", "")
        return f"title={title!r}, formula_latex={formula_latex!r}, explanation={explanation!r}"
    if template == "example":
        problem = data.get("problem", "")
        steps = data.get("steps") or []
        return f"problem={problem!r}, steps={steps!r}"
    if template == "step_by_step":
        title = data.get("title", "")
        steps = data.get("steps") or []
        return f"title={title!r}, steps={steps!r}"
    if template == "formula_build":
        parts = data.get("parts") or []
        return f"parts={parts!r}"
    if template == "comparison":
        return (
            f"left_title={data.get('left_title', '')!r}, "
            f"left_content={data.get('left_content', '')!r}, "
            f"right_title={data.get('right_title', '')!r}, "
            f"right_content={data.get('right_content', '')!r}, "
            f"left_is_correct={data.get('left_is_correct', True)!r}"
        )
    if template == "warning":
        return (
            f"title={data.get('title', '')!r}, "
            f"wrong_latex={data.get('wrong_latex', '')!r}, "
            f"correct_latex={data.get('correct_latex', '')!r}, "
            f"explanation={data.get('explanation', '')!r}"
        )
    if template == "quiz":
        return (
            f"question={data.get('question', '')!r}, "
            f"answer_latex={data.get('answer_latex', '')!r}, "
            f"explanation={data.get('explanation', '')!r}"
        )
    if template == "table":
        headers = data.get("headers") or []
        rows = data.get("rows") or []
        highlight_row = data.get("highlight_row", -1)
        return f"headers={headers!r}, rows={rows!r}, highlight_row={highlight_row!r}"
    if template == "number_line":
        return (
            f"x_min={data.get('x_min', -5)!r}, "
            f"x_max={data.get('x_max', 5)!r}, "
            f"points={data.get('points', [])!r}, "
            f"interval_start={data.get('interval_start')!r}, "
            f"interval_end={data.get('interval_end')!r}"
        )
    if template == "coordinate":
        return (
            f"x_range={data.get('x_range', [-5, 5, 1])!r}, "
            f"y_range={data.get('y_range', [-4, 4, 1])!r}, "
            f"points={data.get('points', [])!r}, "
            f"vectors={data.get('vectors', [])!r}"
        )
    if template == "geometry":
        return (
            f"shape={data.get('shape', 'triangle')!r}, "
            f"labels={data.get('labels', {})!r}, "
            f"title={data.get('title', '')!r}"
        )
    if template == "fraction_visual":
        return (
            f"numerator={data.get('numerator', 1)!r}, "
            f"denominator={data.get('denominator', 4)!r}, "
            f"label={data.get('label', '')!r}"
        )
    if template == "transition":
        return f"text={data.get('text', '')!r}"

    raise ValueError(f"Unsupported template '{template}'")


def _build_plot_args(data: Dict[str, Any]) -> str:
    if "func_code" in data:
        func_code = data.get("func_code", "")
        x_min = data.get("x_min", -5.0)
        x_max = data.get("x_max", 5.0)
        try:
            x_min, x_max = float(x_min), float(x_max)
        except (TypeError, ValueError):
            x_min, x_max = -5.0, 5.0
        return f"func_code={func_code!r}, x_min={x_min!r}, x_max={x_max!r}"
    plot_type = data.get("plot_type", "quadratic")
    defaults = {
        "quadratic": {"a": 1, "b": 0, "c": 0, "x_min": -5, "x_max": 5},
        "linear": {"slope": 1, "intercept": 0, "x_min": -5, "x_max": 5},
        "sine": {"amplitude": 1, "frequency": 1, "x_min": -5, "x_max": 5},
        "cosine": {"amplitude": 1, "frequency": 1, "x_min": -5, "x_max": 5},
    }
    allowed = defaults.get(plot_type, defaults["quadratic"])
    parts = [f"plot_type={plot_type!r}"]
    for key in allowed:
        val = data.get(key, allowed[key])
        try:
            parts.append(f"{key}={float(val)!r}")
        except (TypeError, ValueError):
            parts.append(f"{key}={allowed[key]!r}")
    return ", ".join(parts)
