looker.plugins.visualizations.add({
  id: "kpi_dot_bars",
  label: "KPI Dot Bars",

  options: {
    title: { type: "string", label: "Title", default: "KPI Performance" },
    value_format: { type: "string", label: "Format: auto / currency / percent / number", default: "auto" },
    value_prefix: { type: "string", label: "Value Prefix", default: "€" },
    max_value: { type: "number", label: "Max Value For Scaling", default: 0 }
  },

  create: function(element) {
    element.innerHTML = `
      <style>
        .kpi-wrap{width:100%;height:100%;min-height:300px;background:#030303;color:white;font-family:Inter,Arial,sans-serif;padding:24px;box-sizing:border-box;overflow:auto}
        .kpi-title{font-size:clamp(18px,3vw,30px);font-weight:900;margin-bottom:20px}
        .kpi-bars{display:flex;align-items:flex-end;gap:clamp(12px,2vw,28px);height:calc(100% - 70px);min-height:220px}
        .kpi-card{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;cursor:pointer;opacity:1;transition:.2s}
        .kpi-card.muted{opacity:.2}
        .kpi-col{height:80%;display:flex;flex-direction:column-reverse;gap:4px;align-items:center;justify-content:flex-start}
        .dot{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.14)}
        .val{font-size:clamp(14px,2vw,22px);font-weight:900;margin-bottom:8px}
        .name{font-size:11px;font-weight:800;text-align:center;margin-top:10px;max-width:90px}
      </style>
      <div class="kpi-wrap"><div class="kpi-title"></div><div class="kpi-bars"></div></div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const title = element.querySelector(".kpi-title");
    const bars = element.querySelector(".kpi-bars");
    title.innerText = config.title || "KPI Performance";

    const measures = queryResponse.fields.measure_like || [];
    if (!data?.length || !measures.length) {
      bars.innerHTML = "Add one or more measures.";
      done(); return;
    }

    const colors = ["#36a9d6","#ff9f2f","#e95fb8","#ef3d2f","#74d17c","#b994ff","#f6c85f","#4dd4ac"];
    const row = data[0];
    const kpis = measures.map((m,i)=>({name:m.label_short||m.label||m.name,value:Number(row[m.name]?.value||0),color:colors[i%colors.length]}));
    const max = Number(config.max_value || 0) || Math.max(...kpis.map(k=>k.value),1);
    const dots = 34;

    const fmt = v => {
      if (config.value_format === "percent") return (Math.abs(v)<=1?v*100:v).toFixed(1)+"%";
      if (config.value_format === "currency") return (config.value_prefix||"€") + (Math.abs(v)>=1000?(v/1000).toFixed(0)+"K":v.toFixed(0));
      if (config.value_format === "number") return v.toLocaleString(undefined,{maximumFractionDigits:0});
      if (v<=1) return (v*100).toFixed(0)+"%";
      if (v>=1e6) return (v/1e6).toFixed(1)+"M";
      if (v>=1e3) return (v/1e3).toFixed(0)+"K";
      return v.toFixed(0);
    };

    bars.innerHTML = kpis.map((k,i)=>{
      const pct = k.value <= 1 ? k.value*100 : k.value/max*100;
      const active = Math.round(Math.max(0,Math.min(100,pct))/100*dots);
      return `
        <div class="kpi-card" title="${k.name}: ${fmt(k.value)}">
          <div class="val" style="color:${k.color}">${fmt(k.value)}</div>
          <div class="kpi-col">
            ${Array.from({length:dots}).map((_,idx)=>`<div class="dot" style="${idx<active?`background:${k.color};box-shadow:0 0 8px ${k.color}`:""}"></div>`).join("")}
          </div>
          <div class="name">${k.name}</div>
        </div>`;
    }).join("");

    [...bars.querySelectorAll(".kpi-card")].forEach(card=>{
      card.onclick = () => {
        const active = card.classList.contains("active");
        [...bars.querySelectorAll(".kpi-card")].forEach(c=>c.classList.remove("active","muted"));
        if (!active) {
          [...bars.querySelectorAll(".kpi-card")].forEach(c=>c.classList.add("muted"));
          card.classList.remove("muted"); card.classList.add("active");
        }
      };
    });

    done();
  }
});
