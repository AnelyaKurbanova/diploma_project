from __future__ import annotations
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.db.session import get_session
from app.settings import settings
from app.modules.auth.api.shemas import (
    RegisterStartIn, LoginEmailStartIn, VerifyCodeIn, MessageOut, AccessTokenOut, SessionOut
)
from app.modules.auth.application.service import AuthService
from app.modules.auth.deps import get_current_user
from app.modules.auth.providers.google_oidc import oauth
from app.modules.auth.security.cookies import (
    REFRESH_COOKIE, set_auth_cookies, clear_auth_cookies
)
from app.modules.auth.security.csrf import validate_double_submit

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register/start", response_model=MessageOut)
async def register_start(body: RegisterStartIn, request: Request, session: AsyncSession = Depends(get_session)):
    svc = AuthService(session)
    await svc.register_start(
        body.email,
        ip=request.client.host if request.client else None,
        ua=request.headers.get("user-agent"),
    )
    return MessageOut(message="If email is eligible, verification code was sent")


@router.post("/register/verify", response_model=AccessTokenOut)
async def register_verify(body: VerifyCodeIn, request: Request, response: Response, session: AsyncSession = Depends(get_session)):
    svc = AuthService(session)
    access, refresh, csrf = await svc.register_verify(
        body.email, body.code,
        ip=request.client.host if request.client else None,
        ua=request.headers.get("user-agent"),
    )
    set_auth_cookies(response, refresh, csrf)
    return AccessTokenOut(access_token=access)


@router.post("/login/email/start", response_model=MessageOut)
async def login_email_start(body: LoginEmailStartIn, request: Request, session: AsyncSession = Depends(get_session)):
    svc = AuthService(session)
    await svc.login_email_start(
        body.email,
        ip=request.client.host if request.client else None,
        ua=request.headers.get("user-agent"),
    )
    return MessageOut(message="If email is eligible, verification code was sent")


@router.post("/login/email/verify", response_model=AccessTokenOut)
async def login_email_verify(body: VerifyCodeIn, request: Request, response: Response, session: AsyncSession = Depends(get_session)):
    svc = AuthService(session)
    access, refresh, csrf = await svc.login_email_verify(
        body.email, body.code,
        ip=request.client.host if request.client else None,
        ua=request.headers.get("user-agent"),
    )
    set_auth_cookies(response, refresh, csrf)
    return AccessTokenOut(access_token=access)


@router.get("/google/login")
async def google_login(request: Request):
    return await oauth.google.authorize_redirect(request, settings.GOOGLE_REDIRECT_URI)


@router.get("/google/callback")
async def google_callback(request: Request, session: AsyncSession = Depends(get_session)):
    token = await oauth.google.authorize_access_token(request)
    userinfo = token.get("userinfo") or await oauth.google.parse_id_token(request, token)

    sub = userinfo.get("sub")
    email = userinfo.get("email")
    email_verified = bool(userinfo.get("email_verified"))

    if not sub or not email:
        return RedirectResponse(
            url=f"{settings.FRONTEND_REDIRECT_AFTER_GOOGLE}?error=google_profile_invalid",
            status_code=302,
        )

    svc = AuthService(session)
    access, refresh, csrf = await svc.login_google(
        sub=sub,
        email=email,
        email_verified=email_verified,
        ip=request.client.host if request.client else None,
        ua=request.headers.get("user-agent"),
    )

    redirect = RedirectResponse(
        url=f"{settings.FRONTEND_REDIRECT_AFTER_GOOGLE}?access_token={access}",
        status_code=302,
    )
    set_auth_cookies(redirect, refresh, csrf)
    return redirect


@router.post("/refresh", response_model=AccessTokenOut)
async def refresh(request: Request, response: Response, session: AsyncSession = Depends(get_session)):
    refresh_token = request.cookies.get(REFRESH_COOKIE)
    if not refresh_token:
        from app.core.errors import Unauthorized
        raise Unauthorized("Missing refresh token")

    csrf_plain = validate_double_submit(request)

    svc = AuthService(session)
    access, new_refresh, new_csrf = await svc.refresh(
        refresh_token=refresh_token,
        csrf_token_plain=csrf_plain,
        ip=request.client.host if request.client else None,
        ua=request.headers.get("user-agent"),
    )
    set_auth_cookies(response, new_refresh, new_csrf)
    return AccessTokenOut(access_token=access)


@router.post("/logout", response_model=MessageOut)
async def logout(request: Request, response: Response, session: AsyncSession = Depends(get_session)):
    refresh_token = request.cookies.get(REFRESH_COOKIE)
    if refresh_token:
        csrf_plain = validate_double_submit(request)
        svc = AuthService(session)
        await svc.logout(
            refresh_token=refresh_token,
            csrf_token_plain=csrf_plain,
            ip=request.client.host if request.client else None,
            ua=request.headers.get("user-agent"),
        )

    clear_auth_cookies(response)
    return MessageOut(message="Logged out")


@router.post("/logout-all", response_model=MessageOut)
async def logout_all(request: Request, response: Response, session: AsyncSession = Depends(get_session), current_user=Depends(get_current_user)):
    svc = AuthService(session)
    await svc.logout_all(
        user_id=current_user.id,
        ip=request.client.host if request.client else None,
        ua=request.headers.get("user-agent"),
    )
    clear_auth_cookies(response)
    return MessageOut(message="Logged out from all devices")


@router.get("/me")
async def me(current_user=Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "is_email_verified": current_user.is_email_verified,
        "is_active": current_user.is_active,
    }


@router.get("/sessions", response_model=list[SessionOut])
async def sessions(session: AsyncSession = Depends(get_session), current_user=Depends(get_current_user)):
    svc = AuthService(session)
    rows = await svc.sessions(current_user.id)
    return [
        SessionOut(
            id=r.id,
            ip=r.ip,
            user_agent=r.user_agent,
            created_at=r.created_at,
            expires_at=r.expires_at,
            revoked_at=r.revoked_at,
        )
        for r in rows
    ]
