function loadScript(url, callback) {
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.src = url;
    script.onload = callback;
    document.head.appendChild(script);
}

looker.plugins.visualizations.add({
    id: "panos_kpi_card_sparkline",
    label: "KPI Card with Sparkline",
    
    create: function(element, config) {
        element.innerHTML = `
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
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
                .kpi-main-value { font-size: 38px; font-weight: 700; color: #202124; margin-bottom: 4px; }
                .kpi-sub-value { font-size: 14px; font-weight: 600; margin-bottom: 20px; }
                .positive { color: #137333; } /* Google green */
                .negative { color: #c5221f; } /* Google red */
                .chart-container { flex-grow: 1; position: relative; width: 100%; min-height: 80px; }
                .error-msg { color: #ea4335; font-size: 14px; text-align: center; padding: 20px;}
            </style>
            <div id="kpi-container">
                <div class="kpi-header">
                    <span id="kpi-title">Metric Title</span>
                    <span class="kpi-icon">📊</span>
                </div>
                <div class="kpi-main-value" id="kpi-value">0</div>
                <div class="kpi-sub-value" id="kpi-comparison">...</div>
                <div class="chart-container">
                    <canvas id="kpi-chart"></canvas>
                </div>
            </div>
        `;
        this._chartInstance = null;
    },

    updateAsync: function(data, element, config, queryResponse, details, done) {
        // Πιάνει τα πάντα, ακόμα και Table Calculations
        var dimensions = queryResponse.fields.dimension_like;
        var measures = queryResponse.fields.measure_like;

        if (!dimensions || dimensions.length === 0 || !measures || measures.length === 0) {
            element.querySelector("#kpi-container").innerHTML = `<div class="error-msg">Σφάλμα: Βάλε 1 Dimension και 1 Measure στον πίνακα.</div>`;
            done();
            return;
        }

        // Αν υπήρχε error πριν, το καθαρίζουμε
        if (element.querySelector(".error-msg")) { this.create(element, config); }

        var dimensionName = dimensions[0].name;
        var measureName = measures[0].name;
        var measureLabel = measures[0].label_short || measures[0].label;

        element.querySelector("#kpi-title").innerText = measureLabel;

        var labels = [];
        var values = [];

        data.forEach(function(row) {
            var rawDim = row[dimensionName].rendered || row[dimensionName].value;
            // Κρατάμε τα 3 πρώτα γράμματα του μήνα ή της χρονολογίας για καθαρότητα (π.χ. Jan, Feb)
            var cleanDim = String(rawDim).replace(/(<([^>]+)>)/gi, "").substring(0, 7); 
            labels.push(cleanDim); 
            values.push(Number(row[measureName].value));
        });

        if (values.length === 0) { done(); return; }

        var lastValue = values[values.length - 1];
        var previousValue = values.length > 1 ? values[values.length - 2] : 0;
        
        // Βάζουμε την κύρια τιμή μαζί με το €
        var finalRowInfo = data[data.length - 1][measureName];
        element.querySelector("#kpi-value").innerHTML = finalRowInfo.rendered || finalRowInfo.value;

        // Υπολογισμός ποσοστού %
        var comparisonEl = element.querySelector("#kpi-comparison");
        if (previousValue !== 0 && values.length > 1) {
            var diff = lastValue - previousValue;
            var pctChange = ((diff / Math.abs(previousValue)) * 100).toFixed(1);
            if (diff >= 0) {
                comparisonEl.innerHTML = `+${pctChange}% από τον προηγούμενο μήνα`;
                comparisonEl.className = "kpi-sub-value positive";
            } else {
                comparisonEl.innerHTML = `${pctChange}% από τον προηγούμενο μήνα`;
                comparisonEl.className = "kpi-sub-value negative";
            }
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
                        data: values,
                        borderColor: '#1a73e8',
                        backgroundColor: 'rgba(26, 115, 232, 0.15)',
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        fill: true,
                        tension: 0.4 // Κάνει την καμπύλη ομαλή
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { enabled: true } },
                    scales: {
                        x: { display: true, grid: { display: false }, ticks: { font: {family: 'Inter'}, color: '#80868b' } },
                        y: { display: false, min: Math.min(...values) * 0.90 } // Κρύβει τις τιμές Υ για design
                    },
                    layout: { padding: 0 }
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
