/**
 * 后台 · 监控投票管理
 */
import { ref, reactive, onMounted } from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";

export const VoteView = {
  name: "VoteView",
  props: {
    fetchAdmin: { type: Function, required: true },
    showToast: { type: Function, required: true },
  },
  setup(props) {
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

    const formatDate = (ts) => {
      if (!ts) return "-";
      const d = new Date(typeof ts === "number" ? ts : ts);
      if (isNaN(d.getTime())) return "-";
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    };

    async function fetchVoteSettings() {
      try {
        const d = await props.fetchAdmin("/api/admin/vote/settings");
        if (d.success && d.data) Object.assign(settings, d.data);
      } catch (e) {
        props.showToast(e.message, "error");
      }
    }

    async function saveVoteSettings() {
      try {
        await props.fetchAdmin("/api/admin/vote/settings", {
          method: "POST",
          body: JSON.stringify(settings),
        });
        props.showToast("投票设置已保存", "success");
      } catch (e) {
        props.showToast(e.message, "error");
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
        props.showToast("请填写内容", "error");
        return;
      }
      try {
        const d = await props.fetchAdmin("/api/admin/vote/initial/batch", {
          method: "POST",
          body: JSON.stringify({ items }),
        });
        props.showToast(`导入完成：新增 ${d.added || 0}，跳过 ${d.skipped || 0}`, "success");
        initialText.value = "";
      } catch (e) {
        props.showToast(e.message, "error");
      }
    }

    async function fetchRecords() {
      loading.value = true;
      try {
        const q = monthFilter.value ? `?month=${monthFilter.value}` : "";
        const d = await props.fetchAdmin(`/api/admin/vote/records${q}`);
        if (d.success) records.value = d.data || [];
      } catch (e) {
        props.showToast(e.message, "error");
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
      formatDate,
      saveVoteSettings,
      batchImportInitial,
      fetchRecords,
    };
  },
  template: `
    <div class="space-y-4">
      <h2 class="text-xl font-bold">监控投票管理</h2>

      <!-- 设置 -->
      <div class="bg-white rounded-xl border p-5 shadow-sm space-y-4">
        <div class="text-sm font-medium">投票规则</div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label class="text-xs text-slate-500">每月可投票数</label>
            <input v-model.number="settings.vote_max_per_month" type="number" min="1" max="50"
                   class="w-full border px-3 py-2 rounded-lg text-sm">
          </div>
          <div>
            <label class="text-xs text-slate-500">每月取 Top N 进通用</label>
            <input v-model.number="settings.vote_top_n" type="number" min="10" max="200"
                   class="w-full border px-3 py-2 rounded-lg text-sm">
          </div>
          <div>
            <label class="text-xs text-slate-500">前台列表显示数量</label>
            <input v-model.number="settings.vote_list_limit" type="number" min="50" max="500"
                   class="w-full border px-3 py-2 rounded-lg text-sm">
          </div>
          <div class="flex items-end">
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" v-model="settings.vote_enabled"> 启用投票
            </label>
          </div>
        </div>
        <button @click="saveVoteSettings" class="theme-bg text-white text-sm px-4 py-2 rounded-lg">保存设置</button>
      </div>

      <!-- 批量导入初始列表 -->
      <div class="bg-white rounded-xl border p-5 shadow-sm space-y-3">
        <div class="text-sm font-medium">批量导入初始监控列表</div>
        <p class="text-xs text-slate-400">每行：代码,名称（或仅代码）。已存在的代码会跳过，票数保留。</p>
        <textarea v-model="initialText" rows="8"
                  class="w-full border px-3 py-2 rounded-lg text-sm font-mono"
                  placeholder="510300,沪深300ETF&#10;159915,创业板ETF"></textarea>
        <button @click="batchImportInitial" class="theme-bg text-white text-sm px-4 py-2 rounded-lg">导入</button>
      </div>

      <!-- 投票记录 -->
      <div class="bg-white rounded-xl border p-5 shadow-sm space-y-3">
        <div class="flex flex-wrap gap-2 items-center justify-between">
          <div class="text-sm font-medium">会员投票/添加记录</div>
          <div class="flex gap-2">
            <input v-model="monthFilter" type="month" class="border px-2 py-1.5 rounded text-sm">
            <button @click="fetchRecords" class="bg-slate-100 px-3 py-1.5 rounded text-sm">查询</button>
          </div>
        </div>
        <div v-if="loading" class="py-8 text-center text-slate-400">
          <i class="fa-solid fa-spinner animate-spin"></i>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 text-slate-500 border-b">
              <tr>
                <th class="py-2 px-3 text-left">时间</th>
                <th class="py-2 px-3 text-left">用户</th>
                <th class="py-2 px-3 text-left">代码</th>
                <th class="py-2 px-3 text-left">名称</th>
                <th class="py-2 px-3 text-left">月份</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="r in records" :key="r.id">
                <td class="py-2 px-3 text-xs text-slate-400">{{ formatDate(r.created_at) }}</td>
                <td class="py-2 px-3 font-medium">{{ r.username || '-' }}</td>
                <td class="py-2 px-3 font-mono">{{ r.etf_code }}</td>
                <td class="py-2 px-3">{{ r.etf_name || '-' }}</td>
                <td class="py-2 px-3">{{ r.month_key }}</td>
              </tr>
              <tr v-if="!records.length">
                <td colspan="5" class="py-8 text-center text-slate-400">暂无记录</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
};
