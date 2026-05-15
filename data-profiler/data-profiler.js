looker.plugins.visualizations.add({
  id: "data_profiler",
  label: "Data Profiler",

  options: {
    title: {
      type: "string",
      label: "Title",
      default: "Data Profiler"
    },

    currency: {
      type: "string",
      label: "Currency Symbol",
      default: "€"
    },

    value_format: {
      type: "string",
      label: "Format: currency / percent / number",
      default: "currency"
    }
  },

  create: function(element) {

    element.innerHTML = `
      <style>

        .dp-wrap {
          width: 100%;
          height: 100%;
          min-height: 300px;
          background: #030303;
          color: white;
          font-family: Inter, Arial, sans-serif;
          padding: 24px;
          box-sizing: border-box;
          overflow: auto;
        }

        .dp-title {
          font-size: clamp(18px, 3vw, 30px);
          font-weight: 900;
          margin-bottom: 20px;
        }

        .dp-table {
          width: 100%;
          border-collapse: collapse;
        }

        .dp-table thead th {
          text-align: left;
          padding: 12px;
          font-size: 12px;
          color: rgba(255,255,255,0.65);
          border-bottom: 1px solid rgba(255,255,255,0.15);
          position: sticky;
          top: 0;
          background: #030303;
          z-index: 2;
        }

        .dp-table tbody tr {
          transition: 0.2s ease;
          cursor: pointer;
        }

        .dp-table tbody tr:hover {
          background: rgba(255,255,255,0.06);
        }

        .dp-table tbody tr.active {
          background: rgba(255,255,255,0.09);
        }

        .dp-table tbody tr.muted {
          opacity: 0.2;
        }

        .dp-table td {
          padding: 14px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          vertical-align: middle;
        }

        .dp-dimension {
          font-size: 12px;
          font-weight: 800;
          color: rgba(255,255,255,0.92);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 220px;
        }

        .dp-value {
          font-size: 14px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .dp-bar-bg {
          width: 100%;
          height: 8px;
          background: rgba(255,255,255,0.1);
          border-radius: 999px;
          overflow: hidden;
        }

        .dp-bar {
          height: 100%;
          border-radius: 999px;
          transition: width 0.35s ease;
        }

        .blue {
          background: #36a9d6;
        }

        .orange {
          background: #ff9f2f;
        }

        .pink {
          background: #e95fb8;
        }

        .green {
          background: #74d17c;
        }

        .red {
          background: #ef3d2f;
        }

        .purple {
          background: #b994ff;
        }

        .dp-empty {
          padding: 24px;
          color: white;
        }

      </style>

      <div class="dp-wrap">

        <div class="dp-title"></div>

        <div class="dp-content"></div>

      </div>
    `;
  },

  updateAsync: function(
    data,
    element,
    config,
    queryResponse,
    details,
    done
  ) {

    const titleEl =
      element.querySelector(".dp-title");

    const contentEl =
      element.querySelector(".dp-content");

    titleEl.innerText =
      config.title || "Data Profiler";

    const dimensions =
      queryResponse.fields.dimension_like || [];

    const measures =
      queryResponse.fields.measure_like || [];

    if (
      !data ||
      data.length === 0 ||
      dimensions.length < 1 ||
      measures.length < 1
    ) {

      contentEl.innerHTML = `
        <div class="dp-empty">
          Add:
          <br><br>
          • At least 1 Dimension
          <br>
          • At least 1 Measure
        </div>
      `;

      done();
      return;
    }

    const dimensionField =
      dimensions[0].name;

    const colors = [
      "blue",
      "orange",
      "pink",
      "green",
      "red",
      "purple"
    ];

    function formatValue(value) {

      const format =
        config.value_format || "currency";

      const currency =
        config.currency || "€";

      const num =
        Number(value || 0);

      if (format === "percent") {

        if (Math.abs(num) <= 1) {
          return (num * 100).toFixed(1) + "%";
        }

        return num.toFixed(1) + "%";
      }

      if (format === "number") {

        return num.toLocaleString(undefined, {
          maximumFractionDigits: 0
        });
      }

      if (Math.abs(num) >= 1000000) {
        return currency +
          (num / 1000000).toFixed(1) +
          "M";
      }

      if (Math.abs(num) >= 1000) {
        return currency +
          (num / 1000).toFixed(0) +
          "K";
      }

      return currency +
        num.toLocaleString(undefined, {
          maximumFractionDigits: 0
        });
    }

    const maxValues = {};

    measures.forEach(measure => {

      maxValues[measure.name] =
        Math.max(
          ...data.map(row =>
            Number(
              row[measure.name]?.value || 0
            )
          ),
          1
        );
    });

    let html = `
      <table class="dp-table">

        <thead>
          <tr>

            <th>
              ${dimensions[0].label_short || dimensions[0].label}
            </th>

            ${measures.map(measure => `
              <th>
                ${measure.label_short || measure.label}
              </th>
            `).join("")}

          </tr>
        </thead>

        <tbody>
    `;

    data.forEach((row, rowIndex) => {

      const dimValue =
        row[dimensionField]?.value || "-";

      html += `
        <tr class="dp-row">

          <td>
            <div class="dp-dimension">
              ${dimValue}
            </div>
          </td>
      `;

      measures.forEach((measure, index) => {

        const value =
          Number(
            row[measure.name]?.value || 0
          );

        const percentage =
          (
            value /
            maxValues[measure.name]
          ) * 100;

        html += `
          <td>

            <div class="dp-value">
              ${formatValue(value)}
            </div>

            <div class="dp-bar-bg">

              <div
                class="dp-bar ${colors[index % colors.length]}"
                style="width:${percentage}%">
              </div>

            </div>

          </td>
        `;
      });

      html += `</tr>`;
    });

    html += `
        </tbody>
      </table>
    `;

    contentEl.innerHTML = html;

    const rows =
      contentEl.querySelectorAll(".dp-row");

    rows.forEach(row => {

      row.addEventListener("click", () => {

        const isActive =
          row.classList.contains("active");

        rows.forEach(r => {
          r.classList.remove("active");
          r.classList.remove("muted");
        });

        if (!isActive) {

          rows.forEach(r => {
            r.classList.add("muted");
          });

          row.classList.remove("muted");
          row.classList.add("active");
        }
      });
    });

    done();
  }
});
