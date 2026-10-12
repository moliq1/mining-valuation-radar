import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeHistory,compareHistory,historyFromCsv,providerHistory,pearsonReturns} from '../src/history-data.js';

const dates=Array.from({length:20},(_,i)=>new Date(Date.UTC(2026,8,1+i)).toISOString().slice(0,10));
const fixture=()=>normalizeHistory({
 schemaVersion:1,updatedAt:'2026-09-20',provider:'test fixture only',status:'test',
 series:{gold:dates.map((d,i)=>[d,2000+i*10]),
 zijinA:dates.filter((_,i)=>i!==2).map(d=>[d,20+(dates.indexOf(d)*.5)]),
 zijinH:dates.filter((_,i)=>i!==4).map(d=>[d,23+(dates.indexOf(d)*.3)])}
});
test('validates sorted prices and never fills a missing holiday',()=>{
 const data=fixture();assert.equal(data.series.zijinA.length,19);
 const result=compareHistory(data,{stock:'zijinA',period:'all'});
 assert.equal(result.commonCount,19);
 assert.ok(!result.commonDates.includes(dates[2]));
 assert.equal(result.baseline.gold,2000);
 assert.equal(result.series.gold[0].value,100);
 assert.ok(result.totalReturns.gold>0);
});
test('A/H both mode compares only jointly observed days',()=>{
 const data=fixture();const out=compareHistory(data,{stock:'both',period:'all'});
 assert.equal(out.commonCount,18);
 assert.equal(out.wanted.length,3);
 assert.throws(()=>compareHistory(data,{stock:'both',mode:'dual',period:'all'}),/右轴/);
});
test('one month and three month filters restrict the timeline',()=>{
 const data=fixture();
 const all=compareHistory(data,{stock:'zijinA',period:'all'});
 const one=compareHistory(data,{stock:'zijinA',period:'1m'});
 assert.ok(one.commonCount<=all.commonCount);
});
test('rejects invalid dates, zero prices and duplicates',()=>{
 for(const series of [
  [['2026-09-01',0]],
  [['2026-09-01',10],['2026-09-01',12]],
  [['2026-13-50',12]],
 ]){
  assert.throws(()=>normalizeHistory({schemaVersion:1,series:{gold:series}}));
 }
});
test('CSV handles missing stock dates and refuses invalid schema',()=>{
 const csv='date,gold,zijin_a,zijin_h\n2026-09-01,2000,20,22\n2026-09-02,2010,,22.3\n2026-09-03,2020,20.8,22.6\n';
 const x=historyFromCsv(csv);
 assert.equal(x.series.gold.length,3);
 assert.equal(x.series.zijinA.length,2);
 assert.equal(compareHistory(x,{stock:'zijinA',period:'all'}).commonCount,2);
 assert.throws(()=>historyFromCsv('date,gold\n2026-09-01,2000\n2026-09-02,2010'),/表头/);
});
test('Pearson correlation requires enough aligned returns',()=>{
 assert.equal(pearsonReturns([{gold:1,stock:2},{gold:2,stock:3}]),null);
 const s=dates.map((d,i)=>({gold:100*Math.exp(.01*i+.001*i*i),stock:40*Math.exp(.015*i+.0015*i*i)}));
 assert.ok(pearsonReturns(s)>0.99);
});
function providerBars(key,currency){
 return {meta:{currency,mic_code:key==='601899.SH'?'XSHG':key==='02899.HK'?'XHKG':undefined},
 values:dates.map((d,i)=>({datetime:d,close:String(key==='XAU/USD'?2000+i*10:key==='601899.SH'?20+i*.2:30+i*.3)}))};
}
test('licensed EOD publisher requires gold plus one valid stock',()=>{
 const empty=normalizeHistory({schemaVersion:1,status:'unconfigured',series:{}});
 const quotes={'XAU/USD':providerBars('XAU/USD','USD'),'601899.SH':providerBars('601899.SH','CNY')};
 const r=providerHistory(quotes,empty,{checkedAt:'2026-09-20T18:00:00Z',minOverlap:10});
 assert.equal(r.updated,true);
 assert.equal(r.history.series.gold.length,20);
 assert.equal(r.history.series.zijinA.length,20);
 assert.equal(r.history.series.zijinH.length,0);
 assert.equal(r.history.provider,'Twelve Data · licensed daily EOD');
});
test('publisher rejects wrong currency and keeps unpublished history empty',()=>{
 const empty=normalizeHistory({schemaVersion:1,status:'unconfigured',series:{}});
 const quotes={'XAU/USD':providerBars('XAU/USD','USD'),'601899.SH':providerBars('601899.SH','HKD')};
 const r=providerHistory(quotes,empty,{checkedAt:'2026-09-20T18:00:00Z',minOverlap:10});
 assert.equal(r.updated,false);
 assert.equal(r.history.series.gold.length,0);
});
