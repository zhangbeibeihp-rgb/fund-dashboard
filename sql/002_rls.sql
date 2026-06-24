-- ============================================================
-- 行级安全策略 (Row Level Security)
-- 确保每个用户只能访问自己的数据
-- 在 001_schema.sql 之后执行
-- ============================================================

-- ===== 启用 RLS =====
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- ===== Profiles 策略 =====
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ===== Accounts 策略 =====
DROP POLICY IF EXISTS "accounts_select_own" ON accounts;
CREATE POLICY "accounts_select_own" ON accounts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "accounts_insert_own" ON accounts;
CREATE POLICY "accounts_insert_own" ON accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "accounts_update_own" ON accounts;
CREATE POLICY "accounts_update_own" ON accounts
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "accounts_delete_own" ON accounts;
CREATE POLICY "accounts_delete_own" ON accounts
  FOR DELETE USING (auth.uid() = user_id);

-- ===== Funds 策略 =====
DROP POLICY IF EXISTS "funds_select_own" ON funds;
CREATE POLICY "funds_select_own" ON funds
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "funds_insert_own" ON funds;
CREATE POLICY "funds_insert_own" ON funds
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "funds_update_own" ON funds;
CREATE POLICY "funds_update_own" ON funds
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "funds_delete_own" ON funds;
CREATE POLICY "funds_delete_own" ON funds
  FOR DELETE USING (auth.uid() = user_id);

-- ===== Goals 策略 =====
DROP POLICY IF EXISTS "goals_select_own" ON goals;
CREATE POLICY "goals_select_own" ON goals
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "goals_insert_own" ON goals;
CREATE POLICY "goals_insert_own" ON goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "goals_update_own" ON goals;
CREATE POLICY "goals_update_own" ON goals
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "goals_delete_own" ON goals;
CREATE POLICY "goals_delete_own" ON goals
  FOR DELETE USING (auth.uid() = user_id);

-- ===== Trades 策略 =====
DROP POLICY IF EXISTS "trades_select_own" ON trades;
CREATE POLICY "trades_select_own" ON trades
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "trades_insert_own" ON trades;
CREATE POLICY "trades_insert_own" ON trades
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "trades_update_own" ON trades;
CREATE POLICY "trades_update_own" ON trades
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "trades_delete_own" ON trades;
CREATE POLICY "trades_delete_own" ON trades
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- RLS 策略配置完成
-- 现在每个用户只能看到和修改自己的数据
-- ============================================================
