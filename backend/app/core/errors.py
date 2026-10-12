from typing import Any
from fastapi import HTTPException, status

class MediTraceError(Exception):
    def __init__(self, message: str, code: str = "INTERNAL_ERROR", details: Any = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details

class AuthorizationError(MediTraceError):
    def __init__(self, message: str = "Access denied for this resource", details: Any = None):
        super().__init__(message=message, code="AUTHORIZATION_DENIED", details=details)

class NotFoundError(MediTraceError):
    def __init__(self, message: str = "Resource not found", details: Any = None):
        super().__init__(message=message, code="NOT_FOUND", details=details)

class ValidationError(MediTraceError):
    def __init__(self, message: str = "Validation failed", details: Any = None):
        super().__init__(message=message, code="VALIDATION_FAILED", details=details)

class CitationVerificationError(MediTraceError):
    def __init__(self, message: str = "Citation verification failed", details: Any = None):
        super().__init__(message=message, code="CITATION_VERIFICATION_FAILED", details=details)

class EmergencyDetectedError(MediTraceError):
    def __init__(self, message: str, emergency_info: dict[str, Any]):
        super().__init__(message=message, code="EMERGENCY_DETECTED", details=emergency_info)
