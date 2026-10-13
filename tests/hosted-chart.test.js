import test from 'node:test';
import assert from 'node:assert/strict';
import {PUBLIC_CHART_SYMBOLS,MARKET_SOURCE,RESEARCH_PERIODS,parseEastmoneyHistory,loadDirectHistory} from '../src/hosted-chart.js';
import {compareHistory} from '../src/history-data.js';

const payload=(code,market,base=100,n=14)=>({
 rc:0,data:{code,market,klines:Array.from({length:n},(_,i)=>{
  const day=new Date(Date.UTC(2026,8,i+1)).toISOString().slice(0,10);
  return `${day},0,${base+i*0.9},0,0,0`;
 })}
});
test('fixed upstream is HTTPS and gold/A/H identifiers are verified',()=>{
 assert.equal(MARKET_SOURCE,'https://push2his.eastmoney.com/api/qt/stock/kline/get');
 assert.equal(PUBLIC_CHART_SYMBOLS.zijinA,'1.601899');
 assert.equal(PUBLIC_CHART_SYMBOLS.zijinH,'116.02899');
 assert.equal(PUBLIC_CHART_SYMBOLS.gold,'122.XAU');
 assert.ok(RESEARCH_PERIODS.includes('6m'));
});
test('parse close bars from verified market symbol, sort without filling holidays',()=>{
 const p=payload('601899',1,20,13);
 p.data.klines.splice(2,1);
 p.data.klines.reverse();
 const r=parseEastmoneyHistory(p,'1.601899');
 assert.equal(r.length,12);
 assert.equal(r[0].date,'2026-09-01');
 assert.equal(r.at(-1).close,30.8);
 assert.ok(!r.some(x=>x.date==='2026-09-03'));
});
test('code mismatch, duplicate date, impossible quote and too few rows all fail closed',()=>{
 assert.throws(()=>parseEastmoneyHistory(payload('000001',1), '1.601899'),/校验/);
 const p=payload('601899',1);p.data.klines.push(p.data.klines[0]);
 assert.throws(()=>parseEastmoneyHistory(p,'1.601899'),/重复/);
 const bad=payload('601899',1);bad.data.klines[1]='2026-09-02,1,-5,1,1,1';
 assert.throws(()=>parseEastmoneyHistory(bad,'1.601899'),/异常/);
 assert.throws(()=>parseEastmoneyHistory({rc:0,data:{code:'601899',klines:[]}},'1.601899'),/不足/);
});
test('all browser-sourced series produce pairable gold and A/H charts',async()=>{
 const fetcher=async id=>{
  if(id==='122.XAU')return parseEastmoneyHistory(payload('XAU',122,4100),'122.XAU');
  if(id==='1.601899')return parseEastmoneyHistory(payload('601899',1,20),'1.601899');
  if(id==='116.02899')return parseEastmoneyHistory(payload('02899',116,30),'116.02899');
  throw Error('unexpected '+id);
 };
 const {history,warnings}=await loadDirectHistory(fetcher);
 assert.deepEqual(warnings,[]);
 assert.equal(history.goldInstrument,'XAU/USD');
 assert.equal(history.goldUnit,'USD/oz');
 for(const stock of ['zijinA','zijinH']){
  const result=compareHistory(history,{stock,period:'all'});
  assert.equal(result.commonCount,14);
  assert.equal(result.series.gold[0].value,100);
 }
});
test('when international spot gold fails, fallback is Shanghai Au99.99 CNY/g',async()=>{
 const fetcher=async id=>{
  if(id==='122.XAU')throw Error('XAU unavailable');
  if(id==='118.AU9999')return parseEastmoneyHistory(payload('AU9999',118,900),'118.AU9999');
  if(id==='1.601899')return parseEastmoneyHistory(payload('601899',1,20),'1.601899');
  if(id==='116.02899')throw Error('HK blocked');
  throw Error('unknown');
 };
 const {history,warnings}=await loadDirectHistory(fetcher);
 assert.equal(history.goldInstrument,'SGE Au99.99');
 assert.equal(history.goldUnit,'CNY/g');
 assert.equal(history.series.zijinH.length,0);
 assert.ok(warnings.length>=2);
 assert.equal(compareHistory(history,{stock:'zijinA',period:'all'}).enough,true);
 assert.equal(compareHistory(history,{stock:'zijinH',period:'all'}).enough,false);
});
