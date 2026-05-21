# 🚀 GitHub Pages 部署完整指南

## 📋 部署前准备

### 1. 配置百度统计（如果还没做）

在 `lottery-app` 目录创建 `.env` 文件：

```env
VITE_BAIDU_TONGJI_ID=您的站点ID
```

### 2. 重新编译项目

```bash
cd d:\0.Code\0.发财大计\lottery-app
npm run build
```

---

## 🎯 方法一：使用 GitHub Actions（推荐）⭐

我已经为您配置好了自动部署，只需以下步骤：

### **步骤 1：初始化 Git 仓库**

```bash
cd d:\0.Code\0.发财大计
git init
git add .
git commit -m "Initial commit with analytics"
```

### **步骤 2：创建 GitHub 仓库**

1. 访问 https://github.com/new
2. 填写信息：
   - **Repository name**: `lottery-app`（或其他您喜欢的名字）
   - **Public/Private**: 选择 **Public**（GitHub Pages 免费需要公开仓库）
   - 不要勾选 Initialize with README
3. 点击 **Create repository**

### **步骤 3：推送代码到 GitHub**

```bash
git remote add origin https://github.com/wangzhengwei-gua/lottery-app.git
git branch -M main
git push -u origin main
```

⚠️ **注意**：将 `lottery-app` 替换为您实际创建的仓库名

### **步骤 4：启用 GitHub Pages**

1. 进入您的仓库页面
2. 点击 **Settings**（设置）
3. 左侧菜单找到 **Pages**
4. 在 **Build and deployment** 部分：
   - **Source**: 选择 **GitHub Actions**
5. 等待几分钟，Actions 会自动运行

### **步骤 5：查看部署状态**

1. 点击仓库顶部的 **Actions** 标签
2. 查看最新的 workflow 运行状态
3. 绿色 ✓ 表示成功，红色 ✗ 表示失败

### **步骤 6：访问您的网站**

部署成功后，您的网站地址是：
```
https://wangzhengwei-gua.github.io/lottery-app/
```

---

## 🎯 方法二：手动部署（备选）

如果您不想使用 GitHub Actions，可以手动部署：

### **步骤 1：创建 gh-pages 分支**

```bash
cd d:\0.Code\0.发财大计\lottery-app

# 确保已编译
npm run build

# 创建并切换到 gh-pages 分支
git checkout --orphan gh-pages

# 只添加 dist 目录的内容
git add -f dist

# 提交
git commit -m "Deploy to GitHub Pages"

# 推送到 GitHub
git push -f origin gh-pages
```

### **步骤 2：启用 GitHub Pages**

1. 进入仓库 **Settings** → **Pages**
2. **Source**: 选择 **Deploy from a branch**
3. **Branch**: 选择 `gh-pages`，文件夹选 `/ (root)`
4. 点击 **Save**

---

## 🔧 常见问题解决

### **问题 1：Actions 运行失败**

**检查点：**
1. 确认 `.github/workflows/deploy.yml` 文件存在
2. 确认 `lottery-app/package.json` 中有 `build` 脚本
3. 查看 Actions 日志，找到错误信息

**常见错误：**
- Node.js 版本问题：确保使用 Node.js 22
- 依赖安装失败：检查 `package-lock.json` 是否存在

### **问题 2：部署后访问 404**

**原因：** Vite 的 base 路径配置问题

**解决：**
已为您配置好 `vite.config.js` 中的 `base: './'`，应该没问题。

如果还是 404，检查：
1. 仓库名是否正确（区分大小写）
2. 是否等待了足够时间（首次部署可能需要 5-10 分钟）

### **问题 3：百度统计不工作**

**检查清单：**
1. ✅ `.env` 文件已创建且 ID 正确
2. ✅ 已重新编译（`npm run build`）
3. ✅ 已部署最新版本
4. ✅ 清除浏览器缓存后访问
5. ✅ 在百度统计后台看到实时数据

**调试方法：**
1. 打开浏览器开发者工具（F12）
2. 切换到 Network 标签
3. 刷新页面
4. 搜索 `hm.js`
5. 应该能看到请求成功（状态码 200）

### **问题 4：自定义域名**

如果想使用自己的域名（例如：`lottery.yourdomain.com`）：

1. 在仓库根目录创建 `CNAME` 文件：
   ```
   lottery.yourdomain.com
   ```

2. 在域名服务商处添加 CNAME 记录：
   ```
   主机记录：lottery
   记录类型：CNAME
   记录值：wangzhengwei-gua.github.io
   ```

3. 在 GitHub Pages 设置中添加自定义域名

---

## 📊 验证部署

### **1. 访问网站**
```
https://wangzhengwei-gua.github.io/lottery-app/
```

### **2. 测试功能**
- ✅ 页面正常加载
- ✅ 可以生成号码
- ✅ 可以复制结果
- ✅ 可以保存文件

### **3. 检查百度统计**
1. 访问 https://tongji.baidu.com
2. 点击"实时访客"
3. 应该能看到自己的访问记录
4. 显示"当前在线：1人"

### **4. 查看事件追踪**
1. 在网站上生成几次号码
2. 点击复制按钮
3. 回到百度统计
4. 进入"报告" → "事件分析"
5. 应该能看到触发的事件

---

## 🔄 后续更新

每次修改代码后：

```bash
# 1. 提交更改
git add .
git commit -m "更新内容描述"
git push

# 2. GitHub Actions 会自动重新部署
# 3. 等待 2-3 分钟
# 4. 刷新网站查看更新
```

---

## 💡 优化建议

### **1. 添加 .gitignore**

在根目录创建 `.gitignore` 文件：

```gitignore
# 依赖
node_modules/

# 环境变量（重要！不要上传）
.env

# 构建输出
dist/

# 系统文件
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# Python
*.pyc
__pycache__/
```

### **2. 保护敏感信息**

`.env` 文件包含您的百度统计 ID，虽然这个 ID 是公开的，但最好还是：

1. 确保 `.env` 在 `.gitignore` 中
2. 在 GitHub Settings → Secrets 中添加环境变量
3. 修改 `.github/workflows/deploy.yml` 使用 secrets

### **3. 添加 README**

在项目根目录创建 `README.md`，介绍您的项目。

---

## 📱 移动端适配

您的应用已经做了响应式设计，在手机上也很好看：
- ✅ 自适应布局
- ✅ 触摸友好的按钮
- ✅ 合适的字体大小

---

## 🎉 完成！

部署成功后，您可以：

✅ 分享链接给朋友使用  
✅ 在百度统计查看用户数据  
✅ 持续优化和改进功能  
✅ 收集用户反馈  

**您的网站地址：**
```
https://wangzhengwei-gua.github.io/lottery-app/
```

祝您部署顺利！🚀✨
