from __future__ import annotations

import logging
from pathlib import Path

import httpx

from .settings import Settings


LOGGER = logging.getLogger(__name__)

_TTS_ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
_VOICES_ENDPOINT = "https://api.elevenlabs.io/v1/voices"
_voice_cache: dict[str, str] = {}


def _resolve_voice_id(
    client: httpx.Client,
    requested_voice: str,
    headers: dict[str, str],
) -> str:
    """Resolve voice name or id to canonical ElevenLabs voice_id."""
    cached = _voice_cache.get(requested_voice)
    if cached:
        return cached

    response = client.get(_VOICES_ENDPOINT, headers=headers)
    if response.status_code != 200:
        raise RuntimeError(
            f"ElevenLabs voices lookup failed (HTTP {response.status_code}): {response.text[:500]}"
        )

    data = response.json()
    voices = data.get("voices") if isinstance(data, dict) else None
    if not isinstance(voices, list):
        raise RuntimeError("ElevenLabs voices lookup returned unexpected payload")

    for voice in voices:
        if not isinstance(voice, dict):
            continue
        voice_id = voice.get("voice_id")
        name = voice.get("name")
        if requested_voice == voice_id or requested_voice == name:
            if not isinstance(voice_id, str) or not voice_id:
                break
            _voice_cache[requested_voice] = voice_id
            if isinstance(name, str) and name:
                _voice_cache[name] = voice_id
            return voice_id

    raise RuntimeError(f"ElevenLabs voice '{requested_voice}' not found for this API key")


def generate_speech(text: str, settings: Settings, output_path: Path) -> Path:
    headers = {
        "xi-api-key": settings.elevenlabs_api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }
    payload = {
        "text": text,
        "model_id": settings.elevenlabs_model_id,
        "language_code": "ru",
        "voice_settings": {
            "stability": 0.75,
            "similarity_boost": 0.9,
            "style": 0.0,
            "speed": 1.0,
        },
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)

    LOGGER.debug("Requesting TTS for %d chars → %s", len(text), output_path)

    with httpx.Client(timeout=120.0) as client:
        voice_id = _resolve_voice_id(client, settings.elevenlabs_voice_id, headers)
        url = _TTS_ENDPOINT.format(voice_id=voice_id)
        response = client.post(url, headers=headers, json=payload)

    if response.status_code != 200:
        raise RuntimeError(
            f"ElevenLabs TTS failed (HTTP {response.status_code}): {response.text[:500]}"
        )

    output_path.write_bytes(response.content)
    LOGGER.debug("TTS audio saved to %s (%d bytes)", output_path, len(response.content))
    return output_path
