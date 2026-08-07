/**
 * 波幅探长 - 后台【票选监控管理】组件（优化版）
 * 支持批量导入初始标的 + 自动识别名称 + 同步锁定
 * js/components/admin/VoteMgmt.js
 */
import { store } from "../../store.js";
import { voteApi } from "../../api/vote.js";
import { adminApi } from "../../api/admin.js";

const { ref, reactive, onMounted, computed } = Vue;

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

    // 同步锁定相关
    const lastSyncMonth = ref("");          // 格式：2026-08
    const currentMonth = computed(() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    });
    const canSync = computed(() => lastSyncMonth.value !== currentMonth.value);

    // 批量导入弹窗
    const batchVisible = ref(false);
    const batchText = ref("");
    const batchLoading = ref(false);
    const batchPreview = ref([]);           // [{code, name, status}]

    // ==================== 名称自动识别 ====================
    const fetchStockNameByCode = async (symbolStr) => {
      try {
        const codeMatch = String(symbolStr || "").match(/\d{6}/);
        if (!codeMatch) return "";
        const code = codeMatch[0];
        const prefix = ["5", "6", "9"].includes(code[0]) ? "sh" : "sz";
        const tx_url = `https://qt.gtimg.cn/q=${prefix}${code}`;
        const resp = await fetch(tx_url);
        if (!resp.ok) return "";
        const buffer = await resp.arrayBuffer();
        const decoder = new TextDecoder("gbk");
        const text = decoder.decode(buffer);
        const match = text.match(/="[^~]+~([^~]+)/);
        return match ? match[1].trim() : "";
      } catch (err) {
        return "";
      }
    };

    // 解析批量文本并自动查名
    const parseBatchText = async () => {
      const lines = batchText.value
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      const codes = [...new Set(lines.map((l) => {
        const m = l.match(/\d{6}/);
        return m ? m[0] : null;
      }).filter(Boolean))];

      batchPreview.value = [];
      for (const code of codes) {
        const name = await fetchStockNameByCode(code);
        batchPreview.value.push({
          code,
          name: name || code,
          status: name ? "ok" : "no-name",
        });
      }
    };

    // 执行批量导入（调用后台接口）
    const submitBatchImport = async () => {
      if (!batchPreview.value.length) {
        store.showToast("请先输入代码并解析", "error");
        return;
      }
      batchLoading.value = true;
      try {
        // 这里调用新增的后台接口（见下方 Worker 补充）
        const res = await voteApi.batchSeedVotes(
          batchPreview.value.map((i) => ({
            etf_code: i.code,
            etf_name: i.name,
          }))
        );
        store.showToast(`导入成功！新增 ${res.added || 0} 只，跳过 ${res.skipped || 0} 只`);
        batchVisible.value = false;
        batchText.value = "";
        batchPreview.value = [];
        await loadAdminVoteData();
      } catch (err) {
        store.showToast(err.message || "导入失败", "error");
      } finally {
        batchLoading.value = false;
      }
    };

    // ==================== 数据加载 ====================
    const loadAdminVoteData = async () => {
      loading.value = true;
      try {
        const [statsRes, settingsRes] = await Promise.all([
          voteApi.fetchAdminVoteStats(),
          adminApi.fetchSettings().catch(() => ({ data: {} })),
        ]);

        if (statsRes.success) {
          stats.validSymbolsCount = statsRes.data.valid_symbols_count || 0;
          stats.totalVoteInteractions = statsRes.data.total_vote_interactions || 0;
          stats.monthlyLimit = statsRes.data.monthly_limit || 10;
          voteList.value = statsRes.data.list || [];
        }

        // 读取上次同步月份
        lastSyncMonth.value = settingsRes.data?.vote_last_sync_month || "";
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
      }
    };

    // 同步前50名（带月份锁定）
    const syncToShared = async () => {
      if (!canSync.value) {
        store.showToast("本月已同步过，下个月才能再次操作", "error");
        return;
      }
      if (!confirm("确认将当前得票前 50 标的同步为通用监控列表？\n同步后本月将无法再次操作。")) return;

      try {
        const res = await voteApi.syncTopVotesToShared(50);
        // 记录本月已同步
        await adminApi.saveSettings({
          vote_last_sync_month: currentMonth.value,
        });
        lastSyncMonth.value = currentMonth.value;
        store.showToast(`同步成功！已更新 ${res.count || 0} 只标的至通用监控`);
      } catch (err) {
        store.showToast(err.message, "error");
      }
    };

    onMounted(loadAdminVoteData);

    return {
      loading,
      stats,
      voteList,
      canSync,
      currentMonth,
      lastSyncMonth,
      batchVisible,
      batchText,
      batchLoading,
      batchPreview,
      loadAdminVoteData,
      parseBatchText,
      submitBatchImport,
      syncToShared,
    };
  },
  template: `
    <div class="space-y-4 select-none">
      <!-- 页头 -->
      <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 class="text-xl font-bold text-slate-800">票选监控管理</h2>
          <p class="text-xs text-slate-400 mt-0.5">
            统计全网会员票选结果 · 前台实时展示 Top 200 · 每月初可同步 Top50 至通用监控
          </p>
        </div>
        <div class="flex gap-2 flex-wrap">
          <button @click="batchVisible = true"
                  class="text-xs bg-slate-100 text-slate-700 px-3 py-2 rounded-lg font-bold hover:bg-slate-200 flex items-center gap-1">
            <i class="fa-solid fa-file-import"></i> 批量导入初始标的
          </button>

          <button @click="syncToShared"
                  :disabled="!canSync"
                  class="text-xs px-3 py-2 rounded-lg font-bold flex items-center gap-1 transition-all"
                  :class="canSync 
                    ? 'theme-bg text-white hover:opacity-90 shadow-sm' 
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'">
            <i class="fa-solid fa-rotate"></i>
            {{ canSync ? '同步前50名至通用监控' : '本月已同步' }}
          </button>

          <button @click="loadAdminVoteData" class="bg-white border px-3 py-2 rounded-lg text-sm hover:bg-slate-50">
            <i class="fa-solid fa-rotate-right" :class="{'animate-spin': loading}"></i>
          </button>
        </div>
      </div>

      <!-- 提示条 -->
      <div v-if="!canSync" class="bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 text-xs text-amber-800">
        <i class="fa-solid fa-circle-info mr-1"></i>
        本月（{{ currentMonth }}）已完成同步，下个月才能再次同步前50名。
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
          暂无票选记录，可先使用「批量导入初始标的」
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

      <!-- 批量导入弹窗 -->
      <div v-if="batchVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="batchVisible = false">
        <div class="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
          <div class="flex justify-between items-center">
            <h3 class="font-bold text-slate-800">批量导入初始标的</h3>
            <button @click="batchVisible = false" class="text-slate-400 hover:text-slate-600">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <p class="text-xs text-slate-500">
            每行输入一个 6 位代码，系统会自动识别中文名称并加入票选池（初始得票为 0，会员可继续投票）。
          </p>

          <textarea
            v-model="batchText"
            rows="6"
            placeholder="512690&#10;510300&#10;159915"
            class="w-full border px-3 py-2.5 rounded-lg text-sm font-mono focus:theme-border outline-none"
          ></textarea>

          <div class="flex gap-2">
            <button @click="parseBatchText" class="text-xs bg-slate-100 text-slate-700 px-4 py-2 rounded-lg font-bold hover:bg-slate-200">
              解析并识别名称
            </button>
          </div>

          <!-- 预览列表 -->
          <div v-if="batchPreview.length" class="border rounded-lg overflow-hidden">
            <div class="bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 border-b">
              识别结果（{{ batchPreview.length }} 只）
            </div>
            <div class="max-h-48 overflow-y-auto divide-y">
              <div v-for="(item, i) in batchPreview" :key="i" class="px-3 py-2 text-xs flex items-center justify-between">
                <div>
                  <span class="font-mono font-bold">{{ item.code }}</span>
                  <span class="ml-2 text-slate-600">{{ item.name }}</span>
                </div>
                <span :class="item.status === 'ok' ? 'text-emerald-500' : 'text-amber-500'">
                  {{ item.status === 'ok' ? '已识别' : '未识别名称' }}
                </span>
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button @click="batchVisible = false" class="px-4 py-2 text-sm text-slate-500">取消</button>
            <button
              @click="submitBatchImport"
              :disabled="batchLoading || !batchPreview.length"
              class="theme-bg text-white px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
            >
              {{ batchLoading ? '导入中...' : '确认导入' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
};
