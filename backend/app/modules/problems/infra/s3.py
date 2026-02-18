"""AWS S3 helpers for problem image uploads via presigned URLs."""

from __future__ import annotations

import uuid
from typing import Any

import boto3
from botocore.config import Config

from app.settings import settings

_s3_client = None


def _get_s3_client():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
            config=Config(signature_version="s3v4"),
        )
    return _s3_client


ALLOWED_CONTENT_TYPES = frozenset(
    ["image/jpeg", "image/png", "image/gif", "image/webp"]
)

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB

_EXT_MAP = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
}


def generate_presigned_upload(
    *,
    problem_id: uuid.UUID | None,
    content_type: str,
    file_name: str | None = None,
) -> dict[str, Any]:
    """Return presigned PUT URL and the final public object URL."""
    ext = _EXT_MAP.get(content_type, "bin")
    unique = uuid.uuid4().hex[:12]
    prefix = str(problem_id) if problem_id else "tmp"
    key = f"problems/{prefix}/{unique}.{ext}"

    client = _get_s3_client()

    presigned_url = client.generate_presigned_url(
        ClientMethod="put_object",
        Params={
            "Bucket": settings.S3_BUCKET,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=600,
    )

    final_url = f"https://{settings.S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"

    return {
        "upload_url": presigned_url,
        "final_url": final_url,
        "key": key,
        "content_type": content_type,
    }
