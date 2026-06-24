// ============================================================
// App 初始化模块
// 串联 Supabase 初始化 → 认证检查 → 数据加载 → 全局变量覆写 → 保存钩子 → 实时同步
//
// 工作流程：
// 1. 仪表盘内联脚本先用硬编码数据初始化（离线/降级模式）
// 2. 本模块加载后检查 Supabase 是否配置
// 3. 若已配置 → 认证 → 加载云端数据 → 覆写全局变量 → 重新渲染 → 实时同步
// 4. 若未配置 → 保持 localStorage 模式，不影响现有功能
// ============================================================

let __appUser = null;        // 当前登录用户
let __appAccountId = null;   // 当前账号的数据库 UUID
let __supabaseReady = false; // Supabase 是否就绪
let __isSyncing = false;     // 是否正在同步中（防止循环触发）

// ===== 主入口 =====
async function appInit() {
  // 1. 检查 Supabase 是否配置
  if (!isSupabaseConfigured()) {
    console.log('[App] Supabase 未配置，使用 localStorage 模式');
    return;
  }

  // 2. 初始化 Supabase 客户端
  const client = await initSupabase();
  if (!client) {
    console.warn('[App] Supabase 初始化失败，降级到 localStorage 模式');
    return;
  }

  // 3. 检查认证状态
  const user = await authGuard();
  if (!user) return;  // 已跳转到 login.html
  __appUser = user;
  __supabaseReady = true;

  console.log('[App] 用户已认证:', user.email);

  // 显示退出登录按钮
  if (typeof showLogoutBtn === 'function') showLogoutBtn();

  // 4. 显示数据加载中
  showLoadingOverlay();

  try {
    // 5. 种子数据（首次登录自动创建默认账号）
    await dbSeedDefaultData(user.id);

    // 6. 加载全部数据
    const data = await dbLoadAll(user.id);
    console.log('[App] 数据加载完成:', {
      accounts: data.accounts.length,
      funds: data.funds.length,
      goals: data.goals.length,
      trades: data.trades.length
    });

    // 7. 转换并覆写全局变量
    applyCloudData(data);

    // 8. 重新渲染仪表盘
    await reinitDashboard();

    // 9. 设置保存钩子
    setupSaveHooks();

    // 10. 设置实时同步
    setupRealtimeSync();

    // 11. 自动获取夜盘美股指数（后台静默执行）
    setTimeout(() => {
      if (typeof fetchNightIndexData === 'function') fetchNightIndexData();
    }, 2000);

    console.log('[App] 云端模式启动完成');
  } catch (e) {
    console.error('[App] 数据加载失败:', e);
    showToast('数据同步失败: ' + e.message, 'error');
  } finally {
    hideLoadingOverlay();
  }
}

// ===== 加载遮罩 =====
function showLoadingOverlay() {
  let overlay = document.getElementById('appLoadingOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'appLoadingOverlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,.9);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#e2e8f0;font-family:system-ui,sans-serif;';
    overlay.innerHTML = `
      <div style="width:48px;height:48px;border:4px solid rgba(99,102,241,.2);border-top-color:#6366f1;border-radius:50%;animation:spin 1s linear infinite;margin-bottom:20px;"></div>
      <div style="font-size:18px;font-weight:600;margin-bottom:8px;">正在同步云端数据</div>
      <div style="font-size:14px;color:#94a3b8;">从 Supabase 加载持仓、目标、交易记录...</div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    `;
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('appLoadingOverlay');
  if (overlay) overlay.style.display = 'none';
}

// ===== 转换数据库记录为仪表盘格式并覆写全局变量 =====
function applyCloudData(data) {
  // 转换 funds
  if (data.funds && data.funds.length > 0) {
    funds = data.funds.map(f => ({
      id: f.id,
      _dbId: f.id,
      _accountId: f.account_id,
      name: f.name,
      code: f.code || '',
      type: f.type,
      market: f.market || 'us',
      ref: f.ref || '',
      share: parseFloat(f.share) || 0,
      amount: parseFloat(f.amount) || 0,
      cost: parseFloat(f.cost) || 0,
      nav: parseFloat(f.nav) || 0,
      navDate: f.nav_date || '',
      navLag: f.nav_lag || 'T+1',
      navStatus: f.nav_status || '已披露',
      estChange: parseFloat(f.est_change) || 0,
      yesterday: parseFloat(f.yesterday) || 0,
      hold: parseFloat(f.hold) || 0,
      rate: parseFloat(f.rate) || 0
    }));
    totalAsset = funds.reduce((s, f) => s + f.amount, 0);
  }

  // 转换 trades
  if (data.trades && data.trades.length > 0) {
    trades = data.trades.map(t => ({
      _dbId: t.id,
      _accountId: t.account_id,
      date: t.trade_date,
      fund: t.fund_name,
      type: t.action === 'buy' ? '买入' : t.action === 'sell' ? '卖出' : '调仓',
      action: t.action,
      ftype: t.fund_type || 'mixed',
      amount: parseFloat(t.amount) || 0,
      share: parseFloat(t.share) || 0,
      nav: parseFloat(t.nav) || 0,
      status: '持有中',
      note: t.note || ''
    }));
  }

  // 转换 accounts
  if (data.accounts && data.accounts.length > 0) {
    accounts = data.accounts.map((a, idx) => {
      const acctFunds = (a.fundsData || []).map(f => ({
        name: f.name,
        code: f.code || '',
        type: f.type,
        market: f.market || 'us',
        ref: f.ref || '',
        share: parseFloat(f.share) || 0,
        amount: parseFloat(f.amount) || 0,
        cost: parseFloat(f.cost) || 0,
        nav: parseFloat(f.nav) || 0,
        navDate: f.nav_date || '',
        navLag: f.nav_lag || 'T+1',
        navStatus: f.nav_status || '已披露',
        estChange: parseFloat(f.est_change) || 0,
        yesterday: parseFloat(f.yesterday) || 0,
        hold: parseFloat(f.hold) || 0,
        rate: parseFloat(f.rate) || 0
      }));
      const acctTrades = (a.tradesData || []).map(t => ({
        date: t.trade_date,
        fund: t.fund_name,
        action: t.action,
        type: t.action === 'buy' ? '买入' : '卖出',
        ftype: t.fund_type || 'mixed',
        amount: parseFloat(t.amount) || 0,
        share: parseFloat(t.share) || 0,
        nav: parseFloat(t.nav) || 0,
        status: '持有中',
        note: t.note || ''
      }));
      const acctTotal = acctFunds.reduce((s, f) => s + f.amount, 0);
      const acctHoldProfit = acctFunds.reduce((s, f) => s + f.hold, 0);
      const acctHoldRate = acctTotal > 0 ? acctHoldProfit / (acctTotal - acctHoldProfit) * 100 : 0;

      return {
        id: idx,  // 保持数组索引作为 id
        _dbId: a.id,
        name: a.name,
        icon: a.icon || '🏦',
        platform: a.platform || '',
        totalAsset: acctTotal,
        holdProfit: acctHoldProfit,
        holdRate: acctHoldRate,
        fundCount: acctFunds.length,
        dataSource: a.platform || '',
        lastUpdate: '云端同步',
        investorName: a.investor_name || '',
        age: a.age || 32,
        riskLevel: a.risk_level || '稳健型',
        monthlyInvest: a.monthly_invest || 3000,
        targetAmount: parseFloat(a.target_amount) || 2000000,
        fundsData: acctFunds,
        tradesData: acctTrades
      };
    });
    currentAccountId = 0;
  }

  // 转换 goals
  if (data.goals && data.goals.length > 0) {
    goals = data.goals.map(g => ({
      _dbId: g.id,
      _accountId: g.account_id,
      id: Date.now() + Math.random(),
      type: g.type,
      name: g.name,
      icon: g.icon || '🎯',
      color: g.color || '#6366f1',
      target: parseFloat(g.target) || 285,
      monthly: g.monthly || 3000,
      rate: parseFloat(g.rate) || 0.06,
      endAge: g.end_age || 60
    }));
    currentGoalId = 0;
  }
}

// ===== 重新渲染仪表盘 =====
async function reinitDashboard() {
  // 1. 销毁现有 Chart 实例
  if (typeof charts !== 'undefined' && charts) {
    Object.values(charts).forEach(c => {
      try { if (c && c.destroy) c.destroy(); } catch(e) {}
    });
    // 清空 charts 对象
    Object.keys(charts).forEach(k => delete charts[k]);
  }

  // 2. 重新渲染所有面板
  renderHoldings();
  renderRebalance();
  renderEstimate();
  renderTrades();
  renderPlan();
  renderStyleCompare();
  renderGoalTabs();
  fillGoalInputs();
  updateGoal();
  renderFundPool();
  renderAIPredictions();

  // 3. 重新创建图表
  createCharts();

  // 4. 切换首个账号（仅更新 UI，不覆写全局 funds/trades）
  switchToFirstAccountUI();

  // 5. 重建账号 Tab 栏
  rebuildAccountTabs();
  rebuildAccountTabs();

  // 6. 更新 KPI
  if (typeof updateKPIs === 'function') updateKPIs();
}

// ===== 重建账号 Tab 栏 =====
function rebuildAccountTabs() {
  const tabContainer = document.getElementById('accountTabs');
  if (!tabContainer) return;

  const tabs = accounts.map((a, i) => `
    <button class="acct-tab ${i === 0 ? 'active' : ''}" data-acct="${i}" onclick="switchAccount(${i})">
      <span class="acct-icon">${escapeHtml(a.icon)}</span> ${escapeHtml(a.name)}
      <span class="acct-badge">${a.fundCount}支</span>
    </button>
  `).join('');

  // 保留添加按钮
  const addBtn = '<button class="acct-add-btn" onclick="showAddAccount()" title="添加账号" aria-label="添加账号">＋</button>';
  tabContainer.innerHTML = tabs + addBtn;
}

// ===== 仅刷新账号卡片 UI，不覆写全局 funds/trades/totalAsset =====
function switchToFirstAccountUI() {
  currentAccountId = 0;
  const acct = accounts[0];
  if (!acct) return;

  document.querySelectorAll('.acct-tab').forEach(t => {
    t.classList.toggle('active', parseInt(t.dataset.acct) === 0);
  });

  const nameEl = document.getElementById('currentAcctName');
  const totalEl = document.getElementById('currentAcctTotal');
  const profitEl = document.getElementById('camProfit');
  const fundsEl = document.getElementById('camFunds');
  const updateEl = document.getElementById('camUpdate');

  if (nameEl) nameEl.textContent = acct.name;
  if (totalEl) totalEl.textContent = '¥' + acct.totalAsset.toLocaleString('zh-CN', { minimumFractionDigits: 2 });
  if (profitEl) {
    const sign = acct.holdProfit >= 0 ? '+' : '';
    profitEl.innerHTML = `<span class="${acct.holdProfit >= 0 ? 'green' : ''}">${sign}¥${Math.abs(acct.holdProfit).toFixed(2)} (${sign}${acct.holdRate.toFixed(2)}%)</span>`;
  }
  if (fundsEl) fundsEl.textContent = acct.fundCount + '支基金';
  if (updateEl) updateEl.textContent = '更新于 ' + acct.lastUpdate;

  // 更新目标输入框（如果存在）
  const inputTarget = document.getElementById('inputTarget');
  const inputRate = document.getElementById('inputRate');
  const inputMonthly = document.getElementById('inputMonthly');
  const inputRetireAge = document.getElementById('inputRetireAge');
  if (inputTarget && goals[currentGoalId]) {
    const tgt = acct.targetAmount ? acct.targetAmount / 10000 : goals[currentGoalId].target;
    goals[currentGoalId].target = tgt;
    inputTarget.value = tgt;
  }
  if (inputRate) {
    const rateMap = { '保守型': 4, '稳健型': 6, '平衡型': 7.5, '进取型': 9, '激进型': 11 };
    const r = rateMap[acct.riskLevel] || 6;
    inputRate.value = r;
    if (goals[currentGoalId]) goals[currentGoalId].rate = r / 100;
  }
  if (inputMonthly) { inputMonthly.value = acct.monthlyInvest; if (goals[currentGoalId]) goals[currentGoalId].monthly = acct.monthlyInvest; }
  if (inputRetireAge) { const ra = 60; inputRetireAge.value = ra; if (goals[currentGoalId]) goals[currentGoalId].endAge = ra; }
}

// ===== 设置保存钩子 =====
function setupSaveHooks() {
  // 保存原始 saveGoals
  const _originalSaveGoals = saveGoals;

  // 覆写 saveGoals：同时保存到 localStorage 和 Supabase
  saveGoals = function() {
    _originalSaveGoals();  // 保存到 localStorage（降级备份）
    syncGoalsToCloud();
  };

  console.log('[App] 保存钩子已设置');
}

// ===== 同步 goals 到云端 =====
async function syncGoalsToCloud() {
  if (!__supabaseReady || !__appUser || __isSyncing) return;
  __isSyncing = true;

  try {
    for (const g of goals) {
      if (!g._accountId) {
        // 新目标，关联到当前账号
        g._accountId = accounts[currentAccountId]?._dbId;
      }
      const result = await dbSaveGoal({
        id: g._dbId,
        user_id: __appUser.id,
        account_id: g._accountId,
        type: g.type,
        name: g.name,
        icon: g.icon,
        color: g.color,
        target: g.target,
        monthly: g.monthly,
        rate: g.rate,
        end_age: g.endAge
      });
      if (result && !g._dbId) {
        g._dbId = result.id;  // 保存数据库 ID
      }
    }
  } catch (e) {
    console.error('[App] goals 同步失败:', e);
  } finally {
    __isSyncing = false;
  }
}

// ===== 设置实时同步 =====
function setupRealtimeSync() {
  rtInit({
    onAccountsChange: (payload) => {
      rtDebouncedRefresh(reloadFromCloud);
    },
    onFundsChange: (payload) => {
      rtDebouncedRefresh(reloadFromCloud);
    },
    onGoalsChange: (payload) => {
      rtDebouncedRefresh(reloadFromCloud);
    },
    onTradesChange: (payload) => {
      rtDebouncedRefresh(reloadFromCloud);
    }
  });
}

// ===== 从云端重新加载数据 =====
async function reloadFromCloud() {
  if (!__supabaseReady || !__appUser || __isSyncing) return;
  console.log('[App] 实时同步：重新加载数据...');

  try {
    __isSyncing = true;
    const data = await dbLoadAll(__appUser.id);

    // 保存当前 UI 状态
    const activeSection = typeof currentSection !== 'undefined' ? currentSection : 'overview';
    const activeGoalId = currentGoalId;
    const activeAcctId = currentAccountId;

    // 应用新数据
    applyCloudData(data);

    // 重新渲染
    await reinitDashboard();

    // 恢复 UI 状态
    if (typeof showSection === 'function') showSection(activeSection);
    if (activeGoalId < goals.length) {
      currentGoalId = activeGoalId;
      renderGoalTabs();
      fillGoalInputs();
      updateGoal();
    }
    if (activeAcctId < accounts.length) {
      // 仅更新 UI，不覆写全局 funds/trades（reinitDashboard 已处理渲染）
      switchToFirstAccountUI();
    }

    showToast('数据已同步', 'success');
  } catch (e) {
    console.error('[App] 实时同步失败:', e);
  } finally {
    __isSyncing = false;
  }
}

// ===== 退出登录 =====
async function appLogout() {
  if (__supabaseReady) {
    rtUnsubscribeAll();
    await authLogout();
  }
}

// ===== 启动 =====
// 延迟执行，确保内联脚本已完成初始化
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(appInit, 100);
} else {
  window.addEventListener('load', () => setTimeout(appInit, 100));
}
