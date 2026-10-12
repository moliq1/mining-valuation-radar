import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_FORECAST,applyPreset,projectForecast,inverseGold,validateForecast} from '../src/zijin-forecast.js';
const data=JSON.parse(readFileSync(new URL('../data/snapshot.json',import.meta.url)));
const copy=()=>JSON.parse(JSON.stringify(DEFAULT_FORECAST));

test('three-year inputs are valid and company production guidance is explicit',()=>{
 assert.equal(validateForecast(copy()),true);
 assert.equal(DEFAULT_FORECAST.annual[2026].goldT,105);
 assert.equal(DEFAULT_FORECAST.annual[2028].goldT,135);
 assert.equal(projectForecast(data,copy()).rows.length,3);
});
test('historical first-half net profit is protected from all 2026 H2 scenario price changes',()=>{
 const v=copy(),a=projectForecast(data,v);
 v.annual[2026].goldUsd=6000;
 v.annual[2026].copperUsd=16000;
 const b=projectForecast(data,v);
 assert.equal(a.rows[0].realizedH1Yi,380.34770076);
 assert.equal(a.rows[0].realizedH1Yi,b.rows[0].realizedH1Yi);
 assert.ok(b.rows[0].goldYi>a.rows[0].goldYi);
 assert.ok(b.rows[0].profitYi>a.rows[0].profitYi);
});
test('exact H1 repeat volumes and reference prices reproduce 2x H1 profit',()=>{
 const p=copy();
 p.annual[2026].goldUsd=p.h1.goldUsd;
 p.annual[2026].copperUsd=p.h1.copperUsd;
 p.annual[2026].goldT=2*p.h1.goldSoldT/p.sellGoldRatio;
 p.annual[2026].copperT=2*p.h1.copperSoldT/p.sellCopperRatio;
 const row=projectForecast(data,p).rows[0];
 assert.ok(Math.abs(row.profitYi-2*p.h1.profitYi)<1e-8);
});
test('non-gold/copper growth never multiplies the realized H1 profit',()=>{
 const a=copy(),b=copy();b.growthOther=0.1;
 const before=projectForecast(data,a),after=projectForecast(data,b);
 assert.equal(after.rows[0].realizedH1Yi,b.h1.profitYi);
 assert.ok(Math.abs(after.rows[0].otherYi - before.rows[0].otherYi*1.1)<1e-8);
});
test('gold price 6000 bull scenario raises projected 2028 profit and fair value',()=>{
 const base=projectForecast(data,copy());
 const b=applyPreset(copy(),'bull');
 const bull=projectForecast(data,b);
 assert.equal(b.annual[2028].goldUsd,6000);
 assert.ok(bull.rows[2].profitYi>base.rows[2].profitYi);
 assert.ok(bull.selected.presentPe>base.selected.presentPe);
});
test('gold implied price inversion recovers a known target and A/H conversion',()=>{
 const p=copy(),r=projectForecast(data,p);
 const inferred=inverseGold(data,p,r.selected.presentPe);
 assert.ok(Math.abs(inferred-p.annual[2028].goldUsd)<0.001);
 const hkd=r.selected.presentPe/data.market.hkdCny;
 assert.ok(Math.abs(hkd-r.fairHkd)<1e-9);
});
test('FCFE factor changes cashflow not earnings or PE derived fair value',()=>{
 const a=copy(),b=copy();b.fcfeFactor=.2;
 const x=projectForecast(data,a),y=projectForecast(data,b);
 assert.equal(x.selected.profitYi,y.selected.profitYi);
 assert.equal(x.selected.presentPe,y.selected.presentPe);
 assert.notEqual(x.selected.fcfeYi,y.selected.fcfeYi);
});
test('negative modeled earnings never produce negative PE price',()=>{
 const p=copy();p.annual[2028].goldUsd=500;p.annual[2028].copperUsd=500;p.forwardPe=14;
 const r=projectForecast(data,p);
 assert.ok(r.selected.presentPe>=0);
});
test('limits and missing values fail closed',()=>{
 const v=copy();v.forwardPe=0;assert.throws(()=>validateForecast(v));
 const q=copy();q.annual[2028].goldUsd=NaN;assert.throws(()=>validateForecast(q));
});
