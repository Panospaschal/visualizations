looker.plugins.visualizations.add({
  id: "forecast_gap_waterfall",
  label: "Forecast Gap Intelligence",

  options: {
    title: {
      type: "string",
      label: "Title",
      default: "Forecast Gap Intelligence"
    },
    subtitle: {
      type: "string",
      label: "Subtitle",
      default: "Revenue already secured versus forecast target and remaining opportunity"
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
        .fgw-wrap {
          width: 100%;
          height: 100%;
          min-height: 0;
          background:
            radial-gradient(circle at top right, rgba(54,169,214,0.18), transparent 34%),
            radial-gradient(circle at bottom left, rgba(233,95,184,0.16), transparent 38%),
            #030303;
          color: white;
          font-family: Inter, Arial, sans-serif;
          padding: clamp(10px, 1.8vw, 28px);
          box-sizing: border-box;
          overflow: hidden;
          position: relative;
        }

        .fgw-wrap::before {
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

        .fgw-header {
          position: relative;
          z-index: 2;
        }

        .fgw-title {
          font-size: clamp(16px, 2.5vw, 30px);
          font-weight: 950;
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: -0.03em;
        }

        .fgw-subtitle {
          font-size: clamp(10px, 1vw, 12px);
          color: rgba(255,255,255,0.55);
          margin-bottom: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .fgw-chart {
          position: relative;
          z-index: 2;
          width: 100%;
          height: calc(100% - 58px);
          min-height: 180px;
          overflow: hidden;
        }

        .fgw-chart svg {
          width: 100%;
          height: 100%;
          display: block;
        }

        .fgw-tooltip {
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

        .fgw-empty {
          color: white;
          padding: 18px;
          font-size: 12px;
          line-height: 1.55;
        }
      </style>

      <div class="fgw-wrap">
        <div class="fgw-header">
          <div class="fgw-title"></div>
          <div class="fgw-subtitle"></div>
        </div>
        <div class="fgw-chart"></div>
        <div class="fgw-tooltip"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const titleEl = element.querySelector(".fgw-title");
    const subtitleEl = element.querySelector(".fgw-subtitle");
    const chartEl = element.querySelector(".fgw-chart");
    const tooltipEl = element.querySelector(".fgw-tooltip");

    titleEl.innerText = config.title || "Forecast Gap Intelligence";
    subtitleEl.innerText = config.subtitle || "Revenue already secured versus forecast target and remaining opportunity";

    const dimensions = queryResponse.fields.dimension_like || [];
    const measures = queryResponse.fields.measure_like || [];

    if (!data || data.length === 0 || dimensions.length < 1 || measures.length < 2) {
      chartEl.innerHTML = `
        <div class="fgw-empty">
          Add 1 month dimension and at least 2 measures.<br><br>
          Dimension: Month<br>
          Measures, any order:<br>
          • Current OTB Revenue<br>
          • Forecast Revenue<br>
          Optional:<br>
          • Revenue Gap<br>
          • Achievement %
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
        chartEl.innerHTML = `<div class="fgw-empty">Could not load D3 library.</div>`;
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

      const monthField = dimensions[0].name;

      const currentOtbRevenueField = findField(measures, [
        "current otb revenue",
        "otb revenue",
        "otb room revenue selected year",
        "room revenue selected year"
      ])?.name;

      const forecastRevenueField = findField(measures, [
        "forecast revenue",
        "forecast projection",
        "projected revenue"
      ])?.name;

      const revenueGapField = findField(measures, [
        "revenue gap",
        "forecast gap",
        "remaining opportunity",
        "remaining revenue",
        "gap revenue"
      ])?.name;

      const achievementField = findField(measures, [
        "achievement",
        "achievement %",
        "achievement pct",
        "attainment",
        "secured %",
        "otb vs forecast %",
        "otb forecast %"
      ])?.name;

      if (!currentOtbRevenueField || !forecastRevenueField) {
        chartEl.innerHTML = `
          <div class="fgw-empty">
            Missing required measures.<br><br>
            Required:<br>
            • Current OTB Revenue<br>
            • Forecast Revenue<br><br>
            Optional:<br>
            • Revenue Gap<br>
            • Achievement %
          </div>
        `;
        return;
      }

      const prefix = config.value_prefix || "€";

      function monthRank(value) {
        const m = clean(value).toLowerCase();

        const map = {
          jan: 1, january: 1,
          feb: 2, february: 2,
          mar: 3, march: 3,
          apr: 4, april: 4,
          may: 5,
          jun: 6, june: 6,
          jul: 7, july: 7,
          aug: 8, august: 8,
          sep: 9, sept: 9, september: 9,
          oct: 10, october: 10,
          nov: 11, november: 11,
          dec: 12, december: 12
        };

        if (map[m]) return map[m];

        const num = Number(m);
        if (num >= 1 && num <= 12) return num;

        const match = m.match(/(\\d{4})[-/](\\d{1,2})/);
        if (match) return Number(match[2]);

        return 99;
      }

      function getValue(row, fieldName) {
        return fieldName ? Number(row[fieldName]?.value || 0) : 0;
      }

      function getRendered(row, fieldName) {
        return fieldName ? row[fieldName]?.rendered || null : null;
      }

      function formatCurrency(v, rendered) {
        if (rendered) return clean(rendered);

        const abs = Math.abs(Number(v || 0));
        const sign = v < 0 ? "-" : "";

        if (abs >= 1000000) return sign + prefix + (abs / 1000000).toFixed(1) + "M";
        if (abs >= 1000) return sign + prefix + (abs / 1000).toFixed(0) + "K";

        return sign + prefix + abs.toLocaleString(undefined, { maximumFractionDigits: 0 });
      }

      function pctNumber(v) {
        let num = Number(v || 0);
        if (Math.abs(num) <= 1.2) num *= 100;
        return num;
      }

      function formatPct(v, rendered) {
        if (rendered) return clean(rendered);

        return pctNumber(v).toFixed(1) + "%";
      }

      function getGapRiskColor(d) {
        const achievement = pctNumber(d.achievement);

        if (achievement >= 95) return "#74d17c";
        if (achievement >= 75) return "#f6c85f";
        return "#ef3d2f";
      }

      function getStatus(d) {
        const achievement = pctNumber(d.achievement);

        if (achievement >= 95) return "Low Gap / On Track";
        if (achievement >= 75) return "Remaining Opportunity";
        return "High Gap Risk";
      }

      const rows = data
        .map(row => {
          const month =
            clean(row[monthField]?.rendered) ||
            clean(row[monthField]?.value) ||
            "Unknown";

          const current = getValue(row, currentOtbRevenueField);
          const forecast = getValue(row, forecastRevenueField);
          const gap = revenueGapField
            ? getValue(row, revenueGapField)
            : forecast - current;

          const achievement = achievementField
            ? getValue(row, achievementField)
            : forecast ? current / forecast : 0;

          return {
            month,
            rank: monthRank(month),
            current,
            forecast,
            gap,
            achievement,

            currentRendered: getRendered(row, currentOtbRevenueField),
            forecastRendered: getRendered(row, forecastRevenueField),
            gapRendered: getRendered(row, revenueGapField),
            achievementRendered: getRendered(row, achievementField)
          };
        })
        .filter(row => row.month)
        .sort((a, b) => a.rank - b.rank);

      if (!rows.length) {
        chartEl.innerHTML = `<div class="fgw-empty">No valid data found.</div>`;
        return;
      }

      const bounds = chartEl.getBoundingClientRect();
      const width = Math.max(bounds.width, 320);
      const height = Math.max(bounds.height, 180);

      const margin = {
        top: 34,
        right: 30,
        bottom: width < 620 ? 58 : 46,
        left: 70
      };

      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      const svg = d3
        .select(chartEl)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

      const maxValue = d3.max(rows, d => Math.max(d.current, d.forecast)) || 1;

      const x = d3.scaleBand()
        .domain(rows.map(d => d.month))
        .range([margin.left, margin.left + innerWidth])
        .padding(0.30);

      const y = d3.scaleLinear()
        .domain([0, maxValue * 1.22])
        .range([margin.top + innerHeight, margin.top]);

      const defs = svg.append("defs");

      const cyanGradient = defs.append("linearGradient")
        .attr("id", "fgw-cyan-gradient")
        .attr("x1", "0")
        .attr("x2", "0")
        .attr("y1", "0")
        .attr("y2", "1");

      cyanGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#7bc8e6");

      cyanGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#1c6f91");

      const magentaGradient = defs.append("linearGradient")
        .attr("id", "fgw-magenta-gradient")
        .attr("x1", "0")
        .attr("x2", "0")
        .attr("y1", "0")
        .attr("y2", "1");

      magentaGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#e95fb8");

      magentaGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#7b4dff");

      const glow = defs.append("filter")
        .attr("id", "fgw-glow")
        .attr("x", "-70%")
        .attr("y", "-90%")
        .attr("width", "240%")
        .attr("height", "280%");

      glow.append("feGaussianBlur")
        .attr("stdDeviation", 3.2)
        .attr("result", "blur");

      glow.append("feMerge")
        .html(`
          <feMergeNode in="blur"></feMergeNode>
          <feMergeNode in="SourceGraphic"></feMergeNode>
        `);

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

      const xAxis = svg.append("g")
        .attr("transform", `translate(0,${margin.top + innerHeight})`)
        .call(d3.axisBottom(x));

      xAxis.selectAll("text")
        .style("fill", "rgba(255,255,255,0.62)")
        .style("font-size", width < 620 ? "9px" : "10px")
        .style("font-weight", 800)
        .attr("transform", width < 620 ? "rotate(-28)" : "rotate(-14)")
        .style("text-anchor", "end");

      xAxis.selectAll("path,line")
        .style("stroke", "rgba(255,255,255,0.14)");

      const barWidth = x.bandwidth();
      const innerBarWidth = barWidth * 0.62;
      const targetWidth = barWidth * 0.78;

      const group = svg.append("g")
        .selectAll("g.fgw-month")
        .data(rows)
        .enter()
        .append("g")
        .attr("class", "fgw-month")
        .style("cursor", "pointer");

      group.append("rect")
        .attr("x", d => x(d.month) + (barWidth - targetWidth) / 2)
        .attr("y", d => y(d.forecast))
        .attr("width", targetWidth)
        .attr("height", d => margin.top + innerHeight - y(d.forecast))
        .attr("rx", Math.min(9, targetWidth / 3))
        .attr("fill", "url(#fgw-magenta-gradient)")
        .attr("opacity", 0.30)
        .attr("filter", "url(#fgw-glow)");

      group.append("rect")
        .attr("x", d => x(d.month) + (barWidth - innerBarWidth) / 2)
        .attr("y", margin.top + innerHeight)
        .attr("width", innerBarWidth)
        .attr("height", 0)
        .attr("rx", Math.min(8, innerBarWidth / 3))
        .attr("fill", "url(#fgw-cyan-gradient)")
        .attr("opacity", 0.92)
        .attr("filter", "url(#fgw-glow)")
        .transition()
        .duration(650)
        .ease(d3.easeCubicOut)
        .attr("y", d => y(d.current))
        .attr("height", d => margin.top + innerHeight - y(d.current));

      group.append("rect")
        .attr("x", d => x(d.month) + (barWidth - innerBarWidth) / 2)
        .attr("y", d => y(Math.max(d.current, d.forecast)))
        .attr("width", innerBarWidth)
        .attr("height", d => Math.abs(y(d.current) - y(d.forecast)))
        .attr("rx", Math.min(7, innerBarWidth / 3))
        .attr("fill", d => getGapRiskColor(d))
        .attr("opacity", d => d.gap <= 0 ? 0.18 : 0.72)
        .attr("stroke", d => getGapRiskColor(d))
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3 4");

      group.append("line")
        .attr("x1", d => x(d.month) + (barWidth - targetWidth) / 2)
        .attr("x2", d => x(d.month) + (barWidth + targetWidth) / 2)
        .attr("y1", d => y(d.forecast))
        .attr("y2", d => y(d.forecast))
        .attr("stroke", "#e95fb8")
        .attr("stroke-width", 2)
        .attr("stroke-linecap", "round")
        .attr("filter", "url(#fgw-glow)");

      group.append("text")
        .attr("x", d => x(d.month) + barWidth / 2)
        .attr("y", d => y(Math.max(d.current, d.forecast)) - 8)
        .attr("text-anchor", "middle")
        .text(d => formatPct(d.achievement, d.achievementRendered))
        .style("fill", d => getGapRiskColor(d))
        .style("font-size", width < 620 ? "8px" : "10px")
        .style("font-weight", 950)
        .style("text-shadow", "0 0 10px rgba(0,0,0,0.8)");

      const legend = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top - 12})`);

      const legendItems = [
        { label: "Secured OTB", color: "#7bc8e6" },
        { label: "Forecast Target", color: "#e95fb8" },
        { label: "Gap / Opportunity", color: "#f6c85f" }
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
          .style("fill", "rgba(255,255,255,0.68)")
          .style("font-size", "10px")
          .style("font-weight", 800);

        lx += item.label.length * 6 + 42;
      });

      function showTooltip(event, d) {
        const point = d3.pointer(event, chartEl);
        const color = getGapRiskColor(d);

        tooltipEl.style.opacity = 1;
        tooltipEl.style.left = Math.min(point[0] + 14, width - 285) + "px";
        tooltipEl.style.top = Math.max(point[1] - 18, 20) + "px";

        tooltipEl.innerHTML = `
          <strong>${d.month}</strong><br>
          Current OTB Revenue: <strong style="color:#7bc8e6;">${formatCurrency(d.current, d.currentRendered)}</strong><br>
          Forecast Revenue: <strong style="color:#e95fb8;">${formatCurrency(d.forecast, d.forecastRendered)}</strong><br>
          Remaining Gap: <strong style="color:${color};">${formatCurrency(d.gap, d.gapRendered)}</strong><br>
          Achievement: <strong style="color:${color};">${formatPct(d.achievement, d.achievementRendered)}</strong><br>
          Status: <strong style="color:${color};">${getStatus(d)}</strong>
        `;
      }

      function highlight(d) {
        group.attr("opacity", b => b.month === d.month ? 1 : 0.22);
      }

      function reset() {
        group.attr("opacity", 1);
        tooltipEl.style.opacity = 0;
      }

      group
        .on("mousemove", function(event, d) {
          highlight(d);
          showTooltip(event, d);
        })
        .on("mouseleave", reset);
    }
  }
});
