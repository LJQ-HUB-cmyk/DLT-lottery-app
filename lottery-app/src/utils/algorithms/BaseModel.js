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
   * 智能前区采样（通用方法）—— 奇偶分层采样
   * 保证前区号码奇偶比为2:3或3:2（理想比例），避免0:5或5:0极端分布
   * 在每个奇偶池内仍按权重加权选择，兼顾评分逻辑与统计约束
   * @param {Object} weights - 权重对象 {号码: 权重}
   * @param {number} count - 选择数量
   * @returns {number[]} 选中的号码数组
   */
  smartFrontSample(weights, count) {
    // ===== 奇偶分层采样 =====
    const idealOddMin = Math.round(count * 0.4); // 2 (for count=5)
    const idealOddMax = Math.round(count * 0.6); // 3 (for count=5)
    // 随机选择目标奇数数量：idealOddMin 或 idealOddMax（各50%概率，匹配历史分布）
    const targetOddCount = idealOddMin + Math.floor(Math.random() * (idealOddMax - idealOddMin + 1));

    // 分离奇偶号码池及对应权重
    const allNumbers = Object.keys(weights).map(Number);
    const oddPool = allNumbers.filter(n => n % 2 !== 0);
    const evenPool = allNumbers.filter(n => n % 2 === 0);
    const oddWeights = oddPool.map(n => weights[n] || 0);
    const evenWeights = evenPool.map(n => weights[n] || 0);

    // 从奇数池加权采样
    const oddPickCount = Math.min(targetOddCount, oddPool.length);
    const oddSelected = oddPickCount > 0
      ? this.weightedSampleNoReplacement(oddPool, oddWeights, oddPickCount)
      : [];

    // 从偶数池加权采样剩余数量
    const evenPickCount = Math.min(count - oddSelected.length, evenPool.length);
    const evenSelected = evenPickCount > 0
      ? this.weightedSampleNoReplacement(evenPool, evenWeights, evenPickCount)
      : [];

    let selected = [...oddSelected, ...evenSelected];

    // 兜底：如果分层采样数量不足（极端边界情况），用全池加权采样补充
    if (selected.length < count) {
      const remainingPool = allNumbers.filter(n => !selected.includes(n));
      const remainingWeights = remainingPool.map(n => weights[n] || 0);
      const remainingCount = Math.min(count - selected.length, remainingPool.length);
      const remainingSelected = this.weightedSampleNoReplacement(remainingPool, remainingWeights, remainingCount);
      selected = [...selected, ...remainingSelected];
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
   * 强制区间覆盖（保持奇偶比不变）
   * 替换号码时优先选择同奇偶的候选，避免修复区间覆盖时破坏奇偶平衡
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
        // 保持奇偶比：优先选择与被替换号码同奇偶的候选
        const removedParity = frontCopy[removeIdx] % 2 !== 0; // true=奇数, false=偶数
        const sameParityReplacements = replacement.filter(n => (n % 2 !== 0) === removedParity);
        const finalCandidates = sameParityReplacements.length > 0 ? sameParityReplacements : replacement;
        frontCopy[removeIdx] = finalCandidates[Math.floor(Math.random() * finalCandidates.length)];
        frontZones.add(targetZone);
        uncoveredZones.splice(uncoveredZones.indexOf(targetZone), 1);
      }
    }
  
    return frontCopy.sort((a, b) => a - b);
  }
  
  /**
   * 强制奇偶比约束
   * 确保前区号码的奇偶比在理想范围内（2:3或3:2）
   * 用于不使用smartFrontSample的算法（如BalancedStrategy、ZoneFrequency）的后处理
   * @param {number[]} front - 前区号码数组
   * @param {number[]} allNumbers - 全量号码池（默认1~FRONT_RANGE）
   * @param {number} minOdd - 最少奇数数量（默认2）
   * @param {number} maxOdd - 最大奇数数量（默认3）
   * @returns {number[]} 修正后的号码数组
   */
  enforceParityRatio(front, allNumbers = null, minOdd = 2, maxOdd = 3) {
    if (!allNumbers) {
      allNumbers = Array.from({ length: CONFIG.FRONT_RANGE }, (_, i) => i + 1);
    }
  
    const oddCount = front.filter(n => n % 2 !== 0).length;
  
    // 已经在理想范围内，无需调整
    if (oddCount >= minOdd && oddCount <= maxOdd) return [...front];
  
    const frontCopy = [...front];
  
    // 需要增加奇数（当前偏偶：0:5或1:4）
    if (oddCount < minOdd) {
      const needOdd = minOdd - oddCount;
      const oddCandidates = allNumbers.filter(n => n % 2 !== 0 && !frontCopy.includes(n));
      const evenInFront = frontCopy.filter(n => n % 2 === 0);
  
      for (let i = 0; i < needOdd && i < evenInFront.length && oddCandidates.length > 0; i++) {
        const replaceIdx = frontCopy.indexOf(evenInFront[i]);
        const pick = oddCandidates[Math.floor(Math.random() * oddCandidates.length)];
        frontCopy[replaceIdx] = pick;
        oddCandidates.splice(oddCandidates.indexOf(pick), 1);
      }
    }
  
    // 需要减少奇数（当前偏奇：4:1或5:0）
    if (oddCount > maxOdd) {
      const needEven = oddCount - maxOdd;
      const evenCandidates = allNumbers.filter(n => n % 2 === 0 && !frontCopy.includes(n));
      const oddInFront = frontCopy.filter(n => n % 2 !== 0);
  
      for (let i = 0; i < needEven && i < oddInFront.length && evenCandidates.length > 0; i++) {
        const replaceIdx = frontCopy.indexOf(oddInFront[i]);
        const pick = evenCandidates[Math.floor(Math.random() * evenCandidates.length)];
        frontCopy[replaceIdx] = pick;
        evenCandidates.splice(evenCandidates.indexOf(pick), 1);
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
