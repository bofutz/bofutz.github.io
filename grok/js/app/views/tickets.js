/**
 * 答疑留言
 * - 新建工单
 * - 列表 + 官方回复展示
 */
import {
  ref, reactive, onMounted, watch,
} from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";
import { apiFetch } from "../../api.js";
import { formatDateExact } from "../../utils.js";
import { isLoggedIn } from "../../auth.js";

export const TicketsView = {
  name: "TicketsView",
  props: {
    openAuth: { type: Function, required: true },
  },
  setup(props) {
    const ticketList = ref([]);
    const showTicketForm = ref(false);
    const ticketLoading = ref(false);
    const ticketForm = reactive({
      subject: "",
      level: "medium",
      message: "",
    });

    const fetchTickets = async () => {
      if (!isLoggedIn.value) {
        ticketList.value = [];
        return;
      }
      try {
        const res = await apiFetch("/api/tickets");
        ticketList.value = res.data || [];
      } catch (_) {
        ticketList.value = [];
      }
    };

    const submitTicket = async () => {
      if (!ticketForm.subject.trim() || !ticketForm.message.trim()) {
        alert("请填写主题和内容");
        return;
      }
      ticketLoading.value = true;
      try {
        await apiFetch("/api/tickets", {
          method: "POST",
          body: JSON.stringify({
            subject: ticketForm.subject.trim(),
            level: ticketForm.level,
            message: ticketForm.message.trim(),
          }),
        });
        alert("提交成功");
        ticketForm.subject = "";
        ticketForm.message = "";
        ticketForm.level = "medium";
        showTicketForm.value = false;
        fetchTickets();
      } catch (e) {
        alert(e.message);
      } finally {
        ticketLoading.value = false;
      }
    };

    onMounted(() => {
      if (isLoggedIn.value) fetchTickets();
    });

    watch(isLoggedIn, (v) => {
      if (v) fetchTickets();
      else ticketList.value = [];
    });

    return {
      isLoggedIn,
      openAuth: props.openAuth,
      ticketList,
      showTicketForm,
      ticketForm,
      ticketLoading,
      submitTicket,
      formatDateExact,
    };
  },

  template: `
    <div class="max-w-3xl mx-auto space-y-4">
      <div v-if="!isLoggedIn" class="bg-white rounded-xl border p-10 text-center">
        <p class="text-slate-500 mb-4">请登录后提交答疑留言</p>
        <button @click="openAuth('login')" class="theme-bg text-white px-6 py-2 rounded-lg text-sm">
          去登录
        </button>
      </div>

      <template v-else>
        <div class="flex justify-between items-center">
          <h2 class="text-xl font-bold text-slate-800">答疑留言</h2>
          <button @click="showTicketForm = !showTicketForm"
            class="theme-bg text-white text-sm px-4 py-2 rounded-lg">
            {{ showTicketForm ? '取消' : '新建留言' }}
          </button>
        </div>

        <div v-if="showTicketForm" class="bg-white rounded-xl border p-5 space-y-3 shadow-sm">
          <input v-model="ticketForm.subject" placeholder="主题"
            class="w-full border px-3 py-2 rounded-lg text-sm">
          <select v-model="ticketForm.level" class="w-full border px-3 py-2 rounded-lg text-sm">
            <option value="low">一般</option>
            <option value="medium">中等</option>
            <option value="high">紧急</option>
          </select>
          <textarea v-model="ticketForm.message" rows="4" placeholder="详细描述问题..."
            class="w-full border px-3 py-2 rounded-lg text-sm"></textarea>
          <button @click="submitTicket" :disabled="ticketLoading"
            class="theme-bg text-white px-5 py-2 rounded-lg text-sm disabled:opacity-50">
            {{ ticketLoading ? '提交中...' : '提交' }}
          </button>
        </div>

        <div class="bg-white rounded-xl border overflow-hidden shadow-sm">
          <div v-if="!ticketList.length" class="p-10 text-center text-slate-400 text-sm">
            暂无留言
          </div>
          <div v-for="t in ticketList" :key="t.id" class="border-b last:border-0 p-4 space-y-2">
            <div class="flex justify-between gap-2">
              <span class="font-medium text-sm">{{ t.subject }}</span>
              <span class="text-xs"
                :class="t.status === 'pending' ? 'text-orange-500' : 'text-emerald-500'">
                {{ t.status === 'pending' ? '待回复' : '已回复' }}
              </span>
            </div>
            <p class="text-xs text-slate-500 whitespace-pre-wrap">{{ t.message }}</p>
            <div v-if="t.admin_reply" class="bg-slate-50 rounded-lg p-3 text-xs text-slate-700">
              <span class="font-medium theme-text">官方回复：</span>{{ t.admin_reply }}
            </div>
            <div class="text-[10px] text-slate-400">{{ formatDateExact(t.created_at) }}</div>
          </div>
        </div>
      </template>
    </div>
  `,
};
