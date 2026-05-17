looker.plugins.visualizations.add({
  id: "monthly_forecast_outlook",
  label: "Monthly Revenue Forecast Intelligence",

  options: {
    title: {
      type: "string",
      label: "Title",
      default: "Monthly Revenue Forecast Intelligence"
    },
    subtitle: {
      type: "string",
      label: "Subtitle",
      default: "Forward-looking revenue, ADR and occupancy projection versus historical pace"
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

        .mfo-wrap{
          width:100%;
          height:100%;
          min-height:0;
          background:
            radial-gradient(circle at top right, rgba(54,169,214,0.18), transparent 34%),
            radial-gradient(circle at bottom left, rgba(185,148,255,0.14), transparent 38%),
            #030303;
          color:white;
          font-family:Inter,Arial,sans-serif;
          padding:clamp(10px,1.8vw,28px);
          box-sizing:border-box;
          overflow:hidden;
          position:relative;
        }

        .mfo-wrap::before{
          content:"";
          position:absolute;
          inset:clamp(8px,1.2vw,18px);
          border-radius:22px;
          background:rgba(255,255,255,0.025);
          border:1px solid rgba(255,255,255,0.08);
          box-shadow:
            0 0 34px rgba(54,169,214,0.08),
            inset 0 0 24px rgba(255,255,255,0.018);
          pointer-events:none;
        }

        .mfo-header{
          position:relative;
          z-index:2;
        }

        .mfo-title{
          font-size:clamp(16px,2.5vw,30px);
          font-weight:950;
          margin-bottom:6px;
          letter-spacing:-0.03em;
        }

        .mfo-subtitle{
          font-size:clamp(10px,1vw,12px);
          color:rgba(255,255,255,0.55);
          margin-bottom:12px;
        }

        .mfo-table-wrap{
          position:relative;
          z-index:2;
          width:100%;
          height:calc(100% - 58px);
          min-height:180px;
          overflow:hidden;
          border-radius:18px;
          border:1px solid rgba(255,255,255,0.09);
          background:rgba(255,255,255,0.028);
          box-shadow:inset 0 0 24px rgba(255,255,255,0.018);
        }

        .mfo-scroll{
          width:100%;
          height:100%;
          overflow:auto;
        }

        .mfo-scroll::-webkit-scrollbar{
          width:6px;
          height:6px;
        }

        .mfo-scroll::-webkit-scrollbar-thumb{
          background:rgba(54,169,214,0.35);
          border-radius:999px;
        }

        .mfo-table{
          width:100%;
          min-width:1280px;
          border-collapse:collapse;
          table-layout:auto;
        }

        .mfo-table thead{
          position:sticky;
          top:0;
          z-index:3;
          background:rgba(3,3,3,0.96);
          backdrop-filter:blur(14px);
        }

        .mfo-table th{
          text-align:right;
          padding:10px 12px;
          font-size:10px;
          font-weight:900;
          color:rgba(255,255,255,0.48);
          text-transform:uppercase;
          letter-spacing:0.07em;
          border-bottom:1px solid rgba(255,255,255,0.10);
          white-space:normal;
          overflow:visible;
          text-overflow:unset;
          line-height:1.25;
          cursor:pointer;
          user-select:none;
          vertical-align:bottom;
          min-width:100px;
        }

        .mfo-table th:first-child,
        .mfo-table td:first-child{
          text-align:left;
          min-width:90px;
        }

        .mfo-table td{
          text-align:right;
          padding:10px 12px;
          font-size:12px;
          font-weight:800;
          border-bottom:1px solid rgba(255,255,255,0.06);
          white-space:nowrap;
        }

        .mfo-table tbody tr{
          transition:background .2s ease, filter .2s ease;
        }

        .mfo-table tbody tr:hover{
          background:rgba(255,255,255,0.065);
          filter:brightness(1.08);
        }

        .mfo-month{
          color:rgba(255,255,255,0.92);
          font-weight:950;
        }

        .mfo-current{
          color:#7bc8e6;
          text-shadow:0 0 12px rgba(123,200,230,0.16);
        }

        .mfo-stly{
          color:rgba(123,200,230,0.56);
        }

        .mfo-neutral{
          color:rgba(255,255,255,0.82);
        }

        .mfo-forecast{
          color:#e95fb8;
          text-shadow:0 0 15px rgba(233,95,184,0.28);
          font-weight:950;
        }

        .mfo-positive{
          color:#74d17c;
          text-shadow:0 0 12px rgba(116,209,124,0.16);
        }

        .mfo-negative{
          color:#ef3d2f;
          text-shadow:0 0 12px rgba(239,61,47,0.16);
        }

        .mfo-occ-pill{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          min-width:58px;
          padding:4px 8px;
          border-radius:999px;
          font-weight:950;
          border:1px solid rgba(255,255,255,0.10);
        }

        .mfo-occ-low{
          color:#ef3d2f;
          background:rgba(239,61,47,0.12);
        }

        .mfo-occ-mid{
          color:#f6c85f;
          background:rgba(246,200,95,0.12);
        }

        .mfo-occ-high{
          color:#74d17c;
          background:rgba(116,209,124,0.12);
        }

        .mfo-best{
          background:
            linear-gradient(
              90deg,
              rgba(233,95,184,0.12),
              rgba(54,169,214,0.07),
              transparent
            );
          animation:mfoPulse 3.4s ease-in-out infinite;
        }

        .mfo-compression{
          box-shadow:inset 3px 0 0 rgba(116,209,124,0.75);
        }

        .mfo-weak{
          box-shadow:inset 3px 0 0 rgba(239,61,47,0.75);
        }

        @keyframes mfoPulse{
          0%,100%{
            box-shadow:inset 3px 0 0 rgba(233,95,184,0.35);
          }
          50%{
            box-shadow:inset 3px 0 0 rgba(233,95,184,0.85);
          }
        }

        .mfo-empty{
          color:white;
          padding:18px;
          font-size:12px;
          line-height:1.55;
        }

      </style>

      <div class="mfo-wrap">
        <div class="mfo-header">
          <div class="mfo-title"></div>
          <div class="mfo-subtitle"></div>
        </div>

        <div class="mfo-table-wrap"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done){

    const titleEl = element.querySelector(".mfo-title");
    const subtitleEl = element.querySelector(".mfo-subtitle");
    const tableWrapEl = element.querySelector(".mfo-table-wrap");

    titleEl.innerText = config.title || "Monthly Revenue Forecast Intelligence";
    subtitleEl.innerText = config.subtitle || "Forward-looking revenue, ADR and occupancy projection versus historical pace";

    const dimensions = queryResponse.fields.dimension_like || [];
    const measures = queryResponse.fields.measure_like || [];

    function normalizeText(value){
      return String(value || "")
        .toLowerCase()
        .replace(/[_\-]+/g," ")
        .replace(/\s+/g," ")
        .trim();
    }

    function findField(fields, keywords){
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

    const currentOtbRevenueField = findField(measures,[
      "otb room revenue selected year",
      "current otb revenue",
      "otb revenue selected year",
      "room revenue selected year"
    ])?.name;

    const stlyOtbRevenueField = findField(measures,[
      "otb room revenue stly",
      "stly otb revenue",
      "otb revenue stly"
    ])?.name;

    const forecastRevenueField = findField(measures,[
      "forecast projection",
      "forecast revenue"
    ])?.name;

    const forecastPctField = findField(measures,[
      "forecast vs ly",
      "forecast variance",
      "vs ly %"
    ])?.name;

    const availableRnField = findField(measures,[
      "available room nights otb selected year",
      "available room nights"
    ])?.name;

    const currentOtbRnField = findField(measures,[
      "otb room nights selected year",
      "current otb room nights"
    ])?.name;

    const stlyOtbRnField = findField(measures,[
      "otb room nights stly",
      "stly otb room nights"
    ])?.name;

    const currentOtbAdrField = findField(measures,[
      "otb adr selected year",
      "current otb adr"
    ])?.name;

    const expectedAdditionalAdrField = findField(measures,[
      "expected additional adr"
    ])?.name;

    const forecastOccField = findField(measures,[
      "forecast occupancy",
      "forecast occ"
    ])?.name;

    if(
      !data ||
      data.length === 0 ||
      dimensions.length < 1 ||
      !currentOtbRevenueField ||
      !stlyOtbRevenueField ||
      !forecastRevenueField ||
      !forecastPctField ||
      !availableRnField ||
      !currentOtbRnField ||
      !stlyOtbRnField ||
      !currentOtbAdrField ||
      !expectedAdditionalAdrField ||
      !forecastOccField
    ){
      tableWrapEl.innerHTML = `
        <div class="mfo-empty">
          Missing required fields.
        </div>
      `;
      done();
      return;
    }

    const monthField = dimensions[0].name;
    const prefix = config.value_prefix || "€";

    function clean(v){
      return String(v || "")
        .replace(/(<([^>]+)>)/gi,"")
        .trim();
    }

    function monthRank(v){

      const m = clean(v).toLowerCase();

      const map = {
        jan:1,january:1,
        feb:2,february:2,
        mar:3,march:3,
        apr:4,april:4,
        may:5,
        jun:6,june:6,
        jul:7,july:7,
        aug:8,august:8,
        sep:9,september:9,
        oct:10,october:10,
        nov:11,november:11,
        dec:12,december:12
      };

      if(map[m]) return map[m];

      const match = m.match(/(\d{4})[-/](\d{1,2})/);

      if(match){
        return Number(match[2]);
      }

      return 99;
    }

    function formatCurrency(v, rendered){

      if(rendered){
        return clean(rendered);
      }

      const abs = Math.abs(Number(v || 0));
      const sign = v < 0 ? "-" : "";

      if(abs >= 1000000){
        return sign + prefix + (abs/1000000).toFixed(1) + "M";
      }

      if(abs >= 1000){
        return sign + prefix + (abs/1000).toFixed(0) + "K";
      }

      return sign + prefix + abs.toLocaleString();
    }

    function formatEuro(v, rendered){

      if(rendered){
        return clean(rendered);
      }

      return prefix + Number(v || 0).toLocaleString(undefined,{
        maximumFractionDigits:0
      });
    }

    function formatNumber(v, rendered){

      if(rendered){
        return clean(rendered);
      }

      return Number(v || 0).toLocaleString(undefined,{
        maximumFractionDigits:0
      });
    }

    function pctNumber(v){

      let num = Number(v || 0);

      if(Math.abs(num) <= 1.2){
        num *= 100;
      }

      return num;
    }

    function formatPct(v, rendered, arrow){

      const num = pctNumber(v);

      if(rendered && !arrow){
        return clean(rendered);
      }

      const icon = arrow
        ? num > 0 ? "▲ " : num < 0 ? "▼ " : "• "
        : "";

      if(rendered && arrow){
        return icon + clean(rendered).replace(/^[-+▲▼• ]+/,"");
      }

      return icon + Math.abs(num).toFixed(1) + "%";
    }

    function occClass(v){

      const occ = pctNumber(v);

      if(occ >= 85) return "mfo-occ-high";
      if(occ >= 65) return "mfo-occ-mid";

      return "mfo-occ-low";
    }

    function varianceClass(v){
      return pctNumber(v) >= 0
        ? "mfo-positive"
        : "mfo-negative";
    }

    const rows = data.map(row => {

      const month =
        clean(row[monthField]?.rendered) ||
        clean(row[monthField]?.value) ||
        "Unknown";

      return {

        month,
        rank: monthRank(month),

        currentOtbRevenue:Number(row[currentOtbRevenueField]?.value || 0),
        stlyOtbRevenue:Number(row[stlyOtbRevenueField]?.value || 0),
        forecastRevenue:Number(row[forecastRevenueField]?.value || 0),
        forecastPct:Number(row[forecastPctField]?.value || 0),

        availableRn:Number(row[availableRnField]?.value || 0),
        currentOtbRn:Number(row[currentOtbRnField]?.value || 0),
        stlyOtbRn:Number(row[stlyOtbRnField]?.value || 0),

        currentOtbAdr:Number(row[currentOtbAdrField]?.value || 0),
        expectedAdditionalAdr:Number(row[expectedAdditionalAdrField]?.value || 0),

        forecastOcc:Number(row[forecastOccField]?.value || 0),

        currentOtbRevenueRendered:row[currentOtbRevenueField]?.rendered,
        stlyOtbRevenueRendered:row[stlyOtbRevenueField]?.rendered,
        forecastRevenueRendered:row[forecastRevenueField]?.rendered,
        forecastPctRendered:row[forecastPctField]?.rendered,

        availableRnRendered:row[availableRnField]?.rendered,
        currentOtbRnRendered:row[currentOtbRnField]?.rendered,
        stlyOtbRnRendered:row[stlyOtbRnField]?.rendered,

        currentOtbAdrRendered:row[currentOtbAdrField]?.rendered,
        expectedAdditionalAdrRendered:row[expectedAdditionalAdrField]?.rendered,
        forecastOccRendered:row[forecastOccField]?.rendered
      };

    }).sort((a,b) => a.rank - b.rank);

    let sortKey = "rank";
    let sortDirection = 1;

    function renderTable(){

      const sortedRows = [...rows].sort((a,b) => {

        if(sortKey === "rank"){
          return (a.rank - b.rank) * sortDirection;
        }

        return (
          Number(a[sortKey] || 0) -
          Number(b[sortKey] || 0)
        ) * sortDirection;
      });

      const maxForecast = Math.max(
        ...rows.map(r => r.forecastRevenue),
        0
      );

      const totals = queryResponse.totals_data ? {

        currentOtbRevenue:Number(queryResponse.totals_data[currentOtbRevenueField]?.value || 0),
        stlyOtbRevenue:Number(queryResponse.totals_data[stlyOtbRevenueField]?.value || 0),
        forecastRevenue:Number(queryResponse.totals_data[forecastRevenueField]?.value || 0),
        forecastPct:Number(queryResponse.totals_data[forecastPctField]?.value || 0),

        availableRn:Number(queryResponse.totals_data[availableRnField]?.value || 0),
        currentOtbRn:Number(queryResponse.totals_data[currentOtbRnField]?.value || 0),
        stlyOtbRn:Number(queryResponse.totals_data[stlyOtbRnField]?.value || 0),

        currentOtbAdr:Number(queryResponse.totals_data[currentOtbAdrField]?.value || 0),
        expectedAdditionalAdr:Number(queryResponse.totals_data[expectedAdditionalAdrField]?.value || 0),

        forecastOcc:Number(queryResponse.totals_data[forecastOccField]?.value || 0),

        currentOtbRevenueRendered:queryResponse.totals_data[currentOtbRevenueField]?.rendered,
        stlyOtbRevenueRendered:queryResponse.totals_data[stlyOtbRevenueField]?.rendered,
        forecastRevenueRendered:queryResponse.totals_data[forecastRevenueField]?.rendered,
        forecastPctRendered:queryResponse.totals_data[forecastPctField]?.rendered,

        availableRnRendered:queryResponse.totals_data[availableRnField]?.rendered,
        currentOtbRnRendered:queryResponse.totals_data[currentOtbRnField]?.rendered,
        stlyOtbRnRendered:queryResponse.totals_data[stlyOtbRnField]?.rendered,

        currentOtbAdrRendered:queryResponse.totals_data[currentOtbAdrField]?.rendered,
        expectedAdditionalAdrRendered:queryResponse.totals_data[expectedAdditionalAdrField]?.rendered,
        forecastOccRendered:queryResponse.totals_data[forecastOccField]?.rendered

      } : null;

      tableWrapEl.innerHTML = `
        <div class="mfo-scroll">

          <table class="mfo-table">

            <thead>
              <tr>
                <th data-sort="rank">Month</th>
                <th data-sort="currentOtbRevenue">Current OTB Revenue</th>
                <th data-sort="stlyOtbRevenue">STLY OTB Revenue</th>
                <th data-sort="forecastRevenue">Forecast Revenue</th>
                <th data-sort="forecastPct">Forecast vs LY %</th>
                <th data-sort="availableRn">Available Room Nights</th>
                <th data-sort="currentOtbRn">Current OTB Room Nights</th>
                <th data-sort="stlyOtbRn">STLY OTB Room Nights</th>
                <th data-sort="currentOtbAdr">Current OTB ADR</th>
                <th data-sort="expectedAdditionalAdr">Expected Additional ADR</th>
                <th data-sort="forecastOcc">Forecast Occupancy</th>
              </tr>
            </thead>

            <tbody>

              ${sortedRows.map(row => {

                const isBest =
                  row.forecastRevenue === maxForecast &&
                  maxForecast > 0;

                const isCompression =
                  pctNumber(row.forecastOcc) >= 85;

                const isWeak =
                  pctNumber(row.forecastOcc) < 55;

                const rowClass = [
                  isBest ? "mfo-best" : "",
                  isCompression ? "mfo-compression" : "",
                  isWeak ? "mfo-weak" : ""
                ].join(" ");

                return `
                  <tr class="${rowClass}">

                    <td class="mfo-month">
                      ${row.month}
                    </td>

                    <td class="mfo-current">
                      ${formatCurrency(row.currentOtbRevenue,row.currentOtbRevenueRendered)}
                    </td>

                    <td class="mfo-stly">
                      ${formatCurrency(row.stlyOtbRevenue,row.stlyOtbRevenueRendered)}
                    </td>

                    <td class="mfo-forecast">
                      ${formatCurrency(row.forecastRevenue,row.forecastRevenueRendered)}
                    </td>

                    <td class="${varianceClass(row.forecastPct)}">
                      ${formatPct(row.forecastPct,row.forecastPctRendered,true)}
                    </td>

                    <td class="mfo-neutral">
                      ${formatNumber(row.availableRn,row.availableRnRendered)}
                    </td>

                    <td class="mfo-current">
                      ${formatNumber(row.currentOtbRn,row.currentOtbRnRendered)}
                    </td>

                    <td class="mfo-stly">
                      ${formatNumber(row.stlyOtbRn,row.stlyOtbRnRendered)}
                    </td>

                    <td class="mfo-current">
                      ${formatEuro(row.currentOtbAdr,row.currentOtbAdrRendered)}
                    </td>

                    <td class="mfo-positive">
                      ${formatEuro(row.expectedAdditionalAdr,row.expectedAdditionalAdrRendered)}
                    </td>

                    <td>
                      <span class="mfo-occ-pill ${occClass(row.forecastOcc)}">
                        ${formatPct(row.forecastOcc,row.forecastOccRendered,false)}
                      </span>
                    </td>

                  </tr>
                `;

              }).join("")}

              ${totals ? `

                <tr class="mfo-best">

                  <td class="mfo-month">TOTAL</td>

                  <td class="mfo-current">
                    ${formatCurrency(totals.currentOtbRevenue,totals.currentOtbRevenueRendered)}
                  </td>

                  <td class="mfo-stly">
                    ${formatCurrency(totals.stlyOtbRevenue,totals.stlyOtbRevenueRendered)}
                  </td>

                  <td class="mfo-forecast">
                    ${formatCurrency(totals.forecastRevenue,totals.forecastRevenueRendered)}
                  </td>

                  <td class="${varianceClass(totals.forecastPct)}">
                    ${formatPct(totals.forecastPct,totals.forecastPctRendered,true)}
                  </td>

                  <td class="mfo-neutral">
                    ${formatNumber(totals.availableRn,totals.availableRnRendered)}
                  </td>

                  <td class="mfo-current">
                    ${formatNumber(totals.currentOtbRn,totals.currentOtbRnRendered)}
                  </td>

                  <td class="mfo-stly">
                    ${formatNumber(totals.stlyOtbRn,totals.stlyOtbRnRendered)}
                  </td>

                  <td class="mfo-current">
                    ${formatEuro(totals.currentOtbAdr,totals.currentOtbAdrRendered)}
                  </td>

                  <td class="mfo-positive">
                    ${formatEuro(totals.expectedAdditionalAdr,totals.expectedAdditionalAdrRendered)}
                  </td>

                  <td>
                    <span class="mfo-occ-pill ${occClass(totals.forecastOcc)}">
                      ${formatPct(totals.forecastOcc,totals.forecastOccRendered,false)}
                    </span>
                  </td>

                </tr>

              ` : ""}

            </tbody>

          </table>

        </div>
      `;

      tableWrapEl.querySelectorAll("th[data-sort]").forEach(th => {

        th.addEventListener("click",() => {

          const key = th.getAttribute("data-sort");

          if(sortKey === key){
            sortDirection *= -1;
          }else{
            sortKey = key;
            sortDirection = key === "rank" ? 1 : -1;
          }

          renderTable();
        });

      });

    }

    renderTable();
    done();
  }
});
