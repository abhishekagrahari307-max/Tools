from django.contrib import admin
from django.urls import path

from studio import views as v

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/catalog", v.catalog),
    path("api/auth/<str:action>", v.auth),
    path("api/me", v.me),
    path("api/invitations", v.invitations),
    path("api/invitations/<uuid:key>", v.invitation),
    path("api/invitations/<uuid:key>/responses", v.replies),
    path("api/invitations/<uuid:key>/upload/<str:kind>", v.upload),
    path("api/invitations/<uuid:key>/media/<uuid:mid>", v.private_media),
    path("api/invitations/<uuid:key>/<str:action>", v.publication),
    path("api/public/<slug:slug>", v.guest_card),
    path("api/public/<slug:slug>/qr.png", v.invitation_qr),
    path("api/public/<slug:slug>/rsvp", v.rsvp),
    path("api/public/<slug:slug>/media/<uuid:mid>", v.public_media),
    path("api/oversight", v.oversight),
    path("i/<slug:slug>", v.shell),
    path("", v.shell),
]
