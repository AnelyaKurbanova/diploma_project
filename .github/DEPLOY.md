# Деплой (два сервера: main + video_worker)

## Секреты GitHub (Settings → Secrets and variables → Actions)

**Основной сервер (уже есть):**
- `DEPLOY_HOST` — IP/домен основного droplet (backend, frontend, db, rabbit и т.д.)
- `DEPLOY_USER` — SSH-пользователь
- `DEPLOY_KEY` — приватный SSH-ключ

**Отдельный droplet для video_worker (добавить):**
- `VIDEO_WORKER_DEPLOY_HOST` — IP/домен droplet с video_worker
- `VIDEO_WORKER_DEPLOY_USER` — SSH-пользователь (может совпадать с `DEPLOY_USER`)
- `VIDEO_WORKER_DEPLOY_KEY` — SSH-ключ (может быть тот же, что `DEPLOY_KEY`)

**Важно:** ключи в `DEPLOY_KEY` и `VIDEO_WORKER_DEPLOY_KEY` должны быть **без passphrase**. GitHub Actions не может ввести пароль к ключу. Сгенерируй отдельный ключ только для CI: `ssh-keygen -t ed25519 -C "ci-deploy" -f ~/.ssh/ci_deploy -N ""`, добавь `ci_deploy.pub` в `~/.ssh/authorized_keys` на **обоих** серверах, в оба секрета (`DEPLOY_KEY` и `VIDEO_WORKER_DEPLOY_KEY`) положи содержимое файла `~/.ssh/ci_deploy` (приватный ключ).

## На серверах

**Основной сервер** (`/opt/app-prod` или `/opt/app-staging`):
- В `docker-compose` не должно быть сервиса `video_worker` (оставить только backend, frontend, db, rabbit, nginx и т.д.).

**Droplet video_worker** (`/opt/video-worker-prod` или `/opt/video-worker-staging`):
- Создать каталог и положить туда `docker-compose.yml` только с сервисом video_worker (образ `ghcr.io/anelyakurbanova/diploma-video-worker:prod` / `:staging`).
- Настроить `.env` (очередь RabbitMQ, БД, S3 и т.д. — URL’ы основного сервера/внешних сервисов).

После пуша в `dev` или `main` CI/CD соберёт образы, задеплоит основное приложение на основной сервер и video_worker на второй droplet параллельно.
