from django.contrib import admin
from django.db.models import F

from .models import Design, Invitation, Reply

admin.site.site_header = "Celebration Studio · Administration"
admin.site.site_title = "Celebration Studio"
admin.site.index_title = "Platform management"


@admin.register(Design)
class DesignAdmin(admin.ModelAdmin):
    list_display = ("name", "collection", "opening", "palette", "enabled", "position")
    list_editable = ("enabled", "position")
    list_filter = ("collection", "enabled")
    search_fields = ("code", "name")

    def get_readonly_fields(self, request, obj=None):
        return ("code",) if obj else ()


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ("__str__", "owner", "slug", "updated")
    search_fields = ("slug", "owner__email")
    readonly_fields = ("id", "owner", "slug", "version", "draft", "published", "created", "updated")
    actions = ("take_offline",)

    @admin.action(description="Unpublish selected invitations")
    def take_offline(self, request, qs):
        qs.update(published=None, version=F("version") + 1)

    def has_add_permission(self, request):
        return False


@admin.register(Reply)
class ReplyAdmin(admin.ModelAdmin):
    list_display = ("name", "invitation", "attendance", "party", "updated")
    list_filter = ("attendance",)
    search_fields = ("invitation__slug", "name")
    exclude = ("receipt",)
    readonly_fields = ("name", "invitation", "attendance", "party", "note", "updated")

    def has_add_permission(self, request):
        return False
