/**
 * 波幅探长 - 全网会员监控投票 API 服务
 * js/api/vote.js
 */
import { request } from "./http.js";

export const voteApi = {
  // 【前台】获取全网监控投票排行榜 Top 100
  async fetchRankings(keyword = "") {
    const query = keyword ? `?q=${encodeURIComponent(keyword)}` : "";
    return request(`/api/vote/rankings${query}`);
  },

  // 【前台】获取当前用户的投票资格、本月剩余名额与已投标的列表
  async fetchUserVoteStatus() {
    return request("/api/vote/my-status");
  },

  // 【前台】会员提交投票（输入/选择代码，增加票数）
  async submitVote(etfCode, etfName = "") {
    return request("/api/vote/submit", {
      method: "POST",
      body: JSON.stringify({
        etf_code: String(etfCode).trim().toUpperCase(),
        etf_name: etfName ? etfName.trim() : undefined,
      }),
    });
  },

  // 【前台】撤销某次投票（退回剩余名额）
  async cancelVote(voteId) {
    return request("/api/vote/cancel", {
      method: "POST",
      body: JSON.stringify({ vote_id: voteId }),
    });
  },

  // 【后台】获取投票管理数据概览（总票数、总有效标的数、列表）
  async fetchAdminVoteStats() {
    return request("/api/admin/vote/stats");
  },

  // 【后台】一键清空本月投票
  async clearMonthlyVotes() {
    return request("/api/admin/vote/clear", {
      method: "POST",
    });
  },

  // 【后台】将得票前 N 名的投票标的一键同步为下月通用监控列表
  async syncTopVotesToShared(topN = 50) {
    return request("/api/admin/vote/sync-to-shared", {
      method: "POST",
      body: JSON.stringify({ top_n: topN }),
    });
  },
};
