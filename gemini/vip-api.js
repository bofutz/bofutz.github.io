/**
 * 波幅探长 VIP API - Cloudflare Worker (整份最新版)
 * 已适配：
 * 1. 按购买分类发货 (买通用充通用 VIP，买定制激活定制监控)
 * 2. 优惠码后台开关控制 (promo_enabled)
 * 3. 监控投票榜单与后台管理
 */

const generateRandomString = (length) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
};

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Admin-Secret",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getAdminSecret(env) {
  return env.ADMIN_SECRET || "";
}

function getTgConfig(env) {
  return {
    token: env.TG_BOT_TOKEN || env.TG_CS_BOT_TOKEN || "",
    chatId: env.TG_ADMIN_CHAT_ID || env.TG_CS_CHAT_ID || "",
  };
}

async function sendToTelegram(env, method, body) {
  const { token } = getTgConfig(env);
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (_) {
    return null;
  }
}

function isEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

async function authenticateUser(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.split(" ");
  if (!token) return null;
  const session = await env.DB.prepare(
    "SELECT user_id FROM sessions WHERE token = ? AND expire_at > ?"
  ).bind(token, Date.now()).first();
  return session ? session.user_id : null;
}

function checkAdmin(request, env) {
  const secret = request.headers.get("Admin-Secret");
  const admin = getAdminSecret(env);
  return admin && secret === admin;
}

async function initTables(env) {
  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password_hash TEXT,
        vip_expire_at INTEGER,
        referral_code TEXT,
        referred_by TEXT,
        created_at INTEGER,
        ip_address TEXT,
        vip_days_left INTEGER DEFAULT 0,
        balance REAL DEFAULT 0,
        shared_vip_days INTEGER DEFAULT 0
      );
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER,
        expire_at INTEGER
      );
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        plan_id TEXT,
        amount REAL,
        original_amount REAL,
        tx_id_last6 TEXT,
        status TEXT DEFAULT 'pending',
        order_type TEXT DEFAULT 'vip',
        symbol_count INTEGER DEFAULT 1,
        promo_code TEXT,
        register_username TEXT,
        register_password_hash TEXT,
        created_at INTEGER,
        approved_at INTEGER,
        vip_days_granted INTEGER DEFAULT 0
      );
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS vip_plans (
        id TEXT PRIMARY KEY,
        name TEXT,
        price REAL,
        days INTEGER,
        tag TEXT,
        sort_order INTEGER DEFAULT 0,
        enabled INTEGER DEFAULT 1,
        plan_type TEXT DEFAULT 'both',
        created_at INTEGER
      );
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS promo_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE,
        name TEXT,
        discount_type TEXT DEFAULT 'percent',
        discount_value REAL,
        start_at INTEGER,
        end_at INTEGER,
        enabled INTEGER DEFAULT 1,
        created_at INTEGER
      );
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS watchlist_shared (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        etf_code TEXT UNIQUE,
        etf_name TEXT,
        sort_order INTEGER DEFAULT 0,
        enabled INTEGER DEFAULT 1,
        created_at INTEGER,
        updated_at INTEGER
      );
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS watchlist_custom (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        etf_code TEXT,
        etf_name TEXT,
        status TEXT DEFAULT 'pending',
        start_at INTEGER,
        expire_at INTEGER,
        created_at INTEGER,
        updated_at INTEGER
      );
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        subject TEXT,
        level TEXT DEFAULT 'medium',
        message TEXT,
        status TEXT DEFAULT 'pending',
        admin_reply TEXT,
        created_at INTEGER
      );
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        content TEXT,
        created_at INTEGER,
        created_by TEXT
      );
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS vote_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        etf_code TEXT,
        etf_name TEXT,
        month_key TEXT,
        created_at INTEGER
      );
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at INTEGER
      );
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS etf_charts (
        code TEXT PRIMARY KEY,
        chart_url TEXT,
        updated_at INTEGER
      );
    `).run();
  } catch (e) {
    console.error("Init tables error:", e);
  }
}

async function getSetting(env, key, fallback = null) {
  try {
    const row = await env.DB.prepare("SELECT value FROM system_settings WHERE key = ?").bind(key).first();
    return row ? row.value : fallback;
  } catch (_) {
    return fallback;
  }
}

async function getSettingInt(env, key, fallback = 0) {
  const v = await getSetting(env, key, String(fallback));
  const n = parseInt(v, 10);
  return isNaN(n) ? fallback : n;
}

function getSharedVipDays(user) {
  if (!user) return 0;
  if (user.shared_vip_days != null && user.shared_vip_days > 0) return user.shared_vip_days;
  return user.vip_days_left || 0;
}

// 订单核算发货逻辑
async function approveOrderCore(env, order, opts = {}) {
  const now = Date.now();
  let targetUserId = opts.user_id || order.user_id;
  const plan = await env.DB.prepare("SELECT * FROM vip_plans WHERE id=?").bind(order.plan_id).first();
  let days = parseInt(opts.add_days, 10);
  if (isNaN(days) || days <= 0) days = plan?.days || 30;

  const isCustomOrder = order.order_type === "custom_watchlist";

  if (!targetUserId && order.register_username && order.register_password_hash) {
    const exists = await env.DB.prepare("SELECT id FROM users WHERE username=?").bind(order.register_username).first();
    if (exists) {
      targetUserId = exists.id;
    } else {
      const regDays = await getSettingInt(env, "gift_register_days", 1);
      const myRef = generateRandomString(8).toUpperCase();
      const ins = await env.DB.prepare(
        `INSERT INTO users (username, password_hash, vip_expire_at, referral_code, created_at, ip_address, vip_days_left, balance, shared_vip_days)
         VALUES (?, ?, 0, ?, ?, 'pay_register', ?, 0, ?)`
      ).bind(order.register_username, order.register_password_hash, myRef, now, regDays, regDays).run();
      targetUserId = ins?.meta?.last_row_id;
    }
    await env.DB.prepare("UPDATE orders SET user_id=? WHERE id=?").bind(targetUserId, order.id).run();
  }

  if (!targetUserId) throw new Error("订单无关联用户且无法注册");

  await env.DB.prepare(
    "UPDATE orders SET status='approved', approved_at=?, vip_days_granted=? WHERE id=?"
  ).bind(now, days, order.id).run();

  if (!isCustomOrder) {
    await env.DB.prepare(
      `UPDATE users SET
        shared_vip_days = COALESCE(shared_vip_days, 0) + ?,
        vip_days_left = COALESCE(vip_days_left, 0) + ?
       WHERE id=?`
    ).bind(days, days, targetUserId).run();
  } else {
    const expireAt = now + days * 86400000;
    await env.DB.prepare(
      `UPDATE watchlist_custom SET status='active', start_at=?, expire_at=?, order_id=?, updated_at=?
       WHERE user_id=? AND status='pending'`
    ).bind(now, expireAt, order.id, now, targetUserId).run();
  }

  return { targetUserId, days };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    await initTables(env);
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/api/settings/public" && request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT key, value FROM system_settings").all();
        const map = {};
        (results || []).forEach((r) => { map[r.key] = r.value; });
        return json({
          success: true,
          data: {
            gift_register_days: map.gift_register_days || "1",
            gift_inviter_days: map.gift_inviter_days || "3",
            gift_invitee_days: map.gift_invitee_days || "2",
            free_top_n_charts: map.free_top_n_charts || "3",
            pay_register_enabled: map.pay_register_enabled || "1",
            promo_enabled: map.promo_enabled || "1",
            alipay_qr_url: map.alipay_qr_url || "",
            wechat_qr_url: map.wechat_qr_url || "",
            default_pay_channel: map.default_pay_channel || "alipay",
            custom_max_symbols: map.custom_max_symbols || "3",
            vote_monthly_limit: map.vote_monthly_limit || "10",
            ...map,
          },
        });
      }

      if (path === "/api/register" && request.method === "POST") {
        const { username, password, ref_code } = await request.json();
        if (!username || !password) return json({ error: "账号或密码不能为空" }, 400);
        if (!isEmail(username)) return json({ error: "请输入有效的电子邮箱" }, 400);
        if (String(password).length < 6) return json({ error: "密码至少需要 6 位" }, 400);

        const existing = await env.DB.prepare("SELECT id FROM users WHERE username=?").bind(username.trim()).first();
        if (existing) return json({ error: "该账号已被注册" }, 400);

        const regDays = await getSettingInt(env, "gift_register_days", 1);
        const inviterDays = await getSettingInt(env, "gift_inviter_days", 3);
        const inviteeDays = await getSettingInt(env, "gift_invitee_days", 2);
        let myShared = regDays;
        const myReferralCode = generateRandomString(8).toUpperCase();
        let referredBy = null;

        if (ref_code) {
          const inviter = await env.DB.prepare("SELECT id FROM users WHERE referral_code=?").bind(String(ref_code).trim().toUpperCase()).first();
          if (inviter) {
            referredBy = String(ref_code).trim().toUpperCase();
            myShared += inviteeDays;
            await env.DB.prepare(
              `UPDATE users SET shared_vip_days = COALESCE(shared_vip_days,0) + ?, vip_days_left = COALESCE(vip_days_left,0) + ? WHERE id=?`
            ).bind(inviterDays, inviterDays, inviter.id).run();
          }
        }

        const hashedPassword = await hashPassword(password);
        await env.DB.prepare(
          `INSERT INTO users (username, password_hash, vip_expire_at, referral_code, referred_by, created_at, ip_address, vip_days_left, balance, shared_vip_days)
           VALUES (?, ?, 0, ?, ?, ?, 'online', ?, 0, ?)`
        ).bind(username.trim(), hashedPassword, myReferralCode, referredBy, Date.now(), myShared, myShared).run();

        return json({ success: true, message: "注册成功", vip_days_gift: myShared });
      }

      if (path === "/api/login" && request.method === "POST") {
        const { username, password } = await request.json();
        const hashedPassword = await hashPassword(password);
        const user = await env.DB.prepare(
          "SELECT id, vip_days_left, shared_vip_days, referral_code FROM users WHERE username=? AND password_hash=?"
        ).bind(username, hashedPassword).first();
        if (!user) return json({ error: "账号或密码错误" }, 401);

        const sharedDays = getSharedVipDays(user);
        const token = generateRandomString(32);
        await env.DB.prepare("INSERT INTO sessions (token, user_id, expire_at) VALUES (?,?,?)")
          .bind(token, user.id, Date.now() + 30 * 86400000).run();

        return json({
          success: true,
          token,
          is_vip: sharedDays > 0,
          vip_days_left: sharedDays,
          shared_vip_days: sharedDays,
          referral_code: user.referral_code,
        });
      }

      if (path === "/api/etfs" && request.method === "GET") {
        const userId = await authenticateUser(request, env);
        let isVip = false;
        let sharedDays = 0;
        if (userId) {
          const user = await env.DB.prepare("SELECT vip_days_left, shared_vip_days FROM users WHERE id=?").bind(userId).first();
          sharedDays = getSharedVipDays(user);
          isVip = sharedDays > 0;
        }
        const { results } = await env.DB.prepare("SELECT code, chart_url, updated_at FROM etf_charts").all();
        const chartsData = {};
        let maxUpdated = 0;
        for (const row of results || []) {
          chartsData[row.code] = isVip ? row.chart_url : null;
          const t = Number(row.updated_at) || 0;
          if (t > maxUpdated) maxUpdated = t;
        }
        let chart_as_of = null;
        if (maxUpdated > 0) {
          const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" });
          chart_as_of = fmt.format(new Date(maxUpdated));
        }
        return json({ is_vip: isVip, shared_vip_days: sharedDays, charts: chartsData, chart_as_of });
      }

      if (path === "/api/watchlist/shared" && request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM watchlist_shared WHERE enabled=1 ORDER BY sort_order ASC, id ASC").all();
        return json({ success: true, data: results || [] });
      }

      if (path === "/api/plans" && request.method === "GET") {
        const type = url.searchParams.get("type");
        let sql = "SELECT * FROM vip_plans WHERE enabled=1";
        const binds = [];
        if (type && ["shared", "custom", "both"].includes(type)) {
          sql += " AND (plan_type=? OR plan_type='both' OR plan_type IS NULL)";
          binds.push(type);
        }
        sql += " ORDER BY sort_order ASC";
        const stmt = env.DB.prepare(sql);
        const { results } = binds.length ? await stmt.bind(...binds).all() : await stmt.all();
        return json({ success: true, data: results || [] });
      }

      if (path === "/api/promo/check" && request.method === "POST") {
        const promoEnabled = await getSetting(env, "promo_enabled", "1");
        if (promoEnabled === "0" || promoEnabled === "false") {
          return json({ success: false, error: "优惠码功能未开启" }, 400);
        }

        const { plan_id, promo_code } = await request.json();
        if (!plan_id) return json({ error: "缺少 plan_id" }, 400);
        const plan = await env.DB.prepare("SELECT * FROM vip_plans WHERE id=? AND enabled=1").bind(plan_id).first();
        if (!plan) return json({ error: "套餐不存在" }, 404);

        const basePrice = Number(plan.price);
        let amount = basePrice;
        if (promo_code) {
          const promo = await env.DB.prepare("SELECT * FROM promo_codes WHERE UPPER(code)=? AND enabled=1").bind(String(promo_code).toUpperCase()).first();
          if (promo) {
            if (promo.discount_type === "percent") {
              amount = Math.max(0.01, basePrice * (1 - Number(promo.discount_value) / 100));
            } else {
              amount = Math.max(0.01, basePrice - Number(promo.discount_value));
            }
          }
        }
        amount = Math.round(amount * 100) / 100;
        return json({ success: true, amount, original_amount: basePrice });
      }

      if (path === "/api/orders" && request.method === "POST") {
        const body = await request.json();
        const { plan_id, amount, tx_id_last6, promo_code, order_type, register_username, register_password } = body;

        if (!plan_id || !tx_id_last6) return json({ error: "参数不完整" }, 400);
        if (!/^\d{6}$/.test(String(tx_id_last6))) return json({ error: "凭证须为6位数字" }, 400);

        const plan = await env.DB.prepare("SELECT * FROM vip_plans WHERE id=? AND enabled=1").bind(plan_id).first();
        if (!plan) return json({ error: "套餐不存在" }, 404);

        let userId = await authenticateUser(request, env);
        const isCustom = order_type === "custom_watchlist";

        let registerHash = null;
        let regName = null;
        if (!userId) {
          if (!register_username || !register_password) return json({ error: "未登录请填写账号和密码" }, 400);
          regName = String(register_username).trim();
          const exists = await env.DB.prepare("SELECT id FROM users WHERE username=?").bind(regName).first();
          if (exists) return json({ error: "账号已存在，请直接登录" }, 400);
          registerHash = await hashPassword(register_password);
        }

        const now = Date.now();
        const ins = await env.DB.prepare(
          `INSERT INTO orders (user_id, plan_id, amount, original_amount, tx_id_last6, status, order_type, symbol_count, promo_code, register_username, register_password_hash, created_at)
           VALUES (?,?,?,?,?,'pending',?,1,?,?,?,?)`
        ).bind(userId || null, plan_id, Number(amount) || plan.price, plan.price, String(tx_id_last6), isCustom ? "custom_watchlist" : "vip", promo_code ? String(promo_code).toUpperCase() : null, regName, registerHash, now).run();

        return json({ success: true, message: "订单提交成功", order_id: ins?.meta?.last_row_id });
      }

      if (path === "/api/user/orders" && request.method === "GET") {
        const userId = await authenticateUser(request, env);
        if (!userId) return json({ error: "未登录" }, 401);
        const { results } = await env.DB.prepare("SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 100").bind(userId).all();
        return json({ success: true, data: results || [] });
      }

      if (path === "/api/user/invitees" && request.method === "GET") {
        const userId = await authenticateUser(request, env);
        if (!userId) return json({ error: "未登录" }, 401);
        const me = await env.DB.prepare("SELECT referral_code FROM users WHERE id=?").bind(userId).first();
        if (!me?.referral_code) return json({ success: true, data: [] });
        const { results } = await env.DB.prepare("SELECT id, username, created_at, shared_vip_days, vip_days_left FROM users WHERE referred_by=? ORDER BY created_at DESC").bind(me.referral_code).all();
        return json({ success: true, data: results || [] });
      }

      if (path === "/api/user/watchlist/custom" && request.method === "GET") {
        const userId = await authenticateUser(request, env);
        if (!userId) return json({ error: "未登录" }, 401);
        const { results } = await env.DB.prepare("SELECT * FROM watchlist_custom WHERE user_id=? ORDER BY created_at DESC").bind(userId).all();
        return json({ success: true, data: results || [] });
      }

      if (path === "/api/vote/rankings" && request.method === "GET") {
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const q = url.searchParams.get("q") || "";

        let sql = `SELECT etf_code, etf_name, COUNT(*) as vote_count FROM vote_records WHERE month_key=?`;
        const binds = [monthKey];
        if (q) {
          sql += ` AND (etf_code LIKE ? OR etf_name LIKE ?)`;
          binds.push(`%${q}%`, `%${q}%`);
        }
        sql += ` GROUP BY etf_code ORDER BY vote_count DESC LIMIT 100`;

        const { results } = await env.DB.prepare(sql).bind(...binds).all();
        const total = (results || []).reduce((acc, cur) => acc + cur.vote_count, 0) || 1;
        const data = (results || []).map((r) => ({
          ...r,
          percentage: ((r.vote_count / total) * 100).toFixed(1),
        }));

        return json({ success: true, data });
      }

      if (path === "/api/vote/my-status" && request.method === "GET") {
        const userId = await authenticateUser(request, env);
        if (!userId) return json({ error: "未登录" }, 401);

        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const user = await env.DB.prepare("SELECT shared_vip_days, vip_days_left FROM users WHERE id=?").bind(userId).first();
        const hasQualified = (user?.shared_vip_days || user?.vip_days_left || 0) > 0;

        const { results: myVotes } = await env.DB.prepare("SELECT id, etf_code, etf_name, created_at FROM vote_records WHERE user_id=? AND month_key=?").bind(userId, monthKey).all();
        const limit = await getSettingInt(env, "vote_monthly_limit", 10);
        const used = (myVotes || []).length;

        return json({
          success: true,
          has_qualified: hasQualified,
          monthly_limit: limit,
          votes_used: used,
          votes_remaining: Math.max(0, limit - used),
          my_votes: myVotes || [],
        });
      }

      if (path === "/api/vote/submit" && request.method === "POST") {
        const userId = await authenticateUser(request, env);
        if (!userId) return json({ error: "未登录" }, 401);

        const { etf_code, etf_name } = await request.json();
        if (!etf_code) return json({ error: "缺少标的代码" }, 400);

        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const limit = await getSettingInt(env, "vote_monthly_limit", 10);

        const count = await env.DB.prepare("SELECT COUNT(*) as c FROM vote_records WHERE user_id=? AND month_key=?").bind(userId, monthKey).first();
        if (count && count.c >= limit) {
          return json({ error: `您本月投票额度已满 (上限 ${limit} 只)` }, 400);
        }

        await env.DB.prepare("INSERT INTO vote_records (user_id, etf_code, etf_name, month_key, created_at) VALUES (?, ?, ?, ?, ?)").bind(userId, etf_code.trim().toUpperCase(), etf_name || etf_code, monthKey, Date.now()).run();
        return json({ success: true, message: "投票成功" });
      }

      if (path === "/api/tickets" && request.method === "GET") {
        const userId = await authenticateUser(request, env);
        if (!userId) return json({ error: "未登录" }, 401);
        const { results } = await env.DB.prepare("SELECT * FROM tickets WHERE user_id=? ORDER BY created_at DESC LIMIT 50").bind(userId).all();
        return json({ success: true, data: results || [] });
      }

      if (path === "/api/tickets" && request.method === "POST") {
        const userId = await authenticateUser(request, env);
        if (!userId) return json({ error: "未登录" }, 401);
        const { subject, level, message } = await request.json();
        if (!subject || !message) return json({ error: "请填写完整的主题和内容" }, 400);

        await env.DB.prepare("INSERT INTO tickets (user_id, subject, level, message, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)")
          .bind(userId, subject.trim(), level || "medium", message.trim(), Date.now()).run();
        return json({ success: true, message: "工单提交成功" });
      }

      if (path === "/api/announcements" && request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM announcements ORDER BY created_at DESC LIMIT 30").all();
        return json({ success: true, data: results || [] });
      }

      // ==================== 管理后台 API (/api/admin/*) ====================

      if (path.startsWith("/api/admin/")) {
        if (!checkAdmin(request, env)) return json({ error: "管理员鉴权失败" }, 401);

        if (path === "/api/admin/stats" && request.method === "GET") {
          const users = await env.DB.prepare("SELECT COUNT(*) as c FROM users").first();
          const vip = await env.DB.prepare("SELECT COUNT(*) as c FROM users WHERE COALESCE(shared_vip_days, vip_days_left, 0) > 0").first();
          const pending = await env.DB.prepare("SELECT COUNT(*) as c FROM orders WHERE status='pending'").first();
          const approved = await env.DB.prepare("SELECT COUNT(*) as c FROM orders WHERE status='approved'").first();
          const revenue = await env.DB.prepare("SELECT COALESCE(SUM(amount),0) as s FROM orders WHERE status='approved'").first();
          const sharedCnt = await env.DB.prepare("SELECT COUNT(*) as c FROM watchlist_shared WHERE enabled=1").first();
          const customActive = await env.DB.prepare("SELECT COUNT(*) as c FROM watchlist_custom WHERE status='active'").first();
          const ticketsPending = await env.DB.prepare("SELECT COUNT(*) as c FROM tickets WHERE status='pending'").first();
          const weekAgo = Date.now() - 7 * 86400000;
          const newUsers = await env.DB.prepare("SELECT COUNT(*) as c FROM users WHERE created_at>?").bind(weekAgo).first();
          const rev7 = await env.DB.prepare("SELECT COALESCE(SUM(amount),0) as s FROM orders WHERE status='approved' AND created_at>?").bind(weekAgo).first();

          return json({
            success: true,
            data: {
              users: users?.c || 0,
              vip_users: vip?.c || 0,
              orders_pending: pending?.c || 0,
              orders_approved: approved?.c || 0,
              revenue: revenue?.s || 0,
              shared_count: sharedCnt?.c || 0,
              custom_active: customActive?.c || 0,
              tickets_pending: ticketsPending?.c || 0,
              new_users_7d: newUsers?.c || 0,
              revenue_7d: rev7?.s || 0,
            },
          });
        }

        if (path === "/api/admin/users" && request.method === "GET") {
          const { results } = await env.DB.prepare("SELECT id, username, created_at, ip_address as ip, shared_vip_days, vip_days_left, referral_code, referred_by FROM users ORDER BY id DESC LIMIT 500").all();
          return json({ success: true, data: results || [] });
        }

        if (path === "/api/admin/users/charge" && request.method === "POST") {
          const { user_id, add_days, set_days } = await request.json();
          if (!user_id) return json({ error: "缺少 user_id" }, 400);
          if (set_days != null && set_days !== "") {
            const v = Math.max(0, parseInt(set_days, 10) || 0);
            await env.DB.prepare("UPDATE users SET shared_vip_days=?, vip_days_left=? WHERE id=?").bind(v, v, user_id).run();
          } else {
            const days = parseInt(add_days, 10);
            if (isNaN(days) || days === 0) return json({ error: "请提供有效天数" }, 400);
            await env.DB.prepare("UPDATE users SET shared_vip_days = MAX(0, COALESCE(shared_vip_days,0) + ?), vip_days_left = MAX(0, COALESCE(vip_days_left,0) + ?) WHERE id=?").bind(days, days, user_id).run();
          }
          return json({ success: true, message: "VIP 天数已更新" });
        }

        if (path === "/api/admin/users/batch_charge" && request.method === "POST") {
          const { user_ids, add_days } = await request.json();
          const days = parseInt(add_days, 10);
          if (!Array.isArray(user_ids) || !user_ids.length || isNaN(days) || days === 0) return json({ error: "参数无效" }, 400);
          const stmts = user_ids.map((id) => env.DB.prepare("UPDATE users SET shared_vip_days = MAX(0, COALESCE(shared_vip_days,0) + ?), vip_days_left = MAX(0, COALESCE(vip_days_left,0) + ?) WHERE id=?").bind(days, days, id));
          await env.DB.batch(stmts);
          return json({ success: true, message: `已为 ${user_ids.length} 人调整 ${days} 天` });
        }

        if (path === "/api/admin/users/reset_password" && request.method === "POST") {
          const { user_id, admin_confirm } = await request.json();
          if (admin_confirm !== getAdminSecret(env)) return json({ error: "管理密钥错误" }, 403);
          const defaultHash = await hashPassword("bofutz");
          await env.DB.prepare("UPDATE users SET password_hash=? WHERE id=?").bind(defaultHash, user_id).run();
          return json({ success: true, message: "密码已成功重置为 bofutz" });
        }

        if (path === "/api/admin/users" && request.method === "DELETE") {
          const { user_id, admin_confirm } = await request.json();
          if (admin_confirm !== getAdminSecret(env)) return json({ error: "管理密钥错误" }, 403);
          await env.DB.prepare("DELETE FROM users WHERE id=?").bind(user_id).run();
          await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(user_id).run();
          return json({ success: true, message: "用户已删除" });
        }

        if (path === "/api/admin/orders" && request.method === "GET") {
          const status = url.searchParams.get("status");
          let sql = `SELECT orders.*, users.username FROM orders LEFT JOIN users ON orders.user_id = users.id`;
          const binds = [];
          if (status && ["pending", "approved", "cancelled"].includes(status)) {
            sql += " WHERE orders.status=?";
            binds.push(status);
          }
          sql += " ORDER BY orders.created_at DESC LIMIT 300";
          const stmt = env.DB.prepare(sql);
          const { results } = binds.length ? await stmt.bind(...binds).all() : await stmt.all();
          return json({ success: true, data: results || [] });
        }

        if (path === "/api/admin/orders/approve" && request.method === "POST") {
          const { order_id, user_id, add_days } = await request.json();
          const order = await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(order_id).first();
          if (!order) return json({ error: "订单不存在" }, 404);
          if (order.status !== "pending") return json({ error: "订单已处理" }, 400);

          await approveOrderCore(env, order, { user_id, add_days });
          return json({ success: true, message: "订单已审核通过" });
        }

        if (path === "/api/admin/orders/reject" && request.method === "POST") {
          const { order_id } = await request.json();
          await env.DB.prepare("UPDATE orders SET status='cancelled' WHERE id=?").bind(order_id).run();
          return json({ success: true, message: "订单已驳回" });
        }

        if (path === "/api/admin/watchlist/shared") {
          if (request.method === "GET") {
            const { results } = await env.DB.prepare("SELECT * FROM watchlist_shared ORDER BY sort_order ASC, id ASC").all();
            return json({ success: true, data: results || [] });
          }
          if (request.method === "POST") {
            const { id, etf_code, etf_name, sort_order, enabled } = await request.json();
            const code = String(etf_code || "").trim().toUpperCase();
            const name = String(etf_name || code).trim();
            const ts = Date.now();

            if (id) {
              await env.DB.prepare("UPDATE watchlist_shared SET etf_code=?, etf_name=?, sort_order=?, enabled=?, updated_at=? WHERE id=?")
                .bind(code, name, sort_order || 0, enabled ? 1 : 0, ts, id).run();
            } else {
              await env.DB.prepare("INSERT OR REPLACE INTO watchlist_shared (etf_code, etf_name, sort_order, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
                .bind(code, name, sort_order || 0, enabled ? 1 : 0, ts, ts).run();
            }
            return json({ success: true });
          }
          if (request.method === "DELETE") {
            const { id } = await request.json();
            await env.DB.prepare("DELETE FROM watchlist_shared WHERE id=?").bind(id).run();
            return json({ success: true });
          }
        }

        if (path === "/api/admin/watchlist/shared/batch" && request.method === "POST") {
          const { items } = await request.json();
          let added = 0;
          let skipped = 0;
          const ts = Date.now();
          for (const item of items || []) {
            const code = String(item.etf_code || "").trim().toUpperCase();
            if (!code) continue;
            const exist = await env.DB.prepare("SELECT id FROM watchlist_shared WHERE etf_code=?").bind(code).first();
            if (exist) {
              skipped++;
            } else {
              await env.DB.prepare("INSERT INTO watchlist_shared (etf_code, etf_name, sort_order, enabled, created_at, updated_at) VALUES (?, ?, 0, 1, ?, ?)")
                .bind(code, item.etf_name || code, ts, ts).run();
              added++;
            }
          }
          return json({ success: true, added, skipped });
        }

        if (path === "/api/admin/watchlist/custom") {
          if (request.method === "GET") {
            const { results } = await env.DB.prepare("SELECT w.*, u.username FROM watchlist_custom w LEFT JOIN users u ON w.user_id=u.id ORDER BY w.created_at DESC LIMIT 500").all();
            return json({ success: true, data: results || [] });
          }
          if (request.method === "POST") {
            const { id, etf_code, etf_name, status, expire_at } = await request.json();
            await env.DB.prepare("UPDATE watchlist_custom SET etf_code=?, etf_name=?, status=?, expire_at=?, updated_at=? WHERE id=?")
              .bind(etf_code, etf_name, status, expire_at, Date.now(), id).run();
            return json({ success: true });
          }
          if (request.method === "DELETE") {
            const { id } = await request.json();
            await env.DB.prepare("DELETE FROM watchlist_custom WHERE id=?").bind(id).run();
            return json({ success: true });
          }
        }

        if (path === "/api/admin/plans") {
          if (request.method === "GET") {
            const { results } = await env.DB.prepare("SELECT * FROM vip_plans ORDER BY sort_order ASC").all();
            return json({ success: true, data: results || [] });
          }
          if (request.method === "POST") {
            const b = await request.json();
            const now = Date.now();
            if (b.isEdit || b.id) {
              await env.DB.prepare("UPDATE vip_plans SET name=?, price=?, days=?, tag=?, sort_order=?, enabled=?, plan_type=? WHERE id=?")
                .bind(b.name, Number(b.price), Number(b.days), b.tag || null, b.sort_order ?? 0, b.enabled ? 1 : 0, b.plan_type || "both", b.id).run();
            } else {
              const id = b.id || generateRandomString(8);
              await env.DB.prepare("INSERT INTO vip_plans (id, name, price, days, tag, sort_order, enabled, plan_type, created_at) VALUES (?,?,?,?,?,?,?,?,?)")
                .bind(id, b.name, Number(b.price), Number(b.days), b.tag || null, b.sort_order ?? 0, b.enabled !== false ? 1 : 0, b.plan_type || "both", now).run();
            }
            return json({ success: true });
          }
          if (request.method === "DELETE") {
            const { id } = await request.json();
            await env.DB.prepare("DELETE FROM vip_plans WHERE id=?").bind(id).run();
            return json({ success: true });
          }
        }

        if (path === "/api/admin/promos") {
          if (request.method === "GET") {
            const { results } = await env.DB.prepare("SELECT * FROM promo_codes ORDER BY created_at DESC").all();
            return json({ success: true, data: results || [] });
          }
          if (request.method === "POST") {
            const b = await request.json();
            const code = String(b.code || "").trim().toUpperCase();
            if (b.id) {
              await env.DB.prepare("UPDATE promo_codes SET code=?, name=?, discount_type=?, discount_value=?, start_at=?, end_at=?, enabled=? WHERE id=?")
                .bind(code, b.name || null, b.discount_type, Number(b.discount_value), b.start_at, b.end_at, b.enabled ? 1 : 0, b.id).run();
            } else {
              await env.DB.prepare("INSERT INTO promo_codes (code, name, discount_type, discount_value, start_at, end_at, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
                .bind(code, b.name || null, b.discount_type, Number(b.discount_value), b.start_at, b.end_at, b.enabled ? 1 : 0, Date.now()).run();
            }
            return json({ success: true });
          }
          if (request.method === "DELETE") {
            const { id } = await request.json();
            await env.DB.prepare("DELETE FROM promo_codes WHERE id=?").bind(id).run();
            return json({ success: true });
          }
        }

        if (path === "/api/admin/settings") {
          if (request.method === "GET") {
            const { results } = await env.DB.prepare("SELECT key, value FROM system_settings").all();
            const map = {};
            (results || []).forEach((r) => { map[r.key] = r.value; });
            return json({ success: true, data: map });
          }
          if (request.method === "POST") {
            const body = await request.json();
            const now = Date.now();
            for (const [key, value] of Object.entries(body || {})) {
              await env.DB.prepare("INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?,?,?)")
                .bind(key, String(value), now).run();
            }
            return json({ success: true, message: "设置已成功保存" });
          }
        }

        if (path === "/api/admin/tickets" && request.method === "GET") {
          const { results } = await env.DB.prepare("SELECT tickets.*, users.username FROM tickets LEFT JOIN users ON tickets.user_id=users.id ORDER BY tickets.created_at DESC LIMIT 200").all();
          return json({ success: true, data: results || [] });
        }

        if (path === "/api/admin/tickets/reply" && request.method === "POST") {
          const { ticket_id, reply_message } = await request.json();
          await env.DB.prepare("UPDATE tickets SET status='replied', admin_reply=? WHERE id=?")
            .bind(reply_message.trim(), ticket_id).run();
          return json({ success: true, message: "已成功回复" });
        }

        if (path === "/api/admin/broadcast" && request.method === "POST") {
          const { title, content, also_tg } = await request.json();
          const now = Date.now();
          await env.DB.prepare("INSERT INTO announcements (title, content, created_at, created_by) VALUES (?, ?, ?, 'admin')")
            .bind(title || "系统通知", content.trim(), now).run();

          if (also_tg) {
            const { chatId } = getTgConfig(env);
            if (chatId) {
              await sendToTelegram(env, "sendMessage", {
                chat_id: chatId,
                text: `📢 [全员系统广播]\n标题: ${title}\n内容: ${content.trim()}`,
              });
            }
          }
          return json({ success: true, message: "广播通知发布成功" });
        }

        if (path === "/api/admin/vote/stats" && request.method === "GET") {
          const now = new Date();
          const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

          const totalInteractions = await env.DB.prepare("SELECT COUNT(*) as c FROM vote_records WHERE month_key=?").bind(monthKey).first();
          const { results } = await env.DB.prepare(`
            SELECT etf_code, etf_name, COUNT(*) as vote_count, COUNT(DISTINCT user_id) as voters_count
            FROM vote_records WHERE month_key=? GROUP BY etf_code ORDER BY vote_count DESC
          `).bind(monthKey).all();

          const limit = await getSettingInt(env, "vote_monthly_limit", 10);
          return json({
            success: true,
            data: {
              valid_symbols_count: (results || []).length,
              total_vote_interactions: totalInteractions?.c || 0,
              monthly_limit: limit,
              list: results || [],
            },
          });
        }

        if (path === "/api/admin/vote/clear" && request.method === "POST") {
          const now = new Date();
          const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
          await env.DB.prepare("DELETE FROM vote_records WHERE month_key=?").bind(monthKey).run();
          return json({ success: true, message: "本月投票已清空" });
        }

        if (path === "/api/admin/vote/sync-to-shared" && request.method === "POST") {
          const { top_n } = await request.json();
          const limit = top_n || 50;
          const now = new Date();
          const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

          const { results } = await env.DB.prepare(`
            SELECT etf_code, etf_name FROM vote_records WHERE month_key=? GROUP BY etf_code ORDER BY COUNT(*) DESC LIMIT ?
          `).bind(monthKey, limit).all();

          let count = 0;
          const ts = Date.now();
          for (const item of results || []) {
            await env.DB.prepare("INSERT OR REPLACE INTO watchlist_shared (etf_code, etf_name, sort_order, enabled, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)")
              .bind(item.etf_code, item.etf_name || item.etf_code, count, ts, ts).run();
            count++;
          }
          return json({ success: true, count, message: `已将得票前 ${count} 名同步为通用监控` });
        }
      }

      return new Response("Not Found", { status: 404, headers: corsHeaders });
    } catch (err) {
      return json({ error: err.message }, 500);
    }
  },
};
