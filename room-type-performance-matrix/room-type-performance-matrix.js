looker.plugins.visualizations.add({
  id: "room_type_performance_matrix",
  label: "Room Type Revenue Positioning Matrix",

  options: {
    title: {
      type: "string",
      label: "Title",
      default: "Room Type Revenue Positioning Matrix"
    },
    subtitle: {
      type: "string",
      label: "Subtitle",
      default: "ADR, RevPAR and revenue contribution by room type"
    },
    value_prefix: {
      type: "string",
      label: "Currency Prefix",
      default: "€"
    },
    threshold_mode: {
      type: "string",
      label: "Threshold Mode: median / average",
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
          background:
            radial-gradient(circle at top right, rgba(54,169,214,0.16), transparent 32%),
            radial-gradient(circle at bottom left, rgba(185,148,255,0.12), transparent 34%),
            #030303;
          color: white;
          font-family: Inter, Arial, sans-serif;
          padding: clamp(10px, 1.8vw, 28px);
          box-sizing: border-box;
          overflow: hidden;
          position: relative;
        }

        .rtpm-wrap::before {
          content: "";
          position: absolute;
          inset: clamp(8px, 1.2vw, 18px);
          border-radius: 22px;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.08);
          pointer-events: none;
        }

        .rtpm-header {
          position: relative;
          z-index: 2;
        }

        .rtpm-title {
          font-size: clamp(16px, 2.5vw, 30px);
          font-weight: 950;
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: -0.03em;
        }

        .rtpm-subtitle {
          font-size: clamp(10px, 1vw, 12px);
          color: rgba(255,255,255,0.55);
          margin-bottom: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .rtpm-chart {
          width: 100%;
          height: calc(100% - 58px);
          min-height: 180px;
          position: relative;
          overflow: hidden;
          z-index: 2;
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
        <div class="rtpm-header">
          <div class="rtpm-title"></div>
          <div class="rtpm-subtitle"></div>
        </div>
        <div class="rtpm-chart"></div>
        <div class="rtpm-tooltip"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const titleEl = element.querySelector(".rtpm-title");
    const subtitleEl = element.querySelector(".rtpm-subtitle");
    const chartEl = element.querySelector(".rtpm-chart");
    const tooltipEl = element.querySelector(".rtpm-tooltip");

    titleEl.innerText = config.title || "Room Type Revenue Positioning Matrix";
    subtitleEl.innerText = config.subtitle || "ADR, RevPAR and revenue contribution by room type";

    const dimensions = queryResponse.fields.dimension_like || [];
    const measures = queryResponse.fields.measure_like || [];

    if (!data || data.length === 0 || dimensions.length < 1 || measures.length < 4) {
      chartEl.innerHTML = `
        <div class="rtpm-empty">
          Add 1 room type dimension and 4 measures.<br><br>
          Dimension: Room Types Short Name<br>
          Measure 1: ADR Selected Year<br>
          Measure 2: RevPAR Selected Year<br>
          Measure 3: Room Revenue Selected Year<br>
          Measure 4: Bookings Selected Year
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
      const revparField = measures[1].name;
      const revenueField = measures[2].name;
      const bookingsField = measures[3].name;

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

      function formatEuro(v) {
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
          const roomType =
            clean(row[roomField]?.rendered) ||
            clean(row[roomField]?.value) ||
            "Unknown";

          return {
            roomType,
            adr: Number(row[adrField]?.value || 0),
            revpar: Number(row[revparField]?.value || 0),
            revenue: Number(row[revenueField]?.value || 0),
            bookings: Number(row[bookingsField]?.value || 0),
            adrRendered: row[adrField]?.rendered || null,
            revparRendered: row[revparField]?.rendered || null,
            revenueRendered: row[revenueField]?.rendered || null,
            bookingsRendered: row[bookingsField]?.rendered || null
          };
        })
        .filter(row =>
          row.roomType &&
          isFinite(row.adr) &&
          isFinite(row.revpar) &&
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
        right: 30,
        bottom: width < 600 ? 48 : 40,
        left: 68
      };

      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      const svg = d3
        .select(chartEl)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

      const maxAdr = d3.max(rows, d => d.adr) || 1;
      const maxRevpar = d3.max(rows, d => d.revpar) || 1;
      const maxRevenue = d3.max(rows, d => d.revenue) || 1;

      const thresholdMode = config.threshold_mode || "median";

      const adrThreshold =
        thresholdMode === "average"
          ? d3.mean(rows, d => d.adr)
          : d3.median(rows, d => d.adr);

      const revparThreshold =
        thresholdMode === "average"
          ? d3.mean(rows, d => d.revpar)
          : d3.median(rows, d => d.revpar);

      const x = d3.scaleLinear()
        .domain([0, maxAdr * 1.16])
        .range([margin.left, margin.left + innerWidth]);

      const y = d3.scaleLinear()
        .domain([0, maxRevpar * 1.18])
        .range([margin.top + innerHeight, margin.top]);

      const r = d3.scaleSqrt()
        .domain([0, maxRevenue])
        .range([7, Math.max(20, Math.min(46, Math.min(width, height) * 0.075))]);

      const defs = svg.append("defs");

      const bubbleGradient = defs.append("radialGradient")
        .attr("id", "rtpm-bubble-gradient")
        .attr("cx", "35%")
        .attr("cy", "30%")
        .attr("r", "70%");

      bubbleGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#7bc8e6")
        .attr("stop-opacity", 1);

      bubbleGradient.append("stop")
        .attr("offset", "65%")
        .attr("stop-color", "#36a9d6")
        .attr("stop-opacity", 0.9);

      bubbleGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#1c6f91")
        .attr("stop-opacity", 0.85);

      const glow = defs.append("filter")
        .attr("id", "rtpm-cyan-glow")
        .attr("x", "-80%")
        .attr("y", "-80%")
        .attr("width", "260%")
        .attr("height", "260%");

      glow.append("feGaussianBlur")
        .attr("stdDeviation", 4)
        .attr("result", "blur");

      glow.append("feColorMatrix")
        .attr("in", "blur")
        .attr("type", "matrix")
        .attr("values", "0 0 0 0 0.22  0 0 0 0 0.66  0 0 0 0 0.84  0 0 0 0.9 0")
        .attr("result", "glow");

      glow.append("feMerge")
        .html(`
          <feMergeNode in="glow"></feMergeNode>
          <feMergeNode in="SourceGraphic"></feMergeNode>
        `);

      const clipId = "rtpm-clip";
      defs.append("clipPath")
        .attr("id", clipId)
        .append("rect")
        .attr("x", margin.left)
        .attr("y", margin.top)
        .attr("width", innerWidth)
        .attr("height", innerHeight)
        .attr("rx", 16);

      function quadrant(d) {
        const highAdr = d.adr >= adrThreshold;
        const highRevpar = d.revpar >= revparThreshold;

        if (highAdr && highRevpar) return {
          label: "Star Inventory",
          color: "#74d17c",
          description: "Premium high-performing room type"
        };

        if (!highAdr && highRevpar) return {
          label: "Underpriced",
          color: "#36a9d6",
          description: "Efficient demand with pricing upside"
        };

        if (highAdr && !highRevpar) return {
          label: "Overpriced",
          color: "#ff9f2f",
          description: "High ADR but weaker revenue efficiency"
        };

        return {
          label: "Weak Inventory",
          color: "#ef3d2f",
          description: "Low pricing power and weak revenue efficiency"
        };
      }

      const plot = svg.append("g")
        .attr("clip-path", `url(#${clipId})`);

      plot.append("rect")
        .attr("x", margin.left)
        .attr("y", margin.top)
        .attr("width", x(adrThreshold) - margin.left)
        .attr("height", y(revparThreshold) - margin.top)
        .attr("fill", "rgba(54,169,214,0.055)");

      plot.append("rect")
        .attr("x", x(adrThreshold))
        .attr("y", margin.top)
        .attr("width", margin.left + innerWidth - x(adrThreshold))
        .attr("height", y(revparThreshold) - margin.top)
        .attr("fill", "rgba(116,209,124,0.055)");

      plot.append("rect")
        .attr("x", margin.left)
        .attr("y", y(revparThreshold))
        .attr("width", x(adrThreshold) - margin.left)
        .attr("height", margin.top + innerHeight - y(revparThreshold))
        .attr("fill", "rgba(239,61,47,0.045)");

      plot.append("rect")
        .attr("x", x(adrThreshold))
        .attr("y", y(revparThreshold))
        .attr("width", margin.left + innerWidth - x(adrThreshold))
        .attr("height", margin.top + innerHeight - y(revparThreshold))
        .attr("fill", "rgba(255,159,47,0.05)");

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

      svg.append("line")
        .attr("x1", x(adrThreshold))
        .attr("x2", x(adrThreshold))
        .attr("y1", margin.top)
        .attr("y2", margin.top + innerHeight)
        .attr("stroke", "rgba(255,255,255,0.28)")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4 5");

      svg.append("line")
        .attr("x1", margin.left)
        .attr("x2", margin.left + innerWidth)
        .attr("y1", y(revparThreshold))
        .attr("y2", y(revparThreshold))
        .attr("stroke", "rgba(255,255,255,0.28)")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4 5");

      const xAxis = svg.append("g")
        .attr("transform", `translate(0,${margin.top + innerHeight})`)
        .call(
          d3.axisBottom(x)
            .ticks(5)
            .tickFormat(d => formatEuro(d))
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
            .tickFormat(d => formatEuro(d))
        );

      yAxis.selectAll("text")
        .style("fill", "rgba(255,255,255,0.62)")
        .style("font-size", "10px");

      yAxis.selectAll("path,line")
        .style("stroke", "rgba(255,255,255,0.14)");

      svg.append("text")
        .attr("x", margin.left + innerWidth / 2)
        .attr("y", height - 5)
        .attr("text-anchor", "middle")
        .text("ADR Selected Year")
        .style("fill", "rgba(255,255,255,0.55)")
        .style("font-size", "10px")
        .style("font-weight", 800);

      svg.append("text")
        .attr("x", -margin.top - innerHeight / 2)
        .attr("y", 13)
        .attr("transform", "rotate(-90)")
        .attr("text-anchor", "middle")
        .text("RevPAR Selected Year")
        .style("fill", "rgba(255,255,255,0.55)")
        .style("font-size", "10px")
        .style("font-weight", 800);

      const quadrantLabels = [
        {
          text: "Underpriced",
          x: margin.left + 12,
          y: margin.top + 18,
          color: "#36a9d6"
        },
        {
          text: "Star Inventory",
          x: x(adrThreshold) + 12,
          y: margin.top + 18,
          color: "#74d17c"
        },
        {
          text: "Weak Inventory",
          x: margin.left + 12,
          y: y(revparThreshold) + 18,
          color: "#ef3d2f"
        },
        {
          text: "Overpriced",
          x: x(adrThreshold) + 12,
          y: y(revparThreshold) + 18,
          color: "#ff9f2f"
        }
      ];

      quadrantLabels.forEach(q => {
        svg.append("text")
          .attr("x", q.x)
          .attr("y", q.y)
          .text(q.text)
          .style("fill", q.color)
          .style("font-size", width < 600 ? "8px" : "10px")
          .style("font-weight", 950)
          .style("opacity", 0.72);
      });

      const bubbles = svg.append("g")
        .selectAll("g.rtpm-bubble-group")
        .data(rows)
        .enter()
        .append("g")
        .attr("class", "rtpm-bubble-group")
        .attr("transform", d => `translate(${x(d.adr)},${y(d.revpar)})`)
        .style("cursor", "pointer");

      bubbles.append("circle")
        .attr("r", d => r(d.revenue))
        .attr("fill", "url(#rtpm-bubble-gradient)")
        .attr("opacity", 0.85)
        .attr("stroke", "rgba(255,255,255,0.76)")
        .attr("stroke-width", 1.2)
        .attr("filter", "url(#rtpm-cyan-glow)");

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
        .style("font-weight", 950)
        .style("pointer-events", "none")
        .style("text-shadow", "0 1px 8px rgba(0,0,0,0.8)");

      bubbles
        .on("mousemove", function(event, d) {
          const q = quadrant(d);

          bubbles
            .attr("opacity", b => b.roomType === d.roomType ? 1 : 0.16);

          d3.select(this)
            .select("circle")
            .attr("opacity", 1)
            .attr("stroke-width", 2);

          const point = d3.pointer(event, chartEl);

          tooltipEl.style.opacity = 1;
          tooltipEl.style.left = Math.min(point[0] + 14, width - 270) + "px";
          tooltipEl.style.top = Math.max(point[1] - 18, 20) + "px";

          tooltipEl.innerHTML = `
            <strong>${d.roomType}</strong><br>
            ADR: <strong>${d.adrRendered || formatEuro(d.adr)}</strong><br>
            RevPAR: <strong>${d.revparRendered || formatEuro(d.revpar)}</strong><br>
            Room Revenue: <strong>${d.revenueRendered || formatCurrency(d.revenue)}</strong><br>
            Bookings: <strong>${d.bookingsRendered || formatNumber(d.bookings)}</strong><br>
            <span style="color:${q.color};">${q.label}</span><br>
            <span style="color:rgba(255,255,255,0.58);">${q.description}</span>
          `;
        })
        .on("mouseleave", function() {
          bubbles.attr("opacity", 1);

          bubbles.select("circle")
            .attr("opacity", 0.85)
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
