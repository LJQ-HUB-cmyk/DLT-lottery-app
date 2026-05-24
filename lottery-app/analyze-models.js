/**
 * 模型准确率分析脚本
 * 比较各模型预测结果与最新开奖号码的接近程度
 */

import LotteryAnalyzer from './src/utils/lotteryLogic.js';

// 最新开奖号码
const latestDraw = {
  front: [6, 7, 18, 21, 30],
  back: [1, 5]
};

console.log('========================================');
console.log('   模型准确率分析报告');
console.log('========================================');
console.log('\n最新开奖号码:');
console.log(`  前区: ${latestDraw.front.join(' ')}`);
console.log(`  后区: ${latestDraw.back.join(' ')}`);
console.log('\n');

// 初始化分析器
const analyzer = new LotteryAnalyzer();

// 加载历史数据（从第二行开始，排除最新一期）
const historyData = `04 08 15 20 31 07 08
02 09 11 15 16 02 04
05 18 23 25 32 05 09
02 04 16 23 35 06 11
05 12 18 23 35 06 12
01 03 13 20 26 03 10
03 06 17 21 33 05 11
05 12 13 14 33 05 08
02 03 13 18 26 02 09
14 21 23 29 33 02 10
01 02 09 22 25 01 06
03 05 06 23 26 01 04
16 18 23 34 35 01 06
01 04 10 13 17 03 11
08 09 12 19 24 01 06
04 05 10 23 31 07 12
09 11 19 30 35 01 12
12 13 14 16 31 04 12
01 10 21 23 29 10 12
05 08 12 14 17 04 05
05 09 10 18 26 05 06
09 25 26 27 28 01 08
02 04 08 10 21 09 12
03 15 24 28 29 03 07
10 11 22 26 32 01 08
09 10 11 12 16 01 11`;

const loadedCount = analyzer.loadHistoryData(historyData, '测试数据');
console.log(`已加载 ${loadedCount} 条历史数据\n`);

// 计算命中率的函数
function calculateAccuracy(predicted, actual) {
  const predictedFront = new Set(predicted.front);
  const predictedBack = new Set(predicted.back);
  const actualFront = new Set(actual.front);
  const actualBack = new Set(actual.back);
  
  // 前区命中数
  let frontHits = 0;
  predictedFront.forEach(num => {
    if (actualFront.has(num)) frontHits++;
  });
  
  // 后区命中数
  let backHits = 0;
  predictedBack.forEach(num => {
    if (actualBack.has(num)) backHits++;
  });
  
  return {
    frontHits,
    backHits,
    totalHits: frontHits + backHits,
    frontAccuracy: (frontHits / 5 * 100).toFixed(1),
    backAccuracy: (backHits / 2 * 100).toFixed(1)
  };
}

// 测试各个模型
const models = [
  { name: '周易时空', method: 'generateZhouyiPrediction' },
  { name: '贝叶斯动态', method: 'generateBayesianPrediction' },
  { name: '旋转矩阵', method: 'generateRotationMatrixPrediction' },
  { name: '混合模型', method: 'generateHybridPrediction' } // 新增混合模型
];

console.log('========================================');
console.log('   开始测试各模型...');
console.log('========================================\n');

models.forEach(model => {
  console.log(`\n【${model.name}】`);
  console.log('-'.repeat(40));
  
  try {
    // 生成预测（生成多组取平均）
    const predictions = [];
    const groupCount = model.name === '旋转矩阵' ? 1 : 3;
    
    for (let i = 0; i < groupCount; i++) {
      let prediction;
      if (model.name === '旋转矩阵') {
        // 旋转矩阵一次性生成5组
        const results = analyzer[model.method](5);
        results.forEach((p, idx) => {
          predictions.push(p);
          const accuracy = calculateAccuracy(p, latestDraw);
          console.log(`  第${idx + 1}组: 前区[${p.front.join(' ')}] 后区[${p.back.join(' ')}]`);
          console.log(`         → 前区命中: ${accuracy.frontHits}/5 (${accuracy.frontAccuracy}%) | 后区命中: ${accuracy.backHits}/2 (${accuracy.backAccuracy}%) | 总命中: ${accuracy.totalHits}/7`);
        });
      } else {
        const result = analyzer[model.method]();
        // 将数组格式转换为对象格式
        prediction = {
          front: result.slice(0, 5),
          back: result.slice(5)
        };
        predictions.push(prediction);
        
        const accuracy = calculateAccuracy(prediction, latestDraw);
        console.log(`  第${i + 1}组: 前区[${prediction.front.join(' ')}] 后区[${prediction.back.join(' ')}]`);
        console.log(`         → 前区命中: ${accuracy.frontHits}/5 (${accuracy.frontAccuracy}%) | 后区命中: ${accuracy.backHits}/2 (${accuracy.backAccuracy}%) | 总命中: ${accuracy.totalHits}/7`);
      }
    }
    
    // 计算平均命中率
    const avgFrontHits = predictions.reduce((sum, p) => {
      const acc = calculateAccuracy(p, latestDraw);
      return sum + acc.frontHits;
    }, 0) / predictions.length;
    
    const avgBackHits = predictions.reduce((sum, p) => {
      const acc = calculateAccuracy(p, latestDraw);
      return sum + acc.backHits;
    }, 0) / predictions.length;
    
    const avgTotalHits = avgFrontHits + avgBackHits;
    
    console.log(`\n  平均表现:`);
    console.log(`    前区平均命中: ${avgFrontHits.toFixed(2)}/5`);
    console.log(`    后区平均命中: ${avgBackHits.toFixed(2)}/2`);
    console.log(`    总平均命中: ${avgTotalHits.toFixed(2)}/7`);
    
  } catch (error) {
    console.error(`  错误: ${error.message}`);
    console.error(error.stack);
  }
});

console.log('\n========================================');
console.log('   分析完成！');
console.log('========================================');
