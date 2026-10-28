# Solar Site Survey Sim

Play: https://onlyyjoey.github.io/survey-sim/

On iPhone: open the link in Safari → Share → **Add to Home Screen**, then launch it from the icon for full screen.
Online rooms use the same room codes as the claude.ai version (crew must all be on this site).


## CSV Fix (point file tool)

Open: https://onlyyjoey.github.io/survey-sim/csv/

On iPhone: open in Safari → Share → **Add to Home Screen**. Add a .csv point file — or drop/pick photos, screenshots or PDFs (plan sheets: every "N … / E …" callout becomes a point, read exactly from the PDF text; point tables; scanned pages) — (or create one from photos/screenshots — a screen showing N/E/Elev, or a whole table like an Excel sheet where every row becomes a point — read on the phone, with a confidence meter and "verify this number" checks), then Format with a saved preset (keep only the columns you need), Find Duplicates (renumber, edit or delete them one by one or in bulk), Fix Elevations (wrong rod height or add/subtract any value), view/edit as a spreadsheet, move columns, renumber points, and Save/Share the fixed file. Files stay on the phone.

### Plan viewer (PDF)
Drop or pick a PDF and choose **Open plan**: georeference it from known points (auto from the N/E callout leaders, or tap exact spots), tap anywhere for Northing/Easting, pick linework layers (named from the plan legend where it's clear) and export them as a DXF (R12, X = Easting, Y = Northing) in real coordinates.

### TP3 Editor (Topcon project)
Drop or pick a `.tp3` (Topcon Pocket-3D / Magnet project export): see all points, lines, surfaces and control on a map, tap a boundary around the area to keep, and save a `-clean.tp3` with everything outside removed on **every** layer (points, lines, surface triangles, labels; control optional; optional buffer). The rest of the file is kept as-is and the result is re-read as a self-check before saving. Also exports the kept points to CSV and the lines to DXF. **Edit layers**: drag to set the order the data collector lists them, rename, change color / symbol (from the ones the job already uses), combine layers (or "Find look-alikes" like `fiber` / `fiber 2.0`), delete a layer with everything on it, or empty it (just its points, or everything) and keep the layer. Swipe a layer left for Empty / Delete (long swipe deletes, Undo in the toast). Combining layers can clean up doubles: points on both layers (same spot within a tolerance, or same point #) are kept once — from the layer you pick (newest by default), optionally keeping the other layer's point numbers/codes — while points only on one layer are kept. Each layer is tagged Points / Lines / Points + lines. Per-layer data-collector display toggles (Show layer, point names, descriptions, elevations) with an all-on/all-off "Point labels" sheet; "Number names" (01, 02…) keeps your order when the collector sorts by name. The map has a scale bar like the data collector. Look-alikes has a Strict → Loose sensitivity slider and per-layer ticks — then Save. Test the clean file on a copy in the controller and keep the original.
