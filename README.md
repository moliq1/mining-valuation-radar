# ORE Radar · 金银铜矿业 A/H 动态估值雷达

**8 家矿业上市公司、12 只 A/H 股票的交互式估值研究仪表盘**。无需服务端或第三方 JavaScript 依赖，可以通过 GitHub Pages 托管。

## 功能
- 研究总览：商品价格锚、估值折价、风险提示；
- 三情景估值：调整金价/银价/铜价、估值 PE、盈利可持续系数，实时计算每股估值；
- A/H 价差：同股港币/人民币汇率转换，并标记异步交易日期；
- 情绪错杀雷达：需同时满足**五日股价跌幅≤−8%、金属五日跌幅≥−3%、估值安全边际≥25%、无重大经营利空、现金流与资料审核通过**；数据缺失不触发警报；
- 手工维护股价、交易日、商品价格、核验状态；本地持久化及 JSON 导入导出；
- 资料来源、模型假设、风险提示。

## 本地运行
```bash
python3 -m http.server 4173 --bind 127.0.0.1
```
访问 http://127.0.0.1:4173/ ，直接用 `file://` 打开分模块网页可能触发浏览器 CORS 限制。

运行测试（需 Node.js 18+）：
```bash
npm test
```

## GitHub Pages
仓库 **Settings → Pages → Build and deployment → Deploy from a branch → main / (root) → Save**。
成功启用并部署后，网址应为 `https://moliq1.github.io/mining-valuation-radar/`。仅推送代码不会自动启用 Pages。

## 数据与模型口径
数据为**2026-10-08 与 2026-10-09 历史快照**，不是自动实时行情：前 7 只股价截至 10-08，其余 5 只截至 10-09。不同日期不可视作严格可比。
采用 **2026H1 利润 × 2 × 盈利可持续系数**，叠加金、银、铜价格相对于 H1 参考均价变化的利润敏感度，再乘以各情景人工假设的 PE。模型不是 DCF、不是已审计的正式盈利预测，也不是投资建议。
部分公司产量暂作销量代理，少数股东权益、AISC、税费、净债务、资本开支可能改变结论。洛阳钼业钴/钨/贸易及可转债稀释未完整建模，盛达资源银产销量口径有待进一步核对。紫金矿业与紫金黄金国际存在母子公司敞口重叠。

**V1.1：现已具备可选的 GitHub Actions EOD 自动更新管道（默认未启用）。** 仓库主人需要自行开通有权公开展示的行情源、设置 API 密钥及确认发布权限。未配置时继续显示历史快照。没有自动财报抓取、后台邮件/微信提醒；基本面闸门从不由行情自动通过。

## 开启每日收盘数据同步（需要行情授权）

⚠ **公开 GitHub Pages 上重新发布 A/H 交易所行情，可能需要额外的外部展示或再分发授权。** Twelve Data 个人套餐主要面向个人/内部使用，其官网显示香港、上海、深圳交易所可能要求 Pro 以上套餐；报价/许可资格须向数据商核实。**仅有 API key 不自动证明你有向公开网站分发原始数据的权利。** 不要在仓库里上传 API key。

如具备相应行情使用及公开展示权：
1. Repository → Settings → Secrets and variables → Actions → **Secrets** → 新建 `TWELVE_DATA_API_KEY`。
2. 同一页 **Variables** → 新建 `MARKET_DATA_PUBLICATION_AUTHORIZED`，值设为 `true`。此步骤表示你已自行核实授权。
3. Repository → Actions → **Market EOD sync (licensed provider)** → Run workflow，建议首次选择 **dry_run = true** 查看哪些市场/代码有实际数据。
4. 检查 12 个标的匹配交易所/货币与最新交易日；干跑通过后再选择 `dry_run = false`，之后 GitHub Actions 会尝试在北京时间 **交易工作日 19:25** 自动更新（GitHub 调度并不保证精确时间）。
5. 部分产品或市场若套餐无权限，脚本将记录失败，旧数据保留并显式标记。不保证所有代码在所选套餐里可获取。

自动化代码使用 Twelve Data 的 `/time_series` EOD 日线，限制每次约 17 条行情请求并分批放慢以适应限额。铜商品及跨市场 FX 若当前计划不支持将保持未更新或缺失，不会杜撰。
系统会按 6 个真实日线收盘计算前 5 个交易间隔的回报；校验市场 MIC、币种、时间戳、同日价格差异及疑似除权异常，失败不覆盖股票价格。
**仅当服务端发布更新日期晚于本地快照**，浏览器会合并远端的新价格，同时保留本地调整的金银铜情景与盈利/PE参数；旧风险审核结果不会随新行情自动延用。
可以点击顶部 **获取最新快照** 立即检查远端数据。遇到节假日、半日市或数据延迟，以各股票自身日期为准。

## 代码结构
```
index.html                 网页入口
src/style.css              样式与响应式布局
src/app.js                 页面、交互与本地缓存
src/model.js               纯估值函数、校验与风险规则
src/market-sync.js         数据校验、行情合并、价格源隔离
scripts/update-market.mjs  Twelve Data EOD 适配器，命令行干跑验证
tests/market-sync.test.js  数据准确性/异常/安全闸门测试
.github/workflows/market-sync.yml  工作日定时更新（授权后启用）
data/snapshot.json         8家公司/12只股票研究参数
tests/model.test.js        Node.js 单元测试
.github/workflows/check.yml  GitHub Actions 测试
```

## License
研究演示项目。行情来源、财报及其他第三方数据分别受其原始提供方条款约束。
