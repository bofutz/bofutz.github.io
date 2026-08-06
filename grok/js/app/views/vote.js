import { ref, computed, onMounted, watch } from "vue";
import { fetchVoteList, fetchMyVotes, submitVote } from "../../api.js";
import { pureCode, lookupEtfName, currentMonthKey } from "../../utils.js";
import { VOTE_DEFAULT_LIST_LIMIT } from "../../config.js";

export function useVoteView(ctx) {
  const {
    isLoggedIn,
    isVip,
    openAuth,
    publicSettings,
    showToast = (msg) => alert(msg),
  } = ctx;

  const loading = ref(false);
  const list = ref([]);               // { etf_code, etf_name, vote_count, rank }
  const myVotes = ref([]);            // 本月已投代码列表
  const searchQuery = ref("");
  const inputCode = ref("");
  const inputName = ref("");
  const nameLoading = ref(false);
  const submitting = ref(false);
  const monthKey = ref(currentMonthKey());

  const maxVotes = computed(() =>
    Number(publicSettings.value?.vote_max_per_month) || 10
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

  const canVote = computed(() => isLoggedIn.value && isVip.value && remaining.value > 0);

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
      showToast(e.message || "加载投票列表失败", "error");
    } finally {
      loading.value = false;
    }
  }

  async function loadMyVotes() {
    if (!isLoggedIn.value) {
      myVotes.value = [];
      return;
    }
    try {
      const d = await fetchMyVotes();
      if (d.success) myVotes.value = (d.data || []).map((x) => pureCode(x.etf_code));
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
    if (!isLoggedIn.value) {
      openAuth("login");
      return;
    }
    if (!isVip.value) {
      showToast("仅通用VIP会员可参与投票", "error");
      return;
    }
    if (remaining.value <= 0) {
      showToast(`本月投票次数已用完（上限 ${maxVotes.value} 次）`, "error");
      return;
    }
    const c = pureCode(code);
    if (!/^\d{6}$/.test(c)) {
      showToast("请输入正确的6位标的代码", "error");
      return;
    }
    if (myVotes.value.includes(c)) {
      showToast("本月已对该标的投过票", "error");
      return;
    }

    submitting.value = true;
    try {
      let n = name || inputName.value;
      if (!n) n = await lookupEtfName(c);
      const d = await submitVote({ etf_code: c, etf_name: n || c });
      showToast(d.message || "投票成功", "success");
      inputCode.value = "";
      inputName.value = "";
      await Promise.all([loadList(), loadMyVotes()]);
    } catch (e) {
      showToast(e.message || "投票失败", "error");
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

  watch(isLoggedIn, () => loadMyVotes());

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
    autoLookupName,
    doVote,
    voteFromList,
    loadList,
  };
}
