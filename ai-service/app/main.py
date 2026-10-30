"""FastAPI service for private document summarization."""

import asyncio
import logging
import secrets
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Header, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.document_reader import extract_text, public_filename
from app.errors import AppServiceError
from app.schemas import HealthResponse, SummarizeResponse
from app.summarizer import summarize_text

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app):
    settings = get_settings()
    if settings.host not in {"127.0.0.1", "localhost", "::1"}:
        logger.warning("HOST is not localhost. Keep this service on a private network.")
    if not settings.service_token:
        logger.warning("PYTHON_SERVICE_TOKEN is missing. Summarize requests will be rejected.")
    yield


app = FastAPI(
    title="AI Document Summarizer - Python service",
    version="1.0.0",
    docs_url="/docs",
    lifespan=lifespan,
)


@app.get("/health", response_model=HealthResponse)
def health():
    """Confirm that the process is running. This does not call Amazon Bedrock."""
    return {"status": "ok"}


@app.post("/summarize", response_model=SummarizeResponse)
async def summarize(
    file: UploadFile = File(...),
    x_service_token: str | None = Header(default=None, alias="X-Service-Token"),
):
    """Extract text from an uploaded document and summarize it with Bedrock."""
    _require_token(x_service_token)
    settings = get_settings()
    filename = public_filename(file.filename or "document")
    try:
        data = await _read_limited(file, settings.max_upload_bytes)
        summary, model_id = await asyncio.to_thread(_process_document, filename, data)
    finally:
        await file.close()

    logger.info("Summary created. bytes=%s points=%s", len(data), len(summary))
    return {
        "success": True,
        "filename": filename,
        "summary": summary,
        "model": model_id,
    }


def _process_document(filename: str, data: bytes):
    text = extract_text(filename, data)
    return summarize_text(text)


async def _read_limited(upload: UploadFile, max_bytes: int) -> bytes:
    chunks = []
    total = 0
    while True:
        block = await upload.read(1024 * 1024)
        if not block:
            break
        total += len(block)
        if total > max_bytes:
            limit_mb = max(max_bytes // (1024 * 1024), 1)
            raise AppServiceError(
                "FILE_TOO_LARGE",
                f"The file exceeds the {limit_mb} MB upload limit.",
                413,
            )
        chunks.append(block)
    if total == 0:
        raise AppServiceError("EMPTY_FILE", "The uploaded file is empty.", 400)
    return b"".join(chunks)


def _require_token(provided: str | None) -> None:
    expected = get_settings().service_token
    if not expected:
        raise AppServiceError(
            "SERVICE_NOT_CONFIGURED",
            "The summarization service token is not configured.",
            503,
        )
    provided_bytes = (provided or "").encode("utf-8")
    expected_bytes = expected.encode("utf-8")
    if not provided or not secrets.compare_digest(provided_bytes, expected_bytes):
        raise AppServiceError("UNAUTHORIZED", "The request is not authorized.", 401)


@app.exception_handler(AppServiceError)
async def handle_service_error(_request, error: AppServiceError):
    return JSONResponse(
        status_code=error.status_code,
        content={
            "success": False,
            "error": {"code": error.code, "message": str(error)},
        },
    )


@app.exception_handler(RequestValidationError)
async def handle_validation_error(_request, _error: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": {
                "code": "INVALID_REQUEST",
                "message": "Attach a document using the file field.",
            },
        },
    )


@app.exception_handler(Exception)
async def handle_unexpected_error(_request, error: Exception):
    logger.error("Unhandled error type=%s", type(error).__name__)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "The summarization service could not complete the request.",
            },
        },
    )


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(app, host=settings.host, port=settings.port)
