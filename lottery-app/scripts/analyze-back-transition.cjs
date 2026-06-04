// 分析上期后区04 07条件下，各号码的条件概率
const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, '../src/data/lottery-history.txt');
const lines = fs.readFileSync(dataFile, 'utf-8').trim().split('\n').filter(l => l.trim());
// 数据文件格式：line1=最旧, line211=最新
// 不用reverse，直接使用：lines[0]=最旧, lines[210]=最新

const lastDraw = lines[lines.length - 1]; // line211=最新(211期)
const prevDraw = lines[lines.length - 2]; // line210=上期(210期)
const lastBack = lastDraw.trim().split(/\s+/).map(Number).slice(5, 7);
const prevBack = prevDraw.trim().split(/\s+/).map(Number).slice(5, 7);
console.log(`211期(最新)后区: ${lastBack.join(' ')}`);
console.log(`210期(上期)后区: ${prevBack.join(' ')}\n`);

// 统计从04和07出发转移到各号码的次数
const transitions = {};
for (let i = 1; i < lines.length; i++) {
  const prev = lines[i-1].trim().split(/\s+/).map(Number);
  const curr = lines[i].trim().split(/\s+/).map(Number);
  const prevBack = prev.slice(5, 7);
  const currBack = curr.slice(5, 7);
  
  for (const p of prevBack) {
    if (!transitions[p]) transitions[p] = {};
    for (const c of currBack) {
      transitions[p][c] = (transitions[p][c] || 0) + 1;
    }
  }
}

console.log('\n从04出发的转移:');
if (transitions[4]) {
  const total04 = Object.values(transitions[4]).reduce((a,b) => a+b, 0);
  Object.entries(transitions[4])
    .sort((a,b) => b[1] - a[1])
    .forEach(([num, count]) => {
      console.log(`  ${num}: ${count}次 (${(count/total04*100).toFixed(1)}%)`);
    });
}

console.log('\n从07出发的转移:');
if (transitions[7]) {
  const total07 = Object.values(transitions[7]).reduce((a,b) => a+b, 0);
  Object.entries(transitions[7])
    .sort((a,b) => b[1] - a[1])
    .forEach(([num, count]) => {
      console.log(`  ${num}: ${count}次 (${(count/total07*100).toFixed(1)}%)`);
    });
}

// 综合平均（简化版，不考虑时间衰减和Laplace平滑）
console.log('\n综合条件概率（简化）:');
const scores = {};
for (let y = 1; y <= 12; y++) {
  let score = 0, count = 0;
  for (const x of prevBack) {
    if (transitions[x] && transitions[x][y]) {
      const total = Object.values(transitions[x]).reduce((a,b) => a+b, 0);
      score += transitions[x][y] / total;
      count++;
    }
  }
  scores[y] = count > 0 ? score / count : 0;
}

const sorted = Object.entries(scores).sort((a,b) => b[1] - a[1]).slice(0, 5);
console.log('Top5:');
sorted.forEach(([num, prob]) => {
  console.log(`  ${num.padStart(2,'0')}: ${prob.toFixed(4)}`);
});
