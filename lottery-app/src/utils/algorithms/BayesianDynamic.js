/**
 * 贝叶斯动态预测模型
 * 基于先验概率、时间加权、遗漏值、趋势等多维度的后验概率计算
 */

import { BaseModel } from './BaseModel.js';
import { CONFIG } from '../core/Config.js';

export class BayesianDynamicModel extends BaseModel {
  constructor(dependencies) {
    super(dependencies);
    this.name = 'BayesianDynamic';
  }

  predict() {
    const [frontCounter, backCounter] = this.frequencyAnalyzer.analyzeFrequency();
    const omission = this.omissionCalculator.calculateOmission();
    const sumTrend = this.trendAnalyzer.analyzeSumTrend();
    const repeatAnalysis = this.trendAnalyzer.analyzeRepeatNumbers();
    const conditionalProb = this.conditionalProbability.calculateConditionalProbability();
    const activeData = this.getActiveData();
    const totalDraws = activeData.length;

    if (totalDraws === 0) {
      let front = this.randomSample(this.frontNumbers, CONFIG.FRONT_COUNT);
      const back = this.randomSample(this.backNumbers, CONFIG.BACK_COUNT);
      front.sort((a, b) => a - b);
      back.sort((a, b) => a - b);
      return [...front, ...back];
    }

    // 计算先验概率
    const priorFront = {};
    const priorBack = {};
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
      priorFront[i] = (frontCounter[i] || 0) / totalDraws;
    }
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
      priorBack[i] = (backCounter[i] || 0) / totalDraws;
    }

    // 计算平均遗漏值
    const frontOmissionValues = Object.values(omission.front);
    const backOmissionValues = Object.values(omission.back);
    const frontAvgOmission = frontOmissionValues.reduce((a, b) => a + b, 0) / frontOmissionValues.length;
    const backAvgOmission = backOmissionValues.reduce((a, b) => a + b, 0) / backOmissionValues.length;

    // 获取上期开奖号码
    const lastDraw = activeData && activeData.length > 0 ? activeData[activeData.length - 1] : null;

    // 预计算时间加权得分
    const frontTimeScores = {};
    const backTimeScores = {};
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) frontTimeScores[i] = 0;
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) backTimeScores[i] = 0;

    for (let idx = 0; idx < activeData.length; idx++) {
      const draw = activeData[idx];
      const timeWeight = Math.exp((idx - activeData.length + 1) / activeData.length) * 0.2;
      for (const num of draw.front) frontTimeScores[num] += timeWeight;
      for (const num of draw.back) backTimeScores[num] += timeWeight;
    }

    // 近期频率趋势
    const recentCount = Math.min(CONFIG.RECENT_DRAWS_FOR_TREND, activeData.length);
    const recentFrontFreq = {};
    const recentBackFreq = {};
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) recentFrontFreq[i] = 0;
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) recentBackFreq[i] = 0;

    const recentDraws = activeData.slice(-recentCount);
    for (const draw of recentDraws) {
      for (const num of draw.front) recentFrontFreq[num]++;
      for (const num of draw.back) recentBackFreq[num]++;
    }

    // 前区后验概率计算（8维评分）
    const posteriorFront = {};
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
      let score = priorFront[i] * 0.15;
      score += (frontTimeScores[i] || 0) * 0.12;

      // 近期频率趋势
      const recentRate = recentFrontFreq[i] / recentCount;
      const overallRate = (frontCounter[i] || 0) / totalDraws;
      const trendMomentum = recentRate - overallRate;
      score += trendMomentum * 0.12;

      // 条件概率
      score += (conditionalProb.front[i] || 0) * CONFIG.CONDITIONAL_WEIGHT * conditionalProb.confidence;

      // 遗漏值因子
      const currentOmission = omission.front[i] || 0;
      const omissionDiff = Math.abs(currentOmission - frontAvgOmission);
      const omissionFactor = Math.max(0, 1 - omissionDiff / (frontAvgOmission * 2));
      score += omissionFactor * 0.15;

      // 区间平衡因子
      const zoneIndex = Math.floor((i - 1) / 5);
      const zoneBonus = (zoneIndex % 2 === 0) ? 0.05 : 0;
      score += zoneBonus;

      // 重号因子
      if (lastDraw && lastDraw.front.includes(i)) {
        score += repeatAnalysis.frontRepeatRate * 0.08;
      }

      // 和值趋势因子
      if (sumTrend.trendFront > 5 && i > 18) {
        score += 0.04;
      } else if (sumTrend.trendFront < -5 && i <= 18) {
        score += 0.04;
      }

      posteriorFront[i] = score;
    }

    // 后区后验概率计算
    const posteriorBack = {};
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
      let score = priorBack[i] * 0.15;
      score += (backTimeScores[i] || 0) * 0.12;

      const recentRate = recentBackFreq[i] / recentCount;
      const overallRate = (backCounter[i] || 0) / totalDraws;
      const trendMomentum = recentRate - overallRate;
      score += trendMomentum * 0.12;

      score += (conditionalProb.back[i] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence;

      const currentOmission = omission.back[i] || 0;
      const omissionDiff = Math.abs(currentOmission - backAvgOmission);
      const omissionFactor = Math.max(0, 1 - omissionDiff / (backAvgOmission * 2));
      score += omissionFactor * 0.20;

      const oddEvenBonus = (i % 2 === 1) ? 0.05 : 0;
      score += oddEvenBonus;

      if (lastDraw && lastDraw.back.includes(i)) {
        score += repeatAnalysis.backRepeatRate * 0.08;
      }

      posteriorBack[i] = score;
    }

    // 选择候选池
    const sortedFront = Object.entries(posteriorFront)
      .sort((a, b) => b[1] - a[1])
      .slice(0, CONFIG.BAYESIAN_CANDIDATE_FRONT)
      .map(x => Number(x[0]));

    // 智能采样
    const frontCandidateWeights = {};
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
      const isCandidate = sortedFront.includes(i);
      frontCandidateWeights[i] = isCandidate ? (posteriorFront[i] || 0) + 0.5 : (posteriorFront[i] || 0) + CONFIG.FRONT_RANDOM_BONUS;
    }
    let front = this.smartFrontSample(frontCandidateWeights, CONFIG.FRONT_COUNT);

    const backCandidateWeights = {};
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
      backCandidateWeights[i] = (posteriorBack[i] || 0) + CONFIG.BACK_RANDOM_BONUS;
    }
    const back = this.smartBackSample(backCandidateWeights, 'bayesian');

    const coveredFront = this.enforceZoneCoverage(front, 4);
    coveredFront.sort((a, b) => a - b);
    back.sort((a, b) => a - b);

    console.log('📊 BayesianDynamic 生成结果 - 前区:', coveredFront.length, '个号码', coveredFront, '后区:', back.length, '个号码', back);

    return [...coveredFront, ...back];
  }

  getDescription() {
    return '基于贝叶斯动态更新的复杂预测模型（8维评分）';
  }
}
