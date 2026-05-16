looker.plugins.visualizations.add({
  id: "booking_window_revenue",
  label: "Booking Window Revenue Analysis",

  options: {
    title: {
      type: "string",
      label: "Title",
      default: "Booking Window Revenue Analysis"
    },
    subtitle: {
      type: "string",
      label: "Subtitle",
      default: "Revenue contribution by booking lead time"
    },
    value_prefix: {
      type: "string",
      label: "Currency Prefix",
      default: "€"
    },
    sort_mode: {
      type: "string",
      label: "Sort Mode: revenue / data_order / booking_window",
      default: "booking_window"
    }
  },

  create: function(element) {
    element.innerHTML = `
      <style>
        .bwr-wrap {
          width: 100%;
          height: 100%;
          min-height: 0;
          background:
            radial-gradient(circle at top right, rgba(54,169,214,0.16), transparent 34%),
            radial-gradient(circle at bottom left, rgba(185,148,255,0.10), transparent 36%),
            #030303;
          color: white;
          font-family: Inter, Arial, sans-serif;
          padding: clamp(10px, 1.8vw, 28px);
          box-sizing: border-box;
          overflow: hidden;
          position: relative;
        }

        .bwr-wrap::before {
          content: "";
          position: absolute;
          inset: clamp(8px, 1.2vw, 18px);
          border-radius: 22px;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.08);
          pointer-events: none;
        }

        .bwr-header {
          position: relative;
          z-index: 2;
        }

        .bwr-title {
          font-size: clamp(16px, 2.5vw, 30px);
          font-weight: 950;
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: -0.03em;
        }

        .bwr-subtitle {
          font-size: clamp(10px, 1vw, 12px);
          color: rgba(255,255,255,0.55);
          margin-bottom: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .bwr-chart {
          width: 100%;
          height: calc(100% - 58px);
          min-height: 180px;
          position: relative;
          overflow: hidden;
          z-index: 2;
        }

        .bwr-chart svg {
          width: 100%;
          height: 100%;
          display: block;
        }

        .bwr-tooltip {
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
          max-width: 300px;
        }

        .bwr-empty {
          color: white;
          padding: 18px;
          font-size: 12px;
        }
      </style>

      <div class="bwr-wrap">
        <div class="bwr-header">
          <div class="bwr-title"></div>
          <div class="bwr-subtitle"></div>
        </div>
        <div class="bwr-chart"></div>
        <div class="bwr-tooltip"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const titleEl = element.querySelector(".bwr-title");
    const subtitleEl = element.querySelector(".bwr-subtitle");
    const chartEl = element.querySelector(".bwr-chart");
    const tooltipEl = element.querySelector(".bwr-tooltip");

    titleEl.innerText = config.title || "Booking Window Revenue Analysis";
    subtitleEl.innerText = config.subtitle || "Revenue contribution by booking lead time";

    const dimensions = queryResponse.fields.dimension_like || [];
    const measures = queryResponse.fields.measure_like || [];

    if (!data || data.length === 0 || dimensions.length < 1 || measures.length < 1) {
      chartEl.innerHTML = `
        <div class="bwr-empty">
          Add 1 dimension and at least 1 measure.<br><br>
          Dimension: Booking Window Bucket<br>
          Measure 1: Room Revenue Selected Year<br>
          Optional Measure 2: Bookings Selected Year
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
        chartEl.innerHTML = `<div class="bwr-empty">Could not load D3 library.</div>`;
        done();
      });

    function render() {
      chartEl.innerHTML = "";

      const d3 = window.d3;

      const bucketField = dimensions[0].name;
      const revenueField = measures[0].name;
      const bookingsField = measures.length >= 2 ? measures[1].name : null;

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

      function formatNumber(v) {
        return Number(v || 0).toLocaleString(undefined, {
          maximumFractionDigits: 0
        });
      }

      function bucketRank(bucket) {
        const b = String(bucket || "").toLowerCase();

        if (b.includes("0-1") || b.includes("0 - 1") || b.includes("same") || b.includes("last")) return 1;
        if (b.includes("2-3") || b.includes("2 - 3")) return 2;
        if (b.includes("4-7") || b.includes("4 - 7")) return 3;
        if (b.includes("8-14") || b.includes("8 - 14")) return 4;
        if (b.includes("15-30") || b.includes("15 - 30")) return 5;
        if (b.includes("31-60") || b.includes("31 - 60")) return 6;
        if (b.includes("61-90") || b.includes("61 - 90")) return 7;
        if (b.includes("90+") || b.includes(">90") || b.includes("91") || b.includes("90 +")) return 8;

        const match = b.match(/\\d+/);
        return match ? Number(match[0]) : 999;
      }

      const rows = data
        .map((row, index) => {
          const bucket =
            clean(row[bucketField]?.rendered) ||
            clean(row[bucketField]?.value) ||
            "Unknown";

          return {
            bucket,
            index,
            revenue: Number(row[revenueField]?.value || 0),
            bookings: bookingsField ? Number(row[bookingsField]?.value || 0) : null,
            revenueRendered: row[revenueField]?.rendered || null,
            bookingsRendered: bookingsField ? row[bookingsField]?.rendered : null
          };
        })
        .filter(row => row.bucket && isFinite(row.revenue));

      const sortMode = config.sort_mode || "booking_window";

      if (sortMode === "revenue") {
        rows.sort((a, b) => b.revenue - a.revenue);
      } else if (sortMode === "booking_window") {
        rows.sort((a, b) => bucketRank(a.bucket) - bucketRank(b.bucket));
      } else {
        rows.sort((a, b) => a.index - b.index);
      }

      if (!rows.length) {
        chartEl.innerHTML = `<div class="bwr-empty">No valid booking window data found.</div>`;
        return;
      }

      const bounds = chartEl.getBoundingClientRect();
      const width = Math.max(bounds.width, 320);
      const height = Math.max(bounds.height, 180);

      const margin = {
        top: 18,
        right: width < 600 ? 58 : 92,
        bottom: 30,
        left: width < 600 ? 92 : 130
      };

      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      const svg = d3
        .select(chartEl)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

      const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0) || 1;
      const maxRevenue = d3.max(rows, d => d.revenue) || 1;
      const maxBookings = d3.max(rows, d => d.bookings || 0) || 1;

      const x = d3.scaleLinear()
        .domain([0, maxRevenue * 1.12])
        .range([margin.left, margin.left + innerWidth]);

      const y = d3.scaleBand()
        .domain(rows.map(d => d.bucket))
        .range([margin.top, margin.top + innerHeight])
        .padding(0.28);

      const defs = svg.append("defs");

      const barGradient = defs.append("linearGradient")
        .attr("id", "bwr-bar-gradient")
        .attr("x1", "0")
        .attr("x2", "1")
        .attr("y1", "0")
        .attr("y2", "0");

      barGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#1c6f91")
        .attr("stop-opacity", 0.38);

      barGradient.append("stop")
        .attr("offset", "58%")
        .attr("stop-color", "#36a9d6")
        .attr("stop-opacity", 0.88);

      barGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#7bc8e6")
        .attr("stop-opacity", 1);

      const glow = defs.append("filter")
        .attr("id", "bwr-cyan-glow")
        .attr("x", "-60%")
        .attr("y", "-90%")
        .attr("width", "220%")
        .attr("height", "280%");

      glow.append("feGaussianBlur")
        .attr("stdDeviation", 3.5)
        .attr("result", "blur");

      glow.append("feColorMatrix")
        .attr("in", "blur")
        .attr("type", "matrix")
        .attr("values", "0 0 0 0 0.22  0 0 0 0 0.66  0 0 0 0 0.84  0 0 0 0.75 0")
        .attr("result", "glow");

      glow.append("feMerge")
        .html(`
          <feMergeNode in="glow"></feMergeNode>
          <feMergeNode in="SourceGraphic"></feMergeNode>
        `);

      const grid = svg.append("g")
        .attr("transform", `translate(0,${margin.top + innerHeight})`)
        .call(
          d3.axisBottom(x)
            .ticks(5)
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
            .ticks(5)
            .tickFormat(d => formatCurrency(d))
        );

      xAxis.selectAll("text")
        .style("fill", "rgba(255,255,255,0.58)")
        .style("font-size", "10px");

      xAxis.selectAll("path,line")
        .style("stroke", "rgba(255,255,255,0.14)");

      const yAxis = svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y));

      yAxis.selectAll("text")
        .style("fill", "rgba(255,255,255,0.78)")
        .style("font-size", width < 600 ? "9px" : "11px")
        .style("font-weight", 850);

      yAxis.selectAll("path,line")
        .style("stroke", "rgba(255,255,255,0.14)");

      const barsGroup = svg.append("g");

      barsGroup.selectAll("rect.bwr-bg")
        .data(rows)
        .enter()
        .append("rect")
        .attr("x", margin.left)
        .attr("y", d => y(d.bucket))
        .attr("width", innerWidth)
        .attr("height", y.bandwidth())
        .attr("rx", Math.min(10, y.bandwidth() / 2))
        .attr("fill", "rgba(255,255,255,0.045)");

      const bars = barsGroup.selectAll("rect.bwr-bar")
        .data(rows)
        .enter()
        .append("rect")
        .attr("class", "bwr-bar")
        .attr("x", margin.left)
        .attr("y", d => y(d.bucket))
        .attr("width", 0)
        .attr("height", y.bandwidth())
        .attr("rx", Math.min(10, y.bandwidth() / 2))
        .attr("fill", "url(#bwr-bar-gradient)")
        .attr("filter", "url(#bwr-cyan-glow)")
        .attr("opacity", 0.9)
        .style("cursor", "pointer");

      bars.transition()
        .duration(650)
        .ease(d3.easeCubicOut)
        .attr("width", d => Math.max(1, x(d.revenue) - margin.left));

      const labels = svg.append("g")
        .selectAll("text.bwr-value")
        .data(rows)
        .enter()
        .append("text")
        .attr("class", "bwr-value")
        .attr("x", d => Math.min(x(d.revenue) + 8, margin.left + innerWidth + 4))
        .attr("y", d => y(d.bucket) + y.bandwidth() / 2 + 4)
        .text(d => d.revenueRendered || formatCurrency(d.revenue))
        .style("fill", "rgba(255,255,255,0.82)")
        .style("font-size", width < 600 ? "9px" : "10px")
        .style("font-weight", 900);

      if (bookingsField) {
        const bookingDots = svg.append("g")
          .selectAll("circle.bwr-bookings")
          .data(rows)
          .enter()
          .append("circle")
          .attr("class", "bwr-bookings")
          .attr("cx", d => Math.min(x(d.revenue) + 4, margin.left + innerWidth))
          .attr("cy", d => y(d.bucket) + y.bandwidth() / 2)
          .attr("r", d => 3 + ((d.bookings || 0) / maxBookings) * 7)
          .attr("fill", "#e95fb8")
          .attr("stroke", "rgba(255,255,255,0.7)")
          .attr("stroke-width", 1)
          .attr("opacity", 0.82)
          .style("cursor", "pointer");

        bookingDots
          .on("mousemove", function(event, d) {
            highlight(d);
            showTooltip(event, d, "bookings");
          })
          .on("mouseleave", reset);
      }

      function getInsight(d) {
        const share = d.revenue / totalRevenue * 100;
        const rank = bucketRank(d.bucket);

        if (share >= 35) {
          return {
            text: "High revenue concentration by booking window",
            color: "#ef3d2f"
          };
        }

        if (rank <= 2 && share >= 15) {
          return {
            text: "Strong last-minute booking behavior",
            color: "#ff9f2f"
          };
        }

        if (rank >= 6 && share >= 15) {
          return {
            text: "Long lead-time revenue dependence",
            color: "#74d17c"
          };
        }

        if (share <= 5) {
          return {
            text: "Low contribution booking window",
            color: "rgba(255,255,255,0.58)"
          };
        }

        return {
          text: "Balanced booking lead-time contribution",
          color: "#36a9d6"
        };
      }

      function showTooltip(event, d, metric) {
        const point = d3.pointer(event, chartEl);
        const share = d.revenue / totalRevenue * 100;
        const insight = getInsight(d);

        const metricLine = metric === "bookings" && bookingsField
          ? `Bookings: <strong>${d.bookingsRendered || formatNumber(d.bookings)}</strong><br>`
          : `Revenue: <strong>${d.revenueRendered || formatCurrency(d.revenue)}</strong><br>`;

        tooltipEl.style.opacity = 1;
        tooltipEl.style.left = Math.min(point[0] + 14, width - 260) + "px";
        tooltipEl.style.top = Math.max(point[1] - 18, 20) + "px";

        tooltipEl.innerHTML = `
          <strong>${d.bucket}</strong><br>
          ${metricLine}
          Revenue: <strong>${d.revenueRendered || formatCurrency(d.revenue)}</strong><br>
          ${bookingsField ? `Bookings: <strong>${d.bookingsRendered || formatNumber(d.bookings)}</strong><br>` : ""}
          Revenue Share: <strong>${share.toFixed(1)}%</strong><br>
          <span style="color:${insight.color};">${insight.text}</span>
        `;
      }

      function highlight(d) {
        bars.attr("opacity", b => b.bucket === d.bucket ? 1 : 0.22);
        labels.attr("opacity", b => b.bucket === d.bucket ? 1 : 0.28);
        svg.selectAll("circle.bwr-bookings")
          .attr("opacity", b => b.bucket === d.bucket ? 1 : 0.18);

        bars.attr("stroke", b => b.bucket === d.bucket ? "rgba(255,255,255,0.75)" : "none")
          .attr("stroke-width", b => b.bucket === d.bucket ? 1.4 : 0);
      }

      function reset() {
        bars.attr("opacity", 0.9)
          .attr("stroke", "none")
          .attr("stroke-width", 0);

        labels.attr("opacity", 1);

        svg.selectAll("circle.bwr-bookings")
          .attr("opacity", 0.82);

        tooltipEl.style.opacity = 0;
      }

      bars
        .on("mousemove", function(event, d) {
          highlight(d);
          showTooltip(event, d, "revenue");
        })
        .on("mouseleave", reset)
        .on("click", function(event, d) {
          event.stopPropagation();

          const isActive = d3.select(this).classed("active");

          bars.classed("active", false)
            .transition()
            .duration(160)
            .attr("opacity", 0.16);

          labels.transition()
            .duration(160)
            .attr("opacity", 0.22);

          svg.selectAll("circle.bwr-bookings")
            .transition()
            .duration(160)
            .attr("opacity", 0.12);

          if (!isActive) {
            d3.select(this)
              .classed("active", true)
              .transition()
              .duration(160)
              .attr("opacity", 1);

            labels.filter(b => b.bucket === d.bucket)
              .transition()
              .duration(160)
              .attr("opacity", 1);

            svg.selectAll("circle.bwr-bookings")
              .filter(b => b.bucket === d.bucket)
              .transition()
              .duration(160)
              .attr("opacity", 1);
          } else {
            bars.transition()
              .duration(160)
              .attr("opacity", 0.9);

            labels.transition()
              .duration(160)
              .attr("opacity", 1);

            svg.selectAll("circle.bwr-bookings")
              .transition()
              .duration(160)
              .attr("opacity", 0.82);
          }
        });

      svg.on("click", function(event) {
        if (event.target.tagName === "svg") {
          bars.classed("active", false)
            .transition()
            .duration(160)
            .attr("opacity", 0.9);

          labels.transition()
            .duration(160)
            .attr("opacity", 1);

          svg.selectAll("circle.bwr-bookings")
            .transition()
            .duration(160)
            .attr("opacity", 0.82);
        }
      });
    }
  }
});
