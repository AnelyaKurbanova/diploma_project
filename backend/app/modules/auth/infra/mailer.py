from __future__ import annotations

import json
import smtplib
import ssl
import urllib.error
import urllib.request
from email.message import EmailMessage

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


def _compose_subject(purpose: str) -> str:
    return "OrkenAI: verification code" if purpose in ("register", "login") else "OrkenAI: code"


def _compose_text(code: str, purpose: str) -> str:
    return (
        f"Your verification code: {code}\n"
        f"This code expires in {settings.OTP_EXPIRE_MINUTES} minutes.\n"
        f"Purpose: {purpose}"
    )


def _send_via_sendgrid(*, to_email: str, code: str, purpose: str) -> None:
    api_key = getattr(settings, "SENDGRID_API_KEY", None)
    email_from = getattr(settings, "EMAIL_FROM", None) or getattr(settings, "SMTP_FROM", None)

    if not api_key or not email_from:
        print(f"[DEV OTP] provider=sendgrid-missing-config purpose={purpose} email={to_email} code={code}")
        return

    payload = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": _extract_email(email_from), "name": _extract_name(email_from)},
        "subject": _compose_subject(purpose),
        "content": [{"type": "text/plain", "value": _compose_text(code, purpose)}],
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


def _send_via_smtp(*, to_email: str, code: str, purpose: str) -> None:
    """
    Generic SMTP sender (works for Brevo SMTP and any other SMTP relay).
    Expected settings:
      SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_TLS(bool), EMAIL_FROM(or SMTP_FROM)
    """
    host = getattr(settings, "SMTP_HOST", None)
    port = int(getattr(settings, "SMTP_PORT", 587) or 587)
    user = getattr(settings, "SMTP_USER", None)
    password = getattr(settings, "SMTP_PASSWORD", None)
    use_tls = bool(getattr(settings, "SMTP_TLS", True))
    email_from = getattr(settings, "EMAIL_FROM", None) or getattr(settings, "SMTP_FROM", None)

    if not host or not user or not password or not email_from:
        print(f"[DEV OTP] provider=smtp-missing-config purpose={purpose} email={to_email} code={code}")
        return

    msg = EmailMessage()
    msg["Subject"] = _compose_subject(purpose)
    msg["From"] = email_from
    msg["To"] = to_email
    msg.set_content(_compose_text(code, purpose))

    # Brevo рекомендованный вариант: 587 + STARTTLS
    if use_tls and port in (587, 25):
        context = ssl.create_default_context()
        with smtplib.SMTP(host, port, timeout=15) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(user, password)
            server.send_message(msg)
        return

    # 465 (SSL)
    if use_tls and port == 465:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(host, port, timeout=15, context=context) as server:
            server.login(user, password)
            server.send_message(msg)
        return

    # Plain (не рекомендую, но оставим)
    with smtplib.SMTP(host, port, timeout=15) as server:
        server.login(user, password)
        server.send_message(msg)


def send_verification_email(to_email: str, code: str, purpose: str) -> None:
    """
    Called by FastAPI BackgroundTasks (sync function).

    Provider:
      - EMAIL_PROVIDER=sendgrid -> SendGrid Email API (HTTPS 443)
      - EMAIL_PROVIDER=brevo|smtp -> SMTP (Brevo SMTP relay)
      - otherwise -> DEV OTP print
    """
    provider = (getattr(settings, "EMAIL_PROVIDER", None) or "log").lower()

    if provider == "sendgrid":
        _send_via_sendgrid(to_email=to_email, code=code, purpose=purpose)
        return

    if provider in ("brevo", "smtp"):
        _send_via_smtp(to_email=to_email, code=code, purpose=purpose)
        return

    print(f"[DEV OTP] provider={provider} purpose={purpose} email={to_email} code={code}")
