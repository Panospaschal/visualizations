looker.plugins.visualizations.add({
  id: "comparative_violin",
  label: "Comparative Violin",

  options: {
    title: {
      type: "string",
      label: "Title",
      default: "Comparative Distribution"
    },

    current_year_value: {
      type: "string",
      label: "Current Year Value",
      default: "2026"
    },

    comparison_year_value: {
      type: "string",
      label: "Comparison Year Value",
      default: "2025"
    },

    current_year_label: {
      type: "string",
      label: "Current Year Label",
      default: "Current"
    },

    comparison_year_label: {
      type: "string",
      label: "Comparison Year Label",
      default: "Comparison"
    },

    value_format: {
      type: "string",
      label: "Format: currency / percent / number",
      default: "currency"
    },

    value_prefix: {
      type: "string",
      label: "Value Prefix",
      default: "€"
    }
  },

  create: function(element) {
    element.innerHTML = `
      <style>
        .cv-wrap{
          width:100%;
          height:100%;
          min-height:0;
          background:#030303;
          color:white;
          font-family:Inter,Arial,sans-serif;
          padding:clamp(10px,1.8vw,28px);
          box-sizing:border-box;
          overflow:hidden;
          position:relative;
        }

        .cv-title{
          font-size:clamp(16px,2.6vw,30px);
          font-weight:900;
          margin-bottom:10px;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }

        .cv-legend{
          display:flex;
          gap:18px;
          align-items:center;
          margin-bottom:10px;
          font-size:12px;
          color:rgba(255,255,255,.75);
        }

        .cv-legend-item{
          display:flex;
          gap:7px;
          align-items:center;
        }

        .cv-dot{
          width:11px;
          height:11px;
          border-radius:50%;
        }

        .cv-chart{
          width:100%;
          height:calc(100% - 70px);
          min-height:160px;
          position:relative;
        }

        .cv-chart svg{
          width:100%;
          height:100%;
          display:block;
        }

        .cv-tooltip{
          position:absolute;
          background:rgba(10,10,10,.96);
          border:1px solid rgba(255,255,255,.12);
          border-radius:12px;
          padding:10px 12px;
          font-size:12px;
          line-height:1.5;
          pointer-events:none;
          opacity:0;
          z-index:30;
          color:white;
          max-width:240px;
          box-shadow:0 8px 24px rgba(0,0,0,.45);
        }

        .cv-empty{
          color:white;
          font-size:12px;
          padding:18px;
        }
      </style>

      <div class="cv-wrap">
        <div class="cv-title"></div>
        <div class="cv-legend"></div>
        <div class="cv-chart"></div>
        <div class="cv-tooltip"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const titleEl = element.querySelector(".cv-title");
    const legendEl = element.querySelector(".cv-legend");
    const chartEl = element.querySelector(".cv-chart");
    const tooltipEl = element.querySelector(".cv-tooltip");

    titleEl.innerText = config.title || "Comparative Distribution";

    const dimensions = queryResponse.fields.dimension_like || [];
    const measures = queryResponse.fields.measure_like || [];

    if (!data || data.length === 0 || dimensions.length < 2 || measures.length < 1) {
      chartEl.innerHTML = `
        <div class="cv-empty">
          Add:<br><br>
          • Dimension 1 = Category / Room Type<br>
          • Dimension 2 = Year<br>
          • Measure = Numeric Value / ADR
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
        chartEl.innerHTML = `<div class="cv-empty">Could not load D3 library.</div>`;
        done();
      });

    function render() {
      chartEl.innerHTML = "";

      const d3 = window.d3;

      const bounds = chartEl.getBoundingClientRect();
      const width = Math.max(bounds.width, 320);
      const height = Math.max(bounds.height, 180);

      const categoryField = dimensions[0].name;
      const yearField = dimensions[1].name;
      const valueField = measures[0].name;

      const currentYearValue = String(config.current_year_value || "2026");
      const comparisonYearValue = String(config.comparison_year_value || "2025");

      const currentLabel = config.current_year_label || currentYearValue;
      const comparisonLabel = config.comparison_year_label || comparisonYearValue;

      const colors = {
        current: "#36a9d6",
        comparison: "#ff9f2f"
      };

      legendEl.innerHTML = `
        <div class="cv-legend-item">
          <span class="cv-dot" style="background:${colors.current};"></span>
          ${currentLabel}
        </div>
        <div class="cv-legend-item">
          <span class="cv-dot" style="background:${colors.comparison};"></span>
          ${comparisonLabel}
        </div>
      `;

      function formatValue(v) {
        const format = config.value_format || "currency";
        const prefix = config.value_prefix || "€";
        const val = Number(v || 0);

        if (format === "percent") {
          if (Math.abs(val) <= 1) return (val * 100).toFixed(1) + "%";
          return val.toFixed(1) + "%";
        }

        if (format === "number") {
          return val.toLocaleString(undefined, { maximumFractionDigits: 0 });
        }

        if (Math.abs(val) >= 1000000) return prefix + (val / 1000000).toFixed(1) + "M";
        if (Math.abs(val) >= 1000) return prefix + (val / 1000).toFixed(0) + "K";

        return prefix + val.toLocaleString(undefined, { maximumFractionDigits: 0 });
      }

      const grouped = {};

      data.forEach(row => {
        const category = String(row[categoryField]?.value || "Unknown");
        const year = String(row[yearField]?.value || "Unknown");
        const value = Number(row[valueField]?.value || 0);

        if (!isFinite(value) || value <= 0) return;

        if (!grouped[category]) grouped[category] = {};
        if (!grouped[category][year]) grouped[category][year] = [];

        grouped[category][year].push(value);
      });

      const categories = Object.keys(grouped).filter(category =>
        grouped[category][currentYearValue] || grouped[category][comparisonYearValue]
      );

      const allValues = [];

      categories.forEach(category => {
        [currentYearValue, comparisonYearValue].forEach(year => {
          if (grouped[category][year]) {
            allValues.push(...grouped[category][year]);
          }
        });
      });

      if (categories.length === 0 || allValues.length === 0) {
        chartEl.innerHTML = `
          <div class="cv-empty">
            No data for Current Year Value ${currentYearValue}
            and Comparison Year Value ${comparisonYearValue}.
          </div>
        `;
        return;
      }

      const margin = {
        top: 12,
        right: 18,
        bottom: width < 600 ? 42 : 34,
        left: 62
      };

      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      const svg = d3
        .select(chartEl)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

      const yMin = d3.min(allValues);
      const yMax = d3.max(allValues);
      const yPadding = (yMax - yMin) * 0.08 || 10;

      const y = d3
        .scaleLinear()
        .domain([Math.max(0, yMin - yPadding), yMax + yPadding])
        .range([margin.top + innerHeight, margin.top]);

      const x = d3
        .scaleBand()
        .domain(categories)
        .range([margin.left, margin.left + innerWidth])
        .padding(0.28);

      const yAxis = svg
        .append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).ticks(5));

      yAxis.selectAll("text")
        .style("fill", "rgba(255,255,255,.7)")
        .style("font-size", "10px");

      yAxis.selectAll("path,line")
        .style("stroke", "rgba(255,255,255,.22)");

      const xAxis = svg
        .append("g")
        .attr("transform", `translate(0,${margin.top + innerHeight})`)
        .call(d3.axisBottom(x));

      xAxis.selectAll("text")
        .style("fill", "white")
        .style("font-size", width < 600 ? "9px" : "10px")
        .style("font-weight", "800")
        .attr("transform", width < 600 ? "rotate(-35)" : "rotate(0)")
        .style("text-anchor", width < 600 ? "end" : "middle");

      xAxis.selectAll("path,line")
        .style("stroke", "rgba(255,255,255,.22)");

      const violinWidth = Math.max(8, Math.min(34, x.bandwidth() / 3.2));
      const sideOffset = Math.max(6, Math.min(22, x.bandwidth() / 5));

      const violinGroups = [];

      categories.forEach(category => {
        const pairs = [
          {
            year: currentYearValue,
            label: currentLabel,
            color: colors.current,
            side: "left",
            offset: -sideOffset
          },
          {
            year: comparisonYearValue,
            label: comparisonLabel,
            color: colors.comparison,
            side: "right",
            offset: sideOffset
          }
        ];

        pairs.forEach(pair => {
          const values = grouped[category][pair.year] || [];
          if (!values.length) return;

          const bins = d3
            .bin()
            .domain(y.domain())
            .thresholds(Math.max(12, Math.min(30, Math.round(innerHeight / 18))))(values);

          const maxDensity = d3.max(bins, d => d.length) || 1;

          const xDensity = d3
            .scaleLinear()
            .domain([0, maxDensity])
            .range([0, violinWidth]);

          let area;

          if (pair.side === "left") {
            area = d3
              .area()
              .x0(d => -xDensity(d.length))
              .x1(() => 0)
              .y(d => y((d.x0 + d.x1) / 2))
              .curve(d3.curveCatmullRom);
          } else {
            area = d3
              .area()
              .x0(() => 0)
              .x1(d => xDensity(d.length))
              .y(d => y((d.x0 + d.x1) / 2))
              .curve(d3.curveCatmullRom);
          }

          const cx = x(category) + x.bandwidth() / 2 + pair.offset;

          const group = svg
            .append("g")
            .attr("class", "cv-violin-group")
            .attr("transform", `translate(${cx},0)`)
            .style("cursor", "pointer");

          const median = d3.median(values);
          const avg = d3.mean(values);
          const min = d3.min(values);
          const max = d3.max(values);

          group
            .append("path")
            .datum(bins)
            .attr("d", area)
            .style("fill", pair.color)
            .style("opacity", 0.78)
            .style("stroke", pair.color)
            .style("stroke-width", 1.4)
            .on("mousemove", function(event) {
              const point = d3.pointer(event, chartEl);

              tooltipEl.style.opacity = 1;
              tooltipEl.style.left = point[0] + "px";
              tooltipEl.style.top = point[1] + "px";

              tooltipEl.innerHTML = `
                <strong>${category}</strong><br>
                ${pair.label} (${pair.year})<br><br>
                Count: ${values.length}<br>
                Avg: ${formatValue(avg)}<br>
                Median: ${formatValue(median)}<br>
                Min: ${formatValue(min)}<br>
                Max: ${formatValue(max)}
              `;
            })
            .on("mouseleave", function() {
              tooltipEl.style.opacity = 0;
            });

          group
            .append("line")
            .attr("x1", pair.side === "left" ? -violinWidth : 0)
            .attr("x2", pair.side === "left" ? 0 : violinWidth)
            .attr("y1", y(median))
            .attr("y2", y(median))
            .attr("stroke", "white")
            .attr("stroke-width", 2)
            .attr("opacity", 0.9);

          violinGroups.push(group);
        });
      });

      const groups = svg.selectAll(".cv-violin-group");

      groups.on("click", function(event) {
        event.stopPropagation();

        const current = d3.select(this);
        const isActive = current.classed("active");

        groups
          .classed("active", false)
          .transition()
          .duration(180)
          .style("opacity", 0.16);

        if (!isActive) {
          current
            .classed("active", true)
            .transition()
            .duration(180)
            .style("opacity", 1);
        } else {
          groups
            .transition()
            .duration(180)
            .style("opacity", 1);
        }
      });

      svg.on("click", function(event) {
        if (event.target.tagName === "svg") {
          groups
            .classed("active", false)
            .transition()
            .duration(180)
            .style("opacity", 1);
        }
      });
    }
  }
});
