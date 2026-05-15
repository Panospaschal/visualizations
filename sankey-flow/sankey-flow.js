looker.plugins.visualizations.add({
  id: "sankey_flow",
  label: "Sankey Flow",

  options: {
    title: { type: "string", label: "Title", default: "Revenue Flow" },
    value_format: {
      type: "string",
      label: "Value Format: auto / currency / percent / number",
      default: "currency"
    },
    value_prefix: { type: "string", label: "Value Prefix", default: "€" },
    value_suffix: { type: "string", label: "Value Suffix", default: "" },
    max_nodes_per_level: {
      type: "number",
      label: "Max Nodes Per Level",
      default: 12
    }
  },

  create: function(element) {
    element.innerHTML = `
      <style>
        .sk-wrap {
          width: 100%;
          height: 100%;
          min-height: 0;
          background: #030303;
          color: white;
          font-family: Inter, Arial, sans-serif;
          padding: clamp(8px, 1.5vw, 24px);
          box-sizing: border-box;
          overflow: hidden;
          position: relative;
        }

        .sk-title {
          height: 36px;
          font-size: clamp(16px, 2.4vw, 30px);
          font-weight: 900;
          margin: 0 0 8px 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sk-chart {
          width: 100%;
          height: calc(100% - 44px);
          min-height: 120px;
          overflow: hidden;
          position: relative;
        }

        .sk-chart svg {
          width: 100%;
          height: 100%;
          display: block;
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

        .sk-node-label {
          fill: rgba(255,255,255,0.92);
          font-size: clamp(8px, 0.85vw, 11px);
          font-weight: 800;
          pointer-events: none;
        }

        .sk-node-value {
          fill: rgba(255,255,255,0.55);
          font-size: clamp(7px, 0.75vw, 10px);
          pointer-events: none;
        }

        .sk-empty {
          color: white;
          font-size: 12px;
          padding: 16px;
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
          Add at least 2 dimensions and 1 measure.
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

      const bounds = chartEl.getBoundingClientRect();
      const width = Math.max(bounds.width, 320);
      const height = Math.max(bounds.height, 160);

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

      const maxNodesPerLevel = Number(config.max_nodes_per_level || 12);
      const valueFormat = config.value_format || "currency";
      const prefix = config.value_prefix || "€";
      const suffix = config.value_suffix || "";

      function formatValue(value) {
        const v = Number(value || 0);

        if (valueFormat === "percent") {
          if (Math.abs(v) <= 1) return (v * 100).toFixed(1) + "%";
          return v.toFixed(1) + "%";
        }

        if (valueFormat === "number") {
          return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
        }

        if (valueFormat === "auto") {
          return v.toLocaleString(undefined, { maximumFractionDigits: 2 }) + suffix;
        }

        if (Math.abs(v) >= 1000000) return prefix + (v / 1000000).toFixed(1) + "M" + suffix;
        if (Math.abs(v) >= 1000) return prefix + (v / 1000).toFixed(0) + "K" + suffix;

        return prefix + v.toLocaleString(undefined, { maximumFractionDigits: 0 }) + suffix;
      }

      const levelValues = {};
      dimensionFields.forEach((field, level) => {
        levelValues[level] = {};
      });

      data.forEach(row => {
        const value = Number(row[measureField]?.value || 0);
        if (!value || value <= 0) return;

        dimensionFields.forEach((field, level) => {
          const key = String(row[field]?.value || "Unknown");
          levelValues[level][key] = (levelValues[level][key] || 0) + value;
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
          const name = String(row[field]?.value || "Unknown");
          return allowedByLevel[level].includes(name) ? name : "Other";
        });

        for (let i = 0; i < path.length - 1; i++) {
          const sourceId = addNode(i, path[i]);
          const targetId = addNode(i + 1, path[i + 1]);
          const linkKey = sourceId + "→" + targetId;

          if (!linksMap.has(linkKey)) {
            linksMap.set(linkKey, {
              source: sourceId,
              target: targetId,
              value: 0
            });
          }

          linksMap.get(linkKey).value += value;
        }
      });

      const nodes = Array.from(nodeMap.values());
      const links = Array.from(linksMap.values()).filter(l => l.value > 0);

      if (!nodes.length || !links.length) {
        chartEl.innerHTML = `<div class="sk-empty">No valid Sankey data found.</div>`;
        return;
      }

      const levelCount = dimensionFields.length;

      const leftMargin = width < 600 ? 6 : 12;
      const rightMargin = width < 600 ? 6 : 12;
      const topMargin = 6;
      const bottomMargin = 6;

      const nodeWidth = Math.max(7, Math.min(18, width * 0.014));
      const nodePadding = Math.max(4, Math.min(14, height * 0.018));

      const svg = d3
        .select(chartEl)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

      svg.on("click", function(event) {
        if (event.target.tagName === "svg") {
          resetHighlight();
        }
      });

      const sankey = d3
        .sankey()
        .nodeId(d => d.id)
        .nodeWidth(nodeWidth)
        .nodePadding(nodePadding)
        .extent([
          [leftMargin, topMargin],
          [width - rightMargin, height - bottomMargin]
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

        gradient.append("stop")
          .attr("offset", "0%")
          .attr("stop-color", link.source.color)
          .attr("stop-opacity", 0.5);

        gradient.append("stop")
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
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke", (d, i) => "url(#sk-gradient-" + i + ")")
        .attr("stroke-width", d => Math.max(1, d.width))
        .attr("opacity", 0.82)
        .style("cursor", "pointer")
        .on("mousemove", function(event, d) {
          d3.select(this).attr("opacity", 1);

          const point = d3.pointer(event, chartEl);

          tooltipEl.style.opacity = 1;
          tooltipEl.style.left = point[0] + "px";
          tooltipEl.style.top = point[1] + "px";
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
          const point = d3.pointer(event, chartEl);

          tooltipEl.style.opacity = 1;
          tooltipEl.style.left = point[0] + "px";
          tooltipEl.style.top = point[1] + "px";
          tooltipEl.innerHTML = `
            <strong>${d.name}</strong><br>
            Total: ${formatValue(d.value)}
          `;
        })
        .on("mouseleave", function() {
          tooltipEl.style.opacity = 0;
        });

      const maxLabelChars =
        width < 500 ? 9 :
        width < 800 ? 14 :
        width < 1100 ? 18 :
        24;

      function shorten(text) {
        if (!text) return "";
        return text.length > maxLabelChars
          ? text.slice(0, maxLabelChars) + "…"
          : text;
      }

      node
        .append("text")
        .attr("class", "sk-node-label")
        .attr("x", d => {
          if (levelCount === 2) {
            return d.level === 0 ? d.x1 + 5 : d.x0 - 5;
          }

          if (d.level === 0) return d.x1 + 5;
          if (d.level === levelCount - 1) return d.x0 - 5;
          return d.x1 + 5;
        })
        .attr("y", d => (d.y0 + d.y1) / 2 - 3)
        .attr("dy", "0.35em")
        .attr("text-anchor", d => {
          if (levelCount === 2) {
            return d.level === 0 ? "start" : "end";
          }

          if (d.level === levelCount - 1) return "end";
          return "start";
        })
        .text(d => shorten(d.name));

      node
        .append("text")
        .attr("class", "sk-node-value")
        .attr("x", d => {
          if (levelCount === 2) {
            return d.level === 0 ? d.x1 + 5 : d.x0 - 5;
          }

          if (d.level === 0) return d.x1 + 5;
          if (d.level === levelCount - 1) return d.x0 - 5;
          return d.x1 + 5;
        })
        .attr("y", d => (d.y0 + d.y1) / 2 + 11)
        .attr("text-anchor", d => {
          if (levelCount === 2) {
            return d.level === 0 ? "start" : "end";
          }

          if (d.level === levelCount - 1) return "end";
          return "start";
        })
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
        const { connectedNodes, connectedLinks } = getConnectedPathIds(selectedNode);

        linkSelection
          .transition()
          .duration(200)
          .attr("opacity", d => {
            const id = d.source.id + "→" + d.target.id;
            return connectedLinks.has(id) ? 1 : 0.05;
          })
          .attr("stroke-width", d => {
            const id = d.source.id + "→" + d.target.id;
            return connectedLinks.has(id)
              ? Math.max(2, d.width)
              : Math.max(1, d.width * 0.3);
          });

        node
          .transition()
          .duration(200)
          .attr("opacity", d => connectedNodes.has(d.id) ? 1 : 0.12);
      }

      function highlightLink(selectedLink) {
        const selectedLinkId = selectedLink.source.id + "→" + selectedLink.target.id;

        const visibleNodes = new Set([
          selectedLink.source.id,
          selectedLink.target.id
        ]);

        linkSelection
          .transition()
          .duration(200)
          .attr("opacity", d => {
            const id = d.source.id + "→" + d.target.id;
            return id === selectedLinkId ? 1 : 0.05;
          });

        node
          .transition()
          .duration(200)
          .attr("opacity", d => visibleNodes.has(d.id) ? 1 : 0.12);
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
