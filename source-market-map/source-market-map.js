looker.plugins.visualizations.add({
  id: "source_market_map",
  label: "Source Market World Map",

  options: {
    title: { type: "string", label: "Title", default: "Source Market Intelligence" },
    value_prefix: { type: "string", label: "Currency Prefix", default: "€" },
    max_country_label_chars: { type: "number", label: "Max Country Label Chars", default: 18 }
  },

  create: function(element) {
    element.innerHTML = `
      <style>
        .smm-wrap {
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

        .smm-title {
          font-size: clamp(16px, 2.5vw, 30px);
          font-weight: 900;
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .smm-subtitle {
          font-size: clamp(10px, 1vw, 12px);
          color: rgba(255,255,255,0.55);
          margin-bottom: 12px;
        }

        .smm-chart {
          width: 100%;
          height: calc(100% - 58px);
          min-height: 180px;
          position: relative;
          overflow: hidden;
        }

        .smm-chart svg {
          width: 100%;
          height: 100%;
          display: block;
        }

        .smm-tooltip {
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

        .smm-empty {
          color: white;
          padding: 18px;
          font-size: 12px;
        }
      </style>

      <div class="smm-wrap">
        <div class="smm-title"></div>
        <div class="smm-subtitle">Revenue, ADR, bookings and guest volume by source market</div>
        <div class="smm-chart"></div>
        <div class="smm-tooltip"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const titleEl = element.querySelector(".smm-title");
    const chartEl = element.querySelector(".smm-chart");
    const tooltipEl = element.querySelector(".smm-tooltip");

    titleEl.innerText = config.title || "Source Market Intelligence";

    const dimensions = queryResponse.fields.dimension_like || [];
    const measures = queryResponse.fields.measure_like || [];

    if (!data || data.length === 0 || dimensions.length < 1 || measures.length < 4) {
      chartEl.innerHTML = `
        <div class="smm-empty">
          Add 1 country dimension and 4 measures.<br><br>
          Dimension: Country<br>
          Measure 1: Revenue<br>
          Measure 2: ADR<br>
          Measure 3: Bookings<br>
          Measure 4: Guests
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
      .then(() => loadScript("https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js"))
      .then(() => render())
      .then(() => done())
      .catch(() => {
        chartEl.innerHTML = `<div class="smm-empty">Could not load map libraries.</div>`;
        done();
      });

    async function render() {
      chartEl.innerHTML = "";

      const d3 = window.d3;
      const topojson = window.topojson;

      const countryField = dimensions[0].name;
      const revenueField = measures[0].name;
      const adrField = measures[1].name;
      const bookingsField = measures[2].name;
      const guestsField = measures[3].name;

      const prefix = config.value_prefix || "€";

      function normalizeCountry(name) {
        return String(name || "")
          .toLowerCase()
          .replace(/&/g, "and")
          .replace(/\./g, "")
          .replace(/the /g, "")
          .replace(/republic of /g, "")
          .replace(/kingdom of /g, "")
          .trim();
      }

      const aliases = {
        "united states": "united states of america",
        "usa": "united states of america",
        "us": "united states of america",
        "uk": "united kingdom",
        "u k": "united kingdom",
        "russia": "russian federation",
        "south korea": "korea, republic of",
        "north korea": "korea, democratic people's republic of",
        "vietnam": "viet nam",
        "iran": "iran, islamic republic of",
        "syria": "syrian arab republic",
        "moldova": "moldova, republic of",
        "bolivia": "bolivia, plurinational state of",
        "venezuela": "venezuela, bolivarian republic of",
        "tanzania": "tanzania, united republic of",
        "czech republic": "czechia"
      };

      function countryKey(name) {
        const n = normalizeCountry(name);
        return aliases[n] || n;
      }

      function formatCurrency(v) {
        const abs = Math.abs(Number(v || 0));
        const sign = v < 0 ? "-" : "";

        if (abs >= 1000000) return sign + prefix + (abs / 1000000).toFixed(1) + "M";
        if (abs >= 1000) return sign + prefix + (abs / 1000).toFixed(0) + "K";

        return sign + prefix + abs.toLocaleString(undefined, { maximumFractionDigits: 0 });
      }

      function formatADR(v) {
        return prefix + Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
      }

      function formatNumber(v) {
        return Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
      }

      const marketMap = new Map();

      data.forEach(row => {
        const countryRaw =
          row[countryField]?.rendered ||
          row[countryField]?.value ||
          "Unknown";

        const country = String(countryRaw).replace(/(<([^>]+)>)/gi, "");
        const key = countryKey(country);

        const current = marketMap.get(key) || {
          country,
          revenue: 0,
          adrWeightedRevenue: 0,
          bookings: 0,
          guests: 0
        };

        const revenue = Number(row[revenueField]?.value || 0);
        const adr = Number(row[adrField]?.value || 0);
        const bookings = Number(row[bookingsField]?.value || 0);
        const guests = Number(row[guestsField]?.value || 0);

        current.revenue += revenue;
        current.adrWeightedRevenue += adr * Math.max(bookings, 1);
        current.bookings += bookings;
        current.guests += guests;

        marketMap.set(key, current);
      });

      marketMap.forEach(v => {
        v.adr = v.bookings > 0
          ? v.adrWeightedRevenue / v.bookings
          : 0;
      });

      const totalRevenue = Array.from(marketMap.values())
        .reduce((sum, d) => sum + d.revenue, 0) || 1;

      const maxRevenue = d3.max(Array.from(marketMap.values()), d => d.revenue) || 1;

      const bounds = chartEl.getBoundingClientRect();
      const width = Math.max(bounds.width, 320);
      const height = Math.max(bounds.height, 180);

      const svg = d3
        .select(chartEl)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

      const world = await d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json");
      const namesText = await d3.text("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.tsv");

      const nameById = new Map(
        d3.tsvParse(namesText).map(d => [d.id, d.name])
      );

      const countries = topojson.feature(world, world.objects.countries).features;

      countries.forEach(d => {
        d.properties.name = nameById.get(String(d.id).padStart(3, "0")) || nameById.get(String(d.id)) || "Unknown";
      });

      const projection = d3.geoNaturalEarth1()
        .fitSize([width, height * 0.92], { type: "FeatureCollection", features: countries });

      const path = d3.geoPath(projection);

      const color = d3.scaleLinear()
        .domain([0, maxRevenue * 0.35, maxRevenue])
        .range(["rgba(54,169,214,0.10)", "#36a9d6", "#b994ff"]);

      svg.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "#030303");

      const countryPaths = svg.append("g")
        .selectAll("path")
        .data(countries)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", d => {
          const metric = marketMap.get(countryKey(d.properties.name));
          return metric ? color(metric.revenue) : "rgba(255,255,255,0.06)";
        })
        .attr("stroke", "rgba(255,255,255,0.16)")
        .attr("stroke-width", 0.45)
        .attr("opacity", d => marketMap.get(countryKey(d.properties.name)) ? 0.92 : 0.45)
        .style("cursor", d => marketMap.get(countryKey(d.properties.name)) ? "pointer" : "default")
        .on("mousemove", function(event, d) {
          const metric = marketMap.get(countryKey(d.properties.name));
          if (!metric) return;

          countryPaths.attr("opacity", c =>
            countryKey(c.properties.name) === countryKey(d.properties.name) ? 1 : 0.18
          );

          d3.select(this)
            .attr("stroke", "rgba(255,255,255,0.9)")
            .attr("stroke-width", 1.2);

          const point = d3.pointer(event, chartEl);
          const share = metric.revenue / totalRevenue * 100;

          let insight = "Balanced source market contribution";
          let insightColor = "#36a9d6";

          if (share >= 30) {
            insight = "High international dependency";
            insightColor = "#ef3d2f";
          } else if (metric.adr >= d3.quantile(Array.from(marketMap.values()).map(x => x.adr).sort(d3.ascending), 0.75)) {
            insight = "High-value source market";
            insightColor = "#ff9f2f";
          } else if (metric.bookings >= d3.quantile(Array.from(marketMap.values()).map(x => x.bookings).sort(d3.ascending), 0.75)) {
            insight = "Strong booking volume market";
            insightColor = "#74d17c";
          } else if (share <= 3 && metric.revenue > 0) {
            insight = "Emerging or low exposure market";
            insightColor = "#e95fb8";
          }

          tooltipEl.style.opacity = 1;
          tooltipEl.style.left = Math.min(point[0] + 14, width - 245) + "px";
          tooltipEl.style.top = Math.max(point[1] - 18, 20) + "px";

          tooltipEl.innerHTML = `
            <strong>${metric.country}</strong><br>
            Revenue: <strong>${formatCurrency(metric.revenue)}</strong><br>
            ADR: <strong>${formatADR(metric.adr)}</strong><br>
            Bookings: <strong>${formatNumber(metric.bookings)}</strong><br>
            Guests: <strong>${formatNumber(metric.guests)}</strong><br>
            Revenue Share: <strong>${share.toFixed(1)}%</strong><br>
            <span style="color:${insightColor};">${insight}</span>
          `;
        })
        .on("mouseleave", function() {
          countryPaths
            .attr("opacity", d => marketMap.get(countryKey(d.properties.name)) ? 0.92 : 0.45)
            .attr("stroke", "rgba(255,255,255,0.16)")
            .attr("stroke-width", 0.45);

          tooltipEl.style.opacity = 0;
        });

      const topMarkets = Array.from(marketMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      const panelX = width - Math.min(220, width * 0.34) - 12;
      const panelY = 12;
      const panelW = Math.min(220, width * 0.34);

      if (width > 620 && topMarkets.length) {
        const panel = svg.append("g")
          .attr("transform", `translate(${panelX},${panelY})`);

        panel.append("rect")
          .attr("width", panelW)
          .attr("height", 34 + topMarkets.length * 25)
          .attr("rx", 14)
          .attr("fill", "rgba(0,0,0,0.42)")
          .attr("stroke", "rgba(255,255,255,0.12)");

        panel.append("text")
          .attr("x", 14)
          .attr("y", 21)
          .text("Top Markets")
          .style("fill", "rgba(255,255,255,0.85)")
          .style("font-size", "11px")
          .style("font-weight", 900);

        topMarkets.forEach((market, i) => {
          const y = 45 + i * 25;
          const share = market.revenue / totalRevenue * 100;

          panel.append("circle")
            .attr("cx", 16)
            .attr("cy", y - 4)
            .attr("r", 4)
            .attr("fill", color(market.revenue));

          panel.append("text")
            .attr("x", 26)
            .attr("y", y)
            .text(
              market.country.length > Number(config.max_country_label_chars || 18)
                ? market.country.slice(0, Number(config.max_country_label_chars || 18)) + "…"
                : market.country
            )
            .style("fill", "rgba(255,255,255,0.72)")
            .style("font-size", "10px")
            .style("font-weight", 700);

          panel.append("text")
            .attr("x", panelW - 12)
            .attr("y", y)
            .attr("text-anchor", "end")
            .text(share.toFixed(1) + "%")
            .style("fill", "rgba(255,255,255,0.55)")
            .style("font-size", "10px")
            .style("font-weight", 800);
        });
      }

      const legendW = Math.min(170, width * 0.28);
      const legendX = 16;
      const legendY = height - 24;

      const defs = svg.append("defs");

      const gradient = defs.append("linearGradient")
        .attr("id", "smm-legend-gradient")
        .attr("x1", "0%")
        .attr("x2", "100%");

      gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "rgba(54,169,214,0.10)");

      gradient.append("stop")
        .attr("offset", "55%")
        .attr("stop-color", "#36a9d6");

      gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#b994ff");

      svg.append("rect")
        .attr("x", legendX)
        .attr("y", legendY)
        .attr("width", legendW)
        .attr("height", 7)
        .attr("rx", 5)
        .attr("fill", "url(#smm-legend-gradient)");

      svg.append("text")
        .attr("x", legendX)
        .attr("y", legendY - 5)
        .text("Low revenue")
        .style("fill", "rgba(255,255,255,0.45)")
        .style("font-size", "9px");

      svg.append("text")
        .attr("x", legendX + legendW)
        .attr("y", legendY - 5)
        .attr("text-anchor", "end")
        .text("High revenue")
        .style("fill", "rgba(255,255,255,0.45)")
        .style("font-size", "9px");
    }
  }
});
