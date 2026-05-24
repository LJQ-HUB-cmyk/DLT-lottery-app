"""
大乐透开奖号码自动爬取脚本 v3
直接从网页爬取，不使用API接口
数据源: 牛彩网 (m.cz89.com)
"""

import requests
from bs4 import BeautifulSoup
import os
from datetime import datetime
import re


class LotteryCrawlerV3:
    """增强版大乐透爬虫 - 纯网页爬取"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
        })
        
        # 数据源配置
        self.source_url = 'https://m.cz89.com/kaijiang/dlt'
    
    def fetch_latest_result(self):
        """从牛彩网获取最新一期开奖结果"""
        try:
            print(f"🔍 正在访问: {self.source_url}")
            
            response = self.session.get(self.source_url, timeout=15)
            response.encoding = 'utf-8'
            
            if response.status_code != 200:
                print(f"❌ 请求失败，状态码: {response.status_code}")
                return None
            
            print(f"✅ 页面获取成功，大小: {len(response.text)} bytes")
            
            return self.parse_cz89_page(response.text)
            
        except Exception as e:
            print(f"❌ 爬取失败: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def parse_cz89_page(self, html):
        """解析牛彩网页面"""
        try:
            soup = BeautifulSoup(html, 'html.parser')
            
            # 方法1: 查找包含开奖号码的特定元素
            # 牛彩网的页面结构通常会有特定的class或id
            
            # 尝试查找期号
            period = None
            period_patterns = [
                r'(\d{5})期',
                r'第\s*(\d{5})\s*期',
                r'20\d{6}',
            ]
            
            for pattern in period_patterns:
                match = re.search(pattern, soup.get_text())
                if match:
                    period = match.group(1)
                    break
            
            if not period:
                print("⚠️ 未找到期号")
                return None
            
            print(f"📅 检测到期号: {period}")
            
            # 尝试查找开奖号码
            # 牛彩网通常会以 "XX XX XX XX XX XX XX" 的格式显示
            
            numbers = None
            
            # 方法1: 查找包含7个两位数字的模式
            text_content = soup.get_text()
            
            # 匹配类似 "02 06 14 22 24 08 11" 的格式（前5后2）
            pattern = r'(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})'
            matches = re.findall(pattern, text_content)
            
            if matches:
                # 取第一个匹配（通常是最新的）
                first_match = matches[0]
                front_nums = [int(x) for x in first_match[:5]]
                back_nums = [int(x) for x in first_match[5:]]
                
                # 验证号码范围
                if all(1 <= n <= 35 for n in front_nums) and all(1 <= n <= 12 for n in back_nums):
                    numbers = {
                        'front': front_nums,
                        'back': back_nums
                    }
                    print(f"✅ 找到号码: {' '.join([str(n).zfill(2) for n in front_nums])} + {' '.join([str(n).zfill(2) for n in back_nums])}")
            
            # 如果方法1失败，尝试查找特定的HTML元素
            if not numbers:
                numbers = self.extract_from_html_elements(soup)
            
            if not numbers:
                print("❌ 未能提取到开奖号码")
                return None
            
            result = {
                'period': period,
                'front': numbers['front'],
                'back': numbers['back'],
                'full': numbers['front'] + numbers['back'],
                'date': datetime.now().strftime('%Y-%m-%d'),
                'source': '牛彩网 (m.cz89.com)'
            }
            
            return result
            
        except Exception as e:
            print(f"❌ 解析页面失败: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def extract_from_html_elements(self, soup):
        """从HTML元素中提取号码（备用方法）"""
        try:
            # 查找可能包含号码的元素
            # 常见的class名称
            possible_classes = [
                'kjnum', 'result', 'numbers', 'balls',
                'code', 'draw', 'lottery-num'
            ]
            
            for class_name in possible_classes:
                elements = soup.find_all(class_=re.compile(class_name, re.I))
                
                for elem in elements:
                    text = elem.get_text()
                    # 查找数字
                    nums = re.findall(r'\d{2}', text)
                    
                    if len(nums) >= 7:
                        front = [int(x) for x in nums[:5]]
                        back = [int(x) for x in nums[5:7]]
                        
                        # 验证
                        if all(1 <= n <= 35 for n in front) and all(1 <= n <= 12 for n in back):
                            return {
                                'front': front,
                                'back': back
                            }
            
            return None
            
        except Exception as e:
            print(f"HTML元素提取失败: {e}")
            return None
    
    def format_result(self, result):
        """格式化结果为历史文件格式"""
        if not result or 'front' not in result or 'back' not in result:
            return None
        
        front_str = ' '.join([str(n).zfill(2) for n in result['front']])
        back_str = ' '.join([str(n).zfill(2) for n in result['back']])
        
        return f"{front_str} {back_str}"
    
    def check_and_update(self, history_file, new_line):
        """检查并更新历史文件"""
        if not new_line:
            return False, "数据为空"
        
        # 确保目录存在
        os.makedirs(os.path.dirname(history_file), exist_ok=True)
        
        # 检查文件是否存在
        if not os.path.exists(history_file):
            print(f"📝 创建新文件: {history_file}")
            with open(history_file, 'w', encoding='utf-8') as f:
                f.write(new_line)
            return True, "新建文件"
        
        # 读取现有内容
        with open(history_file, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = [line.strip() for line in content.strip().split('\n') if line.strip()]
        
        # 检查是否已存在
        if new_line in lines:
            return False, "数据已存在"
        
        # 显示最后一行（最新数据）
        if lines:
            print(f"📊 当前最新数据: {lines[-1]}")
        
        # 追加新数据
        with open(history_file, 'a', encoding='utf-8') as f:
            f.write('\n' + new_line)
        
        return True, "数据已更新"
    
    def run(self, history_file='./lottery-app/src/data/lottery-history.txt'):
        """执行爬取任务"""
        print("=" * 70)
        print("🎯 大乐透开奖号码自动爬取 v3")
        print(f"📅 执行时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"🌐 数据源: 牛彩网 (m.cz89.com)")
        print("=" * 70)
        
        # 获取最新开奖结果
        result = self.fetch_latest_result()
        
        if not result:
            print("\n❌ 爬取失败")
            return False
        
        # 显示结果
        print(f"\n✅ 成功获取第 {result['period']} 期数据:")
        print(f"   前区: {' '.join([str(n).zfill(2) for n in result['front']])}")
        print(f"   后区: {' '.join([str(n).zfill(2) for n in result['back']])}")
        print(f"   来源: {result['source']}")
        
        # 格式化
        formatted = self.format_result(result)
        print(f"\n📝 格式化数据: {formatted}")
        
        # 更新文件
        success, message = self.check_and_update(history_file, formatted)
        
        print(f"\n{'=' * 70}")
        if success:
            print(f"✨ {message}")
            print(f"📊 新增数据: {formatted}")
            
            # 显示统计
            with open(history_file, 'r', encoding='utf-8') as f:
                total_lines = len([l for l in f.readlines() if l.strip()])
            print(f"📈 历史数据总数: {total_lines} 期")
        else:
            print(f"ℹ️ {message}")
        print(f"{'=' * 70}\n")
        
        return success


def main():
    """主函数"""
    crawler = LotteryCrawlerV3()
    
    # 设置历史文件路径
    history_file = './lottery-app/src/data/lottery-history.txt'
    
    # 执行爬取
    crawler.run(history_file)


if __name__ == '__main__':
    main()
