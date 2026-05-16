looker.plugins.visualizations.add({
  id: "pace_variance_line",
  label: "Pace Variance Line",

  options: {
    title: {
      type: "string",
      label: "Title",
      default: "Pace Variance vs STLY"
    },
    value_prefix: {
      type: "string",
      label: "Value Prefix",
      default: "€"
    },
    positive_label: {
      type: "string",
      label: "Positive Insight",
      default: "Pickup ahead of STLY"
    },
    negative_label: {
      type: "string",
      label: "Negative Insight",
      default: "Demand softening"
    }
  },

  create: function(element) {
    element.innerHTML = `
      <style>
        .pv-wrap {
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

        .pv-title {
          font-size: clamp(16px, 2.5vw, 30px);
          font-weight: 900;
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .pv-subtitle {
          font-size: clamp(10px, 1vw, 12px);
          color: rgba(255,255,255,0.55);
          margin-bottom: 12px;
        }

        .pv-chart {
          width: 100%;
          height: calc(100% - 58px);
          min-height: 180px;
          position: relative;
          overflow: hidden;
        }

        .pv-chart svg {
          width: 100%;
          height: 100%;
          display: block;
        }

        .pv-tooltip {
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
          max-width: 260px;
        }

        .pv-empty {
          color: white;
          padding: 18px;
          font-size: 12px;
        }
      </style>

      <div class="pv-wrap">
        <div class="pv-title"></div>
        <div class="pv-subtitle">Daily revenue variance against Same Time Last Year</div>
        <div class="pv-chart"></div>
        <div class="pv-tooltip"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const titleEl = element.querySelector(".pv-title");
    const chartEl = element.querySelector(".pv-chart");
    const tooltipEl = element.querySelector(".pv-tooltip");

    titleEl.innerText = config.title || "Pace Variance vs STLY";

    const dimensions = queryResponse.fields.dimension_like || [];
    const measures = queryResponse.fields.measure_like || [];

    if (!data || data.length === 0 || dimensions.length < 1 || measures.length < 1) {
      chartEl.innerHTML = `
        <div class="pv-empty">
          Add 1 date dimension and 1 variance measure.<br><br>
          Example:<br>
          Stay Date + Revenue Variance vs STLY
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
        chartEl.innerHTML = `<div class="pv-empty">Could not load D3 library.</div>`;
        done();
      });

    function render() {
      chartEl.innerHTML = "";

      const d3 = window.d3;

      const dateField = dimensions[0].name;
      const valueField = measures[0].name;
      const pctField = measures.length > 1 ? measures[1].name : null;

      const parseDate = value => {
        if (value instanceof Date) return value;
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
      };

      const rows = data
        .map(row => {
          const rawDate = row[dateField]?.value || row[dateField]?.rendered;
          const date = parseDate(rawDate);
          const value = Number(row[valueField]?.value || 0);
          const pct = pctField ? Number(row[pctField]?.value || 0) : null;

          return {
            date,
            value,
            pct,
            renderedDate: row[dateField]?.rendered || rawDate,
            renderedValue: row[valueField]?.rendered || null,
            renderedPct: pctField ? row[pctField]?.rendered : null
          };
        })
        .filter(row => row.date && isFinite(row.value))
        .sort((a, b) => a.date - b.date);

      if (!rows.length) {
        chartEl.innerHTML = `<div class="pv-empty">No valid date / variance data found.</div>`;
        return;
      }

      const bounds = chartEl.getBoundingClientRect();
      const width = Math.max(bounds.width, 320);
      const height = Math.max(bounds.height, 180);

      const margin = {
        top: 18,
        right: 22,
        bottom: width < 600 ? 48 : 34,
        left: 62
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
        const abs = Math.abs(v);

        if (abs >= 1000000) {
          return (v < 0 ? "-" : "") + prefix + (abs / 1000000).toFixed(1) + "M";
        }

        if (abs >= 1000) {
          return (v < 0 ? "-" : "") + prefix + (abs / 1000).toFixed(0) + "K";
        }

        return (v < 0 ? "-" : "") + prefix + abs.toLocaleString(undefined, {
          maximumFractionDigits: 0
        });
      }

      function formatPct(v) {
        if (v === null || v === undefined || !isFinite(v)) return "";
        if (Math.abs(v) <= 1) return (v * 100).toFixed(1) + "%";
        return v.toFixed(1) + "%";
      }

      const x = d3
        .scaleTime()
        .domain(d3.extent(rows, d => d.date))
        .range([margin.left, margin.left + innerWidth]);

      const maxAbs = d3.max(rows, d => Math.abs(d.value)) || 1;

      const y = d3
        .scaleLinear()
        .domain([-maxAbs * 1.12, maxAbs * 1.12])
        .range([margin.top + innerHeight, margin.top]);

      const zeroY = y(0);

      const defs = svg.append("defs");

      const positiveGradient = defs
        .append("linearGradient")
        .attr("id", "pv-positive-gradient")
        .attr("x1", "0")
        .attr("x2", "0")
        .attr("y1", "0")
        .attr("y2", "1");

      positiveGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#74d17c")
        .attr("stop-opacity", 0.28);

      positiveGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#74d17c")
        .attr("stop-opacity", 0);

      const negativeGradient = defs
        .append("linearGradient")
        .attr("id", "pv-negative-gradient")
        .attr("x1", "0")
        .attr("x2", "0")
        .attr("y1", "0")
        .attr("y2", "1");

      negativeGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#ef3d2f")
        .attr("stop-opacity", 0);

      negativeGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#ef3d2f")
        .attr("stop-opacity", 0.28);

      const clipPositive = defs.append("clipPath").attr("id", "pv-clip-positive");
      clipPositive.append("rect")
        .attr("x", margin.left)
        .attr("y", margin.top)
        .attr("width", innerWidth)
        .attr("height", Math.max(0, zeroY - margin.top));

      const clipNegative = defs.append("clipPath").attr("id", "pv-clip-negative");
      clipNegative.append("rect")
        .attr("x", margin.left)
        .attr("y", zeroY)
        .attr("width", innerWidth)
        .attr("height", Math.max(0, margin.top + innerHeight - zeroY));

      const areaPositive = d3
        .area()
        .x(d => x(d.date))
        .y0(zeroY)
        .y1(d => y(d.value))
        .curve(d3.curveMonotoneX);

      const areaNegative = d3
        .area()
        .x(d => x(d.date))
        .y0(zeroY)
        .y1(d => y(d.value))
        .curve(d3.curveMonotoneX);

      svg.append("path")
        .datum(rows)
        .attr("d", areaPositive)
        .attr("clip-path", "url(#pv-clip-positive)")
        .attr("fill", "url(#pv-positive-gradient)");

      svg.append("path")
        .datum(rows)
        .attr("d", areaNegative)
        .attr("clip-path", "url(#pv-clip-negative)")
        .attr("fill", "url(#pv-negative-gradient)");

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

      svg.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(${margin.left},0)`)
        .call(
          d3.axisLeft(y)
            .ticks(5)
            .tickSize(-innerWidth)
            .tickFormat("")
        )
        .selectAll("line")
        .style("stroke", "rgba(255,255,255,0.06)");

      svg.select(".grid path").remove();

      svg.append("line")
        .attr("x1", margin.left)
        .attr("x2", margin.left + innerWidth)
        .attr("y1", zeroY)
        .attr("y2", zeroY)
        .attr("stroke", "rgba(255,255,255,0.42)")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4 5");

      const line = d3
        .line()
        .x(d => x(d.date))
        .y(d => y(d.value))
        .curve(d3.curveMonotoneX);

      svg.append("path")
        .datum(rows)
        .attr("d", line)
        .attr("clip-path", "url(#pv-clip-positive)")
        .attr("fill", "none")
        .attr("stroke", "#74d17c")
        .attr("stroke-width", 3)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round");

      svg.append("path")
        .datum(rows)
        .attr("d", line)
        .attr("clip-path", "url(#pv-clip-negative)")
        .attr("fill", "none")
        .attr("stroke", "#ef3d2f")
        .attr("stroke-width", 3)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round");

      const hoverLine = svg.append("line")
        .attr("y1", margin.top)
        .attr("y2", margin.top + innerHeight)
        .attr("stroke", "rgba(255,255,255,0.22)")
        .attr("stroke-width", 1)
        .attr("opacity", 0);

      const hoverDot = svg.append("circle")
        .attr("r", 5)
        .attr("fill", "#ffffff")
        .attr("stroke-width", 3)
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
          const cy = y(d.value);

          hoverLine
            .attr("x1", cx)
            .attr("x2", cx)
            .attr("opacity", 1);

          hoverDot
            .attr("cx", cx)
            .attr("cy", cy)
            .attr("stroke", d.value >= 0 ? "#74d17c" : "#ef3d2f")
            .attr("opacity", 1);

          tooltipEl.style.opacity = 1;
          tooltipEl.style.left = Math.min(cx + 16, width - 180) + "px";
          tooltipEl.style.top = Math.max(cy - 16, 20) + "px";

          const insight = d.value >= 0
            ? (config.positive_label || "Pickup ahead of STLY")
            : (config.negative_label || "Demand softening");

          tooltipEl.innerHTML = `
            <strong>${d3.timeFormat("%d %b %Y")(d.date)}</strong><br>
            Variance: <strong>${formatValue(d.value)}</strong><br>
            ${pctField ? `Variance %: <strong>${d.renderedPct || formatPct(d.pct)}</strong><br>` : ""}
            <span style="color:${d.value >= 0 ? "#74d17c" : "#ef3d2f"};">
              ${insight}
            </span>
          `;
        })
        .on("mouseleave", function() {
          hoverLine.attr("opacity", 0);
          hoverDot.attr("opacity", 0);
          tooltipEl.style.opacity = 0;
        });

      const legend = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top - 4})`);

      legend.append("circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", 5)
        .attr("fill", "#74d17c");

      legend.append("text")
        .attr("x", 10)
        .attr("y", 4)
        .text("Ahead")
        .style("fill", "rgba(255,255,255,0.65)")
        .style("font-size", "10px")
        .style("font-weight", 700);

      legend.append("circle")
        .attr("cx", 64)
        .attr("cy", 0)
        .attr("r", 5)
        .attr("fill", "#ef3d2f");

      legend.append("text")
        .attr("x", 74)
        .attr("y", 4)
        .text("Behind")
        .style("fill", "rgba(255,255,255,0.65)")
        .style("font-size", "10px")
        .style("font-weight", 700);
    }
  }
});
