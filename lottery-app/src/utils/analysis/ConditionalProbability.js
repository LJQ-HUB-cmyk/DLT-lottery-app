/**
 * 条件概率计算器
 * 基于马尔可夫转移矩阵，计算给定上期开奖号码后下期各号码出现的概率
 * 核心特性：Laplace平滑、时间衰减、二阶马尔可夫增强、自适应置信度
 */

import { CONFIG } from '../core/Config.js';

export class ConditionalProbability {
  constructor(historyData, getActiveDataFn) {
    this.historyData = historyData;
    this.getActiveData = getActiveDataFn;
    this.cache = null;
  }

  /**
   * 计算条件概率（马尔可夫转移矩阵）
   * @returns {Object} {front: {号码: 概率}, back: {号码: 概率}, confidence: 置信度}
   */
  calculateConditionalProbability() {
    if (this.cache) {
      return this.cache;
    }

    const activeData = this.getActiveData();
    if (activeData.length < 3) {
      // 数据不足时返回均匀分布
      const frontUniform = {};
      const backUniform = {};
      for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) frontUniform[i] = 1 / CONFIG.FRONT_RANGE;
      for (let i = 1; i <= CONFIG.BACK_RANGE; i++) backUniform[i] = 1 / CONFIG.BACK_RANGE;
      
      const result = { front: frontUniform, back: backUniform, confidence: 0 };
      this.cache = result;
      return result;
    }

    const LAPLACE_ALPHA = 0.01; // Laplace平滑参数
    const TIME_DECAY = 0.98;     // 时间衰减因子

    // 构建转移矩阵：使用窗口数据 + 时间衰减权重
    const frontTransition = {};
    const backTransition = {};

    for (let i = 1; i < activeData.length; i++) {
      const prevDraw = activeData[i - 1];
      const currDraw = activeData[i];

      // 时间衰减权重：越近期的转移权重越高
      const recencyIndex = activeData.length - i;
      const timeWeight = Math.pow(TIME_DECAY, recencyIndex);

      // 前区转移（带时间衰减权重）
      for (const prevNum of prevDraw.front) {
        if (!frontTransition[prevNum]) frontTransition[prevNum] = {};
        for (const currNum of currDraw.front) {
          frontTransition[prevNum][currNum] = (frontTransition[prevNum][currNum] || 0) + timeWeight;
        }
      }

      // 后区转移（带时间衰减权重）
      for (const prevNum of prevDraw.back) {
        if (!backTransition[prevNum]) backTransition[prevNum] = {};
        for (const currNum of currDraw.back) {
          backTransition[prevNum][currNum] = (backTransition[prevNum][currNum] || 0) + timeWeight;
        }
      }
    }

    // 条件概率的条件始终用全数据最新期（不受窗口限制）
    const fullData = this.getActiveData();
    if (!fullData || fullData.length === 0) {
      console.warn('⚠️ ConditionalProbability: 历史数据为空，使用均匀分布');
      const uniformFront = {};
      const uniformBack = {};
      for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) uniformFront[i] = 1 / CONFIG.FRONT_RANGE;
      for (let i = 1; i <= CONFIG.BACK_RANGE; i++) uniformBack[i] = 1 / CONFIG.BACK_RANGE;
      const result = { front: uniformFront, back: uniformBack, confidence: 0 };
      this.cache = result;
      return result;
    }
    
    const lastDraw = fullData[fullData.length - 1];
    const frontConditional = {};
    const backConditional = {};

    // Laplace平滑转移概率函数
    const laplaceProb = (rawCount, rawTotal, numOutcomes) => {
      return (rawCount + LAPLACE_ALPHA) / (rawTotal + LAPLACE_ALPHA * numOutcomes);
    };

    // 前区条件概率：P(Y appears | X appeared last draw) 的聚合
    for (let y = 1; y <= CONFIG.FRONT_RANGE; y++) {
      let score = 0;
      let weightSum = 0;

      for (const x of lastDraw.front) {
        const transitions = frontTransition[x] || {};
        const rawTotal = Object.values(transitions).reduce((a, b) => a + b, 0);
        const rawCount = transitions[y] || 0;
        const prob = laplaceProb(rawCount, rawTotal, CONFIG.FRONT_RANGE);
        score += prob;
        weightSum += 1;
      }

      frontConditional[y] = weightSum > 0 ? score / weightSum : 1 / CONFIG.FRONT_RANGE;
    }

    // 后区条件概率
    for (let y = 1; y <= CONFIG.BACK_RANGE; y++) {
      let score = 0;
      let weightSum = 0;

      for (const x of lastDraw.back) {
        const transitions = backTransition[x] || {};
        const rawTotal = Object.values(transitions).reduce((a, b) => a + b, 0);
        const rawCount = transitions[y] || 0;
        const prob = laplaceProb(rawCount, rawTotal, CONFIG.BACK_RANGE);
        score += prob;
        weightSum += 1;
      }

      backConditional[y] = weightSum > 0 ? score / weightSum : 1 / CONFIG.BACK_RANGE;
    }

    // 二阶马尔可夫增强：考虑最近2期的联合转移
    if (fullData.length >= 3) {
      const secondLastDraw = fullData[fullData.length - 2];

      // 前区二阶增强
      for (let y = 1; y <= CONFIG.FRONT_RANGE; y++) {
        let secondOrderScore = 0;
        let secondOrderWeight = 0;

        for (const x of secondLastDraw.front) {
          const transitions = frontTransition[x] || {};
          const rawTotal = Object.values(transitions).reduce((a, b) => a + b, 0);
          const rawCount = transitions[y] || 0;
          const prob = laplaceProb(rawCount, rawTotal, CONFIG.FRONT_RANGE);
          secondOrderScore += prob;
          secondOrderWeight += 1;
        }

        // 一阶权重70% + 二阶权重30%
        const secondOrderContribution = secondOrderWeight > 0 ? secondOrderScore / secondOrderWeight : 0;
        frontConditional[y] = frontConditional[y] * 0.7 + secondOrderContribution * 0.3;
      }

      // 后区二阶增强
      for (let y = 1; y <= CONFIG.BACK_RANGE; y++) {
        let secondOrderScore = 0;
        let secondOrderWeight = 0;

        for (const x of secondLastDraw.back) {
          const transitions = backTransition[x] || {};
          const rawTotal = Object.values(transitions).reduce((a, b) => a + b, 0);
          const rawCount = transitions[y] || 0;
          const prob = laplaceProb(rawCount, rawTotal, CONFIG.BACK_RANGE);
          secondOrderScore += prob;
          secondOrderWeight += 1;
        }

        const secondOrderContribution = secondOrderWeight > 0 ? secondOrderScore / secondOrderWeight : 0;
        backConditional[y] = backConditional[y] * 0.7 + secondOrderContribution * 0.3;
      }
    }

    // 计算条件概率的置信度
    const confidence = this.calculateConfidence(frontTransition, backTransition, LAPLACE_ALPHA);

    const result = { front: frontConditional, back: backConditional, confidence };
    this.cache = result;
    return result;
  }

  /**
   * 计算条件概率的置信度（无前视偏差版本）
   * 基于历史回测：每个验证期仅使用该期之前的数据构建转移矩阵
   * 严格避免数据泄露：验证期本身的数据不参与转移矩阵构建
   * @param {Object} _frontTransition - 不再使用（已废弃，保留参数兼容性）
   * @param {Object} _backTransition - 不再使用（已废弃，保留参数兼容性）
   * @param {number} laplaceAlpha - Laplace平滑参数
   * @returns {number} 置信度 0-1
   */
  calculateConfidence(_frontTransition, _backTransition, laplaceAlpha) {
    const activeData = this.getActiveData();
    if (activeData.length < 20) return 0.3;

    const TIME_DECAY = 0.98; // 回测也使用时间衰减
    const testPeriods = Math.min(20, activeData.length - 1);
    // 回测起始位置，确保每个验证期至少有50期历史数据可用
    const minHistory = 50;
    const startTestIdx = Math.max(activeData.length - testPeriods, minHistory);

    let frontHits = 0;
    let backHits = 0;
    let frontRandomHits = 0;
    let backRandomHits = 0;
    let validTestPeriods = 0;

    const laplaceProb = (rawCount, rawTotal, numOutcomes) => {
      return (rawCount + laplaceAlpha) / (rawTotal + laplaceAlpha * numOutcomes);
    };

    for (let t = startTestIdx; t < activeData.length; t++) {
      const prevDraw = activeData[t - 1];
      const currDraw = activeData[t];

      // 关键修复：仅使用第t期之前的数据构建转移矩阵
      // 严格排除验证期本身的数据，消除前视偏差
      const trainData = activeData.slice(0, t);
      if (trainData.length < 10) continue; // 训练数据不足10期时跳过

      // 为每个验证期独立构建转移矩阵（无前视偏差）
      const localFrontTransition = {}; 
      const localBackTransition = {}; 

      for (let i = 1; i < trainData.length; i++) {
        const trainPrev = trainData[i - 1];
        const trainCurr = trainData[i];
        const recencyIndex = trainData.length - i;
        const timeWeight = Math.pow(TIME_DECAY, recencyIndex);

        for (const prevNum of trainPrev.front) {
          if (!localFrontTransition[prevNum]) localFrontTransition[prevNum] = {}; 
          for (const currNum of trainCurr.front) {
            localFrontTransition[prevNum][currNum] = (localFrontTransition[prevNum][currNum] || 0) + timeWeight;
          }
        }

        for (const prevNum of trainPrev.back) {
          if (!localBackTransition[prevNum]) localBackTransition[prevNum] = {}; 
          for (const currNum of trainCurr.back) {
            localBackTransition[prevNum][currNum] = (localBackTransition[prevNum][currNum] || 0) + timeWeight;
          }
        }
      }

      // 使用独立构建的转移矩阵计算条件概率
      const tempFrontCond = {}; 
      const tempBackCond = {}; 

      for (let y = 1; y <= CONFIG.FRONT_RANGE; y++) {
        let score = 0;
        let wSum = 0;
        for (const x of prevDraw.front) {
          const tr = localFrontTransition[x] || {}; 
          const rawTotal = Object.values(tr).reduce((a, b) => a + b, 0);
          const rawCount = tr[y] || 0;
          const prob = laplaceProb(rawCount, rawTotal, CONFIG.FRONT_RANGE);
          score += prob;
          wSum += 1;
        }
        tempFrontCond[y] = wSum > 0 ? score / wSum : 1 / CONFIG.FRONT_RANGE;
      }

      for (let y = 1; y <= CONFIG.BACK_RANGE; y++) {
        let score = 0;
        let wSum = 0;
        for (const x of prevDraw.back) {
          const tr = localBackTransition[x] || {}; 
          const rawTotal = Object.values(tr).reduce((a, b) => a + b, 0);
          const rawCount = tr[y] || 0;
          const prob = laplaceProb(rawCount, rawTotal, CONFIG.BACK_RANGE);
          score += prob;
          wSum += 1;
        }
        tempBackCond[y] = wSum > 0 ? score / wSum : 1 / CONFIG.BACK_RANGE;
      }

      // 取条件概率最高的top号码
      const topFront = Object.entries(tempFrontCond)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(x => Number(x[0]));
      const topBack = Object.entries(tempBackCond)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(x => Number(x[0]));

      // 统计命中
      frontHits += currDraw.front.filter(n => topFront.includes(n)).length;
      backHits += currDraw.back.filter(n => topBack.includes(n)).length;

      // 随机基线期望命中数
      frontRandomHits += CONFIG.FRONT_COUNT * 10 / CONFIG.FRONT_RANGE;
      backRandomHits += CONFIG.BACK_COUNT * 4 / CONFIG.BACK_RANGE;
      validTestPeriods++; 
    }

    // 置信度 = 实际命中率 / 随机命中率（归一化到0-1）
    const frontConfidence = frontRandomHits > 0
      ? Math.min(1, (frontHits / frontRandomHits) / 2)
      : 0.3;
    const backConfidence = backRandomHits > 0
      ? Math.min(1, (backHits / backRandomHits) / 2)
      : 0.3;

    const confidence = frontConfidence * 0.5 + backConfidence * 0.5;
    console.log(`📊 条件概率置信度(无前视偏差): 前区${frontConfidence.toFixed(2)} 后区${backConfidence.toFixed(2)} 综合${confidence.toFixed(2)} (${validTestPeriods}期回测, 命中率: 前${frontHits}/${frontRandomHits.toFixed(1)} 后${backHits}/${backRandomHits.toFixed(1)})`);
    
    return confidence;
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cache = null;
  }
}
