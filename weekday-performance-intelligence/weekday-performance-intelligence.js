looker.plugins.visualizations.add({
  id: "weekday_performance_intelligence",
  label: "Weekday Performance Intelligence",

  options: {
    title: {
      type: "string",
      label: "Title",
      default: "Weekday Performance Intelligence"
    },
    subtitle: {
      type: "string",
      label: "Subtitle",
      default: "Revenue and demand behavior across weekdays"
    },
    value_prefix: {
      type: "string",
      label: "Currency Prefix",
      default: "€"
    },
    yoy_measure_position: {
      type: "string",
      label: "YoY Measure Position: none / fifth",
      default: "none"
    }
  },

  create: function(element) {
    element.innerHTML = `
      <style>
        .wpi-wrap {
          width: 100%;
          height: 100%;
          min-height: 0;
          background:
            radial-gradient(circle at top right, rgba(54,169,214,0.18), transparent 34%),
            radial-gradient(circle at bottom left, rgba(185,148,255,0.12), transparent 36%),
            #030303;
          color: white;
          font-family: Inter, Arial, sans-serif;
          padding: clamp(10px, 1.8vw, 28px);
          box-sizing: border-box;
          overflow: hidden;
          position: relative;
        }

        .wpi-wrap::before {
          content: "";
          position: absolute;
          inset: clamp(8px, 1.2vw, 18px);
          border-radius: 22px;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.08);
          pointer-events: none;
          animation: wpiGlow 5s ease-in-out infinite;
        }

        @keyframes wpiGlow {
          0%, 100% {
            box-shadow: 0 0 22px rgba(54,169,214,0.08), inset 0 0 22px rgba(255,255,255,0.018);
          }
          50% {
            box-shadow: 0 0 38px rgba(54,169,214,0.16), inset 0 0 28px rgba(255,255,255,0.03);
          }
        }

        .wpi-header {
          position: relative;
          z-index: 2;
        }

        .wpi-title {
          font-size: clamp(16px, 2.5vw, 30px);
          font-weight: 950;
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: -0.03em;
        }

        .wpi-subtitle {
          font-size: clamp(10px, 1vw, 12px);
          color: rgba(255,255,255,0.55);
          margin-bottom: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .wpi-grid {
          position: relative;
          z-index: 2;
          width: 100%;
          height: calc(100% - 58px);
          min-height: 180px;
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: clamp(7px, 1vw, 14px);
        }

        .wpi-day {
          position: relative;
          min-width: 0;
          height: 100%;
          border-radius: clamp(14px, 1.8vw, 22px);
          border: 1px solid rgba(255,255,255,0.09);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.018));
          box-shadow: inset 0 0 20px rgba(255,255,255,0.02);
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.22s ease, opacity 0.22s ease, filter 0.22s ease;
          padding: clamp(8px, 1.1vw, 16px);
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .wpi-day:hover {
          transform: translateY(-4px);
          filter: brightness(1.12);
        }

        .wpi-day.muted {
          opacity: 0.22;
        }

        .wpi-day::before {
          content: "";
          position: absolute;
          inset: 0;
          background: var(--intensity-bg);
          opacity: var(--intensity-opacity);
          pointer-events: none;
        }

        .wpi-day::after {
          content: "";
          position: absolute;
          inset: -40%;
          background: linear-gradient(120deg, transparent, rgba(123,200,230,0.20), transparent);
          transform: translateX(-80%);
          animation: wpiSweep 5.5s ease-in-out infinite;
          pointer-events: none;
        }

        @keyframes wpiSweep {
          0%, 68%, 100% { transform: translateX(-80%); }
          82% { transform: translateX(80%); }
        }

        .wpi-day-content {
          position: relative;
          z-index: 2;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-width: 0;
        }

        .wpi-day-name {
          font-size: clamp(11px, 1.15vw, 14px);
          font-weight: 950;
          color: rgba(255,255,255,0.92);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .wpi-revenue {
          font-size: clamp(16px, 2.4vw, 34px);
          line-height: 1;
          font-weight: 950;
          color: white;
          letter-spacing: -0.04em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-shadow: 0 0 18px rgba(123,200,230,0.20);
        }

        .wpi-bars {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .wpi-metric {
          min-width: 0;
        }

        .wpi-metric-row {
          display: flex;
          justify-content: space-between;
          gap: 6px;
          font-size: clamp(8px, 0.85vw, 10px);
          color: rgba(255,255,255,0.58);
          font-weight: 800;
          margin-bottom: 4px;
        }

        .wpi-bar-bg {
          width: 100%;
          height: clamp(5px, 0.65vw, 8px);
          background: rgba(255,255,255,0.10);
          border-radius: 999px;
          overflow: hidden;
        }

        .wpi-bar {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #1c6f91, #36a9d6, #7bc8e6);
          box-shadow: 0 0 12px rgba(54,169,214,0.35);
          transition: width 0.4s ease;
        }

        .wpi-tooltip {
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

        .wpi-empty {
          color: white;
          padding: 18px;
          font-size: 12px;
        }
      </style>

      <div class="wpi-wrap">
        <div class="wpi-header">
          <div class="wpi-title"></div>
          <div class="wpi-subtitle"></div>
        </div>
        <div class="wpi-grid"></div>
        <div class="wpi-tooltip"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const wrapEl = element.querySelector(".wpi-wrap");
    const titleEl = element.querySelector(".wpi-title");
    const subtitleEl = element.querySelector(".wpi-subtitle");
    const gridEl = element.querySelector(".wpi-grid");
    const tooltipEl = element.querySelector(".wpi-tooltip");

    titleEl.innerText = config.title || "Weekday Performance Intelligence";
    subtitleEl.innerText = config.subtitle || "Revenue and demand behavior across weekdays";

    const dimensions = queryResponse.fields.dimension_like || [];
    const measures = queryResponse.fields.measure_like || [];

    if (!data || data.length === 0 || dimensions.length < 1 || measures.length < 4) {
      gridEl.innerHTML = `
        <div class="wpi-empty">
          Add 1 weekday dimension and 4 measures.<br><br>
          Dimension: Day of Week<br>
          Measure 1: Room Revenue Selected Year<br>
          Measure 2: ADR Selected Year<br>
          Measure 3: Occupancy Selected Year<br>
          Measure 4: RevPAR Selected Year<br>
          Optional Measure 5: YoY Variance %
        </div>
      `;
      done();
      return;
    }

    const dayField = dimensions[0].name;
    const revenueField = measures[0].name;
    const adrField = measures[1].name;
    const occupancyField = measures[2].name;
    const revparField = measures[3].name;
    const yoyField =
      config.yoy_measure_position === "fifth" && measures.length >= 5
        ? measures[4].name
        : null;

    const prefix = config.value_prefix || "€";

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

    function formatEuro(v) {
      return prefix + Number(v || 0).toLocaleString(undefined, {
        maximumFractionDigits: 0
      });
    }

    function pctValue(v) {
      let num = Number(v || 0);
      if (Math.abs(num) <= 1.2) num = num * 100;
      return num;
    }

    function formatPct(v) {
      const num = pctValue(v);
      return num.toFixed(1) + "%";
    }

    function dayRank(day) {
      const d = String(day || "").toLowerCase();

      if (d.includes("mon") || d.includes("δευ") || d === "1" || d.includes("monday")) return 1;
      if (d.includes("tue") || d.includes("τρι") || d === "2" || d.includes("tuesday")) return 2;
      if (d.includes("wed") || d.includes("τετ") || d === "3" || d.includes("wednesday")) return 3;
      if (d.includes("thu") || d.includes("πεμ") || d === "4" || d.includes("thursday")) return 4;
      if (d.includes("fri") || d.includes("παρ") || d === "5" || d.includes("friday")) return 5;
      if (d.includes("sat") || d.includes("σαβ") || d === "6" || d.includes("saturday")) return 6;
      if (d.includes("sun") || d.includes("κυρ") || d === "7" || d.includes("sunday")) return 7;

      return 99;
    }

    function shortDay(day) {
      const rank = dayRank(day);
      const names = {
        1: "Monday",
        2: "Tuesday",
        3: "Wednesday",
        4: "Thursday",
        5: "Friday",
        6: "Saturday",
        7: "Sunday"
      };

      return names[rank] || day;
    }

    const rows = data
      .map(row => {
        const day =
          clean(row[dayField]?.rendered) ||
          clean(row[dayField]?.value) ||
          "Unknown";

        return {
          day: shortDay(day),
          rank: dayRank(day),
          revenue: Number(row[revenueField]?.value || 0),
          adr: Number(row[adrField]?.value || 0),
          occupancy: pctValue(row[occupancyField]?.value || 0),
          revpar: Number(row[revparField]?.value || 0),
          yoy: yoyField ? Number(row[yoyField]?.value || 0) : null,
          revenueRendered: row[revenueField]?.rendered || null,
          adrRendered: row[adrField]?.rendered || null,
          occupancyRendered: row[occupancyField]?.rendered || null,
          revparRendered: row[revparField]?.rendered || null,
          yoyRendered: yoyField ? row[yoyField]?.rendered : null
        };
      })
      .filter(row => row.day && isFinite(row.revenue))
      .sort((a, b) => a.rank - b.rank);

    if (!rows.length) {
      gridEl.innerHTML = `<div class="wpi-empty">No valid weekday data found.</div>`;
      done();
      return;
    }

    const maxRevenue = Math.max(...rows.map(r => r.revenue), 1);
    const maxAdr = Math.max(...rows.map(r => r.adr), 1);
    const maxOcc = Math.max(...rows.map(r => r.occupancy), 1);
    const maxRevpar = Math.max(...rows.map(r => r.revpar), 1);

    const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0) || 1;

    function intensity(row) {
      return Math.max(0.08, Math.min(1, row.revenue / maxRevenue));
    }

    function getInsight(row) {
      const share = row.revenue / totalRevenue * 100;
      const isWeekend = row.rank >= 6;
      const highOcc = row.occupancy >= 80;
      const lowOcc = row.occupancy < 50;
      const highAdr = row.adr >= maxAdr * 0.75;

      if (isWeekend && highOcc && highAdr) {
        return {
          text: "Weekend premium compression",
          color: "#74d17c"
        };
      }

      if (highOcc && !highAdr) {
        return {
          text: "Occupancy pressure pricing opportunity",
          color: "#36a9d6"
        };
      }

      if (lowOcc) {
        return {
          text: "Weak demand period",
          color: "#ef3d2f"
        };
      }

      if (share >= 18) {
        return {
          text: "Strong revenue weekday",
          color: "#7bc8e6"
        };
      }

      return {
        text: "Balanced weekday performance",
        color: "rgba(255,255,255,0.62)"
      };
    }

    gridEl.innerHTML = rows.map(row => {
      const revenueIntensity = intensity(row);
      const opacity = 0.18 + revenueIntensity * 0.74;
      const glow = 8 + revenueIntensity * 28;

      return `
        <div
          class="wpi-day"
          data-day="${row.day}"
          style="
            --intensity-bg: linear-gradient(180deg, rgba(54,169,214,${opacity}), rgba(123,200,230,${opacity * 0.22}));
            --intensity-opacity: ${0.75};
            box-shadow: 0 0 ${glow}px rgba(54,169,214,${0.08 + revenueIntensity * 0.18}), inset 0 0 22px rgba(255,255,255,0.025);
          "
        >
          <div class="wpi-day-content">
            <div class="wpi-day-name">${row.day}</div>

            <div class="wpi-revenue">
              ${row.revenueRendered || formatCurrency(row.revenue)}
            </div>

            <div class="wpi-bars">
              <div class="wpi-metric">
                <div class="wpi-metric-row">
                  <span>ADR</span>
                  <span>${row.adrRendered || formatEuro(row.adr)}</span>
                </div>
                <div class="wpi-bar-bg">
                  <div class="wpi-bar" style="width:${Math.min(100, row.adr / maxAdr * 100)}%;"></div>
                </div>
              </div>

              <div class="wpi-metric">
                <div class="wpi-metric-row">
                  <span>Occ</span>
                  <span>${row.occupancyRendered || row.occupancy.toFixed(1) + "%"}</span>
                </div>
                <div class="wpi-bar-bg">
                  <div class="wpi-bar" style="width:${Math.min(100, row.occupancy / maxOcc * 100)}%;"></div>
                </div>
              </div>

              <div class="wpi-metric">
                <div class="wpi-metric-row">
                  <span>RevPAR</span>
                  <span>${row.revparRendered || formatEuro(row.revpar)}</span>
                </div>
                <div class="wpi-bar-bg">
                  <div class="wpi-bar" style="width:${Math.min(100, row.revpar / maxRevpar * 100)}%;"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    const cards = gridEl.querySelectorAll(".wpi-day");

    cards.forEach(card => {
      const day = card.getAttribute("data-day");
      const row = rows.find(r => r.day === day);

      card.addEventListener("mousemove", event => {
        cards.forEach(c => {
          if (c !== card) c.classList.add("muted");
        });

        const rect = wrapEl.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const share = row.revenue / totalRevenue * 100;
        const insight = getInsight(row);

        tooltipEl.style.opacity = 1;
        tooltipEl.style.left = Math.min(x + 14, rect.width - 270) + "px";
        tooltipEl.style.top = Math.max(y - 18, 20) + "px";

        tooltipEl.innerHTML = `
          <strong>${row.day}</strong><br>
          Revenue: <strong>${row.revenueRendered || formatCurrency(row.revenue)}</strong><br>
          ADR: <strong>${row.adrRendered || formatEuro(row.adr)}</strong><br>
          Occupancy: <strong>${row.occupancyRendered || row.occupancy.toFixed(1) + "%"}</strong><br>
          RevPAR: <strong>${row.revparRendered || formatEuro(row.revpar)}</strong><br>
          ${yoyField ? `YoY Variance: <strong>${row.yoyRendered || formatPct(row.yoy)}</strong><br>` : ""}
          Revenue Share: <strong>${share.toFixed(1)}%</strong><br>
          <span style="color:${insight.color};">${insight.text}</span>
        `;
      });

      card.addEventListener("mouseleave", () => {
        cards.forEach(c => c.classList.remove("muted"));
        tooltipEl.style.opacity = 0;
      });

      card.addEventListener("click", () => {
        const isActive = card.classList.contains("active");

        cards.forEach(c => {
          c.classList.remove("active");
          c.classList.remove("muted");
        });

        if (!isActive) {
          cards.forEach(c => c.classList.add("muted"));
          card.classList.remove("muted");
          card.classList.add("active");
        }
      });
    });

    done();
  }
});
