from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Iterable


def get_duration(path: Path) -> float:
    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(path),
    ]
    proc = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if proc.returncode != 0:
        stderr = proc.stderr.decode("utf-8", errors="ignore")
        raise RuntimeError(f"ffprobe failed for {path}: {stderr}")
    return float(proc.stdout.decode("utf-8").strip())


def merge_audio_video(video: Path, audio: Path, output: Path) -> Path:
    video_dur = get_duration(video)
    audio_dur = get_duration(audio)

    output = output.with_suffix(".mp4")
    output.parent.mkdir(parents=True, exist_ok=True)

    if audio_dur > video_dur:
        extra = audio_dur - video_dur
        cmd = [
            "ffmpeg", "-y",
            "-i", str(video),
            "-i", str(audio),
            "-filter_complex",
            f"[0:v]tpad=stop_mode=clone:stop_duration={extra:.6f}[vout]",
            "-map", "[vout]",
            "-map", "1:a",
            "-c:v", "libx264",
            "-c:a", "aac",
            str(output),
        ]
    else:
        cmd = [
            "ffmpeg", "-y",
            "-i", str(video),
            "-i", str(audio),
            "-filter_complex",
            "[1:a]apad[aout]",
            "-map", "0:v",
            "-map", "[aout]",
            "-shortest",
            "-c:v", "copy",
            "-c:a", "aac",
            str(output),
        ]

    proc = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if proc.returncode != 0:
        stderr = proc.stderr.decode("utf-8", errors="ignore")
        raise RuntimeError(f"ffmpeg merge_audio_video failed: {stderr}")
    return output


def concat_videos(inputs: Iterable[Path], output_path: Path) -> Path:
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

