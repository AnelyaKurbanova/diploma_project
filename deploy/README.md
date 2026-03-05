# Деплой на сервер (включая video_worker)

## Что сделано в репозитории

1. **CI (GitHub Actions)** при пуше в `dev`/`main` собирает и пушит три образа:
   - `ghcr.io/anelyakurbanova/diploma-backend:$tag`
   - `ghcr.io/anelyakurbanova/diploma-frontend:$tag`
   - `ghcr.io/anelyakurbanova/diploma-video-worker:$tag` (новый микросервис)

2. **Пример production compose** — `deploy/docker-compose.prod.yml`: db, rabbitmq, api, frontend, video-worker.

## Что нужно сделать на сервере

### 1. Обновить docker-compose на сервере

В каталоге деплоя (`/opt/app-staging` или `/opt/app-prod`) должен быть актуальный compose с **RabbitMQ** и **video-worker**.

**Вариант А.** Заменить ваш текущий `docker-compose.yml` содержимым из репозитория:

```bash
# На своей машине
scp deploy/docker-compose.prod.yml user@server:/opt/app-staging/docker-compose.yml
```

**Вариант Б.** Вручную добавить в существующий compose сервисы `rabbitmq` и `video-worker` (и зависимости api от rabbitmq), по образцу `deploy/docker-compose.prod.yml`.

### 2. Переменные окружения

В `.env` на сервере должны быть переменные и для **backend**, и для **video_worker**.

Для **video_worker** нужны (добавьте в тот же `.env`, что использует compose):

```env
# Уже есть для backend (Postgres)
POSTGRES_DB=app
POSTGRES_USER=app
POSTGRES_PASSWORD=...

# RabbitMQ (backend публикует задачи, video_worker их потребляет)
RABBITMQ_DEFAULT_USER=app
RABBITMQ_DEFAULT_PASS=...
RABBIT_URL=amqp://app:...@rabbitmq:5672/

# video_worker — Postgres (тот же инстанс, что и backend)
POSTGRES_DSN=postgresql+asyncpg://app:...@db:5432/app

# video_worker — OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini

# video_worker — S3 (загрузка готовых видео)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=eu-north-1
S3_BUCKET=your-bucket-name
```

Backend должен видеть тот же `RABBIT_URL`, чтобы публиковать задачи в очередь `video.requested`.

### 3. Тег образов (staging / prod)

В каталоге деплоя задайте тег, который совпадает с веткой (для CI):

- staging: `IMAGE_TAG=staging` (деплой с ветки `dev`)
- prod: `IMAGE_TAG=prod` (деплой с ветки `main`)

Можно в `.env` на сервере:

```env
IMAGE_TAG=staging
```

или экспортировать перед запуском:

```bash
export IMAGE_TAG=staging
docker compose up -d
```

### 4. После обновления compose и .env

Текущий GitHub Actions деплой уже делает на сервере:

```bash
cd /opt/app-staging   # или /opt/app-prod
docker compose down
docker image prune -af
docker compose pull
docker compose up -d
```

Проверка, что поднялись все сервисы, в том числе video-worker и rabbitmq:

```bash
docker compose ps
docker compose logs video-worker -f
```

## Итог

- В репозитории: CI собирает и пушит **backend**, **frontend**, **video-worker**.
- На сервере: обновлённый **docker-compose** (из `deploy/docker-compose.prod.yml`) с db, rabbitmq, api, frontend, video-worker и полный **.env** с переменными для backend и video_worker. После этого обычный деплой через push в `dev`/`main` поднимет все три приложения.
