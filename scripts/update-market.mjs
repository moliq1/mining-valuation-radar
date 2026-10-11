#!/usr/bin/env node
/** Licensed EOD quote ingestion for static public Pages sites.
 * Environment:
 * TWELVE_DATA_API_KEY secret, MARKET_DATA_PUBLICATION_AUTHORIZED=true repo variable.
 * The provider may require business/redistribution entitlements for public display.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {applyMarketData,marketSymbol} from '../src/market-sync.js';
const dryRun=process.argv.includes('--dry-run');
const fixtureFlag=process.argv.indexOf('--fixture');
const snapshotPath=new URL('../data/snapshot.json',import.meta.url);
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
    const entries={...config,interval:'1day',outputsize:'10',format:'JSON',adjust:'none',apikey:apiKey};
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
const {snapshot:updated,report}=applyMarketData(snapshot,quotes,{checkedAt:new Date().toISOString()});
console.log('EOD sync summary:',JSON.stringify(report,null,2));
if(report.updated.length===0){console.error('No valid stock quotes. Snapshot not overwritten.');process.exitCode=1;}
else if(!dryRun){
  await writeFile(snapshotPath,JSON.stringify(updated,null,2)+'\n','utf8');
  console.log('Updated snapshot with',report.updated.length,'of',snapshot.stocks.length,'quote(s).');
}else console.log('DRY RUN: no files written.');
