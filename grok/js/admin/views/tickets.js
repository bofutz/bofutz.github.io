/**
 * 管理后台 · 答疑工单
 * - 列表（待回复优先）
 * - 回复弹窗
 */
import {
  ref, computed, onMounted, watch,
} from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";
import { formatDate } from "../../utils.js";

export const TicketsView = {
  name: "AdminTickets",
  props: {
    fetchAdmin: { type: Function, required: true },
    showToast: { type: Function, required: true },
    /** main 轮询的轻量列表 */
    tickets: { type: Array, default: () => [] },
  },
  emits: ["refresh"],
  setup(props, { emit }) {
    const localTickets = ref([]);
    const loading = ref(false);
    const statusFilter = ref("all");

    const replyModalVisible = ref(false);
    const currentTicket = ref(null);
    const replyMessage = ref("");

    const filteredTickets = computed(() => {
      let list = localTickets.value;
      if (statusFilter.value !== "all") {
        list = list.filter((t) => t.status === statusFilter.value);
      }
      // 待回复优先
      return [...list].sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (b.status === "pending" && a.status !== "pending") return 1;
        return (b.created_at || 0) - (a.created_at || 0);
      });
    });

    const fetchTickets = async () => {
      loading.value = true;
      try {
        const d = await props.fetchAdmin("/api/admin/tickets");
        if (d.success) localTickets.value = d.data || [];
      } catch (e) {
        props.showToast(e.message, "error");
      } finally {
        loading.value = false;
      }
    };

    const openReplyModal = (t) => {
      currentTicket.value = t;
      replyMessage.value = t.admin_reply || "";
      replyModalVisible.value = true;
    };

    const submitReply = async () => {
      if (!replyMessage.value.trim()) {
        props.showToast("请填写回复内容", "error");
        return;
      }
      try {
        await props.fetchAdmin("/api/admin/tickets/reply", {
          method: "POST",
          body: JSON.stringify({
            ticket_id: currentTicket.value.id,
            reply_message: replyMessage.value.trim(),
          }),
        });
        props.showToast("已回复", "success");
        replyModalVisible.value = false;
        await fetchTickets();
        emit("refresh");
      } catch (e) {
        props.showToast(e.message, "error");
      }
    };

    watch(
      () => props.tickets,
      (v) => {
        if (Array.isArray(v) && v.length) localTickets.value = v;
      },
      { deep: true }
    );

    onMounted(fetchTickets);

    return {
      localTickets,
      loading,
      statusFilter,
      filteredTickets,
      fetchTickets,
      formatDate,
      replyModalVisible,
      currentTicket,
      replyMessage,
      openReplyModal,
      submitReply,
    };
  },

  template: `
    <div class="space-y-4">
      <div class="flex flex-col sm:flex-row justify-between gap-3">
        <h2 class="text-xl font-bold">答疑工单</h2>
        <div class="flex gap-2 flex-wrap">
          <div class="flex bg-white border rounded-lg overflow-hidden text-xs">
            <button
              v-for="s in [
                {k:'all',t:'全部'},
                {k:'pending',t:'待回复'},
                {k:'replied',t:'已回复'}
              ]"
              :key="s.k"
              @click="statusFilter=s.k"
              class="px-3 py-2 border-l first:border-0"
              :class="statusFilter===s.k ? 'theme-bg text-white' : 'text-slate-600'"
            >{{ s.t }}</button>
          </div>
          <button @click="fetchTickets" class="bg-white border px-3 py-2 rounded-lg text-sm">
            <i class="fa-solid fa-rotate-right" :class="{'animate-spin': loading}"></i>
          </button>
        </div>
      </div>

      <div class="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-sm whitespace-nowrap">
            <thead class="bg-slate-50 text-slate-500 border-b">
              <tr>
                <th class="py-3 px-4 text-left">时间</th>
                <th class="py-3 px-4 text-left">用户</th>
                <th class="py-3 px-4 text-left">主题</th>
                <th class="py-3 px-4 text-left">优先级</th>
                <th class="py-3 px-4 text-left">状态</th>
                <th class="py-3 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="t in filteredTickets" :key="t.id" class="hover:bg-slate-50">
                <td class="py-3 px-4 text-xs text-slate-400">{{ formatDate(t.created_at) }}</td>
                <td class="py-3 px-4 font-bold">{{ t.username || t.user_id || '-' }}</td>
                <td class="py-3 px-4">
                  <div class="font-medium">{{ t.subject }}</div>
                  <div class="text-[11px] text-slate-400 max-w-xs truncate">{{ t.message }}</div>
                </td>
                <td class="py-3 px-4">
                  <span class="text-xs px-2 py-0.5 rounded-full"
                    :class="{
                      'bg-red-50 text-red-600': t.level==='high',
                      'bg-amber-50 text-amber-600': t.level==='medium',
                      'bg-slate-100 text-slate-500': t.level==='low' || !t.level
                    }">
                    {{ t.level==='high' ? '紧急' : (t.level==='medium' ? '中等' : '一般') }}
                  </span>
                </td>
                <td class="py-3 px-4">
                  <span v-if="t.status==='pending'"
                    class="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">待回复</span>
                  <span v-else
                    class="text-xs bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">已回复</span>
                </td>
                <td class="py-3 px-4 text-right">
                  <button @click="openReplyModal(t)"
                    class="text-xs theme-bg text-white px-3 py-1 rounded-lg">
                    {{ t.status==='pending' ? '回复' : '查看/修改' }}
                  </button>
                </td>
              </tr>
              <tr v-if="!filteredTickets.length">
                <td colspan="6" class="py-10 text-center text-slate-400">暂无工单</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 回复弹窗 -->
      <div v-if="replyModalVisible"
        class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4"
        @click.self="replyModalVisible=false">
        <div class="bg-white rounded-2xl w-full max-w-md p-6 space-y-3">
          <h3 class="font-bold">回复 · {{ currentTicket?.subject }}</h3>
          <p class="text-xs text-slate-500 whitespace-pre-wrap">{{ currentTicket?.message }}</p>
          <textarea v-model="replyMessage" rows="4" placeholder="回复内容"
            class="w-full border px-3 py-2 rounded-lg text-sm"></textarea>
          <div class="flex justify-end gap-2">
            <button @click="replyModalVisible=false" class="px-4 py-2 text-sm text-slate-500">取消</button>
            <button @click="submitReply"
              class="theme-bg text-white px-4 py-2 rounded-lg text-sm">发送</button>
          </div>
        </div>
      </div>
    </div>
  `,
};
