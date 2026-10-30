"""Call Amazon Bedrock Runtime through the standard AWS credential chain.

Credentials come from the environment's AWS profile, IAM role, or other
providers supported by Boto3. This module does not accept access keys.
"""

import logging
import os
import time

import boto3
from botocore.config import Config
from botocore.exceptions import (
    BotoCoreError,
    ClientError,
    ConnectTimeoutError,
    EndpointConnectionError,
    NoCredentialsError,
    PartialCredentialsError,
    ReadTimeoutError,
)

from app.config import get_settings
from app.errors import AppServiceError

logger = logging.getLogger(__name__)

TRANSIENT_CODES = {
    "ThrottlingException",
    "TooManyRequestsException",
    "ServiceQuotaExceededException",
    "ServiceUnavailableException",
    "InternalServerException",
    "ModelTimeoutException",
    "ModelNotReadyException",
}
AUTH_CODES = {
    "UnrecognizedClientException",
    "InvalidSignatureException",
    "ExpiredTokenException",
    "IncompleteSignatureException",
}
ACCESS_CODES = {"AccessDeniedException"}
CONFIG_CODES = {"ResourceNotFoundException", "ValidationException"}


def generate_text(system_prompt: str, user_prompt: str, max_tokens: int, client=None) -> str:
    """Send a system prompt and a separate user message to Bedrock Converse."""
    settings = get_settings()
    _require_model_configuration(settings)
    runtime = client or create_client(settings)
    delay_seconds = _retry_delay_seconds()
    attempts = 3
    last_error = None

    for attempt in range(1, attempts + 1):
        try:
            response = runtime.converse(
                modelId=settings.bedrock_model_id,
                system=[{"text": system_prompt}],
                messages=[
                    {
                        "role": "user",
                        "content": [{"text": user_prompt}],
                    }
                ],
                inferenceConfig={
                    "maxTokens": max_tokens,
                    "temperature": 0.2,
                },
            )
            return _read_response_text(response)
        except AppServiceError:
            raise
        except ClientError as error:
            last_error = error
            code = error.response.get("Error", {}).get("Code", "Unknown")
            detail = error.response.get("Error", {}).get("Message", "")
            logger.warning("Bedrock request failed on attempt %s: %s", attempt, code)
            if code in TRANSIENT_CODES and attempt < attempts:
                time.sleep(delay_seconds * attempt)
                continue
            raise _map_client_error(code, detail) from error
        except (NoCredentialsError, PartialCredentialsError) as error:
            logger.warning("Bedrock credentials are not available.")
            raise AppServiceError(
                "BEDROCK_AUTH",
                "AWS credentials were not accepted. Configure an AWS profile or an IAM role. Do not put access keys in source code.",
                503,
            ) from error
        except (ReadTimeoutError, ConnectTimeoutError, EndpointConnectionError) as error:
            logger.warning("Bedrock network error on attempt %s: %s", attempt, type(error).__name__)
            if attempt < attempts:
                time.sleep(delay_seconds * attempt)
                continue
            raise AppServiceError(
                "BEDROCK_UNAVAILABLE",
                "Amazon Bedrock did not respond in time. Try again in a moment.",
                503,
            ) from error
        except BotoCoreError as error:
            logger.warning("Bedrock client error: %s", type(error).__name__)
            raise AppServiceError(
                "BEDROCK_UNAVAILABLE",
                "Amazon Bedrock could not be reached. Check the region and network connection.",
                503,
            ) from error

    raise _map_client_error("ThrottlingException", "") if last_error else AppServiceError(
        "BEDROCK_UNAVAILABLE",
        "Amazon Bedrock could not complete the request.",
        503,
    )


def create_client(settings=None):
    """Create a Bedrock Runtime client. This does not call the model."""
    settings = settings or get_settings()
    _require_model_configuration(settings)
    return boto3.client(
        "bedrock-runtime",
        region_name=settings.aws_region,
        config=Config(
            connect_timeout=5,
            read_timeout=60,
            retries={"max_attempts": 1},
        ),
    )


def _require_model_configuration(settings) -> None:
    if settings.aws_region and settings.bedrock_model_id:
        return
    raise AppServiceError(
        "BEDROCK_NOT_CONFIGURED",
        "Amazon Bedrock is not configured. Set AWS_REGION and BEDROCK_MODEL_ID for the Python service.",
        503,
    )


def _retry_delay_seconds() -> float:
    raw_value = os.getenv("BEDROCK_RETRY_DELAY_SECONDS", "0.5")
    try:
        return max(float(raw_value), 0)
    except ValueError:
        return 0.5


def _read_response_text(response: dict) -> str:
    content = response.get("output", {}).get("message", {}).get("content", [])
    pieces = []
    for block in content:
        if isinstance(block, dict) and block.get("text"):
            pieces.append(block["text"])
    text = "\n".join(pieces).strip()
    if not text:
        logger.warning("Bedrock returned no text. stopReason=%s", response.get("stopReason"))
        raise AppServiceError(
            "SUMMARY_EMPTY",
            "The model did not return a usable summary. Try again.",
            502,
        )
    return text


def _map_client_error(code: str, message: str = "") -> AppServiceError:
    lowered = message.lower()
    if "inference profile" in lowered or "on-demand throughput" in lowered:
        return AppServiceError(
            "BEDROCK_CONFIG",
            "This model must be called with an inference profile. In ap-south-1, set BEDROCK_MODEL_ID to apac.amazon.nova-lite-v1:0.",
            503,
        )
    if code in AUTH_CODES:
        return AppServiceError(
            "BEDROCK_AUTH",
            "AWS credentials were not accepted. Configure an AWS profile or an IAM role. Do not put access keys in source code.",
            503,
        )
    if code in ACCESS_CODES:
        return AppServiceError(
            "BEDROCK_ACCESS_DENIED",
            "Amazon Bedrock denied access to the configured model. Check the model ID, Region, and IAM permissions.",
            503,
        )
    if code in TRANSIENT_CODES:
        return AppServiceError(
            "BEDROCK_THROTTLED",
            "Amazon Bedrock is temporarily busy. Wait a moment and try again.",
            503,
        )
    if code in CONFIG_CODES:
        return AppServiceError(
            "BEDROCK_CONFIG",
            "The configured Amazon Bedrock model could not be used. Check BEDROCK_MODEL_ID and model access in this Region.",
            503,
        )
    return AppServiceError(
        "BEDROCK_UNAVAILABLE",
        "Amazon Bedrock could not complete the request. Try again later.",
        503,
    )
