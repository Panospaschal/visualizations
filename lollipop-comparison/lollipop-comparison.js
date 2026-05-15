looker.plugins.visualizations.add({
  id: "lollipop_comparison",
  label: "Lollipop Comparison",

  options: {
    title: { type: "string", label: "Title", default: "Revenue Comparison" },
    current_label: { type: "string", label: "Current Label", default: "Current" },
    comparison_label: { type: "string", label: "Comparison Label", default: "Comparison" },
    value_format: { type: "string", label: "Format: currency / percent / number", default: "currency" },
    value_prefix: { type: "string", label: "Value Prefix", default: "€" }
  },

  create: function(element) {
    element.innerHTML = `
      <style>
        .lc-wrap{width:100%;height:100%;min-height:300px;background:#030303;color:white;font-family:Inter,Arial,sans-serif;padding:24px;box-sizing:border-box;overflow:auto}
        .lc-title{font-size:clamp(18px,3vw,30px);font-weight:900;margin-bottom:12px}
        .lc-legend{display:flex;gap:18px;font-size:12px;color:rgba(255,255,255,.75);margin-bottom:18px}
        .lg{display:flex;gap:7px;align-items:center}.s{width:11px;height:11px;border-radius:50%}
        .row{display:grid;grid-template-columns:150px 1fr 90px;gap:14px;align-items:center;height:34px}
        .label{font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .track{height:24px;position:relative}
        .line{position:absolute;top:50%;height:1px;background:rgba(255,255,255,.35)}
        .dot{position:absolute;top:50%;width:15px;height:15px;border-radius:50%;transform:translate(-50%,-50%);cursor:pointer}
        .current{background:#36a9d6;box-shadow:0 0 12px #36a9d6}.comparison{background:#ff9f2f;opacity:.5}
        .val{text-align:right;font-size:11px;font-weight:800}
        .muted{opacity:.16}
      </style>
      <div class="lc-wrap"><div class="lc-title"></div><div class="lc-legend"></div><div class="lc-chart"></div></div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const title = element.querySelector(".lc-title");
    const legend = element.querySelector(".lc-legend");
    const chart = element.querySelector(".lc-chart");
    title.innerText = config.title || "Revenue Comparison";

    const dims = queryResponse.fields.dimension_like || [];
    const ms = queryResponse.fields.measure_like || [];
    if (!data?.length || dims.length < 1 || ms.length < 2) {
      chart.innerHTML = "Needs 1 dimension and 2 measures.";
      done(); return;
    }

    legend.innerHTML = `
      <div class="lg"><span class="s" style="background:#36a9d6"></span>${config.current_label||"Current"}</div>
      <div class="lg"><span class="s" style="background:#ff9f2f;opacity:.5"></span>${config.comparison_label||"Comparison"}</div>`;

    const dF=dims[0].name, cF=ms[0].name, pF=ms[1].name;
    const rows = data.map(r=>({cat:r[dF]?.value||"-", cur:Number(r[cF]?.value||0), comp:Number(r[pF]?.value||0)}));
    const all = rows.flatMap(r=>[r.cur,r.comp]);
    const min = Math.min(...all,0), max = Math.max(...all,1), range=max-min||1;
    const scale = v => ((v-min)/range)*100;

    const fmt = v => {
      if (config.value_format === "percent") return (Math.abs(v)<=1?v*100:v).toFixed(1)+"%";
      if (config.value_format === "number") return v.toLocaleString(undefined,{maximumFractionDigits:0});
      const p=config.value_prefix||"€";
      if(Math.abs(v)>=1e6)return p+(v/1e6).toFixed(1)+"M";
      if(Math.abs(v)>=1e3)return p+(v/1e3).toFixed(0)+"K";
      return p+v.toLocaleString(undefined,{maximumFractionDigits:0});
    };

    chart.innerHTML = rows.map((r,i)=>{
      const x1=scale(r.cur), x2=scale(r.comp), l=Math.min(x1,x2), w=Math.abs(x1-x2);
      const diff=r.cur-r.comp;
      return `<div class="row" data-i="${i}">
        <div class="label">${r.cat}</div>
        <div class="track">
          <div class="line" style="left:${l}%;width:${w}%;"></div>
          <div class="dot comparison" title="${config.comparison_label}: ${fmt(r.comp)}" style="left:${x2}%"></div>
          <div class="dot current" title="${config.current_label}: ${fmt(r.cur)}" style="left:${x1}%"></div>
        </div>
        <div class="val">${diff>=0?"+":""}${fmt(diff)}</div>
      </div>`;
    }).join("");

    [...chart.querySelectorAll(".row")].forEach(row=>{
      row.onclick=()=>{
        const active=row.classList.contains("active");
        [...chart.querySelectorAll(".row")].forEach(r=>r.classList.remove("active","muted"));
        if(!active){[...chart.querySelectorAll(".row")].forEach(r=>r.classList.add("muted"));row.classList.remove("muted");row.classList.add("active");}
      };
    });

    done();
  }
});
