FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DEBIAN_FRONTEND=noninteractive

# slim-образу нужна директория man для установки части пакетов
RUN mkdir -p /usr/share/man/man1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg \
        libcairo2 \
        libpango-1.0-0 \
        libgdk-pixbuf-xlib-2.0-0 \
        latexmk \
        texlive-latex-base \
        texlive-latex-extra \
        texlive-fonts-recommended \
        texlive-science \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Сборка из корня репозитория: docker build -f video_worker/Dockerfile .
COPY video_worker/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY video_worker/ /app/video_worker/

CMD ["python", "-m", "video_worker.app.main"]

