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

For `Acme Pivot Plus v2` you can use:

- `Visual preset`: `custom`, `finance`, `retail`
- Color options use native Looker color picker controls
- `Subtotal dimensions (comma separated names)`: show subtotals only for specific dimensions
- `Style rules JSON`: rule-based styling by target/dimension/measure/pivot/subtotal level
- `Threshold rules JSON`: conditional formatting by numeric value
- Per-measure format controls are auto-generated in the panel for each measure (`looker`, `number`, `currency`, `percent`, `date`, `datetime`)
- `Show measure format controls`: toggle dynamic measure-format fields on/off
- `Measure formats JSON`: advanced per-measure overrides (`number`, `currency`, `percent`, `date`, `datetime`)
- `Show row totals` / `Show column totals`: toggle totals per measure and bottom totals row
- `Split pivot headers`: renders pivot labels on top row and measures on second row
- `Repeat dimension values`: repeat or suppress repeated dimension text in expanded rows
- Font controls: `Font family`, `Font size`, `Header font size`, `Value font size`
- Per-field alignment controls are auto-generated for each dimension and measure

Example `Subtotal dimensions` value:

`invoices.hypercategory, invoices.department`

Example `Measure formats JSON`:

```json
{
  "orders.total_sales": {
    "type": "currency",
    "currency": "EUR",
    "decimals": 2,
    "locale": "el-GR"
  },
  "orders.margin_pct": {
    "type": "percent",
    "decimals": 1,
    "percent_input": "whole",
    "locale": "el-GR"
  },
  "orders.quantity": {
    "type": "number",
    "decimals": 0,
    "suffix": " pcs",
    "locale": "el-GR"
  },
  "orders.invoice_date": {
    "type": "date",
    "locale": "el-GR",
    "dateOptions": { "year": "numeric", "month": "2-digit", "day": "2-digit" }
  }
}
```

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
