-- ============================================================
-- 基金组合管理仪表盘 - 数据库 Schema
-- 在 Supabase SQL Editor 中执行此文件
-- ============================================================

-- ===== 1. Profiles 表（扩展 auth.users）=====
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT,
  age INTEGER DEFAULT 32,
  risk_level TEXT DEFAULT '稳健型',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 2. Accounts 表（投资账号）=====
CREATE TABLE IF NOT EXISTS accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT '默认账号',
  icon TEXT DEFAULT '🏦',
  platform TEXT DEFAULT '',
  investor_name TEXT DEFAULT '',
  age INTEGER DEFAULT 32,
  risk_level TEXT DEFAULT '稳健型',
  monthly_invest INTEGER DEFAULT 3000,
  target_amount DECIMAL(15,2) DEFAULT 2000000,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 3. Funds 表（基金持仓）=====
CREATE TABLE IF NOT EXISTS funds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES accounts ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  code TEXT DEFAULT '',               -- 基金代码，如 005698
  type TEXT NOT NULL DEFAULT 'mixed',  -- mixed | index | stock
  market TEXT DEFAULT 'us',           -- us(A股) | cn(A股)
  ref TEXT DEFAULT '',                -- 参考指数名称
  share DECIMAL(15,4) DEFAULT 0,
  amount DECIMAL(15,2) DEFAULT 0,
  cost DECIMAL(15,4) DEFAULT 0,
  nav DECIMAL(15,4) DEFAULT 0,
  nav_date TEXT,                      -- 净值来源日期
  nav_lag TEXT DEFAULT 'T+1',         -- 披露滞后：T+0 | T+1 | T+2
  nav_status TEXT DEFAULT '已披露',    -- 净值状态：已披露 | 待确认
  est_change DECIMAL(8,4) DEFAULT 0, -- 预估涨跌%
  yesterday DECIMAL(15,2) DEFAULT 0,
  hold DECIMAL(15,2) DEFAULT 0,
  rate DECIMAL(8,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 4. Goals 表（投资目标）=====
CREATE TABLE IF NOT EXISTS goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES accounts ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL DEFAULT 'retirement',
  name TEXT NOT NULL DEFAULT '退休储备',
  icon TEXT DEFAULT '🎯',
  color TEXT DEFAULT '#6366f1',
  target DECIMAL(15,2) NOT NULL DEFAULT 285,  -- 单位：万
  monthly INTEGER DEFAULT 3000,
  rate DECIMAL(6,4) DEFAULT 0.06,
  end_age INTEGER DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 5. Trades 表（交易记录）=====
CREATE TABLE IF NOT EXISTS trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES accounts ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  trade_date TEXT NOT NULL,
  fund_name TEXT,
  fund_type TEXT DEFAULT 'mixed',  -- mixed | index | stock
  action TEXT DEFAULT 'buy',  -- buy | sell
  amount DECIMAL(15,2) DEFAULT 0,
  share DECIMAL(15,4) DEFAULT 0,
  nav DECIMAL(15,4) DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 6. 索引 =====
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_funds_account ON funds(account_id);
CREATE INDEX IF NOT EXISTS idx_funds_user ON funds(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_account ON goals(account_id);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_account ON trades(account_id);
CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_id);

-- ===== 7. updated_at 自动更新触发器 =====
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated ON profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_accounts_updated ON accounts;
CREATE TRIGGER trg_accounts_updated BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_funds_updated ON funds;
CREATE TRIGGER trg_funds_updated BEFORE UPDATE ON funds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_goals_updated ON goals;
CREATE TRIGGER trg_goals_updated BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===== 8. 新用户注册时自动创建 profile =====
-- 注：SET search_path = public 是 Supabase 官方推荐写法，避免触发器权限问题
-- 若触发 "Database error saving new user"，还需执行以下 GRANT：
--   GRANT INSERT ON profiles TO supabase_auth_admin;
--   GRANT INSERT ON profiles TO anon;
--   GRANT INSERT ON profiles TO authenticated;
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, age, risk_level)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', '投资者'),
    32,
    '稳健型'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ===== 9. 启用 Realtime（跨设备实时同步）=====
-- 使用 DO 块避免"relation already exists"错误（Supabase 可能已自动添加）
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'accounts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE accounts;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'funds'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE funds;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'goals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE goals;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'trades'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE trades;
  END IF;
END $$;

-- ============================================================
-- Schema 创建完成
-- 接下来执行 002_rls.sql 启用行级安全
-- ============================================================

-- ===== 10. 迁移：v2→v3 新增字段（如果从旧版本升级）=====
-- 如果表已存在但缺少新字段，执行以下 ALTER 语句
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_name='funds' AND column_name='code') THEN
    -- 字段已存在，跳过
  ELSE
    ALTER TABLE funds ADD COLUMN code TEXT DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_name='funds' AND column_name='market') THEN
  ELSE
    ALTER TABLE funds ADD COLUMN market TEXT DEFAULT 'us';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_name='funds' AND column_name='ref') THEN
  ELSE
    ALTER TABLE funds ADD COLUMN ref TEXT DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_name='funds' AND column_name='nav_lag') THEN
  ELSE
    ALTER TABLE funds ADD COLUMN nav_lag TEXT DEFAULT 'T+1';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_name='funds' AND column_name='nav_status') THEN
  ELSE
    ALTER TABLE funds ADD COLUMN nav_status TEXT DEFAULT '已披露';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_name='funds' AND column_name='est_change') THEN
  ELSE
    ALTER TABLE funds ADD COLUMN est_change DECIMAL(8,4) DEFAULT 0;
  END IF;
END $$;
