looker.plugins.visualizations.add({
  id: "comparative_violin",
  label: "Comparative Violin",

  options: {

    title: {
      type: "string",
      label: "Title",
      default: "Comparative Distribution"
    },

    current_year: {
      type: "string",
      label: "Current Year Label",
      default: "Current"
    },

    comparison_year: {
      type: "string",
      label: "Comparison Year Label",
      default: "Comparison"
    },

    value_format: {
      type: "string",
      label: "Format: currency / percent / number",
      default: "currency"
    },

    value_prefix: {
      type: "string",
      label: "Value Prefix",
      default: "€"
    }
  },

  create: function(element) {

    element.innerHTML = `
      <style>

        .cv-wrap{
          width:100%;
          height:100%;
          min-height:0;
          background:#030303;
          color:white;
          font-family:Inter,Arial,sans-serif;
          padding:clamp(10px,1.8vw,28px);
          box-sizing:border-box;
          overflow:hidden;
          position:relative;
        }

        .cv-title{
          font-size:clamp(16px,2.6vw,30px);
          font-weight:900;
          margin-bottom:16px;
        }

        .cv-chart{
          width:100%;
          height:calc(100% - 60px);
          position:relative;
        }

        .cv-chart svg{
          width:100%;
          height:100%;
        }

        .cv-tooltip{
          position:absolute;
          background:rgba(10,10,10,.96);
          border:1px solid rgba(255,255,255,.12);
          border-radius:12px;
          padding:10px 12px;
          font-size:12px;
          line-height:1.5;
          pointer-events:none;
          opacity:0;
          z-index:30;
          color:white;
          max-width:240px;
        }

      </style>

      <div class="cv-wrap">
        <div class="cv-title"></div>
        <div class="cv-chart"></div>
        <div class="cv-tooltip"></div>
      </div>
    `;
  },

  updateAsync: function(
    data,
    element,
    config,
    queryResponse,
    details,
    done
  ) {

    const titleEl = element.querySelector(".cv-title");
    const chartEl = element.querySelector(".cv-chart");
    const tooltipEl = element.querySelector(".cv-tooltip");

    titleEl.innerText =
      config.title || "Comparative Distribution";

    const dimensions =
      queryResponse.fields.dimension_like || [];

    const measures =
      queryResponse.fields.measure_like || [];

    if (
      dimensions.length < 2 ||
      measures.length < 1
    ) {

      chartEl.innerHTML = `
        <div style="padding:20px;font-size:12px;">
          Add:
          <br><br>
          • Dimension 1 = Category
          <br>
          • Dimension 2 = Year / Comparison
          <br>
          • Measure = Numeric Value
        </div>
      `;

      done();
      return;
    }

    function loadScript(src) {

      return new Promise((resolve,reject)=>{

        const existing =
          document.querySelector("script[src='"+src+"']");

        if(existing){
          resolve();
          return;
        }

        const script =
          document.createElement("script");

        script.src = src;

        script.onload = resolve;
        script.onerror = reject;

        document.head.appendChild(script);
      });
    }

    Promise.resolve()

      .then(() =>
        loadScript("https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js")
      )

      .then(() => {

        render();

        done();
      });

    function render() {

      chartEl.innerHTML = "";

      const d3 = window.d3;

      const width =
        chartEl.clientWidth;

      const height =
        chartEl.clientHeight;

      const svg =
        d3.select(chartEl)
          .append("svg")
          .attr("viewBox",`0 0 ${width} ${height}`);

      const categoryField =
        dimensions[0].name;

      const yearField =
        dimensions[1].name;

      const valueField =
        measures[0].name;

      const currentLabel =
        config.current_year || "Current";

      const comparisonLabel =
        config.comparison_year || "Comparison";

      const colors = {
        current:"#36a9d6",
        comparison:"#ff9f2f"
      };

      function formatValue(v){

        const format =
          config.value_format || "currency";

        const prefix =
          config.value_prefix || "€";

        const val =
          Number(v || 0);

        if(format === "percent"){

          if(Math.abs(val)<=1){
            return (val*100).toFixed(1)+"%";
          }

          return val.toFixed(1)+"%";
        }

        if(format === "number"){

          return val.toLocaleString(undefined,{
            maximumFractionDigits:0
          });
        }

        if(Math.abs(val)>=1000000){
          return prefix+(val/1000000).toFixed(1)+"M";
        }

        if(Math.abs(val)>=1000){
          return prefix+(val/1000).toFixed(0)+"K";
        }

        return prefix+
          val.toLocaleString(undefined,{
            maximumFractionDigits:0
          });
      }

      const grouped = {};

      data.forEach(row => {

        const category =
          row[categoryField]?.value || "Unknown";

        const year =
          row[yearField]?.value || "Unknown";

        const value =
          Number(
            row[valueField]?.value || 0
          );

        if(!grouped[category]){
          grouped[category] = {};
        }

        if(!grouped[category][year]){
          grouped[category][year] = [];
        }

        grouped[category][year].push(value);
      });

      const categories =
        Object.keys(grouped);

      const allValues =
        data.map(r =>
          Number(r[valueField]?.value || 0)
        );

      const y =
        d3.scaleLinear()
          .domain([
            d3.min(allValues),
            d3.max(allValues)
          ])
          .range([height-50,30]);

      const x =
        d3.scaleBand()
          .domain(categories)
          .range([80,width-40])
          .padding(0.25);

      svg.append("g")
        .attr("transform",`translate(0,${height-50})`)
        .call(
          d3.axisBottom(x)
        )
        .selectAll("text")
        .style("fill","white")
        .style("font-size","11px")
        .style("font-weight","700");

      svg.append("g")
        .attr("transform","translate(80,0)")
        .call(
          d3.axisLeft(y).ticks(5)
        )
        .selectAll("text")
        .style("fill","rgba(255,255,255,.7)")
        .style("font-size","10px");

      categories.forEach(category => {

        const years =
          Object.keys(grouped[category]);

        years.forEach((year,index)=>{

          const values =
            grouped[category][year];

          const density =
            d3.bin()
              .domain(y.domain())
              .thresholds(20)(values);

          const maxDensity =
            d3.max(
              density,
              d => d.length
            );

          const xNum =
            d3.scaleLinear()
              .range([0,x.bandwidth()/2.2])
              .domain([0,maxDensity]);

          const area =
            d3.area()
              .x0(d =>
                xNum(-d.length)
              )
              .x1(d =>
                xNum(d.length)
              )
              .y(d =>
                y(d.x0)
              )
              .curve(d3.curveCatmullRom);

          const group =
            svg.append("g")
              .attr(
                "transform",
                `translate(${
                  x(category)+
                  x.bandwidth()/2+
                  (index===0?-18:18)
                },0)`
              )
              .style("cursor","pointer");

          const color =
            index===0
              ? colors.current
              : colors.comparison;

          group.append("path")
            .datum(density)
            .attr("d",area)
            .style("fill",color)
            .style("opacity",0.72)
            .style("stroke",color)
            .style("stroke-width",1.5)
            .on("mousemove",(event)=>{

              tooltipEl.style.opacity = 1;

              tooltipEl.style.left =
                event.offsetX + "px";

              tooltipEl.style.top =
                event.offsetY + "px";

              const median =
                d3.median(values);

              const avg =
                d3.mean(values);

              tooltipEl.innerHTML = `
                <strong>${category}</strong>
                <br>
                ${year}
                <br><br>
                Count: ${values.length}
                <br>
                Avg: ${formatValue(avg)}
                <br>
                Median: ${formatValue(median)}
              `;
            })
            .on("mouseleave",()=>{

              tooltipEl.style.opacity = 0;
            });

          const median =
            d3.median(values);

          group.append("line")
            .attr("x1",-12)
            .attr("x2",12)
            .attr("y1",y(median))
            .attr("y2",y(median))
            .attr("stroke","white")
            .attr("stroke-width",2);

        });
      });

      const violins =
        svg.selectAll("path");

      violins.on("click",function(){

        const active =
          d3.select(this)
            .classed("active");

        violins
          .classed("active",false)
          .style("opacity",0.15);

        if(!active){

          d3.select(this)
            .classed("active",true)
            .style("opacity",1);
        }
        else{

          violins
            .style("opacity",0.72);
        }
      });
    }
  }
});
