/**
 * 趋势分析器
 * 负责和值趋势、跨度分析、重号分析等
 */

import { CONFIG } from '../core/Config.js';

export class TrendAnalyzer {
  constructor(historyData, getActiveDataFn) {
    this.historyData = historyData;
    this.getActiveData = getActiveDataFn;
    this.cache = {
      sumTrend: null,
      spanAnalysis: null,
      repeatNumbers: null
    };
  }

  /**
   * 分析和值趋势
   * @returns {Object} {avgFrontSum, avgBackSum, frontStd, backStd, trendFront, recentFrontSums, recentBackSums}
   */
  analyzeSumTrend() {
    if (this.cache.sumTrend) {
      return this.cache.sumTrend;
    }

    const activeData = this.getActiveData();
    const recentCount = Math.min(CONFIG.RECENT_DRAWS_FOR_TREND, activeData.length);
    const recentDraws = activeData.slice(-recentCount);

    const frontSums = recentDraws.map(d => d.front.reduce((a, b) => a + b, 0));
    const backSums = recentDraws.map(d => d.back.reduce((a, b) => a + b, 0));

    // 计算平均值和标准差
    const avgFrontSum = frontSums.reduce((a, b) => a + b, 0) / frontSums.length;
    const avgBackSum = backSums.reduce((a, b) => a + b, 0) / backSums.length;

    const frontStd = Math.sqrt(
      frontSums.reduce((sum, val) => sum + Math.pow(val - avgFrontSum, 2), 0) / frontSums.length
    );
    const backStd = Math.sqrt(
      backSums.reduce((sum, val) => sum + Math.pow(val - avgBackSum, 2), 0) / backSums.length
    );

    // 判断趋势（上升、下降、平稳）
    const firstHalfFront = frontSums.slice(0, Math.floor(frontSums.length / 2));
    const secondHalfFront = frontSums.slice(Math.floor(frontSums.length / 2));
    const trendFront = secondHalfFront.reduce((a, b) => a + b, 0) / secondHalfFront.length - 
                       firstHalfFront.reduce((a, b) => a + b, 0) / firstHalfFront.length;

    const result = {
      avgFrontSum,
      avgBackSum,
      frontStd,
      backStd,
      trendFront, // 正值表示上升趋势，负值表示下降趋势
      recentFrontSums: frontSums,
      recentBackSums: backSums
    };

    this.cache.sumTrend = result;
    return result;
  }

  /**
   * 分析跨度
   * @returns {Object} {avgFrontSpan, avgBackSpan, frontSpans, backSpans}
   */
  analyzeSpan() {
    if (this.cache.spanAnalysis) {
      return this.cache.spanAnalysis;
    }

    const activeData = this.getActiveData();
    const recentCount = Math.min(CONFIG.RECENT_DRAWS_FOR_TREND, activeData.length);
    const recentDraws = activeData.slice(-recentCount);

    const frontSpans = recentDraws.map(d => Math.max(...d.front) - Math.min(...d.front));
    const backSpans = recentDraws.map(d => Math.max(...d.back) - Math.min(...d.back));

    const avgFrontSpan = frontSpans.reduce((a, b) => a + b, 0) / frontSpans.length;
    const avgBackSpan = backSpans.reduce((a, b) => a + b, 0) / backSpans.length;

    const result = {
      avgFrontSpan,
      avgBackSpan,
      frontSpans,
      backSpans
    };

    this.cache.spanAnalysis = result;
    return result;
  }

  /**
   * 分析重号（重复号码）
   * @returns {Object} {frontRepeatRate, backRepeatRate, recentRepeats}
   */
  analyzeRepeatNumbers() {
    if (this.cache.repeatNumbers) {
      return this.cache.repeatNumbers;
    }

    const activeData = this.getActiveData();
    if (activeData.length < 2) {
      return { frontRepeatRate: 0, backRepeatRate: 0, recentRepeats: [] };
    }

    let frontRepeatCount = 0;
    let backRepeatCount = 0;
    let comparisonCount = 0;

    for (let i = 1; i < activeData.length; i++) {
      const prevDraw = activeData[i - 1];
      const currDraw = activeData[i];

      // 前区重号
      const frontRepeats = currDraw.front.filter(n => prevDraw.front.includes(n));
      frontRepeatCount += frontRepeats.length;

      // 后区重号
      const backRepeats = currDraw.back.filter(n => prevDraw.back.includes(n));
      backRepeatCount += backRepeats.length;

      comparisonCount++;
    }

    const result = {
      frontRepeatRate: frontRepeatCount / comparisonCount,
      backRepeatRate: backRepeatCount / comparisonCount,
      recentRepeats: []
    };

    this.cache.repeatNumbers = result;
    return result;
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cache = {
      sumTrend: null,
      spanAnalysis: null,
      repeatNumbers: null
    };
  }
}
