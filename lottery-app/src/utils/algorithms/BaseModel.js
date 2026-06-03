/**
 * 算法基类
 * 所有预测算法的抽象基类，定义统一接口
 */

import { CONFIG } from '../core/Config.js';

export class BaseModel {
  /**
   * 构造函数
   * @param {Object} dependencies - 依赖的分析器模块
   * @param {FrequencyAnalyzer} dependencies.frequencyAnalyzer - 频率分析器
   * @param {OmissionCalculator} dependencies.omissionCalculator - 遗漏值计算器
   * @param {TrendAnalyzer} dependencies.trendAnalyzer - 趋势分析器
   * @param {CorrelationAnalyzer} dependencies.correlationAnalyzer - 关联性分析器
   * @param {ConditionalProbability} dependencies.conditionalProbability - 条件概率计算器
   * @param {Function} dependencies.getActiveData - 获取活跃数据函数
   * @param {number[]} dependencies.frontNumbers - 前区号码数组
   * @param {number[]} dependencies.backNumbers - 后区号码数组
   */
  constructor(dependencies) {
    this.frequencyAnalyzer = dependencies.frequencyAnalyzer;
    this.omissionCalculator = dependencies.omissionCalculator;
    this.trendAnalyzer = dependencies.trendAnalyzer;
    this.correlationAnalyzer = dependencies.correlationAnalyzer;
    this.conditionalProbability = dependencies.conditionalProbability;
    this.getActiveData = dependencies.getActiveData;
    this.frontNumbers = dependencies.frontNumbers;
    this.backNumbers = dependencies.backNumbers;
    
    // 算法名称（子类必须重写）
    this.name = 'BaseModel';
  }

  /**
   * 生成预测号码（抽象方法，子类必须实现）
   * @returns {number[]} [前区5个号码, 后区2个号码]
   */
  predict() {
    throw new Error('predict() method must be implemented by subclass');
  }

  /**
   * 智能前区采样（通用方法）
   * @param {Object} weights - 权重对象 {号码: 权重}
   * @param {number} count - 选择数量
   * @returns {number[]} 选中的号码数组
   */
  smartFrontSample(weights, count) {
    const numbers = Object.keys(weights).map(Number);
    const weightValues = Object.values(weights);
    
    // 加权随机选择（无放回）
    const selected = [];
    const remaining = [...numbers];
    const remainingWeights = [...weightValues];
    
    for (let i = 0; i < count && remaining.length > 0; i++) {
      const totalWeight = remainingWeights.reduce((sum, w) => sum + w, 0);
      if (totalWeight === 0) break;
      
      let random = Math.random() * totalWeight;
      let cumulative = 0;
      
      for (let j = 0; j < remaining.length; j++) {
        cumulative += remainingWeights[j];
        if (random <= cumulative) {
          selected.push(remaining[j]);
          remaining.splice(j, 1);
          remainingWeights.splice(j, 1);
          break;
        }
      }
    }
    
    return selected.sort((a, b) => a - b);
  }

  /**
   * 智能后区采样（通用方法）
   * @param {Object} weights - 权重对象
   * @param {string} strategy - 策略名称
   * @returns {number[]} 选中的后区号码
   */
  smartBackSample(weights, strategy = 'default') {
    const backNumbers = Array.from({ length: CONFIG.BACK_RANGE }, (_, i) => i + 1);
    
    // 计算调整后的权重
    const adjustedWeights = {};
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
      const rawWeight = weights[i] || 0;
      const cappedWeight = Math.min(rawWeight, CONFIG.BACK_WEIGHT_CAP);
      const withBonus = cappedWeight + CONFIG.BACK_RANDOM_BONUS;
      const noise = (Math.random() - 0.5) * 2 * CONFIG.BACK_NOISE_FACTOR;
      adjustedWeights[i] = Math.max(0.1, withBonus + noise);
    }
    
    // 分层采样：优先1奇1偶
    const oddNums = backNumbers.filter(n => n % 2 !== 0);
    const evenNums = backNumbers.filter(n => n % 2 === 0);
    
    const oddWeights = oddNums.map(n => adjustedWeights[n]);
    const evenWeights = evenNums.map(n => adjustedWeights[n]);
    
    let back;
    if (CONFIG.BACK_STRATIFIED_ODD && strategy !== 'regression' && CONFIG.BACK_COUNT >= 2) {
      // 分层采样：保证奇偶分布（仅当需要选2个或以上时）
      const oddPick = this.weightedSampleNoReplacement(oddNums, oddWeights, 1);
      const evenPick = this.weightedSampleNoReplacement(evenNums, evenWeights, 1);
      back = [...oddPick, ...evenPick];
    } else {
      const allNums = Object.keys(adjustedWeights).map(Number);
      const allWeights = Object.values(adjustedWeights);
      back = this.weightedSampleNoReplacement(allNums, allWeights, CONFIG.BACK_COUNT);
    }
    
    return back.sort((a, b) => a - b);
  }

  /**
   * 加权采样（无放回）
   * @param {number[]} pool - 候选池
   * @param {number[]} weights - 权重数组
   * @param {number} k - 选择数量
   * @returns {number[]} 选中的号码
   */
  weightedSampleNoReplacement(pool, weights, k) {
    const selected = [];
    const poolCopy = [...pool];
    const weightsCopy = [...weights];
    
    for (let i = 0; i < k; i++) {
      if (poolCopy.length === 0) break;
      
      const cumulativeWeights = [];
      let sum = 0;
      for (const w of weightsCopy) {
        sum += w;
        cumulativeWeights.push(sum);
      }
      
      const random = Math.random() * sum;
      let left = 0, right = cumulativeWeights.length - 1;
      let idx = right;
      
      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        if (cumulativeWeights[mid] >= random) {
          idx = mid;
          right = mid - 1;
        } else {
          left = mid + 1;
        }
      }
      
      selected.push(poolCopy[idx]);
      poolCopy.splice(idx, 1);
      weightsCopy.splice(idx, 1);
    }
    
    return selected;
  }

  /**
   * 强制区间覆盖
   * @param {number[]} front - 前区号码
   * @param {number} minZones - 最少区间数
   * @returns {number[]} 修正后的号码
   */
  enforceZoneCoverage(front, minZones = 4) {
    const zoneSize = 5;
    const totalZones = Math.ceil(CONFIG.FRONT_RANGE / zoneSize);
    const frontZones = new Set(front.map(n => Math.floor((n - 1) / zoneSize)));
    if (frontZones.size >= minZones) return front.sort((a, b) => a - b);
  
    const uncoveredZones = Array.from({ length: totalZones }, (_, i) => i).filter(z => !frontZones.has(z));
    const frontCopy = [...front];
  
    while (frontZones.size < minZones && uncoveredZones.length > 0) {
      const targetZone = uncoveredZones[Math.floor(Math.random() * uncoveredZones.length)];
      // 只生成在 CONFIG.FRONT_RANGE 范围内的号码
      const zoneNumbers = [];
      for (let i = targetZone * zoneSize + 1; i <= Math.min((targetZone + 1) * zoneSize, CONFIG.FRONT_RANGE); i++) {
        zoneNumbers.push(i);
      }
  
      const zoneCount = {};
      frontCopy.forEach(n => { 
        zoneCount[Math.floor((n-1)/zoneSize)] = (zoneCount[Math.floor((n-1)/zoneSize)] || 0) + 1; 
      });
  
      const crowdedZone = Object.entries(zoneCount).sort((a, b) => b[1] - a[1])[0];
      const removeIdx = frontCopy.findIndex(n => Math.floor((n-1)/zoneSize) === Number(crowdedZone[0]));
  
      const replacement = zoneNumbers.filter(n => !frontCopy.includes(n) && n <= CONFIG.FRONT_RANGE);
      if (replacement.length > 0) {
        frontCopy[removeIdx] = replacement[Math.floor(Math.random() * replacement.length)];
        frontZones.add(targetZone);
        uncoveredZones.splice(uncoveredZones.indexOf(targetZone), 1);
      }
    }
  
    return frontCopy.sort((a, b) => a - b);
  }

  /**
   * 获取算法信息
   * @returns {Object} 算法信息
   */
  getInfo() {
    return {
      name: this.name,
      description: this.getDescription()
    };
  }

  /**
   * 获取算法描述（子类可重写）
   * @returns {string} 算法描述
   */
  getDescription() {
    return 'Base prediction model';
  }
}
