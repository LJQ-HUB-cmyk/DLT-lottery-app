/**
 * 后区拖码智能推荐优化器
 * 融合：条件概率 + 遗漏回归 + 时间衰减 + 频率 + 与胆码协同性
 * 使用加权随机采样，每次推荐结果不同但合理
 */

import { CONFIG } from '../core/Config.js';

export class BackTuoOptimizer {
  /**
   * 优化后区拖码推荐（多维度智能评分 + 加权随机采样）
   * @param {Object} analyzer - LotteryAnalyzer实例
   * @param {number[]} danNumbers - 后区胆码数组
   * @param {number} tuoCount - 需要推荐的拖码数量
   * @returns {Object} { selected: number[], probabilityInfo: Object[] }
   */
  static optimize(analyzer, danNumbers, tuoCount = 4, strategy = 'balanced') {
    console.log('🎯 后区拖码智能推荐（多维度评分 + 加权随机采样）');
    console.log('  胆码:', danNumbers, '拖码数量:', tuoCount);

    // 1. 获取条件概率
    const conditionalProb = analyzer.conditionalProbability.calculateConditionalProbability();
    const maxCondProb = Math.max(...Object.values(conditionalProb.back));

    // 2. 获取遗漏数据
    const omissionData = analyzer.omissionCalculator.calculateOmission();
    const avgBackOmission = analyzer.omissionCalculator.getAverageOmission('back');
    const omissionStd = analyzer.omissionCalculator.getOmissionStd('back');
    const maxPositiveDeviation = Math.max(
      ...Object.values(omissionData.back)
        .map(o => (o || 0) - avgBackOmission)
        .filter(d => d > 0)
    );

    // 3. 获取频率数据（全量 + 近期趋势动量）
    const [, backCounter] = analyzer.frequencyAnalyzer.analyzeFrequency();
    const maxFreq = Math.max(...Object.values(backCounter));
    const recentFreq = analyzer.frequencyAnalyzer.analyzeRecentFrequency();

    // 4. 获取时间衰减权重
    const rawTimeWeights = analyzer.calculateTimeDecayWeights();
    const maxBackTimeWeight = Math.max(...Object.values(rawTimeWeights.back));

    // 5. 获取关联性数据（与胆码的共现）
    const correlationData = analyzer.correlationAnalyzer.calculateNumberCorrelation();
    const activeData = analyzer.getActiveData();
    
    // 热号策略专用数据
    const repeatAnalysis = analyzer.trendAnalyzer.analyzeRepeatNumbers();
    const lastDraw = activeData.length > 0 ? activeData[activeData.length - 1] : null;
    
    // 热区趋势：近5期后区两区频率占比
    const veryRecentCount = Math.min(5, activeData.length);
    const veryRecentData = activeData.slice(-veryRecentCount);
    let hotFirstHalfFreq = 0;
    let hotSecondHalfFreq = 0;
    let hotTotalFreq = 0;
    for (const draw of veryRecentData) {
      for (const num of draw.back) {
        if (num <= 6) hotFirstHalfFreq++;
        else hotSecondHalfFreq++;
        hotTotalFreq++;
      }
    }
    const hotFirstHalfRatio = hotTotalFreq > 0 ? hotFirstHalfFreq / hotTotalFreq : 0.5;

    // 排除胆码后的候选拖码
    const candidateNumbers = Array.from({ length: CONFIG.BACK_RANGE }, (_, i) => i + 1)
      .filter(n => !danNumbers.includes(n));

    // 预计算关联性最大值
    const TIME_DECAY = 0.98;
    const rawCorrScores = candidateNumbers.map(tuoNum => {
      let corr = 0;
      const recentDraws = activeData.slice(-15);
      for (const dan of danNumbers) {
        const coOccurrence = correlationData.back[dan] && correlationData.back[dan][tuoNum] || 0;
        corr += coOccurrence;
        for (const draw of recentDraws) {
          if (draw.back.includes(dan) && draw.back.includes(tuoNum)) {
            const recencyIdx = recentDraws.indexOf(draw);
            corr += Math.pow(TIME_DECAY, recentDraws.length - recencyIdx);
          }
        }
      }
      return { number: tuoNum, corr };
    });
    const maxCorr = Math.max(...rawCorrScores.map(s => s.corr));

    // 6. 计算每个号码的综合得分
    // 热号策略7维度：条件概率20 + 遗漏20 + 频率20 + 时间衰减10 + 热区趋势10 + 重号因子10 + 冷却惩罚扣5 = 85~90
    // 均衡/保守策略5维度：条件概率25 + 遗漏25 + 频率20 + 时间衰减15 + 区间均衡15 = 总分100
    const scored = [];

    // 区间均衡：后区两区(1-6/7-12)
    const firstHalfFreq = Array.from({ length: 6 }, (_, i) => i + 1)
      .reduce((sum, n) => sum + (backCounter[String(n)] || backCounter[n] || 0), 0);
    const secondHalfFreq = Array.from({ length: 6 }, (_, i) => i + 7)
      .reduce((sum, n) => sum + (backCounter[String(n)] || backCounter[n] || 0), 0);
    const totalFreq = firstHalfFreq + secondHalfFreq;
    const firstHalfRatio = totalFreq > 0 ? firstHalfFreq / totalFreq : 0.5;

    for (const num of candidateNumbers) {
      let score = 0;
      const isFirstHalf = num <= 6;

      // 维度1: 条件概率得分（热号20分，均衡/保守25分）- 归一化
      const condProb = conditionalProb.back[num] || 0;
      const normalizedCondProb = maxCondProb > 0 ? condProb / maxCondProb : 0;
      score += normalizedCondProb * (strategy === 'hot' ? 20 : 25);

      // 维度2: 遗漏/趋势评分（热号20分，均衡/保守25分）- 热号策略奖励低遗漏，均衡/保守策略奖励遗漏回归
      const currentOmission = omissionData.back[num] || 0;
      const omissionDeviation = currentOmission - avgBackOmission;
      if (strategy === 'hot') {
        // 热号策略：奖励低遗漏（近期频繁出现的热号）
        if (omissionDeviation < 0) {
          const maxNegDeviation = Math.max(
            ...Object.values(omissionData.back)
              .map(o => (o || 0) - avgBackOmission)
              .filter(d => d < 0)
              .map(d => Math.abs(d))
          );
          const normalizedHotness = maxNegDeviation > 0
            ? Math.abs(omissionDeviation) / maxNegDeviation : 0;
          score += normalizedHotness * 20;
        }
      } else {
        // 均衡/保守策略：遗漏回归逻辑
        if (omissionDeviation > 0) {
          const normalizedDeviation = maxPositiveDeviation > 0
            ? omissionDeviation / maxPositiveDeviation : 0;
          score += normalizedDeviation * 20;
          if (omissionDeviation > omissionStd * 2) {
            score += 5;
          }
        }
      }

      // 维度3: 频率得分（20分满分）- 归一化 + 近期趋势动量加成
      const freq = backCounter[String(num)] || backCounter[num] || 0;
      const freqBase = maxFreq > 0 ? (freq / maxFreq) * 15 : 0;
      const momentum = recentFreq.backMomentum[num] || 0;
      const maxMomentum = Math.max(...Object.values(recentFreq.backMomentum).map(m => Math.abs(m)));
      const normalizedMomentum = maxMomentum > 0 ? momentum / maxMomentum : 0;
      score += freqBase + Math.max(0, normalizedMomentum) * 5;

      // 维度4: 时间衰减得分（热号10分，均衡/保守15分）- 归一化
      const rawTimeWeight = rawTimeWeights.back[num] || 0;
      const normalizedTimeWeight = maxBackTimeWeight > 0
        ? rawTimeWeight / maxBackTimeWeight : 0;
      score += normalizedTimeWeight * (strategy === 'hot' ? 10 : 15);

      // 维度5: 区间/热区评分（热号：热区趋势10分+重号因子10分=20分；均衡/保守：区间均衡15分）
      if (strategy === 'hot') {
        // 热区趋势加分（10分满分）：号码所在半区的近期频率占比越高加分越多
        const halfRecentRatio = hotTotalFreq > 0
          ? (isFirstHalf ? hotFirstHalfFreq / hotTotalFreq : hotSecondHalfFreq / hotTotalFreq) : 0.5;
        // 后区理论均值=0.5，占比超过0.5越多加分越多
        const hotZoneBonus = halfRecentRatio > 0.45
          ? Math.min((halfRecentRatio - 0.45) * 20, 10) : 0;
        score += hotZoneBonus;
        
        // 重号因子加分（10分满分）：上期出现的号码本期更可能再出
        if (lastDraw && lastDraw.back.includes(num)) {
          score += Math.min(repeatAnalysis.backRepeatRate * 10, 10);
        }
      } else {
        // 均衡/保守策略：区间均衡补偿
        if (isFirstHalf && firstHalfRatio < 0.5) {
          score += Math.abs(0.5 - firstHalfRatio) * 30;
        } else if (!isFirstHalf && firstHalfRatio > 0.5) {
          score += Math.abs(0.5 - firstHalfRatio) * 30;
        }
      }
      
      // 热号策略：冷却惩罚（最多扣5分）
      // 高频号且当前遗漏 > 平均遗漏 → 正在冷却 → 扣分
      if (strategy === 'hot') {
        const totalBackFreq = Object.values(backCounter).reduce((a, b) => a + b, 0);
        const avgFreqPerNum = totalBackFreq / CONFIG.BACK_RANGE;
        const numFreq = backCounter[String(num)] || backCounter[num] || 0;
        if (numFreq > avgFreqPerNum && currentOmission > avgBackOmission) {
          const coolingDegree = (currentOmission - avgBackOmission) / avgBackOmission;
          const freqHeat = numFreq / avgFreqPerNum;
          const penalty = Math.min(coolingDegree * freqHeat * 2, 5);
          score -= penalty;
        }
      }

      scored.push({
        number: num,
        score,
        condProb,
        omission: currentOmission,
        freq,
        timeWeight: normalizedTimeWeight
      });
    }

    // 加权随机采样：高分号码概率更高，但每次结果不同
    const minScore = Math.min(...scored.map(s => s.score));
    const scoreRange = Math.max(...scored.map(s => s.score)) - minScore;

    const weights = scored.map(s => {
      const normalized = scoreRange > 0 ? (s.score - minScore) / scoreRange : 0.5;
      return {
        ...s,
        sampleWeight: 0.1 + normalized * 0.9  // 最低10%概率
      };
    });

    // 加权随机采样选出 tuoCount 个号码
    const selected = [];
    const remaining = [...weights];

    // 区间覆盖选择：热号策略确保两区至少各1个（防止极端分布）；均衡/保守策略确保两区覆盖
    if (tuoCount >= 2) {
      const zone1Candidates = remaining.filter(w => w.number <= 6);
      const zone2Candidates = remaining.filter(w => w.number > 6);

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

      const z1 = pickOneFromZone(zone1Candidates, remaining);
      const z2 = pickOneFromZone(zone2Candidates, remaining);
      if (z1) selected.push(z1);
      if (z2) selected.push(z2);
    }
    // 热号策略：如果只选了1个拖码，确保两区覆盖（优先选热区号码）
    if (strategy === 'hot' && tuoCount === 1 && selected.length === 0) {
      // 热区优先：选择近期频率更高的半区中的最优号码
      const hotZone1Weight = remaining.filter(w => w.number <= 6)
        .reduce((sum, w) => sum + w.sampleWeight, 0);
      const hotZone2Weight = remaining.filter(w => w.number > 6)
        .reduce((sum, w) => sum + w.sampleWeight, 0);
      const hotZonePool = hotZone1Weight >= hotZone2Weight
        ? remaining.filter(w => w.number <= 6)
        : remaining.filter(w => w.number > 6);
      if (hotZonePool.length > 0) {
        const totalW = hotZonePool.reduce((sum, w) => sum + w.sampleWeight, 0);
        let random = Math.random() * totalW;
        for (const w of hotZonePool) {
          random -= w.sampleWeight;
          if (random <= 0) {
            remaining.splice(remaining.findIndex(r => r.number === w.number), 1);
            selected.push(w.number);
            break;
          }
        }
      }
    }

    // 补充剩余拖码
    while (selected.length < tuoCount && remaining.length > 0) {
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

    // 计算概率排名信息
    const allWeights = scored.map(s => {
      const allMinScore = Math.min(...scored.map(s2 => s2.score));
      const allScoreRange = Math.max(...scored.map(s2 => s2.score)) - allMinScore;
      const normalized = allScoreRange > 0 ? (s.score - allMinScore) / allScoreRange : 0.5;
      return { number: s.number, weight: 0.1 + normalized * 0.9 };
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
        condProb: originalScore ? originalScore.condProb : 0,
        omission: originalScore ? originalScore.omission : 0,
        freq: originalScore ? originalScore.freq : 0
      };
    });

    console.log('✅ 后区拖码推荐完成:', selected.sort((a, b) => a - b));
    console.log('  实际选择:', selected.map(n => `#${n}`).join(', '), '(加权随机采样)');
    console.log('  Top5概率排名:', probabilityInfo.map(p =>
      `#${p.number}(概率${p.probability.toFixed(1)}%, 条件概率${p.condProb.toFixed(3)}, 遗漏${p.omission}, 频率${p.freq}, 总分${p.score.toFixed(2)})`
    ).join(', '));

    return {
      selected: selected.sort((a, b) => a - b),
      probabilityInfo: probabilityInfo
    };
  }
}