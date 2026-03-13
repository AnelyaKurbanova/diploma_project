from __future__ import annotations
import uuid
from datetime import timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import from_url as redis_from_url

from app.settings import settings
from app.core.errors import BadRequest, Unauthorized, TooManyRequests
from app.core.i18n import tr
from app.modules.users.data.repo import UserRepo, UserProfileRepo
from app.modules.auth.data.repo import AuthRepo
from app.modules.auth.security.tokens import (
    hash_value, create_access_token, create_refresh_token, decode_token, gen_csrf, now_utc
)
from app.modules.auth.security.otp import (
    generate_otp_code, hash_otp_code, verify_otp_code, otp_expires_at, resend_not_before, is_expired, attempts_exceeded
)
from app.modules.auth.security.csrf import validate_csrf_hash
from app.modules.auth.infra.audit import AuditService
from app.modules.auth.infra.ratelimit import RateLimitService, InMemoryRateLimiter, RedisRateLimiter
from contextlib import asynccontextmanager



class AuthService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.users = UserRepo(session)
        self.profiles = UserProfileRepo(session)
        self.auth = AuthRepo(session)
        self.audit = AuditService(session)

        if settings.REDIS_URL:
            self._rl = RateLimitService(RedisRateLimiter(redis_from_url(settings.REDIS_URL, decode_responses=True)))
        else:
            self._rl = RateLimitService(InMemoryRateLimiter())

    @asynccontextmanager
    async def _tx(self):
        if self.session.in_transaction():
            try:
                yield
                await self.session.commit()
            except Exception:
                await self.session.rollback()
                raise
        else:
            async with self.session.begin():
                yield

    async def register_start(self, email: str, ip: str | None, ua: str | None) -> str:
        email = email.lower().strip()
        await self._rl.enforce(f"otp:email:{email}", settings.RL_OTP_PER_EMAIL_PER_HOUR, 3600, tr("too_many_otp"))
        if ip:
            await self._rl.enforce(f"otp:ip:{ip}", settings.RL_OTP_PER_IP_PER_HOUR, 3600, tr("too_many_otp_ip"))

        async with self._tx():
            user = await self.users.get_by_email(email)
            if user and user.is_email_verified:
                raise BadRequest(tr("user_already_exists"))

            code = generate_otp_code()

            if not user:
                user = await self.users.create(email)

            current = await self.auth.get_latest_active_verification(user.id, "register")
            if current and current.resend_not_before and current.resend_not_before > now_utc():
                raise TooManyRequests(tr("wait_before_resend"))

            await self.auth.upsert_verification(
                user_id=user.id,
                purpose="register",
                code_hash=hash_otp_code(code),
                expires_at=otp_expires_at(),
                resend_not_before=resend_not_before(),
            )
            await self.audit.log("otp_sent", user.id, ip, ua, {"purpose": "register"})

        return code

    async def register_verify(self, email: str, code: str, ip: str | None, ua: str | None):
        if ip:
            await self._rl.enforce(f"verify:ip:{ip}", settings.RL_VERIFY_PER_IP_PER_15MIN, 900, tr("too_many_verify"))

        email = email.lower().strip()
        user = await self.users.get_by_email(email)
        if not user:
            raise BadRequest(tr("invalid_code_or_email"))

        async with self._tx():
            ver = await self.auth.get_latest_active_verification(user.id, "register")
            if not ver or is_expired(ver.expires_at):
                await self.audit.log("otp_expired_or_missing", user.id, ip, ua, {"purpose": "register"})
                raise BadRequest(tr("invalid_or_expired_code"))
            if attempts_exceeded(ver.attempts):
                await self.audit.log("otp_attempts_exceeded", user.id, ip, ua, {"purpose": "register"})
                raise TooManyRequests(tr("too_many_attempts"))

            if not verify_otp_code(code, ver.code_hash):
                await self.auth.inc_attempt(ver)
                await self.audit.log("otp_verify_failed", user.id, ip, ua, {"purpose": "register"})
                raise BadRequest(tr("invalid_code"))

            await self.auth.consume_verification(ver)
            user.is_email_verified = True
            access, refresh, csrf = await self._issue_session(user.id, ip, ua)
            await self.audit.log("register_verified", user.id, ip, ua)
            return access, refresh, csrf

    async def login_email_start(self, email: str, ip: str | None, ua: str | None) -> str | None:
        email = email.lower().strip()
        await self._rl.enforce(f"otp:email:{email}", settings.RL_OTP_PER_EMAIL_PER_HOUR, 3600, tr("too_many_otp"))
        if ip:
            await self._rl.enforce(f"otp:ip:{ip}", settings.RL_OTP_PER_IP_PER_HOUR, 3600, tr("too_many_otp_ip"))

        user = await self.users.get_by_email(email)
        if not user:
            raise BadRequest(tr("user_not_found"))
        if not user.is_active or not user.is_email_verified:
            return None 

        code = generate_otp_code()

        async with self._tx():
            current = await self.auth.get_latest_active_verification(user.id, "login")
            if current and current.resend_not_before and current.resend_not_before > now_utc():
                raise TooManyRequests(tr("wait_before_resend"))

            await self.auth.upsert_verification(
                user_id=user.id,
                purpose="login",
                code_hash=hash_otp_code(code),
                expires_at=otp_expires_at(),
                resend_not_before=resend_not_before(),
            )
            await self.audit.log("otp_sent", user.id, ip, ua, {"purpose": "login"})

        return code

    async def login_email_verify(self, email: str, code: str, ip: str | None, ua: str | None):
        if ip:
            await self._rl.enforce(f"verify:ip:{ip}", settings.RL_VERIFY_PER_IP_PER_15MIN, 900, tr("too_many_verify"))

        email = email.lower().strip()
        user = await self.users.get_by_email(email)
        if not user or not user.is_active or not user.is_email_verified:
            raise Unauthorized(tr("invalid_credentials"))

        async with self._tx():
            ver = await self.auth.get_latest_active_verification(user.id, "login")
            if not ver or is_expired(ver.expires_at):
                await self.audit.log("otp_expired_or_missing", user.id, ip, ua, {"purpose": "login"})
                raise Unauthorized(tr("invalid_or_expired_code"))
            if attempts_exceeded(ver.attempts):
                await self.audit.log("otp_attempts_exceeded", user.id, ip, ua, {"purpose": "login"})
                raise TooManyRequests(tr("too_many_attempts"))

            if not verify_otp_code(code, ver.code_hash):
                await self.auth.inc_attempt(ver)
                await self.audit.log("otp_verify_failed", user.id, ip, ua, {"purpose": "login"})
                raise Unauthorized(tr("invalid_code"))

            await self.auth.consume_verification(ver)
            access, refresh, csrf = await self._issue_session(user.id, ip, ua)
            await self.audit.log("login_success", user.id, ip, ua)
            return access, refresh, csrf

    async def login_google(self, sub: str, email: str, email_verified: bool, ip: str | None, ua: str | None):
        if not email_verified:
            raise Unauthorized(tr("google_email_not_verified"))

        email = email.lower().strip()

        async with self._tx():
            acc = await self.auth.get_auth_account("google", sub)
            if acc:
                user_id = acc.user_id
            else:
                user = await self.users.get_by_email(email)
                if not user:
                    user = await self.users.create(email)
                user.is_email_verified = True
                await self.auth.create_auth_account(user.id, "google", sub)
                user_id = user.id

            access, refresh, csrf = await self._issue_session(user_id, ip, ua)
            await self.audit.log("google_login_success", user_id, ip, ua)
            return access, refresh, csrf

    async def refresh(self, refresh_token: str, csrf_token_plain: str, ip: str | None, ua: str | None):
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise Unauthorized(tr("invalid_refresh_token"))

        sub = payload.get("sub")
        jti = payload.get("jti")
        if not sub or not jti:
            raise Unauthorized(tr("invalid_refresh_token"))

        session_id = uuid.UUID(jti)
        user_id = uuid.UUID(sub)

        async with self._tx():
            row = await self.auth.get_refresh_session(session_id)
            if not row or row.revoked_at is not None or row.expires_at < now_utc():
                raise Unauthorized(tr("session_expired"))

            if row.refresh_hash != hash_value(refresh_token):
                await self.auth.revoke_all_user_sessions(user_id)
                await self.audit.log("refresh_reuse_detected", user_id, ip, ua)
                raise Unauthorized(tr("session_compromised"))

            validate_csrf_hash(csrf_token_plain, row.csrf_hash)

            await self.auth.revoke_refresh_session(row)
            access, new_refresh, new_csrf = await self._issue_session(user_id, ip, ua, rotated_from=row.id)
            await self.audit.log("refresh_rotated", user_id, ip, ua)
            return access, new_refresh, new_csrf

    async def logout(self, refresh_token: str, csrf_token_plain: str, ip: str | None, ua: str | None):
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            return

        sub = payload.get("sub")
        jti = payload.get("jti")
        if not sub or not jti:
            return

        user_id = uuid.UUID(sub)
        session_id = uuid.UUID(jti)

        async with self._tx():
            row = await self.auth.get_refresh_session(session_id)
            if row and row.revoked_at is None:
                validate_csrf_hash(csrf_token_plain, row.csrf_hash)
                await self.auth.revoke_refresh_session(row)
            await self.audit.log("logout", user_id, ip, ua)

    async def logout_all(self, user_id: uuid.UUID, ip: str | None, ua: str | None):
        async with self._tx():
            await self.auth.revoke_all_user_sessions(user_id)
            await self.audit.log("logout_all", user_id, ip, ua)

    async def sessions(self, user_id: uuid.UUID):
        return await self.auth.list_user_sessions(user_id)

    async def _issue_session(self, user_id: uuid.UUID, ip: str | None, ua: str | None, rotated_from: uuid.UUID | None = None):
        sid = uuid.uuid4()
        access = create_access_token(str(user_id))
        refresh = create_refresh_token(str(user_id), str(sid))
        csrf = gen_csrf()

        await self.auth.create_refresh_session(
            session_id=sid,
            user_id=user_id,
            refresh_hash=hash_value(refresh),
            csrf_hash=hash_value(csrf),
            expires_at=now_utc() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            user_agent=ua,
            ip=ip,
            rotated_from=rotated_from,
        )
        return access, refresh, csrf
