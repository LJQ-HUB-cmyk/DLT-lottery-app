// 查看10号各维度得分
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fs = require('fs');

const { default: LotteryAnalyzer } = await import('../src/utils/LotteryAnalyzer.js');

const dataStr = fs.readFileSync(join(__dirname, '../src/data/lottery-history.txt'), 'utf-8');

// 直接查看10号的数据
const analyzer = new LotteryAnalyzer();
analyzer.loadHistoryData(dataStr);

const omissionData = analyzer.omissionCalculator.calculateOmission();
const [, backFreqCount] = analyzer.frequencyAnalyzer.analyzeFrequency();
const condProb = analyzer.calculateConditionalProbability();

console.log('\n210期后区（上期）:', analyzer.historyData[analyzer.historyData.length-2].back);
console.log('211期后区（最新）:', analyzer.historyData[analyzer.historyData.length-1].back);

const totalPeriods = analyzer.historyData.length;

console.log('\n10号关键数据：');
const omit10 = omissionData.back[10] || {};
const freq10 = backFreqCount[10] || 0;
const freq10Prob = freq10 / totalPeriods;  // 转为概率
const cond10 = condProb.back[10] || 0;
const avgOmission = analyzer.omissionCalculator.getAverageOmission('back');

console.log(`  遗漏: ${omit10.current || 0} (均值${avgOmission.toFixed(1)})`);
console.log(`  频率: ${freq10}次/${totalPeriods}期 = ${(freq10Prob*100).toFixed(2)}%`);
console.log(`  条件概率: ${cond10.toFixed(4)}`);
console.log(`  频率偏差: ${((freq10Prob - 1/12) / (1/12) * 100).toFixed(1)}%`);

// 打印前3名做对比
console.log('\nTop3号码对比（按条件概率排序）：');
const allScores = [];
for (let i = 1; i <= 12; i++) {
  const omit = omissionData.back[i] || {};
  const freq = backFreqCount[i] || 0;
  const freqProb = freq / totalPeriods;
  const cond = condProb.back[i] || 0;
  allScores.push({ num: i, omit: omit.current || 0, freq: freqProb, cond });
}

allScores.sort((a,b) => b.cond - a.cond).slice(0, 3).forEach(s => {
  console.log(`  ${String(s.num).padStart(2,'0')}: 条件概率=${s.cond.toFixed(4)}, 遗漏=${s.omit}, 频率=${(s.freq*100).toFixed(2)}%`);
});
