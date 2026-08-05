/**
 * 波幅探长 管理后台逻辑处理脚本 v2.3
 * js/admin.js
 */

const { createApp, ref, reactive, computed, onMounted, onUnmounted } = Vue;

createApp({
  setup() {
    const adminSecret = ref(localStorage.getItem('admin_secret') || '');
    const isAuthenticated = ref(false);
    const currentTab = ref('dashboard');
    const loading = ref(false);
    const isInitialLoad = ref(true);
    const errorMsg = ref('');
    const sidebarOpen = ref(false);
    const toasts = ref([]);

    const showToast = (msg, type = 'success') => {
      toasts.value.push({ msg, type });
      setTimeout(() => toasts.value.shift(), 2800);
    };

    // 数据源定义
    const users = ref([]);
    const orders = ref([]);
    const plans = ref([]);
    const tickets = ref([]);
    const sharedList = ref([]);
    const customList = ref([]);
    const promos = ref([]);
    const stats = ref({});
    
    // 监控投票后台定义（新增）
    const voteAdminList = ref([]);

    // 筛选与勾选状态
    const userSearchQuery = ref('');
    const orderSearchQuery = ref('');
    const orderStatusFilter = ref('all');
    const selectedUserIds = ref([]);

    const pendingOrdersCount = computed(() => (orders.value.filter(o => o.status === 'pending') || []).length);
    const pendingTicketsCount = computed(() => (tickets.value.filter(t => t.status === 'pending') || []).length);
    
    // 投票统计计算
    const totalVotesSum = computed(() => voteAdminList.value.reduce((sum, item) => sum + (item.vote_count || 0), 0));
    const voteTotalCount = computed(() => voteAdminList.value.length);

    const filteredUsers = computed(() => {
      let list = users.value;
      if (userSearchQuery.value) {
        const q = userSearchQuery.value.toLowerCase();
        list = list.filter(u =>
          (u.username || '').toLowerCase().includes(q) ||
          (u.referral_code || '').toLowerCase().includes(q) ||
          (u.ip || u.register_ip || '').includes(q)
        );
      }
      return list;
    });

    const filteredOrders = computed(() => {
      let list = orders.value;
      if (orderStatusFilter.value !== 'all') list = list.filter(o => o.status === orderStatusFilter.value);
      if (orderSearchQuery.value) {
        const q = orderSearchQuery.value.toLowerCase();
        list = list.filter(o =>
          (o.username || '').toLowerCase().includes(q) ||
          (o.tx_id_last6 || '').includes(q)
        );
      }
      return list;
    });

    // API 请求封装
    const fetchAdmin = async (endpoint, options = {}) => {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: { 
          'Content-Type': 'application/json', 
          'Admin-Secret': adminSecret.value, 
          ...options.headers 
        },
      });
      if (res.status === 401) {
        isAuthenticated.value = false;
        localStorage.removeItem('admin_secret');
        throw new Error('鉴权失败，管理密钥无效');
      }
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const j = await res.json(); if (j.error) msg = j.error; } catch (_) {}
        throw new Error(msg);
      }
      return res.json();
    };

    const login = async () => {
      if (!adminSecret.value) return;
      loading.value = true; errorMsg.value = '';
      try {
        await fetchAdmin('/api/admin/plans');
        isAuthenticated.value = true;
        localStorage.setItem('admin_secret', adminSecret.value);
        await refreshAll();
      } catch (e) { errorMsg.value = e.message; }
      finally { loading.value = false; isInitialLoad.value = false; }
    };

    const logout = () => {
      isAuthenticated.value = false;
      adminSecret.value = '';
      localStorage.removeItem('admin_secret');
    };

    const switchTab = (tab) => {
      currentTab.value = tab;
      sidebarOpen.value = false;
      if (tab === 'users') fetchUsers();
      else if (tab === 'orders') fetchOrders();
      else if (tab === 'plans') fetchPlans();
      else if (tab === 'shared') fetchShared();
      else if (tab === 'custom') fetchCustom();
      else if (tab === 'votes') fetchVotes();
      else if (tab === 'promos') fetchPromos();
      else if (tab === 'settings') fetchSettings();
      else if (tab === 'tickets') fetchTickets();
      else if (tab === 'dashboard') fetchStats();
    };

    const refreshAll = async () => {
      loading.value = true;
      try {
        await Promise.all([
          fetchStats(), 
          fetchUsers(false), 
          fetchOrders(false), 
          fetchPlans(false), 
          fetchTickets(false),
          fetchVotes(false)
        ]);
      } finally { loading.value = false; isInitialLoad.value = false; }
    };

    // 数据获取列表函数
    const fetchStats = async () => {
      try { const d = await fetchAdmin('/api/admin/stats'); if (d.success) stats.value = d.data || {}; } catch (_) {}
    };
    const fetchUsers = async (spin = true) => {
      if (spin) loading.value = true;
      try { const d = await fetchAdmin('/api/admin/users'); if (d.success) users.value = d.data || []; } catch (e) { showToast(e.message, 'error'); }
      if (spin) loading.value = false;
    };
    const fetchOrders = async (spin = true) => {
      if (spin) loading.value = true;
      try { const d = await fetchAdmin('/api/admin/orders'); if (d.success) orders.value = d.data || []; } catch (e) { showToast(e.message, 'error'); }
      if (spin) loading.value = false;
    };
    const fetchPlans = async () => {
      try { const d = await fetchAdmin('/api/admin/plans'); if (d.success) plans.value = d.data || []; } catch (_) {}
    };
    const fetchTickets = async () => {
      try { const d = await fetchAdmin('/api/admin/tickets'); if (d.success) tickets.value = d.data || []; } catch (_) {}
    };
    const fetchShared = async () => {
      try { const d = await fetchAdmin('/api/admin/watchlist/shared'); if (d.success) sharedList.value = d.data || []; } catch (e) { showToast(e.message, 'error'); }
    };
    const fetchCustom = async () => {
      try { const d = await fetchAdmin('/api/admin/watchlist/custom'); if (d.success) customList.value = d.data || []; } catch (e) { showToast(e.message, 'error'); }
    };
    const fetchPromos = async () => {
      try { const d = await fetchAdmin('/api/admin/promos'); if (d.success) promos.value = d.data || []; } catch (e) { showToast(e.message, 'error'); }
    };

    // 监控投票后台接口（新增）
    const fetchVotes = async (spin = true) => {
      if (spin) loading.value = true;
      try {
        const d = await fetchAdmin('/api/admin/votes');
        if (d.success) voteAdminList.value = d.data || [];
      } catch (e) { showToast(e.message, 'error'); }
      if (spin) loading.value = false;
    };

    const deleteVoteItem = async (code) => {
      if (!confirm(`确认清除标的 ${code} 的当前票数？`)) return;
      try {
        await fetchAdmin('/api/admin/votes/delete', { method: 'POST', body: JSON.stringify({ etf_code: code }) });
        showToast(`已清除 ${code} 票数`, 'success');
        fetchVotes(false);
      } catch (e) { showToast(e.message, 'error'); }
    };

    const clearMonthlyVotes = async () => {
      if (!confirm('警告：确认要重置并清空全网所有会员本月的投票记录吗？此操作不可撤销！')) return;
      try {
        await fetchAdmin('/api/admin/votes/clear_all', { method: 'POST' });
        showToast('已成功清空本月全部投票数据', 'success');
        fetchVotes(false);
      } catch (e) { showToast(e.message, 'error'); }
    };

    // 系统参数表单定义（含投票设置）
    const settingsForm = reactive({
      gift_register_days: 1, gift_inviter_days: 3, gift_invitee_days: 2,
      free_top_n_charts: 3, pay_register_enabled: '1', custom_max_symbols: 3,
      vote_max_per_user: 10, vote_display_top_n: 100, vote_min_plan_days: 30,
      alipay_qr_url: '', wechat_qr_url: '', default_pay_channel: 'alipay',
      social_douyin: '', social_shipinhao: '', social_xiaohongshu: '', social_gongzhonghao: '',
    });

    const fetchSettings = async () => {
      try {
        const d = await fetchAdmin('/api/admin/settings');
        if (d.success && d.data) {
          Object.keys(settingsForm).forEach(k => {
            if (d.data[k] != null) {
              settingsForm[k] = (typeof settingsForm[k] === 'number') ? Number(d.data[k]) : d.data[k];
            }
          });
        }
      } catch (e) { showToast(e.message, 'error'); }
    };

    const saveSettings = async () => {
      try {
        await fetchAdmin('/api/admin/settings', { method: 'POST', body: JSON.stringify(settingsForm) });
        showToast('系统设置已更新保存', 'success');
      } catch (e) { showToast(e.message, 'error'); }
    };

    // 用户操作弹窗与处理
    const chargeModalVisible = ref(false);
    const chargeTarget = ref(null);
    const chargeDays = ref(7);
    const openChargeModal = (u) => { chargeTarget.value = u; chargeDays.value = 7; chargeModalVisible.value = true; };
    const submitCharge = async () => {
      try {
        await fetchAdmin('/api/admin/users/charge', { method: 'POST', body: JSON.stringify({ user_id: chargeTarget.value.id, add_days: chargeDays.value }) });
        showToast('已成功调整天数', 'success'); chargeModalVisible.value = false; fetchUsers(false);
      } catch (e) { showToast(e.message, 'error'); }
    };

    const batchChargeVisible = ref(false);
    const batchDays = ref(7);
    const openBatchCharge = () => {
      if (!selectedUserIds.value.length) { showToast('请先勾选目标用户', 'error'); return; }
      batchDays.value = 7; batchChargeVisible.value = true;
    };
    const submitBatchCharge = async () => {
      try {
        await fetchAdmin('/api/admin/users/batch_charge', { method: 'POST', body: JSON.stringify({ user_ids: selectedUserIds.value, add_days: batchDays.value }) });
        showToast('批量充值完成', 'success'); batchChargeVisible.value = false; selectedUserIds.value = []; fetchUsers(false);
      } catch (e) { showToast(e.message, 'error'); }
    };
    const toggleSelectAllUsers = (e) => {
      selectedUserIds.value = e.target.checked ? filteredUsers.value.map(u => u.id) : [];
    };

    const resetPwdVisible = ref(false);
    const resetTarget = ref(null);
    const resetConfirmSecret = ref('');
    const openResetPwd = (u) => { resetTarget.value = u; resetConfirmSecret.value = ''; resetPwdVisible.value = true; };
    const submitResetPwd = async () => {
      try {
        const d = await fetchAdmin('/api/admin/users/reset_password', {
          method: 'POST',
          body: JSON.stringify({ user_id: resetTarget.value.id, admin_confirm: resetConfirmSecret.value }),
        });
        showToast(d.message || '密码已重置', 'success'); resetPwdVisible.value = false;
      } catch (e) { showToast(e.message, 'error'); }
    };

    const deleteUserVisible = ref(false);
    const deleteTarget = ref(null);
    const deleteConfirmSecret = ref('');
    const openDeleteUser = (u) => { deleteTarget.value = u; deleteConfirmSecret.value = ''; deleteUserVisible.value = true; };
    const submitDeleteUser = async () => {
      try {
        await fetchAdmin('/api/admin/users', { method: 'DELETE', body: JSON.stringify({ user_id: deleteTarget.value.id, admin_confirm: deleteConfirmSecret.value }) });
        showToast('用户已删除', 'success'); deleteUserVisible.value = false; fetchUsers(false);
      } catch (e) { showToast(e.message, 'error'); }
    };

    // 订单审核与工单广播
    const approveOrder = async (o) => {
      if (!confirm(`确定通过用户 ${o.username || o.register_username} 的订单？`)) return;
      try {
        await fetchAdmin('/api/admin/orders/approve', { method: 'POST', body: JSON.stringify({ order_id: o.id, user_id: o.user_id }) });
        showToast('审核通过', 'success'); fetchOrders(false); fetchUsers(false); fetchStats();
      } catch (e) { showToast(e.message, 'error'); }
    };
    const rejectOrder = async (o) => {
      if (!confirm('确定驳回此订单？')) return;
      try {
        await fetchAdmin('/api/admin/orders/reject', { method: 'POST', body: JSON.stringify({ order_id: o.id }) });
        showToast('已驳回', 'success'); fetchOrders(false);
      } catch (e) { showToast(e.message, 'error'); }
    };

    const getPlanName = (id) => { const p = plans.value.find(x => x.id === id); return p ? p.name : id; };

    const replyModalVisible = ref(false);
    const currentTicket = ref(null);
    const replyMessage = ref('');
    const openReplyModal = (t) => { currentTicket.value = t; replyMessage.value = t.admin_reply || ''; replyModalVisible.value = true; };
    const submitReply = async () => {
      try {
        await fetchAdmin('/api/admin/tickets/reply', { method: 'POST', body: JSON.stringify({ ticket_id: currentTicket.value.id, reply_message: replyMessage.value }) });
        showToast('回复已发送', 'success'); replyModalVisible.value = false; fetchTickets();
      } catch (e) { showToast(e.message, 'error'); }
    };

    const broadcastVisible = ref(false);
    const broadcastLoading = ref(false);
    const broadcastForm = reactive({ title: '', content: '' });
    const openBroadcast = () => { broadcastForm.title = ''; broadcastForm.content = ''; broadcastVisible.value = true; };
    const submitBroadcast = async () => {
      if (!broadcastForm.content.trim()) { showToast('请填写广播内容', 'error'); return; }
      broadcastLoading.value = true;
      try {
        await fetchAdmin('/api/admin/broadcast', { method: 'POST', body: JSON.stringify(broadcastForm) });
        showToast('广播发送成功', 'success'); broadcastVisible.value = false;
      } catch (e) { showToast(e.message, 'error'); }
      finally { broadcastLoading.value = false; }
    };

    let pollTimer = null;
    onMounted(() => {
      if (adminSecret.value) login();
      pollTimer = setInterval(() => { if (isAuthenticated.value) { fetchOrders(false); fetchTickets(); fetchStats(); } }, 60000);
    });
    onUnmounted(() => { if (pollTimer) clearInterval(pollTimer); });

    return {
      adminSecret, isAuthenticated, currentTab, loading, isInitialLoad, errorMsg, sidebarOpen,
      login, logout, switchTab, refreshAll,
      users, orders, plans, tickets, sharedList, customList, promos, stats,
      userSearchQuery, orderSearchQuery, orderStatusFilter, selectedUserIds,
      filteredUsers, filteredOrders, pendingOrdersCount, pendingTicketsCount,
      
      // 监控投票暴露给视图
      voteAdminList, totalVotesSum, voteTotalCount, fetchVotes, deleteVoteItem, clearMonthlyVotes,
      
      fetchUsers, fetchOrders, fetchPlans, fetchShared, fetchCustom, fetchPromos, fetchTickets,
      getPlanName, formatDate: formatDateExact, toasts,
      chargeModalVisible, chargeTarget, chargeDays, openChargeModal, submitCharge,
      batchChargeVisible, batchDays, openBatchCharge, submitBatchCharge, toggleSelectAllUsers,
      resetPwdVisible, resetTarget, resetConfirmSecret, openResetPwd, submitResetPwd,
      deleteUserVisible, deleteTarget, deleteConfirmSecret, openDeleteUser, submitDeleteUser,
      approveOrder, rejectOrder, settingsForm, fetchSettings, saveSettings,
      replyModalVisible, currentTicket, replyMessage, openReplyModal, submitReply,
      broadcastVisible, broadcastLoading, broadcastForm, openBroadcast, submitBroadcast,
    };
  },
}).mount('#admin-app');
