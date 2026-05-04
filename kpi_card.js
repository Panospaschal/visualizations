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
    
    // ΑΥΤΗ ΕΙΝΑΙ Η ΜΑΓΙΚΗ ΕΝΤΟΛΗ ΠΟΥ ΕΛΕΙΠΕ!
    // Λέει στο Looker να μας στείλει τα Totals στον κώδικα
    has_totals: true, 
    
    create: function(element, config) {
        element.innerHTML = `
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                #kpi-container {
                    font-family: 'Inter', sans-serif;
                    background: #ffffff;
                    border-radius: 12px;
                    padding: 20px 20px 10px 20px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                    border: 1px solid #e8eaed;
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    box-sizing: border-box;
                    width: 100%;
                }
                .kpi-header { display: flex; justify-content: space-between; align-items: center; color: #5f6368; font-size: 14px; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;}
                .kpi-icon { color: #1a73e8; font-size: 18px; }
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
                <div class="kpi-header">
                    <span id="kpi-title">YTD ADR</span>
                    <span class="kpi-icon">💶</span>
                </div>
                <div class="kpi-main-value" id="kpi-value">...</div>
                
                <div class="comparisons-wrapper">
                    <div class="kpi-sub-value" id="yoy-comparison">
                        <span class="badge" id="yoy-badge">...</span> vs Last Year YTD
                    </div>
                    <div class="kpi-sub-value" id="mom-comparison">
                        <span class="badge" id="mom-badge">...</span> vs Last Month
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

        if (dimensions.length === 0 || measures.length < 2) {
            element.querySelector("#kpi-container").innerHTML = `<div class="error-msg"><b>Λάθος Δεδομένα:</b> Χρειάζομαι 1 Dimension (Μήνα) και 2 Measures (Φετινό, Περσινό).</div>`;
            done(); return;
        }

        var dimMonth = dimensions[0].name;
        var measureCurrent = measures[0].name; 
        var measurePast = measures[1].name;    

        // --- ΔΙΑΒΑΣΜΑ ΤΩΝ TOTALS ---
        // Τώρα που βάλαμε το has_totals: true, το Looker θα μας τα στείλει!
        var currentYearTotal = 0;
        var pastYearTotal = 0;
        var formattedTotal = "€0.00";

        if (queryResponse.totals_data) {
            currentYearTotal = Number(queryResponse.totals_data[measureCurrent].value) || 0;
            pastYearTotal = Number(queryResponse.totals_data[measurePast].value) || 0;
            formattedTotal = queryResponse.totals_data[measureCurrent].rendered || ("€" + currentYearTotal.toFixed(2));
        } else {
            // Αν για κάποιο λόγο δεν έρθουν τα totals (π.χ. ο χρήστης ξε-τσέκαρε το κουτάκι), τα υπολογίζουμε εμείς με το χέρι!
            data.forEach(function(row) {
                currentYearTotal += Number(row[measureCurrent].value) || 0;
                pastYearTotal += Number(row[measurePast].value) || 0;
            });
            formattedTotal = "€" + currentYearTotal.toFixed(2);
        }
        
        // Εμφάνιση Κεντρικού YTD
        element.querySelector("#kpi-value").innerHTML = formattedTotal;

        // YTD vs Last Year
        var yoyBadge = element.querySelector("#yoy-badge");
        if (pastYearTotal > 0) {
            var yoyDiff = currentYearTotal - pastYearTotal;
            var yoyPct = ((yoyDiff / pastYearTotal) * 100).toFixed(1);
            yoyBadge.innerHTML = (yoyDiff > 0 ? "+" : "") + yoyPct + "%";
            yoyBadge.className = "badge " + (yoyDiff >= 0 ? "positive-badge" : "negative-badge");
        } else {
            yoyBadge.innerHTML = "-"; yoyBadge.className = "badge neutral-badge";
        }

        // Διαβάζουμε τα δεδομένα ανά μήνα για το Γράφημα και το MoM
        var currentValues = [];
        var labels = [];
        
        data.forEach(function(row) {
            var val = row[measureCurrent].value;
            // Παίρνουμε τους μήνες που έχουν δεδομένα (όχι null)
            if(val !== null && val !== undefined) { 
                var rawDim = row[dimMonth].rendered || row[dimMonth].value;
                labels.push(String(rawDim).replace(/(<([^>]+)>)/gi, "").substring(0, 3)); 
                currentValues.push(Number(val));
            }
        });

        // MoM (Τελευταίος μήνας vs Προηγούμενος)
        var currentMonthValue = currentValues.length > 0 ? currentValues[currentValues.length - 1] : 0;
        var previousMonthValue = currentValues.length > 1 ? currentValues[currentValues.length - 2] : 0;
        var momBadge = element.querySelector("#mom-badge");

        if (previousMonthValue > 0) {
            var momDiff = currentMonthValue - previousMonthValue;
            var momPct = ((momDiff / previousMonthValue) * 100).toFixed(1);
            momBadge.innerHTML = (momDiff > 0 ? "+" : "") + momPct + "%";
            momBadge.className = "badge " + (momDiff >= 0 ? "positive-badge" : "negative-badge");
        } else {
            momBadge.innerHTML = "-"; momBadge.className = "badge neutral-badge";
        }

        // Σχεδιασμός Γραφήματος
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
                        backgroundColor: 'rgba(26, 115, 232, 0.1)', 
                        borderWidth: 2.5,
                        pointBackgroundColor: '#1a73e8',
                        pointRadius: 0,
                        pointHoverRadius: 5,
                        fill: true,
                        tension: 0.3 
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { enabled: true, displayColors: false, callbacks: { label: function(context) { return '€' + context.parsed.y.toFixed(2); } } } },
                    scales: {
                        x: { display: true, grid: { display: false }, ticks: { font: {family: 'Inter', size: 10}, color: '#9aa0a6' } },
                        y: { display: false, min: Math.min(...currentValues) * 0.95 } 
                    },
                    layout: { padding: { top: 5, bottom: 0, left: 0, right: 0 } }
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
