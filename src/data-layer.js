// ============================================================
// 数据层 - CRUD 操作封装
// 所有数据库读写都通过此模块，仪表盘不直接操作 Supabase
// ============================================================

// ===== 加载全部数据 =====
async function dbLoadAll(userId) {
  if (!supabaseClient) throw new Error('Supabase 未初始化');

  // 并行加载所有表
  const [accountsRes, fundsRes, goalsRes, tradesRes] = await Promise.all([
    supabaseClient.from('accounts').select('*').eq('user_id', userId).order('sort_order'),
    supabaseClient.from('funds').select('*').eq('user_id', userId).order('sort_order'),
    supabaseClient.from('goals').select('*').eq('user_id', userId).order('created_at'),
    supabaseClient.from('trades').select('*').eq('user_id', userId).order('trade_date', { ascending: false })
  ]);

  if (accountsRes.error) throw accountsRes.error;

  const accounts = accountsRes.data || [];
  const funds = fundsRes.data || [];
  const goals = goalsRes.data || [];
  const trades = tradesRes.data || [];

  // 将 funds 和 trades 按账号分组挂到 accounts 上
  accounts.forEach(acct => {
    acct.fundsData = funds.filter(f => f.account_id === acct.id);
    acct.tradesData = trades.filter(t => t.account_id === acct.id);
  });

  return { accounts, funds, goals, trades };
}

// ===== Account CRUD =====
async function dbSaveAccount(account) {
  const { data, error } = await supabaseClient
    .from('accounts')
    .upsert({
      id: account.id || undefined,
      user_id: account.user_id,
      name: account.name,
      icon: account.icon || '🏦',
      platform: account.platform || '',
      investor_name: account.investor_name || account.investorName || '',
      age: account.age || 32,
      risk_level: account.risk_level || account.riskLevel || '稳健型',
      monthly_invest: account.monthly_invest || account.monthlyInvest || 3000,
      target_amount: account.target_amount || account.targetAmount || 2000000,
      sort_order: account.sort_order || 0
    })
    .select();
  if (error) throw error;
  return data[0];
}

async function dbDeleteAccount(accountId) {
  const { error } = await supabaseClient
    .from('accounts')
    .delete()
    .eq('id', accountId);
  if (error) throw error;
}

// ===== Fund CRUD =====
async function dbSaveFund(fund) {
  const { data, error } = await supabaseClient
    .from('funds')
    .upsert({
      id: fund.id || undefined,
      account_id: fund.account_id || fund.accountId,
      user_id: fund.user_id || fund.userId,
      name: fund.name,
      code: fund.code || '',
      type: fund.type || 'mixed',
      market: fund.market || 'us',
      ref: fund.ref || '',
      share: fund.share || 0,
      amount: fund.amount || 0,
      cost: fund.cost || 0,
      nav: fund.nav || 0,
      nav_date: fund.nav_date || fund.navDate || '',
      nav_lag: fund.nav_lag || fund.navLag || 'T+1',
      nav_status: fund.nav_status || fund.navStatus || '已披露',
      est_change: fund.est_change || fund.estChange || 0,
      yesterday: fund.yesterday || 0,
      hold: fund.hold || 0,
      rate: fund.rate || 0,
      sort_order: fund.sort_order || 0
    })
    .select();
  if (error) throw error;
  return data[0];
}

async function dbDeleteFund(fundId) {
  const { error } = await supabaseClient
    .from('funds')
    .delete()
    .eq('id', fundId);
  if (error) throw error;
}

// ===== Goal CRUD =====
async function dbSaveGoal(goal) {
  const { data, error } = await supabaseClient
    .from('goals')
    .upsert({
      id: goal.id || undefined,
      user_id: goal.user_id || goal.userId,
      account_id: goal.account_id || goal.accountId,
      type: goal.type || 'retirement',
      name: goal.name || '退休储备',
      icon: goal.icon || '🎯',
      color: goal.color || '#6366f1',
      target: goal.target || 285,
      monthly: goal.monthly || 3000,
      rate: goal.rate || 0.06,
      end_age: goal.end_age || goal.endAge || 60
    })
    .select();
  if (error) throw error;
  return data[0];
}

async function dbDeleteGoal(goalId) {
  const { error } = await supabaseClient
    .from('goals')
    .delete()
    .eq('id', goalId);
  if (error) throw error;
}

// ===== Trade CRUD =====
async function dbSaveTrade(trade) {
  const { data, error } = await supabaseClient
    .from('trades')
    .upsert({
      id: trade.id || undefined,
      account_id: trade.account_id || trade.accountId,
      user_id: trade.user_id || trade.userId,
      trade_date: trade.trade_date || trade.date || new Date().toISOString().slice(0, 10),
      fund_name: trade.fund_name || trade.fund || '',
      fund_type: trade.fund_type || trade.ftype || 'mixed',
      action: trade.action || 'buy',
      amount: trade.amount || 0,
      share: trade.share || 0,
      nav: trade.nav || 0,
      note: trade.note || ''
    })
    .select();
  if (error) throw error;
  return data[0];
}

async function dbDeleteTrade(tradeId) {
  const { error } = await supabaseClient
    .from('trades')
    .delete()
    .eq('id', tradeId);
  if (error) throw error;
}

// ===== Profile =====
async function dbGetProfile(userId) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function dbUpdateProfile(userId, updates) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select();
  if (error) throw error;
  return data[0];
}

// ============================================================
// 新用户种子数据 - 首次登录时自动创建默认账号+持仓
// ============================================================
async function dbSeedDefaultData(userId) {
  if (!supabaseClient) throw new Error('Supabase 未初始化');

  // 检查是否已有数据
  const { data: existing } = await supabaseClient
    .from('accounts')
    .select('id')
    .eq('user_id', userId)
    .limit(1);
  if (existing && existing.length > 0) return;  // 已有数据，不重复 seed

  // 创建默认账号
  const { data: account, error: acctErr } = await supabaseClient
    .from('accounts')
    .insert({
      user_id: userId,
      name: '京东金融',
      icon: '🏦',
      platform: '京东金融',
      investor_name: '投资者',
      age: 32,
      risk_level: '稳健型',
      monthly_invest: 3000,
      target_amount: 2850000,
      sort_order: 0
    })
    .select();
  if (acctErr) throw acctErr;

  const acctId = account[0].id;

  // 创建默认目标
  await supabaseClient.from('goals').insert({
    user_id: userId,
    account_id: acctId,
    type: 'retirement',
    name: '退休储备',
    icon: '🎯',
    color: '#6366f1',
    target: 285,
    monthly: 3000,
    rate: 0.06,
    end_age: 60
  });

  console.log('[DB] 默认数据已创建');
  return account[0];
}
