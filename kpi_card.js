// Φορτώνουμε τη βιβλιοθήκη Chart.js δυναμικά
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
        // Δημιουργούμε το HTML και το CSS για να μοιάζει με την εικόνα σου
        element.innerHTML = `
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
                #kpi-container {
                    font-family: 'Inter', sans-serif;
                    background: #ffffff;
                    border-radius: 16px;
                    padding: 20px 20px 10px 20px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                    border: 1px solid #e0e0e0;
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    box-sizing: border-box;
                }
                .kpi-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    color: #4a4a4a;
                    font-size: 14px;
                    font-weight: 600;
                    margin-bottom: 15px;
                }
                .kpi-icon {
                    color: #1a73e8;
                    font-size: 18px;
                }
                .kpi-main-value {
                    font-size: 36px;
                    font-weight: 700;
                    color: #202124;
                    margin-bottom: 5px;
                }
                .kpi-sub-value {
                    font-size: 13px;
                    font-weight: 600;
                    margin-bottom: 20px;
                }
                .positive { color: #34a853; }
                .negative { color: #ea4335; }
                .chart-container {
                    flex-grow: 1;
                    position: relative;
                    width: 100%;
                    min-height: 80px;
                }
                .error-msg {
                    color: #ea4335;
                    font-size: 12px;
                    text-align: center;
                }
            </style>
            <div id="kpi-container">
                <div class="kpi-header">
                    <span id="kpi-title">Metric Title</span>
                    <span class="kpi-icon">👥</span>
                </div>
                <div class="kpi-main-value" id="kpi-value">0</div>
                <div class="kpi-sub-value" id="kpi-comparison">No comparison data</div>
                <div class="chart-container">
                    <canvas id="kpi-chart"></canvas>
                </div>
            </div>
        `;
        this._chartInstance = null;
    },

    updateAsync: function(data, element, config, queryResponse, details, done) {
        // Έλεγχος ότι έχουμε σωστά δεδομένα (1 Dimension, 1 Measure)
        if (queryResponse.fields.dimensions.length === 0 || queryResponse.fields.measures.length === 0) {
            element.querySelector("#kpi-container").innerHTML = `<div class="error-msg">Παρακαλώ επίλεξε 1 Dimension (π.χ. Μήνα) και 1 Measure (π.χ. Ποσοστό).</div>`;
            done();
            return;
        }

        // Τραβάμε τα ονόματα των πεδίων
        var dimensionName = queryResponse.fields.dimensions[0].name;
        var measureName = queryResponse.fields.measures[0].name;
        var measureLabel = queryResponse.fields.measures[0].label_short || queryResponse.fields.measures[0].label;

        // Ενημερώνουμε τον τίτλο
        element.querySelector("#kpi-title").innerText = measureLabel;

        // Φτιάχνουμε τους πίνακες για το γράφημα
        var labels = [];
        var values = [];

        data.forEach(function(row) {
            var dimValue = LookerCharts.Utils.htmlForCell(row[dimensionName]) || row[dimensionName].value;
            // Κρατάμε τα 3 πρώτα γράμματα του μήνα (π.χ. Jan, Feb)
            labels.push(String(dimValue).substring(0, 3)); 
            values.push(row[measureName].value);
        });

        // Υπολογισμός κεντρικής τιμής (η τελευταία τιμή των δεδομένων)
        var lastValue = values[values.length - 1];
        var previousValue = values[values.length - 2] || 0;
        
        // Μορφοποίηση της κύριας τιμής
        var formattedValue = LookerCharts.Utils.htmlForCell(data[data.length - 1][measureName]) || lastValue;
        element.querySelector("#kpi-value").innerHTML = formattedValue;

        // Υπολογισμός διαφοράς από τον προηγούμενο μήνα
        var comparisonEl = element.querySelector("#kpi-comparison");
        if (previousValue !== 0 && values.length > 1) {
            var diff = lastValue - previousValue;
            var pctChange = ((diff / previousValue) * 100).toFixed(1);
            if (diff >= 0) {
                comparisonEl.innerHTML = `+${pctChange}% from last month`;
                comparisonEl.className = "kpi-sub-value positive";
            } else {
                comparisonEl.innerHTML = `${pctChange}% from last month`;
                comparisonEl.className = "kpi-sub-value negative";
            }
        }

        // Σχεδιασμός του Γραφήματος με Chart.js
        var drawChart = () => {
            var ctx = element.querySelector("#kpi-chart").getContext("2d");
            
            if (this._chartInstance) {
                this._chartInstance.destroy();
            }

            this._chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        data: values,
                        borderColor: '#1a73e8', // Μπλε γραμμή
                        backgroundColor: 'rgba(26, 115, 232, 0.15)', // Γαλάζιο γέμισμα
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        fill: true,
                        tension: 0.4 // Κάνει την καμπύλη απαλή (όπως στην εικόνα)
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { enabled: true } },
                    scales: {
                        x: {
                            grid: { display: false, drawBorder: false },
                            ticks: { font: { size: 10, family: 'Inter' }, color: '#70757a' }
                        },
                        y: {
                            display: true,
                            grid: { color: '#e8eaed', borderDash: [4, 4], drawBorder: false },
                            ticks: { display: false } // Κρύβουμε τους αριθμούς αριστερά, αφήνουμε μόνο τις διακεκομμένες γραμμές
                        }
                    },
                    layout: { padding: { left: -10, bottom: -10 } }
                }
            });
            done();
        };

        // Φόρτωση βιβλιοθήκης και εκτέλεση
        if (typeof Chart === 'undefined') {
            loadScript('https://cdn.jsdelivr.net/npm/chart.js', drawChart);
        } else {
            drawChart();
        }
    }
});
