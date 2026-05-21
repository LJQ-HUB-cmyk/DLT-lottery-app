# 🚀 5分钟快速配置数据统计

## 第一步：获取 Google Analytics ID（2分钟）

1. 访问 https://analytics.google.com
2. 点击"开始衡量" → 创建账号
3. 创建媒体资源，获取测量 ID（格式：`G-XXXXXXXXXX`）

## 第二步：配置项目（1分钟）

在 `lottery-app` 目录下创建 `.env` 文件：

```env
VITE_GA_MEASUREMENT_ID=G-您的实际ID
```

**示例：**
```env
VITE_GA_MEASUREMENT_ID=G-ABC123XYZ
```

## 第三步：重新编译（1分钟）

```bash
cd d:\0.Code\0.发财大计\lottery-app
npm run build
```

## 第四步：部署并验证（1分钟）

1. 部署到 GitHub Pages / Vercel / Cloudflare
2. 访问您的网站
3. 在 Google Analytics 的"实时"报告中看到自己的访问

## ✅ 完成！

现在您可以追踪：
- 👥 有多少用户访问
- 🖱️ 生成了多少次号码
- 📋 复制了多少次结果
- 💾 保存了多少次文件
- 📊 哪个模型最受欢迎

---

## 📈 查看数据

登录 https://analytics.google.com

### 实时数据
报告 → 实时（显示当前在线用户）

### 用户统计
报告 → 用户 → 用户属性（查看用户数量、设备等）

### 事件统计
报告 → 互动 → 事件（查看各种操作次数）

---

## 💡 提示

- 数据会有 24-48 小时延迟（实时数据除外）
- 免费额度：每月 1000 万次事件（完全够用）
- 详细文档请查看 `ANALYTICS.md`
