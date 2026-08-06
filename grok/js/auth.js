/**
 * 前台登录态读写
 */
import { ref } from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";

export const isLoggedIn = ref(false);
export const isVip = ref(false);
export const username = ref("");
export const vipDaysLeft = ref(0);
export const referralCode = ref("");

export function checkLoginState() {
  try {
    if (localStorage.getItem("etf_token")) {
      isLoggedIn.value = true;
      username.value = localStorage.getItem("etf_username") || "";
      referralCode.value = localStorage.getItem("etf_ref") || "";
      vipDaysLeft.value = parseInt(localStorage.getItem("etf_vip_days")) || 0;
      isVip.value = vipDaysLeft.value > 0;
    } else {
      isLoggedIn.value = false;
      isVip.value = false; 
      username.value = "";
      referralCode.value = "";
      vipDaysLeft.value = 0;
    }
  } catch (_) {}
}

export function setLoginState({ token, username: u, referral_code, shared_vip_days }) {
  localStorage.setItem("etf_token", token);
  localStorage.setItem("etf_username", u || "");
  localStorage.setItem("etf_ref", referral_code || "");
  localStorage.setItem("etf_vip_days", shared_vip_days ?? 0);
  checkLoginState();
}

export function clearLoginState() {
  try {
    localStorage.clear();
  } catch (_) {}
  isLoggedIn.value = false;
  isVip.value = false;
  username.value = "";
  referralCode.value = "";
  vipDaysLeft.value = 0;
}

export function updateVipDays(days) {
  vipDaysLeft.value = days;
  isVip.value = days > 0;
  localStorage.setItem("etf_vip_days", days);
}
