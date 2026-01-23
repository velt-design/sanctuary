# Projects Page QA (Staff Portal)

## Goal
Quick manual regression checks for `/staff/projects` layout and Filters card overflow.

## Viewports
- Desktop: 1440×900
- Laptop: 1280×800
- Tablet: 768×1024
- Mobile: 375×812

## Checklist
1. Open `/staff/projects`.
2. Confirm spacing between the “Filters” card and “All Projects” card matches other stacked sections (consistent gap; no extra “floating” whitespace).
3. Resize through the viewports above and confirm:
   - No stray/clipped text appears at the right edge of the Filters card.
   - Filters controls wrap cleanly (Search / Status / Follow‑up due).
4. Toggle “Follow-up due (today + overdue)” and confirm the list updates without layout jitter or overflow.

