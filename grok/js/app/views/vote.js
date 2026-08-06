/**
 * 监控投票页面组件
 */
import { ref, computed, onMounted, watch } from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";
import { fetchVoteList, fetchMyVotes, submitVote } from "../../api.js";
import { pureCode, lookupEtfName, currentMonthKey } from "../../utils.js";
import { VOTE_DEFAULT_LIST_LIMIT } from "../../config.js";

export const VoteView = {
  name: "VoteView",
  props: {
    publicSettings: { type: Object, required: true },
    isLoggedIn: { type: Boolean, default: false },
    isVip: { type: Boolean, default: false },
    openAuth: { type: Function, required: true },
  },
  setup(props) {
    const loading = ref(false);
    const list = ref([]);
    const myVotes = ref([]);
    const searchQuery = ref("");
    const inputCode = ref("");
    const inputName = ref("");
    const nameLoading = ref(false);
    const submitting = ref(false);
    const monthKey = ref(currentMonthKey());

    const maxVotes = computed(() =>
      Number(props.publicSettings?.vote_max_per_month) || 10
    );
    const remaining = computed(() =>
      Math.max(0, maxVotes.value - myVotes.value.length)
    );

    const filteredList = computed(() => {
      let rows = list.value;
      if (searchQuery.value.trim()) {
        const q = searchQuery.value.toLowerCase();
        rows = rows.filter(
          (r) =>
            (r.etf_code || "").toLowerCase().includes(q) ||
            (r.etf_name || "").toLowerCase().includes(q)
        );
      }
      return rows;
    });

    const canVote = computed(
      () => props.isLoggedIn && props.isVip && remaining.value > 0
    );

    async function loadList() {
      loading.value = true;
      try {
        const d = await fetchVoteList(VOTE_DEFAULT_LIST_LIMIT);
        if (d.success) {
          list.value = (d.data || []).map((r, i) => ({
            ...r,
            rank: i + 1,
          }));
          monthKey.value = d.month || currentMonthKey();
        }
      } catch (e) {
        alert(e.message || "加载投票列表失败");
      } finally {
        loading.value = false;
      }
    }

    async function loadMyVotes() {
      if (!props.isLoggedIn) {
        myVotes.value = [];
        return;
      }
      try {
        const d = await fetchMyVotes();
        if (d.success) {
          myVotes.value = (d.data || []).map((x) => pureCode(x.etf_code));
        }
      } catch (_) {
        myVotes.value = [];
      }
    }

    async function autoLookupName() {
      const code = pureCode(inputCode.value);
      if (!/^\d{6}$/.test(code)) {
        inputName.value = "";
        return;
      }
      nameLoading.value = true;
      try {
        const name = await lookupEtfName(code);
        inputName.value = name || "";
      } finally {
        nameLoading.value = false;
      }
    }

    async function doVote(code, name = "") {
      if (!props.isLoggedIn) {
        props.openAuth("login");
        return;
      }
      if (!props.isVip) {
        alert("仅通用VIP会员可参与投票");
        return;
      }
      if (remaining.value <= 0) {
        alert(`本月投票次数已用完（上限 ${maxVotes.value} 次）`);
        return;
      }
      const c = pureCode(code);
      if (!/^\d{6}$/.test(c)) {
        alert("请输入正确的6位标的代码");
        return;
      }
      if (myVotes.value.includes(c)) {
        alert("本月已对该标的投过票");
        return;
      }

      submitting.value = true;
      try {
        let n = name || inputName.value;
        if (!n) n = await lookupEtfName(c);
        const d = await submitVote({ etf_code: c, etf_name: n || c });
        alert(d.message || "投票成功");
        inputCode.value = "";
        inputName.value = "";
        await Promise.all([loadList(), loadMyVotes()]);
      } catch (e) {
        alert(e.message || "投票失败");
      } finally {
        submitting.value = false;
      }
    }

    function voteFromList(row) {
      doVote(row.etf_code, row.etf_name);
    }

    onMounted(() => {
      loadList();
      loadMyVotes();
    });

    watch(
      () => props.isLoggedIn,
      () => loadMyVotes()
    );

    return {
      loading,
      list,
      filteredList,
      myVotes,
      searchQuery,
      inputCode,
      inputName,
      nameLoading,
      submitting,
      monthKey,
      maxVotes,
      remaining,
      canVote,
      pureCode,
      autoLookupName,
      doVote,
      voteFromList,
      loadList,
      loadMyVotes,
    };
  },
  template: `
    <div class="max-w-5xl mx-auto space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="text-xl font-bold text-slate-800">监控投票 · {{ monthKey }}</h2>
          <p class="text-xs text-slate-400 mt-1">
            通用VIP每月可投 <strong>{{ maxVotes }}</strong> 次 · 每只标的每月限投一次 ·
            下月第一个交易日取 Top {{ publicSettings.vote_top_n || 50 }} 作为通用监控列表
          </p>
        </div>
        <div class="text-sm">
          <span v-if="isLoggedIn && isVip" class="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg border border-emerald-100">
            本月剩余 <strong>{{ remaining }}</strong> 票
          </span>
          <span v-else-if="isLoggedIn" class="bg-amber-50 text-amber-600 px-3 py-1.5 rounded-lg border border-amber-100">
            仅通用VIP可投票
          </span>
          <button v-else @click="openAuth('login')" class="theme-bg text-white text-sm px-4 py-1.5 rounded-lg">登录后投票</button>
        </div>
      </div>

      <!-- 手动输入投票 -->
      <div class="bg-white rounded-xl border border-slate-100 p-4 sm:p-5 shadow-sm">
        <div class="text-sm font-medium text-slate-700 mb-3">自行输入标的投票</div>
        <div class="flex flex-col sm:flex-row gap-2">
          <input v-model="inputCode" @blur="autoLookupName" maxlength="6"
                 placeholder="6位代码" class="w-full sm:w-32 px-3 py-2 border rounded-lg text-sm font-mono">
          <div class="flex-1 relative">
            <input v-model="inputName" placeholder="名称（自动查询）"
                   class="w-full px-3 py-2 border rounded-lg text-sm" :disabled="nameLoading">
            <i v-if="nameLoading" class="fa-solid fa-spinner animate-spin absolute right-3 top-3 text-slate-400 text-xs"></i>
          </div>
          <button @click="doVote(inputCode, inputName)" :disabled="submitting || !canVote"
                  class="theme-bg text-white px-5 py-2 rounded-lg text-sm disabled:opacity-50 whitespace-nowrap">
            {{ submitting ? '提交中...' : '投票' }}
          </button>
        </div>
      </div>

      <!-- 列表 -->
      <div class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div class="px-4 py-3 border-b flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
          <div class="text-sm text-slate-500">共 {{ list.length }} 只 · 按票数降序 · 长期保留</div>
          <input v-model="searchQuery" placeholder="搜索代码/名称"
                 class="px-3 py-1.5 border rounded-lg text-sm w-full sm:w-48">
        </div>
        <div v-if="loading" class="p-10 text-center text-slate-400">
          <i class="fa-solid fa-spinner animate-spin text-xl"></i>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm whitespace-nowrap">
            <thead class="bg-slate-50 text-slate-500 border-b">
              <tr>
                <th class="py-3 px-4 text-left w-16">#</th>
                <th class="py-3 px-4 text-left">代码</th>
                <th class="py-3 px-4 text-left">名称</th>
                <th class="py-3 px-4 text-left">票数</th>
                <th class="py-3 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="row in filteredList" :key="row.etf_code" class="hover:bg-slate-50">
                <td class="py-3 px-4 text-slate-400 font-mono">{{ row.rank }}</td>
                <td class="py-3 px-4 font-mono font-bold">{{ row.etf_code }}</td>
                <td class="py-3 px-4">{{ row.etf_name || '-' }}</td>
                <td class="py-3 px-4">
                  <span class="font-bold" :class="row.vote_count > 0 ? 'theme-text' : 'text-slate-400'">
                    {{ row.vote_count || 0 }}
                  </span>
                </td>
                <td class="py-3 px-4 text-right">
                  <button v-if="myVotes.includes(pureCode(row.etf_code))"
                          class="text-xs text-slate-400 cursor-default">已投</button>
                  <button v-else-if="canVote"
                          @click="voteFromList(row)"
                          class="text-xs theme-bg text-white px-3 py-1 rounded-lg">投票</button>
                  <button v-else class="text-xs text-slate-300 cursor-default">—</button>
                </td>
              </tr>
              <tr v-if="!filteredList.length">
                <td colspan="5" class="py-12 text-center text-slate-400">暂无数据</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
};

// 兼容：如果别处还在用 useVoteView，可保留空导出或删除
export function useVoteView() {
  console.warn("useVoteView 已废弃，请直接使用 VoteView 组件");
  return {};
}
