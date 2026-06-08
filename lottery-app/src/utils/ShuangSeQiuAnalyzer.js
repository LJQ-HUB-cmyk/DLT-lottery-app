/**
 * 双色球专用算法适配器
 * 
 * 完全独立于大乐透算法，专为双色球设计：
 * - 红球：1-33 选6个
 * - 蓝球：1-16 选1个
 * 
 * 不修改、不影响大乐透的任何算法逻辑
 */

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
   * 计算前区遗漏值
   */
  calculateFrontOmission() {
    const activeData = this.dataLoader.getActiveData(SSQ_CONFIG.OMISSION_WINDOW);
    const omission = {};

    // 初始化
    for (let i = 1; i <= SSQ_CONFIG.FRONT_RANGE; i++) {
      omission[i] = 0;
    }

    // 从最新到最旧遍历
    for (let i = activeData.length - 1; i >= 0; i--) {
      const draw = activeData[i];
      for (const num of draw.front) {
        if (omission[num] === 0) {
          omission[num] = activeData.length - 1 - i;
        }
      }
    }

    return omission;
  }

  /**
   * 计算后区遗漏值
   */
  calculateBackOmission() {
    const activeData = this.dataLoader.getActiveData(SSQ_CONFIG.OMISSION_WINDOW);
    const omission = {};

    // 初始化
    for (let i = 1; i <= SSQ_CONFIG.BACK_RANGE; i++) {
      omission[i] = 0;
    }

    // 从最新到最旧遍历
    for (let i = activeData.length - 1; i >= 0; i--) {
      const draw = activeData[i];
      for (const num of draw.back) {
        if (omission[num] === 0) {
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
 * 双色球预测引擎 - 核心算法
 */
class SSQPredictionEngine {
  constructor(dataLoader) {
    this.dataLoader = dataLoader;
    this.frequencyAnalyzer = new SSQFrequencyAnalyzer(dataLoader);
    this.omissionAnalyzer = new SSQOmissionAnalyzer(dataLoader);
    this.timeDecayAnalyzer = new SSQTimeDecayAnalyzer(dataLoader);
    this.zoneAnalyzer = new SSQZoneFrequencyAnalyzer(dataLoader);
  }

  /**
   * 频率加权预测
   */
  frequencyWeightedPredict() {
    const frontFreq = this.frequencyAnalyzer.analyzeFrontFrequency();
    const backFreq = this.frequencyAnalyzer.analyzeBackFrequency();

    // 前区：选择频率最高的6个
    const frontCandidates = Object.entries(frontFreq)
      .map(([num, freq]) => ({ number: parseInt(num), freq }))
      .sort((a, b) => b.freq - a.freq)
      .slice(0, SSQ_CONFIG.FRONT_COUNT + 3);

    const frontNumbers = this.weightedRandomSelect(
      frontCandidates,
      SSQ_CONFIG.FRONT_COUNT
    );

    // 后区：选择频率最高的1个
    const backCandidates = Object.entries(backFreq)
      .map(([num, freq]) => ({ number: parseInt(num), freq }))
      .sort((a, b) => b.freq - a.freq)
      .slice(0, 3);

    const backNumbers = [backCandidates[0].number];

    return [...frontNumbers.sort((a, b) => a - b), ...backNumbers];
  }

  /**
   * 贝叶斯动态预测
   */
  bayesianPredict() {
    const frontFreq = this.frequencyAnalyzer.analyzeFrontFrequency();
    const backFreq = this.frequencyAnalyzer.analyzeBackFrequency();
    const frontOmission = this.omissionAnalyzer.calculateFrontOmission();
    const backOmission = this.omissionAnalyzer.calculateBackOmission();

    const totalFrontFreq = Object.values(frontFreq).reduce((a, b) => a + b, 0);
    const totalBackFreq = Object.values(backFreq).reduce((a, b) => a + b, 0);

    // 计算后验概率
    const frontPosterior = {};
    for (let i = 1; i <= SSQ_CONFIG.FRONT_RANGE; i++) {
      const prior = (frontFreq[i] || 0) / totalFrontFreq;
      const likelihood = frontOmission[i] > 10 ? 1.5 : 1.0; // 高遗漏增加概率
      frontPosterior[i] = prior * likelihood;
    }

    const backPosterior = {};
    for (let i = 1; i <= SSQ_CONFIG.BACK_RANGE; i++) {
      const prior = (backFreq[i] || 0) / totalBackFreq;
      const likelihood = backOmission[i] > 5 ? 1.5 : 1.0;
      backPosterior[i] = prior * likelihood;
    }

    // 选择后验概率最高的号码
    const frontNumbers = Object.entries(frontPosterior)
      .map(([num, prob]) => ({ number: parseInt(num), prob }))
      .sort((a, b) => b.prob - a.prob)
      .slice(0, SSQ_CONFIG.FRONT_COUNT)
      .map(item => item.number);

    const backNumbers = Object.entries(backPosterior)
      .map(([num, prob]) => ({ number: parseInt(num), prob }))
      .sort((a, b) => b.prob - a.prob)
      .slice(0, SSQ_CONFIG.BACK_COUNT)
      .map(item => item.number);

    return [...frontNumbers.sort((a, b) => a - b), ...backNumbers];
  }

  /**
   * 遗漏分析预测
   */
  omissionPredict() {
    const frontOmission = this.omissionAnalyzer.calculateFrontOmission();
    const backOmission = this.omissionAnalyzer.calculateBackOmission();

    // 选择遗漏值适中的号码（回归理论）
    const frontNumbers = Object.entries(frontOmission)
      .map(([num, omission]) => ({ number: parseInt(num), omission }))
      .sort((a, b) => {
        // 遗漏值在5-15之间的号码优先
        const aScore = Math.abs(a.omission - 10);
        const bScore = Math.abs(b.omission - 10);
        return aScore - bScore;
      })
      .slice(0, SSQ_CONFIG.FRONT_COUNT)
      .map(item => item.number);

    const backNumbers = Object.entries(backOmission)
      .map(([num, omission]) => ({ number: parseInt(num), omission }))
      .sort((a, b) => {
        const aScore = Math.abs(a.omission - 5);
        const bScore = Math.abs(b.omission - 5);
        return aScore - bScore;
      })
      .slice(0, SSQ_CONFIG.BACK_COUNT)
      .map(item => item.number);

    return [...frontNumbers.sort((a, b) => a - b), ...backNumbers];
  }

  /**
   * 时间衰减预测
   */
  timeDecayPredict() {
    const { frontWeights, backWeights } = this.timeDecayAnalyzer.calculateDecayWeights();

    const frontNumbers = Object.entries(frontWeights)
      .map(([num, weight]) => ({ number: parseInt(num), weight }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, SSQ_CONFIG.FRONT_COUNT)
      .map(item => item.number);

    const backNumbers = Object.entries(backWeights)
      .map(([num, weight]) => ({ number: parseInt(num), weight }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, SSQ_CONFIG.BACK_COUNT)
      .map(item => item.number);

    return [...frontNumbers.sort((a, b) => a - b), ...backNumbers];
  }

  /**
   * 区间频率预测
   */
  zoneFrequencyPredict() {
    const frontFreq = this.frequencyAnalyzer.analyzeFrontFrequency();
    const frontZones = this.zoneAnalyzer.analyzeFrontZones();
  
    // 从每个区间选择2个号码
    const frontNumbers = [];
    for (const zone of frontZones) {
      const zoneCandidates = [];
      for (let i = zone.start; i <= zone.end; i++) {
        zoneCandidates.push({ number: i, freq: frontFreq[i] || 0 });
      }
  
      const selected = zoneCandidates
        .sort((a, b) => b.freq - a.freq)
        .slice(0, 2)
        .map(item => item.number);
  
      frontNumbers.push(...selected);
    }
  
    // 后区使用频率加权
    const backFreq = this.frequencyAnalyzer.analyzeBackFrequency();
    const backNumbers = Object.entries(backFreq)
      .map(([num, freq]) => ({ number: parseInt(num), freq }))
      .sort((a, b) => b.freq - a.freq)
      .slice(0, SSQ_CONFIG.BACK_COUNT)
      .map(item => item.number);
  
    return [...frontNumbers.sort((a, b) => a - b), ...backNumbers];
  }
  
  /**
   * 均值回归预测
   * 基于历史数据的均值，选择偏离均值较远、有回归趋势的号码
   */
  meanRegressionPredict() {
    const activeData = this.dataLoader.getActiveData(50);
      
    // 计算每个红球号码的历史出现均值位置
    const frontPositions = {};  // 记录每个号码在出现时的平均期号位置
    const frontCounts = {};     // 记录每个号码出现次数
    for (let i = 1; i <= SSQ_CONFIG.FRONT_RANGE; i++) {
      frontPositions[i] = 0;
      frontCounts[i] = 0;
    }
      
    for (let i = 0; i < activeData.length; i++) {
      for (const num of activeData[i].front) {
        frontPositions[num] += i;
        frontCounts[num]++;
      }
    }
      
    // 计算均值位置和当前位置的偏差
    const midPoint = activeData.length / 2;
    const frontScores = [];
    for (let i = 1; i <= SSQ_CONFIG.FRONT_RANGE; i++) {
      const avgPos = frontCounts[i] > 0 ? frontPositions[i] / frontCounts[i] : 0;
      // 均值偏差：偏离均值越远的号码，回归概率越高
      const deviation = frontCounts[i] > 0 ? Math.abs(avgPos - midPoint) / activeData.length : 0;
      // 低频号码回归优先
      const countScore = Math.max(0, (activeData.length * 6 / SSQ_CONFIG.FRONT_RANGE - frontCounts[i])) / activeData.length;
      const score = deviation * 15 + countScore * 20;
      frontScores.push({ number: i, score });
    }
      
    const frontNumbers = frontScores
      .sort((a, b) => b.score - a.score)
      .slice(0, SSQ_CONFIG.FRONT_COUNT)
      .map(item => item.number);
  
    // 蓝球均值回归
    const backPositions = {};
    const backCounts = {};
    for (let i = 1; i <= SSQ_CONFIG.BACK_RANGE; i++) {
      backPositions[i] = 0;
      backCounts[i] = 0;
    }
    for (let i = 0; i < activeData.length; i++) {
      for (const num of activeData[i].back) {
        backPositions[num] += i;
        backCounts[num]++;
      }
    }
      
    const backScores = [];
    for (let i = 1; i <= SSQ_CONFIG.BACK_RANGE; i++) {
      const avgPos = backCounts[i] > 0 ? backPositions[i] / backCounts[i] : 0;
      const deviation = backCounts[i] > 0 ? Math.abs(avgPos - midPoint) / activeData.length : 0;
      const countScore = Math.max(0, (activeData.length * 1 / SSQ_CONFIG.BACK_RANGE - backCounts[i])) / activeData.length;
      const score = deviation * 15 + countScore * 20;
      backScores.push({ number: i, score });
    }
      
    const backNumbers = backScores
      .sort((a, b) => b.score - a.score)
      .slice(0, SSQ_CONFIG.BACK_COUNT)
      .map(item => item.number);
  
    return [...frontNumbers.sort((a, b) => a - b), ...backNumbers];
  }
  
  /**
   * 平衡策略预测
   * 综合热号与冷号，确保奇偶、大小均衡分布
   */
  balancedStrategyPredict() {
    const hotCold = this.frequencyAnalyzer.getHotColdNumbers(10);
    const frontFreq = this.frequencyAnalyzer.analyzeFrontFrequency();
    const frontOmission = this.omissionAnalyzer.calculateFrontOmission();
  
    // 综合评分：频率 + 遗漏回归
    const frontScores = [];
    const totalFrontFreq = Object.values(frontFreq).reduce((a, b) => a + b, 0);
    const avgFreq = totalFrontFreq / SSQ_CONFIG.FRONT_RANGE;
      
    for (let i = 1; i <= SSQ_CONFIG.FRONT_RANGE; i++) {
      const freqScore = (frontFreq[i] || 0) >= avgFreq ? 15 : 5;  // 热号加分，冷号基础分
      const omissionScore = frontOmission[i] > 8 ? 15 : frontOmission[i] > 3 ? 10 : 5;  // 中等遗漏优先
      frontScores.push({ number: i, score: freqScore + omissionScore });
    }
  
    // 从候选中选取，确保奇偶均衡（3:3 或 4:2 或 2:4）
    const candidates = frontScores.sort((a, b) => b.score - a.score);
    const frontNumbers = this._selectBalancedOddEven(candidates, SSQ_CONFIG.FRONT_COUNT, 3);
  
    // 蓝球：冷号优先（遗漏回归策略）
    const backOmission = this.omissionAnalyzer.calculateBackOmission();
    const backNumbers = Object.entries(backOmission)
      .map(([num, om]) => ({ number: parseInt(num), omission: om }))
      .sort((a, b) => b.omission - a.omission)  // 遗漏越大越优先
      .slice(0, SSQ_CONFIG.BACK_COUNT)
      .map(item => item.number);
  
    return [...frontNumbers.sort((a, b) => a - b), ...backNumbers];
  }
  
  /**
   * 正态分布预测
   * 基于号码出现频率的正态分布特征选号
   */
  normalDistributionPredict() {
    const frontFreq = this.frequencyAnalyzer.analyzeFrontFrequency();
    const activeData = this.dataLoader.getActiveData(50);
  
    // 计算频率的均值和标准差
    const frequencies = Object.values(frontFreq);
    const meanFreq = frequencies.reduce((a, b) => a + b, 0) / frequencies.length;
    const variance = frequencies.reduce((a, b) => a + (b - meanFreq) ** 2, 0) / frequencies.length;
    const stdDev = Math.sqrt(variance);
  
    // 选择频率在均值 ± 1σ 范围内的号码（出现频率适中）
    // 以及低于均值 1σ 的号码（出现偏少，有回归可能）
    const frontScores = []; 
    for (let i = 1; i <= SSQ_CONFIG.FRONT_RANGE; i++) {
      const freq = frontFreq[i] || 0;
      const zScore = (freq - meanFreq) / (stdDev || 1);
      // 频率适中的号码（z在 -1 到 1）得分较高
      // 频率偏低的号码（z < -1）额外加分（回归预期）
      let score;
      if (zScore >= -1 && zScore <= 1) {
        score = 20;  // 适中频率
      } else if (zScore < -1) {
        score = 18;  // 低频回归
      } else {
        score = 8;   // 过高频，可能回落
      }
      // 叠加时间衰减因子
      const recentAppearances = activeData.slice(-10).filter(d => d.front.includes(i)).length;
      score += recentAppearances * 2;
      frontScores.push({ number: i, score });
    }
  
    const frontNumbers = frontScores
      .sort((a, b) => b.score - a.score)
      .slice(0, SSQ_CONFIG.FRONT_COUNT)
      .map(item => item.number);
  
    // 蓝球正态分布
    const backFreq = this.frequencyAnalyzer.analyzeBackFrequency();
    const backFreqs = Object.values(backFreq);
    const backMean = backFreqs.reduce((a, b) => a + b, 0) / backFreqs.length;
    const backVar = backFreqs.reduce((a, b) => a + (b - backMean) ** 2, 0) / backFreqs.length;
    const backStd = Math.sqrt(backVar);
  
    const backScores = []; 
    for (let i = 1; i <= SSQ_CONFIG.BACK_RANGE; i++) {
      const freq = backFreq[i] || 0;
      const zScore = (freq - backMean) / (backStd || 1);
      let score;
      if (zScore >= -1 && zScore <= 1) {
        score = 20;
      } else if (zScore < -1) {
        score = 18;
      } else {
        score = 8;
      }
      backScores.push({ number: i, score });
    }
  
    const backNumbers = backScores
      .sort((a, b) => b.score - a.score)
      .slice(0, SSQ_CONFIG.BACK_COUNT)
      .map(item => item.number);
  
    return [...frontNumbers.sort((a, b) => a - b), ...backNumbers];
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
   * 混合模型预测（综合多种策略）
   */
  hybridPredict() {
    const frontFreq = this.frequencyAnalyzer.analyzeFrontFrequency();
    const backFreq = this.frequencyAnalyzer.analyzeBackFrequency();
    const frontOmission = this.omissionAnalyzer.calculateFrontOmission();
    const backOmission = this.omissionAnalyzer.calculateBackOmission();
    const { frontWeights } = this.timeDecayAnalyzer.calculateDecayWeights();

    const totalFrontFreq = Object.values(frontFreq).reduce((a, b) => a + b, 0);
    const expectedFreqPerNum = totalFrontFreq / SSQ_CONFIG.FRONT_RANGE;

    // 综合评分
    const frontScores = [];
    for (let i = 1; i <= SSQ_CONFIG.FRONT_RANGE; i++) {
      const freqScore = ((frontFreq[i] || 0) / expectedFreqPerNum) * 30; // 频率30分
      const omissionScore = frontOmission[i] > 8 ? 20 : 10; // 遗漏20分
      const decayScore = frontWeights[i] * 20; // 时间衰减20分
      const totalScore = freqScore + omissionScore + decayScore;

      frontScores.push({ number: i, score: totalScore });
    }

    const frontNumbers = frontScores
      .sort((a, b) => b.score - a.score)
      .slice(0, SSQ_CONFIG.FRONT_COUNT)
      .map(item => item.number);

    const backNumbers = Object.entries(backFreq)
      .map(([num, freq]) => ({ number: parseInt(num), freq }))
      .sort((a, b) => b.freq - a.freq)
      .slice(0, SSQ_CONFIG.BACK_COUNT)
      .map(item => item.number);

    return [...frontNumbers.sort((a, b) => a - b), ...backNumbers];
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
    const predictions = [];

    for (const model of selectedModels) {
      for (let i = 0; i < groupsPerModel; i++) {
        try {
          const prediction = this.generatePrediction(model);
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
