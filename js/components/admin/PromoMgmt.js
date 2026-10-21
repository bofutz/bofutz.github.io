/**
 * 波幅探长 - 后台【优惠码管理】组件 (v5.1)
 * 修复：
 *  1. 兼容日期留空或部分浏览器 datetime-local 解析 NaN 导致 D1 报错的问题
 *  2. 强化折扣数值校验（百分比 1~99，固定金额 > 0）與保存状态防连点
 */
import { store } from "../../store.js";
import { adminApi } from "../../api/admin.js";

const { ref, reactive, onMounted } = Vue;

export default {
  name: "PromoMgmt",
  setup() {
    const promos = ref([]);
    const loading = ref(false);
    const saving = ref(false);
    const modalVisible = ref(false);

    const promoForm = reactive({
      id: null,
      code: "",
      name: "",
      discount_type: "percent",
      discount_value: 10,
      startLocal: "",
      endLocal: "",
      enabled: true,
    });

    const loadPromos = async () => {
      loading.value = true;
      try {
        const res = await adminApi.fetchPromos();
        const raw = res?.data || res || [];
        promos.value = (Array.isArray(raw) ? raw : []).filter(
          (x) =>
            !(
              String(x.name || "").startsWith("__DELETED__") ||
              String(x.code || "").startsWith("__del_")
            )
        );
      } catch (err) {
        store.showToast(err.message || "加载优惠码失败", "error");
      } finally {
        loading.value = false;
      }
    };

    const toLocalInput = (ts) => {
      const n = Number(ts);
      if (!n || !Number.isFinite(n)) return "";
      const d = new Date(n < 1e12 ? n * 1000 : n);
      if (isNaN(d.getTime())) return "";
      const p = (v) => String(v).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
        d.getHours()
      )}:${p(d.getMinutes())}`;
    };

    const parseLocalInput = (str, fallbackTs) => {
      const s = String(str || "").trim();
      if (!s) return fallbackTs;
      const t = Date.parse(s);
      return Number.isFinite(t) && t > 0 ? t : fallbackTs;
    };

    const openModal = (p = null) => {
      const now = Date.now();
      if (p) {
        Object.assign(promoForm, {
          id: p.id,
          code: p.code || "",
          name: p.name || "",
          discount_type: p.discount_type === "fixed" ? "fixed" : "percent",
          discount_value: Number(p.discount_value) || 10,
          startLocal: toLocalInput(p.start_at) || toLocalInput(now),
          endLocal: toLocalInput(p.end_at) || toLocalInput(now + 30 * 86400000),
          enabled: p.enabled !== 0 && p.enabled !== false,
        });
      } else {
        Object.assign(promoForm, {
          id: null,
          code: "",
          name: "",
          discount_type: "percent",
          discount_value: 10,
          startLocal: toLocalInput(now),
          endLocal: toLocalInput(now + 30 * 86400000),
          enabled: true,
        });
      }
      modalVisible.value = true;
    };

    const submitPromo = async () => {
      const code = String(promoForm.code || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");
      if (!code) {
        store.showToast("请输入优惠码（如 VIP88）", "error");
        return;
      }
      const val = Number(promoForm.discount_value);
      if (!Number.isFinite(val) || val <= 0) {
        store.showToast("请输入大于 0 的有效折扣数值", "error");
        return;
      }
      if (promoForm.discount_type === "percent" && val >= 100) {
        store.showToast("百分比减免需在 1 ~ 99 之间（如填 20 代表减免 20% 即 8 折）", "error");
        return;
      }

      const now = Date.now();
      const startAt = parseLocalInput(promoForm.startLocal, now - 60000);
      const endAt = parseLocalInput(promoForm.endLocal, now + 365 * 86400000);
      if (endAt <= startAt) {
        store.showToast("截止时间必须晚于开始时间", "error");
        return;
      }

      saving.value = true;
      try {
        await adminApi.savePromo({
          id: promoForm.id || null,
          code,
          name: String(promoForm.name || "").trim() || code,
          discount_type: promoForm.discount_type === "fixed" ? "fixed" : "percent",
          discount_value: val,
          start_at: startAt,
          end_at: endAt,
          enabled: promoForm.enabled ? 1 : 0,
        });
        store.showToast(promoForm.id ? "优惠码已更新" : "优惠码已新增");
        modalVisible.value = false;
        await loadPromos();
      } catch (err) {
        store.showToast(err.message || "优惠码保存失败", "error");
      } finally {
        saving.value = false;
      }
    };

    const deletePromo = async (p) => {
      if (!confirm(`确认删除优惠码 ${p.code}？`)) return;
      try {
        await adminApi.deletePromo(p.id);
        store.showToast("已删除");
        await loadPromos();
      } catch (err) {
        store.showToast(err.message || "删除失败", "error");
      }
    };

    const formatDate = (ts) => {
      const n = Number(ts);
      if (!n || !Number.isFinite(n)) return "长期有效";
      const d = new Date(n < 1e12 ? n * 1000 : n);
      if (isNaN(d.getTime())) return "-";
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    };

    onMounted(loadPromos);

    return {
      promos,
      loading,
      saving,
      modalVisible,
      promoForm,
      loadPromos,
      openModal,
      submitPromo,
      deletePromo,
      formatDate,
    };
  },
  template: `
    <div class="space-y-4 select-none">
      <div class="flex flex-wrap justify-between items-center gap-2">
        <div>
          <h2 class="text-base font-bold text-slate-800">优惠码列表</h2>
          <p class="text-xs text-slate-400 mt-0.5">设置优惠码、折扣力度与有效期（前台「赞助标的」清单与支付弹窗均可直接核销）</p>
        </div>
        <div class="flex gap-2">
          <button type="button" @click="openModal()" class="theme-bg text-white text-xs px-3.5 py-2 rounded-lg font-bold hover:opacity-90">
            + 新增优惠码
          </button>
          <button type="button" @click="loadPromos" class="bg-white border px-3 py-2 rounded-lg text-xs hover:bg-slate-50">
            <i class="fa-solid fa-rotate-right" :class="{'animate-spin': loading}"></i>
          </button>
        </div>
      </div>

      <div class="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
        <div v-if="loading" class="text-center py-10 text-slate-400">
          <i class="fa-solid fa-circle-notch animate-spin text-xl theme-text"></i>
        </div>
        <div v-else-if="!promos.length" class="text-center py-10 text-slate-400 text-xs">
          暂无优惠码，点击右上角「新增优惠码」创建
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm text-left whitespace-nowrap">
            <thead class="bg-slate-50 text-slate-500 border-b text-xs font-bold">
              <tr>
                <th class="py-2.5 px-3">优惠码</th>
                <th class="py-2.5 px-3">名称</th>
                <th class="py-2.5 px-3">优惠力度</th>
                <th class="py-2.5 px-3">有效期</th>
                <th class="py-2.5 px-3">状态</th>
                <th class="py-2.5 px-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="p in promos" :key="p.id" class="hover:bg-slate-50">
                <td class="py-2.5 px-3 font-mono font-bold text-slate-800">{{ p.code }}</td>
                <td class="py-2.5 px-3 font-medium text-xs">{{ p.name || '-' }}</td>
                <td class="py-2.5 px-3 font-bold text-orange-500 font-mono text-xs">
                  {{ p.discount_type === 'percent' ? ('减免 ' + p.discount_value + '%') : ('立减 ¥' + p.discount_value) }}
                </td>
                <td class="py-2.5 px-3 text-xs font-mono text-slate-500">
                  {{ formatDate(p.start_at) }} ~ {{ formatDate(p.end_at) }}
                </td>
                <td class="py-2.5 px-3 text-xs">
                  <span :class="p.enabled ? 'text-emerald-600 font-bold' : 'text-slate-400'">
                    {{ p.enabled ? '启用' : '停用' }}
                  </span>
                </td>
                <td class="py-2.5 px-3 text-right space-x-1">
                  <button type="button" @click="openModal(p)" class="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded hover:bg-slate-200">编辑</button>
                  <button type="button" @click="deletePromo(p)" class="text-xs bg-red-50 text-red-500 px-2.5 py-1 rounded hover:bg-red-100">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 编辑/新增弹窗 -->
      <div v-if="modalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="modalVisible = false">
        <div class="bg-white rounded-2xl w-full max-w-md p-6 space-y-3.5 shadow-2xl">
          <div class="flex items-center justify-between">
            <h3 class="font-bold text-slate-800">{{ promoForm.id ? '编辑优惠码' : '新增优惠码' }}</h3>
            <button type="button" @click="modalVisible = false" class="text-slate-400 hover:text-slate-600">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div class="space-y-1">
            <label class="text-xs text-slate-500 block">优惠码（自动转大写，如 VIP88）</label>
            <input v-model="promoForm.code" placeholder="例如：VIP88"
                   class="w-full border px-3 py-2 rounded-lg text-sm font-mono uppercase focus:theme-border outline-none">
          </div>

          <div class="space-y-1">
            <label class="text-xs text-slate-500 block">备注名称（选填）</label>
            <input v-model="promoForm.name" placeholder="例如：老友专属福利"
                   class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <label class="text-xs text-slate-500 block">折扣方式</label>
              <select v-model="promoForm.discount_type" class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
                <option value="percent">按百分比减免 (%)</option>
                <option value="fixed">固定立减金额 (元)</option>
              </select>
            </div>
            <div class="space-y-1">
              <label class="text-xs text-slate-500 block">
                {{ promoForm.discount_type === 'percent' ? '减免比例 (1~99)' : '立减金额 (元)' }}
              </label>
              <input type="number" step="any" min="0.01" v-model.number="promoForm.discount_value"
                     :placeholder="promoForm.discount_type === 'percent' ? '填 20 即打8折' : '填 5 即减5元'"
                     class="w-full border px-3 py-2 rounded-lg text-sm font-mono focus:theme-border outline-none">
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label class="text-[11px] text-slate-400 block mb-0.5">生效开始（可留空=立即）</label>
              <input type="datetime-local" v-model="promoForm.startLocal" class="w-full border px-2.5 py-1.5 rounded-lg text-xs focus:theme-border outline-none">
            </div>
            <div>
              <label class="text-[11px] text-slate-400 block mb-0.5">生效截止（可留空=默认1年）</label>
              <input type="datetime-local" v-model="promoForm.endLocal" class="w-full border px-2.5 py-1.5 rounded-lg text-xs focus:theme-border outline-none">
            </div>
          </div>

          <label class="flex items-center gap-2 text-sm text-slate-600 cursor-pointer pt-1">
            <input type="checkbox" v-model="promoForm.enabled"> 立即启用该优惠码
          </label>

          <div class="flex justify-end gap-2 pt-2">
            <button type="button" @click="modalVisible = false" class="px-4 py-2 text-sm text-slate-500">取消</button>
            <button type="button" @click="submitPromo" :disabled="saving"
                    class="theme-bg text-white px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50">
              {{ saving ? '保存中...' : '保存优惠码' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
};
