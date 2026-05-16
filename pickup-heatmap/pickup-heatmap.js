looker.plugins.visualizations.add({
  id: "pickup_heatmap",
  label: "Pickup Heatmap",

  options: {
    title: {
      type: "string",
      label: "Title",
      default: "Pickup & Demand Compression Heatmap"
    },

    value_format: {
      type: "string",
      label: "Format: currency / number / percent",
      default: "currency"
    },

    value_prefix: {
      type: "string",
      label: "Value Prefix",
      default: "€"
    },

    spike_threshold: {
      type: "number",
      label: "Spike Threshold % of Max",
      default: 85
    }
  },

  create: function(element) {
    element.innerHTML = `
      <style>
        .ph-wrap {
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

        .ph-title {
          font-size: clamp(16px, 2.5vw, 30px);
          font-weight: 900;
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ph-subtitle {
          font-size: clamp(10px, 1vw, 12px);
          color: rgba(255,255,255,0.55);
          margin-bottom: 12px;
        }

        .ph-chart {
          width: 100%;
          height: calc(100% - 58px);
          min-height: 180px;
          position: relative;
          overflow: hidden;
        }

        .ph-chart svg {
          width: 100%;
          height: 100%;
          display: block;
        }

        .ph-tooltip {
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

        .ph-empty {
          color: white;
          padding: 18px;
          font-size: 12px;
        }
      </style>

      <div class="ph-wrap">
        <div class="ph-title"></div>
        <div class="ph-subtitle">Booking pickup intensity by stay date and booking window</div>
        <div class="ph-chart"></div>
        <div class="ph-tooltip"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const titleEl = element.querySelector(".ph-title");
    const chartEl = element.querySelector(".ph-chart");
    const tooltipEl = element.querySelector(".ph-tooltip");

    titleEl.innerText = config.title || "Pickup & Demand Compression Heatmap";

    const dimensions = queryResponse.fields.dimension_like || [];
    const measures = queryResponse.fields.measure_like || [];

    if (!data || data.length === 0 || dimensions.length < 2 || measures.length < 1) {
      chartEl.innerHTML = `
        <div class="ph-empty">
          Add 2 dimensions and 1 measure.<br><br>
          Dimension 1: Stay Date<br>
          Dimension 2: Booking Window Bucket<br>
          Measure: Revenue / Pickup / Room Nights
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
        chartEl.innerHTML = `<div class="ph-empty">Could not load D3 library.</div>`;
        done();
      });

    function render() {
      chartEl.innerHTML = "";

      const d3 = window.d3;

      const dateField = dimensions[0].name;
      const bucketField = dimensions[1].name;
      const valueField = measures[0].name;

      const parseDate = value => {
        if (value instanceof Date) return value;
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
      };

      const rows = data
        .map(row => {
          const rawDate = row[dateField]?.value || row[dateField]?.rendered;
          const date = parseDate(rawDate);
          const bucket = String(row[bucketField]?.value || row[bucketField]?.rendered || "Unknown");
          const value = Number(row[valueField]?.value || 0);

          return {
            date,
            bucket,
            value,
            renderedDate: row[dateField]?.rendered || rawDate,
            renderedValue: row[valueField]?.rendered || null
          };
        })
        .filter(row => row.date && isFinite(row.value));

      if (!rows.length) {
        chartEl.innerHTML = `<div class="ph-empty">No valid heatmap data found.</div>`;
        return;
      }

      const bounds = chartEl.getBoundingClientRect();
      const width = Math.max(bounds.width, 320);
      const height = Math.max(bounds.height, 180);

      const margin = {
        top: 18,
        right: 18,
        bottom: width < 600 ? 48 : 34,
        left: width < 600 ? 72 : 94
      };

      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      const svg = d3
        .select(chartEl)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

      const prefix = config.value_prefix || "€";

      function formatValue(v, rendered) {
        if (config.value_format === "auto" && rendered) return rendered;

        const num = Number(v || 0);

        if (config.value_format === "percent") {
          if (Math.abs(num) <= 1) return (num * 100).toFixed(1) + "%";
          return num.toFixed(1) + "%";
        }

        if (config.value_format === "number") {
          return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
        }

        if (Math.abs(num) >= 1000000) return prefix + (num / 1000000).toFixed(1) + "M";
        if (Math.abs(num) >= 1000) return prefix + (num / 1000).toFixed(0) + "K";

        return prefix + num.toLocaleString(undefined, { maximumFractionDigits: 0 });
      }

      const bucketOrder = [
        "0-1 days",
        "0-1",
        "2-3 days",
        "2-3",
        "4-7 days",
        "4-7",
        "8-14 days",
        "8-14",
        "15-30 days",
        "15-30",
        "31-60 days",
        "31-60",
        "61-90 days",
        "61-90",
        "90+ days",
        "90+"
      ];

      function bucketRank(bucket) {
        const index = bucketOrder.findIndex(x => x.toLowerCase() === bucket.toLowerCase());
        return index === -1 ? 999 : index;
      }

      const dates = Array.from(
        new Map(
          rows
            .sort((a, b) => a.date - b.date)
            .map(row => [d3.timeFormat("%Y-%m-%d")(row.date), row.date])
        ).values()
      );

      const buckets = Array.from(new Set(rows.map(r => r.bucket)))
        .sort((a, b) => bucketRank(a) - bucketRank(b));

      const maxValue = d3.max(rows, d => d.value) || 1;
      const spikeThreshold = Number(config.spike_threshold || 85) / 100;

      const x = d3
        .scaleBand()
        .domain(dates.map(d => d3.timeFormat("%Y-%m-%d")(d)))
        .range([margin.left, margin.left + innerWidth])
        .padding(0.08);

      const y = d3
        .scaleBand()
        .domain(buckets)
        .range([margin.top, margin.top + innerHeight])
        .padding(0.08);

      const color = d3
        .scaleLinear()
        .domain([0, maxValue * 0.35, maxValue])
        .range(["rgba(54,169,214,0.12)", "#36a9d6", "#b994ff"]);

      const cellData = rows.map(row => ({
        ...row,
        dateKey: d3.timeFormat("%Y-%m-%d")(row.date)
      }));

      svg.append("g")
        .selectAll("rect")
        .data(cellData)
        .enter()
        .append("rect")
        .attr("x", d => x(d.dateKey))
        .attr("y", d => y(d.bucket))
        .attr("width", Math.max(1, x.bandwidth()))
        .attr("height", Math.max(1, y.bandwidth()))
        .attr("rx", Math.min(6, x.bandwidth() / 4, y.bandwidth() / 4))
        .attr("fill", d => d.value >= maxValue * spikeThreshold ? "#ef3d2f" : color(d.value))
        .attr("opacity", 0.88)
        .style("cursor", "pointer")
        .on("mousemove", function(event, d) {
          d3.select(this)
            .attr("opacity", 1)
            .attr("stroke", "rgba(255,255,255,0.75)")
            .attr("stroke-width", 1);

          const point = d3.pointer(event, chartEl);

          const intensity = d.value >= maxValue * spikeThreshold
            ? "Demand spike detected"
            : d.value >= maxValue * 0.6
              ? "Strong pickup intensity"
              : d.value >= maxValue * 0.25
                ? "Moderate pickup"
                : "Low pickup activity";

          tooltipEl.style.opacity = 1;
          tooltipEl.style.left = Math.min(point[0] + 14, width - 220) + "px";
          tooltipEl.style.top = Math.max(point[1] - 20, 20) + "px";

          tooltipEl.innerHTML = `
            <strong>${d3.timeFormat("%d %b %Y")(d.date)}</strong><br>
            Booking Window: <strong>${d.bucket}</strong><br>
            Value: <strong>${formatValue(d.value, d.renderedValue)}</strong><br>
            <span style="color:${d.value >= maxValue * spikeThreshold ? "#ef3d2f" : "#36a9d6"};">
              ${intensity}
            </span>
          `;
        })
        .on("mouseleave", function() {
          d3.select(this)
            .attr("opacity", 0.88)
            .attr("stroke", "none");

          tooltipEl.style.opacity = 0;
        })
        .on("click", function(event, d) {
          const selectedBucket = d.bucket;
          const selectedDate = d.dateKey;

          const cells = svg.selectAll("rect");

          const alreadyActive = d3.select(this).classed("active");

          cells
            .classed("active", false)
            .transition()
            .duration(160)
            .attr("opacity", 0.18);

          if (!alreadyActive) {
            cells
              .filter(c => c.bucket === selectedBucket || c.dateKey === selectedDate)
              .classed("active", true)
              .transition()
              .duration(160)
              .attr("opacity", 1);
          } else {
            cells
              .transition()
              .duration(160)
              .attr("opacity", 0.88);
          }
        });

      svg.on("click", function(event) {
        if (event.target.tagName === "svg") {
          svg.selectAll("rect")
            .classed("active", false)
            .transition()
            .duration(160)
            .attr("opacity", 0.88);
        }
      });

      const xAxis = svg.append("g")
        .attr("transform", `translate(0,${margin.top + innerHeight})`)
        .call(
          d3.axisBottom(x)
            .tickValues(
              dates
                .filter((d, i) => {
                  const maxTicks = width < 600 ? 5 : 10;
                  return i % Math.ceil(dates.length / maxTicks) === 0;
                })
                .map(d => d3.timeFormat("%Y-%m-%d")(d))
            )
            .tickFormat(d => d3.timeFormat("%d %b")(new Date(d)))
        );

      xAxis.selectAll("text")
        .style("fill", "rgba(255,255,255,0.62)")
        .style("font-size", width < 600 ? "8px" : "10px")
        .attr("transform", "rotate(-28)")
        .style("text-anchor", "end");

      xAxis.selectAll("path,line")
        .style("stroke", "rgba(255,255,255,0.14)");

      const yAxis = svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y));

      yAxis.selectAll("text")
        .style("fill", "rgba(255,255,255,0.72)")
        .style("font-size", width < 600 ? "8px" : "10px")
        .style("font-weight", 700);

      yAxis.selectAll("path,line")
        .style("stroke", "rgba(255,255,255,0.14)");

      const legendWidth = Math.min(160, innerWidth * 0.28);
      const legendX = margin.left + innerWidth - legendWidth;
      const legendY = margin.top - 8;

      const defs = svg.append("defs");

      const gradient = defs.append("linearGradient")
        .attr("id", "ph-legend-gradient")
        .attr("x1", "0%")
        .attr("x2", "100%");

      gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "rgba(54,169,214,0.12)");

      gradient.append("stop")
        .attr("offset", "50%")
        .attr("stop-color", "#36a9d6");

      gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#b994ff");

      svg.append("rect")
        .attr("x", legendX)
        .attr("y", legendY)
        .attr("width", legendWidth)
        .attr("height", 6)
        .attr("rx", 4)
        .attr("fill", "url(#ph-legend-gradient)")
        .attr("opacity", 0.9);

      svg.append("text")
        .attr("x", legendX)
        .attr("y", legendY - 4)
        .text("Low")
        .style("fill", "rgba(255,255,255,0.45)")
        .style("font-size", "9px");

      svg.append("text")
        .attr("x", legendX + legendWidth)
        .attr("y", legendY - 4)
        .text("High")
        .attr("text-anchor", "end")
        .style("fill", "rgba(255,255,255,0.45)")
        .style("font-size", "9px");
    }
  }
});
