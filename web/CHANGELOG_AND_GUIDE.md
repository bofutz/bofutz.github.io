# 波幅探长 v5.0 全面优化说明与部署指南

## 一、核心升级亮点

1. **未注册用户点击非前 3 标的图表时的醒目注册引导**
   - 未登录用户点击非免费 TOP N 标的的日线/半日线/周线图表或星标收藏时，弹出定制设计的**「注册即可免费查看全部图表」醒目引导弹窗**，清晰展示三大免费权益，支持一键切换「立即免费注册」或「直接登录」。

2. **彻底移除邀请码、赠送天数、会员等级及返利体系**
   - 前后端已彻底清理 `referral_code`、`referred_by`、`gift_register_days`、`gift_invitee_days`、`vip_level`、`vip_days_left`、`shared_vip_days`、邀请返利、交易日扣减等全部历史冗余逻辑。
   - 注册流程精简为：**邮箱验证码注册 → 选填专属昵称 → 立即免费解锁全量数据与图表**。

3. **保留并强化优惠码功能（会员赞助标的支付抵扣）**
   - 后台「系统设置 → 优惠码」可配置百分比折扣或固定金额减免优惠码。
   - 前台「赞助标的 → 支付界面」内置优惠码输入框，点击「使用优惠码」即可实时核销抵扣并重算精准浮动实付金额。

4. **数据看板底部常驻醒目打赏横幅 + 自由输入金额支付弹窗**
   - 看板底部新增醒目的「温暖打赏 · 共建免费监控工具」卡片，提供快捷金额按钮（`¥6.66`、`¥18.88`、`¥66`）及「自由输入金额打赏」主按钮。
   - 点击弹出**自由输入打赏金额支付界面**，支持手动输入任意金额、切换微信/支付宝收款码，并可留言及登记支付单号后 6 位（同步通知后台与 Telegram）。

5. **导航栏科学规划与设置**
   - **顶部主导航（核心功能与高频入口）**：`数据看板` (`#/`)、`赞助标的` (`#/sponsor`)、`我的赞助` (`#/sponsor?tab=mine`，登录后显示)、`图表说明` (`#/guide`)、`客服工单` (`#/tickets`)。
   - **右侧个人菜单**：显示用户昵称与「全量免费」标识，下拉含 `个人中心（昵称/订单/安全）`、`我的赞助（查看/修改标的）`、`客服工单（反馈/广播通知）`、`退出登录`。
   - **赞助页内部双栏视图**：支持在「发起赞助 / 公共池」与「我的赞助」之间无缝切换。

6. **用户自由设置昵称 + 数据看板展示赞助者昵称**
   - 用户可在注册时、个人中心顶部或赞助页顶部自由设置/修改自己的**专属昵称（2～16 字）**。
   - 被会员赞助的标的，在**数据看板**第一列标的代码旁及**公共赞助池**中，均会醒目显示 **`❤️ 昵称 赞助`** 徽章，让全站用户都知道是谁在为大家服务。

## 二、全站文件清单（共 33 个文件）

- **根目录与后端 Worker**：`index.html`, `admin.html`, `vip-api.js`, `etf-api.js`, `mail.js`, `CHANGELOG_AND_GUIDE.md`
- **前端配置与状态**：`js/config.js`, `js/store.js`
- **前端 API 层**：`js/api/http.js`, `js/api/auth.js`, `js/api/etf.js`, `js/api/sponsor.js`, `js/api/ticket.js`, `js/api/admin.js`, `js/api/dashboardPrefs.js`
- **前端公共组件**：`js/components/common/Header.js`, `js/components/common/Footer.js`, `js/components/common/AuthModal.js`, `js/components/common/Toast.js`, `js/components/common/AdsPopup.js`
- **前台业务组件**：`js/components/index/Dashboard.js`, `js/components/index/Sponsor.js`, `js/components/index/Profile.js`, `js/components/index/Guide.js`, `js/components/index/Tickets.js`
- **管理后台组件**：`js/components/admin/Dashboard.js`, `js/components/admin/UserMgmt.js`, `js/components/admin/OrderMgmt.js`, `js/components/admin/SponsorMgmt.js`, `js/components/admin/SharedWatch.js`, `js/components/admin/TicketMgmt.js`, `js/components/admin/SettingsMgmt.js`, `js/components/admin/PromoMgmt.js`
