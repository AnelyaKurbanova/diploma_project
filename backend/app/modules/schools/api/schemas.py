from __future__ import annotations

import uuid

from pydantic import BaseModel


class SchoolOut(BaseModel):
    id: uuid.UUID
    name: str


class SchoolCreateIn(BaseModel):
    name: str


class SchoolWithCodeOut(BaseModel):
    id: uuid.UUID
    name: str
    teacher_code: str
