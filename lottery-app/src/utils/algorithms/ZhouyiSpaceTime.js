/**
 * 周易时空预测模型
 * 基于卦象计算、时辰映射和动爻相关号码
 */

import { BaseModel } from './BaseModel.js';
import { CONFIG } from '../core/Config.js';

export class ZhouyiSpaceTimeModel extends BaseModel {
  constructor(dependencies) {
    super(dependencies);
    this.name = 'ZhouyiSpaceTime';
  }

  predict() {
    const now = new Date();
    const conditionalProb = this.conditionalProbability.calculateConditionalProbability();
    const correlation = this.correlationAnalyzer.calculateNumberCorrelation();

    // 获取时间要素
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const second = now.getSeconds();
    const weekday = now.getDay();

    // 计算距离下次开奖的天数
    const drawDays = [1, 3, 6];
    let daysToNextDraw = 0;
    for (const drawDay of drawDays) {
      let diff = drawDay - weekday;
      if (diff < 0) diff += 7;
      if (diff === 0 && hour >= 20) diff = 7;
      if (diff > 0) {
        daysToNextDraw = diff;
        break;
      }
    }
    if (daysToNextDraw === 0) daysToNextDraw = 7;

    // 计算卦象
    const upperTrigram = (year + month + day) % 8;
    const lowerTrigram = (year + month + day + hour + minute) % 8;
    const movingLine = (year + month + day + hour + minute + second + daysToNextDraw) % 6;

    // 卦象元素映射
    const trigramElements = {
      0: [1, 8, 15, 22, 29],
      1: [2, 9, 16, 23, 30],
      2: [3, 10, 17, 24, 31],
      3: [4, 11, 18, 25, 32],
      4: [5, 12, 19, 26, 33],
      5: [6, 13, 20, 27, 34],
      6: [7, 14, 21, 28, 35],
      7: [1, 9, 17, 25, 33]
    };

    // 根据上卦和下卦组合选号
    const poolUpper = trigramElements[upperTrigram] || [];
    const poolLower = trigramElements[lowerTrigram] || [];
    const combinedPool = [...new Set([...poolUpper, ...poolLower])];

    // 如果号码池不足，补充动爻相关号码
    if (combinedPool.length < CONFIG.FRONT_COUNT) {
      const movingLineNumbers = [
        movingLine + 1,
        movingLine + 6,
        movingLine + 11,
        movingLine + 16,
        movingLine + 21,
        movingLine + 26,
        movingLine + 31
      ].filter(n => n >= 1 && n <= CONFIG.FRONT_RANGE);
      combinedPool.push(...movingLineNumbers);
    }

    // 构建卦象池权重
    const [frontCounter, backCounter] = this.frequencyAnalyzer.analyzeFrequency();
    const zhouyiFrontWeights = {};
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
      const isInPool = combinedPool.includes(i);
      const freqWeight = isInPool ? ((frontCounter[i] || 0) + 1) * 2 : 1;
      const condBonus = (conditionalProb.front[i] || 0) * CONFIG.CONDITIONAL_WEIGHT * conditionalProb.confidence * 8;
      
      let corrBonus = 0;
      if (correlation.front[i]) {
        const correlations = Object.values(correlation.front[i]);
        if (correlations.length > 0) {
          corrBonus = correlations.reduce((sum, c) => sum + c, 0) / correlations.length * 0.1;
        }
      }
      
      const scienceBonus = isInPool ? 0 : (conditionalProb.front[i] || 0) * CONFIG.CONDITIONAL_WEIGHT * conditionalProb.confidence * 3;
      zhouyiFrontWeights[i] = freqWeight + condBonus + corrBonus + scienceBonus;
    }

    let front = this.smartFrontSample(zhouyiFrontWeights, CONFIG.FRONT_COUNT);

    // 后区：时辰候选 + 条件概率融合
    const hourBackMap = {
      0: [1, 6, 7, 12], 1: [1, 6, 7, 12],
      2: [2, 5, 8, 11], 3: [2, 5, 8, 11],
      4: [3, 4, 9, 10], 5: [3, 4, 9, 10],
      6: [1, 4, 7, 10], 7: [1, 4, 7, 10],
      8: [2, 5, 8, 11], 9: [2, 5, 8, 11],
      10: [3, 6, 9, 12], 11: [3, 6, 9, 12],
      12: [1, 6, 7, 12], 13: [1, 6, 7, 12],
      14: [2, 5, 8, 11], 15: [2, 5, 8, 11],
      16: [3, 4, 9, 10], 17: [3, 4, 9, 10],
      18: [1, 4, 7, 10], 19: [1, 4, 7, 10],
      20: [2, 5, 8, 11], 21: [2, 5, 8, 11],
      22: [3, 6, 9, 12], 23: [3, 6, 9, 12]
    };

    const backCandidates = hourBackMap[hour] || [1, 6, 7, 12];
    const expandedBackWeights = {};
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
      const isTimeCandidate = backCandidates.includes(i);
      const timeWeight = isTimeCandidate ? 2.0 : 0.5;
      const freqWeight = (backCounter[i] || 0) + 1;
      const condWeight = (conditionalProb.back[i] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence * 8;
      expandedBackWeights[i] = timeWeight * freqWeight + condWeight;
    }

    const back = this.smartBackSample(expandedBackWeights, 'zhouyi');

    const coveredFront = this.enforceZoneCoverage(front, 4);
    coveredFront.sort((a, b) => a - b);
    back.sort((a, b) => a - b);

    console.log('📊 ZhouyiSpaceTime 生成结果 - 前区:', coveredFront.length, '个号码', coveredFront, '后区:', back.length, '个号码', back);

    return [...coveredFront, ...back];
  }

  getDescription() {
    return '基于周易卦象和时辰映射的预测模型';
  }
}
