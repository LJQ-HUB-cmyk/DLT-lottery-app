/**
 * 遗漏值计算器
 * 负责计算每个号码的连续遗漏期数
 */

import { CONFIG } from '../core/Config.js';

export class OmissionCalculator {
  constructor(historyData, getActiveDataFn, frontNumbers, backNumbers) {
    this.historyData = historyData;
    this.getActiveData = getActiveDataFn;
    this.frontNumbers = frontNumbers;
    this.backNumbers = backNumbers;
    this.cache = null;
  }

  /**
   * 计算前区和后区号码的遗漏值
   * @returns {Object} {front: {号码: 遗漏期数}, back: {号码: 遗漏期数}}
   */
  calculateOmission() {
    if (this.cache) {
      return this.cache;
    }

    const frontOmission = {};
    const backOmission = {};
    
    // 初始化
    this.frontNumbers.forEach(n => frontOmission[n] = 0);
    this.backNumbers.forEach(n => backOmission[n] = 0);

    // 遗漏计算使用窗口数据
    const activeData = this.getActiveData();

    // 正确计算每个号码的连续遗漏期数（从窗口数据的最后一期往前搜索）
    for (const num of this.frontNumbers) {
      let omission = 0;
      for (let i = activeData.length - 1; i >= 0; i--) {
        if (activeData[i].front.includes(num)) {
          break; // 找到最近一次出现，停止计数
        }
        omission++;
      }
      frontOmission[num] = omission;
    }

    for (const num of this.backNumbers) {
      let omission = 0;
      for (let i = activeData.length - 1; i >= 0; i--) {
        if (activeData[i].back.includes(num)) {
          break; // 找到最近一次出现，停止计数
        }
        omission++;
      }
      backOmission[num] = omission;
    }

    this.cache = { front: frontOmission, back: backOmission };
    return this.cache;
  }

  /**
   * 获取平均遗漏值
   * @param {string} area - 'front' 或 'back'
   * @returns {number} 平均遗漏期数
   */
  getAverageOmission(area = 'front') {
    const omission = this.calculateOmission();
    const values = Object.values(omission[area]);
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * 获取遗漏值的标准差
   * @param {string} area - 'front' 或 'back'
   * @returns {number} 标准差
   */
  getOmissionStd(area = 'front') {
    const omission = this.calculateOmission();
    const values = Object.values(omission[area]);
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cache = null;
  }
}
