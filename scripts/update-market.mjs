#!/usr/bin/env node
/** Licensed EOD quote ingestion for static public Pages sites.
 * Environment:
 * TWELVE_DATA_API_KEY secret, MARKET_DATA_PUBLICATION_AUTHORIZED=true repo variable.
 * The provider may require business/redistribution entitlements for public display.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {applyMarketData,marketSymbol} from '../src/market-sync.js';
import {providerHistory} from '../src/history-data.js';
const dryRun=process.argv.includes('--dry-run');
const fixtureFlag=process.argv.indexOf('--fixture');
const snapshotPath=new URL('../data/snapshot.json',import.meta.url);
const historyPath=new URL('../data/market-history.json',import.meta.url);
const snapshot=JSON.parse(await readFile(snapshotPath,'utf8'));
const license=process.env.MARKET_DATA_PUBLICATION_AUTHORIZED==='true';
const apiKey=process.env.TWELVE_DATA_API_KEY;
if(!dryRun&&!license){console.error('Publishing disabled. Set repository variable MARKET_DATA_PUBLICATION_AUTHORIZED=true only with market data redistribution rights.');process.exit(2);}
if(fixtureFlag<0&&!apiKey){console.error('TWELVE_DATA_API_KEY GitHub Actions secret is missing; no data changed.');process.exit(2);}
const quotes={};
if(fixtureFlag>=0){
  const filename=process.argv[fixtureFlag+1];if(!filename)throw Error('--fixture requires path');
  Object.assign(quotes,JSON.parse(await readFile(filename,'utf8')));
}else{
  const symbols=[...snapshot.stocks.map(s=>[s.ticker,marketSymbol(s.ticker)]),
                 ['XAU/USD',{symbol:'XAU/USD'}],['XAG/USD',{symbol:'XAG/USD'}],
                 ['COPPER',{symbol:'COPPER'}],['USD/CNY',{symbol:'USD/CNY'}],
                 ['HKD/CNY',{symbol:'HKD/CNY'}]];
  for(const [ticker,config] of symbols){
    const url=new URL('https://api.twelvedata.com/time_series');
    const entries={...config,interval:'1day',outputsize:['601899.SH','02899.HK','XAU/USD'].includes(ticker)?'400':'10',format:'JSON',adjust:'none',apikey:apiKey};
    for(const [k,v] of Object.entries(entries))url.searchParams.set(k,v);
    try{
      const res=await fetch(url,{headers:{'Accept':'application/json'},signal:AbortSignal.timeout(14000)});
      if(!res.ok)throw Error('HTTP '+res.status);
      const body=await res.json();
      if(body?.status==='error')throw Error('Provider: '+body.message);
      quotes[ticker]=body;
      console.log('fetched',ticker,'bars',body?.values?.length??0);
    }catch(err){console.warn('unavailable',ticker,err.message);}
    // Free and low-tier API plans have per-minute credit limits.
    await new Promise(r=>setTimeout(r,8200));
  }
}
const historyBefore=JSON.parse(await readFile(historyPath,'utf8'));
const historical=providerHistory(quotes,historyBefore,{checkedAt:new Date().toISOString(),minOverlap:10});
console.log('History publish:',historical.updated?'validated historical series ready':'not updated',historical.errors);
const {snapshot:updated,report}=applyMarketData(snapshot,quotes,{checkedAt:new Date().toISOString()});
console.log('EOD sync summary:',JSON.stringify(report,null,2));
if(report.updated.length===0 && !historical.updated){console.error('No valid stock quotes or licensed historical charts; existing data left intact.');process.exitCode=1;}
else if(!dryRun){
  if(report.updated.length>0){await writeFile(snapshotPath,JSON.stringify(updated,null,2)+'\n','utf8');console.log('Updated snapshot with',report.updated.length,'quotes.');}
  if(historical.updated){await writeFile(historyPath,JSON.stringify(historical.history,null,2)+'\n','utf8');console.log('Updated gold and Zijin historical series.');}
}else console.log('DRY RUN: no files written.');
