/**
 * 关联性分析器
 * 负责计算号码之间的共现频率和关联性
 * 增强版：加入时间衰减权重，近期共现权重更高
 */

import { CONFIG } from '../core/Config.js';

export class CorrelationAnalyzer {
  constructor(historyData, getActiveDataFn) {
    this.historyData = historyData;
    this.getActiveData = getActiveDataFn;
    this.cache = null;
    this.cacheWithTimeDecay = null;
  }

  /**
   * 计算号码关联性（共现频率）
   * 统计哪些号码在同一期出现时，其他号码也经常出现
   * @returns {Object} {front: {号码: {关联号码: 共现次数}}, back: {...}}
   */
  calculateNumberCorrelation() {
    if (this.cache) {
      return this.cache;
    }

    const activeData = this.getActiveData();
    if (activeData.length < 5) {
      const emptyResult = { front: {}, back: {} };
      this.cache = emptyResult;
      return emptyResult;
    }

    // 前区共现统计（使用窗口数据）
    const frontCoOccurrence = {};
    for (const draw of activeData) {
      for (let i = 0; i < draw.front.length; i++) {
        const a = draw.front[i];
        if (!frontCoOccurrence[a]) frontCoOccurrence[a] = {};
        for (let j = 0; j < draw.front.length; j++) {
          if (i === j) continue;
          const b = draw.front[j];
          frontCoOccurrence[a][b] = (frontCoOccurrence[a][b] || 0) + 1;
        }
      }
    }

    // 后区共现统计
    const backCoOccurrence = {};
    for (const draw of activeData) {
      for (let i = 0; i < draw.back.length; i++) {
        const a = draw.back[i];
        if (!backCoOccurrence[a]) backCoOccurrence[a] = {};
        for (let j = 0; j < draw.back.length; j++) {
          if (i === j) continue;
          const b = draw.back[j];
          backCoOccurrence[a][b] = (backCoOccurrence[a][b] || 0) + 1;
        }
      }
    }

    this.cache = { front: frontCoOccurrence, back: backCoOccurrence };
    return this.cache;
  }

  /**
   * 计算号码关联性（带时间衰减权重）
   * 近期共现权重更高，远期共现权重衰减
   * 使用指数衰减模型：weight = TIME_DECAY ^ (distance_from_end)
   * @returns {Object} {front: {号码: {关联号码: 衰减权重}}, back: {...}}
   */
  calculateNumberCorrelationWithTimeDecay() {
    if (this.cacheWithTimeDecay) {
      return this.cacheWithTimeDecay;
    }

    const activeData = this.getActiveData();
    if (activeData.length < 5) {
      const emptyResult = { front: {}, back: {} };
      this.cacheWithTimeDecay = emptyResult;
      return emptyResult;
    }

    const TIME_DECAY = 0.95; // 时间衰减因子
    const totalDraws = activeData.length;

    // 前区共现统计（带时间衰减权重）
    const frontCoOccurrence = {};
    for (let idx = 0; idx < activeData.length; idx++) {
      const draw = activeData[idx];
      const recency = totalDraws - idx; // 距当前的距离
      const timeWeight = Math.pow(TIME_DECAY, recency);

      for (let i = 0; i < draw.front.length; i++) {
        const a = draw.front[i];
        if (!frontCoOccurrence[a]) frontCoOccurrence[a] = {};
        for (let j = 0; j < draw.front.length; j++) {
          if (i === j) continue;
          const b = draw.front[j];
          frontCoOccurrence[a][b] = (frontCoOccurrence[a][b] || 0) + timeWeight;
        }
      }
    }

    // 后区共现统计（带时间衰减权重）
    const backCoOccurrence = {};
    for (let idx = 0; idx < activeData.length; idx++) {
      const draw = activeData[idx];
      const recency = totalDraws - idx;
      const timeWeight = Math.pow(TIME_DECAY, recency);

      for (let i = 0; i < draw.back.length; i++) {
        const a = draw.back[i];
        if (!backCoOccurrence[a]) backCoOccurrence[a] = {};
        for (let j = 0; j < draw.back.length; j++) {
          if (i === j) continue;
          const b = draw.back[j];
          backCoOccurrence[a][b] = (backCoOccurrence[a][b] || 0) + timeWeight;
        }
      }
    }

    this.cacheWithTimeDecay = { front: frontCoOccurrence, back: backCoOccurrence };
    return this.cacheWithTimeDecay;
  }

  /**
   * 获取两个号码的共现次数
   * @param {number} num1 - 号码1
   * @param {number} num2 - 号码2
   * @param {boolean} isFront - 是否为前区
   * @param {boolean} useTimeDecay - 是否使用时间衰减版本
   * @returns {number} 共现次数（或衰减权重）
   */
  getCoOccurrence(num1, num2, isFront = true, useTimeDecay = false) {
    const correlation = useTimeDecay
      ? this.calculateNumberCorrelationWithTimeDecay()
      : this.calculateNumberCorrelation();
    const area = isFront ? 'front' : 'back';
    return (correlation[area][num1] && correlation[area][num1][num2]) || 0;
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cache = null;
    this.cacheWithTimeDecay = null;
  }
}
