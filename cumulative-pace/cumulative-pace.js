looker.plugins.visualizations.add({
  id: "cumulative_pace",
  label: "Cumulative Pace",

  options: {
    title: {
      type: "string",
      label: "Title",
      default: "Cumulative OTB Pace vs STLY"
    },
    selected_label: {
      type: "string",
      label: "Selected Year Label",
      default: "Selected Year"
    },
    comparison_label: {
      type: "string",
      label: "Comparison Label",
      default: "STLY"
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
        .cp-wrap {
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

        .cp-title {
          font-size: clamp(16px, 2.5vw, 30px);
          font-weight: 900;
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .cp-subtitle {
          font-size: clamp(10px, 1vw, 12px);
          color: rgba(255,255,255,0.55);
          margin-bottom: 12px;
        }

        .cp-chart {
          width: 100%;
          height: calc(100% - 58px);
          min-height: 180px;
          position: relative;
          overflow: hidden;
        }

        .cp-chart svg {
          width: 100%;
          height: 100%;
          display: block;
        }

        .cp-tooltip {
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

        .cp-empty {
          color: white;
          padding: 18px;
          font-size: 12px;
        }
      </style>

      <div class="cp-wrap">
        <div class="cp-title"></div>
        <div class="cp-subtitle">Cumulative OTB revenue pacing against Same Time Last Year</div>
        <div class="cp-chart"></div>
        <div class="cp-tooltip"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const titleEl = element.querySelector(".cp-title");
    const chartEl = element.querySelector(".cp-chart");
    const tooltipEl = element.querySelector(".cp-tooltip");

    titleEl.innerText = config.title || "Cumulative OTB Pace vs STLY";

    const dimensions = queryResponse.fields.dimension_like || [];
    const measures = queryResponse.fields.measure_like || [];

    if (!data || data.length === 0 || dimensions.length < 1 || measures.length < 2) {
      chartEl.innerHTML = `
        <div class="cp-empty">
          Add 1 date dimension and 2 measures.<br><br>
          Dimension: Stay Week / Stay Date<br>
          Measure 1: Selected Year Cumulative Revenue<br>
          Measure 2: STLY Cumulative Revenue
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
        chartEl.innerHTML = `<div class="cp-empty">Could not load D3 library.</div>`;
        done();
      });

    function render() {
      chartEl.innerHTML = "";

      const d3 = window.d3;

      const dateField = dimensions[0].name;
      const selectedField = measures[0].name;
      const comparisonField = measures[1].name;

      const parseDate = value => {
        if (value instanceof Date) return value;
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
      };

      const rows = data
        .map(row => {
          const rawDate = row[dateField]?.value || row[dateField]?.rendered;
          const date = parseDate(rawDate);

          return {
            date,
            selected: Number(row[selectedField]?.value || 0),
            comparison: Number(row[comparisonField]?.value || 0),
            renderedDate: row[dateField]?.rendered || rawDate,
            selectedRendered: row[selectedField]?.rendered || null,
            comparisonRendered: row[comparisonField]?.rendered || null
          };
        })
        .filter(row => row.date)
        .sort((a, b) => a.date - b.date);

      if (!rows.length) {
        chartEl.innerHTML = `<div class="cp-empty">No valid date data found.</div>`;
        return;
      }

      const bounds = chartEl.getBoundingClientRect();
      const width = Math.max(bounds.width, 320);
      const height = Math.max(bounds.height, 180);

      const margin = {
        top: 20,
        right: 24,
        bottom: width < 600 ? 48 : 34,
        left: 64
      };

      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      const svg = d3
        .select(chartEl)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

      const prefix = config.value_prefix || "€";

      function formatValue(v) {
        const abs = Math.abs(Number(v || 0));
        const sign = v < 0 ? "-" : "";

        if (abs >= 1000000) return sign + prefix + (abs / 1000000).toFixed(1) + "M";
        if (abs >= 1000) return sign + prefix + (abs / 1000).toFixed(0) + "K";

        return sign + prefix + abs.toLocaleString(undefined, {
          maximumFractionDigits: 0
        });
      }

      function formatPct(v) {
        if (!isFinite(v)) return "-";
        return (v > 0 ? "+" : "") + v.toFixed(1) + "%";
      }

      const x = d3
        .scaleTime()
        .domain(d3.extent(rows, d => d.date))
        .range([margin.left, margin.left + innerWidth]);

      const maxValue = d3.max(rows, d => Math.max(d.selected, d.comparison)) || 1;

      const y = d3
        .scaleLinear()
        .domain([0, maxValue * 1.08])
        .range([margin.top + innerHeight, margin.top]);

      const defs = svg.append("defs");

      const selectedGlow = defs.append("filter")
        .attr("id", "cp-selected-glow")
        .attr("x", "-50%")
        .attr("y", "-50%")
        .attr("width", "200%")
        .attr("height", "200%");

      selectedGlow.append("feGaussianBlur")
        .attr("stdDeviation", 3)
        .attr("result", "blur");

      selectedGlow.append("feMerge")
        .html(`
          <feMergeNode in="blur"></feMergeNode>
          <feMergeNode in="SourceGraphic"></feMergeNode>
        `);

      const areaGradient = defs.append("linearGradient")
        .attr("id", "cp-area-gradient")
        .attr("x1", "0")
        .attr("x2", "0")
        .attr("y1", "0")
        .attr("y2", "1");

      areaGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#36a9d6")
        .attr("stop-opacity", 0.22);

      areaGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#36a9d6")
        .attr("stop-opacity", 0);

      const grid = svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(
          d3.axisLeft(y)
            .ticks(5)
            .tickSize(-innerWidth)
            .tickFormat("")
        );

      grid.selectAll("line")
        .style("stroke", "rgba(255,255,255,0.06)");

      grid.select("path").remove();

      const xAxis = svg.append("g")
        .attr("transform", `translate(0,${margin.top + innerHeight})`)
        .call(
          d3.axisBottom(x)
            .ticks(width < 600 ? 4 : 8)
            .tickFormat(d3.timeFormat("%d %b"))
        );

      xAxis.selectAll("text")
        .style("fill", "rgba(255,255,255,0.62)")
        .style("font-size", width < 600 ? "9px" : "10px")
        .attr("transform", width < 600 ? "rotate(-32)" : "rotate(-18)")
        .style("text-anchor", "end");

      xAxis.selectAll("path,line")
        .style("stroke", "rgba(255,255,255,0.14)");

      const yAxis = svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(
          d3.axisLeft(y)
            .ticks(5)
            .tickFormat(d => formatValue(d))
        );

      yAxis.selectAll("text")
        .style("fill", "rgba(255,255,255,0.62)")
        .style("font-size", "10px");

      yAxis.selectAll("path,line")
        .style("stroke", "rgba(255,255,255,0.14)");

      const lineSelected = d3.line()
        .x(d => x(d.date))
        .y(d => y(d.selected))
        .curve(d3.curveMonotoneX);

      const lineComparison = d3.line()
        .x(d => x(d.date))
        .y(d => y(d.comparison))
        .curve(d3.curveMonotoneX);

      const areaSelected = d3.area()
        .x(d => x(d.date))
        .y0(y(0))
        .y1(d => y(d.selected))
        .curve(d3.curveMonotoneX);

      svg.append("path")
        .datum(rows)
        .attr("d", areaSelected)
        .attr("fill", "url(#cp-area-gradient)");

      svg.append("path")
        .datum(rows)
        .attr("d", lineComparison)
        .attr("fill", "none")
        .attr("stroke", "#7bc8e6")
        .attr("stroke-width", 2.6)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("opacity", 0.55);

      svg.append("path")
        .datum(rows)
        .attr("d", lineSelected)
        .attr("fill", "none")
        .attr("stroke", "#36a9d6")
        .attr("stroke-width", 3.4)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("filter", "url(#cp-selected-glow)");

      const legend = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top - 6})`);

      legend.append("circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", 5)
        .attr("fill", "#36a9d6");

      legend.append("text")
        .attr("x", 10)
        .attr("y", 4)
        .text(config.selected_label || "Selected Year")
        .style("fill", "rgba(255,255,255,0.7)")
        .style("font-size", "10px")
        .style("font-weight", 700);

      legend.append("circle")
        .attr("cx", 116)
        .attr("cy", 0)
        .attr("r", 5)
        .attr("fill", "#7bc8e6")
        .attr("opacity", 0.65);

      legend.append("text")
        .attr("x", 126)
        .attr("y", 4)
        .text(config.comparison_label || "STLY")
        .style("fill", "rgba(255,255,255,0.7)")
        .style("font-size", "10px")
        .style("font-weight", 700);

      const hoverLine = svg.append("line")
        .attr("y1", margin.top)
        .attr("y2", margin.top + innerHeight)
        .attr("stroke", "rgba(255,255,255,0.22)")
        .attr("stroke-width", 1)
        .attr("opacity", 0);

      const selectedDot = svg.append("circle")
        .attr("r", 5)
        .attr("fill", "#36a9d6")
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 2)
        .attr("opacity", 0);

      const comparisonDot = svg.append("circle")
        .attr("r", 5)
        .attr("fill", "#7bc8e6")
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 2)
        .attr("opacity", 0);

      const overlay = svg.append("rect")
        .attr("x", margin.left)
        .attr("y", margin.top)
        .attr("width", innerWidth)
        .attr("height", innerHeight)
        .attr("fill", "transparent")
        .style("cursor", "crosshair");

      const bisect = d3.bisector(d => d.date).left;

      overlay
        .on("mousemove", function(event) {
          const [mx] = d3.pointer(event);
          const date = x.invert(mx);
          const index = bisect(rows, date, 1);
          const a = rows[index - 1];
          const b = rows[index];
          const d = b && (date - a.date > b.date - date) ? b : a;

          if (!d) return;

          const cx = x(d.date);
          const selectedY = y(d.selected);
          const comparisonY = y(d.comparison);

          hoverLine
            .attr("x1", cx)
            .attr("x2", cx)
            .attr("opacity", 1);

          selectedDot
            .attr("cx", cx)
            .attr("cy", selectedY)
            .attr("opacity", 1);

          comparisonDot
            .attr("cx", cx)
            .attr("cy", comparisonY)
            .attr("opacity", 1);

          const variance = d.selected - d.comparison;
          const variancePct = d.comparison ? (variance / d.comparison) * 100 : null;

          const insight = variance >= 0
            ? "Pacing ahead of STLY"
            : "Pacing behind STLY";

          tooltipEl.style.opacity = 1;
          tooltipEl.style.left = Math.min(cx + 16, width - 220) + "px";
          tooltipEl.style.top = Math.max(Math.min(selectedY, comparisonY) - 12, 20) + "px";

          tooltipEl.innerHTML = `
            <strong>${d3.timeFormat("%d %b %Y")(d.date)}</strong><br>
            ${config.selected_label || "Selected Year"}: <strong>${formatValue(d.selected)}</strong><br>
            ${config.comparison_label || "STLY"}: <strong>${formatValue(d.comparison)}</strong><br>
            Variance: <strong style="color:${variance >= 0 ? "#74d17c" : "#ef3d2f"};">
              ${variance >= 0 ? "+" : ""}${formatValue(variance)}
            </strong><br>
            Variance %: <strong>${variancePct === null ? "-" : formatPct(variancePct)}</strong><br>
            <span style="color:${variance >= 0 ? "#74d17c" : "#ef3d2f"};">
              ${insight}
            </span>
          `;
        })
        .on("mouseleave", function() {
          hoverLine.attr("opacity", 0);
          selectedDot.attr("opacity", 0);
          comparisonDot.attr("opacity", 0);
          tooltipEl.style.opacity = 0;
        });
    }
  }
});
