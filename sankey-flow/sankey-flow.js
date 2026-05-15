looker.plugins.visualizations.add({
  id: "sankey_flow",
  label: "Sankey Flow",

  options: {
    title: {
      type: "string",
      label: "Title",
      default: "Revenue Flow"
    },
    value_format: {
      type: "string",
      label: "Value Format: auto / currency / percent / number",
      default: "currency"
    },
    value_prefix: {
      type: "string",
      label: "Value Prefix",
      default: "€"
    },
    value_suffix: {
      type: "string",
      label: "Value Suffix",
      default: ""
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
          max-width: 280px;
        }

        .sk-empty {
          padding: 30px;
          color: white;
        }

        .sk-node-label {
          fill: rgba(255,255,255,0.92);
          font-size: 11px;
          font-weight: 700;
          pointer-events: none;
        }

        .sk-node-value {
          fill: rgba(255,255,255,0.55);
          font-size: 10px;
          pointer-events: none;
        }

        .sk-hint {
          position: absolute;
          right: 42px;
          top: 42px;
          color: rgba(255,255,255,0.45);
          font-size: 11px;
        }
      </style>

      <div class="sk-wrap">
        <div class="sk-title"></div>
        <div class="sk-hint">Click a node to isolate path</div>
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
          Book Source → Country → Rate Name<br>
          Measure: Revenue / % of Total / Nights / Bookings
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
      .catch(() => {
        chartEl.innerHTML = `<div class="sk-empty">Could not load Sankey libraries.</div>`;
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

      const maxNodesPerLevel = Number(config.max_nodes_per_level || 20);
      const valueFormat = config.value_format || "currency";
      const prefix = config.value_prefix || "€";
      const suffix = config.value_suffix || "";

      const formatValue = value => {
        const v = Number(value || 0);

        if (valueFormat === "percent") {
          if (Math.abs(v) <= 1) {
            return (v * 100).toFixed(1) + "%";
          }
          return v.toFixed(1) + "%";
        }

        if (valueFormat === "number") {
          return v.toLocaleString(undefined, {
            maximumFractionDigits: 0
          });
        }

        if (valueFormat === "auto") {
          return v.toLocaleString(undefined, {
            maximumFractionDigits: 2
          }) + suffix;
        }

        if (Math.abs(v) >= 1000000) {
          return prefix + (v / 1000000).toFixed(1) + "M" + suffix;
        }

        if (Math.abs(v) >= 1000) {
          return prefix + (v / 1000).toFixed(0) + "K" + suffix;
        }

        return prefix + v.toLocaleString(undefined, {
          maximumFractionDigits: 0
        }) + suffix;
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
            id,
            name,
            level,
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
        chartEl.innerHTML = `<div class="sk-empty">No valid Sankey data found.</div>`;
        return;
      }

      const width = chartEl.clientWidth || 1000;
      const height = chartEl.clientHeight || 570;

      const svg = d3
        .select(chartEl)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("cursor", "default");

      svg.on("click", function(event) {
        if (event.target.tagName === "svg") {
          resetHighlight();
        }
      });

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
          .attr("stop-opacity", 0.5);

        gradient
          .append("stop")
          .attr("offset", "100%")
          .attr("stop-color", link.target.color)
          .attr("stop-opacity", 0.5);
      });

      const linkSelection = svg
        .append("g")
        .attr("fill", "none")
        .selectAll("path")
        .data(graph.links)
        .enter()
        .append("path")
        .attr("class", "sk-link")
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke", (d, i) => "url(#sk-gradient-" + i + ")")
        .attr("stroke-width", d => Math.max(1, d.width))
        .attr("opacity", 0.82)
        .style("cursor", "pointer")
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
          tooltipEl.style.opacity = 0;
        })
        .on("click", function(event, d) {
          event.stopPropagation();
          highlightLink(d);
        });

      const node = svg
        .append("g")
        .selectAll("g")
        .data(graph.nodes)
        .enter()
        .append("g")
        .attr("class", "sk-node")
        .style("cursor", "pointer")
        .on("click", function(event, d) {
          event.stopPropagation();
          highlightNodePath(d);
        });

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
            Total: ${formatValue(d.value)}<br>
            Level: ${d.level + 1}
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

      function getConnectedPathIds(selectedNode) {
        const connectedNodes = new Set();
        const connectedLinks = new Set();

        connectedNodes.add(selectedNode.id);

        let changed = true;

        while (changed) {
          changed = false;

          graph.links.forEach(link => {
            const sourceId = link.source.id;
            const targetId = link.target.id;

            if (connectedNodes.has(sourceId) || connectedNodes.has(targetId)) {
              const linkId = sourceId + "→" + targetId;

              if (!connectedLinks.has(linkId)) {
                connectedLinks.add(linkId);
                changed = true;
              }

              if (!connectedNodes.has(sourceId)) {
                connectedNodes.add(sourceId);
                changed = true;
              }

              if (!connectedNodes.has(targetId)) {
                connectedNodes.add(targetId);
                changed = true;
              }
            }
          });
        }

        return { connectedNodes, connectedLinks };
      }

      function highlightNodePath(selectedNode) {
        const { connectedNodes, connectedLinks } =
          getConnectedPathIds(selectedNode);

        linkSelection
          .transition()
          .duration(200)
          .attr("opacity", d => {
            const id = d.source.id + "→" + d.target.id;
            return connectedLinks.has(id) ? 1 : 0.08;
          })
          .attr("stroke-width", d => {
            const id = d.source.id + "→" + d.target.id;
            return connectedLinks.has(id)
              ? Math.max(2, d.width)
              : Math.max(1, d.width * 0.4);
          });

        node
          .transition()
          .duration(200)
          .attr("opacity", d => connectedNodes.has(d.id) ? 1 : 0.15);
      }

      function highlightLink(selectedLink) {
        const selectedLinkId =
          selectedLink.source.id + "→" + selectedLink.target.id;

        const visibleNodes = new Set([
          selectedLink.source.id,
          selectedLink.target.id
        ]);

        linkSelection
          .transition()
          .duration(200)
          .attr("opacity", d => {
            const id = d.source.id + "→" + d.target.id;
            return id === selectedLinkId ? 1 : 0.08;
          });

        node
          .transition()
          .duration(200)
          .attr("opacity", d => visibleNodes.has(d.id) ? 1 : 0.15);
      }

      function resetHighlight() {
        linkSelection
          .transition()
          .duration(200)
          .attr("opacity", 0.82)
          .attr("stroke-width", d => Math.max(1, d.width));

        node
          .transition()
          .duration(200)
          .attr("opacity", 1);
      }
    }
  }
});
