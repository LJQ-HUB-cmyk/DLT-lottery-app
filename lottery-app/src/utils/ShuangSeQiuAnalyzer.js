/**
 * 频率动量分析器 - 动态预测核心
 * 计算近期频率变化趋势（动量），上升中的号码更值得关注
 */
class SSQFrequencyMomentumAnalyzer {
  constructor(dataLoader) {
    this.dataLoader = dataLoader;
  }

  /**
   * 计算红球频率动量
   * 对比近5期频率与近20期频率，计算变化率
   * @returns {Object} 每个号码的动量值（正=上升趋势，负=下降趋势）
   */
  calculateFrontMomentum() {
    const recent5 = this.dataLoader.getActiveData(5);
    const recent20 = this.dataLoader.getActiveData(20);

    const recent5Freq = {}; 
    const recent20Freq = {}; 
    for (let i = 1; i <= SSQ_CONFIG.FRONT_RANGE; i++) { recent5Freq[i] = 0; recent20Freq[i] = 0; }

    for (const draw of recent5) {
      for (const num of draw.front) recent5Freq[num]++; 
    }
    for (const draw of recent20) {
      for (const num of draw.front) recent20Freq[num]++; 
    }

    const momentum = {}; 
    for (let i = 1; i <= SSQ_CONFIG.FRONT_RANGE; i++) {
      // 动量 = 近5期频率/5 - 近20期频率/20
      // 正值表示近期出现频率上升（热度增加）
      // 负值表示近期出现频率下降（热度降低）
      const shortTermRate = (recent5Freq[i] || 0) / 5;  // 近5期出现率
      const longTermRate = (recent20Freq[i] || 0) / 20; // 近20期出现率
      momentum[i] = shortTermRate - longTermRate;
    }

    return momentum;
  }

  /**
   * 计算蓝球频率动量
   */
  calculateBackMomentum() {
    const recent5 = this.dataLoader.getActiveData(5);
    const recent20 = this.dataLoader.getActiveData(20);

    const recent5Freq = {}; 
    const recent20Freq = {}; 
    for (let i = 1; i <= SSQ_CONFIG.BACK_RANGE; i++) { recent5Freq[i] = 0; recent20Freq[i] = 0; }

    for (const draw of recent5) {
      for (const num of draw.back) recent5Freq[num]++; 
    }
    for (const draw of recent20) {
      for (const num of draw.back) recent20Freq[num]++; 
    }

    const momentum = {}; 
    for (let i = 1; i <= SSQ_CONFIG.BACK_RANGE; i++) {
      const shortTermRate = (recent5Freq[i] || 0) / 5;
      const longTermRate = (recent20Freq[i] || 0) / 20;
      momentum[i] = shortTermRate - longTermRate;
    }

    return momentum;
  }
}

/**
 * 连号/邻号分析器 - 动态预测核心
 * 双色球历史数据中每期平均有1-2组连号
 */
class SSQConsecutiveAnalyzer {
  constructor(dataLoader) {
    this.dataLoader = dataLoader;
  }

  /**
   * 分析近10期连号规律
   * @returns {Object} 连号统计和建议
   */
  analyzeConsecutivePattern() {
    const recent10 = this.dataLoader.getActiveData(10);

    let totalConsecutivePairs = 0; // 近10期总连号组数
    const consecutivePairFreq = {};  // 各连号对出现次数

    for (const draw of recent10) {
      const sorted = [...draw.front].sort((a, b) => a - b);
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i + 1] - sorted[i] === 1) {
          // 连号对
          totalConsecutivePairs++; 
          const pairKey = `${sorted[i]}-${sorted[i+1]}`;
          consecutivePairFreq[pairKey] = (consecutivePairFreq[pairKey] || 0) + 1;
        } else if (sorted[i + 1] - sorted[i] === 2) {
          // 邦号对（差2）
          totalConsecutivePairs += 0.5;  // 邦号半权重
        }
      }
    }

    const avgConsecutivePerDraw = totalConsecutivePairs / Math.max(1, recent10.length);

    // 找近10期出现过的连号对
    const hotConsecutivePairs = Object.entries(consecutivePairFreq)
      .map(([pair, freq]) => ({ pair, freq, nums: pair.split('-').map(Number) }))
      .sort((a, b) => b.freq - a.freq)
      .slice(0, 5);

    return {
      avgConsecutivePerDraw,  // 平均每期连号数
      hotConsecutivePairs,    // 近10期热门连号对
      shouldIncludeConsecutive: avgConsecutivePerDraw >= 0.8  // 建议包含连号
    }; 
  }

  /**
   * 为推荐号码注入连号
   * @param numbers 当前推荐号码
   * @returns 注入连号后的号码
   */
  injectConsecutive(numbers) {
    const pattern = this.analyzeConsecutivePattern();
    if (!pattern.shouldIncludeConsecutive) return numbers; 

    const sorted = [...numbers].sort((a, b) => a - b);
    let hasConsecutive = false; 
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i + 1] - sorted[i] === 1) hasConsecutive = true; 
    }

    // 如果已经有连号则不处理
    if (hasConsecutive) return numbers;

    // 从近10期热门连号对中找一个可以注入的
    const frontFreq = this.dataLoader.historyData;
    for (const pairInfo of pattern.hotConsecutivePairs) {
      const [small, big] = pairInfo.nums;
      // 检查small是否已经在推荐中，而big不在
      if (sorted.includes(small) && !sorted.includes(big)) {
        // 替换掉一个邻号或最低频率号码
        const toRemoveIdx = sorted.findIndex(n => n > big || (n !== small && Math.abs(n - small) > 3));
        if (toRemoveIdx !== -1) {
          sorted[toRemoveIdx] = big; 
          return sorted.sort((a, b) => a - b);
        }
      }
      // 检查big是否在推荐中，small不在
      if (sorted.includes(big) && !sorted.includes(small)) {
        const toRemoveIdx = sorted.findIndex(n => n < small || (n !== big && Math.abs(n - big) > 3));
        if (toRemoveIdx !== -1) {
          sorted[toRemoveIdx] = small; 
          return sorted.sort((a, b) => a - b);
        }
      }
    }

    // 如果热门连号对无法注入，从推荐号码中选一个号码加入其相邻号
    // 选择评分中偏高的号码，加入其+1或-1（在1-33范围内）
    const bestCandidate = sorted[sorted.length - 1];  // 最大的号码
    const neighbor = bestCandidate + 1 <= 33 ? bestCandidate + 1 : bestCandidate - 1;
    if (!sorted.includes(neighbor)) {
      // 替换掉最远的一个号码
      const farthest = sorted.reduce((a, b) => Math.abs(a - neighbor) > Math.abs(b - neighbor) ? a : b);
      sorted[sorted.indexOf(farthest)] = neighbor; 
    }

    return sorted.sort((a, b) => a - b);
  }
}

import ssqHistoryRaw from '../data/ssq-history.txt?raw';

// 双色球配置
const SSQ_CONFIG = {
  FRONT_COUNT: 6,      // 红球选6个
  BACK_COUNT: 1,       // 蓝球选1个
  FRONT_RANGE: 33,     // 红球范围 1-33
  BACK_RANGE: 16,      // 蓝球范围 1-16
  SUM_RANGE_MIN: 70,   // 和值最小范围
  SUM_RANGE_MAX: 140,  // 和值最大范围
  OMISSION_WINDOW: 30, // 遗漏分析窗口
  FREQUENCY_WINDOW: 100, // 频率统计窗口
  TIME_DECAY_FACTOR: 0.95, // 时间衰减因子
};

/**
 * 双色球数据加载器
 */
class SSQDataLoader {
  constructor() {
    this.historyData = [];
    this.dataLoaded = false;
  }

  /**
   * 加载并解析双色球历史数据
   */
  loadData(dataStr) {
    const lines = dataStr.trim().split('\n');
    this.historyData = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      const numbers = line.trim().split(/\s+/).map(Number);

      // 双色球格式：6个红球 + 1个蓝球 = 7个数字
      if (numbers.length !== 7) continue;

      const red = numbers.slice(0, 6);
      const blue = numbers.slice(6);

      // 验证号码范围
      if (!red.every(n => n >= 1 && n <= 33)) continue;
      if (!blue.every(n => n >= 1 && n <= 16)) continue;

      this.historyData.push({
        front: red,
        back: blue,
        full: numbers
      });
    }

    this.dataLoaded = this.historyData.length > 0;
    return this.historyData.length;
  }

  /**
   * 获取活动数据窗口
   */
  getActiveData(windowSize = 100) {
    const size = Math.min(windowSize, this.historyData.length);
    return this.historyData.slice(-size);
  }
}

/**
 * 频率分析器 - 独立于大乐透
 */
class SSQFrequencyAnalyzer {
  constructor(dataLoader) {
    this.dataLoader = dataLoader;
  }

  /**
   * 分析前区（红球）频率
   */
  analyzeFrontFrequency() {
    const activeData = this.dataLoader.getActiveData(SSQ_CONFIG.FREQUENCY_WINDOW);
    const counter = {};

    // 初始化计数器
    for (let i = 1; i <= SSQ_CONFIG.FRONT_RANGE; i++) {
      counter[i] = 0;
    }

    // 统计频率
    for (const draw of activeData) {
      for (const num of draw.front) {
        counter[num] = (counter[num] || 0) + 1;
      }
    }

    return counter;
  }

  /**
   * 分析后区（蓝球）频率
   */
  analyzeBackFrequency() {
    const activeData = this.dataLoader.getActiveData(SSQ_CONFIG.FREQUENCY_WINDOW);
    const counter = {};

    // 初始化计数器
    for (let i = 1; i <= SSQ_CONFIG.BACK_RANGE; i++) {
      counter[i] = 0;
    }

    // 统计频率
    for (const draw of activeData) {
      for (const num of draw.back) {
        counter[num] = (counter[num] || 0) + 1;
      }
    }

    return counter;
  }

  /**
   * 获取热号和冷号
   */
  getHotColdNumbers(topN = 10) {
    const frontFreq = this.analyzeFrontFrequency();
    const backFreq = this.analyzeBackFrequency();

    // 前区排序
    const frontSorted = Object.entries(frontFreq)
      .map(([num, freq]) => ({ number: parseInt(num), freq }))
      .sort((a, b) => b.freq - a.freq);

    // 后区排序
    const backSorted = Object.entries(backFreq)
      .map(([num, freq]) => ({ number: parseInt(num), freq }))
      .sort((a, b) => b.freq - a.freq);

    return {
      frontHot: frontSorted.slice(0, topN).map(item => item.number),
      frontCold: frontSorted.slice(-topN).reverse().map(item => item.number),
      backHot: backSorted.slice(0, Math.min(topN, SSQ_CONFIG.BACK_RANGE)).map(item => item.number),
      backCold: backSorted.slice(-Math.min(topN, SSQ_CONFIG.BACK_RANGE)).reverse().map(item => item.number)
    };
  }
}

/**
 * 遗漏分析器 - 独立于大乐透
 */
class SSQOmissionAnalyzer {
  constructor(dataLoader) {
    this.dataLoader = dataLoader;
  }

  /**
   * 计算前区遗漏值（修复版：从未出现的号码遗漏=数据长度而非0）
   */
  calculateFrontOmission() {
    const activeData = this.dataLoader.getActiveData(SSQ_CONFIG.OMISSION_WINDOW);
    const omission = {}; 
  
    for (let i = 1; i <= SSQ_CONFIG.FRONT_RANGE; i++) {
      omission[i] = activeData.length;  // 默认遗漏=数据长度（从未出现）
    }
  
    for (let i = activeData.length - 1; i >= 0; i--) {
      const draw = activeData[i];
      for (const num of draw.front) {
        if (omission[num] === activeData.length) {
          omission[num] = activeData.length - 1 - i;
        }
      }
    }
  
    return omission;
  }

  /**
   * 计算后区遗漏值（修复版）
   */
  calculateBackOmission() {
    const activeData = this.dataLoader.getActiveData(SSQ_CONFIG.OMISSION_WINDOW);
    const omission = {}; 
  
    for (let i = 1; i <= SSQ_CONFIG.BACK_RANGE; i++) {
      omission[i] = activeData.length;  // 默认遗漏=数据长度（从未出现）
    }
  
    for (let i = activeData.length - 1; i >= 0; i--) {
      const draw = activeData[i];
      for (const num of draw.back) {
        if (omission[num] === activeData.length) {
          omission[num] = activeData.length - 1 - i;
        }
      }
    }
  
    return omission;
  }
}

/**
 * 时间衰减分析器 - 独立于大乐透
 */
class SSQTimeDecayAnalyzer {
  constructor(dataLoader) {
    this.dataLoader = dataLoader;
  }

  /**
   * 计算带时间衰减的频率权重
   */
  calculateDecayWeights() {
    const activeData = this.dataLoader.getActiveData(50);
    const frontWeights = {};
    const backWeights = {};

    // 初始化
    for (let i = 1; i <= SSQ_CONFIG.FRONT_RANGE; i++) {
      frontWeights[i] = 0;
    }
    for (let i = 1; i <= SSQ_CONFIG.BACK_RANGE; i++) {
      backWeights[i] = 0;
    }

    // 应用时间衰减
    for (let i = 0; i < activeData.length; i++) {
      const draw = activeData[i];
      const weight = Math.pow(SSQ_CONFIG.TIME_DECAY_FACTOR, activeData.length - 1 - i);

      for (const num of draw.front) {
        frontWeights[num] += weight;
      }
      for (const num of draw.back) {
        backWeights[num] += weight;
      }
    }

    return { frontWeights, backWeights };
  }
}

/**
 * 区间频率分析器 - 独立于大乐透
 */
class SSQZoneFrequencyAnalyzer {
  constructor(dataLoader) {
    this.dataLoader = dataLoader;
  }

  /**
   * 分析前区间频率（3个区间：1-11, 12-22, 23-33）
   */
  analyzeFrontZones() {
    const activeData = this.dataLoader.getActiveData(50);
    const zones = [
      { name: '一区', start: 1, end: 11, count: 0 },
      { name: '二区', start: 12, end: 22, count: 0 },
      { name: '三区', start: 23, end: 33, count: 0 }
    ];

    for (const draw of activeData) {
      for (const num of draw.front) {
        if (num <= 11) zones[0].count++;
        else if (num <= 22) zones[1].count++;
        else zones[2].count++;
      }
    }

    return zones;
  }

  /**
   * 分析后区间频率（4个小区：1-4, 5-8, 9-12, 13-16）
   */
  analyzeBackZones() {
    const activeData = this.dataLoader.getActiveData(50);
    const zones = [
      { name: '小区1', start: 1, end: 4, count: 0 },
      { name: '小区2', start: 5, end: 8, count: 0 },
      { name: '小区3', start: 9, end: 12, count: 0 },
      { name: '小区4', start: 13, end: 16, count: 0 }
    ];

    for (const draw of activeData) {
      for (const num of draw.back) {
        if (num <= 4) zones[0].count++;
        else if (num <= 8) zones[1].count++;
        else if (num <= 12) zones[2].count++;
        else zones[3].count++;
      }
    }

    return zones;
  }
}

/**
 * 双色球预测引擎 - 核心算法（优化版）
 * 
 * 优化点：
 * 1. 冷号注入 - 每组推荐至少1-2个低频号
 * 2. 重号机制 - 上期号码加权（连续出号很常见）
 * 3. 区间强制均衡 - 三区间各至少1个
 * 4. 蓝球扩展 - 综合频率+遗漏+趋势
 */
class SSQPredictionEngine {
  constructor(dataLoader) {
    this.dataLoader = dataLoader;
    this.frequencyAnalyzer = new SSQFrequencyAnalyzer(dataLoader);
    this.omissionAnalyzer = new SSQOmissionAnalyzer(dataLoader);
    this.timeDecayAnalyzer = new SSQTimeDecayAnalyzer(dataLoader);
    this.zoneAnalyzer = new SSQZoneFrequencyAnalyzer(dataLoader);
    this.momentumAnalyzer = new SSQFrequencyMomentumAnalyzer(dataLoader);
    this.consecutiveAnalyzer = new SSQConsecutiveAnalyzer(dataLoader);
  }

  /**
   * 获取上期开奖号码（重号机制依赖）
   */
  _getLastDraw() {
    const history = this.dataLoader.historyData;
    return history && history.length > 0 ? history[history.length - 1] : null;
  }

  /**
   * 识别冷号（频率低于平均值的号码）
   */
  _getColdNumbers(threshold = 0.7) {
    const freq = this.frequencyAnalyzer.analyzeFrontFrequency();
    const avg = Object.values(freq).reduce((a, b) => a + b, 0) / SSQ_CONFIG.FRONT_RANGE;
    const coldThreshold = avg * threshold;
    const coldNumbers = [];
    for (let i = 1; i <= SSQ_CONFIG.FRONT_RANGE; i++) {
      if ((freq[i] || 0) <= coldThreshold) coldNumbers.push(i);
    }
    return coldNumbers;
  }

  /**
   * 区间强制均衡：确保三区间各至少1个号码
   */
  _ensureZoneBalance(numbers) {
    const zones = [[1,11], [12,22], [23,33]];
    const zoneCounts = zones.map(z => numbers.filter(n => n >= z[0] && n <= z[1]).length);
    
    // 如果某区间0个号码，从该区间的高分候选中补充
    const emptyZones = zoneCounts.map((c, idx) => c === 0 ? idx : -1).filter(idx => idx !== -1);
    if (emptyZones.length === 0) return numbers;

    const frontFreq = this.frequencyAnalyzer.analyzeFrontFrequency();
    const frontOmission = this.omissionAnalyzer.calculateFrontOmission();
    const totalFreq = Object.values(frontFreq).reduce((a, b) => a + b, 0);
    const avgFreq = totalFreq / SSQ_CONFIG.FRONT_RANGE;

    const result = [...numbers];
    for (const zoneIdx of emptyZones) {
      const zone = zones[zoneIdx];
      // 从该区间综合评分最高的号码中选
      const candidates = []; 
      for (let i = zone[0]; i <= zone[1]; i++) {
        const freqScore = (frontFreq[i] || 0) / avgFreq;
        const omScore = frontOmission[i] > 8 ? 1.2 : frontOmission[i] > 4 ? 1.0 : 0.8;
        candidates.push({ number: i, score: freqScore * omScore });
      }
      candidates.sort((a, b) => b.score - a.score);
      // 找该区间第一个不在result中的号码
      for (const c of candidates) {
        if (!result.includes(c.number)) {
          result.push(c.number);
          break;
        }
      }
    }

    // 如果补充了号码导致超过6个，去掉重复区间的最低分号码
    if (result.length > SSQ_CONFIG.FRONT_COUNT) {
      // 优先保留冷号和重号
      const lastDraw = this._getLastDraw();
      const lastRed = lastDraw ? lastDraw.front : []; 
      // 按区间号码数降序排列，从号码最多的区间删一个最低分的
      while (result.length > SSQ_CONFIG.FRONT_COUNT) {
        const currentZoneCounts = zones.map(z => result.filter(n => n >= z[0] && n <= z[1]).length);
        const maxZoneIdx = currentZoneCounts.indexOf(Math.max(...currentZoneCounts));
        const maxZone = zones[maxZoneIdx];
        // 找该区间中评分最低的号码（排除重号）
        const zoneNums = result.filter(n => n >= maxZone[0] && n <= maxZone[1]);
        const sorted = zoneNums.sort((a, b) => {
          // 保留重号优先
          const aIsRepeat = lastRed.includes(a) ? 100 : 0;
          const bIsRepeat = lastRed.includes(b) ? 100 : 0;
          return (bIsRepeat + (frontFreq[b] || 0)) - (aIsRepeat + (frontFreq[a] || 0));
        });
        // 删除评分最低的（不是重号且频率最低的）
        const toRemove = sorted.filter(n => !lastRed.includes(n)).pop() || sorted.pop();
        result.splice(result.indexOf(toRemove), 1);
      }
    }

    return result.sort((a, b) => a - b);
  }

  /**
   * 注入冷号：确保每组至少包含1-2个冷号
   */
  _injectColdNumbers(numbers, minCold = 1) {
    const coldNumbers = this._getColdNumbers(0.7);
    const currentCold = numbers.filter(n => coldNumbers.includes(n));
    
    if (currentCold.length >= minCold) return numbers;

    const result = [...numbers];
    const frontOmission = this.omissionAnalyzer.calculateFrontOmission();
    
    // 从冷号中选遗漏回归最好的
    const coldCandidates = coldNumbers
      .filter(n => !result.includes(n))
      .map(n => ({ number: n, omission: frontOmission[n] || 0 }))
      .sort((a, b) => b.omission - a.omission);  // 遗漏越大回归概率越高

    // 替换掉热号中最不重要的（低遗漏、高频的）
    const frontFreq = this.frequencyAnalyzer.analyzeFrontFrequency();
    const avg = Object.values(frontFreq).reduce((a, b) => a + b, 0) / SSQ_CONFIG.FRONT_RANGE;
    const hotNumbers = numbers.filter(n => !coldNumbers.includes(n));
    const hotToRemove = hotNumbers
      .map(n => ({ number: n, freq: frontFreq[n] || 0 }))
      .sort((a, b) => a.freq - b.freq);  // 频率最低的热号先被替换

    const needInject = minCold - currentCold.length;
    for (let i = 0; i < needInject && i < coldCandidates.length && hotToRemove.length > 0; i++) {
      const replaceIdx = result.indexOf(hotToRemove[i].number);
      if (replaceIdx !== -1) {
        result[replaceIdx] = coldCandidates[i].number;
      }
    }

    return result.sort((a, b) => a - b);
  }

  /**
   * 动态优化后处理：频率动量调整 + 连号注入
   * 每个算法最终输出前调用此方法
   */
  _applyDynamicOptimization(numbers) {
    const momentum = this.momentumAnalyzer.calculateFrontMomentum();

    // 动量调整：上升趋势的号码加权，下降趋势的号码减权
    // 不会改变号码集合，但调整排序以影响后续冷号/区间均衡优先级
    const adjusted = numbers.map(n => ({
      number: n,
      momentum: momentum[n] || 0
    })).sort((a, b) => b.momentum - a.momentum);

    // 如果有下降趋势的号码且不在冷号范围内，考虑替换为上升趋势号码
    const coldNumbers = this._getColdNumbers(0.7);
    const frontFreq = this.frequencyAnalyzer.analyzeFrontFrequency();
    const avg = Object.values(frontFreq).reduce((a, b) => a + b, 0) / SSQ_CONFIG.FRONT_RANGE;

    const result = [...numbers];
    // 找下降趋势最严重的号码
    const declining = adjusted.filter(a => a.momentum < -0.05 && !coldNumbers.includes(a.number));
    // 找上升趋势但不在结果中的号码
    const risingCandidates = []; 
    for (let i = 1; i <= SSQ_CONFIG.FRONT_RANGE; i++) {
      if (!result.includes(i) && (momentum[i] || 0) > 0.05) {
        risingCandidates.push({ number: i, momentum: momentum[i] });
      }
    }
    risingCandidates.sort((a, b) => b.momentum - a.momentum);

    // 替换最多1个下降趋势号码为上升趋势号码
    if (declining.length > 0 && risingCandidates.length > 0) {
      const toReplace = declining[0].number;
      const replaceIdx = result.indexOf(toReplace);
      if (replaceIdx !== -1) {
        result[replaceIdx] = risingCandidates[0].number;
      }
    }

    // 连号注入
    return this.consecutiveAnalyzer.injectConsecutive(result.sort((a, b) => a - b));
  }

  /**
   * 重号机制：上期号码加分
   */
  _getRepeatBonus() {
    const lastDraw = this._getLastDraw();
    if (!lastDraw) return {}; 
    // 上期出现的号码给重复加分
    const bonus = {}; 
    for (const num of lastDraw.front) bonus[num] = 12;
    return bonus;
  }

  /**
   * 蓝球综合预测（频率+遗漏+动量+重号，归一化防垄断）
   */
  _predictBlue() {
    const backFreq = this.frequencyAnalyzer.analyzeBackFrequency();
    const backOmission = this.omissionAnalyzer.calculateBackOmission();
    const backMomentum = this.momentumAnalyzer.calculateBackMomentum();
    const lastDraw = this._getLastDraw();

    // 各维度归一化到0-100范围，避免某维度量级垄断
    const maxFreq = Math.max(...Object.values(backFreq)) || 1;
    const maxOmission = Math.max(...Object.values(backOmission)) || 1;
    const maxAbsMomentum = Math.max(...Object.values(backMomentum).map(v => Math.abs(v))) || 1;

    const scores = {}; 
    for (let i = 1; i <= SSQ_CONFIG.BACK_RANGE; i++) {
      // 频率评分（归一化0-25）
      const freqScore = ((backFreq[i] || 0) / maxFreq) * 25;
      // 遗漏评分：遗漏适中得分最高，刚出现得低分
      const om = backOmission[i] || 0;
      const omNormalized = om / maxOmission;
      let omScore;
      if (om === 0) omScore = 5;           // 刚出现，不太可能连续出
      else if (om <= 5) omScore = 10 + omNormalized * 15;  // 适中遗漏，回归概率高
      else omScore = 15 + omNormalized * 5;  // 大遗漏，回归概率中等
      // 动量评分（归一化0-20）
      const momentum = backMomentum[i] || 0;
      const momentumScore = momentum > 0 ? (momentum / maxAbsMomentum) * 20 : 0;
      // 重号加分（适中+6，不垄断）
      const repeatScore = lastDraw && lastDraw.back.includes(i) ? 6 : 0;
      scores[i] = freqScore + omScore + momentumScore + repeatScore;
    }

    // 加权随机从Top5候选中选蓝球，避免确定性垄断
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const topCandidates = sorted.slice(0, 5);
    const topScores = topCandidates.map(([_, s]) => s);
    const totalScore = topScores.reduce((a, b) => a + b, 0);
    
    // 按评分权重随机选择，评分越高被选中概率越大
    let rand = Math.random() * totalScore;
    for (const [num, score] of topCandidates) {
      rand -= score;
      if (rand <= 0) return parseInt(num);
    }
    // 兜底：返回最高分
    return parseInt(topCandidates[0][0]);
  }

  /**
   * 频率加权预测（优化：加入重号+冷号+区间均衡）
   */
  frequencyWeightedPredict() {
    const frontFreq = this.frequencyAnalyzer.analyzeFrontFrequency();
    const repeatBonus = this._getRepeatBonus();

    // 综合评分：频率 + 重号加分
    const frontScores = [];
    for (let i = 1; i <= SSQ_CONFIG.FRONT_RANGE; i++) {
      const freq = frontFreq[i] || 0;
      const repeat = repeatBonus[i] || 0;
      frontScores.push({ number: i, score: freq + repeat });
    }

    let frontNumbers = frontScores
      .sort((a, b) => b.score - a.score)
      .slice(0, SSQ_CONFIG.FRONT_COUNT)
      .map(item => item.number);

    // 注入冷号（至少1个）
    frontNumbers = this._injectColdNumbers(frontNumbers, 1);
    frontNumbers = this._ensureZoneBalance(frontNumbers);
    frontNumbers = this._applyDynamicOptimization(frontNumbers);

    // 蓝球综合预测
    const blue = this._predictBlue();

    return [...frontNumbers.sort((a, b) => a - b), blue];
  }

  /**
   * 贝叶斯动态预测（优化：加入重号+冷号+区间均衡）
   */
  bayesianPredict() {
    const frontFreq = this.frequencyAnalyzer.analyzeFrontFrequency();
    const frontOmission = this.omissionAnalyzer.calculateFrontOmission();
    const repeatBonus = this._getRepeatBonus();

    const totalFrontFreq = Object.values(frontFreq).reduce((a, b) => a + b, 0);

    // 计算后验概率 + 重号加分
    const frontPosterior = [];
    for (let i = 1; i <= SSQ_CONFIG.FRONT_RANGE; i++) {
      const prior = (frontFreq[i] || 0) / totalFrontFreq;
      const likelihood = frontOmission[i] > 10 ? 1.5 : 1.0;
      const repeat = repeatBonus[i] || 0;
      frontPosterior.push({ number: i, prob: prior * likelihood + repeat * 0.01 });
    }

    let frontNumbers = frontPosterior
      .sort((a, b) => b.prob - a.prob)
      .slice(0, SSQ_CONFIG.FRONT_COUNT)
      .map(item => item.number);

    frontNumbers = this._injectColdNumbers(frontNumbers, 1);
    frontNumbers = this._ensureZoneBalance(frontNumbers);
    frontNumbers = this._applyDynamicOptimization(frontNumbers);

    const blue = this._predictBlue();

    return [...frontNumbers.sort((a, b) => a - b), blue];
  }

  /**
   * 遗漏分析预测（优化：加入重号+冷号+区间均衡）
   */
  omissionPredict() {
    const frontOmission = this.omissionAnalyzer.calculateFrontOmission();
    const repeatBonus = this._getRepeatBonus();

    // 遗漏评分 + 重号加分
    const frontScores = []; 
    for (let i = 1; i <= SSQ_CONFIG.FRONT_RANGE; i++) {
      const omScore = Math.abs(frontOmission[i] - 10);  // 接近10的最佳
      const repeat = repeatBonus[i] || 0;
      frontScores.push({ number: i, score: -omScore + repeat });  // 遗漏偏差越小越好
    }

    let frontNumbers = frontScores
      .sort((a, b) => b.score - a.score)
      .slice(0, SSQ_CONFIG.FRONT_COUNT)
      .map(item => item.number);

    frontNumbers = this._injectColdNumbers(frontNumbers, 1);
    frontNumbers = this._ensureZoneBalance(frontNumbers);
    frontNumbers = this._applyDynamicOptimization(frontNumbers);

    const blue = this._predictBlue();

    return [...frontNumbers.sort((a, b) => a - b), blue];
  }

  /**
   * 时间衰减预测（优化：加入重号+冷号+区间均衡）
   */
  timeDecayPredict() {
    const { frontWeights } = this.timeDecayAnalyzer.calculateDecayWeights();
    const repeatBonus = this._getRepeatBonus();

    const frontScores = []; 
    for (let i = 1; i <= SSQ_CONFIG.FRONT_RANGE; i++) {
      const decay = frontWeights[i] || 0;
      const repeat = repeatBonus[i] || 0;
      frontScores.push({ number: i, score: decay + repeat });
    }

    let frontNumbers = frontScores
      .sort((a, b) => b.score - a.score)
      .slice(0, SSQ_CONFIG.FRONT_COUNT)
      .map(item => item.number);

    frontNumbers = this._injectColdNumbers(frontNumbers, 1);
    frontNumbers = this._ensureZoneBalance(frontNumbers);
    frontNumbers = this._applyDynamicOptimization(frontNumbers);

    const blue = this._predictBlue();

    return [...frontNumbers.sort((a, b) => a - b), blue];
  }

  /**
   * 区间频率预测（优化：加入重号+冷号+区间均衡）
   */
  zoneFrequencyPredict() {
    const frontFreq = this.frequencyAnalyzer.analyzeFrontFrequency();
    const frontZones = this.zoneAnalyzer.analyzeFrontZones();
    const repeatBonus = this._getRepeatBonus();
  
    // 从每个区间选择2个号码（优先重号）
    const frontNumbers = []; 
    for (const zone of frontZones) {
      const zoneCandidates = [];
      for (let i = zone.start; i <= zone.end; i++) {
        const freqScore = frontFreq[i] || 0;
        const repeat = repeatBonus[i] || 0;
        zoneCandidates.push({ number: i, score: freqScore + repeat });
      }
  
      const selected = zoneCandidates
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
        .map(item => item.number);
  
      frontNumbers.push(...selected);
    }
  
    // 注入冷号
    let result = this._injectColdNumbers(frontNumbers, 1);
    // 区间均衡已经由算法本身保证（每区2个），确保刚好6个
    if (result.length > SSQ_CONFIG.FRONT_COUNT) {
      result = result.slice(0, SSQ_CONFIG.FRONT_COUNT);
    }
  
    const blue = this._predictBlue();
  
    return [...result.sort((a, b) => a - b), blue];
  }
  
  /**
   * 均值回归预测（优化：加入冷号+区间均衡）
   */
  meanRegressionPredict() {
    const activeData = this.dataLoader.getActiveData(50);
    const repeatBonus = this._getRepeatBonus();
    
    const frontPositions = {}; const frontCounts = {};
    for (let i = 1; i <= SSQ_CONFIG.FRONT_RANGE; i++) { frontPositions[i] = 0; frontCounts[i] = 0; }
    for (let i = 0; i < activeData.length; i++) {
      for (const num of activeData[i].front) { frontPositions[num] += i; frontCounts[num]++; }
    }
    
    const midPoint = activeData.length / 2;
    const frontScores = [];
    for (let i = 1; i <= SSQ_CONFIG.FRONT_RANGE; i++) {
      const avgPos = frontCounts[i] > 0 ? frontPositions[i] / frontCounts[i] : 0;
      const deviation = frontCounts[i] > 0 ? Math.abs(avgPos - midPoint) / activeData.length : 0;
      const countScore = Math.max(0, (activeData.length * 6 / SSQ_CONFIG.FRONT_RANGE - frontCounts[i])) / activeData.length;
      const repeat = repeatBonus[i] || 0;
      frontScores.push({ number: i, score: deviation * 15 + countScore * 20 + repeat });
    }
    
    let frontNumbers = frontScores
      .sort((a, b) => b.score - a.score)
      .slice(0, SSQ_CONFIG.FRONT_COUNT)
      .map(item => item.number);

    frontNumbers = this._injectColdNumbers(frontNumbers, 2);
    frontNumbers = this._ensureZoneBalance(frontNumbers);
    frontNumbers = this._applyDynamicOptimization(frontNumbers);

    const blue = this._predictBlue();
    return [...frontNumbers.sort((a, b) => a - b), blue];
  }
  
  /**
   * 平衡策略预测（优化：加入重号+冷号+区间均衡）
   */
  balancedStrategyPredict() {
    const frontFreq = this.frequencyAnalyzer.analyzeFrontFrequency();
    const frontOmission = this.omissionAnalyzer.calculateFrontOmission();
    const repeatBonus = this._getRepeatBonus();
  
    const totalFrontFreq = Object.values(frontFreq).reduce((a, b) => a + b, 0);
    const avgFreq = totalFrontFreq / SSQ_CONFIG.FRONT_RANGE;
      
    const frontScores = [];
    for (let i = 1; i <= SSQ_CONFIG.FRONT_RANGE; i++) {
      const freqScore = (frontFreq[i] || 0) >= avgFreq ? 15 : 5;
      const omissionScore = frontOmission[i] > 8 ? 15 : frontOmission[i] > 3 ? 10 : 5;
      const repeat = repeatBonus[i] || 0;
      frontScores.push({ number: i, score: freqScore + omissionScore + repeat });
    }

    let frontNumbers = this._selectBalancedOddEven(frontScores.sort((a, b) => b.score - a.score), SSQ_CONFIG.FRONT_COUNT, 3);

    frontNumbers = this._injectColdNumbers(frontNumbers, 1);
    frontNumbers = this._ensureZoneBalance(frontNumbers);
    frontNumbers = this._applyDynamicOptimization(frontNumbers);

    const blue = this._predictBlue();
    return [...frontNumbers.sort((a, b) => a - b), blue];
  }
  
  /**
   * 正态分布预测（优化：加入重号+冷号+区间均衡）
   */
  normalDistributionPredict() {
    const frontFreq = this.frequencyAnalyzer.analyzeFrontFrequency();
    const activeData = this.dataLoader.getActiveData(50);
    const repeatBonus = this._getRepeatBonus();
    
    const frequencies = Object.values(frontFreq);
    const meanFreq = frequencies.reduce((a, b) => a + b, 0) / frequencies.length;
    const variance = frequencies.reduce((a, b) => a + (b - meanFreq) ** 2, 0) / frequencies.length;
    const stdDev = Math.sqrt(variance);
  
    const frontScores = []; 
    for (let i = 1; i <= SSQ_CONFIG.FRONT_RANGE; i++) {
      const freq = frontFreq[i] || 0;
      const zScore = (freq - meanFreq) / (stdDev || 1);
      let score;
      if (zScore >= -1 && zScore <= 1) score = 20;
      else if (zScore < -1) score = 18;  // 低频回归
      else score = 8;
      const recentAppearances = activeData.slice(-10).filter(d => d.front.includes(i)).length;
      score += recentAppearances * 2;
      score += (repeatBonus[i] || 0);  // 重号加分
      frontScores.push({ number: i, score });
    }
  
    let frontNumbers = frontScores
      .sort((a, b) => b.score - a.score)
      .slice(0, SSQ_CONFIG.FRONT_COUNT)
      .map(item => item.number);
  
    frontNumbers = this._injectColdNumbers(frontNumbers, 1);
    frontNumbers = this._ensureZoneBalance(frontNumbers);
    frontNumbers = this._applyDynamicOptimization(frontNumbers);

    const blue = this._predictBlue();
    return [...frontNumbers.sort((a, b) => a - b), blue];
  }
  
  /**
   * 从候选中选取号码，确保奇偶均衡
   * @param candidates 排序后的候选列表
   * @param count 需要选取的数量
   * @param targetOddCount 目标奇数个数
   */
  _selectBalancedOddEven(candidates, count, targetOddCount) {
    const oddPool = candidates.filter(c => c.number % 2 === 1);
    const evenPool = candidates.filter(c => c.number % 2 === 0);
  
    const result = []; 
    let oddCount = 0;
    let evenCount = 0;
  
    // 优先从高分候选中交替选奇偶
    for (const c of candidates) {
      if (result.length >= count) break;
      if (result.includes(c.number)) continue;
  
      const isOdd = c.number % 2 === 1;
      if (isOdd && oddCount < targetOddCount + 1) {
        result.push(c.number);
        oddCount++;
      } else if (!isOdd && evenCount < count - targetOddCount + 1) {
        result.push(c.number);
        evenCount++;
      }
    }
  
    // 如果不够，补充剩余候选
    if (result.length < count) {
      for (const c of candidates) {
        if (result.length >= count) break;
        if (!result.includes(c.number)) {
          result.push(c.number);
        }
      }
    }
  
    return result;
  }

  /**
   * 混合模型预测（优化：加入重号+冷号+区间均衡）
   */
  hybridPredict() {
    const frontFreq = this.frequencyAnalyzer.analyzeFrontFrequency();
    const frontOmission = this.omissionAnalyzer.calculateFrontOmission();
    const { frontWeights } = this.timeDecayAnalyzer.calculateDecayWeights();
    const repeatBonus = this._getRepeatBonus();

    const totalFrontFreq = Object.values(frontFreq).reduce((a, b) => a + b, 0);
    const expectedFreqPerNum = totalFrontFreq / SSQ_CONFIG.FRONT_RANGE;

    const frontScores = [];
    for (let i = 1; i <= SSQ_CONFIG.FRONT_RANGE; i++) {
      const freqScore = ((frontFreq[i] || 0) / expectedFreqPerNum) * 30;
      const omissionScore = frontOmission[i] > 8 ? 20 : 10;
      const decayScore = frontWeights[i] * 20;
      const repeatScore = repeatBonus[i] || 0;
      frontScores.push({ number: i, score: freqScore + omissionScore + decayScore + repeatScore });
    }

    let frontNumbers = frontScores
      .sort((a, b) => b.score - a.score)
      .slice(0, SSQ_CONFIG.FRONT_COUNT)
      .map(item => item.number);

    frontNumbers = this._injectColdNumbers(frontNumbers, 1);
    frontNumbers = this._ensureZoneBalance(frontNumbers);
    frontNumbers = this._applyDynamicOptimization(frontNumbers);

    const blue = this._predictBlue();
    return [...frontNumbers.sort((a, b) => a - b), blue];
  }

  /**
   * 加权随机选择
   */
  weightedRandomSelect(candidates, count) {
    const selected = [];
    const remaining = [...candidates];

    while (selected.length < count && remaining.length > 0) {
      const totalWeight = remaining.reduce((sum, c) => sum + c.freq, 0);
      let random = Math.random() * totalWeight;

      for (let i = 0; i < remaining.length; i++) {
        random -= remaining[i].freq;
        if (random <= 0) {
          selected.push(remaining[i].number);
          remaining.splice(i, 1);
          break;
        }
      }
    }

    return selected.sort((a, b) => a - b);
  }
}

/**
 * 双色球分析器主类
 */
class ShuangSeQiuAnalyzer {
  constructor() {
    this.dataLoader = new SSQDataLoader();
    this.predictionEngine = null;
  }

  /**
   * 加载历史数据
   */
  loadHistoryData(dataStr, sourceName = "双色球数据") {
    if (!this.dataLoader) {
      this.dataLoader = new SSQDataLoader();
    }
    const count = this.dataLoader.loadData(dataStr);
    this.predictionEngine = new SSQPredictionEngine(this.dataLoader);
    console.log(`✅ ${sourceName} 已加载，共 ${count} 期数据`);
    return count;
  }

  /**
   * 获取热号冷号
   */
  getHotColdNumbers(topN = 10) {
    if (!this.predictionEngine) {
      throw new Error('请先加载历史数据');
    }

    const hotCold = this.predictionEngine.frequencyAnalyzer.getHotColdNumbers(topN);
    return {
      frontHot: hotCold.frontHot,
      frontCold: hotCold.frontCold,
      backHot: hotCold.backHot,
      backCold: hotCold.backCold
    };
  }

  /**
   * 生成预测
   */
  generatePrediction(model = 'frequencyWeighted') {
    if (!this.predictionEngine) {
      throw new Error('请先加载历史数据');
    }

    let result;
    switch (model) {
      case 'frequencyWeighted':
        result = this.predictionEngine.frequencyWeightedPredict();
        break;
      case 'bayesian':
        result = this.predictionEngine.bayesianPredict();
        break;
      case 'omissionAnalysis':
        result = this.predictionEngine.omissionPredict();
        break;
      case 'timeDecay':
        result = this.predictionEngine.timeDecayPredict();
        break;
      case 'zoneFrequency':
        result = this.predictionEngine.zoneFrequencyPredict();
        break;
      case 'meanRegression':
        result = this.predictionEngine.meanRegressionPredict();
        break;
      case 'balancedStrategy':
        result = this.predictionEngine.balancedStrategyPredict();
        break;
      case 'normalDistribution':
        result = this.predictionEngine.normalDistributionPredict();
        break;
      case 'hybrid':
        result = this.predictionEngine.hybridPredict();
        break;
      default:
        throw new Error(`未知模型: ${model}`);
    }

    return {
      red: result.slice(0, SSQ_CONFIG.FRONT_COUNT),
      blue: result.slice(SSQ_CONFIG.FRONT_COUNT)
    };
  }

  /**
   * 生成多个模型的推荐
   */
  generateRecommendation(groupsPerModel = 3, selectedModels = ['frequencyWeighted', 'bayesian', 'hybrid']) {
    console.log('🚀 generateRecommendation, 模型:', selectedModels, '每组:', groupsPerModel);
    const predictions = [];

    for (const model of selectedModels) {
      for (let i = 0; i < groupsPerModel; i++) {
        try {
          const prediction = this.generatePrediction(model);
          console.log(`  ✅ ${model} 第${i+1}组: 红=${prediction.red.join(',')} 蓝=${prediction.blue.join(',')}`);
          predictions.push({
            model,
            groupNum: i + 1,
            red: prediction.red,
            blue: prediction.blue
          });
        } catch (e) {
          console.warn(`模型 ${model} 生成第${i + 1}组失败:`, e.message);
        }
      }
    }

    const hotCold = this.getHotColdNumbers(10);

    return {
      predictions,
      hotCold: {
        redHot: hotCold.frontHot,
        redCold: hotCold.frontCold,
        blueHot: hotCold.backHot,
        blueCold: hotCold.backCold
      },
      dataCount: this.dataLoader.historyData.length,
      generatedAt: new Date().toLocaleString('zh-CN')
    };
  }

  /**
   * 释放资源
   */
  destroy() {
    this.dataLoader = null;
    this.predictionEngine = null;
  }
}

// 默认数据
export const SSQ_DEFAULT_DATA = ssqHistoryRaw.trim();

export default ShuangSeQiuAnalyzer;
