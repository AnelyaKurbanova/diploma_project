from __future__ import annotations

import json
import urllib.request
import urllib.error

from app.settings import settings


def _extract_email(from_value: str) -> str:
    if "<" in from_value and ">" in from_value:
        return from_value.split("<", 1)[1].split(">", 1)[0].strip()
    return from_value.strip()


def _extract_name(from_value: str) -> str | None:
    if "<" in from_value:
        name = from_value.split("<", 1)[0].strip().strip('"')
        return name or None
    return None


def _compose_subject(purpose: str) -> str:
    return "OrkenAI: verification code" if purpose in ("register", "login") else "OrkenAI: code"


def _compose_text(code: str, purpose: str) -> str:
    return (
        f"Your verification code: {code}\n"
        f"This code expires in {settings.OTP_EXPIRE_MINUTES} minutes.\n"
        f"Purpose: {purpose}"
    )


def _send_via_brevo(*, to_email: str, code: str, purpose: str) -> None:
    api_key = getattr(settings, "BREVO_API_KEY", None)
    email_from = getattr(settings, "EMAIL_FROM", None) or getattr(settings, "SMTP_FROM", None)

    if not api_key or not email_from:
        print(f"[DEV OTP] provider=brevo-missing-config purpose={purpose} email={to_email} code={code}")
        return

    payload = {
        "sender": {
            "email": _extract_email(email_from),
            "name": _extract_name(email_from) or "OrkenAI",
        },
        "to": [{"email": to_email}],
        "subject": _compose_subject(purpose),
        "textContent": _compose_text(code, purpose),
    }

    req = urllib.request.Request(
        url="https://api.brevo.com/v3/smtp/email",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status not in (200, 201, 202):
                body = resp.read().decode("utf-8", errors="ignore")
                raise RuntimeError(f"Brevo send failed: {resp.status} {body}")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore") if e.fp else ""
        raise RuntimeError(f"Brevo HTTPError: {e.code} {body}") from e


def send_verification_email(to_email: str, code: str, purpose: str) -> None:
    provider = (getattr(settings, "EMAIL_PROVIDER", None) or "log").lower()

    if provider == "brevo":
        _send_via_brevo(to_email=to_email, code=code, purpose=purpose)
        return

    print(f"[DEV OTP] provider={provider} purpose={purpose} email={to_email} code={code}")