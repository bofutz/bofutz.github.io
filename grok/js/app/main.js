/**
 * 前台入口：路由 + 公共状态 + 挂载
 */
import {
  createApp, ref, reactive, computed, watch, onMounted, onUnmounted, nextTick,
} from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";

import { API_BASE, PROTECTED_ROUTES } from "../config.js";
import { apiFetch } from "../api.js";
import {
  isLoggedIn, isVip, username, vipDaysLeft, referralCode,
  checkLoginState, clearLoginState, updateVipDays,
} from "../auth.js";
import { useLayout } from "./layout.js";

// ---------- Views ----------
import { DashboardView } from "./views/dashboard.js";
import { ProfileView } from "./views/profile.js";
import { PlanView } from "./views/plan.js";
import { TicketsView } from "./views/tickets.js";
import { DocsView } from "./views/docs.js";

createApp({
  components: {
    DashboardView,
    ProfileView,
    PlanView,
    TicketsView,
    DocsView,
  },
  setup() {
    // ========== 路由 ==========
    const currentRoute = ref(window.location.hash || "#/");

    const navigate = (path) => {
      if (PROTECTED_ROUTES.includes(path) && !isLoggedIn.value) {
        layout.openAuth("login");
        return;
      }
      currentRoute.value = path;
      window.location.hash = path;
      layout.menuOpen.value = false;
    };

    // ========== 公共设置 ==========
    const publicSettings = ref({
      gift_register_days: "1",
      gift_inviter_days: "3",
      gift_invitee_days: "2",
      free_top_n_charts: "3",
      pay_register_enabled: "1",
      alipay_qr_url: "",
      wechat_qr_url: "",
      default_pay_channel: "alipay",
      custom_max_symbols: "3",
      social_douyin: "",
      social_shipinhao: "",
      social_xiaohongshu: "",
      social_gongzhonghao: "",
      social_kuaishou: "",
    });

    const fetchPublicSettings = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/settings/public`);
        const data = await res.json();
        if (data.success && data.data) {
          publicSettings.value = { ...publicSettings.value, ...data.data };
        }
      } catch (_) {}
    };

    // ========== 定制草稿（layout 弹窗 + plan 共用） ==========
    const customDraftItems = ref([{ etf_code: "", etf_name: "" }]);
    const customDedupeTip = ref("");
    const customMaxSymbols = computed(() =>
      Math.max(1, parseInt(publicSettings.value.custom_max_symbols, 10) || 3)
    );
    const customSymbolCount = computed(
      () => customDraftItems.value.filter((r) => String(r.etf_code || "").trim()).length || 0
    );

    const pureCode = (code) => {
      const m = String(code || "").match(/\d{6}/);
      return m ? m[0] : String(code || "").trim();
    };

    const dedupeCustomDraft = () => {
      const seen = new Set();
      const next = [];
      let removed = 0;
      for (const row of customDraftItems.value) {
        const raw = String(row.etf_code || "").trim();
        if (!raw) {
          next.push(row);
          continue;
        }
        const key = pureCode(raw) || raw.toUpperCase();
        if (seen.has(key)) {
          removed++;
          continue;
        }
        seen.add(key);
        next.push({ ...row, etf_code: raw });
      }
      if (next.length === 0) next.push({ etf_code: "", etf_name: "" });
      const max = customMaxSymbols.value;
      const filled = next.filter((r) => String(r.etf_code || "").trim());
      if (filled.length > max) {
        const kept = [];
        const keys = new Set();
        for (const r of next) {
          const raw = String(r.etf_code || "").trim();
          if (!raw) {
            kept.push(r);
            continue;
          }
          const key = pureCode(raw) || raw.toUpperCase();
          if (keys.size >= max) {
            removed++;
            continue;
          }
          keys.add(key);
          kept.push(r);
        }
        customDraftItems.value = kept.length ? kept : [{ etf_code: "", etf_name: "" }];
        customDedupeTip.value = `已自动去重/截断，定制套餐最多 ${max} 只`;
      } else {
        customDraftItems.value = next;
        customDedupeTip.value = removed > 0 ? `已自动去除 ${removed} 个重复代码` : "";
      }
    };

    const confirmCustomAndPay = () => {
      dedupeCustomDraft();
      const items = customDraftItems.value
        .map((r) => ({
          etf_code: String(r.etf_code || "").trim(),
          etf_name: String(r.etf_name || r.etf_code || "").trim(),
        }))
        .filter((r) => r.etf_code);
      if (!items.length) {
        alert("请至少填写一只代码");
        return;
      }
      if (items.length > customMaxSymbols.value) {
        alert(`定制套餐最多 ${customMaxSymbols.value} 只`);
        return;
      }
      sessionStorage.setItem("pending_custom_items", JSON.stringify(items));
      layout.customEditorVisible.value = false;
      navigate("#/plan");
      // plan 页会读取 pending_custom_items 并切到定制 tab
    };

    // ========== Layout ==========
    const layout = useLayout({
      currentRoute,
      navigate,
      publicSettings,
      customDraftItems,
      customMaxSymbols,
      customDedupeTip,
      dedupeCustomDraft,
      confirmCustomAndPay,
    });

    // 登录成功后的刷新钩子（各 view 可监听 isLoggedIn）
    const onLoginSuccess = () => {
      // 预留：后续可触发各模块 refresh
    };

    // ========== 生命周期 ==========
    const onHashChange = () => {
      currentRoute.value = window.location.hash || "#/";
    };

    onMounted(() => {
      checkLoginState();
      fetchPublicSettings();
      window.addEventListener("click", layout.closeDropdowns);
      window.addEventListener("hashchange", onHashChange);
    });

    onUnmounted(() => {
      window.removeEventListener("click", layout.closeDropdowns);
      window.removeEventListener("hashchange", onHashChange);
    });

    return {
      // 路由
      currentRoute,
      navigate,
      // 公共
      publicSettings,
      isLoggedIn,
      isVip,
      username,
      vipDaysLeft,
      referralCode,
      // 定制草稿
      customDraftItems,
      customDedupeTip,
      customMaxSymbols,
      customSymbolCount,
      dedupeCustomDraft,
      confirmCustomAndPay,
      // layout 透出
      ...layout,
      onLoginSuccess,
      // 给子组件用的
      openAuth: layout.openAuth,
      openCustomEditor: layout.openCustomEditor,
      logout: (show = true) => layout.logout(show, () => {}),
    };
  },

  template: `
    <div class="flex w-full h-full" @click="closeDropdowns">
      <div class="flex-1 flex flex-col h-full overflow-hidden relative">
        <!-- 顶栏 -->
        ${/* header 由 layout 提供，这里直接内联拼接 */ ""}
        <header class="h-14 sm:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-6 z-10 shrink-0">
          <div class="flex items-center gap-2 sm:gap-3">
            <button @click.stop="menuOpen = true" class="text-slate-500 hover:text-slate-700 p-2">
              <i class="fa-solid fa-bars text-xl"></i>
            </button>
            <a @click.prevent="navigate('#/')" href="#/" class="flex items-center gap-2 cursor-pointer hover:opacity-85">
              <img src="assets/logo.png" alt="Logo" class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-cover shadow-sm border border-slate-100" onerror="this.style.display='none'">
              <span class="text-base sm:text-lg font-bold theme-text tracking-wide hidden sm:block">波幅探长</span>
            </a>
            <span class="text-sm font-semibold text-slate-500 border-l border-slate-200 pl-3 hidden sm:block">{{ pageTitle }}</span>
            <span class="text-sm font-semibold text-slate-700 sm:hidden">{{ pageTitle }}</span>
          </div>
          <div class="flex items-center gap-2 sm:gap-5">
            <div v-if="!isLoggedIn" class="flex gap-2">
              <button @click="openAuth('login')" class="text-sm font-medium text-slate-600 hover:theme-text px-1">登录</button>
              <button @click="openAuth('register')" class="text-sm font-medium theme-bg text-white px-3 py-1.5 rounded-lg hover:opacity-90 shadow-sm">注册</button>
            </div>
            <div v-else class="relative">
              <div @click.stop="userMenuOpen = !userMenuOpen" class="flex items-center gap-2 cursor-pointer hover:bg-slate-50 px-2 py-1 rounded select-none">
                <i class="fa-solid fa-circle-user text-slate-400 text-2xl"></i>
                <span class="text-sm font-medium text-slate-600 hidden sm:inline">{{ username }}</span>
                <i class="fa-solid fa-chevron-down text-[10px] text-slate-400" :class="{'rotate-180': userMenuOpen}"></i>
              </div>
              <div v-if="userMenuOpen" @click.stop class="absolute right-0 mt-2 w-36 bg-white rounded-xl shadow-lg border border-slate-100 z-50 overflow-hidden">
                <div @click="navigate('#/profile'); userMenuOpen=false" class="px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer flex items-center border-b border-slate-50">
                  <i class="fa-regular fa-user mr-2 text-slate-400"></i>个人中心
                </div>
                <div @click="logout(true); userMenuOpen=false" class="px-4 py-3 text-sm text-red-500 hover:bg-red-50 cursor-pointer flex items-center">
                  <i class="fa-solid fa-right-from-bracket mr-2"></i>退出登录
                </div>
              </div>
            </div>
          </div>
        </header>

        <main class="flex-1 overflow-auto custom-scrollbar p-3 sm:p-6 relative flex flex-col justify-between">
          <div class="flex-1">
            <DashboardView v-if="currentRoute === '#/'" :public-settings="publicSettings" :navigate="navigate" :open-auth="openAuth" />
            <ProfileView v-else-if="currentRoute === '#/profile'" :public-settings="publicSettings" :navigate="navigate" :open-auth="openAuth" :open-custom-editor="openCustomEditor" />
            <PlanView v-else-if="currentRoute === '#/plan'"
              :public-settings="publicSettings"
              :navigate="navigate"
              :open-auth="openAuth"
              :custom-draft-items="customDraftItems"
              :custom-dedupe-tip="customDedupeTip"
              :custom-max-symbols="customMaxSymbols"
              :custom-symbol-count="customSymbolCount"
              :dedupe-custom-draft="dedupeCustomDraft"
            />
            <TicketsView v-else-if="currentRoute === '#/tickets'" :open-auth="openAuth" />
            <DocsView v-else-if="currentRoute === '#/docs'" :public-settings="publicSettings" />
          </div>

          <!-- 页脚 -->
          <footer class="mt-10 pt-5 pb-5 border-t border-slate-200/80 text-center text-xs text-slate-500 shrink-0">
            <div class="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div class="flex items-center gap-2">
                <img src="assets/logo.png" alt="Logo" class="w-5 h-5 rounded object-cover" onerror="this.style.display='none'">
                <span>© 2026 波幅探长 · 专业的波幅监控与数据分析平台</span>
              </div>
              <div class="flex items-center gap-4 text-slate-400">
                <a v-if="publicSettings.social_douyin" :href="publicSettings.social_douyin" target="_blank" rel="noopener" class="social-item hover:text-slate-700 transition-colors" title="抖音">
                  <i class="fa-brands fa-tiktok text-lg"></i>
                  <div class="social-qr-pop">
                    <img :src="'https://api.qrserver.com/v1/create-qr-code/?size=160x160&data='+encodeURIComponent(publicSettings.social_douyin)" alt="抖音">
                    <p class="text-[10px] text-slate-500 mt-1 text-center">抖音</p>
                  </div>
                </a>
                <a v-if="publicSettings.social_shipinhao" :href="publicSettings.social_shipinhao" target="_blank" rel="noopener" class="social-item hover:text-[#07C160] transition-colors" title="视频号">
                  <i class="fa-brands fa-weixin text-lg"></i>
                  <div class="social-qr-pop">
                    <img :src="'https://api.qrserver.com/v1/create-qr-code/?size=160x160&data='+encodeURIComponent(publicSettings.social_shipinhao)" alt="视频号">
                    <p class="text-[10px] text-slate-500 mt-1 text-center">视频号</p>
                  </div>
                </a>
                <a v-if="publicSettings.social_xiaohongshu" :href="publicSettings.social_xiaohongshu" target="_blank" rel="noopener" class="social-item hover:text-[#FE2C55] transition-colors" title="小红书">
                  <i class="fa-solid fa-book text-lg"></i>
                  <div class="social-qr-pop">
                    <img :src="'https://api.qrserver.com/v1/create-qr-code/?size=160x160&data='+encodeURIComponent(publicSettings.social_xiaohongshu)" alt="小红书">
                    <p class="text-[10px] text-slate-500 mt-1 text-center">小红书</p>
                  </div>
                </a>
                <a v-if="publicSettings.social_gongzhonghao" :href="publicSettings.social_gongzhonghao" target="_blank" rel="noopener" class="social-item hover:text-[#07C160] transition-colors" title="公众号">
                  <i class="fa-solid fa-comment-dots text-lg"></i>
                  <div class="social-qr-pop">
                    <img :src="'https://api.qrserver.com/v1/create-qr-code/?size=160x160&data='+encodeURIComponent(publicSettings.social_gongzhonghao)" alt="公众号">
                    <p class="text-[10px] text-slate-500 mt-1 text-center">公众号</p>
                  </div>
                </a>
                <a v-if="publicSettings.social_kuaishou" :href="publicSettings.social_kuaishou" target="_blank" rel="noopener" class="social-item hover:text-[#FF4906] transition-colors" title="快手">
                  <i class="fa-solid fa-video text-lg"></i>
                  <div class="social-qr-pop">
                    <img :src="'https://api.qrserver.com/v1/create-qr-code/?size=160x160&data='+encodeURIComponent(publicSettings.social_kuaishou)" alt="快手">
                    <p class="text-[10px] text-slate-500 mt-1 text-center">快手</p>
                  </div>
                </a>
              </div>
            </div>
          </footer>
        </main>
      </div>

      <!-- 侧栏 -->
      <aside
        class="fixed inset-y-0 left-0 w-64 bg-white z-50 transform transition-transform duration-300 flex flex-col shadow-2xl"
        :class="menuOpen ? 'translate-x-0' : '-translate-x-full'"
      >
        <div class="h-14 sm:h-16 theme-bg text-white flex items-center justify-between px-5 text-lg tracking-wider">
          <a href="#/" @click="menuOpen=false" class="flex items-center gap-2 text-white">
            <img src="assets/logo.png" class="w-7 h-7 rounded-full bg-white/20 p-0.5 object-cover" onerror="this.style.display='none'">
            <span>波幅探长</span>
          </a>
          <button @click="menuOpen=false" class="text-white/70 hover:text-white">
            <i class="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto py-2 custom-scrollbar">
          <div @click="navigate('#/')" class="nav-item block px-6 py-3.5 border-b border-slate-50" :class="{active: currentRoute==='#/'}">
            <i class="fa-solid fa-chart-simple w-6"></i> 数据看板
          </div>
          <div @click="requireLoginThen('#/profile')" class="nav-item block px-6 py-3.5 border-b border-slate-50" :class="{active: currentRoute==='#/profile'}">
            <i class="fa-solid fa-user w-6"></i> 个人中心
          </div>
          <div @click="navigate('#/plan')" class="nav-item block px-6 py-3.5 border-b border-slate-50" :class="{active: currentRoute==='#/plan'}">
            <i class="fa-solid fa-bag-shopping w-6"></i> 购买套餐
          </div>
          <div @click="requireLoginThen('#/tickets')" class="nav-item block px-6 py-3.5 border-b border-slate-50" :class="{active: currentRoute==='#/tickets'}">
            <i class="fa-solid fa-headset w-6"></i> 答疑留言
          </div>
          <div @click="navigate('#/docs')" class="nav-item block px-6 py-3.5" :class="{active: currentRoute==='#/docs'}">
            <i class="fa-solid fa-book w-6"></i> 使用说明
          </div>
        </div>
      </aside>
      <div v-if="menuOpen" @click="menuOpen=false" class="fixed inset-0 bg-black/40 z-40 sm:hidden"></div>

      <!-- 登录注册弹窗 -->
      <div v-if="authModalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="closeAuth">
        <div class="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
          <div class="flex border-b border-slate-100">
            <button @click="switchAuthMode('login')" class="flex-1 py-4 text-sm font-medium" :class="authMode==='login'?'theme-text border-b-2 theme-border':'text-slate-400'">账号登录</button>
            <button @click="switchAuthMode('register')" class="flex-1 py-4 text-sm font-medium" :class="authMode==='register'?'theme-text border-b-2 theme-border':'text-slate-400'">免费注册</button>
          </div>
          <div class="p-6 space-y-3.5">
            <div v-if="authMode==='register'" class="bg-emerald-50 text-emerald-600 text-xs p-2 rounded-lg text-center border border-emerald-100">
              新注册即送通用 VIP <strong>{{ publicSettings.gift_register_days || 1 }}</strong> 天
            </div>
            <input v-model="authForm.username" type="email" :placeholder="authMode==='register'?'注册电子邮箱':'邮箱账号'" class="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none">
            <div v-show="authMode==='register'" class="flex justify-center min-h-[65px]"><div id="turnstile-container"></div></div>
            <div v-if="authMode==='register'" class="flex gap-2">
              <input v-model="authForm.emailCode" type="text" placeholder="6位邮箱验证码" class="flex-1 px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm font-mono">
              <button @click="sendEmailCode" type="button" :disabled="sendCodeLoading||countdown>0" class="px-3 py-2 text-xs theme-bg text-white rounded-lg disabled:opacity-50 whitespace-nowrap">
                {{ countdown>0 ? countdown+'s' : (sendCodeLoading?'发送中...':'获取验证码') }}
              </button>
            </div>
            <input v-model="authForm.password" type="password" :placeholder="authMode==='register'?'设置密码(至少6位)':'输入密码'" class="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm">
            <input v-if="authMode==='register'" v-model="authForm.refCode" type="text" placeholder="推荐码(选填)" class="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm">
            <p v-if="authMode==='register' && authForm.refCode" class="text-[11px] text-slate-400">
              填写邀请码后，双方各送 VIP：邀请人 {{ publicSettings.gift_inviter_days || 3 }} 天 · 您 {{ (Number(publicSettings.gift_register_days)||1) + (Number(publicSettings.gift_invitee_days)||2) }} 天（含注册赠送）
            </p>
            <button @click="submitAuth(onLoginSuccess)" :disabled="authLoading" class="w-full theme-bg text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-50">
              {{ authMode==='login'?'立即登录':'注册账号' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 定制编辑弹窗 -->
      <div v-if="customEditorVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="customEditorVisible=false">
        <div class="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
          <div class="px-6 py-4 border-b bg-slate-50 font-medium">添加定制监控</div>
          <div class="p-6 space-y-3">
            <div v-for="(row, i) in customDraftItems" :key="i" class="flex gap-2">
              <input v-model="row.etf_code" @blur="dedupeCustomDraft" placeholder="代码" class="w-28 px-2 py-2 border rounded-lg text-sm font-mono">
              <input v-model="row.etf_name" placeholder="名称" class="flex-1 px-2 py-2 border rounded-lg text-sm">
              <button v-if="customDraftItems.length>1" @click="customDraftItems.splice(i,1); dedupeCustomDraft()" class="text-slate-300 hover:text-red-500 px-1">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
            <button v-if="customDraftItems.length < (Number(publicSettings.custom_max_symbols)||3)" @click="customDraftItems.push({etf_code:'',etf_name:''})" class="text-xs theme-text">
              + 再加一只
            </button>
            <p class="text-[11px] text-slate-400">套餐总价含最多 {{ publicSettings.custom_max_symbols || 3 }} 只，重复代码会自动去重。</p>
            <p v-if="customDedupeTip" class="text-xs text-amber-600">{{ customDedupeTip }}</p>
          </div>
          <div class="px-6 py-4 bg-slate-50 flex justify-end gap-2">
            <button @click="customEditorVisible=false" class="px-4 py-2 text-sm text-slate-500">取消</button>
            <button @click="confirmCustomAndPay" class="theme-bg text-white px-4 py-2 rounded-lg text-sm">去选套餐支付</button>
          </div>
        </div>
      </div>
    </div>
  `,
}).mount("#app");
