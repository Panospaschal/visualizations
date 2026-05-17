looker.plugins.visualizations.add({
  id: "monthly_forecast_outlook",
  label: "Monthly Revenue Forecast Intelligence",

  options: {
    title: {
      type: "string",
      label: "Title",
      default: "Monthly Revenue Forecast Intelligence"
    },
    subtitle: {
      type: "string",
      label: "Subtitle",
      default: "Forward-looking revenue, ADR and occupancy projection versus historical pace"
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
            radial-gradient(circle at top right, rgba(54,169,214,0.18), transparent 34%),
            radial-gradient(circle at bottom left, rgba(185,148,255,0.14), transparent 38%),
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
            0 0 34px rgba(54,169,214,0.08),
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

        .mfo-scroll {
          width: 100%;
          height: 100%;
          overflow: auto;
        }

        .mfo-scroll::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        .mfo-scroll::-webkit-scrollbar-thumb {
          background: rgba(54,169,214,0.35);
          border-radius: 999px;
        }

        .mfo-table {
          width: 100%;
          min-width: 1180px;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .mfo-table thead {
          position: sticky;
          top: 0;
          z-index: 3;
          background: rgba(3,3,3,0.96);
          backdrop-filter: blur(14px);
        }

        .mfo-table th {
          text-align: right;
          padding: 10px 12px;
          font-size: 10px;
          font-weight: 900;
          color: rgba(255,255,255,0.48);
          text-transform: uppercase;
          letter-spacing: 0.07em;
          border-bottom: 1px solid rgba(255,255,255,0.10);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          cursor: pointer;
          user-select: none;
        }

        .mfo-table th:first-child,
        .mfo-table td:first-child {
          text-align: left;
        }

        .mfo-table td {
          text-align: right;
          padding: 10px 12px;
          font-size: 12px;
          font-weight: 800;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .mfo-table tbody tr {
          transition: background 0.2s ease, filter 0.2s ease;
        }

        .mfo-table tbody tr:hover {
          background: rgba(255,255,255,0.065);
          filter: brightness(1.08);
        }

        .mfo-month {
          color: rgba(255,255,255,0.92);
          font-weight: 950;
        }

        .mfo-current {
          color: #7bc8e6;
          text-shadow: 0 0 12px rgba(123,200,230,0.16);
        }

        .mfo-stly {
          color: rgba(123,200,230,0.56);
        }

        .mfo-neutral {
          color: rgba(255,255,255,0.82);
        }

        .mfo-forecast {
          color: #e95fb8;
          text-shadow: 0 0 15px rgba(233,95,184,0.28);
          font-weight: 950;
        }

        .mfo-positive {
          color: #74d17c;
          text-shadow: 0 0 12px rgba(116,209,124,0.16);
        }

        .mfo-negative {
          color: #ef3d2f;
          text-shadow: 0 0 12px rgba(239,61,47,0.16);
        }

        .mfo-occ-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 58px;
          padding: 4px 8px;
          border-radius: 999px;
          font-weight: 950;
          border: 1px solid rgba(255,255,255,0.10);
        }

        .mfo-occ-low {
          color: #ef3d2f;
          background: rgba(239,61,47,0.12);
        }

        .mfo-occ-mid {
          color: #f6c85f;
          background: rgba(246,200,95,0.12);
        }

        .mfo-occ-high {
          color: #74d17c;
          background: rgba(116,209,124,0.12);
        }

        .mfo-best {
          background:
            linear-gradient(90deg, rgba(233,95,184,0.12), rgba(54,169,214,0.07), transparent);
          animation: mfoPulse 3.4s ease-in-out infinite;
        }

        .mfo-compression {
          box-shadow: inset 3px 0 0 rgba(116,209,124,0.75);
        }

        .mfo-weak {
          box-shadow: inset 3px 0 0 rgba(239,61,47,0.75);
        }

        @keyframes mfoPulse {
          0%, 100% { box-shadow: inset 3px 0 0 rgba(233,95,184,0.35); }
          50% { box-shadow: inset 3px 0 0 rgba(233,95,184,0.85); }
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

    titleEl.innerText = config.title || "Monthly Revenue Forecast Intelligence";
    subtitleEl.innerText = config.subtitle || "Forward-looking revenue, ADR and occupancy projection versus historical pace";

    const dimensions = queryResponse.fields.dimension_like || [];
    const measures = queryResponse.fields.measure_like || [];

    if (!data || data.length === 0 || dimensions.length < 1 || measures.length < 10) {
      tableWrapEl.innerHTML = `
        <div class="mfo-empty">
          Add 1 month dimension and 10 measures.<br><br>
          Dimension: Month<br>
          Measure 1: Current OTB Revenue<br>
          Measure 2: STLY OTB Revenue<br>
          Measure 3: Forecast Revenue<br>
          Measure 4: Forecast vs LY %<br>
          Measure 5: Available Room Nights<br>
          Measure 6: Current OTB Room Nights<br>
          Measure 7: STLY OTB Room Nights<br>
          Measure 8: Current OTB ADR<br>
          Measure 9: Expected Additional ADR<br>
          Measure 10: Forecast Occupancy
        </div>
      `;
      done();
      return;
    }

    const monthField = dimensions[0].name;

    const currentOtbRevenueField = measures[0].name;
    const stlyOtbRevenueField = measures[1].name;
    const forecastRevenueField = measures[2].name;
    const forecastPctField = measures[3].name;
    const availableRnField = measures[4].name;
    const currentOtbRnField = measures[5].name;
    const stlyOtbRnField = measures[6].name;
    const currentOtbAdrField = measures[7].name;
    const expectedAdditionalAdrField = measures[8].name;
    const forecastOccField = measures[9].name;

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

    function formatEuro(v, rendered) {
      if (rendered) return clean(rendered);

      return prefix + Number(v || 0).toLocaleString(undefined, {
        maximumFractionDigits: 0
      });
    }

    function formatNumber(v, rendered) {
      if (rendered) return clean(rendered);

      return Number(v || 0).toLocaleString(undefined, {
        maximumFractionDigits: 0
      });
    }

    function pctNumber(v) {
      let num = Number(v || 0);
      if (Math.abs(num) <= 1.2) num = num * 100;
      return num;
    }

    function formatPct(v, rendered, arrow) {
      if (rendered && !arrow) return clean(rendered);

      const num = pctNumber(v);

      if (rendered && arrow) {
        const sign = num > 0 ? "▲ " : num < 0 ? "▼ " : "• ";
        return sign + clean(rendered).replace(/^[-+▲▼• ]+/, "");
      }

      const prefixArrow = arrow
        ? num > 0 ? "▲ " : num < 0 ? "▼ " : "• "
        : "";

      return prefixArrow + Math.abs(num).toFixed(1) + "%";
    }

    function occClass(value) {
      const occ = pctNumber(value);
      if (occ >= 85) return "mfo-occ-high";
      if (occ >= 65) return "mfo-occ-mid";
      return "mfo-occ-low";
    }

    function varianceClass(value) {
      return pctNumber(value) >= 0 ? "mfo-positive" : "mfo-negative";
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

          currentOtbRevenue: Number(row[currentOtbRevenueField]?.value || 0),
          stlyOtbRevenue: Number(row[stlyOtbRevenueField]?.value || 0),
          forecastRevenue: Number(row[forecastRevenueField]?.value || 0),
          forecastPct: pctNumber(row[forecastPctField]?.value || 0),
          availableRn: Number(row[availableRnField]?.value || 0),
          currentOtbRn: Number(row[currentOtbRnField]?.value || 0),
          stlyOtbRn: Number(row[stlyOtbRnField]?.value || 0),
          currentOtbAdr: Number(row[currentOtbAdrField]?.value || 0),
          expectedAdditionalAdr: Number(row[expectedAdditionalAdrField]?.value || 0),
          forecastOcc: pctNumber(row[forecastOccField]?.value || 0),

          currentOtbRevenueRendered: row[currentOtbRevenueField]?.rendered || null,
          stlyOtbRevenueRendered: row[stlyOtbRevenueField]?.rendered || null,
          forecastRevenueRendered: row[forecastRevenueField]?.rendered || null,
          forecastPctRendered: row[forecastPctField]?.rendered || null,
          availableRnRendered: row[availableRnField]?.rendered || null,
          currentOtbRnRendered: row[currentOtbRnField]?.rendered || null,
          stlyOtbRnRendered: row[stlyOtbRnField]?.rendered || null,
          currentOtbAdrRendered: row[currentOtbAdrField]?.rendered || null,
          expectedAdditionalAdrRendered: row[expectedAdditionalAdrField]?.rendered || null,
          forecastOccRendered: row[forecastOccField]?.rendered || null
        };
      })
      .filter(row => row.month)
      .sort((a, b) => a.rank - b.rank);

    let sortKey = "rank";
    let sortDirection = 1;

    function renderTable() {
      const sortedRows = [...rows].sort((a, b) => {
        if (sortKey === "rank") return (a.rank - b.rank) * sortDirection;

        const av = a[sortKey];
        const bv = b[sortKey];

        if (typeof av === "string") return av.localeCompare(bv) * sortDirection;

        return (Number(av || 0) - Number(bv || 0)) * sortDirection;
      });

      const maxForecast = Math.max(...rows.map(r => r.forecastRevenue), 0);

      tableWrapEl.innerHTML = `
        <div class="mfo-scroll">
          <table class="mfo-table">
            <thead>
              <tr>
                <th data-sort="rank">Month</th>
                <th data-sort="currentOtbRevenue">Current OTB Rev</th>
                <th data-sort="stlyOtbRevenue">STLY OTB Rev</th>
                <th data-sort="forecastRevenue">Forecast Rev</th>
                <th data-sort="forecastPct">Forecast vs LY</th>
                <th data-sort="availableRn">Available RN</th>
                <th data-sort="currentOtbRn">Current OTB RN</th>
                <th data-sort="stlyOtbRn">STLY OTB RN</th>
                <th data-sort="currentOtbAdr">Current OTB ADR</th>
                <th data-sort="expectedAdditionalAdr">Expected Add. ADR</th>
                <th data-sort="forecastOcc">Forecast Occ.</th>
              </tr>
            </thead>

            <tbody>
              ${sortedRows.map(row => {
                const isBest = row.forecastRevenue === maxForecast && maxForecast > 0;
                const isCompression = row.forecastOcc >= 85;
                const isWeak = row.forecastOcc < 55;

                const rowClass = [
                  isBest ? "mfo-best" : "",
                  isCompression ? "mfo-compression" : "",
                  isWeak ? "mfo-weak" : ""
                ].join(" ");

                return `
                  <tr class="${rowClass}">
                    <td class="mfo-month">${row.month}</td>

                    <td class="mfo-current">
                      ${formatCurrency(row.currentOtbRevenue, row.currentOtbRevenueRendered)}
                    </td>

                    <td class="mfo-stly">
                      ${formatCurrency(row.stlyOtbRevenue, row.stlyOtbRevenueRendered)}
                    </td>

                    <td class="mfo-forecast">
                      ${formatCurrency(row.forecastRevenue, row.forecastRevenueRendered)}
                    </td>

                    <td class="${varianceClass(row.forecastPct)}">
                      ${formatPct(row.forecastPct, row.forecastPctRendered, true)}
                    </td>

                    <td class="mfo-neutral">
                      ${formatNumber(row.availableRn, row.availableRnRendered)}
                    </td>

                    <td class="mfo-current">
                      ${formatNumber(row.currentOtbRn, row.currentOtbRnRendered)}
                    </td>

                    <td class="mfo-stly">
                      ${formatNumber(row.stlyOtbRn, row.stlyOtbRnRendered)}
                    </td>

                    <td class="mfo-current">
                      ${formatEuro(row.currentOtbAdr, row.currentOtbAdrRendered)}
                    </td>

                    <td class="mfo-positive">
                      ${formatEuro(row.expectedAdditionalAdr, row.expectedAdditionalAdrRendered)}
                    </td>

                    <td>
                      <span class="mfo-occ-pill ${occClass(row.forecastOcc)}">
                        ${formatPct(row.forecastOcc, row.forecastOccRendered, false)}
                      </span>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `;

      tableWrapEl.querySelectorAll("th[data-sort]").forEach(th => {
        th.addEventListener("click", () => {
          const key = th.getAttribute("data-sort");

          if (sortKey === key) {
            sortDirection *= -1;
          } else {
            sortKey = key;
            sortDirection = key === "rank" ? 1 : -1;
          }

          renderTable();
        });
      });
    }

    renderTable();
    done();
  }
});
