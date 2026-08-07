-- ====================== 用户相关 ======================
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  vip_expire_at INTEGER DEFAULT 0,
  referral_code TEXT,
  referred_by TEXT,
  created_at INTEGER,
  ip_address TEXT,
  vip_days_left INTEGER DEFAULT 0,
  balance REAL DEFAULT 0,
  shared_vip_days INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expire_at INTEGER NOT NULL
);

-- ====================== 订单与套餐 ======================
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

CREATE TABLE IF NOT EXISTS vip_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  days INTEGER NOT NULL,
  tag TEXT,
  sort_order INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  plan_type TEXT DEFAULT 'both',
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS promo_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT,
  discount_type TEXT DEFAULT 'percent',
  discount_value REAL,
  start_at INTEGER,
  end_at INTEGER,
  enabled INTEGER DEFAULT 1,
  created_at INTEGER
);

-- ====================== 监控列表 ======================
CREATE TABLE IF NOT EXISTS watchlist_shared (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  etf_code TEXT UNIQUE NOT NULL,
  etf_name TEXT,
  sort_order INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS watchlist_custom (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  etf_code TEXT NOT NULL,
  etf_name TEXT,
  status TEXT DEFAULT 'pending',
  start_at INTEGER,
  expire_at INTEGER,
  order_id INTEGER,
  created_at INTEGER,
  updated_at INTEGER
);

-- ====================== 客服工单（含图片 + 60天过期） ======================
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  subject TEXT NOT NULL,
  message TEXT,
  images TEXT DEFAULT '[]',
  status TEXT DEFAULT 'pending',
  admin_reply TEXT,
  reply_images TEXT DEFAULT '[]',
  created_at INTEGER,
  replied_at INTEGER,
  expire_at INTEGER
);

-- ====================== 票选监控 ======================
CREATE TABLE IF NOT EXISTS vote_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  etf_code TEXT NOT NULL,
  etf_name TEXT,
  month_key TEXT NOT NULL,
  created_at INTEGER
);

-- ====================== 系统与公告 ======================
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  content TEXT,
  created_at INTEGER,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS etf_charts (
  code TEXT PRIMARY KEY,
  chart_url TEXT,
  updated_at INTEGER
);

-- 给 tickets 表补充缺失的字段
ALTER TABLE tickets ADD COLUMN images TEXT DEFAULT '[]';
ALTER TABLE tickets ADD COLUMN reply_images TEXT DEFAULT '[]';
ALTER TABLE tickets ADD COLUMN replied_at INTEGER;
ALTER TABLE tickets ADD COLUMN expire_at INTEGER;

-- ====================== 常用索引（提升查询速度） ======================
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_custom_user ON watchlist_custom(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_vote_month ON vote_records(month_key);
CREATE INDEX IF NOT EXISTS idx_vote_code_month ON vote_records(etf_code, month_key);

INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES
('gift_register_days', '1', strftime('%s','now') * 1000),
('gift_inviter_days', '3', strftime('%s','now') * 1000),
('gift_invitee_days', '2', strftime('%s','now') * 1000),
('free_top_n_charts', '3', strftime('%s','now') * 1000),
('pay_register_enabled', '1', strftime('%s','now') * 1000),
('promo_enabled', '1', strftime('%s','now') * 1000),
('custom_max_symbols', '3', strftime('%s','now') * 1000),
('vote_monthly_limit', '10', strftime('%s','now') * 1000),
('default_pay_channel', 'alipay', strftime('%s','now') * 1000);


