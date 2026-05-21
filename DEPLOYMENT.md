# 🚀 部署指南

本文档提供多种免费部署方案，您可以根据需要选择。

---

## 方案一：GitHub Pages（推荐）⭐⭐

### 优点
- ✅ 完全免费，无流量限制
- ✅ 自动 CI/CD，推送代码即部署
- ✅ 与 GitHub 深度集成
- ✅ 支持自定义域名

### 部署步骤

#### 1. 初始化 Git 仓库（如果还没有）
```bash
cd d:\0.Code\0.发财大计
git init
git add .
git commit -m "Initial commit"
```

#### 2. 创建 GitHub 仓库
1. 访问 https://github.com/new
2. 创建一个新的公开仓库（例如：`lottery-app`）
3. 不要初始化 README、.gitignore 或 license

#### 3. 推送代码到 GitHub
```bash
git remote add origin https://github.com/你的用户名/lottery-app.git
git branch -M main
git push -u origin main
```

#### 4. 启用 GitHub Pages
1. 进入仓库的 **Settings** → **Pages**
2. 在 **Build and deployment** 部分：
   - Source: 选择 **GitHub Actions**
3. 等待几分钟，Actions 会自动运行

#### 5. 查看部署结果
- 您的网站将发布在：`https://你的用户名.github.io/lottery-app/`
- 可以在 **Settings** → **Pages** 中查看部署状态

### 后续更新
只需推送代码到 `main` 分支，GitHub Actions 会自动重新部署！

```bash
git add .
git commit -m "更新内容"
git push
```

---

## 方案二：Vercel（推荐）⭐

### 优点
- ✅ 完全免费，个人使用无限制
- ✅ 全球 CDN，访问速度快
- ✅ 自动 HTTPS
- ✅ 优秀的开发者体验

### 部署步骤

#### 方法 A：通过网页部署（最简单）

1. **注册/登录 Vercel**
   - 访问 https://vercel.com
   - 使用 GitHub/GitLab/Bitbucket 账号登录

2. **导入项目**
   - 点击 **"New Project"**
   - 选择您的 Git 仓库
   - 点击 **"Import"**

3. **配置构建设置**
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `lottery-app/dist`
   - Install Command: `npm install`

4. **部署**
   - 点击 **"Deploy"**
   - 等待 1-2 分钟完成

5. **访问网站**
   - 您会获得一个类似 `https://lottery-app-xxx.vercel.app` 的域名

#### 方法 B：通过 CLI 部署

```bash
# 1. 安装 Vercel CLI
npm install -g vercel

# 2. 登录
vercel login

# 3. 进入项目目录
cd d:\0.Code\0.发财大计\lottery-app

# 4. 部署
vercel

# 5. 生产环境部署
vercel --prod
```

### 后续更新
- **网页部署**：推送代码到 Git 后自动部署
- **CLI 部署**：运行 `vercel --prod`

---

## 方案三：Cloudflare Pages

### 优点
- ✅ 完全免费，无限带宽
- ✅ 全球 CDN，速度极快
- ✅ 内置 DDoS 保护

### 部署步骤

1. **注册 Cloudflare**
   - 访问 https://pages.cloudflare.com
   - 使用 GitHub 账号登录

2. **创建新项目**
   - 点击 **"Create a project"**
   - 连接您的 GitHub 仓库

3. **配置构建**
   - Build command: `npm run build`
   - Build output directory: `lottery-app/dist`
   - Node.js version: `22`

4. **部署**
   - 点击 **"Save and Deploy"**

---

## 方案四：Netlify（备选）

如果您的 Netlify 只是临时暂停，可以：

### 恢复方法
1. 升级到付费计划
2. 或者等待下个周期重置

### 或者创建新账号
- 使用不同的邮箱注册新账号
- 每个账号都有免费的额度

---

## 方案五：静态文件托管服务

### 选项列表
- **Firebase Hosting**：https://firebase.google.com/products/hosting
- **Surge.sh**：https://surge.sh
- **Render**：https://render.com
- **Fly.io**：https://fly.io

---

## 📊 方案对比

| 特性 | GitHub Pages | Vercel | Cloudflare | Netlify |
|------|-------------|--------|------------|---------|
| **免费额度** | 无限 | 充足 | 无限 | 有限 |
| **自动部署** | ✅ | ✅ | ✅ | ✅ |
| **自定义域名** | ✅ | ✅ | ✅ | ✅ |
| **HTTPS** | ✅ | ✅ | ✅ | ✅ |
| **CDN** | ✅ | ✅ | ✅✅ | ✅ |
| **部署速度** | 中等 | 快速 | 快速 | 快速 |
| **易用性** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 💡 推荐建议

### 如果您追求简单快捷
→ 选择 **Vercel**（网页部署，3分钟搞定）

### 如果您已经使用 GitHub
→ 选择 **GitHub Pages**（已配置好 Actions，推送即部署）

### 如果您需要最佳性能
→ 选择 **Cloudflare Pages**（全球 CDN，速度最快）

### 如果您喜欢 Netlify
→ 等待额度重置或升级计划

---

## 🔧 常见问题

### Q: 如何绑定自定义域名？
A: 所有平台都支持，在设置中添加域名并按提示配置 DNS 即可。

### Q: 部署后访问 404？
A: 检查 `vite.config.js` 中的 `base` 配置，确保设置为 `'./'`。

### Q: 如何查看部署日志？
A: 
- GitHub Pages: Actions 标签页
- Vercel: Deployments 页面
- Cloudflare: Builds 页面

### Q: 可以回滚到之前的版本吗？
A: 所有平台都支持版本回滚，在部署历史中选择旧版本即可。

---

## 📝 快速开始（GitHub Pages）

我已经为您配置好了 GitHub Actions，只需：

```bash
# 1. 初始化 Git（如果还没有）
cd d:\0.Code\0.发财大计
git init
git add .
git commit -m "Initial commit"

# 2. 创建 GitHub 仓库并推送
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main

# 3. 在 GitHub 仓库设置中启用 Pages（选择 GitHub Actions）
```

就这么简单！🎉
