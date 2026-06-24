// ============================================================
// Supabase 客户端初始化
// 从 CDN 加载 Supabase JS SDK 并创建客户端实例
// ============================================================

let supabaseClient = null;

// 多 CDN 回退加载
function loadSupabaseSDK() {
  return new Promise((resolve, reject) => {
    if (window.supabase) {
      resolve(window.supabase);
      return;
    }

    const CDNS = [
      'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js',
      'https://unpkg.com/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/supabase-js/2.45.4/supabase.min.js'
    ];

    let tryIndex = 0;

    function tryLoad() {
      if (tryIndex >= CDNS.length) {
        reject(new Error('所有 CDN 加载失败，请检查网络连接'));
        return;
      }

      const script = document.createElement('script');
      script.src = CDNS[tryIndex];
      script.onload = () => {
        if (window.supabase) {
          resolve(window.supabase);
        } else {
          tryIndex++;
          tryLoad();
        }
      };
      script.onerror = () => {
        tryIndex++;
        tryLoad();
      };
      document.head.appendChild(script);
    }

    tryLoad();
  });
}

// 初始化 Supabase 客户端
async function initSupabase() {
  if (!isSupabaseConfigured()) {
    console.warn('[Supabase] 配置未完成，请编辑 src/config.js 填入你的项目 URL 和 anon key');
    return null;
  }

  try {
    const supabase = await loadSupabaseSDK();
    supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      realtime: {
        params: { eventsPerSecond: 2 }
      }
    });
    console.log('[Supabase] 客户端初始化成功');
    return supabaseClient;
  } catch (e) {
    console.error('[Supabase] 初始化失败:', e);
    return null;
  }
}
