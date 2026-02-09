from __future__ import annotations
import smtplib
from email.message import EmailMessage
from app.settings import settings


def send_verification_email(to_email: str, code: str, purpose: str):
    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        print(f"[DEV OTP] purpose={purpose} email={to_email} code={code}")
        return

    msg = EmailMessage()
    msg["Subject"] = "Your verification code"
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_email
    msg.set_content(
        f"Your verification code: {code}\n"
        f"This code expires in {settings.OTP_EXPIRE_MINUTES} minutes."
    )

    if settings.SMTP_TLS:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
    else:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
