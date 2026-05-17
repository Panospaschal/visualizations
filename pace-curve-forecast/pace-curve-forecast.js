looker.plugins.visualizations.add({
  id: "pace_curve_forecast",
  label: "Pace Curve vs STLY vs Forecast",

  options: {
    title: {
      type: "string",
      label: "Title",
      default: "Pace Curve vs STLY vs Forecast"
    },
    subtitle: {
      type: "string",
      label: "Subtitle",
      default: "OTB revenue pace, historical benchmark and forecast trajectory"
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
        .pcf-wrap {
          width: 100%;
          height: 100%;
          min-height: 0;
          background:
            radial-gradient(circle at top right, rgba(54,169,214,0.18), transparent 34%),
            radial-gradient(circle at bottom left, rgba(233,95,184,0.13), transparent 36%),
            #030303;
          color: white;
          font-family: Inter, Arial, sans-serif;
          padding: clamp(10px, 1.8vw, 28px);
          box-sizing: border-box;
          overflow: hidden;
          position: relative;
        }

        .pcf-wrap::before {
          content: "";
          position: absolute;
          inset: clamp(8px, 1.2vw, 18px);
          border-radius: 22px;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.08);
          pointer-events: none;
          box-shadow:
            0 0 32px rgba(54,169,214,0.08),
            inset 0 0 24px rgba(255,255,255,0.02);
        }

        .pcf-header {
          position: relative;
          z-index: 2;
        }

        .pcf-title {
          font-size: clamp(16px, 2.5vw, 30px);
          font-weight: 950;
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: -0.03em;
        }

        .pcf-subtitle {
          font-size: clamp(10px, 1vw, 12px);
          color: rgba(255,255,255,0.55);
          margin-bottom: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .pcf-chart {
          width: 100%;
          height: calc(100% - 58px);
          min-height: 180px;
          position: relative;
          overflow: hidden;
          z-index: 2;
        }

        .pcf-chart svg {
          width: 100%;
          height: 100%;
          display: block;
        }

        .pcf-tooltip {
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
          max-width: 320px;
        }

        .pcf-empty {
          color: white;
          padding: 18px;
          font-size: 12px;
        }
      </style>

      <div class="pcf-wrap">
        <div class="pcf-header">
          <div class="pcf-title"></div>
          <div class="pcf-subtitle"></div>
        </div>
        <div class="pcf-chart"></div>
        <div class="pcf-tooltip"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const titleEl = element.querySelector(".pcf-title");
    const subtitleEl = element.querySelector(".pcf-subtitle");
    const chartEl = element.querySelector(".pcf-chart");
    const tooltipEl = element.querySelector(".pcf-tooltip");

    titleEl.innerText = config.title || "Pace Curve vs STLY vs Forecast";
    subtitleEl.innerText = config.subtitle || "OTB revenue pace, historical benchmark and forecast trajectory";

    const dimensions = queryResponse.fields.dimension_like || [];
    const measures = queryResponse.fields.measure_like || [];

    if (!data || data.length === 0 || dimensions.length < 1 || measures.length < 4) {
      chartEl.innerHTML = `
        <div class="pcf-empty">
          Add 1 date dimension and 4 measures.<br><br>
          Dimension: Stay Date / Stay Week<br>
          Measure 1: Current Year OTB Revenue<br>
          Measure 2: STLY OTB Revenue<br>
          Measure 3: Final Last Year Actual Revenue<br>
          Measure 4: Forecast Projection
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
        chartEl.innerHTML = `<div class="pcf-empty">Could not load D3 library.</div>`;
        done();
      });

    function render() {
      chartEl.innerHTML = "";

      const d3 = window.d3;

      const dateField = dimensions[0].name;
      const currentField = measures[0].name;
      const stlyField = measures[1].name;
      const lyActualField = measures[2].name;
      const forecastField = measures[3].name;

      const prefix = config.value_prefix || "€";

      function parseDate(value) {
        if (value instanceof Date) return value;
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
      }

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

      function formatPct(v) {
        if (!isFinite(v)) return "-";
        return (v > 0 ? "+" : "") + v.toFixed(1) + "%";
      }

      const rows = data
        .map(row => {
          const rawDate = row[dateField]?.value || row[dateField]?.rendered;
          const date = parseDate(rawDate);

          return {
            date,
            renderedDate: clean(row[dateField]?.rendered) || rawDate,
            current: Number(row[currentField]?.value || 0),
            stly: Number(row[stlyField]?.value || 0),
            lyActual: Number(row[lyActualField]?.value || 0),
            forecast: Number(row[forecastField]?.value || 0),
            currentRendered: row[currentField]?.rendered || null,
            stlyRendered: row[stlyField]?.rendered || null,
            lyActualRendered: row[lyActualField]?.rendered || null,
            forecastRendered: row[forecastField]?.rendered || null
          };
        })
        .filter(row => row.date)
        .sort((a, b) => a.date - b.date);

      if (!rows.length) {
        chartEl.innerHTML = `<div class="pcf-empty">No valid pace curve data found.</div>`;
        return;
      }

      const bounds = chartEl.getBoundingClientRect();
      const width = Math.max(bounds.width, 320);
      const height = Math.max(bounds.height, 180);

      const margin = {
        top: 24,
        right: 28,
        bottom: width < 600 ? 58 : 48,
        left: 68
      };

      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      const svg = d3
        .select(chartEl)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

      const allValues = rows.flatMap(d => [
        d.current,
        d.stly,
        d.lyActual,
        d.forecast
      ]);

      const maxValue = d3.max(allValues) || 1;

      const x = d3.scaleTime()
        .domain(d3.extent(rows, d => d.date))
        .range([margin.left, margin.left + innerWidth]);

      const y = d3.scaleLinear()
        .domain([0, maxValue * 1.12])
        .range([margin.top + innerHeight, margin.top]);

      const defs = svg.append("defs");

      const cyanGlow = defs.append("filter")
        .attr("id", "pcf-cyan-glow")
        .attr("x", "-80%")
        .attr("y", "-80%")
        .attr("width", "260%")
        .attr("height", "260%");

      cyanGlow.append("feGaussianBlur")
        .attr("stdDeviation", 4)
        .attr("result", "blur");

      cyanGlow.append("feColorMatrix")
        .attr("in", "blur")
        .attr("type", "matrix")
        .attr("values", "0 0 0 0 0.22  0 0 0 0 0.66  0 0 0 0 0.84  0 0 0 0.9 0")
        .attr("result", "glow");

      cyanGlow.append("feMerge")
        .html(`
          <feMergeNode in="glow"></feMergeNode>
          <feMergeNode in="SourceGraphic"></feMergeNode>
        `);

      const forecastGlow = defs.append("filter")
        .attr("id", "pcf-forecast-glow")
        .attr("x", "-80%")
        .attr("y", "-80%")
        .attr("width", "260%")
        .attr("height", "260%");

      forecastGlow.append("feGaussianBlur")
        .attr("stdDeviation", 4)
        .attr("result", "blur");

      forecastGlow.append("feColorMatrix")
        .attr("in", "blur")
        .attr("type", "matrix")
        .attr("values", "0 0 0 0 0.91  0 0 0 0 0.37  0 0 0 0 0.72  0 0 0 0.85 0")
        .attr("result", "glow");

      forecastGlow.append("feMerge")
        .html(`
          <feMergeNode in="glow"></feMergeNode>
          <feMergeNode in="SourceGraphic"></feMergeNode>
        `);

      const forecastGradient = defs.append("linearGradient")
        .attr("id", "pcf-forecast-gradient")
        .attr("gradientUnits", "userSpaceOnUse")
        .attr("x1", margin.left)
        .attr("x2", margin.left + innerWidth);

      forecastGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#b994ff");

      forecastGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#e95fb8");

      const areaGradient = defs.append("linearGradient")
        .attr("id", "pcf-current-area")
        .attr("x1", "0")
        .attr("x2", "0")
        .attr("y1", "0")
        .attr("y2", "1");

      areaGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#36a9d6")
        .attr("stop-opacity", 0.18);

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
        .style("stroke", "rgba(255,255,255,0.055)");

      grid.select("path").remove();

      const xAxis = svg.append("g")
        .attr("transform", `translate(0,${margin.top + innerHeight})`)
        .call(
          d3.axisBottom(x)
            .ticks(width < 600 ? 4 : 8)
            .tickFormat(d3.timeFormat("%d %b"))
        );

      xAxis.selectAll("text")
        .style("fill", "rgba(255,255,255,0.60)")
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
            .tickFormat(d => formatCurrency(d))
        );

      yAxis.selectAll("text")
        .style("fill", "rgba(255,255,255,0.60)")
        .style("font-size", "10px");

      yAxis.selectAll("path,line")
        .style("stroke", "rgba(255,255,255,0.14)");

      const line = key => d3.line()
        .defined(d => isFinite(d[key]))
        .x(d => x(d.date))
        .y(d => y(d[key]))
        .curve(d3.curveMonotoneX);

      const areaCurrent = d3.area()
        .x(d => x(d.date))
        .y0(y(0))
        .y1(d => y(d.current))
        .curve(d3.curveMonotoneX);

      svg.append("path")
        .datum(rows)
        .attr("d", areaCurrent)
        .attr("fill", "url(#pcf-current-area)");

      svg.append("path")
        .datum(rows)
        .attr("d", line("lyActual"))
        .attr("fill", "none")
        .attr("stroke", "rgba(255,255,255,0.42)")
        .attr("stroke-width", 2)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("opacity", 0.65);

      svg.append("path")
        .datum(rows)
        .attr("d", line("stly"))
        .attr("fill", "none")
        .attr("stroke", "#7bc8e6")
        .attr("stroke-width", 2.2)
        .attr("stroke-dasharray", "6 6")
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("opacity", 0.72);

      svg.append("path")
        .datum(rows)
        .attr("d", line("forecast"))
        .attr("fill", "none")
        .attr("stroke", "url(#pcf-forecast-gradient)")
        .attr("stroke-width", 3)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("filter", "url(#pcf-forecast-glow)")
        .attr("opacity", 0.96);

      svg.append("path")
        .datum(rows)
        .attr("d", line("current"))
        .attr("fill", "none")
        .attr("stroke", "#36a9d6")
        .attr("stroke-width", 3.6)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("filter", "url(#pcf-cyan-glow)");

      const hoverLine = svg.append("line")
        .attr("y1", margin.top)
        .attr("y2", margin.top + innerHeight)
        .attr("stroke", "rgba(255,255,255,0.24)")
        .attr("stroke-width", 1)
        .attr("opacity", 0);

      const dotData = [
        { key: "current", color: "#36a9d6" },
        { key: "stly", color: "#7bc8e6" },
        { key: "lyActual", color: "rgba(255,255,255,0.65)" },
        { key: "forecast", color: "#e95fb8" }
      ];

      const hoverDots = svg.append("g")
        .selectAll("circle")
        .data(dotData)
        .enter()
        .append("circle")
        .attr("r", 4.8)
        .attr("fill", d => d.color)
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1.5)
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
          const d = b && a && (date - a.date > b.date - date) ? b : a;

          if (!d) return;

          const cx = x(d.date);

          hoverLine
            .attr("x1", cx)
            .attr("x2", cx)
            .attr("opacity", 1);

          hoverDots
            .attr("cx", dot => cx)
            .attr("cy", dot => y(d[dot.key]))
            .attr("opacity", dot => isFinite(d[dot.key]) ? 1 : 0);

          const variance = d.current - d.stly;
          const variancePct = d.stly ? (variance / d.stly) * 100 : null;

          const forecastGap = d.forecast - d.current;
          const forecastGapPct = d.current ? (forecastGap / d.current) * 100 : null;

          const insight = variance >= 0
            ? "Current pace is ahead of STLY"
            : "Current pace is behind STLY";

          const forecastInsight = forecastGap >= 0
            ? "Forecast indicates further upside"
            : "Forecast indicates downside risk";

          tooltipEl.style.opacity = 1;
          tooltipEl.style.left = Math.min(cx + 16, width - 290) + "px";
          tooltipEl.style.top = Math.max(y(Math.max(d.current, d.forecast, d.stly)) - 18, 20) + "px";

          tooltipEl.innerHTML = `
            <strong>${d3.timeFormat("%d %b %Y")(d.date)}</strong><br>
            Current OTB: <strong style="color:#36a9d6;">${d.currentRendered || formatCurrency(d.current)}</strong><br>
            STLY OTB: <strong style="color:#7bc8e6;">${d.stlyRendered || formatCurrency(d.stly)}</strong><br>
            Final LY Actual: <strong style="color:rgba(255,255,255,0.70);">${d.lyActualRendered || formatCurrency(d.lyActual)}</strong><br>
            Forecast: <strong style="color:#e95fb8;">${d.forecastRendered || formatCurrency(d.forecast)}</strong><br>
            Variance vs STLY: <strong style="color:${variance >= 0 ? "#74d17c" : "#ef3d2f"};">
              ${variance >= 0 ? "+" : ""}${formatCurrency(variance)}
              ${variancePct === null ? "" : " (" + formatPct(variancePct) + ")"}
            </strong><br>
            Forecast Gap: <strong style="color:${forecastGap >= 0 ? "#74d17c" : "#ef3d2f"};">
              ${forecastGap >= 0 ? "+" : ""}${formatCurrency(forecastGap)}
              ${forecastGapPct === null ? "" : " (" + formatPct(forecastGapPct) + ")"}
            </strong><br>
            <span style="color:${variance >= 0 ? "#74d17c" : "#ef3d2f"};">${insight}</span><br>
            <span style="color:${forecastGap >= 0 ? "#b994ff" : "#ef3d2f"};">${forecastInsight}</span>
          `;
        })
        .on("mouseleave", function() {
          hoverLine.attr("opacity", 0);
          hoverDots.attr("opacity", 0);
          tooltipEl.style.opacity = 0;
        });

      const legendItems = [
        { label: "Current Year OTB", color: "#36a9d6", type: "solid" },
        { label: "STLY OTB", color: "#7bc8e6", type: "dash" },
        { label: "Final LY Actual", color: "rgba(255,255,255,0.55)", type: "solid" },
        { label: "Forecast", color: "#e95fb8", type: "gradient" }
      ];

      const legend = svg.append("g")
        .attr("transform", `translate(${margin.left + innerWidth / 2},${height - 10})`);

      const itemWidth = width < 650 ? 86 : 128;
      const totalLegendWidth = itemWidth * legendItems.length;
      let startX = -totalLegendWidth / 2;

      legendItems.forEach((item, i) => {
        const g = legend.append("g")
          .attr("transform", `translate(${startX + i * itemWidth},0)`);

        g.append("line")
          .attr("x1", 0)
          .attr("x2", 18)
          .attr("y1", -4)
          .attr("y2", -4)
          .attr("stroke", item.type === "gradient" ? "#e95fb8" : item.color)
          .attr("stroke-width", 3)
          .attr("stroke-dasharray", item.type === "dash" ? "4 4" : "0")
          .attr("stroke-linecap", "round");

        g.append("text")
          .attr("x", 24)
          .attr("y", 0)
          .text(width < 650 ? item.label.replace(" Year", "").replace(" Actual", "") : item.label)
          .style("fill", "rgba(255,255,255,0.68)")
          .style("font-size", width < 650 ? "8px" : "10px")
          .style("font-weight", 800);
      });
    }
  }
});
