// ============================================================
// Supabase 配置文件
//
// 使用方法：
// 1. 去 https://supabase.com 注册账号，创建新项目
// 2. 在项目设置 → API 中找到 URL 和 anon key
// 3. 替换下方两个值
// ============================================================

const SUPABASE_CONFIG = {
  // 在 Supabase Dashboard → Settings → API → Project URL
  // 注意：只填项目根 URL，不要加 /rest/v1/
  url: 'https://ndjvbsqqoffyaliakyag.supabase.co',

  // 在 Supabase Dashboard → Settings → API → Project API Keys → anon public
  anonKey: 'sb_publishable_jpjxJpBgJXpv9GqwjEpbng_kueteKvF'
};

// 检查是否已配置
function isSupabaseConfigured() {
  return SUPABASE_CONFIG.url !== 'https://YOUR_PROJECT_ID.supabase.co'
    && SUPABASE_CONFIG.anonKey !== 'YOUR_ANON_KEY'
    && SUPABASE_CONFIG.url.startsWith('https://');
}
