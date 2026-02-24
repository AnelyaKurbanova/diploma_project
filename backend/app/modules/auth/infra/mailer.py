from __future__ import annotations

import json
import urllib.request
import urllib.error

from app.settings import settings


def _extract_email(from_value: str) -> str:
    # 'Name <email@domain>'
    if "<" in from_value and ">" in from_value:
        return from_value.split("<", 1)[1].split(">", 1)[0].strip()
    return from_value.strip()


def _extract_name(from_value: str) -> str | None:
    if "<" in from_value:
        name = from_value.split("<", 1)[0].strip().strip('"')
        return name or None
    return None


def _send_via_sendgrid(*, to_email: str, code: str, purpose: str) -> None:
    api_key = getattr(settings, "SENDGRID_API_KEY", None)
    email_from = getattr(settings, "EMAIL_FROM", None) or getattr(settings, "SMTP_FROM", None)

    if not api_key or not email_from:
        # fallback для dev/staging
        print(f"[DEV OTP] provider=sendgrid-missing-config purpose={purpose} email={to_email} code={code}")
        return

    subject = "OrkenAI: verification code" if purpose in ("register", "login") else "OrkenAI: code"
    text = (
        f"Your verification code: {code}\n"
        f"This code expires in {settings.OTP_EXPIRE_MINUTES} minutes.\n"
        f"Purpose: {purpose}"
    )

    payload = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": _extract_email(email_from), "name": _extract_name(email_from)},
        "subject": subject,
        "content": [{"type": "text/plain", "value": text}],
    }

    req = urllib.request.Request(
        url="https://api.sendgrid.com/v3/mail/send",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            # SendGrid success: 202 Accepted
            if resp.status != 202:
                body = resp.read().decode("utf-8", errors="ignore")
                raise RuntimeError(f"SendGrid send failed: {resp.status} {body}")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore") if e.fp else ""
        raise RuntimeError(f"SendGrid HTTPError: {e.code} {body}") from e


def send_verification_email(to_email: str, code: str, purpose: str) -> None:
    """
    Called by FastAPI BackgroundTasks (sync function).
    Provider:
      - EMAIL_PROVIDER=sendgrid -> SendGrid Email API (HTTPS 443)
      - otherwise -> DEV OTP print
    """
    provider = (getattr(settings, "EMAIL_PROVIDER", None) or "log").lower()

    if provider == "sendgrid":
        _send_via_sendgrid(to_email=to_email, code=code, purpose=purpose)
        return

    # fallback (free & works always)
    print(f"[DEV OTP] provider={provider} purpose={purpose} email={to_email} code={code}")
