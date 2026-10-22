/**
 * 后台 - 赞助标的管理
 * 1. 输入 6 位代码自动识别标的名称及 T+0 / T+1 交易制度
 * 2. 看板展示署名统一映射为 sponsor_name（显示为“(昵称) 赞助”，如“老李 赞助”）
 * 3. T+0 标的代码显示为红色，T+1 保持不变，不加 (0)
 */
import { store } from "../../store.js";
import { adminApi } from "../../api/admin.js";
import { resolveTradeRule, fetchSecurityInfo } from "../../config.js";

const { ref, reactive, onMounted } = Vue;

export default {
  name: "SponsorMgmt",
  emits: ["refresh-stats"],
  setup(_, { emit }) {
    const list = ref([]);
    const loading = ref(false);
    const saving = ref(false);
    const detecting = ref(false);
    const statusFilter = ref("active");

    const modalVisible = ref(false);
    const form = reactive({
      id: null,
      user_id: "",
      etf_code: "",
      etf_name: "",
      sponsor_name: "",
      trade_mode: "t+1",
      days: 30,
      status: "active",
    });

    const load = async () => {
      loading.value = true;
      try {
        const res = await adminApi.fetchSponsors(
          statusFilter.value === "all" ? "" : statusFilter.value
        );
        list.value = res.data || [];
        emit("refresh-stats");
      } catch (e) {
        store.showToast(e.message || "加载失败", "error");
      } finally {
        loading.value = false;
      }
    };

    let codeTimer = null;
    const onCodeInput = () => {
      if (codeTimer) clearTimeout(codeTimer);
      const code = String(form.etf_code || "").replace(/\D/g, "").slice(-6);
      if (code.length !== 6) return;
      form.trade_mode = resolveTradeRule(code, form.etf_name);
      codeTimer = setTimeout(async () => {
        detecting.value = true;
        const info = await fetchSecurityInfo(code);
        if (info.name) form.etf_name = info.name;
        form.trade_mode = info.trade_mode;
        detecting.value = false;
      }, 250);
    };

    const openModal = (row = null) => {
      if (row) {
        Object.assign(form, {
          id: row.id,
          user_id: row.user_id || "",
          etf_code: row.etf_code || "",
          etf_name: row.etf_name || "",
          sponsor_name: row.sponsor_name || row.nickname || "",
          trade_mode: resolveTradeRule(row.etf_code, row.etf_name, row.trade_mode),
          days: row.days || 30,
          status: row.status || "active",
        });
      } else {
        Object.assign(form, {
          id: null,
          user_id: "",
          etf_code: "",
          etf_name: "",
          sponsor_name: "",
          trade_mode: "t+1",
          days: 30,
          status: "active",
        });
      }
      modalVisible.value = true;
    };

    const submitForm = async () => {
      const code = String(form.etf_code || "")
        .replace(/\D/g, "")
        .slice(-6);
      if (code.length !== 6) {
        store.showToast("请输入 6 位数字标的代码", "error");
        return;
      }
      saving.value = true;
      try {
        if (!form.etf_name || form.etf_name.trim() === code) {
          const info = await fetchSecurityInfo(code);
          form.etf_name = info.name || code;
          if (!form.trade_mode) form.trade_mode = info.trade_mode;
        }
        await adminApi.saveSponsor({
          id: form.id || null,
          user_id: form.user_id ? Number(form.user_id) : undefined,
          etf_code: code,
          etf_name: String(form.etf_name || code).trim(),
          sponsor_name: String(form.sponsor_name || "").trim(),
          trade_mode: form.trade_mode || resolveTradeRule(code, form.etf_name),
          days: Math.max(1, Number(form.days) || 30),
          status: form.status || "active",
        });
        store.showToast(form.id ? "赞助记录已更新" : "赞助标的已添加");
        modalVisible.value = false;
        await load();
      } catch (e) {
        store.showToast(e.message || "保存失败", "error");
      } finally {
        saving.value = false;
      }
    };

    const forceExpire = async (row) => {
      if (!confirm(`强制下线 ${row.etf_code}？`)) return;
      const pwd = prompt("请输入管理密码确认：");
      if (!pwd) return;
      try {
        await adminApi.forceExpireSponsor(row.id, pwd.trim());
        store.showToast("已下线");
        await load();
      } catch (e) {
        store.showToast(e.message || "失败", "error");
      }
    };

    const formatTime = (ts) => {
      if (!ts) return "-";
      const d = new Date(Number(ts));
      if (isNaN(d.getTime())) return "-";
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
    };

    const remainDays = (row) => {
      if (!row?.expire_at) return 0;
      const left = Number(row.expire_at) - Date.now();
      if (left <= 0) return 0;
      return Math.ceil(left / 86400000);
    };

    const remainText = (row) => {
      if (row.status !== "active" || Number(row.expire_at) <= Date.now()) return "已过期";
      const d = remainDays(row);
      if (d <= 0) return "即将到期";
      return `剩余 ${d} 天`;
    };

    const displayRule = (row) => resolveTradeRule(row.etf_code, row.etf_name, row.trade_mode);

    onMounted(load);

    return {
      list,
      loading,
      saving,
      detecting,
      statusFilter,
      modalVisible,
      form,
      onCodeInput,
      load,
      openModal,
      submitForm,
      forceExpire,
      formatTime,
      remainDays,
      remainText,
      displayRule,
    };
  },
  template: `
    <div class="space-y-4 select-none">
      <div class="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 class="text-xl font-bold text-slate-800">赞助标的管理</h2>
          <p class="text-xs text-slate-400 mt-0.5">管理会员赞助标的、修改看板展示的「(昵称) 赞助」署名与 T+0/T+1 属性</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <select v-model="statusFilter" @change="load" class="border rounded-lg px-2.5 py-1.5 text-xs bg-white">
            <option value="active">有效中</option>
            <option value="expired">已过期</option>
            <option value="all">全部</option>
          </select>
          <button type="button" @click="openModal()" class="theme-bg text-white text-xs px-3.5 py-1.5 rounded-lg font-bold hover:opacity-90">
            + 手动新增赞助
          </button>
          <button type="button" @click="load" class="bg-white border px-3 py-1.5 rounded-lg text-sm">
            <i class="fa-solid fa-rotate-right" :class="{'animate-spin': loading}"></i>
          </button>
        </div>
      </div>

      <div class="bg-white rounded-xl border overflow-hidden shadow-sm">
        <div v-if="loading" class="py-12 text-center text-slate-400">加载中…</div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm text-left whitespace-nowrap">
            <thead class="bg-slate-50 text-xs text-slate-500 border-b font-bold">
              <tr>
                <th class="py-2.5 px-3">看板展示署名</th>
                <th class="py-2.5 px-3">关联邮箱</th>
                <th class="py-2.5 px-3">代码（红色=T+0）</th>
                <th class="py-2.5 px-3">标的名称</th>
                <th class="py-2.5 px-3">周期</th>
                <th class="py-2.5 px-3">到期日</th>
                <th class="py-2.5 px-3">剩余时间</th>
                <th class="py-2.5 px-3">获赞数</th>
                <th class="py-2.5 px-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="r in list" :key="r.id" class="hover:bg-slate-50">
                <td class="py-2.5 px-3">
                  <span class="inline-flex items-center gap-1 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded">
                    <i class="fa-solid fa-heart text-[10px] text-rose-500"></i>
                    {{ r.sponsor_name || r.nickname || '匿名会员' }} 赞助
                  </span>
                </td>
                <td class="py-2.5 px-3 text-xs text-slate-500 font-mono">
                  {{ r.username || ('UID:' + (r.user_id || '-')) }}
                </td>
                <td class="py-2.5 px-3 font-mono font-bold">
                  <span :class="displayRule(r)==='t+0' ? 'text-red-500' : 'text-slate-800'">{{ r.etf_code }}</span>
                  <span class="ml-1.5 text-[10px] px-1.5 py-0.5 rounded"
                        :class="displayRule(r)==='t+0' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'">
                    {{ displayRule(r).toUpperCase() }}
                  </span>
                </td>
                <td class="py-2.5 px-3 font-medium">{{ r.etf_name }}</td>
                <td class="py-2.5 px-3 text-xs font-bold">{{ r.days || '-' }} 天</td>
                <td class="py-2.5 px-3 text-xs font-mono text-slate-400">{{ formatTime(r.expire_at) }}</td>
                <td class="py-2.5 px-3 text-xs font-bold"
                    :class="r.status==='active' && remainDays(r)>0 ? (remainDays(r)<=7?'text-amber-600':'text-emerald-600') : 'text-slate-400'">
                  {{ remainText(r) }}
                </td>
                <td class="py-2.5 px-3 font-mono text-xs text-rose-500 font-bold">
                  <i class="fa-solid fa-thumbs-up mr-1"></i>{{ r.like_count || 0 }}
                </td>
                <td class="py-2.5 px-3 text-right space-x-1.5">
                  <button type="button" @click="openModal(r)" class="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded font-bold hover:bg-slate-200">
                    编辑/改昵称
                  </button>
                  <button v-if="r.status==='active'" type="button" @click="forceExpire(r)" class="text-xs text-red-500 hover:underline">
                    下线
                  </button>
                </td>
              </tr>
              <tr v-if="!list.length">
                <td colspan="9" class="py-10 text-center text-slate-400">暂无记录</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 编辑/新增赞助弹窗 -->
      <div v-if="modalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="modalVisible=false">
        <div class="bg-white rounded-2xl w-full max-w-md p-6 space-y-3.5 shadow-2xl">
          <div class="flex items-center justify-between">
            <h3 class="font-bold text-slate-800">{{ form.id ? '编辑赞助记录 / 修改展示昵称' : '手动新增赞助标的' }}</h3>
            <button type="button" @click="modalVisible=false" class="text-slate-400 hover:text-slate-600">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-xs text-slate-500 block mb-1">6位标的代码（自动识别）</label>
              <input v-model="form.etf_code" @input="onCodeInput" maxlength="6" placeholder="如 000651"
                     class="w-full border px-3 py-2 rounded-lg text-sm font-mono focus:theme-border outline-none">
            </div>
            <div>
              <label class="text-xs text-slate-500 block mb-1">
                标的名称 <span v-if="detecting" class="theme-text">(识别中...)</span>
              </label>
              <input v-model="form.etf_name" placeholder="输入代码后自动识别"
                     class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
            </div>
          </div>

          <div>
            <label class="text-xs text-slate-500 block mb-1">看板展示赞助者昵称（修改后看板立即显示「(昵称) 赞助」，如：老李 赞助）</label>
            <input v-model="form.sponsor_name" maxlength="16" placeholder="例如：老李"
                   class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-xs text-slate-500 block mb-1">交易制度（自动识别）</label>
              <select v-model="form.trade_mode" class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
                <option value="t+0">T+0（红色代码）</option>
                <option value="t+1">T+1（常规代码）</option>
              </select>
            </div>
            <div>
              <label class="text-xs text-slate-500 block mb-1">有效天数</label>
              <input type="number" v-model.number="form.days" min="1"
                     class="w-full border px-3 py-2 rounded-lg text-sm font-mono focus:theme-border outline-none">
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-xs text-slate-500 block mb-1">关联用户 ID（选填）</label>
              <input v-model="form.user_id" type="number" placeholder="如 1（可留空）"
                     class="w-full border px-3 py-2 rounded-lg text-sm font-mono focus:theme-border outline-none">
            </div>
            <div>
              <label class="text-xs text-slate-500 block mb-1">状态</label>
              <select v-model="form.status" class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
                <option value="active">active (生效中)</option>
                <option value="expired">expired (已过期)</option>
              </select>
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button type="button" @click="modalVisible=false" class="px-4 py-2 text-sm text-slate-500">取消</button>
            <button type="button" @click="submitForm" :disabled="saving"
                    class="theme-bg text-white px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50">
              {{ saving ? '保存中...' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
};
