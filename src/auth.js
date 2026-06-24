// ============================================================
// 认证模块
// 处理登录、注册、登出、会话管理
// ============================================================

let currentUser = null;

// 获取当前会话
async function authGetSession() {
  if (!supabaseClient) return null;
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session;
}

// 获取当前用户
async function authGetCurrentUser() {
  if (!supabaseClient) return null;
  const { data: { user } } = await supabaseClient.auth.getUser();
  currentUser = user;
  return user;
}

// 登录
async function authLogin(email, password) {
  if (!supabaseClient) throw new Error('Supabase 未初始化');
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: email.trim(),
    password: password
  });
  if (error) throw error;
  currentUser = data.user;
  return data.user;
}

// 注册
async function authRegister(email, password, username) {
  if (!supabaseClient) throw new Error('Supabase 未初始化');
  const { data, error } = await supabaseClient.auth.signUp({
    email: email.trim(),
    password: password,
    options: {
      data: { username: username || '投资者' }
    }
  });
  if (error) throw error;
  return data;
}

// 登出
async function authLogout() {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
  currentUser = null;
  window.location.href = 'login.html';
}

// 监听认证状态变化
function authOnAuthChange(callback) {
  if (!supabaseClient) return;
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      currentUser = null;
      window.location.href = 'login.html';
    } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      currentUser = session.user;
      callback(session.user);
    }
  });
}

// 检查认证状态，未登录则跳转
async function authGuard() {
  const session = await authGetSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  const user = await authGetCurrentUser();
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }
  return user;
}

// ===== 显示/隐藏退出登录按钮 =====
function showLogoutBtn() {
  const btn = document.getElementById('logoutBtn');
  if (btn) btn.style.display = 'inline-flex';
}

function hideLogoutBtn() {
  const btn = document.getElementById('logoutBtn');
  if (btn) btn.style.display = 'none';
}
