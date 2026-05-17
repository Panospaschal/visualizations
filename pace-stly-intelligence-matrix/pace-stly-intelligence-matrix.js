looker.plugins.visualizations.add({
  id: "pace_stly_intelligence_matrix",
  label: "Pace vs STLY Intelligence Matrix",

  options: {
    title: {
      type: "string",
      label: "Title",
      default: "Pace vs STLY Intelligence Matrix"
    },
    subtitle: {
      type: "string",
      label: "Subtitle",
      default: "Forward-looking pacing analysis versus same time last year"
    }
  },

  create: function(element) {
    element.innerHTML = `
      <style>
        .psim-wrap {
          width: 100%;
          height: 100%;
          min-height: 0;
          background:
            radial-gradient(circle at top right, rgba(54,169,214,0.18), transparent 34%),
            radial-gradient(circle at bottom left, rgba(185,148,255,0.14), transparent 38%),
            #030303;
          color: white;
          font-family: Inter, Arial, sans-serif;
          padding: clamp(10px,1.8vw,28px);
          box-sizing: border-box;
          overflow: hidden;
          position: relative;
        }

        .psim-wrap::before {
          content: "";
          position: absolute;
          inset: clamp(8px,1.2vw,18px);
          border-radius: 22px;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow:
            0 0 34px rgba(54,169,214,0.08),
            inset 0 0 24px rgba(255,255,255,0.018);
          pointer-events: none;
        }

        .psim-header {
          position: relative;
          z-index: 2;
        }

        .psim-title {
          font-size: clamp(16px,2.5vw,30px);
          font-weight: 950;
          margin-bottom: 6px;
          letter-spacing: -0.03em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .psim-subtitle {
          font-size: clamp(10px,1vw,12px);
          color: rgba(255,255,255,0.55);
          margin-bottom: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .psim-table-wrap {
          position: relative;
          z-index: 2;
          width: 100%;
          height: calc(100% - 58px);
          min-height: 180px;
          overflow: hidden;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.09);
          background: rgba(255,255,255,0.028);
          box-shadow: inset 0 0 24px rgba(255,255,255,0.018);
        }

        .psim-scroll {
          width: 100%;
          height: 100%;
          overflow: auto;
        }

        .psim-scroll::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        .psim-scroll::-webkit-scrollbar-thumb {
          background: rgba(54,169,214,0.35);
          border-radius: 999px;
        }

        .psim-table {
          width: 100%;
          min-width: 720px;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .psim-table thead {
          position: sticky;
          top: 0;
          z-index: 3;
          background: rgba(3,3,3,0.96);
          backdrop-filter: blur(14px);
        }

        .psim-table th {
          text-align: right;
          padding: 11px 14px;
          font-size: 10px;
          font-weight: 900;
          color: rgba(255,255,255,0.48);
          text-transform: uppercase;
          letter-spacing: 0.07em;
          border-bottom: 1px solid rgba(255,255,255,0.10);
          white-space: normal;
          line-height: 1.25;
          cursor: pointer;
          user-select: none;
          vertical-align: bottom;
        }

        .psim-table th:first-child,
        .psim-table td:first-child {
          text-align: left;
        }

        .psim-table td {
          text-align: right;
          padding: 11px 14px;
          font-size: 12px;
          font-weight: 850;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          white-space: nowrap;
        }

        .psim-table tbody tr {
          transition: background .2s ease, filter .2s ease;
        }

        .psim-table tbody tr:hover {
          background: rgba(255,255,255,0.065);
          filter: brightness(1.08);
        }

        .psim-month {
          color: rgba(255,255,255,0.92);
          font-weight: 950;
        }

        .psim-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 72px;
          padding: 5px 9px;
          border-radius: 999px;
          font-weight: 950;
          border: 1px solid rgba(255,255,255,0.11);
          box-shadow: inset 0 0 14px rgba(255,255,255,0.025);
        }

        .psim-good {
          color: #74d17c;
          background: rgba(116,209,124,0.13);
          text-shadow: 0 0 12px rgba(116,209,124,0.18);
        }

        .psim-warning {
          color: #f6c85f;
          background: rgba(246,200,95,0.13);
          text-shadow: 0 0 12px rgba(246,200,95,0.18);
        }

        .psim-risk {
          color: #ef3d2f;
          background: rgba(239,61,47,0.13);
          text-shadow: 0 0 12px rgba(239,61,47,0.18);
        }

        .psim-demand {
          color: #7bc8e6;
          background: rgba(54,169,214,0.12);
          text-shadow: 0 0 12px rgba(123,200,230,0.18);
        }

        .psim-best {
          background:
            linear-gradient(90deg, rgba(116,209,124,0.12), rgba(54,169,214,0.07), transparent);
          animation: psimPulse 3.4s ease-in-out infinite;
        }

        .psim-weak {
          box-shadow: inset 3px 0 0 rgba(239,61,47,0.75);
        }

        .psim-strong {
          box-shadow: inset 3px 0 0 rgba(116,209,124,0.75);
        }

        @keyframes psimPulse {
          0%,100% { box-shadow: inset 3px 0 0 rgba(116,209,124,0.35); }
          50% { box-shadow: inset 3px 0 0 rgba(116,209,124,0.85); }
        }
