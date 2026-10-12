import {DEFAULT_FORECAST,validateForecast,projectForecast,inverseGold,applyPreset} from './zijin-forecast.js';
function displayNum(n,d=1){return typeof n==='number'&&Number.isFinite(n)?n.toLocaleString('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d}):'—'}

function displayPct(n){return typeof n==='number'&&Number.isFinite(n)?((n>0?'+':'')+(n*100).toFixed(1)+'%'):'—'}

function forecastInput(label,path,value,step='1',unit=''){return `<div class="f-field"><label>${label}${unit?' · '+unit:''}</label><input type="number" step="${step}" data-fkey="${path}" value="${value}"></div>`}

function forecastScreen(data,p,warning=''){
 const r=projectForecast(data,p), sel=r.selected;
 const fmt=displayNum,pct=displayPct;
 const impliedA=inverseGold(data,p,r.stockA);
 const impliedH=inverseGold(data,p,r.stockH*data.market.hkdCny);
 const baseCompany=data.companies.find(x=>x.id==='zijin');
 const years=[2026,2027,2028];
 const maxP=Math.max(1,...r.rows.map(x=>Math.abs(x.profitYi)));
 return `<div class="f-top"><a class="f-back" href="./index.html#scenario">← 返回 ORE Radar · 情景实验室</a><span class="f-stale">2026H1 财报锚 · 非实时股价</span></div>
 <div class="f-kicker">EARNINGS FORECAST / 2026—2028</div>
 <h1 class="f-title">紫金矿业 · 三年成长与估值模型</h1>
 <p class="f-sub">已锁定上半年扣非利润，并按照矿产金、铜<strong>产量→模型销量→归母利润</strong>推算2026H2及2027—2028年；其他业务利润与金铜业务分开增长。结果是研究情景而非盈利指引或正式NAV。</p>
 ${warning?`<div class="f-error">${warning.replaceAll('<','&lt;')}</div>`:''}
 <div class="f-grid">
 <div class="f-card">
  <div class="f-inline" style="justify-content:space-between;width:100%"><h2>研究假设</h2><button class="f-btn" data-freset>恢复初始参数</button></div>
  <p>一键代入金铜价格轨迹，再逐年修改。2026和2028矿产量默认参考公司规划；2027是模型插值。</p>
  <div class="f-scenarios"><button data-fpreset="bear">悲观情景</button><button data-fpreset="base">基准情景</button><button data-fpreset="bull">乐观（金价6,000）</button></div>
  <div class="f-year-grid">${years.map(y=>`<div class="f-year-box"><h3>${y} 年 ${y===2027?'· 插值':'· 规划锚'}</h3>
   ${forecastInput('金价','annual.'+y+'.goldUsd',p.annual[y].goldUsd,50,'USD/oz')}
   ${forecastInput('铜价','annual.'+y+'.copperUsd',p.annual[y].copperUsd,100,'USD/t')}
   ${forecastInput('矿产金','annual.'+y+'.goldT',p.annual[y].goldT,1,'吨')}
   ${forecastInput('矿产铜','annual.'+y+'.copperT',p.annual[y].copperT,10000,'吨')}
  </div>`).join('')}</div>
  <div class="f-sep"></div>
  <h3>经营/归母参数 <span class="f-muted">（可调整的研究假设）</span></h3>
  <div class="f-controls" style="margin-top:14px">
  ${forecastInput('矿山黄金单位销售成本','costGoldUsdOz',p.costGoldUsdOz,50,'USD/oz')}
  ${forecastInput('矿山铜单位销售成本','costCopperUsdT',p.costCopperUsdT,100,'USD/t')}
  ${forecastInput('金价增量归母留存','retainGold',p.retainGold,.02,'0-1')}
  ${forecastInput('铜价增量归母留存','retainCopper',p.retainCopper,.02,'0-1')}
  ${forecastInput('非金铜归母剩余利润增长','growthOther',p.growthOther,.01,'年变化率')}
  ${forecastInput('FCFE转换系数（核验）','fcfeFactor',p.fcfeFactor,.05,'0-1.5')}
  ${forecastInput('模型黄金销量/产量','sellGoldRatio',fmt(p.sellGoldRatio,4),.01,'近似比率')}
  ${forecastInput('模型铜销量/产量','sellCopperRatio',fmt(p.sellCopperRatio,4),.01,'近似比率')}
  ${forecastInput('前瞻情景PE','forwardPe',p.forwardPe,1,'倍')}
  ${forecastInput('前瞻市盈率折现率','discount',p.discount,.01,'年')}
  <div class="f-field"><label>使用哪年的预测估值</label><select data-fkey="terminalYear">${years.map(y=>`<option value="${y}" ${p.terminalYear===y?'selected':''}>${y}年</option>`).join('')}</select></div>
  </div>
  <div class="f-data" style="margin-top:17px">报告财务基准：H1扣非归母 <b>${fmt(p.h1.profitYi,2)} 亿元</b>，H1黄金销量44.18吨，矿产金46.702吨；矿山铜产品销量459,796吨，矿产铜534,407吨。<br>H1销售成本参照公司分产品单位销售成本估算美元量级，并非AISC。留存系数不是法定税率。</div>
 </div>
 <div>
 <div class="f-card">
  <div class="f-inline" style="justify-content:space-between;width:100%"><div><h2>${p.terminalYear} 年估值结果</h2><p>前瞻PE折现至2026年末的<strong>研究价格</strong>，并非当前即时可成交目标价。</p></div><span class="tag gold">${fmt(p.forwardPe,0)}× PE</span></div>
  <div class="f-summary">
   <div class="f-summary-item"><div class="cap">${p.terminalYear}年归母预测</div><div class="val">${fmt(sel.profitYi,1)}<small> 亿</small></div></div>
   <div class="f-summary-item"><div class="cap">${p.terminalYear}年 EPS（RMB）</div><div class="val">¥${fmt(sel.eps,2)}</div></div>
   <div class="f-summary-item"><div class="cap">前瞻PE折现价 · A股</div><div class="val">¥${fmt(sel.presentPe,2)}</div></div>
  </div>
  <div class="f-split">
   <div><div class="f-line"><span>A股参考股价</span><strong>¥${fmt(r.stockA,2)}</strong></div><div class="f-line"><span>A股模型安全边际</span><strong class="${r.marginA>=0?'f-positive':'f-negative'}">${pct(r.marginA)}</strong></div><div class="f-line"><span>当前A价隐含${p.terminalYear}年金价</span><strong>${impliedA===null?'模型边界外':'$'+fmt(impliedA,0)+'/oz'}</strong></div><div class="f-muted" style="margin-top:8px">A价日期 ${r.asOfA||'未知'}</div></div>
   <div><div class="f-line"><span>H股折算模型价格</span><strong>HK$${fmt(r.fairHkd,2)}</strong></div><div class="f-line"><span>H股参考价</span><strong>HK$${fmt(r.stockH,2)}</strong></div><div class="f-line"><span>H股模型安全边际</span><strong class="${r.marginH>=0?'f-positive':'f-negative'}">${pct(r.marginH)}</strong></div><div class="f-line"><span>当前H价隐含${p.terminalYear}年金价</span><strong>${impliedH===null?'模型边界外':'$'+fmt(impliedH,0)+'/oz'}</strong></div><div class="f-muted" style="margin-top:8px">H价日期 ${r.asOfH||'未知'}</div></div>
  </div>
  <div class="f-warn" style="margin-top:17px">风险：当前股票价格可能仍是历史快照。反推金价是“其余参数完全不变、指定年度的金价”而非市场真实共识。2028年折现采用 (${p.terminalYear}－2026) 年差，不等于从当前日期逐日折现。</div>
 </div>
 <div class="f-card" style="margin-top:19px">
  <h2>2026—2028年经营预测表</h2><p>2026年是H1已实现 + H2预测；2027—2028年是全年模型。各项单位及币种按行标注。</p>
  <div class="f-table-wrap"><table class="f-table"><thead><tr><th>预测维度</th>${years.map(y=>`<th>${y}</th>`).join('')}</tr></thead><tbody>
  ${[
   ['黄金年度均价 · USD/oz',v=>fmt(v.goldUsd,0)],
   ['铜年度均价 · USD/t',v=>fmt(v.copperUsd,0)],
   ['矿产金计划 · 吨',v=>fmt(v.goldT,1)],
   ['黄金模型全年销量 · 吨',v=>fmt(v.goldSales,1)],
   ['矿产铜计划 · 吨',v=>fmt(v.copperT,0)],
   ['铜模型全年销量 · 吨',v=>fmt(v.copperSales,0)],
   ['已实现2026H1利润 · 亿',v=>fmt(v.realizedH1Yi,1)],
   ['黄金模型归母贡献 · 亿',v=>fmt(v.goldYi,1)],
   ['铜模型归母贡献 · 亿',v=>fmt(v.copperYi,1)],
   ['其他归母剩余贡献 · 亿',v=>fmt(v.otherYi,1)],
   ['归母利润合计 · 亿',v=>fmt(v.profitYi,1)],
   ['EPS · RMB',v=>fmt(v.eps,2)],
   ['FCFE研究换算 · 亿',v=>fmt(v.fcfeYi,1)]
  ].map(([label,fn])=>`<tr><td>${label}</td>${r.rows.map(v=>`<td class="f-num">${fn(v)}</td>`).join('')}</tr>`).join('')}
  </tbody></table></div>
  <div class="f-split"><div class="f-data"><strong>已实现H1归母利润的拆分：</strong><br>金价成本归母贡献 ${fmt(r.anchoredGold,1)} 亿；铜价成本归母贡献 ${fmt(r.anchoredCopper,1)} 亿；其余净利润 ${fmt(r.otherH1,1)} 亿。三者合计 ${fmt(p.h1.profitYi,1)} 亿，不额外相加到H1已实现值。</div><div class="f-data"><strong>现金流校验：</strong><br>${p.terminalYear}年模型FCFE ${fmt(sel.fcfeYi,1)} 亿，按所选转换系数 ${pct(p.fcfeFactor)} 测算；参考A股价的对应现金收益率 ${pct(r.fcfeYieldA)}。<b>不构成自由现金流DCF/NAV。</b></div></div>
 </div>
 </div></div>
 <div class="f-card" style="margin-top:20px"><h2>来源、口径与边界</h2><div class="f-split"><div class="f-data"><b>公司正式披露：</b><br><a href="https://www.zjky.cn/investor/2026yeji.htm" target="_blank" rel="noopener">2026H1 紫金官网业务报告 ↗</a><br><a href="https://vip.stock.finance.sina.com.cn/corp/view/vCB_AllBulletinDetail.php?id=12519310&stockid=601899" target="_blank" rel="noopener">2026H1分产品销量、销售成本 ↗</a><br><a href="https://paper.cnstock.com/html/2026-02/10/content_2179725.htm" target="_blank" rel="noopener">2026—2028产量规划 ↗</a></div><div class="f-warn"><b>注意双重口径与投资风险：</b>矿产量包含部分权益项目，报表销量不完全覆盖全部矿山投资收益；销售比率只是桥接参数。2027产量插值、现金流转换、权益留存和PE均为研究假设。模型尚未将锂/钴、并购与矿山生命期逐矿建模，也没有矿权NAV或完整DCF。紫金黄金国际等控股资产已经在紫金合并口径中，不能再重复加总。</div></div></div>`;
}

async function startForecast(){
 const root=document.getElementById('forecastApp'),storageKey='ore-zijin-3y-v2';
 let snapshot,params=JSON.parse(JSON.stringify(DEFAULT_FORECAST));
 try{
  const res=await fetch('./data/snapshot.json',{cache:'no-store'});if(!res.ok)throw Error('无法获取研究快照');
  snapshot=await res.json();
  const local=localStorage.getItem(storageKey);
  if(local){try{const saved=JSON.parse(local);validateForecast(saved);params=saved}catch{localStorage.removeItem(storageKey)}}
 }catch(error){root.textContent='三年预测无法加载：'+error.message;return}
 const render=message=>{root.innerHTML=forecastScreen(snapshot,params,message);};
 const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify(params))}catch{}};
 root.addEventListener('click',e=>{
  const preset=e.target.closest('[data-fpreset]');if(preset){params=applyPreset(params,preset.dataset.fpreset);save();render();return}
  if(e.target.closest('[data-freset]')){params=JSON.parse(JSON.stringify(DEFAULT_FORECAST));save();render()}
 });
 root.addEventListener('change',e=>{
  const el=e.target.closest('[data-fkey]');if(!el)return;
  const path=el.dataset.fkey, val=Number(el.value),copy=JSON.parse(JSON.stringify(params));
  if(!Number.isFinite(val)){render('请输入有效数字');return}
  const m=/^annual\.(2026|2027|2028)\.(goldT|copperT|goldUsd|copperUsd)$/.exec(path);
  const valid=['costGoldUsdOz','costCopperUsdT','retainGold','retainCopper','growthOther','fcfeFactor','sellGoldRatio','sellCopperRatio','forwardPe','discount','terminalYear'];
  if(m){copy.annual[m[1]][m[2]]=val}else if(valid.includes(path)){copy[path]=val}else return;
  if(val<0&&path!=='growthOther'||val>100000000||val===0&&path!=='growthOther'&&path!=='costGoldUsdOz'&&path!=='costCopperUsdT'){render('参数超出有效范围');return}
  try{validateForecast(copy);params=copy;save();render()}catch(ex){render(ex.message)}
 });
 render();
}
startForecast();
