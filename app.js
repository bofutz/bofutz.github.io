/**
 * 波幅探长 - 主业务逻辑脚本 (app.js)
 */
const { createApp, ref, computed, reactive, onMounted, onUnmounted, watch, nextTick } = Vue;

const API_BASE = "https://vip.hahagw.eu.org";
const MAIL_API_BASE = "https://mail.hahagw2016.workers.dev";
const TURNSTILE_SITEKEY = "0x4AAAAAAEDLWs232Np7X0xa";

createApp({
    setup() {
        const currentRoute = ref(window.location.hash || '#/');
        const menuOpen = ref(false); 
        const userMenuOpen = ref(false);
        const freeEtfCodes = ref([]);

        // V免签随机微浮动金额算法 (如 18.82元)
        const generateFloatingAmount = (basePrice) => {
            const randCents = (Math.floor(Math.random() * 5) + 1) / 100;
            return (basePrice + randCents).toFixed(2);
        };

        const topUpForm = reactive({ planId: 'month', amount: 18.80, floatingAmount: '18.82', txId: '' });
        const selectTopUpPlan = (plan) => { 
            topUpForm.planId = plan.id; 
            topUpForm.amount = plan.price; 
            topUpForm.floatingAmount = generateFloatingAmount(plan.price);
        };

        // 引入在线客服模块逻辑
        const chatModule = typeof useChatModule === 'function' ? useChatModule(Vue) : {};

        // 移动端简洁周标签 (如 7-3周) 与完整周一至周五数据处理
        const getPastWeeks = (etf_code) => {
            if (!selectedMonday.value) return [];
            const pastData = allData.value.filter(item => item.etf_code === etf_code && (item.day_status || item.week_status));
            const weekMap = {};
            pastData.forEach(item => {
                if(!item.date) return;
                const wDays = getWeekDays(item.date);
                if(wDays.length === 0) return;
                const monday = wDays[0];
                if (monday === selectedMonday.value) return; 

                if (!weekMap[monday]) {
                    const m = parseMonth(monday);
                    const fullLabel = getWeekNumberInMonth(monday);
                    const weekNum = fullLabel.replace(/[^0-9一二三四五六]/g, '');
                    weekMap[monday] = {
                        monday: monday, 
                        weekLabel: `${m}月${fullLabel}`, 
                        shortWeekLabel: `${m}-${weekNum}周`,
                        fridayDate: wDays, 
                        days: [null, null, null, null, null], 
                        week_status: null
                    };
                }
                const idx = wDays.indexOf(item.date);
                if(idx !== -1) weekMap[monday].days[idx] = item;
                if (item.week_status && item.week_status !== '-' && item.week_status !== '--') weekMap[monday].week_status = item.week_status;
            });
            return Object.values(weekMap).sort((a, b) => b.monday.localeCompare(a.monday));
        };

        // ...其它登录、注册、图表预览与订单处理逻辑...

        return {
            currentRoute, menuOpen, userMenuOpen, pageTitle, navigate, closeDropdowns,
            isLoggedIn, isVip, username, balance, vipDaysLeft, referralCode, logout,
            authModalVisible, authMode, authForm, authLoading, openAuth, closeAuth, submitAuth, switchAuthMode, sendEmailCode, sendCodeLoading, countdown,
            loading, sortedData, showDropdown, searchQuery, availablePeriods, currentPeriodLabel, selectWeek, selectedMonday, sortColumn, sortOrder, handleSort, currentWeekHeaders, weekStatusHeader,
            expandedRowKey, toggleRow, getPastWeeks, parseDay, parseMonth, parseYear,
            vipPlans, topUpForm, selectTopUpPlan, orderLoading, orderMessage, submitOrder, checkPaymentStatus, showManualInput,
            openChart, getColorClass, selectedOrder, orderList, viewOrder, getPlanName, formatStatus, formatDateExact,
            pwdForm, pwdLoading, submitPasswordChange, ticketModalVisible, ticketForm, ticketsList, ticketLoading, submitTicket, openTicketModal, deleteTicket, clearFinishedTickets,
            freeEtfCodes,
            ...chatModule,
            socialModalVisible, currentSocialPlatform, openSocialModal
        };
    }
}).mount('#app');
