class StudioHeaders:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.path.startswith("/admin/"):
            response["X-Frame-Options"] = "DENY"
        else:  # The studio can be embedded in Arena; scripts, media and API are first-party only.
            response["Content-Security-Policy"] = (
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: blob:; font-src 'self'; media-src 'self' blob:; connect-src 'self' blob:; "
                "object-src 'none'; base-uri 'none'; form-action 'self'"
            )
        if not request.path.startswith("/s/"):
            response["Cache-Control"] = "no-store"
        response["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response
