# Product Images / Product Data Source

By default, the app loads products from `assets/products/catalog.json`.

## Option 1 (default): local JSON + local images

Upload product images in this folder and update entries in `assets/products/catalog.json`.

Recommended:
- Format: `.jpg`, `.png`, or `.webp`
- Size: around `800x800`
- Keep file names simple, e.g. `kundan-necklace.jpg`

Example catalog entry:
```json
{ "id": "necklace-3", "name": "New Necklace", "category": "Necklace", "price": 1299, "image": "assets/products/kundan-necklace.jpg" }
```

## Option 2: Google Sheet products + Google Drive images by SKU folders

`script.js` supports loading live products from Google Sheet and images from Google Drive.

### Google Sheet expected columns

The loader supports these headers (case-insensitive match where possible):
- `SKU`
- `Product Name`
- `Product Catagory` (or `Product Category`)
- `Type`
- `Quantity`
- `Market Price`
- `Extra Delivery charges`

### Google Drive expected structure

Inside one root folder, create one folder per SKU (example: `JW-002`, `JW-010`).

- If SKU folder has 1 image → 1 product card.
- If SKU folder has multiple images → multiple variants are created automatically.

### Enable in code

In `script.js`, set:
- `GOOGLE_SHEET_PRODUCTS.enabled = true`
- `GOOGLE_SHEET_PRODUCTS.sheetId = "<your-sheet-id>"`
- `GOOGLE_DRIVE_IMAGES.enabled = true`
- `GOOGLE_DRIVE_IMAGES.apiKey = "<your-google-api-key>"`
- `GOOGLE_DRIVE_IMAGES.rootFolderId = "<your-drive-root-folder-id>"`

If any of these are disabled/missing, the app falls back to local JSON catalog.

## Local SKU upload folders

The following SKU folders are pre-created for image uploads:

`JW-001`, `JW-002`, `JW-003`, `JW-004`, `JW-005`, `JW-006`, `JW-007`, `JW-008`, `JW-009`, `JW-010`, `JW-011`, `JW-012`, `JW-013`, `JW-014`, `JW-015`, `JW-016`.

Place product images in each SKU folder using names like `image.jpg`, `image.png`, or numbered files (`1.jpg`, `2.jpg`, etc.).
