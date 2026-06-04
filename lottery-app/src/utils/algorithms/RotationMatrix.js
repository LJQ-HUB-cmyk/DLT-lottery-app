/**
 * 旋转矩阵预测模型
 * 使用5种不同的旋转策略生成号码组合
 */

import { BaseModel } from './BaseModel.js';
import { CONFIG } from '../core/Config.js';

export class RotationMatrixModel extends BaseModel {
  constructor(dependencies) {
    super(dependencies);
    this.name = 'RotationMatrix';
  }

  predict() {
    const [frontCounter, backCounter] = this.frequencyAnalyzer.analyzeFrequency();
    const omission = this.omissionCalculator.calculateOmission();
    const conditionalProb = this.conditionalProbability.calculateConditionalProbability();
    const correlation = this.correlationAnalyzer.calculateNumberCorrelation();

    // 根据频率排序，选择高频号码作为基础池
    const sortedFrontNums = Object.entries(frontCounter)
      .sort((a, b) => b[1] - a[1])
      .slice(0, CONFIG.ROTATION_HIGH_FREQ)
      .map(x => Number(x[0]));

    // 添加低频号和遗漏号
    const lowFreqFront = Object.entries(frontCounter)
      .filter(([, count]) => count === 0 || count <= 2)
      .map(x => Number(x[0]))
      .slice(0, 8);

    const highOmissionFront = Object.entries(omission.front)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(x => Number(x[0]));

    const allFrontPool = [...new Set([...sortedFrontNums, ...lowFreqFront, ...highOmissionFront])];

    // 辅助方法：构建加权权重
    const buildStrategyWeights = (pool, isFront) => {
      const weights = {};
      for (const num of pool) {
        const freq = (isFront ? frontCounter[num] : backCounter[num]) || 0;
        const cond = isFront
          ? (conditionalProb.front[num] || 0) * CONFIG.CONDITIONAL_WEIGHT * conditionalProb.confidence * 8
          : (conditionalProb.back[num] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence * 8;
        let corr = 0;
        if (isFront && correlation.front[num]) {
          const correlations = Object.values(correlation.front[num]);
          if (correlations.length > 0) {
            corr = correlations.reduce((sum, c) => sum + c, 0) / correlations.length * 0.1;
          }
        }
        weights[num] = freq + 1 + cond + corr;
      }
      return weights;
    };

    // 随机选择一个策略（0-4）
    const strategyIndex = Math.floor(Math.random() * 5);
    let front;

    if (strategyIndex === 0) {
      // 策略1：主要高频号
      const weights = buildStrategyWeights(sortedFrontNums, true);
      const fullWeights = {};
      for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
        fullWeights[i] = sortedFrontNums.includes(i)
          ? (weights[i] || 0) * 2
          : CONFIG.FRONT_RANDOM_BONUS;
      }
      front = this.smartFrontSample(fullWeights, CONFIG.FRONT_COUNT);
    } else if (strategyIndex === 1) {
      // 策略2：混合高频和中频
      const midFreq = allFrontPool.filter(n => !sortedFrontNums.includes(n)).slice(0, 12);
      const mixedPool = [...sortedFrontNums.slice(0, 10), ...midFreq];
      const weights = buildStrategyWeights(mixedPool, true);
      const fullWeights = {};
      for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
        fullWeights[i] = mixedPool.includes(i)
          ? (weights[i] || 0) * 1.5
          : CONFIG.FRONT_RANDOM_BONUS;
      }
      front = this.smartFrontSample(fullWeights, CONFIG.FRONT_COUNT);
    } else if (strategyIndex === 2) {
      // 策略3：包含冷门号
      const withCold = [...sortedFrontNums.slice(0, 10), ...lowFreqFront.slice(0, 5)];
      const weights = buildStrategyWeights(withCold, true);
      const fullWeights = {};
      for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
        fullWeights[i] = withCold.includes(i)
          ? (weights[i] || 0)
          : CONFIG.FRONT_RANDOM_BONUS;
      }
      for (const num of lowFreqFront.slice(0, 5)) {
        if (num <= CONFIG.FRONT_RANGE) {
          const omissionVal = omission.front[num] || 0;
          fullWeights[num] = (fullWeights[num] || 0) + omissionVal * 0.3;
        }
      }
      front = this.smartFrontSample(fullWeights, CONFIG.FRONT_COUNT);
    } else if (strategyIndex === 3) {
      // 策略4：遗漏值回归策略
      const withOmission = [...highOmissionFront.slice(0, 3), ...sortedFrontNums.slice(0, 12)];
      const weights = buildStrategyWeights(withOmission, true);
      const fullWeights = {};
      for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
        fullWeights[i] = withOmission.includes(i)
          ? (weights[i] || 0)
          : CONFIG.FRONT_RANDOM_BONUS;
      }
      for (const num of highOmissionFront.slice(0, 3)) {
        if (num <= CONFIG.FRONT_RANGE) {
          const omissionVal = omission.front[num] || 0;
          fullWeights[num] = (fullWeights[num] || 0) + omissionVal * 0.5;
        }
      }
      front = this.smartFrontSample(fullWeights, CONFIG.FRONT_COUNT);
    } else {
      // 策略5：全池探索
      const weights = buildStrategyWeights(allFrontPool, true);
      const fullWeights = {};
      for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
        fullWeights[i] = allFrontPool.includes(i)
          ? (weights[i] || 0)
          : (conditionalProb.front[i] || 0) * CONFIG.CONDITIONAL_WEIGHT * conditionalProb.confidence * 5 + CONFIG.FRONT_RANDOM_BONUS;
      }
      front = this.smartFrontSample(fullWeights, CONFIG.FRONT_COUNT);
    }

    // 后区：3种策略之一
    let back;
    const backStrategy = Math.floor(Math.random() * 3);
    if (backStrategy === 0) {
      // 策略1：频率+条件概率
      const backFreqWeights = {};
      for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
        const freq = (backCounter[i] || 0) + 1;
        const cond = (conditionalProb.back[i] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence * 8;
        backFreqWeights[i] = freq + cond;
      }
      back = this.smartBackSample(backFreqWeights, 'rotation');
    } else if (backStrategy === 1) {
      // 策略2：遗漏值+条件概率
      const backOmissionWeights = {};
      for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
        const omissionVal = (omission.back[i] || 0) + 1;
        const cond = (conditionalProb.back[i] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence * 8;
        backOmissionWeights[i] = omissionVal + cond;
      }
      back = this.smartBackSample(backOmissionWeights, 'rotation');
    } else {
      // 策略3：条件概率引导
      const backCondWeights = {};
      for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
        const cond = (conditionalProb.back[i] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence * 10;
        backCondWeights[i] = cond + CONFIG.BACK_RANDOM_BONUS + 1;
      }
      back = this.smartBackSample(backCondWeights, 'rotation');
    }

    const coveredFront = this.enforceZoneCoverage(front, 4);
    coveredFront.sort((a, b) => a - b);
    back.sort((a, b) => a - b);

    console.log('📊 RotationMatrix 生成结果 - 前区:', coveredFront.length, '个号码', coveredFront, '后区:', back.length, '个号码', back);

    return [...coveredFront, ...back];
  }

  getDescription() {
    return '基于5种旋转策略的组合数学预测模型';
  }
}
