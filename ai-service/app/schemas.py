"""Response shapes for the FastAPI service."""

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorDetail


class SummarizeResponse(BaseModel):
    success: bool = True
    filename: str
    summary: list[str] = Field(min_length=1)
    model: str
