import {CASES,CASE_LABEL,METAL_LABEL,companyValue,stockMetrics,stockStatus,ahPairs,validateSnapshot,finite} from './model.js';
const BASE_URL=new URL('../data/snapshot.json',import.meta.url);

const LS='ore-mining-radar-v1';
const navs=[['overview','◫','研究总览'],['valuation','▦','估值矩阵'],['scenario','◈','情景实验室'],['spread','⇆','A / H 比价'],['signals','⚑','错杀雷达'],['sources','≡','数据与来源']];
const app=document.getElementById('app');
const state={data:null,tab:location.hash.replace('#','')||'overview',labCompany:'zijin',labCase:'base',selected:'01787.HK',board:'all',search:'',message:''};
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt=(n,d=2)=>finite(n)?n.toLocaleString('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const pct=(n,d=1)=>finite(n)?`${n>0?'+':''}${(n*100).toFixed(d)}%`:'—';
const sign=n=>n>0?'positive':n<0?'negative':'muted';
const money=(n,ccy)=>`${ccy==='HKD'?'HK$':'¥'}${fmt(n,2)}`;
const company=id=>state.data.companies.find(c=>c.id===id);
const stock=ticker=>state.data.stocks.find(s=>s.ticker===ticker);
const calc=s=>stockMetrics(s,company(s.companyId),state.data.market);
const view=s=>({s,c:company(s.companyId),m:calc(s),status:stockStatus(s,company(s.companyId),state.data.market)});
const rows=()=>state.data.stocks.map(view);
const tag=(text,tone='neutral')=>`<span class="tag ${esc(tone)}">${esc(text)}</span>`;
const link=url=>/^https:\/\//.test(url||'')?esc(url):'#';
const note=`研究演示数据，不是实时报价或买卖建议。利润基准按2026H1×2并经留存系数修正；AISC、资本开支、矿山复产、钴价与可转债等可能使估值显著偏离。`;

function save(){try{localStorage.setItem(LS,JSON.stringify(state.data));}catch(e){console.warn('无法写入本地存储',e);}}
function sectionTitle(title,desc='',right=''){return `<div class="section-header"><div><h2>${title}</h2>${desc?`<p>${desc}</p>`:''}</div>${right}</div>`;}
function shell(){
 return `<div class="layout">
 <aside class="sidebar"><div class="brand"><div class="logo-mark">◆</div><div><div class="brand-main">ORE RADAR</div><div class="brand-sub">GLOBAL METALS RESEARCH</div></div></div>
 <div><div class="nav-label">INVESTMENT TERMINAL</div><nav class="nav-group">${navs.map(([id,ico,name])=>`<button class="nav-item ${id===state.tab?'active':''}" data-tab="${id}"><span class="symbol">${ico}</span>${name}</button>`).join('')}</nav></div>
 <div class="sidebar-bottom"><strong><span class="live-dot"></span>离线研究模型</strong><p>已内置 2026H1 财报参数。行情手工录入，不连接实时交易所报价。</p></div><div class="version">ORE / V1.0 · LOCAL FIRST</div></aside>
 <main class="main"><header class="topbar"><div class="breadcrumb">研究工作台　/　<b>${esc(navs.find(n=>n[0]===state.tab)?.[2]||'研究总览')}</b></div><div class="top-actions"><span class="asof">快照截至 ${esc(state.data.updatedAt)}</span><button class="button tiny" data-action="export">↓ 导出 JSON</button><label class="button tiny" for="file-input">↑ 导入数据</label><input id="file-input" type="file" accept="application/json,.json" hidden></div></header>
 <div class="hero"><div><div class="eyebrow">QUANTITATIVE RESEARCH / COMMODITIES</div><h1>全球金银铜矿业 · 估值雷达</h1><p>用可解释的盈利模型，识别商品价格变化与 A/H 股票定价之间的预期差。</p></div><div class="hero-actions"><span class="datepill">◉ 历史快照 · 非实时</span><button data-action="reset" class="button">↺ 重置基准</button></div></div>
 ${state.message?`<div class="note-block" role="status" style="margin-bottom:15px">${esc(state.message)}</div>`:''}
 <div id="content">${page()}</div>
 <footer class="footer-note">ORE Radar © 2026　/　仅用于投研假设和风险筛选。${esc(note)} 真实交易前请复核所有输入、披露公告及交易费用。</footer>
 </main></div>`;
}
function page(){switch(state.tab){case'valuation':return valuationPage();case'scenario':return scenarioPage();case'spread':return spreadPage();case'signals':return signalsPage();case'sources':return sourcesPage();default:return overviewPage();}}
function overviewPage(){
 const rs=rows(), discounts=rs.filter(x=>finite(x.m.margin)&&x.m.margin>=0.25),watch=rs.filter(x=>x.status.code==='watch');
 const highest=[...rs].sort((a,b)=>(b.m.margin??-Infinity)-(a.m.margin??-Infinity));
 const sorted=[...rs].filter(r=>r.m.base>0).sort((a,b)=>a.s.price/a.m.base-b.s.price/b.m.base).slice(0,8);
 return `<div class="stat-grid">
 ${stat('覆盖上市公司',state.data.companies.length,'家','八大矿企', '◈')}
 ${stat('A / H 交易标的',state.data.stocks.length,'只','四对A/H双重上市','⇆')}
 ${stat('模型折价 ≥25%',discounts.length,'只','不是已确认错杀','↘')}
 ${stat('已验证错杀警报',watch.length,'只','全部条件满足才触发','⚑')}
 </div>
 <div class="dashboard-grid">
 <div class="panel"><div class="panel-heading"><div><h2>估值位置对比</h2><p>当前股价 / 基准合理价值，数值越低代表模型折价越高</p></div><button class="panel-link" data-tab="valuation">查看估值矩阵 →</button></div>
 <div class="chart-bars">${sorted.map(r=>{const ratio=r.s.price/r.m.base;const w=Math.min(100,Math.max(0,ratio*50));return `<div class="bar-line"><span class="bar-label">${esc(r.c.name)} ${r.s.board}</span><div class="bar-track"><div class="bar-fill ${ratio<=0.75?'green-bar':ratio>=1?'red-bar':'gold-bar'}" style="width:${w}%"></div><div style="position:absolute;left:50%;height:100%;top:0;border-left:2px dashed #7a8ca0"></div></div><span class="bar-score mono">${fmt(ratio*100,0)}%</span></div>`}).join('')}</div><div class="legend"><span><b style="background:#62ad9f"></b>模型折价</span><span><b style="background:#c58f39"></b>接近基准</span><span><b style="background:#c96569"></b>模型溢价</span><span>竖线＝100%公允比值</span></div><p class="chart-caption">仅显示估值比值较低的8只。并不代表投资推荐次序。</p></div>
 <div class="side-stack">
 <div class="panel"><div class="panel-heading"><div><h2>宏观定价锚</h2><p>基准预测值与2026H1参考均价的区别</p></div><button class="panel-link" data-tab="scenario">调节假设 →</button></div><div class="commodities">${metalRow('gold','黄金','USD / oz','◆',state.data.market.scenarios.base.gold,4693)}${metalRow('silver','白银','USD / oz','◇',state.data.market.scenarios.base.silver,79)}${metalRow('copper','铜','USD / tonne','⬡',state.data.market.scenarios.base.copper,13083)}</div></div>
 <div class="panel"><div class="panel-heading"><div><h2>低估信号观察</h2><p>保守的“折价—下跌—基本面”三级验证</p></div><button class="panel-link" data-tab="signals">进入雷达 →</button></div>${highest.slice(0,4).map(r=>`<div class="list-row"><div><b>${esc(r.c.name)}</b> <span class="tick">${esc(r.s.ticker)}</span></div><div>${tag(r.status.text,r.status.tone)}</div></div>`).join('')}<p class="model-disclaimer">仅“5日股价下跌、商品未显著走弱、资料及现金流已审核”同时成立，才提示疑似情绪错杀。</p></div></div></div>
 <div class="three-col"><div class="panel mini-panel"><div class="block-title">① 追踪全球金属价格</div><p class="detail-meta">金银铜价格形成公开的外部价格锚，但并不代表价格不会出现剧烈投机波动。</p><button class="panel-link" data-tab="scenario">打开情景实验室 →</button></div><div class="panel mini-panel"><div class="block-title">② 衡量矿业利润弹性</div><p class="detail-meta">将生产规模、权益利润、产量及成本留存假设映射到每股盈利；钴/锡业务需补充建模。</p><button class="panel-link" data-tab="valuation">查看归母敏感度 →</button></div><div class="panel mini-panel"><div class="block-title">③ 等待估值预期差</div><p class="detail-meta">股价下跌不等于价值低估，必须经过安全边际及经营风险闸门。</p><button class="panel-link" data-tab="signals">查看低估条件 →</button></div></div>
 <div class="note-block" style="margin-top:20px"><strong>数据口径提醒：</strong>7只股票的参考价截至2026-10-08，新增5只截至2026-10-09；不同日期的数值不可用于严格的跨股日内套利判断。所有预估估值使用研究假设，不是实时行情或目标价。</div>`;
}
function stat(title,n,unit,foot,ico){return `<div class="stat-card"><div class="stat-top"><span class="stat-title">${title}</span><span class="stat-icon">${ico}</span></div><div><span class="value-xl">${esc(n)}</span> <span class="muted" style="font-size:12px">${unit}</span><div class="stat-foot" style="margin-top:8px">${foot}</div></div></div>`;}
function metalRow(id,name,unit,ico,price,ref){return `<div class="commodity"><div class="commodity-left"><div class="metal-icon ${id}">${ico}</div><div><div class="metal-title">${name}</div><div class="metal-sub">${unit} · 上半年参考 ${fmt(ref,0)}</div></div></div><div style="text-align:right"><div class="metal-price mono">${fmt(price,0)}</div><div class="metal-sub ${price>=ref?'positive':'negative'}">相对参考 ${pct(price/ref-1)}</div></div></div>`;}
function valuationPage(){
 const keyword=state.search.trim().toLowerCase();const rs=rows().filter(r=>(state.board==='all'||state.board===r.s.board)&&(!keyword||(r.c.name+r.s.ticker+r.c.sector).toLowerCase().includes(keyword))).sort((a,b)=>(b.m.margin??-100)-(a.m.margin??-100));
 const chosen=stock(state.selected)||state.data.stocks[0];const cc=company(chosen.companyId),vm=calc(chosen);const anchor=companyValue(cc,state.data.market,'base');
 return `${sectionTitle('12只股票 · 动态估值矩阵','点击股票查看经营参数，表格按基准安全边际从高到低排列。',`<div class="controls"><input id="search" class="searchbox" placeholder="查找公司 / 股票代码" value="${esc(state.search)}"/><select data-setting="board" class="field"><option value="all" ${state.board==='all'?'selected':''}>A股 + H股</option><option value="A" ${state.board==='A'?'selected':''}>仅A股</option><option value="H" ${state.board==='H'?'selected':''}>仅H股</option></select></div>`)}
 <div class="panel" style="padding:0"><div class="table-wrap"><table class="data-table"><thead><tr><th>公司 / 证券代码</th><th>市场</th><th class="num">参考收盘价</th><th class="num">悲观估值</th><th class="num">基准估值</th><th class="num">乐观估值</th><th class="num">安全边际</th><th>研究标签</th><th>日期</th></tr></thead><tbody>
 ${rs.map(r=>`<tr data-pick="${esc(r.s.ticker)}" style="cursor:pointer;${r.s.ticker===state.selected?'background:#f7fafc':''}"><td><div class="co-name">${esc(r.c.name)}</div><div class="co-ticker mono">${esc(r.s.ticker)}</div></td><td>${tag(r.s.board,'blue')}</td><td class="num money">${money(r.s.price,r.m.currency)}</td><td class="num">${money(r.m.bear,r.m.currency)}</td><td class="num" style="font-weight:850">${money(r.m.base,r.m.currency)}</td><td class="num">${money(r.m.bull,r.m.currency)}</td><td class="num score ${sign(r.m.margin)}">${pct(r.m.margin)}</td><td>${tag(r.status.text,r.status.tone)}</td><td class="date-text mono">${esc(r.s.asOf)}</td></tr>`).join('')||'<tr><td colspan="9" class="empty">暂无匹配结果</td></tr>'}
 </tbody></table></div><div class="table-footer"><span>模型安全边际 = 1 − 参考价 / 基准估值；“高折价”不代表已排除基本面风险。</span><span>${rs.length} 个标的</span></div></div>
 <div class="details"><div class="panel"><div class="panel-heading"><div><h2>选中标的：${esc(cc.name)} <span class="board">${esc(chosen.ticker)}</span></h2><p>${esc(cc.sector)} · 2026H1利润：${esc(cc.profitType)} · 证据等级：${esc(cc.confidence)}</p></div><button class="button tiny" data-tab="signals">编辑价格 →</button></div>
 <div class="duo-values"><div><span class="label-sm">预测年利润 · 亿元RMB</span><b class="mono">${fmt(anchor.annualProfitYi,1)}</b></div><div><span class="label-sm">预测EPS · RMB/股</span><b class="mono">${fmt(anchor.epsRmb,2)}</b></div><div><span class="label-sm">基准 PE</span><b class="mono">${fmt(anchor.pe,0)}×</b></div></div>
 <p class="detail-meta">${esc(cc.note)}</p><p class="model-disclaimer">归母盈利模型并非严格的FCFE折现。若股本发生变化、未来资本开支显著高于折旧，须调整模型。</p></div>
 <div class="panel"><div class="panel-heading"><div><h2>估值前需排除的风险</h2><p>针对单个矿企进行风险验证，而不是仅靠金属价格判定低估</p></div></div><ul class="flag-list">${cc.risks.map(t=>`<li>${esc(t)}</li>`).join('')}</ul><div class="riskbox">当前状态：${tag(stockStatus(chosen,cc,state.data.market).text,stockStatus(chosen,cc,state.data.market).tone)}　·　需要人工完成资料与现金流核验。</div><p class="model-disclaimer">参考材料：<a class="inline-link" href="${link(cc.source)}" target="_blank" rel="noopener noreferrer">相关中报及资讯 →</a></p></div></div>`;
}
function scenarioPage(){
 const c=company(state.labCompany)||state.data.companies[0];const m=state.data.market;
 const selectedCase=m.scenarios[state.labCase];
 const base=companyValue(c,m,'base');
 const maxv=Math.max(...CASES.map(x=>companyValue(c,m,x).fairCny),1);
 const metals=[['gold','黄金价格','USD / oz',2500,6000,50],['silver','白银价格','USD / oz',25,130,1],['copper','铜价格','USD / 吨',7000,18000,100]];
 return `${sectionTitle('商品价格 · 情景实验室','修改金银铜价格，三情景利润和A/H每股估值立即重新计算。','<button class="button" data-action="reset-scenarios">↺ 重置情景假设</button>')}
 <div class="lab-layout"><div class="panel"><div class="panel-heading"><div><h2>情景参数</h2><p>所有数值为未来12个月平均价格假设，不是现价预测</p></div></div>
 <div class="small-form"><div><label class="field-label">操作公司</label><select class="field" style="width:100%" data-setting="labCompany">${state.data.companies.map(co=>`<option value="${esc(co.id)}" ${c.id===co.id?'selected':''}>${esc(co.name)}</option>`).join('')}</select></div><div><label class="field-label">调节情景</label><select class="field" style="width:100%" data-setting="labCase">${CASES.map(s=>`<option value="${s}" ${s===state.labCase?'selected':''}>${CASE_LABEL[s]}情景</option>`).join('')}</select></div></div>
 ${metals.map(([id,name,unit,min,max,step])=>`<div class="range-block"><div class="range-top"><label>${name}<span style="color:#93a1af;font-weight:400"> · ${unit}</span></label><span class="range-value mono">${fmt(selectedCase[id],0)}</span></div><input aria-label="${name}" class="range-input" type="range" min="${min}" max="${max}" step="${step}" value="${selectedCase[id]}" data-metal="${id}"/><div class="range-hint"><span>${fmt(min,0)}</span><span>${fmt(max,0)}</span></div></div>`).join('')}
 <div class="sep"></div><div class="input-matrix"><div><label class="field-label">当前情景 PE（倍）</label><input class="field mono" type="number" min="0" max="100" step="0.5" value="${c.pe[state.labCase]}" data-edit="pe"/></div><div><label class="field-label">盈利可持续系数</label><input class="field mono" type="number" min="0" max="2" step="0.05" value="${c.sustain}" data-edit="sustain"/></div><div><label class="field-label">非金属利润增长率</label><input class="field mono" type="number" min="-0.9" max="2" step="0.05" value="${c.growth}" data-edit="growth"/></div></div>
 <p class="model-disclaimer">系数是建模假设，而不是从财报中直接披露的净利润率。调整会改变所有持有该公司股票的估值结果。</p></div>
 <div class="panel"><div class="panel-heading"><div><h2>${esc(c.name)} · 三情景估值</h2><p>统一以人民币每股价值展示；H股价格需要按港元汇率折算</p></div>${tag('敏感度：'+c.confidence,c.confidence==='低'?'negative':'blue')}</div>
 ${CASES.map(x=>{const v=companyValue(c,m,x);const w=Math.max(0,v.fairCny/maxv)*100;return `<div class="scenario-bar"><div style="min-width:110px"><strong>${CASE_LABEL[x]}情景</strong><p>PE ${fmt(v.pe,0)}× · 盈利 ${fmt(v.annualProfitYi,1)}亿</p></div><div style="flex:1;height:14px;background:#f1f4f6;border-radius:4px;overflow:hidden"><div style="height:100%;background:${x==='bear'?'#b6c3ce':x==='base'?'#caa363':'#56a797'};width:${w}%;border-radius:4px"></div></div><div style="text-align:right;min-width:95px"><span class="scenario-value mono">¥${fmt(v.fairCny,2)}</span><div class="label-sm" style="margin-top:5px">EPS ${fmt(v.epsRmb,2)} RMB</div></div></div>`}).join('')}
 <div class="sep"></div><div class="block-title" style="margin-top:17px">基准情景 · 利润贡献拆解（亿元人民币）</div><div class="impact"><div><span class="label-sm">年化正常化盈利</span><b class="mono">${fmt(base.normalized,1)}</b></div><div><span class="label-sm">黄金价格变化</span><b class="mono ${sign(base.impacts.gold)}">${fmt(base.impacts.gold,1)}</b></div><div><span class="label-sm">铜价变化</span><b class="mono ${sign(base.impacts.copper)}">${fmt(base.impacts.copper,1)}</b></div></div><div class="note-block" style="margin-top:19px"><strong>计算说明：</strong>价格影响＝（情景价格－H1参考价格）×H1金属量×2×归母留存系数×汇率。利润再除以总股本，并乘情景PE。白银的敏感度包含在总利润中，可在数据页查阅。</div></div></div>`;
}
function spreadPage(){
 const pairs=ahPairs(state.data);
 return `${sectionTitle('A/H 同股溢价 · 货币换算','按同股不同价比较价格差异；港股折价不等同套利空间。',`<div class="pillrow">${tag(`HKD/CNY ${fmt(state.data.market.hkdCny,5)}`,'blue')} ${tag('需按同日交易价比较')}</div>`)}
 <div class="stat-grid" style="grid-template-columns:repeat(${Math.min(4,pairs.length)},minmax(0,1fr))">${pairs.map(p=>`<div class="stat-card"><span class="stat-title">${esc(p.company.name)}</span><div><div class="value-xl ${p.premium>=0?'accent-gold':'accent-green'}">${pct(p.premium)}</div><div class="stat-foot" style="margin-top:10px">A股相对H股溢价</div></div></div>`).join('')}</div>
 <div class="panel" style="padding:0"><div class="table-wrap"><table class="data-table"><thead><tr><th>公司</th><th class="num">A股（RMB）</th><th class="num">H股（HKD）</th><th class="num">H股折人民币</th><th class="num">A相对H溢价</th><th>数据同日性</th></tr></thead><tbody>${pairs.map(p=>`<tr><td><div class="co-name">${esc(p.company.name)}</div></td><td class="num">¥${fmt(p.a.price)}</td><td class="num">HK$${fmt(p.h.price)}</td><td class="num">¥${fmt(p.hInCny)}</td><td class="num score ${sign(p.premium)}">${pct(p.premium)}</td><td>${tag(p.sameDate?'同日快照':'非同日，请勿比较',p.sameDate?'blue':'negative')}</td></tr>`).join('')}</tbody></table></div></div>
 <div class="note-block" style="margin-top:18px"><strong>交易约束：</strong>A/H 并非完全可自由兑换的同一交易账户股份。港股通资格、南向交易日、股息税、交易费用、汇率和流动性都会影响实际投资回报；差价未必自动收敛。</div>`;
}
function signalsPage(){
 const watch=rows().filter(r=>r.status.code==='watch');
 const rs=rows().sort((a,b)=>(b.m.margin??-100)-(a.m.margin??-100));
 const s=stock(state.selected)||state.data.stocks[0];const c=company(s.companyId),m=calc(s),stat=stockStatus(s,c,state.data.market);
 return `${sectionTitle('情绪性杀跌 · 五重验证雷达','只有通过价格、商品、估值和基本面闸门才会触发；本页面不会发送后台通知。',tag(`确认触发 ${watch.length} 只`,watch.length?'positive':'neutral'))}
 <div class="panel" style="margin-bottom:18px"><div class="panel-heading"><div><h2>目前已触发的研究提示</h2><p>报警不是交易指令，优先复核交易所公告和风险资料</p></div></div>${watch.length?watch.map(r=>`<div class="list-row"><b>${esc(r.c.name)} ${esc(r.s.ticker)}</b>${tag('疑似情绪错杀','positive')}</div>`).join(''):'<div class="no-data">暂无满足全部验证条件的标的。部分资料缺失是刻意保留的安全闸门，不会自动视为“无风险”。</div>'}</div>
 <div class="details"><div class="panel"><div class="panel-heading"><div><h2>信号列表</h2><p>点选任一标的，更新核验状态与参考价格</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>公司 / 标的</th><th class="num">折价</th><th>核验结论</th></tr></thead><tbody>${rs.map(r=>`<tr data-pick="${esc(r.s.ticker)}" style="cursor:pointer;background:${r.s.ticker===s.ticker?'#f5f9fc':''}"><td><b>${esc(r.c.name)}</b><div class="co-ticker mono">${esc(r.s.ticker)}</div></td><td class="num ${sign(r.m.margin)}">${pct(r.m.margin)}</td><td>${tag(r.status.text,r.status.tone)}</td></tr>`).join('')}</tbody></table></div></div>
 <div class="panel"><div class="panel-heading"><div><h2>更新核验 · ${esc(c.name)}</h2><p>${esc(s.ticker)} · ${esc(s.asOf)} · ${tag(stat.text,stat.tone)}</p></div></div>
 <div class="small-form"><div><label class="field-label">最新参考股价（${s.board==='H'?'HKD':'CNY'}）</label><input class="field mono" type="number" min="0.01" step="0.01" value="${s.price}" data-stockfield="price" /></div><div><label class="field-label">参考价日期</label><input class="field" type="date" value="${esc(s.asOf)}" data-stockfield="asOf" /></div><div><label class="field-label">五个交易日前同市场收盘价</label><input class="field mono" type="number" min="0.01" step="0.01" placeholder="缺失，不会触发" value="${finite(s.previous5d)?s.previous5d:''}" data-stockfield="previous5d" /></div><div><label class="field-label">${METAL_LABEL[c.primaryMetal]}近5日变动（百分数）</label><input class="field mono" type="number" step="0.1" placeholder="例如 -2" value="${finite(state.data.market.metal5d[c.primaryMetal])?state.data.market.metal5d[c.primaryMetal]*100:''}" data-stockfield="metal5d" /></div><div><label class="field-label">重大经营/公告事件</label><select class="field" data-stockfield="event">${[['unknown','未核验'],['none','确认无重大利空'],['material','确认存在实质利空']].map(([v,l])=>`<option value="${v}" ${s.event===v?'selected':''}>${l}</option>`).join('')}</select></div><div><label class="field-label">现金流 / 盈利真实性</label><select class="field" data-stockfield="cashflow">${[['pending','待核验'],['pass','核验通过'],['fail','存在问题']].map(([v,l])=>`<option value="${v}" ${s.cashflow===v?'selected':''}>${l}</option>`).join('')}</select></div><div><label class="field-label">数据完整程度</label><select class="field" data-stockfield="quality">${[['pending','待核验'],['complete','已全部复核']].map(([v,l])=>`<option value="${v}" ${s.quality===v?'selected':''}>${l}</option>`).join('')}</select></div><div><label class="field-label">公司研究置信度</label><input class="field" readonly value="${esc(c.confidence)}（源自基线质量）" /></div></div>
 <div class="riskbox">当前模型基准价：${money(m.base,m.currency)} · 安全边际 ${pct(m.margin)} · 近5日股价 ${pct(m.change5d)}。低置信度企业不能在未经附加审计的情况下触发“疑似错杀”。</div><p class="model-disclaimer">⚠ 这些风险确认依赖人工查验财报、公告、矿山产量和实质性利空。此网页不连接任何实时行情数据接口，也不会在后台自动推送消息。</p></div></div>`;
}
function sourcesPage(){
 return `${sectionTitle('来源与数据治理','研究透明比漂亮的预测数字更重要。财报口径、价格日期、假设和模型局限全部公开。',`<button class="button" data-action="export">↓ 导出当前研究快照</button>`)}
 <div class="panel" style="margin-bottom:18px"><div class="panel-heading"><div><h2>模型全局假设</h2><p>修改后可通过 JSON 导入导出保存，状态默认保存在当前浏览器。</p></div></div><div class="small-form" style="grid-template-columns:repeat(4,minmax(0,1fr))"><div><label class="field-label">USD/CNY</label><input class="field mono" type="number" min="0.01" step="0.001" value="${state.data.market.usdCny}" data-marketfield="usdCny"/></div><div><label class="field-label">HKD/CNY</label><input class="field mono" type="number" min="0.01" step="0.001" value="${state.data.market.hkdCny}" data-marketfield="hkdCny"/></div><div><label class="field-label">研究快照日期</label><input type="date" class="field" value="${esc(state.data.updatedAt)}" data-marketfield="updatedAt"/></div><div><label class="field-label">数据类型</label><input readonly class="field" value="历史快照 / 非实时"/></div></div></div>
 <div class="sources-grid">${state.data.companies.map(c=>`<div class="panel source-card"><div class="panel-heading" style="margin-bottom:8px"><div><h3>${esc(c.name)}</h3><span class="date-text">${esc(c.sector)} · 可信度 ${esc(c.confidence)}</span></div>${tag(c.profitType,c.profitType.includes('非扣非')?'gold':'blue')}</div><div class="list-row"><span>2026H1利润</span><b class="mono">${fmt(c.profitH1,2)} 亿${c.profitCurrency==='USD'?'美元':'元'}</b></div><div class="list-row"><span>总股本</span><b class="mono">${fmt(c.sharesYi,3)} 亿股</b></div><div class="list-row"><span>H1 金 / 银 / 铜量</span><span class="mono" style="font-size:10px">${fmt(c.volumesH1.gold,2)}t / ${fmt(c.volumesH1.silver,1)}t / ${fmt(c.volumesH1.copper,0)}t</span></div><p>${esc(c.note)}</p><a href="${link(c.source)}" target="_blank" rel="noopener noreferrer">来源材料 ↗</a></div>`).join('')}</div>
 <div class="note-block" style="margin-top:19px"><strong>局限与检查清单：</strong>① 部分H1利润为归母非扣非；② 部分金属“产量”用作“销量”的近似代理；③ 固定利润留存系数无法反映全部税费、少数股东、套保、AISC和资本开支；④ 洛阳钼业钴/钨与增发稀释未完整建模；⑤ 盛达资源销量口径待验证；⑥ 不自动获取行情。建议用最新三季报及时修正基线。</div>`;
}
function render(){document.title=`${navs.find(n=>n[0]===state.tab)?.[2]||'研究总览'} | ORE RADAR`;app.className='';app.innerHTML=shell();}
function toast(s){state.message=s;render();}
function triggerDownload(data,name,mime){const blob=new Blob([data],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function changed(target) {
 if(target.dataset.tab){const next=target.dataset.tab;state.tab=next;state.message='';history.replaceState(null,'','#'+next);render();return;}
 if(target.dataset.pick){state.selected=target.dataset.pick;render();return;}
 if(target.dataset.action==='export'){triggerDownload(JSON.stringify(state.data,null,2),'ore-radar-'+new Date().toISOString().slice(0,10)+'.json','application/json');return;}
 if(target.dataset.action==='reset'){if(window.confirm('确定恢复全部默认参数和价格快照吗？浏览器保存的修改将被覆盖。')){localStorage.removeItem(LS);init(true);}return;}
 if(target.dataset.action==='reset-scenarios'){const defaults={bear:{gold:3600,silver:45,copper:10000},base:{gold:4200,silver:65,copper:12500},bull:{gold:4800,silver:85,copper:14500}};state.data.market.scenarios=defaults;save();render();return;}
}
app.addEventListener('click',e=>{const target=e.target.closest('[data-action],[data-tab],[data-pick]');if(target)changed(target);});
app.addEventListener('input',e=>{if(e.target.id==='search'){state.search=e.target.value;return;}});
app.addEventListener('change',e=>{
 const el=e.target;
 if(el.id==='file-input' && el.files?.[0]){const file=el.files[0];if(file.size>2e6){toast('文件过大，请导入小于2MB的研究 JSON');return;}file.text().then(t=>{const incoming=JSON.parse(t);validateSnapshot(incoming);state.data=incoming;save();toast('研究快照已导入，所有数据仅在浏览器本地保存。');}).catch(err=>toast('导入失败：'+err.message));return;}
 if(el.id==='search'){state.search=el.value;render();return;}
 if(el.dataset.setting){state[el.dataset.setting]=el.value;render();return;}
 if(el.dataset.metal){const v=Number(el.value);if(finite(v)&&v>0){state.data.market.scenarios[state.labCase][el.dataset.metal]=v;save();render();}return;}
 if(el.dataset.edit){const v=Number(el.value);if(!finite(v))return;const co=company(state.labCompany);if(el.dataset.edit==='pe'&&v>=0&&v<=100)co.pe[state.labCase]=v;
 if(el.dataset.edit==='sustain'&&v>=0&&v<=2)co.sustain=v;
 if(el.dataset.edit==='growth'&&v>=-0.9&&v<=2)co.growth=v;
 save();render();return;}
 if(el.dataset.marketfield){let v=el.dataset.marketfield==='updatedAt'?el.value:Number(el.value);if(el.dataset.marketfield!=='updatedAt'&&(!finite(v)||v<=0))return;
 if(el.dataset.marketfield==='updatedAt')state.data.updatedAt=v;else state.data.market[el.dataset.marketfield]=v;save();render();return;}
 if(el.dataset.stockfield){const s=stock(state.selected);const field=el.dataset.stockfield;
 if(field==='metal5d'){const v=el.value.trim()===''?null:Number(el.value)/100;if(v===null||(finite(v)&&v>=-1&&v<=5))state.data.market.metal5d[company(s.companyId).primaryMetal]=v;}
 else if(field==='previous5d'){const v=el.value.trim()===''?null:Number(el.value);if(v===null||(finite(v)&&v>0))s.previous5d=v;}
 else if(field==='price'){const v=Number(el.value);if(finite(v)&&v>0)s.price=v;}
 else if(field==='asOf'){if(/^\d{4}-\d{2}-\d{2}$/.test(el.value))s.asOf=el.value;}
 else s[field]=el.value;save();render();return;}
});
window.addEventListener('hashchange',()=>{const h=location.hash.replace('#','');if(navs.some(x=>x[0]===h)){state.tab=h;render();}});
async function init(reset=false){
 try{const r=await fetch(BASE_URL);if(!r.ok)throw Error('HTTP '+r.status);const defaultData=await r.json();validateSnapshot(defaultData);
  let stored=null;if(!reset){try{stored=JSON.parse(localStorage.getItem(LS)||'null');if(stored)validateSnapshot(stored);}catch{try{localStorage.removeItem(LS);}catch{}stored=null;}}
  state.data=stored||defaultData;state.message='';render();
 }catch(e){app.innerHTML=`<div class="loading-block" style="margin:15vh auto;max-width:580px;padding:30px;background:white;border-radius:18px"><h2>无法读取数据</h2><p>${esc(e.message)}</p><p>请在本项目目录启动本地 HTTP 服务：<code>python3 -m http.server 4173</code>，然后打开 http://127.0.0.1:4173/ ，而不是直接双击 HTML 文件。</p></div>`;}
}
init();
