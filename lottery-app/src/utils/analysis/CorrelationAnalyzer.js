/**
 * 关联性分析器
 * 负责计算号码之间的共现频率和关联性
 */

export class CorrelationAnalyzer {
  constructor(historyData, getActiveDataFn) {
    this.historyData = historyData;
    this.getActiveData = getActiveDataFn;
    this.cache = null;
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
   * 获取两个号码的共现次数
   * @param {number} num1 - 号码1
   * @param {number} num2 - 号码2
   * @param {boolean} isFront - 是否为前区
   * @returns {number} 共现次数
   */
  getCoOccurrence(num1, num2, isFront = true) {
    const correlation = this.calculateNumberCorrelation();
    const area = isFront ? 'front' : 'back';
    return (correlation[area][num1] && correlation[area][num1][num2]) || 0;
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cache = null;
  }
}
