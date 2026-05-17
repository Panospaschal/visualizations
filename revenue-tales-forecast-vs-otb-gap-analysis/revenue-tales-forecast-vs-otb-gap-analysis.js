looker.plugins.visualizations.add({
  id: "revenue_tales_forecast_vs_otb_gap_analysis",
  label: "Revenue Tales — Forecast vs OTB Gap Analysis",
  options: {
    title: {
      type: "string",
      label: "Chart Title",
      default: "Forecast vs OTB Gap Analysis",
      section: "Revenue Tales"
    },
    subtitle: {
      type: "string",
      label: "Subtitle",
      default: "Monthly revenue gap and forecast alignment",
      section: "Revenue Tales"
    },
    currency_symbol: {
      type: "string",
      label: "Currency Symbol",
      default: "€",
      section: "Formatting"
    },
    near_zero_threshold_pct: {
      type: "number",
      label: "Near-Zero Threshold %",
      default: 3,
      section: "Logic"
    },
    show_points: {
      type: "boolean",
      label: "Show Line Points",
      default: true,
      section: "Style"
    },
    sort_months: {
      type: "boolean",
      label: "Sort Months Chronologically",
      default: true,
      section: "Data"
    }
  },

  create: function(element) {
    element.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        .rt-gap-root {
          width: 100%;
          height: 100%;
          min-height: 280px;
          position: relative;
          overflow: hidden;
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: #eaf4ff;
          background:
            radial-gradient(circle at 12% 0%, rgba(0, 229, 255, 0.18), transparent 32%),
            radial-gradient(circle at 88% 10%, rgba(168, 85, 247, 0.18), transparent 34%),
            linear-gradient(135deg, #070a12 0%, #0b1020 48%, #070a12 100%);
          border-radius: 22px;
          box-sizing: border-box;
        }

        .rt-gap-shell {
          position: absolute;
          inset: 0;
          padding: 18px 20px 16px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .rt-gap-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex: 0 0 auto;
          z-index: 2;
        }

        .rt-gap-kicker {
          font-size: 10px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #64e8ff;
          font-weight: 800;
          margin-bottom: 4px;
          text-shadow: 0 0 18px rgba(0, 229, 255, 0.35);
        }

        .rt-gap-title {
          margin: 0;
          font-size: clamp(16px, 2.1vw, 24px);
          line-height: 1.1;
          font-weight: 800;
          color: #f4fbff;
          letter-spacing: -0.04em;
        }

        .rt-gap-subtitle {
          margin-top: 5px;
          font-size: 12px;
          color: #8da4bf;
          font-weight: 500;
        }

        .rt-gap-legend {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 8px;
          font-size: 11px;
          color: #a9bbd2;
        }

        .rt-gap-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 9px;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.16);
          background: rgba(15, 23, 42, 0.48);
          backdrop-filter: blur(14px);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
          white-space: nowrap;
        }

        .rt-gap-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          box-shadow: 0 0 12px currentColor;
        }

        .rt-gap-chart-wrap {
          position: relative;
          flex: 1 1 auto;
          min-height: 190px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          background:
            linear-gradient(180deg, rgba(15, 23, 42, 0.62), rgba(2, 6, 23, 0.32));
          border-radius: 18px;
          box-shadow:
            0 24px 70px rgba(0, 0, 0, 0.34),
            inset 0 1px 0 rgba(255,255,255,0.04);
          overflow: hidden;
        }

        .rt-gap-svg {
          width: 100%;
          height: 100%;
          display: block;
        }

        .rt-axis text {
          fill: #91a6c2;
          font-size: 11px;
          font-weight: 600;
        }

        .rt-grid line {
          stroke: rgba(148, 163, 184, 0.13);
          stroke-width: 1;
          shape-rendering: crispEdges;
        }

        .rt-zero-line {
          stroke: rgba(226, 232, 240, 0.72);
          stroke-width: 1.35;
          stroke-dasharray: 4 4;
          filter: drop-shadow(0 0 5px rgba(226, 232, 240, 0.25));
        }

        .rt-gap-bar {
          cursor: pointer;
          transition: opacity 180ms ease, filter 180ms ease, transform 180ms ease;
          transform-box: fill-box;
          transform-origin: center;
        }

        .rt-gap-bar:hover {
          opacity: 1;
          filter: brightness(1.18) drop-shadow(0 0 14px currentColor);
        }

        .rt-gap-line {
          fill: none;
          stroke: url(#rtLineGradient);
          stroke-width: 3;
          stroke-linecap: round;
          stroke-linejoin: round;
          filter: drop-shadow(0 0 10px rgba(139, 92, 246, 0.45));
        }

        .rt-gap-area {
          fill: url(#rtAreaGradient);
          opacity: 0.5;
        }

        .rt-line-point {
          cursor: pointer;
          transition: r 160ms ease, filter 160ms ease;
          fill: #111827;
          stroke: #b26bff;
          stroke-width: 2.2;
          filter: drop-shadow(0 0 8px rgba(168, 85, 247, 0.7));
        }

        .rt-line-point:hover {
          r: 6;
          filter: drop-shadow(0 0 14px rgba(168, 85, 247, 0.95));
        }

        .rt-gap-tooltip {
          position: fixed;
          z-index: 999999;
          pointer-events: none;
          opacity: 0;
          transform: translate(-50%, calc(-100% - 16px)) scale(0.96);
          transition: opacity 140ms ease, transform 140ms ease;
          min-width: 250px;
          border-radius: 16px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          background:
            radial-gradient(circle at top left, rgba(0, 229, 255, 0.12), transparent 38%),
            linear-gradient(145deg, rgba(15, 23, 42, 0.98), rgba(2, 6, 23, 0.98));
          box-shadow:
            0 22px 70px rgba(0,0,0,0.5),
            inset 0 1px 0 rgba(255,255,255,0.07);
          backdrop-filter: blur(18px);
          padding: 13px 14px;
          color: #eaf4ff;
          font-family: Inter, sans-serif;
        }

        .rt-gap-tooltip.visible {
          opacity: 1;
          transform: translate(-50%, calc(-100% - 12px)) scale(1);
        }

        .rt-tip-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 10px;
          padding-bottom: 9px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.14);
        }

        .rt-tip-month {
          font-size: 13px;
          font-weight: 800;
          color: #f8fbff;
          letter-spacing: -0.02em;
        }

        .rt-tip-status {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 5px 8px;
          border-radius: 999px;
          border: 1px solid currentColor;
          background: rgba(255,255,255,0.04);
        }

        .rt-tip-row {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          font-size: 11px;
          line-height: 1.75;
        }

        .rt-tip-label {
          color: #93a6bf;
          font-weight: 600;
        }

        .rt-tip-value {
          color: #f4fbff;
          font-weight: 800;
          text-align: right;
        }

        .rt-empty {
          height: 100%;
          min-height: 260px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: #9fb3cc;
          padding: 32px;
          box-sizing: border-box;
          font-family: Inter, sans-serif;
        }

        .rt-empty strong {
          color: #eaf4ff;
          display: block;
          margin-bottom: 6px;
          font-size: 15px;
        }

        @media (max-width: 620px) {
          .rt-gap-shell {
            padding: 14px;
          }

          .rt-gap-header {
            flex-direction: column;
            gap: 8px;
          }

          .rt-gap-legend {
            justify-content: flex-start;
          }

          .rt-gap-pill {
            padding: 5px 8px;
            font-size: 10px;
          }

          .rt-axis text {
            font-size: 9px;
          }
        }
      </style>

      <div class="rt-gap-root">
        <div class="rt-gap-shell">
          <div class="rt-gap-header">
            <div>
              <div class="rt-gap-kicker">Revenue Tales Intelligence</div>
              <h2 class="rt-gap-title"></h2>
              <div class="rt-gap-subtitle"></div>
            </div>
            <div class="rt-gap-legend">
              <div class="rt-gap-pill"><span class="rt-gap-dot" style="color:#22c55e;background:#22c55e;"></span>Ahead</div>
              <div class="rt-gap-pill"><span class="rt-gap-dot" style="color:#f59e0b;background:#f59e0b;"></span>On Track</div>
              <div class="rt-gap-pill"><span class="rt-gap-dot" style="color:#ef4444;background:#ef4444;"></span>Behind</div>
              <div class="rt-gap-pill"><span class="rt-gap-dot" style="color:#a855f7;background:#a855f7;"></span>Gap %</div>
            </div>
          </div>
          <div class="rt-gap-chart-wrap">
            <svg class="rt-gap-svg"></svg>
          </div>
        </div>
      </div>
      <div class="rt-gap-tooltip"></div>
    `;

    this.container = element.querySelector(".rt-gap-root");
    this.svg = element.querySelector(".rt-gap-svg");
    this.tooltip = element.querySelector(".rt-gap-tooltip");
    this.titleEl = element.querySelector(".rt-gap-title");
    this.subtitleEl = element.querySelector(".rt-gap-subtitle");

    this.resizeObserver = new ResizeObserver(() => {
      if (this.lastData) {
        this.renderVisualization(
          this.lastData.data,
          this.lastData.queryResponse,
          this.lastData.config,
          this.lastData.done
        );
      }
    });

    this.resizeObserver.observe(element);
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.clearErrors();

    this.lastData = { data, queryResponse, config, done };

    if (!queryResponse.fields.dimensions.length) {
      this.addError({
        title: "Missing Month Dimension",
        message: "This visualization requires a Month dimension."
      });
      done();
      return;
    }

    if (!queryResponse.fields.measures.length) {
      this.addError({
        title: "Missing Measures",
        message: "This visualization requires revenue and occupancy measures."
      });
      done();
      return;
    }

    this.renderVisualization(data, queryResponse, config, done);
  },

  renderVisualization: function(data, queryResponse, config, done) {
    const dimensions = queryResponse.fields.dimensions || [];
    const measures = queryResponse.fields.measures || [];

    const title = config.title || "Forecast vs OTB Gap Analysis";
    const subtitle = config.subtitle || "Monthly revenue gap and forecast alignment";
    const currency = config.currency_symbol || "€";
    const nearZeroThreshold = Number(config.near_zero_threshold_pct || 3);

    this.titleEl.textContent = title;
    this.subtitleEl.textContent = subtitle;

    const fields = this.detectFields(dimensions, measures);

    if (!fields.month || !fields.revenueGap || !fields.revenueGapPct) {
      this.svg.innerHTML = "";
      this.showEmpty(`
        <strong>Required fields not found</strong>
        Add Month, Revenue Gap and Revenue Gap % to your Looker query.
      `);
      done();
      return;
    }

    const parsedRows = data
      .filter(row => row && row[fields.month.name])
      .map(row => {
        const revenueGap = this.getNumber(row, fields.revenueGap);
        const revenueGapPct = this.getNumber(row, fields.revenueGapPct);
        const status = this.getStatus(revenueGapPct, nearZeroThreshold);

        return {
          monthRaw: this.getValue(row, fields.month),
          monthLabel: this.getLabel(row, fields.month),
          otbRevenue: this.getNumber(row, fields.otbRevenue),
          forecastRevenue: this.getNumber(row, fields.forecastRevenue),
          revenueGap,
          revenueGapPct,
          otbOccupancyPct: this.getNumber(row, fields.otbOccupancyPct),
          forecastOccupancyPct: this.getNumber(row, fields.forecastOccupancyPct),
          occupancyGapPp: this.getNumber(row, fields.occupancyGapPp),
          status
        };
      })
      .filter(d => Number.isFinite(d.revenueGap) || Number.isFinite(d.revenueGapPct));

    if (!parsedRows.length) {
      this.svg.innerHTML = "";
      this.showEmpty(`
        <strong>No usable data</strong>
        Revenue Gap or Revenue Gap % contains no numeric values.
      `);
      done();
      return;
    }

    this.hideEmpty();

    const rows = config.sort_months === false
      ? parsedRows
      : parsedRows.sort((a, b) => this.monthSortValue(a.monthRaw, a.monthLabel) - this.monthSortValue(b.monthRaw, b.monthLabel));

    const wrap = this.svg.parentElement;
    const width = Math.max(320, wrap.clientWidth || 640);
    const height = Math.max(190, wrap.clientHeight || 320);

    const compact = width < 620 || height < 280;

    const margin = {
      top: compact ? 18 : 24,
      right: compact ? 42 : 58,
      bottom: compact ? 38 : 48,
      left: compact ? 54 : 72
    };

    const innerW = Math.max(120, width - margin.left - margin.right);
    const innerH = Math.max(90, height - margin.top - margin.bottom);

    const barValues = rows.map(d => Number.isFinite(d.revenueGap) ? d.revenueGap : 0);
    const lineValues = rows.map(d => Number.isFinite(d.revenueGapPct) ? d.revenueGapPct : 0);

    const maxAbsGap = Math.max(1, ...barValues.map(v => Math.abs(v))) * 1.18;
    const maxAbsPct = Math.max(1, ...lineValues.map(v => Math.abs(v))) * 1.25;

    const yGap = v => margin.top + ((maxAbsGap - v) / (maxAbsGap * 2)) * innerH;
    const yPct = v => margin.top + ((maxAbsPct - v) / (maxAbsPct * 2)) * innerH;

    const zeroY = yGap(0);
    const step = innerW / Math.max(1, rows.length);
    const barW = Math.max(10, Math.min(42, step * 0.48));

    const xCenter = i => margin.left + step * i + step / 2;

    const gapTicks = this.makeSymmetricTicks(maxAbsGap, 4);
    const pctTicks = this.makeSymmetricTicks(maxAbsPct, 4);

    const uid = `rtgap${Math.random().toString(36).slice(2)}`;

    this.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    this.svg.setAttribute("preserveAspectRatio", "none");

    const defs = `
      <defs>
        <linearGradient id="${uid}-green" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#34d399" stop-opacity="0.96"/>
          <stop offset="100%" stop-color="#16a34a" stop-opacity="0.66"/>
        </linearGradient>

        <linearGradient id="${uid}-amber" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.96"/>
          <stop offset="100%" stop-color="#d97706" stop-opacity="0.66"/>
        </linearGradient>

        <linearGradient id="${uid}-red" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fb7185" stop-opacity="0.96"/>
          <stop offset="100%" stop-color="#dc2626" stop-opacity="0.68"/>
        </linearGradient>

        <linearGradient id="rtLineGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#22d3ee"/>
          <stop offset="52%" stop-color="#818cf8"/>
          <stop offset="100%" stop-color="#d946ef"/>
        </linearGradient>

        <linearGradient id="rtAreaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#a855f7" stop-opacity="0.20"/>
          <stop offset="100%" stop-color="#22d3ee" stop-opacity="0.00"/>
        </linearGradient>

        <filter id="${uid}-softGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
    `;

    const grid = gapTicks.map(t => {
      const y = yGap(t);
      return `
        <g class="rt-grid">
          <line x1="${margin.left}" x2="${width - margin.right}" y1="${y}" y2="${y}"></line>
        </g>
        <text x="${margin.left - 12}" y="${y + 4}" text-anchor="end" class="rt-axis-label">
          ${this.formatCompactCurrency(t, currency)}
        </text>
      `;
    }).join("");

    const rightAxis = pctTicks.map(t => {
      const y = yPct(t);
      return `
        <text x="${width - margin.right + 12}" y="${y + 4}" text-anchor="start" class="rt-axis-label">
          ${this.formatPct(t)}
        </text>
      `;
    }).join("");

    const bars = rows.map((d, i) => {
      const x = xCenter(i) - barW / 2;
      const yVal = yGap(d.revenueGap);
      const y = d.revenueGap >= 0 ? yVal : zeroY;
      const h = Math.max(2, Math.abs(zeroY - yVal));
      const color = d.status.key === "ahead" ? "green" : d.status.key === "behind" ? "red" : "amber";
      const glow = d.status.key === "ahead" ? "#22c55e" : d.status.key === "behind" ? "#ef4444" : "#f59e0b";

      return `
        <rect
          class="rt-gap-bar"
          data-idx="${i}"
          x="${x}"
          y="${zeroY}"
          width="${barW}"
          height="0"
          rx="${Math.min(8, barW / 2)}"
          fill="url(#${uid}-${color})"
          style="color:${glow};"
        >
          <animate attributeName="y" from="${zeroY}" to="${y}" dur="720ms" fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1"/>
          <animate attributeName="height" from="0" to="${h}" dur="720ms" fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1"/>
        </rect>
      `;
    }).join("");

    const linePoints = rows.map((d, i) => `${xCenter(i)},${yPct(d.revenueGapPct)}`).join(" ");
    const linePath = this.pointsToPath(rows.map((d, i) => [xCenter(i), yPct(d.revenueGapPct)]));
    const areaPath = `${linePath} L ${xCenter(rows.length - 1)},${zeroY} L ${xCenter(0)},${zeroY} Z`;

    const line = `
      <path class="rt-gap-area" d="${areaPath}"></path>
      <path class="rt-gap-line" d="${linePath}">
        <animate attributeName="stroke-dasharray" from="0 ${innerW * 2}" to="${innerW * 2} 0" dur="900ms" fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1"/>
      </path>
      ${
        config.show_points === false
          ? ""
          : rows.map((d, i) => `
              <circle
                class="rt-line-point"
                data-idx="${i}"
                cx="${xCenter(i)}"
                cy="${yPct(d.revenueGapPct)}"
                r="4"
              ></circle>
            `).join("")
      }
    `;

    const xAxis = rows.map((d, i) => {
      const shouldShow = compact && rows.length > 8 ? i % Math.ceil(rows.length / 6) === 0 : true;
      return shouldShow ? `
        <text
          x="${xCenter(i)}"
          y="${height - margin.bottom + 24}"
          text-anchor="middle"
          class="rt-axis-label"
        >${this.escapeXml(this.shortenLabel(d.monthLabel, compact ? 8 : 12))}</text>
      ` : "";
    }).join("");

    const axisLabels = `
      <text x="${margin.left}" y="${margin.top - 8}" text-anchor="start" fill="#8da4bf" font-size="10" font-weight="800" letter-spacing="0.08em">REVENUE GAP</text>
      <text x="${width - margin.right}" y="${margin.top - 8}" text-anchor="end" fill="#a78bfa" font-size="10" font-weight="800" letter-spacing="0.08em">GAP %</text>
    `;

    this.svg.innerHTML = `
      ${defs}
      <g class="rt-axis">
        ${grid}
        ${rightAxis}
        ${axisLabels}
        <line class="rt-zero-line" x1="${margin.left}" x2="${width - margin.right}" y1="${zeroY}" y2="${zeroY}"></line>
        ${bars}
        ${line}
        ${xAxis}
      </g>
    `;

    const hitTargets = [...this.svg.querySelectorAll("[data-idx]")];

    hitTargets.forEach(el => {
      const idx = Number(el.getAttribute("data-idx"));
      const row = rows[idx];

      el.addEventListener("mousemove", ev => {
        this.showTooltip(ev, row, currency);
      });

      el.addEventListener("mouseenter", ev => {
        this.showTooltip(ev, row, currency);
      });

      el.addEventListener("mouseleave", () => {
        this.hideTooltip();
      });
    });

    done();
  },

  detectFields: function(dimensions, measures) {
    const all = [...dimensions, ...measures];

    const findDimension = patterns =>
      dimensions.find(f => this.matchesField(f, patterns)) || dimensions[0];

    const findMeasure = patterns =>
      measures.find(f => this.matchesField(f, patterns));

    return {
      month: findDimension(["month", "date_month", "period", "μήνας"]),
      otbRevenue: findMeasure(["otb revenue", "on the books revenue", "pickup revenue", "actual revenue", "otb_revenue"]),
      forecastRevenue: findMeasure(["forecast revenue", "forecasted revenue", "fc revenue", "forecast_revenue"]),
      revenueGap: findMeasure(["revenue gap", "gap revenue", "rev gap", "revenue_gap", "variance revenue"]),
      revenueGapPct: findMeasure(["revenue gap %", "revenue gap pct", "revenue gap percent", "gap %", "gap pct", "gap_percent", "revenue_gap_pct"]),
      otbOccupancyPct: findMeasure(["otb occupancy", "otb occ", "on the books occupancy", "otb_occupancy"]),
      forecastOccupancyPct: findMeasure(["forecast occupancy", "forecast occ", "forecast_occupancy"]),
      occupancyGapPp: findMeasure(["occupancy gap pp", "occ gap pp", "occupancy gap", "occ gap", "occupancy_gap_pp"])
    };
  },

  matchesField: function(field, patterns) {
    const source = [
      field.name,
      field.label,
      field.label_short,
      field.view_label,
      field.description
    ].filter(Boolean).join(" ").toLowerCase();

    return patterns.some(pattern => {
      const p = pattern.toLowerCase();
      return source.includes(p);
    });
  },

  getValue: function(row, field) {
    if (!field || !row[field.name]) return null;
    return row[field.name].value;
  },

  getLabel: function(row, field) {
    if (!field || !row[field.name]) return "";
    const cell = row[field.name];
    return String(cell.rendered || cell.value || "");
  },

  getNumber: function(row, field) {
    if (!field || !row[field.name]) return null;
    const cell = row[field.name];
    const raw = cell.value;

    if (typeof raw === "number") return raw;

    const cleaned = String(raw ?? cell.rendered ?? "")
      .replace(/[€$£,%\s]/g, "")
      .replace(/\((.*)\)/, "-$1")
      .replace(/,/g, "");

    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  },

  getStatus: function(gapPct, threshold) {
    if (!Number.isFinite(gapPct)) {
      return { key: "on_track", label: "On Track", color: "#f59e0b" };
    }

    const normalized = Math.abs(gapPct) <= 1 && Math.abs(gapPct) > threshold / 100
      ? gapPct * 100
      : gapPct;

    if (normalized > threshold) {
      return { key: "ahead", label: "Ahead", color: "#22c55e" };
    }

    if (normalized < -threshold) {
      return { key: "behind", label: "Behind", color: "#ef4444" };
    }

    return { key: "on_track", label: "On Track", color: "#f59e0b" };
  },

  monthSortValue: function(raw, label) {
    const value = raw || label;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;

    const text = String(label || raw || "").toLowerCase();

    const months = {
      jan: 1, january: 1,
      feb: 2, february: 2,
      mar: 3, march: 3,
      apr: 4, april: 4,
      may: 5,
      jun: 6, june: 6,
      jul: 7, july: 7,
      aug: 8, august: 8,
      sep: 9, sept: 9, september: 9,
      oct: 10, october: 10,
      nov: 11, november: 11,
      dec: 12, december: 12
    };

    const greekMonths = {
      "ιαν": 1, "ιανουάριος": 1,
      "φεβ": 2, "φεβρουάριος": 2,
      "μαρ": 3, "μάρτιος": 3,
      "απρ": 4, "απρίλιος": 4,
      "μαι": 5, "μάιος": 5,
      "ιουν": 6, "ιούνιος": 6,
      "ιουλ": 7, "ιούλιος": 7,
      "αυγ": 8, "αύγουστος": 8,
      "σεπ": 9, "σεπτέμβριος": 9,
      "οκτ": 10, "οκτώβριος": 10,
      "νοε": 11, "νοέμβριος": 11,
      "δεκ": 12, "δεκέμβριος": 12
    };

    const yearMatch = text.match(/20\d{2}/);
    const year = yearMatch ? Number(yearMatch[0]) : 2000;

    for (const [k, v] of Object.entries({ ...months, ...greekMonths })) {
      if (text.includes(k)) return year * 100 + v;
    }

    const numMatch = text.match(/\b(1[0-2]|0?[1-9])\b/);
    if (numMatch) return year * 100 + Number(numMatch[1]);

    return Number.MAX_SAFE_INTEGER;
  },

  makeSymmetricTicks: function(maxAbs, count) {
    const nice = this.niceNumber(maxAbs);
    const step = nice / count;
    const ticks = [];

    for (let i = -count; i <= count; i++) {
      ticks.push(i * step);
    }

    return ticks;
  },

  niceNumber: function(value) {
    const exponent = Math.floor(Math.log10(value));
    const fraction = value / Math.pow(10, exponent);
    let niceFraction;

    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;

    return niceFraction * Math.pow(10, exponent);
  },

  pointsToPath: function(points) {
    if (!points.length) return "";

    if (points.length === 1) {
      return `M ${points[0][0]} ${points[0][1]}`;
    }

    let d = `M ${points[0][0]} ${points[0][1]}`;

    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      const cx1 = x0 + (x1 - x0) * 0.45;
      const cy1 = y0;
      const cx2 = x1 - (x1 - x0) * 0.45;
      const cy2 = y1;

      d += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x1} ${y1}`;
    }

    return d;
  },

  showTooltip: function(ev, d, currency) {
    const status = d.status || { label: "On Track", color: "#f59e0b" };

    this.tooltip.innerHTML = `
      <div class="rt-tip-head">
        <div class="rt-tip-month">${this.escapeHtml(d.monthLabel)}</div>
        <div class="rt-tip-status" style="color:${status.color};">${status.label}</div>
      </div>

      ${this.tipRow("OTB Revenue", this.formatCurrency(d.otbRevenue, currency))}
      ${this.tipRow("Forecast Revenue", this.formatCurrency(d.forecastRevenue, currency))}
      ${this.tipRow("Revenue Gap", this.formatCurrency(d.revenueGap, currency))}
      ${this.tipRow("Revenue Gap %", this.formatPct(d.revenueGapPct))}
      ${this.tipRow("OTB Occupancy %", this.formatPct(d.otbOccupancyPct))}
      ${this.tipRow("Forecast Occupancy %", this.formatPct(d.forecastOccupancyPct))}
      ${this.tipRow("Occupancy Gap pp", this.formatPp(d.occupancyGapPp))}
    `;

    const pad = 16;
    const tooltipWidth = 270;
    const x = Math.min(window.innerWidth - tooltipWidth / 2 - pad, Math.max(tooltipWidth / 2 + pad, ev.clientX));
    const y = Math.max(120, ev.clientY);

    this.tooltip.style.left = `${x}px`;
    this.tooltip.style.top = `${y}px`;
    this.tooltip.classList.add("visible");
  },

  hideTooltip: function() {
    if (this.tooltip) {
      this.tooltip.classList.remove("visible");
    }
  },

  tipRow: function(label, value) {
    return `
      <div class="rt-tip-row">
        <span class="rt-tip-label">${label}</span>
        <span class="rt-tip-value">${value}</span>
      </div>
    `;
  },

  showEmpty: function(html) {
    const existing = this.container.querySelector(".rt-empty");
    if (existing) existing.remove();

    const empty = document.createElement("div");
    empty.className = "rt-empty";
    empty.innerHTML = `<div>${html}</div>`;
    this.container.appendChild(empty);
  },

  hideEmpty: function() {
    const existing = this.container.querySelector(".rt-empty");
    if (existing) existing.remove();
  },

  formatCurrency: function(value, currency) {
    if (!Number.isFinite(value)) return "—";

    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";

    if (abs >= 1000000) {
      return `${sign}${currency}${(abs / 1000000).toFixed(abs >= 10000000 ? 1 : 2)}M`;
    }

    if (abs >= 1000) {
      return `${sign}${currency}${(abs / 1000).toFixed(abs >= 100000 ? 0 : 1)}K`;
    }

    return `${sign}${currency}${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  },

  formatCompactCurrency: function(value, currency) {
    if (!Number.isFinite(value)) return "—";
    if (value === 0) return `${currency}0`;
    return this.formatCurrency(value, currency);
  },

  formatPct: function(value) {
    if (!Number.isFinite(value)) return "—";

    const normalized = Math.abs(value) <= 1 ? value * 100 : value;

    return `${normalized > 0 ? "+" : ""}${normalized.toFixed(Math.abs(normalized) >= 10 ? 0 : 1)}%`;
  },

  formatPp: function(value) {
    if (!Number.isFinite(value)) return "—";

    const normalized = Math.abs(value) <= 1 ? value * 100 : value;

    return `${normalized > 0 ? "+" : ""}${normalized.toFixed(Math.abs(normalized) >= 10 ? 0 : 1)} pp`;
  },

  shortenLabel: function(label, max) {
    const text = String(label || "");
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  },

  escapeHtml: function(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  escapeXml: function(str) {
    return this.escapeHtml(str);
  }
});
