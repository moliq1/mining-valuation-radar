import test from 'node:test';
import assert from 'node:assert/strict';
import {publicCompareConfig,PUBLIC_CHART_SYMBOLS,PUBLIC_CHART_SOURCE} from '../src/hosted-chart.js';

test('Gold matches the known TradingView OANDA XAUUSD symbol',()=>{
 assert.equal(PUBLIC_CHART_SYMBOLS.gold,'OANDA:XAUUSD');
 assert.match(PUBLIC_CHART_SOURCE,/^https:\/\/s3\.tradingview\.com\/external-embedding\//);
});
test('A and H use their own exchange symbols with identical gold base',()=>{
 const a=publicCompareConfig('zijinA'),h=publicCompareConfig('zijinH');
 assert.equal(a.compareSymbol.symbol,'SSE:601899');
 assert.equal(h.compareSymbol.symbol,'HKEX:2899');
 assert.equal(a.symbols[0][1], 'OANDA:XAUUSD|1D');
 assert.equal(h.symbols[0][1], 'OANDA:XAUUSD|1D');
 assert.equal(a.scaleMode,'Percentage');
 assert.equal(h.scaleMode,'Percentage');
 assert.equal(a.chartType,'line');
 assert.equal(a.autosize,true);
});
test('Invalid stock cannot inject arbitrary symbols into externally hosted script',()=>{
 assert.throws(()=>publicCompareConfig('bad-stock'),/仅支持/);
 assert.throws(()=>publicCompareConfig('both'),/仅支持/);
});
