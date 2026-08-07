/**
 * 波幅探长 - 后台【客服工单】分块组件
 * 对齐前台「客服工单」，去掉优先级，支持图片查看
 * js/components/admin/TicketMgmt.js
 */
import { store } from "../../store.js";
import { adminApi } from "../../api/admin.js";

const { ref, reactive, onMounted } = Vue;

export default {
  name: "TicketMgmt",
  setup() {
    const tickets = ref([]);
    const loading = ref(false);
    const statusFilter = ref("all"); // all | pending | replied

    const replyModalVisible = ref(false);
    const currentTicket = ref(null);
    const replyMessage = ref("");
    const replyLoading = ref(false);

    const broadcastModalVisible = ref(false);
    const broadcastForm = reactive({
      title: "",
      content: "",
      also_tg: true,
    });
    const broadcastLoading = ref(false);

    const loadTickets = async () => {
      loading.value = true;
      try {
        const res = await adminApi.fetchTickets();
        tickets.value = res.data || [];
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
      }
    };

    const filteredTickets = () => {
      if (statusFilter.value === "all") return tickets.value;
      if (statusFilter.value === "pending") {
        return tickets.value.filter((t) => t.status === "pending" || t.status === "open");
      }
      return tickets.value.filter((t) => t.status === "replied" || t.status === "closed");
    };

    const openReplyModal = (t) => {
      currentTicket.value = t;
      replyMessage.value = t.admin_reply || "";
      replyModalVisible.value = true;
    };

    const submitReply = async () => {
      if (!replyMessage.value.trim()) {
        store.showToast("回复内容不能为空", "error");
        return;
      }
      replyLoading.value = true;
      try {
        await adminApi.replyTicket(currentTicket.value.id, replyMessage.value.trim());
        store.showToast("工单已回复");
        replyModalVisible.value = false;
        await loadTickets();
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        replyLoading.value = false;
      }
    };

    const submitBroadcast = async () => {
      if (!broadcastForm.content.trim()) {
        store.showToast("广播内容不能为空", "error");
        return;
      }
      broadcastLoading.value = true;
      try {
        const res = await adminApi.broadcastNotice(
          broadcastForm.title || "系统通知",
          broadcastForm.content.trim(),
          broadcastForm.also_tg
        );
        store.showToast(res.message || "全员广播发送成功");
        broadcastModalVisible.value = false;
        broadcastForm.title = "";
        broadcastForm.content = "";
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        broadcastLoading.value = false;
      }
    };

    const formatDate = (ts) => {
      if (!ts) return "-";
      const d = new Date(ts);
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
    };

    onMounted(loadTickets);

    return {
      tickets,
      loading,
      statusFilter,
      filteredTickets,
      replyModalVisible,
      currentTicket,
      replyMessage,
      replyLoading,
      broadcastModalVisible,
      broadcastForm,
      broadcastLoading,
      loadTickets,
      openReplyModal,
      submitReply,
      submitBroadcast,
      formatDate,
    };
  },
  template: `
    <div class="space-y-4 select-none">
      <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 class="text-xl font-bold text-slate-800">客服工单</h2>
          <p class="text-xs text-slate-400 mt-0.5">回复用户工单 · 支持查看图片附件 · 一键全员广播</p>
        </div>
        <div class="flex gap-2 flex-wrap">
          <div class="flex bg-white border border-slate-200 rounded-lg overflow-hidden text-xs">
            <button v-for="s in [{k:'all',t:'全部'},{k:'pending',t:'待回复'},{k:'replied',t:'已回复'}]"
                    :key="s.k" @click="statusFilter = s.k"
                    class="px-3 py-2 border-l first:border-0"
                    :class="statusFilter === s.k ? 'theme-bg text-white font-bold' : 'text-slate-600 hover:bg-slate-50'">
              {{ s.t }}
            </button>
          </div>
          <button @click="broadcastModalVisible = true" class="text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 px-3.5 py-2 rounded-lg font-bold hover:bg-indigo-100">
            <i class="fa-solid fa-bullhorn mr-1"></i>一键广播
          </button>
          <button @click="loadTickets" class="bg-white border px-3 py-2 rounded-lg text-sm hover:bg-slate-50">
            <i class="fa-solid fa-rotate-right" :class="{'animate-spin': loading}"></i>
          </button>
        </div>
      </div>

      <div class="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
        <div v-if="loading" class="text-center py-12 text-slate-400">
          <i class="fa-solid fa-circle-notch animate-spin text-2xl theme-text"></i>
        </div>
        <div v-else-if="!filteredTickets().length" class="text-center py-14 text-slate-400 text-sm">
          暂无工单
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm text-left whitespace-nowrap">
            <thead class="bg-slate-50 text-slate-500 border-b text-xs font-bold">
              <tr>
                <th class="py-3 px-4">时间</th>
                <th class="py-3 px-4">用户</th>
                <th class="py-3 px-4">主题</th>
                <th class="py-3 px-4">状态</th>
                <th class="py-3 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="t in filteredTickets()" :key="t.id" class="hover:bg-slate-50">
                <td class="py-3.5 px-4 text-xs font-mono text-slate-400">{{ formatDate(t.created_at) }}</td>
                <td class="py-3.5 px-4 font-bold text-slate-800">{{ t.username || '用户' }}</td>
                <td class="py-3.5 px-4 font-medium max-w-[200px] truncate">{{ t.subject }}</td>
                <td class="py-3.5 px-4">
                  <span class="text-xs font-bold px-2.5 py-0.5 rounded-full"
                        :class="(t.status === 'pending' || t.status === 'open') ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-600'">
                    {{ (t.status === 'pending' || t.status === 'open') ? '待回复' : '已回复' }}
                  </span>
                </td>
                <td class="py-3.5 px-4 text-right">
                  <button @click="openReplyModal(t)" class="text-xs theme-bg text-white px-3 py-1.5 rounded-lg font-bold">
                    {{ (t.status === 'pending' || t.status === 'open') ? '回复' : '查看/补充' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 回复弹窗 -->
      <div v-if="replyModalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="replyModalVisible = false">
        <div class="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
          <div class="flex justify-between items-start">
            <h3 class="font-bold text-slate-800">回复工单</h3>
            <button @click="replyModalVisible = false" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <div class="space-y-2">
            <div class="text-xs text-slate-400">主题</div>
            <div class="font-bold text-slate-800">{{ currentTicket?.subject }}</div>
          </div>

          <div class="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-wrap border">
            {{ currentTicket?.message }}
          </div>

          <!-- 用户上传的图片 -->
          <div v-if="currentTicket?.images?.length" class="flex flex-wrap gap-2">
            <a v-for="(url, idx) in currentTicket.images" :key="idx" :href="url" target="_blank"
               class="block w-16 h-16 rounded-lg overflow-hidden border border-slate-200 hover:opacity-90">
              <img :src="url" class="w-full h-full object-cover" alt="附件">
            </a>
          </div>

          <div>
            <label class="text-xs font-bold text-slate-600 mb-1.5 block">官方回复</label>
            <textarea v-model="replyMessage" rows="5" placeholder="填写回复内容..."
                      class="w-full border px-3 py-2.5 rounded-lg text-sm focus:theme-border outline-none resize-none"></textarea>
          </div>

          <div class="flex justify-end gap-2">
            <button @click="replyModalVisible = false" class="px-4 py-2 text-sm text-slate-500">取消</button>
            <button @click="submitReply" :disabled="replyLoading" class="theme-bg text-white px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50">
              {{ replyLoading ? '发送中...' : '发送回复' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 一键广播弹窗 -->
      <div v-if="broadcastModalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="broadcastModalVisible = false">
        <div class="bg-white rounded-2xl w-full max-w-md p-6 space-y-3 shadow-2xl">
          <h3 class="font-bold text-indigo-600 flex items-center gap-1.5">
            <i class="fa-solid fa-bullhorn"></i> 一键广播给全体会员
          </h3>
          <input v-model="broadcastForm.title" placeholder="标题（默认：系统通知）"
                 class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
          <textarea v-model="broadcastForm.content" rows="5" placeholder="广播内容..."
                    class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none"></textarea>
          <label class="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" v-model="broadcastForm.also_tg"> 同时推送至管理员 Telegram
          </label>
          <div class="flex justify-end gap-2 pt-1">
            <button @click="broadcastModalVisible = false" class="px-4 py-2 text-sm text-slate-500">取消</button>
            <button @click="submitBroadcast" :disabled="broadcastLoading"
                    class="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50">
              {{ broadcastLoading ? '发送中...' : '确认广播' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
};
