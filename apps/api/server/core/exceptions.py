from fastapi import HTTPException, status


class AppException(HTTPException):
    """Bázová výjimka pro celou aplikaci."""

    pass


class NotFoundException(AppException):
    def __init__(self, detail: str = "Zdroj nenalezen"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class BadRequestException(AppException):
    def __init__(self, detail: str = "Chybný požadavek"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class ForbiddenException(AppException):
    def __init__(self, detail: str = "Nedostatečná práva"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)
