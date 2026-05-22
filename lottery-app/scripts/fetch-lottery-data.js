/**
 * 大乐透开奖数据自动获取脚本
 * 用于 GitHub Actions 定时抓取最新开奖数据
 * 
 * @node-env
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 从 API 获取最新开奖数据
 */
async function fetchFromAPI() {
  // 方案 1：api100.duapp.com (主选)
  try {
    console.log('\n[方案1] 正在从 api100.duapp.com 获取数据...');
    
    const apiUrl = 'http://api100.duapp.com/lottery/?type=' + encodeURIComponent('大乐透');
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data || !data[1] || !data[1].Title) {
      throw new Error('数据格式错误');
    }
    
    const titleStr = data[1].Title;
    console.log('  原始数据:', titleStr);
    
    // 解析数据
    const lines = titleStr.split('\n');
    
    let expect = '';
    let date = '';
    let numbers = '';
    
    for (const line of lines) {
      if (line.includes('第') && line.includes('期')) {
        const match = line.match(/第(\d+)期/);
        if (match) expect = match[1];
      } else if (line.includes('开奖时间')) {
        date = line.replace('开奖时间：', '').trim();
      } else if (line.includes('开奖号码')) {
        numbers = line.replace('开奖号码：', '').trim();
        numbers = numbers.replace(/-/g, ' ').replace('+', ' ');
      }
    }
    
    if (!expect || !numbers) {
      throw new Error('解析失败');
    }
    
    console.log('  ✅ 成功获取数据');
    console.log('  期号:', expect);
    console.log('  号码:', numbers);
    console.log('  日期:', date);
    
    return { expect, numbers, date };
    
  } catch (error) {
    console.log('  ❌ 方案1 失败:', error.message);
  }
  
  // 方案 2：api.xinti.com (备用)
  try {
    console.log('\n[方案2] 正在从 api.xinti.com 获取数据...');
    
    const url = 'https://api.xinti.com/chart/queryPrizeHistoryByGameCode';
    const params = {
      ClientSource: 3,
      Param: { GameCode: 'DLT', IssuseCount: 1 },
      Date: Date.now(),
      Token: '',
      Sign: '4edaf737113b3411911c5b7a2ccd8640'
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.Value || !data.Value.GameHistoryInfo || data.Value.GameHistoryInfo.length === 0) {
      throw new Error('数据格式错误或无数据');
    }
    
    const latest = data.Value.GameHistoryInfo[0];
    const numbers = latest.WinNumber.replace(/-/g, ' ');
    
    console.log('  ✅ 成功获取数据');
    console.log('  期号:', latest.IssuseNumber);
    console.log('  号码:', numbers);
    console.log('  日期:', latest.PrizeTime);
    
    return {
      expect: latest.IssuseNumber,
      numbers,
      date: latest.PrizeTime
    };
    
  } catch (error) {
    console.log('  ❌ 方案2 失败:', error.message);
  }
  
  // 两个方案都失败
  console.log('\n⚠️  所有 API 都不可用，请手动维护数据');
  console.log('请访问：https://www.lottery.gov.cn/kj/kjlb.html?dlt');
  console.log('然后编辑 lottery-app/src/data/lottery-history.txt 文件\n');
  
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
  
  // 修复路径：数据文件应该在 lottery-app/src/data/ 下
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
  const latestData = await fetchFromAPI();
  
  if (!latestData) {
    console.log('\n❌ 所有数据源都获取失败，请检查网络连接或稍后重试');
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
