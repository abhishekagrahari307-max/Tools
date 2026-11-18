"""A separate collection for each studio. Do not replace the six original designs or touch invitation JSON."""

from django.db import migrations

# Occasion, group, names for the illustrated / folio / night plates, opening scenes, signature palette.
ROWS = [
    (
        "birthday",
        "Milestones",
        ("Buttercream Wishes", "Birthday Post", "Midnight Candles"),
        ("balloon", "gift", "confetti"),
        "rose",
    ),
    (
        "wedding",
        "Milestones",
        ("The Palace Courtyard", "Vows on Vellum", "The Moonlit Mandap"),
        ("envelope", "hearts", "diya"),
        "wine",
    ),
    (
        "engagement",
        "Milestones",
        ("The Gilded Promise", "A Letter for Two", "Afterglow Atelier"),
        ("ring", "envelope", "hearts"),
        "rose",
    ),
    (
        "anniversary",
        "Milestones",
        ("Golden Years", "Our Archival Album", "Anniversary Nocturne"),
        ("hearts", "envelope", "gift"),
        "saffron",
    ),
    (
        "diwali",
        "Festivals",
        ("The Diya Courtyard", "Letters by Lamplight", "Amavasya Gold"),
        ("diya", "envelope", "confetti"),
        "saffron",
    ),
    (
        "holi",
        "Festivals",
        ("Gulal Garden", "A Colour Postcard", "Rang After Dark"),
        ("confetti", "scratch", "balloon"),
        "rose",
    ),
    (
        "raksha-bandhan",
        "Family",
        ("The Silk Thread", "Childhood Post", "A Glimmer of Rakhi"),
        ("gift", "envelope", "hearts"),
        "saffron",
    ),
    (
        "baby-shower",
        "Family",
        ("The Little Cradle", "Letters to Baby", "Starlit Lullaby"),
        ("gift", "envelope", "hearts"),
        "forest",
    ),
    (
        "housewarming",
        "Family",
        ("The Mango Toran", "From Our Doorstep", "Courtyard at Dusk"),
        ("envelope", "gift", "diya"),
        "forest",
    ),
    (
        "festival-party",
        "Festivals",
        ("Neon Guest Pass", "The Backstage Letter", "Disco After Hours"),
        ("scratch", "envelope", "confetti"),
        "night",
    ),
    (
        "karwa-chauth",
        "Festivals",
        ("Moon Through Silk", "A Moonrise Letter", "Velvet Moon"),
        ("hearts", "envelope", "diya"),
        "wine",
    ),
    (
        "new-year",
        "Festivals",
        ("The Midnight Clock", "Postmarked January", "Fireworks at Twelve"),
        ("confetti", "envelope", "scratch"),
        "night",
    ),
    (
        "christmas",
        "Festivals",
        ("The Evergreen Star", "North Pole Post", "A Candlelit Carol"),
        ("gift", "envelope", "diya"),
        "forest",
    ),
]
EDITIONS = [
    ("signature", "Illustrated signature plate"),
    ("folio", "The letterpress folio"),
    ("nocturne", "The night edition"),
]


def seed(apps, schema_editor):
    design = apps.get_model("studio", "Design")
    for i, (occasion, group, names, openings, ink) in enumerate(ROWS):
        for j, (edition, caption) in enumerate(EDITIONS):
            design.objects.create(
                code=f"{occasion}-{edition}",
                occasion=occasion,
                edition=edition,
                name=names[j],
                caption=caption,
                collection=group,
                art=occasion,
                opening=openings[j],
                palette=(ink, "ink", "night")[j],
                position=20 + 3 * i + j,
            )


def unseed(apps, schema_editor):
    apps.get_model("studio", "Design").objects.filter(
        code__in=[f"{row[0]}-{ed}" for row in ROWS for ed, _ in EDITIONS]
    ).delete()


class Migration(migrations.Migration):
    dependencies = [("studio", "0003_function_editions")]
    operations = [migrations.RunPython(seed, unseed)]
