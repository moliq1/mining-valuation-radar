/** Market data reconciliation. No market quotes are invented or backfilled from model assumptions. */
const MIC_BY_SUFFIX={SH:'XSHG',SZ:'XSHE',HK:'XHKG'};
const CURRENCY_BY_SUFFIX={SH:'CNY',SZ:'CNY',HK:'HKD'};
const MAX_AGE_DAYS=9;
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'));
export function marketSymbol(ticker){
  const m=/^(\d{5}|\d{6})\.(SH|SZ|HK)$/.exec(ticker);
  if(!m)throw Error('Unsupported market symbol: '+ticker);
  return {symbol:m[1].replace(/^0+(?=\d)/,''),mic_code:MIC_BY_SUFFIX[m[2]],currency:CURRENCY_BY_SUFFIX[m[2]]};
}
/** Strict EOD time-series parser (Twelve Data schema). Incomplete 5-day histories never trigger signals. */
export function parseHistory(payload,{mic_code,currency,now=new Date()}={}){
  if(payload?.status==='error'||payload?.code>=400)throw Error('Provider error: '+(payload.message||payload.code));
  if(!Array.isArray(payload?.values)||!payload.values.length)throw Error('Missing EOD daily bars');
  if(mic_code&&payload.meta?.mic_code&&payload.meta.mic_code!==mic_code)throw Error('Exchange mismatch: '+payload.meta.mic_code+' != '+mic_code);
  if(currency&&payload.meta?.currency&&payload.meta.currency.toUpperCase()!==currency)throw Error('Currency mismatch: '+payload.meta.currency+' != '+currency);
  const bars=payload.values.map(v=>({date:String(v.datetime||'').slice(0,10),price:Number(v.close)})).sort((a,b)=>b.date.localeCompare(a.date));
  for(const b of bars)if(!validDate(b.date)||!Number.isFinite(b.price)||b.price<=0)throw Error('Invalid date or price in provider EOD');
  for(let j=1;j<bars.length;j++)if(bars[j-1].date===bars[j].date)throw Error('Duplicated provider market day');
  const first=bars[0];
  const age=(Date.parse(now.toISOString().slice(0,10)+'T00:00:00Z')-Date.parse(first.date+'T00:00:00Z'))/86400000;
  if(age<0||age>MAX_AGE_DAYS)throw Error('Stale or future EOD date: '+first.date);
  let previous5d=bars.length>=6?bars[5].price:null;
  if(previous5d!==null&&Math.abs(first.price/previous5d-1)>0.45)throw Error('Price moved >45% over 5 sessions; verify splits or abnormal data');
  return {date:first.date,price:first.price,previous5d};
}
export function applyMarketData(snapshot,quotes,{provider='Twelve Data',checkedAt=new Date().toISOString()}={}){
  const s=structuredClone(snapshot);
  const report={updated:[],failed:[],unchanged:[],provider,checkedAt};
  let maxDate=s.updatedAt;
  for(const stock of s.stocks){
    const q=quotes[stock.ticker];
    if(!q){report.failed.push(stock.ticker+': no provider quote');continue;}
    const req=marketSymbol(stock.ticker);
    try {
      const p=parseHistory(q,{mic_code:req.mic_code,currency:req.currency,now:new Date(checkedAt)});
      if(p.date<stock.asOf){report.unchanged.push(stock.ticker+': older');continue;}
      if(p.date===stock.asOf && Math.abs(p.price/stock.price-1)>0.07)throw Error('Same-date price differs by >7% from snapshot');
      stock.price=p.price;
      stock.asOf=p.date;
      stock.previous5d=p.previous5d;
      stock.quoteSource={provider,kind:'EOD',exchange:req.mic_code,verifiedAt:checkedAt,asOf:p.date};
      report.updated.push(stock.ticker);
      if(p.date>maxDate)maxDate=p.date;
    }catch(e){report.failed.push(stock.ticker+': '+e.message);}
  }
  for(const [key,feedKey] of [['gold','XAU/USD'],['silver','XAG/USD'],['copper','COPPER']]){
    s.market.metal5d[key]=null; // Fail closed: old five-day changes cannot be carried forward
    const p=quotes[feedKey];
    if(!p)continue;
    try {
      const parsed=parseHistory(p,{now:new Date(checkedAt)});
      if(parsed.previous5d===null)throw Error('Need at least six daily bars for five-session return');
      s.market.metal5d[key]=parsed.price/parsed.previous5d-1;
      s.market[key+'Spot']=parsed.price;
    }catch(e){report.failed.push(feedKey+': '+e.message);}
  }
  for(const [field,feedKey] of [['usdCny','USD/CNY'],['hkdCny','HKD/CNY']]){
    const p=quotes[feedKey];if(!p)continue;
    try{const parsed=parseHistory(p,{now:new Date(checkedAt)});if(parsed.price<=0||parsed.price>=15)throw Error('Out-of-range FX');s.market[field]=parsed.price;}
    catch(e){report.failed.push(feedKey+': '+e.message);}
  }
  // Never automatically certify company filings, operating risks, cash flow or audit quality.
  s.updatedAt=maxDate;
  s.marketFeed={provider,checkedAt,updatedTickers:report.updated,errors:report.failed,licenseNote:'行情许可与公开分发权限由仓库所有者负责核实；仅供研究，不代表实时报价'};
  return {snapshot:s,report};
}
/** Preserve local model inputs but replace old published market bars with newer published prices. */
export function reconcileSnapshot(remote,local){
  if(!local||local.schemaVersion!==remote.schemaVersion||!local.updatedAt)return remote;
  if(local.updatedAt>=remote.updatedAt)return local;
  const s=structuredClone(remote);
  if(local.market?.scenarios){
    for(const sc of ['bear','base','bull'])for(const metal of ['gold','silver','copper']){
      const p=local.market.scenarios?.[sc]?.[metal];
      if(typeof p==='number'&&Number.isFinite(p)&&p>0)s.market.scenarios[sc][metal]=p;
    }
  }
  for(const co of s.companies){
    const old=local.companies.find(c=>c.id===co.id);
    if(!old)continue;
    for(const field of ['sustain','growth'])if(typeof old[field]==='number'&&Number.isFinite(old[field]))co[field]=old[field];
    for(const sc of ['bear','base','bull'])if(typeof old.pe?.[sc]==='number'&&Number.isFinite(old.pe[sc]))co.pe[sc]=old.pe[sc];
  }
  for(const stock of s.stocks){
    const old=local.stocks.find(x=>x.ticker===stock.ticker);
    if(!old)continue;
    // Do not carry outdated verification to later price dates; real operating risk must be re-evaluated.
    if(old.asOf===stock.asOf){
      if(old.event==='material')stock.event='material';
      // Do not automatically preserve "none"/"pass"/"complete" upon new feed.
    }
  }
  return s;
}
