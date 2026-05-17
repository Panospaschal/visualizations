looker.plugins.visualizations.add({
  id: "monthly_forecast_outlook",
  label: "Monthly Forecast Outlook",

  options: {
    title: {
      type: "string",
      label: "Title",
      default: "Monthly Forecast Outlook"
    },
    subtitle: {
      type: "string",
      label: "Subtitle",
      default: "Forward-looking revenue projection versus historical benchmarks"
    },
    value_prefix: {
      type: "string",
      label: "Currency Prefix",
      default: "€"
    }
  },

  create: function(element) {
    element.innerHTML = `
      <style>
        .mfo-wrap {
          width: 100%;
          height: 100%;
          min-height: 0;
          background:
            radial-gradient(circle at top right, rgba(54,169,214,0.17), transparent 34%),
            radial-gradient(circle at bottom left, rgba(233,95,184,0.13), transparent 38%),
            #030303;
          color: white;
          font-family: Inter, Arial, sans-serif;
          padding: clamp(10px, 1.8vw, 28px);
          box-sizing: border-box;
          overflow: hidden;
          position: relative;
        }

        .mfo-wrap::before {
          content: "";
          position: absolute;
          inset: clamp(8px, 1.2vw, 18px);
          border-radius: 22px;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow:
            0 0 30px rgba(54,169,214,0.08),
            inset 0 0 24px rgba(255,255,255,0.018);
          pointer-events: none;
        }

        .mfo-header {
          position: relative;
          z-index: 2;
        }

        .mfo-title {
          font-size: clamp(16px, 2.5vw, 30px);
          font-weight: 950;
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: -0.03em;
        }

        .mfo-subtitle {
          font-size: clamp(10px, 1vw, 12px);
          color: rgba(255,255,255,0.55);
          margin-bottom: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .mfo-table-wrap {
          position: relative;
          z-index: 2;
          width: 100%;
          height: calc(100% - 58px);
          min-height: 180px;
          overflow: hidden;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.09);
          background: rgba(255,255,255,0.028);
          box-shadow: inset 0 0 24px rgba(255,255,255,0.018);
        }

        .mfo-table {
          width: 100%;
          height: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .mfo-table thead {
          position: sticky;
          top: 0;
          z-index: 3;
          background: rgba(3,3,3,0.94);
          backdrop-filter: blur(14px);
        }

        .mfo-table th {
          text-align: right;
          padding: clamp(8px, 1vw, 14px);
          font-size: clamp(8px, 0.85vw, 11px);
          font-weight: 900;
          color: rgba(255,255,255,0.48);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          border-bottom: 1px solid rgba(255,255,255,0.10);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .mfo-table th:first-child {
          text-align: left;
        }

        .mfo-table td {
          text-align: right;
          padding: clamp(8px, 1vw, 14px);
          font-size: clamp(10px, 1vw, 13px);
          font-weight: 800;
          border-bottom: 1px solid rgba(255,255,255,0.065);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .mfo-table td:first-child {
          text-align: left;
        }

        .mfo-table tbody tr {
          transition: background 0.2s ease, transform 0.2s ease, opacity 0.2s ease;
        }

        .mfo-table tbody tr:hover {
          background: rgba(255,255,255,0.06);
        }

        .mfo-month {
          color: rgba(255,255,255,0.90);
          font-weight: 950;
        }

        .mfo-current {
          color: #7bc8e6;
          text-shadow: 0 0 12px rgba(123,200,230,0.16);
        }

        .mfo-stly {
          color: rgba(123,200,230,0.56);
        }

        .mfo-final {
          color: rgba(255,255,255,0.88);
        }

        .mfo-forecast {
          color: #e95fb8;
          text-shadow: 0 0 14px rgba(233,95,184,0.22);
        }

        .mfo-positive {
          color: #74d17c;
          text-shadow: 0 0 12px rgba(116,209,124,0.16);
        }

        .mfo-negative {
          color: #ef3d2f;
          text-shadow: 0 0 12px rgba(239,61,47,0.16);
        }

        .mfo-best {
          background:
            linear-gradient(90deg, rgba(233,95,184,0.10), rgba(54,169,214,0.07), transparent);
          animation: mfoPulse 3.4s ease-in-out infinite;
        }

        @keyframes mfoPulse {
          0%, 100% {
            box-shadow: inset 3px 0 0 rgba(233,95,184,0.35);
          }
          50% {
            box-shadow: inset 3px 0 0 rgba(233,95,184,0.85);
          }
        }

        .mfo-empty {
          color: white;
          padding: 18px;
          font-size: 12px;
        }
      </style>

      <div class="mfo-wrap">
        <div class="mfo-header">
          <div class="mfo-title"></div>
          <div class="mfo-subtitle"></div>
        </div>
        <div class="mfo-table-wrap"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const titleEl = element.querySelector(".mfo-title");
    const subtitleEl = element.querySelector(".mfo-subtitle");
    const tableWrapEl = element.querySelector(".mfo-table-wrap");

    titleEl.innerText = config.title || "Monthly Forecast Outlook";
    subtitleEl.innerText = config.subtitle || "Forward-looking revenue projection versus historical benchmarks";

    const dimensions = queryResponse.fields.dimension_like || [];
    const measures = queryResponse.fields.measure_like || [];

    if (!data || data.length === 0 || dimensions.length < 1 || measures.length < 5) {
      tableWrapEl.innerHTML = `
        <div class="mfo-empty">
          Add 1 month dimension and 5 measures.<br><br>
          Dimension: Month<br>
          Measure 1: Current Year OTB<br>
          Measure 2: STLY OTB<br>
          Measure 3: Final LY Actual<br>
          Measure 4: Forecast Projection<br>
          Measure 5: Forecast vs LY %
        </div>
      `;
      done();
      return;
    }

    const monthField = dimensions[0].name;
    const currentField = measures[0].name;
    const stlyField = measures[1].name;
    const finalField = measures[2].name;
    const forecastField = measures[3].name;
    const forecastPctField = measures[4].name;

    const prefix = config.value_prefix || "€";

    function clean(value) {
      return String(value || "")
        .replace(/(<([^>]+)>)/gi, "")
        .trim();
    }

    function monthRank(value) {
      const m = clean(value).toLowerCase();

      const map = {
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

      if (map[m]) return map[m];

      const num = Number(m);
      if (num >= 1 && num <= 12) return num;

      return 99;
    }

    function formatCurrency(v, rendered) {
      if (rendered) return clean(rendered);

      const abs = Math.abs(Number(v || 0));
      const sign = v < 0 ? "-" : "";

      if (abs >= 1000000) return sign + prefix + (abs / 1000000).toFixed(1) + "M";
      if (abs >= 1000) return sign + prefix + (abs / 1000).toFixed(0) + "K";

      return sign + prefix + abs.toLocaleString(undefined, {
        maximumFractionDigits: 0
      });
    }

    function formatPct(v, rendered) {
      if (rendered) return clean(rendered);

      let num = Number(v || 0);
      if (Math.abs(num) <= 1.2) num = num * 100;

      return (num > 0 ? "▲ " : num < 0 ? "▼ " : "• ") +
        Math.abs(num).toFixed(1) +
        "%";
    }

    function pctNumber(v) {
      let num = Number(v || 0);
      if (Math.abs(num) <= 1.2) num = num * 100;
      return num;
    }

    const rows = data
      .map(row => {
        const month =
          clean(row[monthField]?.rendered) ||
          clean(row[monthField]?.value) ||
          "Unknown";

        return {
          month,
          rank: monthRank(month),
          current: Number(row[currentField]?.value || 0),
          stly: Number(row[stlyField]?.value || 0),
          finalLy: Number(row[finalField]?.value || 0),
          forecast: Number(row[forecastField]?.value || 0),
          forecastPct: pctNumber(row[forecastPctField]?.value || 0),
          currentRendered: row[currentField]?.rendered || null,
          stlyRendered: row[stlyField]?.rendered || null,
          finalRendered: row[finalField]?.rendered || null,
          forecastRendered: row[forecastField]?.rendered || null,
          forecastPctRendered: row[forecastPctField]?.rendered || null
        };
      })
      .filter(row => row.month)
      .sort((a, b) => a.rank - b.rank);

    const maxForecast = Math.max(...rows.map(r => r.forecast), 0);

    tableWrapEl.innerHTML = `
      <table class="mfo-table">
        <thead>
          <tr>
            <th>Month</th>
            <th>Current OTB</th>
            <th>STLY OTB</th>
            <th>Final LY Actual</th>
            <th>Forecast</th>
            <th>Forecast vs LY</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => {
            const isPositive = row.forecastPct >= 0;
            const isBest = row.forecast === maxForecast && maxForecast > 0;

            return `
              <tr class="${isBest ? "mfo-best" : ""}">
                <td class="mfo-month">${row.month}</td>
                <td class="mfo-current">${formatCurrency(row.current, row.currentRendered)}</td>
                <td class="mfo-stly">${formatCurrency(row.stly, row.stlyRendered)}</td>
                <td class="mfo-final">${formatCurrency(row.finalLy, row.finalRendered)}</td>
                <td class="mfo-forecast">${formatCurrency(row.forecast, row.forecastRendered)}</td>
                <td class="${isPositive ? "mfo-positive" : "mfo-negative"}">
                  ${formatPct(row.forecastPct, row.forecastPctRendered)}
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;

    done();
  }
});
