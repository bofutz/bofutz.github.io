/**
 * 波幅探长 - 全网监控投票分块组件
 * js/components/index/Vote.js
 */
import { store } from "../../store.js";
import { voteApi } from "../../api/vote.js";

const { ref, reactive, computed, onMounted } = Vue;

export default {
  name: "Vote",
  setup() {
    const loading = ref(false);
    const rankings = ref([]);
    const searchQuery = ref("");
    const userStatus = reactive({
      hasQualified: false,
      monthlyLimit: 10,
      votesUsed: 0,
      votesRemaining: 0,
      myVotes: [],
    });

    const voteModalVisible = ref(false);
    const voteForm = reactive({
      etfCode: "",
      etfName: "",
    });
    const submitLoading = ref(false);

    // 加载排行榜与个人投票状态
    const loadVoteData = async () => {
      loading.value = true;
      try {
        const [rankRes, statusRes] = await Promise.all([
          voteApi.fetchRankings(searchQuery.value).catch(() => ({ data: [] })),
          store.state.isLoggedIn ? voteApi.fetchUserVoteStatus().catch(() => ({})) : Promise.resolve({}),
        ]);

        rankings.value = rankRes.data || [];

        if (statusRes.success) {
          userStatus.hasQualified = statusRes.has_qualified;
          userStatus.monthlyLimit = statusRes.monthly_limit || 10;
          userStatus.votesUsed = statusRes.votes_used || 0;
          userStatus.votesRemaining = statusRes.votes_remaining || 0;
          userStatus.myVotes = statusRes.my_votes || [];
        }
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
      }
    };

    const openVoteModal = () => {
      if (!store.state.isLoggedIn) {
        store.state.authMode = "login";
        store.state.authModalVisible = true;
        return;
      }
      if (!userStatus.hasQualified) {
        store.showToast("监控投票仅限月付及以上会员参与", "error");
        return;
      }
      if (userStatus.votesRemaining <= 0) {
        store.showToast("您本月已用完投票名额（上限 10 只）", "error");
        return;
      }
      voteForm.etfCode = "";
      voteForm.etfName = "";
      voteModalVisible.value = true;
    };

    const submitVote = async () => {
      if (!voteForm.etfCode.trim()) {
        store.showToast("请输入 6 位标的代码", "error");
        return;
      }
      submitLoading.value = true;
      try {
        await voteApi.submitVote(voteForm.etfCode, voteForm.etfName);
        store.showToast("投票成功！");
        voteModalVisible.value = false;
        await loadVoteData();
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        submitLoading.value = false;
      }
    };

    const cancelVote = async (voteId) => {
      if (!confirm("确认撤销此标的的投票？撤销后将返还名额。")) return;
      try {
        await voteApi.cancelVote(voteId);
        store.showToast("已撤销投票");
        await loadVoteData();
      } catch (err) {
        store.showToast(err.message, "error");
      }
    };

    const filteredRankings = computed(() => {
      if (!searchQuery.value) return rankings.value;
      const q = searchQuery.value.toLowerCase().trim();
      return rankings.value.filter(
        (r) => r.etf_code.toLowerCase().includes(q) || (r.etf_name && r.etf_name.toLowerCase().includes(q))
      );
    });

    onMounted(() => {
      loadVoteData();
    });

    return {
      store: store.state,
      loading,
      searchQuery,
      userStatus,
      voteModalVisible,
      voteForm,
      submitLoading,
      filteredRankings,
      openVoteModal,
      submitVote,
      cancelVote,
      loadVoteData,
    };
  },
  template: `
    <div class="max-w-6xl mx-auto space-y-4 select-none">
      <!-- 顶部绿色 Banner 卡片 (完全契合截图) -->
      <div class="theme-bg rounded-2xl p-6 text-white shadow-md relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-2">
            <h2 class="text-2xl font-bold tracking-wide">全网会员监控投票榜</h2>
            <span class="bg-white/20 text-xs px-2.5 py-0.5 rounded-full font-mono">TOP 100</span>
          </div>
          <p class="text-xs text-white/90 leading-relaxed max-w-2xl">
            月度及以上付费会员，每月可填写最想监控的最多 10 只标的代码。<br>
            系统按投票总数量实时排序，展示排名前 100 标的。月底 24 时截止，前 50 标的自动纳入下月通用监控。
          </p>
        </div>

        <!-- 资格与剩余名额卡片 (右侧) -->
        <div class="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 text-center min-w-[200px] shrink-0">
          <div class="text-xs text-white/80 mb-1">本月剩余投票名额</div>
          <div v-if="!store.isLoggedIn" class="text-sm font-bold text-amber-200">请先登录</div>
          <div v-else-if="!userStatus.hasQualified" class="text-sm font-bold text-amber-200">暂无资格 (限月付会员)</div>
          <div v-else class="text-2xl font-extrabold font-mono text-amber-300 mb-2">
            {{ userStatus.votesRemaining }} <span class="text-xs text-white font-normal">/ {{ userStatus.monthlyLimit }} 只</span>
          </div>
          <button @click="openVoteModal" class="w-full bg-white theme-text font-bold text-xs py-2 rounded-lg hover:bg-slate-50 transition-colors shadow">
            <i class="fa-solid fa-plus mr-1"></i> 我要投票
          </button>
        </div>
      </div>

      <!-- 搜索与列表汇总 -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex flex-col sm:flex-row justify-between items-center gap-3">
        <div class="flex items-center gap-2 text-xs text-slate-500">
          <i class="fa-solid fa-fire text-orange-500"></i>
          <span>实时热门投票排名 (每 30 分钟同步)</span>
        </div>
        <div class="w-full sm:w-72 relative">
          <i class="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-sm"></i>
          <input v-model="searchQuery" type="text" placeholder="搜索投票标的..." class="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:theme-border">
        </div>
      </div>

      <!-- 排行榜表格 -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div v-if="loading" class="text-center py-12 text-slate-400">
          <i class="fa-solid fa-spinner animate-spin text-2xl theme-text"></i>
          <p class="mt-2 text-sm">加载全网投票中...</p>
        </div>
        <div v-else-if="!filteredRankings.length" class="text-center py-12 text-slate-400">
          <i class="fa-solid fa-check-to-slot text-4xl mb-3 opacity-30"></i>
          <p>暂无投票数据，快来投出第一票吧！</p>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm text-center whitespace-nowrap">
            <thead class="bg-slate-50 border-b border-slate-100 text-xs text-slate-500 font-bold">
              <tr>
                <th class="py-3 px-4 w-16">排名</th>
                <th class="py-3 px-4 text-left">标的代码</th>
                <th class="py-3 px-4 text-left">标的名称</th>
                <th class="py-3 px-4">得票数</th>
                <th class="py-3 px-4">热度占比</th>
                <th class="py-3 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="(item, index) in filteredRankings" :key="item.etf_code" class="hover:bg-slate-50">
                <td class="py-3 px-4 font-mono font-bold" :class="index < 3 ? 'theme-text text-base' : 'text-slate-500'">
                  #{{ index + 1 }}
                </td>
                <td class="py-3 px-4 text-left font-mono font-bold text-slate-800">{{ item.etf_code }}</td>
                <td class="py-3 px-4 text-left font-medium">{{ item.etf_name || item.etf_code }}</td>
                <td class="py-3 px-4 font-bold text-orange-500 font-mono">{{ item.vote_count }} 票</td>
                <td class="py-3 px-4">
                  <div class="w-24 bg-slate-100 rounded-full h-2 mx-auto overflow-hidden">
                    <div class="theme-bg h-full rounded-full" :style="{ width: item.percentage + '%' }"></div>
                  </div>
                  <span class="text-[10px] text-slate-400 mt-0.5 block">{{ item.percentage }}%</span>
                </td>
                <td class="py-3 px-4 text-right">
                  <button @click="voteForm.etfCode = item.etf_code; voteForm.etfName = item.etf_name; openVoteModal()" class="text-xs theme-text hover:underline font-medium">
                    +1 投它
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 我要投票弹窗 -->
      <div v-if="voteModalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="voteModalVisible = false">
        <div class="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl space-y-4 p-6">
          <div class="flex justify-between items-center border-b pb-3">
            <h3 class="font-bold text-slate-800">填写监控投票标的</h3>
            <button @click="voteModalVisible = false" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="space-y-3">
            <div>
              <label class="text-xs font-medium text-slate-500 mb-1 block">标的代码 (6位数字)</label>
              <input v-model="voteForm.etfCode" type="text" maxlength="6" placeholder="例如：510300" class="w-full border px-3 py-2 rounded-lg text-sm font-mono focus:theme-border outline-none">
            </div>
            <div>
              <label class="text-xs font-medium text-slate-500 mb-1 block">标的名称 (选填)</label>
              <input v-model="voteForm.etfName" type="text" placeholder="例如：沪深300ETF" class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
            </div>
            <p class="text-xs text-amber-600 bg-amber-50 p-2.5 rounded-lg border border-amber-100">
              <i class="fa-solid fa-circle-info mr-1"></i>提交后将扣除 1 个本月名额，系统月底汇总前 Top 50 自动纳为通用监控。
            </p>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button @click="voteModalVisible = false" class="px-4 py-2 text-sm text-slate-500">取消</button>
            <button @click="submitVote" :disabled="submitLoading" class="theme-bg text-white px-5 py-2 rounded-lg text-sm disabled:opacity-50">
              {{ submitLoading ? '提交中...' : '确认投票' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
};
