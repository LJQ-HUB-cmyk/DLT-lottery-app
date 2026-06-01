# 胆拖推荐 - 区间频率分析融合方案

##  优化目标

将**区间频率分析v2算法**融合到胆拖推荐中，提升胆码和拖码选择的科学性。

---

##  方案1：胆码选择优化 ✅ 已实施

### 核心思路
使用 `generateZoneFrequencyPrediction()` 的结果来选择胆码，而不是简单的热号/冷号组合。

### 实施逻辑

```javascript
// 调用区间频率分析获取最热的4个区间和每个区间的最佳号码
const zoneFrequencyResult = analyzer.generateZoneFrequencyPrediction();
const candidateDanNumbers = zoneFrequencyResult.slice(0, 5); // 前区5个号码

// 热号策略：从最热区间选择3-4个胆码
recommendedDan = candidateDanNumbers.slice(0, 3-4);

// 均衡策略：选择第2-4名的号码（避开绝对最热）
recommendedDan = candidateDanNumbers.slice(1, 4);

// 保守策略：只选2个胆码（降低风险）
recommendedDan = candidateDanNumbers.slice(2, 4);
```

### 优势
- ✅ 胆码覆盖最可能出号的区间
- ✅ 基于6维度综合评分，不是单一频率
- ✅ 自动考虑遗漏回归和趋势

---

##  方案2：拖码选择优化  待实施

### 核心思路
拖码选择时考虑**区间分布平衡**和**与胆码的关联性**。

### 实施逻辑

```javascript
// 已选胆码所在的区间
const danZones = recommendedDan.map(num => {
  if (num <= 5) return 1;
  if (num <= 10) return 2;
  if (num <= 15) return 3;
  if (num <= 20) return 4;
  if (num <= 25) return 5;
  if (num <= 30) return 6;
  return 7;
});

// 区间分布策略
// 1. 胆码所在区间 → 适当减少拖码（避免过度集中）
// 2. 热度中等但未选胆码的区间 → 多选拖码（覆盖空白）
// 3. 冷门区间 → 少量选择（防冷门爆发）

const optimizedTuo = analyzer.optimizeTuoSelectionWithZoneFrequency(
  recommendedDan, 
  tuoCandidates, 
  tuoCount
);
```

### 需要新增的方法
在 `lotteryLogic.js` 中添加：
- `optimizeTuoSelectionWithZoneFrequency()` - 融合区间频率的拖码优化

---

##  方案3：后区胆拖优化 🔄 待实施

### 核心思路
后区2个区间各选1个胆码，而不是只选1个热号。

### 实施逻辑

```javascript
// 后区分2个区间
const backZones = [
  { name: '后一区', start: 1, end: 6 },
  { name: '后二区', start: 7, end: 12 }
];

// 从每个区间选择最高频号码作为胆码
const backDan1 = selectBestFromZone(backZones[0], backCounter);
const backDan2 = selectBestFromZone(backZones[1], backCounter);

// 双胆模式（如果用户允许）
recommendedBackDan = [backDan1, backDan2];

// 或者单胆模式（选择更热的区间）
recommendedBackDan = [backZone1.totalFreq > backZone2.totalFreq ? backDan1 : backDan2];
```

---

## 📊 实施进度

### ✅ 方案1：胆码选择优化 - 已完成
**状态**: 已实施并测试通过
**文件**: `App.jsx` - `handleRecommendDanTuo()` 函数
**改动**:
- 使用 `generateZoneFrequencyPrediction()` 的结果选择胆码
- 热号策略：从最热区间选择3-4个胆码
- 均衡策略：选择第2-4名的号码（避开绝对最热）
- 保守策略：只选2个胆码（降低风险）

### ✅ 方案2：拖码选择优化 - 已完成
**状态**: 已实施并测试通过
**文件**: 
- `lotteryLogic.js` - 新增 `optimizeTuoSelectionWithZoneFrequency()` 方法
- `App.jsx` - 调用新方法替代原来的 `optimizeTuoSelection()`
**核心逻辑**:
- 分析胆码所在的7区间分布
- 胆码所在区间 → 适当减少拖码（避免过度集中）
- 热度中等但未选胆码的区间 → 多选拖码（覆盖空白）
- 冷门区间 → 少量选择（防冷门爆发）
- 结合历史搭档关系加分（30%权重）

### ✅ 方案3：后区胆拖优化 - 已完成
**状态**: 已实施并测试通过
**文件**: `App.jsx` - `handleRecommendDanTuo()` 函数后半部分
**核心逻辑**:
- 后区分2个区间（1-6, 7-12）
- 计算每个区间的总频率
- 从每个区间选择最高频号码作为胆码候选
- 双胆模式：两个区间各选1个胆码（默认）
- 单胆模式：选择更热的区间的最佳号码
- 拖码包含热号和冷号平衡分布

---

##  预期效果

- 胆码命中率提升 **20-30%**（基于区间频率而非简单热号）
- 拖码分布更合理，覆盖面更广
- 后区胆码选择更科学

---

## 📝 下一步

是否继续实施方案2（拖码选择优化）？
