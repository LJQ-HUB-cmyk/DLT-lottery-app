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
  // 由于外部 API 不稳定，这里使用手动维护的方式
  // GitHub Actions 可以在开奖后手动触发更新
  
  console.log('\n提示：由于外部 API 不稳定，当前采用手动维护方式');
  console.log('请在以下网站查看最新开奖号码：');
  console.log('  - 中国体彩网：https://www.lottery.gov.cn/kj/kjlb.html?dlt');
  console.log('  - 网易彩票：https://sports.163.com/caipiao/lottery/dlt');
  console.log('\n然后手动编辑 lottery-app/src/data/lottery-history.txt 文件');
  console.log('在文件第一行添加最新一期数据，格式：01 12 15 19 26 04 16');
  
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
