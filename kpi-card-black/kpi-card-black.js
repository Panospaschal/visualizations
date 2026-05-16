looker.plugins.visualizations.add({
  id: "panos_kpi_card_black",
  label: "Revenue Tales KPI Card - Black",

  has_totals: true,

  options: {
    kpi_title: {
      type: "string",
      label: "Τίτλος Κάρτας",
      default: "KPI"
    },

    value_format: {
      type: "string",
      label: "Format: auto / euro / percent / number",
      default: "auto"
    },

    comparison_1_label: {
      type: "string",
      label: "Comparison 1 Label",
      default: "vs Last Year"
    },

    comparison_2_label: {
      type: "string",
      label: "Comparison 2 Label",
      default: "vs Previous"
    }
  },

  create: function(element) {
    element.innerHTML = `
      <style>
        .rt-kpi-wrap {
          width: 100%;
          height: 100%;
          min-height: 0;
          background: #030303;
          color: white;
          font-family: Inter, Arial, sans-serif;
          padding: clamp(12px, 2vw, 28px);
          box-sizing: border-box;
          overflow: hidden;
          border-radius: 0;
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .rt-kpi-wrap::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at top right, rgba(54,169,214,0.18), transparent 35%),
            radial-gradient(circle at bottom left, rgba(255,159,47,0.12), transparent 38%);
          pointer-events: none;
        }

        .rt-kpi-content {
          position: relative;
          z-index: 2;
          width: 100%;
        }

        .rt-kpi-header {
          font-size: clamp(10px, 1.1vw, 13px);
          font-weight: 800;
          color: rgba(255,255,255,0.62);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: clamp(8px, 1vw, 12px);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .rt-kpi-main-value {
          font-size: clamp(28px, 6vw, 58px);
          line-height: 0.95;
          font-weight: 950;
          color: white;
          letter-spacing: -0.05em;
          margin-bottom: clamp(14px, 2vw, 24px);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .rt-comparisons {
          display: flex;
          flex-direction: column;
          gap: clamp(7px, 1vw, 10px);
        }

        .rt-comparison-row {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 0;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .rt-comparison-row:hover {
          transform: translateX(3px);
        }

        .rt-comparison-row.muted {
          opacity: 0.25;
        }

        .rt-badge {
          padding: 5px 9px;
          border-radius: 999px;
          font-weight: 900;
          font-size: clamp(10px, 1vw, 12px);
          min-width: 54px;
          text-align: center;
          flex-shrink: 0;
        }

        .rt-positive {
          background: rgba(116,209,124,0.18);
          color: #74d17c;
          box-shadow: 0 0 14px rgba(116,209,124,0.12);
        }

        .rt-negative {
          background: rgba(239,61,47,0.18);
          color: #ef3d2f;
          box-shadow: 0 0 14px rgba(239,61,47,0.12);
        }

        .rt-neutral {
          background: rgba(255,255,255,0.10);
          color: rgba(255,255,255,0.65);
        }

        .rt-comparison-text {
          font-size: clamp(10px, 1.1vw, 13px);
          font-weight: 700;
          color: rgba(255,255,255,0.78);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .rt-subtext {
          font-size: clamp(8px, 0.9vw, 10px);
          color: rgba(255,255,255,0.42);
          font-weight: 600;
        }

        .rt-error {
          color: white;
          font-size: 12px;
          padding: 14px;
          border-radius: 12px;
          background: rgba(239,61,47,0.16);
          border: 1px solid rgba(239,61,47,0.35);
        }
      </style>

      <div class="rt-kpi-wrap">
        <div class="rt-kpi-content">
          <div class="rt-kpi-header" id="rt-kpi-title">...</div>
          <div class="rt-kpi-main-value" id="rt-kpi-value">...</div>

          <div class="rt-comparisons">
            <div class="rt-comparison-row" id="rt-comp-row-1">
              <span class="rt-badge rt-neutral" id="rt-badge-1">...</span>
              <span class="rt-comparison-text" id="rt-text-1"></span>
            </div>

            <div class="rt-comparison-row" id="rt-comp-row-2">
              <span class="rt-badge rt-neutral" id="rt-badge-2">...</span>
              <span class="rt-comparison-text" id="rt-text-2"></span>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const container = element.querySelector(".rt-kpi-content");

    const dimensions = queryResponse.fields.dimension_like || [];
    const measures = queryResponse.fields.measure_like || [];

    if (!data || data.length === 0 || measures.length === 0) {
      container.innerHTML = `<div class="rt-error">Λείπουν δεδομένα ή measures.</div>`;
      done();
      return;
    }

    const titleEl = element.querySelector("#rt-kpi-title");
    const valueEl = element.querySelector("#rt-kpi-value");

    const badge1 = element.querySelector("#rt-badge-1");
    const badge2 = element.querySelector("#rt-badge-2");
    const text1 = element.querySelector("#rt-text-1");
    const text2 = element.querySelector("#rt-text-2");

    const row1 = element.querySelector("#rt-comp-row-1");
    const row2 = element.querySelector("#rt-comp-row-2");

    titleEl.innerText = config.kpi_title || "KPI";

    const formatChoice = config.value_format || "auto";

    function cleanRendered(str) {
      if (!str) return null;
      return String(str).replace(/(<([^>]+)>)/gi, "");
    }

    function formatVal(val, renderedStr) {
      if (formatChoice === "auto" && renderedStr) {
        return cleanRendered(renderedStr);
      }

      let num = Number(val || 0);

      if (formatChoice === "percent") {
        if (Math.abs(num) <= 1.2) num = num * 100;
        return num.toFixed(1).replace(".", ",") + "%";
      }

      if (formatChoice === "number") {
        return num.toLocaleString("el-GR", {
          maximumFractionDigits: Number.isInteger(num) ? 0 : 2
        });
      }

      if (formatChoice === "euro") {
        return "€" + num.toLocaleString("el-GR", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        });
      }

      if (Math.abs(num) >= 1000000) {
        return "€" + (num / 1000000).toFixed(1).replace(".", ",") + "M";
      }

      if (Math.abs(num) >= 1000) {
        return "€" + (num / 1000).toFixed(0) + "K";
      }

      return num.toLocaleString("el-GR", {
        maximumFractionDigits: 2
      });
    }

    function pctBadge(current, base) {
      if (!base || base === 0) {
        return {
          text: "-",
          className: "rt-badge rt-neutral",
          diff: 0,
          pct: null
        };
      }

      const diff = current - base;
      const pct = (diff / base) * 100;

      return {
        text: (pct > 0 ? "+" : "") + pct.toFixed(1).replace(".", ",") + "%",
        className: "rt-badge " + (diff >= 0 ? "rt-positive" : "rt-negative"),
        diff,
        pct
      };
    }

    function setComparison(badgeEl, textEl, badgeData, label, current, base, currentRendered, baseRendered) {
      badgeEl.innerHTML = badgeData.text;
      badgeEl.className = badgeData.className;

      textEl.innerHTML = `
        ${label}
        <span class="rt-subtext">
          (${formatVal(current, currentRendered)} vs ${formatVal(base, baseRendered)})
        </span>
      `;
    }

    // MODE 1:
    // 1 measure + rows as periods:
    // row 0 = current, row 1 = previous, row 2 = last year
    if (measures.length === 1 && data.length >= 2 && dimensions.length >= 1) {
      const dimName = dimensions[0].name;
      const measureName = measures[0].name;

      const valCurrent = Number(data[0]?.[measureName]?.value || 0);
      const valPrev = Number(data[1]?.[measureName]?.value || 0);
      const valLY = Number(data[2]?.[measureName]?.value || 0);

      const namePrev = data[1]
        ? String(data[1][dimName]?.value || "Previous").replace(/^[0-9]+\\.\\s*/, "")
        : "Previous";

      const nameLY = data[2]
        ? String(data[2][dimName]?.value || "Last Year").replace(/^[0-9]+\\.\\s*/, "")
        : "Last Year";

      const currentRendered = data[0]?.[measureName]?.rendered || null;
      const prevRendered = data[1]?.[measureName]?.rendered || null;
      const lyRendered = data[2]?.[measureName]?.rendered || null;

      valueEl.innerHTML = formatVal(valCurrent, currentRendered);

      const comp1 = pctBadge(valCurrent, valLY);
      setComparison(
        badge1,
        text1,
        comp1,
        config.comparison_1_label || `vs ${nameLY}`,
        valCurrent,
        valLY,
        currentRendered,
        lyRendered
      );

      const comp2 = pctBadge(valCurrent, valPrev);
      setComparison(
        badge2,
        text2,
        comp2,
        config.comparison_2_label || `vs ${namePrev}`,
        valCurrent,
        valPrev,
        currentRendered,
        prevRendered
      );
    }

    // MODE 2:
    // 2+ measures:
    // measure 1 = current, measure 2 = comparison
    else if (measures.length >= 2) {
      const currentMeasure = measures[0].name;
      const comparisonMeasure = measures[1].name;

      let currentTotal = 0;
      let comparisonTotal = 0;

      let currentRendered = null;
      let comparisonRendered = null;

      if (queryResponse.totals_data) {
        currentTotal = Number(queryResponse.totals_data[currentMeasure]?.value || 0);
        comparisonTotal = Number(queryResponse.totals_data[comparisonMeasure]?.value || 0);
        currentRendered = queryResponse.totals_data[currentMeasure]?.rendered || null;
        comparisonRendered = queryResponse.totals_data[comparisonMeasure]?.rendered || null;
      } else {
        data.forEach(row => {
          currentTotal += Number(row[currentMeasure]?.value || 0);
          comparisonTotal += Number(row[comparisonMeasure]?.value || 0);
        });
      }

      valueEl.innerHTML = formatVal(currentTotal, currentRendered);

      const comp1 = pctBadge(currentTotal, comparisonTotal);

      setComparison(
        badge1,
        text1,
        comp1,
        config.comparison_1_label || "vs Last Year YTD",
        currentTotal,
        comparisonTotal,
        currentRendered,
        comparisonRendered
      );

      // Optional Month-over-Month from first measure, if dimension exists
      if (dimensions.length >= 1 && data.length >= 2) {
        const dimName = dimensions[0].name;
        const labels = [];
        const values = [];

        data.forEach(row => {
          const value = Number(row[currentMeasure]?.value || 0);
          const label = cleanRendered(row[dimName]?.rendered) || row[dimName]?.value || "";
          labels.push(String(label).substring(0, 3));
          values.push(value);
        });

        const currentMonth =
          ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][new Date().getMonth()];

        const idx = labels.indexOf(currentMonth);
        const currentMonthValue = idx !== -1 ? values[idx] : values[values.length - 1];
        const previousMonthValue = idx > 0 ? values[idx - 1] : values[values.length - 2];

        const comp2 = pctBadge(currentMonthValue, previousMonthValue);

        setComparison(
          badge2,
          text2,
          comp2,
          config.comparison_2_label || "vs Last Month",
          currentMonthValue,
          previousMonthValue,
          null,
          null
        );
      } else {
        badge2.innerHTML = "-";
        badge2.className = "rt-badge rt-neutral";
        text2.innerHTML = config.comparison_2_label || "vs Previous";
      }
    }

    else {
      container.innerHTML = `<div class="rt-error">Unsupported query shape.</div>`;
    }

    [row1, row2].forEach(row => {
      row.addEventListener("click", () => {
        const isMuted = row.classList.contains("muted");

        row1.classList.remove("muted");
        row2.classList.remove("muted");

        if (!isMuted) {
          if (row === row1) row2.classList.add("muted");
          if (row === row2) row1.classList.add("muted");
        }
      });
    });

    done();
  }
});
