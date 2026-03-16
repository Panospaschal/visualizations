const VIZ_ID = "acme_bar_plus"
const CSS_ID = "acme-bar-plus-css"

function ensureStylesheet() {
  if (document.getElementById(CSS_ID)) return

  const link = document.createElement("link")
  link.id = CSS_ID
  link.rel = "stylesheet"

  const script = document.currentScript
  if (script?.src) {
    const baseUrl = script.src.replace(/acme_bar_plus\.js(?:\?.*)?$/, "")
    link.href = `${baseUrl}acme_bar_plus.css`
  }

  if (link.href) {
    document.head.appendChild(link)
  }
}

function asNumber(value) {
  if (typeof value === "number") return value
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatValue(field, value) {
  if (value == null) return "-"
  if (field?.value_format && typeof LookerCharts !== "undefined") {
    return LookerCharts.Utils.textForCell({ value, value_format: field.value_format })
  }
  return value.toLocaleString()
}

looker.plugins.visualizations.add({
  id: VIZ_ID,
  label: "Acme Bar Plus",
  options: {
    show_title: {
      type: "boolean",
      label: "Show chart title",
      default: true
    },
    max_bars: {
      type: "number",
      label: "Max bars",
      default: 10,
      min: 1,
      max: 50
    }
  },

  create(element) {
    ensureStylesheet()
    element.innerHTML = `
      <div class="acme-bar-plus">
        <h3 class="acme-bar-plus__title"></h3>
        <div class="acme-bar-plus__chart"></div>
      </div>
    `
  },

  updateAsync(data, element, config, queryResponse, details, done) {
    const container = element.querySelector(".acme-bar-plus")
    const title = element.querySelector(".acme-bar-plus__title")
    const chart = element.querySelector(".acme-bar-plus__chart")

    if (!container || !title || !chart) {
      done()
      return
    }

    const dimensions = queryResponse.fields.dimension_like
    const measures = queryResponse.fields.measure_like

    if (!dimensions.length || !measures.length) {
      this.addError({
        title: "Bar Plus requires one dimension and one measure",
        message: "Update your Explore query to include at least one dimension and one measure."
      })
      done()
      return
    }

    this.clearErrors()
    const dimension = dimensions[0]
    const measure = measures[0]
    const maxBars = Math.max(1, Math.min(Number(config.max_bars) || 10, 50))

    const rows = data
      .map((row) => {
        const label = row[dimension.name]?.rendered ?? row[dimension.name]?.value ?? "(blank)"
        const numericValue = asNumber(row[measure.name]?.value)
        return { label: String(label), value: numericValue }
      })
      .filter((row) => row.value != null)
      .sort((a, b) => b.value - a.value)
      .slice(0, maxBars)

    if (!rows.length) {
      chart.innerHTML = ""
      title.textContent = "No numeric values to display"
      done()
      return
    }

    const max = Math.max(...rows.map((row) => row.value))
    title.style.display = config.show_title === false ? "none" : "block"
    title.textContent = `${measure.label_short ?? measure.label} by ${dimension.label_short ?? dimension.label}`

    chart.innerHTML = rows
      .map((row) => {
        const pct = max === 0 ? 0 : Math.round((row.value / max) * 100)
        const formattedValue = formatValue(measure, row.value)
        return `
          <div class="acme-bar-plus__row">
            <div class="acme-bar-plus__label" title="${row.label}">${row.label}</div>
            <div class="acme-bar-plus__track">
              <div class="acme-bar-plus__bar" style="width:${pct}%;"></div>
            </div>
            <div class="acme-bar-plus__value">${formattedValue}</div>
          </div>
        `
      })
      .join("")

    done()
  }
})
