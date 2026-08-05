/**
 * 全局配置 - 前后台共用
 */
export const API_BASE = "https://vip.hahagw.eu.org";
export const MAIL_API_BASE = "https://mail.hahagw.eu.org";
export const TURNSTILE_SITEKEY = "0x4AAAAAAEDLWs232Np7X0xa";

/** 前台受保护路由 */
export const PROTECTED_ROUTES = ["#/profile", "#/tickets"];

/** 前台路由标题 */
export const PAGE_TITLES = {
  "#/": "数据看板",
  "#/plan": "购买套餐",
  "#/profile": "个人中心",
  "#/tickets": "答疑留言",
  "#/docs": "使用说明",
};
