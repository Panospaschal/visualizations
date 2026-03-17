# Looker Custom Visualizations

Starter repository for hosting custom Looker visualizations from your own GitHub repository.

## Included

- `src/acme_bar_plus.js`: Custom Looker visualization plugin code.
- `src/acme_pie_custom.js`: Custom Looker pie chart plugin with configurable palette.
- `src/acme_pivot_plus.js`: Custom Looker pivot table plugin with styling rules, subtotals, and expand/collapse (v2 id).
- `src/acme_bar_plus.css`: Stylesheet loaded by the plugin.
- `looker/manifest.lkml`: Manifest snippet showing how to register the visualization URL.
- `.github/workflows/deploy-pages.yml`: GitHub Actions workflow to build and publish `dist/` to GitHub Pages.

## Local development

```bash
npm install
npm run build
```

Build output:

- `dist/acme_bar_plus.js`
- `dist/acme_pie_custom.js`
- `dist/acme_pivot_plus.js`
- `dist/acme_pivot_plus_v2.js`
- `dist/acme_bar_plus.css`

## Publish with GitHub Pages

1. Create a GitHub repository and push this project.
2. In GitHub Settings -> Pages, set Source to "GitHub Actions".
3. Create a release tag like `v1.0.0` and push it:

```bash
git tag v1.0.0
git push origin v1.0.0
```

4. The workflow deploys `dist/` to your Pages URL:

`https://<github-username>.github.io/<repo-name>/`

## Configure Looker

1. Update `looker/manifest.lkml` constant `ACME_VIZ_BASE_URL` with your GitHub Pages URL.
2. Add the manifest visualization block to your Looker project manifest.
3. Validate and deploy Looker project changes.
4. In Explore, choose visualization type "Acme Bar Plus", "Acme Pie Custom", or "Acme Pivot Plus v2".

## Pie palette configuration

For `Acme Pie Custom`, use the visualization setting `Palette (comma separated colors)` and pass values like:

`#0f766e, #0891b2, #2563eb, #ea580c`

## Pivot presets and threshold formatting

For `Acme Pivot Plus` you can use:

- `Visual preset`: `custom`, `finance`, `retail`
- `Style rules JSON`: rule-based styling by target/dimension/measure/pivot/subtotal level
- `Threshold rules JSON`: conditional formatting by numeric value

Example `Threshold rules JSON`:

```json
[
  {
    "target": "value",
    "measure": "orders.total_sales",
    "operator": ">=",
    "value": 100000,
    "style": { "bgColor": "#dcfce7", "fontColor": "#166534", "bold": true }
  },
  {
    "target": "value",
    "measure": "orders.total_sales",
    "operator": "<",
    "value": 0,
    "style": { "bgColor": "#fee2e2", "fontColor": "#991b1b", "bold": true }
  },
  {
    "target": "subtotal",
    "subtotalLevel": 1,
    "operator": "between",
    "min": 10000,
    "max": 50000,
    "style": { "bgColor": "#fef3c7", "fontColor": "#92400e" }
  }
]
```

## Versioning recommendation

Use release tags and pin manifest URLs to versioned files if you need strict change control.
