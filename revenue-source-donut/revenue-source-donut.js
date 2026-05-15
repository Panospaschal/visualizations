looker.plugins.visualizations.add({
  id: "revenue_source_donut",
  label: "Revenue Source Donut",

  create: function(element) {
    element.innerHTML = `
      <style>
        .rs-wrap {
          width: 100%;
          min-height: 620px;
          background: #050505;
          color: white;
          font-family: Inter, Arial, sans-serif;
          position: relative;
          overflow: hidden;
          padding: 28px;
          box-sizing: border-box;
        }

        .rs-title {
          position: absolute;
          top: 28px;
          left: 34%;
          transform: translateX(-20%);
          font-size: 32px;
          font-weight: 800;
        }

        .rs-chart-area {
          position: absolute;
          left: 50%;
          top: 53%;
          transform: translate(-50%, -50%);
          width: 420px;
          height: 420px;
          border-radius: 50%;
          background: #181812;
          box-shadow: 0 0 0 18px rgba(255,255,255,0.08);
        }

        .rs-donut {
          width: 100%;
          height: 100%;
          border-radius: 50%;
        }

        .rs-hole {
          position: absolute;
          width: 135px;
          height: 135px;
          border-radius: 50%;
          background: #050505;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          border: 8px solid #f5f5f5;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          font-size: 11px;
          color: #222;
        }

        .rs-hole span {
          background: white;
          padding: 10px 14px;
          border-radius: 10px;
        }

        .rs-label {
          position: absolute;
          max-width: 210px;
        }

        .rs-name {
          font-size: 12px;
          font-weight: 700;
          color: white;
        }

        .rs-percent {
          font-size: 42px;
          font-weight: 900;
          line-height: 0.95;
        }

        .rs-line {
          position: absolute;
          height: 1px;
          background: rgba(255,255,255,0.75);
        }

        .rs-overview {
          position: absolute;
          left: 50%;
          bottom: 35px;
          transform: translateX(-50%);
          width: 420px;
          text-align: left;
        }

        .rs-overview-title {
          font-size: 22px;
          font-weight: 800;
          margin-bottom: 8px;
        }

        .rs-overview-text {
          font-size: 11px;
          line-height: 1.35;
          color: rgba(255,255,255,0.82);
        }

        .rs-empty {
          padding: 30px;
          color: white;
          font-family: Inter, Arial;
        }
      </style>

      <div class="rs-wrap">
        <div class="rs-title">Revenue By Source</div>
        <div id="rs-chart"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const wrap = element.querySelector(".rs-wrap");
    const chart = element.querySelector("#rs-chart");

    if (!data || data.length === 0) {
      chart.innerHTML = `<div class="rs-empty">No data available</div>`;
      done();
      return;
    }

    const dimensions = queryResponse.fields.dimension_like || [];
    const measures = queryResponse.fields.measure_like || [];

    if (dimensions.length < 1 || measures.length < 1) {
      chart.innerHTML = `
        <div class="rs-empty">
          This visualization needs 1 dimension and 1 measure:<br>
          Source and Revenue
        </div>
      `;
      done();
      return;
    }

    const sourceField = dimensions[0].name;
    const revenueField = measures[0].name;

    const colors = [
      "#f39a3d",
      "#36a9d6",
      "#ef3d2f",
      "#d965b6",
      "#7bc8e6",
      "#f6c06a",
      "#8bd17c",
      "#b994ff"
    ];

    const rows = data
      .map((row, index) => {
        const source = row[sourceField]?.value || "Unknown";
        const revenue = Number(row[revenueField]?.value || 0);

        return {
          source,
          revenue,
          color: colors[index % colors.length]
        };
      })
      .filter(row => row.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);

    const total = rows.reduce((sum, row) => sum + row.revenue, 0);

    if (!total) {
      chart.innerHTML = `<div class="rs-empty">No revenue data available</div>`;
      done();
      return;
    }

    let current = 0;

    const gradientParts = rows.map(row => {
      const start = current;
      const pct = row.revenue / total * 100;
      current += pct;
      return `${row.color} ${start}% ${current}%`;
    });

    const donutBackground = `conic-gradient(${gradientParts.join(", ")})`;

    const labelPositions = [
      { left: "67%", top: "90px", align: "left" },
      { left: "67%", top: "305px", align: "left" },
      { left: "70px", top: "305px", align: "left" },
      { left: "75px", top: "115px", align: "left" },
      { left: "75px", top: "445px", align: "left" },
      { left: "67%", top: "445px", align: "left" }
    ];

    const linePositions = [
      { left: "58%", top: "150px", width: "180px" },
      { left: "58%", top: "355px", width: "180px" },
      { left: "150px", top: "355px", width: "150px" },
      { left: "150px", top: "185px", width: "150px" },
      { left: "150px", top: "505px", width: "150px" },
      { left: "58%", top: "505px", width: "180px" }
    ];

    let labelsHTML = "";

    rows.slice(0, 6).forEach((row, index) => {
      const pct = row.revenue / total * 100;
      const pos = labelPositions[index] || labelPositions[0];
      const line = linePositions[index] || linePositions[0];

      labelsHTML += `
        <div
          class="rs-label"
          style="left:${pos.left}; top:${pos.top}; text-align:${pos.align};"
        >
          <div class="rs-name">${row.source}</div>
          <div class="rs-percent" style="color:${row.color};">
            ${pct.toFixed(0)}%
          </div>
        </div>

        <div
          class="rs-line"
          style="left:${line.left}; top:${line.top}; width:${line.width};"
        ></div>
      `;
    });

    const topSource = rows[0];
    const topPct = topSource.revenue / total * 100;

    chart.innerHTML = `
      <div class="rs-chart-area">
        <div class="rs-donut" style="background:${donutBackground};"></div>
        <div class="rs-hole">
          <span>Total<br>€${Math.round(total).toLocaleString()}</span>
        </div>
      </div>

      ${labelsHTML}

      <div class="rs-overview">
        <div class="rs-overview-title">Overview</div>
        <div class="rs-overview-text">
          Total revenue is distributed across ${rows.length} sources.
          The leading source is ${topSource.source}, contributing
          ${topPct.toFixed(1)}% of total revenue.
        </div>
      </div>
    `;

    done();
  }
});
