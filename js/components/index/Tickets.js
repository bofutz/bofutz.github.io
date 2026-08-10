/**
 * 波幅探长 - 客服工单分块组件
 * 支持文字 + 图片（粘贴/上传至 Cloudflare R2），内容保留 60 天自动删除
 * 所有交流同步可通过 Telegram 机器人进行
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
    const selectedIds = ref([]);
    const deleteLoading = ref(false);

    const form = reactive({
      subject: "",
      message: "",
      images: [], // { url, uploading, id }
    });
    const submitLoading = ref(false);
    const uploadingCount = ref(0);

    // ==================== 图片上传到 Cloudflare R2 ====================
    const uploadImageToR2 = async (file) => {
      if (!file || !file.type.startsWith("image/")) {
        store.showToast("仅支持图片文件", "error");
        return null;
      }
      // 限制单张 5MB
      if (file.size > 5 * 1024 * 1024) {
        store.showToast("单张图片不能超过 5MB", "error");
        return null;
      }

      const tempId = Date.now() + Math.random().toString(36).slice(2);
      form.images.push({
        id: tempId,
        url: "",
        uploading: true,
        preview: URL.createObjectURL(file),
      });
      uploadingCount.value++;

      try {
        // 调用后端上传接口（后端负责传到 Cloudflare R2 并返回公开 URL）
        const res = await ticketApi.uploadImage(file);
        const finalUrl = res.url || res.data?.url;
        if (!finalUrl) throw new Error("上传失败，未返回地址");

        const idx = form.images.findIndex((img) => img.id === tempId);
        if (idx !== -1) {
          form.images[idx].url = finalUrl;
          form.images[idx].uploading = false;
        }
        return finalUrl;
      } catch (err) {
        // 上传失败移除预览
        form.images = form.images.filter((img) => img.id !== tempId);
        store.showToast(err.message || "图片上传失败", "error");
        return null;
      } finally {
        uploadingCount.value = Math.max(0, uploadingCount.value - 1);
      }
    };

    // 处理文件选择
    const onFileSelect = async (e) => {
      const files = Array.from(e.target.files || []);
      for (const file of files) {
        await uploadImageToR2(file);
      }
      e.target.value = ""; // 重置，允许重复选同一文件
    };

    // 支持粘贴图片
    const onPaste = async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) await uploadImageToR2(file);
        }
      }
    };

    // 删除已上传/预览的图片
    const removeImage = (id) => {
      form.images = form.images.filter((img) => img.id !== id);
    };

    // ==================== 工单逻辑 ====================
    const loadTickets = async () => {
      if (!store.state.isLoggedIn) return;
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
      if (!store.state.isLoggedIn) {
        store.state.authMode = "login";
        store.state.authModalVisible = true;
        return;
      }
      if (!form.subject.trim()) {
        store.showToast("请填写工单主题", "error");
        return;
      }
      if (!form.message.trim() && form.images.length === 0) {
        store.showToast("请填写问题描述或上传图片", "error");
        return;
      }
      if (uploadingCount.value > 0) {
        store.showToast("请等待图片上传完成", "error");
        return;
      }

      // 过滤出已成功上传的图片 URL
      const imageUrls = form.images
        .filter((img) => img.url && !img.uploading)
        .map((img) => img.url);

      submitLoading.value = true;
      try {
        await ticketApi.submitTicket({
          subject: form.subject.trim(),
          message: form.message.trim(),
          images: imageUrls, // 后端保存图片地址数组
        });
        store.showToast("工单已提交，专员将尽快回复！");
        // 重置表单
        form.subject = "";
        form.message = "";
        form.images = [];
        showForm.value = false;
        await loadTickets();
      } catch (err) {
        store.showToast(err.message || "提交失败", "error");
      } finally {
        submitLoading.value = false;
      }
    };

    const toggleSelect = (id) => {
      const i = selectedIds.value.indexOf(id);
      if (i >= 0) selectedIds.value.splice(i, 1);
      else selectedIds.value.push(id);
    };
    const toggleSelectAll = () => {
      if (selectedIds.value.length === tickets.value.length) selectedIds.value = [];
      else selectedIds.value = tickets.value.map((x) => x.id);
    };
    const deleteSelected = async () => {
      if (!selectedIds.value.length) {
        store.showToast("请先勾选工单", "error");
        return;
      }
      if (!confirm(`确认删除选中的 ${selectedIds.value.length} 条工单？`)) return;
      deleteLoading.value = true;
      try {
        await ticketApi.deleteTickets(selectedIds.value);
        store.showToast("已删除");
        selectedIds.value = [];
        await loadTickets();
      } catch (err) {
        store.showToast(err.message || "删除失败", "error");
      } finally {
        deleteLoading.value = false;
      }
    };

    const formatTime = (ts) => {
      if (!ts) return "";
      const d = new Date(ts);
      if (isNaN(d.getTime())) return "";
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
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
      selectedIds,
      deleteLoading,
      toggleSelect,
      toggleSelectAll,
      deleteSelected,
      form,
      submitLoading,
      uploadingCount,
      submit,
      onFileSelect,
      onPaste,
      removeImage,
      formatTime,
      loadTickets,
    };
  },
  template: `
    <div class="max-w-3xl mx-auto space-y-5 select-none">
      <!-- 标题区 -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="text-2xl font-bold text-slate-800">客服工单</h2>
          <p class="text-xs text-slate-400 mt-1">
            内容与图片保留 60 天自动删除
          </p>
        </div>
        <button
          @click="showForm = !showForm"
          class="theme-bg text-white text-xs px-4 py-2.5 rounded-lg font-bold shrink-0"
        >
          {{ showForm ? '取消' : '新建工单' }}
        </button>
      </div>

      <!-- 新建工单表单 -->
      <div v-if="showForm" class="bg-white rounded-xl border border-slate-100 p-5 space-y-4 shadow-sm">
        <div>
          <label class="text-xs font-bold text-slate-600 mb-1.5 block">工单主题</label>
          <input
            v-model="form.subject"
            type="text"
            maxlength="80"
            placeholder="简要概括问题（必填）"
            class="w-full border px-3 py-2.5 rounded-lg text-sm focus:theme-border outline-none"
          >
        </div>

        <div>
          <label class="text-xs font-bold text-slate-600 mb-1.5 block">问题描述</label>
          <textarea
            v-model="form.message"
            @paste="onPaste"
            rows="5"
            placeholder="请详细描述问题...（支持直接粘贴截图）"
            class="w-full border px-3 py-2.5 rounded-lg text-sm focus:theme-border outline-none resize-none"
          ></textarea>
        </div>

        <!-- 图片上传区 -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-xs font-bold text-slate-600">附件图片（可选）</label>
            <span class="text-[11px] text-slate-400">支持粘贴 / 选择 · 单张 ≤5MB</span>
          </div>

          <!-- 已上传预览 -->
          <div v-if="form.images.length" class="flex flex-wrap gap-2.5 mb-3">
            <div
              v-for="img in form.images"
              :key="img.id"
              class="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-50"
            >
              <img
                :src="img.url || img.preview"
                class="w-full h-full object-cover"
                alt="附件"
              >
              <div
                v-if="img.uploading"
                class="absolute inset-0 bg-black/40 flex items-center justify-center"
              >
                <i class="fa-solid fa-spinner animate-spin text-white text-sm"></i>
              </div>
              <button
                v-else
                @click="removeImage(img.id)"
                class="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full text-[10px] flex items-center justify-center hover:bg-red-500"
              >
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>

          <!-- 上传按钮 -->
          <label class="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-slate-300 rounded-lg text-xs text-slate-500 cursor-pointer hover:border-[#4da6a0] hover:text-[#4da6a0] transition-colors">
            <i class="fa-solid fa-image"></i>
            <span>{{ uploadingCount > 0 ? '上传中...' : '选择图片或直接粘贴' }}</span>
            <input
              type="file"
              accept="image/*"
              multiple
              class="hidden"
              @change="onFileSelect"
              :disabled="uploadingCount > 0"
            >
          </label>
        </div>

        <div class="flex items-center justify-between pt-1">
          <p class="text-[11px] text-slate-400">
            提交后内容将保留 60 天，到期自动删除
          </p>
          <button
            @click="submit"
            :disabled="submitLoading || uploadingCount > 0"
            class="theme-bg text-white px-6 py-2.5 rounded-lg text-xs font-bold disabled:opacity-50"
          >
            {{ submitLoading ? '提交中...' : '提交工单' }}
          </button>
        </div>
      </div>

      <!-- 历史工单列表 -->
      <div class="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
        <div class="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <span class="font-bold text-slate-700 text-sm">我的工单记录</span>
          <div class="flex items-center gap-2">
            <button
              v-if="store.isLoggedIn && tickets.length"
              type="button"
              @click="toggleSelectAll"
              class="text-xs text-slate-500 hover:theme-text"
            >全选</button>
            <button
              v-if="store.isLoggedIn && selectedIds.length"
              type="button"
              @click="deleteSelected"
              :disabled="deleteLoading"
              class="text-xs text-red-500 font-bold hover:underline disabled:opacity-50"
            >删除选中 ({{ selectedIds.length }})</button>
            <button
              v-if="store.isLoggedIn"
              @click="loadTickets"
              class="text-xs text-slate-400 hover:theme-text"
            >
              <i class="fa-solid fa-rotate-right mr-1"></i>刷新
            </button>
          </div>
        </div>

        <div v-if="!store.isLoggedIn" class="text-center py-12 text-slate-400 text-sm">
          <i class="fa-solid fa-lock text-2xl mb-2 opacity-40"></i>
          <p>登录后可查看与提交工单</p>
        </div>

        <div v-else-if="loading" class="text-center py-12 text-slate-400">
          <i class="fa-solid fa-spinner animate-spin text-xl theme-text"></i>
        </div>

        <div v-else-if="!tickets.length" class="text-center py-12 text-slate-400 text-sm">
          暂无工单记录
        </div>

        <div v-else class="divide-y divide-slate-50">
          <div v-for="t in tickets" :key="t.id" class="p-4 sm:p-5 space-y-3">
            <!-- 头部 -->
            <div class="flex justify-between items-start gap-3">
              <label class="pt-0.5 shrink-0">
                <input type="checkbox" :checked="selectedIds.includes(t.id)" @change="toggleSelect(t.id)">
              </label>
              <div class="min-w-0 flex-1">
                <div class="font-bold text-sm text-slate-800 truncate">{{ t.subject }}</div>
                <div class="text-[11px] text-slate-400 mt-0.5">
                  {{ formatTime(t.created_at) }}
                  <span v-if="t.expire_at" class="ml-2">· 将于 {{ formatTime(t.expire_at) }} 自动删除</span>
                </div>
              </div>
              <span
                class="text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0"
                :class="t.status === 'pending' || t.status === 'open'
                  ? 'bg-orange-50 text-orange-600'
                  : 'bg-emerald-50 text-emerald-600'"
              >
                {{ t.status === 'pending' || t.status === 'open' ? '待回复' : '已回复' }}
              </span>
            </div>

            <!-- 用户留言 -->
            <div class="text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg leading-relaxed">
              {{ t.message }}
            </div>

            <!-- 用户上传的图片 -->
            <div v-if="t.images && t.images.length" class="flex flex-wrap gap-2">
              <a
                v-for="(url, idx) in t.images"
                :key="idx"
                :href="url"
                target="_blank"
                class="block w-16 h-16 rounded-lg overflow-hidden border border-slate-200 hover:opacity-90"
              >
                <img :src="url" class="w-full h-full object-cover" alt="附件">
              </a>
            </div>

            <!-- 官方回复 -->
            <div
              v-if="t.admin_reply"
              class="bg-emerald-50/70 border border-emerald-100 rounded-lg p-3 text-xs text-slate-700 leading-relaxed"
            >
              <div class="font-bold theme-text mb-1 flex items-center gap-1">
                <i class="fa-solid fa-headset"></i> 官方回复
                <span v-if="t.replied_at" class="font-normal text-slate-400 ml-2">{{ formatTime(t.replied_at) }}</span>
              </div>
              <div class="whitespace-pre-wrap">{{ t.admin_reply }}</div>

              <!-- 回复中的图片（如果有） -->
              <div v-if="t.reply_images && t.reply_images.length" class="flex flex-wrap gap-2 mt-2">
                <a
                  v-for="(url, idx) in t.reply_images"
                  :key="idx"
                  :href="url"
                  target="_blank"
                  class="block w-16 h-16 rounded-lg overflow-hidden border border-emerald-200"
                >
                  <img :src="url" class="w-full h-full object-cover" alt="回复附件">
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部说明 -->
      <p class="text-center text-[11px] text-slate-400 leading-relaxed">
        所有工单与图片仅保留 60 天，到期后系统自动彻底删除 · 重要信息请及时自行保存
      </p>
    </div>
  `,
};
