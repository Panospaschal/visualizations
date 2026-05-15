looker.plugins.visualizations.add({
  id: "data_profiler",
  label: "Data Profiler",

  create: function(element) {
    element.innerHTML = `
      <style>
        body {
          font-family: Arial;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th {
          text-align: left;
          padding: 10px;
          border-bottom: 2px solid #ddd;
        }

        td {
          padding: 10px;
          border-bottom: 1px solid #eee;
          vertical-align: middle;
        }

        .histogram {
          display: flex;
          align-items: flex-end;
          height: 50px;
          gap: 2px;
        }

        .bar {
          background: #d9a066;
          width: 12px;
        }

        .field-name {
          font-weight: 600;
        }
      </style>

      <div id="profiler"></div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {

    const container = element.querySelector("#profiler")

    let html = `
      <table>
        <thead>
          <tr>
            <th>Column</th>
            <th>Distribution</th>
            <th>Missing</th>
            <th>Mean</th>
            <th>Median</th>
            <th>Std</th>
          </tr>
        </thead>
        <tbody>
    `

    data.forEach(row => {

      const field =
        row.field_name?.value || ""

      const missing =
        row.missing_pct?.value || 0

      const mean =
        row.mean?.value || "-"

      const median =
        row.median?.value || "-"

      const std =
        row.std?.value || "-"

      let bins = []

      try {
        bins = JSON.parse(
          row.histogram_bins?.value || "[]"
        )
      } catch(e) {}

      const histogramHTML = `
        <div class="histogram">
          ${bins.map(v => `
            <div
              class="bar"
              style="height:${v}px">
            </div>
          `).join("")}
        </div>
      `

      html += `
        <tr>
          <td class="field-name">
            ${field}
          </td>

          <td>
            ${histogramHTML}
          </td>

          <td>
            ${missing}%
          </td>

          <td>
            ${mean}
          </td>

          <td>
            ${median}
          </td>

          <td>
            ${std}
          </td>
        </tr>
      `
    })

    html += `
        </tbody>
      </table>
    `

    container.innerHTML = html

    done()
  }
})
