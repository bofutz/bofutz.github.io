/**
 * 波幅探长 - 自主查询（按次出图）
 * js/components/index/Query.js
 *
 * 流程：输入代码 → 识别名称 → 选周期 → 扣次排队 → 批次生成后记录中查看链接
 */
import { store } from "../../store.js";
import { chartQueryApi } from "../../api/chartQuery.js";
import { CONFIG } from "../../config.js";

const { ref, reactive, computed, onMounted } = Vue;

function settingOn(val) {
  return val === "1" || val === 1 || val === true || val === "true";
}

export default {
  name: "Query",
  setup() {
    const loading = ref(false);
    const submitLoading = ref(false);
    const records = ref([]);
    const form = reactive({
      etfCode: "",
      etfName: "",
      interval: "daily",
    });
    const searchingName = ref(false);
    const nameError = ref("");

    const settings = computed(() => store.state.publicSettings || {});
    const batchHours = computed(
      () => parseInt(settings.value.chart_query_batch_hours || "2", 10) || 2
    );
    const retainDays = computed(
      () => parseInt(settings.value.chart_query_retain_trading_days || "2", 10) || 2
    );

    const enabledIntervals = computed(() => {
      let raw = settings.value.chart_query_intervals || '["daily"]';
      try {
        const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (Array.isArray(arr) && arr.length) return arr;
      } catch (_) {}
      return ["daily"];
    });

    const intervalLabel = (k) =>
      (CONFIG.CHART_INTERVALS && CONFIG.CHART_INTERVALS[k]) || k;

    const nextBatchHint = computed(() => {
      const h = batchHours.value;
      const now = new Date();
      const slot = Math.ceil((now.getHours() + now.getMinutes() / 60) / h) * h;
      const next = new Date(now);
      if (slot >= 24) {
        next.setDate(next.getDate() + 1);
        next.setHours(0, 0, 0, 0);
      } else {
        next.setHours(slot, 0, 0, 0);
        if (next <= now) next.setHours(next.getHours() + h);
      }
      const p = (n) => String(n).padStart(2, "0");
      return `${p(next.getHours())}:00`;
    });

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
      form.etfName = "";
      nameError.value = "";
      if (searchTimer) clearTimeout(searchTimer);
      const code = form.etfCode.trim();
      if (!/^\d{6}$/.test(code)) return;
      searchTimer = setTimeout(async () => {
        searchingName.value = true;
        const name = await fetchStockNameByCode(code);
        searchingName.value = false;
        if (name) form.etfName = name;
        else nameError.value = "未识别到名称，可手动填写或直接提交";
      }, 320);
    };

    const loadRecords = async () => {
      if (!store.state.isLoggedIn) return;
      loading.value = true;
      try {
        const res = await chartQueryApi.fetchMyQueries();
        records.value = res.data || res || [];
      } catch (err) {
        store.showToast(err.message || "加载失败", "error");
      } finally {
        loading.value = false;
      }
    };

    const openLogin = () => {
      store.state.authMode = "login";
      store.state.authModalVisible = true;
    };

    const submit = async () => {
      if (!store.state.isLoggedIn) {
        openLogin();
        return;
      }
      const code = form.etfCode.trim().toUpperCase();
      if (!/^\d{6}$/.test(code)) {
        store.showToast("请输入 6 位标的代码", "error");
        return;
      }
      if (!enabledIntervals.value.includes(form.interval)) {
        store.showToast("当前未开放该周期", "error");
        return;
      }
      const credits = store.state.chartCredits ?? 0;
      if (credits < 1) {
        store.showToast("查询次数不足，请先购买次数包", "error");
        window.location.hash = "#/plan";
        return;
      }

      submitLoading.value = true;
      try {
        if (!form.etfName) {
          const n = await fetchStockNameByCode(code);
          if (n) form.etfName = n;
        }
        const res = await chartQueryApi.submit({
          etfCode: code,
          etfName: form.etfName || code,
          interval: form.interval,
        });
        if (res.chart_credits != null) {
          store.setChartCredits(res.chart_credits);
        } else if (store.state.chartCredits > 0) {
          store.setChartCredits(store.state.chartCredits - 1);
        }
        store.showToast(
          res.message || `已加入队列，预计 ${nextBatchHint.value} 前后可出图`
        );
        form.etfCode = "";
        form.etfName = "";
        await loadRecords();
      } catch (err) {
        store.showToast(err.message || "提交失败", "error");
      } finally {
        submitLoading.value = false;
      }
    };

    const statusLabel = (s) => {
      const map = {
        pending: "排队中",
        processing: "生成中",
        done: "已完成",
        failed: "失败已退次",
      };
      return map[s] || s;
    };

    const formatTime = (ts) => {
      if (!ts) return "-";
      const d = new Date(ts);
      if (isNaN(d.getTime())) return "-";
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    };

    const isExpired = (row) => {
      if (!row.expire_at) return false;
      return Date.now() > Number(row.expire_at);
    };

    onMounted(() => {
      if (enabledIntervals.value.length && !enabledIntervals.value.includes(form.interval)) {
        form.interval = enabledIntervals.value[0];
      }
      loadRecords();
    });

    return {
      store: store.state,
      loading,
      submitLoading,
      records,
      form,
      searchingName,
      nameError,
      batchHours,
      retainDays,
      enabledIntervals,
      intervalLabel,
      nextBatchHint,
      onCodeInput,
      submit,
      openLogin,
      loadRecords,
      statusLabel,
      formatTime,
      isExpired,
    };
  },
  template: `
    <div class="max-w-3xl mx-auto space-y-5 select-none">
      <div>
        <h2 class="text-2xl font-bold text-slate-800">自主查询</h2>
        <p class="text-xs text-slate-400 mt-1 leading-relaxed">
          输入任意股票/ETF 代码，按次消耗查询次数。系统每
          <strong class="text-slate-600">{{ batchHours }}</strong> 小时批量生成图表，
          图片约保留 <strong class="text-slate-600">{{ retainDays }}</strong> 个交易日。
          非实时；盘中可能使用上一完整周期图表。
        </p>
      </div>

      <!-- 余额条 -->
      <div class="bg-white rounded-xl border border-slate-100 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div class="text-sm">
          <span class="text-slate-500">剩余查询次数</span>
          <span class="text-2xl font-extrabold theme-text ml-2 font-mono">{{ store.chartCredits ?? 0 }}</span>
        </div>
        <a href="#/plan" class="text-xs theme-bg text-white px-4 py-2 rounded-lg font-bold no-underline hover:opacity-90">
          购买次数包
        </a>
      </div>

      <!-- 查询表单 -->
      <div class="bg-white rounded-xl border border-slate-100 p-5 space-y-4 shadow-sm">
        <div class="text-sm font-bold text-slate-700">发起查询</div>
        <div v-if="!store.isLoggedIn" class="text-center py-6 text-sm text-slate-500">
          请先 <button type="button" @click="openLogin" class="theme-text font-bold underline">登录</button> 后再查询
        </div>
        <template v-else>
          <div>
            <label class="text-xs font-bold text-slate-600 mb-1.5 block">标的代码（6 位）</label>
            <input v-model="form.etfCode" @input="onCodeInput" maxlength="6"
                   placeholder="例如：510300"
                   class="w-full border px-3 py-2.5 rounded-lg text-sm font-mono uppercase focus:theme-border outline-none">
            <p v-if="searchingName" class="text-xs text-slate-400 mt-1"><i class="fa-solid fa-spinner animate-spin mr-1"></i>识别名称中…</p>
            <p v-else-if="form.etfName" class="text-xs theme-text mt-1 font-bold"><i class="fa-solid fa-circle-check mr-1"></i>{{ form.etfName }}</p>
            <p v-else-if="nameError" class="text-xs text-amber-600 mt-1">{{ nameError }}</p>
          </div>
          <div>
            <label class="text-xs font-bold text-slate-600 mb-1.5 block">图表周期</label>
            <div class="flex flex-wrap gap-2">
              <button type="button" v-for="iv in enabledIntervals" :key="iv"
                      @click="form.interval = iv"
                      class="px-3.5 py-1.5 rounded-lg text-xs border font-bold transition-colors"
                      :class="form.interval === iv ? 'theme-bg text-white border-transparent' : 'bg-white text-slate-600'">
                {{ intervalLabel(iv) }}
              </button>
            </div>
            <p class="text-[11px] text-slate-400 mt-1.5">未在列表中的周期表示后台未开放</p>
          </div>
          <div class="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 leading-relaxed">
            提交后预计在 <strong class="theme-text">{{ nextBatchHint }}</strong> 前后的批次生成。
            成功出图后可在下方记录中打开链接；失败将自动退回 1 次。
          </div>
          <button type="button" @click="submit" :disabled="submitLoading || searchingName"
                  class="w-full theme-bg text-white py-2.5 rounded-lg text-sm font-bold disabled:opacity-50">
            {{ submitLoading ? '提交中…' : '确认查询（消耗 1 次）' }}
          </button>
        </template>
      </div>

      <!-- 记录 -->
      <div class="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
        <div class="px-5 py-3.5 border-b border-slate-100 flex justify-between items-center">
          <span class="font-bold text-slate-700 text-sm">查询记录</span>
          <button type="button" @click="loadRecords" class="text-xs text-slate-400 hover:theme-text">
            <i class="fa-solid fa-rotate-right mr-1"></i>刷新
          </button>
        </div>
        <div v-if="!store.isLoggedIn" class="py-10 text-center text-sm text-slate-400">登录后查看记录</div>
        <div v-else-if="loading" class="py-10 text-center text-slate-400">
          <i class="fa-solid fa-spinner animate-spin theme-text"></i>
        </div>
        <div v-else-if="!records.length" class="py-10 text-center text-sm text-slate-400">暂无记录</div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm text-left whitespace-nowrap">
            <thead class="bg-slate-50 text-xs text-slate-500 border-b font-bold">
              <tr>
                <th class="py-2.5 px-4">代码 / 名称</th>
                <th class="py-2.5 px-3">周期</th>
                <th class="py-2.5 px-3">提交时间</th>
                <th class="py-2.5 px-3">状态</th>
                <th class="py-2.5 px-3">有效期</th>
                <th class="py-2.5 px-4 text-right">图表</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="r in records" :key="r.id" class="hover:bg-slate-50/80">
                <td class="py-3 px-4">
                  <div class="font-mono font-bold text-slate-800">{{ r.etf_code }}</div>
                  <div class="text-xs text-slate-500">{{ r.etf_name || '-' }}</div>
                </td>
                <td class="py-3 px-3 text-xs">{{ intervalLabel(r.interval) }}</td>
                <td class="py-3 px-3 text-xs font-mono text-slate-400">{{ formatTime(r.created_at) }}</td>
                <td class="py-3 px-3">
                  <span class="text-xs font-bold px-2 py-0.5 rounded-full"
                        :class="{
                          'bg-orange-50 text-orange-600': r.status==='pending' || r.status==='processing',
                          'bg-emerald-50 text-emerald-600': r.status==='done',
                          'bg-slate-100 text-slate-400': r.status==='failed'
                        }">{{ statusLabel(r.status) }}</span>
                </td>
                <td class="py-3 px-3 text-xs font-mono"
                    :class="isExpired(r) ? 'text-red-400' : 'text-slate-500'">
                  {{ r.expire_at ? formatTime(r.expire_at) : '-' }}
                  <span v-if="isExpired(r)" class="block text-red-400">已过期</span>
                </td>
                <td class="py-3 px-4 text-right">
                  <a v-if="r.status==='done' && r.chart_url && !isExpired(r)"
                     :href="r.chart_url" target="_blank" rel="noopener"
                     class="text-xs theme-text font-bold hover:underline">打开</a>
                  <span v-else class="text-xs text-slate-300">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p class="text-[11px] text-slate-400 text-center leading-relaxed">
        数据与图表仅供学习观察，不构成投资建议。生成依赖行情与图床任务，偶发失败会自动退次。
      </p>
    </div>
  `,
};
