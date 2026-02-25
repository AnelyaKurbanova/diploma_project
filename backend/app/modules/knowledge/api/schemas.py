from __future__ import annotations

import uuid

from pydantic import BaseModel, Field


class IngestResponse(BaseModel):
    document_id: uuid.UUID
    chunks_count: int
