/**
 * 波幅探长 - 后台【默认监控列表】组件
 * 核心能力：
 * 1. 添加标的 & 批量导入：只要输入 6 位代码，即可自动识别对应股票/ETF名称及是 t+0 还是 t+1
 * 2. 支持点击选中标的，按住直接上下拖动实时调整排序（或使用键盘 ↑/↓ 及快捷按钮微调）
 * 3. T+0 标的代码显示为红色，T+1 保持默认颜色，不在代码后加 (0)
 */
import { store } from "../../store.js";
import { adminApi } from "../../api/admin.js";
import { resolveTradeRule, fetchSecurityInfo } from "../../config.js";

const { ref, reactive, computed, onMounted, onUnmounted } = Vue;

export default {
  name: "SharedWatch",
  emits: ["refresh-stats"],
  setup(_, { emit }) {
    const sharedList = ref([]);
    const loading = ref(false);
    const orderSaving = ref(false);
    const searchQuery = ref("");

    // 选中与拖拽状态
    const selectedIds = ref([]);
    const draggingId = ref(null);
    const dragOverId = ref(null);
    const orderSnapshot = ref("");

    // 添加/编辑单个标的弹窗
    const modalVisible = ref(false);
    const detectingSingle = ref(false);
    const form = reactive({
      id: null,
      etf_code: "",
      etf_name: "",
      trade_mode: "t+1",
      sort_order: 0,
      enabled: true,
    });

    // 批量导入弹窗
    const batchImportVisible = ref(false);
    const batchText = ref("");
    const batchParsing = ref(false);
    const batchPreview = ref([]); // [{ etf_code, etf_name, trade_mode }]

    const isSearching = computed(() => !!searchQuery.value.trim());

    const filteredList = computed(() => {
      if (!isSearching.value) return sharedList.value;
      const q = searchQuery.value.toLowerCase().trim();
      return sharedList.value.filter(
        (w) =>
          (w.etf_code && w.etf_code.toLowerCase().includes(q)) ||
          (w.etf_name && w.etf_name.toLowerCase().includes(q))
      );
    });

    const isSelected = (id) => selectedIds.value.includes(id);

    const allSelected = computed(() => {
      const list = filteredList.value;
      return list.length > 0 && list.every((w) => selectedIds.value.includes(w.id));
    });

    const onRowClick = (w, ev) => {
      if (!w) return;
      if (ev && ev.target && ev.target.closest("button, input, select, a, label")) return;
      if (ev && (ev.ctrlKey || ev.metaKey || ev.shiftKey)) {
        toggleSelect(w.id);
      } else {
        if (selectedIds.value.length === 1 && selectedIds.value[0] === w.id) {
          selectedIds.value = [];
        } else {
          selectedIds.value = [w.id];
        }
      }
    };

    const toggleSelect = (id, ev) => {
      if (ev) ev.stopPropagation();
      const idx = selectedIds.value.indexOf(id);
      if (idx >= 0) {
        selectedIds.value = selectedIds.value.filter((x) => x !== id);
      } else {
        selectedIds.value = [...selectedIds.value, id];
      }
    };

    const toggleSelectAll = () => {
      const list = filteredList.value;
      if (allSelected.value) {
        const removeSet = new Set(list.map((w) => w.id));
        selectedIds.value = selectedIds.value.filter((id) => !removeSet.has(id));
      } else {
        const merged = new Set([...selectedIds.value, ...list.map((w) => w.id)]);
        selectedIds.value = Array.from(merged);
      }
    };

    const loadShared = async () => {
      loading.value = true;
      try {
        const res = await adminApi.fetchSharedWatchlist();
        const raw = Array.isArray(res.data) ? res.data : [];
        raw.sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) || (a.id || 0) - (b.id || 0));
        raw.forEach((item, idx) => {
          item._saved_sort = Number(item.sort_order ?? idx);
        });
        sharedList.value = raw;
        emit("refresh-stats");
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
      }
    };

    const persistCurrentOrder = async (silent = false) => {
      sharedList.value.forEach((item, idx) => {
        item.sort_order = idx;
      });

      const changedItems = sharedList.value.filter((item) => item._saved_sort !== item.sort_order);
      if (!changedItems.length) return;

      orderSaving.value = true;
      try {
        const ordersPayload = sharedList.value.map((item, idx) => ({
          id: item.id,
          sort_order: idx,
        }));
        await adminApi.reorderSharedWatchlist(ordersPayload);
        sharedList.value.forEach((item) => {
          item._saved_sort = item.sort_order;
        });
        if (!silent) store.showToast("排序已更新并保存");
      } catch (err) {
        store.showToast(err.message || "排序保存失败，请刷新重试", "error");
        await loadShared();
      } finally {
        orderSaving.value = false;
      }
    };

    // ==================== 拖拽排序 ====================
    const onDragStart = (w, ev) => {
      if (isSearching.value) {
        ev.preventDefault();
        store.showToast("请先清空搜索框，再上下拖动调整全局排序", "error");
        return;
      }
      draggingId.value = w.id;
      if (!selectedIds.value.includes(w.id)) {
        selectedIds.value = [w.id];
      }
      orderSnapshot.value = sharedList.value.map((x) => x.id).join(",");
      if (ev.dataTransfer) {
        ev.dataTransfer.effectAllowed = "move";
        try {
          ev.dataTransfer.setData("text/plain", String(w.id));
        } catch (_) {}
      }
    };

    const onDragEnter = (targetItem, ev) => {
      if (ev) ev.preventDefault();
      if (!draggingId.value || !targetItem || targetItem.id === draggingId.value) return;
      dragOverId.value = targetItem.id;

      const list = sharedList.value.slice();
      const movingIds = new Set(
        selectedIds.value.length && selectedIds.value.includes(draggingId.value)
          ? selectedIds.value
          : [draggingId.value]
      );
      if (movingIds.has(targetItem.id)) return;

      const firstMovingIdx = list.findIndex((x) => movingIds.has(x.id));
      const targetIdx = list.findIndex((x) => x.id === targetItem.id);
      if (firstMovingIdx < 0 || targetIdx < 0) return;

      const movingItems = list.filter((x) => movingIds.has(x.id));
      const remaining = list.filter((x) => !movingIds.has(x.id));
      const newTargetIdx = remaining.findIndex((x) => x.id === targetItem.id);
      if (newTargetIdx < 0) return;

      const insertPos = firstMovingIdx < targetIdx ? newTargetIdx + 1 : newTargetIdx;
      remaining.splice(insertPos, 0, ...movingItems);
      remaining.forEach((item, idx) => {
        item.sort_order = idx;
      });
      sharedList.value = remaining;
    };

    const onDragOver = (w, ev) => {
      if (ev) {
        ev.preventDefault();
        if (ev.dataTransfer) ev.dataTransfer.dropEffect = "move";
      }
      if (w && draggingId.value && w.id !== draggingId.value) {
        onDragEnter(w, ev);
      }
    };

    const finishDrag = async () => {
      if (!draggingId.value) return;
      draggingId.value = null;
      dragOverId.value = null;
      const currentOrder = sharedList.value.map((x) => x.id).join(",");
      if (orderSnapshot.value && currentOrder !== orderSnapshot.value) {
        orderSnapshot.value = "";
        await persistCurrentOrder();
      }
    };

    const onDrop = async (ev) => {
      if (ev) ev.preventDefault();
      await finishDrag();
    };

    const onDragEnd = async () => {
      await finishDrag();
    };

    const moveSelected = async (direction) => {
      if (isSearching.value) {
        store.showToast("请先清空搜索框再调整排序", "error");
        return;
      }
      const selSet = new Set(selectedIds.value);
      if (!selSet.size) {
        store.showToast("请先点击选中要移动的标的", "error");
        return;
      }

      const list = sharedList.value.slice();
      if (direction === "top") {
        const picked = list.filter((x) => selSet.has(x.id));
        const rest = list.filter((x) => !selSet.has(x.id));
        sharedList.value = [...picked, ...rest];
      } else if (direction === "bottom") {
        const picked = list.filter((x) => selSet.has(x.id));
        const rest = list.filter((x) => !selSet.has(x.id));
        sharedList.value = [...rest, ...picked];
      } else if (direction === "up") {
        for (let i = 1; i < list.length; i++) {
          if (selSet.has(list[i].id) && !selSet.has(list[i - 1].id)) {
            const tmp = list[i - 1];
            list[i - 1] = list[i];
            list[i] = tmp;
          }
        }
        sharedList.value = list;
      } else if (direction === "down") {
        for (let i = list.length - 2; i >= 0; i--) {
          if (selSet.has(list[i].id) && !selSet.has(list[i + 1].id)) {
            const tmp = list[i + 1];
            list[i + 1] = list[i];
            list[i] = tmp;
          }
        }
        sharedList.value = list;
      }
      await persistCurrentOrder();
    };

    const moveSingleRow = async (w, direction, ev) => {
      if (ev) ev.stopPropagation();
      selectedIds.value = [w.id];
      await moveSelected(direction);
    };

    const onKeyDown = (ev) => {
      if (modalVisible.value || batchImportVisible.value) return;
      const tag = (ev.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (!selectedIds.value.length) return;

      if (ev.key === "ArrowUp") {
        ev.preventDefault();
        moveSelected("up");
      } else if (ev.key === "ArrowDown") {
        ev.preventDefault();
        moveSelected("down");
      }
    };

    // ==================== 单条添加/编辑：输入代码自动识别名称及 t+0/t+1 ====================
    let singleTimer = null;
    const onSingleCodeInput = () => {
      if (singleTimer) clearTimeout(singleTimer);
      const code = String(form.etf_code || "").replace(/\D/g, "").slice(-6);
      if (code.length !== 6) return;
      // 先按代码规则即时预判 T+0/T+1
      form.trade_mode = resolveTradeRule(code, form.etf_name);
      singleTimer = setTimeout(async () => {
        detectingSingle.value = true;
        const info = await fetchSecurityInfo(code);
        if (info.name) form.etf_name = info.name;
        form.trade_mode = info.trade_mode;
        detectingSingle.value = false;
      }, 250);
    };

    const openModal = (item = null, ev = null) => {
      if (ev) ev.stopPropagation();
      if (item) {
        Object.assign(form, {
          ...item,
          trade_mode: resolveTradeRule(item.etf_code, item.etf_name, item.trade_mode),
          enabled: !!item.enabled,
        });
      } else {
        Object.assign(form, {
          id: null,
          etf_code: "",
          etf_name: "",
          trade_mode: "t+1",
          sort_order: sharedList.value.length,
          enabled: true,
        });
      }
      modalVisible.value = true;
    };

    const submitShared = async () => {
      const code = String(form.etf_code || "").replace(/\D/g, "").slice(-6);
      if (code.length !== 6) {
        store.showToast("请输入 6 位数字标的代码", "error");
        return;
      }
      detectingSingle.value = true;
      try {
        if (!form.etf_name || form.etf_name.trim() === code) {
          const info = await fetchSecurityInfo(code);
          form.etf_name = info.name || code;
          if (!form.trade_mode || form.trade_mode === "auto") {
            form.trade_mode = info.trade_mode;
          }
        }
        await adminApi.saveSharedItem({
          ...form,
          etf_code: code,
          etf_name: (form.etf_name || code).trim(),
          trade_mode: form.trade_mode || resolveTradeRule(code, form.etf_name),
        });
        store.showToast("保存成功");
        modalVisible.value = false;
        await loadShared();
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        detectingSingle.value = false;
      }
    };

    // ==================== 批量导入：只需输入代码，自动识别股票名称及 t+0/t+1 ====================
    const openBatchModal = () => {
      batchText.value = "";
      batchPreview.value = [];
      batchImportVisible.value = true;
    };

    /** 解析批量输入文本并并发调用腾讯行情自动识别名称与 t+0/t+1 */
    const recognizeBatchInput = async () => {
      const rawLines = String(batchText.value || "")
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!rawLines.length) {
        store.showToast("请先输入标的代码", "error");
        return [];
      }

      const parsed = [];
      const seen = new Set();
      for (const line of rawLines) {
        const parts = line
          .split(/[,，\t\s]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (!parts.length) continue;

        // 支持一行多个纯代码，或 "代码,名称,交易制度"
        const firstCode = parts[0].replace(/\D/g, "").slice(-6);
        if (firstCode.length === 6 && parts.length >= 2 && !/^\d{6}$/.test(parts[1])) {
          if (seen.has(firstCode)) continue;
          seen.add(firstCode);
          const customName = parts[1];
          const explicitMode = (parts[2] || "").toLowerCase();
          parsed.push({
            etf_code: firstCode,
            custom_name: customName,
            explicit_mode: explicitMode === "t+0" || explicitMode === "t0" ? "t+0" : explicitMode === "t+1" || explicitMode === "t1" ? "t+1" : "",
          });
        } else {
          for (const token of parts) {
            const c = token.replace(/\D/g, "").slice(-6);
            if (c.length === 6 && !seen.has(c)) {
              seen.add(c);
              parsed.push({ etf_code: c, custom_name: "", explicit_mode: "" });
            }
          }
        }
      }

      if (!parsed.length) {
        store.showToast("未识别到有效的 6 位数字代码", "error");
        return [];
      }

      batchParsing.value = true;
      try {
        const results = await Promise.all(
          parsed.map(async (item) => {
            const info = await fetchSecurityInfo(item.etf_code, item.custom_name);
            const finalName = item.custom_name || info.name || item.etf_code;
            const finalMode = item.explicit_mode || resolveTradeRule(item.etf_code, finalName, info.trade_mode);
            return {
              etf_code: item.etf_code,
              etf_name: finalName,
              trade_mode: finalMode,
            };
          })
        );
        batchPreview.value = results;
        return results;
      } finally {
        batchParsing.value = false;
      }
    };

    const submitBatchImport = async () => {
      let items = batchPreview.value;
      if (!items.length) {
        items = await recognizeBatchInput();
      }
      if (!items.length) return;

      batchParsing.value = true;
      try {
        const res = await adminApi.batchImportShared(items);
        store.showToast(
          `批量导入完成！新增 ${res.added || 0} 只，更新 ${res.updated || res.skipped || 0} 只`
        );
        batchImportVisible.value = false;
        batchText.value = "";
        batchPreview.value = [];
        await loadShared();
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        batchParsing.value = false;
      }
    };

    const deleteItem = async (w, ev = null) => {
      if (ev) ev.stopPropagation();
      if (!confirm(`确认删除默认监控标的 ${w.etf_code}（${w.etf_name}）？`)) return;
      try {
        await adminApi.deleteSharedItem(w.id);
        selectedIds.value = selectedIds.value.filter((id) => id !== w.id);
        store.showToast("已删除");
        await loadShared();
      } catch (err) {
        store.showToast(err.message, "error");
      }
    };

    const displayRule = (w) => resolveTradeRule(w.etf_code, w.etf_name, w.trade_mode);

    onMounted(() => {
      loadShared();
      window.addEventListener("keydown", onKeyDown);
    });

    onUnmounted(() => {
      window.removeEventListener("keydown", onKeyDown);
    });

    return {
      sharedList,
      loading,
      orderSaving,
      searchQuery,
      isSearching,
      filteredList,
      selectedIds,
      allSelected,
      isSelected,
      onRowClick,
      toggleSelect,
      toggleSelectAll,
      draggingId,
      dragOverId,
      onDragStart,
      onDragEnter,
      onDragOver,
      onDrop,
      onDragEnd,
      moveSelected,
      moveSingleRow,
      modalVisible,
      detectingSingle,
      form,
      onSingleCodeInput,
      batchImportVisible,
      batchText,
      batchParsing,
      batchPreview,
      openBatchModal,
      recognizeBatchInput,
      loadShared,
      openModal,
      submitShared,
      submitBatchImport,
      deleteItem,
      displayRule,
    };
  },
  template: `
    <div class="space-y-4 select-none">
      <!-- 顶部标题与操作区 -->
      <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="text-xl font-bold text-slate-800">默认监控列表</h2>
            <span v-if="orderSaving" class="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2.5 py-0.5 rounded-full font-bold">
              <i class="fa-solid fa-spinner animate-spin mr-1"></i>正在保存排序...
            </span>
          </div>
          <p class="text-xs text-slate-400 mt-0.5">
            添加或批量导入时<strong>只需输入 6 位代码</strong>即可自动识别名称与 T+0/T+1 属性；点击选中后<strong>按住直接上下拖动</strong>可调整排序
          </p>
        </div>

        <div class="flex gap-2 flex-wrap items-center">
          <div class="relative">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索代码 / 名称"
              class="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:theme-border w-44"
            >
            <button v-if="searchQuery" type="button" @click="searchQuery=''"
                    class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
              <i class="fa-solid fa-circle-xmark text-xs"></i>
            </button>
          </div>
          <button type="button" @click="openBatchModal" class="text-xs bg-slate-100 text-slate-700 px-3 py-2 rounded-lg font-bold hover:bg-slate-200">
            批量导入
          </button>
          <button type="button" @click="openModal()" class="theme-bg text-white text-sm px-3.5 py-2 rounded-lg font-bold hover:opacity-90">
            添加标的
          </button>
          <button type="button" @click="loadShared" class="bg-white border px-3 py-2 rounded-lg text-sm hover:bg-slate-50" title="刷新列表">
            <i class="fa-solid fa-rotate-right" :class="{'animate-spin': loading}"></i>
          </button>
        </div>
      </div>

      <!-- 选中标的浮动快捷排序栏 -->
      <div v-if="selectedIds.length"
           class="bg-teal-50/90 border border-[#4da6a0]/40 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-sm">
        <div class="text-xs text-slate-700 flex items-center gap-2">
          <span class="w-2 h-2 rounded-full theme-bg"></span>
          <span>已选中 <strong class="theme-text font-mono text-sm">{{ selectedIds.length }}</strong> 只标的</span>
          <span class="text-slate-400 hidden sm:inline">（可直接按住选中行上下拖动，或点击右侧按钮 / 键盘 ↑↓ 调整位置）</span>
        </div>
        <div class="flex items-center gap-1.5 flex-wrap">
          <button type="button" @click="moveSelected('top')" :disabled="orderSaving || isSearching"
                  class="px-2.5 py-1 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:border-[#4da6a0] hover:theme-text disabled:opacity-40 shadow-sm">
            <i class="fa-solid fa-angles-up mr-1"></i>置顶
          </button>
          <button type="button" @click="moveSelected('up')" :disabled="orderSaving || isSearching"
                  class="px-2.5 py-1 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:border-[#4da6a0] hover:theme-text disabled:opacity-40 shadow-sm">
            <i class="fa-solid fa-arrow-up mr-1"></i>上移
          </button>
          <button type="button" @click="moveSelected('down')" :disabled="orderSaving || isSearching"
                  class="px-2.5 py-1 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:border-[#4da6a0] hover:theme-text disabled:opacity-40 shadow-sm">
            <i class="fa-solid fa-arrow-down mr-1"></i>下移
          </button>
          <button type="button" @click="moveSelected('bottom')" :disabled="orderSaving || isSearching"
                  class="px-2.5 py-1 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:border-[#4da6a0] hover:theme-text disabled:opacity-40 shadow-sm">
            <i class="fa-solid fa-angles-down mr-1"></i>置底
          </button>
          <button type="button" @click="selectedIds = []"
                  class="px-2.5 py-1 rounded-lg text-xs text-slate-500 hover:text-slate-700 ml-1">
            取消选中
          </button>
        </div>
      </div>

      <!-- 主表格 -->
      <div class="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
        <div v-if="loading" class="text-center py-12 text-slate-400">
          <i class="fa-solid fa-circle-notch animate-spin text-2xl theme-text"></i>
        </div>
        <div v-else-if="!filteredList.length" class="text-center py-14 text-slate-400 text-sm">
          暂无默认监控标的
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm text-left whitespace-nowrap">
            <thead class="bg-slate-50 text-slate-500 border-b text-xs font-bold">
              <tr>
                <th class="py-3 pl-4 pr-2 w-10">
                  <input type="checkbox" :checked="allSelected" @change="toggleSelectAll"
                         class="rounded border-slate-300 cursor-pointer" title="全选 / 取消全选">
                </th>
                <th class="py-3 px-4">代码（红色=T+0）</th>
                <th class="py-3 px-4">名称</th>
                <th class="py-3 px-4">交易属性</th>
                <th class="py-3 px-4">排序（按住上下拖动）</th>
                <th class="py-3 px-4">状态</th>
                <th class="py-3 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100" @dragover.prevent @drop="onDrop">
              <tr v-for="(w, idx) in filteredList" :key="w.id"
                  :draggable="!isSearching"
                  @click="onRowClick(w, $event)"
                  @dragstart="onDragStart(w, $event)"
                  @dragenter="onDragEnter(w, $event)"
                  @dragover="onDragOver(w, $event)"
                  @drop="onDrop($event)"
                  @dragend="onDragEnd"
                  class="transition-colors group relative"
                  :class="[
                    isSearching ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
                    isSelected(w.id) ? 'bg-[#4da6a0]/10 hover:bg-[#4da6a0]/15' : 'hover:bg-slate-50',
                    draggingId && isSelected(w.id) ? 'opacity-60 ring-2 ring-inset ring-[#4da6a0]' : ''
                  ]">
                <td class="py-3 pl-4 pr-2 relative" @click.stop="toggleSelect(w.id)">
                  <div v-if="isSelected(w.id)" class="absolute left-0 top-0 bottom-0 w-1 theme-bg"></div>
                  <input type="checkbox" :checked="isSelected(w.id)"
                         @change="toggleSelect(w.id)"
                         class="rounded border-slate-300 cursor-pointer">
                </td>

                <!-- 代码：T+0 为红色，T+1 保持原色，不加 (0) -->
                <td class="py-3 px-4 font-mono font-bold"
                    :class="displayRule(w)==='t+0' ? 'text-red-500' : 'text-slate-800'">
                  {{ w.etf_code }}
                </td>

                <td class="py-3 px-4 font-medium text-slate-800">{{ w.etf_name }}</td>

                <td class="py-3 px-4">
                  <span class="text-xs font-mono font-bold px-2 py-0.5 rounded"
                        :class="displayRule(w)==='t+0' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-slate-100 text-slate-600'">
                    {{ displayRule(w).toUpperCase() }}
                  </span>
                </td>

                <td class="py-3 px-4">
                  <div class="inline-flex items-center gap-2">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-bold transition"
                          :class="isSelected(w.id)
                            ? 'bg-[#4da6a0] text-white border-transparent shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 group-hover:border-[#4da6a0]/50'"
                          title="按住此行上下拖动即可调整顺序">
                      <i class="fa-solid fa-grip-vertical text-[11px] opacity-75"></i>
                      <span>{{ idx }}</span>
                    </span>

                    <div v-if="!isSearching" class="inline-flex items-center gap-0.5 opacity-80 group-hover:opacity-100">
                      <button type="button" @click="moveSingleRow(w, 'up', $event)"
                              :disabled="idx === 0 || orderSaving"
                              class="w-6 h-6 rounded hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 disabled:opacity-25 flex items-center justify-center text-xs"
                              title="上移一位">
                        <i class="fa-solid fa-chevron-up text-[10px]"></i>
                      </button>
                      <button type="button" @click="moveSingleRow(w, 'down', $event)"
                              :disabled="idx === filteredList.length - 1 || orderSaving"
                              class="w-6 h-6 rounded hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 disabled:opacity-25 flex items-center justify-center text-xs"
                              title="下移一位">
                        <i class="fa-solid fa-chevron-down text-[10px]"></i>
                      </button>
                      <button v-if="idx > 0" type="button" @click="moveSingleRow(w, 'top', $event)"
                              :disabled="orderSaving"
                              class="w-6 h-6 rounded hover:bg-teal-50 text-slate-400 hover:theme-text disabled:opacity-25 flex items-center justify-center text-xs"
                              title="一键置顶">
                        <i class="fa-solid fa-angles-up text-[10px]"></i>
                      </button>
                    </div>
                  </div>
                </td>

                <td class="py-3 px-4">
                  <span :class="w.enabled ? 'text-emerald-500 font-bold' : 'text-slate-400'">
                    {{ w.enabled ? '启用' : '停用' }}
                  </span>
                </td>

                <td class="py-3 px-4 text-right space-x-1">
                  <button type="button" @click="openModal(w, $event)" class="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded hover:bg-slate-200">编辑</button>
                  <button type="button" @click="deleteItem(w, $event)" class="text-xs bg-red-50 text-red-500 px-2.5 py-1 rounded hover:bg-red-100">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 单条添加/编辑弹窗（输入6位代码自动识别名称与T+0/T+1） -->
      <div v-if="modalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="modalVisible = false">
        <div class="bg-white rounded-2xl w-full max-w-md p-6 space-y-3.5 shadow-2xl">
          <div class="flex items-center justify-between">
            <h3 class="font-bold text-slate-800">{{ form.id ? '编辑' : '添加' }}默认监控标的</h3>
            <span v-if="detectingSingle" class="text-xs theme-text">
              <i class="fa-solid fa-spinner animate-spin mr-1"></i>正在自动识别名称与交易制度...
            </span>
          </div>

          <div class="space-y-1">
            <label class="text-xs text-slate-500 block">标的代码（输入 6 位代码即自动识别名称及 T+0 / T+1）</label>
            <input v-model="form.etf_code" @input="onSingleCodeInput" maxlength="6" placeholder="例如：513090 或 000651"
                   class="w-full border px-3 py-2 rounded-lg text-sm font-mono focus:theme-border outline-none"
                   @keyup.enter="submitShared">
          </div>

          <div class="space-y-1">
            <label class="text-xs text-slate-500 block">标的名称（已自动识别，也可手动微调）</label>
            <input v-model="form.etf_name" placeholder="输入代码后自动填充"
                   class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none"
                   @keyup.enter="submitShared">
          </div>

          <div class="space-y-1">
            <label class="text-xs text-slate-500 block">交易制度（自动识别，支持手动切换）</label>
            <div class="grid grid-cols-2 gap-2">
              <button type="button" @click="form.trade_mode='t+0'"
                      class="py-2 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5"
                      :class="form.trade_mode==='t+0' ? 'bg-red-500 text-white border-red-500 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200'">
                <span>T+0（红色代码）</span>
              </button>
              <button type="button" @click="form.trade_mode='t+1'"
                      class="py-2 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5"
                      :class="form.trade_mode==='t+1' ? 'theme-bg text-white border-transparent shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200'">
                <span>T+1（常规代码）</span>
              </button>
            </div>
          </div>

          <label class="flex items-center gap-2 text-sm text-slate-600 pt-1 cursor-pointer">
            <input type="checkbox" v-model="form.enabled"> 启用该标的监控
          </label>

          <div class="flex justify-end gap-2 pt-2">
            <button type="button" @click="modalVisible = false" class="px-4 py-2 text-sm text-slate-500">取消</button>
            <button type="button" @click="submitShared" :disabled="detectingSingle"
                    class="theme-bg text-white px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50">
              保存
            </button>
          </div>
        </div>
      </div>

      <!-- 批量导入弹窗（只需输入代码，自动识别名称及 T+0 / T+1） -->
      <div v-if="batchImportVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="batchImportVisible = false">
        <div class="bg-white rounded-2xl w-full max-w-lg p-6 space-y-3.5 shadow-2xl max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between">
            <h3 class="font-bold text-slate-800">批量导入默认监控标的</h3>
            <button type="button" @click="batchImportVisible = false" class="text-slate-400 hover:text-slate-600">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <p class="text-xs text-slate-500 leading-relaxed">
            <strong>只需输入 6 位股票/ETF代码</strong>（每行一个，或用空格/逗号分隔），系统将自动查询对应股票名称并智能判断是 <strong class="text-red-500">T+0</strong> 还是 <strong>T+1</strong>：
          </p>

          <textarea
            v-model="batchText"
            @input="batchPreview = []"
            rows="6"
            placeholder="513090&#10;159920&#10;562500&#10;000651"
            class="w-full border px-3 py-2 rounded-lg text-sm font-mono focus:theme-border outline-none"
          ></textarea>

          <!-- 自动识别结果预览表 -->
          <div v-if="batchPreview.length" class="border border-slate-200 rounded-xl overflow-hidden">
            <div class="bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 flex justify-between items-center">
              <span>已自动识别 {{ batchPreview.length }} 只标的（点击交易属性可手动切换）</span>
            </div>
            <div class="max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs">
              <div v-for="(item, idx) in batchPreview" :key="item.etf_code" class="px-3 py-2 flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="font-mono font-bold" :class="item.trade_mode==='t+0' ? 'text-red-500' : 'text-slate-800'">
                    {{ item.etf_code }}
                  </span>
                  <input v-model="item.etf_name" class="border border-slate-200 rounded px-2 py-0.5 text-xs w-36 focus:theme-border outline-none">
                </div>
                <button type="button"
                        @click="item.trade_mode = item.trade_mode === 't+0' ? 't+1' : 't+0'"
                        class="px-2 py-0.5 rounded font-mono font-bold border transition shrink-0"
                        :class="item.trade_mode==='t+0' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-100 text-slate-600 border-slate-200'">
                  {{ item.trade_mode.toUpperCase() }}
                </button>
              </div>
            </div>
          </div>

          <div class="flex justify-between items-center gap-2 pt-2">
            <button type="button" @click="recognizeBatchInput" :disabled="batchParsing || !batchText.trim()"
                    class="text-xs bg-slate-100 text-slate-700 px-3.5 py-2 rounded-lg font-bold hover:bg-slate-200 disabled:opacity-50">
              <i v-if="batchParsing" class="fa-solid fa-spinner animate-spin mr-1"></i>
              {{ batchParsing ? '正在识别...' : '预览自动识别结果' }}
            </button>
            <div class="flex gap-2">
              <button type="button" @click="batchImportVisible = false" class="px-4 py-2 text-sm text-slate-500">取消</button>
              <button type="button" @click="submitBatchImport" :disabled="batchParsing || !batchText.trim()"
                      class="theme-bg text-white px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50">
                {{ batchParsing ? '导入中...' : '自动识别并导入' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
};
