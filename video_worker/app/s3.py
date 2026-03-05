from __future__ import annotations

from pathlib import Path
from typing import Any, Dict

import boto3

from .settings import Settings


class S3Client:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client = boto3.client(
            "s3",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
        )

    @property
    def bucket(self) -> str:
        return self._settings.s3_bucket

    def upload_final_video(self, job_id: str, file_path: Path) -> str:
        """Upload final.mp4 to S3 and return the object URL."""

        key = f"videos/{job_id}/final.mp4"
        self._client.upload_file(str(file_path), self.bucket, key)
        return self._object_url(key)

    def generate_presigned_url(self, key: str) -> str:
        """Generate a presigned URL for the given S3 key."""

        params: Dict[str, Any] = {
            "Bucket": self.bucket,
            "Key": key,
        }
        url = self._client.generate_presigned_url(
            ClientMethod="get_object",
            Params=params,
            ExpiresIn=self._settings.s3_presign_expires_seconds,
        )
        return url

    def _object_url(self, key: str) -> str:
        return f"https://{self.bucket}.s3.{self._settings.aws_region}.amazonaws.com/{key}"

