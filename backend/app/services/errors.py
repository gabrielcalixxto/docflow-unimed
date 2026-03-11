class ServiceError(Exception):
    status_code = 400
    default_detail = "Request could not be processed."

    def __init__(self, detail: str | None = None):
        self.detail = detail or self.default_detail
        super().__init__(self.detail)


class NotFoundServiceError(ServiceError):
    status_code = 404
    default_detail = "Resource not found."


class ForbiddenServiceError(ServiceError):
    status_code = 403
    default_detail = "You do not have permission to perform this action."


class ConflictServiceError(ServiceError):
    status_code = 409
    default_detail = "Operation conflicts with the current resource state."
