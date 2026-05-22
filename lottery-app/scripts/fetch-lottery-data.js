/**
 * 从中国体彩网抓取最新大乐透开奖数据
 * 使用 Node.js fetch + HTML 解析（无需额外依赖）
 * 
 * 注意：由于体彩网使用 JavaScript 动态加载数据，
 * 此脚本尝试直接访问其 API 接口
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 尝试多个 API 源获取数据
 */
async function fetchFromMultipleSources() {
  const sources = [
    {
      name: 'api100.duapp.com',
      url: 'http://api100.duapp.com/lottery/?type=' + encodeURIComponent('大乐透'),
      method: 'GET'
    },
    {
      name: 'api.xinti.com',
      url: 'https://api.xinti.com/chart/queryPrizeHistoryByGameCode',
      method: 'POST',
      body: {
        ClientSource: 3,
        Param: { GameCode: 'DLT', IssuseCount: 1 },
        Date: Date.now(),
        Token: '',
        Sign: '4edaf737113b3411911c5b7a2ccd8640'
      }
    }
  ];
  
  for (const source of sources) {
    try {
      console.log(`\n[${source.name}] 正在尝试...`);
      
      let response;
      if (source.method === 'POST') {
        response = await fetch(source.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          body: JSON.stringify(source.body)
        });
      } else {
        response = await fetch(source.url);
      }
      
      if (!response.ok) {
        console.log(`  ❌ HTTP ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      
      // 解析 api100.duapp.com
      if (source.name === 'api100.duapp.com' && data && data[1] && data[1].Title) {
        const titleStr = data[1].Title;
        const lines = titleStr.split('\n');
        
        let expect = '', date = '', numbers = '';
        
        for (const line of lines) {
          if (line.includes('第') && line.includes('期')) {
            const match = line.match(/第(\d+)期/);
            if (match) expect = match[1];
          } else if (line.includes('开奖时间')) {
            date = line.replace('开奖时间：', '').trim();
          } else if (line.includes('开奖号码')) {
            numbers = line.replace('开奖号码：', '').trim().replace(/-/g, ' ').replace('+', ' ');
          }
        }
        
        if (expect && numbers) {
          console.log('  ✅ 成功获取');
          console.log('  期号:', expect);
          console.log('  号码:', numbers);
          console.log('  日期:', date);
          return { expect, numbers, date };
        }
      }
      
      // 解析 api.xinti.com
      if (source.name === 'api.xinti.com' && data.Value && data.Value.GameHistoryInfo) {
        const latest = data.Value.GameHistoryInfo[0];
        const numbers = latest.WinNumber.replace(/-/g, ' ');
        
        console.log('  ✅ 成功获取');
        console.log('  期号:', latest.IssuseNumber);
        console.log('  号码:', numbers);
        console.log('  日期:', latest.PrizeTime);
        
        return {
          expect: latest.IssuseNumber,
          numbers,
          date: latest.PrizeTime
        };
      }
      
      console.log(`  ❌ 数据格式不匹配`);
      
    } catch (error) {
      console.log(`  ❌ 请求失败:`, error.message);
    }
  }
  
  return null;
}

/**
 * 读取现有数据文件
 */
function readExistingData(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log('数据文件不存在，将创建新文件');
    return [];
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  console.log(`\n当前数据文件包含 ${lines.length} 条记录`);
  return lines;
}

/**
 * 检查是否已存在该期数据
 */
function isDuplicate(lines, numbers) {
  return lines.some(line => {
    const trimmed = line.trim();
    const targetNumbers = numbers.replace(/\s+/g, ' ').trim();
    return trimmed === targetNumbers;
  });
}

/**
 * 更新数据文件
 */
function updateDataFile(filePath, lines, newLine) {
  // 添加到开头
  lines.unshift(newLine);
  
  // 保持最多 100 条记录
  if (lines.length > 100) {
    lines.length = 100;
    console.log('  📝 已超过 100 条，移除最旧的记录');
  }
  
  // 写入文件
  const content = lines.join('\n');
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`  ✅ 数据文件已更新，当前共 ${lines.length} 条记录`);
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================');
  console.log('  大乐透开奖数据自动获取脚本');
  console.log('========================================');
  
  const dataFilePath = path.join(__dirname, '..', 'src', 'data', 'lottery-history.txt');
  
  // 确保目录存在
  const dataDir = path.dirname(dataFilePath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`\n创建数据目录: ${dataDir}`);
  }
  
  // 读取现有数据
  const existingLines = readExistingData(dataFilePath);
  
  // 获取最新开奖数据
  console.log('\n开始获取最新开奖数据...');
  const latestData = await fetchFromMultipleSources();
  
  if (!latestData) {
    console.log('\n⚠️  所有 API 都不可用');
    console.log('\n💡 建议操作：');
    console.log('1. 访问 https://www.lottery.gov.cn/kj/kjlb.html?dlt');
    console.log('2. 复制最新一期号码（格式：01 12 15 19 26 04 16）');
    console.log('3. 编辑 lottery-app/src/data/lottery-history.txt');
    console.log('4. 在第一行粘贴新号码\n');
    process.exit(1);
  }
  
  // 检查是否已存在
  if (isDuplicate(existingLines, latestData.numbers)) {
    console.log('\nℹ️  最新一期数据已存在，无需更新');
    process.exit(0);
  }
  
  // 更新数据文件
  console.log('\n开始更新数据文件...');
  updateDataFile(dataFilePath, existingLines, latestData.numbers);
  
  console.log('\n========================================');
  console.log('  ✅ 数据更新完成！');
  console.log('========================================\n');
  
  // 输出用于 Git commit 的信息
  console.log('Git Commit Message:');
  console.log(`auto: 添加第 ${latestData.expect} 期开奖数据 (${latestData.numbers})`);
}

// 运行主函数
main().catch(error => {
  console.error('\n❌ 发生错误:', error.message);
  console.error(error.stack);
  process.exit(1);
});
