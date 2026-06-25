(function(){
  var state = {
    tab: 'home',
    filter: 'all',
    ocrDraft: null
  };

  function money(value){
    var n = Number(value || 0);
    return '¥' + n.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function getAccounts(){
    return Array.isArray(window.accounts) ? window.accounts : [];
  }

  function activeAccount(){
    var accounts = getAccounts();
    if(!accounts.length) return {};
    if(typeof window.currentAccountId !== 'undefined'){
      return accounts.find(function(account){ return account.id === window.currentAccountId; }) || accounts[window.currentAccountId] || accounts[0] || {};
    }
    if(typeof window.currentAccountIndex === 'number') return accounts[window.currentAccountIndex] || accounts[0] || {};
    return accounts[0] || {};
  }

  function getFunds(){
    if(Array.isArray(window.funds)) return window.funds;
    var account = activeAccount();
    if(Array.isArray(account.fundsData)) return account.fundsData;
    if(Array.isArray(account.funds)) return account.funds;
    return [];
  }

  function getTrades(){
    if(Array.isArray(window.trades)) return window.trades;
    var account = activeAccount();
    if(Array.isArray(account.tradesData)) return account.tradesData;
    if(Array.isArray(account.trades)) return account.trades;
    return [];
  }

  function getGoals(){
    if(Array.isArray(window.goals)) return window.goals;
    var account = activeAccount();
    return account.goal ? [account.goal] : [];
  }

  function switchTab(tab){
    state.tab = tab;
    document.querySelectorAll('[data-mobile-panel]').forEach(function(panel){
      panel.classList.toggle('active', panel.dataset.mobilePanel === tab);
    });
    document.querySelectorAll('[data-mobile-tab]').forEach(function(btn){
      btn.classList.toggle('active', btn.dataset.mobileTab === tab);
    });
    renderAll();
  }

  function renderHome(){
    var funds = getFunds();
    var trades = getTrades();
    var account = activeAccount();
    var total = funds.reduce(function(sum, fund){ return sum + Number(fund.amount || fund.market_value || 0); }, 0);
    var hold = funds.reduce(function(sum, fund){ return sum + Number(fund.hold || fund.profit || 0); }, 0);
    var yesterday = funds.reduce(function(sum, fund){ return sum + Number(fund.yesterday || fund.daily_profit || 0); }, 0);

    setText('mobileAccountName', account.name || account.platform || '本地账号');
    setText('mobileTotalAsset', money(total));
    setText('mobileAssetMeta', funds.length ? funds.length + ' 支基金' : '暂无持仓');
    setText('mobileYesterday', money(yesterday));
    setText('mobileHoldProfit', money(hold));
    setText('mobileFundCount', String(funds.length));
    setText('mobileGoalPct', calcGoalPct(total));

    var risk = document.getElementById('mobileRiskCard');
    if(risk){
      risk.textContent = funds.length ? '配置集中度和再平衡偏离可在「目标」页复核。' : '暂无持仓，建议先上传截图或手动录入。';
    }

    var recent = document.getElementById('mobileRecentTrades');
    if(recent){
      recent.innerHTML = trades.slice(0, 3).map(function(trade){
        return '<div class="mobile-fund-card"><h3>' + escapeHtml(trade.fund || trade.fund_name || '未命名基金') + '</h3><div class="meta"><span>' + escapeHtml(trade.date || trade.trade_date || '') + '</span><strong>' + money(trade.amount) + '</strong></div></div>';
      }).join('') || '<div class="mobile-list-empty">暂无交易记录</div>';
    }

    updateSyncStatus();
  }

  function renderFunds(){
    var list = document.getElementById('mobileFundList');
    if(!list) return;
    var items = getFunds().filter(function(fund){
      var name = fund.name || fund.fund_name || '';
      if(state.filter === 'qdii') return fund.market === 'us' || /QDII|全球|美国|纳斯达克|标普/.test(name);
      if(state.filter === 'cn') return fund.market === 'cn' || /A股|沪深|中证|创业板/.test(name);
      if(state.filter === 'watch') return Boolean(fund.watch || fund.is_watch);
      return true;
    });

    list.innerHTML = items.map(function(fund, index){
      return '<button class="mobile-fund-card" type="button" onclick="MobileDashboard.openFundSheet(' + index + ')"><h3>' + escapeHtml(fund.name || fund.fund_name || '未命名基金') + '</h3><div class="meta"><span>' + money(fund.amount || fund.market_value) + '</span><strong>' + money(fund.hold || fund.profit) + '</strong></div></button>';
    }).join('') || '<div class="mobile-list-empty">暂无持仓，可到「记录」上传截图导入。</div>';
  }

  function renderGoal(){
    var total = getFunds().reduce(function(sum, fund){ return sum + Number(fund.amount || fund.market_value || 0); }, 0);
    var goal = getGoals()[0] || activeAccount() || {};
    var target = normalizeTarget(goal.target || goal.target_amount || goal.targetAmount);
    var monthly = Number(goal.monthly || goal.monthly_invest || goal.monthlyInvest || 0);
    var pct = target > 0 ? Math.min(100, total / target * 100) : 0;

    setText('mobileGoalProgress', pct.toFixed(2) + '%');
    var bar = document.getElementById('mobileGoalBar');
    if(bar) bar.style.width = pct + '%';

    var summary = document.getElementById('mobileGoalSummary');
    if(summary){
      summary.innerHTML = '<div class="mobile-metric"><span>目标金额</span><strong>' + money(target) + '</strong></div><div class="mobile-metric"><span>月投入测算</span><strong>' + money(monthly) + '</strong></div>';
    }
  }

  function renderAll(){
    renderHome();
    renderFunds();
    renderGoal();
  }

  function openFundSheet(index){
    var fund = getFunds()[index];
    var sheet = document.getElementById('mobileSheet');
    if(!fund || !sheet) return;

    sheet.innerHTML = '<h2>' + escapeHtml(fund.name || fund.fund_name || '基金详情') + '</h2><p>代码：' + escapeHtml(fund.code || '-') + '</p><p>金额：' + money(fund.amount || fund.market_value) + '</p><p>份额：' + Number(fund.share || 0).toFixed(4) + '</p><p>持有收益：' + money(fund.hold || fund.profit) + '</p><button class="mobile-primary-button" type="button" onclick="MobileDashboard.closeSheet()">关闭</button>';
    sheet.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');
  }

  function closeSheet(){
    var sheet = document.getElementById('mobileSheet');
    if(sheet){
      sheet.classList.remove('open');
      sheet.setAttribute('aria-hidden', 'true');
    }
  }

  function exportData(){
    try {
      var data = {
        version: 7,
        exportDate: new Date().toISOString(),
        accounts: getAccounts(),
        funds: getFunds(),
        trades: getTrades(),
        goals: getGoals(),
        currentAccountId: typeof window.currentAccountId !== 'undefined' ? window.currentAccountId : null,
        currentAccountIndex: typeof window.currentAccountIndex !== 'undefined' ? window.currentAccountIndex : null,
        currentGoalId: typeof window.currentGoalId !== 'undefined' ? window.currentGoalId : null
      };
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = 'fund-mobile-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      notify('数据已导出到文件');
    } catch(error) {
      notify('导出失败：' + messageOf(error));
    }
  }

  function importData(event){
    var input = event && event.target;
    var file = input && input.files && input.files[0];
    if(!file) return;

    var reader = new FileReader();
    reader.onload = function(loadEvent){
      try {
        var data = JSON.parse(loadEvent.target.result);
        var hasAccounts = Array.isArray(data.accounts);
        var hasGoals = Array.isArray(data.goals);
        if(!hasAccounts && !hasGoals){
          notify('文件格式不正确：缺少 accounts 或 goals 数据');
          return;
        }

        if(hasGoals) setGlobalArray('goals', data.goals);
        if(hasAccounts) setGlobalArray('accounts', data.accounts);
        if(Array.isArray(data.funds)) setGlobalArray('funds', data.funds);
        else setGlobalArray('funds', getFundsFromAccounts(data.accounts));
        if(Array.isArray(data.trades)) setGlobalArray('trades', data.trades);
        else setGlobalArray('trades', getTradesFromAccounts(data.accounts));

        if(data.currentAccountId !== undefined) window.currentAccountId = data.currentAccountId;
        if(data.currentAccountIndex !== undefined) window.currentAccountIndex = data.currentAccountIndex;
        if(data.currentGoalId !== undefined) window.currentGoalId = data.currentGoalId;

        persistLocalData();
        renderAll();
        if(typeof window.syncImportedDataToCloud === 'function') window.syncImportedDataToCloud();
        notify('数据导入成功');
      } catch(error) {
        notify('导入失败：' + messageOf(error));
      } finally {
        if(input) input.value = '';
      }
    };
    reader.readAsText(file);
  }

  function openPrivacyDialog(){
    var sheet = document.getElementById('mobileSheet');
    if(!sheet) return;
    sheet.innerHTML = '<h2>隐私说明</h2>' +
      '<p>本页面优先使用浏览器本地数据，导入、导出和手动记录会保存在当前设备的 localStorage 中。</p>' +
      '<p>截图识别使用浏览器本地 OCR 逻辑，图片仅在本机读取，不会上传到后端 OCR 服务，也不需要任何 OCR 密钥。</p>' +
      '<p>如需云端同步，请在 PC 工作台登录并使用同一浏览器环境；手机端会尽量复用可用的云端写入能力。</p>' +
      '<button class="mobile-primary-button" type="button" onclick="MobileDashboard.closeSheet()">关闭</button>';
    sheet.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');
  }

  async function clearAllUserData(){
    var ok = typeof window.confirm === 'function'
      ? window.confirm('确定删除本机基金目标、持仓和交易数据吗？此操作不可撤销。')
      : true;
    if(!ok) return;

    var oldAccounts = getAccounts().slice();
    var oldFunds = getFunds().slice();
    var oldTrades = getTrades().slice();
    var oldGoals = getGoals().slice();

    for(var v = 1; v <= 7; v++) localStorage.removeItem('fund_goals_v' + v);
    localStorage.removeItem('fund_trades');

    setGlobalArray('funds', []);
    setGlobalArray('trades', []);
    setGlobalArray('goals', []);
    if(Array.isArray(window.accounts)){
      window.accounts.forEach(function(account){
        account.fundsData = [];
        account.tradesData = [];
        account.totalAsset = 0;
        account.holdProfit = 0;
        account.fundCount = 0;
      });
    }

    renderAll();
    notify('本地数据已删除');
    await bestEffortDeleteCloudRecords(oldAccounts, oldFunds, oldTrades, oldGoals);
  }

  function logout(){
    if(typeof window.authLogout === 'function'){
      window.authLogout();
      return;
    }
    window.location.href = 'login.html';
  }

  function handleOcrFiles(files){
    var result = document.getElementById('mobileOcrResult');
    if(!result || !files || !files.length) return;
    state.ocrDraft = null;
    if(typeof callOCRApi !== 'function'){
      result.innerHTML = '<div class="mobile-alert-card">浏览器本地 OCR 尚未加载，请稍后重试。</div>';
      return;
    }
    result.innerHTML = '<div class="mobile-alert-card">浏览器本地 OCR 识别中...</div>';

    Array.from(files).forEach(function(file){
      var reader = new FileReader();
      reader.onload = function(event){
        callOCRApi(event.target.result).then(function(parsed){
          state.ocrDraft = normalizeOcrResult(parsed || {});
          result.innerHTML = renderOcrCards(parsed || {});
        }).catch(function(error){
          state.ocrDraft = null;
          result.innerHTML = '<div class="mobile-alert-card">OCR 失败：' + escapeHtml(error && error.message ? error.message : '请手动录入') + '</div>';
        });
      };
      reader.readAsDataURL(file);
    });
  }

  function normalizeOcrResult(parsed){
    return {
      funds: Array.isArray(parsed.funds) ? parsed.funds : [],
      trades: Array.isArray(parsed.trades) ? parsed.trades : [],
      texts: Array.isArray(parsed.texts) ? parsed.texts : []
    };
  }

  function renderOcrCards(parsed){
    var normalized = normalizeOcrResult(parsed || {});
    var funds = normalized.funds;
    var trades = normalized.trades;
    if(!funds.length && !trades.length) return '<div class="mobile-alert-card">未识别到可导入记录，请手动录入。</div>';
    return '<div class="mobile-alert-card">待确认：' + funds.length + ' 支基金 / ' + trades.length + ' 条交易</div>' +
      funds.map(function(fund){
        return '<div class="mobile-ocr-card"><h3>' + escapeHtml(fund.name || fund.fund_name || '未命名基金') + '</h3><div class="meta"><span>' + escapeHtml(fund.code || '持仓') + '</span><strong>' + money(fund.amount || fund.market_value) + '</strong></div></div>';
      }).join('') +
      trades.map(function(trade){
        return '<div class="mobile-ocr-card"><h3>' + escapeHtml(trade.fund || trade.fund_name || '未命名交易') + '</h3><div class="meta"><span>' + escapeHtml(trade.date || trade.trade_date || '交易') + '</span><strong>' + money(trade.amount) + '</strong></div></div>';
      }).join('') +
      '<button class="mobile-primary-button mobile-ocr-confirm" type="button" onclick="MobileDashboard.confirmOcrImport()">确认导入</button>';
  }

  function confirmOcrImport(){
    var result = document.getElementById('mobileOcrResult');
    var draft = state.ocrDraft || { funds: [], trades: [] };
    var funds = Array.isArray(draft.funds) ? draft.funds : [];
    var trades = Array.isArray(draft.trades) ? draft.trades : [];
    if(!funds.length && !trades.length){
      if(result) result.innerHTML = '<div class="mobile-alert-card">暂无可导入的 OCR 记录，请重新上传截图。</div>';
      return;
    }

    if(!Array.isArray(window.funds)) window.funds = getFunds().slice();
    if(!Array.isArray(window.trades)) window.trades = getTrades().slice();
    funds.forEach(function(fund){ window.funds.unshift(fund); });
    trades.forEach(function(trade){ window.trades.unshift(trade); });
    persistLocalData();

    if(typeof window.syncOcrFundsToCloud === 'function' && funds.length) window.syncOcrFundsToCloud(funds);
    if(typeof window.syncTradeToCloud === 'function') trades.forEach(function(trade){ window.syncTradeToCloud(trade); });

    state.ocrDraft = null;
    renderAll();
    if(result){
      result.innerHTML = '<div class="mobile-alert-card">已导入 ' + funds.length + ' 支基金 / ' + trades.length + ' 条交易。</div>';
    }
  }

  function bindEvents(){
    document.querySelectorAll('[data-mobile-tab]').forEach(function(btn){
      btn.addEventListener('click', function(){ switchTab(btn.dataset.mobileTab); });
    });

    document.querySelectorAll('[data-mobile-filter]').forEach(function(btn){
      btn.addEventListener('click', function(){
        state.filter = btn.dataset.mobileFilter;
        document.querySelectorAll('[data-mobile-filter]').forEach(function(item){
          item.classList.toggle('active', item === btn);
        });
        renderFunds();
      });
    });

    var input = document.getElementById('mobileOcrInput');
    if(input){
      input.addEventListener('change', function(){
        handleOcrFiles(input.files);
        input.value = '';
      });
    }

    var form = document.getElementById('mobileTradeForm');
    if(form){
      form.addEventListener('submit', function(event){
        event.preventDefault();
        var trade = {
          date: valueOf('mobileTradeDate'),
          fund: valueOf('mobileTradeFund').trim(),
          action: valueOf('mobileTradeAction'),
          type: valueOf('mobileTradeAction') === 'sell' ? '卖出' : '买入',
          amount: Number(valueOf('mobileTradeAmount') || 0),
          share: Number(valueOf('mobileTradeShare') || 0),
          nav: 0,
          ftype: 'mixed',
          status: '待确认',
          note: '手机端手动记录'
        };
        if(!Array.isArray(window.trades)) window.trades = getTrades().slice();
        window.trades.unshift(trade);
        persistLocalData();
        if(typeof window.syncTradeToCloud === 'function') window.syncTradeToCloud(trade);
        form.reset();
        renderAll();
        switchTab('home');
      });
    }
  }

  function updateSyncStatus(){
    var badge = document.getElementById('mobileSyncStatus');
    if(!badge) return;
    var synced = typeof window.isCloudWriteReady === 'function' && window.isCloudWriteReady();
    badge.dataset.status = synced ? 'synced' : 'local';
    badge.textContent = synced ? '云端已同步' : '本地保存';
  }

  function calcGoalPct(total){
    var goal = getGoals()[0] || activeAccount() || {};
    var target = normalizeTarget(goal.target || goal.target_amount || goal.targetAmount);
    return target > 0 ? (total / target * 100).toFixed(2) + '%' : '0%';
  }

  function normalizeTarget(value){
    var n = Number(value || 0);
    return n > 0 && n < 10000 ? n * 10000 : n;
  }

  function setGlobalArray(name, value){
    window[name] = Array.isArray(value) ? value : [];
  }

  function getFundsFromAccounts(accounts){
    if(!Array.isArray(accounts)) return [];
    var index = typeof window.currentAccountId !== 'undefined' ? window.currentAccountId : window.currentAccountIndex;
    var account = accounts.find(function(item){ return item && item.id === index; }) || accounts[index] || accounts[0];
    if(!account) return [];
    if(Array.isArray(account.fundsData)) return account.fundsData;
    if(Array.isArray(account.funds)) return account.funds;
    return [];
  }

  function getTradesFromAccounts(accounts){
    if(!Array.isArray(accounts)) return [];
    var index = typeof window.currentAccountId !== 'undefined' ? window.currentAccountId : window.currentAccountIndex;
    var account = accounts.find(function(item){ return item && item.id === index; }) || accounts[index] || accounts[0];
    if(!account) return [];
    if(Array.isArray(account.tradesData)) return account.tradesData;
    if(Array.isArray(account.trades)) return account.trades;
    return [];
  }

  function persistLocalData(){
    try {
      localStorage.setItem('fund_goals_v7', JSON.stringify(getGoals()));
      localStorage.setItem('fund_trades', JSON.stringify(getTrades()));
    } catch(error) {
      notify('本地保存失败：' + messageOf(error));
    }
  }

  async function bestEffortDeleteCloudRecords(accounts, funds, trades, goals){
    if(typeof window.isCloudWriteReady === 'function' && !window.isCloudWriteReady()) return;
    var tasks = [];
    if(typeof window.dbDeleteTrade === 'function'){
      trades.forEach(function(trade){ if(trade && trade._dbId) tasks.push(window.dbDeleteTrade(trade._dbId)); });
      accounts.forEach(function(account){
        (account && account.tradesData || []).forEach(function(trade){ if(trade && trade._dbId) tasks.push(window.dbDeleteTrade(trade._dbId)); });
      });
    }
    if(typeof window.dbDeleteFund === 'function'){
      funds.forEach(function(fund){ if(fund && fund._dbId) tasks.push(window.dbDeleteFund(fund._dbId)); });
      accounts.forEach(function(account){
        (account && account.fundsData || []).forEach(function(fund){ if(fund && fund._dbId) tasks.push(window.dbDeleteFund(fund._dbId)); });
      });
    }
    if(typeof window.dbDeleteGoal === 'function'){
      goals.forEach(function(goal){ if(goal && goal._dbId) tasks.push(window.dbDeleteGoal(goal._dbId)); });
    }
    if(typeof window.dbDeleteAccount === 'function'){
      accounts.forEach(function(account){ if(account && account._dbId) tasks.push(window.dbDeleteAccount(account._dbId)); });
    }
    try {
      await Promise.all(tasks.map(function(task){ return Promise.resolve(task).catch(function(){}); }));
    } catch(error) {
      console.warn('[MobileDashboard] 云端删除失败', error);
    }
  }

  function notify(message){
    if(typeof window.showToast === 'function') window.showToast(message, 'info', 3000);
    else console.log('[MobileDashboard] ' + message);
  }

  function messageOf(error){
    return error && error.message ? error.message : String(error || '未知错误');
  }

  function setText(id, text){
    var el = document.getElementById(id);
    if(el) el.textContent = text;
  }

  function valueOf(id){
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  function escapeHtml(value){
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function init(){
    bindEvents();
    renderAll();
  }

  window.MobileDashboard = {
    init: init,
    switchTab: switchTab,
    renderAll: renderAll,
    openFundSheet: openFundSheet,
    closeSheet: closeSheet,
    exportData: exportData,
    importData: importData,
    openPrivacyDialog: openPrivacyDialog,
    clearAllUserData: clearAllUserData,
    logout: logout,
    handleOcrFiles: handleOcrFiles,
    confirmOcrImport: confirmOcrImport
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
