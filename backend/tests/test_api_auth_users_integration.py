"""API integration tests for auth and users flows (with dependency overrides).

Goal: verify HTTP-level user flows without requiring a real database.
We monkeypatch service/repo classes in router modules and override FastAPI dependencies.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import Request
from fastapi.testclient import TestClient

from app.data.db.session import get_session
from app.main import app
from app.modules.auth.deps import get_current_user
from app.modules.users.data.models import UserRole


class FakeSession:
    def __init__(self) -> None:
        self.commit_calls = 0
        self.flush_calls = 0
        self.refresh_calls = 0

    async def commit(self) -> None:
        self.commit_calls += 1

    async def flush(self) -> None:
        self.flush_calls += 1

    async def refresh(self, _obj) -> None:
        self.refresh_calls += 1

    def in_transaction(self) -> bool:
        return False

    def begin(self):
                                             
        class _Tx:
            async def __aenter__(self_inner):                
                return None

            async def __aexit__(self_inner, exc_type, exc, tb):                
                return False

        return _Tx()


class TestApiAuthFlows:
    @pytest.fixture(autouse=True)
    def _setup(self, monkeypatch: pytest.MonkeyPatch):
        import app.modules.auth.api.router as auth_router_module

        self.fake_session = FakeSession()
        self.email_calls: list[tuple[str, str, str]] = []
        self.calls: list[tuple] = []
        self.current_user = SimpleNamespace(
            id=uuid.uuid4(),
            email="auth-user@example.com",
            role=UserRole.STUDENT,
            is_email_verified=True,
            is_active=True,
        )

        class FakeAuthService:
            def __init__(self, _session):
                self._session = _session

            async def register_start(self, email: str, ip: str | None, ua: str | None):
                self_ref.calls.append(("register_start", email, ip, ua))
                return "111111"

            async def register_verify(self, email: str, code: str, ip: str | None, ua: str | None):
                self_ref.calls.append(("register_verify", email, code, ip, ua))
                return ("access-reg", "refresh-reg", "csrf-reg")

            async def login_email_start(self, email: str, ip: str | None, ua: str | None):
                self_ref.calls.append(("login_start", email, ip, ua))
                return "222222"

            async def login_email_verify(self, email: str, code: str, ip: str | None, ua: str | None):
                self_ref.calls.append(("login_verify", email, code, ip, ua))
                return ("access-login", "refresh-login", "csrf-login")

            async def refresh(self, refresh_token: str, csrf_token_plain: str, ip: str | None, ua: str | None):
                self_ref.calls.append(("refresh", refresh_token, csrf_token_plain, ip, ua))
                return ("access-new", "refresh-new", "csrf-new")

            async def logout(self, refresh_token: str, csrf_token_plain: str, ip: str | None, ua: str | None):
                self_ref.calls.append(("logout", refresh_token, csrf_token_plain, ip, ua))

            async def logout_all(self, user_id, ip: str | None, ua: str | None):
                self_ref.calls.append(("logout_all", user_id, ip, ua))

            async def sessions(self, user_id):
                self_ref.calls.append(("sessions", user_id))
                now = datetime.now(timezone.utc)
                return [
                    SimpleNamespace(
                        id=uuid.uuid4(),
                        ip="127.0.0.1",
                        user_agent="pytest",
                        created_at=now,
                        expires_at=now,
                        revoked_at=None,
                    )
                ]

        self_ref = self

        def fake_send_verification_email(to_email: str, code: str, purpose: str) -> None:
            self.email_calls.append((to_email, code, purpose))

        async def override_get_session():
            yield self.fake_session

        async def override_current_user(_creds=object(), _session=object()):                                   
            return self.current_user

        monkeypatch.setattr(auth_router_module, "AuthService", FakeAuthService)
        monkeypatch.setattr(auth_router_module, "send_verification_email", fake_send_verification_email)

        app.dependency_overrides[get_session] = override_get_session
        app.dependency_overrides[get_current_user] = override_current_user
        yield
        app.dependency_overrides.clear()

    def test_register_start_and_verify(self):
        with TestClient(app) as client:
            start_resp = client.post(
                "/auth/register/start",
                json={"email": "new@example.com"},
                headers={"user-agent": "pytest-agent"},
            )
            assert start_resp.status_code == 200
            assert "message" in start_resp.json()
            assert self.email_calls == [("new@example.com", "111111", "register")]

            verify_resp = client.post(
                "/auth/register/verify",
                json={"email": "new@example.com", "code": "111111"},
                headers={"user-agent": "pytest-agent"},
            )
            assert verify_resp.status_code == 200
            assert verify_resp.json()["access_token"] == "access-reg"
            set_cookie = verify_resp.headers.get("set-cookie", "")
            assert "refresh_token=refresh-reg" in set_cookie
            assert "csrf_token=csrf-reg" in set_cookie

    def test_login_start_and_verify(self):
        with TestClient(app) as client:
            start_resp = client.post(
                "/auth/login/email/start",
                json={"email": "user@example.com"},
            )
            assert start_resp.status_code == 200
            assert self.email_calls == [("user@example.com", "222222", "login")]

            verify_resp = client.post(
                "/auth/login/email/verify",
                json={"email": "user@example.com", "code": "222222"},
            )
            assert verify_resp.status_code == 200
            assert verify_resp.json()["access_token"] == "access-login"

    def test_refresh_csrf_validation_and_success(self):
        with TestClient(app) as client:
            resp_missing_cookie = client.post("/auth/refresh")
            assert resp_missing_cookie.status_code == 401

            client.cookies.set("refresh_token", "refresh-old", path="/auth")
            resp_missing_header = client.post("/auth/refresh")
            assert resp_missing_header.status_code == 401

            client.cookies.set("csrf_token", "cookie-csrf", path="/")
            resp_mismatch = client.post("/auth/refresh", headers={"X-CSRF-Token": "header-csrf"})
            assert resp_mismatch.status_code == 401

            resp_ok = client.post("/auth/refresh", headers={"X-CSRF-Token": "cookie-csrf"})
            assert resp_ok.status_code == 200
            assert resp_ok.json()["access_token"] == "access-new"

    def test_logout_logout_all_me_and_sessions(self):
        with TestClient(app) as client:
                                                                                  
            resp_logout_no_cookie = client.post("/auth/logout")
            assert resp_logout_no_cookie.status_code == 200

                                                      
            client.cookies.set("refresh_token", "refresh-old", path="/auth")
            client.cookies.set("csrf_token", "csrf-old", path="/")
            resp_logout = client.post("/auth/logout", headers={"X-CSRF-Token": "csrf-old"})
            assert resp_logout.status_code == 200

            resp_logout_all = client.post(
                "/auth/logout-all",
                headers={"Authorization": "Bearer fake-token"},
            )
            assert resp_logout_all.status_code == 200
            assert any(call[0] == "logout_all" for call in self.calls)

            resp_me = client.get("/auth/me", headers={"Authorization": "Bearer fake-token"})
            assert resp_me.status_code == 200
            assert resp_me.json()["email"] == "auth-user@example.com"

            resp_sessions = client.get("/auth/sessions", headers={"Authorization": "Bearer fake-token"})
            assert resp_sessions.status_code == 200
            assert isinstance(resp_sessions.json(), list)
            assert len(resp_sessions.json()) == 1


class TestApiUsersFlows:
    @pytest.fixture(autouse=True)
    def _setup(self, monkeypatch: pytest.MonkeyPatch):
        import app.modules.users.api.router as users_router_module

        self.fake_session = FakeSession()
        self.now = datetime.now(timezone.utc)

        self.user_a = SimpleNamespace(
            id=uuid.uuid4(),
            email="alice@example.com",
            role=UserRole.STUDENT,
            is_email_verified=True,
            is_active=True,
            created_at=self.now,
        )
        self.user_b = SimpleNamespace(
            id=uuid.uuid4(),
            email="bob@example.com",
            role=UserRole.STUDENT,
            is_email_verified=True,
            is_active=True,
            created_at=self.now,
        )

        self.users = {self.user_a.id: self.user_a, self.user_b.id: self.user_b}
        self.profiles: dict[uuid.UUID, SimpleNamespace] = {
            self.user_a.id: SimpleNamespace(
                user_id=self.user_a.id,
                full_name="Alice",
                school_id=None,
                school=None,
                city="Almaty",
                avatar_url=None,
                grade_level=11,
                preferred_language="ru",
                timezone="Asia/Almaty",
                primary_goal="unt_prep",
                interested_subjects=["math"],
                intro_difficulties=None,
                intro_notes=None,
                onboarding_completed_at=self.now,
                created_at=self.now,
                updated_at=self.now,
            )
        }

        self.friendships: set[tuple[uuid.UUID, uuid.UUID]] = set()
        self.requests: dict[tuple[uuid.UUID, uuid.UUID], SimpleNamespace] = {}
        self.notifications: dict[uuid.UUID, list[SimpleNamespace]] = {
            self.user_a.id: [],
            self.user_b.id: [],
        }

        self.school_id = uuid.uuid4()
        self.teacher_code = "teacher-123"
        self.school = SimpleNamespace(id=self.school_id, name="NIS", teacher_code_hash="hash")

        class FakeUserRepo:
            def __init__(self, _session):
                self._session = _session

            async def get_by_id(self, user_id: uuid.UUID):
                return self_ref.users.get(user_id)

            async def get_by_email(self, email: str):
                email = email.lower().strip()
                for user in self_ref.users.values():
                    if user.email == email:
                        return user
                return None

        class FakeUserProfileRepo:
            def __init__(self, _session):
                self._session = _session

            async def get_by_user_id(self, user_id):
                return self_ref.profiles.get(user_id)

            async def create_default_for_user(self, user_id):
                profile = SimpleNamespace(
                    user_id=user_id,
                    full_name=None,
                    school_id=None,
                    school=None,
                    city=None,
                    avatar_url=None,
                    grade_level=None,
                    preferred_language="ru",
                    timezone="Asia/Almaty",
                    primary_goal=None,
                    interested_subjects=None,
                    intro_difficulties=None,
                    intro_notes=None,
                    onboarding_completed_at=None,
                    created_at=self_ref.now,
                    updated_at=self_ref.now,
                )
                self_ref.profiles[user_id] = profile
                return profile

        class FakeUserFriendRepo:
            def __init__(self, _session):
                self._session = _session

            @staticmethod
            def _norm(a: uuid.UUID, b: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
                return (a, b) if str(a) < str(b) else (b, a)

            async def are_friends(self, user_id: uuid.UUID, friend_id: uuid.UUID) -> bool:
                return self._norm(user_id, friend_id) in self_ref.friendships

            async def create_friendship(self, user_id: uuid.UUID, friend_id: uuid.UUID):
                self_ref.friendships.add(self._norm(user_id, friend_id))
                return True

            async def delete_friendship(self, user_id: uuid.UUID, friend_id: uuid.UUID):
                self_ref.friendships.discard(self._norm(user_id, friend_id))
                return True

            async def list_friend_ids(self, user_id: uuid.UUID):
                out: list[uuid.UUID] = []
                for a, b in self_ref.friendships:
                    if a == user_id:
                        out.append(b)
                    elif b == user_id:
                        out.append(a)
                return out

            async def count_friends(self, user_id: uuid.UUID) -> int:
                return len(await self.list_friend_ids(user_id))

        class FakeUserFriendRequestRepo:
            def __init__(self, _session):
                self._session = _session

            async def get_between(self, requester_id: uuid.UUID, target_id: uuid.UUID):
                return self_ref.requests.get((requester_id, target_id))

            async def create_request(self, requester_id: uuid.UUID, target_id: uuid.UUID):
                if (requester_id, target_id) in self_ref.requests:
                    return False
                self_ref.requests[(requester_id, target_id)] = SimpleNamespace(
                    requester_id=requester_id,
                    target_id=target_id,
                    created_at=self_ref.now,
                )
                return True

            async def delete_request(self, requester_id: uuid.UUID, target_id: uuid.UUID):
                return self_ref.requests.pop((requester_id, target_id), None) is not None

            async def list_incoming(self, target_id: uuid.UUID):
                return [row for (req_id, tgt_id), row in self_ref.requests.items() if tgt_id == target_id]

            async def list_outgoing(self, requester_id: uuid.UUID):
                return [row for (req_id, _tgt_id), row in self_ref.requests.items() if req_id == requester_id]

        class FakeUserNotificationRepo:
            def __init__(self, _session):
                self._session = _session

            async def create(
                self,
                *,
                user_id: uuid.UUID,
                type: str,
                title: str,
                message: str,
                actor_user_id: uuid.UUID | None = None,
                payload: dict | None = None,
            ):
                row = SimpleNamespace(
                    id=uuid.uuid4(),
                    user_id=user_id,
                    actor_user_id=actor_user_id,
                    type=type,
                    title=title,
                    message=message,
                    payload=payload,
                    is_read=False,
                    read_at=None,
                    created_at=self_ref.now,
                )
                self_ref.notifications.setdefault(user_id, []).append(row)
                return row

            async def list_for_user(self, user_id: uuid.UUID, *, limit: int = 20):
                rows = list(self_ref.notifications.get(user_id, []))
                rows.sort(key=lambda row: (row.is_read, -row.created_at.timestamp()))
                return rows[:limit]

            async def count_unread(self, user_id: uuid.UUID) -> int:
                return sum(1 for row in self_ref.notifications.get(user_id, []) if not row.is_read)

            async def get_by_id_for_user(self, notification_id: uuid.UUID, user_id: uuid.UUID):
                for row in self_ref.notifications.get(user_id, []):
                    if row.id == notification_id:
                        return row
                return None

            async def mark_read(self, row):
                row.is_read = True
                row.read_at = self_ref.now
                return row

            async def mark_all_read(self, user_id: uuid.UUID) -> int:
                count = 0
                for row in self_ref.notifications.get(user_id, []):
                    if not row.is_read:
                        row.is_read = True
                        row.read_at = self_ref.now
                        count += 1
                return count

        class FakeSchoolRepo:
            def __init__(self, _session):
                self._session = _session

            async def get_by_id(self, school_id: uuid.UUID):
                if school_id == self_ref.school_id:
                    return self_ref.school
                return None

        self_ref = self

        async def fake_load_activity_days(_session, _user_id):
            return [{"date": "2026-03-01", "count": 2}]

        async def fake_load_friends(_session, _friend_repo, _user_id, *, limit=20):
            return []

        async def fake_load_incoming_requests(_session, _request_repo, _user_id, *, limit=20):
            return []

        async def fake_load_notification_actor_map(_session, actor_ids):
            return {
                actor_id: (self_ref.users[actor_id], self_ref.profiles.get(actor_id))
                for actor_id in actor_ids
                if actor_id in self_ref.users
            }

        class FakeDashboardService:
            def __init__(self, _session):
                self._session = _session

            async def get_stats(self, _user_id):
                return SimpleNamespace(
                    overall_progress=10,
                    completed_lectures=1,
                    total_lectures=10,
                    solved_tasks=2,
                    total_tasks=20,
                    accuracy=50,
                )

        async def override_get_session():
            yield self.fake_session

        async def override_current_user(request: Request):
                                                               
                                
            marker = (request.headers.get("X-Test-User") or "").strip().lower()
            return self.user_b if marker == "b" else self.user_a

        def fake_verify_teacher_code(_plain: str, _hash: str) -> bool:
            return _plain == self_ref.teacher_code

        monkeypatch.setattr(users_router_module, "UserRepo", FakeUserRepo)
        monkeypatch.setattr(users_router_module, "UserProfileRepo", FakeUserProfileRepo)
        monkeypatch.setattr(users_router_module, "UserFriendRepo", FakeUserFriendRepo)
        monkeypatch.setattr(users_router_module, "UserFriendRequestRepo", FakeUserFriendRequestRepo)
        monkeypatch.setattr(users_router_module, "UserNotificationRepo", FakeUserNotificationRepo)
        monkeypatch.setattr(users_router_module, "SchoolRepo", FakeSchoolRepo)
        monkeypatch.setattr(users_router_module, "_load_activity_days", fake_load_activity_days)
        monkeypatch.setattr(users_router_module, "_load_friends", fake_load_friends)
        monkeypatch.setattr(users_router_module, "_load_incoming_requests", fake_load_incoming_requests)
        monkeypatch.setattr(
            users_router_module,
            "_load_notification_actor_map",
            fake_load_notification_actor_map,
        )
        monkeypatch.setattr(users_router_module, "DashboardService", FakeDashboardService)
        monkeypatch.setattr(users_router_module, "verify_teacher_code", fake_verify_teacher_code)

        app.dependency_overrides[get_session] = override_get_session
        app.dependency_overrides[get_current_user] = override_current_user
        yield
        app.dependency_overrides.clear()

    def test_profile_and_social(self):
        with TestClient(app) as client:
            profile_resp = client.get("/me/profile", headers={"Authorization": "Bearer fake"})
            assert profile_resp.status_code == 200
            assert profile_resp.json()["email"] == "alice@example.com"

            social_resp = client.get("/me/social", headers={"Authorization": "Bearer fake"})
            assert social_resp.status_code == 200
            social_data = social_resp.json()
            assert "friends" in social_data
            assert "activity" in social_data
            assert "incoming_requests" in social_data

    def test_friend_requests_lifecycle(self):
        with TestClient(app) as client:
                                 
            send_resp = client.post(
                "/me/friends",
                headers={"Authorization": "Bearer fake"},
                json={"friend_user_id": str(self.user_b.id)},
            )
            assert send_resp.status_code == 200
            assert send_resp.json()["status"] == "request_sent"

            send_again = client.post(
                "/me/friends",
                headers={"Authorization": "Bearer fake"},
                json={"friend_user_id": str(self.user_b.id)},
            )
            assert send_again.status_code == 200
            assert send_again.json()["status"] == "already_requested"

                                   
            accept_resp = client.post(
                f"/me/friends/requests/{self.user_a.id}/accept",
                headers={"Authorization": "Bearer fake", "X-Test-User": "b"},
            )
            assert accept_resp.status_code == 200
            assert accept_resp.json()["ok"] is True

                                                                
            already_friends = client.post(
                "/me/friends",
                headers={"Authorization": "Bearer fake"},
                json={"friend_user_id": str(self.user_b.id)},
            )
            assert already_friends.status_code == 200
            assert already_friends.json()["status"] == "already_friends"

                                                                            
            pub = client.get(
                f"/me/users/{self.user_b.id}/profile",
                headers={"Authorization": "Bearer fake"},
            )
            assert pub.status_code == 200
            assert pub.json()["friendship_status"] == "friends"

                                         
            remove_resp = client.delete(
                f"/me/friends/{self.user_b.id}",
                headers={"Authorization": "Bearer fake"},
            )
            assert remove_resp.status_code == 200
            assert remove_resp.json()["ok"] is True

                                               
            client.post(
                "/me/friends",
                headers={"Authorization": "Bearer fake"},
                json={"friend_user_id": str(self.user_b.id)},
            )
            reject_resp = client.post(
                f"/me/friends/requests/{self.user_a.id}/reject",
                headers={"Authorization": "Bearer fake", "X-Test-User": "b"},
            )
            assert reject_resp.status_code == 200
            assert reject_resp.json()["ok"] is True

                                                                
            client.post(
                "/me/friends",
                headers={"Authorization": "Bearer fake"},
                json={"friend_user_id": str(self.user_b.id)},
            )
            cancel_resp = client.delete(
                f"/me/friends/requests/{self.user_b.id}",
                headers={"Authorization": "Bearer fake"},
            )
            assert cancel_resp.status_code == 200
            assert cancel_resp.json()["ok"] is True

    def test_notifications_for_friend_request_and_accept(self):
        with TestClient(app) as client:
            send_resp = client.post(
                "/me/friends",
                headers={"Authorization": "Bearer fake"},
                json={"friend_user_id": str(self.user_b.id)},
            )
            assert send_resp.status_code == 200

            notifications_b = client.get(
                "/me/notifications",
                headers={"Authorization": "Bearer fake", "X-Test-User": "b"},
            )
            assert notifications_b.status_code == 200
            data_b = notifications_b.json()
            assert data_b["unread_count"] == 1
            assert data_b["items"][0]["type"] == "friend_request_received"
            notification_id = data_b["items"][0]["id"]

            read_resp = client.post(
                f"/me/notifications/{notification_id}/read",
                headers={"Authorization": "Bearer fake", "X-Test-User": "b"},
            )
            assert read_resp.status_code == 200

            notifications_b_after_read = client.get(
                "/me/notifications",
                headers={"Authorization": "Bearer fake", "X-Test-User": "b"},
            )
            assert notifications_b_after_read.status_code == 200
            assert notifications_b_after_read.json()["unread_count"] == 0

            accept_resp = client.post(
                f"/me/friends/requests/{self.user_a.id}/accept",
                headers={"Authorization": "Bearer fake", "X-Test-User": "b"},
            )
            assert accept_resp.status_code == 200

            notifications_a = client.get(
                "/me/notifications",
                headers={"Authorization": "Bearer fake"},
            )
            assert notifications_a.status_code == 200
            data_a = notifications_a.json()
            assert data_a["unread_count"] == 1
            assert data_a["items"][0]["type"] == "friend_added"

            read_all_resp = client.post(
                "/me/notifications/read-all",
                headers={"Authorization": "Bearer fake"},
            )
            assert read_all_resp.status_code == 200

            notifications_a_after_read_all = client.get(
                "/me/notifications",
                headers={"Authorization": "Bearer fake"},
            )
            assert notifications_a_after_read_all.status_code == 200
            assert notifications_a_after_read_all.json()["unread_count"] == 0

    def test_onboarding_teacher_sets_role_and_school(self):
        with TestClient(app) as client:
            onboarding_resp = client.post(
                "/me/onboarding",
                headers={"Authorization": "Bearer fake"},
                json={
                    "full_name": "Alice Updated",
                    "is_teacher": True,
                    "school_id": str(self.school_id),
                    "teacher_code": self.teacher_code,
                    "grade_level": None,
                    "primary_goal": None,
                    "interested_subjects": None,
                    "difficulties": "Need more physics practice",
                    "notes": "after school",
                },
            )
            assert onboarding_resp.status_code == 200
            data = onboarding_resp.json()
            assert data["role"] == "teacher"
            assert data["school"] == "NIS"

    def test_onboarding_student_sets_role_and_fields(self):
        with TestClient(app) as client:
            resp = client.post(
                "/me/onboarding",
                headers={"Authorization": "Bearer fake"},
                json={
                    "full_name": "Alice Student",
                    "is_teacher": False,
                    "grade_level": 11,
                    "primary_goal": "unt_prep",
                    "interested_subjects": ["math"],
                    "difficulties": "need practice",
                    "notes": "daily",
                },
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["role"] == "student"
            assert data["grade_level"] == 11
            assert data["primary_goal"] == "unt_prep"
            assert data["interested_subjects"] == ["math"]

    def test_onboarding_teacher_missing_school_or_code_is_422(self):
        with TestClient(app) as client:
            resp = client.post(
                "/me/onboarding",
                headers={"Authorization": "Bearer fake"},
                json={
                    "is_teacher": True,
                                                                                        
                },
            )
            assert resp.status_code == 422

    def test_onboarding_teacher_wrong_code_is_400(self):
        with TestClient(app) as client:
            resp = client.post(
                "/me/onboarding",
                headers={"Authorization": "Bearer fake"},
                json={
                    "full_name": "Alice Updated",
                    "is_teacher": True,
                    "school_id": str(self.school_id),
                    "teacher_code": "wrong",
                },
            )
            assert resp.status_code == 400
