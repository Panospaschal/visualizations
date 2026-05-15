looker.plugins.visualizations.add({
  id: "sankey_flow",
  label: "Sankey Flow",

  options: {
    title: {
      type: "string",
      label: "Title",
      default: "Revenue Flow"
    },
    value_prefix: {
      type: "string",
      label: "Value Prefix",
      default: "€"
    },
    max_nodes_per_level: {
      type: "number",
      label: "Max Nodes Per Level",
      default: 20
    }
  },

  create: function(element) {
    element.innerHTML = `
      <style>
        .sk-wrap {
          width: 100%;
          min-height: 680px;
          background: #030303;
          color: white;
          font-family: Inter, Arial, sans-serif;
          padding: 34px 42px;
          box-sizing: border-box;
          position: relative;
          overflow: hidden;
        }

        .sk-title {
          font-size: 30px;
          font-weight: 900;
          margin-bottom: 18px;
        }

        .sk-chart {
          width: 100%;
          height: 570px;
          position: relative;
        }

        .sk-tooltip {
          position: absolute;
          pointer-events: none;
          background: rgba(10,10,10,0.94);
          color: white;
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 12px;
          line-height: 1.4;
          box-shadow: 0 8px 24px rgba(0,0,0,0.45);
          opacity: 0;
          transform: translate(-50%, -120%);
          z-index: 20;
          max-width: 260px;
        }

        .sk-empty {
          padding: 30px;
          color: white;
        }

        .sk-node-label {
          fill: rgba(255,255,255,0.92);
          font-size: 11px;
          font-weight: 700;
        }

        .sk-node-value {
          fill: rgba(255,255,255,0.55);
          font-size: 10px;
        }
      </style>

      <div class="sk-wrap">
        <div class="sk-title"></div>
        <div class="sk-chart"></div>
        <div class="sk-tooltip"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const titleEl = element.querySelector(".sk-title");
    const chartEl = element.querySelector(".sk-chart");
    const tooltipEl = element.querySelector(".sk-tooltip");

    titleEl.innerText = config.title || "Revenue Flow";

    const dimensions = queryResponse.fields.dimension_like || [];
    const measures = queryResponse.fields.measure_like || [];

    if (!data || data.length === 0 || dimensions.length < 2 || measures.length < 1) {
      chartEl.innerHTML = `
        <div class="sk-empty">
          Add at least 2 dimensions and 1 measure.<br><br>
          Example:<br>
          Source → Country → Room Type<br>
          Measure: Revenue
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
      .then(() => loadScript("https://cdn.jsdelivr.net/npm/d3-sankey@0.12.3/dist/d3-sankey.min.js"))
      .then(() => {
        renderSankey();
        done();
      })
      .catch(error => {
        chartEl.innerHTML = `
          <div class="sk-empty">
            Could not load Sankey libraries.
          </div>
        `;
        done();
      });

    function renderSankey() {
      chartEl.innerHTML = "";

      const d3 = window.d3;

      const measureField = measures[0].name;
      const dimensionFields = dimensions.map(d => d.name);

      const colors = [
        "#36a9d6",
        "#ff9f2f",
        "#e95fb8",
        "#ef3d2f",
        "#74d17c",
        "#b994ff",
        "#f6c85f",
        "#4dd4ac"
      ];

      const prefix = config.value_prefix || "€";
      const maxNodesPerLevel = Number(config.max_nodes_per_level || 20);

      const formatValue = value => {
        if (Math.abs(value) >= 1000000) {
          return prefix + (value / 1000000).toFixed(1) + "M";
        }

        if (Math.abs(value) >= 1000) {
          return prefix + (value / 1000).toFixed(0) + "K";
        }

        return prefix + Number(value).toLocaleString(undefined, {
          maximumFractionDigits: 0
        });
      };

      const levelValues = {};

      dimensionFields.forEach((field, level) => {
        levelValues[level] = {};
      });

      data.forEach(row => {
        const value = Number(row[measureField]?.value || 0);

        if (!value || value <= 0) return;

        dimensionFields.forEach((field, level) => {
          const raw = row[field]?.value || "Unknown";
          const key = String(raw);

          levelValues[level][key] =
            (levelValues[level][key] || 0) + value;
        });
      });

      const allowedByLevel = {};

      Object.keys(levelValues).forEach(level => {
        allowedByLevel[level] = Object.entries(levelValues[level])
          .sort((a, b) => b[1] - a[1])
          .slice(0, maxNodesPerLevel)
          .map(d => d[0]);
      });

      const nodeMap = new Map();
      const linksMap = new Map();

      function getNodeId(level, name) {
        return level + "::" + name;
      }

      function addNode(level, name) {
        const id = getNodeId(level, name);

        if (!nodeMap.has(id)) {
          nodeMap.set(id, {
            id: id,
            name: name,
            level: level,
            color: colors[level % colors.length]
          });
        }

        return id;
      }

      data.forEach(row => {
        const value = Number(row[measureField]?.value || 0);

        if (!value || value <= 0) return;

        const path = dimensionFields.map((field, level) => {
          const raw = row[field]?.value || "Unknown";
          const name = String(raw);

          if (!allowedByLevel[level].includes(name)) {
            return "Other";
          }

          return name;
        });

        for (let i = 0; i < path.length - 1; i++) {
          const sourceId = addNode(i, path[i]);
          const targetId = addNode(i + 1, path[i + 1]);

          const linkKey = sourceId + "→" + targetId;

          if (!linksMap.has(linkKey)) {
            linksMap.set(linkKey, {
              source: sourceId,
              target: targetId,
              value: 0,
              sourceName: path[i],
              targetName: path[i + 1],
              sourceLevel: i
            });
          }

          linksMap.get(linkKey).value += value;
        }
      });

      const nodes = Array.from(nodeMap.values());
      const links = Array.from(linksMap.values()).filter(l => l.value > 0);

      if (nodes.length === 0 || links.length === 0) {
        chartEl.innerHTML = `
          <div class="sk-empty">
            No valid Sankey data found.
          </div>
        `;
        return;
      }

      const width = chartEl.clientWidth || 1000;
      const height = chartEl.clientHeight || 570;

      const svg = d3
        .select(chartEl)
        .append("svg")
        .attr("width", width)
        .attr("height", height);

      const sankey = d3
        .sankey()
        .nodeId(d => d.id)
        .nodeWidth(18)
        .nodePadding(16)
        .extent([
          [10, 10],
          [width - 10, height - 10]
        ]);

      const graph = sankey({
        nodes: nodes.map(d => Object.assign({}, d)),
        links: links.map(d => Object.assign({}, d))
      });

      const defs = svg.append("defs");

      graph.links.forEach((link, i) => {
        const gradient = defs
          .append("linearGradient")
          .attr("id", "sk-gradient-" + i)
          .attr("gradientUnits", "userSpaceOnUse")
          .attr("x1", link.source.x1)
          .attr("x2", link.target.x0);

        gradient
          .append("stop")
          .attr("offset", "0%")
          .attr("stop-color", link.source.color)
          .attr("stop-opacity", 0.45);

        gradient
          .append("stop")
          .attr("offset", "100%")
          .attr("stop-color", link.target.color)
          .attr("stop-opacity", 0.45);
      });

      svg
        .append("g")
        .attr("fill", "none")
        .selectAll("path")
        .data(graph.links)
        .enter()
        .append("path")
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke", (d, i) => "url(#sk-gradient-" + i + ")")
        .attr("stroke-width", d => Math.max(1, d.width))
        .attr("opacity", 0.82)
        .on("mousemove", function(event, d) {
          d3.select(this).attr("opacity", 1);

          tooltipEl.style.opacity = 1;
          tooltipEl.style.left = event.offsetX + "px";
          tooltipEl.style.top = event.offsetY + "px";
          tooltipEl.innerHTML = `
            <strong>${d.source.name}</strong> → <strong>${d.target.name}</strong><br>
            Value: ${formatValue(d.value)}
          `;
        })
        .on("mouseleave", function() {
          d3.select(this).attr("opacity", 0.82);
          tooltipEl.style.opacity = 0;
        });

      const node = svg
        .append("g")
        .selectAll("g")
        .data(graph.nodes)
        .enter()
        .append("g");

      node
        .append("rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("height", d => Math.max(1, d.y1 - d.y0))
        .attr("width", d => d.x1 - d.x0)
        .attr("rx", 3)
        .attr("fill", d => d.color)
        .attr("opacity", 0.95)
        .on("mousemove", function(event, d) {
          tooltipEl.style.opacity = 1;
          tooltipEl.style.left = event.offsetX + "px";
          tooltipEl.style.top = event.offsetY + "px";
          tooltipEl.innerHTML = `
            <strong>${d.name}</strong><br>
            Total: ${formatValue(d.value)}
          `;
        })
        .on("mouseleave", function() {
          tooltipEl.style.opacity = 0;
        });

      node
        .append("text")
        .attr("class", "sk-node-label")
        .attr("x", d => d.x0 < width / 2 ? d.x1 + 8 : d.x0 - 8)
        .attr("y", d => (d.y0 + d.y1) / 2 - 3)
        .attr("dy", "0.35em")
        .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
        .text(d => d.name.length > 24 ? d.name.slice(0, 24) + "…" : d.name);

      node
        .append("text")
        .attr("class", "sk-node-value")
        .attr("x", d => d.x0 < width / 2 ? d.x1 + 8 : d.x0 - 8)
        .attr("y", d => (d.y0 + d.y1) / 2 + 12)
        .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
        .text(d => formatValue(d.value));
    }
  }
});
