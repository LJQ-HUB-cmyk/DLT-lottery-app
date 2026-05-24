# 🚀 快速开始 - 大乐透数据管理

## ⚡ 5分钟上手

### 1️⃣ 手动添加开奖数据（推荐先用这个）

```bash
# 运行手动添加脚本
python scripts/manual_update.py
```

**操作流程：**
1. 选择模式：1=单期添加，2=批量添加
2. 输入前区5个号码（空格分隔）
3. 输入后区2个号码（空格分隔）
4. 确认添加
5. 提交到Git

**示例：**
```
选择操作模式:
1. 单期添加
2. 批量添加

请选择 (1/2): 1

请输入开奖号码（每两个数字之间用空格分隔）：

前区5个号码 (例如: 07 09 23 27 32): 07 09 23 27 32
后区2个号码 (例如: 02 08): 02 08

✅ 格式化后的数据: 07 09 23 27 32 02 08

是否添加到历史文件？(y/n): y

✅ 数据已成功添加
📊 历史数据总数: 57 期
```

---

### 2️⃣ 提交到Git

```bash
git add .
git commit -m "更新大乐透开奖数据"
git push
```

---

## 🔄 每周例行流程

### 开奖日（周一、三、六）晚上21:30后：

```bash
# 1. 查看最新开奖结果（从电视或官网）

# 2. 运行添加脚本
python scripts/manual_update.py

# 3. 输入号码并确认

# 4. 提交代码
git add .
git commit -m "更新 $(date +%Y-%m-%d) 开奖数据"
git push
```

---

## 📋 完整功能列表

### ✅ 已实现

| 功能 | 状态 | 说明 |
|------|------|------|
| 手动添加单期数据 | ✅ | `manual_update.py` 模式1 |
| 批量添加多期数据 | ✅ | `manual_update.py` 模式2 |
| 数据格式验证 | ✅ | 自动检查号码范围和重复 |
| 去重机制 | ✅ | 避免重复添加 |
| GitHub Actions配置 | ✅ | 定时自动执行（待完善数据源）|
| 本地测试工具 | ✅ | `test_crawler.py` |
| 详细文档 | ✅ | README, GUIDE, SUMMARY |

### 🚧 待完善

| 功能 | 状态 | 说明 |
|------|------|------|
| 自动网页爬取 | 🚧 | 需要找到稳定数据源 |
| API接口集成 | 🚧 | 需要注册API服务 |
| 邮件通知 | ❌ | 未来可添加 |
| 数据统计分析 | ❌ | 未来可添加 |

---

## 🎯 常用命令速查

```bash
# 安装依赖（首次使用）
pip install -r scripts/requirements.txt

# 手动添加数据
python scripts/manual_update.py

# 测试爬虫（需要配置数据源）
python test_crawler.py

# 查看历史数据
cat lottery-app/src/data/lottery-history.txt

# 查看最近5期
tail -n 5 lottery-app/src/data/lottery-history.txt

# Git操作
git status
git add .
git commit -m "描述"
git push
```

---

## 📖 文档导航

- **SUMMARY.md** - 完整方案总结（本文档的详细说明版）
- **IMPLEMENTATION_GUIDE.md** - 实施指南和技术细节
- **README.md** - 项目说明和使用手册

---

## 💡 提示

1. **数据准确性最重要** - 手动添加虽然麻烦，但最可靠
2. **定期备份** - 历史数据文件很重要，建议定期备份
3. **核对数据** - 添加后可以用 `tail` 命令检查最后几行
4. **保持格式一致** - 确保每期都是7个数字，两位数格式

---

## ❓ 遇到问题？

### 问题1: 脚本运行报错
```bash
# 检查Python版本
python --version  # 应该是 3.x

# 重新安装依赖
pip install -r scripts/requirements.txt
```

### 问题2: 找不到历史文件
```bash
# 检查文件路径
ls lottery-app/src/data/lottery-history.txt

# 如果不存在，运行一次 manual_update.py 会自动创建
```

### 问题3: Git推送失败
```bash
# 检查网络连接
ping github.com

# 查看Git状态
git status
git log --oneline -3
```

---

## 🎉 开始使用吧！

现在就运行第一个命令：

```bash
python scripts/manual_update.py
```

祝你使用愉快！🍀
