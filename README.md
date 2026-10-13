## 获取行情走势图的下一步：第三行情备源与可下载的只读研究包（v1.4）

### CMOC（洛阳钼业）独立第三备源

上次 GitHub Actions 的 `603993.SH` 与 `03993.HK` 因东方财富链路中断未能成功采集。现在：

- **A股 603993.SH**：AKShare → efinance → **BaoStock**（`sh.603993`，日线，`adjustflag=3` 不复权）。
- **H股 03993.HK**：AKShare → efinance → **Yahoo Finance / yfinance**（`3993.HK`，`Close`、`auto_adjust=False`，需核验 HKD 和市场标识）。
- 只有前两路失败时才访问第三方；历史日期、币种、证券标识、数据时效和前五交易日异常仍严格校验。第三源可用性不保证；Yahoo 属非官方接口、数据使用受其许可限制。

### 一次 GitHub Actions 干跑 → 下载 CSV → 浏览器看走势

1. 打开 [免费行情工作流](https://github.com/moliq1/mining-valuation-radar/actions/workflows/free-market-sync.yml)，选择 **Run workflow**、保持 `dry_run=true`。
2. 等待任务 `fetch` 成功，点击本次运行的 **Summary** 页面，在下方 **Artifacts** 下载 `ore-eod-research-<run_id>` 压缩包（保留2天）。
3. 解压后获得 `market-history.csv`、`market-history.json`、`snapshot.json`、`data-quality-report.json`；重点查看 report 的 **fetchFailures** 和 **updated**。如果源失败则相应日期不会被补造。
4. 打开 [ORE Radar 走势图](https://moliq1.github.io/mining-valuation-radar/#history)，选择 **导入 CSV / JSON**，上传压缩包内的 **`market-history.csv` 或 `market-history.json`**，即可在你当前的浏览器中显示真实历史收盘曲线。图表会识别 `gold_instrument=SGE Au99.99` 和 `gold_unit=CNY/g`，并与 A/H 股票的不同计价币种并列显示。
5. 上传数据仅保存在**当前浏览器本地存储**；不提交到仓库。换浏览器/清除浏览器数据会失去手动导入的记录。

**重要的隐私/版权界限：**在公开 GitHub 仓库，Actions artifact 即便没有部署到 Pages，也**可能被有仓库读取权限的人访问**，因此不能称为私密存储。若需要严格在自己电脑使用数据，执行：

```bash
pip install akshare efinance baostock yfinance pandas
python scripts/free_market_sync.py --output-dir ./private_market_data
```

随后把本地的 `private_market_data/market-history.csv` 上传网页即可，GitHub 不会保存这份行情原始文件。项目不会在未核实第三方再分发授权时自动把原始行情加入公开 GitHub Pages。部分 Yahoo 数据在公司分股事件前有拆股调整，不代表含分红再投的实际收益；国际现货金 XAU/USD 与上海 Au99.99 不能互换。

---

# ORE Radar · 金银铜矿业 A/H 动态估值雷达

## 紫金矿业 × 黄金走势图（原生 SVG，浏览器直接读数，无 TradingView iframe）

在 [走势图](https://moliq1.github.io/mining-valuation-radar/#history) 最上方分别绘制：
- **国际现货金 XAU/USD**（美元/盎司）与 **紫金矿业 A 601899.SH**（人民币/股）；
- **国际现货金 XAU/USD** 与 **紫金矿业 H 02899.HK**（港币/股）。

页面直接从浏览器向东方财富网页日 K 数据接口（`push2his.eastmoney.com`）请求日线，并在页面通过本地 SVG 绘制**共同基准=100**的两条相对涨跌曲线，支持 1M / 3M / 6M / 1Y / 全部区间和悬停查看日期、收盘价。**不再依赖 TradingView 跨站 iframe**，也不会将免费行情复制进公开 GitHub 仓库。股票采用不复权日线，收益率比较未进行外汇对冲和分红再投资调整。

三种证券的网页接口代码为：国际现货金 `122.XAU`、A 股 `1.601899`、H 股 `116.02899`。如果 XAU 历史行情无法读取，改用 **上金所 Au99.99 `118.AU9999`，单位 CNY/克**，并在图表中更改黄金品种标签；不会谎称其为国际现货金。

上游行情是网页非正式接口，不是受 SLA 保障的数据服务，可能遇到反爬、地区网络限制或接口变更。**若金价或股票接口失败，将显示明确错误及直达原始行情源的链接，绝不伪造走势。** 页面底部保留用户 CSV/JSON 导入的原生统计模块作为可靠离线备选。

数据在访客的浏览器内直接使用，不额外把原始日线公开存储；但直接调用上游接口仍需遵守数据方的使用条款，不保证能在所有地区和网络中成功获取。


**8 家矿业上市公司、12 只 A/H 股票的交互式估值研究仪表盘**。无需服务端或第三方 JavaScript 依赖，可以通过 GitHub Pages 托管。

## 功能
- 研究总览：商品价格锚、估值折价、风险提示；
- 三情景估值：调整金价/银价/铜价、估值 PE、盈利可持续系数，实时计算每股估值；
- A/H 价差：同股港币/人民币汇率转换，并标记异步交易日期；
- 情绪错杀雷达：需同时满足**五日股价跌幅≤−8%、金属五日跌幅≥−3%、估值安全边际≥25%、无重大经营利空、现金流与资料审核通过**；数据缺失不触发警报；
- 手工维护股价、交易日、商品价格、核验状态；本地持久化及 JSON 导入导出；
- 资料来源、模型假设、风险提示。


## 免费 A/H 行情采集（v1.3 · AKShare 主源 + efinance 备用）

现在可以在**不申请 API Key**的情况下从 Python 拉取 A/H 历史日线。默认 `scripts/free_market_sync.py` 以**只读取、不改写 GitHub 数据**的干跑模式执行；AKShare 先请求不复权收盘价，无法取得或数据过旧时才尝试 efinance（`fqt=0`）。

覆盖所有 **12 只 A/H 股票**。历史走势图中的黄金可使用 **上海黄金交易所 Au99.99（CNY/克）**：这**不是**国际伦敦现货黄金 XAU/USD（USD/盎司），不能代替国际金价用于美元金价估值。界面会自动切换黄金品种和单位标签。为了避免币种/时区错配，程序不会尝试在未核验汇率时把 Au99.99 转成美元/盎司，也不会凭此自动通过情绪错杀雷达中的国际金价检验。

### 本地免费运行（无需 API Key）

需要 Python 3.11+：

```bash
python -m pip install "akshare>=1.16,<3" "efinance>=0.5,<1" "pandas>=2,<3"
python scripts/free_market_sync.py
# 默认只打印真实市场请求、来源及校验结果，不覆盖 data/ 中的文件
python scripts/free_market_sync.py --output-dir ./private_market_data
# 将通过校验的结果写到本机私有文件夹，不发布到公开 GitHub 仓库
```

运行测试（测试使用模拟测试夹具，不访问行情服务器）：`python -m unittest discover -s tests -p 'test_*.py' -v`。

**数据标准：**仅接收价格大于0、有效日期和正确交易代码的日线；根据交易市场独立计算前5交易日收益，拒绝9天以上的过时数据、重复日期或与仓库同日行情差异过大的数据；不会自动填充周末、节假日或停牌缺口。采集失败时保留旧数据，新的股票收盘价会使原有基本面事件/现金流审核状态重新待核验。

### GitHub Actions 免费采集工作流

在 <https://github.com/moliq1/mining-valuation-radar/actions/workflows/free-market-sync.yml> 找到 **Free EOD research sync (AKShare / efinance)**，选择 **Run workflow → dry_run=true**：不需要密钥或公开数据授权，即可测试 GitHub 的执行环境能否访问接口（获取失败会在日志中注明）。这不会让数据自动出现在公开 GitHub Pages。

⚠ **AKShare/efinance 免费读取 ≠ 东方财富或交易所授权向公众再分发。** 若以后希望每天自动提交到公开仓库，必须先取得上游行情公开展示/再分发许可，并自行在仓库 **Settings → Secrets and variables → Actions → Variables** 中设置以下变量：

- `MARKET_DATA_PUBLICATION_AUTHORIZED=true`：确认网站公开展示获得授权；
- `FREE_DATA_REDISPLAY_RIGHTS_VERIFIED=true`：确认 AKShare、efinance 上游及上金所相应数据使用/再分发条款；
- `FREE_MARKET_SYNC_ENABLED=true`：明确启用这一条免费的自动发布工作流。

**只有三个变量全部明确设置，且手工执行 `dry_run=false` 或进入预定工作日时，才可能提交到 GitHub Pages。** 不应在尚未取得授权时自行把变量设为 true。这些开关只是安全闸门，不是授权凭证。公开版本如果没有权利，应继续使用已有的**用户 CSV 本地导入**方式，或更换具有再分发授权的行情提供商。

另有可选的 `market-sync.yml`（Twelve Data），需要付费覆盖范围与展示授权。**只启用一种自动公开同步方案**，避免多个数据源同时写入行情文件；两种工作流共用 concurrency group。

### 数据质量与局限

- 股票价格均按不复权 EOD、原市场本币保存：A 股人民币，H 股港币。未完成除权调整时，跨除权日的历史收益不等于真实投资者总回报。
- 上金所 `Au99.99` 使用 CNY/克，和 XAU/USD 的定价市场、交易时间、汇率均不同；归一化图可以研究方向，但不能把前者数字直接当成国际金价。
- 东方财富、AKShare、efinance 的数据可用性可能随网站、反爬、接口变化而波动；每日运行**不是**行情服务质量保证。
- 金属/估值参数和财报利润**不会**因下载股票价格就自动更新；缺少独立核实的国际金价时，国际金价的5日变化仍为 `null`，相关错杀信号不会误报。

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

**V1.3：提供免费的 AKShare 主源 / efinance 备源（默认只读），以及可选的 Twelve Data GitHub Actions EOD 同步；默认均不向公开网站推送未经授权的数据。** 仓库主人需要自行开通有权公开展示的行情源、设置 API 密钥及确认发布权限。未配置时继续显示历史快照。没有自动财报抓取、后台邮件/微信提醒；基本面闸门从不由行情自动通过。

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


## 紫金矿业 2026—2028 年逐年模型（v2）

访问 [forecast.html](./forecast.html) 或在主面板点击「紫金三年成长预测」。该页面不依赖实时行情接口，以 2026 年半年报披露及公司 2026—2028 年产量规划作为锚，增加可调整的 2027 年插值、销量转换比例、销售成本、金铜增量归母留存比例及逐年金铜价格情景。

- **2026 H1 已实现部分不变**：2026 全年 = H1 已实现扣非归母 + 2026 H2 产销/价格预测 + H2 其他业务归母余额；未来情景价格不重新计入 H1。
- **2027/2028 单独计算**：金、铜矿产量规划先经模型销量/产量比例调整，逐年计算金/铜归母贡献，其他业务余额单独增长，杜绝「非金属增长率」乘整个公司利润的错置。
- **估值**：目标年度预期 EPS × 模型前瞻 PE，再按年度差及折现率折回 2026 年末，同时计算 A/H 本币换算、模型安全边际及当前股价隐含的目标年度金价。它不是证券公司的投资目标价。
- **现金校验**：归母利润 × 人工 FCFE 转换比例，只展示可能的现金流及收益率，不充当完整矿山 NAV。准确的矿山 NAV 需要单矿储量、矿山寿命、回收率、逐年资本开支、税费、少数股东权益及闭矿成本等额外数据。
- **研究参数限制**：2026H1 成本信息来自分产品单位销售成本，只是售出产品成本量级近似而非 AISC；金、铜生产量包含部分权益矿项目，披露的销售量口径未必同质；销量/产量比率不得当成真实回收率。2027 产量仅是模型插值。

关键可核验公告：[紫金矿业 2026 年中期业绩](https://www.zjky.cn/investor/2026yeji.htm)、[2026H1 销售与单位成本](https://vip.stock.finance.sina.com.cn/corp/view/vCB_AllBulletinDetail.php?id=12519310&stockid=601899)、[2026—2028 年产量规划](https://paper.cnstock.com/html/2026-02/10/content_2179725.htm)。报告目标是前瞻性规划，不能视为业绩承诺。

快速验证：

```bash
npm run check
npm test
```

## 走势图 / 可视化（v1.2）

主导航新增「走势图」。支持 **国际现货金 XAU/USD（USD/金衡盎司）与紫金矿业 A 股 601899.SH（人民币）或 H 股 02899.HK（港币）**历史收盘价对比，包括：

- **1M、3M、6M、1Y、ALL** 时间选择；A股、H股、A/H同屏；
- **归一化起点=100**（适合不同币种和绝对价格尺度下的相对涨跌）与单市场 **双纵轴实际价格**；
- 光标悬停显示日期、原始价格和累计涨跌幅；展示按日期严格对齐的日收益 Pearson 相关系数（共同交易日少于6个时不计算）；
- 没有交易的日期保持缺失，不跨节假日填充或捏造行情；相关性不代表因果；
- 支持导入 CSV：表头 `date,gold,zijin_a,zijin_h`，日期 `YYYY-MM-DD`，金价 **USD/oz**，A股 **CNY/股**，H股 **HKD/股**；缺失日可以留空。用本地浏览器存储保留上传的数据，可随时清除恢复仓库版本。

### 自动获取历史日线（许可要求）

图表的默认仓库数据文件为 `data/market-history.json`，初始为空，**不是模拟历史数据**。在已获得向 GitHub Pages 公开展示原始历史行情的合法许可、并配置 `TWELVE_DATA_API_KEY` 和 `MARKET_DATA_PUBLICATION_AUTHORIZED=true` 后，现有的 `market-sync.yml` 定时工作流将尝试为 **XAU/USD、601899.SH、02899.HK** 请求最多400条 EOD 日线，经交易所/币种/价格校验及至少10个金价与股票共同交易日后，写入 `data/market-history.json`。接口无数据、无权访问或数据无效时保留旧数据，不显示虚假曲线。免费或低级订阅可能不支持上海/香港市场历史行情。公开再分发权限必须由数据许可方确认。

CSV 可以从已获许可的行情终端导出并在浏览器中手动导入（无需提交原始行情数据到 GitHub）。自动数据更新不等同于实时行情。

运行价格走势图回归测试：`npm test`。
