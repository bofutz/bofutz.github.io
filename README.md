# 波幅探长｜整站优化交付版

本项目保留原有 ETF/股票波幅数据采集、图表生成、Cloudflare D1/R2、会员定制、订单审核、优惠码、客服工单和 GitHub Actions 流程，并在其上完成产品体验、安全与部署文档优化。

## 产品定位

**一句话定位：** 面向 A 股投资者的股票与 ETF 波幅观察工具，帮助用户集中发现异动、追踪多周期变化并管理自己的观察清单。

核心原则：
- 首页先展示监控价值，再让用户进入数据看板；避免把营销内容盖过核心数据。
- 基础看板保持轻量；会员付费集中在专属标的定制、长期监控和个性化管理。
- 默认定制标的仅用户本人可见，公开分享必须由用户主动选择。
- 继续采用当前 30/90/180/365 天价格配置，避免在缺乏真实转化数据时贸然降价。价格仍由后台 `symbol_prices` 设置控制，可通过小流量优惠码测试价格弹性。
- 不宣传收益率、胜率或“稳赚”结果；行情与图表仅供研究参考，不构成投资建议。

## 本次改造重点

### 产品与前端
- 首页新增紧凑价值主张区和清晰的“使用说明 / 定制我的标的”入口。
- 优化移动端触控、表单字号、焦点可见性和减少动态效果偏好。
- 完善 SEO 标题、描述、Open Graph、结构化数据、站点地图和 robots 规则。
- 新增 Web App manifest 与轻量 256px 图标；原始高清 Logo 保留。
- 管理员密钥改为 `sessionStorage`，关闭管理页/浏览器会话后不再长期保存在 localStorage。

### 安全与账号
- 新注册及密码修改使用 PBKDF2-SHA256（独立随机盐，210,000 次迭代）。
- 兼容旧 SHA-256 密码；用户下一次成功登录时自动升级哈希，不要求老用户重置密码。
- 登录会话令牌改用 Web Crypto 安全随机数生成。
- 管理员重置用户密码改为生成随机临时密码，不再把所有用户重置成公开的固定密码 `bofutz`；重置后会注销该用户的既有会话。
- 邮箱验证码发送增加 IP 与邮箱维度的 KV 轻量限流（15 分钟内最多 3 次成功发送）；登录失败按 IP 与账号组合限流（15 分钟内最多 8 次），并在邮件服务配置缺失时明确失败。
- 修复验证码邮件模板中的官网链接。

## 部署结构

| 模块 | 部署位置 | 作用 |
|---|---|---|
| 前端 | GitHub Pages | `index.html`、`admin.html`、`js/`、`webpic/` |
| 核心 API | Cloudflare Worker `vip-api.js` | 用户、订单、会员、管理后台、工单 |
| 行情 API | Cloudflare Worker `etf-api.js` | 行情历史数据读写 |
| 邮件 API | Cloudflare Worker `mail.js` | Turnstile、人机验证、邮箱验证码 |
| 数据库 | Cloudflare D1 | 账号、订单、监控历史等业务数据 |
| KV | Cloudflare KV | 邮箱验证码及限流计数 |
| 对象存储 | Cloudflare R2 | 图表和工单图片 |
| 自动化 | GitHub Actions | 行情采集、图表生成、内容制作 |

## 部署步骤

1. 将本压缩包内文件覆盖到 GitHub 仓库工作目录，保留 `.github/workflows/` 下现有工作流文件（本次未重写原有 workflow）。
2. GitHub Pages 继续使用仓库根目录发布。
3. 将 `workers/vip-api.js` 部署到现有核心 API Worker；保留原 D1、R2、KV 绑定名称。
4. 将 `workers/etf-api.js` 部署到现有行情 API Worker。
5. 将 `workers/mail.js` 部署到现有邮件 Worker。
6. 按下表核对 Worker 变量与绑定，勿将密钥写入仓库。
7. 确认 Worker 部署成功后，再执行 GitHub Actions 的手动工作流，检查 monitor → charts 流程。

### 核心 API Worker（vip-api.js）

| 名称 | 类型 | 用途 |
|---|---|---|
| `DB` | D1 绑定 | 业务数据库 |
| `CODE_KV` | KV 绑定 | 邮箱验证码与验证码限流 |
| `R2` | R2 绑定 | 工单图片 |
| `ADMIN_SECRET` | Secret | 管理后台密钥，必须设置强随机值 |
| `MONITOR_TOKEN` 或 `VIP_API_TOKEN` | Secret | 自动化脚本调用凭证 |
| `R2_PUBLIC_BASE` | Variable | 工单图片公开域名 |
| `TG_BOT_TOKEN` / `TG_ADMIN_CHAT_ID` | Secret | 可选 Telegram 工单通知 |

### 邮件 Worker（mail.js）

| 名称 | 类型 | 用途 |
|---|---|---|
| `CODE_KV` | KV 绑定 | 验证码与发送限流 |
| `TURNSTILE_SECRET_KEY` | Secret | Cloudflare Turnstile 服务端密钥 |
| `RESEND_API_KEY` | Secret | Resend 邮件服务密钥 |

### 行情 Worker（etf-api.js）

- `DB`：D1 绑定，与核心业务需要一致或指向同一业务数据库。
- `API_TOKEN`：建议配置为高强度 Secret，并与采集端使用的 `ETF_API_TOKEN` 保持一致。现有实现若未设置 `API_TOKEN` 会兼容旧部署，但这意味着写入/删除接口没有有效的令牌校验，应尽快补齐。

### GitHub Actions Secrets

根据当前工作流至少检查：
- `ETF_API_URL`、`ETF_API_TOKEN`
- `VIP_API_URL`、`VIP_API_TOKEN`、`ADMIN_SECRET`
- `R2_ACCOUNT_ID`、`R2_ACCESS_KEY`、`R2_SECRET_KEY`、`R2_BUCKET_NAME`、`R2_PUBLIC_DOMAIN`
- 邮件/内容功能启用时再配置 `TELEGRAM_BOT_TOKEN`、`TELEGRAM_CHAT_ID`、`DEEPSEEK_API_KEY`、`TV_SESSION_ID`

## 上线前必做检查

- [ ] 先备份 D1 数据库；不要在上线时重建表或清空数据。
- [ ] 确认 `ADMIN_SECRET` 已设置且与 GitHub Actions Secret 一致。
- [ ] 确认邮件 Worker 的 `CODE_KV`、Turnstile Secret、Resend Key 均已配置。
- [ ] 确认前端 `js/config.js` 中的 API 域名、Turnstile Site Key、R2 图表域名仍为实际生产值。
- [ ] 用一个测试账号注册，验证邮件验证码、登录、退出、找回密码和修改密码。
- [ ] 用测试账号创建一笔低金额测试订单，核对订单提交、后台审核、会员有效期和退款/驳回流程。
- [ ] 检查手机端首页、图表放大、定制标的、个人中心、工单与管理后台。
- [ ] 手动运行一次 GitHub Actions，确认行情更新、图表生成、R2 上传均正常。
- [ ] 管理员重置密码后，安全地将临时密码交给用户，并提醒其立即修改。

## 重要兼容性说明

- 原有用户密码哈希为 SHA-256。新版保留兼容验证，用户第一次成功登录时才升级为 PBKDF2，因此不需要批量重置账号。
- 原有订单、定制标的、优惠码、用户资料及监控数据结构均保留。
- 现有 D1 `system_settings` 中如果已经保存 `symbol_prices`，数据库配置优先于代码默认值。价格调整请在管理后台确认，切勿直接覆盖生产数据库。
- 旧管理后台固定重置密码已取消；新版接口会返回随机临时密码。请部署前端与核心 Worker 时保持版本一致。
- 本次未接入自动支付回调。当前二维码支付仍按原有“用户提交凭证 → 管理员审核”流程运行；自动支付需先确定真实支付服务商、商户资质和回调签名方案，不能用前端按钮模拟支付成功。

## 风险与经营建议

1. 不应将波幅信号包装成买卖建议或收益承诺。
2. 先观察注册转化、定制页到达率、订单提交率、审核通过率、续费率，再决定是否调整价格。
3. 优先测试季度与年度套餐的优惠展示；不要用长期低价牺牲服务可持续性。
4. 建议后续补充隐私政策、服务条款、数据来源说明、支付与退款规则、联系渠道，并根据实际经营主体所在地完成合规审查。
