/**
 * 后台 - 赞助标的列表
 * 与前台「我的赞助 / 公共池」字段一一映射：代码、名称、周期、到期、剩余、状态
 */
import { store } from "../../store.js";
import { adminApi } from "../../api/admin.js";

const { ref, onMounted } = Vue;

export default {
  name: "SponsorMgmt",
  setup() {
    const list = ref([]);
    const loading = ref(false);
    const statusFilter = ref("active");

    const load = async () => {
      loading.value = true;
      try {
        const res = await adminApi.fetchSponsors(statusFilter.value === "all" ? "" : statusFilter.value);
        list.value = res.data || [];
      } catch (e) {
        store.showToast(e.message || "加载失败", "error");
      } finally {
        loading.value = false;
      }
    };

    const forceExpire = async (row) => {
      if (!confirm(`强制下线 ${row.etf_code}？`)) return;
      const pwd = prompt("请输入管理密码确认：");
      if (!pwd) return;
      try {
        await adminApi.forceExpireSponsor(row.id, pwd.trim());
        store.showToast("已下线");
        await load();
      } catch (e) {
        store.showToast(e.message || "失败", "error");
      }
    };

    const formatTime = (ts) => {
      if (!ts) return "-";
      const d = new Date(Number(ts));
      if (isNaN(d.getTime())) return "-";
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
    };

    const remainDays = (row) => {
      if (!row?.expire_at) return 0;
      const left = Number(row.expire_at) - Date.now();
      if (left <= 0) return 0;
      return Math.ceil(left / 86400000);
    };

    const remainText = (row) => {
      if (row.status !== "active" || Number(row.expire_at) <= Date.now()) return "已过期";
      const d = remainDays(row);
      if (d <= 0) return "即将到期";
      return `剩余 ${d} 天`;
    };

    onMounted(load);

    return { list, loading, statusFilter, load, forceExpire, formatTime, remainDays, remainText };
  },
  template: `
    <div class="space-y-4">
      <div class="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 class="text-xl font-bold text-slate-800">赞助标的</h2>
          <p class="text-xs text-slate-400 mt-0.5">会员购买并审核通过后进入公共监控池 · 全体注册用户可见</p>
        </div>
        <div class="flex gap-2">
          <select v-model="statusFilter" @change="load" class="border rounded-lg px-2 py-1.5 text-xs">
            <option value="active">有效中</option>
            <option value="expired">已过期</option>
            <option value="all">全部</option>
          </select>
          <button @click="load" class="bg-white border px-3 py-1.5 rounded-lg text-sm">
            <i class="fa-solid fa-rotate-right" :class="{'animate-spin': loading}"></i>
          </button>
        </div>
      </div>
      <div class="bg-white rounded-xl border overflow-hidden">
        <div v-if="loading" class="py-12 text-center text-slate-400">加载中…</div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm text-left whitespace-nowrap">
            <thead class="bg-slate-50 text-xs text-slate-500 border-b">
              <tr>
                <th class="py-2.5 px-3">用户</th>
                <th class="py-2.5 px-3">代码</th>
                <th class="py-2.5 px-3">名称</th>
                <th class="py-2.5 px-3">购买周期</th>
                <th class="py-2.5 px-3">到期日</th>
                <th class="py-2.5 px-3">剩余时间</th>
                <th class="py-2.5 px-3">点赞</th>
                <th class="py-2.5 px-3">状态</th>
                <th class="py-2.5 px-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="r in list" :key="r.id" class="hover:bg-slate-50">
                <td class="py-2.5 px-3">{{ r.username || r.user_id }}</td>
                <td class="py-2.5 px-3 font-mono font-bold">{{ r.etf_code }}</td>
                <td class="py-2.5 px-3">{{ r.etf_name }}</td>
                <td class="py-2.5 px-3 text-xs font-bold">{{ r.days || '-' }} 天</td>
                <td class="py-2.5 px-3 text-xs font-mono text-slate-400">{{ formatTime(r.expire_at) }}</td>
                <td class="py-2.5 px-3 text-xs font-bold"
                    :class="r.status==='active' && remainDays(r)>0 ? (remainDays(r)<=7?'text-amber-600':'text-emerald-600') : 'text-slate-400'">
                  {{ remainText(r) }}
                </td>
                <td class="py-2.5 px-3 font-mono">{{ r.like_count || 0 }}</td>
                <td class="py-2.5 px-3 text-xs">{{ r.status }}</td>
                <td class="py-2.5 px-3 text-right">
                  <button v-if="r.status==='active'" @click="forceExpire(r)" class="text-xs text-red-500">强制下线</button>
                </td>
              </tr>
              <tr v-if="!list.length">
                <td colspan="9" class="py-10 text-center text-slate-400">暂无记录</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
};
