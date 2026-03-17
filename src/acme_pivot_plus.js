const VIZ_ID = "acme_pivot_plus_v2"

const NO_PIVOT_KEY = "__no_pivot__"

function asNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function asDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date
  }
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date
  }
  return null
}

function toNonNegativeInteger(value) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) return null
  return parsed
}

function formatWithIntlNumber(value, locale, options) {
  try {
    return new Intl.NumberFormat(locale, options).format(value)
  } catch (_error) {
    return value.toLocaleString()
  }
}

function formatWithIntlDate(value, locale, options) {
  try {
    return new Intl.DateTimeFormat(locale, options).format(value)
  } catch (_error) {
    return value.toLocaleString()
  }
}

function formatByMeasureConfig(value, config, fallbackLocale) {
  if (!config || typeof config !== "object") return null

  const type = String(config.type || "").toLowerCase()
  const locale = typeof config.locale === "string" && config.locale.trim()
    ? config.locale
    : fallbackLocale
  const prefix = typeof config.prefix === "string" ? config.prefix : ""
  const suffix = typeof config.suffix === "string" ? config.suffix : ""

  if (type === "number" || type === "currency" || type === "percent") {
    const numeric = asNumber(value)
    if (numeric == null) return "-"

    const decimals = toNonNegativeInteger(config.decimals)
    const options = {}
    if (decimals != null) {
      options.minimumFractionDigits = decimals
      options.maximumFractionDigits = decimals
    }

    if (type === "currency") {
      options.style = "currency"
      options.currency = typeof config.currency === "string" && config.currency ? config.currency : "EUR"
    } else if (type === "percent") {
      options.style = "percent"
      const percentInput = config.percent_input === "whole" ? "whole" : "ratio"
      const percentValue = percentInput === "whole" ? numeric / 100 : numeric
      return `${prefix}${formatWithIntlNumber(percentValue, locale, options)}${suffix}`
    }

    return `${prefix}${formatWithIntlNumber(numeric, locale, options)}${suffix}`
  }

  if (type === "date" || type === "datetime") {
    const date = asDate(value)
    if (!date) return "-"

    const defaultDateOptions = type === "date"
      ? { year: "numeric", month: "2-digit", day: "2-digit" }
      : {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        }

    const dateOptions = config.dateOptions && typeof config.dateOptions === "object"
      ? config.dateOptions
      : defaultDateOptions

    return `${prefix}${formatWithIntlDate(date, locale, dateOptions)}${suffix}`
  }

  return null
}

function formatValue(field, value, measureConfig, fallbackLocale) {
  if (value == null) return "-"

  const customFormatted = formatByMeasureConfig(value, measureConfig, fallbackLocale)
  if (customFormatted != null) return customFormatted

  if (field?.value_format && typeof LookerCharts !== "undefined") {
    return LookerCharts.Utils.textForCell({ value, value_format: field.value_format })
  }

  if (typeof value === "number") {
    return formatWithIntlNumber(value, fallbackLocale, {})
  }

  return String(value)
}

function parseJsonObject(raw, fallback = {}) {
  if (!raw || typeof raw !== "string") return fallback
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === "object") return parsed
    return fallback
  } catch (_error) {
    return fallback
  }
}

function parseJsonArray(raw, fallback = []) {
  if (!raw || typeof raw !== "string") return fallback
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : fallback
  } catch (_error) {
    return fallback
  }
}

function normalizeAlign(value, fallback) {
  return value === "left" || value === "center" || value === "right" ? value : fallback
}

function matchesRule(ruleValue, ctxValue) {
  if (ruleValue == null || ruleValue === "*" || ruleValue === "all") return true
  if (Array.isArray(ruleValue)) return ruleValue.some((entry) => matchesRule(entry, ctxValue))
  return String(ruleValue) === String(ctxValue)
}

function styleFromRules(rules, context) {
  const style = {}
  rules.forEach((rule) => {
    if (!rule || typeof rule !== "object") return
    if (!matchesRule(rule.target, context.target)) return
    if (!matchesRule(rule.dimension, context.dimension)) return
    if (!matchesRule(rule.measure, context.measure)) return
    if (!matchesRule(rule.pivotKey, context.pivotKey)) return
    if (!matchesRule(rule.rowLevel, context.rowLevel)) return
    if (!matchesRule(rule.subtotalLevel, context.subtotalLevel)) return
    if (!rule.style || typeof rule.style !== "object") return
    Object.assign(style, rule.style)
  })
  return style
}

function compareThreshold(operator, left, right, min, max) {
  if (left == null || !Number.isFinite(left)) return false
  if (operator === "between") {
    return Number.isFinite(min) && Number.isFinite(max) && left >= min && left <= max
  }
  if (!Number.isFinite(right)) return false
  if (operator === ">") return left > right
  if (operator === ">=") return left >= right
  if (operator === "<") return left < right
  if (operator === "<=") return left <= right
  if (operator === "=") return left === right
  if (operator === "!=") return left !== right
  return false
}

function styleFromThresholdRules(rules, context, numericValue) {
  const style = {}
  rules.forEach((rule) => {
    if (!rule || typeof rule !== "object") return
    if (!matchesRule(rule.target, context.target)) return
    if (!matchesRule(rule.dimension, context.dimension)) return
    if (!matchesRule(rule.measure, context.measure)) return
    if (!matchesRule(rule.pivotKey, context.pivotKey)) return
    if (!matchesRule(rule.rowLevel, context.rowLevel)) return
    if (!matchesRule(rule.subtotalLevel, context.subtotalLevel)) return
    if (!rule.style || typeof rule.style !== "object") return

    const operator = String(rule.operator || ">=")
    const threshold = asNumber(rule.value)
    const min = asNumber(rule.min)
    const max = asNumber(rule.max)
    if (!compareThreshold(operator, numericValue, threshold, min, max)) return

    Object.assign(style, rule.style)
  })
  return style
}

function applyPresetConfig(config) {
  const preset = config.preset_theme || "custom"
  if (preset === "finance") {
    return {
      ...config,
      header_bg_color: "#0f172a",
      header_font_color: "#e2e8f0",
      header_align: "center",
      value_bg_color: "#ffffff",
      value_font_color: "#0f172a",
      value_align: "right",
      subtotal_bg_color: "#dbeafe",
      subtotal_font_color: "#1e3a8a",
      table_border_color: "#334155",
      cell_border_color: "#cbd5e1"
    }
  }

  if (preset === "retail") {
    return {
      ...config,
      header_bg_color: "#14532d",
      header_font_color: "#f0fdf4",
      header_align: "left",
      value_bg_color: "#ffffff",
      value_font_color: "#14532d",
      value_align: "right",
      subtotal_bg_color: "#fef3c7",
      subtotal_font_color: "#92400e",
      table_border_color: "#166534",
      cell_border_color: "#bbf7d0"
    }
  }

  return config
}

function applyCellStyle(cell, style, defaults) {
  const align = normalizeAlign(style.align, defaults.align)
  const bold = style.bold == null ? defaults.bold : Boolean(style.bold)
  const bgColor = style.bgColor || defaults.bgColor
  const fontColor = style.fontColor || defaults.fontColor

  if (align) cell.style.textAlign = align
  if (bgColor) cell.style.backgroundColor = bgColor
  if (fontColor) cell.style.color = fontColor
  cell.style.fontWeight = bold ? "700" : "400"
}

function parseSubtotalLevels(rawLevels, maxLevel) {
  if (!rawLevels || typeof rawLevels !== "string") {
    return new Set(Array.from({ length: maxLevel }, (_v, index) => index + 1))
  }

  const set = new Set()
  rawLevels
    .split(",")
    .map((part) => Number(part.trim()))
    .forEach((level) => {
      if (Number.isInteger(level) && level >= 1 && level <= maxLevel) {
        set.add(level)
      }
    })

  if (!set.size) {
    return new Set(Array.from({ length: maxLevel }, (_v, index) => index + 1))
  }

  return set
}

function getPivotEntries(queryResponse) {
  const pivots = Array.isArray(queryResponse.pivots) ? queryResponse.pivots : []
  if (!pivots.length) return [{ key: NO_PIVOT_KEY, label: "Value" }]

  return pivots.map((pivot) => {
    const key = String(pivot?.key ?? "")
    const labelFromData = pivot?.data && typeof pivot.data === "object"
      ? Object.values(pivot.data)
          .map((value) => String(value))
          .join(" | ")
      : ""
    return {
      key,
      label: labelFromData || key || "Pivot"
    }
  })
}

function getMeasurePivotValue(row, measureName, pivotKey) {
  const measureCell = row[measureName]
  if (!measureCell) return null

  if (pivotKey === NO_PIVOT_KEY) {
    return asNumber(measureCell.value)
  }

  const pivotCell = measureCell[pivotKey]
  return asNumber(pivotCell?.value)
}

function createAggregator(measures, pivots) {
  const agg = {}
  measures.forEach((measure) => {
    agg[measure.name] = {}
    pivots.forEach((pivot) => {
      agg[measure.name][pivot.key] = 0
    })
  })
  return agg
}

function addToAggregator(target, source, measures, pivots) {
  measures.forEach((measure) => {
    pivots.forEach((pivot) => {
      target[measure.name][pivot.key] += source[measure.name][pivot.key]
    })
  })
}

function extractRowValues(row, measures, pivots) {
  const values = createAggregator(measures, pivots)
  measures.forEach((measure) => {
    pivots.forEach((pivot) => {
      const numeric = getMeasurePivotValue(row, measure.name, pivot.key)
      values[measure.name][pivot.key] = numeric == null ? 0 : numeric
    })
  })
  return values
}

function buildTree(data, dimensions, measures, pivots) {
  const root = {
    id: "root",
    level: 0,
    label: "",
    dimension: null,
    children: new Map(),
    rows: [],
    totals: createAggregator(measures, pivots)
  }

  data.forEach((row) => {
    const rowValues = extractRowValues(row, measures, pivots)
    addToAggregator(root.totals, rowValues, measures, pivots)

    let cursor = root
    const dimPath = []

    dimensions.forEach((dimension, index) => {
      const rendered = row[dimension.name]?.rendered
      const raw = row[dimension.name]?.value
      const label = String(rendered ?? raw ?? "(blank)")
      dimPath.push(label)
      const key = `${dimension.name}::${label}`

      if (!cursor.children.has(key)) {
        cursor.children.set(key, {
          id: `${cursor.id}|${key}`,
          level: index + 1,
          label,
          dimension: dimension.name,
          children: new Map(),
          rows: [],
          totals: createAggregator(measures, pivots)
        })
      }

      cursor = cursor.children.get(key)
      addToAggregator(cursor.totals, rowValues, measures, pivots)
    })

    cursor.rows.push({
      id: `${cursor.id}|row|${cursor.rows.length}`,
      values: rowValues,
      dimensions: dimPath
    })
  })

  return root
}

function buildValueColumns(measures, pivots) {
  const columns = []
  measures.forEach((measure) => {
    pivots.forEach((pivot) => {
      const pivotLabel = pivot.key === NO_PIVOT_KEY ? "" : pivot.label
      columns.push({
        id: `${measure.name}::${pivot.key}`,
        measureName: measure.name,
        measureLabel: measure.label_short ?? measure.label,
        pivotKey: pivot.key,
        pivotLabel,
        label: pivotLabel ? `${pivotLabel} - ${measure.label_short ?? measure.label}` : (measure.label_short ?? measure.label)
      })
    })
  })
  return columns
}

function addStyles(element, config) {
  const tableBorderWidth = Number(config.table_border_width)
  const cellBorderWidth = Number(config.cell_border_width)

  const safeTableBorderWidth = Number.isFinite(tableBorderWidth) && tableBorderWidth >= 0 ? tableBorderWidth : 1
  const safeCellBorderWidth = Number.isFinite(cellBorderWidth) && cellBorderWidth >= 0 ? cellBorderWidth : 1

  const style = document.createElement("style")
  style.textContent = `
    .acme-pivot-plus {
      width: 100%;
      height: 100%;
      overflow: auto;
      box-sizing: border-box;
      font-family: 'Open Sans', Arial, sans-serif;
      color: #111827;
    }

    .acme-pivot-plus table {
      width: 100%;
      border-collapse: collapse;
      table-layout: auto;
      border-style: ${config.table_border_style || "solid"};
      border-color: ${config.table_border_color || "#9ca3af"};
      border-width: ${safeTableBorderWidth}px;
    }

    .acme-pivot-plus th,
    .acme-pivot-plus td {
      border-style: ${config.cell_border_style || "solid"};
      border-color: ${config.cell_border_color || "#d1d5db"};
      border-width: ${safeCellBorderWidth}px;
      padding: 6px 8px;
      vertical-align: middle;
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
      max-width: 420px;
    }

    .acme-pivot-plus td.acme-pivot-plus__dim-cell {
      max-width: 320px;
    }

    .acme-pivot-plus__toggle {
      display: inline-block;
      margin-right: 8px;
      border: 0;
      background: transparent;
      cursor: pointer;
      color: inherit;
      font-size: 12px;
      font-weight: 700;
      padding: 0;
      line-height: 1;
    }
  `

  element.appendChild(style)
}

function addHeaderRow(table, dimensions, valueColumns, config, rules) {
  const thead = document.createElement("thead")
  const row = document.createElement("tr")

  dimensions.forEach((dimension, index) => {
    const th = document.createElement("th")
    th.textContent = dimension.label_short ?? dimension.label
    const context = {
      target: "header",
      dimension: dimension.name,
      measure: null,
      pivotKey: null,
      rowLevel: index + 1,
      subtotalLevel: null
    }
    const style = styleFromRules(rules, context)
    applyCellStyle(th, style, {
      align: config.header_align,
      bgColor: config.header_bg_color,
      fontColor: config.header_font_color,
      bold: config.header_bold !== false
    })
    row.appendChild(th)
  })

  valueColumns.forEach((column) => {
    const th = document.createElement("th")
    th.textContent = column.label
    const context = {
      target: "header",
      dimension: null,
      measure: column.measureName,
      pivotKey: column.pivotKey,
      rowLevel: null,
      subtotalLevel: null
    }
    const style = styleFromRules(rules, context)
    applyCellStyle(th, style, {
      align: config.header_align,
      bgColor: config.header_bg_color,
      fontColor: config.header_font_color,
      bold: config.header_bold !== false
    })
    row.appendChild(th)
  })

  thead.appendChild(row)
  table.appendChild(thead)
}

function ensureExpandedSet(vis) {
  if (!vis._expandedNodes || !(vis._expandedNodes instanceof Set)) {
    vis._expandedNodes = new Set()
  }
  return vis._expandedNodes
}

function isExpanded(node, expandedNodes) {
  if (!node.children.size) return true
  return !expandedNodes.has(node.id)
}

function addSubtotalRow({
  tbody,
  node,
  dimensions,
  valueColumns,
  measuresMap,
  measureFormats,
  defaultLocale,
  config,
  rules,
  thresholdRules,
  expandedNodes,
  showSubtotal
}) {
  const tr = document.createElement("tr")
  tr.dataset.nodeId = node.id
  tr.dataset.rowType = "subtotal"

  const expanded = isExpanded(node, expandedNodes)

  dimensions.forEach((dimension, index) => {
    const td = document.createElement("td")
    td.className = "acme-pivot-plus__dim-cell"

    if (index + 1 === node.level) {
      if (node.children.size) {
        const button = document.createElement("button")
        button.type = "button"
        button.className = "acme-pivot-plus__toggle"
        button.textContent = expanded ? "-" : "+"
        button.setAttribute("aria-label", expanded ? "Collapse" : "Expand")
        button.dataset.toggleNodeId = node.id
        td.appendChild(button)
      }

      td.appendChild(document.createTextNode(node.label))
    }

    const context = {
      target: "subtotal",
      dimension: dimension.name,
      measure: null,
      pivotKey: null,
      rowLevel: node.level,
      subtotalLevel: node.level
    }
    const ruleStyle = styleFromRules(rules, context)
    const levelStyle = config.subtotalLevelStyles[node.level] || {}
    applyCellStyle(td, { ...levelStyle, ...ruleStyle }, {
      align: config.value_align,
      bgColor: config.subtotal_bg_color,
      fontColor: config.subtotal_font_color,
      bold: config.subtotal_bold !== false
    })

    tr.appendChild(td)
  })

  valueColumns.forEach((column) => {
    const td = document.createElement("td")
    const value = node.totals[column.measureName][column.pivotKey]
    if (showSubtotal) {
      const measure = measuresMap.get(column.measureName)
      const measureConfig = measureFormats[column.measureName]
      td.textContent = formatValue(measure, value, measureConfig, defaultLocale)
    }

    const context = {
      target: "subtotal",
      dimension: node.dimension,
      measure: column.measureName,
      pivotKey: column.pivotKey,
      rowLevel: node.level,
      subtotalLevel: node.level
    }
    const ruleStyle = styleFromRules(rules, context)
    const thresholdStyle = styleFromThresholdRules(thresholdRules, context, value)
    const levelStyle = config.subtotalLevelStyles[node.level] || {}
    applyCellStyle(td, { ...levelStyle, ...ruleStyle, ...thresholdStyle }, {
      align: config.value_align,
      bgColor: config.subtotal_bg_color,
      fontColor: config.subtotal_font_color,
      bold: config.subtotal_bold !== false
    })

    tr.appendChild(td)
  })

  tbody.appendChild(tr)

  return expanded
}

function addDetailRow({
  tbody,
  detailRow,
  dimensions,
  valueColumns,
  measuresMap,
  measureFormats,
  defaultLocale,
  config,
  rules,
  thresholdRules
}) {
  const tr = document.createElement("tr")
  tr.dataset.rowType = "value"

  dimensions.forEach((dimension, index) => {
    const td = document.createElement("td")
    td.className = "acme-pivot-plus__dim-cell"
    td.textContent = detailRow.dimensions[index] || ""

    const context = {
      target: "value",
      dimension: dimension.name,
      measure: null,
      pivotKey: null,
      rowLevel: index + 1,
      subtotalLevel: null
    }
    const style = styleFromRules(rules, context)
    applyCellStyle(td, style, {
      align: config.value_align,
      bgColor: config.value_bg_color,
      fontColor: config.value_font_color,
      bold: config.value_bold === true
    })
    tr.appendChild(td)
  })

  valueColumns.forEach((column) => {
    const td = document.createElement("td")
    const measure = measuresMap.get(column.measureName)
    const measureConfig = measureFormats[column.measureName]
    const value = detailRow.values[column.measureName][column.pivotKey]
    td.textContent = formatValue(measure, value, measureConfig, defaultLocale)

    const context = {
      target: "value",
      dimension: null,
      measure: column.measureName,
      pivotKey: column.pivotKey,
      rowLevel: dimensions.length,
      subtotalLevel: null
    }
    const style = styleFromRules(rules, context)
    const thresholdStyle = styleFromThresholdRules(thresholdRules, context, value)
    applyCellStyle(td, { ...style, ...thresholdStyle }, {
      align: config.value_align,
      bgColor: config.value_bg_color,
      fontColor: config.value_font_color,
      bold: config.value_bold === true
    })
    tr.appendChild(td)
  })

  tbody.appendChild(tr)
}

function renderNode({
  tbody,
  node,
  dimensions,
  valueColumns,
  measuresMap,
  measureFormats,
  defaultLocale,
  config,
  rules,
  thresholdRules,
  subtotalLevels,
  expandedNodes
}) {
  const showSubtotal = config.enable_subtotals !== false && subtotalLevels.has(node.level)
  const expanded = addSubtotalRow({
    tbody,
    node,
    dimensions,
    valueColumns,
    measuresMap,
    measureFormats,
    defaultLocale,
    config,
    rules,
    thresholdRules,
    expandedNodes,
    showSubtotal
  })

  if (!expanded) return

  if (node.children.size) {
    node.children.forEach((child) => {
      renderNode({
        tbody,
        node: child,
        dimensions,
        valueColumns,
        measuresMap,
        measureFormats,
        defaultLocale,
        config,
        rules,
        thresholdRules,
        subtotalLevels,
        expandedNodes
      })
    })
    return
  }

  if (config.show_detail_rows === false) return

  node.rows.forEach((detailRow) => {
    addDetailRow({
      tbody,
      detailRow,
      dimensions,
      valueColumns,
      measuresMap,
      measureFormats,
      defaultLocale,
      config,
      rules,
      thresholdRules
    })
  })
}

looker.plugins.visualizations.add({
  id: VIZ_ID,
  label: "Acme Pivot Plus v2",
  options: {
    preset_theme: {
      type: "string",
      display: "select",
      label: "Visual preset",
      default: "custom",
      values: [{ custom: "custom" }, { finance: "finance" }, { retail: "retail" }]
    },
    header_bg_color: {
      type: "string",
      display: "color",
      label: "Header background",
      default: "#f3f4f6"
    },
    header_font_color: {
      type: "string",
      display: "color",
      label: "Header font color",
      default: "#111827"
    },
    header_align: {
      type: "string",
      display: "select",
      label: "Header alignment",
      default: "left",
      values: [{ left: "left" }, { center: "center" }, { right: "right" }]
    },
    header_bold: { type: "boolean", label: "Header bold", default: true },

    value_bg_color: {
      type: "string",
      display: "color",
      label: "Values background",
      default: "#ffffff"
    },
    value_font_color: {
      type: "string",
      display: "color",
      label: "Values font color",
      default: "#111827"
    },
    value_align: {
      type: "string",
      display: "select",
      label: "Value alignment",
      default: "right",
      values: [{ left: "left" }, { center: "center" }, { right: "right" }]
    },
    value_bold: { type: "boolean", label: "Values bold", default: false },

    enable_subtotals: { type: "boolean", label: "Enable subtotals", default: true },
    subtotal_levels: {
      type: "string",
      label: "Subtotal levels (comma separated)",
      default: "1,2,3"
    },
    subtotal_bg_color: {
      type: "string",
      display: "color",
      label: "Subtotal background",
      default: "#e5e7eb"
    },
    subtotal_font_color: {
      type: "string",
      display: "color",
      label: "Subtotal font color",
      default: "#111827"
    },
    subtotal_bold: { type: "boolean", label: "Subtotal bold", default: true },
    subtotal_level_styles_json: {
      type: "string",
      label: "Subtotal level styles JSON",
      default: "{}"
    },

    show_detail_rows: { type: "boolean", label: "Show detail rows", default: true },

    table_border_color: {
      type: "string",
      display: "color",
      label: "Table border color",
      default: "#9ca3af"
    },
    table_border_width: { type: "number", label: "Table border width", default: 1 },
    table_border_style: {
      type: "string",
      display: "select",
      label: "Table border style",
      default: "solid",
      values: [{ solid: "solid" }, { dashed: "dashed" }, { dotted: "dotted" }]
    },
    cell_border_color: {
      type: "string",
      display: "color",
      label: "Cell border color",
      default: "#d1d5db"
    },
    cell_border_width: { type: "number", label: "Cell border width", default: 1 },
    cell_border_style: {
      type: "string",
      display: "select",
      label: "Cell border style",
      default: "solid",
      values: [{ solid: "solid" }, { dashed: "dashed" }, { dotted: "dotted" }]
    },

    style_rules_json: {
      type: "string",
      label: "Style rules JSON",
      default: "[]"
    },
    threshold_rules_json: {
      type: "string",
      label: "Threshold rules JSON",
      default: "[]"
    },
    default_locale: {
      type: "string",
      label: "Default locale",
      default: "el-GR"
    },
    measure_formats_json: {
      type: "string",
      label: "Measure formats JSON",
      default: "{}"
    }
  },

  create(element) {
    element.innerHTML = ""
    const wrapper = document.createElement("div")
    wrapper.className = "acme-pivot-plus"
    element.appendChild(wrapper)
  },

  updateAsync(data, element, config, queryResponse, details, done) {
    try {
    const wrapper = element.querySelector(".acme-pivot-plus")
    if (!wrapper) {
      done()
      return
    }

    const dimensions = queryResponse.fields.dimension_like || []
    const measures = queryResponse.fields.measure_like || []

    if (!dimensions.length || !measures.length) {
      this.addError({
        title: "Pivot Plus requires dimensions and measures",
        message: "Add at least one dimension and one measure to render the pivot table."
      })
      wrapper.innerHTML = ""
      done()
      return
    }

    this.clearErrors()

    const rules = parseJsonArray(config.style_rules_json, [])
    const thresholdRules = parseJsonArray(config.threshold_rules_json, [])
    const measureFormats = parseJsonObject(config.measure_formats_json, {})
    const subtotalLevelStyles = parseJsonObject(config.subtotal_level_styles_json, {})
    const parsedConfig = {
      ...config,
      header_align: normalizeAlign(config.header_align, "left"),
      value_align: normalizeAlign(config.value_align, "right"),
      subtotalLevelStyles
    }
    const finalConfig = applyPresetConfig(parsedConfig)
    const defaultLocale = typeof config.default_locale === "string" && config.default_locale.trim()
      ? config.default_locale
      : "el-GR"

    const pivots = getPivotEntries(queryResponse)
    const valueColumns = buildValueColumns(measures, pivots)
    const tree = buildTree(data, dimensions, measures, pivots)
    const subtotalLevels = parseSubtotalLevels(config.subtotal_levels, dimensions.length)
    const measuresMap = new Map(measures.map((measure) => [measure.name, measure]))
    const expandedNodes = ensureExpandedSet(this)

    const renderTable = () => {
      wrapper.innerHTML = ""
      addStyles(wrapper, finalConfig)

      const table = document.createElement("table")
      addHeaderRow(table, dimensions, valueColumns, finalConfig, rules)
      const tbody = document.createElement("tbody")

      tree.children.forEach((node) => {
        renderNode({
          tbody,
          node,
          dimensions,
          valueColumns,
          measuresMap,
          measureFormats,
          defaultLocale,
          config: finalConfig,
          rules,
          thresholdRules,
          subtotalLevels,
          expandedNodes
        })
      })

      table.appendChild(tbody)
      wrapper.appendChild(table)
    }

    renderTable()

    wrapper.onclick = (event) => {
      const button = event.target.closest("button[data-toggle-node-id]")
      if (!button) return

      const nodeId = button.dataset.toggleNodeId
      if (!nodeId) return

      if (expandedNodes.has(nodeId)) {
        expandedNodes.delete(nodeId)
      } else {
        expandedNodes.add(nodeId)
      }

      renderTable()
    }

    done()
    } catch (error) {
      this.addError({
        title: "Pivot Plus v2 render error",
        message: String(error && error.message ? error.message : error)
      })
      const wrapper = element.querySelector(".acme-pivot-plus")
      if (wrapper) {
        wrapper.innerHTML = ""
      }
      done()
    }
  }
})
