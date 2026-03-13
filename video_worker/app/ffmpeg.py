from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Iterable


def concat_videos(inputs: Iterable[Path], output_path: Path) -> Path:
    """Concatenate mp4 scene files into a single mp4 using ffmpeg concat demuxer."""

    input_paths = [Path(p) for p in inputs]
    if not input_paths:
        raise ValueError("No input videos provided for concatenation")

    output_path = output_path.with_suffix(".mp4")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    list_file = output_path.parent / "concat_list.txt"
    lines = []
    for p in input_paths:
        # Use absolute paths for safety; escape single quotes.
        abs_path = str(p.resolve()).replace("'", r"'\''")
        lines.append(f"file '{abs_path}'\n")
    list_file.write_text("".join(lines), encoding="utf-8")

    cmd = [
        "ffmpeg",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(list_file),
        "-c",
        "copy",
        str(output_path),
    ]
    proc = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if proc.returncode != 0:
        stderr = proc.stderr.decode("utf-8", errors="ignore")
        raise RuntimeError(f"ffmpeg concat failed: {stderr}")

    return output_path

