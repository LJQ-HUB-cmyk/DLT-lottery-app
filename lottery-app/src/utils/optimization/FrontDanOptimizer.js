/**
 * 前区胆码智能推荐优化器
 * 融合：条件概率 + 遗漏回归 + 时间衰减 + 频率 + 区间分布
 * 使用加权随机采样，每次推荐结果不同但合理
 */

import { CONFIG } from '../core/Config.js';
import { HistoricalSimilarity } from '../analysis/HistoricalSimilarity.js';

export class FrontDanOptimizer {
  /**
   * 优化前区胆码推荐（多维度智能评分 + 加权随机采样）
   * @param {Object} analyzer - LotteryAnalyzer实例
   * @param {number} danCount - 需要推荐的胆码数量（2-4）
   * @param {string} strategy - 策略：hot/balanced/conservative
   * @returns {Object} { selected: number[], probabilityInfo: Object[] }
   */
  static optimize(analyzer, danCount = 3, strategy = 'hot') {
    console.log('🎯 前区胆码智能推荐（多维度评分 + 加权随机采样）');
    console.log('  策略:', strategy, '胆码数量:', danCount);
    
    // 1. 获取条件概率
    const conditionalProb = analyzer.conditionalProbability.calculateConditionalProbability();
    const confidence = conditionalProb.confidence || 0.3;
    
    // 2. 获取遗漏数据
    const omissionData = analyzer.omissionCalculator.calculateOmission();
    const avgFrontOmission = analyzer.omissionCalculator.getAverageOmission('front');
    const omissionStd = analyzer.omissionCalculator.getOmissionStd('front');
    
    // 3. 获取频率数据（全量 + 近期趋势动量）
    const [frontCounter] = analyzer.frequencyAnalyzer.analyzeFrequency();
    const maxFreq = Math.max(...Object.values(frontCounter));
    const recentFreq = analyzer.frequencyAnalyzer.analyzeRecentFrequency();
    
    // 4. 获取时间衰减权重（归一化到0-1范围）
    const rawTimeWeights = analyzer.calculateTimeDecayWeights();
    const maxFrontTimeWeight = Math.max(...Object.values(rawTimeWeights.front));
    
    // 5. 获取关联性数据（使用时间衰减版本，近期共现权重更高）
    const correlationData = analyzer.correlationAnalyzer.calculateNumberCorrelationWithTimeDecay();
    
    // 6. 热号策略专用数据
    const repeatAnalysis = analyzer.trendAnalyzer.analyzeRepeatNumbers();
    const activeData = analyzer.getActiveData();
    const lastDraw = activeData.length > 0 ? activeData[activeData.length - 1] : null;
    
    // 动量加速度：近5期频率 vs 近15期频率
    const veryRecentCount = Math.min(5, activeData.length);
    const veryRecentData = activeData.slice(-veryRecentCount);
    const veryRecentFrontFreq = {};
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) veryRecentFrontFreq[i] = 0;
    for (const draw of veryRecentData) {
      for (const num of draw.front) veryRecentFrontFreq[num]++;
    }
    
    // 热区趋势：近5期各区频率占比（7区细分，比3大区更精准）
    const getZone7 = (num) => {
      if (num <= 5) return 1;
      if (num <= 10) return 2;
      if (num <= 15) return 3;
      if (num <= 20) return 4;
      if (num <= 25) return 5;
      if (num <= 30) return 6;
      return 7;
    };
    // 7. 计算每个号码的综合得分（策略差异化评分，总分约100）
    // 热号策略：9维度(热度信号20+近期频率逆袭6+条件概率20+热区趋势10+重号因子自适应5-10+动量加速5+时间衰减10+历史相似度5+区间防极端-3+冷却惩罚-5 = 72~91)
    // 均衡/保守策略：5维度(频率动量15+条件概率30+遗漏偏离度20+时间衰减15+区间结构20 = 100)
    const scored = [];
    
    // 先计算全局最大值用于归一化
    const maxCondProb = Math.max(...Object.values(conditionalProb.front));
    const maxOmissionDeviation = Math.max(
      ...Object.values(omissionData.front)
        .map(o => (o || 0) - avgFrontOmission)
        .filter(d => d > 0)
    );
    // 计算关联性最大值
    let maxCorrelation = 0;
    for (const num in correlationData.front) {
      const correlations = Object.values(correlationData.front[num] || {});
      const sum = correlations.reduce((a, b) => a + b, 0);
      if (sum > maxCorrelation) maxCorrelation = sum;
    }
    
    // 3大区定义
    const getZone = (num) => {
      if (num <= 12) return 1;
      if (num <= 24) return 2;
      return 3;
    };
    
    // 计算各区频率占比（用于区间均衡加分）
    const zone1Freq = Array.from({ length: 12 }, (_, i) => i + 1)
      .reduce((sum, n) => sum + (frontCounter[String(n)] || frontCounter[n] || 0), 0);
    const zone2Freq = Array.from({ length: 12 }, (_, i) => i + 13)
      .reduce((sum, n) => sum + (frontCounter[String(n)] || frontCounter[n] || 0), 0);
    const zone3Freq = Array.from({ length: 11 }, (_, i) => i + 25)
      .reduce((sum, n) => sum + (frontCounter[String(n)] || frontCounter[n] || 0), 0);
    const totalZoneFreq = zone1Freq + zone2Freq + zone3Freq;
    const zone1Ratio = totalZoneFreq > 0 ? zone1Freq / totalZoneFreq : 0.33;
    const zone2Ratio = totalZoneFreq > 0 ? zone2Freq / totalZoneFreq : 0.33;
    const zone3Ratio = totalZoneFreq > 0 ? zone3Freq / totalZoneFreq : 0.33;
    
    // 预计算：近期频率逆袭数据（优化：近15期频率/全量频率比值>1 → 冷→热逆袭信号）
    const recent15Count = Math.min(15, activeData.length);
    const recent15Data = activeData.slice(-recent15Count);
    const recent15FrontFreq = {};
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) recent15FrontFreq[i] = 0;
    for (const draw of recent15Data) {
      for (const num of draw.front) recent15FrontFreq[num]++;
    }
    const totalDraws = activeData.length;
    const frontFreqRatio = {};
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
      const recentRate = recent15FrontFreq[i] / recent15Count;
      const overallRate = (frontCounter[String(i)] || frontCounter[i] || 0) / totalDraws;
      frontFreqRatio[i] = overallRate > 0 ? recentRate / overallRate : 0;
    }
    const maxFreqRatioValue = Math.max(...Object.values(frontFreqRatio).filter(r => r > 1), 1);

    // 预计算：重号因子自适应（优化：近10期重号率调整权重）
    const recent10ForRepeat = Math.min(10, activeData.length - 1);
    let recent10RepeatSum = 0;
    for (let i = activeData.length - recent10ForRepeat; i < activeData.length; i++) {
      if (i > 0) {
        const prevDraw = activeData[i - 1];
        const currDraw = activeData[i];
        const repeatCount = currDraw.front.filter(n => prevDraw.front.includes(n)).length;
        recent10RepeatSum += repeatCount;
      }
    }
    const recent10RepeatRate = recent10ForRepeat > 0 ? recent10RepeatSum / recent10ForRepeat : 0;
    const repeatWeightFactor = recent10RepeatRate < 1.0 ? 0.5 : recent10RepeatRate > 2.0 ? 1.5 : 1.0;

    // 预计算：近5期各区频率（用于热区趋势+区间防极端）
    const hotZoneRecentFreq = {};
    for (let zone = 1; zone <= 7; zone++) hotZoneRecentFreq[zone] = 0;
    for (const draw of veryRecentData) {
      for (const num of draw.front) hotZoneRecentFreq[getZone7(num)]++;
    }
    const totalHotZoneFreq = Object.values(hotZoneRecentFreq).reduce((a, b) => a + b, 0) || 1;

    // 预计算：循环外常量（避免在35次循环中重复计算）
    const maxMomentum = Math.max(...Object.values(recentFreq.frontMomentum).map(m => Math.abs(m))); 
    const totalFrontFreq = Object.values(frontCounter).reduce((a, b) => a + b, 0);
    const avgFreqPerNum = totalFrontFreq / CONFIG.FRONT_RANGE;
    // 预计算：动量加速度全局最大值
    const maxAcceleration = Math.max(
      ...Array.from({ length: CONFIG.FRONT_RANGE }, (_, i) => i + 1)
        .map(n => ((veryRecentFrontFreq[n] || 0) / veryRecentCount) - ((recentFreq.front[n] || 0) / recentFreq.recentCount))
        .filter(a => a > 0)
    );

    for (let num = 1; num <= CONFIG.FRONT_RANGE; num++) {
      let score = 0;
      const zone7 = getZone7(num);
      const zone = getZone(num);
      
      // 维度1: 热度信号得分（20分满分）- 频率+遗漏合并，消除信息重叠
      // 热号策略：低遗漏=热号信号强，频率作为权重倍率
      // 均衡/保守策略：频率基础10分 + 动量5分（与原逻辑一致）
      const freq = frontCounter[String(num)] || frontCounter[num] || 0;
      const momentum = recentFreq.frontMomentum[num] || 0;
      const normalizedMomentum = maxMomentum > 0 ? momentum / maxMomentum : 0;
      const currentOmission = omissionData.front[num] || 0;
      
      if (strategy === 'hot') {
        // 热号策略：热度信号 = 低遗漏权重(0~15) + 频率权重倍率(0~5)
        const omissionBaseScore = Math.max(0, 15 - (currentOmission / avgFrontOmission) * 15);
        // 频率倍率：高频号的热度信号更可信，加权5分
        const freqBoost = maxFreq > 0 ? (freq / maxFreq) * 5 : 0;
        score += omissionBaseScore + freqBoost;
      } else {
        // 均衡/保守：保留频率基础10分 + 动量5分
        const freqBase = maxFreq > 0 ? (freq / maxFreq) * 10 : 0;
        score += freqBase + Math.max(0, normalizedMomentum) * 5;
      }

      // 热号策略维度2: 近期频率逆袭加成（6分满分）
      // 近15期频率/全量频率比值>1 → 近期升温比历史更热 → 加分
      // 直接捕捉冷→热逆袭号码（如#26、#34），弥补全量频率低估
      if (strategy === 'hot') {
        const freqRatio = frontFreqRatio[num] || 0;
        if (freqRatio > 1) {
          const normalizedRatio = maxFreqRatioValue > 1 ? (freqRatio - 1) / (maxFreqRatioValue - 1) : 0;
          score += normalizedRatio * 6;
        }
      }

      // 热号策略维度3: 条件概率得分 - 归一化（20分）
      // 均衡/保守策略维度2: 条件概率得分 - 归一化（30分）
      const condProb = conditionalProb.front[num] || 0;
      const normalizedCondProb = maxCondProb > 0 ? condProb / maxCondProb : 0;
      score += normalizedCondProb * (strategy === 'hot' ? 20 : 30);
      
      // 均衡/保守策略维度3: 遗漏偏离度评分（20分满分）
      // 热号策略已在热度信号维度中处理遗漏，此处仅均衡/保守策略使用
      if (strategy !== 'hot') {
        const omissionDeviation = currentOmission - avgFrontOmission;
        const absDeviation = Math.abs(omissionDeviation);
        const maxAbsDeviation = Math.max(
          ...Object.values(omissionData.front).map(o => Math.abs((o || 0) - avgFrontOmission))
        );
        const normalizedDeviation = maxAbsDeviation > 0 ? absDeviation / maxAbsDeviation : 0;
        score += normalizedDeviation * 10; // 偏离度基础分10分
        // 遗漏策略加成：均衡/保守偏向高遗漏号码
        if (omissionDeviation > 0) {
          const posNormalized = maxOmissionDeviation > 0 ? omissionDeviation / maxOmissionDeviation : 0;
          score += posNormalized * 7;
          if (omissionDeviation > omissionStd * 2) {
            score += 3;
          }
        }
      }
      

      
      // 热号策略维度4: 时间衰减得分（10分）
      // 均衡/保守策略维度4: 时间衰减得分（15分）
      const rawTimeWeight = rawTimeWeights.front[num] || 0;
      const normalizedTimeWeight = maxFrontTimeWeight > 0 
        ? rawTimeWeight / maxFrontTimeWeight : 0;
      score += normalizedTimeWeight * (strategy === 'hot' ? 10 : 15);
      
      // 热号策略维度5: 热区趋势+重号因子+区间防极端
      if (strategy === 'hot') {
        // 维度5a: 热区趋势加分（10分满分）
        // 号码所在区的近期频率占比越高 → 该区越热 → 号码加分
        const zoneRatio = totalHotZoneFreq > 0 ? hotZoneRecentFreq[zone7] / totalHotZoneFreq : 0;
        const idealZoneRatio = 1 / 7;
        const hotZoneBonus = zoneRatio > idealZoneRatio
          ? Math.min((zoneRatio - idealZoneRatio) / (1 - idealZoneRatio) * 10, 10)
          : 0;
        score += hotZoneBonus;
        
        // 维度5b: 重号因子加分（自适应5-10分满分）
        // 低重号周期(近10期<1.0)权重降为0.5，高重号周期(>2.0)权重升为1.5
        if (lastDraw && lastDraw.front.includes(num)) {
          const repeatMaxScore = Math.min(10 * repeatWeightFactor, 10);
          score += Math.min(repeatAnalysis.frontRepeatRate * 10 * repeatWeightFactor, repeatMaxScore);
        }
      } else {
      // 均衡/保守策略维度5: 区间结构评分（20分满分）
        // 归一化补偿：偏差比例 * 45，但严格限制不超过20分满分
        const idealRatio = 0.33;
        let zoneBonus = 0;
        if (zone === 1 && zone1Ratio < idealRatio) {
          zoneBonus = Math.abs(idealRatio - zone1Ratio) * 45;
        } else if (zone === 2 && zone2Ratio < idealRatio) {
          zoneBonus = Math.abs(idealRatio - zone2Ratio) * 45;
        } else if (zone === 3 && zone3Ratio < idealRatio) {
          zoneBonus = Math.abs(idealRatio - zone3Ratio) * 45;
        }
        score += Math.min(zoneBonus, 20); // 严格限制不超过维度满分
      }
      
      // 热号策略维度6: 动量加速度加分（5分满分）
      // 近5期频率/5 > 近15期频率/15 → 动量正在加速 → 加分
      if (strategy === 'hot') {
        const veryRecentRate = (veryRecentFrontFreq[num] || 0) / veryRecentCount;
        const mediumRecentRate = (recentFreq.front[num] || 0) / recentFreq.recentCount;
        const acceleration = veryRecentRate - mediumRecentRate;
        if (acceleration > 0 && maxAcceleration > 0) {
          score += (acceleration / maxAcceleration) * 5;
        }
      }
      
      // 热号策略维度7: 冷却惩罚（最多扣5分）
      // 高频号（历史频率 > 平均）且当前遗漏 > 平均遗漏 → 正在冷却 → 扣分
      if (strategy === 'hot') {
        const numFreq = frontCounter[String(num)] || frontCounter[num] || 0;
        if (numFreq > avgFreqPerNum && currentOmission > avgFrontOmission) {
          const coolingDegree = (currentOmission - avgFrontOmission) / avgFrontOmission;
          const freqHeat = numFreq / avgFreqPerNum;
          const penalty = Math.min(coolingDegree * freqHeat * 2, 5);
          score -= penalty;
        }
      }
      
      // 热号策略维度8: 历史形态相似度加成（5分满分）- 归一化
      if (strategy === 'hot') {
        const similarityBonus = HistoricalSimilarity.computeNumberSimilarityBonus(
          num, true, [], [], activeData
        );
        score += similarityBonus * 5;
      }
      
      scored.push({
        number: num,
        score,
        zone,
        condProb,
        omission: currentOmission,
        freq,
        timeWeight: normalizedTimeWeight,
        isRepeat: lastDraw ? lastDraw.front.includes(num) : false,
        isCooling: strategy === 'hot' && freq > avgFreqPerNum && currentOmission > avgFrontOmission
      });
    }
    
    // 热号策略：区间防极端惩罚（最多扣3分）- 必须在所有号码评分完成后统一计算
    // 防止在循环内部基于不完整的scored数组计算，导致评分不公平
    if (strategy === 'hot') {
      scored.sort((a, b) => b.score - a.score);
      const top12ZoneCounts = {};
      for (let z = 1; z <= 7; z++) top12ZoneCounts[z] = 0;
      scored.slice(0, 12).forEach(s => top12ZoneCounts[getZone7(s.number)]++);
      // 对所在区在Top12中占比>=4的号码统一扣3分
      for (const s of scored) {
        const zone7Num = getZone7(s.number);
        if (top12ZoneCounts[zone7Num] >= 4) {
          s.score -= 3;
        }
      }
    }

    // 根据策略调整候选池
    scored.sort((a, b) => b.score - a.score);
    
    let candidatePool;
    if (strategy === 'hot') {
      // 热号策略：从Top12中选（扩大候选池，覆盖更多热号信号号码）
      candidatePool = scored.slice(0, 12);
    } else if (strategy === 'balanced') {
      // 均衡策略：从Top15中选（包含一些中等分数号码）
      candidatePool = scored.slice(0, 15);
    } else {
      // 保守策略：从Top20中选（避开绝对最热）
      candidatePool = scored.slice(3, 20);
    }
    
    // 加权随机采样
    const minScore = Math.min(...candidatePool.map(s => s.score));
    const scoreRange = Math.max(...candidatePool.map(s => s.score)) - minScore;
    
    const weights = candidatePool.map(s => {
      const normalized = scoreRange > 0 ? (s.score - minScore) / scoreRange : 0.5;
      return {
        ...s,
        sampleWeight: 0.05 + normalized * 0.95
      };
    });
    
    // 加权随机采样选出 danCount 个号码
    // 热号策略：不做区间覆盖强制，让趋势自然决定分布
    // 均衡/保守策略：确保3大区都有覆盖
    const selected = [];
    const remaining = [...weights];
    
    if (strategy === 'hot') {
      // 热号策略：纯加权随机采样，不强制区间覆盖
      while (selected.length < danCount && remaining.length > 0) {
        const totalW = remaining.reduce((sum, w) => sum + w.sampleWeight, 0);
        let random = Math.random() * totalW;
        let chosenIdx = 0;
        for (let j = 0; j < remaining.length; j++) {
          random -= remaining[j].sampleWeight;
          if (random <= 0) { chosenIdx = j; break; }
        }
        selected.push(remaining[chosenIdx].number);
        remaining.splice(chosenIdx, 1);
      }
    } else {
      // 均衡/保守策略：确保3大区都有覆盖
      const zone1Candidates = remaining.filter(w => getZone(w.number) === 1);
      const zone2Candidates = remaining.filter(w => getZone(w.number) === 2);
      const zone3Candidates = remaining.filter(w => getZone(w.number) === 3);
      
      const pickOneFromZone = (zoneCandidates, remList) => {
        if (zoneCandidates.length === 0) return null;
        const totalW = zoneCandidates.reduce((sum, w) => sum + w.sampleWeight, 0);
        let random = Math.random() * totalW;
        for (const w of zoneCandidates) {
          random -= w.sampleWeight;
          if (random <= 0) {
            remList.splice(remList.findIndex(r => r.number === w.number), 1);
            return w.number;
          }
        }
        const chosen = zoneCandidates[0];
        remList.splice(remList.findIndex(r => r.number === chosen.number), 1);
        return chosen.number;
      };
      
      if (danCount >= 3) {
        const z1 = pickOneFromZone(zone1Candidates, remaining);
        const z2 = pickOneFromZone(zone2Candidates, remaining);
        const z3 = pickOneFromZone(zone3Candidates, remaining);
        if (z1) selected.push(z1);
        if (z2) selected.push(z2);
        if (z3) selected.push(z3);
      } else if (danCount === 2) {
        const zones = [zone1Candidates, zone2Candidates, zone3Candidates];
        const topZones = zones.sort((a, b) => {
          const totalA = a.reduce((s, w) => s + w.sampleWeight, 0);
          const totalB = b.reduce((s, w) => s + w.sampleWeight, 0);
          return totalB - totalA;
        }).slice(0, 2);
        for (const zoneC of topZones) {
          const num = pickOneFromZone(zoneC, remaining);
          if (num) selected.push(num);
        }
      } else {
        const totalW = remaining.reduce((sum, w) => sum + w.sampleWeight, 0);
        let random = Math.random() * totalW;
        let chosenIdx = 0;
        for (let j = 0; j < remaining.length; j++) {
          random -= remaining[j].sampleWeight;
          if (random <= 0) { chosenIdx = j; break; }
        }
        selected.push(remaining[chosenIdx].number);
        remaining.splice(chosenIdx, 1);
      }
      
      // 如果还需更多胆码（4个），从剩余号码中加权随机选
      while (selected.length < danCount && remaining.length > 0) {
        const totalW = remaining.reduce((sum, w) => sum + w.sampleWeight, 0);
        let random = Math.random() * totalW;
        let chosenIdx = 0;
        for (let j = 0; j < remaining.length; j++) {
          random -= remaining[j].sampleWeight;
          if (random <= 0) { chosenIdx = j; break; }
        }
        selected.push(remaining[chosenIdx].number);
        remaining.splice(chosenIdx, 1);
      }
    }
    
    // 奇偶平衡后处理
    // 所有策略：防止0:5或5:0极端比例（统计上极不可能出现）
    // 均衡/保守策略：更严格确保2:3或3:2
    if (danCount >= 2) {
      const selOddCount = selected.filter(n => n % 2 !== 0).length;
      const selEvenCount = selected.length - selOddCount;
      const needFix = strategy === 'hot'
        ? (selOddCount === 0 || selEvenCount === 0) // 热号：仅防止极端
        : (selOddCount === 0 || selEvenCount === 0); // 均衡/保守：防止极端（已通过采样约束保证2:3或3:2）
      
      if (needFix) {
        const needOdd = selOddCount === 0;
        // 从未被选中的号码中找最优替换（按评分排序）
        const replaceCandidates = scored
          .filter(s => !selected.includes(s.number) && (needOdd ? s.number % 2 !== 0 : s.number % 2 === 0))
          .sort((a, b) => b.score - a.score);
        if (replaceCandidates.length > 0) {
          // 替换评分最低的已选号码
          const worstSelected = selected
            .map(n => ({ num: n, score: scored.find(s => s.number === n)?.score || 0 }))
            .sort((a, b) => a.score - b.score)[0];
          selected[selected.indexOf(worstSelected.num)] = replaceCandidates[0].number;
        }
      }
    }

    // 计算概率排名信息（基于全量35号码）
    const allWeights = scored.map(s => {
      const allMinScore = Math.min(...scored.map(s2 => s2.score));
      const allScoreRange = Math.max(...scored.map(s2 => s2.score)) - allMinScore;
      const normalized = allScoreRange > 0 ? (s.score - allMinScore) / allScoreRange : 0.5;
      return { number: s.number, weight: 0.05 + normalized * 0.95 };
    });
    
    const totalWeightSum = allWeights.reduce((sum, w) => sum + w.weight, 0);
    const topCandidates = [...allWeights].sort((a, b) => b.weight - a.weight).slice(0, 5);
    const probabilityInfo = topCandidates.map(w => {
      const actualProb = totalWeightSum > 0 ? (w.weight / totalWeightSum * 100) : 0;
      const originalScore = scored.find(s => s.number === w.number);
      return {
        number: w.number,
        probability: actualProb,
        score: originalScore ? originalScore.score : 0,
        zone: originalScore ? originalScore.zone : 0,
        condProb: originalScore ? originalScore.condProb : 0,
        omission: originalScore ? originalScore.omission : 0,
        freq: originalScore ? originalScore.freq : 0
      };
    });
    
    // 计算7区频率排名（供UI显示）
    const zoneNames = ['一区(01-05)', '二区(06-10)', '三区(11-15)', '四区(16-20)', '五区(21-25)', '六区(26-30)', '七区(31-35)'];
    const zoneFrequencies = {};
    for (let zone = 1; zone <= 7; zone++) {
      const start = (zone - 1) * 5 + 1;
      const end = zone * 5;
      let totalFreq = 0;
      for (let i = start; i <= end; i++) {
        totalFreq += frontCounter[String(i)] || frontCounter[i] || 0;
      }
      zoneFrequencies[zone] = totalFreq;
    }
    // 按频率排序
    const zoneRank = Object.entries(zoneFrequencies)
      .sort((a, b) => b[1] - a[1])
      .map(([zone, freq], idx) => ({ zone: parseInt(zone), name: zoneNames[parseInt(zone) - 1], freq, rank: idx + 1 }));
    const zoneInfo = zoneRank.map(z => `${z.name}:${z.freq}次(第${z.rank}名)`).join('、');
    
    console.log('✅ 前区胆码推荐完成:', selected.sort((a, b) => a - b));
    console.log('  实际选择:', selected.map(n => `#${n}`).join(', '), '(加权随机采样)');
    console.log('  Top5概率排名:', probabilityInfo.map(p => 
      `#${p.number}(概率${p.probability.toFixed(1)}%, 区${p.zone}, 条件概率${p.condProb.toFixed(3)}, 遗漏${p.omission}, 频率${p.freq}, 总分${p.score.toFixed(2)})`
    ).join(', '));
    console.log('  区间频率排名:', zoneInfo);
    
    return {
      selected: selected.sort((a, b) => a - b),
      probabilityInfo: probabilityInfo,
      zoneInfo: zoneInfo
    };
  }
}