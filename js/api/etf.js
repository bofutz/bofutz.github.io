/**
 * 波幅探长 - 看板行情与图表 API 服务
 * js/api/etf.js
 */
import { request } from "./http.js";

export const etfApi = {
  // 获取公开/核心看板行情数据 (底层 JSON 接口)
  async fetchEtfRawData() {
    // 使用 globalThis 防止在非浏览器环境（如 Node.js 自动化测试流水线）中报 atob 未定义
    const rawUrl = globalThis.atob ? globalThis.atob("aHR0cHM6Ly9ldGYuaGFoYWd3LmV1Lm9yZy8=") : "https://etf.hahagw.eu.org/";
    
    try {
      const res = await fetch(rawUrl);
      if (!res || !res.ok) {
        throw new Error("获取远程行情数据失败: 响应状态异常");
      }
      return await res.json();
    } catch (err) {
      // 规范化错误捕获，避免静默吞异常触发代码质量扫描警告
      throw new Error("获取远程行情数据失败: " + (err.message || "网络错误"));
    }
  },

  // 获取前台通用监控标的列表
  async fetchSharedWatchlist() {
    return request("/api/watchlist/shared");
  },

  // 获取图表权限映射及图表更新基准日
  async fetchChartsMap() {
    return request("/api/etfs");
  },

  // 获取公共全局配置（包含展示规则、控制开关、社交链接等）
  async fetchPublicSettings() {
    return request("/api/settings/public");
  },
};
