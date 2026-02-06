# README — Modular FastAPI Monolith (dev: venv + Postgres in Docker)

## Зачем эта структура
Проект построен как **модульный монолит**: каждая фича живёт в своём модуле и максимально изолирована от других.  
API запускается **локально** (быстро, hot reload), а **PostgreSQL** поднимается в **Docker** (стабильная инфраструктура для всей команды).

---

## Требования
- Python **3.11+**
- Docker Desktop (для PostgreSQL)
- PowerShell (Windows) / bash (Linux/macOS)

---

## Структура проекта и назначение файлов

```
diploma/
├─ .env.example                 # пример переменных окружения (копируем в .env)
├─ .env                         # локальные переменные окружения (НЕ коммитить)
├─ requirements.txt             # зависимости для локальной разработки через venv
├─ docker-compose.dev.yml       # dev-compose: ТОЛЬКО PostgreSQL (API запускается локально)
├─ Dockerfile                   # (опционально) для контейнеризации API позже/для CI
├─ alembic.ini                  # конфиг Alembic (ini, НЕ Python)
├─ migrations/
│  ├─ env.py                    # Alembic runtime: подключение metadata, чтение .env, url
│  ├─ script.py.mako            # шаблон генерации миграций Alembic
│  └─ versions/                 # файлы миграций (автогенерируемые/ручные)
└─ app/
   ├─ main.py                   # создание FastAPI app, подключение роутеров, error handler
   ├─ settings.py               # конфиг приложения (pydantic-settings), читает .env
   ├─ routers.py                # агрегатор роутеров: подключает router каждого модуля
   ├─ core/
   │  ├─ errors.py              # единые доменные ошибки (AppError/NotFound/Conflict)
   │  └─ logging.py             # настройка логирования (JSON logs)
   ├─ data/
   │  └─ db/
   │     ├─ base.py             # SQLAlchemy Base (DeclarativeBase)
   │     ├─ session.py          # async engine + sessionmaker + dependency get_session
   │     └─ registry.py         # ЕДИНСТВЕННОЕ место, где перечисляются модели модулей
   └─ modules/
      └─ projects/              # пример модуля CRUD
         ├─ api/
         │  ├─ router.py        # HTTP эндпоинты модуля (тонкие, без логики)
         │  └─ schemas.py       # Pydantic модели запросов/ответов
         ├─ application/
         │  └─ service.py       # use-cases / бизнес-логика (транзакции на write)
         └─ data/
            ├─ models.py        # ORM модели этого модуля (таблицы)
            └─ repo.py          # доступ к БД (CRUD) только для этого модуля
```

### Главные правила проекта
1) **Роутер (`api/router.py`) не содержит бизнес-логики** — только принимает запрос, вызывает сервис, возвращает ответ.  
2) **Бизнес-логика живёт в `application/service.py`**.  
3) **Работа с БД — только через `data/repo.py`**.  
4) **ORM модели — внутри модуля** (`modules/<name>/data/models.py`).  
5) Модули **не импортируют друг друга**.  
6) Единственная “точка склейки” модулей:
   - `app/routers.py` — подключение router
   - `app/data/db/registry.py` — подключение ORM моделей для Alembic

---

## Правило работы с миграциями в команде
- один человек — одна миграция
- миграции коммитятся вместе с кодом
- никогда не редактировать уже применённые миграции

---

## Быстрый старт (Windows / PowerShell) — с нуля

### 1) Клонировать репозиторий и перейти в папку
```powershell
git clone <repo>
cd diploma
```

### 2) Создать `.env`
```powershell
copy .env.example .env
```

### 3) Поднять PostgreSQL в Docker (dev)
```powershell
docker compose -f docker-compose.dev.yml --env-file .env up -d
docker ps
```

### 4) Создать venv
```powershell
python -m venv .venv
```

### 5) Разрешить выполнение скриптов (1 раз на пользователя)
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```
Закрой PowerShell и открой заново.

### 6) Активировать venv
```powershell
.venv\Scripts\Activate.ps1
```

### 7) Установить зависимости
```powershell
pip install --upgrade pip
pip install -r requirements.txt
```

### 8) Применить миграции
```powershell
alembic upgrade head
```

### 9) Запустить API (быстро, hot reload)
```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Открой:
- Swagger: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/health

---

## Автогенерация миграций (Alembic)

### Создать новую миграцию автоматически (после изменения моделей)
```powershell
alembic revision --autogenerate -m "your message"
```

### Применить миграции
```powershell
alembic upgrade head
```

### Откатить последнюю миграцию
```powershell
alembic downgrade -1
```

---

## Автогенерация requirements.txt (ПОСЛЕ добавления новых библиотек)

После установки новых зависимостей в активированном venv обнови `requirements.txt` командой:

```powershell
pip freeze > requirements.txt
```

Рекомендуется делать это **после каждого добавления новой библиотеки**, чтобы у всей команды были одинаковые версии.

---

## Как добавить новый модуль 

Предположим, хотим новый модуль `users`.

### 1) Создать папки
```
app/modules/users/
  api/
  application/
  data/
```

И файлы:
```
app/modules/users/api/router.py
app/modules/users/api/schemas.py
app/modules/users/application/service.py
app/modules/users/data/models.py
app/modules/users/data/repo.py
```

### 2) Создать ORM модель (пример)
`app/modules/users/data/models.py`
- таблица `users`
- поля (uuid, email, etc.)
- наследование от `Base` из `app.data.db.base`

### 3) Создать repo
`app/modules/users/data/repo.py`
- CRUD функции
- обработка `IntegrityError` (уникальные ограничения) → `Conflict`

### 4) Создать service (use-cases)
`app/modules/users/application/service.py`
- на write-операциях использовать транзакции:
  - `async with session.begin(): ...`

### 5) Создать router
`app/modules/users/api/router.py`
- dependency `session: AsyncSession = Depends(get_session)`
- вызвать сервис
- вернуть `schemas`

### 6) Подключить router модуля
Открыть `app/routers.py` и добавить:
```python
from app.modules.users.api.router import router as users_router
api_router.include_router(users_router)
```

### 7) Зарегистрировать модели для Alembic
Открыть `app/data/db/registry.py` и добавить импорт:
```python
from app.modules.users.data import models as _users_models  # noqa: F401
```

### 8) Сгенерировать миграцию
```powershell
alembic revision --autogenerate -m "add users"
alembic upgrade head
```

---

## Как “правильно” проектировать модуль

### 1) Не тянуть ORM классы из другого модуля
Если нужна связь между модулями — делай это через:
- UUID поля (`user_id: UUID`)
- foreign key строкой (в миграции), но **без импорта класса**
- и бизнес-валидацию через сервисы (если надо)

### 2) Сервис = бизнес-логика
- в сервисе решаем “можно/нельзя”
- репозиторий только читает/пишет

### 3) Роутер тонкий
- валидация уже в schemas
- роутер не решает правила

---

## Команды

Поднять БД:
```powershell
docker compose -f docker-compose.dev.yml --env-file .env up -d
```

Остановить БД:
```powershell
docker compose -f docker-compose.dev.yml down
```

Миграции:
```powershell
alembic revision --autogenerate -m "msg"
alembic upgrade head
```

Запуск API:
```powershell
uvicorn app.main:app --reload
```

---
