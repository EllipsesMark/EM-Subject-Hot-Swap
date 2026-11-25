"""Ref2VA clothing catalogue — pack-local only (no H3 Studio).

Reuses ``h3_subject_prompt.wardrobe`` so Hybrid / Ref2VA share one catalogue
under this pack's ``data/wardrobe``.
"""

from ..h3_subject_prompt.wardrobe import (  # noqa: F401
    PREFIX,
    _contained,
    _photo_roots,
    list_catalogue,
    pieces_of,
    resolve_image,
)
