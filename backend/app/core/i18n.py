from __future__ import annotations

_MESSAGES_RU: dict[str, str] = {
    # ── core / generic ────────────────────────────────────────────────
    "app_error": "Ошибка приложения",
    "not_found": "Не найдено",
    "conflict": "Конфликт данных",
    "bad_request": "Некорректный запрос",
    "unauthorized": "Не авторизован",
    "forbidden": "Доступ запрещён",
    "too_many_requests": "Слишком много запросов",
    "internal_server_error": "Внутренняя ошибка сервера",

    # ── auth ──────────────────────────────────────────────────────────
    "otp_sent_if_eligible": "Если email корректен, код подтверждения отправлен",
    "too_many_otp": "Слишком много запросов кода",
    "too_many_otp_ip": "Слишком много запросов кода с этого IP",
    "user_already_exists": "Пользователь с таким email уже существует",
    "wait_before_resend": "Подождите перед повторной отправкой кода",
    "too_many_verify": "Слишком много попыток проверки",
    "invalid_code_or_email": "Неверный код или email",
    "invalid_or_expired_code": "Код недействителен или истёк",
    "too_many_attempts": "Слишком много попыток",
    "invalid_code": "Неверный код",
    "invalid_credentials": "Неверные учётные данные",
    "google_email_not_verified": "Email Google не подтверждён",
    "invalid_refresh_token": "Недействительный токен обновления",
    "session_expired": "Сессия истекла",
    "session_compromised": "Сессия скомпрометирована. Войдите заново.",
    "csrf_failed": "Ошибка CSRF-проверки",
    "missing_refresh_token": "Токен обновления отсутствует",
    "logged_out": "Вы вышли из системы",
    "logged_out_all": "Вы вышли со всех устройств",
    "invalid_access_token": "Недействительный токен доступа",
    "user_not_found": "Пользователь не найден",
    "insufficient_permissions": "Недостаточно прав",

    # ── rate-limit ────────────────────────────────────────────────────
    "retry_in": "Повторите через {seconds} сек.",

    # ── users / profile ───────────────────────────────────────────────
    "profile_not_initialized": "Профиль не инициализирован",

    # ── problems ──────────────────────────────────────────────────────
    "problem_not_found": "Задача не найдена",
    "problem_not_available": "Задача недоступна",
    "failed_to_create_problem": "Не удалось создать задачу",
    "failed_to_update_problem": "Не удалось обновить задачу",
    "only_draft_or_pending_edit": "Редактировать можно только черновики и задачи на проверке",
    "only_draft_submit_review": "Только черновики можно отправить на проверку",
    "only_pending_publish": "Опубликовать можно только задачи на проверке",
    "only_pending_reject": "Отклонить можно только задачи на проверке",
    "numeric_type_deprecated": "Тип «числовой» устарел; используйте «текстовый ответ»",
    "problem_has_submissions_cannot_delete": "Нельзя удалить задачу: есть отправленные решения. Сначала удалите их или архивируйте задачу.",

    # ── submissions ───────────────────────────────────────────────────
    "graded": "Проверено",
    "sent_to_review": "Отправлено на проверку",

    # ── catalog ───────────────────────────────────────────────────────
    "subject_code_exists": "Предмет с таким кодом уже существует",
    "subject_not_found": "Предмет не найден",
    "topic_params_exist": "Тема с такими параметрами уже существует",
    "topic_not_found": "Тема не найдена",

    # ── lessons ───────────────────────────────────────────────────────
    "lesson_not_found": "Урок не найден",
    "content_block_not_found": "Блок контента не найден",

    # ── schools ───────────────────────────────────────────────────────
    "school_not_found": "Школа не найдена",

    # ── projects ──────────────────────────────────────────────────────
    "project_name_exists": "Проект с таким названием уже существует",
    "project_not_found": "Проект не найден",
}

_ACTIVE_LOCALE = _MESSAGES_RU


def tr(key: str, **kwargs: object) -> str:
    template = _ACTIVE_LOCALE.get(key, key)
    if kwargs:
        return template.format(**kwargs)
    return template
