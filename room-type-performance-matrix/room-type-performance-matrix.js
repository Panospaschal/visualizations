looker.plugins.visualizations.add({
  id: "room_type_performance_matrix",
  label: "Room Type Performance Matrix",

  options: {
    title: {
      type: "string",
      label: "Title",
      default: "Room Type Performance Matrix"
    },
    value_prefix: {
      type: "string",
      label: "Currency Prefix",
      default: "€"
    },
    occupancy_threshold: {
      type: "number",
      label: "Occupancy Threshold %",
      default: 70
    },
    adr_threshold_mode: {
      type: "string",
      label: "ADR Threshold: median / average",
      default: "median"
    }
  },

  create: function(element) {
    element.innerHTML = `
      <style>
        .rtpm-wrap {
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

        .rtpm-title {
          font-size: clamp(16px, 2.5vw, 30px);
          font-weight: 900;
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .rtpm-subtitle {
          font-size: clamp(10px, 1vw, 12px);
          color: rgba(255,255,255,0.55);
          margin-bottom: 12px;
        }

        .rtpm-chart {
          width: 100%;
          height: calc(100% - 58px);
          min-height: 180px;
          position: relative;
          overflow: hidden;
        }

        .rtpm-chart svg {
          width: 100%;
          height: 100%;
          display: block;
        }

        .rtpm-tooltip {
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

        .rtpm-empty {
          color: white;
          padding: 18px;
          font-size: 12px;
        }
      </style>

      <div class="rtpm-wrap">
        <div class="rtpm-title"></div>
        <div class="rtpm-subtitle">ADR, occupancy and revenue contribution by room type</div>
        <div class="rtpm-chart"></div>
        <div class="rtpm-tooltip"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const titleEl = element.querySelector(".rtpm-title");
    const chartEl = element.querySelector(".rtpm-chart");
    const tooltipEl = element.querySelector(".rtpm-tooltip");

    titleEl.innerText = config.title || "Room Type Performance Matrix";

    const dimensions = queryResponse.fields.dimension_like || [];
    const measures = queryResponse.fields.measure_like || [];

    if (!data || data.length === 0 || dimensions.length < 1 || measures.length < 5) {
      chartEl.innerHTML = `
        <div class="rtpm-empty">
          Add 1 room type dimension and 5 measures.<br><br>
          Dimension: Room Type<br>
          Measure 1: ADR<br>
          Measure 2: Occupancy<br>
          Measure 3: Revenue<br>
          Measure 4: RevPAR<br>
          Measure 5: Booking Share
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
        chartEl.innerHTML = `<div class="rtpm-empty">Could not load D3 library.</div>`;
        done();
      });

    function render() {
      chartEl.innerHTML = "";

      const d3 = window.d3;

      const roomField = dimensions[0].name;
      const adrField = measures[0].name;
      const occField = measures[1].name;
      const revenueField = measures[2].name;
      const revparField = measures[3].name;
      const bookingShareField = measures[4].name;

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

      function formatPct(v) {
        let num = Number(v || 0);
        if (Math.abs(num) <= 1.2) num = num * 100;

        return num.toFixed(1) + "%";
      }

      function pctValue(v) {
        let num = Number(v || 0);
        if (Math.abs(num) <= 1.2) num = num * 100;
        return num;
      }

      const rows = data
        .map(row => {
          const roomType =
            clean(row[roomField]?.rendered) ||
            clean(row[roomField]?.value) ||
            "Unknown";

          return {
            roomType,
            adr: Number(row[adrField]?.value || 0),
            occupancy: pctValue(row[occField]?.value || 0),
            revenue: Number(row[revenueField]?.value || 0),
            revpar: Number(row[revparField]?.value || 0),
            bookingShare: pctValue(row[bookingShareField]?.value || 0),
            adrRendered: row[adrField]?.rendered || null,
            occupancyRendered: row[occField]?.rendered || null,
            revenueRendered: row[revenueField]?.rendered || null,
            revparRendered: row[revparField]?.rendered || null,
            bookingShareRendered: row[bookingShareField]?.rendered || null
          };
        })
        .filter(row =>
          row.roomType &&
          isFinite(row.adr) &&
          isFinite(row.occupancy) &&
          isFinite(row.revenue)
        );

      if (!rows.length) {
        chartEl.innerHTML = `<div class="rtpm-empty">No valid room type data found.</div>`;
        return;
      }

      const bounds = chartEl.getBoundingClientRect();
      const width = Math.max(bounds.width, 320);
      const height = Math.max(bounds.height, 180);

      const margin = {
        top: 26,
        right: 28,
        bottom: width < 600 ? 48 : 38,
        left: 66
      };

      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      const svg = d3
        .select(chartEl)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

      const maxOcc = Math.max(100, d3.max(rows, d => d.occupancy) || 100);
      const maxAdr = d3.max(rows, d => d.adr) || 1;
      const maxRevenue = d3.max(rows, d => d.revenue) || 1;

      const occThreshold = Number(config.occupancy_threshold || 70);

      const adrThreshold =
        (config.adr_threshold_mode || "median") === "average"
          ? d3.mean(rows, d => d.adr)
          : d3.median(rows, d => d.adr);

      const x = d3.scaleLinear()
        .domain([0, Math.min(110, maxOcc * 1.08)])
        .range([margin.left, margin.left + innerWidth]);

      const y = d3.scaleLinear()
        .domain([0, maxAdr * 1.15])
        .range([margin.top + innerHeight, margin.top]);

      const r = d3.scaleSqrt()
        .domain([0, maxRevenue])
        .range([6, Math.max(18, Math.min(44, Math.min(width, height) * 0.07))]);

      function quadrant(d) {
        const highOcc = d.occupancy >= occThreshold;
        const highAdr = d.adr >= adrThreshold;

        if (highOcc && highAdr) return {
          label: "Star inventory",
          color: "#74d17c",
          description: "High ADR and high occupancy"
        };

        if (!highOcc && highAdr) return {
          label: "Overpriced inventory",
          color: "#ff9f2f",
          description: "High ADR but lower demand"
        };

        if (highOcc && !highAdr) return {
          label: "Underpriced inventory",
          color: "#36a9d6",
          description: "High occupancy with ADR upside"
        };

        return {
          label: "Weak performing inventory",
          color: "#ef3d2f",
          description: "Low ADR and low occupancy"
        };
      }

      const defs = svg.append("defs");

      const glow = defs.append("filter")
        .attr("id", "rtpm-glow")
        .attr("x", "-50%")
        .attr("y", "-50%")
        .attr("width", "200%")
        .attr("height", "200%");

      glow.append("feGaussianBlur")
        .attr("stdDeviation", 3)
        .attr("result", "blur");

      glow.append("feMerge")
        .html(`
          <feMergeNode in="blur"></feMergeNode>
          <feMergeNode in="SourceGraphic"></feMergeNode>
        `);

      const gridX = svg.append("g")
        .attr("transform", `translate(0,${margin.top + innerHeight})`)
        .call(
          d3.axisBottom(x)
            .ticks(5)
            .tickSize(-innerHeight)
            .tickFormat("")
        );

      gridX.selectAll("line")
        .style("stroke", "rgba(255,255,255,0.06)");

      gridX.select("path").remove();

      const gridY = svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(
          d3.axisLeft(y)
            .ticks(5)
            .tickSize(-innerWidth)
            .tickFormat("")
        );

      gridY.selectAll("line")
        .style("stroke", "rgba(255,255,255,0.06)");

      gridY.select("path").remove();

      svg.append("rect")
        .attr("x", margin.left)
        .attr("y", margin.top)
        .attr("width", x(occThreshold) - margin.left)
        .attr("height", y(adrThreshold) - margin.top)
        .attr("fill", "rgba(255,159,47,0.045)");

      svg.append("rect")
        .attr("x", x(occThreshold))
        .attr("y", margin.top)
        .attr("width", margin.left + innerWidth - x(occThreshold))
        .attr("height", y(adrThreshold) - margin.top)
        .attr("fill", "rgba(116,209,124,0.055)");

      svg.append("rect")
        .attr("x", margin.left)
        .attr("y", y(adrThreshold))
        .attr("width", x(occThreshold) - margin.left)
        .attr("height", margin.top + innerHeight - y(adrThreshold))
        .attr("fill", "rgba(239,61,47,0.045)");

      svg.append("rect")
        .attr("x", x(occThreshold))
        .attr("y", y(adrThreshold))
        .attr("width", margin.left + innerWidth - x(occThreshold))
        .attr("height", margin.top + innerHeight - y(adrThreshold))
        .attr("fill", "rgba(54,169,214,0.055)");

      svg.append("line")
        .attr("x1", x(occThreshold))
        .attr("x2", x(occThreshold))
        .attr("y1", margin.top)
        .attr("y2", margin.top + innerHeight)
        .attr("stroke", "rgba(255,255,255,0.28)")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4 5");

      svg.append("line")
        .attr("x1", margin.left)
        .attr("x2", margin.left + innerWidth)
        .attr("y1", y(adrThreshold))
        .attr("y2", y(adrThreshold))
        .attr("stroke", "rgba(255,255,255,0.28)")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4 5");

      const xAxis = svg.append("g")
        .attr("transform", `translate(0,${margin.top + innerHeight})`)
        .call(
          d3.axisBottom(x)
            .ticks(5)
            .tickFormat(d => d + "%")
        );

      xAxis.selectAll("text")
        .style("fill", "rgba(255,255,255,0.62)")
        .style("font-size", "10px");

      xAxis.selectAll("path,line")
        .style("stroke", "rgba(255,255,255,0.14)");

      const yAxis = svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(
          d3.axisLeft(y)
            .ticks(5)
            .tickFormat(d => formatADR(d))
        );

      yAxis.selectAll("text")
        .style("fill", "rgba(255,255,255,0.62)")
        .style("font-size", "10px");

      yAxis.selectAll("path,line")
        .style("stroke", "rgba(255,255,255,0.14)");

      svg.append("text")
        .attr("x", margin.left + innerWidth / 2)
        .attr("y", height - 4)
        .attr("text-anchor", "middle")
        .text("Occupancy")
        .style("fill", "rgba(255,255,255,0.52)")
        .style("font-size", "10px")
        .style("font-weight", 800);

      svg.append("text")
        .attr("x", -margin.top - innerHeight / 2)
        .attr("y", 12)
        .attr("transform", "rotate(-90)")
        .attr("text-anchor", "middle")
        .text("ADR")
        .style("fill", "rgba(255,255,255,0.52)")
        .style("font-size", "10px")
        .style("font-weight", 800);

      const quadrantLabels = [
        {
          text: "Overpriced",
          x: margin.left + 10,
          y: margin.top + 16,
          color: "#ff9f2f"
        },
        {
          text: "Star inventory",
          x: x(occThreshold) + 10,
          y: margin.top + 16,
          color: "#74d17c"
        },
        {
          text: "Weak",
          x: margin.left + 10,
          y: y(adrThreshold) + 18,
          color: "#ef3d2f"
        },
        {
          text: "Underpriced",
          x: x(occThreshold) + 10,
          y: y(adrThreshold) + 18,
          color: "#36a9d6"
        }
      ];

      quadrantLabels.forEach(q => {
        svg.append("text")
          .attr("x", q.x)
          .attr("y", q.y)
          .text(q.text)
          .style("fill", q.color)
          .style("font-size", "10px")
          .style("font-weight", 900)
          .style("opacity", 0.72);
      });

      const bubbles = svg.append("g")
        .selectAll("g.rtpm-bubble-group")
        .data(rows)
        .enter()
        .append("g")
        .attr("class", "rtpm-bubble-group")
        .attr("transform", d => `translate(${x(d.occupancy)},${y(d.adr)})`)
        .style("cursor", "pointer");

      bubbles.append("circle")
        .attr("r", d => r(d.revenue))
        .attr("fill", d => quadrant(d).color)
        .attr("opacity", 0.72)
        .attr("stroke", "rgba(255,255,255,0.7)")
        .attr("stroke-width", 1.2)
        .attr("filter", "url(#rtpm-glow)");

      bubbles.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .text(d => {
          const maxChars = width < 600 ? 5 : 9;
          return d.roomType.length > maxChars
            ? d.roomType.slice(0, maxChars) + "…"
            : d.roomType;
        })
        .style("fill", "white")
        .style("font-size", width < 600 ? "8px" : "10px")
        .style("font-weight", 900)
        .style("pointer-events", "none");

      bubbles
        .on("mousemove", function(event, d) {
          const q = quadrant(d);

          bubbles
            .attr("opacity", b => b.roomType === d.roomType ? 1 : 0.18);

          d3.select(this)
            .select("circle")
            .attr("opacity", 1)
            .attr("stroke-width", 2);

          const point = d3.pointer(event, chartEl);

          tooltipEl.style.opacity = 1;
          tooltipEl.style.left = Math.min(point[0] + 14, width - 260) + "px";
          tooltipEl.style.top = Math.max(point[1] - 18, 20) + "px";

          tooltipEl.innerHTML = `
            <strong>${d.roomType}</strong><br>
            ADR: <strong>${d.adrRendered || formatADR(d.adr)}</strong><br>
            Occupancy: <strong>${d.occupancyRendered || formatPct(d.occupancy)}</strong><br>
            Revenue: <strong>${d.revenueRendered || formatCurrency(d.revenue)}</strong><br>
            RevPAR: <strong>${d.revparRendered || formatADR(d.revpar)}</strong><br>
            Booking Share: <strong>${d.bookingShareRendered || formatPct(d.bookingShare)}</strong><br>
            <span style="color:${q.color};">${q.label}</span><br>
            <span style="color:rgba(255,255,255,0.58);">${q.description}</span>
          `;
        })
        .on("mouseleave", function() {
          bubbles.attr("opacity", 1);

          bubbles.select("circle")
            .attr("opacity", 0.72)
            .attr("stroke-width", 1.2);

          tooltipEl.style.opacity = 0;
        })
        .on("click", function(event, d) {
          event.stopPropagation();

          const isActive = d3.select(this).classed("active");

          bubbles.classed("active", false)
            .transition()
            .duration(180)
            .attr("opacity", 0.14);

          if (!isActive) {
            d3.select(this)
              .classed("active", true)
              .transition()
              .duration(180)
              .attr("opacity", 1);
          } else {
            bubbles
              .transition()
              .duration(180)
              .attr("opacity", 1);
          }
        });

      svg.on("click", function(event) {
        if (event.target.tagName === "svg") {
          bubbles.classed("active", false)
            .transition()
            .duration(180)
            .attr("opacity", 1);
        }
      });
    }
  }
});
