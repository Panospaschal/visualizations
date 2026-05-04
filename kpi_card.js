function loadScript(url, callback) {
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.src = url;
    script.onload = callback;
    document.head.appendChild(script);
}

looker.plugins.visualizations.add({
    id: "panos_kpi_card_universal",
    label: "Universal KPI Card",
    has_totals: true, 
    
    options: {
        kpi_title: { type: "string", label: "Τίτλος Κάρτας", default: "ΜΕΤΡΗΣΗ" },
        kpi_icon: { type: "string", label: "Εικονίδιο (Emoji)", default: "📊" },
        value_format: {
            type: "string", label: "Μορφοποίηση Αριθμού", display: "select",
            values: [ {"Αυτόματο": "auto"}, {"Ευρώ (€)": "euro"}, {"Ποσοστό (%)": "percent"}, {"Απλός Αριθμός": "number"} ],
            default: "auto"
        }
    },

    create: function(element, config) {
        element.innerHTML = `
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                #kpi-container { font-family: 'Inter', sans-serif; background: #ffffff; border-radius: 12px; padding: 20px 20px 10px 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #e8eaed; display: flex; flex-direction: column; height: 100%; box-sizing: border-box; width: 100%; }
                .kpi-header { display: flex; justify-content: space-between; align-items: center; color: #5f6368; font-size: 14px; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;}
                .kpi-icon { font-size: 18px; }
                .kpi-main-value { font-size: 36px; font-weight: 700; color: #202124; margin-bottom: 12px; letter-spacing: -0.5px;}
                .comparisons-wrapper { display: flex; flex-direction: column; gap: 6px; margin-bottom: 15px; }
                .kpi-sub-value { font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 8px; color: #5f6368;}
                .badge { padding: 3px 6px; border-radius: 4px; font-weight: 700; font-size: 12px; min-width: 45px; text-align: center;}
                .positive-badge { background-color: #e6f4ea; color: #137333; }
                .negative-badge { background-color: #fce8e6; color: #c5221f; }
                .neutral-badge { background-color: #f1f3f4; color: #5f6368; }
                .chart-container { flex-grow: 1; position: relative; width: 100%; min-height: 70px; margin-top: auto;}
                .error-msg { color: #d93025; font-size: 13px; text-align: center; padding: 15px; background: #fce8e6; border-radius: 8px; border: 1px solid #fad2cf;}
            </style>
            <div id="kpi-container">
                <div class="kpi-header"><span id="kpi-title">...</span><span class="kpi-icon" id="kpi-icon">📊</span></div>
                <div class="kpi-main-value" id="kpi-value">...</div>
                <div class="comparisons-wrapper">
                    <div class="kpi-sub-value" id="comp-1"><span class="badge" id="badge-1">...</span> <span id="text-1"></span></div>
                    <div class="kpi-sub-value" id="comp-2"><span class="badge" id="badge-2">...</span> <span id="text-2"></span></div>
                </div>
                <div class="chart-container"><canvas id="kpi-chart"></canvas></div>
            </div>
        `;
        this._chartInstance = null;
    },

    updateAsync: function(data, element, config, queryResponse, details, done) {
        var dimensions = queryResponse.fields.dimension_like;
        var measures = queryResponse.fields.measure_like;

        if (dimensions.length === 0 || measures.length === 0) { 
            element.querySelector("#kpi-container").innerHTML = `<div class="error-msg">Λείπουν δεδομένα.</div>`;
            done(); return; 
        }

        var formatChoice = config.value_format || "auto";
        element.querySelector("#kpi-title").innerText = config.kpi_title || "METRIC";
        element.querySelector("#kpi-icon").innerText = config.kpi_icon || "📊";

        function formatVal(val, renderedStr) {
            if (formatChoice === "auto" && renderedStr) return renderedStr;
            if (formatChoice === "euro") return "€" + Number(val).toFixed(2);
            if (formatChoice === "percent") {
                var pctVal = (Number(val) <= 1.2 && Number(val) > -1.2) ? Number(val) * 100 : Number(val);
                return pctVal.toFixed(1) + "%";
            }
            if (formatChoice === "number") return Number(val).toLocaleString();
            return renderedStr || Number(val).toLocaleString();
        }

        var labels = [];
        var chartValues = [];
        var tooltips = [];

        // ==========================================
        // ΛΕΙΤΟΥΡΓΙΑ 1: ΓΡΑΜΜΕΣ (Π.χ. Pickup 3 days)
        // 1 Measure, >1 Γραμμές (Τα δεδομένα συγκρίνονται κάθετα)
        // ==========================================
        if (measures.length === 1 && data.length >= 2) {
            var dimName = dimensions[0].name;
            var measureName = measures[0].name;

            // Παίρνουμε τις τιμές (Γραμμή 0=Current, Γραμμή 1=Prev, Γραμμή 2=LY)
            var valCurrent = data[0] ? Number(data[0][measureName].value) : 0;
            var valPrev = data[1] ? Number(data[1][measureName].value) : 0;
            var valLY = data[2] ? Number(data[2][measureName].value) : 0;

            // Ονόματα από το Dimension (πχ "LY 3 days")
            var nameCurrent = data[0] ? String(data[0][dimName].value).replace(/^[0-9]+\.\s*/, '') : "Current";
            var namePrev = data[1] ? String(data[1][dimName].value).replace(/^[0-9]+\.\s*/, '') : "Previous";
            var nameLY = data[2] ? String(data[2][dimName].value).replace(/^[0-9]+\.\s*/, '') : "Last Year";

            element.querySelector("#kpi-value").innerHTML = formatVal(valCurrent, data[0][measureName].rendered);

            // Σύγκριση 1 (Current vs LY - Γραμμή 0 vs Γραμμή 2)
            var badge1 = element.querySelector("#badge-1");
            if (data.length >= 3 && valLY > 0) {
                var diff1 = valCurrent - valLY;
                var pct1 = ((diff1 / valLY) * 100).toFixed(1);
                badge1.innerHTML = (diff1 > 0 ? "+" : "") + pct1 + "%";
                badge1.className = "badge " + (diff1 >= 0 ? "positive-badge" : "negative-badge");
                element.querySelector("#text-1").innerHTML = `vs ${nameLY} <span style="font-size:10px; color:#bdc1c6;">(${valCurrent} vs ${valLY})</span>`;
            } else {
                badge1.innerHTML = "-"; badge1.className = "badge neutral-badge";
                element.querySelector("#text-1").innerHTML = `vs Last Year`;
            }

            // Σύγκριση 2 (Current vs Prev - Γραμμή 0 vs Γραμμή 1)
            var badge2 = element.querySelector("#badge-2");
            if (data.length >= 2 && valPrev > 0) {
                var diff2 = valCurrent - valPrev;
                var pct2 = ((diff2 / valPrev) * 100).toFixed(1);
                badge2.innerHTML = (diff2 > 0 ? "+" : "") + pct2 + "%";
                badge2.className = "badge " + (diff2 >= 0 ? "positive-badge" : "negative-badge");
                element.querySelector("#text-2").innerHTML = `vs ${namePrev} <span style="font-size:10px; color:#bdc1c6;">(${valCurrent} vs ${valPrev})</span>`;
            } else {
                badge2.innerHTML = "-"; badge2.className = "badge neutral-badge";
                element.querySelector("#text-2").innerHTML = `vs Previous`;
            }

            // Για το γράφημα (από το παλιότερο στο νεότερο)
            for (var i = data.length - 1; i >= 0; i--) {
                labels.push(String(data[i][dimName].value).replace(/^[0-9]+\.\s*/, ''));
                chartValues.push(Number(data[i][measureName].value));
                tooltips.push(formatVal(data[i][measureName].value, data[i][measureName].rendered));
            }
        } 
        // ==========================================
        // ΛΕΙΤΟΥΡΓΙΑ 2: ΣΤΗΛΕΣ (Π.χ. YTD ADR/Occupancy)
        // 2 Measures (Φετινό, Περσινό) (Τα δεδομένα συγκρίνονται οριζόντια)
        // ==========================================
        else if (measures.length >= 2) {
            var dimMonth = dimensions[0].name;
            var measureCurrent = measures[0].name; 
            var measurePast = measures[1].name;    

            var currentYearTotal = 0; var pastYearTotal = 0;
            if (queryResponse.totals_data) {
                currentYearTotal = Number(queryResponse.totals_data[measureCurrent].value) || 0;
                pastYearTotal = Number(queryResponse.totals_data[measurePast].value) || 0;
                element.querySelector("#kpi-value").innerHTML = formatVal(currentYearTotal, queryResponse.totals_data[measureCurrent].rendered);
            } else {
                data.forEach(function(row) { currentYearTotal += Number(row[measureCurrent].value)||0; pastYearTotal += Number(row[measurePast].value)||0; });
                element.querySelector("#kpi-value").innerHTML = formatVal(currentYearTotal, null);
            }

            var badge1 = element.querySelector("#badge-1");
            if (pastYearTotal > 0) {
                var yoyDiff = currentYearTotal - pastYearTotal;
                var yoyPct = ((yoyDiff / pastYearTotal) * 100).toFixed(1);
                badge1.innerHTML = (yoyDiff > 0 ? "+" : "") + yoyPct + "%";
                badge1.className = "badge " + (yoyDiff >= 0 ? "positive-badge" : "negative-badge");
                element.querySelector("#text-1").innerHTML = `vs Last Year YTD`;
            } else {
                badge1.innerHTML = "-"; badge1.className = "badge neutral-badge"; element.querySelector("#text-1").innerHTML = `vs Last Year YTD`;
            }

            data.forEach(function(row) {
                var val = row[measureCurrent].value;
                if(val !== null && val !== undefined) { 
                    var rawDim = row[dimMonth].rendered || row[dimMonth].value;
                    labels.push(String(rawDim).replace(/(<([^>]+)>)/gi, "").substring(0, 3)); 
                    chartValues.push(Number(val));
                    tooltips.push(formatVal(val, row[measureCurrent].rendered));
                }
            });

            var currentRealMonth = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][new Date().getMonth()]; 
            var idx = labels.indexOf(currentRealMonth);
            var currentMonthValue = idx !== -1 ? chartValues[idx] : (chartValues.length > 0 ? chartValues[chartValues.length - 1] : 0);
            var previousMonthValue = idx > 0 ? chartValues[idx - 1] : (chartValues.length > 1 ? chartValues[chartValues.length - 2] : 0);

            var badge2 = element.querySelector("#badge-2");
            if (previousMonthValue > 0) {
                var momDiff = currentMonthValue - previousMonthValue;
                var momPct = ((momDiff / previousMonthValue) * 100).toFixed(1);
                badge2.innerHTML = (momDiff > 0 ? "+" : "") + momPct + "%";
                badge2.className = "badge " + (momDiff >= 0 ? "positive-badge" : "negative-badge");
                element.querySelector("#text-2").innerHTML = `vs Last Month <span style="font-size: 10px; color: #bdc1c6;">(${currentRealMonth} vs ${idx > 0 ? labels[idx-1] : 'N/A'})</span>`;
            } else {
                badge2.innerHTML = "-"; badge2.className = "badge neutral-badge"; element.querySelector("#text-2").innerHTML = `vs Last Month`;
            }
        }

        // Ζωγραφική του Γραφήματος (Κοινό και για τις 2 λειτουργίες)
        var drawChart = () => {
            var ctx = element.querySelector("#kpi-chart").getContext("2d");
            if (this._chartInstance) { this._chartInstance.destroy(); }
            this._chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        data: chartValues, borderColor: '#1a73e8', backgroundColor: 'rgba(26, 115, 232, 0.1)', borderWidth: 2.5, pointBackgroundColor: '#1a73e8', pointRadius: 0, pointHoverRadius: 5, fill: true, tension: 0.3 
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { enabled: true, displayColors: false, callbacks: { label: function(c) { return tooltips[c.dataIndex]; } } } },
                    scales: { x: { display: true, grid: { display: false }, ticks: { font: {family: 'Inter', size: 10}, color: '#9aa0a6' } }, y: { display: false, min: Math.min(...chartValues) * 0.95 } },
                    layout: { padding: { top: 5, bottom: 0, left: 0, right: 0 } }
                }
            });
            done();
        };

        if (typeof Chart === 'undefined') { loadScript('https://cdn.jsdelivr.net/npm/chart.js', drawChart); } else { drawChart(); }
    }
});
