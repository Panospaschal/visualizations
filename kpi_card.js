function loadScript(url, callback) {
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.src = url;
    script.onload = callback;
    document.head.appendChild(script);
}

looker.plugins.visualizations.add({
    id: "panos_kpi_card_advanced",
    label: "ADR Advanced KPI Card",
    
    create: function(element, config) {
        element.innerHTML = `
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                #kpi-container {
                    font-family: 'Inter', sans-serif;
                    background: #ffffff;
                    border-radius: 16px;
                    padding: 24px 24px 12px 24px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                    border: 1px solid #e0e0e0;
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    box-sizing: border-box;
                    width: 100%;
                }
                .kpi-header { display: flex; justify-content: space-between; align-items: center; color: #5f6368; font-size: 15px; font-weight: 600; margin-bottom: 8px; }
                .kpi-icon { color: #1a73e8; font-size: 20px; }
                .kpi-main-value { font-size: 38px; font-weight: 700; color: #202124; margin-bottom: 8px; }
                
                .comparisons-wrapper { display: flex; flex-direction: column; gap: 4px; margin-bottom: 15px; }
                .kpi-sub-value { font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 6px; color: #5f6368;}
                .badge { padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 12px; }
                
                .positive-badge { background-color: #e6f4ea; color: #137333; }
                .negative-badge { background-color: #fce8e6; color: #c5221f; }
                .neutral-badge { background-color: #f1f3f4; color: #5f6368; }

                .chart-container { flex-grow: 1; position: relative; width: 100%; min-height: 80px; }
                .error-msg { color: #ea4335; font-size: 14px; text-align: center; padding: 20px; background: #fce8e6; border-radius: 8px;}
            </style>
            <div id="kpi-container">
                <div class="kpi-header">
                    <span id="kpi-title">YTD ADR</span>
                    <span class="kpi-icon">💶</span>
                </div>
                <div class="kpi-main-value" id="kpi-value">€0.00</div>
                
                <div class="comparisons-wrapper">
                    <div class="kpi-sub-value" id="yoy-comparison">
                        <span class="badge" id="yoy-badge">0%</span> vs Last Year YTD
                    </div>
                    <div class="kpi-sub-value" id="mom-comparison">
                        <span class="badge" id="mom-badge">0%</span> vs Last Month
                    </div>
                </div>

                <div class="chart-container">
                    <canvas id="kpi-chart"></canvas>
                </div>
            </div>
        `;
        this._chartInstance = null;
    },

    updateAsync: function(data, element, config, queryResponse, details, done) {
        var dimensions = queryResponse.fields.dimension_like;
        var measures = queryResponse.fields.measure_like;

        // Έλεγχος λαθών
        if (dimensions.length === 0 || measures.length < 2) {
            element.querySelector("#kpi-container").innerHTML = `<div class="error-msg"><b>Σφάλμα:</b> Βάλε 1 Dimension (Μήνα) και 2 Measures (Φετινό ADR, Περσινό ADR).</div>`;
            done(); return;
        }
        if (!queryResponse.totals_data) {
             element.querySelector("#kpi-container").innerHTML = `<div class="error-msg"><b>Σφάλμα:</b> Πρέπει να τσεκάρεις το κουτάκι <b>Totals</b> στον πίνακα δεδομένων στο Looker!</div>`;
             done(); return;
        }

        // Ονόματα Στηλών
        var dimMonth = dimensions[0].name;
        var measureCurrent = measures[0].name; // Φετινό
        var measurePast = measures[1].name;    // Περσινό

        // --- ΥΠΟΛΟΓΙΣΜΟΣ ΣΥΝΟΛΟΥ ΧΡΟΝΙΑΣ (YTD) ---
        // Διαβάζουμε το συνολικό νούμερο από τη γραμμή Totals του Looker
        var currentYearTotal = queryResponse.totals_data[measureCurrent].value;
        var pastYearTotal = queryResponse.totals_data[measurePast].value;
        
        // Μορφοποίηση κεντρικού αριθμού (Συνολικό Φετινό ADR)
        element.querySelector("#kpi-value").innerHTML = queryResponse.totals_data[measureCurrent].rendered || ("€" + currentYearTotal.toFixed(2));

        // --- ΥΠΟΛΟΓΙΣΜΟΣ YTD vs LAST YEAR ---
        var yoyBadge = element.querySelector("#yoy-badge");
        if (pastYearTotal) {
            var yoyDiff = currentYearTotal - pastYearTotal;
            var yoyPct = ((yoyDiff / pastYearTotal) * 100).toFixed(1);
            yoyBadge.innerHTML = (yoyDiff > 0 ? "+" : "") + yoyPct + "%";
            yoyBadge.className = "badge " + (yoyDiff >= 0 ? "positive-badge" : "negative-badge");
        } else {
            yoyBadge.innerHTML = "N/A"; yoyBadge.className = "badge neutral-badge";
        }

        // --- ΥΠΟΛΟΓΙΣΜΟΣ ΜΗΝΑ vs ΠΡΟΗΓΟΥΜΕΝΟΥ ΜΗΝΑ ---
        var currentValues = [];
        var labels = [];
        
        data.forEach(function(row) {
            var rawDim = row[dimMonth].rendered || row[dimMonth].value;
            labels.push(String(rawDim).replace(/(<([^>]+)>)/gi, "").substring(0, 3)); 
            currentValues.push(Number(row[measureCurrent].value));
        });

        var currentMonthValue = currentValues[currentValues.length - 1];
        var previousMonthValue = currentValues.length > 1 ? currentValues[currentValues.length - 2] : 0;
        var momBadge = element.querySelector("#mom-badge");

        if (previousMonthValue !== 0) {
            var momDiff = currentMonthValue - previousMonthValue;
            var momPct = ((momDiff / previousMonthValue) * 100).toFixed(1);
            momBadge.innerHTML = (momDiff > 0 ? "+" : "") + momPct + "%";
            momBadge.className = "badge " + (momDiff >= 0 ? "positive-badge" : "negative-badge");
        } else {
            momBadge.innerHTML = "N/A"; momBadge.className = "badge neutral-badge";
        }

        // --- ΣΧΕΔΙΑΣΜΟΣ ΓΡΑΦΗΜΑΤΟΣ (Φετινή Καμπύλη) ---
        var drawChart = () => {
            var ctx = element.querySelector("#kpi-chart").getContext("2d");
            if (this._chartInstance) { this._chartInstance.destroy(); }

            this._chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        data: currentValues,
                        borderColor: '#1a73e8',
                        backgroundColor: 'rgba(26, 115, 232, 0.15)',
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { enabled: true } },
                    scales: {
                        x: { display: true, grid: { display: false }, ticks: { font: {family: 'Inter', size: 11}, color: '#80868b' } },
                        y: { display: false, min: Math.min(...currentValues) * 0.90 } 
                    },
                    layout: { padding: { top: 10 } }
                }
            });
            done();
        };

        if (typeof Chart === 'undefined') {
            loadScript('https://cdn.jsdelivr.net/npm/chart.js', drawChart);
        } else {
            drawChart();
        }
    }
});
