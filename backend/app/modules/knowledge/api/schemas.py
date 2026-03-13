from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class IngestResponse(BaseModel):
    document_id: uuid.UUID
    chunks_count: int


class DocumentOut(BaseModel):
    id: uuid.UUID
    filename: str
    subject_code: str
    uploaded_at: datetime
    chunks_count: int
