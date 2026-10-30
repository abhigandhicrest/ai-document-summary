"""Read Python service settings from the environment."""

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    host: str
    port: int
    aws_region: str
    bedrock_model_id: str
    max_document_characters: int
    max_output_tokens: int
    service_token: str
    max_upload_bytes: int
    single_pass_characters: int
    chunk_characters: int


def get_settings() -> Settings:
    """Load settings each call so tests and local edits are picked up."""
    max_characters = _read_positive_int("MAX_DOCUMENT_CHARACTERS", 200_000)
    # One Bedrock request is used when the document fits in this budget.
    # Larger documents, up to max_characters, are summarized in chunks.
    single_pass_characters = min(50_000, max_characters)
    chunk_characters = min(40_000, max_characters)

    return Settings(
        host=os.getenv("HOST", "127.0.0.1"),
        port=_read_positive_int("PORT", 8000),
        aws_region=os.getenv("AWS_REGION", "").strip(),
        bedrock_model_id=os.getenv("BEDROCK_MODEL_ID", "").strip(),
        max_document_characters=max_characters,
        max_output_tokens=_read_positive_int("MAX_OUTPUT_TOKENS", 800),
        service_token=os.getenv("PYTHON_SERVICE_TOKEN", ""),
        max_upload_bytes=_read_positive_int("MAX_UPLOAD_MB", 10) * 1024 * 1024,
        single_pass_characters=single_pass_characters,
        chunk_characters=max(chunk_characters, 1),
    )


def _read_positive_int(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None or raw_value.strip() == "":
        return default
    try:
        value = int(raw_value)
    except ValueError as error:
        raise ValueError(f"{name} must be a whole number.") from error
    if value <= 0:
        raise ValueError(f"{name} must be greater than zero.")
    return value
