import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {marketSymbol,parseHistory,applyMarketData,reconcileSnapshot} from '../src/market-sync.js';
import {stockStatus,validateSnapshot} from '../src/model.js';
const base=JSON.parse(readFileSync(new URL('../data/snapshot.json',import.meta.url),'utf8'));
const now=new Date('2026-10-11T10:00:00Z');
function fixture(mic_code='XHKG',currency='HKD'){
 const values=Array.from({length:10},(_,i)=>({datetime:'2026-10-'+String(10-i).padStart(2,'0'),close:String(20+i)}));
 return {meta:{mic_code,currency},values};
}
test('ticker maps to proper exchange and currency',()=>{
 assert.deepEqual(marketSymbol('02899.HK'),{symbol:'2899',mic_code:'XHKG',currency:'HKD'});
 assert.equal(marketSymbol('601899.SH').mic_code,'XSHG');
 assert.equal(marketSymbol('000426.SZ').mic_code,'XSHE');
});
test('parser enforces matching exchange, currency and non-future date',()=>{
 const payload=fixture();
 assert.equal(parseHistory(payload,{mic_code:'XHKG',currency:'HKD',now}).date,'2026-10-10');
 assert.throws(()=>parseHistory(payload,{mic_code:'XSHG',currency:'HKD',now}),/Exchange mismatch/);
 assert.throws(()=>parseHistory(payload,{mic_code:'XHKG',currency:'CNY',now}),/Currency mismatch/);
});
test('five-session baseline uses 6th most recent daily bar',()=>{
 const p=parseHistory(fixture(),{mic_code:'XHKG',currency:'HKD',now});
 assert.equal(p.price,20);assert.equal(p.previous5d,25);
});
test('missing quote does not fabricate a newer share price',()=>{
 const orig=base.stocks[0];
 const {snapshot:out,report}=applyMarketData(base,{}, {checkedAt:'2026-10-11T10:00:00Z'});
 assert.equal(out.stocks[0].price,orig.price);
 assert.equal(out.stocks[0].asOf,orig.asOf);
 assert.ok(report.failed.length>=base.stocks.length);
});
test('valid quote updates price and never auto-verifies events',()=>{
 const source=structuredClone(base);
 const q={'02899.HK':fixture()};
 const {snapshot:out,report}=applyMarketData(source,q,{checkedAt:'2026-10-11T10:00:00Z'});
 const h=out.stocks.find(s=>s.ticker==='02899.HK');
 assert.equal(h.price,20);assert.equal(h.previous5d,25);assert.equal(h.asOf,'2026-10-10');
 assert.equal(h.event,'unknown');assert.equal(h.cashflow,'pending');assert.equal(h.quality,'pending');
 assert.equal(report.updated.length,1);assert.equal(validateSnapshot(out),true);
});
test('local scenarios survive refresh; old prices and verification do not',()=>{
 const local=structuredClone(base);
 local.market.scenarios.base.gold=5111;
 const target=local.stocks.find(s=>s.ticker==='02899.HK');target.event='none';target.quality='complete';target.cashflow='pass';
 const remote=structuredClone(base);remote.updatedAt='2026-10-11';
 const fresh=remote.stocks.find(s=>s.ticker==='02899.HK');fresh.price=29;fresh.asOf='2026-10-11';
 const reconciled=reconcileSnapshot(remote,local);
 assert.equal(reconciled.market.scenarios.base.gold,5111);
 assert.equal(reconciled.stocks.find(s=>s.ticker==='02899.HK').price,29);
 assert.equal(reconciled.stocks.find(s=>s.ticker==='02899.HK').event,'unknown');
});
test('provider-error response rejected, missing metal changes remain null',()=>{
 const p=fixture();p.status='error';p.message='quota exceeded';
 assert.throws(()=>parseHistory(p,{now}),/Provider error/);
 const {snapshot}=applyMarketData(base,{'XAU/USD':p},{checkedAt:'2026-10-11T10:00:00Z'});
 assert.equal(snapshot.market.metal5d.gold,null);
});

test('stale stock date blocks otherwise-qualified undervaluation',()=>{
  const s=structuredClone(base);
  const c=s.companies.find(x=>x.id==='shandong');
  const st=s.stocks.find(x=>x.ticker==='01787.HK');
  st.price=10;st.previous5d=11.5;st.event='none';st.cashflow='pass';st.quality='complete';
  st.asOf='2020-01-01';s.market.metal5d.gold=0;
  const result=stockStatus(st,c,s.market);
  assert.equal(result.code,'stale');
});

test('moving to a new EOD date invalidates stale operating-risk checks',()=>{
 const s=structuredClone(base),target=s.stocks.find(x=>x.ticker==='02899.HK');
 target.event='none';target.cashflow='pass';target.quality='complete';
 const {snapshot}=applyMarketData(s,{'02899.HK':fixture()},{checkedAt:'2026-10-11T10:00:00Z'});
 const updated=snapshot.stocks.find(x=>x.ticker==='02899.HK');
 assert.equal(updated.asOf,'2026-10-10');
 assert.equal(updated.event,'unknown');
 assert.equal(updated.cashflow,'pending');
 assert.equal(updated.quality,'pending');
});
