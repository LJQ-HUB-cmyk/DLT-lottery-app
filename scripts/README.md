# 大乐透自动爬取脚本

## 📋 功能说明

自动爬取中国体育彩票大乐透（超级大乐透）的开奖结果，并更新到历史数据文件中。

### 开奖时间
- **每周一、三、六** 晚上 21:30 开奖
- 脚本在开奖后 30 分钟（22:00）自动执行

### 数据来源
- 500.com 体彩大乐透频道
- URL: http://kaijiang.500.com/shtml/dlt.shtml

## 🚀 使用方法

### 本地测试

```bash
# 1. 安装依赖
pip install -r scripts/requirements.txt

# 2. 运行测试脚本（不会修改文件）
python test_crawler.py
```

### 手动执行爬取

```bash
# 直接运行爬虫脚本
python scripts/crawl_lottery.py
```

### GitHub Actions 自动执行

工作流配置在 `.github/workflows/auto-crawl-lottery.yml`

#### 定时执行
- 每周一、三、六 22:00 (UTC+8) 自动执行
- Cron 表达式: `0 14 * * 1,3,6` (UTC 时间 14:00)

#### 手动触发
1. 进入 GitHub Actions 页面
2. 选择 "Auto Crawl Lottery Results" 工作流
3. 点击 "Run workflow"
4. 可选择测试模式（不提交更改）

## 📁 文件结构

```
.
├── scripts/
│   ├── crawl_lottery.py      # 主爬虫脚本
│   └── requirements.txt       # Python 依赖
├── .github/
│   └── workflows/
│       └── auto-crawl-lottery.yml  # GitHub Actions 配置
├── test_crawler.py            # 本地测试脚本
└── lottery-app/
    └── src/
        └── data/
            └── lottery-history.txt  # 历史数据文件（自动更新）
```

## 🔧 技术实现

### 爬虫逻辑
1. 访问 500.com 获取最新期号
2. 解析期号对应的开奖页面
3. 提取前区 5 个号码和后区 2 个号码
4. 格式化为标准格式：`XX XX XX XX XX XX XX`
5. 检查是否已存在于历史文件
6. 如为新数据，追加到文件末尾

### 数据格式
```
07 09 23 27 32 02 08
```
- 前 5 个数字：前区号码（01-35）
- 后 2 个数字：后区号码（01-12）
- 所有数字均为两位数，不足补零

## ⚠️ 注意事项

1. **反爬机制**: 500.com 可能有反爬措施，如遇到失败请调整请求频率
2. **页面结构变化**: 如果网站改版，需要更新 CSS 选择器
3. **网络问题**: GitHub Actions 需要能访问 500.com
4. **时区设置**: Cron 使用 UTC 时间，已转换为北京时间 22:00

## 🐛 故障排查

### 爬取失败
- 检查网络连接
- 验证 500.com 网站是否可访问
- 查看 GitHub Actions 日志获取详细错误信息

### 数据格式错误
- 检查历史文件格式是否正确
- 确认号码提取逻辑与网页结构匹配
- 手动访问目标 URL 验证页面结构

### 未自动执行
- 检查 GitHub Actions 是否启用
- 验证 cron 表达式是否正确
- 查看工作流运行历史

## 📝 开发计划

- [ ] 支持多个数据源（提高稳定性）
- [ ] 添加邮件/通知提醒
- [ ] 数据验证和去重优化
- [ ] 支持更多彩种（双色球等）
- [ ] 添加数据统计和分析功能

## 📄 许可证

本项目仅供学习和个人使用，请遵守相关法律法规。
