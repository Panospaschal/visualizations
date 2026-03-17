const VIZ_ID = "acme_pivot_plus_v2"

const NO_PIVOT_KEY = "__no_pivot__"
const ROW_TOTAL_KEY = "__row_total__"

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

function parseSubtotalDimensions(rawDimensions, dimensions) {
  const normalize = (value) => String(value || "").trim().toLowerCase()
  const nameByToken = new Map()
  dimensions.forEach((dimension) => {
    const name = dimension.name
    nameByToken.set(normalize(name), name)
    nameByToken.set(normalize(dimension.label), name)
    nameByToken.set(normalize(dimension.label_short), name)
  })

  if (!rawDimensions || typeof rawDimensions !== "string" || !rawDimensions.trim()) {
    return new Set(dimensions.map((dimension) => dimension.name))
  }

  const selected = new Set()

  rawDimensions
    .split(",")
    .map((part) => normalize(part))
    .filter((name) => name.length > 0)
    .forEach((token) => {
      const resolvedName = nameByToken.get(token)
      if (resolvedName) selected.add(resolvedName)
    })

  return selected.size ? selected : new Set(dimensions.map((dimension) => dimension.name))
}

function measureOptionKey(index, field) {
  return `measure_format_${index}_${field}`
}

function dimensionOptionKey(index) {
  return `dimension_align_${index}`
}

function measureAlignOptionKey(index) {
  return `measure_align_${index}`
}

function registerMeasureFormatOptions(vis, dimensions, measures, defaultLocale, includeDynamic) {
  const signature = `${dimensions.map((dimension) => dimension.name).join("|")}::${measures
    .map((measure) => measure.name)
    .join("|")}`
  const mode = includeDynamic ? "dynamic" : "base"
  const cacheKey = `${mode}|${signature}|${defaultLocale}`
  if (vis._measureOptionSignature === cacheKey) return

  const options = { ...BASE_OPTIONS }

  dimensions.forEach((dimension, index) => {
    const label = dimension.label_short ?? dimension.label ?? dimension.name
    options[dimensionOptionKey(index)] = {
      type: "string",
      display: "select",
      label: `Align ${label}`,
      default: "left",
      values: [{ left: "left" }, { center: "center" }, { right: "right" }]
    }
  })

  measures.forEach((measure, index) => {
    const label = measure.label_short ?? measure.label ?? measure.name
    options[measureAlignOptionKey(index)] = {
      type: "string",
      display: "select",
      label: `Align ${label}`,
      default: "right",
      values: [{ left: "left" }, { center: "center" }, { right: "right" }]
    }
  })

  if (includeDynamic) {
    measures.forEach((measure, index) => {
      const label = measure.label_short ?? measure.label ?? measure.name
      options[measureOptionKey(index, "type")] = {
        type: "string",
        display: "select",
        label: `Format ${label}`,
        default: "looker",
        values: [
          { looker: "looker" },
          { number: "number" },
          { currency: "currency" },
          { percent: "percent" },
          { date: "date" },
          { datetime: "datetime" }
        ]
      }
      options[measureOptionKey(index, "decimals")] = {
        type: "number",
        label: `Decimals ${label}`,
        default: 2
      }
      options[measureOptionKey(index, "currency")] = {
        type: "string",
        label: `Currency ${label}`,
        default: "EUR"
      }
      options[measureOptionKey(index, "percent_input")] = {
        type: "string",
        display: "select",
        label: `Percent input ${label}`,
        default: "ratio",
        values: [{ ratio: "ratio" }, { whole: "whole" }]
      }
      options[measureOptionKey(index, "prefix")] = {
        type: "string",
        label: `Prefix ${label}`,
        default: ""
      }
      options[measureOptionKey(index, "suffix")] = {
        type: "string",
        label: `Suffix ${label}`,
        default: ""
      }
      options[measureOptionKey(index, "locale")] = {
        type: "string",
        label: `Locale ${label}`,
        default: defaultLocale
      }
    })
  }

  vis.trigger("registerOptions", options)
  vis._measureOptionSignature = cacheKey
}

function buildMeasureFormatsFromOptions(measures, config, defaultLocale) {
  const formats = {}

  measures.forEach((measure, index) => {
    const type = String(config[measureOptionKey(index, "type")] || "looker").toLowerCase()
    if (type === "looker") return

    const format = { type }
    const decimals = toNonNegativeInteger(config[measureOptionKey(index, "decimals")])
    const currency = config[measureOptionKey(index, "currency")]
    const percentInput = config[measureOptionKey(index, "percent_input")]
    const prefix = config[measureOptionKey(index, "prefix")]
    const suffix = config[measureOptionKey(index, "suffix")]
    const locale = config[measureOptionKey(index, "locale")]

    if (decimals != null) format.decimals = decimals
    if (typeof currency === "string" && currency.trim()) format.currency = currency.trim().toUpperCase()
    if (percentInput === "whole" || percentInput === "ratio") format.percent_input = percentInput
    if (typeof prefix === "string" && prefix) format.prefix = prefix
    if (typeof suffix === "string" && suffix) format.suffix = suffix
    if (typeof locale === "string" && locale.trim()) {
      format.locale = locale.trim()
    } else {
      format.locale = defaultLocale
    }

    formats[measure.name] = format
  })

  return formats
}

function getDimensionAlignment(config, dimensionIndex) {
  return normalizeAlign(config[dimensionOptionKey(dimensionIndex)], config.value_align)
}

function getMeasureAlignment(config, measureIndex) {
  return normalizeAlign(config[measureAlignOptionKey(measureIndex)], config.value_align)
}

function shouldDisplayDimensionValue(previousDimensions, currentDimensions, index, repeatValues) {
  if (repeatValues !== false) return true
  if (!previousDimensions) return true
  for (let i = 0; i <= index; i += 1) {
    if (previousDimensions[i] !== currentDimensions[i]) {
      return true
    }
  }
  return false
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

function buildValueColumns(measures, pivots, showRowTotals) {
  const columns = []
  const hasRealPivots = pivots.some((pivot) => pivot.key !== NO_PIVOT_KEY)

  measures.forEach((measure) => {
    pivots.forEach((pivot) => {
      const pivotLabel = pivot.key === NO_PIVOT_KEY ? "" : pivot.label
      columns.push({
        id: `${measure.name}::${pivot.key}`,
        measureName: measure.name,
        measureIndex: measures.findIndex((entry) => entry.name === measure.name),
        measureLabel: measure.label_short ?? measure.label,
        pivotKey: pivot.key,
        pivotLabel,
        isRowTotal: false,
        label: pivotLabel ? `${pivotLabel} - ${measure.label_short ?? measure.label}` : (measure.label_short ?? measure.label)
      })
    })

    if (showRowTotals && hasRealPivots) {
      columns.push({
        id: `${measure.name}::${ROW_TOTAL_KEY}`,
        measureName: measure.name,
        measureIndex: measures.findIndex((entry) => entry.name === measure.name),
        measureLabel: measure.label_short ?? measure.label,
        pivotKey: ROW_TOTAL_KEY,
        pivotLabel: "Total",
        isRowTotal: true,
        label: `Total - ${measure.label_short ?? measure.label}`
      })
    }
  })

  return columns
}

function getColumnNumericValue(valuesByMeasure, column, pivots) {
  if (!column.isRowTotal) {
    return valuesByMeasure[column.measureName][column.pivotKey]
  }

  return pivots.reduce((sum, pivot) => {
    if (pivot.key === NO_PIVOT_KEY) return sum
    return sum + (valuesByMeasure[column.measureName][pivot.key] || 0)
  }, 0)
}

function addStyles(element, config) {
  const tableBorderWidth = Number(config.table_border_width)
  const cellBorderWidth = Number(config.cell_border_width)

  const safeTableBorderWidth = Number.isFinite(tableBorderWidth) && tableBorderWidth >= 0 ? tableBorderWidth : 1
  const safeCellBorderWidth = Number.isFinite(cellBorderWidth) && cellBorderWidth >= 0 ? cellBorderWidth : 1
  const baseFontSize = Number(config.font_size_px)
  const headerFontSize = Number(config.header_font_size_px)
  const valueFontSize = Number(config.value_font_size_px)
  const safeBaseFontSize = Number.isFinite(baseFontSize) && baseFontSize > 0 ? baseFontSize : 14
  const safeHeaderFontSize = Number.isFinite(headerFontSize) && headerFontSize > 0 ? headerFontSize : safeBaseFontSize
  const safeValueFontSize = Number.isFinite(valueFontSize) && valueFontSize > 0 ? valueFontSize : safeBaseFontSize
  const fontFamily =
    config.font_family && config.font_family !== "custom"
      ? config.font_family
      : (config.custom_font_family || "'Open Sans', Arial, sans-serif")

  const style = document.createElement("style")
  style.textContent = `
    .acme-pivot-plus {
      width: 100%;
      height: 100%;
      overflow: auto;
      box-sizing: border-box;
      font-family: ${fontFamily};
      font-size: ${safeBaseFontSize}px;
      color: #111827;
    }

    .acme-pivot-plus th {
      font-size: ${safeHeaderFontSize}px;
    }

    .acme-pivot-plus td {
      font-size: ${safeValueFontSize}px;
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

function addHeaderRow(table, dimensions, measures, pivots, valueColumns, config, rules) {
  const thead = document.createElement("thead")
  const hasRealPivots = pivots.some((pivot) => pivot.key !== NO_PIVOT_KEY)
  const splitPivotHeaders = config.split_pivot_headers !== false && hasRealPivots

  if (!splitPivotHeaders) {
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
        align: getDimensionAlignment(config, index),
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
        align: getMeasureAlignment(config, column.measureIndex),
        bgColor: config.header_bg_color,
        fontColor: config.header_font_color,
        bold: config.header_bold !== false
      })
      row.appendChild(th)
    })

    thead.appendChild(row)
    table.appendChild(thead)
    return
  }

  const topRow = document.createElement("tr")
  const secondRow = document.createElement("tr")

  dimensions.forEach((dimension, index) => {
    const th = document.createElement("th")
    th.rowSpan = 2
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
      align: getDimensionAlignment(config, index),
      bgColor: config.header_bg_color,
      fontColor: config.header_font_color,
      bold: config.header_bold !== false
    })
    topRow.appendChild(th)
  })

  const groups = []
  const groupMap = new Map()
  valueColumns.forEach((column) => {
    const key = column.pivotLabel || "Value"
    if (!groupMap.has(key)) {
      const group = { label: key, columns: [] }
      groupMap.set(key, group)
      groups.push(group)
    }
    groupMap.get(key).columns.push(column)
  })

  groups.forEach((group) => {
    const thGroup = document.createElement("th")
    thGroup.colSpan = group.columns.length
    thGroup.textContent = group.label
    applyCellStyle(thGroup, {}, {
      align: config.header_align,
      bgColor: config.header_bg_color,
      fontColor: config.header_font_color,
      bold: config.header_bold !== false
    })
    topRow.appendChild(thGroup)

    group.columns.forEach((column) => {
      const th = document.createElement("th")
      const measure = measures[column.measureIndex]
      th.textContent = measure?.label_short ?? measure?.label ?? column.measureLabel
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
        align: getMeasureAlignment(config, column.measureIndex),
        bgColor: config.header_bg_color,
        fontColor: config.header_font_color,
        bold: config.header_bold !== false
      })
      secondRow.appendChild(th)
    })
  })

  thead.appendChild(topRow)
  thead.appendChild(secondRow)
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
  pivots,
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
      align: getDimensionAlignment(config, index),
      bgColor: config.subtotal_bg_color,
      fontColor: config.subtotal_font_color,
      bold: config.subtotal_bold !== false
    })

    tr.appendChild(td)
  })

  valueColumns.forEach((column) => {
    const td = document.createElement("td")
    const value = getColumnNumericValue(node.totals, column, pivots)
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
      align: getMeasureAlignment(config, column.measureIndex),
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
  pivots,
  valueColumns,
  measuresMap,
  measureFormats,
  defaultLocale,
  config,
  rules,
  thresholdRules,
  lastDetailDimensions
}) {
  const tr = document.createElement("tr")
  tr.dataset.rowType = "value"

  dimensions.forEach((dimension, index) => {
    const td = document.createElement("td")
    td.className = "acme-pivot-plus__dim-cell"
    const showValue = shouldDisplayDimensionValue(
      lastDetailDimensions.value,
      detailRow.dimensions,
      index,
      config.repeat_dimension_values
    )
    td.textContent = showValue ? (detailRow.dimensions[index] || "") : ""

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
      align: getDimensionAlignment(config, index),
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
    const value = getColumnNumericValue(detailRow.values, column, pivots)
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
      align: getMeasureAlignment(config, column.measureIndex),
      bgColor: config.value_bg_color,
      fontColor: config.value_font_color,
      bold: config.value_bold === true
    })
    tr.appendChild(td)
  })

  tbody.appendChild(tr)
  lastDetailDimensions.value = detailRow.dimensions.slice()
}

function renderNode({
  tbody,
  node,
  dimensions,
  pivots,
  valueColumns,
  measuresMap,
  measureFormats,
  defaultLocale,
  config,
  rules,
  thresholdRules,
  subtotalLevels,
  subtotalDimensions,
  expandedNodes,
  lastDetailDimensions
}) {
  const showSubtotal =
    config.enable_subtotals !== false &&
    subtotalLevels.has(node.level) &&
    subtotalDimensions.has(node.dimension)

  if (!showSubtotal && !node.children.size) {
    if (config.show_detail_rows === false) return
    node.rows.forEach((detailRow) => {
      addDetailRow({
        tbody,
        detailRow,
        dimensions,
        pivots,
        valueColumns,
        measuresMap,
        measureFormats,
        defaultLocale,
        config,
        rules,
        thresholdRules,
        lastDetailDimensions
      })
    })
    return
  }

  const expanded = addSubtotalRow({
    tbody,
    node,
    dimensions,
    valueColumns,
    pivots,
    measuresMap,
    measureFormats,
    defaultLocale,
    config,
    rules,
    thresholdRules,
    expandedNodes,
    showSubtotal
  })

  if (showSubtotal) {
    lastDetailDimensions.value = null
  }

  if (!expanded) return

  if (node.children.size) {
    node.children.forEach((child) => {
      renderNode({
        tbody,
        node: child,
        dimensions,
        pivots,
        valueColumns,
        measuresMap,
        measureFormats,
        defaultLocale,
        config,
        rules,
        thresholdRules,
        subtotalLevels,
        subtotalDimensions,
        expandedNodes,
        lastDetailDimensions
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
      pivots,
      valueColumns,
      measuresMap,
      measureFormats,
      defaultLocale,
      config,
      rules,
      thresholdRules,
      lastDetailDimensions
    })
  })
}

function addColumnTotalsRow({
  table,
  dimensions,
  pivots,
  valueColumns,
  measuresMap,
  measureFormats,
  defaultLocale,
  rootTotals,
  config,
  rules,
  thresholdRules
}) {
  const tfoot = document.createElement("tfoot")
  const tr = document.createElement("tr")

  dimensions.forEach((dimension, index) => {
    const td = document.createElement("td")
    td.textContent = index === 0 ? "Total" : ""
    const context = {
      target: "subtotal",
      dimension: dimension.name,
      measure: null,
      pivotKey: null,
      rowLevel: null,
      subtotalLevel: 0
    }
    const style = styleFromRules(rules, context)
    applyCellStyle(td, style, {
      align: getDimensionAlignment(config, index),
      bgColor: config.subtotal_bg_color,
      fontColor: config.subtotal_font_color,
      bold: true
    })
    tr.appendChild(td)
  })

  valueColumns.forEach((column) => {
    const td = document.createElement("td")
    const value = getColumnNumericValue(rootTotals, column, pivots)
    const measure = measuresMap.get(column.measureName)
    const measureConfig = measureFormats[column.measureName]
    td.textContent = formatValue(measure, value, measureConfig, defaultLocale)

    const context = {
      target: "subtotal",
      dimension: null,
      measure: column.measureName,
      pivotKey: column.pivotKey,
      rowLevel: null,
      subtotalLevel: 0
    }
    const style = styleFromRules(rules, context)
    const thresholdStyle = styleFromThresholdRules(thresholdRules, context, value)
    applyCellStyle(td, { ...style, ...thresholdStyle }, {
      align: getMeasureAlignment(config, column.measureIndex),
      bgColor: config.subtotal_bg_color,
      fontColor: config.subtotal_font_color,
      bold: true
    })
    tr.appendChild(td)
  })

  tfoot.appendChild(tr)
  table.appendChild(tfoot)
}

const BASE_OPTIONS = {
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
  repeat_dimension_values: {
    type: "boolean",
    label: "Repeat dimension values",
    default: false
  },
  split_pivot_headers: {
    type: "boolean",
    label: "Split pivot headers",
    default: true
  },
  show_row_totals: {
    type: "boolean",
    label: "Show row totals",
    default: false
  },
  show_column_totals: {
    type: "boolean",
    label: "Show column totals",
    default: false
  },
  font_family: {
    type: "string",
    display: "select",
    label: "Font family",
    default: "'Open Sans', Arial, sans-serif",
    values: [
      { "'Open Sans', Arial, sans-serif": "Open Sans" },
      { "'Lato', Arial, sans-serif": "Lato" },
      { "'Montserrat', Arial, sans-serif": "Montserrat" },
      { "'Source Sans 3', Arial, sans-serif": "Source Sans 3" },
      { "'Nunito Sans', Arial, sans-serif": "Nunito Sans" },
      { "'Merriweather', Georgia, serif": "Merriweather" },
      { "'Roboto Slab', Georgia, serif": "Roboto Slab" },
      { custom: "Custom" }
    ]
  },
  custom_font_family: {
    type: "string",
    label: "Custom font family",
    default: "'Open Sans', Arial, sans-serif"
  },
  font_size_px: {
    type: "number",
    label: "Font size",
    default: 14
  },
  header_font_size_px: {
    type: "number",
    label: "Header font size",
    default: 14
  },
  value_font_size_px: {
    type: "number",
    label: "Value font size",
    default: 14
  },

  enable_subtotals: { type: "boolean", label: "Enable subtotals", default: true },
  subtotal_levels: {
    type: "string",
    label: "Subtotal levels (comma separated)",
    default: "1,2,3"
  },
  subtotal_dimensions: {
    type: "string",
    label: "Subtotal dimensions (comma separated names)",
    default: ""
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
  enable_measure_format_controls: {
    type: "boolean",
    label: "Show measure format controls",
    default: true
  },
  measure_formats_json: {
    type: "string",
    label: "Measure formats JSON",
    default: "{}"
  }
}

looker.plugins.visualizations.add({
  id: VIZ_ID,
  label: "Acme Pivot Plus v2",
  options: BASE_OPTIONS,

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

    const defaultLocale = typeof config.default_locale === "string" && config.default_locale.trim()
      ? config.default_locale
      : "el-GR"
    const includeMeasureControls = config.enable_measure_format_controls !== false

    registerMeasureFormatOptions(this, dimensions, measures, defaultLocale, includeMeasureControls)

    const rules = parseJsonArray(config.style_rules_json, [])
    const thresholdRules = parseJsonArray(config.threshold_rules_json, [])
    const optionMeasureFormats = includeMeasureControls
      ? buildMeasureFormatsFromOptions(measures, config, defaultLocale)
      : {}
    const jsonMeasureFormats = parseJsonObject(config.measure_formats_json, {})
    const measureFormats = {
      ...optionMeasureFormats,
      ...jsonMeasureFormats
    }
    const subtotalLevelStyles = parseJsonObject(config.subtotal_level_styles_json, {})
    const parsedConfig = {
      ...config,
      header_align: normalizeAlign(config.header_align, "left"),
      value_align: normalizeAlign(config.value_align, "right"),
      subtotalLevelStyles
    }
    const finalConfig = applyPresetConfig(parsedConfig)

    const pivots = getPivotEntries(queryResponse)
    const valueColumns = buildValueColumns(measures, pivots, finalConfig.show_row_totals === true)
    const tree = buildTree(data, dimensions, measures, pivots)
    const subtotalLevels = parseSubtotalLevels(config.subtotal_levels, dimensions.length)
    const subtotalDimensions = parseSubtotalDimensions(config.subtotal_dimensions, dimensions)
    const measuresMap = new Map(measures.map((measure) => [measure.name, measure]))
    const expandedNodes = ensureExpandedSet(this)

    const renderTable = () => {
      wrapper.innerHTML = ""
      addStyles(wrapper, finalConfig)

      const table = document.createElement("table")
      addHeaderRow(table, dimensions, measures, pivots, valueColumns, finalConfig, rules)
      const tbody = document.createElement("tbody")
      const lastDetailDimensions = { value: null }

      tree.children.forEach((node) => {
        renderNode({
          tbody,
          node,
          dimensions,
          pivots,
          valueColumns,
          measuresMap,
          measureFormats,
          defaultLocale,
          config: finalConfig,
          rules,
          thresholdRules,
          subtotalLevels,
          subtotalDimensions,
          expandedNodes,
          lastDetailDimensions
        })
      })

      table.appendChild(tbody)
      if (finalConfig.show_column_totals === true) {
        addColumnTotalsRow({
          table,
          dimensions,
          pivots,
          valueColumns,
          measuresMap,
          measureFormats,
          defaultLocale,
          rootTotals: tree.totals,
          config: finalConfig,
          rules,
          thresholdRules
        })
      }
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
