looker.plugins.visualizations.add({
  id: "gymnast_radar_chart",
  label: "Gymnast Radar Chart",

  create: function(element, config) {
    element.innerHTML = "";
    
    // Create the canvas element explicitly
    var canvas = document.createElement("canvas");
    canvas.id = "myChart";
    element.appendChild(canvas);
    this._canvas = canvas;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.clearErrors();

    // Safety checks: Make sure Chart.js loaded
    if (typeof Chart === 'undefined') {
      this.addError({title: "Dependency Error", message: "Chart.js failed to load. Check Dependencies tab."});
      return;
    }

    // Safety checks: Ensure query metadata exists
    if (!queryResponse || !queryResponse.fields) {
       this.addError({title: "No Data", message: "No query metadata found. Check Query tab."});
       return;
    }

    // Handle both Looker production formats and mock data formats
    const dimensions = queryResponse.fields.dimension_like || queryResponse.fields.dimensions;
    const measures = queryResponse.fields.measure_like || queryResponse.fields.measures;

    if (!dimensions || dimensions.length === 0) {
      this.addError({title: "No Dimensions", message: "Requires 1 dimension."});
      return;
    }

    const dimName = dimensions[0].name;
    const measureNames = measures.map(m => m.name);

    let chartLabels = [];
    
    // Colors matching your specific image
    const colorPalette = [
      { border: 'rgba(235, 110, 110, 1)', bg: 'rgba(235, 110, 110, 0.3)' }, // Gymnast 1 (Red)
      { border: 'rgba(54, 162, 235, 1)',  bg: 'rgba(54, 162, 235, 0.3)' },  // Gymnast 2 (Blue)
      { border: 'rgba(110, 235, 110, 1)', bg: 'rgba(110, 235, 110, 0.3)' }   // Gymnast 3 (Green)
    ];

    let chartDatasets = measures.map((measure, i) => {
      let color = colorPalette[i % colorPalette.length]; 
      return {
        label: measure.label_short || measure.name,
        data: [],
        borderColor: color.border,
        backgroundColor: color.bg,
        pointBackgroundColor: color.border,
        borderWidth: 2,
        pointRadius: 4 // Make dots slightly larger
      };
    });

    // Populate data arrays
    data.forEach(row => {
      if (row[dimName]) {
        chartLabels.push(row[dimName].value);
      }
      measureNames.forEach((m, i) => {
        if (row[m]) {
          chartDatasets[i].data.push(row[m].value);
        }
      });
    });

    // Drawing the Chart
    const ctx = this._canvas.getContext('2d');

    if (this._chart) {
      this._chart.destroy();
    }

    this._chart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: chartLabels,
        datasets: chartDatasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            min: 0,
            max: 10,
            ticks: {
              stepSize: 1,
              font: { size: 14 }
            },
            pointLabels: {
              font: { size: 14, family: 'serif' }
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Gymnast Scoring Radar Chart',
            align: 'start',
            font: { size: 24, family: 'serif', weight: 'bold' },
            color: '#000'
          },
          legend: {
            position: 'top',
            align: 'start',
            labels: { font: { size: 16, family: 'serif' }, boxWidth: 15 }
          }
        }
      }
    });

    done();
  }
});