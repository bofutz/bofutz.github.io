/**
 * 波幅探长 - 后台【票选监控管理】组件 
 * 对齐前台「票选监控」
 * js/components/admin/VoteMgmt.js
 */
import { store } from "../../store.js";
import { voteApi } from "../../api/vote.js";

const { ref, reactive, onMounted } = Vue;

export default {
  name: "VoteMgmt",
  setup() {
    const loading = ref(false);
    const stats = reactive({
      validSymbolsCount: 0,
      totalVoteInteractions: 0,
      monthlyLimit: 10,
    });
    const voteList = ref([]);

    const loadAdminVoteData = async () => {
      loading.value = true;
      try {
        const res = await voteApi.fetchAdminVoteStats();
        if (res.success) {
          stats.validSymbolsCount = res.data.valid_symbols_count || 0;
          stats.totalVoteInteractions = res.data.total_vote_interactions || 0;
          stats.monthlyLimit = res.data.monthly_limit || 10;
          voteList.value = res.data.list || [];
        }
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
      }
    };

    const clearMonthlyVotes = async () => {
      if (!confirm("确定清空本月全网票选数据吗？此操作不可撤销！")) return;
      try {
        await voteApi.clearMonthlyVotes();
        store.showToast("本月票选数据已清空");
        await loadAdminVoteData();
      } catch (err) {
        store.showToast(err.message, "error");
      }
    };

    const syncToShared = async () => {
      if (!confirm("确认将当前得票前 50 标的一键同步为下月【通用监控列表】？")) return;
      try {
        const res = await voteApi.syncTopVotesToShared(50);
        store.showToast(`同步成功！已更新 ${res.count || 0} 只标的至通用监控`);
      } catch (err) {
        store.showToast(err.message, "error");
      }
    };

    onMounted(loadAdminVoteData);

    return {
      stats,
      voteList,
      loading,
      loadAdminVoteData,
      clearMonthlyVotes,
      syncToShared,
    };
  },
  template: `
    <div class="space-y-4 select-none">
      <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 class="text-xl font-bold text-slate-800">票选监控管理</h2>
          <p class="text-xs text-slate-400 mt-0.5">
            统计全网会员票选结果 · 前台实时展示 Top 200 · 每月初可同步 Top50 至通用监控
          </p>
        </div>
        <div class="flex gap-2 flex-wrap">
          <button @click="clearMonthlyVotes"
                  class="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded-lg font-bold hover:bg-red-100 flex items-center gap-1">
            <i class="fa-solid fa-trash-can"></i> 清空本月票选
          </button>
          <button @click="syncToShared"
                  class="text-xs theme-bg text-white px-3 py-2 rounded-lg font-bold hover:opacity-90 shadow-sm flex items-center gap-1">
            <i class="fa-solid fa-rotate"></i> 同步前50名至通用监控
          </button>
          <button @click="loadAdminVoteData" class="bg-white border px-3 py-2 rounded-lg text-sm hover:bg-slate-50">
            <i class="fa-solid fa-rotate-right" :class="{'animate-spin': loading}"></i>
          </button>
        </div>
      </div>

      <!-- 数据卡片 -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div class="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
          <div class="text-xs text-slate-400 mb-2">有效票选标的数</div>
          <div class="text-3xl font-extrabold text-slate-800 font-mono">{{ stats.validSymbolsCount }}</div>
        </div>
        <div class="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
          <div class="text-xs text-slate-400 mb-2">累计投票总人次</div>
          <div class="text-3xl font-extrabold theme-text font-mono">{{ stats.totalVoteInteractions }}</div>
        </div>
        <div class="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
          <div class="text-xs text-slate-400 mb-2">每人每月上限</div>
          <div class="text-3xl font-extrabold text-orange-500 font-mono">
            {{ stats.monthlyLimit }} <span class="text-sm text-slate-400 font-normal">只</span>
          </div>
        </div>
      </div>

      <!-- 排行榜 -->
      <div class="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
        <div v-if="loading" class="text-center py-12 text-slate-400">
          <i class="fa-solid fa-circle-notch animate-spin text-2xl theme-text"></i>
        </div>
        <div v-else-if="!voteList.length" class="text-center py-14 text-slate-400 text-sm">
          暂无票选记录
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm whitespace-nowrap text-left">
            <thead class="bg-slate-50 text-slate-500 border-b text-xs font-bold">
              <tr>
                <th class="py-3 px-4 w-16">排名</th>
                <th class="py-3 px-4">代码</th>
                <th class="py-3 px-4">名称</th>
                <th class="py-3 px-4">得票数</th>
                <th class="py-3 px-4">投票人数</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="(item, idx) in voteList" :key="item.etf_code" class="hover:bg-slate-50">
                <td class="py-3 px-4 font-bold font-mono"
                    :class="idx < 3 ? 'theme-text' : 'text-slate-500'">
                  #{{ idx + 1 }}
                </td>
                <td class="py-3 px-4 font-mono font-bold text-slate-800">{{ item.etf_code }}</td>
                <td class="py-3 px-4 font-medium">{{ item.etf_name || item.etf_code }}</td>
                <td class="py-3 px-4 font-bold text-orange-500 font-mono">{{ item.vote_count }} 票</td>
                <td class="py-3 px-4 font-mono text-slate-600">{{ item.voters_count || '-' }} 人</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
};
