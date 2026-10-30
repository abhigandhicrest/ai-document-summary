from botocore.exceptions import ClientError, NoCredentialsError, ReadTimeoutError

from app.bedrock_client import generate_text
from app.errors import AppServiceError
import pytest


def client_error(code: str, message: str | None = None) -> ClientError:
    return ClientError(
        {
            "Error": {
                "Code": code,
                "Message": message
                or "sensitive arn:aws:iam::123456789012:user/secret AKIAEXAMPLE",
            }
        },
        "Converse",
    )


class ScriptedClient:
    def __init__(self, effects):
        self.effects = list(effects)
        self.calls = 0

    def converse(self, **_kwargs):
        self.calls += 1
        effect = self.effects.pop(0)
        if isinstance(effect, Exception):
            raise effect
        return effect


def success_response(text="1. A usable summary point."):
    return {"output": {"message": {"content": [{"text": text}]}}}


def test_authentication_failure_is_safe():
    client = ScriptedClient([NoCredentialsError()])
    with pytest.raises(AppServiceError) as error:
        generate_text("system", "user", 100, client=client)
    assert error.value.code == "BEDROCK_AUTH"
    assert "arn:aws" not in str(error.value)
    assert "AKIA" not in str(error.value)
    assert client.calls == 1


def test_access_denied_is_safe_and_not_retried():
    client = ScriptedClient([client_error("AccessDeniedException")])
    with pytest.raises(AppServiceError) as error:
        generate_text("system", "user", 100, client=client)
    assert error.value.code == "BEDROCK_ACCESS_DENIED"
    assert "secret" not in str(error.value)
    assert client.calls == 1


def test_throttling_retries_then_succeeds():
    client = ScriptedClient(
        [
            client_error("ThrottlingException"),
            client_error("ThrottlingException"),
            success_response(),
        ]
    )
    text = generate_text("system", "user", 100, client=client)
    assert "usable summary" in text
    assert client.calls == 3


def test_throttling_after_retries_returns_a_temporary_failure():
    client = ScriptedClient([client_error("ThrottlingException")] * 3)
    with pytest.raises(AppServiceError) as error:
        generate_text("system", "user", 100, client=client)
    assert error.value.code == "BEDROCK_THROTTLED"
    assert client.calls == 3


def test_timeout_returns_a_service_failure():
    timeout = ReadTimeoutError(endpoint_url="https://bedrock.example")
    client = ScriptedClient([timeout, timeout, timeout])
    with pytest.raises(AppServiceError) as error:
        generate_text("system", "user", 100, client=client)
    assert error.value.code == "BEDROCK_UNAVAILABLE"
    assert client.calls == 3


def test_on_demand_model_id_asks_for_an_inference_profile():
    client = ScriptedClient(
        [
            client_error(
                "AccessDeniedException",
                "Invocation of model ID with on-demand throughput isn't supported. Retry with an inference profile.",
            )
        ]
    )
    with pytest.raises(AppServiceError) as error:
        generate_text("system", "user", 100, client=client)
    assert error.value.code == "BEDROCK_CONFIG"
    assert "apac.amazon.nova-lite-v1:0" in str(error.value)
    assert "secret" not in str(error.value)


def test_invalid_model_returns_a_setup_error():
    client = ScriptedClient([client_error("ValidationException")])
    with pytest.raises(AppServiceError) as error:
        generate_text("system", "user", 100, client=client)
    assert error.value.code == "BEDROCK_CONFIG"


def test_missing_configuration_does_not_call_the_client(monkeypatch):
    monkeypatch.setenv("BEDROCK_MODEL_ID", "")
    monkeypatch.setenv("AWS_REGION", "")
    client = ScriptedClient([success_response()])
    with pytest.raises(AppServiceError) as error:
        generate_text("system", "user", 100, client=client)
    assert error.value.code == "BEDROCK_NOT_CONFIGURED"
    assert client.calls == 0
