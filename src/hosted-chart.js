/**
 * Direct-browser historical trends (no republished quote files).
 * Eastmoney historical K-line is an unofficial upstream endpoint; it can fail or
 * change without warning. We keep clearly attributed, non-redistributed prices
 * in this visitor's browser only. NO THIRD-PARTY IFRAMES are loaded here.
 */
import {compareHistory,normalizeHistory} from './history-data.js';

export const PUBLIC_CHART_SYMBOLS=Object.freeze({
 gold:'122.XAU',goldBackup:'118.AU9999',
 zijinA:'1.601899',zijinH:'116.02899'
});
export const MARKET_SOURCE='https://push2his.eastmoney.com/api/qt/stock/kline/get';
export const DIRECT_LINKS=Object.freeze({
 gold:'https://quote.eastmoney.com/q/122.XAU.html',
 goldBackup:'https://quote.eastmoney.com/q/118.AU9999.html',
 zijinA:'https://quote.eastmoney.com/sh601899.html',
 zijinH:'https://quote.eastmoney.com/q/116.02899.html'
});
export const RESEARCH_PERIODS=['1m','3m','6m','1y','all'];
const LABEL={gold:'黄金',zijinA:'紫金矿业 A',zijinH:'紫金矿业 H'};
const PALETTE={gold:'#c29542',zijinA:'#397bb8',zijinH:'#158c82'};
let nextRequest=0;
function fmt(n,d=2){return Number.isFinite(n)?n.toLocaleString('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';}
function percent(n){return Number.isFinite(n)?(n>0?'+':'')+fmt(n*100,2)+'%':'—';}
function nameGold(history){return history.goldInstrument==='SGE Au99.99'?'上海黄金 Au99.99':'国际现货金 XAU/USD';}
function goldUnit(history){return history.goldUnit||'USD/oz';}
function friendly(e){return String(e?.message||e).slice(0,220);}

/** Validates exact market identity and returns chronological unadjusted daily close. */
export function parseEastmoneyHistory(payload,secid){
 const code=String(secid).split('.').slice(1).join('.').toUpperCase();
 const data=payload?.data;
 if(payload?.rc!==0||!data||!Array.isArray(data.klines))throw Error(secid+' 没有返回有效的日线数据');
 if(String(data.code||'').toUpperCase()!==code)throw Error('行情标的校验失败 '+secid);
 if(data.klines.length<2)throw Error(secid+' 返回的日线不足');
 const prices=new Map();
 for(const text of data.klines){
  if(typeof text!=='string')throw Error('行情行格式无效');
  const parts=text.split(','),date=parts[0],close=Number(parts[2]);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T00:00:00Z'))||!(close>0)||!Number.isFinite(close))throw Error('价格或日期格式异常');
  if(prices.has(date))throw Error('同一交易日重复：'+date);
  prices.set(date,close);
 }
 return [...prices.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,close])=>({date,close}));
}

/** Same-origin CORS first. Fall back to documented JSONP callback for browsers
 *  where the upstream chooses not to return CORS headers. API may still block.
 *  Loads only from a fixed HTTPS allowlisted origin and uses non-secret data.
 */
export function fetchKlines(secid,{timeoutMs=8500}={}){
 if(!Object.values(PUBLIC_CHART_SYMBOLS).includes(secid))return Promise.reject(Error('不支持的行情代码'));
 return new Promise((resolve,reject)=>{
  const id=++nextRequest;
  const callback='__oreEodJsonp_'+id+'_'+Math.random().toString(36).slice(2);
  const url=new URL(MARKET_SOURCE);
  for(const [key,val] of Object.entries({
   secid,klt:'101',fqt:'0',beg:'20230101',end:'20500101',lmt:'800',
   fields1:'f1,f2,f3,f4,f5,f6',fields2:'f51,f52,f53,f54,f55,f56',
   ut:'fa5fd1943c7b386f172d6893dbfba10b',cb:callback
  }))url.searchParams.set(key,val);
  const script=document.createElement('script');
  let timer,finished=false;
  function finish(error,value){
   if(finished)return;finished=true;
   clearTimeout(timer);script.remove();
   try{delete window[callback]}catch{window[callback]=undefined;}
   error?reject(error):resolve(value);
  }
  window[callback]=response=>{
   try{finish(null,parseEastmoneyHistory(response,secid))}
   catch(e){finish(e);}
  };
  script.src=url.toString();script.async=true;
  script.onerror=()=>finish(Error('行情源网络请求失败（浏览器或网络可能拦截）'));
  timer=setTimeout(()=>finish(Error('行情源响应超时')),timeoutMs);
  document.head.appendChild(script);
 });
}

export async function loadDirectHistory(fetcher=fetchKlines){
 const calls=await Promise.allSettled([
  fetcher(PUBLIC_CHART_SYMBOLS.gold),
  fetcher(PUBLIC_CHART_SYMBOLS.zijinA),
  fetcher(PUBLIC_CHART_SYMBOLS.zijinH)
 ]);
 const quotes={gold:calls[0],zijinA:calls[1],zijinH:calls[2]};
 let instrument='XAU/USD',unit='USD/oz';
 const warnings=[];
 if(calls[0].status==='rejected'){
  warnings.push('国际现货金：'+friendly(calls[0].reason));
  try{
   quotes.gold={status:'fulfilled',value:await fetcher(PUBLIC_CHART_SYMBOLS.goldBackup)};
   instrument='SGE Au99.99';unit='CNY/g';
  }catch(e){warnings.push('上海黄金：'+friendly(e));}
 }
 const series={};
 for(const key of ['gold','zijinA','zijinH']){
  const q=quotes[key];
  series[key]=q?.status==='fulfilled'?q.value.map(p=>[p.date,p.close]):[];
  if(key!=='gold'&&q.status==='rejected')warnings.push(LABEL[key]+'：'+friendly(q.reason));
 }
 return {
  history:normalizeHistory({
   schemaVersion:1,updatedAt:new Date().toISOString().slice(0,10),
   provider:'东方财富网页日线接口（由本机浏览器请求，非官方开放API）',
   status:'browser-eod',goldInstrument:instrument,goldUnit:unit,
   notes:'价格取不复权日线收盘，仅供研究；无行情再分发、无跨日填值。',
   series
  }),warnings
 };
}
function displayRows(state,chart){
 const periods=RESEARCH_PERIODS.map(p=>\`<button class="hist-toggle \${state.period===p?'active':''}" data-online-range="\${p}">\${p==='all'?'全部':p.toUpperCase()}</button>\`).join('');
 return \`<div class="hist-control"><label>价格比较区间</label><div class="hist-togglebar">\${periods}</div></div>
 <div class="hist-chart-top"><div><h3>\${nameGold(state.history)}与紫金矿业走势图</h3><p>黄金：\${goldUnit(state.history)} · A股：人民币 · H股：港币</p></div></div>\${chart}\`;
}
export function mountPublicMarketCharts(container,renderChart){
 if(!container)return;
 let state={history:null,period:'6m',warnings:[],loading:true};
 const chartLink=\`<div class="hist-source" style="margin-top:16px">
 <b>数据源说明：</b>本功能直接由你的浏览器请求东方财富历史日线，不把价格文件存到公开 GitHub 仓库。免费网页接口可能被限流或调整，不能保证全天可用。黄金优先使用国际 XAU/USD；失败时改用上金所 Au99.99（人民币/克），并明确标注。以上均为未经复权处理的历史收盘价；相关性和相对涨幅不消除汇率影响。
 <div style="margin-top:7px"><a class="inline-link" href="\${DIRECT_LINKS.zijinA}" target="_blank" rel="noopener noreferrer">在东方财富查看紫金A股 ↗</a>　<a class="inline-link" href="\${DIRECT_LINKS.zijinH}" target="_blank" rel="noopener noreferrer">查看紫金H股 ↗</a>　<a class="inline-link" href="\${DIRECT_LINKS.goldBackup}" target="_blank" rel="noopener noreferrer">查看上金所黄金 ↗</a></div>
 </div>\`;
 function show(){
  if(!container.isConnected)return;
  const header=\`<div class="hist-intro"><div><div class="eyebrow">BROWSER PRICE HISTORY / NO IFRAME</div><h2>黄金价格 × 紫金矿业 · 走势图</h2><p>由本站的原生 SVG 绘制，不再依赖 TradingView 第三方嵌入框。</p></div><span class="hist-state">\${state.loading?'加载行情中':'第三方网页数据 · 非实时'}</span></div>\`;
  if(state.loading){
   container.innerHTML=header+\`<div class="panel hist-chart-panel"><div class="hist-empty"><div class="hist-empty-icon">⌁</div><b>正在获取真实历史收盘价</b><p>尝试国际现货黄金与紫金A/H，如网络无法访问将明确显示原因；不会绘制虚假曲线。</p></div></div>\`;
   return;
  }
  let warning=state.warnings.map(x=>\`<div class="hist-warning">⚠ \${x.replaceAll('<','&lt;')}</div>\`).join('');
  const periods=RESEARCH_PERIODS.map(p=>\`<button class="hist-toggle \${state.period===p?'active':''}" data-online-range="\${p}">\${p==='all'?'全部':p.toUpperCase()}</button>\`).join('');
  const content=['zijinA','zijinH'].map(key=>{
   let result=compareHistory(state.history,{stock:key,period:state.period,mode:'indexed'});
   const headline=key==='zijinA'?'紫金矿业 A 股 · 601899.SH':'紫金矿业 H 股 · 02899.HK';
   const usable=result.enough;
   return \`<section class="panel hosted-card">
     <div class="hosted-card-head"><div><h3>\${nameGold(state.history)} vs \${headline}</h3>
     <p>\${usable?result.start+' → '+result.end+' · '+result.commonCount+'个共同交易日':'暂时没有足够的共同历史行情'} · 两条曲线起点均为100</p></div>
     </div>
     \${usable?renderChart(result):\`<div class="hist-empty" style="min-height:245px"><b>该组合暂无可绘制的实际历史行情</b><p>\${result.reason||'请稍后重试或从下方导入已保存的CSV/JSON。'}</p></div>\`}
     \${usable?\`<div class="hist-stats" style="grid-template-columns:repeat(2,minmax(0,1fr))">
     \${['gold',key].map(x=>\`<div class="hist-stat"><span class="hist-stat-title"><i style="background:\${PALETTE[x]}"></i>\${x==='gold'?nameGold(state.history):LABEL[x]}</span><strong class="\${result.totalReturns[x]>=0?'positive':'negative'}">\${percent(result.totalReturns[x])}</strong><small>相同日历日期比较；不含股息及汇率中性化</small></div>\`).join('')}
     </div>\`:''}
   </section>\`;
  }).join('');
  container.innerHTML=header+\`<div class="panel hist-toolbar"><div class="hist-control"><label>选择时间区间</label><div class="hist-togglebar">\${periods}</div></div><button class="button" data-reload-ore-prices>↻ 重新加载行情</button></div><div class="hosted-grid">\${content}</div>\${warning?'<div class="panel hist-source">'+warning+'</div>':''}\${chartLink}\`;
 }
 async function load(){
  state.loading=true;show();
  try{
   const x=await loadDirectHistory();
   state.history=x.history;state.warnings=x.warnings;state.loading=false;
  }catch(e){
   state.history=normalizeHistory({schemaVersion:1,series:{},provider:'行情源访问失败',status:'unconfigured'});
   state.warnings=[friendly(e)];state.loading=false;
  }
  show();
 }
 container.addEventListener('click',e=>{
  const range=e.target.closest('[data-online-range]');
  if(range){state.period=range.dataset.onlineRange;show();return;}
  if(e.target.closest('[data-reload-ore-prices]'))load();
 });
 load();
}
