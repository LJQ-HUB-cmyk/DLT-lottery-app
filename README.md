# 发财大计 - 智能彩票预测

一个基于多种算法模型的彩票号码预测工具，部署在 GitHub Pages。

## 🌐 在线访问

https://wangzhengwei-gua.github.io/lottery-app/

## 🚀 一键部署

修改代码后，运行：

```bash
.\deploy.bat
```

或手动执行：

```bash
git add .
git commit -m "更新说明"
git push origin main
```

GitHub Actions 会自动构建并部署（约 2-3 分钟）。

## 📊 数据统计

已集成百度统计，可以追踪：
- 用户访问量和来源
- 设备信息（手机/电脑、浏览器）
- 用户行为（生成、复制、保存操作）

百度统计后台：https://tongji.baidu.com

## 🛠️ 技术栈

- React + Vite
- GitHub Pages（部署）
- GitHub Actions（CI/CD）
- 百度统计（用户分析）

## 📝 项目结构

```
.
├── .github/workflows/    # GitHub Actions 部署配置
├── lottery-app/          # 主项目目录
│   ├── src/              # 源代码
│   ├── public/           # 静态资源
│   ├── .env              # 环境变量（百度统计 ID）
│   └── ...
├── .gitignore            # Git 忽略配置
├── deploy.bat            # 一键部署脚本
└── cleanup.bat           # 清理脚本（已使用）
```

##  许可证

MIT
