import {normalizeHistory,compareHistory,historyFromCsv,HISTORY_NAMES,HISTORY_UNITS} from './history-data.js';
const HISTORY_URL = new URL('../data/market-history.json', import.meta.url);
const CACHE_KEY = 'ore-history-import-v1';
const PALETTE = {gold:'#c09449',zijinA:'#387ab6',zijinH:'#168f83'};
const PERIODS=['1m','3m','6m','1y','all'];
let marketHistory=null, importedHistory=null, selectedStock='zijinA',selectedMode='indexed',selectedPeriod='6m';
const number=(v,d=2)=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const percent=v=>typeof v==='number'&&Number.isFinite(v)?(v>0?'+':'')+(v*100).toFixed(2)+'%':'—';
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=date=>Date.parse(date+'T00:00:00Z');
const priceColors=PALETTE;
const instrumentName=(key,view)=>key==='gold'?(view.goldInstrument==='SGE Au99.99'?'上金所 Au99.99':'国际现货黄金 XAU/USD'):HISTORY_NAMES[key];
const instrumentUnit=(key,view)=>key==='gold'?(view.goldUnit||'USD/oz'):HISTORY_UNITS[key];

export function makeChart(result){
 if(!result.enough)return `<div class="hist-empty"><div class="hist-empty-icon">⌁</div><b>暂无可用的真实黄金—紫金矿业历史走势</b><p>${escapeHtml(result.reason)} 请导入包含实际日期和价格的CSV，或配置已获许可的收盘数据源。这里不会生成模拟价格。</p></div>`;
 const W=1000,H=390,L=74,R=80,T=30,B=48,PW=W-L-R,PH=H-T-B;
 const start=when(result.start),end=when(result.end),dx=(date)=>L+(when(date)-start)/Math.max(1,end-start)*PW;
 const getVals=(keys)=>keys.flatMap(k=>result.series[k].map(p=>p.value));
 const extent=(vals)=>{let lo=Math.min(...vals),hi=Math.max(...vals);if(!(hi>lo)){let p=Math.max(1,Math.abs(hi)*.04);lo-=p;hi+=p;}let p=(hi-lo)*.08;return [lo-p,hi+p];};
 const yLeft=result.mode==='indexed'?extent(getVals(result.wanted)):extent(getVals(['gold']));
 const yRight=result.mode==='dual'?extent(getVals([result.stock])):null;
 const y=(v,lim)=>T+(lim[1]-v)/(lim[1]-lim[0])*PH;
 let lines='';
 for(let i=0;i<5;i++){
  let t=i/4,py=T+t*PH,ty=yLeft[1]-t*(yLeft[1]-yLeft[0]);
  lines+=`<line x1="${L}" x2="${W-R}" y1="${py}" y2="${py}" stroke="#e7eef3"/><text x="${L-9}" y="${py+4}" text-anchor="end" class="hist-axis">${number(ty,result.mode==='indexed'?1:0)}</text>`;
  if(yRight)lines+=`<text x="${W-R+12}" y="${py+4}" class="hist-axis">${number(yRight[1]-t*(yRight[1]-yRight[0]))}</text>`;
  const date=new Date(start+(end-start)*t).toISOString().slice(0,10);
  lines+=`<text x="${L+PW*t}" y="${H-12}" text-anchor="${i===0?'start':i===4?'end':'middle'}" class="hist-axis">${date}</text>`;
 }
 if(result.mode==='indexed'&&yLeft[0]<100&&yLeft[1]>100){const yy=y(100,yLeft);lines+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="#8196a6" stroke-dasharray="5 6" opacity=".8"/><text x="${W-R-5}" y="${yy-6}" text-anchor="end" class="hist-100">100基准</text>`;}
 const paths=result.wanted.map(k=>{
  const axis=(result.mode==='dual'&&k!=='gold')?yRight:yLeft;
  const d=result.series[k].map((p,i)=>`${i?'L':'M'}${dx(p.date).toFixed(2)},${y(p.value,axis).toFixed(2)}`).join(' ');
  return `<path d="${d}" fill="none" stroke="${PALETTE[k]}" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
 }).join('');
 return `<div class="hist-svgbox"><svg class="hist-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="金价和紫金矿业股票比较走势图，${result.mode==='indexed'?'共同基准100':'双纵轴价格'}；${result.start}至${result.end}"><text x="${L}" y="17" class="hist-axis-title">${result.mode==='indexed'?'共同起点＝100':'左轴 '+instrumentName('gold',result)+' '+instrumentUnit('gold',result)}</text>${yRight?`<text x="${W-R}" y="17" text-anchor="end" class="hist-axis-title">右轴 ${HISTORY_UNITS[result.stock]}/股</text>`:''}${lines}${paths}<line data-crosshair x1="0" x2="0" y1="${T}" y2="${T+PH}" stroke="#8ca1b0" stroke-dasharray="3 4" visibility="hidden"/><rect data-hist-hover x="${L}" y="${T}" width="${PW}" height="${PH}" fill="transparent" style="cursor:crosshair"/></svg><div class="hist-tooltip" hidden></div></div>`;
}

export function downloadHistoryText(filename,text){
 const blob=new Blob([text],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function bindHover(container,view){
 if(!view.enough)return;
 const svg=container.querySelector('.hist-svg'),overlay=container.querySelector('[data-hist-hover]'),tip=container.querySelector('.hist-tooltip'),line=container.querySelector('[data-crosshair]');
 if(!svg||!overlay)return;
 const lookup=Object.fromEntries(view.wanted.map(k=>[k,new Map(view.series[k].map(p=>[p.date,p.value]))]));
 overlay.addEventListener('pointerleave',()=>{tip.hidden=true;line.setAttribute('visibility','hidden')});
 overlay.addEventListener('pointermove',e=>{
  const r=svg.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*1000,loc=(x-74)/846;
  if(loc<0||loc>1)return;
  const target=when(view.start)+(when(view.end)-when(view.start))*loc;
  let date=view.commonDates[0],delta=Infinity;
  for(const d of view.commonDates){let v=Math.abs(when(d)-target);if(v<delta){delta=v;date=d;}}
  const cross=74+(when(date)-when(view.start))/Math.max(1,when(view.end)-when(view.start))*846;
  line.setAttribute('x1',cross);line.setAttribute('x2',cross);line.setAttribute('visibility','visible');
  const values=view.wanted.map(k=>{
   const graphVal=lookup[k].get(date);
   // Both chart modes derive raw price from the same common-date values.
   const raw=view.mode==='indexed'?graphVal/100*view.baseline[k]:graphVal;
   const growth=raw/view.baseline[k]-1;
   return `<div class="hist-tip-row"><span><i style="background:${PALETTE[k]}"></i>${escapeHtml(instrumentName(k,view))}</span><b>${number(raw)} ${instrumentUnit(k,view)} · ${percent(growth)}</b></div>`;
  }).join('');
  tip.innerHTML=`<strong>${date}</strong>${values}`;tip.hidden=false;
  tip.style.left=Math.min(r.width-240,Math.max(8,cross/1000*r.width+12))+'px';
  tip.style.top='42px';
 });
}

export function repaintHistory(container){
 if(!container.isConnected)return;
 const src=importedHistory||marketHistory;
 const view=compareHistory(src,{stock:selectedStock,period:selectedPeriod,mode:selectedMode});
 const choose=(field,value,label,selected)=>`<button class="hist-toggle ${selected===value?'active':''}" type="button" data-${field}="${value}">${label}</button>`;
 const controls=`<div class="panel hist-toolbar"><div class="hist-control"><label>比较对象</label><div class="hist-togglebar">${[['zijinA','紫金 A'],['zijinH','紫金 H'],['both','A / H 同图']].map(([k,n])=>choose('hist-stock',k,n,selectedStock)).join('')}</div></div>
 <div class="hist-control"><label>时间跨度</label><div class="hist-togglebar">${PERIODS.map(k=>choose('hist-period',k,k.toUpperCase(),selectedPeriod)).join('')}</div></div>
 <div class="hist-control"><label>坐标方式</label><div class="hist-togglebar">${[['indexed','起点=100'],['dual','双价格轴']].map(([k,n])=>choose('hist-mode',k,n,selectedMode)).join('')}</div></div></div>`;
 const legend=view.wanted.map(k=>`<span><i style="background:${PALETTE[k]}"></i>${escapeHtml(instrumentName(k,view))}</span>`).join('');
 const metrics=view.enough?`<div class="hist-stats">${view.wanted.map(k=>`<div class="hist-stat"><span class="hist-stat-title"><i style="background:${PALETTE[k]}"></i>${escapeHtml(instrumentName(k,view))}</span><strong class="${view.totalReturns[k]>=0?'positive':'negative'}">${percent(view.totalReturns[k])}</strong><small>${view.start} → ${view.end}</small></div>`).join('')}</div>`:'';
 const corr=view.enough?view.wanted.filter(k=>k!=='gold').map(k=>`<div class="hist-corr">${escapeHtml(instrumentName(k,view))} vs 金价，交集交易日收益 Pearson 相关系数：<strong>${number(view.correlations[k],3)}</strong></div>`).join(''):'';
 const allKeys=['gold','zijinA','zijinH'];
 const counts=allKeys.map(k=>`${instrumentName(k,view)}：${src.series[k]?.length||0}条`).join(' · ');
 container.innerHTML=`<div class="hist-intro"><div><div class="eyebrow">MARKET VISUALIZATION / EOD RESEARCH</div><h2>黄金价格 × 紫金矿业 · 走势图</h2><p>直观看金价变化与紫金 A/H 股价的同步性、强弱差及时间错位。</p></div><span class="hist-state">${src.status==='unconfigured'?'行情源尚未配置':src.status==='imported'?'用户导入':'历史收盘数据 · 非实时'}</span></div>
 ${controls}<div class="panel hist-chart-panel"><div class="hist-chart-top"><div><h3>${instrumentName('gold',view)} vs 紫金矿业</h3><p>${view.enough?view.start+' 至 '+view.end+' · '+view.commonCount+'个共有交易日':'等待足够的真实历史行情'}</p></div><div class="hist-legends">${legend}</div></div>${makeChart(view)}${metrics}<div class="hist-correlations">${corr}</div>
 <div class="hist-source"><div><strong>源：</strong>${escapeHtml(src.provider||'未注明')}${src.updatedAt?' · 更新 '+escapeHtml(src.updatedAt):''} · ${escapeHtml(counts)}</div>
 <div class="hist-dimension">黄金 <b>${instrumentName('gold',view)}（${instrumentUnit('gold',view)}）</b>，A股 <b>人民币/股</b>，H股 <b>港元/股</b>。归一化显示各自相对回报，不剔除汇率波动。</div>
 ${src.status==='unconfigured'?'<div class="hist-warning">⚠ 未配置获授权的历史数据源，网页不会生成虚假的走势图。</div>':''}
 ${src.status==='imported'?'<div class="hist-warning">⚠ 用户CSV并未由服务端核验准确性。</div>':''}</div></div>
 <div class="panel hist-import"><div><h3>导入真实历史数据 / 管理行情源</h3><p>CSV表头：<code>date,gold,zijin_a,zijin_h</code>；缺失价格留空，禁止估算或跨节假日填补。也可设置已有的 Twelve Data 许可，同步服务会自动产生历史行情文件。</p></div><div class="hist-import-buttons"><button class="button" data-hist-template>↓ CSV模板</button><label for="hist-file" class="button primary">↑ 导入行情CSV</label><input type="file" accept=".csv,text/csv" id="hist-file" hidden>${importedHistory?'<button class="button" data-hist-clear>清除手动导入</button>':''}</div></div>
 <p class="hist-disclaimer">采用<strong>不复权收盘价</strong>（不含分红再投资），按相同日历日期交集计算同期涨幅与 Pearson 相关系数；不跨日插值。黄金以美元计价，A/H股票受人民币/港元汇率影响。相关系数不代表因果关系或未来收益。</p>`;
 bindHover(container,view);
}

export async function mountHistoryPanel(container){
 if(!container)return;
 container.innerHTML='<div class="panel hist-loading">加载历史行情...</div>';
 if(!marketHistory){
  try{const response=await fetch(new URL('../data/market-history.json',import.meta.url),{cache:'no-store'});if(!response.ok)throw Error('HTTP '+response.status);marketHistory=normalizeHistory(await response.json());}
  catch(error){marketHistory=normalizeHistory({schemaVersion:1,status:'unconfigured',provider:'未读取到公开历史数据',notes:String(error),series:{}});}
 }
 try{const local=localStorage.getItem('ore-history-import-v1');if(local)importedHistory=normalizeHistory(JSON.parse(local));}
 catch{importedHistory=null;}
 if(!container.isConnected)return;
 repaintHistory(container);
 container.addEventListener('click',event=>{
  const el=event.target.closest('button');if(!el)return;
  if(el.dataset.histStock){selectedStock=el.dataset.histStock;if(selectedStock==='both')selectedMode='indexed';repaintHistory(container);}
  else if(el.dataset.histPeriod){selectedPeriod=el.dataset.histPeriod;repaintHistory(container);}
  else if(el.dataset.histMode){selectedMode=el.dataset.histMode;if(selectedMode==='dual'&&selectedStock==='both')selectedStock='zijinA';repaintHistory(container);}
  else if(el.hasAttribute('data-hist-template'))downloadHistoryText('mining-gold-zijin-template.csv','date,gold,zijin_a,zijin_h\n');
  else if(el.hasAttribute('data-hist-clear')){importedHistory=null;try{localStorage.removeItem('ore-history-import-v1')}catch{}repaintHistory(container);}
 });
 container.addEventListener('change',async event=>{
  if(event.target.id!=='hist-file')return;
  const file=event.target.files?.[0];if(!file)return;
  if(file.size>1500000){window.alert('CSV不得超过1.5MB');return;}
  try{
   importedHistory=historyFromCsv(await file.text());
   try{localStorage.setItem('ore-history-import-v1',JSON.stringify(importedHistory))}catch{}
   repaintHistory(container);
  }catch(error){window.alert('数据导入失败：'+error.message);}
 });
}
