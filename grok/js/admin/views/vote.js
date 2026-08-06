import { ref, reactive, onMounted } from "vue";

export function useAdminVote(fetchAdmin, showToast) {
  const settings = reactive({
    vote_max_per_month: 10,
    vote_top_n: 50,
    vote_list_limit: 200,
    vote_enabled: true,
  });
  const initialText = ref("");
  const records = ref([]);
  const loading = ref(false);
  const monthFilter = ref("");

  async function fetchVoteSettings() {
    try {
      const d = await fetchAdmin("/api/admin/vote/settings");
      if (d.success && d.data) Object.assign(settings, d.data);
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  async function saveVoteSettings() {
    try {
      await fetchAdmin("/api/admin/vote/settings", {
        method: "POST",
        body: JSON.stringify(settings),
      });
      showToast("投票设置已保存", "success");
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  async function batchImportInitial() {
    const items = initialText.value
      .split("\n")
      .map((line) => {
        const parts = line.split(/[,，\t]/).map((s) => s.trim()).filter(Boolean);
        if (!parts.length) return null;
        return { etf_code: parts[0], etf_name: parts[1] || parts[0] };
      })
      .filter(Boolean);
    if (!items.length) {
      showToast("请填写内容", "error");
      return;
    }
    try {
      const d = await fetchAdmin("/api/admin/vote/initial/batch", {
        method: "POST",
        body: JSON.stringify({ items }),
      });
      showToast(`导入完成：新增 ${d.added || 0}，跳过 ${d.skipped || 0}`, "success");
      initialText.value = "";
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  async function fetchRecords() {
    loading.value = true;
    try {
      const q = monthFilter.value ? `?month=${monthFilter.value}` : "";
      const d = await fetchAdmin(`/api/admin/vote/records${q}`);
      if (d.success) records.value = d.data || [];
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      loading.value = false;
    }
  }

  onMounted(() => {
    fetchVoteSettings();
    fetchRecords();
  });

  return {
    settings,
    initialText,
    records,
    loading,
    monthFilter,
    fetchVoteSettings,
    saveVoteSettings,
    batchImportInitial,
    fetchRecords,
  };
}
