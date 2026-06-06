/**
 * 贝叶斯动态胆拖推荐模型
 * 核心特色：先验概率→后验概率动态更新，重号因子+和值趋势因子
 * 不修改现有优化器，作为独立的辅助推荐模型
 */

import { CONFIG } from '../core/Config.js';

export class BayesianDanTuoModel {

  /**
   * 推荐前区胆码+拖码
   * @param {Object} analyzer - LotteryAnalyzer实例
   * @param {number} danCount - 胆码数量(2-4)
   * @param {string} strategy - 策略: hot/balanced/conservative
   * @returns {Object} { danSelected, tuoSelected, probabilityInfo, description }
   */
  static recommendFront(analyzer, danCount = 3, strategy = 'hot') {
    console.log('🔮 贝叶斯动态胆拖推荐（前区）');

    const [frontCounter] = analyzer.frequencyAnalyzer.analyzeFrequency();
    const conditionalProb = analyzer.conditionalProbability.calculateConditionalProbability();
    const omission = analyzer.omissionCalculator.calculateOmission();
    const sumTrend = analyzer.trendAnalyzer.analyzeSumTrend();
    const repeatAnalysis = analyzer.trendAnalyzer.analyzeRepeatNumbers();
    const activeData = analyzer.getActiveData();
    const totalDraws = activeData.length;

    if (totalDraws === 0) {
      return { danSelected: [], tuoSelected: [], probabilityInfo: [], backDanSelected: [], backTuoSelected: [], description: '数据不足' };
    }

    const lastDraw = activeData[activeData.length - 1];

    // 1. 先验概率（频率基础）
    const priorFront = {};
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
      priorFront[i] = (frontCounter[String(i)] || frontCounter[i] || 0) / totalDraws;
    }

    // 2. 时间加权得分（归一化到0-1范围，避免高频号过度主导）
    const frontTimeScores = {}; 
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) frontTimeScores[i] = 0; 
    for (let idx = 0; idx < activeData.length; idx++) {
      const draw = activeData[idx];
      const timeWeight = Math.exp((idx - activeData.length + 1) / activeData.length) * 0.2;
      for (const num of draw.front) frontTimeScores[num] += timeWeight; 
    }
    const frontMaxTime = Math.max(...Object.values(frontTimeScores)) || 1;
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) frontTimeScores[i] /= frontMaxTime;

    // 3. 近期频率趋势
    const recentCount = Math.min(CONFIG.RECENT_DRAWS_FOR_TREND, activeData.length);
    const recentFrontFreq = {};
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) recentFrontFreq[i] = 0;
    const recentDraws = activeData.slice(-recentCount);
    for (const draw of recentDraws) {
      for (const num of draw.front) recentFrontFreq[num]++;
    }

    // 4. 遗漏均值
    const frontAvgOmission = analyzer.omissionCalculator.getAverageOmission('front');

    // 5. 后验概率计算（8维评分，与BayesianDynamic模型核心一致）
    const posteriorFront = {};
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
      let score = priorFront[i] * 0.15;
      score += (frontTimeScores[i] || 0) * 0.12;

      const recentRate = recentFrontFreq[i] / recentCount;
      const overallRate = (frontCounter[String(i)] || frontCounter[i] || 0) / totalDraws;
      score += (recentRate - overallRate) * 0.12;

      score += (conditionalProb.front[i] || 0) * CONFIG.CONDITIONAL_WEIGHT * conditionalProb.confidence;

      const currentOmission = omission.front[i] || 0;
      const omissionDiff = Math.abs(currentOmission - frontAvgOmission);
      const omissionFactor = Math.max(0, 1 - omissionDiff / (frontAvgOmission * 2));
      score += omissionFactor * 0.15;

      const zoneIndex = Math.floor((i - 1) / 5);
      score += (zoneIndex % 2 === 0) ? 0.05 : 0;

      // 重号因子（核心特色维度）
      if (lastDraw && lastDraw.front.includes(i)) {
        score += repeatAnalysis.frontRepeatRate * 0.08;
      }

      // 和值趋势因子（核心特色维度）
      if (sumTrend.trendFront > 5 && i > 18) {
        score += 0.04;
      } else if (sumTrend.trendFront < -5 && i <= 18) {
        score += 0.04;
      }

      posteriorFront[i] = score;
    }

    // 6. 确定性推荐：直接选择评分最高的号码作为胆码
    const sortedFront = Object.entries(posteriorFront).sort((a, b) => b[1] - a[1]);
    const candidateSize = strategy === 'hot' ? 10 : strategy === 'balanced' ? 15 : 20;
    const candidatePool = sortedFront.slice(0, candidateSize).map(x => ({
      number: Number(x[0]), posteriorScore: x[1]
    }));

    // 胆码：确定性推荐（直接取评分最高），确保结果稳定可预期
    const danSelected = candidatePool.slice(0, danCount).map(c => c.number);

    // 7. 拖码：确定性推荐（按评分排序取剩余号码）
    const tuoAllNumbers = Array.from({ length: CONFIG.FRONT_RANGE }, (_, i) => i + 1)
      .filter(n => !danSelected.includes(n));
    const tuoCandidates = tuoAllNumbers.map(n => ({
      number: n, posteriorScore: posteriorFront[n] || 0
    }));

    // 拖码数量：根据胆码数量动态调整（保证胆拖总数约13-15个号码）
    const tuoCount = 15 - danCount;
    const tuoSelected = tuoCandidates.sort((a, b) => b.posteriorScore - a.posteriorScore)
      .slice(0, tuoCount).map(c => c.number);

    // 概率排名信息（基于Top5号码的相对权重）
    const probabilityInfo = sortedFront.slice(0, 5).map(([num, score], idx) => {
      return {
        number: Number(num),
        probability: score,
        rank: idx + 1,
        score: score
      };
    });

    console.log('✅ 贝叶斯动态前区推荐完成 - 胆码:', danSelected.sort((a, b) => a - b));
    console.log('  拖码:', tuoSelected.sort((a, b) => a - b));

    return {
      danSelected: danSelected.sort((a, b) => a - b),
      tuoSelected: tuoSelected.sort((a, b) => a - b),
      probabilityInfo,
      description: '贝叶斯动态模型：先验→后验修正，融合重号因子+和值趋势+时间加权（归一化）',
      recommendType: '确定性推荐'
    };
  }

  /**
   * 推荐后区胆码+拖码
   */
  static recommendBack(analyzer, backDanCount = 1) {
    const [, backCounter] = analyzer.frequencyAnalyzer.analyzeFrequency();
    const conditionalProb = analyzer.conditionalProbability.calculateConditionalProbability();
    const omission = analyzer.omissionCalculator.calculateOmission();
    const repeatAnalysis = analyzer.trendAnalyzer.analyzeRepeatNumbers();
    const activeData = analyzer.getActiveData();
    const totalDraws = activeData.length;
    const lastDraw = activeData[activeData.length - 1];
    const backAvgOmission = analyzer.omissionCalculator.getAverageOmission('back');

    const priorBack = {};
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
      priorBack[i] = (backCounter[String(i)] || backCounter[i] || 0) / totalDraws;
    }

    const backTimeScores = {};
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) backTimeScores[i] = 0;
    for (let idx = 0; idx < activeData.length; idx++) {
      const draw = activeData[idx];
      const timeWeight = Math.exp((idx - activeData.length + 1) / activeData.length) * 0.2;
      for (const num of draw.back) backTimeScores[num] += timeWeight;
    }
    // 归一化到0-1范围，避免高频号过度主导
    const backMaxTime = Math.max(...Object.values(backTimeScores)) || 1;
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) backTimeScores[i] /= backMaxTime;

    const recentCount = Math.min(CONFIG.RECENT_DRAWS_FOR_TREND, activeData.length);
    const recentBackFreq = {};
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) recentBackFreq[i] = 0;
    const recentDraws = activeData.slice(-recentCount);
    for (const draw of recentDraws) {
      for (const num of draw.back) recentBackFreq[num]++;
    }

    const scored = []; // 8维评分结果
    const posteriorBack = {};
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
      let score = priorBack[i] * 0.15;                     // 维度1: 先验概率 15%
      score += (backTimeScores[i] || 0) * 0.12;           // 维度2: 时间加权 12%（已归一化）
      const recentRate = recentBackFreq[i] / recentCount;
      const overallRate = (backCounter[String(i)] || backCounter[i] || 0) / totalDraws;
      score += (recentRate - overallRate) * 0.12;         // 维度3: 动量因子 12%
      score += (conditionalProb.back[i] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence; // 维度4: 条件概率 20%
      const currentOmission = omission.back[i] || 0;
      const omissionDiff = Math.abs(currentOmission - backAvgOmission);
      const omissionFactor = Math.max(0, 1 - omissionDiff / (backAvgOmission * 2));
    // 维度5: 遗漏回归 15%
      score += omissionFactor * 0.15;
      score += (i % 2 === 1) ? 0.05 : 0;                  // 维度6: 奖偶偏好 5%
      // 重号因子
      const streakFlag = lastDraw && lastDraw.back.includes(i);
      if (streakFlag) {
        score += repeatAnalysis.backRepeatRate * 0.08;      // 维度7: 重号因子 8%
      }

      // 维度8: 冷热状态检测 (8%) - 动态识别“历史热号正在冷却”的现象
      // 8a. 频率温度比率：近期出现率 / 期望出现率
      const expectedRate = 2 / CONFIG.BACK_RANGE; // ≈0.167
      const temperatureRatio = recentRate / expectedRate;
      let temperatureScore = 0;
      if (temperatureRatio >= 1.5) {
        // 热号加分：近期频率显著高于期望
        temperatureScore = Math.min(0.08, (temperatureRatio - 1.5) * 0.04);
      } else if (temperatureRatio < 0.5) {
        // 冷号惩罚：如果历史也是热号但近期冷却，惩罚更重
        const historicalHeat = overallRate / expectedRate;
        const coolPenalty = Math.min(0.08, (0.5 - temperatureRatio) * 0.04 * Math.min(2, historicalHeat));
        temperatureScore = -coolPenalty;
      }
      // 8b. 连续缺席惩罚：当前遗漏超过均值1.5倍时，额外扣分
      let streakPenalty = 0;
      if (currentOmission > backAvgOmission * 1.5) {
        const streakRatio = currentOmission / backAvgOmission;
        const heatMultiplier = Math.min(2, overallRate / expectedRate);
        streakPenalty = -Math.min(0.08, (streakRatio - 1.5) * 0.02 * heatMultiplier);
      }
      score += temperatureScore + streakPenalty;

      const tempDesc = temperatureScore > 0 ? '🔥热号加分' : temperatureScore < 0 ? '❄️冷号惩罚' : '中性';
      const streakDesc = streakPenalty < 0 ? `连续缺席扣分(${streakPenalty.toFixed(4)})` : '';
      console.log(`  后区${i}: 先验=${(priorBack[i]*0.15).toFixed(4)} 时间=${(backTimeScores[i]*0.12).toFixed(4)} 动量=${((recentRate-overallRate)*0.12).toFixed(4)} 条件=${((conditionalProb.back[i]||0)*CONFIG.BACK_CONDITIONAL_WEIGHT*conditionalProb.confidence).toFixed(4)} 遗漏=${(omissionFactor*0.15).toFixed(4)} 奖偶=${i%2===1?'0.05':'0'} 重号=${streakFlag?'✓':'✗'} 温度=${tempDesc}${streakDesc} → 总分=${score.toFixed(4)}`);

      posteriorBack[i] = score;
      scored.push({
        number: i,
        score,
        priorScore: priorBack[i] * 0.15,
        timeScore: backTimeScores[i] * 0.12,
        momentumScore: (recentRate - overallRate) * 0.12,
        conditionalScore: (conditionalProb.back[i] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence,
        omissionScore: omissionFactor * 0.15,
        oddEvenScore: i % 2 === 1 ? 0.05 : 0,
        repeatFlag: streakFlag ? '✓' : '',
        temperatureRatio,
        temperatureScore,
        streakPenalty
      });
    }

    const allCandidates = scored.sort((a, b) => b.score - a.score)
      .map(x => ({ number: x.number, posteriorScore: x.score }));

    // 概率排名信息
    const probabilityInfo = scored.slice(0, 3).map(s => {
      const totalSum = scored.reduce((acc, x) => acc + x.score + 0.5, 0);
      return {
        number: s.number,
        probability: totalSum > 0 ? ((s.score + 0.5) / totalSum * 100) : 0,
        score: s.score,
        priorScore: s.priorScore,
        timeScore: s.timeScore,
        momentumScore: s.momentumScore,
        conditionalScore: s.conditionalScore,
        omissionScore: s.omissionScore,
        oddEvenScore: s.oddEvenScore,
        repeatFlag: s.repeatFlag,
        temperatureRatio: s.temperatureRatio,
        temperatureScore: s.temperatureScore,
        streakPenalty: s.streakPenalty
      };
    });

    // 后区胆码：确定性推荐（直接取评分最高），确保推荐结果稳定可预期
    // 后区12选1的特性适合确定性策略，每次推荐都是同一号码
    const danSelected = allCandidates.slice(0, backDanCount).map(c => c.number);

    const tuoAll = Array.from({ length: CONFIG.BACK_RANGE }, (_, i) => i + 1)
      .filter(n => !danSelected.includes(n));
    const tuoCandidates = tuoAll.map(n => ({
      number: n, posteriorScore: posteriorBack[n] || 0
    }));
    // 后区拖码：确定性推荐（按评分排序取前4个）
    const tuoSelected = tuoCandidates.sort((a, b) => b.posteriorScore - a.posteriorScore)
      .slice(0, 4).map(c => c.number);

    return {
      danSelected: danSelected.sort((a, b) => a - b),
      tuoSelected: tuoSelected.sort((a, b) => a - b),
      description: '8维评分：先验+时间+动量+条件概率+遗漏+奇偶+重号+冷热状态',
      probabilityInfo,
      recommendType: '确定性推荐'
    };
  }

  /**
   * 加权随机采样
   */
  static _weightedSample(candidates, count) {
    const minScore = Math.min(...candidates.map(c => c.posteriorScore));
    const scoreRange = Math.max(...candidates.map(c => c.posteriorScore)) - minScore;

    const weighted = candidates.map(c => ({
      ...c,
      sampleWeight: 0.05 + (scoreRange > 0 ? (c.posteriorScore - minScore) / scoreRange : 0.5) * 0.95
    }));

    const selected = [];
    const remaining = [...weighted];

    while (selected.length < count && remaining.length > 0) {
      const totalWeight = remaining.reduce((sum, w) => sum + w.sampleWeight, 0);
      let random = Math.random() * totalWeight;
      let chosenIdx = 0;
      for (let j = 0; j < remaining.length; j++) {
        random -= remaining[j].sampleWeight;
        if (random <= 0) { chosenIdx = j; break; }
      }
      if (chosenIdx >= remaining.length) chosenIdx = remaining.length - 1;
      selected.push(remaining[chosenIdx].number);
      remaining.splice(chosenIdx, 1);
    }

    return selected;
  }

  /**
   * 模型说明（优缺点）
   */
  static getDescription() {
    return {
      name: '贝叶斯动态',
      icon: '🔮',
      strengths: [
        '先验→后验概率动态更新，理论基础扎实',
        '重号因子：利用相邻期号码重复规律（大乐超平均重号率约0.6-0.8个/期）',
        '和值趋势因子：捕捉和值上升/下降趋势',
        '时间加权（归一化）：近期数据权重更高，避免高频号主导',
        '遗漏值因子：偏离均值越近得分越高（温和回归）',
        '冷热状态检测：动态识别“历史热号正在冷却”现象'
      ],
      weaknesses: [
        '先验概率基于全量频率，长期冷号先验极低难以翻身',
        '和值趋势判断阈值固定(±5)，对小幅波动不敏感',
        '区间平衡因子过于简单（仅奇偶区间交替加分0.05）',
        '后验概率各维度权重固定，缺乏自适应机制'
      ]
    };
  }
}