/**
 * 赞助监控标的
 * - 按周期计价（后台可配）
 * - 添加标的 → 进入对应金额收款界面 → 提交凭证 → 审核通过后进入公共池
 * - 「我的赞助」展示：代码、名称、购买周期、剩余时间、状态
 * - 有效期内可改代码/名称；他人可点赞
 */
import { store } from "../../store.js";
import { sponsorApi } from "../../api/sponsor.js";

const { ref, reactive, computed, onMounted } = Vue;

export default {
  name: "Sponsor",
  setup() {
    const loading = ref(false);
    const mine = ref([]);
    const activeList = ref([]);
    const prices = computed(() => store.getSymbolPrices());

    const cart = ref([]); // { etf_code, etf_name }
    const form = reactive({ code: "", name: "" });
    const searching = ref(false);
    const selectedDays = ref(30);
    const payChannel = ref("wechat");
    const txId = ref("");
    const showPay = ref(false);
    const submitLoading = ref(false);
    const floatingAmount = ref("0.00");

    const editModal = reactive({
      visible: false,
      id: null,
      etf_code: "",
      etf_name: "",
    });
    const editLoading = ref(false);

    const settings = computed(() => store.state.publicSettings || {});
    const unitPrice = computed(() => {
      const p = prices.value.find((x) => x.days === selectedDays.value);
      return p ? Number(p.price) : 0;
    });
    const selectedLabel = computed(() => {
      const p = prices.value.find((x) => x.days === selectedDays.value);
      return p ? p.label : `${selectedDays.value}天`;
    });
    const totalBase = computed(() => unitPrice.value * cart.value.length);

    const isImageUrl = (url) => {
      const u = String(url || "").trim();
      return u && /^https?:\/\//i.test(u) && /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(u);
    };
    const qrSrc = computed(() => {
      const raw =
        payChannel.value === "wechat"
          ? settings.value.wechat_qr_url || ""
          : settings.value.alipay_qr_url || "";
      return isImageUrl(raw) ? raw.trim() : "";
    });

    const fetchName = async (code) => {
      try {
        const m = String(code || "").match(/\d{6}/);
        if (!m) return "";
        const c = m[0];
        const prefix = ["5", "6", "9"].includes(c[0]) ? "sh" : "sz";
        const resp = await fetch(`https://qt.gtimg.cn/q=${prefix}${c}`);
        if (!resp.ok) return "";
        const text = new TextDecoder("gbk").decode(await resp.arrayBuffer());
        const match = text.match(/="[^~]+~([^~]+)/);
        return match ? match[1].trim() : "";
      } catch {
        return "";
      }
    };

    let timer = null;
    const onCodeInput = () => {
      form.name = "";
      if (timer) clearTimeout(timer);
      const code = form.code.trim();
      if (!/^\d{6}$/.test(code)) return;
      timer = setTimeout(async () => {
        searching.value = true;
        form.name = (await fetchName(code)) || "";
        searching.value = false;
      }, 300);
    };

    const addToCart = async () => {
      const code = form.code.trim().replace(/\D/g, "").slice(-6);
      if (code.length !== 6) {
        store.showToast("请输入 6 位代码", "error");
        return;
      }
      if (cart.value.some((x) => x.etf_code === code)) {
        store.showToast("已在清单中", "error");
        return;
      }
      if (!form.name) form.name = (await fetchName(code)) || code;
      cart.value.push({ etf_code: code, etf_name: form.name || code });
      form.code = "";
      form.name = "";
      regenFloat();
    };

    const removeCart = (code) => {
      cart.value = cart.value.filter((x) => x.etf_code !== code);
      regenFloat();
    };

    const regenFloat = () => {
      const base = totalBase.value;
      const cents = (Math.floor(Math.random() * 5) + 1) / 100;
      floatingAmount.value = (base + cents).toFixed(2);
    };

    /** 添加完成后进入收款界面 */
    const openPay = () => {
      if (!store.state.isLoggedIn) {
        store.state.authMode = "login";
        store.state.authModalVisible = true;
        return;
      }
      if (!cart.value.length) {
        store.showToast("请先添加标的", "error");
        return;
      }
      if (!(unitPrice.value > 0)) {
        store.showToast("请选择有效周期", "error");
        return;
      }
      regenFloat();
      txId.value = "";
      showPay.value = true;
    };

    const submitOrder = async () => {
      if (!/^\d{6}$/.test(txId.value)) {
        store.showToast("请填写 6 位支付凭证", "error");
        return;
      }
      submitLoading.value = true;
      try {
        await sponsorApi.submitOrder({
          items: cart.value,
          days: selectedDays.value,
          amount: Number(floatingAmount.value),
          tx_id_last6: txId.value.trim(),
        });
        store.showToast("订单已提交，审核通过后标的将进入公共监控池，并显示在「我的赞助」");
        cart.value = [];
        txId.value = "";
        showPay.value = false;
        await loadMine();
      } catch (e) {
        store.showToast(e.message || "提交失败", "error");
      } finally {
        submitLoading.value = false;
      }
    };

    const loadMine = async () => {
      if (!store.state.isLoggedIn) {
        mine.value = [];
        return;
      }
      try {
        const res = await sponsorApi.fetchMine();
        mine.value = res.data || [];
      } catch (_) {
        mine.value = [];
      }
    };

    const loadActive = async () => {
      try {
        const res = await sponsorApi.fetchActive();
        activeList.value = res.data || [];
      } catch (_) {
        activeList.value = [];
      }
    };

    const openEdit = (row) => {
      editModal.visible = true;
      editModal.id = row.id;
      editModal.etf_code = row.etf_code;
      editModal.etf_name = row.etf_name || "";
    };

    const saveEdit = async () => {
      const code = String(editModal.etf_code || "").replace(/\D/g, "").slice(-6);
      if (code.length !== 6) {
        store.showToast("代码须为 6 位", "error");
        return;
      }
      editLoading.value = true;
      try {
        await sponsorApi.updateSymbol(editModal.id, {
          etf_code: code,
          etf_name: editModal.etf_name,
        });
        store.showToast("已更新");
        editModal.visible = false;
        await Promise.all([loadMine(), loadActive()]);
      } catch (e) {
        store.showToast(e.message || "更新失败", "error");
      } finally {
        editLoading.value = false;
      }
    };

    const toggleLike = async (row) => {
      if (!store.state.isLoggedIn) {
        store.state.authMode = "login";
        store.state.authModalVisible = true;
        return;
      }
      try {
        if (row.liked_by_me) {
          await sponsorApi.unlike(row.id);
          row.liked_by_me = false;
          row.like_count = Math.max(0, (row.like_count || 1) - 1);
        } else {
          await sponsorApi.like(row.id);
          row.liked_by_me = true;
          row.like_count = (row.like_count || 0) + 1;
        }
      } catch (e) {
        store.showToast(e.message || "操作失败", "error");
      }
    };

    const formatTime = (ts) => {
      if (!ts) return "-";
      const d = new Date(Number(ts));
      if (isNaN(d.getTime())) return "-";
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
    };

    const isActive = (row) =>
      row.status === "active" && Number(row.expire_at) > Date.now();

    /** 剩余天数（自然日） */
    const remainDays = (row) => {
      if (!row || !row.expire_at) return 0;
      const left = Number(row.expire_at) - Date.now();
      if (left <= 0) return 0;
      return Math.ceil(left / 86400000);
    };

    const remainText = (row) => {
      if (!isActive(row)) return "已过期";
      const d = remainDays(row);
      if (d <= 0) return "即将到期";
      if (d === 1) return "不足 1 天";
      return `剩余 ${d} 天`;
    };

    onMounted(async () => {
      loading.value = true;
      const ch = settings.value.default_pay_channel || "wechat";
      payChannel.value = ch === "alipay" ? "alipay" : "wechat";
      if (prices.value.length) selectedDays.value = prices.value[0].days;
      await Promise.all([loadMine(), loadActive()]);
      loading.value = false;
    });

    return {
      store: store.state,
      loading,
      mine,
      activeList,
      prices,
      cart,
      form,
      searching,
      selectedDays,
      selectedLabel,
      unitPrice,
      totalBase,
      payChannel,
      txId,
      showPay,
      submitLoading,
      floatingAmount,
      qrSrc,
      editModal,
      editLoading,
      onCodeInput,
      addToCart,
      removeCart,
      openPay,
      submitOrder,
      openEdit,
      saveEdit,
      toggleLike,
      formatTime,
      isActive,
      remainDays,
      remainText,
      loadActive,
      loadMine,
    };
  },
  template: `
    <div class="max-w-4xl mx-auto space-y-5 select-none">
      <div>
        <h2 class="text-2xl font-bold text-slate-800">赞助监控标的</h2>
        <p class="text-xs text-slate-500 mt-2 leading-relaxed">
          你赞助的标的会进入<strong class="text-slate-700">公共监控池</strong>，所有注册会员均可免费查看行情与图表。
          添加标的后进入收款界面完成支付；审核通过后在「我的赞助」可查看代码、名称、购买周期与剩余时间。有效期内可修改标的。
        </p>
      </div>

      <!-- 定价与加购 -->
      <div class="bg-white rounded-xl border border-slate-100 p-5 shadow-sm space-y-4">
        <div class="text-sm font-bold text-slate-700">① 选择周期并添加标的</div>
        <div class="flex flex-wrap gap-2">
          <button v-for="p in prices" :key="p.days" type="button" @click="selectedDays=p.days; regenFloat && regenFloat()"
                  class="px-3 py-2 rounded-lg border text-xs font-bold transition"
                  :class="selectedDays===p.days ? 'theme-bg text-white border-transparent' : 'bg-white text-slate-600'">
            {{ p.label }} · ¥{{ p.price }}/只
          </button>
        </div>
        <div class="flex flex-col sm:flex-row gap-2">
          <input v-model="form.code" @input="onCodeInput" maxlength="6" placeholder="6位代码"
                 class="flex-1 border rounded-lg px-3 py-2 text-sm font-mono uppercase">
          <input v-model="form.name" placeholder="名称（可自动识别）"
                 class="flex-1 border rounded-lg px-3 py-2 text-sm">
          <button type="button" @click="addToCart" class="theme-bg text-white px-4 py-2 rounded-lg text-xs font-bold shrink-0">
            加入清单
          </button>
        </div>
        <p v-if="searching" class="text-xs text-slate-400"><i class="fa-solid fa-spinner animate-spin mr-1"></i>识别中…</p>

        <div v-if="cart.length" class="border rounded-lg overflow-hidden">
          <div class="bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 flex justify-between">
            <span>待购清单（{{ cart.length }} 只）· {{ selectedLabel }}</span>
            <span>合计约 ¥{{ totalBase.toFixed(2) }}</span>
          </div>
          <div class="divide-y">
            <div v-for="c in cart" :key="c.etf_code" class="px-3 py-2 text-sm flex justify-between items-center">
              <span><span class="font-mono font-bold">{{ c.etf_code }}</span>
                <span class="text-slate-500 ml-2">{{ c.etf_name }}</span></span>
              <button type="button" @click="removeCart(c.etf_code)" class="text-xs text-red-500">移除</button>
            </div>
          </div>
          <div class="p-3 text-right">
            <button type="button" @click="openPay" class="theme-bg text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm">
              ② 去支付 · ¥{{ totalBase.toFixed(2) }}
            </button>
          </div>
        </div>
      </div>

      <!-- 我的赞助：代码、名称、购买周期、剩余时间 -->
      <div class="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
        <div class="px-4 py-3 border-b flex justify-between items-center">
          <span class="font-bold text-slate-700 text-sm">我的赞助</span>
          <button type="button" @click="loadMine" class="text-xs text-slate-400 hover:theme-text">
            <i class="fa-solid fa-rotate-right"></i>
          </button>
        </div>
        <div v-if="!store.isLoggedIn" class="py-8 text-center text-sm text-slate-400">登录后查看</div>
        <div v-else-if="!mine.length" class="py-8 text-center text-sm text-slate-400">暂无赞助记录（支付并审核通过后显示）</div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm text-left">
            <thead class="bg-slate-50 text-xs text-slate-500 border-b">
              <tr>
                <th class="py-2 px-3">代码</th>
                <th class="py-2 px-3">名称</th>
                <th class="py-2 px-3">购买周期</th>
                <th class="py-2 px-3">到期日</th>
                <th class="py-2 px-3">剩余时间</th>
                <th class="py-2 px-3">状态</th>
                <th class="py-2 px-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="r in mine" :key="r.id">
                <td class="py-2.5 px-3 font-mono font-bold">{{ r.etf_code }}</td>
                <td class="py-2.5 px-3">{{ r.etf_name }}</td>
                <td class="py-2.5 px-3 text-xs font-bold text-slate-600">{{ r.days || '-' }} 天</td>
                <td class="py-2.5 px-3 text-xs font-mono text-slate-500">{{ formatTime(r.expire_at) }}</td>
                <td class="py-2.5 px-3 text-xs font-bold"
                    :class="isActive(r) ? (remainDays(r) <= 7 ? 'text-amber-600' : 'text-emerald-600') : 'text-slate-400'">
                  {{ remainText(r) }}
                </td>
                <td class="py-2.5 px-3">
                  <span class="text-xs font-bold px-2 py-0.5 rounded-full"
                        :class="isActive(r) ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'">
                    {{ isActive(r) ? '有效' : '已过期' }}
                  </span>
                </td>
                <td class="py-2.5 px-3 text-right">
                  <button v-if="isActive(r)" type="button" @click="openEdit(r)" class="text-xs theme-text font-bold">修改标的</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 公共赞助池 + 点赞 -->
      <div class="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
        <div class="px-4 py-3 border-b flex justify-between items-center">
          <span class="font-bold text-slate-700 text-sm">当前公共赞助池</span>
          <button type="button" @click="loadActive" class="text-xs text-slate-400 hover:theme-text">刷新</button>
        </div>
        <div v-if="loading" class="py-10 text-center text-slate-400 text-sm">加载中…</div>
        <div v-else-if="!activeList.length" class="py-10 text-center text-sm text-slate-400">暂无会员赞助标的</div>
        <div v-else class="divide-y">
          <div v-for="r in activeList" :key="r.id" class="px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
            <div>
              <div class="font-mono font-bold text-slate-800">{{ r.etf_code }}
                <span class="font-sans font-normal text-slate-600 ml-2 text-sm">{{ r.etf_name }}</span>
              </div>
              <div class="text-[11px] text-slate-400 mt-0.5">
                赞助者 {{ r.username || '会员' }} · {{ r.days || '-' }} 天 · 至 {{ formatTime(r.expire_at) }}
              </div>
            </div>
            <button type="button" @click="toggleLike(r)"
                    class="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition"
                    :class="r.liked_by_me ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white border-slate-200 text-slate-500 hover:border-rose-200'">
              <i class="fa-solid fa-heart"></i>
              {{ r.like_count || 0 }}
            </button>
          </div>
        </div>
      </div>

      <!-- 支付弹层：对应金额收款界面 -->
      <div v-if="showPay" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="showPay=false">
        <div class="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
          <h3 class="font-bold text-slate-800 text-center">支付赞助费用</h3>
          <div class="text-center space-y-1">
            <div class="text-xs text-amber-700 bg-amber-50 inline-block px-2 py-0.5 rounded border border-amber-100">请支付下方精准金额（勿多付少付）</div>
            <div class="text-3xl font-extrabold text-red-500 font-mono">¥ {{ floatingAmount }}</div>
            <div class="text-xs text-slate-500">
              {{ cart.length }} 只 × {{ selectedLabel }}（单价 ¥{{ unitPrice }}）
            </div>
          </div>
          <div class="bg-slate-50 rounded-lg p-3 text-[11px] text-slate-600 space-y-0.5 max-h-28 overflow-y-auto">
            <div v-for="c in cart" :key="c.etf_code" class="flex justify-between">
              <span class="font-mono font-bold">{{ c.etf_code }}</span>
              <span class="text-slate-500 truncate ml-2">{{ c.etf_name }}</span>
            </div>
          </div>
          <div class="flex justify-center gap-2 text-xs">
            <button type="button" @click="payChannel='wechat'" class="px-3 py-1 rounded-full border"
                    :class="payChannel==='wechat'?'theme-bg text-white border-transparent':''">微信</button>
            <button type="button" @click="payChannel='alipay'" class="px-3 py-1 rounded-full border"
                    :class="payChannel==='alipay'?'theme-bg text-white border-transparent':''">支付宝</button>
          </div>
          <div class="flex justify-center">
            <img v-if="qrSrc" :src="qrSrc" class="w-44 h-44 object-contain border rounded-lg" alt="收款码">
            <p v-else class="text-xs text-slate-400 py-8">请在后台配置收款码</p>
          </div>
          <div>
            <label class="text-[11px] text-slate-500 block mb-1 text-center">支付完成后填写凭证后 6 位数字</label>
            <input v-model="txId" maxlength="6" placeholder="例如：123456"
                   class="w-full border rounded-lg px-3 py-2.5 text-center font-mono text-sm tracking-widest">
          </div>
          <div class="flex gap-2 justify-end pt-1">
            <button type="button" @click="showPay=false" class="text-sm text-slate-500 px-3">取消</button>
            <button type="button" @click="submitOrder" :disabled="submitLoading || !/^\\d{6}$/.test(txId)"
                    class="theme-bg text-white px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50">
              {{ submitLoading ? '提交中…' : '提交订单' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 修改标的 -->
      <div v-if="editModal.visible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="editModal.visible=false">
        <div class="bg-white rounded-2xl w-full max-w-sm p-6 space-y-3 shadow-2xl">
          <h3 class="font-bold text-slate-800">修改赞助标的</h3>
          <input v-model="editModal.etf_code" maxlength="6" placeholder="代码" class="w-full border rounded-lg px-3 py-2 font-mono text-sm">
          <input v-model="editModal.etf_name" placeholder="名称" class="w-full border rounded-lg px-3 py-2 text-sm">
          <div class="flex justify-end gap-2">
            <button type="button" @click="editModal.visible=false" class="text-sm text-slate-500">取消</button>
            <button type="button" @click="saveEdit" :disabled="editLoading" class="theme-bg text-white px-4 py-2 rounded-lg text-sm font-bold">保存</button>
          </div>
        </div>
      </div>
    </div>
  `,
};
