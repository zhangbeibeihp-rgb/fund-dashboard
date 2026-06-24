# 基金组合管理仪表盘 - 安装指南

## 概述

本指南帮助你完成 Supabase 后端配置，实现多设备数据同步。

**预计耗时：15 分钟**

---

## 第 1 步：注册 Supabase（2 分钟）

1. 打开 https://supabase.com
2. 点击 "Start your project" 注册账号（支持 GitHub 登录）
3. 点击 "New Project" 创建新项目
4. 填写项目名称（如 `fund-dashboard`）
5. 设置数据库密码（记住它）
6. 选择区域：Northeast Asia (Tokyo) 或 Southeast Asia (Singapore)
7. 点击 "Create new project"，等待约 2 分钟初始化

---

## 第 2 步：执行数据库脚本（3 分钟）

1. 在 Supabase Dashboard 左侧菜单点击 **SQL Editor**
2. 点击 "New query"
3. 复制 `sql/001_schema.sql` 全部内容，粘贴到编辑器
4. 点击 "Run"（Ctrl+Enter）
5. 再创建一个新 query，复制 `sql/002_rls.sql` 全部内容，粘贴
6. 点击 "Run"

确认看到 "Success" 提示。

---

## 第 3 步：获取 API 密钥（1 分钟）

1. 在 Supabase Dashboard 左侧菜单点击 **Settings**（齿轮图标）
2. 点击 **API**
3. 找到以下两个值：
   - **Project URL**：`https://xxxxx.supabase.co`
   - **anon public** key：一长串字符

---

## 第 4 步：配置 config.js（1 分钟）

1. 打开 `src/config.js`
2. 替换为你的实际值：

```javascript
const SUPABASE_CONFIG = {
  url: 'https://你的项目ID.supabase.co',
  anonKey: '你的anon_key'
};
```

3. 保存文件

---

## 第 5 步：部署（5 分钟）

### 方式 A：Vercel（推荐，免费）

1. 将整个项目文件夹上传到 GitHub
2. 去 https://vercel.com 创建账号
3. "New Project" → 导入 GitHub 仓库
4. Framework 选 "Other"，直接 Deploy
5. 部署完成后拿到网址（如 `https://fund-dashboard.vercel.app`）

### 方式 B：本地运行

直接用浏览器打开 `login.html` 即可（需用 http 服务而非 file 协议）：

```bash
# Python
python -m http.server 8080

# Node
npx serve .
```

然后访问 `http://localhost:8080/login.html`

---

## 第 6 步：注册账号 + 安装为 APP（3 分钟）

1. 打开部署后的网址，进入登录页面
2. 切换到"注册"标签，填写邮箱和密码
3. 注册成功后自动跳转到仪表盘
4. **安装为 APP**：
   - **手机 Chrome**：菜单 → "添加到主屏幕"
   - **手机 Safari**：分享 → "添加到主屏幕"
   - **电脑 Chrome**：地址栏右侧安装图标 → "安装"
5. 安装后从桌面图标打开即为全屏 APP 体验

---

## 数据同步说明

- **自动同步**：所有操作（修改目标、切换账号等）自动保存到云端
- **实时同步**：电脑端修改后，手机端 1-2 秒内自动更新
- **离线模式**：断网时仍可查看数据，联网后自动同步
- **降级模式**：Supabase 未配置时，自动回退到 localStorage 本地存储

---

## 常见问题

### Q: 注册后提示"请检查邮箱确认链接"
A: Supabase 默认开启邮箱确认。去 Settings → Authentication →关闭 "Confirm email" 即可直接登录。

### Q: 图表显示空白
A: 检查浏览器控制台是否有报错。首次登录会自动创建默认账号，但持仓数据为空。可在仪表盘中手动添加基金。

### Q: 手机上打开是离线模式
A: 确保手机访问的是部署后的网址（如 vercel.app），而非本地文件。检查 `src/config.js` 是否已正确配置。

### Q: 想导入现有持仓数据
A: 在仪表盘中使用"📥导入"功能，上传之前导出的 JSON 文件。导入的数据会自动同步到云端。

---

## 文件结构

```
项目根目录/
├── portfolio-rebalance-dashboard.html  # 主仪表盘
├── login.html                          # 登录/注册页
├── manifest.json                       # PWA 配置
├── SETUP.md                            # 本文件
├── src/
│   ├── config.js                       # Supabase 配置（需编辑）
│   ├── supabase.js                     # 客户端初始化
│   ├── auth.js                         # 认证模块
│   ├── data-layer.js                   # 数据 CRUD
│   ├── realtime.js                     # 实时同步
│   └── app-init.js                     # 应用初始化
└── sql/
    ├── 001_schema.sql                  # 数据库建表脚本
    └── 002_rls.sql                     # 行级安全策略
```

---

## 下一步

- [ ] 在仪表盘中添加你的实际基金持仓
- [ ] 设置投资目标和定投计划
- [ ] 在手机上安装为 APP
- [ ] 体验多设备实时同步
