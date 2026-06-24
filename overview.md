# Phase 1 完成概要 — Supabase 后端搭建

## 完成内容

### 数据库层（SQL）
- **sql/001_schema.sql** — 5 张表（profiles/accounts/funds/goals/trades）+ 索引 + 触发器 + Realtime 启用 + v3 迁移脚本
- **sql/002_rls.sql** — 行级安全策略，每个用户只能访问自己的数据

### 后端模块（src/）
| 文件 | 功能 | 行数 |
|------|------|------|
| config.js | Supabase 配置（用户填入密钥） | ~20行 |
| supabase.js | 客户端初始化 + 3级CDN回退 | ~65行 |
| auth.js | 登录/注册/登出/会话管理/认证守卫 + showLogoutBtn | ~95行 |
| data-layer.js | 全表 CRUD + 新用户种子数据（含v3字段） | ~185行 |
| realtime.js | 4表实时订阅 + 防抖刷新 | ~100行 |
| app-init.js | 主入口：认证→加载→覆写→重渲染→保存钩子→实时同步 | ~380行 |

### 前端改动
- **login.html** — 独立登录/注册页面（暗色主题 + Tab切换 + 错误提示）
- **portfolio-rebalance-dashboard.html** — 3 处改动：
  1. manifest 从内联改为外部 manifest.json
  2. Header 新增 🚪退出按钮（登录后显示）
  3. `</body>` 前加载 6 个 Supabase 模块脚本
- **manifest.json** — PWA 配置（standalone + 图标）
- **SETUP.md** — 6 步安装指南（15分钟完成）

## v3 修复项（2026-06-23）
1. **SQL funds 表**新增字段：code/market/ref/nav_lag/nav_status/est_change（共6个），含 ALTER TABLE 迁移脚本
2. **SQL trades 表**新增字段：fund_type/nav
3. **data-layer.js dbSaveFund** 更新：包含新增6字段
4. **data-layer.js dbSaveTrade** 更新：包含新增2字段
5. **app-init.js applyCloudData** 更新：funds/trades/accounts 转换包含全部新增字段
6. **auth.js** 新增 showLogoutBtn/hideLogoutBtn 函数

## 工作流程

```
用户打开仪表盘
  ↓
内联脚本用硬编码数据初始化（离线降级模式）
  ↓
app-init.js 加载
  ↓
检查 Supabase 是否配置？
  ├─ 否 → 保持 localStorage 模式，功能不受影响
  └─ 是 → 检查认证
      ├─ 未登录 → 跳转 login.html
      └─ 已登录 → 加载云端数据 → 覆写全局变量 → 销毁旧图表 → 重新渲染 → 设置保存钩子 → 建立实时订阅
```

## 数据同步机制
- **写入**：saveGoals() 同时写 localStorage + Supabase
- **读取**：优先从 Supabase 加载，localStorage 作为降级备份
- **实时**：Supabase Realtime 监听 4 张表变化 → 500ms 防抖 → 重新加载+渲染
- **防循环**：`__isSyncing` 标志位防止实时回调触发再次同步

## 用户下一步
1. 注册 Supabase 账号 → 创建项目
2. 执行 SQL 脚本（001 + 002）
3. 编辑 src/config.js 填入密钥
4. 部署到 Vercel 或本地运行
5. 注册账号 → 安装为 PWA
