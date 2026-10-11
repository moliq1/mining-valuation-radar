/** Pure finance functions. All amounts and assumptions are explicitly modelled. */
export const OUNCES_PER_TONNE = 32150.7466;
export const CASES = ['bear','base','bull'];
export const CASE_LABEL = {bear:'悲观',base:'基准',bull:'乐观'};
export const METAL_LABEL = {gold:'黄金',silver:'白银',copper:'铜'};

export function finite(v) {return typeof v === 'number' && Number.isFinite(v);}
export function companyValue(company, market, scenario='base') {
  const metals=market.scenarios[scenario];
  const profitRmb=company.profitH1 * (company.profitCurrency === 'USD' ? market.usdCny : 1);
  const normalized=profitRmb * 2 * company.sustain * (1 + company.growth);
  const impacts={};
  for(const metal of ['gold','silver','copper']) {
    const units=(company.volumesH1[metal]||0)*2;
    const perUnit=metal === 'copper' ? 1 : OUNCES_PER_TONNE;
    impacts[metal] = (metals[metal] - company.refs[metal]) * units * perUnit * market.usdCny * (company.retention[metal]||0) / 1e8;
  }
  const annualProfitYi=normalized + impacts.gold+impacts.silver+impacts.copper;
  const epsRmb=company.sharesYi>0 ? annualProfitYi/company.sharesYi : 0;
  const pe=company.pe[scenario];
  const fairCny=epsRmb > 0 ? epsRmb * pe : 0;
  const fairHkd=market.hkdCny>0 ? fairCny / market.hkdCny : 0;
  return {normalized,impacts,annualProfitYi,epsRmb,pe,fairCny,fairHkd};
}
export function stockMetrics(stock, company, market) {
  const values=Object.fromEntries(CASES.map(c=>[c,companyValue(company,market,c)]));
  const currency=stock.board === 'H'?'HKD':'CNY';
  const localFair=c=>stock.board==='H'?values[c].fairHkd:values[c].fairCny;
  const bear=localFair('bear'),base=localFair('base'),bull=localFair('bull');
  const margin=base>0?1-stock.price/base:null;
  const potential=stock.price>0?base/stock.price-1:null;
  const downside=stock.price>0?bear/stock.price-1:null;
  const change5d=finite(stock.previous5d)&&stock.previous5d>0?stock.price/stock.previous5d-1:null;
  return {currency,bear,base,bull,margin,potential,downside,change5d,values};
}
export function stockStatus(stock, company, market) {
  const m=stockMetrics(stock,company,market);
  const metalChange=market.metal5d[company.primaryMetal];
  const lowConf = company.confidence === '低';
  const asOfMillis=Date.parse(stock.asOf+'T00:00:00Z');
  const age=Number.isFinite(asOfMillis)?(Date.now()-asOfMillis)/86400000:Infinity;
  const fresh=age>=-1&&age<=10;
  const verified=fresh && stock.event==='none' && stock.cashflow==='pass' && stock.quality==='complete' && !lowConf;
  if(!(m.base>0)) return {code:'unpriced',text:'无法估值',tone:'neutral'};
  if(m.margin>=0.25 && finite(m.change5d) && finite(metalChange) && m.change5d<=-0.08 && metalChange>=-0.03 && verified)
    return {code:'watch',text:'疑似情绪错杀',tone:'positive'};
  if(stock.event==='material'||stock.cashflow==='fail') return {code:'risk',text:'基本面风险待重估',tone:'negative'};
  if(m.margin>=0.25) return {code:'discount',text:'折价待核验',tone:'gold'};
  if(m.margin>=0.10) return {code:'observe',text:'继续观察',tone:'blue'};
  return {code:'normal',text:'安全边际不足',tone:'neutral'};
}
export function ahPairs(snapshot) {
  const out=[];
  for(const c of snapshot.companies) {
    const a=snapshot.stocks.find(s=>s.companyId===c.id && s.board==='A');
    const h=snapshot.stocks.find(s=>s.companyId===c.id && s.board==='H');
    if(!a||!h) continue;
    const hInCny=h.price*snapshot.market.hkdCny;
    out.push({company:c,a,h,hInCny,premium:hInCny>0?a.price/hInCny-1:null,sameDate:a.asOf===h.asOf});
  }
  return out;
}
export function validateSnapshot(s) {
  if(!s || s.schemaVersion!==1 || !s.market || !Array.isArray(s.stocks) || !Array.isArray(s.companies)) throw Error('数据格式不符合 schemaVersion=1');
  if(!finite(s.market.usdCny)||s.market.usdCny<=0||!finite(s.market.hkdCny)||s.market.hkdCny<=0) throw Error('汇率必须为正数');
  for(const kind of CASES) for(const metal of ['gold','silver','copper']) if(!finite(s.market.scenarios?.[kind]?.[metal])||s.market.scenarios[kind][metal]<=0) throw Error('商品价格必须为正数');
  const ids=new Set();
  for(const c of s.companies){if(!c.id||ids.has(c.id)||!finite(c.sharesYi)||c.sharesYi<=0||!finite(c.profitH1))throw Error('公司数据有缺失或重复');ids.add(c.id);
    for(const key of ['gold','silver','copper']) if(!finite(c.volumesH1?.[key])||!finite(c.refs?.[key])||!finite(c.retention?.[key])) throw Error('金属产销量或敏感度缺失');
    if(!CASES.every(sc=>finite(c.pe?.[sc])))throw Error('估值倍数缺失');
  }
  const tickers=new Set();for(const s0 of s.stocks){if(!ids.has(s0.companyId)||!s0.ticker||tickers.has(s0.ticker)||!['A','H'].includes(s0.board)||!finite(s0.price)||s0.price<=0)throw Error('股票代码/价格无效');tickers.add(s0.ticker);}
  return true;
}
