"""
大乐透开奖号码自动爬取脚本 v3
直接从网页爬取，不使用API接口
数据源: 牛彩网 (m.cz89.com)
"""

import requests
from bs4 import BeautifulSoup
import json
import os
from datetime import datetime
import time
import re


class LotteryCrawlerV2:
    """增强版大乐透爬虫"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, text/plain, */*',
        })
    
    def fetch_from_api_1(self):
        """
        数据源1: 使用公开API（如果可用）
        这里使用一个示例API，实际使用时需要替换为真实可用的API
        """
        try:
            # 示例：某些第三方API提供彩票数据
            # 注意：这里需要根据实际情况调整
            urls_to_try = [
                'https://api.leshuzi.com/api/v1/lottery/dlt/latest',
                'https://www.cwl.gov.cn/cwl_admin/kjxx/findDrawNotice?name=dlt&issueCount=1',
            ]
            
            for url in urls_to_try:
                try:
                    response = self.session.get(url, timeout=10)
                    if response.status_code == 200:
                        data = response.json()
                        # 根据实际API返回格式解析
                        return self.parse_api_response(data)
                except:
                    continue
            
            return None
        except Exception as e:
            print(f"API数据源1失败: {e}")
            return None
    
    def parse_api_response(self, data):
        """解析API响应（需要根据实际API调整）"""
        try:
            # 这是一个示例解析逻辑，需要根据实际API调整
            if isinstance(data, dict):
                # 假设返回格式
                if 'data' in data:
                    result_data = data['data']
                    if isinstance(result_data, list) and len(result_data) > 0:
                        latest = result_data[0]
                        return {
                            'period': latest.get('expect', ''),
                            'front': latest.get('opencode', '').split(',')[:5],
                            'back': latest.get('opencode', '').split(',')[5:],
                        }
            return None
        except:
            return None
    
    def fetch_from_web_scraping(self):
        """
        数据源2: 网页爬取（备用方案）
        尝试从多个网站获取数据
        """
        websites = [
            {
                'name': '500.com',
                'url': 'https://kaijiang.500.com/shtml/dlt.shtml',
                'method': 'parse_500com'
            },
            {
                'name': 'Sina',
                'url': 'https://caipiao.sina.com.cn/award/lotto/dlt.html',
                'method': 'parse_sina'
            }
        ]
        
        for site in websites:
            try:
                print(f"尝试从 {site['name']} 获取数据...")
                response = self.session.get(site['url'], timeout=15)
                
                if response.status_code == 200:
                    if site['method'] == 'parse_500com':
                        result = self.parse_500com(response.text)
                    elif site['method'] == 'parse_sina':
                        result = self.parse_sina(response.text)
                    
                    if result:
                        print(f"✅ 成功从 {site['name']} 获取数据")
                        return result
                else:
                    print(f"⚠️ {site['name']} 返回状态码: {response.status_code}")
                    
            except Exception as e:
                print(f"❌ {site['name']} 失败: {e}")
                continue
        
        return None
    
    def parse_500com(self, html):
        """解析500.com页面"""
        from bs4 import BeautifulSoup
        import re
        
        try:
            soup = BeautifulSoup(html, 'html.parser')
            
            # 查找最新期号
            period_match = re.search(r'第(\d+)期', soup.get_text())
            if not period_match:
                return None
            
            period = period_match.group(1)
            
            # 查找开奖号码 - 尝试多种选择器
            numbers = []
            
            # 方法1: 查找特定class的span或div
            ball_elements = soup.find_all(['span', 'div'], class_=re.compile(r'ball|red|blue'))
            
            for elem in ball_elements:
                text = elem.get_text().strip()
                if text.isdigit():
                    numbers.append(int(text))
            
            # 方法2: 从文本中提取数字模式
            if len(numbers) < 7:
                text_content = soup.get_text()
                # 匹配类似 "07 09 23 27 32 02 08" 的模式
                pattern = r'(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})'
                matches = re.findall(pattern, text_content)
                
                if matches:
                    # 取最后一个匹配
                    last_match = matches[-1]
                    numbers = [int(x) for x in last_match]
            
            if len(numbers) >= 7:
                return {
                    'period': period,
                    'front': numbers[:5],
                    'back': numbers[5:7]
                }
            
            return None
            
        except Exception as e:
            print(f"解析500.com失败: {e}")
            return None
    
    def parse_sina(self, html):
        """解析新浪彩票页面"""
        from bs4 import BeautifulSoup
        import re
        
        try:
            soup = BeautifulSoup(html, 'html.parser')
            
            # 新浪页面的解析逻辑（需要根据实际页面结构调整）
            # 这里是一个示例实现
            
            # 查找包含期号和号码的元素
            period_elem = soup.find('span', class_='period')
            if not period_elem:
                return None
            
            period = period_elem.get_text().strip()
            
            # 查找号码球
            balls = soup.find_all('em', class_='ball')
            numbers = []
            
            for ball in balls:
                num = ball.get_text().strip()
                if num.isdigit():
                    numbers.append(int(num))
            
            if len(numbers) >= 7:
                return {
                    'period': period,
                    'front': numbers[:5],
                    'back': numbers[5:7]
                }
            
            return None
            
        except Exception as e:
            print(f"解析新浪彩票失败: {e}")
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
        
        # 检查文件是否存在
        if not os.path.exists(history_file):
            print(f"📝 创建新文件: {history_file}")
            with open(history_file, 'w', encoding='utf-8') as f:
                f.write(new_line)
            return True, "新建文件"
        
        # 读取现有内容
        with open(history_file, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.strip().split('\n')
        
        # 检查是否已存在
        if new_line in lines:
            return False, "数据已存在"
        
        # 检查最后一行（最新数据）
        if lines and lines[-1] == new_line:
            return False, "已是最新数据"
        
        # 追加新数据
        with open(history_file, 'a', encoding='utf-8') as f:
            f.write('\n' + new_line)
        
        return True, "数据已更新"
    
    def run(self, history_file='./lottery-app/src/data/lottery-history.txt'):
        """执行爬取任务"""
        print("=" * 70)
        print("🎯 大乐透开奖号码自动爬取 v2")
        print(f"📅 执行时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 70)
        
        result = None
        
        # 尝试API方式
        print("\n[1/2] 尝试API数据源...")
        result = self.fetch_from_api_1()
        
        # 如果API失败，尝试网页爬取
        if not result:
            print("\n[2/2] 尝试网页爬取...")
            result = self.fetch_from_web_scraping()
        
        if not result:
            print("\n❌ 所有数据源均失败")
            return False
        
        # 格式化结果
        print(f"\n✅ 获取到第 {result['period']} 期数据:")
        print(f"   前区: {' '.join([str(n).zfill(2) for n in result['front']])}")
        print(f"   后区: {' '.join([str(n).zfill(2) for n in result['back']])}")
        
        formatted = self.format_result(result)
        print(f"\n📝 格式化数据: {formatted}")
        
        # 更新文件
        success, message = self.check_and_update(history_file, formatted)
        
        print(f"\n{'=' * 70}")
        if success:
            print(f"✨ {message}")
            print(f"📊 新增数据: {formatted}")
        else:
            print(f"ℹ️ {message}")
        print(f"{'=' * 70}\n")
        
        return success


def main():
    """主函数"""
    crawler = LotteryCrawlerV2()
    
    # 设置历史文件路径
    history_file = './lottery-app/src/data/lottery-history.txt'
    
    # 执行爬取
    crawler.run(history_file)


if __name__ == '__main__':
    main()
