# SafeSpace pixel-art direction

**On hold pending group feedback.** `saved-for-group-review.png` is the exact
character draft the user selected in their latest attachment. Graphics changes
are not integrated into the app; typography work proceeds separately.

Review draft, September 2026. Original artwork inspired by the user's references:
compact human sprites, a slightly top-down room, clear furniture silhouettes and
consistent pixel shading. Keep SafeSpace's dark navy and neon mint, pink, violet
and gold identity. Skin and hair remain natural colours.

- `neon-room-concept-v4.svg`: current editable room concept on a 288 × 198 grid.
- `neon-character-studies-v4.svg`: six revised character studies on a 196 × 44 grid.
- `character-v4-*.svg`: individual transparent sprites, each on a 24 × 32 grid.
- The latest revision makes the characters cuter with rounder cheeks, small bright
  eyes, blush, tiny smiles and shorter bodies. It preserves the previous correction
  to eye placement, shoulder shape and connected sleeves. The reference informs
  compact proportions, clustered hair
  shading, layered clothes and distinct silhouettes. Neon colours
  appear primarily on clothing; skin and hair use natural tones.
- PNG files use integer nearest-neighbour scaling: 4× for the room, 3× for the
  character lineup and 6× for individual sprites. The room renders the character
  on the furniture's pixel grid.
- `draft.py` contains the room source and environment palette; `characters_v4.py`
  contains the revised sprites and shares palettes from `characters_v2.py`.
  Run `python3 design/pixel-art/draft.py` with Pillow installed to regenerate the
  current SVG and PNG files. Earlier versions remain available for comparison.

The reference images are used for direction only; their pixels are not reused.
These assets are review concepts and are not wired into the application yet.
An implementation should keep each furniture item and character as a separate
sprite so the existing furniture placement feature continues to work.
