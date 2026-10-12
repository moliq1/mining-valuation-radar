/**
 * Historical price comparison calculations. All source prices are unadjusted EOD.
 * Missing market days are never forward-filled, and returns are aligned by date.
 */
export const HISTORY_KEYS = ['gold','zijinA','zijinH'];
export const HISTORY_NAMES = {gold:'黄金 XAU/USD',zijinA:'紫金矿业 A · 601899.SH',zijinH:'紫金矿业 H · 02899.HK'};
export const HISTORY_UNITS = {gold:'USD/oz',zijinA:'CNY',zijinH:'HKD'};
const ISO=/^\d{4}-\d{2}-\d{2}$/;
const acceptableDate=(date)=>ISO.test(date)&&!Number.isNaN(Date.parse(date+'T00:00:00Z'))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;
export function normalizeHistory(raw){
 if(!raw||typeof raw!=='object'||raw.schemaVersion!==1)throw Error('历史数据需要 schemaVersion=1');
 const out={schemaVersion:1,updatedAt:raw.updatedAt||null,provider:String(raw.provider||'未注明'),status:raw.status||'unknown',notes:String(raw.notes||''),goldInstrument:String(raw.goldInstrument||'XAU/USD'),goldUnit:String(raw.goldUnit||'USD/oz'),series:{}};
 for(const key of HISTORY_KEYS){
  const input=raw.series?.[key];
  if(input===undefined||input===null){out.series[key]=[];continue;}
  if(!Array.isArray(input))throw Error(key+' 序列格式错误');
  if(input.length>3000)throw Error('历史数据超出3000条');
  const seen=new Set();
  out.series[key]=input.map(p=>{
   const date=Array.isArray(p)?p[0]:p?.date;
   const rawPrice=Array.isArray(p)?p[1]:p?.close;
   const close=typeof rawPrice==='number'?rawPrice: (typeof rawPrice==='string'&&rawPrice.trim()!==''?Number(rawPrice):NaN);
   if(!acceptableDate(date)||!Number.isFinite(close)||close<=0)throw Error(key+' 包含无效的交易日或收盘价');
   if(seen.has(date))throw Error(key+' 包含重复日期 '+date);
   seen.add(date);
   return {date,close};
  }).sort((a,b)=>a.date.localeCompare(b.date));
 }
 return out;
}
export function compareHistory(history,{stock='zijinA',period='6m',mode='indexed',now=null}={}){
 const h=normalizeHistory(history);
 if(!['zijinA','zijinH','both'].includes(stock))throw Error('未知股票');
 if(!['indexed','dual'].includes(mode))throw Error('未知图表模式');
 if(!['1m','3m','6m','1y','all'].includes(period))throw Error('未知时间区间');
 if(stock==='both'&&mode==='dual')throw Error('两只不同币种股票不能共用一条右轴，请选涨幅对比');
 const wanted=stock==='both'?['gold','zijinA','zijinH']:['gold',stock];
 const latestDates=wanted.map(k=>h.series[k].at(-1)?.date).filter(Boolean);
 const latest=latestDates.sort().at(-1);
 let threshold=null;
 if(latest&&period!=='all'){
  // Calendar-month windows anchored to latest available observation, not today's date.
  const months={'1m':1,'3m':3,'6m':6,'1y':12}[period];
  const date=new Date(latest+'T00:00:00Z');
  const year=date.getUTCFullYear(),month=date.getUTCMonth(),day=date.getUTCDate();
  const targetFirst=new Date(Date.UTC(year,month-months,1));
  const lastDay=new Date(Date.UTC(targetFirst.getUTCFullYear(),targetFirst.getUTCMonth()+1,0)).getUTCDate();
  threshold=new Date(Date.UTC(targetFirst.getUTCFullYear(),targetFirst.getUTCMonth(),Math.min(day,lastDay))).toISOString().slice(0,10);
 }
 const sample=Object.fromEntries(wanted.map(k=>[k,h.series[k].filter(p=>!threshold||p.date>=threshold)]));
 const shared=new Set(sample[wanted[0]].map(p=>p.date));
 for(const k of wanted.slice(1)){
  const dates=new Set(sample[k].map(p=>p.date));
  for(const d of shared)if(!dates.has(d))shared.delete(d);
 }
 const commonDates=[...shared].sort();
 if(commonDates.length<2)return {enough:false,wanted,series:sample,commonDates,threshold,latest,mode,stock,period,goldInstrument:h.goldInstrument,goldUnit:h.goldUnit,reason:'至少需要两个黄金与股票共同交易日才能比较。'};
 const start=commonDates[0],end=commonDates.at(-1);
 const overlap=Object.fromEntries(wanted.map(k=>[k,new Map(sample[k].map(p=>[p.date,p.close]))]));
 const common=commonDates.map(date=>({date,...Object.fromEntries(wanted.map(k=>[k,overlap[k].get(date)]))}));
 const baseline=Object.fromEntries(wanted.map(k=>[k,0])); // deliberately initialized below
 for(const k of wanted)baseline[k]=overlap[k].get(start);
 const chartSeries=Object.fromEntries(wanted.map(k=>[k, sample[k].filter(p=>p.date>=start&&p.date<=end).map(p=>({date:p.date,close:p.close,value:mode==='indexed'?p.close/baseline[k]*100:p.close}))]));
 const totalReturns=Object.fromEntries(wanted.map(k=>[k,common.at(-1)[k]/baseline[k]-1]));
 const correlations={};
 for(const k of wanted.filter(k=>k!=='gold'))correlations[k]=pearsonReturns(common.map(p=>({gold:p.gold,stock:p[k]})));
 return {enough:true,commonDates,commonCount:commonDates.length,wanted,series:chartSeries,baseline,totalReturns,correlations,threshold,start,end,latest,mode,stock,period,goldInstrument:h.goldInstrument,goldUnit:h.goldUnit,provider:h.provider,status:h.status,updatedAt:h.updatedAt};
}
export function pearsonReturns(data){
 const a=[],b=[];
 for(let i=1;i<data.length;i++){
  const prev=data[i-1],curr=data[i];
  if(!prev||!curr||prev.gold<=0||prev.stock<=0||curr.gold<=0||curr.stock<=0)continue;
  const ga=Math.log(curr.gold/prev.gold),st=Math.log(curr.stock/prev.stock);
  if(Number.isFinite(ga)&&Number.isFinite(st)){a.push(ga);b.push(st);}
 }
 if(a.length<5)return null;
 const mx=a.reduce((s,v)=>s+v,0)/a.length,my=b.reduce((s,v)=>s+v,0)/b.length;
 let cov=0,vx=0,vy=0;
 for(let i=0;i<a.length;i++){const x=a[i]-mx,y=b[i]-my;cov+=x*y;vx+=x*x;vy+=y*y;}
 return vx>0&&vy>0?Math.max(-1,Math.min(1,cov/Math.sqrt(vx*vy))):null;
}
function parseCsvRecords(text){
 if(typeof text!=='string'||text.length>1500000)throw Error('CSV不得超过1.5MB');
 const rows=[];let row=[],v='',quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(ch==='"'){if(quoted&&text[i+1]==='"'){v+='"';i++;}else quoted=!quoted;}
  else if(ch===','&&!quoted){row.push(v);v='';}
  else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(v);v='';if(row.some(x=>x.trim()!==''))rows.push(row);row=[];}
  else v+=ch;
 }
 if(quoted)throw Error('CSV引号未闭合');
 row.push(v);if(row.some(x=>x.trim()!==''))rows.push(row);
 return rows;
}
/** Import wide CSV, blank values mean missing observations, not zero/forward-filled. */
export function historyFromCsv(csv){
 const rows=parseCsvRecords(csv.trim().replace(/^\uFEFF/,''));
 if(rows.length<3)throw Error('至少需要表头和两个交易日');
 const names=rows[0].map(v=>v.trim().toLowerCase());
 const columns={date:names.indexOf('date'),gold:names.indexOf('gold'),zijinA:names.indexOf('zijin_a'),zijinH:names.indexOf('zijin_h')};
 if(columns.date<0||columns.gold<0||(columns.zijinA<0&&columns.zijinH<0))throw Error('表头必须包含 date,gold,zijin_a,zijin_h（最后两列可选一列）');
 const series={gold:[],zijinA:[],zijinH:[]};
 for(const row of rows.slice(1)){
  const date=row[columns.date]?.trim();
  if(!acceptableDate(date))throw Error('无效日期 '+date);
  for(const key of HISTORY_KEYS){
   const col=columns[key],str=col>=0?row[col]?.trim():'';
   if(!str)continue;
   const close=Number(str);
   if(!Number.isFinite(close)||close<=0)throw Error(date+' 的 '+key+' 收盘价无效');
   series[key].push([date,close]);
  }
 }
 return normalizeHistory({schemaVersion:1,updatedAt:new Date().toISOString().slice(0,10),provider:'用户导入 CSV（来源未经独立核验）',status:'imported',notes:'黄金单位USD/oz；A股为CNY，H股为HKD；日期必须是当地同一日。',series});
}

/** Convert licensed Twelve Data daily API responses into strictly dated daily close series.
 * Do not expose endpoint tokens, estimate gaps, or replace existing series with stale bars.
 */
export function providerHistory(quotes,current,{checkedAt=new Date().toISOString(),minOverlap=10}={}){
 const mapping={gold:['XAU/USD','USD'],zijinA:['601899.SH','CNY'],zijinH:['02899.HK','HKD']};
 const old=normalizeHistory(current);
 const next=structuredClone(old);
 const errors=[];
 const checkDay=checkedAt.slice(0,10);
 for(const [key,[symbol,currency]] of Object.entries(mapping)){
  const payload=quotes[symbol];
  if(key==='gold'&&old.series.gold?.length&&old.goldInstrument!=='XAU/USD'){errors.push('Cannot merge XAU/USD into existing '+old.goldInstrument);continue;}
  if(!payload||payload.status==='error'||!Array.isArray(payload.values)||payload.values.length<minOverlap){errors.push(symbol+': missing/insufficient provider history');continue;}
  if(payload.meta?.currency && payload.meta.currency.toUpperCase()!==currency){errors.push(symbol+': currency mismatch');continue;}
  if(key==='zijinA'&&payload.meta?.mic_code&&payload.meta.mic_code!=='XSHG'){errors.push(symbol+': wrong exchange');continue;}
  if(key==='zijinH'&&payload.meta?.mic_code&&payload.meta.mic_code!=='XHKG'){errors.push(symbol+': wrong exchange');continue;}
  try{
   const rows=payload.values.map(p=>[String(p.datetime||'').slice(0,10),p.close]);
   const normalized=normalizeHistory({schemaVersion:1,status:'licensed-eod',series:{[key]:rows}}).series[key];
   const last=normalized.at(-1)?.date;
   const age=(Date.parse(checkDay+'T00:00:00Z')-Date.parse(last+'T00:00:00Z'))/86400000;
   if(!Number.isFinite(age)||age<0||age>9)throw Error('stale/future '+last);
   if(old.series[key]?.length&&last<old.series[key].at(-1).date)throw Error('provider series is older than published');
   const merged=new Map((old.series[key]||[]).map(p=>[p.date,p.close]));
   for(const bar of normalized)merged.set(bar.date,bar.close);
   next.series[key]=[...merged.entries()].map(([date,close])=>({date,close})).sort((a,b)=>a.date.localeCompare(b.date)).slice(-1000);
  }catch(e){errors.push(symbol+': '+e.message);}
 }
 const aligned=['zijinA','zijinH'].map(k=>compareHistory(next,{stock:k,period:'all'}));
 const usable=aligned.some(c=>c.enough&&c.commonCount>=minOverlap);
 if(!usable)return {updated:false,history:old,errors:[...errors,'No stock has >= '+minOverlap+' valid gold-matched trading dates']};
 const changed=HISTORY_KEYS.some(k=>JSON.stringify(old.series[k])!==JSON.stringify(next.series[k]));
 if(!changed)return {updated:false,history:old,errors};
 if(quotes['XAU/USD']?.values?.length && next.series.gold?.length){next.goldInstrument='XAU/USD';next.goldUnit='USD/oz';}
 next.provider='Twelve Data · licensed daily EOD';
 next.status='licensed-eod';
 next.updatedAt=checkDay;
 next.notes='每日收盘数据，不复权，黄金XAU/USD为美元/盎司；A股人民币，H股港元。仅在确认行情公开展示授权后发布。';
 return {updated:true,history:next,errors};
}
