# Personal Canva Starter Template Pack

This pack contains 50 editable templates.

Contents:
- catalog.json — searchable library index
- templates/*.json — generic editable template data
- previews/*.svg — vector previews that can also be imported as standalone graphics

Generic element types:
- text
- shape

Each JSON file includes:
- canvas dimensions
- page data
- absolute x/y coordinates
- width/height
- colors
- font family, size, weight and alignment
- layer order based on array order

Integration:
1. Import catalog.json into your template browser.
2. When a template is selected, load its JSON file.
3. Convert each generic `element` into your editor's own item schema.
4. Generate your editor's IDs if it requires UUIDs.
5. Preserve the array order for layer stacking.

The SVG files can be displayed as thumbnails immediately.

No external images or fonts are required.
