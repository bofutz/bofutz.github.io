/**
 * 波幅探长 - 票选监控（整合版）
 * - 等级门槛：vote_min_level（后台可配）
 * - 可选仅 ETF：vote_etf_only，名称不含 ETF 则拦截
 * 对齐：GET /api/vote/rankings | /api/vote/status | POST submit/cancel
 * js/components/index/Vote.js
 */
import { store } from "../../store.js";
import { voteApi } from "../../api/vote.js";
import { CONFIG } from "../../config.js";

const { ref, reactive, computed, onMounted, watch } = Vue;

function settingOn(val) {
  return val === "1" || val === 1 || val === true || val === "true";
}

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
      vipLevel: 0,
      minLevel: 1,
      etfOnly: true,
    });

    const voteModalVisible = ref(false);
    const voteForm = reactive({ etfCode: "", etfName: "" });
    const searchingName = ref(false);
    const nameError = ref("");
    const submitLoading = ref(false);

    const settings = computed(() => store.state.publicSettings || {});
    const etfOnlySetting = computed(() =>
      settingOn(settings.value.vote_etf_only ?? "1")
    );
    const minLevelSetting = computed(() => {
      const n = parseInt(settings.value.vote_min_level || "1", 10);
      return isNaN(n) ? 1 : Math.max(0, Math.min(4, n));
    });
    const levelLabel = (lv) => {
      const map = CONFIG.VIP_LEVEL_LABELS || {};
      return map[lv] || `Lv.${lv}`;
    };

    const fetchStockNameByCode = async (symbolStr) => {
      try {
        const codeMatch = String(symbolStr || "").match(/\d{6}/);
        if (!codeMatch) return "";
        const code = codeMatch[0];
        const prefix = ["5", "6", "9"].includes(code[0]) ? "sh" : "sz";
        const resp = await fetch(`https://qt.gtimg.cn/q=${prefix}${code}`);
        if (!resp.ok) return "";
        const buffer = await resp.arrayBuffer();
        const text = new TextDecoder("gbk").decode(buffer);
        const match = text.match(/="[^~]+~([^~]+)/);
        return match ? match[1].trim() : "";
      } catch {
        return "";
      }
    };

    let searchTimer = null;
    const onCodeInput = () => {
      voteForm.etfName = "";
      nameError.value = "";
      if (searchTimer) clearTimeout(searchTimer);
      const code = voteForm.etfCode.trim();
      if (!code || code.length < 6) return;
      searchTimer = setTimeout(async () => {
        searchingName.value = true;
        const name = await fetchStockNameByCode(code);
        searchingName.value = false;
        if (name) {
          voteForm.etfName = name;
          if (etfOnlySetting.value && !/ETF/i.test(name)) {
            nameError.value = "当前仅支持名称含「ETF」的标的，该代码无效";
          }
        } else {
          nameError.value = "未识别到中文名称，可手动填写或直接提交";
        }
      }, 350);
    };

    const loadVoteData = async () => {
      loading.value = true;
      try {
        const [rankRes, statusRes] = await Promise.all([
          voteApi.fetchRankings(searchQuery.value).catch(() => ({ data: [] })),
          store.state.isLoggedIn
            ? voteApi.fetchUserVoteStatus().catch(() => ({}))
            : Promise.resolve({}),
        ]);

        const raw = rankRes?.data ?? rankRes;
        rankings.value = (Array.isArray(raw) ? raw : []).slice(0, 200);

        if (statusRes && (statusRes.success || statusRes.has_qualified != null)) {
          userStatus.hasQualified = !!statusRes.has_qualified;
          userStatus.monthlyLimit = statusRes.monthly_limit || 10;
          userStatus.votesUsed = statusRes.votes_used || 0;
          userStatus.votesRemaining =
            statusRes.votes_remaining != null
              ? statusRes.votes_remaining
              : Math.max(0, userStatus.monthlyLimit - userStatus.votesUsed);
          userStatus.myVotes = statusRes.my_votes || [];
          userStatus.vipLevel = statusRes.vip_level ?? store.state.vipLevel ?? 0;
          userStatus.minLevel = statusRes.min_level ?? minLevelSetting.value;
          userStatus.etfOnly =
            statusRes.etf_only != null
              ? !!statusRes.etf_only
              : etfOnlySetting.value;

          if (statusRes.vip_level != null) {
            store.setUserState({ vipLevel: statusRes.vip_level });
          }
        } else if (store.state.isLoggedIn) {
          userStatus.minLevel = minLevelSetting.value;
          userStatus.etfOnly = etfOnlySetting.value;
          userStatus.vipLevel = store.state.vipLevel || 0;
          userStatus.hasQualified = userStatus.vipLevel >= userStatus.minLevel;
        }
      } catch (err) {
        store.showToast(err.message || "加载失败", "error");
      } finally {
        loading.value = false;
      }
    };

    let searchDebounce = null;
    watch(searchQuery, () => {
      if (searchDebounce) clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => loadVoteData(), 400);
    });

    const openVoteModal = (presetCode = "", presetName = "") => {
      if (!store.state.isLoggedIn) {
        store.state.authMode = "login";
        store.state.authModalVisible = true;
        return;
      }
      if (!userStatus.hasQualified) {
        store.showToast(
          `票选需达到 Lv.${userStatus.minLevel}（${levelLabel(
            userStatus.minLevel
          )}）及以上会员`,
          "error"
        );
        return;
      }
      if (userStatus.votesRemaining <= 0) {
        store.showToast(
          `您本月已用完投票名额（上限 ${userStatus.monthlyLimit} 只）`,
          "error"
        );
        return;
      }
      voteForm.etfCode = presetCode || "";
      voteForm.etfName = presetName || "";
      nameError.value = "";
      searchingName.value = false;
      voteModalVisible.value = true;
      if (presetCode && presetCode.length === 6) onCodeInput();
    };

    const submitVote = async () => {
      const code = voteForm.etfCode.trim().toUpperCase();
      if (!/^\d{6}$/.test(code)) {
        store.showToast("请输入正确的 6 位标的代码", "error");
        return;
      }
      if (!voteForm.etfName) {
        searchingName.value = true;
        const name = await fetchStockNameByCode(code);
        searchingName.value = false;
        if (name) voteForm.etfName = name;
      }
      const finalName = (voteForm.etfName || code).trim();
      if (etfOnlySetting.value && !/ETF/i.test(finalName)) {
        store.showToast("当前仅支持名称含「ETF」的标的", "error");
        return;
      }

      submitLoading.value = true;
      try {
        await voteApi.submitVote(code, finalName);
        store.showToast("投票成功！");
        voteModalVisible.value = false;
        await loadVoteData();
      } catch (err) {
        store.showToast(err.message || "投票失败", "error");
      } finally {
        submitLoading.value = false;
      }
    };

    const cancelVote = async (voteId) => {
      if (!confirm("确认撤销此标的的投票？撤销后将返还本月名额。")) return;
      try {
        await voteApi.cancelVote(voteId);
        store.showToast("已撤销投票");
        await loadVoteData();
      } catch (err) {
        store.showToast(err.message || "撤销失败", "error");
      }
    };

    const isVotedByMe = (code) =>
      userStatus.myVotes.some((v) => v.etf_code === code);

    onMounted(loadVoteData);

    return {
      store: store.state,
      loading,
      searchQuery,
      userStatus,
      rankings,
      voteModalVisible,
      voteForm,
      searchingName,
      nameError,
      submitLoading,
      etfOnlySetting,
      openVoteModal,
      submitVote,
      cancelVote,
      isVotedByMe,
      loadVoteData,
      onCodeInput,
      levelLabel,
    };
  },
  template: `
    <div class="max-w-6xl mx-auto space-y-4 select-none">
      <div class="theme-bg rounded-2xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-2 flex-wrap">
              <h2 class="text-xl sm:text-2xl font-bold tracking-wide">票选监控</h2>
              <span class="bg-white/20 text-xs px-2.5 py-0.5 rounded-full font-mono">TOP 200</span>
              <span v-if="etfOnlySetting" class="bg-white/15 text-[10px] px-2 py-0.5 rounded-full">仅 ETF</span>
            </div>
            <p class="text-xs sm:text-sm text-white/90 leading-relaxed max-w-3xl">
              Lv.{{ userStatus.minLevel }} 及以上会员每月可投票/新增最多
              <strong>{{ userStatus.monthlyLimit || 10 }}</strong> 只标的。
              系统按得票实时排序，每月初可同步 Top 50 至通用监控。
              <span v-if="etfOnlySetting">当前开启「仅 ETF」限制。</span>
            </p>
          </div>
          <div class="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 text-center min-w-[210px] shrink-0">
            <div class="text-xs text-white/80 mb-1">本月剩余投票名额</div>
            <template v-if="!store.isLoggedIn">
              <div class="text-sm font-bold text-amber-200 py-1">请先登录后投票</div>
            </template>
            <template v-else-if="!userStatus.hasQualified">
              <div class="text-sm font-bold text-amber-200 py-1 leading-snug">
                暂无资格<br>
                <span class="text-[11px] opacity-80">
                  需 Lv.{{ userStatus.minLevel }}（当前 Lv.{{ userStatus.vipLevel || store.vipLevel || 0 }}）
                </span>
              </div>
            </template>
            <template v-else>
              <div class="text-2xl font-extrabold font-mono text-amber-300 mb-1">
                {{ userStatus.votesRemaining }}
                <span class="text-xs text-white font-normal">/ {{ userStatus.monthlyLimit }} 只</span>
              </div>
            </template>
            <button @click="openVoteModal()"
              class="w-full mt-2 bg-white theme-text font-bold text-xs py-2.5 rounded-lg hover:bg-slate-50 transition-colors shadow">
              <i class="fa-solid fa-plus mr-1"></i> 我要投票 / 新增
            </button>
          </div>
        </div>
      </div>

      <div v-if="store.isLoggedIn && userStatus.myVotes.length > 0" class="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <div class="flex items-center justify-between mb-3">
          <div class="text-sm font-bold text-slate-700">
            <i class="fa-solid fa-check-to-slot theme-text mr-1.5"></i>
            我本月已投 ({{ userStatus.myVotes.length }})
          </div>
          <button @click="loadVoteData" class="text-xs text-slate-400 hover:theme-text">
            <i class="fa-solid fa-rotate-right mr-1"></i>刷新
          </button>
        </div>
        <div class="flex flex-wrap gap-2">
          <div v-for="v in userStatus.myVotes" :key="v.id"
               class="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
            <span class="font-mono font-bold text-slate-800">{{ v.etf_code }}</span>
            <span class="text-slate-500">{{ v.etf_name || '' }}</span>
            <button @click="cancelVote(v.id)" class="text-slate-400 hover:text-red-500 ml-1" title="撤销投票">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-3.5 flex flex-col sm:flex-row justify-between items-center gap-3">
        <div class="flex items-center gap-2 text-xs text-slate-500">
          <i class="fa-solid fa-fire text-orange-500"></i>
          <span>实时热度排名 · 最多展示前 200 · 票数持续累计</span>
        </div>
        <div class="w-full sm:w-72 relative">
          <i class="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-sm"></i>
          <input v-model="searchQuery" type="search" placeholder="搜索代码 / 名称..."
                 class="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:theme-border">
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div v-if="loading" class="text-center py-14 text-slate-400">
          <i class="fa-solid fa-spinner animate-spin text-2xl theme-text"></i>
          <p class="mt-2 text-sm">加载票选数据中...</p>
        </div>
        <div v-else-if="!rankings.length" class="text-center py-14 text-slate-400">
          <i class="fa-solid fa-check-to-slot text-4xl mb-3 opacity-30"></i>
          <p class="text-sm">暂无票选数据，快来投出第一票吧！</p>
          <button @click="openVoteModal()" class="mt-4 text-xs theme-bg text-white px-4 py-2 rounded-lg font-bold">立即投票</button>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm text-center whitespace-nowrap">
            <thead class="bg-slate-50 border-b border-slate-100 text-xs text-slate-500 font-bold">
              <tr>
                <th class="py-3 px-3 w-14">排名</th>
                <th class="py-3 px-3 text-left">代码</th>
                <th class="py-3 px-3 text-left">名称</th>
                <th class="py-3 px-3">得票</th>
                <th class="py-3 px-3">热度</th>
                <th class="py-3 px-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="(item, index) in rankings" :key="item.etf_code" class="hover:bg-slate-50/80 transition-colors">
                <td class="py-3 px-3 font-mono font-bold"
                    :class="index < 3 ? 'theme-text text-base' : (index < 10 ? 'text-slate-700' : 'text-slate-400')">
                  #{{ index + 1 }}
                </td>
                <td class="py-3 px-3 text-left font-mono font-bold text-slate-800">{{ item.etf_code }}</td>
                <td class="py-3 px-3 text-left font-medium text-slate-700 max-w-[140px] truncate">{{ item.etf_name || item.etf_code }}</td>
                <td class="py-3 px-3 font-bold text-orange-500 font-mono">{{ item.vote_count || 0 }} 票</td>
                <td class="py-3 px-3">
                  <div class="w-20 sm:w-24 bg-slate-100 rounded-full h-1.5 mx-auto overflow-hidden">
                    <div class="theme-bg h-full rounded-full transition-all"
                         :style="{ width: Math.min(item.percentage || 0, 100) + '%' }"></div>
                  </div>
                  <span class="text-[10px] text-slate-400 mt-0.5 block">{{ item.percentage || 0 }}%</span>
                </td>
                <td class="py-3 px-3 text-right">
                  <button v-if="isVotedByMe(item.etf_code)" class="text-xs text-emerald-600 font-medium cursor-default">
                    <i class="fa-solid fa-check mr-0.5"></i>已投
                  </button>
                  <button v-else @click="openVoteModal(item.etf_code, item.etf_name)"
                          class="text-xs theme-text hover:underline font-medium">+1 投它</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="text-center text-[11px] text-slate-400 leading-relaxed px-2">
        本页任何人可查看 · 投票需登录且达到等级门槛
        <span v-if="etfOnlySetting"> · 仅限 ETF</span>
        · 票数持续累计
      </div>

      <div v-if="voteModalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4"
           @click.self="voteModalVisible = false">
        <div class="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl space-y-4 p-6">
          <div class="flex justify-between items-center border-b pb-3">
            <h3 class="font-bold text-slate-800 text-base">投票 / 新增监控标的</h3>
            <button @click="voteModalVisible = false" class="text-slate-400 hover:text-slate-600">
              <i class="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>
          <div class="space-y-3">
            <div>
              <label class="text-xs font-bold text-slate-600 mb-1.5 block">标的代码（6位）</label>
              <input v-model="voteForm.etfCode" @input="onCodeInput" type="text" maxlength="6"
                     placeholder="例如：510300 / 159915"
                     class="w-full border px-3 py-2.5 rounded-lg text-sm font-mono uppercase focus:theme-border outline-none">
            </div>
            <div>
              <label class="text-xs font-bold text-slate-600 mb-1.5 block">
                标的名称 <span class="font-normal text-slate-400">（自动识别，可修改）</span>
              </label>
              <div class="relative">
                <input v-model="voteForm.etfName" type="text" placeholder="识别中或手动填写..."
                       class="w-full border px-3 py-2.5 rounded-lg text-sm focus:theme-border outline-none"
                       :class="searchingName ? 'bg-slate-50' : ''">
                <span v-if="searchingName" class="absolute right-3 top-2.5 text-xs text-slate-400">
                  <i class="fa-solid fa-spinner animate-spin"></i>
                </span>
              </div>
              <p v-if="nameError" class="text-xs text-amber-600 mt-1.5">{{ nameError }}</p>
              <p v-else-if="voteForm.etfName" class="text-xs theme-text mt-1.5 flex items-center gap-1">
                <i class="fa-solid fa-circle-check"></i> 已识别：{{ voteForm.etfName }}
              </p>
            </div>
            <div class="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-100 leading-relaxed">
              <i class="fa-solid fa-circle-info mr-1"></i>
              提交将扣除 1 个本月名额。
              <span v-if="etfOnlySetting">名称须包含「ETF」。</span>
            </div>
          </div>
          <div class="flex justify-end gap-2 pt-1">
            <button @click="voteModalVisible = false" class="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">取消</button>
            <button @click="submitVote" :disabled="submitLoading || searchingName || !voteForm.etfCode"
                    class="theme-bg text-white px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50">
              {{ submitLoading ? '提交中...' : '确认投票' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
};
