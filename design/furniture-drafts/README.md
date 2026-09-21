# Furniture review · 21 September 2026

Status: **Approved and integrated. All 24 designs are available in the shop.**

The shop uses six categories: Basic furniture, Lighting, Decor, Storage, Tech &
entertainment, and Sports & hobbies. Decor combines Windows & doors, Carpets and
Plants with subfilters. Availability filters combine with these selections.

The two PNG sheets are shareable review boards. Numbers are stable review IDs.
Each design also has an editable SVG and a transparent 56 × 48 PNG. All shapes
use a consistent pixel grid, dark outlines, and SafeSpace's neon accents.

| IDs | Category | Drafts |
| --- | --- | --- |
| 01–04 | Basic furniture | Mint couch, starlight bed, blush chair, coffee table |
| 05–07 | Lights | Crystal chandelier, wall sconce, reading lamp |
| 08–10 | Windows & doors | City window, curtained window, neon-panel door |
| 11–12 | Carpets | Woven runner, orbit carpet |
| 13–15 | Plants | Leafy plant, flowering cactus, hanging planter |
| 16–17 | Shelves & storage | Bookcase, drawer cabinet |
| 18–20 | Tech & entertainment | Desktop setup, laptop, movie-night TV |
| 21–24 | Sports & hobbies | Basketball hoop, dumbbell rack, skateboard, acoustic guitar |

01, 02, 07, 08, 11, 13, 16 and 20 propose refreshed art for existing furniture
types; the other 16 are new variants or types. Existing IDs and prices are kept.
New prices are defined in `src/app/shop-catalogue.ts`. Approved SVGs are copied to
`public/furniture/`; regenerate review assets here and copy deliberate art updates
to that runtime directory. Hanging furniture starts at the wall and carpets render
beneath the other furniture, while saved positions always take precedence.

Regenerate with `python3 design/furniture-drafts/draw.py` (Pillow). The drawing
source produces SVGs and nearest-neighbour pixel previews; it is not a runtime dependency.
