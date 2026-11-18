from django.db import migrations


def seed(apps, schema_editor):
    design = apps.get_model("studio", "Design")
    rows = [
        ("royal", "Royal Celebration", "The royal edit", "Milestones", "envelope", "wine"),
        ("floral", "Floral Garden", "In full bloom", "Family", "hearts", "forest"),
        ("festive", "Festive Glow", "A festival of light", "Festivals", "diya", "saffron"),
        ("midnight", "Midnight Stars", "Written in the stars", "Milestones", "ring", "night"),
        ("playful", "Playful Pop", "A little birthday joy", "Family", "balloon", "rose"),
        ("classic", "Classic Letter", "Sealed with love", "Festivals", "envelope", "ink"),
    ]
    for n, (code, name, caption, group, opening, palette) in enumerate(rows):
        design.objects.create(
            code=code,
            art=code,
            name=name,
            caption=caption,
            collection=group,
            opening=opening,
            palette=palette,
            position=n + 1,
        )


class Migration(migrations.Migration):
    dependencies = [("studio", "0001_initial")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
