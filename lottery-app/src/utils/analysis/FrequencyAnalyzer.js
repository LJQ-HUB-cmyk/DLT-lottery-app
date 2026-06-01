/**
 * 频率分析器
 * 负责号码频率统计、冷热号分析等
 */

import { CONFIG } from '../core/Config.js';

export class FrequencyAnalyzer {
  constructor(historyData, getActiveDataFn) {
    this.historyData = historyData;
    this.getActiveData = getActiveDataFn;
    this.cache = null;
  }

  /**
   * 分析前区和后区号码频率
   * @returns {[Object, Object]} [前区频率对象, 后区频率对象]
   */
  analyzeFrequency() {
    if (this.cache) {
      return this.cache;
    }

    const frontCounter = {};
    const backCounter = {};

    // 初始化计数器
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
      frontCounter[i] = 0;
    }
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
      backCounter[i] = 0;
    }

    for (const data of this.getActiveData()) {
      for (const num of data.front) {
        frontCounter[num]++;
      }
      for (const num of data.back) {
        backCounter[num]++;
      }
    }

    this.cache = [frontCounter, backCounter];
    return this.cache;
  }

  /**
   * 获取冷热号码
   * @param {number} topN - 热号/冷号数量
   * @returns {Object} {frontHot, frontCold, backHot, backCold}
   */
  getHotColdNumbers(topN = CONFIG.HOT_NUMBERS_COUNT) {
    const [frontCounter, backCounter] = this.analyzeFrequency();

    const sortByCount = (counter) => 
      Object.entries(counter).sort((a, b) => b[1] - a[1]);

    const frontSorted = sortByCount(frontCounter);
    const backSorted = sortByCount(backCounter);

    return {
      frontHot: frontSorted.slice(0, topN),
      frontCold: frontSorted.slice(-topN).reverse(),
      backHot: backSorted.slice(0, topN),
      backCold: backSorted.slice(-topN).reverse()
    };
  }

  /**
   * 计算期望值
   * @returns {[number, number]} [前区期望值, 后区期望值]
   */
  calculateExpectedValue() {
    const [frontCounter, backCounter] = this.analyzeFrequency();
    const totalFront = Object.values(frontCounter).reduce((a, b) => a + b, 0);
    const totalBack = Object.values(backCounter).reduce((a, b) => a + b, 0);

    const expFront = totalFront > 0
      ? Object.entries(frontCounter).reduce((sum, [num, count]) => 
          sum + Number(num) * count, 0) / totalFront
      : (CONFIG.FRONT_RANGE + 1) / 2;

    const expBack = totalBack > 0
      ? Object.entries(backCounter).reduce((sum, [num, count]) => 
          sum + Number(num) * count, 0) / totalBack
      : (CONFIG.BACK_RANGE + 1) / 2;

    return [expFront, expBack];
  }

  /**
   * 计算方差和标准差
   * @returns {Object} {frontVar, frontStd, backVar, backStd}
   */
  calculateVariance() {
    const [frontCounter, backCounter] = this.analyzeFrequency();
    const [expFront, expBack] = this.calculateExpectedValue();
    const totalFront = Object.values(frontCounter).reduce((a, b) => a + b, 0);
    const totalBack = Object.values(backCounter).reduce((a, b) => a + b, 0);

    const varFront = totalFront > 0
      ? Object.entries(frontCounter).reduce((sum, [num, count]) => 
          sum + count * Math.pow(Number(num) - expFront, 2), 0) / totalFront
      : 0;

    const varBack = totalBack > 0
      ? Object.entries(backCounter).reduce((sum, [num, count]) => 
          sum + count * Math.pow(Number(num) - expBack, 2), 0) / totalBack
      : 0;

    return {
      frontVar: varFront,
      frontStd: Math.sqrt(varFront),
      backVar: varBack,
      backStd: Math.sqrt(varBack)
    };
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cache = null;
    this.recentCache = null;
  }

  /**
   * 分析近期频率趋势（仅统计最近N期的数据）
   * 返回近期频率计数和趋势动量（近期频率 - 全期频率期望）
   * @param {number} recentCount - 近期期数（默认15）
   * @returns {Object} { front: {号码: 近期频率}, back: {号码: 近期频率}, frontMomentum: {号码: 趋势动量}, backMomentum: {号码: 趋势动量} }
   */
  analyzeRecentFrequency(recentCount = CONFIG.RECENT_DRAWS_FOR_TREND) {
    if (this.recentCache && this.recentCache.recentCount === recentCount) {
      return this.recentCache;
    }

    const activeData = this.getActiveData();
    const recent = activeData.slice(-recentCount);
    const recentLength = recent.length;

    // 近期频率计数
    const frontCounter = {};
    const backCounter = {};
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) frontCounter[i] = 0;
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) backCounter[i] = 0;

    for (const data of recent) {
      for (const num of data.front) frontCounter[num]++;
      for (const num of data.back) backCounter[num]++;
    }

    // 全期频率（用于对比计算趋势动量）
    const [allFront, allBack] = this.analyzeFrequency();
    const totalDraws = activeData.length;

    // 趋势动量 = 近期频率/近期期数 - 全期频率/全期期数
    // 正值表示近期比全期更活跃（上升趋势），负值表示近期比全期更冷（下降趋势）
    const frontMomentum = {};
    const backMomentum = {};

    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
      const recentRate = frontCounter[i] / recentLength;
      const overallRate = (allFront[String(i)] || allFront[i] || 0) / totalDraws;
      frontMomentum[i] = recentRate - overallRate;
    }

    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
      const recentRate = backCounter[i] / recentLength;
      const overallRate = (allBack[String(i)] || allBack[i] || 0) / totalDraws;
      backMomentum[i] = recentRate - overallRate;
    }

    const result = {
      front: frontCounter,
      back: backCounter,
      frontMomentum,
      backMomentum,
      recentCount: recentLength,
      totalDraws
    };

    this.recentCache = result;
    return result;
  }
}
