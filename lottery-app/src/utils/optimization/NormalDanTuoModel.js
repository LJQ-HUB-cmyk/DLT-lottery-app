/**
 * 正态分布胆拖推荐模型
 * 核心特色：期望值/方差引导搜索，和值逼近目标
 * 不修改现有优化器，作为独立的辅助推荐模型
 */

import { CONFIG } from '../core/Config.js';

export class NormalDanTuoModel {

  /**
   * 推荐前区胆码+拖码
   * @param {Object} analyzer - LotteryAnalyzer实例
   * @param {number} danCount - 胆码数量(2-4)
   * @param {string} strategy - 策略: hot/balanced/conservative
   * @returns {Object} { danSelected, tuoSelected, probabilityInfo, description }
   */
  static recommendFront(analyzer, danCount = 3, strategy = 'balanced') {
    console.log('📊 正态分布胆拖推荐（前区）');

    const [frontCounter] = analyzer.frequencyAnalyzer.analyzeFrequency();
    const [expFront] = analyzer.frequencyAnalyzer.calculateExpectedValue();
    const conditionalProb = analyzer.conditionalProbability.calculateConditionalProbability();
    const activeData = analyzer.getActiveData();

    if (activeData.length === 0) {
      return { danSelected: [], tuoSelected: [], probabilityInfo: [], description: '数据不足' };
    }

    // 目标参数
    const targetSumFront = Math.round(expFront * CONFIG.FRONT_COUNT);

    // 融合条件概率的权重
    const frontFreqWeights = {};
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
      const freq = (frontCounter[String(i)] || frontCounter[i] || 0) + 1;
      const cond = (conditionalProb.front[i] || 0) * CONFIG.CONDITIONAL_WEIGHT * conditionalProb.confidence * 10;
      frontFreqWeights[i] = freq + cond;
    }

    // 引导式搜索：找和值最接近目标的前区组合
    let bestFront = null;
    let bestScore = -Infinity;
    const tryCount = 300;

    for (let i = 0; i < tryCount; i++) {
      let f;
      if (i < tryCount * 0.8) {
        // 加权采样
        const frontNums = Object.keys(frontFreqWeights).map(Number);
        const frontWeights = Object.values(frontFreqWeights);
        f = NormalDanTuoModel._weightedSampleNoReplacement(frontNums, frontWeights, CONFIG.FRONT_COUNT);
      } else {
        // 纯随机
        const allNums = Array.from({ length: CONFIG.FRONT_RANGE }, (_, idx) => idx + 1);
        f = [...allNums].sort(() => Math.random() - 0.5).slice(0, CONFIG.FRONT_COUNT);
      }

      const sumF = f.reduce((a, b) => a + b, 0);
      const diffF = Math.abs(sumF - targetSumFront);

      // 综合评分：和值接近度 + 组合质量 + 区间覆盖
      const sumScore = 100 - (diffF / targetSumFront * 50);
      const qualityScore = NormalDanTuoModel._evaluateCombination(f);
      const zones = new Set(f.map(n => Math.floor((n - 1) / 5)));
      const coverageBonus = zones.size >= 4 ? 5 : zones.size >= 3 ? 2 : -3;
      const totalScore = sumScore * 0.3 + qualityScore * 0.6 + coverageBonus;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestFront = f.sort((a, b) => a - b);
      }

      // 早停条件
      if (diffF < 10 && qualityScore >= 70 && zones.size >= 3) {
        bestFront = f.sort((a, b) => a - b);
        break;
      }
    }

    if (!bestFront) {
      bestFront = Array.from({ length: CONFIG.FRONT_COUNT }, (_, i) => i + 1);
    }

    // 确保区间覆盖
    bestFront = NormalDanTuoModel._enforceZoneCoverage(bestFront, 4);

    // 从最佳组合中选胆码（按权重排序，选最关键的号码）
    // 胆码策略：选对目标和值贡献最大的号码
    const perNumTarget = targetSumFront / CONFIG.FRONT_COUNT;
    const danPriority = bestFront.map(n => ({
      number: n,
      sumContribution: Math.abs(n - perNumTarget) < perNumTarget * 0.5 ? 1 : 0.5, // 越接近期望，越适合做胆码
      weight: frontFreqWeights[n] || 1
    })).sort((a, b) => (b.sumContribution + b.weight * 0.001) - (a.sumContribution + a.weight * 0.001));

    const danSelected = danPriority.slice(0, danCount).map(d => d.number).sort((a, b) => a - b);

    // 拖码 = 最佳组合中非胆码的部分 + 其余高分号码
    const tuoFromBest = bestFront.filter(n => !danSelected.includes(n));
    const tuoRest = Array.from({ length: CONFIG.FRONT_RANGE }, (_, i) => i + 1)
      .filter(n => !danSelected.includes(n) && !tuoFromBest.includes(n))
      .sort((a, b) => (frontFreqWeights[b] || 0) - (frontFreqWeights[a] || 0))
      .slice(0, 10 - tuoFromBest.length);
    const tuoSelected = [...tuoFromBest, ...tuoRest].sort((a, b) => a - b);

    // 概率排名信息
    const allWeights = Object.entries(frontFreqWeights)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([num, weight]) => ({
        number: Number(num),
        weight,
        probability: weight / Object.values(frontFreqWeights).reduce((s, w) => s + w, 0) * 100
      }));

    console.log('✅ 正态分布前区推荐完成 - 胆码:', danSelected, '拖码:', tuoSelected.slice(0, 5), '目标和值:', targetSumFront);

    return {
      danSelected,
      tuoSelected,
      probabilityInfo: allWeights,
      targetSum: targetSumFront,
      description: `正态分布模型：期望值${targetSumFront}引导搜索，和值逼近目标+组合质量评估`
    };
  }

  /**
   * 推荐后区胆码+拖码
   */
  static recommendBack(analyzer, backDanCount = 1) {
    const [, backCounter] = analyzer.frequencyAnalyzer.analyzeFrequency();
    const [, expBack] = analyzer.frequencyAnalyzer.calculateExpectedValue();
    const conditionalProb = analyzer.conditionalProbability.calculateConditionalProbability();
    const targetSumBack = Math.round(expBack * CONFIG.BACK_COUNT);

    const backFreqWeights = {};
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
      const freq = (backCounter[String(i)] || backCounter[i] || 0) + 1;
      const cond = (conditionalProb.back[i] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence * 10;
      backFreqWeights[i] = freq + cond;
    }

    // 搜索最接近目标和值的后区组合
    let bestBack = null;
    let bestDiff = Infinity;

    for (let i = 0; i < 100; i++) {
      const backNums = Object.keys(backFreqWeights).map(Number);
      const backWeights = Object.values(backFreqWeights);
      const b = NormalDanTuoModel._weightedSampleNoReplacement(backNums, backWeights, CONFIG.BACK_COUNT);
      const sumB = b.reduce((a, c) => a + c, 0);
      const diff = Math.abs(sumB - targetSumBack);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestBack = b.sort((a, c) => a - c);
      }
      if (diff < 3) break;
    }

    if (!bestBack) bestBack = [1, 2];

    const danSelected = bestBack.slice(0, backDanCount);
    const tuoAll = Array.from({ length: CONFIG.BACK_RANGE }, (_, i) => i + 1)
      .filter(n => !danSelected.includes(n));
    const tuoSelected = tuoAll.slice(0, 4);

    return {
      danSelected: danSelected.sort((a, b) => a - b),
      tuoSelected: tuoSelected.sort((a, b) => a - b),
      targetSum: targetSumBack,
      description: `正态分布后区推荐，目标和值${targetSumBack}`
    };
  }

  /**
   * 评估组合质量
   */
  static _evaluateCombination(front) {
    let score = 50;
    const oddCount = front.filter(n => n % 2 !== 0).length;
    if (oddCount >= 2 && oddCount <= 3) score += 10;
    const bigCount = front.filter(n => n > 17).length;
    if (bigCount >= 2 && bigCount <= 3) score += 10;
    return score;
  }

  /**
   * 加权无重复采样
   */
  static _weightedSampleNoReplacement(nums, weights, count) {
    const selected = [];
    const remainingNums = [...nums];
    const remainingWeights = [...weights];

    for (let i = 0; i < count && remainingNums.length > 0; i++) {
      const totalWeight = remainingWeights.reduce((s, w) => s + w, 0);
      let random = Math.random() * totalWeight;
      let chosenIdx = 0;
      for (let j = 0; j < remainingWeights.length; j++) {
        random -= remainingWeights[j];
        if (random <= 0) { chosenIdx = j; break; }
      }
      if (chosenIdx >= remainingNums.length) chosenIdx = remainingNums.length - 1;
      selected.push(remainingNums[chosenIdx]);
      remainingNums.splice(chosenIdx, 1);
      remainingWeights.splice(chosenIdx, 1);
    }

    return selected;
  }

  /**
   * 确保区间覆盖（至少4个区间有号码）
   */
  static _enforceZoneCoverage(front, minZones) {
    const zones = new Set(front.map(n => Math.floor((n - 1) / 5)));
    if (zones.size >= minZones) return front;

    const result = [...front];
    const missingZones = [];
    for (let z = 0; z < 7; z++) {
      if (!zones.has(z)) missingZones.push(z);
    }

    // 从缺失区间中选最小号码替换最大区间的冗余号码
    for (const missingZone of missingZones) {
      if (result.length >= 5) {
        const zoneStart = missingZone * 5 + 1;
        const zoneEnd = Math.min(missingZone * 5 + 5, CONFIG.FRONT_RANGE);
        const candidate = zoneStart;
        // 替换最冗余区的号码
        const zoneCounts = {};
        result.forEach(n => { const z = Math.floor((n - 1) / 5); zoneCounts[z] = (zoneCounts[z] || 0) + 1; });
        const mostCrowdedZone = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1])[0];
        if (mostCrowdedZone && mostCrowdedZone[1] > 1) {
          const replaceIdx = result.findIndex(n => Math.floor((n - 1) / 5) === Number(mostCrowdedZone[0]) && n !== Math.min(...result));
          if (replaceIdx !== -1 && !result.includes(candidate)) {
            result[replaceIdx] = candidate;
          }
        }
      }
    }

    return result.sort((a, b) => a - b);
  }

  /**
   * 模型说明（优缺点）
   */
  static getDescription() {
    return {
      name: '正态分布',
      icon: '📊',
      strengths: [
        '期望值/方差引导搜索，和值逼近历史均值',
        '组合质量评估：奇偶平衡+大小平衡双维度',
        '区间覆盖保障：确保至少4个区间有号码',
        '80%加权采样+20%纯随机混合，兼顾确定性随机性',
        '早停机制：找到高质量组合立即返回，效率高'
      ],
      weaknesses: [
        '和值逼近是单一全局目标，忽略号码间的微观关系',
        '组合质量评估过于简单（仅奇偶+大小，各10分）',
        '引导式搜索300次迭代，计算成本较高',
        '胆码选择策略（和值贡献优先）可能导致胆码偏向中间值',
        '未利用遗漏/重号/条件概率等维度信息'
      ]
    };
  }
}