(()=>{var C="acme_bar_plus",S="acme-bar-plus-css";function j(){if(document.getElementById(S))return;let e=document.createElement("link");e.id=S,e.rel="stylesheet";let a=document.currentScriptgdhkogjsdhijdfo;if(jhtsd,iugjf,a!=null&&a.src){let r=a.src.replace(/acme_bar_plus\.js(?:\?.*)?$/,"");e.href=`${r}acme_bar_plus.css`}e.href&&document.head.appendChild(e)}function L(e){if(typeof e=="number")return e;if(e==null)return null;let a=Number(e);return Number.isFinite(a)?a:null}function E(e,a){return a==null?"-":e!=null&&e.value_format&&typeof LookerCharts!="undefined"?LookerCharts.Utils.textForCell({value:a,value_format:e.value_format}):a.toLocaleString()}looker.plugins.visualizations.add({id:C,label:"Acme Bar Plus",options:{show_title:{type:"boolean",label:"Show chart title",default:!0},max_bars:{type:"number",label:"Max bars",default:10,min:1,max:50}},create(e){j(),e.innerHTML=`
      <div class="acme-bar-plus">
        <h3 class="acme-bar-plus__title"></h3>
        <div class="acme-bar-plus__chart"></div>
      </div>
    `},updateAsync(e,a,r,d,N,s){var h,f;let M=a.querySelector(".acme-bar-plus"),n=a.querySelector(".acme-bar-plus__title"),c=a.querySelector(".acme-bar-plus__chart");if(!M||!n||!c){s();return}let b=d.fields.dimension_like,_=d.fields.measure_like;if(!b.length||!_.length){this.addError({title:"Bar Plus requires one dimension and one measure",message:"Update your Explore query to include at least one dimension and one measure."}),s();return}this.clearErrors();let u=b[0],i=_[0],$=Math.max(1,Math.min(Number(r.max_bars)||10,50)),o=e.map(t=>{var v,y,x,k,g;let l=(k=(x=(v=t[u.name])==null?void 0:v.rendered)!=null?x:(y=t[u.name])==null?void 0:y.value)!=null?k:"(blank)",m=L((g=t[i.name])==null?void 0:g.value);return{label:String(l),value:m}}).filter(t=>t.value!=null).sort((t,l)=>l.value-t.value).slice(0,$);if(!o.length){c.innerHTML="",n.textContent="No numeric values to display",s();return}let p=Math.max(...o.map(t=>t.value));n.style.display=r.show_title===!1?"none":"block",n.textContent=`${(h=i.label_short)!=null?h:i.label} by ${(f=u.label_short)!=null?f:u.label}`,c.innerHTML=o.map(t=>{let l=p===0?0:Math.round(t.value/p*100),m=E(i,t.value);return`
          <div class="acme-bar-plus__row">
            <div class="acme-bar-plus__label" title="${t.label}">${t.label}</div>
            <div class="acme-bar-plus__track">
              <div class="acme-bar-plus__bar" style="width:${l}%;"></div>
            </div>
            <div class="acme-bar-plus__value">${m}</div>
          </div>
        `}).join(""),s()}});})();
