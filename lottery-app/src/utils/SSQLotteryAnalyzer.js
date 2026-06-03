/**
 * 双色球彩票分析器
 * 
 * 通过临时修改 CONFIG 让所有算法模型自动适配双色球的号码范围：
 * - 红球：1-33 选6个（对应大乐透前区）
 * - 蓝球：1-16 选1个（对应大乐透后区）
 * 
 * 数据格式：7个数字/行，前6个为红球，第7个为蓝球
 */

import { CONFIG } from './core/Config.js';
import LotteryAnalyzer from './LotteryAnalyzer.js';
import ssqHistoryRaw from '../data/ssq-history.txt?raw';

// 双色球配置参数
export const SSQ_CONFIG = {
  FRONT_COUNT: 6,    // 红球选6个
  BACK_COUNT: 1,     // 蓝球选1个
  FRONT_RANGE: 33,   // 红球范围 1-33
  BACK_RANGE: 16,    // 蓝球范围 1-16
  // 和值相关参数（红球6个号码的和值范围不同）
  SUM_RANGE_MIN: 70,
  SUM_RANGE_MAX: 140,
};

// 保存原始 CONFIG 值
const originalConfig = {
  FRONT_COUNT: CONFIG.FRONT_COUNT,
  BACK_COUNT: CONFIG.BACK_COUNT,
  FRONT_RANGE: CONFIG.FRONT_RANGE,
  BACK_RANGE: CONFIG.BACK_RANGE,
  SUM_RANGE_MIN: CONFIG.SUM_RANGE_MIN,
  SUM_RANGE_MAX: CONFIG.SUM_RANGE_MAX,
};

class SSQLotteryAnalyzer {
  constructor() {
    this.analyzer = new LotteryAnalyzer();
    this._patched = false;
  }

  /**
   * 临时将 CONFIG 替换为双色球参数
   * 所有 import CONFIG 的算法模块都会看到新值
   */
  _patchConfig() {
    if (this._patched) return;
    CONFIG.FRONT_COUNT = SSQ_CONFIG.FRONT_COUNT;
    CONFIG.BACK_COUNT = SSQ_CONFIG.BACK_COUNT;
    CONFIG.FRONT_RANGE = SSQ_CONFIG.FRONT_RANGE;
    CONFIG.BACK_RANGE = SSQ_CONFIG.BACK_RANGE;
    CONFIG.SUM_RANGE_MIN = SSQ_CONFIG.SUM_RANGE_MIN;
    CONFIG.SUM_RANGE_MAX = SSQ_CONFIG.SUM_RANGE_MAX;
    this._patched = true;
  }

  /**
   * 恢复原始 CONFIG（大乐透参数）
   */
  _restoreConfig() {
    if (!this._patched) return;
    CONFIG.FRONT_COUNT = originalConfig.FRONT_COUNT;
    CONFIG.BACK_COUNT = originalConfig.BACK_COUNT;
    CONFIG.FRONT_RANGE = originalConfig.FRONT_RANGE;
    CONFIG.BACK_RANGE = originalConfig.BACK_RANGE;
    CONFIG.SUM_RANGE_MIN = originalConfig.SUM_RANGE_MIN;
    CONFIG.SUM_RANGE_MAX = originalConfig.SUM_RANGE_MAX;
    this._patched = false;
  }

  /**
   * 解析双色球数据格式：6红球 + 1蓝球
   * 大乐透的 LotteryAnalyzer.loadHistoryData 按 5+2 解析，
   * 我们需要将 6+1 的数据预处理成 Analyzer 可接受的格式
   */
  _preprocessSSQData(dataStr) {
    const lines = dataStr.trim().split('\n');
    const processedLines = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      const numbers = line.trim().split(/\s+/).map(Number);

      // 双色球每行7个数字：6红球 + 1蓝球
      if (numbers.length !== 7) continue;

      const red = numbers.slice(0, 6);   // 红球6个
      const blue = numbers.slice(6);      // 蓝球1个

      // 验证红球范围 1-33
      if (!red.every(n => n >= 1 && n <= 33)) continue;
      // 验证蓝球范围 1-16
      if (!blue.every(n => n >= 1 && n <= 16)) continue;

      // 双色球数据格式不变，仍然是7个数字/行
      // 但 Analyzer 内部会按 CONFIG.FRONT_COUNT=6 和 CONFIG.BACK_COUNT=1 来分割
      processedLines.push(line.trim());
    }

    return processedLines.join('\n');
  }

  /**
   * 加载双色球历史数据
   */
  loadHistoryData(dataStr, sourceName = "双色球数据") {
    this._patchConfig();
    const processedData = this._preprocessSSQData(dataStr);
    this.analyzer.frontNumbers = Array.from({ length: SSQ_CONFIG.FRONT_RANGE }, (_, i) => i + 1);
    this.analyzer.backNumbers = Array.from({ length: SSQ_CONFIG.BACK_RANGE }, (_, i) => i + 1);
    const result = this.analyzer.loadHistoryData(processedData, sourceName);
    return result;
  }

  /**
   * 设置数据窗口
   */
  setDataWindow(window) {
    this.analyzer.setDataWindow(window);
  }

  /**
   * 获取热号冷号
   */
  getHotColdNumbers(topN = 10) {
    return this.analyzer.getHotColdNumbers(topN);
  }

  /**
   * 将算法预测结果拆分为红球+蓝球
   * 预测结果为7个数字：前6个为红球，第7个为蓝球
   */
  _splitResult(nums) {
    return {
      red: nums.slice(0, SSQ_CONFIG.FRONT_COUNT),
      blue: nums.slice(SSQ_CONFIG.FRONT_COUNT)
    };
  }

  /**
   * 生成多个模型的推荐号码
   * @param {string[]} models - 模型列表
   * @param {number} groupsPerModel - 每模型生成组数
   * @returns {Array} 推荐结果数组
   */
  generatePredictions(models, groupsPerModel = 5) {
    this._patchConfig();
    const results = [];
  
    models.forEach(model => {
      for (let i = 0; i < groupsPerModel; i++) {
        try {
          let nums;
          // rotation 模型有特殊返回格式
          if (model === 'rotation') {
            const batch = this.analyzer.generateRotationMatrixPrediction(1);
            if (batch.length > 0) {
              nums = [...batch[0].front, ...batch[0].back];
            }
          } else if (model === 'bayesian') {
            nums = this.analyzer.generateBayesianPrediction();
          } else if (model === 'zhouyi') {
            nums = this.analyzer.generateZhouyiPrediction(i);
          } else if (model === 'hybrid') {
            nums = this.analyzer.generateHybridPrediction();
          } else if (model === 'zoneFrequency') {
            nums = this.analyzer.generateZoneFrequencyPrediction(i);
          } else if (model === 'frequencyWeighted') {
            nums = this.analyzer.models.frequencyWeighted.predict();
          } else if (model === 'omissionAnalysis') {
            nums = this.analyzer.models.omissionAnalysis.predict();
          } else if (model === 'timeDecay') {
            nums = this.analyzer.models.timeDecay.predict();
          } else if (model === 'meanRegression') {
            nums = this.analyzer.models.meanRegression.predict();
          } else if (model === 'balancedStrategy') {
            nums = this.analyzer.models.balancedStrategy.predict();
          } else if (model === 'normalDistribution') {
            nums = this.analyzer.models.normalDistribution.predict();
          } else {
            console.warn('未知模型:', model);
            return;
          }
  
          if (nums && nums.length >= 7) {
            const split = this._splitResult(nums);
            results.push({
              model,
              groupNum: i + 1,
              red: split.red.sort((a, b) => a - b),
              blue: split.blue.sort((a, b) => a - b)
            });
          }
        } catch (e) {
          console.warn(`模型 ${model} 生成第${i + 1}组失败:`, e.message);
        }
      }
    });
  
    return results;
  }

  /**
   * 生成智能推荐（分析最优模型后推荐）
   * @param {number} groupsPerModel - 每模型生成组数
   * @param {string[]} selectedModels - 选择的模型
   * @returns {Object} 推荐结果
   */
  generateRecommendation(groupsPerModel = 5, selectedModels = ['frequencyWeighted', 'bayesian', 'hybrid']) {
    this._patchConfig();
    const predictions = this.generatePredictions(selectedModels, groupsPerModel);

    // 获取统计信息
    const hotCold = this.analyzer.getHotColdNumbers(10);
    const omission = this.analyzer.calculateOmission();

    // 分析推荐结果质量
    const latestDraw = this.analyzer.historyData.length > 0
      ? this.analyzer.historyData[this.analyzer.historyData.length - 1]
      : null;

    return {
      predictions,
      hotCold: {
        redHot: hotCold.frontHot.map(item => Number(item[0])),
        redCold: hotCold.frontCold.map(item => Number(item[0])),
        blueHot: hotCold.backHot.map(item => Number(item[0])),
        blueCold: hotCold.backCold.map(item => Number(item[0])),
      },
      omission,
      latestDraw: latestDraw ? {
        red: latestDraw.front,
        blue: latestDraw.back
      } : null,
      dataCount: this.analyzer.historyData.length,
      generatedAt: new Date().toLocaleString('zh-CN')
    };
  }

  /**
   * 释放资源时恢复 CONFIG
   */
  destroy() {
    this._restoreConfig();
  }
}

// 从文件读取双色球历史数据
export const SSQ_DEFAULT_DATA = ssqHistoryRaw.trim();

export default SSQLotteryAnalyzer;