/**
 * 从中国体彩网抓取最新大乐透开奖数据
 * 使用 Puppeteer 模拟浏览器访问并解析 HTML
 */

import puppeteer from 'puppeteer';
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
  
  let browser;
  
  try {
    // 启动浏览器（无头模式）
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // 设置 User-Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // 访问页面
    await page.goto('https://www.lottery.gov.cn/kj/kjlb.html?dlt', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    console.log('  ✅ 页面加载成功');
    
    // 等待数据加载
    await page.waitForSelector('.kj_tablelist02 tbody tr', { timeout: 10000 });
    
    // 提取最新一期数据（第一行）
    const lotteryData = await page.evaluate(() => {
      // 查找表格中的第一行数据
      const firstRow = document.querySelector('.kj_tablelist02 tbody tr');
      
      if (!firstRow) {
        return null;
      }
      
      const cells = firstRow.querySelectorAll('td');
      
      if (cells.length < 4) {
        return null;
      }
      
      // 提取期号
      const expectCell = cells[0];
      const expectText = expectCell ? expectCell.textContent.trim() : '';
      const expectMatch = expectText.match(/(\d+)/);
      const expect = expectMatch ? expectMatch[1] : '';
      
      // 提取开奖日期
      const dateCell = cells[1];
      const date = dateCell ? dateCell.textContent.trim() : '';
      
      // 提取开奖号码
      const numberCell = cells[2];
      if (!numberCell) return null;
      
      // 号码格式可能是 "01 12 15 19 26 + 04 16" 或类似格式
      const numberText = numberCell.textContent.trim();
      
      // 提取所有数字
      const numbers = numberText.match(/\d+/g);
      
      if (!numbers || numbers.length < 7) {
        return null;
      }
      
      // 取前7个数字（5个前区 + 2个后区）
      const frontNums = numbers.slice(0, 5).map(n => n.padStart(2, '0'));
      const backNums = numbers.slice(5, 7).map(n => n.padStart(2, '0'));
      const numbersStr = [...frontNums, ...backNums].join(' ');
      
      return {
        expect,
        date,
        numbers: numbersStr
      };
    });
    
    if (!lotteryData) {
      throw new Error('无法解析页面数据');
    }
    
    console.log('  ✅ 成功抓取数据');
    console.log('  期号:', lotteryData.expect);
    console.log('  号码:', lotteryData.numbers);
    console.log('  日期:', lotteryData.date);
    
    return lotteryData;
    
  } catch (error) {
    console.log('  ❌ 抓取失败:', error.message);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
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
  console.log('  大乐透开奖数据自动获取脚本（Puppeteer版）');
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
