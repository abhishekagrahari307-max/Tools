import uuid

from django.conf import settings
from django.db import models

from .catalog import ART, GROUPS, OCCASIONS, OPENINGS, PALETTES


class Design(models.Model):
    code = models.SlugField(primary_key=True, max_length=40)
    occasion = models.SlugField(
        max_length=32,
        blank=True,
        default="",
        choices=[(k, v["name"]) for k, v in OCCASIONS.items()],
    )
    edition = models.CharField(
        max_length=12,
        default="signature",
        choices=[
            ("signature", "Illustrated plate"),
            ("folio", "Letter folio"),
            ("nocturne", "Night edition"),
        ],
    )
    name = models.CharField(max_length=70)
    caption = models.CharField(max_length=120)
    collection = models.CharField(max_length=20, choices=[(v, v) for v in GROUPS])
    art = models.CharField(max_length=20, choices=[(v, v) for v in ART])
    opening = models.CharField(max_length=20, choices=OPENINGS.items())
    palette = models.CharField(max_length=20, choices=[(k, v[0]) for k, v in PALETTES.items()])
    enabled = models.BooleanField(default=True)
    position = models.PositiveSmallIntegerField(default=10)

    class Meta:
        ordering = ["position", "name"]

    def __str__(self):
        return self.name

    def public(self):
        return {
            k: getattr(self, k)
            for k in (
                "code",
                "name",
                "caption",
                "collection",
                "art",
                "opening",
                "palette",
                "occasion",
                "edition",
            )
        }


class StudioSession(models.Model):
    # Only an SHA-256 digest of an unguessable token is persisted.
    digest = models.CharField(primary_key=True, max_length=64)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    expires = models.DateTimeField(db_index=True)
    auth_hash = models.CharField(max_length=128)  # invalidates on password reset


class Invitation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="invitations"
    )
    slug = models.SlugField(unique=True, max_length=90)
    draft = models.JSONField()
    published = models.JSONField(null=True, blank=True)
    version = models.PositiveIntegerField(default=1)
    updated = models.DateTimeField(auto_now=True)
    created = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.draft.get("person") or self.slug


class Media(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invitation = models.ForeignKey(Invitation, on_delete=models.CASCADE, related_name="media")
    kind = models.CharField(max_length=8)
    mime = models.CharField(max_length=32)
    size = models.PositiveIntegerField()
    contents = models.BinaryField()
    created = models.DateTimeField(auto_now_add=True)


class Reply(models.Model):
    invitation = models.ForeignKey(Invitation, on_delete=models.CASCADE, related_name="replies")
    receipt = models.CharField(max_length=64)
    name = models.CharField(max_length=80)
    attendance = models.CharField(
        max_length=8, choices=[("yes", "Attending"), ("no", "Not attending"), ("maybe", "Maybe")]
    )
    party = models.PositiveSmallIntegerField(default=0)
    note = models.CharField(max_length=300, blank=True)
    updated = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["invitation", "receipt"], name="one_reply_per_receipt")
        ]

    def public_to_host(self):
        return {k: getattr(self, k) for k in ("name", "attendance", "party", "note", "updated")}
