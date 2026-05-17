looker.plugins.visualizations.add({
  id: "forecast_gap_analysis",
  label: "Forecast Gap Analysis",

  options: {
    title: {
      type: "string",
      label: "Title",
      default: "Forecast Gap Analysis"
    },
    subtitle: {
      type: "string",
      label: "Subtitle",
      default: "Monthly forecast gap intelligence and pickup requirements"
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
        .fga-wrap {
          width: 100%;
          height: 100%;
          min-height: 0;
          background:
            radial-gradient(circle at top right, rgba(54,169,214,0.18), transparent 34%),
            radial-gradient(circle at bottom left, rgba(185,148,255,0.16), transparent 38%),
            #030303;
          color: white;
          font-family: Inter, Arial, sans-serif;
          padding: clamp(10px,1.8vw,28px);
          box-sizing: border-box;
          overflow: hidden;
          position: relative;
        }

        .fga-wrap::before {
          content: "";
          position: absolute;
          inset: clamp(8px,1.2vw,18px);
          border-radius: 22px;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow:
            0 0 34px rgba(54,169,214,0.08),
            inset 0 0 24px rgba(255,255,255,0.018);
          pointer-events: none;
        }

        .fga-header {
          position: relative;
          z-index: 2;
        }

        .fga-title {
          font-size: clamp(16px,2.5vw,30px);
          font-weight: 950;
          margin-bottom: 6px;
          letter-spacing: -0.03em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .fga-subtitle {
          font-size: clamp(10px,1vw,12px);
          color: rgba(255,255,255,0.55);
          margin-bottom: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .fga-table-wrap {
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

        .fga-scroll {
          width: 100%;
          height: 100%;
          overflow: auto;
        }

        .fga-scroll::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        .fga-scroll::-webkit-scrollbar-thumb {
          background: rgba(54,169,214,0.35);
          border-radius: 999px;
        }

        .fga-table {
          width: 100%;
          min-width: 1450px;
          border-collapse: collapse;
          table-layout: auto;
        }

        .fga-table thead {
          position: sticky;
          top: 0;
          z-index: 3;
          background: rgba(3,3,3,0.96);
          backdrop-filter: blur(14px);
        }

        .fga-table th {
          text-align: right;
          padding: 10px 12px;
          font-size: 10px;
          font-weight: 900;
          color: rgba(255,255,255,0.48);
          text-transform: uppercase;
          letter-spacing: 0.07em;
          border-bottom: 1px solid rgba(255,255,255,0.10);
          white-space: normal;
          overflow: visible;
          line-height: 1.25;
          cursor: pointer;
          user-select: none;
          vertical-align: bottom;
          min-width: 105px;
        }

        .fga-table th:first-child,
        .fga-table td:first-child {
          text-align: left;
          min-width: 90px;
        }

        .fga-table td {
          text-align: right;
          padding: 10px 12px;
          font-size: 12px;
          font-weight: 800;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          white-space: nowrap;
        }

        .fga-table tbody tr {
          transition: background .2s ease, filter .2s ease;
        }

        .fga-table tbody tr:hover {
          background: rgba(255,255,255,0.065);
          filter: brightness(1.08);
        }

        .fga-month {
          color: rgba(255,255,255,0.92);
          font-weight: 950;
        }

        .fga-current {
          color: #7bc8e6;
          text-shadow: 0 0 12px rgba(123,200,230,0.16);
        }

        .fga-forecast {
          color: #e95fb8;
          text-shadow: 0 0 15px rgba(233,95,184,0.28);
          font-weight: 950;
        }

        .fga-adr {
          color: #74d17c;
          text-shadow: 0 0 12px rgba(116,209,124,0.16);
        }

        .fga-neutral {
          color: rgba(255,255,255,0.82);
        }

        .fga-soft {
          color: rgba(123,200,230,0.56);
        }

        .fga-positive {
          color: #74d17c;
          text-shadow: 0 0 12px rgba(116,209,124,0.16);
        }

        .fga-negative {
          color: #ef3d2f;
          text-shadow: 0 0 12px rgba(239,61,47,0.16);
        }

        .fga-warning {
          color: #f6c85f;
          text-shadow: 0 0 12px rgba(246,200,95,0.16);
        }

        .fga-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 62px;
          padding: 4px 8px;
          border-radius: 999px;
          font-weight: 950;
          border: 1px solid rgba(255,255,255,0.10);
        }

        .fga-occ-low {
          color: #ef3d2f;
          background: rgba(239,61,47,0.12);
        }

        .fga-occ-mid {
          color: #f6c85f;
          background: rgba(246,200,95,0.12);
        }

        .fga-occ-high {
          color: #74d17c;
          background: rgba(116,209,124,0.12);
        }

        .fga-gap-good {
          color: #74d17c;
          background: rgba(116,209,124,0.10);
        }

        .fga-gap-risk {
          color: #f6c85f;
          background: rgba(246,200,95,0.10);
        }

        .fga-gap-critical {
          color: #ef3d2f;
          background: rgba(239,61,47,0.12);
        }

        .fga-best {
          background:
            linear-gradient(90deg, rgba(233,95,184,0.12), rgba(54,169,214,0.07), transparent);
          animation: fgaPulse 3.4s ease-in-out infinite;
        }

        .fga-total {
          background:
            linear-gradient(90deg, rgba(54,169,214,0.12), rgba(233,95,184,0.10), transparent);
          border-top: 1px solid rgba(255,255,255,0.16);
        }

        .fga-weak {
          box-shadow: inset 3px 0 0 rgba(239,61,47,0.75);
        }

        .fga-compression {
          box-shadow: inset 3px 0 0 rgba(116,209,124,0.75);
        }

        @keyframes fgaPulse {
          0%,100% { box-shadow: inset 3px 0 0 rgba(233,95,184,0.35); }
          50% { box-shadow: inset 3px 0 0 rgba(233,95,184,0.85); }
        }

        .fga-empty {
          color: white;
          padding: 18px;
          font-size: 12px;
          line-height: 1.55;
        }
      </style>

      <div class="fga-wrap">
        <div class="fga-header">
          <div class="fga-title"></div>
          <div class="fga-subtitle"></div>
        </div>
        <div class="fga-table-wrap"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const titleEl = element.querySelector(".fga-title");
    const subtitleEl = element.querySelector(".fga-subtitle");
    const tableWrapEl = element.querySelector(".fga-table-wrap");

    titleEl.innerText = config.title || "Forecast Gap Analysis";
    subtitleEl.innerText = config.subtitle || "Monthly forecast gap intelligence and pickup requirements";

    const dimensions = queryResponse.fields.dimension_like || [];
    const measures = queryResponse.fields.measure_like || [];

    function normalizeText(value) {
      return String(value || "")
        .toLowerCase()
        .replace(/[_\\-]+/g, " ")
        .replace(/\\s+/g, " ")
        .trim();
    }

    function findField(fields, keywords) {
      return fields.find(field => {
        const haystack = `
          ${normalizeText(field.name)}
          ${normalizeText(field.label)}
          ${normalizeText(field.label_short)}
          ${normalizeText(field.view_label)}
        `;

        return keywords.some(keyword =>
          haystack.includes(normalizeText(keyword))
        );
      });
    }

    const currentOtbRevenueField = findField(measures, [
      "current otb revenue",
      "otb room revenue selected year",
      "otb revenue selected year",
      "room revenue selected year"
    ])?.name;

    const forecastRevenueField = findField(measures, [
      "forecast revenue",
      "forecast projection",
      "projected revenue"
    ])?.name;

    const revenueGapField = findField(measures, [
      "revenue gap",
      "forecast gap",
      "remaining revenue",
      "pickup revenue needed"
    ])?.name;

    const forecastPctField = findField(measures, [
      "forecast vs ly",
      "forecast variance",
      "vs ly %",
      "forecast %"
    ])?.name;

    const currentOtbRnField = findField(measures, [
      "current otb room nights",
      "otb room nights selected year",
      "otb room nights"
    ])?.name;

    const forecastRnField = findField(measures, [
      "forecast room nights",
      "projected room nights",
      "forecast rn"
    ])?.name;

    const remainingRnField = findField(measures, [
      "remaining room nights needed",
      "remaining room nights",
      "expected additional room nights",
      "additional room nights"
    ])?.name;

    const currentOtbOccField = findField(measures, [
      "current otb occupancy",
      "otb occupancy selected year",
      "otb occupancy"
    ])?.name;

    const forecastOccField = findField(measures, [
      "forecast occupancy",
      "forecast occ"
    ])?.name;

    const remainingOccField = findField(measures, [
      "remaining occupancy needed",
      "remaining occupancy",
      "occupancy needed"
    ])?.name;

    const currentOtbAdrField = findField(measures, [
      "current otb adr",
      "otb adr selected year",
      "otb adr"
    ])?.name;

    const expectedAdditionalAdrField = findField(measures, [
      "expected additional adr",
      "additional adr"
    ])?.name;

    if (
      !data || data.length === 0 ||
      dimensions.length < 1 ||
      !currentOtbRevenueField ||
      !forecastRevenueField ||
      !forecastPctField ||
      !currentOtbRnField ||
      !forecastRnField ||
      !remainingRnField ||
      !currentOtbOccField ||
      !forecastOccField ||
      !remainingOccField ||
      !currentOtbAdrField ||
      !expectedAdditionalAdrField
    ) {
      tableWrapEl.innerHTML = `
        <div class="fga-empty">
          Missing required fields.<br><br>
          Required fields can be in any order:<br><br>
          • Month<br>
          • Current OTB Revenue<br>
          • Forecast Revenue<br>
          • Revenue Gap € <em>(optional: if missing it will be calculated)</em><br>
          • Forecast vs LY %<br>
          • Current OTB Room Nights<br>
          • Forecast Room Nights<br>
          • Remaining Room Nights Needed<br>
          • Current OTB Occupancy<br>
          • Forecast Occupancy<br>
          • Remaining Occupancy Needed<br>
          • Current OTB ADR<br>
          • Expected Additional ADR
        </div>
      `;
      done();
      return;
    }

    const monthField = dimensions[0].name;
    const prefix = config.value_prefix || "€";

    function clean(v) {
      return String(v || "")
        .replace(/(<([^>]+)>)/gi, "")
        .trim();
    }

    function monthRank(v) {
      const m = clean(v).toLowerCase();

      const map = {
        jan: 1, january: 1,
        feb: 2, february: 2,
        mar: 3, march: 3,
        apr: 4, april: 4,
        may: 5,
        jun: 6, june: 6,
        jul: 7, july: 7,
        aug: 8, august: 8,
        sep: 9, september: 9,
        oct: 10, october: 10,
        nov: 11, november: 11,
        dec: 12, december: 12
      };

      if (map[m]) return map[m];

      const match = m.match(/(\\d{4})[-/](\\d{1,2})/);
      if (match) return Number(match[2]);

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

      return sign + prefix + abs.toLocaleString(undefined, { maximumFractionDigits: 0 });
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
      if (Math.abs(num) <= 1.2) num *= 100;
      return num;
    }

    function formatPct(v, rendered, arrow) {
      const num = pctNumber(v);

      if (rendered && !arrow) return clean(rendered);

      const icon = arrow
        ? num > 0 ? "▲ " : num < 0 ? "▼ " : "• "
        : "";

      if (rendered && arrow) {
        return icon + clean(rendered).replace(/^[-+▲▼• ]+/, "");
      }

      return icon + Math.abs(num).toFixed(1) + "%";
    }

    function varianceClass(v) {
      return Number(v || 0) >= 0 ? "fga-positive" : "fga-negative";
    }

    function gapClass(v) {
      const val = Number(v || 0);

      if (val <= 0) return "fga-gap-good";
      if (val > 0) return "fga-gap-critical";
      return "fga-gap-risk";
    }

    function occClass(v) {
      const occ = pctNumber(v);

      if (occ >= 85) return "fga-occ-high";
      if (occ >= 65) return "fga-occ-mid";
      return "fga-occ-low";
    }

    function remainingOccClass(v) {
      const occ = pctNumber(v);

      if (occ <= 0) return "fga-positive";
      if (occ <= 10) return "fga-warning";
      return "fga-negative";
    }

    function getRendered(row, fieldName) {
      return fieldName ? row[fieldName]?.rendered : null;
    }

    function getValue(row, fieldName) {
      return fieldName ? Number(row[fieldName]?.value || 0) : 0;
    }

    const rows = data.map(row => {
      const month =
        clean(row[monthField]?.rendered) ||
        clean(row[monthField]?.value) ||
        "Unknown";

      const currentOtbRevenue = getValue(row, currentOtbRevenueField);
      const forecastRevenue = getValue(row, forecastRevenueField);
      const revenueGap = revenueGapField
        ? getValue(row, revenueGapField)
        : forecastRevenue - currentOtbRevenue;

      return {
        month,
        rank: monthRank(month),

        currentOtbRevenue,
        forecastRevenue,
        revenueGap,
        forecastPct: getValue(row, forecastPctField),

        currentOtbRn: getValue(row, currentOtbRnField),
        forecastRn: getValue(row, forecastRnField),
        remainingRn: getValue(row, remainingRnField),

        currentOtbOcc: getValue(row, currentOtbOccField),
        forecastOcc: getValue(row, forecastOccField),
        remainingOcc: getValue(row, remainingOccField),

        currentOtbAdr: getValue(row, currentOtbAdrField),
        expectedAdditionalAdr: getValue(row, expectedAdditionalAdrField),

        currentOtbRevenueRendered: getRendered(row, currentOtbRevenueField),
        forecastRevenueRendered: getRendered(row, forecastRevenueField),
        revenueGapRendered: getRendered(row, revenueGapField),
        forecastPctRendered: getRendered(row, forecastPctField),

        currentOtbRnRendered: getRendered(row, currentOtbRnField),
        forecastRnRendered: getRendered(row, forecastRnField),
        remainingRnRendered: getRendered(row, remainingRnField),

        currentOtbOccRendered: getRendered(row, currentOtbOccField),
        forecastOccRendered: getRendered(row, forecastOccField),
        remainingOccRendered: getRendered(row, remainingOccField),

        currentOtbAdrRendered: getRendered(row, currentOtbAdrField),
        expectedAdditionalAdrRendered: getRendered(row, expectedAdditionalAdrField)
      };
    }).sort((a, b) => a.rank - b.rank);

    let sortKey = "rank";
    let sortDirection = 1;

    function totalsRow() {
      if (!queryResponse.totals_data) return null;

      const t = queryResponse.totals_data;

      const currentOtbRevenue = Number(t[currentOtbRevenueField]?.value || 0);
      const forecastRevenue = Number(t[forecastRevenueField]?.value || 0);
      const revenueGap = revenueGapField
        ? Number(t[revenueGapField]?.value || 0)
        : forecastRevenue - currentOtbRevenue;

      return {
        month: "TOTAL",
        currentOtbRevenue,
        forecastRevenue,
        revenueGap,
        forecastPct: Number(t[forecastPctField]?.value || 0),

        currentOtbRn: Number(t[currentOtbRnField]?.value || 0),
        forecastRn: Number(t[forecastRnField]?.value || 0),
        remainingRn: Number(t[remainingRnField]?.value || 0),

        currentOtbOcc: Number(t[currentOtbOccField]?.value || 0),
        forecastOcc: Number(t[forecastOccField]?.value || 0),
        remainingOcc: Number(t[remainingOccField]?.value || 0),

        currentOtbAdr: Number(t[currentOtbAdrField]?.value || 0),
        expectedAdditionalAdr: Number(t[expectedAdditionalAdrField]?.value || 0),

        currentOtbRevenueRendered: t[currentOtbRevenueField]?.rendered,
        forecastRevenueRendered: t[forecastRevenueField]?.rendered,
        revenueGapRendered: revenueGapField ? t[revenueGapField]?.rendered : null,
        forecastPctRendered: t[forecastPctField]?.rendered,

        currentOtbRnRendered: t[currentOtbRnField]?.rendered,
        forecastRnRendered: t[forecastRnField]?.rendered,
        remainingRnRendered: t[remainingRnField]?.rendered,

        currentOtbOccRendered: t[currentOtbOccField]?.rendered,
        forecastOccRendered: t[forecastOccField]?.rendered,
        remainingOccRendered: t[remainingOccField]?.rendered,

        currentOtbAdrRendered: t[currentOtbAdrField]?.rendered,
        expectedAdditionalAdrRendered: t[expectedAdditionalAdrField]?.rendered
      };
    }

    function renderRow(row, extraClass) {
      const isCompression = pctNumber(row.forecastOcc) >= 85;
      const isWeak = pctNumber(row.forecastOcc) < 55;

      const rowClass = [
        extraClass || "",
        isCompression ? "fga-compression" : "",
        isWeak ? "fga-weak" : ""
      ].join(" ");

      return `
        <tr class="${rowClass}">
          <td class="fga-month">${row.month}</td>

          <td class="fga-current">
            ${formatCurrency(row.currentOtbRevenue, row.currentOtbRevenueRendered)}
          </td>

          <td class="fga-forecast">
            ${formatCurrency(row.forecastRevenue, row.forecastRevenueRendered)}
          </td>

          <td>
            <span class="fga-pill ${gapClass(row.revenueGap)}">
              ${formatCurrency(row.revenueGap, row.revenueGapRendered)}
            </span>
          </td>

          <td class="${varianceClass(row.forecastPct)}">
            ${formatPct(row.forecastPct, row.forecastPctRendered, true)}
          </td>

          <td class="fga-current">
            ${formatNumber(row.currentOtbRn, row.currentOtbRnRendered)}
          </td>

          <td class="fga-forecast">
            ${formatNumber(row.forecastRn, row.forecastRnRendered)}
          </td>

          <td class="${Number(row.remainingRn || 0) > 0 ? "fga-warning" : "fga-positive"}">
            ${formatNumber(row.remainingRn, row.remainingRnRendered)}
          </td>

          <td class="fga-current">
            ${formatPct(row.currentOtbOcc, row.currentOtbOccRendered, false)}
          </td>

          <td>
            <span class="fga-pill ${occClass(row.forecastOcc)}">
              ${formatPct(row.forecastOcc, row.forecastOccRendered, false)}
            </span>
          </td>

          <td class="${remainingOccClass(row.remainingOcc)}">
            ${formatPct(row.remainingOcc, row.remainingOccRendered, false)}
          </td>

          <td class="fga-current">
            ${formatEuro(row.currentOtbAdr, row.currentOtbAdrRendered)}
          </td>

          <td class="fga-adr">
            ${formatEuro(row.expectedAdditionalAdr, row.expectedAdditionalAdrRendered)}
          </td>
        </tr>
      `;
    }

    function renderTable() {
      const sortedRows = [...rows].sort((a, b) => {
        if (sortKey === "rank") return (a.rank - b.rank) * sortDirection;

        return (
          Number(a[sortKey] || 0) -
          Number(b[sortKey] || 0)
        ) * sortDirection;
      });

      const maxForecast = Math.max(...rows.map(r => r.forecastRevenue), 0);
      const totals = totalsRow();

      tableWrapEl.innerHTML = `
        <div class="fga-scroll">
          <table class="fga-table">
            <thead>
              <tr>
                <th data-sort="rank">Month</th>
                <th data-sort="currentOtbRevenue">Current OTB Revenue</th>
                <th data-sort="forecastRevenue">Forecast Revenue</th>
                <th data-sort="revenueGap">Revenue Gap €</th>
                <th data-sort="forecastPct">Forecast vs LY %</th>
                <th data-sort="currentOtbRn">Current OTB Room Nights</th>
                <th data-sort="forecastRn">Forecast Room Nights</th>
                <th data-sort="remainingRn">Remaining Room Nights Needed</th>
                <th data-sort="currentOtbOcc">Current OTB Occupancy</th>
                <th data-sort="forecastOcc">Forecast Occupancy</th>
                <th data-sort="remainingOcc">Remaining Occupancy Needed</th>
                <th data-sort="currentOtbAdr">Current OTB ADR</th>
                <th data-sort="expectedAdditionalAdr">Expected Additional ADR</th>
              </tr>
            </thead>

            <tbody>
              ${sortedRows.map(row => {
                const best = row.forecastRevenue === maxForecast && maxForecast > 0;
                return renderRow(row, best ? "fga-best" : "");
              }).join("")}

              ${totals ? renderRow(totals, "fga-total") : ""}
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
