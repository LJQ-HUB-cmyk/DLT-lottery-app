# Netlify 快速部署指南

## 方法一：拖拽部署（最简单）

1. 在项目根目录运行构建命令：
   ```powershell
   cd lottery-app
   npm run build
   ```

2. 构建完成后，会生成 `dist` 文件夹

3. 访问：https://app.netlify.com/drop

4. 将 `dist` 文件夹直接拖拽到网页上的虚线框内

5. 等待几秒钟，即可获得访问链接（例如：https://random-name.netlify.app）

6. 点击 "Site settings" → "Change site name" 可以自定义域名

## 方法二：Git 部署（推荐，支持自动更新）

1. 将项目推送到 GitHub：
   ```powershell
   git init
   git add .
   git commit -m "initial commit"
   git branch -M main
   git remote add origin https://github.com/你的用户名/lottery-app.git
   git push -u origin main
   ```

2. 访问：https://app.netlify.com/start

3. 点击 "New site from Git" → 选择 GitHub → 授权 → 选择项目

4. 配置保持不变，点击 "Deploy site"

5. 每次推送到 GitHub 的 main 分支，Netlify 会自动重新部署

## 自定义域名（可选）

1. 在 Netlify 控制台进入 "Domain settings"
2. 点击 "Add custom domain"
3. 输入你的域名（如：lottery.example.com）
4. 按照提示配置 DNS 记录

## 注意事项

- 免费套餐每月有 100GB 带宽限制
- 支持 HTTPS（自动配置）
- 全球 CDN 加速
- 数据保存在用户浏览器本地（localStorage），不同用户之间不共享

## 如果数据需要云端同步

当前版本的数据保存在每个用户的浏览器本地。如果需要所有用户共享同一份数据，需要：
1. 部署后端 API（如使用 Vercel Serverless Functions）
2. 使用数据库（如 Supabase、Firebase）
3. 修改前端代码，将 localStorage 替换为 API 调用
