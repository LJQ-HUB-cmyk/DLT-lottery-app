/**
 * 从中国体彩网抓取最新大乐透开奖数据
 * 使用 fetch + 正则表达式解析 HTML（无需额外依赖）
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 从中国体彩网抓取最新一期大乐透数据
 */
async function fetchFromLotteryGov() {
  console.log('\n正在从中国体彩网抓取数据...');
  console.log('URL: https://www.lottery.gov.cn/kj/kjlb.html?dlt');
  
  try {
    // 获取页面 HTML
    const response = await fetch('https://www.lottery.gov.cn/kj/kjlb.html?dlt', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    console.log('  ✅ 页面加载成功，HTML 长度:', html.length);
    
    // 方法1：查找表格中的第一行数据
    // 匹配模式：<tr>...</tr> 包含期号、日期、号码
    const tableRegex = /<tbody[^>]*>([\s\S]*?)<\/tbody>/i;
    const tableMatch = html.match(tableRegex);
    
    if (!tableMatch) {
      throw new Error('未找到数据表格');
    }
    
    const tbodyContent = tableMatch[1];
    
    // 查找第一个 <tr> 标签
    const firstRowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/i;
    const rowMatch = tbodyContent.match(firstRowRegex);
    
    if (!rowMatch) {
      throw new Error('未找到数据行');
    }
    
    const rowContent = rowMatch[1];
    
    // 提取所有 <td> 标签的内容
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells = [];
    let match;
    
    while ((match = tdRegex.exec(rowContent)) !== null) {
      // 去除 HTML 标签，只保留文本
      const text = match[1].replace(/<[^>]+>/g, '').trim();
      cells.push(text);
    }
    
    console.log('  找到', cells.length, '个单元格');
    
    if (cells.length < 3) {
      throw new Error('数据格式错误');
    }
    
    // 提取期号（第一个单元格）
    const expectText = cells[0];
    const expectMatch = expectText.match(/(\d+)/);
    const expect = expectMatch ? expectMatch[1] : '';
    
    // 提取日期（第二个单元格）
    const date = cells[1] || '';
    
    // 提取号码（第三个单元格）
    const numberText = cells[2];
    
    // 从号码文本中提取所有数字
    const numbers = numberText.match(/\d+/g);
    
    if (!numbers || numbers.length < 7) {
      console.log('  号码文本:', numberText);
      throw new Error(`号码数量不足，找到 ${numbers ? numbers.length : 0} 个`);
    }
    
    // 取前7个数字（5个前区 + 2个后区）
    const frontNums = numbers.slice(0, 5).map(n => n.padStart(2, '0'));
    const backNums = numbers.slice(5, 7).map(n => n.padStart(2, '0'));
    const numbersStr = [...frontNums, ...backNums].join(' ');
    
    console.log('  ✅ 成功解析数据');
    console.log('  期号:', expect);
    console.log('  号码:', numbersStr);
    console.log('  日期:', date);
    
    return {
      expect,
      date,
      numbers: numbersStr
    };
    
  } catch (error) {
    console.log('  ❌ 抓取失败:', error.message);
    return null;
  }
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
  console.log('  大乐透开奖数据自动获取脚本（HTML解析版）');
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
  
  // 抓取最新开奖数据
  console.log('\n开始抓取最新开奖数据...');
  const latestData = await fetchFromLotteryGov();
  
  if (!latestData) {
    console.log('\n❌ 抓取失败，请检查网络连接或稍后重试');
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
