# 多数据源彩票爬虫系统

## 📋 功能说明

这是一套完整的彩票数据自动化采集系统，支持：
- **多彩种**: 大乐透 (DLT) 和 双色球 (SSQ)
- **多数据源**: 每个彩种多个备用数据源
- **自动切换**: 数据源不可用时自动切换
- **智能备份**: 所有获取的数据自动备份
- **状态报告**: 实时数据源健康状况

## 🚀 快速开始

### 本地测试

```bash
# 1. 安装依赖
pip install -r scripts/requirements.txt

# 2. 爬取所有彩种
python scripts/crawl_universal.py

# 3. 爬取特定彩种
python scripts/crawl_universal.py --type dlt    # 大乐透
python scripts/crawl_universal.py --type ssq    # 双色球

# 4. 查看数据源状态
python scripts/data_source_manager.py
```

### GitHub Actions 自动执行

#### 方式 1: 定时执行
配置文件在 `scripts/auto-crawl-multi-lottery.yml`（需要手动复制到 `.github/workflows/`）

**执行时间**:
- **大乐透**: 每周一、三、六 21:35
- **双色球**: 每周二、五、日 21:35

#### 方式 2: 手动触发
1. 进入 GitHub 仓库
2. 点击 "Actions" 标签
3. 选择 "Auto Crawl Multi-Lottery Data"
4. 点击 "Run workflow"
5. 选择彩种类型和运行模式

```yaml
- lottery_type: all / dlt / ssq
- dry_run: true (仅预览) / false (实际提交)
```

## 📁 项目结构

```
scripts/
├── crawl_universal.py           # 统一爬虫系统
├── crawl_ssq.py                 # 双色球爬虫
├── data_source_manager.py       # 数据源管理
├── data_sources.json            # 数据源配置
├── auto-crawl-multi-lottery.yml # GitHub Actions配置
├── requirements.txt             # Python依赖
└── README.md                    # 本文档
```

## 🔧 配置说明

### data_sources.json 配置文件

```json
{
  "sources": {
    "dlt": [
      {
        "name": "500.com",
        "url": "http://kaijiang.500.com/shtml/dlt/{period}.shtml",
        "priority": 1
      }
    ],
    "ssq": [
      {
        "name": "data.17500.cn",
        "url": "https://data.17500.cn/ssq_asc.txt",
        "priority": 1
      }
    ]
  },
  "settings": {
    "timeout": 15,
    "max_retries": 3,
    "retry_interval": 300,
    "backup_enabled": true,
    "auto_switch_on_failure": true
  }
}
```

### 数据源添加方法

1. 编辑 `scripts/data_sources.json`
2. 在对应彩种的 `sources` 数组中添加新源
3. 设置 `priority` 值（1 最高优先级）

```json
{
  "name": "新数据源名称",
  "url": "数据源URL",
  "priority": 3
}
```

## 📊 数据格式

### 大乐透 (DLT)
```
前区5个号码(01-35) 后区2个号码(01-12)

示例: 07 09 23 27 32 02 08
```

### 双色球 (SSQ)
```
红球6个号码(01-33) 蓝球1个号码(01-16)

示例: 05 17 23 26 28 33 06
```

## 🛠️ 使用示例

### 示例 1: 爬取最新大乐透数据

```bash
python scripts/crawl_universal.py --type dlt
```

输出:
```
======================================================================
🎯 统一彩票爬虫系统
📅 时间: 2026-05-28 11:45:30
======================================================================

【大乐透 (DLT)】
📡 尝试数据源: 500.com (优先级: 1)
   正在请求: http://kaijiang.500.com/shtml/dlt/26056.shtml
   ✅ 连接成功
✅ 成功获取数据
   源: 500.com
   前区: 07 09 23 27 32
   后区: 02 08
✅ 数据已更新: 07 09 23 27 32 02 08
📈 总计: 1234 期
```

### 示例 2: 查看数据源状态

```bash
python scripts/data_source_manager.py
```

输出:
```
======================================================================
📊 数据源状态报告
更新时间: 2026-05-28 11:46:00
======================================================================

【DLT】
  ✅ 正常  500.com            优先级 1    失败 0 次
  ✅ 正常  lottery.gov.cn     优先级 2    失败 1 次

【SSQ】
  ✅ 正常  data.17500.cn      优先级 1    失败 0 次
  ✅ 正常  500.com            优先级 2    失败 2 次
```

## 🔄 工作流程

```
┌─────────────────────────┐
│  触发爬虫系统            │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  加载数据源配置          │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  按优先级尝试数据源      │
└────────┬────────────────┘
         │
    ┌────▼──────┐
    │            │
    ▼            ▼
  成功         失败
    │            │
    │      尝试下一个源
    │            │
    │      ┌─────▼─────┐
    │      │            │
    │      ▼            ▼
    │    还有源        没有了
    │      │            │
    │      │            ▼
    │      │        ❌ 返回失败
    │      │
    │      └──────┐
    │             │
    ▼             ▼
┌─────────────────────────┐
│  解析数据              │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  验证数据格式            │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  更新历史文件            │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  ✅ 完成                │
└─────────────────────────┘
```

## ⚠️ 注意事项

1. **反爬虫机制**: 某些网站可能有反爬措施
   - 已配置合理的请求头
   - 建议不要频繁请求同一源

2. **数据有效性**: 系统自动验证
   - 号码范围检查
   - 重复号码检查
   - 格式验证

3. **备份策略**: 所有数据自动备份
   - 备份位置: `lottery-app/src/data/`
   - 备份格式: `{lottery_type}_backup_{timestamp}.txt`

4. **错误处理**: 自动记录所有失败
   - 查看状态报告了解问题源

## 🐛 常见问题

### Q1: 爬虫失败怎么办？

**答案**: 
1. 查看日志输出
2. 检查网络连接
3. 运行 `python scripts/data_source_manager.py` 查看数据源状态
4. 如果某个源长期失败，可以在 `data_sources.json` 中禁用它

### Q2: 如何添加新的数据源？

**答案**:
1. 编辑 `scripts/data_sources.json`
2. 在对应彩种的数组中添加新源信息
3. 如需要特殊解析逻辑，编辑 `crawl_universal.py` 的相关方法

### Q3: GitHub Actions 不执行怎么办？

**答案**:
1. 确保 `.github/workflows/auto-crawl-multi-lottery.yml` 文件存在
2. 检查 GitHub Actions 是否启用
3. 查看 Actions 页面的执行日志

### Q4: 如何验证爬虫是否工作正常？

**答案**:
```bash
# 1. 运行测试
python scripts/crawl_universal.py --type all

# 2. 检查生成的数据文件
ls -lah lottery-app/src/data/

# 3. 查看数据内容
head lottery-app/src/data/lottery-history.txt
head lottery-app/src/data/ssq-history.txt
```

## 📝 开发计划

- [x] 大乐透爬虫
- [x] 双色球爬虫
- [x] 多数据源支持
- [x] 自动切换机制
- [x] 数据源管理模块
- [x] GitHub Actions 工作流
- [ ] 更多彩种支持 (3D, 排列五等)
- [ ] Web 前端展示数据源状态
- [ ] 数据统计和分析功能
- [ ] 邮件/通知提醒功能

## 📄 许可证

本项目仅供学习和个人使用，请遵守相关法律法规。

## 📞 技术支持

遇到问题？请查看：
1. 本文档的常见问题部分
2. 运行日志输出
3. `data_source_manager.py` 生成的状态报告
