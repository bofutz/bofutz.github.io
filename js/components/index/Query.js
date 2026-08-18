/**
 * 波幅探长 - 自主查询（按次出图）
 * js/components/index/Query.js
 *
 * 流程：输入代码 → 识别名称 → 选周期 → 扣次排队 → 批次生成后记录中查看链接
 */
import { store } from "../../store.js";
import { chartQueryApi } from "../../api/chartQuery.js";
import { CONFIG } from "../../config.js";

const { ref, reactive, computed, onMounted } = Vue;

function settingOn(val) {
  return val === "1" || val === 1 || val === true || val === "true";
}

export default {
  name: "Query",
  setup() {
    const loading = ref(false);
    const submitLoading = ref(false);
    const records = ref([]);
    const form = reactive({
      etfCode: "",
      etfName: "",
      /** @type {string[]} 多选周期 */
      intervals: ["daily_closed"],
    });
    const searchingName = ref(false);
    const nameError = ref("");

    const settings = computed(() => store.state.publicSettings || {});
    const batchHours = computed(
      () => parseInt(settings.value.chart_query_batch_hours || "2", 10) || 2
    );
    const retainDays = computed(
      () => parseInt(settings.value.chart_query_retain_trading_days || "2", 10) || 2
    );

    const enabledIntervals = computed(() => {
      let raw =
        settings.value.chart_query_intervals ||
        '["half_day_closed","half_day_next","daily_closed","daily_next","weekly_closed","weekly_next"]';
      try {
        const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (Array.isArray(arr) && arr.length) {
          // 规范化旧 key
          const map = { half_day: "half_day_closed", daily: "daily_closed", weekly: "weekly_closed" };
          return [...new Set(arr.map((x) => map[x] || x))];
        }
      } catch (_) {}
      return ["daily_closed"];
    });

    const intervalLabel = (k) =>
      (CONFIG.CHART_INTERVALS && CONFIG.CHART_INTERVALS[k]) || k;

    const isIntervalSelected = (key) => form.intervals.includes(key);

    const toggleInterval = (key) => {
      const i = form.intervals.indexOf(key);
      if (i >= 0) {
        // 至少保留一个时允许清空？产品：允许清空，提交时再校验
        form.intervals.splice(i, 1);
      } else {
        form.intervals.push(key);
      }
    };

    const selectedCount = computed(() => form.intervals.length);

    const selectedLabels = computed(() =>
      form.intervals.map((k) => intervalLabel(k)).filter(Boolean)
    );


    /** 分组展示：半日 / 日 / 周 × 最新收盘 / 下一收盘 */
    const intervalGroups = computed(() => {
      const enabled = new Set(enabledIntervals.value);
      const groups = [
        {
          title: "半日线",
          icon: "fa-solid fa-chart-area",
          tone: "sky",
          items: [
            { key: "half_day_closed", short: "最新收盘", desc: "已结束时段" },
            { key: "half_day_next", short: "下一收盘", desc: "未结束时段" },
          ],
        },
        {
          title: "日线",
          icon: "fa-solid fa-chart-line",
          tone: "teal",
          items: [
            { key: "daily_closed", short: "最新收盘", desc: "已结束时段" },
            { key: "daily_next", short: "下一收盘", desc: "未结束时段" },
          ],
        },
        {
          title: "周线",
          icon: "fa-solid fa-calendar-week",
          tone: "violet",
          items: [
            { key: "weekly_closed", short: "最新收盘", desc: "已结束周" },
            { key: "weekly_next", short: "下一收盘", desc: "未结束周" },
          ],
        },
      ];
      return groups
        .map((g) => ({
          ...g,
          items: g.items.filter((it) => enabled.has(it.key)),
        }))
        .filter((g) => g.items.length);
    });

    /** 场次耗时：15:35 含监控列表，约 25 分钟；其余约 10 分钟 */
    const etaMinutesForSlot = (timeStr, mode) => {
      const t = String(timeStr || "");
      if (t === "15:35" || mode === "all") return 25;
      return 10;
    };

    /**
     * 按所选周期 + 后台 chart_run_slots 推算最近一场
     * 返回 { text, time, etaMin, mode, detail }
     */
    const nextBatchInfo = computed(() => {
      const iv = (form.intervals && form.intervals[0]) || "daily_closed";
      const isWeekly = String(iv).startsWith("weekly");
      const isNext = String(iv).includes("_next");
      let slots = [];
      try {
        const raw = settings.value.chart_run_slots;
        const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (Array.isArray(arr)) {
          for (const s of arr) {
            if (!s || s.enabled === false) continue;
            const tm = String(s.time || "");
            const m = tm.match(/^(\d{1,2}):(\d{2})$/);
            if (!m) continue;
            const kinds = Array.isArray(s.kinds)
              ? s.kinds
              : s.kind
              ? [s.kind]
              : ["half_day", "daily"];
            slots.push({
              time: `${String(m[1]).padStart(2, "0")}:${m[2]}`,
              mins: parseInt(m[1], 10) * 60 + parseInt(m[2], 10),
              kinds,
              weekday: s.weekday != null ? Number(s.weekday) : null,
              mode: s.mode || "query",
            });
          }
        }
      } catch (_) {}
      if (!slots.length) {
        slots = [
          { time: "07:00", mins: 7 * 60, kinds: ["half_day", "daily"], weekday: null, mode: "query" },
          { time: "15:35", mins: 15 * 60 + 35, kinds: ["half_day", "daily"], weekday: null, mode: "all" },
          { time: "19:00", mins: 19 * 60, kinds: ["half_day", "daily"], weekday: null, mode: "query" },
          { time: "22:00", mins: 22 * 60, kinds: ["half_day", "daily"], weekday: null, mode: "query" },
          { time: "09:00", mins: 9 * 60, kinds: ["weekly"], weekday: 6, mode: "query" },
        ];
      }
      const base = isWeekly ? "weekly" : String(iv).includes("half") ? "half_day" : "daily";
      const matched = slots.filter((s) => (s.kinds || []).includes(base));
      const now = new Date();
      const bj = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));
      const mins = bj.getHours() * 60 + bj.getMinutes();
      const wd = bj.getDay();

      const pack = (slot, whenLabel, past = false) => {
        const eta = etaMinutesForSlot(slot.time, slot.mode);
        const modeNote =
          slot.mode === "all"
            ? "含监控列表，出图较慢"
            : "仅自主查询标的";
        const text = past
          ? `${whenLabel} ${slot.time} 场（最新收盘）`
          : `${whenLabel} ${slot.time}`;
        return {
          text,
          time: slot.time,
          etaMin: eta,
          mode: slot.mode,
          past,
          detail: `预计排队约 ${eta} 分钟出图（${modeNote}；高峰可能更久）`,
        };
      };

      if (isWeekly) {
        const weekSlots = matched.filter((s) => s.weekday === 6 || s.weekday != null);
        const use = weekSlots.length ? weekSlots : matched;
        if (wd === 6) {
          for (const s of use.slice().sort((a, b) => a.mins - b.mins)) {
            if (mins < s.mins) return pack(s, "今日");
            if (!isNext && mins >= s.mins) return pack(s, "本周六", true);
          }
        }
        const s0 = use[0] || { time: "09:00", mode: "query" };
        return pack(s0, "下一周六");
      }

      const daySlots = matched
        .filter((s) => s.weekday == null || (s.weekday >= 1 && s.weekday <= 5))
        .sort((a, b) => a.mins - b.mins);
      const isTd = wd >= 1 && wd <= 5;

      if (isNext) {
        if (isTd) {
          for (const s of daySlots) {
            if (mins < s.mins) return pack(s, "今日");
          }
        }
        return pack(daySlots[0] || { time: "07:00", mode: "query" }, "下一交易日");
      }

      if (isTd) {
        const past = daySlots.filter((s) => s.mins <= mins);
        if (past.length) return pack(past[past.length - 1], "今日", true);
        for (const s of daySlots) {
          if (mins < s.mins) return pack(s, "今日");
        }
      }
      return pack(daySlots[0] || { time: "07:00", mode: "query" }, "下一交易日");
    });

    const nextBatchHint = computed(() => nextBatchInfo.value?.text || "—");

    const fetchStockNameByCode = async (symbolStr) => {
      try {
        const codeMatch = String(symbolStr || "").match(/\d{6}/);
        if (!codeMatch) return "";
        const code = codeMatch[0];
        const prefix = ["5", "6", "9"].includes(code[0]) ? "sh" : "sz";
        const resp = await fetch(`https://qt.gtimg.cn/q=${prefix}${code}`);
        if (!resp.ok) return "";
        const buffer = await resp.arrayBuffer();
        const text = new TextDecoder("gbk").decode(buffer);
        const match = text.match(/="[^~]+~([^~]+)/);
        return match ? match[1].trim() : "";
      } catch {
        return "";
      }
    };

    let searchTimer = null;
    const onCodeInput = () => {
      form.etfName = "";
      nameError.value = "";
      if (searchTimer) clearTimeout(searchTimer);
      const code = form.etfCode.trim();
      if (!/^\d{6}$/.test(code)) return;
      searchTimer = setTimeout(async () => {
        searchingName.value = true;
        const name = await fetchStockNameByCode(code);
        searchingName.value = false;
        if (name) form.etfName = name;
        else nameError.value = "未识别到名称，可手动填写或直接提交";
      }, 320);
    };

    const loadRecords = async () => {
      if (!store.state.isLoggedIn) return;
      loading.value = true;
      try {
        const res = await chartQueryApi.fetchMyQueries();
        records.value = res.data || res || [];
      } catch (err) {
        store.showToast(err.message || "加载失败", "error");
      } finally {
        loading.value = false;
      }
    };

    const openLogin = () => {
      store.state.authMode = "login";
      store.state.authModalVisible = true;
    };

    const submit = async () => {
      if (!store.state.isLoggedIn) {
        openLogin();
        return;
      }
      const code = form.etfCode.trim().toUpperCase();
      if (!/^\d{6}$/.test(code)) {
        store.showToast("请输入 6 位标的代码", "error");
        return;
      }
      const picked = (form.intervals || []).filter((k) =>
        enabledIntervals.value.includes(k)
      );
      if (!picked.length) {
        store.showToast("请至少选择一种图表类型", "error");
        return;
      }
      const credits = store.state.chartCredits ?? 0;
      if (credits < picked.length) {
        store.showToast(
          `查询次数不足：本次需 ${picked.length} 次，剩余 ${credits} 次`,
          "error"
        );
        window.location.hash = "#/plan?tab=credits";
        return;
      }

      submitLoading.value = true;
      try {
        if (!form.etfName) {
          const n = await fetchStockNameByCode(code);
          if (n) form.etfName = n;
        }
        const res = await chartQueryApi.submit({
          etfCode: code,
          etfName: form.etfName || code,
          intervals: picked,
        });
        if (res.chart_credits != null) {
          store.setChartCredits(res.chart_credits);
        } else if (store.state.chartCredits >= picked.length) {
          store.setChartCredits(store.state.chartCredits - picked.length);
        }
        store.showToast(
          res.message || `已提交 ${picked.length} 项查询`
        );
        form.etfCode = "";
        form.etfName = "";
        // 保留周期多选，方便连续查不同代码
        await loadRecords();
      } catch (err) {
        store.showToast(err.message || "提交失败", "error");
      } finally {
        submitLoading.value = false;
      }
    };

    const statusLabel = (s) => {
      const map = {
        pending: "排队中",
        processing: "生成中",
        done: "已完成",
        failed: "失败已退次",
        cancelled: "已撤回",
      };
      return map[s] || s;
    };

    /** 记录行：完整周期文案（如 最新收盘·日线） */
    const recordIntervalText = (r) => {
      const k = r && r.interval;
      if (!k) return "—";
      return intervalLabel(k);
    };

    /** 相位短标签 */
    const recordPhaseHint = (r) => {
      const k = String((r && r.interval) || "");
      if (k.includes("_next")) return "下一收盘·未结束时段";
      if (
        k.includes("_closed") ||
        k === "half_day" ||
        k === "daily" ||
        k === "weekly"
      )
        return "最新收盘·已结束时段";
      return "";
    };

    const cancellingId = ref(null);

    /** 撤回排队中订单并退次 */
    const cancelQuery = async (row) => {
      if (!row || row.status !== "pending") return;
      const label = recordIntervalText(row);
      if (
        !confirm(
          `确认撤回？\n${row.etf_code} ${row.etf_name || ""}\n${label}\n将退回 1 次查询次数。`
        )
      ) {
        return;
      }
      cancellingId.value = row.id;
      try {
        const res = await chartQueryApi.cancel(row.id);
        if (res.chart_credits != null) store.setChartCredits(res.chart_credits);
        store.showToast(res.message || "已撤回，次数已退回");
        await loadRecords();
      } catch (err) {
        store.showToast(err.message || "撤回失败", "error");
      } finally {
        cancellingId.value = null;
      }
    };

    /**
     * 改单：撤回原单（退次）并把标的/周期填回表单，用户改完后重新「确认查询」
     */
    const editPendingQuery = async (row) => {
      if (!row || row.status !== "pending") return;
      const label = recordIntervalText(row);
      if (
        !confirm(
          `将撤回当前排队单并退回 1 次，\n把「${row.etf_code} / ${label}」填回上方表单供修改后重新提交。\n是否继续？`
        )
      ) {
        return;
      }
      form.etfCode = String(row.etf_code || "").replace(/\D/g, "").slice(-6);
      form.etfName = row.etf_name || "";
      const iv = row.interval || "daily_closed";
      if (enabledIntervals.value.includes(iv)) form.intervals = [iv];
      else if (enabledIntervals.value.length) form.intervals = [enabledIntervals.value[0]];
      cancellingId.value = row.id;
      try {
        const res = await chartQueryApi.cancel(row.id);
        if (res.chart_credits != null) store.setChartCredits(res.chart_credits);
        store.showToast("已撤回并填回表单，请修改后重新确认查询");
        await loadRecords();
        try {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (_) {}
      } catch (err) {
        store.showToast(err.message || "操作失败", "error");
      } finally {
        cancellingId.value = null;
      }
    };


    const formatTime = (ts) => {
      if (!ts) return "-";
      const d = new Date(ts);
      if (isNaN(d.getTime())) return "-";
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    };

    const isExpired = (row) => {
      if (!row.expire_at) return false;
      return Date.now() > Number(row.expire_at);
    };

    /**
     * 查询记录分组展示：
     * - 有 group_id → 同一批多选合并为一张卡片
     * - 否则按 代码+提交时刻(分钟) 宽松合并历史单选记录
     * 卡片内每一行仍是一种周期，可单独撤回/看图
     */
    const recordGroups = computed(() => {
      const list = records.value || [];
      const map = new Map();
      for (const r of list) {
        let key = r.group_id ? `g:${r.group_id}` : null;
        if (!key) {
          const ts = Number(r.created_at) || 0;
          const minute = Math.floor(ts / 60000);
          key = `s:${r.etf_code}|${minute}`;
        }
        if (!map.has(key)) {
          map.set(key, {
            key,
            etf_code: r.etf_code,
            etf_name: r.etf_name,
            created_at: r.created_at,
            items: [],
          });
        }
        const g = map.get(key);
        g.items.push(r);
        if (Number(r.created_at) > Number(g.created_at || 0)) g.created_at = r.created_at;
      }
      return [...map.values()].map((g) => {
        const pending = g.items.filter((x) => x.status === "pending").length;
        const done = g.items.filter((x) => x.status === "done").length;
        const failed = g.items.filter((x) => x.status === "failed").length;
        const cancelled = g.items.filter((x) => x.status === "cancelled").length;
        return { ...g, pending, done, failed, cancelled, total: g.items.length };
      });
    });

    onMounted(() => {
      if (enabledIntervals.value.length) {
        form.intervals = form.intervals.filter((k) => enabledIntervals.value.includes(k));
        if (!form.intervals.length) form.intervals = [enabledIntervals.value[0]];
      }
      loadRecords();
    });


    const probeImage = (url) =>
      new Promise((resolve) => {
        if (!url) return resolve(false);
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url + (url.includes("?") ? "&" : "?") + "t=" + Date.now();
      });

    const ensureViewerNavStyle = () => {
      if (document.getElementById("bofutz-viewer-nav-style")) return;
      const style = document.createElement("style");
      style.id = "bofutz-viewer-nav-style";
      style.textContent = `
        .bofutz-viewer-nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          z-index: 30;
          width: 52px;
          height: 52px;
          border-radius: 999px;
          border: 2.5px solid rgba(255,255,255,0.92);
          background: rgba(15, 23, 42, 0.45);
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 20px rgba(0,0,0,.28);
          -webkit-tap-highlight-color: transparent;
          user-select: none;
          backdrop-filter: blur(6px);
          transition: background .15s ease, transform .15s ease, border-color .15s ease;
          padding: 0;
        }
        .bofutz-viewer-nav:hover {
          background: rgba(15, 23, 42, 0.7);
          border-color: #fff;
        }
        .bofutz-viewer-nav:active { transform: translateY(-50%) scale(0.94); }
        .bofutz-viewer-nav svg {
          width: 22px;
          height: 22px;
          display: block;
          fill: none;
          stroke: currentColor;
          stroke-width: 2.6;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .bofutz-viewer-prev { left: 16px; }
        .bofutz-viewer-next { right: 16px; }
        @media (max-width: 640px) {
          .bofutz-viewer-nav { width: 46px; height: 46px; }
          .bofutz-viewer-nav svg { width: 20px; height: 20px; }
          .bofutz-viewer-prev { left: 8px; }
          .bofutz-viewer-next { right: 8px; }
        }
      `;
      document.head.appendChild(style);
    };

    const showViewerWithMultiImages = (imgList, initialIndex = 0) => {
      if (!imgList || !imgList.length) return;
      const container = document.createElement("div");
      container.style.display = "none";
      imgList.forEach((item) => {
        const img = document.createElement("img");
        img.src = item.url;
        img.alt = item.title || "";
        container.appendChild(img);
      });
      document.body.appendChild(container);
      const isMulti = imgList.length > 1;
      if (window.Viewer) {
        ensureViewerNavStyle();
        let navPrev = null;
        let navNext = null;
        const clearNav = () => {
          try { navPrev && navPrev.remove(); navNext && navNext.remove(); } catch (_) {}
          navPrev = navNext = null;
        };
        const viewer = new window.Viewer(container, {
          hidden: () => {
            clearNav();
            viewer.destroy();
            container.remove();
          },
          title: (image) => image.alt || "",
          navbar: isMulti,
          tooltip: true,
          movable: true,
          zoomable: true,
          rotatable: false,
          scalable: false,
          transition: true,
          keyboard: isMulti,
          loop: isMulti,
          initialViewIndex: Math.min(initialIndex, imgList.length - 1),
          toolbar: {
            zoomIn: 1, zoomOut: 1, oneToOne: 1, reset: 1,
            prev: isMulti ? 1 : 0, play: 0, next: isMulti ? 1 : 0,
            rotateLeft: 0, rotateRight: 0, flipHorizontal: 0, flipVertical: 0,
          },
          ready() {
            if (!isMulti) return;
            const root = (viewer && viewer.viewer) || document.querySelector(".viewer-container");
            if (!root) return;
            if (getComputedStyle(root).position === "static") root.style.position = "relative";
            clearNav();
            navPrev = document.createElement("button");
            navPrev.type = "button";
            navPrev.className = "bofutz-viewer-nav bofutz-viewer-prev";
            navPrev.setAttribute("aria-label", "上一张");
            navPrev.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="15 6 9 12 15 18"></polyline></svg>';
            navPrev.addEventListener("click", (e) => {
              e.preventDefault(); e.stopPropagation();
              try { viewer.prev(true); } catch (_) {}
            });
            navNext = document.createElement("button");
            navNext.type = "button";
            navNext.className = "bofutz-viewer-nav bofutz-viewer-next";
            navNext.setAttribute("aria-label", "下一张");
            navNext.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="9 6 15 12 9 18"></polyline></svg>';
            navNext.addEventListener("click", (e) => {
              e.preventDefault(); e.stopPropagation();
              try { viewer.next(true); } catch (_) {}
            });
            root.appendChild(navPrev);
            root.appendChild(navNext);
          },
        });
        viewer.show();
      } else {
        window.open(imgList[initialIndex]?.url, "_blank");
      }
    };

    /** 半日线在前、日线在后，可翻页浏览全部自主查询成品图 */
    const openChartGallery = async (row) => {
      if (!row || !row.chart_url || isExpired(row)) {
        store.showToast("图表不可用或已过期", "error");
        return;
      }
      const R2 = "https://pub-973330e118204686a625fe51431d4336.r2.dev/charts";
      const order = {
        half_day_closed: 0, half_day_next: 1, half_day: 0,
        daily_closed: 2, daily_next: 3, daily: 2,
        weekly_closed: 4, weekly_next: 5, weekly: 4,
      };
      const done = (records.value || []).filter(
        (r) => r.status === "done" && r.chart_url && !isExpired(r)
      );
      // 按标的去重周期，半日→日线→周线
      const gallery = [];
      const seen = new Set();
      const sorted = [...done].sort((a, b) => {
        const oa = order[a.interval] ?? 9;
        const ob = order[b.interval] ?? 9;
        if (oa !== ob) return oa - ob;
        return String(a.etf_code).localeCompare(String(b.etf_code));
      });
      for (const r of sorted) {
        const iv = r.interval || "daily";
        const key = `${r.etf_code}|${iv}`;
        if (seen.has(key)) continue;
        seen.add(key);
        let url = r.chart_url;
        // 补全半日/日线成对：有日线时尝试半日，有半日时尝试日线
        const label = intervalLabel(iv);
        gallery.push({
          title: `${r.etf_name || r.etf_code} (${r.etf_code}) ${label}`,
          url,
          code: r.etf_code,
          interval: iv,
        });
      }
      // 对每个标的，若只有一种周期，尝试 R2 补另一种（半日优先序已在 sort）
      const codes = [...new Set(gallery.map((g) => g.code))];
      for (const code of codes) {
        for (const [iv, file, lab] of [
          ["half_day", "half_day", "半日线"],
          ["daily", "daily", "日线"],
        ]) {
          const key = `${code}|${iv}`;
          if (seen.has(key)) continue;
          const url = `${R2}/${code}_${file}.png`;
          if (await probeImage(url)) {
            seen.add(key);
            const name =
              gallery.find((g) => g.code === code)?.title?.split(" (")[0] || code;
            gallery.push({
              title: `${name} (${code}) ${lab}`,
              url,
              code,
              interval: iv,
            });
          }
        }
      }
      gallery.sort((a, b) => {
        const oa = order[a.interval] ?? 9;
        const ob = order[b.interval] ?? 9;
        if (oa !== ob) return oa - ob;
        return String(a.code).localeCompare(String(b.code));
      });
      if (!gallery.length) {
        store.showToast("暂无可用图表", "error");
        return;
      }
      let idx = gallery.findIndex(
        (g) => g.url === row.chart_url || (g.code === row.etf_code && g.interval === (row.interval || "daily"))
      );
      if (idx < 0) idx = 0;
      showViewerWithMultiImages(gallery, idx);
    };

    return {
      store: store.state,
      loading,
      submitLoading,
      records,
recordGroups,
      form,
      searchingName,
      nameError,
      batchHours,
      retainDays,
      enabledIntervals,
      intervalGroups,
      intervalLabel,
isIntervalSelected,
      toggleInterval,
      selectedCount,
      selectedLabels,
      nextBatchInfo,
      nextBatchHint,
      onCodeInput,
      submit,
      openLogin,
      loadRecords,
      statusLabel,
      recordIntervalText,
      recordPhaseHint,
      cancellingId,
      cancelQuery,
      editPendingQuery,
      formatTime,
      isExpired,
      openChartGallery,
    };
  },
  template: `
    <div class="max-w-3xl mx-auto space-y-5 select-none">
      <div>
        <h2 class="text-2xl font-bold text-slate-800">自主查询</h2>
        <p class="text-xs text-slate-400 mt-1 leading-relaxed">
          输入任意股票/ETF 代码，选择<strong>最新收盘 / 下一收盘</strong>的半日线、日线或周线，按次消耗查询次数。
          系统按 charts 工作流对齐最近场次；出图约 10～25 分钟（15:35 含监控池更久）。
          当前预计：<strong class="theme-text">{{ nextBatchHint }}</strong>。
          图片约保留 <strong class="text-slate-600">{{ retainDays }}</strong> 个交易日。
        </p>
      </div>

      <!-- 余额条 -->
      <div class="bg-white rounded-xl border border-slate-100 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div class="text-sm">
          <span class="text-slate-500">剩余查询次数</span>
          <span class="text-2xl font-extrabold theme-text ml-2 font-mono">{{ store.chartCredits ?? 0 }}</span>
        </div>
        <a href="#/plan?tab=credits" class="text-xs theme-bg text-white px-4 py-2 rounded-lg font-bold no-underline hover:opacity-90">
          购买次数包
        </a>
      </div>

      <!-- 查询表单 -->
      <div class="bg-white rounded-xl border border-slate-100 p-5 space-y-4 shadow-sm">
        <div class="text-sm font-bold text-slate-700">发起查询</div>
        <div v-if="!store.isLoggedIn" class="text-center py-6 text-sm text-slate-500">
          请先 <button type="button" @click="openLogin" class="theme-text font-bold underline">登录</button> 后再查询
        </div>
        <template v-else>
          <div>
            <label class="text-xs font-bold text-slate-600 mb-1.5 block">标的代码（6 位）</label>
            <input v-model="form.etfCode" @input="onCodeInput" maxlength="6"
                   placeholder="例如：510300"
                   class="w-full border px-3 py-2.5 rounded-lg text-sm font-mono uppercase focus:theme-border outline-none">
            <p v-if="searchingName" class="text-xs text-slate-400 mt-1"><i class="fa-solid fa-spinner animate-spin mr-1"></i>识别名称中…</p>
            <p v-else-if="form.etfName" class="text-xs theme-text mt-1 font-bold"><i class="fa-solid fa-circle-check mr-1"></i>{{ form.etfName }}</p>
            <p v-else-if="nameError" class="text-xs text-amber-600 mt-1">{{ nameError }}</p>
          </div>
          <div>
            <div class="flex items-center justify-between gap-2 mb-2.5">
              <label class="text-xs font-bold text-slate-700">图表类型与收盘相位</label>
              <span class="text-[10px] text-slate-400 hidden sm:inline">可多选，按选中数量扣次</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div v-for="g in intervalGroups" :key="g.title"
                   class="rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50/80 to-white p-3 shadow-sm">
                <div class="flex items-center gap-1.5 mb-2.5">
                  <span class="w-6 h-6 rounded-lg flex items-center justify-center text-[11px]"
                        :class="{
                          'bg-sky-100 text-sky-600': g.tone==='sky',
                          'bg-teal-100 text-teal-700': g.tone==='teal',
                          'bg-violet-100 text-violet-600': g.tone==='violet'
                        }">
                    <i :class="g.icon"></i>
                  </span>
                  <span class="text-xs font-bold text-slate-700">{{ g.title }}</span>
                </div>
                <div class="grid grid-cols-2 gap-1.5">
                  <button type="button" v-for="it in g.items" :key="it.key"
                          @click="toggleInterval(it.key)"
                          class="relative rounded-lg px-2 py-2 text-left transition-all border"
                          :class="isIntervalSelected(it.key)
                            ? 'theme-bg text-white border-transparent shadow-md ring-2 ring-[#4da6a0]/25'
                            : 'bg-white text-slate-600 border-slate-150 hover:border-[#4da6a0]/40 hover:bg-[#4da6a0]/5'">
                    <span v-if="isIntervalSelected(it.key)"
                          class="absolute top-1 right-1 text-[9px] leading-none opacity-90">✓</span>
                    <span class="block text-[11px] font-bold leading-tight">{{ it.short }}</span>
                    <span class="block text-[10px] mt-0.5 leading-tight"
                          :class="isIntervalSelected(it.key) ? 'text-white/85' : 'text-slate-400'">{{ it.desc }}</span>
                  </button>
                </div>
              </div>
            </div>
            <p class="text-[11px] text-slate-400 mt-2.5 leading-relaxed">
              <span class="font-medium text-slate-500">最新收盘</span>对齐已结束时段；
              <span class="font-medium text-slate-500">下一收盘</span>排队等待未结束时段的下场工作流。
              场次：交易日 07:00 / 15:35 / 19:00 / 22:00；周线周六 09:00。
            </p>
            <p v-if="selectedCount" class="text-[11px] text-slate-600 mt-1.5">
              已选 <strong class="theme-text">{{ selectedCount }}</strong> 项：
              <span class="text-slate-500">{{ selectedLabels.join('、') }}</span>
            </p>
            <p v-else class="text-[11px] text-amber-600 mt-1.5">请至少选择一种图表类型</p>
          </div>

          <div class="rounded-xl border border-slate-100 bg-slate-50/90 px-3.5 py-3 flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4">
            <div class="flex items-start gap-2.5 min-w-0 flex-1">
              <span class="mt-0.5 w-8 h-8 rounded-full theme-bg/10 theme-text flex items-center justify-center shrink-0">
                <i class="fa-regular fa-clock text-sm"></i>
              </span>
              <div class="min-w-0 text-xs leading-relaxed">
                <div class="text-slate-700">
                  预计对齐
                  <strong class="theme-text font-mono text-sm mx-0.5">{{ nextBatchInfo.text }}</strong>
                </div>
                <div class="text-slate-500 mt-0.5">{{ nextBatchInfo.detail }}</div>
              </div>
            </div>
            <div class="shrink-0 flex items-center gap-1.5 text-[11px]">
              <span class="px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-600 font-bold">
                ≈{{ nextBatchInfo.etaMin }} 分钟
              </span>
              <span v-if="nextBatchInfo.mode==='all'" class="px-2 py-1 rounded-full bg-amber-50 border border-amber-100 text-amber-700 font-medium">
                含监控池
              </span>
            </div>
          </div>
          <p class="text-[10px] text-slate-400 -mt-1 leading-relaxed">
            15:35 同时更新监控列表与自主查询，通常约 25 分钟；其它场次约 10 分钟。会员增多时耗时会相应延长。失败自动退回 1 次。
          </p>
          <button type="button" @click="submit" :disabled="submitLoading || searchingName || !selectedCount"
                  class="w-full theme-bg text-white py-2.5 rounded-lg text-sm font-bold disabled:opacity-50">
            {{ submitLoading ? '提交中…' : (selectedCount ? '确认查询（消耗 ' + selectedCount + ' 次）' : '请选择图表类型') }}
          </button>
        </template>
      </div>

      <!-- 记录 -->
            <div class="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
        <div class="px-5 py-3.5 border-b border-slate-100 flex justify-between items-center">
          <span class="font-bold text-slate-700 text-sm">查询记录</span>
          <button type="button" @click="loadRecords" class="text-xs text-slate-400 hover:theme-text">
            <i class="fa-solid fa-rotate-right mr-1"></i>刷新
          </button>
        </div>
        <div v-if="!store.isLoggedIn" class="py-10 text-center text-sm text-slate-400">登录后查看记录</div>
        <div v-else-if="loading" class="py-10 text-center text-slate-400">
          <i class="fa-solid fa-spinner animate-spin theme-text"></i>
        </div>
        <div v-else-if="!recordGroups.length" class="py-10 text-center text-sm text-slate-400">暂无记录</div>
        <div v-else class="divide-y divide-slate-50">
          <div v-for="g in recordGroups" :key="g.key" class="px-4 py-3.5 hover:bg-slate-50/50">
            <div class="flex flex-wrap items-start justify-between gap-2 mb-2">
              <div class="min-w-0">
                <div class="font-mono font-bold text-slate-800">{{ g.etf_code }}
                  <span class="text-xs font-sans font-normal text-slate-500 ml-1">{{ g.etf_name || '' }}</span>
                </div>
                <div class="text-[11px] text-slate-400 font-mono mt-0.5">{{ formatTime(g.created_at) }}
                  <span v-if="g.total > 1" class="ml-1 text-slate-500">· 共 {{ g.total }} 项</span>
                </div>
              </div>
              <div class="flex flex-wrap gap-1 text-[10px]">
                <span v-if="g.pending" class="px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-600 font-bold">排队 {{ g.pending }}</span>
                <span v-if="g.done" class="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-bold">完成 {{ g.done }}</span>
                <span v-if="g.failed" class="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">失败 {{ g.failed }}</span>
                <span v-if="g.cancelled" class="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400">撤回 {{ g.cancelled }}</span>
              </div>
            </div>
            <div class="space-y-1.5">
              <div v-for="r in g.items" :key="r.id"
                   class="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-white px-2.5 py-2 text-xs">
                <div class="min-w-[7.5rem] flex-1">
                  <div class="font-bold text-slate-700">{{ recordIntervalText(r) }}</div>
                  <div class="text-[10px] text-slate-400">{{ recordPhaseHint(r) }}</div>
                </div>
                <span class="px-2 py-0.5 rounded-full font-bold shrink-0"
                      :class="{
                        'bg-orange-50 text-orange-600': r.status==='pending' || r.status==='processing',
                        'bg-emerald-50 text-emerald-600': r.status==='done',
                        'bg-slate-100 text-slate-400': r.status==='failed' || r.status==='cancelled'
                      }">{{ statusLabel(r.status) }}</span>
                <span class="text-[10px] font-mono text-slate-400 shrink-0 hidden sm:inline"
                      :class="isExpired(r) ? 'text-red-400' : ''">
                  {{ r.expire_at ? formatTime(r.expire_at) : (r.status==='pending' ? '待出图' : '—') }}
                </span>
                <div class="ml-auto flex items-center gap-2 shrink-0">
                  <button type="button" v-if="r.status==='done' && r.chart_url && !isExpired(r)"
                     @click="openChartGallery(r)"
                     class="theme-text font-bold hover:underline">查看</button>
                  <template v-if="r.status==='pending'">
                    <button type="button" @click="editPendingQuery(r)" :disabled="cancellingId===r.id"
                            class="text-slate-500 hover:theme-text disabled:opacity-50">改单</button>
                    <button type="button" @click="cancelQuery(r)" :disabled="cancellingId===r.id"
                            class="text-rose-500 font-medium disabled:opacity-50">
                      {{ cancellingId===r.id ? '…' : '撤回' }}
                    </button>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p class="text-[11px] text-slate-400 text-center leading-relaxed">
        数据与图表仅供学习观察，不构成投资建议。生成依赖行情与图床任务，偶发失败会自动退次。
      </p>
    </div>
  `,
};
