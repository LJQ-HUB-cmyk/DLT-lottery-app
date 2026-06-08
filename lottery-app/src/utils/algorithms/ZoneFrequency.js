/**
 * 区间频率分析模型
 * 前区分7个区（每区5个号），后区分2个区（每区6个号）
 * 多因子综合评分模型
 */

import { BaseModel } from './BaseModel.js';
import { CONFIG } from '../core/Config.js';

export class ZoneFrequencyModel extends BaseModel {
  constructor(dependencies) {
    super(dependencies);
    this.name = 'ZoneFrequency';
  }

  predict() {
    const [frontCounter, backCounter] = this.frequencyAnalyzer.analyzeFrequency();
    const activeData = this.getActiveData();
    const totalDraws = activeData.length;

    if (totalDraws === 0) {
      let front = this.randomSample(this.frontNumbers, CONFIG.FRONT_COUNT);
      const back = this.randomSample(this.backNumbers, CONFIG.BACK_COUNT);
      front.sort((a, b) => a - b);
      back.sort((a, b) => a - b);
      return [...front, ...back];
    }

    // ==================== 第一步：区间定义（动态适配CONFIG） ====================
    const frontZoneSize = 5;
    const frontZoneCount = Math.ceil(CONFIG.FRONT_RANGE / frontZoneSize);
    const frontZoneNames = ['一区','二区','三区','四区','五区','六区','七区','八区','九区','十区'];
    const frontZones = [];
    for (let z = 0; z < frontZoneCount; z++) {
      const start = z * frontZoneSize + 1;
      const end = Math.min((z + 1) * frontZoneSize, CONFIG.FRONT_RANGE);
      frontZones.push({ name: frontZoneNames[z] || `第${z+1}区`, start, end });
    }

    const backZoneSize = CONFIG.BACK_RANGE <= 12 ? 6 : Math.ceil(CONFIG.BACK_RANGE / Math.ceil(CONFIG.BACK_COUNT * 1.5));
    const backZoneCount = Math.ceil(CONFIG.BACK_RANGE / backZoneSize);
    const backZones = [];
    for (let z = 0; z < backZoneCount; z++) {
      const start = z * backZoneSize + 1;
      const end = Math.min((z + 1) * backZoneSize, CONFIG.BACK_RANGE);
      backZones.push({ name: `后${z+1}区`, start, end });
    }

    // ==================== 第二步：计算各区间的综合热度 ====================
    const frontZoneScores = frontZones.map(zone => {
      let zoneTotalFreq = 0;
      for (let i = zone.start; i <= zone.end; i++) {
        zoneTotalFreq += frontCounter[String(i)] || frontCounter[i] || 0;
      }
      return {
        ...zone,
        totalFreq: zoneTotalFreq,
        avgFreq: zoneTotalFreq / (zone.end - zone.start + 1)
      };
    });

    // 按总频率排序，选择最热的区间（选够覆盖 CONFIG.FRONT_COUNT 的区间数）
    const selectedFrontZoneCount = Math.min(frontZoneCount, Math.ceil(CONFIG.FRONT_COUNT * 0.8));
    const sortedFrontZones = [...frontZoneScores].sort((a, b) => b.totalFreq - a.totalFreq);
    const selectedFrontZones = sortedFrontZones.slice(0, selectedFrontZoneCount);

    console.log('🎯 选择的前区区间:', selectedFrontZones.map(z => `${z.name}(${z.totalFreq})`).join(', '));

    // ==================== 第三步：对每个选中区间的号码进行多因子评分 ====================
    const scoreNumber = (number, zoneNumbers) => {
      const numStr = String(number);

      // 1️⃣ 频率分（25%）
      const freq = frontCounter[numStr] || frontCounter[number] || 0;
      const allFreqValues = Object.values(frontCounter).filter(v => typeof v === 'number' && !isNaN(v));
      const maxFreq = allFreqValues.length > 0 ? Math.max(...allFreqValues) : 1;
      const freqScore = maxFreq > 0 ? (freq / maxFreq) * 100 : 0;

      // 2️⃣ 遗漏回归分（25%）
      const omissionData = this.omissionCalculator.calculateOmission();
      const omission = omissionData.front[number] || 0;
      const allFrontOmissions = Object.values(omissionData.front).filter(v => typeof v === 'number' && !isNaN(v));
      const avgOmission = allFrontOmissions.length > 0
        ? allFrontOmissions.reduce((sum, o) => sum + o, 0) / allFrontOmissions.length
        : 0;

      const omissionDeviation = avgOmission > 0 ? (omission - avgOmission) / avgOmission : 0;
      const omissionScore = Math.min(100, Math.max(0, (isFinite(omissionDeviation) ? omissionDeviation : 0 + 1) * 50));

      // 3️⃣ 趋势分（20%）
      const recent10Count = activeData.slice(0, 10).filter(d => d.front.includes(number)).length;
      const recent30Count = activeData.slice(0, 30).filter(d => d.front.includes(number)).length;
      const expectedRecent10 = recent30Count > 0 ? (recent30Count / 30) * 10 : 1;
      const trendRatio = expectedRecent10 > 0 && isFinite(expectedRecent10) ? recent10Count / expectedRecent10 : 1;
      const trendScore = Math.min(100, Math.max(0, isFinite(trendRatio) ? trendRatio * 50 : 50));

      // 4️⃣ 关联分（15%）
      let correlationBonus = 0;
      if (zoneNumbers.length > 0) {
        const correlations = zoneNumbers.map(n => {
          // 使用 calculateNumberCorrelation 获取整个矩阵，然后查找特定号码的关联性
          const corrMatrix = this.correlationAnalyzer.calculateNumberCorrelation();
          const corr = corrMatrix.front[number] && corrMatrix.front[number][n] ? corrMatrix.front[number][n] : 0;
          return typeof corr === 'number' && !isNaN(corr) ? corr : 0;
        });

        if (correlations.length > 0) {
          correlationBonus = correlations.reduce((sum, c) => sum + c, 0) / correlations.length;
        }
      }
      const correlationScore = Math.min(100, Math.max(0, correlationBonus * 10));

      // 5️⃣ 和值适配分（10%）
      const sumScore = 50;

      // 6️⃣ 位置偏好分（5%）
      const positionScore = 50;

      // 综合评分
      const totalScore =
        (freqScore || 0) * 0.25 +
        (omissionScore || 0) * 0.25 +
        (trendScore || 0) * 0.20 +
        (correlationScore || 0) * 0.15 +
        (sumScore || 0) * 0.10 +
        (positionScore || 0) * 0.05;

      return {
        number,
        freq,
        omission,
        scores: {
          freq: freqScore.toFixed(1),
          omission: omissionScore.toFixed(1),
          trend: trendScore.toFixed(1),
          correlation: correlationScore.toFixed(1),
          sum: sumScore,
          position: positionScore,
          total: totalScore.toFixed(1)
        }
      };
    };

    // ==================== 第四步：从每个选中区间选择最高分号码 ====================
    const frontNumbers = [];

    selectedFrontZones.forEach((zone) => {
      const zoneNums = [];
      for (let i = zone.start; i <= zone.end; i++) {
        zoneNums.push(i);
      }

      // 对该区间所有号码评分
      const scoredNumbers = zoneNums.map(num => scoreNumber(num, frontNumbers));

      // 按总分排序
      scoredNumbers.sort((a, b) => parseFloat(b.scores.total) - parseFloat(a.scores.total));

      // 从前3名中随机选择一个（增加多样性）
      const topN = Math.min(3, scoredNumbers.length);
      const selectedIndex = Math.floor(Math.random() * topN);

      const bestNumber = scoredNumbers[selectedIndex];
      frontNumbers.push(bestNumber.number);
    });

    // ==================== 第五步：后区选择 ====================
    const backNumbers = [];
    if (CONFIG.BACK_RANGE === 12 && CONFIG.BACK_COUNT === 2) {
      // 大乐透专用逻辑：从2个后区各选1个
      backZones.forEach((zone) => {
        const zoneCandidates = [];
        for (let i = zone.start; i <= zone.end; i++) {
          const freq = backCounter[String(i)] || backCounter[i] || 0;
          zoneCandidates.push({ number: i, freq });
        }
        zoneCandidates.sort((a, b) => b.freq - a.freq);
        const topN = Math.min(2, zoneCandidates.length);
        const selectIdx = Math.floor(Math.random() * topN);
        const selectedCandidate = zoneCandidates[selectIdx];
        backNumbers.push(selectedCandidate.number);
      });
    } else {
      // 其他玩法（如双色球）：按频率加权选择 CONFIG.BACK_COUNT 个
      const backAllCandidates = [];
      for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
        const freq = backCounter[String(i)] || backCounter[i] || 0;
        backAllCandidates.push({ number: i, freq });
      }
      backAllCandidates.sort((a, b) => b.freq - a.freq);
      const backTopN = Math.min(CONFIG.BACK_COUNT + 2, backAllCandidates.length);
      const backPool = backAllCandidates.slice(0, backTopN);
      const backPoolWeights = backPool.map(c => c.freq + 1);
      const backSelected = this.weightedSampleNoReplacement(
        backPool.map(c => c.number),
        backPoolWeights,
        CONFIG.BACK_COUNT
      );
      backNumbers.push(...backSelected);
    }

    // 确保前区有 CONFIG.FRONT_COUNT 个号码
    while (frontNumbers.length < CONFIG.FRONT_COUNT) {
      const allNumbers = Array.from({ length: CONFIG.FRONT_RANGE }, (_, i) => i + 1);
      const missing = allNumbers.filter(n => !frontNumbers.includes(n));
      if (missing.length > 0) {
        const randomIdx = Math.floor(Math.random() * missing.length);
        frontNumbers.push(missing[randomIdx]);
      } else {
        break;
      }
    }

    // 奇偶比后处理：确保2:3或3:2的理想比例
    frontNumbers = this.enforceParityRatio(frontNumbers);

    // 确保后区有 CONFIG.BACK_COUNT 个号码
    while (backNumbers.length < CONFIG.BACK_COUNT) {
      const allNumbers = Array.from({ length: CONFIG.BACK_RANGE }, (_, i) => i + 1);
      const missing = allNumbers.filter(n => !backNumbers.includes(n));
      if (missing.length > 0) {
        const randomIdx = Math.floor(Math.random() * missing.length);
        backNumbers.push(missing[randomIdx]);
      } else {
        break;
      }
    }

    // 最终统一排序
    frontNumbers.sort((a, b) => a - b);
    backNumbers.sort((a, b) => a - b);

    console.log('✅ ZoneFrequency 生成结果 - 前区:', frontNumbers, '后区:', backNumbers);

    return [...frontNumbers, ...backNumbers];
  }

  /**
   * 随机采样
   */
  randomSample(pool, count) {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  getDescription() {
    return '基于区间定位和多因子综合评分的预测模型';
  }
}
