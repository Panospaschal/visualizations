looker.plugins.visualizations.add({
  id: "revenue_adr_occ_combo",
  label: "Revenue ADR Occupancy Combo",

  options: {
    title: {
      type: "string",
      label: "Title",
      default: "Revenue, ADR & Occupancy"
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
    occupancy_label: {
      type: "string",
      label: "Occupancy Label",
      default: "Occupancy"
    },
    value_prefix: {
      type: "string",
      label: "Currency Prefix",
      default: "€"
    },
    yoy_measure_position: {
      type: "string",
      label: "YoY Measure Position: none / fourth",
      default: "none"
    }
  },

  create: function(element) {
    element.innerHTML = `
      <style>
        .raoc-wrap {
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

        .raoc-title {
          font-size: clamp(16px, 2.5vw, 30px);
          font-weight: 900;
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .raoc-subtitle {
          font-size: clamp(10px, 1vw, 12px);
          color: rgba(255,255,255,0.55);
          margin-bottom: 12px;
        }

        .raoc-chart {
          width: 100%;
          height: calc(100% - 58px);
          min-height: 180px;
          position: relative;
          overflow: hidden;
        }

        .raoc-chart svg {
          width: 100%;
          height: 100%;
          display: block;
        }

        .raoc-tooltip {
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

        .raoc-empty {
          color: white;
          padding: 18px;
          font-size: 12px;
        }
      </style>

      <div class="raoc-wrap">
        <div class="raoc-title"></div>
        <div class="raoc-subtitle">Room revenue performance with ADR and occupancy dynamics</div>
        <div class="raoc-chart"></div>
        <div class="raoc-tooltip"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const titleEl = element.querySelector(".raoc-title");
    const chartEl = element.querySelector(".raoc-chart");
    const tooltipEl = element.querySelector(".raoc-tooltip");

    titleEl.innerText = config.title || "Revenue, ADR & Occupancy";

    const dimensions = queryResponse.fields.dimension_like || [];
    const measures = queryResponse.fields.measure_like || [];

    if (!data || data.length === 0 || dimensions.length < 1 || measures.length < 3) {
      chartEl.innerHTML = `
        <div class="raoc-empty">
          Add 1 time dimension and 3 measures.<br><br>
          Dimension: Month / Stay Month<br>
          Measure 1: Revenue<br>
          Measure 2: ADR<br>
          Measure 3: Occupancy<br>
          Optional Measure 4: YoY %
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
      .then(() => loadScript("https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"))
      .then(() => {
        render();
        done();
      })
      .catch(() => {
        chartEl.innerHTML = `<div class="raoc-empty">Could not load D3 library.</div>`;
        done();
      });

    function render() {
      chartEl.innerHTML = "";

      const d3 = window.d3;

      const categoryField = dimensions[0].name;
      const revenueField = measures[0].name;
      const adrField = measures[1].name;
      const occField = measures[2].name;
      const yoyField =
        config.yoy_measure_position === "fourth" && measures.length >= 4
          ? measures[3].name
          : null;

      const rows = data
        .map((row, index) => {
          let label =
            row[categoryField]?.rendered ||
            row[categoryField]?.value ||
            String(index + 1);

          label = String(label).replace(/(<([^>]+)>)/gi, "");

          let occ = Number(row[occField]?.value || 0);

          if (Math.abs(occ) <= 1.2) {
            occ = occ * 100;
          }

          return {
            label,
            revenue: Number(row[revenueField]?.value || 0),
            adr: Number(row[adrField]?.value || 0),
            occupancy: occ,
            yoy: yoyField ? Number(row[yoyField]?.value || 0) : null,
            revenueRendered: row[revenueField]?.rendered || null,
            adrRendered: row[adrField]?.rendered || null,
            occRendered: row[occField]?.rendered || null,
            yoyRendered: yoyField ? row[yoyField]?.rendered : null
          };
        })
        .filter(row => isFinite(row.revenue) && isFinite(row.adr) && isFinite(row.occupancy));

      if (!rows.length) {
        chartEl.innerHTML = `<div class="raoc-empty">No valid combo chart data found.</div>`;
        return;
      }

      const bounds = chartEl.getBoundingClientRect();
      const width = Math.max(bounds.width, 320);
      const height = Math.max(bounds.height, 180);

      const margin = {
        top: 24,
        right: 62,
        bottom: width < 600 ? 50 : 36,
        left: 66
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

      function formatPct(v) {
        if (!isFinite(v)) return "-";
        if (Math.abs(v) <= 1.2) return (v * 100).toFixed(1) + "%";
        return v.toFixed(1) + "%";
      }

      const x = d3
        .scaleBand()
        .domain(rows.map(d => d.label))
        .range([margin.left, margin.left + innerWidth])
        .padding(0.26);

      const yRevenue = d3
        .scaleLinear()
        .domain([0, (d3.max(rows, d => d.revenue) || 1) * 1.12])
        .range([margin.top + innerHeight, margin.top]);

      const maxAdr = d3.max(rows, d => d.adr) || 1;
      const maxOcc = d3.max(rows, d => d.occupancy) || 100;

      const yRightMax = Math.max(maxAdr, maxOcc) * 1.15;

      const yRight = d3
        .scaleLinear()
        .domain([0, yRightMax])
        .range([margin.top + innerHeight, margin.top]);

      const defs = svg.append("defs");

      const barGradient = defs.append("linearGradient")
        .attr("id", "raoc-bar-gradient")
        .attr("x1", "0")
        .attr("x2", "0")
        .attr("y1", "0")
        .attr("y2", "1");

      barGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#36a9d6")
        .attr("stop-opacity", 0.95);

      barGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#36a9d6")
        .attr("stop-opacity", 0.28);

      const glow = defs.append("filter")
        .attr("id", "raoc-glow")
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

      const grid = svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(
          d3.axisLeft(yRevenue)
            .ticks(5)
            .tickSize(-innerWidth)
            .tickFormat("")
        );

      grid.selectAll("line")
        .style("stroke", "rgba(255,255,255,0.06)");

      grid.select("path").remove();

      const yAxisLeft = svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(
          d3.axisLeft(yRevenue)
            .ticks(5)
            .tickFormat(d => formatCurrency(d))
        );

      yAxisLeft.selectAll("text")
        .style("fill", "rgba(255,255,255,0.62)")
        .style("font-size", "10px");

      yAxisLeft.selectAll("path,line")
        .style("stroke", "rgba(255,255,255,0.14)");

      const yAxisRight = svg.append("g")
        .attr("transform", `translate(${margin.left + innerWidth},0)`)
        .call(
          d3.axisRight(yRight)
            .ticks(5)
            .tickFormat(d => {
              if (d <= 100) return d + "%";
              return prefix + d;
            })
        );

      yAxisRight.selectAll("text")
        .style("fill", "rgba(255,255,255,0.62)")
        .style("font-size", "10px");

      yAxisRight.selectAll("path,line")
        .style("stroke", "rgba(255,255,255,0.14)");

      const xAxis = svg.append("g")
        .attr("transform", `translate(0,${margin.top + innerHeight})`)
        .call(d3.axisBottom(x));

      xAxis.selectAll("text")
        .style("fill", "rgba(255,255,255,0.68)")
        .style("font-size", width < 600 ? "9px" : "10px")
        .style("font-weight", 700)
        .attr("transform", width < 600 ? "rotate(-32)" : "rotate(-18)")
        .style("text-anchor", "end");

      xAxis.selectAll("path,line")
        .style("stroke", "rgba(255,255,255,0.14)");

      const bars = svg.append("g")
        .selectAll("rect")
        .data(rows)
        .enter()
        .append("rect")
        .attr("x", d => x(d.label))
        .attr("y", d => yRevenue(d.revenue))
        .attr("width", x.bandwidth())
        .attr("height", d => margin.top + innerHeight - yRevenue(d.revenue))
        .attr("rx", Math.min(8, x.bandwidth() / 3))
        .attr("fill", "url(#raoc-bar-gradient)")
        .attr("opacity", 0.88);

      const lineAdr = d3.line()
        .x(d => x(d.label) + x.bandwidth() / 2)
        .y(d => yRight(d.adr))
        .curve(d3.curveMonotoneX);

      const lineOcc = d3.line()
        .x(d => x(d.label) + x.bandwidth() / 2)
        .y(d => yRight(d.occupancy))
        .curve(d3.curveMonotoneX);

      svg.append("path")
        .datum(rows)
        .attr("d", lineAdr)
        .attr("fill", "none")
        .attr("stroke", "#ff9f2f")
        .attr("stroke-width", 3)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("filter", "url(#raoc-glow)");

      svg.append("path")
        .datum(rows)
        .attr("d", lineOcc)
        .attr("fill", "none")
        .attr("stroke", "#74d17c")
        .attr("stroke-width", 2.4)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("opacity", 0.82);

      svg.append("g")
        .selectAll("circle.adr")
        .data(rows)
        .enter()
        .append("circle")
        .attr("class", "adr")
        .attr("cx", d => x(d.label) + x.bandwidth() / 2)
        .attr("cy", d => yRight(d.adr))
        .attr("r", 3.5)
        .attr("fill", "#ff9f2f")
        .attr("stroke", "#030303")
        .attr("stroke-width", 1.5);

      svg.append("g")
        .selectAll("circle.occ")
        .data(rows)
        .enter()
        .append("circle")
        .attr("class", "occ")
        .attr("cx", d => x(d.label) + x.bandwidth() / 2)
        .attr("cy", d => yRight(d.occupancy))
        .attr("r", 3)
        .attr("fill", "#74d17c")
        .attr("stroke", "#030303")
        .attr("stroke-width", 1.5)
        .attr("opacity", 0.9);

      const legend = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top - 8})`);

      const legendItems = [
        { label: config.revenue_label || "Revenue", color: "#36a9d6" },
        { label: config.adr_label || "ADR", color: "#ff9f2f" },
        { label: config.occupancy_label || "Occupancy", color: "#74d17c" }
      ];

      let lx = 0;

      legendItems.forEach(item => {
        const g = legend.append("g").attr("transform", `translate(${lx},0)`);

        g.append("circle")
          .attr("r", 5)
          .attr("fill", item.color);

        g.append("text")
          .attr("x", 10)
          .attr("y", 4)
          .text(item.label)
          .style("fill", "rgba(255,255,255,0.7)")
          .style("font-size", "10px")
          .style("font-weight", 700);

        lx += item.label.length * 6 + 42;
      });

      const hoverLine = svg.append("line")
        .attr("y1", margin.top)
        .attr("y2", margin.top + innerHeight)
        .attr("stroke", "rgba(255,255,255,0.22)")
        .attr("stroke-width", 1)
        .attr("opacity", 0);

      const overlay = svg.append("g");

      overlay.selectAll("rect")
        .data(rows)
        .enter()
        .append("rect")
        .attr("x", d => x(d.label))
        .attr("y", margin.top)
        .attr("width", x.bandwidth())
        .attr("height", innerHeight)
        .attr("fill", "transparent")
        .style("cursor", "crosshair")
        .on("mousemove", function(event, d) {
          const cx = x(d.label) + x.bandwidth() / 2;

          hoverLine
            .attr("x1", cx)
            .attr("x2", cx)
            .attr("opacity", 1);

          bars
            .attr("opacity", b => b.label === d.label ? 1 : 0.35);

          d3.select(this.parentNode.parentNode)
            .selectAll("circle")
            .attr("opacity", c => c.label === d.label ? 1 : 0.35);

          const yoy = d.yoy;
          const yoyText = yoy === null || !isFinite(yoy)
            ? "YoY insight unavailable"
            : yoy >= 0
              ? `Revenue performance is up ${formatPct(yoy)} YoY`
              : `Revenue performance is down ${formatPct(yoy)} YoY`;

          const insightColor =
            yoy === null || !isFinite(yoy)
              ? "rgba(255,255,255,0.6)"
              : yoy >= 0
                ? "#74d17c"
                : "#ef3d2f";

          tooltipEl.style.opacity = 1;
          tooltipEl.style.left = Math.min(cx + 16, width - 230) + "px";
          tooltipEl.style.top = Math.max(yRevenue(d.revenue) - 20, 20) + "px";

          tooltipEl.innerHTML = `
            <strong>${d.label}</strong><br>
            ${config.revenue_label || "Revenue"}: <strong>${d.revenueRendered || formatCurrency(d.revenue)}</strong><br>
            ${config.adr_label || "ADR"}: <strong>${d.adrRendered || formatADR(d.adr)}</strong><br>
            ${config.occupancy_label || "Occupancy"}: <strong>${d.occRendered || formatPct(d.occupancy)}</strong><br>
            <span style="color:${insightColor};">${yoyText}</span>
          `;
        })
        .on("mouseleave", function() {
          hoverLine.attr("opacity", 0);
          bars.attr("opacity", 0.88);

          svg.selectAll("circle")
            .attr("opacity", 1);

          svg.selectAll("circle.occ")
            .attr("opacity", 0.9);

          tooltipEl.style.opacity = 0;
        });

      function formatPct(v) {
        if (!isFinite(v)) return "-";
        if (Math.abs(v) <= 1.2) {
          return (v * 100).toFixed(1) + "%";
        }
        return v.toFixed(1) + "%";
      }
    }
  }
});
