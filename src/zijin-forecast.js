/** Zijin Mining: H1 2026 realized profit locked, H2 and 2027-28 modeled separately.
 * All yuan earnings are in units of RMB 100 million. Not a mine-by-mine NAV.
 */
export const DEFAULT_FORECAST={
 version:2, h1:{profitYi:380.34770076,goldMinedT:46.702,copperMinedT:534407,goldSoldT:44.18,copperSoldT:459796,goldUsd:4693,copperUsd:13083},
 annual:{
  2026:{goldT:105,copperT:1200000,goldUsd:4200,copperUsd:12500},
  2027:{goldT:120,copperT:1380000,goldUsd:4300,copperUsd:12800},
  2028:{goldT:135,copperT:1550000,goldUsd:4400,copperUsd:13000}
 },
 costGoldUsdOz:1350,costCopperUsdT:4050,retainGold:0.32,retainCopper:0.32,
 sellGoldRatio:44.18/46.702,sellCopperRatio:459796/534407,
 growthOther:0,fcfeFactor:0.65,forwardPe:14,discount:0.12,terminalYear:2028
};
export const PRESETS={
 bear:{gold:[3600,3500,3400],copper:[10500,10000,9500],volume:0.85},
 base:{gold:[4200,4300,4400],copper:[12500,12800,13000],volume:1},
 bull:{gold:[6000,6000,6000],copper:[14500,15000,15500],volume:1}
};
export function validateForecast(p){
 if(!p||p.version!==2||!p.h1||!p.annual)throw Error('三年模型参数版本错误');
 for(const y of [2026,2027,2028])for(const k of ['goldT','copperT','goldUsd','copperUsd'])if(!Number.isFinite(p.annual[y]?.[k])||p.annual[y][k]<=0)throw Error('年度预测数值异常');
 for(const k of ['costGoldUsdOz','costCopperUsdT','retainGold','retainCopper','sellGoldRatio','sellCopperRatio','growthOther','fcfeFactor','forwardPe','discount'])if(!Number.isFinite(p[k]))throw Error('预测参数缺失：'+k);
 if(![2026,2027,2028].includes(p.terminalYear)||p.forwardPe<=0||p.forwardPe>60||p.discount<=0||p.discount>=.5||p.growthOther<=-1||p.growthOther>=1||p.retainGold<0||p.retainGold>1||p.retainCopper<0||p.retainCopper>1||p.fcfeFactor<0||p.fcfeFactor>1.5||p.sellGoldRatio<=0||p.sellGoldRatio>1.2||p.sellCopperRatio<=0||p.sellCopperRatio>1.2)throw Error('参数超出安全边界');
 return true;
}
export function projectForecast(s,p){
 validateForecast(p);
 const co=s.companies.find(x=>x.id==='zijin'),fx=s.market.usdCny,rate=s.market.hkdCny;
 if(!co||!Number.isFinite(fx)||fx<=0||!Number.isFinite(co.sharesYi)||co.sharesYi<=0)throw Error('缺少公司股本或汇率');
 const H=p.h1,oz=32150.7466, shares=co.sharesYi;
 const gold=(q,price)=>q*oz*(price-p.costGoldUsdOz)*fx*p.retainGold/1e8;
 const copper=(q,price)=>q*(price-p.costCopperUsdT)*fx*p.retainCopper/1e8;
 const anchoredGold=gold(H.goldSoldT,H.goldUsd),anchoredCopper=copper(H.copperSoldT,H.copperUsd);
 const otherH1=H.profitYi-anchoredGold-anchoredCopper;
 const rows=[2026,2027,2028].map(year=>{
  const v=p.annual[year],goldSales=v.goldT*p.sellGoldRatio,copperSales=v.copperT*p.sellCopperRatio;
  const goldModeled=year===2026?Math.max(0,goldSales-H.goldSoldT):goldSales;
  const copperModeled=year===2026?Math.max(0,copperSales-H.copperSoldT):copperSales;
  const goldYi=gold(goldModeled,v.goldUsd),copperYi=copper(copperModeled,v.copperUsd);
  const otherYi=otherH1*(year===2026?1+p.growthOther:2*Math.pow(1+p.growthOther,year-2025));
  const realizedH1Yi=year===2026?H.profitYi:0;
  const profitYi=realizedH1Yi+goldYi+copperYi+otherYi, eps=profitYi/shares;
  const fair=eps>0?eps*p.forwardPe:0;
  return {year,goldT:v.goldT,copperT:v.copperT,goldUsd:v.goldUsd,copperUsd:v.copperUsd,goldSales,copperSales,goldModeled,copperModeled,realizedH1Yi,goldYi,copperYi,otherYi,profitYi,eps,fcfeYi:profitYi*p.fcfeFactor,undiscountedPe:fair,presentPe:fair/Math.pow(1+p.discount,year-2026)};
 });
 const row=rows.find(x=>x.year===p.terminalYear);
 const A=s.stocks.find(x=>x.ticker==='601899.SH'),Hstock=s.stocks.find(x=>x.ticker==='02899.HK');
 const fairHkd=rate>0?row.presentPe/rate:null,stockA=A?.price,stockH=Hstock?.price;
 return {rows,selected:row,otherH1,anchoredGold,anchoredCopper,
  stockA,stockH,fairHkd, asOfA:A?.asOf,asOfH:Hstock?.asOf,
  marginA:row.presentPe>0&&Number.isFinite(stockA)?1-stockA/row.presentPe:null,
  marginH:fairHkd>0&&Number.isFinite(stockH)?1-stockH/fairHkd:null,
  fcfeYieldA:Number.isFinite(stockA)&&stockA>0?row.fcfeYi/(stockA*shares):null};
}
export function inverseGold(s,p,targetRmb){
 if(!Number.isFinite(targetRmb)||targetRmb<=0)return null;
 const t=value=>{const copy=JSON.parse(JSON.stringify(p));copy.annual[copy.terminalYear].goldUsd=value;return projectForecast(s,copy).selected.presentPe;};
 let left=500,right=14000;if(targetRmb<t(left)||targetRmb>t(right))return null;
 for(let i=0;i<45;i++){const mid=(left+right)/2;if(t(mid)<targetRmb)left=mid;else right=mid;}
 return (left+right)/2;
}
export function applyPreset(p,name){
 if(!PRESETS[name])throw Error('未知情景');
 const q=JSON.parse(JSON.stringify(p)),preset=PRESETS[name];
 for(let i=0;i<3;i++){const y=2026+i;q.annual[y].goldUsd=preset.gold[i];q.annual[y].copperUsd=preset.copper[i];q.annual[y].goldT=DEFAULT_FORECAST.annual[y].goldT*preset.volume;q.annual[y].copperT=DEFAULT_FORECAST.annual[y].copperT*preset.volume;}
 return q;
}
