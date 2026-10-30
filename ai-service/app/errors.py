"""Errors that are safe to return to the Express API."""


class AppServiceError(Exception):
    """A known failure with a public code, message, and HTTP status."""

    def __init__(self, code: str, message: str, status_code: int):
        super().__init__(message)
        self.code = code
        self.status_code = status_code
