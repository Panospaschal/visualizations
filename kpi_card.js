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
    
    // ΕΔΩ ΦΤΙΑΧΝΟΥΜΕ ΤΟ ΜΕΝΟΥ ΕΠΙΛΟΓΩΝ ΓΙΑ ΤΟ LOOKER!
    options: {
        kpi_title: {
            type: "string",
            label: "Τίτλος Κάρτας",
            default: "YTD METRIC"
        },
        kpi_icon: {
            type: "string",
            label: "Εικονίδιο (Emoji)",
            default: "📊"
        },
        value_format: {
            type: "string",
            label: "Μορφοποίηση Αριθμού",
            display: "select",
            values: [
                {"Αυτόματο (Από LookML)": "auto"},
                {"Ευρώ (€)": "euro"},
                {"Ποσοστό (%)": "percent"},
                {"Απλός Αριθμός": "number"}
            ],
            default: "auto"
        }
    },

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
                .kpi-icon { font-size: 18px; }
                .kpi-main-value { font-size: 36px; font-weight: 700; color: #202124; margin-bottom: 12px; letter-spacing: -0.5px;}
                
                .comparisons-wrapper { display: flex; flex-direction: column; gap: 6px; margin-bottom: 15px; }
                .kpi-sub-value { font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 8px; color: #5f6368;}
                .badge { padding: 3px 6px; border-radius: 4px; font-weight: 700; font-size: 12px; min-width: 45px; text-align: center;}
                
                .positive-badge { background-color: #e6f4ea; color: #137333; }
                .negative-badge { background-color: #fce8e6; color: #c5221f; }
                .neutral-badge { background-color: #f1f3f4; color: #5f6368; }

                .chart-container { flex-grow: 1; position: relative; width: 100%; min-height: 70px; margin-top: auto;}
            </style>
            <div id="kpi-container">
                <div class="kpi-header">
                    <span id="kpi-title">...</span>
                    <span class="kpi-icon" id="kpi-icon">📊</span>
                </div>
                <div class="kpi-main-value" id="kpi-value">...</div>
                
                <div class="comparisons-wrapper">
                    <div class="kpi-sub-value" id="yoy-comparison">
                        <span class="badge" id="yoy-badge">...</span> vs Last Year YTD
                    </div>
                    <div class="kpi-sub-value" id="mom-comparison">
                        <span class="badge" id="mom-badge">...</span> <span id="mom-text">vs Last Month</span>
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

        if (dimensions.length === 0 || measures.length < 2) { done(); return; }

        var dimMonth = dimensions[0].name;
        var measureCurrent = measures[0].name; 
        var measurePast = measures[1].name;    

        // Διάβασμα των επιλογών του χρήστη από το Looker (ή default τιμές)
        var title = config.kpi_title || "YTD METRIC";
        var icon = config.kpi_icon || "📊";
        var formatChoice = config.value_format || "auto";

        element.querySelector("#kpi-title").innerText = title;
        element.querySelector("#kpi-icon").innerText = icon;

        // Συνάρτηση Μορφοποίησης Αριθμών
        function formatVal(val, renderedStr) {
            if (formatChoice === "auto" && renderedStr) return renderedStr;
            if (formatChoice === "euro") return "€" + Number(val).toFixed(2);
            if (formatChoice === "percent") {
                // Αν το Looker στέλνει 0.68 το κάνουμε 68.0%. Αν στέλνει 68, το αφήνουμε 68.0%.
                var pctVal = (Number(val) <= 1.2 && Number(val) > -1.2) ? Number(val) * 100 : Number(val);
                return pctVal.toFixed(1) + "%";
            }
            if (formatChoice === "number") return Number(val).toFixed(1);
            return renderedStr || Number(val).toFixed(2);
        }

        var currentYearTotal = 0;
        var pastYearTotal = 0;
        var finalFormattedTotal = "";

        if (queryResponse.totals_data) {
            currentYearTotal = Number(queryResponse.totals_data[measureCurrent].value) || 0;
            pastYearTotal = Number(queryResponse.totals_data[measurePast].value) || 0;
            finalFormattedTotal = formatVal(currentYearTotal, queryResponse.totals_data[measureCurrent].rendered);
        } else {
            data.forEach(function(row) {
                currentYearTotal += Number(row[measureCurrent].value) || 0;
                pastYearTotal += Number(row[measurePast].value) || 0;
            });
            finalFormattedTotal = formatVal(currentYearTotal, null);
        }
        
        element.querySelector("#kpi-value").innerHTML = finalFormattedTotal;

        // YTD vs Last Year (%)
        var yoyBadge = element.querySelector("#yoy-badge");
        if (pastYearTotal > 0) {
            var yoyDiff = currentYearTotal - pastYearTotal;
            var yoyPct = ((yoyDiff / pastYearTotal) * 100).toFixed(1);
            yoyBadge.innerHTML = (yoyDiff > 0 ? "+" : "") + yoyPct + "%";
            yoyBadge.className = "badge " + (yoyDiff >= 0 ? "positive-badge" : "negative-badge");
        } else {
            yoyBadge.innerHTML = "-"; yoyBadge.className = "badge neutral-badge";
        }

        // Δεδομένα Μηνών
        var currentValues = [];
        var formattedValues = []; // Αποθηκεύει το πώς φαίνεται στο Tooltip!
        var labels = [];
        
        data.forEach(function(row) {
            var val = row[measureCurrent].value;
            if(val !== null && val !== undefined) { 
                var rawDim = row[dimMonth].rendered || row[dimMonth].value;
                labels.push(String(rawDim).replace(/(<([^>]+)>)/gi, "").substring(0, 3)); 
                currentValues.push(Number(val));
                formattedValues.push(formatVal(val, row[measureCurrent].rendered));
            }
        });

        // --- ΕΞΥΠΝΟΣ ΥΠΟΛΟΓΙΣΜΟΣ ΜΗΝΑ ---
        var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        var currentRealMonth = monthNames[new Date().getMonth()]; 
        var indexOfCurrentMonth = labels.indexOf(currentRealMonth);
        
        var currentMonthValue = 0;
        var previousMonthValue = 0;

        if (indexOfCurrentMonth !== -1) {
            currentMonthValue = currentValues[indexOfCurrentMonth];
            if (indexOfCurrentMonth > 0) {
                previousMonthValue = currentValues[indexOfCurrentMonth - 1];
            }
        } else {
            currentMonthValue = currentValues.length > 0 ? currentValues[currentValues.length - 1] : 0;
            previousMonthValue = currentValues.length > 1 ? currentValues[currentValues.length - 2] : 0;
        }

        var momBadge = element.querySelector("#mom-badge");
        if (previousMonthValue > 0) {
            var momDiff = currentMonthValue - previousMonthValue;
            var momPct = ((momDiff / previousMonthValue) * 100).toFixed(1);
            momBadge.innerHTML = (momDiff > 0 ? "+" : "") + momPct + "%";
            momBadge.className = "badge " + (momDiff >= 0 ? "positive-badge" : "negative-badge");
            element.querySelector("#mom-text").innerHTML = `vs Last Month <span style="font-size: 10px; color: #bdc1c6;">(${currentRealMonth} vs ${indexOfCurrentMonth > 0 ? labels[indexOfCurrentMonth-1] : 'N/A'})</span>`;
        } else {
            momBadge.innerHTML = "-"; momBadge.className = "badge neutral-badge";
            element.querySelector("#mom-text").innerHTML = `vs Last Month`;
        }

        // Γράφημα
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
                    plugins: { 
                        legend: { display: false }, 
                        tooltip: { 
                            enabled: true, 
                            displayColors: false, 
                            callbacks: { 
                                // Παίρνει το σωστά μορφοποιημένο νούμερο για το tooltip!
                                label: function(context) { return formattedValues[context.dataIndex]; } 
                            } 
                        } 
                    },
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
