const DashboardModule = {
    template: `
<!-- dashboard.html -->
<div class="flex flex-col sm:flex-row gap-2 sm:gap-3">
    <div class="flex-1 bg-white rounded-xl shadow-sm border border-slate-100 relative">
        <button @click.stop="showDropdown = !showDropdown" class="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 rounded-xl">
            <span><i class="fa-regular fa-calendar mr-2 text-slate-400"></i>{{ currentPeriodLabel || '历史数据加载中...' }}</span>
            <i class="fa-solid fa-chevron-down text-slate-400 text-xs"></i>
        </button>
        <div v-if="showDropdown" @click.stop class="absolute left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-4 w-full sm:w-80">
            <div class="max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
                <div v-for="month in availablePeriods" :key="month.monthKey" class="mb-3 last:mb-0">
                    <div class="text-xs font-bold text-slate-400 mb-2 border-b pb-1">{{ month.monthLabel }}</div>
                    <div class="flex flex-wrap gap-2">
                        <button v-for="week in month.weeks" :key="week.monday" @click="selectWeek(week.monday)"
                            class="px-2.5 py-1 text-xs rounded-lg border transition-all"
                            :class="selectedMonday === week.monday ? 'theme-bg text-white border-transparent' : 'bg-slate-50 text-slate-600 border-slate-200'">
                            {{ week.weekLabel }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="bg-white rounded-xl shadow-sm border border-slate-100 flex items-center sm:w-64">
        <i class="fa-solid fa-magnifying-glass text-slate-400 pl-3"></i>
        <input v-model="searchQuery" type="search" autocomplete="new-password" placeholder="搜索 标的代码/名称..." class="w-full bg-transparent border-none outline-none text-sm py-2.5 px-3">
    </div>
</div>

<div v-if="loading" class="text-center py-12 text-slate-400"><i class="fa-solid fa-spinner animate-spin text-2xl"></i><p class="mt-2 text-sm">读取云端数据中...</p></div>
<div v-else-if="sortedData.length === 0" class="text-center py-12 text-slate-400">
    <i class="fa-solid fa-folder-open text-4xl mb-3 opacity-50"></i><p>该周期暂无相关数据</p>
</div>
<div v-else>
    <!-- 桌面表格 -->
    <div class="hidden sm:block bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div class="overflow-x-auto custom-scrollbar">
            <table class="w-full text-center border-collapse whitespace-nowrap min-w-max">
                <thead class="bg-slate-50 border-b border-slate-100 sticky top-0 z-30">
                    <tr class="text-xs text-slate-600 font-bold select-none">
                        <th class="py-3 px-4 text-left cursor-pointer hover:bg-slate-100 sticky left-0 bg-slate-50 z-40 etf-name-column" @click="handleSort('etf_name')">标的名称</th>
                        <th v-for="idx in 5" :key="idx" class="py-3 px-2 cursor-pointer hover:bg-slate-100" @click="handleSort('d'+(idx-1))">周{{ ['一','二','三','四','五'][idx-1] }}</th>
                        <th class="py-3 px-4 cursor-pointer hover:bg-slate-100" @click="handleSort('week_status')">周线</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-50 text-sm">
                    <template v-for="(item, index) in sortedData" :key="item.etf_code">
                        <tr class="hover:bg-[#4da6a0]/5 transition-colors group cursor-pointer" @click="toggleRow(item)">
                            <td class="p-3 text-left relative sticky left-0 bg-white group-hover:bg-[#f6faf9] z-10 etf-name-column shadow-[1px_0_0_0_#f1f5f9]">
                                <div v-if="freeEtfCodes.includes(item.etf_code)" class="absolute left-0 top-0 bottom-0 w-1 theme-bg"></div>
                                <div class="flex items-center justify-between">
                                    <div class="flex flex-col">
                                        <div class="font-bold text-slate-800 flex items-center group-hover:theme-text">
                                            {{ item.etf_name }}
                                            <span v-if="freeEtfCodes.includes(item.etf_code)" class="text-[9px] bg-orange-100 text-orange-600 px-1 py-0.5 rounded ml-1 font-normal">免费</span>
                                        </div>
                                        <div class="text-[11px] text-slate-400 font-mono">{{ item.etf_code }}</div>
                                    </div>
                                    <i class="fa-solid text-[10px] text-slate-300" :class="expandedRowKey === item.etf_code ? 'fa-chevron-down theme-text' : 'fa-chevron-right'"></i>
                                </div>
                            </td>
                            <td v-for="idx in 5" :key="idx" class="p-3 font-medium" :class="getColorClass(item.days[idx-1]?.day_status)">
                                <div class="flex items-center justify-center gap-1">
                                    <span v-if="item.days[idx-1]?.day_status && item.days[idx-1].day_status !== '-' && item.days[idx-1].day_status !== '--'" :title="getDayTooltip(item.days[idx-1].date)">{{ item.days[idx-1].day_status }}</span>
                                    <span v-else>-</span>
                                    <i v-if="isDailyChartColumn(idx-1)"
                                       class="fa-regular fa-image text-slate-300 chart-icon cursor-pointer text-[12px]"
                                       :title="'日线图表 · ' + getColumnDateLabel(idx-1)"
                                       @click.stop="openChart(item.etf_code, 'daily')"></i>
                                </div>
                            </td>
                            <td class="p-3">
                                <div class="flex items-center justify-center gap-1 font-medium" :class="getColorClass(item.week_status)">
                                    <span v-if="item.week_status && item.week_status !== '-' && item.week_status !== '--'" :title="getWeekTooltip(selectedMonday)">{{ item.week_status }}</span>
                                    <span v-else>-</span>
                                    <i class="fa-regular fa-image text-slate-300 chart-icon cursor-pointer text-[12px]"
                                       :title="'周线图表 · ' + getWeekTooltip(selectedMonday)"
                                       @click.stop="openChart(item.etf_code, 'weekly')"></i>
                                </div>
                            </td>
                        </tr>
                        <template v-if="expandedRowKey === item.etf_code">
                            <tr v-for="week in getPastWeeks(item.etf_code)" :key="week.monday" class="bg-slate-50/80 border-b border-dashed border-slate-100" @click.stop>
                                <td class="p-3 sticky left-0 bg-slate-50/80 z-10 etf-name-column"></td>
                                <td v-for="idx in 5" :key="idx" class="p-3 text-xs" :class="getColorClass(week.days[idx-1]?.day_status)">
                                    <span v-if="week.days[idx-1]?.day_status && week.days[idx-1].day_status !== '-' && week.days[idx-1].day_status !== '--'">{{ week.days[idx-1].day_status }}</span>
                                    <span v-else>-</span>
                                </td>
                                <td class="p-3 text-xs" :class="getColorClass(week.week_status)">
                                    <span v-if="week.week_status && week.week_status !== '-' && week.week_status !== '--'">{{ week.week_status }}</span>
                                    <span v-else>-</span>
                                </td>
                            </tr>
                        </template>
                    </template>
                </tbody>
            </table>
        </div>
    </div>

    <!-- 手机卡片（优化版） -->
    <div class="sm:hidden space-y-2.5">
        <div v-for="item in sortedData" :key="item.etf_code" class="m-card">
            <div class="px-3.5 py-2.5 flex items-center justify-between" @click="toggleRow(item)">
                <div class="flex items-center gap-2 min-w-0 flex-1">
                    <div class="min-w-0">
                        <div class="flex items-center gap-1.5">
                            <span class="text-[15px] font-bold text-slate-800 font-mono">{{ item.etf_code }}</span>
                            <span v-if="freeEtfCodes.includes(item.etf_code)" class="text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full shrink-0">免费</span>
                        </div>
                        <div class="text-[13px] text-slate-500 truncate mt-0.5">{{ item.etf_name }}</div>
                    </div>
                </div>
                <i class="fa-solid text-xs text-slate-300 shrink-0 ml-2" :class="expandedRowKey === item.etf_code ? 'fa-chevron-down theme-text' : 'fa-chevron-right'"></i>
            </div>
            <div class="m-day-grid border-t border-slate-50">
                <div v-for="idx in 5" :key="idx" class="m-day-cell">
                    <div class="text-[10px] text-slate-400 font-medium">周{{ ['一','二','三','四','五'][idx-1] }}</div>
                    <div v-if="item.days[idx-1]?.date" class="text-[9px] text-slate-300 mt-0.5">{{ getMobileDayDate(item.days[idx-1].date) }}</div>
                    <div class="flex items-center justify-center gap-0.5 mt-1">
                        <span class="text-[13px] font-bold leading-none" :class="getMobileStatusClass(item.days[idx-1]?.day_status)">{{ formatMobileStatus(item.days[idx-1]?.day_status) }}</span>
                        <i v-if="isDailyChartColumn(idx-1)"
                           class="fa-regular fa-image text-slate-400 text-[10px] chart-icon"
                           :title="'日线 · ' + getColumnDateLabel(idx-1)"
                           @click.stop="openChart(item.etf_code, 'daily')"></i>
                    </div>
                </div>
                <div class="m-day-cell">
                    <div class="text-[10px] text-slate-500 font-bold">周线</div>
                    <div class="text-[9px] text-slate-400 mt-0.5">{{ getMobileWeekDate(selectedMonday) }}</div>
                    <div class="flex items-center justify-center gap-0.5 mt-1">
                        <span class="text-[13px] font-bold leading-none" :class="getMobileStatusClass(item.week_status)">{{ formatMobileStatus(item.week_status) }}</span>
                        <i class="fa-regular fa-image text-slate-400 text-[10px] chart-icon"
                           :title="'周线 · ' + getWeekTooltip(selectedMonday)"
                           @click.stop="openChart(item.etf_code, 'weekly')"></i>
                    </div>
                </div>
            </div>
            <div v-if="expandedRowKey === item.etf_code" class="border-t border-slate-100 bg-slate-50/60">
                <div v-for="week in getPastWeeks(item.etf_code)" :key="week.monday" class="px-2 py-2 border-b border-slate-100/80 last:border-0">
                    <div class="m-day-grid">
                        <div v-for="idx in 5" :key="idx" class="text-center py-1">
                            <div v-if="week.days[idx-1]?.date" class="text-[9px] text-slate-400">{{ getMobileDayDate(week.days[idx-1].date) }}</div>
                            <div class="text-[12px] font-bold mt-0.5" :class="getMobileStatusClass(week.days[idx-1]?.day_status)">{{ formatMobileStatus(week.days[idx-1]?.day_status) }}</div>
                        </div>
                        <div class="text-center py-1 bg-[#4da6a0]/10 rounded-md">
                            <div class="text-[9px] text-slate-400">{{ getMobileWeekDate(week.monday) }}</div>
                            <div class="text-[12px] font-bold mt-0.5" :class="getMobileStatusClass(week.week_status)">{{ formatMobileStatus(week.week_status) }}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
`
};
