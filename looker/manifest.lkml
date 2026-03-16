project_name: "acme_visualizations"

constant: ACME_VIZ_BASE_URL {
  value: "https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPO_NAME"
}

visualization: {
  id: "acme_bar_plus"
  label: "Acme Bar Plus"
  url: "@{ACME_VIZ_BASE_URL}/acme_bar_plus.js"
}
