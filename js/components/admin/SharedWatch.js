/**
 * 波幅探长 - 后台【默认监控列表】组件 (v5.2 选中与上下拖拽排序版)
 * 核心升级：
 * 1. 支持点击选中标的（单选/多选），选中行高亮显示，可直接按住上下拖动实时调整顺序
 * 2. 拖动过程中列表行实时跟随鼠标上下换位（所见即所得），松手后自动归一化序号（0, 1, 2...）并保存至数据库
 * 3. 支持选中后使用键盘 ↑ / ↓ 方向键、顶部快捷栏（置顶/上移/下移/置底）或行内微调按钮调整顺序
 * 4. 双重兼容保存：优先使用批量排序接口，若后端未升级则自动无缝回退为逐条保存接口，确保 100% 落库成功
 */
import { store } from "../../store.js";
import { adminApi } from "../../api/admin.js";
import { resolveTradeRule } from "../../config.js";

const { ref, reactive, computed, onMounted, onUnmounted } = Vue;

export default {
  name: "SharedWatch",
  setup() {
    const sharedList = ref([]);
    const loading = ref(false);
    const orderSaving = ref(false);
    const searchQuery = ref("");

    // 选中与拖拽状态
    const selectedIds = ref([]); // 支持单击选中或勾选多只标的
    const draggingId = ref(null);
    const dragOverId = ref(null);
    const orderSnapshot = ref(""); // 记录拖拽前顺序，用于判断是否发生变化及失败回滚

    const modalVisible = ref(false);
    const form = reactive({
      id: null,
      etf_code: "",
      etf_name: "",
      trade_mode: "auto",
      sort_order: 0,
      enabled: true,
    });

    const batchImportVisible = ref(false);
    const batchText = ref("");

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

    /** 点击行选中标的（若按住 Ctrl/Cmd 或点击复选框则切换多选，普通点击则选中当前行便于直接上下调整） */
    const onRowClick = (w, ev) => {
      if (!w) return;
      // 忽略按钮、输入框点击
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
        // 记录原始 sort_order 以便对比变更
        raw.forEach((item, idx) => {
          item._saved_sort = Number(item.sort_order ?? idx);
        });
        sharedList.value = raw;
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
      }
    };

    /** 重新编号 0, 1, 2... 并持久化保存到数据库（兼容批量接口与单条保存回退） */
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
          etf_code: item.etf_code,
          etf_name: item.etf_name,
          trade_mode: item.trade_mode || "auto",
          sort_order: idx,
          enabled: !!item.enabled,
        }));

        let savedViaBatch = false;
        if (typeof adminApi.reorderSharedWatchlist === "function") {
          try {
            await adminApi.reorderSharedWatchlist(ordersPayload);
            savedViaBatch = true;
          } catch (_) {
            savedViaBatch = false;
          }
        }

        if (!savedViaBatch) {
          // 优先尝试向 /api/admin/watchlist/shared 发送批量 action: "reorder"
          try {
            await adminApi.saveSharedItem({
              action: "reorder",
              orders: ordersPayload.map((x) => ({ id: x.id, sort_order: x.sort_order })),
            });
            savedViaBatch = true;
          } catch (_) {
            savedViaBatch = false;
          }
        }

        if (!savedViaBatch) {
          // 兜底：逐条并发更新发生变动的标的（100% 兼容未升级的旧版 vip-api.js）
          await Promise.all(
            changedItems.map((item) =>
              adminApi.saveSharedItem({
                id: item.id,
                etf_code: item.etf_code,
                etf_name: item.etf_name,
                trade_mode: item.trade_mode || "auto",
                sort_order: item.sort_order,
                enabled: !!item.enabled,
              })
            )
          );
        }

        sharedList.value.forEach((item) => {
          item._saved_sort = item.sort_order;
        });
        if (!silent) {
          store.showToast("排序已实时更新并保存");
        }
      } catch (err) {
        store.showToast(err.message || "排序保存失败，请刷新重试", "error");
        await loadShared();
      } finally {
        orderSaving.value = false;
      }
    };

    // ==================== 鼠标上下拖拽排序（实时换位 + 支持单选/多选成组拖动） ====================
    const onDragStart = (w, ev) => {
      if (isSearching.value) {
        ev.preventDefault();
        store.showToast("请先清空右上角搜索框，再上下拖动调整全局排序", "error");
        return;
      }
      draggingId.value = w.id;
      // 如果拖动的行不在当前选中列表里，自动将其设为当前选中项
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

      // 若目标行本身也在被拖动的选中集合内，则无需移动
      if (movingIds.has(targetItem.id)) return;

      const firstMovingIdx = list.findIndex((x) => movingIds.has(x.id));
      const targetIdx = list.findIndex((x) => x.id === targetItem.id);
      if (firstMovingIdx < 0 || targetIdx < 0) return;

      const movingItems = list.filter((x) => movingIds.has(x.id));
      const remaining = list.filter((x) => !movingIds.has(x.id));
      const newTargetIdx = remaining.findIndex((x) => x.id === targetItem.id);
      if (newTargetIdx < 0) return;

      // 向下拖时插入到目标行之后，向上拖时插入到目标行之前
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

    const onDrop = async (ev) => {
      if (ev) ev.preventDefault();
      await finishDrag();
    };

    const onDragEnd = async () => {
      await finishDrag();
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

    // ==================== 选中项快捷上下移动 / 置顶 / 置底（含键盘 ↑↓ 支持） ====================
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

    // ==================== 新增 / 编辑 / 批量导入 / 删除 ====================
    const openModal = (item = null, ev = null) => {
      if (ev) ev.stopPropagation();
      if (item) {
        Object.assign(form, {
          ...item,
          trade_mode: item.trade_mode || "auto",
          enabled: !!item.enabled,
        });
      } else {
        Object.assign(form, {
          id: null,
          etf_code: "",
          etf_name: "",
          trade_mode: "auto",
          sort_order: sharedList.value.length,
          enabled: true,
        });
      }
      modalVisible.value = true;
    };

    const submitShared = async () => {
      if (!form.etf_code.trim()) {
        store.showToast("标的代码不能为空", "error");
        return;
      }
      try {
        await adminApi.saveSharedItem(form);
        store.showToast("保存成功");
        modalVisible.value = false;
        await loadShared();
      } catch (err) {
        store.showToast(err.message, "error");
      }
    };

    const submitBatchImport = async () => {
      if (!batchText.value.trim()) return;
      const items = batchText.value
        .split("\n")
        .map((line) => {
          const parts = line
            .split(/[,，\t]/)
            .map((s) => s.trim())
            .filter(Boolean);
          if (!parts.length) return null;
          const modeRaw = (parts[2] || "").toLowerCase();
          const trade_mode =
            modeRaw === "t+0" || modeRaw === "t0"
              ? "t+0"
              : modeRaw === "t+1" || modeRaw === "t1"
              ? "t+1"
              : "auto";
          return {
            etf_code: parts[0],
            etf_name: parts[1] || parts[0],
            trade_mode,
          };
        })
        .filter(Boolean);

      if (!items.length) {
        store.showToast("未解析到有效数据", "error");
        return;
      }

      try {
        const res = await adminApi.batchImportShared(items);
        store.showToast(`批量导入成功！新增 ${res.added || 0} 只，跳过 ${res.skipped || 0} 只`);
        batchImportVisible.value = false;
        batchText.value = "";
        await loadShared();
      } catch (err) {
        store.showToast(err.message, "error");
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
      form,
      batchImportVisible,
      batchText,
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
            点击可选中标的，<strong>按住直接上下拖动</strong>即可调整监控顺序（亦可使用 ↑ / ↓ 方向键或快捷按钮微调）
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
          <button type="button" @click="batchImportVisible = true" class="text-xs bg-slate-100 text-slate-700 px-3 py-2 rounded-lg font-bold hover:bg-slate-200">
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

      <!-- 主表格（支持点击选中 + 按住直接上下拖动排序） -->
      <div class="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
        <div v-if="loading" class="text-center py-12 text-slate-400">
          <i class="fa-solid fa-circle-notch animate-spin text-2xl theme-text"></i>
        </div>
        <div v-else-if="!filteredList.length" class="text-center py-14 text-slate-400 text-sm">
          暂无通用标的
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm text-left whitespace-nowrap">
            <thead class="bg-slate-50 text-slate-500 border-b text-xs font-bold">
              <tr>
                <th class="py-3 pl-4 pr-2 w-10">
                  <input type="checkbox" :checked="allSelected" @change="toggleSelectAll"
                         class="rounded border-slate-300 cursor-pointer" title="全选 / 取消全选">
                </th>
                <th class="py-3 px-4">代码</th>
                <th class="py-3 px-4">名称</th>
                <th class="py-3 px-4">交易条件</th>
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
                <!-- 选中勾选框 + 左侧高亮条 -->
                <td class="py-3 pl-4 pr-2 relative" @click.stop="toggleSelect(w.id)">
                  <div v-if="isSelected(w.id)" class="absolute left-0 top-0 bottom-0 w-1 theme-bg"></div>
                  <input type="checkbox" :checked="isSelected(w.id)"
                         @change="toggleSelect(w.id)"
                         class="rounded border-slate-300 cursor-pointer">
                </td>

                <!-- 代码 -->
                <td class="py-3 px-4 font-mono font-bold text-slate-800">
                  {{ w.etf_code }}<span v-if="displayRule(w)==='t+0'" class="text-indigo-600 font-bold">(0)</span>
                </td>

                <!-- 名称 -->
                <td class="py-3 px-4 font-medium text-slate-800">{{ w.etf_name }}</td>

                <!-- 交易条件 -->
                <td class="py-3 px-4">
                  <span class="text-xs font-mono font-bold px-2 py-0.5 rounded"
                        :class="displayRule(w)==='t+0' ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-slate-100 text-slate-600'">
                    ({{ displayRule(w) }})
                  </span>
                  <span v-if="w.trade_mode && w.trade_mode !== 'auto'" class="text-[10px] text-amber-600 ml-1">手动指定</span>
                </td>

                <!-- 排序列：拖拽手柄 + 当前序号 + 快捷上下微调按钮 -->
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

                <!-- 状态 -->
                <td class="py-3 px-4">
                  <span :class="w.enabled ? 'text-emerald-500 font-bold' : 'text-slate-400'">
                    {{ w.enabled ? '启用' : '停用' }}
                  </span>
                </td>

                <!-- 操作 -->
                <td class="py-3 px-4 text-right space-x-1">
                  <button type="button" @click="openModal(w, $event)" class="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded hover:bg-slate-200">编辑</button>
                  <button type="button" @click="deleteItem(w, $event)" class="text-xs bg-red-50 text-red-500 px-2.5 py-1 rounded hover:bg-red-100">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 单条编辑/新增弹窗 -->
      <div v-if="modalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="modalVisible = false">
        <div class="bg-white rounded-2xl w-full max-w-md p-6 space-y-3.5 shadow-2xl">
          <h3 class="font-bold text-slate-800">{{ form.id ? '编辑' : '添加' }}默认监控标的</h3>
          <div class="space-y-1">
            <label class="text-xs text-slate-500 block">标的代码（6位数字）</label>
            <input v-model="form.etf_code" maxlength="6" placeholder="例如：513090" class="w-full border px-3 py-2 rounded-lg text-sm font-mono focus:theme-border outline-none">
          </div>
          <div class="space-y-1">
            <label class="text-xs text-slate-500 block">标的名称</label>
            <input v-model="form.etf_name" placeholder="例如：香港证券ETF" class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
          </div>
          <div class="space-y-1">
            <label class="text-xs text-slate-500 block">交易制度标识</label>
            <select v-model="form.trade_mode" class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
              <option value="auto">自动识别（跨境/商品/债券/黄金T+0，其余T+1）</option>
              <option value="t+0">强制设为 T+0 (0)</option>
              <option value="t+1">强制设为 T+1</option>
            </select>
          </div>
          <label class="flex items-center gap-2 text-sm text-slate-600 pt-1 cursor-pointer">
            <input type="checkbox" v-model="form.enabled"> 启用该标的监控
          </label>
          <p class="text-[11px] text-slate-400">
            提示：保存后可在列表中直接选中并上下拖动来调整排序位置。
          </p>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" @click="modalVisible = false" class="px-4 py-2 text-sm text-slate-500">取消</button>
            <button type="button" @click="submitShared" class="theme-bg text-white px-4 py-2 rounded-lg text-sm font-bold">保存</button>
          </div>
        </div>
      </div>

      <!-- 批量导入弹窗 -->
      <div v-if="batchImportVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="batchImportVisible = false">
        <div class="bg-white rounded-2xl w-full max-w-md p-6 space-y-3 shadow-2xl">
          <h3 class="font-bold text-slate-800">批量导入通用标的</h3>
          <p class="text-xs text-slate-400">每行格式：代码,名称,交易制度(可选 t+0 或 t+1，不填则自动识别)</p>
          <textarea
            v-model="batchText"
            rows="8"
            placeholder="513090,香港证券ETF,t+0&#10;562500,机器人ETF,t+1"
            class="w-full border px-3 py-2 rounded-lg text-sm font-mono focus:theme-border outline-none"
          ></textarea>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" @click="batchImportVisible = false" class="px-4 py-2 text-sm text-slate-500">取消</button>
            <button type="button" @click="submitBatchImport" class="theme-bg text-white px-4 py-2 rounded-lg text-sm font-bold">导入</button>
          </div>
        </div>
      </div>
    </div>
  `,
};