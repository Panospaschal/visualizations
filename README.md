# Looker Custom Visualizations

Starter repository for hosting custom Looker visualizations from your own GitHub repository.

## Included

- `src/acme_bar_plus.js`: Custom Looker visualization plugin code.
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
4. In Explore, choose visualization type "Acme Bar Plus".

## Versioning recommendation

Use release tags and pin manifest URLs to versioned files if you need strict change control.
