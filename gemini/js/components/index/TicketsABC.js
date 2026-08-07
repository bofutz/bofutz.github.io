/**
 * 波幅探长 - 答疑留言分块组件
 * js/components/index/Tickets.js
 */
import { store } from "../../store.js";
import { ticketApi } from "../../api/ticket.js";

const { ref, reactive, onMounted } = Vue;

export default {
  name: "Tickets",
  setup() {
    const tickets = ref([]);
    const loading = ref(false);
    const showForm = ref(false);

    const form = reactive({
      subject: "",
      level: "medium",
      message: "",
    });
    const submitLoading = ref(false);

    const loadTickets = async () => {
      loading.value = true;
      try {
        const res = await ticketApi.fetchUserTickets();
        tickets.value = res.data || [];
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
      }
    };

    const submit = async () => {
      if (!form.subject.trim() || !form.message.trim()) {
        store.showToast("主题和内容不能为空", "error");
        return;
      }
      submitLoading.value = true;
      try {
        await ticketApi.submitTicket(form.subject, form.level, form.message);
        store.showToast("工单已提交，专员将尽快回复！");
        form.subject = "";
        form.message = "";
        showForm.value = false;
        await loadTickets();
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        submitLoading.value = false;
      }
    };

    onMounted(() => {
      if (store.state.isLoggedIn) {
        loadTickets();
      }
    });

    return {
      store: store.state,
      tickets,
      loading,
      showForm,
      form,
      submitLoading,
      submit,
    };
  },
  template: `
    <div class="max-w-3xl mx-auto space-y-4 select-none">
      <div class="flex justify-between items-center">
        <h2 class="text-2xl font-bold text-slate-800">答疑留言</h2>
        <button @click="showForm = !showForm" class="theme-bg text-white text-xs px-4 py-2 rounded-lg font-bold">
          {{ showForm ? '取消' : '新建留言' }}
        </button>
      </div>

      <!-- 新建工单表单 -->
      <div v-if="showForm" class="bg-white rounded-xl border border-slate-100 p-5 space-y-3 shadow-sm">
        <input v-model="form.subject" type="text" placeholder="留言主题" class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
        <select v-model="form.level" class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
          <option value="low">一般问题</option>
          <option value="medium">中等优先级</option>
          <option value="high">紧急咨询</option>
        </select>
        <textarea v-model="form.message" rows="4" placeholder="请详细描述您的问题..." class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none"></textarea>
        <button @click="submit" :disabled="submitLoading" class="theme-bg text-white px-5 py-2 rounded-lg text-xs font-bold disabled:opacity-50">
          {{ submitLoading ? '提交中...' : '提交工单' }}
        </button>
      </div>

      <!-- 工单列表 -->
      <div class="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
        <div v-if="loading" class="text-center py-8 text-slate-400">
          <i class="fa-solid fa-spinner animate-spin text-xl theme-text"></i>
        </div>
        <div v-else-if="!tickets.length" class="text-center py-10 text-slate-400 text-sm">
          暂无留言记录
        </div>
        <div v-else class="divide-y divide-slate-50">
          <div v-for="t in tickets" :key="t.id" class="p-4 space-y-2">
            <div class="flex justify-between items-center">
              <span class="font-bold text-sm text-slate-800">{{ t.subject }}</span>
              <span class="text-xs font-bold" :class="t.status === 'pending' ? 'text-orange-500' : 'text-emerald-500'">
                {{ t.status === 'pending' ? '待回复' : '已回复' }}
              </span>
            </div>
            <p class="text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 p-2.5 rounded-lg">{{ t.message }}</p>
            <div v-if="t.admin_reply" class="bg-emerald-50/60 border border-emerald-100 rounded-lg p-3 text-xs text-slate-700">
              <span class="font-bold theme-text">官方回复：</span>{{ t.admin_reply }}
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
};
