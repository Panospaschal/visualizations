looker.plugins.visualizations.add({
  id: "pace_stly_intelligence_matrix",
  label: "Pace vs STLY Intelligence Matrix",

  options: {
    title: {
      type: "string",
      label: "Title",
      default: "Pace vs STLY Intelligence Matrix"
    },
    subtitle: {
      type: "string",
      label: "Subtitle",
      default: "Forward-looking pacing analysis versus same time last year"
    }
  },

  create: function(element) {
    element.innerHTML = `
      <style>
        .psim-wrap {
          width: 100%;
          height: 100%;
          min-height: 0;
          background:
            radial-gradient(circle at top right, rgba(54,169,214,0.18), transparent 34%),
            radial-gradient(circle at bottom left, rgba(185,148,255,0.14), transparent 38%),
            #030303;
          color: white;
          font-family: Inter, Arial, sans-serif;
          padding: clamp(10px,1.8vw,28px);
          box-sizing: border-box;
          overflow: hidden;
          position: relative;
        }

        .psim-wrap::before {
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

        .psim-header {
          position: relative;
          z-index: 2;
        }

        .psim-title {
          font-size: clamp(16px,2.5vw,30px);
          font-weight: 950;
          margin-bottom: 6px;
          letter-spacing: -0.03em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .psim-subtitle {
          font-size: clamp(10px,1vw,12px);
          color: rgba(255,255,255,0.55);
          margin-bottom: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .psim-table-wrap {
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

        .psim-scroll {
          width: 100%;
          height: 100%;
          overflow: auto;
        }

        .psim-scroll::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        .psim-scroll::-webkit-scrollbar-thumb {
          background: rgba(54,169,214,0.35);
          border-radius: 999px;
        }

        .psim-table {
          width: 100%;
          min-width: 720px;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .psim-table thead {
          position: sticky;
          top: 0;
          z-index: 3;
          background: rgba(3,3,3,0.96);
          backdrop-filter: blur(14px);
        }

        .psim-table th {
          text-align: right;
          padding: 11px 14px;
          font-size: 10px;
          font-weight: 900;
          color: rgba(255,255,255,0.48);
          text-transform: uppercase;
          letter-spacing: 0.07em;
          border-bottom: 1px solid rgba(255,255,255,0.10);
          white-space: normal;
          line-height: 1.25;
          cursor: pointer;
          user-select: none;
          vertical-align: bottom;
        }

        .psim-table th:first-child,
        .psim-table td:first-child {
          text-align: left;
        }

        .psim-table td {
          text-align: right;
          padding: 11px 14px;
          font-size: 12px;
          font-weight: 850;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          white-space: nowrap;
        }

        .psim-table tbody tr {
          transition: background .2s ease, filter .2s ease;
        }

        .psim-table tbody tr:hover {
          background: rgba(255,255,255,0.065);
          filter: brightness(1.08);
        }

        .psim-month {
          color: rgba(255,255,255,0.92);
          font-weight: 950;
        }

        .psim-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 72px;
          padding: 5px 9px;
          border-radius: 999px;
          font-weight: 950;
          border: 1px solid rgba(255,255,255,0.11);
          box-shadow: inset 0 0 14px rgba(255,255,255,0.025);
        }

        .psim-good {
          color: #74d17c;
          background: rgba(116,209,124,0.13);
          text-shadow: 0 0 12px rgba(116,209,124,0.18);
        }

        .psim-warning {
          color: #f6c85f;
          background: rgba(246,200,95,0.13);
          text-shadow: 0 0 12px rgba(246,200,95,0.18);
        }

        .psim-risk {
          color: #ef3d2f;
          background: rgba(239,61,47,0.13);
          text-shadow: 0 0 12px rgba(239,61,47,0.18);
        }

        .psim-demand {
          color: #7bc8e6;
          background: rgba(54,169,214,0.12);
          text-shadow: 0 0 12px rgba(123,200,230,0.18);
        }

        .psim-best {
          background:
            linear-gradient(90deg, rgba(116,209,124,0.12), rgba(54,169,214,0.07), transparent);
          animation: psimPulse 3.4s ease-in-out infinite;
        }

        .psim-weak {
          box-shadow: inset 3px 0 0 rgba(239,61,47,0.75);
        }

        .psim-strong {
          box-shadow: inset 3px 0 0 rgba(116,209,124,0.75);
        }

        @keyframes psimPulse {
          0%,100% { box-shadow: inset 3px 0 0 rgba(116,209,124,0.35); }
          50% { box-shadow: inset 3px 0 0 rgba(116,209,124,0.85); }
        }

        .psim-empty {
          color: white;
          padding: 18px;
          font-size: 12px;
          line-height: 1.55;
        }
      </style>

      <div class="psim-wrap">
        <div class="psim-header">
          <div class="psim-title"></div>
          <div class="psim-subtitle"></div>
        </div>
        <div class="psim-table-wrap"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const titleEl = element.querySelector(".psim-title");
    const subtitleEl = element.querySelector(".psim-subtitle");
    const tableWrapEl = element.querySelector(".psim-table-wrap");

    titleEl.innerText = config.title || "Pace vs STLY Intelligence Matrix";
    subtitleEl.innerText = config.subtitle || "Forward-looking pacing analysis versus same time last year";

    const dimensions = queryResponse.fields.dimension_like || [];
    const measures = queryResponse.fields.measure_like || [];

    function normalizeText(value) {
      return String(value || "")
        .toLowerCase()
        .replace(/[_\\-]+/g, " ")
        .replace(/\\s+/g, " ")
        .trim();
    }

    function clean(value) {
      return String(value || "")
        .replace(/(<([^>]+)>)/gi, "")
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

    const revenuePaceField = findField(measures, [
      "revenue pace",
      "revenue pace %",
      "room revenue pace",
      "pace revenue",
      "revenue vs stly",
      "revenue stly %"
    ])?.name;

    const roomNightsPaceField = findField(measures, [
      "room nights pace",
      "room nights pace %",
      "rn pace",
      "nights pace",
      "room nights vs stly",
      "occupied room nights pace"
    ])?.name;

    const adrPaceField = findField(measures, [
      "adr pace",
      "adr pace %",
      "adr vs stly",
      "adr stly %"
    ])?.name;

    const currentOtbOccField = findField(measures, [
      "current otb occupancy",
      "otb occupancy",
      "current occupancy",
      "otb occupancy selected year"
    ])?.name;

    if (
      !data ||
      data.length === 0 ||
      dimensions.length < 1 ||
      !revenuePaceField ||
      !roomNightsPaceField ||
      !adrPaceField ||
      !currentOtbOccField
    ) {
      tableWrapEl.innerHTML = `
        <div class="psim-empty">
          Missing required fields.<br><br>
          Dimension:<br>
          • Month<br><br>
          Measures, any order:<br>
          • Revenue Pace %<br>
          • Room Nights Pace %<br>
          • ADR Pace %<br>
          • Current OTB Occupancy
        </div>
      `;
      done();
      return;
    }

    const monthField = dimensions[0].name;

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

      const match = m.match(/(\\d{4})[-/](\\d{1,2})/);
      if (match) return Number(match[2]);

      return 99;
    }

    function getValue(row, fieldName) {
      return fieldName ? Number(row[fieldName]?.value || 0) : 0;
    }

    function getRendered(row, fieldName) {
      return fieldName ? row[fieldName]?.rendered || null : null;
    }

    function pctNumber(v) {
      let num = Number(v || 0);
      if (Math.abs(num) <= 1.2) num *= 100;
      return num;
    }

    function formatPct(v, rendered, signed) {
      const num = pctNumber(v);

      if (rendered) {
        const value = clean(rendered);
        if (!signed) return value;
        const icon = num > 0 ? "▲ " : num < 0 ? "▼ " : "• ";
        return icon + value.replace(/^[-+▲▼• ]+/, "");
      }

      const icon = signed
        ? num > 0 ? "▲ " : num < 0 ? "▼ " : "• "
        : "";

      return icon + Math.abs(num).toFixed(1) + "%";
    }

    function paceClass(v) {
      const num = pctNumber(v);

      if (num >= 0) return "psim-good";
      if (num >= -7) return "psim-warning";
      return "psim-risk";
    }

    function occupancyClass(v) {
      const occ = pctNumber(v);

      if (occ >= 85) return "psim-good";
      if (occ >= 65) return "psim-demand";
      if (occ >= 50) return "psim-warning";
      return "psim-risk";
    }

    function rowStatus(row) {
      const avgPace = (
        pctNumber(row.revenuePace) +
        pctNumber(row.roomNightsPace) +
        pctNumber(row.adrPace)
      ) / 3;

      if (avgPace >= 0) return "strong";
      if (avgPace >= -7) return "watch";
      return "weak";
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

          revenuePace: getValue(row, revenuePaceField),
          roomNightsPace: getValue(row, roomNightsPaceField),
          adrPace: getValue(row, adrPaceField),
          currentOtbOcc: getValue(row, currentOtbOccField),

          revenuePaceRendered: getRendered(row, revenuePaceField),
          roomNightsPaceRendered: getRendered(row, roomNightsPaceField),
          adrPaceRendered: getRendered(row, adrPaceField),
          currentOtbOccRendered: getRendered(row, currentOtbOccField)
        };
      })
      .filter(row => row.month)
      .sort((a, b) => a.rank - b.rank);

    let sortKey = "rank";
    let sortDirection = 1;

    function renderCell(value, rendered, type) {
      const cls = type === "occupancy"
        ? occupancyClass(value)
        : paceClass(value);

      return `
        <span class="psim-pill ${cls}">
          ${formatPct(value, rendered, type !== "occupancy")}
        </span>
      `;
    }

    function renderRow(row, extraClass) {
      const status = rowStatus(row);

      const rowClass = [
        extraClass || "",
        status === "strong" ? "psim-strong" : "",
        status === "weak" ? "psim-weak" : ""
      ].join(" ");

      return `
        <tr class="${rowClass}">
          <td class="psim-month">${row.month}</td>

          <td>
            ${renderCell(row.revenuePace, row.revenuePaceRendered, "pace")}
          </td>

          <td>
            ${renderCell(row.roomNightsPace, row.roomNightsPaceRendered, "pace")}
          </td>

          <td>
            ${renderCell(row.adrPace, row.adrPaceRendered, "pace")}
          </td>

          <td>
            ${renderCell(row.currentOtbOcc, row.currentOtbOccRendered, "occupancy")}
          </td>
        </tr>
      `;
    }

    function totalsRow() {
      if (!queryResponse.totals_data) return null;

      const t = queryResponse.totals_data;

      return {
        month: "TOTAL",
        rank: 999,

        revenuePace: Number(t[revenuePaceField]?.value || 0),
        roomNightsPace: Number(t[roomNightsPaceField]?.value || 0),
        adrPace: Number(t[adrPaceField]?.value || 0),
        currentOtbOcc: Number(t[currentOtbOccField]?.value || 0),

        revenuePaceRendered: t[revenuePaceField]?.rendered || null,
        roomNightsPaceRendered: t[roomNightsPaceField]?.rendered || null,
        adrPaceRendered: t[adrPaceField]?.rendered || null,
        currentOtbOccRendered: t[currentOtbOccField]?.rendered || null
      };
    }

    function renderTable() {
      const sortedRows = [...rows].sort((a, b) => {
        if (sortKey === "rank") {
          return (a.rank - b.rank) * sortDirection;
        }

        return (
          Number(a[sortKey] || 0) -
          Number(b[sortKey] || 0)
        ) * sortDirection;
      });

      const bestRow = rows.reduce((best, row) => {
        const score =
          pctNumber(row.revenuePace) +
          pctNumber(row.roomNightsPace) +
          pctNumber(row.adrPace);

        const bestScore = best
          ? pctNumber(best.revenuePace) + pctNumber(best.roomNightsPace) + pctNumber(best.adrPace)
          : -999999;

        return score > bestScore ? row : best;
      }, null);

      const totals = totalsRow();

      tableWrapEl.innerHTML = `
        <div class="psim-scroll">
          <table class="psim-table">
            <thead>
              <tr>
                <th data-sort="rank">Month</th>
                <th data-sort="revenuePace">Revenue Pace %</th>
                <th data-sort="roomNightsPace">Room Nights Pace %</th>
                <th data-sort="adrPace">ADR Pace %</th>
                <th data-sort="currentOtbOcc">Current OTB Occupancy</th>
              </tr>
            </thead>

            <tbody>
              ${sortedRows.map(row =>
                renderRow(row, bestRow && row.month === bestRow.month ? "psim-best" : "")
              ).join("")}

              ${totals ? renderRow(totals, "psim-best") : ""}
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
