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
