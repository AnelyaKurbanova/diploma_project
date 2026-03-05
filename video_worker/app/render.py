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
        # Manim's -o option expects a basename without extension; it will
        # append the appropriate container extension (e.g. .mp4) itself.
        output_basename = f"scene_{idx:02d}"

        cmd = [
            "manim",
            "-qm",
            "--disable_caching",
            "-o",
            output_basename,
            script_path.name,
            wrapper_class,
        ]
        # Ensure the video_worker package is importable when manim runs from out_dir.
        env = os.environ.copy()
        # We need the parent directory that contains the `video_worker` package
        # (i.e. .../diploma_project/diploma_project) on PYTHONPATH so that
        # `import video_worker` works inside the temporary Manim script.
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

        # Manim chooses a quality subdirectory name (e.g. 480p15, 720p30).
        # We don't want to hard-code it; instead, search for the rendered file
        # under media/videos/<script_stem>/**/scene_xx.mp4.
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


def _build_script_text(scenes: List[Mapping[str, Any]]) -> str:
    """Generate a Python script that defines per-job scene subclasses."""

    lines = [
        "from __future__ import annotations",
        "",
        "from video_worker.app.manim_templates import (",
        "    TitleScene,",
        "    GoalScene,",
        "    DefinitionsScene,",
        "    DerivationScene,",
        "    PlotScene,",
        "    SummaryScene,",
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
    if template == "summary":
        final_latex = data.get("final_latex", "")
        text = data.get("text", "")
        return f"final_latex={final_latex!r}, text={text!r}"

    raise ValueError(f"Unsupported template '{template}'")

