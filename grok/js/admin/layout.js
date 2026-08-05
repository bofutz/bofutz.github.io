/**
 * 后台布局：登录页、顶栏、侧栏、Toast
 */
import { ref, computed } from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";
import { adminFetch } from "../api.js";

export function useAdminLayout() {
  const adminSecret = ref(localStorage.getItem("admin_secret") || "");
  const isAuthenticated = ref(false);
  const currentTab = ref("dashboard");
  const loading = ref(false);
  const isInitialLoad = ref(true);
  const errorMsg = ref("");
  const sidebarOpen = ref(false);
  const toasts = ref([]);

  const showToast = (msg, type = "success") => {
    toasts.value.push({ msg, type });
    setTimeout(() => toasts.value.shift(), 2800);
  };

  const login = async (afterLogin) => {
    if (!adminSecret.value) return;
    loading.value = true;
    errorMsg.value = "";
    try {
      await adminFetch("/api/admin/plans", adminSecret.value);
      isAuthenticated.value = true;
      localStorage.setItem("admin_secret", adminSecret.value);
      if (typeof afterLogin === "function") await afterLogin();
    } catch (e) {
      errorMsg.value = e.message;
      isAuthenticated.value = false;
    } finally {
      loading.value = false;
      isInitialLoad.value = false;
    }
  };

  const logout = () => {
    isAuthenticated.value = false;
    adminSecret.value = "";
    localStorage.removeItem("admin_secret");
  };

  const switchTab = (tab) => {
    currentTab.value = tab;
    sidebarOpen.value = false;
  };

  /** 统一带 secret 的请求 */
  const fetchAdmin = (endpoint, options = {}) =>
    adminFetch(endpoint, adminSecret.value, options);

  return {
    adminSecret,
    isAuthenticated,
    currentTab,
    loading,
    isInitialLoad,
    errorMsg,
    sidebarOpen,
    toasts,
    showToast,
    login,
    logout,
    switchTab,
    fetchAdmin,
  };
}
