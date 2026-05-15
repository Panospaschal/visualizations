looker.plugins.visualizations.add({
  id: "kpi_dot_bars",
  label: "KPI Dot Bars",

  options: {
    title: {
      type: "string",
      label: "Title",
      default: "KPI Performance"
    },
    subtitle: {
      type: "string",
      label: "Overview Text",
      default: "This visualization compares selected KPIs using dot-style vertical bars."
    },
    max_value: {
      type: "number",
      label: "Max Value For Scaling",
      default: 0
    }
  },

  create: function(element) {
    element.innerHTML = `
      <style>
        .kpi-wrap {
          width: 100%;
          min-height: 620px;
          background: #030303;
          color: white;
          font-family: Inter, Arial, sans-serif;
          padding: 42px 54px;
          box-sizing: border-box;
          position: relative;
          overflow: hidden;
        }

        .kpi-title {
          font-size: 30px;
          font-weight: 900;
          margin-bottom: 24px;
        }

        .kpi-bars {
          display: flex;
          align-items: flex-end;
          gap: 22px;
          height: 370px;
        }

        .kpi-col {
          width: 54px;
          height: 340px;
          display: flex;
          flex-direction: column-reverse;
          gap: 5px;
          position: relative;
        }

        .kpi-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: rgba(255,255,255,0.16);
        }

        .kpi-dot.active {
          box-shadow: 0 0 8px currentColor;
        }

        .kpi-percent {
          position: absolute;
          left: 0;
          font-size: 21px;
          font-weight: 900;
          color: white;
          transform: translateY(-26px);
        }

        .kpi-name {
          text-align: center;
          font-size: 10px;
          font-weight: 700;
          margin-top: 10px;
          width: 70px;
          margin-left: -8px;
        }

        .kpi-card {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .kpi-overview {
          position: absolute;
          left: 370px;
          bottom: 64px;
          max-width: 430px;
        }

        .kpi-overview-title {
          font-size: 22px;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .kpi-overview-text {
          font-size: 11px;
          line-height: 1.4;
          color: rgba(255,255,255,0.8);
        }

        .kpi-line {
          position: absolute;
          height: 1px;
          background: rgba(255,255,255,0.35);
          left: 250px;
          right: 80px;
        }

        .kpi-badge {
          position: absolute;
          right: 110px;
          width: 34px;
          height: 34px;
          border-radius: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 16px;
          color: white;
        }

        .kpi-empty {
          color: white;
          padding: 30px;
        }
      </style>

      <div class="kpi-wrap">
        <div class="kpi-title"></div>
        <div id="kpi-content"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const title = element.querySelector(".kpi-title");
    const content = element.querySelector("#kpi-content");

    title.innerText = config.title || "KPI Performance";

    const measures = queryResponse.fields.measure_like || [];

    if (!data || data.length === 0 || measures.length === 0) {
      content.innerHTML = `
        <div class="kpi-empty">
          Add one or more measures/KPIs to use this visualization.
        </div>
      `;
      done();
      return;
    }

    const colors = [
      "#35b8e6",
      "#ff9f2f",
      "#e95fb8",
      "#ef3d2f",
      "#74d17c",
      "#b994ff",
      "#f6c85f",
      "#4dd4ac"
    ];

    const row = data[0];

    const kpis = measures.map((measure, index) => {
      const rawValue = row[measure.name] ? row[measure.name].value : 0;
      const value = Number(rawValue || 0);

      return {
        name: measure.label_short || measure.label || measure.name,
        value: value,
        color: colors[index % colors.length]
      };
    });

    let scaleMax = Number(config.max_value || 0);

    if (!scaleMax || scaleMax <= 0) {
      scaleMax = Math.max(...kpis.map(k => k.value), 1);
    }

    const dotCount = 42;

    const formatValue = function(value) {
      if (value <= 1) {
        return (value * 100).toFixed(0) + "%";
      }

      if (value >= 1000000) {
        return (value / 1000000).toFixed(1) + "M";
      }

      if (value >= 1000) {
        return (value / 1000).toFixed(0) + "K";
      }

      return value.toFixed(0);
    };

    let barsHTML = `<div class="kpi-bars">`;

    kpis.forEach((kpi, index) => {
      let pct;

      if (kpi.value <= 1) {
        pct = kpi.value * 100;
      } else {
        pct = (kpi.value / scaleMax) * 100;
      }

      pct = Math.max(0, Math.min(pct, 100));

      const activeDots = Math.round((pct / 100) * dotCount);

      let dots = "";

      for (let i = 0; i < dotCount; i++) {
        const active = i < activeDots;

        dots += `
          <div
            class="kpi-dot ${active ? "active" : ""}"
            style="color:${kpi.color}; background:${active ? kpi.color : "rgba(255,255,255,0.14)"}"
          ></div>
        `;
      }

      const labelTop = 340 - ((pct / 100) * 340);

      barsHTML += `
        <div class="kpi-card">
          <div class="kpi-col">
            ${dots}
            <div
              class="kpi-percent"
              style="top:${labelTop}px;"
            >
              ${formatValue(kpi.value)}
            </div>
          </div>
          <div class="kpi-name">${kpi.name}</div>
        </div>
      `;
    });

    barsHTML += `</div>`;

    let linesHTML = "";

    kpis.slice(0, 4).forEach((kpi, index) => {
      linesHTML += `
        <div class="kpi-line" style="top:${150 + index * 72}px;"></div>
        <div
          class="kpi-badge"
          style="top:${132 + index * 72}px; background:${kpi.color};"
        >
          ${index + 1}
        </div>
      `;
    });

    content.innerHTML = `
      ${barsHTML}
      ${linesHTML}

      <div class="kpi-overview">
        <div class="kpi-overview-title">Overview</div>
        <div class="kpi-overview-text">
          ${config.subtitle || ""}
        </div>
      </div>
    `;

    done();
  }
});
