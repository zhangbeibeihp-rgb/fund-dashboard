function setSyncStatus(status, message){
  var el = document.getElementById('syncStatusBadge') || document.getElementById('mobileSyncStatus');
  if(!el) return;
  var label = message || {
    local: '本地保存',
    syncing: '同步中...',
    synced: '云端已同步',
    failed: '同步失败'
  }[status] || '本地保存';
  el.textContent = label;
  el.dataset.status = status || 'local';
  el.title = '数据同步状态：' + label;
}

function currentCloudUser(){
  if(typeof __appUser !== 'undefined' && __appUser) return __appUser;
  if(window.__appUser) return window.__appUser;
  return null;
}

function isCloudWriteReady(){
  var ready = (typeof __supabaseReady !== 'undefined' && __supabaseReady) || Boolean(window.__supabaseReady);
  return Boolean(ready && currentCloudUser());
}

function currentAccount(){
  if(!Array.isArray(window.accounts)) return null;
  var id = typeof window.currentAccountId !== 'undefined' ? window.currentAccountId : window.currentAccountIndex;
  return window.accounts.find(function(account){ return account && account.id === id; }) || window.accounts[id] || window.accounts[0] || null;
}

function markLocalChange(){
  setSyncStatus(isCloudWriteReady() ? 'syncing' : 'local', isCloudWriteReady() ? '等待云端同步' : '本地保存');
}

function markSyncSuccess(message){
  setSyncStatus('synced', message || '云端已同步');
}

function markSyncFailure(message){
  setSyncStatus('failed', message || '同步失败');
}

function reportSyncError(code, error, meta){
  if(typeof reportAppError === 'function') reportAppError(code, error, meta || {});
  else console.warn('[Sync]', code, error, meta || {});
}

function showSyncToast(message, type, duration){
  if(typeof showToast === 'function') showToast(message, type || 'warn', duration || 5000);
}

async function syncTradeToCloud(trade){
  try {
    if(!isCloudWriteReady()){ setSyncStatus('local', '本地保存'); return; }
    if(typeof dbSaveTrade !== 'function') return;
    setSyncStatus('syncing', '交易同步中...');
    var acct = currentAccount();
    if(!acct || !acct._dbId){ setSyncStatus('local', '本地保存'); return; }
    var user = currentCloudUser();
    var saved = await dbSaveTrade({
      id: trade._dbId,
      account_id: acct._dbId,
      user_id: user.id,
      trade_date: trade.date || trade.trade_date,
      fund_name: trade.fund || trade.fund_name,
      fund_type: trade.ftype || trade.fund_type,
      action: trade.action,
      amount: trade.amount,
      share: trade.share,
      nav: trade.nav,
      note: trade.note || ''
    });
    if(saved && saved.id){
      trade._dbId = saved.id;
      trade._accountId = acct._dbId;
      trade.id = trade.id || saved.id;
    }
    markSyncSuccess('交易已同步');
  } catch(error) {
    markSyncFailure('交易同步失败');
    reportSyncError('trade_sync_failed', error, { fund: trade && (trade.fund || trade.fund_name) });
    showSyncToast('交易已保存在本地，但云端同步失败：' + error.message, 'warn', 5000);
  }
}

async function syncDeletedTradeToCloud(trade){
  try {
    if(!isCloudWriteReady() || !trade || !trade._dbId){ setSyncStatus('local', '本地保存'); return; }
    if(typeof dbDeleteTrade !== 'function') return;
    setSyncStatus('syncing', '删除同步中...');
    await dbDeleteTrade(trade._dbId);
    markSyncSuccess('删除已同步');
  } catch(error) {
    markSyncFailure('删除同步失败');
    reportSyncError('trade_delete_sync_failed', error, { id: trade && trade._dbId });
    showSyncToast('交易已从本地删除，但云端删除失败：' + error.message, 'warn', 5000);
  }
}

async function syncAccountToCloud(account){
  try {
    if(!isCloudWriteReady() || !account){ setSyncStatus('local', '本地保存'); return; }
    if(typeof dbSaveAccount !== 'function') return;
    setSyncStatus('syncing', '账号同步中...');
    var user = currentCloudUser();
    var saved = await dbSaveAccount({
      id: account._dbId,
      user_id: user.id,
      name: account.name,
      icon: account.icon,
      platform: account.platform,
      investor_name: account.investorName,
      age: account.age,
      risk_level: account.riskLevel,
      monthly_invest: account.monthlyInvest,
      target_amount: account.targetAmount,
      sort_order: account.id || 0
    });
    if(saved && saved.id){
      account._dbId = saved.id;
      account.lastUpdate = '云端同步';
      if(typeof updateAccountSummaryUI === 'function') updateAccountSummaryUI();
    }
    markSyncSuccess('账号已同步');
  } catch(error) {
    markSyncFailure('账号同步失败');
    reportSyncError('account_sync_failed', error, { name: account && account.name });
    showSyncToast('账号已保存在本地，但云端同步失败：' + error.message, 'warn', 5000);
  }
}

async function syncOcrFundsToCloud(importedFunds){
  try {
    if(!isCloudWriteReady()){ setSyncStatus('local', '本地保存'); return; }
    if(typeof dbSaveFund !== 'function') return;
    var acct = currentAccount();
    if(!acct || !acct._dbId){ setSyncStatus('local', '本地保存'); return; }
    var user = currentCloudUser();
    setSyncStatus('syncing', 'OCR持仓同步中...');

    for(var i = 0; i < importedFunds.length; i++){
      var f = importedFunds[i];
      var saved = await dbSaveFund({
        id: f._dbId,
        account_id: acct._dbId,
        user_id: user.id,
        name: f.name,
        code: f.code,
        type: f.type,
        market: f.market,
        ref: f.ref,
        share: f.share,
        amount: f.amount,
        cost: f.cost,
        nav: f.nav,
        nav_date: f.navDate,
        nav_lag: f.navLag,
        nav_status: f.navStatus,
        est_change: f.estChange,
        yesterday: f.yesterday,
        hold: f.hold,
        rate: f.rate,
        sort_order: i
      });
      if(saved && saved.id){
        f._dbId = saved.id;
        f._accountId = acct._dbId;
      }
    }
    markSyncSuccess('OCR持仓已同步');
  } catch(error) {
    markSyncFailure('OCR持仓同步失败');
    reportSyncError('ocr_fund_sync_failed', error, { count: importedFunds && importedFunds.length });
    showSyncToast('持仓已导入本地，但云端同步失败：' + error.message, 'warn', 5000);
  }
}

async function syncImportedDataToCloud(){
  try {
    if(!isCloudWriteReady()){ setSyncStatus('local', '本地保存'); return; }
    if(!Array.isArray(window.accounts)){ setSyncStatus('local', '本地保存'); return; }
    setSyncStatus('syncing', '导入数据同步中...');
    var user = currentCloudUser();

    for(var i = 0; i < window.accounts.length; i++){
      var acct = window.accounts[i];
      await syncAccountToCloud(acct);
      var acctId = acct && acct._dbId;
      if(!acctId) continue;

      var acctFunds = acct.fundsData || (i === window.currentAccountId ? window.funds : []);
      if(typeof dbSaveFund === 'function' && Array.isArray(acctFunds)){
        for(var fIdx = 0; fIdx < acctFunds.length; fIdx++){
          var f = acctFunds[fIdx];
          var savedFund = await dbSaveFund({
            id: f._dbId,
            account_id: acctId,
            user_id: user.id,
            name: f.name,
            code: f.code,
            type: f.type,
            market: f.market,
            ref: f.ref,
            share: f.share,
            amount: f.amount,
            cost: f.cost,
            nav: f.nav,
            nav_date: f.navDate,
            nav_lag: f.navLag,
            nav_status: f.navStatus,
            est_change: f.estChange,
            yesterday: f.yesterday,
            hold: f.hold,
            rate: f.rate,
            sort_order: fIdx
          });
          if(savedFund && savedFund.id){
            f._dbId = savedFund.id;
            f._accountId = acctId;
          }
        }
      }

      var acctTrades = acct.tradesData || (i === window.currentAccountId ? window.trades : []);
      if(typeof dbSaveTrade === 'function' && Array.isArray(acctTrades)){
        for(var tIdx = 0; tIdx < acctTrades.length; tIdx++){
          var t = acctTrades[tIdx];
          var savedTrade = await dbSaveTrade({
            id: t._dbId,
            account_id: acctId,
            user_id: user.id,
            trade_date: t.date || t.trade_date,
            fund_name: t.fund || t.fund_name,
            fund_type: t.ftype || t.fund_type,
            action: t.action,
            amount: t.amount,
            share: t.share,
            nav: t.nav,
            note: t.note || ''
          });
          if(savedTrade && savedTrade.id){
            t._dbId = savedTrade.id;
            t._accountId = acctId;
          }
        }
      }
    }
    if(typeof syncGoalsToCloud === 'function') syncGoalsToCloud();
    markSyncSuccess('导入数据已同步');
  } catch(error) {
    markSyncFailure('导入同步失败');
    reportSyncError('import_sync_failed', error, {
      accounts: Array.isArray(window.accounts) ? window.accounts.length : 0,
      goals: Array.isArray(window.goals) ? window.goals.length : 0
    });
    showSyncToast('导入数据已恢复到本地，但云端同步失败：' + error.message, 'warn', 6000);
  }
}

window.setSyncStatus = setSyncStatus;
window.markLocalChange = markLocalChange;
window.markSyncSuccess = markSyncSuccess;
window.markSyncFailure = markSyncFailure;
window.isCloudWriteReady = isCloudWriteReady;
window.syncTradeToCloud = syncTradeToCloud;
window.syncDeletedTradeToCloud = syncDeletedTradeToCloud;
window.syncAccountToCloud = syncAccountToCloud;
window.syncOcrFundsToCloud = syncOcrFundsToCloud;
window.syncImportedDataToCloud = syncImportedDataToCloud;
