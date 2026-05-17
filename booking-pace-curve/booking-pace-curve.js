looker.plugins.visualizations.add({
  id: "booking_pace_curve",
  label: "Booking Pace Curve",

  options: {
    title: {
      type: "string",
      label: "Title",
      default: "Booking Pace Curve"
    },
    subtitle: {
      type: "string",
      label: "Subtitle",
      default: "Cumulative booking pace versus same time last year"
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
        .bpc-wrap {
          width: 100%;
          height: 100%;
          min-height: 0;
          background:
            radial-gradient(circle at top right, rgba(54,169,214,0.18), transparent 34%),
            radial-gradient(circle at bottom left, rgba(233,95,184,0.15), transparent 38%),
            #030303;
          color: white;
          font-family: Inter, Arial, sans-serif;
          padding: clamp(10px, 1.8vw, 28px);
          box-sizing: border-box;
          overflow: hidden;
          position: relative;
        }

        .bpc-wrap::before {
          content: "";
          position: absolute;
          inset: clamp(8px, 1.2vw, 18px);
          border-radius: 22px;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow:
            0 0 34px rgba(54,169,214,0.08),
            inset 0 0 24px rgba(255,255,255,0.018);
          pointer-events: none;
        }

        .bpc-header {
          position: relative;
          z-index: 2;
        }

        .bpc-title {
          font-size: clamp(16px, 2.5vw, 30px);
          font-weight: 950;
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: -0.03em;
        }

        .bpc-subtitle {
          font-size: clamp(10px, 1vw, 12px);
          color: rgba(255,255,255,0.55);
          margin-bottom: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .bpc-chart {
          position: relative;
          z-index: 2;
          width: 100%;
          height: calc(100% - 58px);
          min-height: 180px;
          overflow: hidden;
        }

        .bpc-chart svg {
          width: 100%;
          height: 100%;
          display: block;
        }

        .bpc-tooltip {
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

        .bpc-empty {
          color: white;
          padding: 18px;
          font-size: 12px;
          line-height: 1.55;
        }
      </style>

      <div class="bpc-wrap">
        <div class="bpc-header">
          <div class="bpc-title"></div>
          <div class="bpc-subtitle"></div>
        </div>
        <div class="bpc-chart"></div>
        <div class="bpc-tooltip"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const titleEl = element.querySelector(".bpc-title");
    const subtitleEl = element.querySelector(".bpc-subtitle");
    const chartEl = element.querySelector(".bpc-chart");
    const tooltipEl = element.querySelector(".bpc-tooltip");

    titleEl.innerText = config.title || "Booking Pace Curve";
    subtitleEl.innerText = config.subtitle || "Cumulative booking pace versus same time last year";

    const dimensions = queryResponse.fields.dimension_like || [];
    const measures = queryResponse.fields.measure_like || [];

    if (!data || data.length === 0 || dimensions.length < 1 || measures.length < 2) {
      chartEl.innerHTML = `
        <div class="bpc-empty">
          Add 1 booking-window dimension and 2 measures.<br><br>
          Dimension:<br>
          • Booking Window Days Before Arrival<br><br>
          Measures, any order:<br>
          • Current Year Cumulative Revenue<br>
          • STLY Cumulative Revenue
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
        chartEl.innerHTML = `<div class="bpc-empty">Could not load D3 library.</div>`;
        done();
      });

    function render() {
      chartEl.innerHTML = "";

      const d3 = window.d3;

      function normalizeText(value) {
        return String(value || "")
          .toLowerCase()
          .replace(/[_\\-]+/g, " ")
          .replace(/\\s+/g, " ")
          .trim();
      }

      function clean(value) {
        return String(value || "")
          .replace(/(<([^>]+)>)/gi, "")
          .trim();
      }

      function findField(fields, keywords) {
        return fields.find(field => {
          const haystack = `
            ${normalizeText(field.name)}
            ${normalizeText(field.label)}
            ${normalizeText(field.label_short)}
            ${normalizeText(field.view_label)}
          `;

          return keywords.some(keyword =>
            haystack.includes(normalizeText(keyword))
          );
        });
      }

      const daysField = dimensions[0].name;

      const currentField = findField(measures, [
        "current year cumulative revenue",
        "current cumulative revenue",
        "current year booking pace",
        "selected year cumulative revenue",
        "selected cumulative revenue",
        "current otb revenue",
        "otb revenue selected year"
      ])?.name || measures[0].name;

      const stlyField = findField(measures, [
        "stly cumulative revenue",
        "same time last year cumulative revenue",
        "last year cumulative revenue",
        "comparison cumulative revenue",
        "stly booking pace",
        "otb revenue stly"
      ])?.name || measures[1].name;

      const prefix = config.value_prefix || "€";

      function getValue(row, fieldName) {
        return fieldName ? Number(row[fieldName]?.value || 0) : 0;
      }

      function getRendered(row, fieldName) {
        return fieldName ? row[fieldName]?.rendered || null : null;
      }

      function parseDays(value) {
        const raw = clean(value);
        const num = Number(raw);

        if (isFinite(num)) return num;

        const match = raw.match(/-?\\d+(?:\\.\\d+)?/);
        return match ? Number(match[0]) : null;
      }

      function formatCurrency(v, rendered) {
        if (rendered) return clean(rendered);

        const abs = Math.abs(Number(v || 0));
        const sign = v < 0 ? "-" : "";

        if (abs >= 1000000) return sign + prefix + (abs / 1000000).toFixed(1) + "M";
        if (abs >= 1000) return sign + prefix + (abs / 1000).toFixed(0) + "K";

        return sign + prefix + abs.toLocaleString(undefined, { maximumFractionDigits: 0 });
      }

      function formatPct(v) {
        if (!isFinite(v)) return "-";
        return (v > 0 ? "+" : "") + v.toFixed(1) + "%";
      }

      const rows = data
        .map(row => {
          const rawDays =
            row[daysField]?.value ??
            row[daysField]?.rendered ??
            "";

          const days = parseDays(rawDays);

          return {
            days,
            label: clean(row[daysField]?.rendered || row[daysField]?.value || days),
            current: getValue(row, currentField),
            stly: getValue(row, stlyField),
            currentRendered: getRendered(row, currentField),
            stlyRendered: getRendered(row, stlyField)
          };
        })
        .filter(row => row.days !== null && isFinite(row.days))
        .sort((a, b) => b.days - a.days);

      if (!rows.length) {
        chartEl.innerHTML = `<div class="bpc-empty">No valid booking-window data found.</div>`;
        return;
      }

      const bounds = chartEl.getBoundingClientRect();
      const width = Math.max(bounds.width, 320);
      const height = Math.max(bounds.height, 180);

      const margin = {
        top: 30,
        right: 32,
        bottom: width < 620 ? 58 : 46,
        left: 72
      };

      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      const svg = d3
        .select(chartEl)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

      const maxDay = Math.max(120, d3.max(rows, d => d.days) || 120);
      const minDay = Math.min(0, d3.min(rows, d => d.days) || 0);

      const maxValue = d3.max(rows, d => Math.max(d.current, d.stly)) || 1;

      const x = d3.scaleLinear()
        .domain([maxDay, minDay])
        .range([margin.left, margin.left + innerWidth]);

      const y = d3.scaleLinear()
        .domain([0, maxValue * 1.12])
        .range([margin.top + innerHeight, margin.top]);

      const defs = svg.append("defs");

      const cyanGlow = defs.append("filter")
        .attr("id", "bpc-cyan-glow")
        .attr("x", "-80%")
        .attr("y", "-80%")
        .attr("width", "260%")
        .attr("height", "260%");

      cyanGlow.append("feGaussianBlur")
        .attr("stdDeviation", 4)
        .attr("result", "blur");

      cyanGlow.append("feMerge")
        .html(`
          <feMergeNode in="blur"></feMergeNode>
          <feMergeNode in="SourceGraphic"></feMergeNode>
        `);

      const magentaGlow = defs.append("filter")
        .attr("id", "bpc-magenta-glow")
        .attr("x", "-80%")
        .attr("y", "-80%")
        .attr("width", "260%")
        .attr("height", "260%");

      magentaGlow.append("feGaussianBlur")
        .attr("stdDeviation", 3)
        .attr("result", "blur");

      magentaGlow.append("feMerge")
        .html(`
          <feMergeNode in="blur"></feMergeNode>
          <feMergeNode in="SourceGraphic"></feMergeNode>
        `);

      const areaGradient = defs.append("linearGradient")
        .attr("id", "bpc-area-gradient")
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

      const markers = [90, 60, 30, 14, 7, 0]
        .filter(day => day <= maxDay && day >= minDay);

      const markerGroup = svg.append("g");

      markers.forEach(day => {
        markerGroup.append("line")
          .attr("x1", x(day))
          .attr("x2", x(day))
          .attr("y1", margin.top)
          .attr("y2", margin.top + innerHeight)
          .attr("stroke", "rgba(255,255,255,0.13)")
          .attr("stroke-width", 1)
          .attr("stroke-dasharray", "3 6");

        markerGroup.append("text")
          .attr("x", x(day))
          .attr("y", margin.top + 10)
          .attr("text-anchor", "middle")
          .text(day + "d")
          .style("fill", "rgba(255,255,255,0.40)")
          .style("font-size", "9px")
          .style("font-weight", 800);
      });

      const xAxis = svg.append("g")
        .attr("transform", `translate(0,${margin.top + innerHeight})`)
        .call(
          d3.axisBottom(x)
            .ticks(width < 620 ? 5 : 8)
            .tickFormat(d => d + "d")
        );

      xAxis.selectAll("text")
        .style("fill", "rgba(255,255,255,0.62)")
        .style("font-size", width < 620 ? "9px" : "10px")
        .style("font-weight", 800);

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

      svg.append("text")
        .attr("x", margin.left + innerWidth / 2)
        .attr("y", height - 6)
        .attr("text-anchor", "middle")
        .text("Days before arrival")
        .style("fill", "rgba(255,255,255,0.48)")
        .style("font-size", "10px")
        .style("font-weight", 800);

      const lineCurrent = d3.line()
        .x(d => x(d.days))
        .y(d => y(d.current))
        .curve(d3.curveMonotoneX);

      const lineStly = d3.line()
        .x(d => x(d.days))
        .y(d => y(d.stly))
        .curve(d3.curveMonotoneX);

      const areaCurrent = d3.area()
        .x(d => x(d.days))
        .y0(y(0))
        .y1(d => y(d.current))
        .curve(d3.curveMonotoneX);

      svg.append("path")
        .datum(rows)
        .attr("d", areaCurrent)
        .attr("fill", "url(#bpc-area-gradient)");

      const stlyPath = svg.append("path")
        .datum(rows)
        .attr("d", lineStly)
        .attr("fill", "none")
        .attr("stroke", "#e95fb8")
        .attr("stroke-width", 2.4)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("stroke-dasharray", "7 7")
        .attr("opacity", 0.82)
        .attr("filter", "url(#bpc-magenta-glow)");

      const currentPath = svg.append("path")
        .datum(rows)
        .attr("d", lineCurrent)
        .attr("fill", "none")
        .attr("stroke", "#36a9d6")
        .attr("stroke-width", 3.6)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("filter", "url(#bpc-cyan-glow)");

      [currentPath, stlyPath].forEach(path => {
        const length = path.node().getTotalLength();

        path
          .attr("stroke-dasharray", function() {
            const dash = d3.select(this).attr("stroke-dasharray");
            return dash && dash !== "null" && dash.includes("7")
              ? "7 7"
              : `${length} ${length}`;
          })
          .attr("stroke-dashoffset", function() {
            const dash = d3.select(this).attr("stroke-dasharray");
            return dash && dash.includes("7") ? 0 : length;
          });

        if (path === currentPath) {
          path.transition()
            .duration(800)
            .ease(d3.easeCubicOut)
            .attr("stroke-dashoffset", 0);
        }
      });

      const hoverLine = svg.append("line")
        .attr("y1", margin.top)
        .attr("y2", margin.top + innerHeight)
        .attr("stroke", "rgba(255,255,255,0.24)")
        .attr("stroke-width", 1)
        .attr("opacity", 0);

      const currentDot = svg.append("circle")
        .attr("r", 5)
        .attr("fill", "#36a9d6")
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1.5)
        .attr("opacity", 0);

      const stlyDot = svg.append("circle")
        .attr("r", 5)
        .attr("fill", "#e95fb8")
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

      function nearestRow(days) {
        return rows.reduce((best, row) => {
          if (!best) return row;

          return Math.abs(row.days - days) < Math.abs(best.days - days)
            ? row
            : best;
        }, null);
      }

      overlay
        .on("mousemove", function(event) {
          const [mx] = d3.pointer(event);
          const days = x.invert(mx);
          const d = nearestRow(days);

          if (!d) return;

          const cx = x(d.days);
          const currentY = y(d.current);
          const stlyY = y(d.stly);

          hoverLine
            .attr("x1", cx)
            .attr("x2", cx)
            .attr("opacity", 1);

          currentDot
            .attr("cx", cx)
            .attr("cy", currentY)
            .attr("opacity", 1);

          stlyDot
            .attr("cx", cx)
            .attr("cy", stlyY)
            .attr("opacity", 1);

          const variance = d.current - d.stly;
          const variancePct = d.stly ? (variance / d.stly) * 100 : null;
          const color = variance >= 0 ? "#74d17c" : "#ef3d2f";
          const insight = variance >= 0
            ? "Current booking pace is ahead of STLY"
            : "Current booking pace is behind STLY";

          tooltipEl.style.opacity = 1;
          tooltipEl.style.left = Math.min(cx + 16, width - 290) + "px";
          tooltipEl.style.top = Math.max(Math.min(currentY, stlyY) - 18, 20) + "px";

          tooltipEl.innerHTML = `
            <strong>${d.days} days before arrival</strong><br>
            Current Year: <strong style="color:#36a9d6;">${formatCurrency(d.current, d.currentRendered)}</strong><br>
            STLY: <strong style="color:#e95fb8;">${formatCurrency(d.stly, d.stlyRendered)}</strong><br>
            Variance: <strong style="color:${color};">
              ${variance >= 0 ? "+" : ""}${formatCurrency(variance)}
              ${variancePct === null ? "" : " (" + formatPct(variancePct) + ")"}
            </strong><br>
            <span style="color:${color};">${insight}</span>
          `;
        })
        .on("mouseleave", function() {
          hoverLine.attr("opacity", 0);
          currentDot.attr("opacity", 0);
          stlyDot.attr("opacity", 0);
          tooltipEl.style.opacity = 0;
        });

      const legend = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top - 10})`);

      const legendItems = [
        { label: "Current Year", color: "#36a9d6", dashed: false },
        { label: "STLY", color: "#e95fb8", dashed: true }
      ];

      let lx = 0;

      legendItems.forEach(item => {
        const g = legend.append("g")
          .attr("transform", `translate(${lx},0)`);

        g.append("line")
          .attr("x1", 0)
          .attr("x2", 22)
          .attr("y1", 0)
          .attr("y2", 0)
          .attr("stroke", item.color)
          .attr("stroke-width", 3)
          .attr("stroke-linecap", "round")
          .attr("stroke-dasharray", item.dashed ? "6 5" : "0");

        g.append("text")
          .attr("x", 30)
          .attr("y", 4)
          .text(item.label)
          .style("fill", "rgba(255,255,255,0.68)")
          .style("font-size", "10px")
          .style("font-weight", 800);

        lx += item.label.length * 7 + 62;
      });
    }
  }
});
