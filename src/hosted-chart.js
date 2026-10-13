/**
 * Provider-hosted TradingView comparisons.
 * No underlying exchange data is downloaded, copied or published by ORE Radar.
 * Official symbol-overview widget's compareSymbol offers indexed percentage views.
 */
export const PUBLIC_CHART_SYMBOLS = Object.freeze({
  gold:'OANDA:XAUUSD',
  zijinA:'SSE:601899',
  zijinH:'HKEX:2899'
});
export const PUBLIC_CHART_SOURCE='https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js';
export const PUBLIC_CHART_LINKS=Object.freeze({
  gold:'https://www.tradingview.com/symbols/XAUUSD/',
  zijinA:'https://www.tradingview.com/symbols/SSE-601899/',
  zijinH:'https://www.tradingview.com/symbols/HKEX-2899/'
});
export function publicCompareConfig(stock){
  if(stock!=='zijinA'&&stock!=='zijinH')throw Error('仅支持紫金矿业A/H独立对比');
  return {
    symbols:[['国际现货黄金 XAU/USD',PUBLIC_CHART_SYMBOLS.gold+'|1D']],
    compareSymbol:{
      symbol:PUBLIC_CHART_SYMBOLS[stock],
      lineColor:stock==='zijinA'?'rgba(56, 122, 182, 1)':'rgba(22, 143, 131, 1)',
      lineWidth:2
    },
    chartOnly:true,
    width:'100%',
    height:'100%',
    locale:'zh_CN',
    colorTheme:'light',
    autosize:true,
    showVolume:false,
    showMA:false,
    hideDateRanges:false,
    hideMarketStatus:true,
    hideSymbolLogo:false,
    scalePosition:'right',
    scaleMode:'Percentage',
    fontFamily:'-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
    fontSize:'11',
    noTimeScale:false,
    valuesTracking:'1',
    changeMode:'price-and-percent',
    chartType:'line',
    lineWidth:2,
    lineType:0,
    dateRanges:['1w|15','1m|60','3m|60','12m|1D','all|1M'],
    dateFormat:'yyyy-MM-dd',
    bottomColor:'rgba(255,255,255,0)'
  };
}
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
export function mountPublicMarketCharts(container){
  if(!container)return;
  const items=[['zijinA','紫金矿业 A 股','人民币 / 股'],['zijinH','紫金矿业 H 股','港币 / 股']];
  container.innerHTML=`<div class="hist-intro"><div><div class="eyebrow">TRADINGVIEW HOSTED DATA / PUBLIC CHARTS</div><h2>真实行情对比 · 黄金 × 紫金矿业</h2><p>行情在 TradingView 官方组件内加载；研究网站不抓取或再分发交易所原始历史数据。</p></div><span class="hist-state">第三方图表 · 数据或延迟因市场而异</span></div>
  <div class="hosted-grid">${items.map(([key,name,unit])=>`<div class="panel hosted-card"><div class="hosted-card-head"><div><h3>黄金 XAU/USD vs ${name}</h3><p>黄金美元/盎司 · ${unit} · 同期百分比涨跌</p></div><a href="${PUBLIC_CHART_LINKS[key]}" target="_blank" rel="noopener noreferrer">查看股票行情 ↗</a></div><div class="tv-widget-holder" data-tv-stock="${key}"></div><div class="tv-provider"><a href="https://www.tradingview.com/widget/" target="_blank" rel="noopener nofollow noreferrer">行情图表由 TradingView 提供</a> · 可在图内切换日期区间；如第三方脚本被拦截，请通过上方链接打开</div></div>`).join('')}</div>
  <div class="hist-source" style="margin:12px 0 24px"><strong>图表口径：</strong>每张图均显示国际现货金 ${PUBLIC_CHART_SYMBOLS.gold} 与紫金矿业相对变化。两个币种并未进行汇率中性化，价格时间可能延迟；请以提供商标注为准。下方“本地统计”仍需导入获授权的数据，不能将嵌入式图表内部数据当成可导出的CSV。</div>`;
  for(const [key] of items){
    const holder=container.querySelector('[data-tv-stock="'+key+'"]');
    if(!holder)continue;
    const body=document.createElement('div');
    body.className='tradingview-widget-container';
    body.style.cssText='height:100%;width:100%';
    const widget=document.createElement('div');
    widget.className='tradingview-widget-container__widget';
    widget.style.cssText='height:100%;width:100%';
    body.appendChild(widget);
    const script=document.createElement('script');
    script.type='text/javascript';
    script.src=PUBLIC_CHART_SOURCE;
    script.async=true;
    script.textContent=JSON.stringify(publicCompareConfig(key));
    body.appendChild(script);
    holder.appendChild(body);
  }
}
