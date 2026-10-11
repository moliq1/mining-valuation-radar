# ORE Radar · 全球金银铜矿业 A/H 动态估值雷达

可离线托管、无后端、无 npm 依赖的中文投资研究仪表盘，复现并扩展 2026-10-10 版金银铜矿业 Excel 模型。

![Status](https://img.shields.io/badge/data-historical_snapshot-926f37) ![Dependencies](https://img.shields.io/badge/runtime_dependencies-0-168a75) ![Market](https://img.shields.io/badge/market-A%2FH-4e7294)

## 已实现

- **研究总览**：8 家公司 / 12 个 A/H 标的，估值位置排名、金银铜价格锚和风险提示。
- **动态估值矩阵**：悲观、基准、乐观三情景；利润、EPS、合理每股估值和安全边际。
- **情景实验室**：动态调整金价、银价、铜价、PE 倍数、盈利可持续系数和非金属业务增长假设，所有标的联动更新。
- **A/H 溢价**：按港元兑人民币汇率换算，比较紫金矿业、山东黄金、赤峰黄金、洛阳钼业的同股溢价。
- **情绪性杀跌筛选**：价格五日跌幅、金属五日跌幅、估值安全边际、重大风险、现金流质量和资料核验多重闸门。
- **数据管理**：手动修改股价、日期、五日前价格和汇率；JSON 导入导出、浏览器本地保存、恢复基准快照。
- **来源透明**：展示估值依据、财报参考来源及模型局限；所有模型输入都在 `data/snapshot.json` 中。

## 运行

项目由原生 HTML、CSS、JavaScript ES modules 构成，不需要 npm install：

```bash
python3 -m http.server 4173 --bind 127.0.0.1
# 然后打开 http://127.0.0.1:4173/
```

如有 Node.js 18+，可运行单元测试：

```bash
npm test
```

浏览器直接打开 `index.html` 通常会受到 `file://` 跨域限制，因此请使用静态 HTTP 服务器。

## 新建 GitHub 仓库并上传

如果本机已安装并登录 [GitHub CLI](https://cli.github.com/)，在项目目录执行：

```bash
bash scripts/publish-to-github.sh private
# 若希望部署到公开 GitHub Pages，可使用 public（仓库中的都是公开市场研究示例数据）
```

该脚本会在登录的 GitHub 账号下创建独立仓库 `mining-valuation-radar` 并推送 `main` 分支。脚本不会覆盖已有同名仓库，也不会提交本地认证令牌。

手动操作也可以：在 GitHub 网站建立空仓库后，在本目录运行 `git init -b main && git add . && git commit -m "Initial mining valuation dashboard" && git remote add origin https://github.com/<你的GitHub用户名>/mining-valuation-radar.git && git push -u origin main`。

### GitHub Pages 部署

公开仓库推送后，进入 **Settings → Pages → Build and deployment → Deploy from a branch**，选择 `main` 分支和根目录 `/ (root)`，保存。站点 URL 类似：`https://<用户名>.github.io/mining-valuation-radar/`。如选择私有仓库，需要确认 GitHub 账户/组织的 Pages 资格与可见性设置。

## 数据口径（务必先读）

- 股票价格是**历史手工快照**：前七个标的截至 2026-10-08，新增五个标的截至 2026-10-09。不同日期不可直接拿来做套利比较。
- **2026H1 盈利年化×2 不等于正式全年盈利预测**；留存率和情景 PE 是研究假设，而非公司或分析师正式预测。
- 量化敏感度将**部分矿产量近似为销量**。不能替代原始销售确认、AISC、现金税费、少数股东权益或自由现金流模型。
- **洛阳钼业钴/钨/贸易业务、可转债潜在稀释**没有完全纳入；**盛达资源白银产销口径**有待核验；中国黄金国际、紫金黄金国际的盈利基线**不是扣非利润**。
- 紫金矿业与紫金黄金国际的业务和股权存在重叠，不可将两者简单视作独立组合敞口。
- **没有内置实时行情 API、自动定时刷新、邮件/微信推送或后台服务器**。网页“报警”是手动更新后进行的**本地规则筛选**，不等于已经部署主动提醒。若需要自动数据管道，下一阶段可加入服务端行情适配器、公告抓取、数据审计和调度。

## 情绪错杀规则

同时要求：

1. 基准估值安全边际 `>=25%`，其中 `margin = 1 - marketPrice / baseFairPrice`。
2. 证券所在市场 **5 个交易日**收盘价变化 `<= -8%`（须提供五日前同市场收盘价）。
3. 对应主导金属 **5 日价格变化 `>= -3%`**（人工更新）。
4. 已核实 **没有重大经营利空**，且现金流与资料核验通过。
5. 源数据置信度不能为“低”。此时需要强化审计后调整模型，而不是直接发出信号。

任何数据缺失时**不会**自动假定条件满足。

## 计算公式

盈利基线：

```text
normalized_profit_RMB_100m = H1_profit_100m * (USD_CNY if profit in USD else 1)
                              * 2 * sustainability * (1+non_metal_growth)
```

金属价格相对半年报参考均价变化产生的利润影响：

```text
impact_RMB_100m = (scenario_price - H1_reference_price)
                  * H1_production_or_sales_tonnes * 2
                  * (32150.7466 if gold/silver else 1)
                  * USD_CNY * attributable_retention_ratio / 1e8
```

```text
EPS_RMB    = (normalized_profit_RMB_100m + sum(impacts_RMB_100m)) / shares_100m
fair_RMB   = EPS_RMB * scenario_PE, provided EPS > 0
fair_HKD   = fair_RMB / HKD_CNY
margin     = 1 - share_price_in_local_currency / fair_price_in_local_currency
```

这里的“合理价值”是**情景盈利 × 假设PE**，并非经正式审计的股权贴现估值模型（DCF）。

## 项目结构

```text
index.html                     入口页面
src/style.css                  响应式设计
src/app.js                     UI与交互逻辑
src/model.js                   可单独测试的纯估值函数
data/snapshot.json             2026-10研究快照
scripts/publish-to-github.sh   GitHub 新建仓库推送辅助脚本
tests/model.test.js            规则与回归测试
```

## 免责声明

仅用于研究与学习，所有金融数据应在实际决策前核实。系统不构成投资咨询，不保证“低估”必然修复，也不提供自动交易功能。