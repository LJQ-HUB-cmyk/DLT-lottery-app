const fs = require('fs');
const data = fs.readFileSync('src/data/lottery-history.txt', 'utf8').trim().split('\n');
const draws = data.map(line => line.trim().split(/\s+/).map(Number));

// 后区频率统计
const backFreq = {};
for (let i = 1; i <= 12; i++) backFreq[i] = 0;
draws.forEach(d => { backFreq[d[5]]++; backFreq[d[6]]++; });

console.log('=== 后区号码频率 (210期, 总420次出现) ===');
const avg = 420/12;
for (let i = 1; i <= 12; i++) {
  const pct = (backFreq[i]/420*100).toFixed(1);
  const deviation = ((backFreq[i]/avg - 1)*100).toFixed(0);
  console.log('  ' + i.toString().padStart(2) + ': ' + backFreq[i] + '次 (占比' + pct + '%, 偏离' + (deviation > 0 ? '+' : '') + deviation + '%)');
}

// 最近30期趋势
const recent30 = draws.slice(-30);
const recentBackFreq = {};
for (let i = 1; i <= 12; i++) recentBackFreq[i] = 0;
recent30.forEach(d => { recentBackFreq[d[5]]++; recentBackFreq[d[6]]++; });
console.log('\n=== 最近30期后区频率 (60次出现) ===');
for (let i = 1; i <= 12; i++) {
  const momentum = (recentBackFreq[i]/30) - (backFreq[i]/210);
  console.log('  ' + i.toString().padStart(2) + ': ' + recentBackFreq[i] + '次 (动量: ' + (momentum > 0 ? '+' : '') + momentum.toFixed(3) + ')');
}

// 重号率统计
let repeatCount = 0;
for (let i = 1; i < draws.length; i++) {
  const prevBack = [draws[i-1][5], draws[i-1][6]];
  const currBack = [draws[i][5], draws[i][6]];
  if (currBack.some(n => prevBack.includes(n))) repeatCount++;
}
const randomRepeatRate = (1 - (10*9)/(12*11)) * 100;
console.log('\n=== 重号率 ===');
console.log('  含重号的期数: ' + repeatCount + '/' + (draws.length-1) + ' = ' + (repeatCount/(draws.length-1)*100).toFixed(1) + '%');
console.log('  随机期望: ' + randomRepeatRate.toFixed(1) + '%');

// 条件概率转移矩阵
console.log('\n=== 后区条件概率转移 (Top15最强) ===');
const transitions = [];
for (let t = 1; t <= 12; t++) {
  for (let f = 1; f <= 12; f++) {
    let triggerCount = 0, followCount = 0;
    for (let i = 1; i < draws.length; i++) {
      const prevBack = [draws[i-1][5], draws[i-1][6]];
      const currBack = [draws[i][5], draws[i][6]];
      if (prevBack.includes(t)) { triggerCount++; if (currBack.includes(f)) followCount++; }
    }
    if (triggerCount > 10) {
      const prob = followCount / triggerCount;
      transitions.push({ trigger: t, follow: f, prob, count: followCount, total: triggerCount });
    }
  }
}
transitions.sort((a,b) => b.prob - a.prob);
transitions.slice(0, 15).forEach(c => {
  const mark = c.prob > 0.167 ? ' ★' : '';
  console.log('  上期' + c.trigger + ' → 下期' + c.follow + ': ' + (c.prob*100).toFixed(1) + '% (' + c.count + '/' + c.total + ')' + mark);
});

// 基于最新后区的预测
const lastBack = [draws[draws.length-1][5], draws[draws.length-1][6]];
console.log('\n=== 最新一期后区: ' + lastBack.join(' ') + ' ===');
console.log('\n=== 基于最新后区的条件概率预测 ===');
const predictions = [];
for (let follow = 1; follow <= 12; follow++) {
  let hitCount02 = 0, total02 = 0;
  let hitCount12 = 0, total12 = 0;
  for (let i = 1; i < draws.length; i++) {
    const prevBack = [draws[i-1][5], draws[i-1][6]];
    const currBack = [draws[i][5], draws[i][6]];
    if (prevBack.includes(2)) { total02++; if (currBack.includes(follow)) hitCount02++; }
    if (prevBack.includes(12)) { total12++; if (currBack.includes(follow)) hitCount12++; }
  }
  const prob02 = total02 > 0 ? hitCount02/total02 : 0;
  const prob12 = total12 > 0 ? hitCount12/total12 : 0;
  const avgProb = (prob02 + prob12) / 2;
  predictions.push({ follow, prob02, prob12, avgProb });
}
predictions.sort((a,b) => b.avgProb - a.avgProb);
predictions.forEach(p => {
  const mark = p.avgProb > 0.167 ? ' ★' : '';
  console.log('  ' + p.follow.toString().padStart(2) + ': 综合' + (p.avgProb*100).toFixed(1) + '% (02→' + (p.prob02*100).toFixed(1) + '%, 12→' + (p.prob12*100).toFixed(1) + '%)' + mark);
});

// 遗漏统计
const lastDrawIdx = draws.length - 1;
console.log('\n=== 当前遗漏值 ===');
const omissions = [];
for (let i = 1; i <= 12; i++) {
  let omission = 0;
  for (let j = lastDrawIdx; j >= 0; j--) {
    if ([draws[j][5], draws[j][6]].includes(i)) break;
    omission++;
  }
  const avgOmission = 210 / (backFreq[i] || 1);
  omissions.push({ num: i, omission, avgOmission, deviation: omission - avgOmission });
}
omissions.sort((a,b) => b.deviation - a.deviation);
omissions.forEach(o => {
  const mark = o.deviation > 0 ? ' ★待回归' : '';
  console.log('  ' + o.num.toString().padStart(2) + ': 遗漏' + o.omission + '期 (平均' + o.avgOmission.toFixed(1) + ', 偏离' + (o.deviation > 0 ? '+' : '') + o.deviation.toFixed(1) + ')' + mark);
});