const VIZ_ID = "acme_pie_custom"

const DEFAULT_PALETTE = [
  "#0f766e",
  "#0891b2",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#ca8a04",
  "#65a30d"
]

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

function isValidColor(value) {
  if (!value) return false
  if (typeof CSS !== "undefined" && typeof CSS.supports === "function") {
    return CSS.supports("color", value)
  }
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
}

function parsePalette(rawPalette) {
  if (typeof rawPalette !== "string") return DEFAULT_PALETTE

  const palette = rawPalette
    .split(",")
    .map((color) => color.trim())
    .filter((color) => color.length > 0 && isValidColor(color))

  return palette.length ? palette : DEFAULT_PALETTE
}

function polarToCartesian(centerX, centerY, radius, angleRadians) {
  return {
    x: centerX + radius * Math.cos(angleRadians),
    y: centerY + radius * Math.sin(angleRadians)
  }
}

function buildSlicePath(centerX, centerY, radius, startAngle, endAngle) {
  const start = polarToCartesian(centerX, centerY, radius, startAngle)
  const end = polarToCartesian(centerX, centerY, radius, endAngle)
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0

  return [
    `M ${centerX} ${centerY}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
    "Z"
  ].join(" ")
}

function clearNode(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild)
  }
}

looker.plugins.visualizations.add({
  id: VIZ_ID,
  label: "Acme Pie Custom",
  options: {
    palette: {
      type: "string",
      label: "Palette (comma separated colors)",
      default: DEFAULT_PALETTE.join(", ")
    },
    show_legend: {
      type: "boolean",
      label: "Show legend",
      default: true
    },
    show_labels: {
      type: "boolean",
      label: "Show percentage labels",
      default: true
    }
  },

  create(element) {
    element.innerHTML = `
      <div class="acme-pie-custom" style="font-family: 'Open Sans', Arial, sans-serif; color: #1f2937; height: 100%; box-sizing: border-box; padding: 12px;">
        <div class="acme-pie-custom__title" style="font-size: 14px; font-weight: 600; margin-bottom: 8px;"></div>
        <div class="acme-pie-custom__layout" style="display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap;">
          <svg class="acme-pie-custom__svg" viewBox="0 0 320 320" role="img" aria-label="Pie chart" style="width: min(420px, 100%); height: auto; flex: 1 1 280px;"></svg>
          <div class="acme-pie-custom__legend" style="flex: 1 1 220px; min-width: 180px;"></div>
        </div>
      </div>
    `
  },

  updateAsync(data, element, config, queryResponse, details, done) {
    const titleNode = element.querySelector(".acme-pie-custom__title")
    const svg = element.querySelector(".acme-pie-custom__svg")
    const legend = element.querySelector(".acme-pie-custom__legend")

    if (!titleNode || !svg || !legend) {
      done()
      return
    }

    const dimensions = queryResponse.fields.dimension_like
    const measures = queryResponse.fields.measure_like

    if (!dimensions.length || !measures.length) {
      this.addError({
        title: "Pie Custom requires one dimension and one measure",
        message: "Update your Explore query to include at least one dimension and one measure."
      })
      clearNode(svg)
      clearNode(legend)
      titleNode.textContent = ""
      done()
      return
    }

    this.clearErrors()

    const dimension = dimensions[0]
    const measure = measures[0]
    const palette = parsePalette(config.palette)

    const rows = data
      .map((row) => {
        const rawLabel = row[dimension.name]?.rendered ?? row[dimension.name]?.value ?? "(blank)"
        const numericValue = asNumber(row[measure.name]?.value)
        return {
          label: String(rawLabel),
          value: numericValue
        }
      })
      .filter((row) => row.value != null && row.value >= 0)

    const total = rows.reduce((sum, row) => sum + row.value, 0)

    clearNode(svg)
    clearNode(legend)

    titleNode.textContent = `${measure.label_short ?? measure.label} by ${dimension.label_short ?? dimension.label}`

    if (!rows.length || total <= 0) {
      const empty = document.createElementNS("http://www.w3.org/2000/svg", "text")
      empty.setAttribute("x", "160")
      empty.setAttribute("y", "160")
      empty.setAttribute("text-anchor", "middle")
      empty.setAttribute("dominant-baseline", "middle")
      empty.setAttribute("fill", "#6b7280")
      empty.setAttribute("font-size", "13")
      empty.textContent = "No numeric values to display"
      svg.appendChild(empty)
      done()
      return
    }

    const centerX = 160
    const centerY = 160
    const radius = 120
    let startAngle = -Math.PI / 2

    if (rows.length === 1) {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle")
      circle.setAttribute("cx", String(centerX))
      circle.setAttribute("cy", String(centerY))
      circle.setAttribute("r", String(radius))
      circle.setAttribute("fill", palette[0])
      svg.appendChild(circle)
    } else {
      rows.forEach((row, index) => {
        const angle = (row.value / total) * Math.PI * 2
        const endAngle = startAngle + angle
        const fill = palette[index % palette.length]

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
        path.setAttribute("d", buildSlicePath(centerX, centerY, radius, startAngle, endAngle))
        path.setAttribute("fill", fill)
        path.setAttribute("stroke", "#ffffff")
        path.setAttribute("stroke-width", "1")
        path.setAttribute("aria-label", `${row.label}: ${formatValue(measure, row.value)}`)
        svg.appendChild(path)

        if (config.show_labels !== false && row.value > 0) {
          const midAngle = startAngle + angle / 2
          const labelPoint = polarToCartesian(centerX, centerY, radius * 0.64, midAngle)
          const percent = `${((row.value / total) * 100).toFixed(1)}%`

          const text = document.createElementNS("http://www.w3.org/2000/svg", "text")
          text.setAttribute("x", String(labelPoint.x))
          text.setAttribute("y", String(labelPoint.y))
          text.setAttribute("text-anchor", "middle")
          text.setAttribute("dominant-baseline", "middle")
          text.setAttribute("fill", "#ffffff")
          text.setAttribute("font-size", "11")
          text.setAttribute("font-weight", "600")
          text.textContent = percent
          svg.appendChild(text)
        }

        startAngle = endAngle
      })
    }

    if (config.show_legend !== false) {
      rows.forEach((row, index) => {
        const item = document.createElement("div")
        item.style.display = "flex"
        item.style.alignItems = "center"
        item.style.gap = "8px"
        item.style.marginBottom = "6px"
        item.style.fontSize = "12px"

        const swatch = document.createElement("span")
        swatch.style.width = "10px"
        swatch.style.height = "10px"
        swatch.style.borderRadius = "2px"
        swatch.style.display = "inline-block"
        swatch.style.flex = "0 0 auto"
        swatch.style.backgroundColor = palette[index % palette.length]

        const label = document.createElement("span")
        label.style.flex = "1"
        label.style.minWidth = "0"
        label.style.overflow = "hidden"
        label.style.textOverflow = "ellipsis"
        label.style.whiteSpace = "nowrap"
        label.title = row.label
        label.textContent = `${row.label}: ${formatValue(measure, row.value)} (${((row.value / total) * 100).toFixed(1)}%)`

        item.appendChild(swatch)
        item.appendChild(label)
        legend.appendChild(item)
      })
    }

    done()
  }
})
