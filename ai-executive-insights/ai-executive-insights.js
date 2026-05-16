looker.plugins.visualizations.add({
  id: "ai_executive_insights",
  label: "AI Executive Insights",

  options: {
    title: {
      type: "string",
      label: "Title",
      default: "AI Executive Insights"
    },
    subtitle: {
      type: "string",
      label: "Subtitle",
      default: "Automated commercial performance interpretation"
    }
  },

  create: function(element) {
    element.innerHTML = `
      <style>
        .aei-wrap {
          width: 100%;
          height: 100%;
          min-height: 0;
          background:
            radial-gradient(circle at top right, rgba(54,169,214,0.18), transparent 34%),
            radial-gradient(circle at bottom left, rgba(185,148,255,0.14), transparent 36%),
            #030303;
          color: white;
          font-family: Inter, Arial, sans-serif;
          padding: clamp(12px, 2vw, 30px);
          box-sizing: border-box;
          overflow: hidden;
          position: relative;
        }

        .aei-wrap::before {
          content: "";
          position: absolute;
          inset: clamp(8px, 1.2vw, 18px);
          border-radius: 24px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.09);
          box-shadow:
            0 0 28px rgba(54,169,214,0.10),
            inset 0 0 28px rgba(255,255,255,0.025);
          pointer-events: none;
          animation: aeiPulse 4s ease-in-out infinite;
        }

        @keyframes aeiPulse {
          0%, 100% {
            box-shadow:
              0 0 24px rgba(54,169,214,0.08),
              inset 0 0 24px rgba(255,255,255,0.02);
          }
          50% {
            box-shadow:
              0 0 38px rgba(54,169,214,0.16),
              inset 0 0 30px rgba(255,255,255,0.035);
          }
        }

        .aei-card {
          position: relative;
          z-index: 2;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          transition: transform 0.25s ease, filter 0.25s ease;
        }

        .aei-card:hover {
          transform: translateY(-2px);
          filter: brightness(1.06);
        }

        .aei-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: clamp(10px, 1.4vw, 16px);
        }

        .aei-header-text {
          min-width: 0;
        }

        .aei-title {
          font-size: clamp(16px, 2.5vw, 30px);
          font-weight: 950;
          margin-bottom: 5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: -0.03em;
        }

        .aei-subtitle {
          font-size: clamp(10px, 1vw, 12px);
          color: rgba(255,255,255,0.55);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .aei-icon {
          width: clamp(34px, 5vw, 52px);
          height: clamp(34px, 5vw, 52px);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background:
            linear-gradient(135deg, rgba(54,169,214,0.25), rgba(185,148,255,0.18));
          border: 1px solid rgba(255,255,255,0.14);
          box-shadow: 0 0 22px rgba(54,169,214,0.18);
          color: #7bc8e6;
          font-size: clamp(17px, 2.5vw, 26px);
          font-weight: 950;
        }

        .aei-divider {
          height: 1px;
          width: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
          margin-bottom: clamp(12px, 1.8vw, 22px);
        }

        .aei-body {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: clamp(8px, 2vw, 28px);
          box-sizing: border-box;
          overflow: hidden;
        }

        .aei-message {
          max-width: 980px;
          font-size: clamp(18px, 3.5vw, 42px);
          line-height: 1.18;
          font-weight: 850;
          letter-spacing: -0.035em;
          color: rgba(255,255,255,0.94);
          animation: aeiFadeIn 0.65s ease both;
          white-space: normal;
          overflow-wrap: break-word;
        }

        @keyframes aeiFadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .aei-cyan {
          color: #7bc8e6;
          text-shadow: 0 0 14px rgba(123,200,230,0.22);
        }

        .aei-green {
          color: #74d17c;
          text-shadow: 0 0 14px rgba(116,209,124,0.18);
        }

        .aei-red {
          color: #ef3d2f;
          text-shadow: 0 0 14px rgba(239,61,47,0.18);
        }

        .aei-gold {
          color: #f6c85f;
          text-shadow: 0 0 14px rgba(246,200,95,0.18);
        }

        .aei-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          color: rgba(255,255,255,0.38);
          font-size: clamp(9px, 0.9vw, 11px);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .aei-status {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .aei-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #74d17c;
          box-shadow: 0 0 12px rgba(116,209,124,0.6);
        }

        .aei-tooltip {
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
          max-width: 300px;
        }

        .aei-empty {
          color: white;
          padding: 18px;
          font-size: 12px;
        }
      </style>

      <div class="aei-wrap">
        <div class="aei-card">
          <div class="aei-header">
            <div class="aei-header-text">
              <div class="aei-title"></div>
              <div class="aei-subtitle"></div>
            </div>
            <div class="aei-icon">AI</div>
          </div>

          <div class="aei-divider"></div>

          <div class="aei-body">
            <div class="aei-message"></div>
          </div>

          <div class="aei-divider"></div>

          <div class="aei-footer">
            <div class="aei-status">
              <span class="aei-status-dot"></span>
              Commercial Copilot
            </div>
            <div>Revenue Tales Intelligence</div>
          </div>
        </div>

        <div class="aei-tooltip"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const wrapEl = element.querySelector(".aei-wrap");
    const titleEl = element.querySelector(".aei-title");
    const subtitleEl = element.querySelector(".aei-subtitle");
    const messageEl = element.querySelector(".aei-message");
    const tooltipEl = element.querySelector(".aei-tooltip");

    titleEl.innerText = config.title || "AI Executive Insights";
    subtitleEl.innerText = config.subtitle || "Automated commercial performance interpretation";

    const dimensions = queryResponse.fields.dimension_like || [];
    const measures = queryResponse.fields.measure_like || [];
    const tableCalcs = queryResponse.fields.table_calculations || [];

    const allFields = [
      ...dimensions,
      ...measures,
      ...tableCalcs
    ];

    if (!data || data.length === 0 || allFields.length < 1) {
      messageEl.innerHTML = `
        <div class="aei-empty">
          Add the field: Executive AI Insight Message
        </div>
      `;
      done();
      return;
    }

    function clean(value) {
      return String(value || "")
        .replace(/(<([^>]+)>)/gi, "")
        .trim();
    }

    function getFieldValue(row, field) {
      if (!field) return null;
      const cell = row[field.name];
      if (!cell) return null;
      return clean(cell.rendered || cell.value);
    }

    function findFieldByName(patterns) {
      return allFields.find(field => {
        const name = String(field.name || "").toLowerCase();
        const label = String(field.label || field.label_short || "").toLowerCase();
        return patterns.some(pattern => name.includes(pattern) || label.includes(pattern));
      });
    }

    const insightField =
      findFieldByName(["executive ai insight", "ai insight", "insight message", "alert message"]) ||
      allFields[0];

    const revenueVarianceField =
      findFieldByName(["revenue variance", "revenue var", "revenue diff", "revenue_vs"]);

    const adrVarianceField =
      findFieldByName(["adr variance", "adr var", "adr diff", "adr_vs"]);

    const occupancyVarianceField =
      findFieldByName(["occupancy variance", "occupancy var", "occupancy diff", "occupancy_vs"]);

    const otbVarianceField =
      findFieldByName(["otb variance", "otb var", "otb diff", "stly", "pace variance"]);

    const row = data[0];

    const rawMessage = getFieldValue(row, insightField) || "No executive insight available.";

    function escapeHtml(text) {
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function highlightText(text) {
      let html = escapeHtml(text);

      html = html.replace(
        /([+-]?\d+(?:[.,]\d+)?%)/g,
        '<span class="aei-cyan">$1</span>'
      );

      html = html.replace(
        /\b(up|increase|increased|growth|ahead|strong|stronger|improved|positive|higher)\b/gi,
        '<span class="aei-green">$1</span>'
      );

      html = html.replace(
        /\b(down|decrease|decreased|drop|behind|soft|softening|weak|weaker|negative|lower|risk)\b/gi,
        '<span class="aei-red">$1</span>'
      );

      html = html.replace(
        /\b(OTB|STLY|Same Time Last Year|comparison year|LY|Last Year)\b/g,
        '<span class="aei-gold">$1</span>'
      );

      return html;
    }

    messageEl.innerHTML = highlightText(rawMessage);

    function tooltipLine(label, field) {
      const value = getFieldValue(row, field);
      if (!value) return "";
      return `${label}: <strong>${value}</strong><br>`;
    }

    wrapEl.onmousemove = function(event) {
      const rect = wrapEl.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const tooltipHtml = `
        ${tooltipLine("Revenue variance", revenueVarianceField)}
        ${tooltipLine("ADR variance", adrVarianceField)}
        ${tooltipLine("Occupancy variance", occupancyVarianceField)}
        ${tooltipLine("OTB variance", otbVarianceField)}
      `;

      if (!tooltipHtml.trim()) return;

      tooltipEl.style.opacity = 1;
      tooltipEl.style.left = Math.min(x + 14, rect.width - 260) + "px";
      tooltipEl.style.top = Math.max(y - 18, 20) + "px";
      tooltipEl.innerHTML = tooltipHtml;
    };

    wrapEl.onmouseleave = function() {
      tooltipEl.style.opacity = 0;
    };

    done();
  }
});
