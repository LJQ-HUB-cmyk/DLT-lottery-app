# 算法模块实施指南

## 📋 概述

本文档指导如何完成剩余10个算法模型的提取工作。

---

## ✅ 已完成（2个文件）

1. ✅ **BaseModel.js** - 算法基类（218行）
   - 定义统一接口 `predict()`
   - 提供通用方法：smartFrontSample, smartBackSample, enforceZoneCoverage等
   - 依赖注入模式

2. ✅ **FrequencyWeighted.js** - 频率加权模型（57行）
   - 基于历史频率 + 条件概率
   - 完整实现示例

---

## ⏳ 待完成（10个算法）

### 算法列表及对应原方法

| # | 算法名称 | 文件名 | 原方法 | 预计行数 | 复杂度 |
|---|---------|--------|--------|----------|--------|
| 3 | 均值回归 | MeanRegression.js | generateStatisticalPrediction('regression') | ~80行 | ⭐⭐ |
| 4 | 正态分布 | NormalDistribution.js | generateStatisticalPrediction('distribution') | ~100行 | ⭐⭐⭐ |
| 5 | 平衡策略 | BalancedStrategy.js | generateStatisticalPrediction('balanced') | ~90行 | ⭐⭐ |
| 6 | 遗漏分析 | OmissionAnalysis.js | generateOmissionBasedPrediction() | ~70行 | ⭐⭐ |
| 7 | 时间衰减 | TimeDecay.js | generateTimeDecayPrediction() | ~60行 | ⭐⭐ |
| 8 | 贝叶斯动态 | BayesianDynamic.js | generateBayesianPrediction() | ~150行 | ⭐⭐⭐⭐ |
| 9 | 旋转矩阵 | RotationMatrix.js | generateRotationMatrixPrediction() | ~180行 | ⭐⭐⭐⭐ |
| 10 | 周易时空 | ZhouyiSpaceTime.js | generateZhouyiPrediction() | ~120行 | ⭐⭐⭐ |
| 11 | 混合模型 | HybridModel.js | generateHybridPrediction() | ~160行 | ⭐⭐⭐⭐⭐ |
| 12 | 区间频率 | ZoneFrequency.js | generateZoneFrequencyPrediction() | ~200行 | ⭐⭐⭐⭐⭐ |

**总预计工作量**: 约1,210行代码

---

## 🔧 实施步骤

### 步骤1：创建算法文件模板

每个算法文件遵循以下结构：

```javascript
/**
 * [算法名称]预测模型
 * [算法描述]
 */

import { BaseModel } from './BaseModel.js';
import { CONFIG } from '../core/Config.js';

export class [AlgorithmName]Model extends BaseModel {
  constructor(dependencies) {
    super(dependencies);
    this.name = '[AlgorithmName]';
  }

  /**
   * 生成预测号码
   * @returns {number[]} [前区5个号码, 后区2个号码]
   */
  predict() {
    // 1. 获取所需数据
    const [frontCounter, backCounter] = this.frequencyAnalyzer.analyzeFrequency();
    // ... 其他数据分析
    
    // 2. 计算权重或评分
    const frontWeights = {};
    for (let n = 1; n <= CONFIG.FRONT_RANGE; n++) {
      // 根据算法逻辑计算权重
      frontWeights[n] = /* 权重计算 */;
    }
    
    // 3. 智能采样
    const front = this.smartFrontSample(frontWeights, CONFIG.FRONT_COUNT);
    const back = this.smartBackSample(backWeights, '[algorithm_name]');
    
    // 4. 区间覆盖修正
    const coveredFront = this.enforceZoneCoverage(front, 4);
    
    coveredFront.sort((a, b) => a - b);
    back.sort((a, b) => a - b);
    
    console.log(`📊 ${this.name} 生成结果 - 前区:`, coveredFront.length, '个号码', coveredFront, '后区:', back.length, '个号码', back);
    
    return [...coveredFront, ...back];
  }

  getDescription() {
    return '[算法描述]';
  }
}
```

### 步骤2：逐个提取算法

#### **算法3：均值回归模型**

源位置：`lotteryLogic.js` 第346-386行（strategy === 'regression'）

关键逻辑：
- 计算遗漏偏差因子
- 期望值接近度
- 条件概率加成
- 频率基线

#### **算法4：正态分布模型**

源位置：`lotteryLogic.js` 第388-454行（strategy === 'distribution'）

关键逻辑：
- 目标参数计算
- 引导式搜索
- 综合评分（和值+质量+区间）
- 最优解选择

#### **算法5：平衡策略模型**

源位置：`lotteryLogic.js` 第456-504行（strategy === 'balanced'）

关键逻辑：
- 冷热温号分类
- 自适应分配比例
- 趋势判断
- 智能采样

#### **算法6：遗漏分析模型**

源位置：`lotteryLogic.js` 第521-583行

关键逻辑：
- 连续评分函数
- 遗漏回归倾向
- 极端遗漏加成
- 条件概率融合

#### **算法7：时间衰减模型**

源位置：`lotteryLogic.js` 第589-621行

关键逻辑：
- 时间衰减权重计算
- 条件概率叠加
- 关联性加分

#### **算法8：贝叶斯动态模型** ⭐复杂

源位置：`lotteryLogic.js` 第768-944行

关键逻辑：
- 先验概率
- 后验概率计算（8维评分）
- 时间加权
- 近期频率趋势
- 条件概率
- 遗漏值因子
- 区间平衡
- 重号因子
- 和值趋势

#### **算法9：旋转矩阵模型** ⭐复杂

源位置：`lotteryLogic.js` 第951-1113行

关键逻辑：
- 5种旋转策略
- 高频号池构建
- 低频号补充
- 遗漏号加入
- 加权采样
- 后区3种策略

#### **算法10：周易时空模型**

源位置：`lotteryLogic.js` 第628-760行

关键逻辑：
- 卦象计算
- 时辰映射
- 动爻相关号码
- 卦象池权重
- 条件概率融合

#### **算法11：混合模型** ⭐最复杂

源位置：`lotteryLogic.js` 第1120-1274行

关键逻辑：
- 三个模型投票
- 加权投票机制
- 条件概率加成
- 质量评估
- 跨度/和值/AC值检查
- 后区投票+重号策略

#### **算法12：区间频率模型** ⭐最复杂

源位置：需要单独查找 `generateZoneFrequencyPrediction()`

关键逻辑：
- 7区间划分
- 区间频率统计
- 动态权重调整
- 多轮迭代优化

---

## 💡 实施技巧

### 1. 批量创建文件

可以使用脚本批量创建文件框架：

```bash
# 创建所有算法文件
touch algorithms/{MeanRegression,NormalDistribution,BalancedStrategy,OmissionAnalysis,TimeDecay,BayesianDynamic,RotationMatrix,ZhouyiSpaceTime,HybridModel,ZoneFrequency}.js
```

### 2. 代码复制策略

1. **定位源代码**：使用 grep 找到原方法
2. **提取核心逻辑**：只复制算法核心，去除类上下文
3. **替换 this 引用**：
   - `this.frequencyAnalyzer` → `this.frequencyAnalyzer`
   - `this.calculateOmission()` → `this.omissionCalculator.calculateOmission()`
   - `this.randomSample()` → 使用基类方法或 Utils
4. **添加依赖**：在构造函数中声明所需依赖

### 3. 测试验证

每完成一个算法，立即测试：

```javascript
import { FrequencyAnalyzer, OmissionCalculator, ..., MeanRegressionModel } from './index.js';

// 创建依赖
const dependencies = {
  frequencyAnalyzer: new FrequencyAnalyzer(...),
  omissionCalculator: new OmissionCalculator(...),
  // ... 其他依赖
};

// 创建算法实例
const model = new MeanRegressionModel(dependencies);

// 测试预测
const prediction = model.predict();
console.log('预测结果:', prediction);
```

---

## 📊 进度跟踪

| 算法 | 状态 | 行数 | 备注 |
|------|------|------|------|
| BaseModel | ✅ | 218 | 基类完成 |
| FrequencyWeighted | ✅ | 57 | 示例完成 |
| MeanRegression | ⏳ | ~80 | - |
| NormalDistribution | ⏳ | ~100 | - |
| BalancedStrategy | ⏳ | ~90 | - |
| OmissionAnalysis | ⏳ | ~70 | - |
| TimeDecay | ⏳ | ~60 | - |
| BayesianDynamic | ⏳ | ~150 | 复杂 |
| RotationMatrix | ⏳ | ~180 | 复杂 |
| ZhouyiSpaceTime | ⏳ | ~120 | - |
| HybridModel | ⏳ | ~160 | 最复杂 |
| ZoneFrequency | ⏳ | ~200 | 最复杂 |

**当前进度**: 2/12 (17%)  
**预计还需**: 约1,210行代码

---

## 🎯 下次会话计划

### 目标：完成所有10个算法

**时间安排**：
- 简单算法（6个）：每个10-15分钟 = 60-90分钟
- 复杂算法（4个）：每个20-30分钟 = 80-120分钟
- **总计**: 约2.5-3.5小时

**实施顺序**（从简单到复杂）：
1. TimeDecay（最简单）
2. OmissionAnalysis
3. MeanRegression
4. BalancedStrategy
5. ZhouyiSpaceTime
6. NormalDistribution
7. BayesianDynamic
8. RotationMatrix
9. HybridModel
10. ZoneFrequency（最复杂）

---

## ✅ 完成标准

每个算法必须满足：
1. ✅ 继承 BaseModel
2. ✅ 实现 predict() 方法
3. ✅ 返回格式正确：[5个前区, 2个后区]
4. ✅ 号码升序排列
5. ✅ 区间覆盖检查
6. ✅ 完整的JSDoc注释
7. ✅ 与原算法输出一致

---

## 🚀 完成后下一步

1. 更新 index.js 导出所有算法
2. 创建 LotteryAnalyzer 主类
3. 集成所有模块
4. 全面测试
5. 删除原 lotteryLogic.js
6. **统一提交到GitHub** 🎉

---

**最后更新**: 2026-06-01  
**文档版本**: v1.0  
**维护者**: AI Assistant
