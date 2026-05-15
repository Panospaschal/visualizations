looker.plugins.visualizations.add({
  id: "revenue_source_donut",
  label: "Revenue Source Donut",

  options: {
    title: { type: "string", label: "Title", default: "Revenue By Source" },
    value_format: { type: "string", label: "Format: currency / percent / number", default: "currency" },
    value_prefix: { type: "string", label: "Value Prefix", default: "€" }
  },

  create: function(element) {
    element.innerHTML = `
      <style>
        .rs-wrap{width:100%;height:100%;min-height:320px;background:#030303;color:white;font-family:Inter,Arial,sans-serif;padding:24px;box-sizing:border-box;position:relative;overflow:hidden}
        .rs-title{font-size:clamp(18px,3vw,30px);font-weight:900;margin-bottom:12px}
        .rs-layout{display:grid;grid-template-columns:minmax(220px,1fr) minmax(180px,.8fr);gap:24px;height:calc(100% - 50px);align-items:center}
        .rs-donut{width:min(48vh,42vw,360px);aspect-ratio:1;border-radius:50%;margin:auto;position:relative;cursor:pointer}
        .rs-hole{position:absolute;inset:30%;background:#030303;border:6px solid rgba(255,255,255,.9);border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;font-size:clamp(10px,1.6vw,13px);font-weight:800}
        .rs-list{overflow:auto;max-height:100%}
        .rs-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px;border-radius:10px;cursor:pointer;transition:.2s}
        .rs-item:hover,.rs-item.active{background:rgba(255,255,255,.08)}
        .rs-dot{width:12px;height:12px;border-radius:50%;flex:0 0 12px}
        .rs-name{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800}
        .rs-val{text-align:right;font-size:12px;color:rgba(255,255,255,.75)}
        .rs-muted{opacity:.18}
      </style>
      <div class="rs-wrap">
        <div class="rs-title"></div>
        <div class="rs-layout"><div class="rs-donut"></div><div class="rs-list"></div></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const title = element.querySelector(".rs-title");
    const donut = element.querySelector(".rs-donut");
    const list = element.querySelector(".rs-list");
    title.innerText = config.title || "Revenue By Source";

    const dims = queryResponse.fields.dimension_like || [];
    const ms = queryResponse.fields.measure_like || [];
    if (!data?.length || dims.length < 1 || ms.length < 1) {
      list.innerHTML = "Needs 1 dimension and 1 measure.";
      done(); return;
    }

    const colors = ["#36a9d6","#ff9f2f","#e95fb8","#ef3d2f","#74d17c","#b994ff","#f6c85f","#4dd4ac"];
    const dF = dims[0].name, mF = ms[0].name;
    const rows = data.map((r,i)=>({name:String(r[dF]?.value||"Unknown"), value:Number(r[mF]?.value||0), color:colors[i%colors.length]})).filter(r=>r.value>0).sort((a,b)=>b.value-a.value);
    const total = rows.reduce((s,r)=>s+r.value,0) || 1;

    const fmt = v => {
      if (config.value_format === "percent") return (Math.abs(v)<=1 ? v*100 : v).toFixed(1)+"%";
      if (config.value_format === "number") return v.toLocaleString(undefined,{maximumFractionDigits:0});
      const p = config.value_prefix || "€";
      if (Math.abs(v)>=1e6) return p+(v/1e6).toFixed(1)+"M";
      if (Math.abs(v)>=1e3) return p+(v/1e3).toFixed(0)+"K";
      return p+v.toLocaleString(undefined,{maximumFractionDigits:0});
    };

    let cur=0;
    donut.style.background = `conic-gradient(${rows.map(r=>{const s=cur; cur += r.value/total*100; return `${r.color} ${s}% ${cur}%`;}).join(",")})`;
    donut.innerHTML = `<div class="rs-hole">Total<br>${fmt(total)}</div>`;

    list.innerHTML = rows.map((r,i)=>`
      <div class="rs-item" data-i="${i}">
        <div class="rs-name"><span class="rs-dot" style="background:${r.color}"></span>${r.name}</div>
        <div class="rs-val">${(r.value/total*100).toFixed(1)}%<br>${fmt(r.value)}</div>
      </div>
    `).join("");

    [...list.querySelectorAll(".rs-item")].forEach(item=>{
      item.onclick = () => {
        const active = item.classList.contains("active");
        [...list.querySelectorAll(".rs-item")].forEach(x=>x.classList.remove("active","rs-muted"));
        if (!active) {
          [...list.querySelectorAll(".rs-item")].forEach(x=>x.classList.add("rs-muted"));
          item.classList.remove("rs-muted"); item.classList.add("active");
        }
      };
    });

    done();
  }
});
