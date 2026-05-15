looker.plugins.visualizations.add({
  id: "lollipop_comparison",
  label: "Lollipop Comparison",

  options: {
    title: {
      type: "string",
      label: "Title",
      default: "Revenue Comparison"
    },
    current_label: {
      type: "string",
      label: "Current Label",
      default: "Current"
    },
    comparison_label: {
      type: "string",
      label: "Comparison Label",
      default: "Comparison"
    },
    value_prefix: {
      type: "string",
      label: "Value Prefix",
      default: "€"
    },
    sort_by: {
      type: "string",
      label: "Sort By",
      default: "current"
    }
  },

  create: function(element) {
    element.innerHTML = `
      <style>
        .lc-wrap {
          width: 100%;
          min-height: 620px;
          background: #030303;
          color: white;
          font-family: Inter, Arial, sans-serif;
          padding: 34px 42px;
          box-sizing: border-box;
          overflow: auto;
        }

        .lc-title {
          font-size: 30px;
          font-weight: 900;
          margin-bottom: 10px;
        }

        .lc-legend {
          display: flex;
          gap: 22px;
          margin-bottom: 28px;
          font-size: 12px;
          color: rgba(255,255,255,0.8);
        }

        .lc-legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .lc-dot-small {
          width: 11px;
          height: 11px;
          border-radius: 50%;
        }

        .lc-chart {
          position: relative;
          width: 100%;
        }

        .lc-row {
          display: grid;
          grid-template-columns: 160px 1fr 110px;
          align-items: center;
          height: 34px;
          gap: 14px;
        }

        .lc-label {
          font-size: 12px;
          font-weight: 700;
          color: rgba(255,255,255,0.86);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .lc-track {
          position: relative;
          height: 24px;
        }

        .lc-line {
          position: absolute;
          top: 50%;
          height: 1px;
          background: rgba(255,255,255,0.42);
          transform: translateY(-50%);
        }

        .lc-dot {
          position: absolute;
          top: 50%;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 10px currentColor;
        }

        .lc-value {
          font-size: 11px;
          font-weight: 700;
          text-align: right;
          color: rgba(255,255,255,0.82);
        }

        .lc-axis {
          margin-left: 174px;
          margin-right: 124px;
          height: 24px;
          position: relative;
          border-top: 1px solid rgba(255,255,255,0.22);
          margin-top: 12px;
        }

        .lc-axis-label {
          position: absolute;
          top: 7px;
          transform: translateX(-50%);
          font-size: 10px;
          color: rgba(255,255,255,0.55);
        }

        .lc-empty {
          padding: 30px;
          color: white;
        }
      </style>

      <div class="lc-wrap">
        <div class="lc-title"></div>
        <div class="lc-legend"></div>
        <div class="lc-chart"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const titleEl = element.querySelector(".lc-title");
    const legendEl = element.querySelector(".lc-legend");
    const chartEl = element.querySelector(".lc-chart");

    titleEl.innerText = config.title || "Revenue Comparison";

    const dimensions = queryResponse.fields.dimension_like || [];
    const measures = queryResponse.fields.measure_like || [];

    if (!data || data.length === 0 || dimensions.length < 1 || measures.length < 2) {
      chartEl.innerHTML = `
        <div class="lc-empty">
          Add 1 dimension and 2 measures:<br>
          Category, Current Period, Comparison Period
        </div>
      `;
      done();
      return;
    }

    const categoryField = dimensions[0].name;
    const currentField = measures[0].name;
    const comparisonField = measures[1].name;

    const currentColor = "#36a9d6";
    const comparisonColor = "#ff9f2f";

    legendEl.innerHTML = `
      <div class="lc-legend-item">
        <span class="lc-dot-small" style="background:${currentColor};"></span>
        ${config.current_label || "Current"}
      </div>
      <div class="lc-legend-item">
        <span class="lc-dot-small" style="background:${comparisonColor};"></span>
        ${config.comparison_label || "Comparison"}
      </div>
    `;

    let rows = data.map(row => {
      const category = row[categoryField]?.value || "-";
      const current = Number(row[currentField]?.value || 0);
      const comparison = Number(row[comparisonField]?.value || 0);

      return { category, current, comparison };
    });

    if ((config.sort_by || "current") === "comparison") {
      rows.sort((a, b) => b.comparison - a.comparison);
    } else if ((config.sort_by || "current") === "difference") {
      rows.sort((a, b) => Math.abs(b.current - b.comparison) - Math.abs(a.current - a.comparison));
    } else {
      rows.sort((a, b) => b.current - a.current);
    }

    const allValues = rows.flatMap(r => [r.current, r.comparison]);
    const minValue = Math.min(...allValues, 0);
    const maxValue = Math.max(...allValues, 1);
    const range = maxValue - minValue || 1;

    const scale = value => ((value - minValue) / range) * 100;

    const formatValue = value => {
      const prefix = config.value_prefix || "€";

      if (Math.abs(value) >= 1000000) {
        return prefix + (value / 1000000).toFixed(1) + "M";
      }

      if (Math.abs(value) >= 1000) {
        return prefix + (value / 1000).toFixed(0) + "K";
      }

      return prefix + Number(value).toLocaleString(undefined, {
        maximumFractionDigits: 0
      });
    };

    let html = "";

    rows.forEach(row => {
      const currentX = scale(row.current);
      const comparisonX = scale(row.comparison);

      const left = Math.min(currentX, comparisonX);
      const width = Math.abs(currentX - comparisonX);

      const diff = row.current - row.comparison;
      const diffText = diff >= 0 ? "+" + formatValue(diff) : formatValue(diff);

      html += `
        <div class="lc-row">
          <div class="lc-label">${row.category}</div>

          <div class="lc-track">
            <div class="lc-line" style="left:${left}%; width:${width}%;"></div>

            <div
              class="lc-dot"
              title="${config.current_label}: ${formatValue(row.current)}"
              style="left:${currentX}%; background:${currentColor}; color:${currentColor};">
            </div>

            <div
              class="lc-dot"
              title="${config.comparison_label}: ${formatValue(row.comparison)}"
              style="left:${comparisonX}%; background:${comparisonColor}; color:${comparisonColor};">
            </div>
          </div>

          <div class="lc-value">${diffText}</div>
        </div>
      `;
    });

    html += `
      <div class="lc-axis">
        <div class="lc-axis-label" style="left:0%;">${formatValue(minValue)}</div>
        <div class="lc-axis-label" style="left:50%;">${formatValue((minValue + maxValue) / 2)}</div>
        <div class="lc-axis-label" style="left:100%;">${formatValue(maxValue)}</div>
      </div>
    `;

    chartEl.innerHTML = html;

    done();
  }
});
