looker.plugins.visualizations.add({
  id: "source_market_map",
  label: "Source Market World Map",

  options: {
    title: {
      type: "string",
      label: "Title",
      default: "Source Market Intelligence"
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
        .smm-wrap {
          width: 100%;
          height: 100%;
          min-height: 0;
          background: #030303;
          color: white;
          font-family: Inter, Arial, sans-serif;
          padding: clamp(10px, 1.8vw, 28px);
          box-sizing: border-box;
          overflow: hidden;
          position: relative;
        }

        .smm-title {
          font-size: clamp(16px, 2.5vw, 30px);
          font-weight: 900;
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .smm-subtitle {
          font-size: clamp(10px, 1vw, 12px);
          color: rgba(255,255,255,0.55);
          margin-bottom: 12px;
        }

        .smm-chart {
          width: 100%;
          height: calc(100% - 58px);
          min-height: 220px;
          position: relative;
          overflow: hidden;
        }

        .smm-empty {
          color: white;
          padding: 18px;
          font-size: 12px;
        }
      </style>

      <div class="smm-wrap">
        <div class="smm-title"></div>
        <div class="smm-subtitle">Revenue, ADR, bookings and guest volume by source market</div>
        <div class="smm-chart"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const titleEl = element.querySelector(".smm-title");
    const chartEl = element.querySelector(".smm-chart");

    titleEl.innerText = config.title || "Source Market Intelligence";

    const dimensions = queryResponse.fields.dimension_like || [];
    const measures = queryResponse.fields.measure_like || [];

    if (!data || data.length === 0 || dimensions.length < 1 || measures.length < 4) {
      chartEl.innerHTML = `
        <div class="smm-empty">
          Add 1 country dimension and 4 measures.<br><br>
          Dimension: Country<br>
          Measure 1: Revenue<br>
          Measure 2: ADR<br>
          Measure 3: Bookings<br>
          Measure 4: Guests
        </div>
      `;
      done();
      return;
    }

    function loadScript(src) {
      return new Promise((resolve, reject) => {
        const existing = document.querySelector("script[src='" + src + "']");
        if (existing) {
          resolve();
          return;
        }

        const script = document.createElement("script");
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    Promise.resolve()
      .then(() => loadScript("https://cdn.plot.ly/plotly-2.35.2.min.js"))
      .then(() => {
        render();
        done();
      })
      .catch(() => {
        chartEl.innerHTML = `<div class="smm-empty">Could not load Plotly library.</div>`;
        done();
      });

    function render() {
      chartEl.innerHTML = "";

      const countryField = dimensions[0].name;
      const revenueField = measures[0].name;
      const adrField = measures[1].name;
      const bookingsField = measures[2].name;
      const guestsField = measures[3].name;

      const prefix = config.value_prefix || "€";

      function clean(value) {
        return String(value || "")
          .replace(/(<([^>]+)>)/gi, "")
          .trim();
      }

      function formatCurrency(v) {
        const abs = Math.abs(Number(v || 0));
        const sign = v < 0 ? "-" : "";

        if (abs >= 1000000) return sign + prefix + (abs / 1000000).toFixed(1) + "M";
        if (abs >= 1000) return sign + prefix + (abs / 1000).toFixed(0) + "K";

        return sign + prefix + abs.toLocaleString(undefined, {
          maximumFractionDigits: 0
        });
      }

      function formatADR(v) {
        return prefix + Number(v || 0).toLocaleString(undefined, {
          maximumFractionDigits: 0
        });
      }

      function formatNumber(v) {
        return Number(v || 0).toLocaleString(undefined, {
          maximumFractionDigits: 0
        });
      }

      const rows = data
        .map(row => {
          const country =
            clean(row[countryField]?.rendered) ||
            clean(row[countryField]?.value) ||
            "Unknown";

          return {
            country,
            revenue: Number(row[revenueField]?.value || 0),
            adr: Number(row[adrField]?.value || 0),
            bookings: Number(row[bookingsField]?.value || 0),
            guests: Number(row[guestsField]?.value || 0)
          };
        })
        .filter(row => row.country && row.country !== "∅" && row.revenue > 0);

      if (!rows.length) {
        chartEl.innerHTML = `<div class="smm-empty">No valid country data found.</div>`;
        return;
      }

      const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0) || 1;

      const locations = rows.map(r => r.country);
      const zValues = rows.map(r => r.revenue);

      const hoverText = rows.map(r => {
        const share = (r.revenue / totalRevenue) * 100;

        let insight = "Balanced source market contribution";

        if (share >= 30) {
          insight = "High international dependency";
        } else if (r.adr >= Math.max(...rows.map(x => x.adr)) * 0.85) {
          insight = "High-value source market";
        } else if (r.bookings >= Math.max(...rows.map(x => x.bookings)) * 0.75) {
          insight = "Strong booking volume market";
        } else if (share <= 3) {
          insight = "Emerging or low exposure market";
        }

        return `
          <b>${r.country}</b><br>
          Revenue: <b>${formatCurrency(r.revenue)}</b><br>
          ADR: <b>${formatADR(r.adr)}</b><br>
          Bookings: <b>${formatNumber(r.bookings)}</b><br>
          Guests: <b>${formatNumber(r.guests)}</b><br>
          Revenue Share: <b>${share.toFixed(1)}%</b><br>
          ${insight}
        `;
      });

      const plotData = [{
        type: "choropleth",
        locationmode: "country names",
        locations: locations,
        z: zValues,
        text: hoverText,
        hovertemplate: "%{text}<extra></extra>",
        colorscale: [
          [0, "rgba(54,169,214,0.18)"],
          [0.45, "#36a9d6"],
          [1, "#b994ff"]
        ],
        marker: {
          line: {
            color: "rgba(255,255,255,0.18)",
            width: 0.5
          }
        },
        colorbar: {
          title: "",
          thickness: 8,
          len: 0.45,
          x: 0.02,
          y: 0.12,
          bgcolor: "rgba(0,0,0,0)",
          tickfont: {
            color: "rgba(255,255,255,0.65)",
            size: 10
          }
        }
      }];

      const layout = {
        paper_bgcolor: "#030303",
        plot_bgcolor: "#030303",
        margin: {
          l: 0,
          r: 0,
          t: 0,
          b: 0
        },
        geo: {
          projection: {
            type: "natural earth"
          },
          bgcolor: "#030303",
          showframe: false,
          showcoastlines: false,
          showcountries: true,
          countrycolor: "rgba(255,255,255,0.12)",
          showland: true,
          landcolor: "rgba(255,255,255,0.055)",
          showocean: true,
          oceancolor: "#030303",
          lataxis: {
            showgrid: false
          },
          lonaxis: {
            showgrid: false
          }
        },
        hoverlabel: {
          bgcolor: "rgba(10,10,10,0.96)",
          bordercolor: "rgba(255,255,255,0.18)",
          font: {
            color: "#ffffff",
            family: "Inter, Arial, sans-serif",
            size: 12
          }
        }
      };

      const plotConfig = {
        responsive: true,
        displayModeBar: false
      };

      Plotly.newPlot(chartEl, plotData, layout, plotConfig);

      window.addEventListener("resize", function() {
        Plotly.Plots.resize(chartEl);
      });
    }
  }
});
