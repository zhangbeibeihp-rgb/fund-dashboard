// ============================================================
// 实时同步模块
// 监听数据库变化，跨设备自动同步
// ============================================================

let subscriptions = [];

// 初始化实时订阅
function rtInit(callbacks) {
  if (!supabaseClient) {
    console.warn('[Realtime] Supabase 未初始化，跳过实时订阅');
    return;
  }

  rtUnsubscribeAll();

  // 订阅 accounts 表变化
  if (callbacks.onAccountsChange) {
    const sub = supabaseClient
      .channel('accounts-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'accounts'
      }, (payload) => {
        console.log('[Realtime] accounts 变化:', payload.eventType);
        callbacks.onAccountsChange(payload);
      })
      .subscribe();
    subscriptions.push(sub);
  }

  // 订阅 funds 表变化
  if (callbacks.onFundsChange) {
    const sub = supabaseClient
      .channel('funds-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'funds'
      }, (payload) => {
        console.log('[Realtime] funds 变化:', payload.eventType);
        callbacks.onFundsChange(payload);
      })
      .subscribe();
    subscriptions.push(sub);
  }

  // 订阅 goals 表变化
  if (callbacks.onGoalsChange) {
    const sub = supabaseClient
      .channel('goals-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'goals'
      }, (payload) => {
        console.log('[Realtime] goals 变化:', payload.eventType);
        callbacks.onGoalsChange(payload);
      })
      .subscribe();
    subscriptions.push(sub);
  }

  // 订阅 trades 表变化
  if (callbacks.onTradesChange) {
    const sub = supabaseClient
      .channel('trades-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'trades'
      }, (payload) => {
        console.log('[Realtime] trades 变化:', payload.eventType);
        callbacks.onTradesChange(payload);
      })
      .subscribe();
    subscriptions.push(sub);
  }

  console.log('[Realtime] 订阅已建立，共', subscriptions.length, '个频道');
}

// 取消所有订阅
function rtUnsubscribeAll() {
  subscriptions.forEach(sub => {
    try { supabaseClient.removeChannel(sub); } catch(e) {}
  });
  subscriptions = [];
}

// 防抖刷新 - 短时间内多次变化只刷新一次
let refreshTimer = null;
function rtDebouncedRefresh(refreshFn, delay = 500) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshFn();
    refreshTimer = null;
  }, delay);
}
