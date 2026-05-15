looker.plugins.visualizations.add({
  id: "data_profiler",
  label: "Hotel Performance Table",

  create: function(element) {
    element.innerHTML = `
      <style>
        .rt-table-wrapper {
          font-family: Inter, Arial, sans-serif;
          width: 100%;
          overflow-x: auto;
        }

        .rt-table {
          width: 100%;
          border-collapse: collapse;
        }

        .rt-table th {
          text-align: left;
          padding: 14px;
          background: #f7f7f7;
          border-bottom: 2px solid #ddd;
          font-size: 13px;
          font-weight: 700;
          color: #111;
        }

        .rt-table td {
          padding: 14px;
          border-bottom: 1px solid #eee;
          font-size: 13px;
          color: #222;
          vertical-align: middle;
        }

        .rt-month {
          font-weight: 700;
        }

        .rt-value {
          font-weight: 600;
          margin-bottom: 6px;
        }

        .rt-bar-container {
          width: 100%;
          height: 9px;
          background: #eeeeee;
          border-radius: 20px;
          overflow: hidden;
        }

        .rt-bar {
          height: 100%;
          border-radius: 20px;
        }

        .rt-blue {
          background: #007aff;
        }

        .rt-green {
          background: #34c759;
        }

        .rt-orange {
          background: #ff9500;
        }

        .rt-empty {
          padding: 24px;
          font-family: Inter, Arial, sans-serif;
          color: #555;
        }
      </style>

      <div class="rt-table-wrapper">
        <div id="rt-table"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const container = element.querySelector("#rt-table");

    if (!data || data.length === 0) {
      container.innerHTML = `<div class="rt-empty">No data available</div>`;
      done();
      return;
    }

    const dimensions = queryResponse.fields.dimension_like || [];
    const measures = queryResponse.fields.measure_like || [];

    if (dimensions.length < 1 || measures.length < 4) {
      container.innerHTML = `
        <div class="rt-empty">
          This visualization needs 1 dimension and 4 measures:<br>
          Bookmonth, ADR, Occupancy, Revenue, Nights Sold
        </div>
      `;
      done();
      return;
    }

    const monthField = dimensions[0].name;
    const adrField = measures[0].name;
    const occField = measures[1].name;
    const revenueField = measures[2].name;
    const nightsField = measures[3].name;

    const getValue = function(row, field) {
      return row && row[field] ? row[field].value : null;
    };

    const formatCurrency = function(value) {
      if (value === null || value === undefined || value === "") return "-";
      return "€" + Number(value).toLocaleString(undefined, {
        maximumFractionDigits: 0
      });
    };

    const formatNumber = function(value) {
      if (value === null || value === undefined || value === "") return "-";
      return Number(value).toLocaleString(undefined, {
        maximumFractionDigits: 0
      });
    };

    const formatPercent = function(value) {
      if (value === null || value === undefined || value === "") return "-";

      let pct = Number(value);

      if (pct <= 1) {
        pct = pct * 100;
      }

      return pct.toFixed(1) + "%";
    };

    const adrValues = data
      .map(row => Number(getValue(row, adrField)))
      .filter(v => !isNaN(v));

    const revenueValues = data
      .map(row => Number(getValue(row, revenueField)))
      .filter(v => !isNaN(v));

    const maxAdr = Math.max(...adrValues, 1);
    const maxRevenue = Math.max(...revenueValues, 1);

    let html = `
      <table class="rt-table">
        <thead>
          <tr>
            <th>Month</th>
            <th>ADR</th>
            <th>Occupancy</th>
            <th>Revenue</th>
            <th>Nights Sold</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.forEach(row => {
      const month = getValue(row, monthField);
      const adr = Number(getValue(row, adrField));
      const occRaw = Number(getValue(row, occField));
      const revenue = Number(getValue(row, revenueField));
      const nights = Number(getValue(row, nightsField));

      let occPct = occRaw;

      if (occPct <= 1) {
        occPct = occPct * 100;
      }

      const adrWidth = isNaN(adr) ? 0 : Math.min((adr / maxAdr) * 100, 100);
      const occWidth = isNaN(occPct) ? 0 : Math.min(occPct, 100);
      const revenueWidth = isNaN(revenue) ? 0 : Math.min((revenue / maxRevenue) * 100, 100);

      html += `
        <tr>
          <td class="rt-month">
            ${month || "-"}
          </td>

          <td>
            <div class="rt-value">${formatCurrency(adr)}</div>
            <div class="rt-bar-container">
              <div class="rt-bar rt-blue" style="width:${adrWidth}%"></div>
            </div>
          </td>

          <td>
            <div class="rt-value">${formatPercent(occRaw)}</div>
            <div class="rt-bar-container">
              <div class="rt-bar rt-green" style="width:${occWidth}%"></div>
            </div>
          </td>

          <td>
            <div class="rt-value">${formatCurrency(revenue)}</div>
            <div class="rt-bar-container">
              <div class="rt-bar rt-orange" style="width:${revenueWidth}%"></div>
            </div>
          </td>

          <td>
            <div class="rt-value">${formatNumber(nights)}</div>
          </td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
    `;

    container.innerHTML = html;

    done();
  }
});
