"""Test environment. These values never call Amazon Bedrock by themselves."""

import os

os.environ["PYTHON_SERVICE_TOKEN"] = "test-token"
os.environ["AWS_REGION"] = "ap-south-1"
os.environ["BEDROCK_MODEL_ID"] = "amazon.nova-lite-v1:0"
os.environ["MAX_DOCUMENT_CHARACTERS"] = "200000"
os.environ["MAX_OUTPUT_TOKENS"] = "400"
os.environ["MAX_UPLOAD_MB"] = "10"
os.environ["BEDROCK_RETRY_DELAY_SECONDS"] = "0"
os.environ["HOST"] = "127.0.0.1"
os.environ["PORT"] = "8000"
