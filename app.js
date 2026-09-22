const $ = id => document.getElementById(id);
const refs = {icao:$('icao'),runway:$('runway'),tow:$('tow'),cg:$('cg'),tora:$('tora'),elev:$('elev'),oat:$('oat'),qnh:$('qnh'),slope:$('slope'),windDir:$('windDir'),windSpeed:$('windSpeed'),condition:$('condition'),flaps:$('flaps'),thrustMode:$('thrustMode'),packs:$('packs'),antiIce:$('antiIce')};
const RUNWAYS_URL='https://davidmegginson.github.io/ourairports-data/runways.csv';
let runwayCsvText=''; let airportRunways=[];
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x)); const n=v=>Number(v);
function csvLine(line){let out=[],s='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){s+='"';i++;}else q=!q;}else if(c===','&&!q){out.push(s);s='';}else s+=c;}out.push(s);return out;}
async function getRunwayDb(force=false){
  const cache=await caches.open('a380x-airport-db-v1');
  if(!force){const hit=await cache.match(RUNWAYS_URL); if(hit){runwayCsvText=await hit.text(); return runwayCsvText;}}
  const r=await fetch(RUNWAYS_URL,{cache:'no-store'}); if(!r.ok) throw new Error(`HTTP ${r.status}`); await cache.put(RUNWAYS_URL,r.clone()); runwayCsvText=await r.text(); return runwayCsvText;
}
function parseRunwaysFor(icao){
  if(!runwayCsvText) return [];
  const lines=runwayCsvText.split(/\r?\n/); const h=csvLine(lines[0]); const ix=Object.fromEntries(h.map((v,i)=>[v,i])); const found=[];
  for(let i=1;i<lines.length;i++){if(!lines[i].includes(icao)) continue; const c=csvLine(lines[i]); if(c[ix.airport_ident]!==icao || c[ix.closed]==='1') continue;
    const common={lengthFt:n(c[ix.length_ft]),surface:c[ix.surface]||'UNK'};
    [['le','he'],['he','le']].forEach(([p,op])=>{const ident=c[ix[`${p}_ident`]]; if(!ident) return; const disp=n(c[ix[`${p}_displaced_threshold_ft`]])||0; const elev=n(c[ix[`${p}_elevation_ft`]])||0; const hdg=n(c[ix[`${p}_heading_degT`]])||runwayHeading(ident); found.push({ident,lengthFt:common.lengthFt,usableFt:Math.max(0,common.lengthFt-disp),elev,heading:hdg,surface:common.surface});});
  } return found.sort((a,b)=>a.ident.localeCompare(b.ident));
}
async function loadAirport(force=false){
  const icao=refs.icao.value.trim().toUpperCase(); refs.icao.value=icao; if(!/^[A-Z0-9]{4}$/.test(icao)){statusAirport('Enter a four-character ICAO code.','bad');return;}
  statusAirport(force?'Updating runway database…':'Loading runway data…');
  try{if(!runwayCsvText||force) await getRunwayDb(force); airportRunways=parseRunwaysFor(icao); if(!airportRunways.length) throw new Error('No runway records found');
    refs.runway.innerHTML=airportRunways.map(r=>`<option value="${r.ident}">${r.ident} · ${Math.round(r.usableFt*0.3048)} m</option>`).join(''); selectRunway(); statusAirport(`${airportRunways.length} runway ends loaded · OurAirports ${force?'updated':'cached/online'}.`,'ok');
  }catch(e){statusAirport(`Runway lookup unavailable (${e.message}). Manual runway data can still be entered.`,'bad'); if(!refs.runway.options.length) refs.runway.innerHTML='<option value="">MANUAL</option>';}
}
function selectRunway(){const r=airportRunways.find(x=>x.ident===refs.runway.value); if(!r)return; refs.tora.value=Math.round(r.usableFt*0.3048); refs.elev.value=Math.round(r.elev); if(r.heading) refs.runway.dataset.heading=r.heading;}
function statusAirport(t,c=''){const e=$('airportStatus');e.textContent=t;e.className=`helper ${c}`;}
function runwayHeading(runway){const d=String(runway).match(/^(\d{1,2})/);if(!d)return null;const r=+d[1];return r===36?360:r*10;}
function activeHeading(){const r=airportRunways.find(x=>x.ident===refs.runway.value);return r?.heading||runwayHeading(refs.runway.value);}
function headwind(h,wdir,wspd){if(!Number.isFinite(h)||!Number.isFinite(wdir)||!Number.isFinite(wspd))return 0;let a=Math.abs(wdir-h)%360;if(a>180)a=360-a;return Math.cos(a*Math.PI/180)*wspd;}
function calcForConf(d,conf){
  const refW=363068,wr=d.tow/refW,ss=Math.sqrt(wr); const b={1:{v1:140,vr:145,v2:149,fb:-2,rf:1.03},2:{v1:136,vr:136,v2:142,fb:0,rf:1},3:{v1:134,vr:135,v2:141,fb:-3,rf:.97}}[conf];
  const dens=(d.elev/1000)*.7+Math.max(0,d.oat-15)*.08+Math.max(0,1013-d.qnh)*.015; const tail=Math.max(0,-d.hw); const sAdj=dens*.25+(d.condition==='wet'?.3:0)+Math.max(0,d.slope)*.24+tail*.12;
  let v1=Math.round(b.v1*ss+sAdj),vr=Math.max(v1,Math.round(b.vr*ss+sAdj)),v2=Math.max(vr+4,Math.round(b.v2*ss+sAdj));
  let flex=66+b.fb+((d.tora-4000)/100)*.75-((d.tow-refW)/1000)*.11+clamp(d.hw,-15,25)*.18-dens*.8-(d.condition==='wet'?5:0)-Math.max(0,d.slope)*2.3-(d.packs?1:0)-(d.antiIce?3:0); flex=Math.floor(clamp(flex,d.oat+1,70));
  let req=2850*Math.pow(wr,1.55)*b.rf; req*=1+Math.max(0,d.oat-15)*.004; req*=1+d.elev*.000035; req*=d.condition==='wet'?1.08:1; req*=1+Math.max(0,d.slope)*.05; req*=1+tail*.012; req*=1-Math.max(0,d.hw)*.004; req=Math.round(req);
  if(d.thrustMode==='toga') flex=null; return{conf,v1,vr,v2,flex,req,margin:d.tora-req};
}
function compute(){
  const d={icao:refs.icao.value.trim().toUpperCase()||'----',runway:refs.runway.value||'--',tow:n(refs.tow.value),cg:n(refs.cg.value),tora:n(refs.tora.value),elev:n(refs.elev.value),oat:n(refs.oat.value),qnh:n(refs.qnh.value),slope:n(refs.slope.value),windDir:n(refs.windDir.value),windSpeed:n(refs.windSpeed.value),condition:refs.condition.value,packs:refs.packs.checked,antiIce:refs.antiIce.checked,thrustMode:refs.thrustMode.value}; d.hw=headwind(activeHeading(),d.windDir,d.windSpeed);
  const p=[];if(!(d.tow>=250000&&d.tow<=575000))p.push('TOW outside 250–575 t model envelope.');if(!(d.cg>=28&&d.cg<=44))p.push('CG outside current A380X takeoff range 28–44 %MAC.');if(!(d.tora>=1200&&d.tora<=6000))p.push('Check TORA.');if(!(d.qnh>=930&&d.qnh<=1060))p.push('Check QNH.');
  $('outIcao').textContent=d.icao;$('outRunway').textContent=d.runway;$('runwayMeta').textContent=`TORA ${d.tora} M · ELEV ${d.elev} FT · ${d.condition.toUpperCase()}`;
  if(p.length){setValidity('invalid','CHECK INPUT');$('notes').textContent=p.join(' ');clearOutputs();return;}
  let cs=[1,2,3].map(c=>calcForConf(d,c));let choice;if(refs.flaps.value==='opt'){const valid=cs.filter(x=>x.margin>=0);choice=(valid.length?valid:cs).sort((a,b)=>(b.flex??-999)-(a.flex??-999)||b.margin-a.margin)[0];}else choice=cs.find(x=>x.conf===+refs.flaps.value);
  $('v1').textContent=choice.v1;$('vr').textContent=choice.vr;$('v2').textContent=choice.v2;$('outFlaps').textContent=choice.conf===1?'CONF 1+F':`CONF ${choice.conf}`;$('thrust').textContent=d.thrustMode==='toga'?'TOGA':'FLEX';$('flex').textContent=choice.flex==null?'—':`${choice.flex}°C`;$('ths').textContent=d.cg.toFixed(1);$('headwind').textContent=`${d.hw>=0?'+':''}${d.hw.toFixed(0)} KT`;$('req').textContent=`${choice.req} M`;$('margin').textContent=`${choice.margin>=0?'+':''}${choice.margin} M`;
  $('confTable').innerHTML='<div class="conf-head">CONFIG COMPARISON</div>'+cs.map(x=>`<div class="conf-row ${x.conf===choice.conf?'selected':''}"><span>${x.conf===1?'1+F':x.conf}</span><span>V2 ${x.v2}</span><span>${x.flex==null?'TOGA':`FLEX ${x.flex}`}</span><span>${x.margin>=0?'+':''}${x.margin} m</span></div>`).join('');
  if(choice.margin<0)setValidity('invalid','NO VALID TAKEOFF*');else if(choice.margin<350||d.hw<-10||d.condition==='wet')setValidity('caution','CHECK / CAUTION*');else setValidity('valid','PERFORMANCE VALID*');
  $('notes').textContent=`Estimated takeoff distance ≈ ${choice.req} m. ${refs.flaps.value==='opt'?`OPTIMUM selected ${choice.conf===1?'CONF 1+F':`CONF ${choice.conf}`}. `:''}Cross-check against SimBrief A388 / D8-FBW.`; save();
}
function clearOutputs(){['v1','vr','v2','outFlaps','thrust','flex','ths','headwind','req','margin'].forEach(id=>$(id).textContent='—');$('confTable').innerHTML='';}
function setValidity(c,t){const e=$('validity');e.className=`validity ${c}`;e.textContent=t;}
function save(){localStorage.setItem('a380xPerfV02',JSON.stringify(Object.fromEntries(Object.entries(refs).map(([k,e])=>[k,e.type==='checkbox'?e.checked:e.value]))));}
function parseMetar(){const s=$('metar').value.trim().toUpperCase();let changed=[];let w=s.match(/\b(\d{3}|VRB)(\d{2,3})(?:G\d{2,3})?KT\b/);if(w&&w[1]!=='VRB'){refs.windDir.value=+w[1];refs.windSpeed.value=+w[2];changed.push('wind');}let t=s.match(/\s(M?\d{2})\/(M?\d{2}|XX)\b/);if(t){refs.oat.value=t[1][0]==='M'?-Number(t[1].slice(1)):Number(t[1]);changed.push('OAT');}let q=s.match(/\bQ(\d{4})\b/);if(q){refs.qnh.value=+q[1];changed.push('QNH');}let a=s.match(/\bA(\d{4})\b/);if(!q&&a){refs.qnh.value=Math.round((+a[1]/100)*33.8639);changed.push('QNH');}$('metarStatus').textContent=changed.length?`Loaded: ${changed.join(', ')}.`:'Could not find wind/OAT/QNH in this METAR.';}

async function importSimbrief(){
  const id=$('simbriefId').value.trim(); const st=$('simbriefStatus'); const sum=$('simbriefSummary');
  if(!/^\d{1,7}$/.test(id)){st.textContent='Enter your numeric SimBrief Pilot ID (1–7 digits).';st.className='helper bad';return;}
  localStorage.setItem('a380xSimbriefId',id); st.textContent='Requesting latest SimBrief OFP…';st.className='helper'; sum.hidden=true;
  try{
    const url=`https://www.simbrief.com/api/xml.fetcher.php?userid=${encodeURIComponent(id)}&json=v2`;
    const r=await fetch(url,{cache:'no-store'}); if(!r.ok) throw new Error(`SimBrief HTTP ${r.status}`); const j=await r.json();
    const pick=(o,...paths)=>{for(const path of paths){let v=o;for(const k of path.split('.'))v=v?.[k];if(v!==undefined&&v!==null&&v!=='')return v;}return null};
    const dep=String(pick(j,'origin.icao_code','origin.icao')||'').toUpperCase(); const dest=String(pick(j,'destination.icao_code','destination.icao')||'').toUpperCase();
    const units=String(pick(j,'params.units')||'kgs').toLowerCase(); let tow=Number(pick(j,'weights.takeoff_weight','weights.est_tow','weights.plan_tow'));
    if(Number.isFinite(tow)&&units.includes('lb'))tow*=0.45359237;
    const metar=String(pick(j,'weather.orig_metar','weather.origin_metar')||''); const ac=String(pick(j,'aircraft.icaocode','aircraft.icao_code','aircraft.name')||'');
    const airline=String(pick(j,'general.icao_airline')||''); const fn=String(pick(j,'general.flight_number')||''); const airac=String(pick(j,'params.airac')||'—');
    if(dep){refs.icao.value=dep;await loadAirport(false);} if(Number.isFinite(tow)&&tow>0)refs.tow.value=Math.round(tow/100)*100;
    if(metar){$('metar').value=metar;parseMetar();}
    st.textContent='Latest OFP imported. Select/verify departure runway, CG and configuration before calculation.';st.className='helper ok';
    sum.innerHTML=`<b>${airline}${fn||''}</b> ${dep||'----'} → ${dest||'----'} · ${ac||'AIRCRAFT'} · TOW ${Number.isFinite(tow)?(tow/1000).toFixed(1)+' t':'—'} · AIRAC ${airac}`;sum.hidden=false;
  }catch(e){st.textContent=`SimBrief import failed: ${e.message}. The PWA can still be used manually.`;st.className='helper bad';}
}
$('importSimbrief').addEventListener('click',importSimbrief);$('icao').addEventListener('change',()=>loadAirport(false));$('icao').addEventListener('keyup',e=>{if(e.key==='Enter')loadAirport(false)});$('runway').addEventListener('change',selectRunway);$('syncDb').addEventListener('click',()=>loadAirport(true));$('calculate').addEventListener('click',compute);$('parseMetar').addEventListener('click',parseMetar);
function net(){ $('netState').textContent=navigator.onLine?'ONLINE':'OFFLINE'; $('netState').className=`net ${navigator.onLine?'':'off'}`;} addEventListener('online',net);addEventListener('offline',net);net();
try{const s=JSON.parse(localStorage.getItem('a380xPerfV02')||'null');if(s)Object.entries(s).forEach(([k,v])=>{if(!refs[k]||k==='runway')return;if(refs[k].type==='checkbox')refs[k].checked=!!v;else refs[k].value=v;});}catch{}
$('simbriefId').value=localStorage.getItem('a380xSimbriefId')||'';
if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js'));
loadAirport(false);
