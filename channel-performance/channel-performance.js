looker.plugins.visualizations.add({
  id: "channel_performance",
  label: "Channel Performance",

  options: {
    title: {
      type: "string",
      label: "Title",
      default: "Channel Performance"
    },
    revenue_label: {
      type: "string",
      label: "Revenue Label",
      default: "Revenue"
    },
    adr_label: {
      type: "string",
      label: "ADR Label",
      default: "ADR"
    },
    bookings_label: {
      type: "string",
      label: "Bookings Label",
      default: "Bookings"
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
        .ch-wrap {
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

        .ch-title {
          font-size: clamp(16px, 2.5vw, 30px);
          font-weight: 900;
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ch-subtitle {
          font-size: clamp(10px, 1vw, 12px);
          color: rgba(255,255,255,0.55);
          margin-bottom: 12px;
        }

        .ch-chart {
          width: 100%;
          height: calc(100% - 58px);
          min-height: 180px;
          position: relative;
          overflow: hidden;
        }

        .ch-chart svg {
          width: 100%;
          height: 100%;
          display: block;
        }

        .ch-tooltip {
          position: absolute;
          pointer-events: none;
          background: rgba(10,10,10,0.96);
          color: white;
          border: 1px solid rgba(255,255,255,0.16);
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 12px;
          line-height: 1.45;
          box-shadow: 0 10px 28px rgba(0,0,0,0.5);
          opacity: 0;
          z-index: 30;
          max-width: 280px;
        }

        .ch-empty {
          color: white;
          padding: 18px;
          font-size: 12px;
        }
      </style>

      <div class="ch-wrap">
        <div class="ch-title"></div>
        <div class="ch-subtitle">Revenue contribution, ADR quality and booking volume by channel</div>
        <div class="ch-chart"></div>
        <div class="ch-tooltip"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const titleEl = element.querySelector(".ch-title");
    const chartEl = element.querySelector(".ch-chart");
    const tooltipEl = element.querySelector(".ch-tooltip");

    titleEl.innerText = config.title || "Channel Performance";

    const dimensions = queryResponse.fields.dimension_like || [];
    const measures = queryResponse.fields.measure_like || [];

    if (!data || data.length === 0 || dimensions.length < 1 || measures.length < 3) {
      chartEl.innerHTML = `
        <div class="ch-empty">
          Add 1 channel dimension and 3 measures.<br><br>
          Dimension: Booking Channel / Source<br>
          Measure 1: Revenue<br>
          Measure 2: ADR<br>
          Measure 3: Bookings
        </div>
      `;
      done();
      return;
    }

    function loadScript(src) {
      return new Promise((resolve, reject) => {
        const existing = document.querySelector("script[src='" + src + "']");
        if (existing) return resolve();

        const script = document.createElement("script");
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    Promise.resolve()
      .then(() => loadScript("https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"))
      .then(() => {
        render();
        done();
      })
      .catch(() => {
        chartEl.innerHTML = `<div class="ch-empty">Could not load D3 library.</div>`;
        done();
      });

    function render() {
      chartEl.innerHTML = "";

      const d3 = window.d3;

      const channelField = dimensions[0].name;
      const revenueField = measures[0].name;
      const adrField = measures[1].name;
      const bookingsField = measures[2].name;

      const rows = data
        .map(row => {
          const channelRaw =
            row[channelField]?.rendered ||
            row[channelField]?.value ||
            "Unknown";

          const channel = String(channelRaw).replace(/(<([^>]+)>)/gi, "");

          return {
            channel,
            revenue: Number(row[revenueField]?.value || 0),
            adr: Number(row[adrField]?.value || 0),
            bookings: Number(row[bookingsField]?.value || 0),
            revenueRendered: row[revenueField]?.rendered || null,
            adrRendered: row[adrField]?.rendered || null,
            bookingsRendered: row[bookingsField]?.rendered || null
          };
        })
        .filter(row => isFinite(row.revenue))
        .sort((a, b) => b.revenue - a.revenue);

      if (!rows.length) {
        chartEl.innerHTML = `<div class="ch-empty">No valid channel data found.</div>`;
        return;
      }

      const bounds = chartEl.getBoundingClientRect();
      const width = Math.max(bounds.width, 320);
      const height = Math.max(bounds.height, 180);

      const margin = {
        top: 20,
        right: 92,
        bottom: 28,
        left: width < 600 ? 96 : 132
      };

      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      const svg = d3
        .select(chartEl)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

      const prefix = config.value_prefix || "€";

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

      function getChannelColor(channel) {
        const c = String(channel || "").toLowerCase();

        if (c.includes("direct") || c.includes("website") || c.includes("web")) return "#74d17c";
        if (c.includes("ota") || c.includes("booking") || c.includes("expedia") || c.includes("airbnb")) return "#36a9d6";
        if (c.includes("whole") || c.includes("tour") || c.includes("operator")) return "#f6c85f";
        if (c.includes("corp") || c.includes("business") || c.includes("company")) return "#b994ff";

        return "#ff9f2f";
      }

      function shorten(text, max) {
        if (!text) return "";
        return text.length > max ? text.slice(0, max) + "…" : text;
      }

      const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0) || 1;
      const maxRevenue = d3.max(rows, d => d.revenue) || 1;
      const maxADR = d3.max(rows, d => d.adr) || 1;
      const maxBookings = d3.max(rows, d => d.bookings) || 1;

      const y = d3
        .scaleBand()
        .domain(rows.map(d => d.channel))
        .range([margin.top, margin.top + innerHeight])
        .padding(0.22);

      const x = d3
        .scaleLinear()
        .domain([0, maxRevenue * 1.08])
        .range([margin.left, margin.left + innerWidth]);

      const defs = svg.append("defs");

      rows.forEach((row, i) => {
        const gradient = defs.append("linearGradient")
          .attr("id", "ch-gradient-" + i)
          .attr("x1", "0")
          .attr("x2", "1")
          .attr("y1", "0")
          .attr("y2", "0");

        gradient.append("stop")
          .attr("offset", "0%")
          .attr("stop-color", getChannelColor(row.channel))
          .attr("stop-opacity", 0.35);

        gradient.append("stop")
          .attr("offset", "100%")
          .attr("stop-color", getChannelColor(row.channel))
          .attr("stop-opacity", 0.95);
      });

      const grid = svg.append("g")
        .attr("transform", `translate(0,${margin.top + innerHeight})`)
        .call(
          d3.axisBottom(x)
            .ticks(4)
            .tickSize(-innerHeight)
            .tickFormat("")
        );

      grid.selectAll("line")
        .style("stroke", "rgba(255,255,255,0.06)");

      grid.select("path").remove();

      const xAxis = svg.append("g")
        .attr("transform", `translate(0,${margin.top + innerHeight})`)
        .call(
          d3.axisBottom(x)
            .ticks(4)
            .tickFormat(d => formatCurrency(d))
        );

      xAxis.selectAll("text")
        .style("fill", "rgba(255,255,255,0.55)")
        .style("font-size", "10px");

      xAxis.selectAll("path,line")
        .style("stroke", "rgba(255,255,255,0.14)");

      const yAxis = svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).tickFormat(d => shorten(d, width < 600 ? 13 : 20)));

      yAxis.selectAll("text")
        .style("fill", "rgba(255,255,255,0.78)")
        .style("font-size", width < 600 ? "9px" : "11px")
        .style("font-weight", 800);

      yAxis.selectAll("path,line")
        .style("stroke", "rgba(255,255,255,0.14)");

      const bars = svg.append("g")
        .selectAll("rect.ch-bar")
        .data(rows)
        .enter()
        .append("rect")
        .attr("class", "ch-bar")
        .attr("x", margin.left)
        .attr("y", d => y(d.channel))
        .attr("width", d => Math.max(1, x(d.revenue) - margin.left))
        .attr("height", y.bandwidth())
        .attr("rx", Math.min(8, y.bandwidth() / 2))
        .attr("fill", (d, i) => `url(#ch-gradient-${i})`)
        .attr("opacity", 0.9)
        .style("cursor", "pointer");

      const adrMarkers = svg.append("g")
        .selectAll("circle.ch-adr")
        .data(rows)
        .enter()
        .append("circle")
        .attr("class", "ch-adr")
        .attr("cx", d => margin.left + innerWidth + 22)
        .attr("cy", d => y(d.channel) + y.bandwidth() * 0.35)
        .attr("r", d => 4 + (d.adr / maxADR) * 6)
        .attr("fill", "#ff9f2f")
        .attr("opacity", 0.9)
        .style("cursor", "pointer");

      const bookingMarkers = svg.append("g")
        .selectAll("circle.ch-bookings")
        .data(rows)
        .enter()
        .append("circle")
        .attr("class", "ch-bookings")
        .attr("cx", d => margin.left + innerWidth + 52)
        .attr("cy", d => y(d.channel) + y.bandwidth() * 0.65)
        .attr("r", d => 4 + (d.bookings / maxBookings) * 6)
        .attr("fill", "#e95fb8")
        .attr("opacity", 0.82)
        .style("cursor", "pointer");

      svg.append("text")
        .attr("x", margin.left + innerWidth + 22)
        .attr("y", margin.top - 7)
        .attr("text-anchor", "middle")
        .text("ADR")
        .style("fill", "rgba(255,255,255,0.52)")
        .style("font-size", "9px")
        .style("font-weight", 800);

      svg.append("text")
        .attr("x", margin.left + innerWidth + 52)
        .attr("y", margin.top - 7)
        .attr("text-anchor", "middle")
        .text("Bookings")
        .style("fill", "rgba(255,255,255,0.52)")
        .style("font-size", "9px")
        .style("font-weight", 800);

      function showTooltip(event, d, metric) {
        const point = d3.pointer(event, chartEl);
        const share = d.revenue / totalRevenue * 100;

        let insight = "Balanced channel contribution";
        let color = getChannelColor(d.channel);

        if (share >= 40) {
          insight = "High revenue concentration risk";
          color = "#ef3d2f";
        } else if (String(d.channel).toLowerCase().includes("direct")) {
          insight = "Direct booking strength indicator";
          color = "#74d17c";
        } else if (d.adr >= maxADR * 0.85) {
          insight = "High ADR quality channel";
          color = "#ff9f2f";
        } else if (d.bookings >= maxBookings * 0.75 && d.adr < maxADR * 0.6) {
          insight = "High volume but lower quality channel";
          color = "#e95fb8";
        }

        let metricTitle = config.revenue_label || "Revenue";
        let metricValue = d.revenueRendered || formatCurrency(d.revenue);

        if (metric === "adr") {
          metricTitle = config.adr_label || "ADR";
          metricValue = d.adrRendered || formatADR(d.adr);
        }

        if (metric === "bookings") {
          metricTitle = config.bookings_label || "Bookings";
          metricValue = d.bookingsRendered || formatNumber(d.bookings);
        }

        tooltipEl.style.opacity = 1;
        tooltipEl.style.left = Math.min(point[0] + 14, width - 240) + "px";
        tooltipEl.style.top = Math.max(point[1] - 18, 20) + "px";

        tooltipEl.innerHTML = `
          <strong>${d.channel}</strong><br>
          <span style="color:${color};">${metricTitle}: <strong>${metricValue}</strong></span><br>
          ${config.revenue_label || "Revenue"}: <strong>${d.revenueRendered || formatCurrency(d.revenue)}</strong><br>
          ${config.adr_label || "ADR"}: <strong>${d.adrRendered || formatADR(d.adr)}</strong><br>
          ${config.bookings_label || "Bookings"}: <strong>${d.bookingsRendered || formatNumber(d.bookings)}</strong><br>
          Revenue Share: <strong>${share.toFixed(1)}%</strong><br>
          <span style="color:${color};">${insight}</span>
        `;
      }

      function resetOpacity() {
        bars.attr("opacity", 0.9);
        adrMarkers.attr("opacity", 0.9);
        bookingMarkers.attr("opacity", 0.82);
        tooltipEl.style.opacity = 0;
      }

      bars
        .on("mousemove", function(event, d) {
          bars.attr("opacity", b => b.channel === d.channel ? 1 : 0.25);
          adrMarkers.attr("opacity", b => b.channel === d.channel ? 1 : 0.18);
          bookingMarkers.attr("opacity", b => b.channel === d.channel ? 1 : 0.18);
          showTooltip(event, d, "revenue");
        })
        .on("mouseleave", resetOpacity);

      adrMarkers
        .on("mousemove", function(event, d) {
          bars.attr("opacity", b => b.channel === d.channel ? 1 : 0.25);
          adrMarkers.attr("opacity", b => b.channel === d.channel ? 1 : 0.18);
          bookingMarkers.attr("opacity", b => b.channel === d.channel ? 1 : 0.18);
          showTooltip(event, d, "adr");
        })
        .on("mouseleave", resetOpacity);

      bookingMarkers
        .on("mousemove", function(event, d) {
          bars.attr("opacity", b => b.channel === d.channel ? 1 : 0.25);
          adrMarkers.attr("opacity", b => b.channel === d.channel ? 1 : 0.18);
          bookingMarkers.attr("opacity", b => b.channel === d.channel ? 1 : 0.18);
          showTooltip(event, d, "bookings");
        })
        .on("mouseleave", resetOpacity);
    }
  }
});
