"""
大乐透开奖号码自动爬取脚本
数据来源: 500.com 体彩大乐透
开奖时间: 每周一、三、六 21:30
"""

import requests
from bs4 import BeautifulSoup
import json
import os
from datetime import datetime, timedelta
import time
import re


class LotteryCrawler:
    """大乐透爬虫类"""
    
    def __init__(self):
        # 多个数据源，按优先级排序
        self.sources = [
            {
                'name': '500.com',
                'base_url': 'https://kaijiang.500.com',
                'latest_url': 'https://kaijiang.500.com/shtml/dlt.shtml',
                'period_pattern': r'/shtml/dlt/(\d+)\.shtml'
            },
            {
                'name': 'Sina Lottery',
                'base_url': 'https://caipiao.sina.com.cn',
                'latest_url': 'https://caipiao.sina.com.cn/award/lotto/dlt.html',
                'period_pattern': None  # 需要特殊处理
            }
        ]
        
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        })
    
    def get_latest_draw_info(self):
        """获取最新一期开奖信息"""
        try:
            # 访问大乐透首页获取最新期号
            url = f"{self.base_url}/shtml/dlt.shtml"
            response = self.session.get(url, timeout=10)
            response.encoding = 'utf-8'
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 查找最新期号链接
            latest_link = soup.find('a', href=re.compile(r'/shtml/dlt/\d+\.shtml'))
            
            if latest_link:
                period_url = latest_link['href']
                period_num = re.search(r'/dlt/(\d+)\.shtml', period_url)
                
                if period_num:
                    return {
                        'url': f"{self.base_url}{period_url}",
                        'period': period_num.group(1)
                    }
            
            return None
            
        except Exception as e:
            print(f"❌ 获取最新期号失败: {e}")
            return None
    
    def crawl_draw_result(self, period_url, period_num):
        """爬取指定期号的开奖结果"""
        try:
            print(f"🔍 正在爬取第 {period_num} 期...")
            
            response = self.session.get(period_url, timeout=10)
            response.encoding = 'utf-8'
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 查找开奖号码 - 根据500.com的页面结构调整选择器
            # 前区号码
            front_balls = []
            front_elements = soup.select('.ball_red') or soup.select('div.ball_box01 ul li.redBall')
            
            if not front_elements:
                # 尝试其他可能的选择器
                front_elements = soup.find_all('span', class_=re.compile(r'red|front'))
            
            for ball in front_elements[:5]:  # 只取前5个
                num = ball.get_text().strip()
                if num.isdigit():
                    front_balls.append(int(num))
            
            # 后区号码
            back_balls = []
            back_elements = soup.select('.ball_blue') or soup.select('div.ball_box01 ul li.blueBall')
            
            if not back_elements:
                back_elements = soup.find_all('span', class_=re.compile(r'blue|back'))
            
            for ball in back_elements[:2]:  # 只取前2个
                num = ball.get_text().strip()
                if num.isdigit():
                    back_balls.append(int(num))
            
            # 如果没找到，尝试从页面文本中提取
            if not front_balls or not back_balls:
                front_balls, back_balls = self.extract_numbers_from_text(response.text)
            
            if len(front_balls) == 5 and len(back_balls) == 2:
                result = {
                    'period': period_num,
                    'front': front_balls,
                    'back': back_balls,
                    'full': front_balls + back_balls,
                    'date': datetime.now().strftime('%Y-%m-%d'),
                    'source': '500.com'
                }
                print(f"✅ 成功获取: {result}")
                return result
            else:
                print(f"⚠️ 号码提取不完整: 前区{len(front_balls)}个, 后区{len(back_balls)}个")
                return None
                
        except Exception as e:
            print(f"❌ 爬取第 {period_num} 期失败: {e}")
            return None
    
    def extract_numbers_from_text(self, html_text):
        """从HTML文本中提取号码（备用方法）"""
        # 尝试用正则表达式提取类似 "07 09 23 27 32 02 08" 的格式
        pattern = r'(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})'
        matches = re.findall(pattern, html_text)
        
        if matches:
            # 取最后一个匹配（通常是最新的）
            last_match = matches[-1]
            front = [int(x) for x in last_match[:5]]
            back = [int(x) for x in last_match[5:]]
            return front, back
        
        return [], []
    
    def format_for_history_file(self, result):
        """将结果格式化为历史数据文件格式"""
        if not result:
            return None
        
        # 格式化为两位数字，空格分隔
        front_str = ' '.join([str(n).zfill(2) for n in result['front']])
        back_str = ' '.join([str(n).zfill(2) for n in result['back']])
        
        return f"{front_str} {back_str}"
    
    def check_if_new_draw(self, history_file_path):
        """检查是否有新的开奖（对比最新期号）"""
        if not os.path.exists(history_file_path):
            print("📝 历史文件不存在，需要初始化")
            return True, None
        
        # 读取最后一行（最新一期）
        with open(history_file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            if lines:
                last_line = lines[-1].strip()
                print(f"📊 当前最新数据: {last_line}")
                return True, last_line  # 简化处理，总是尝试获取最新
        
        return True, None
    
    def update_history_file(self, history_file_path, new_data_line):
        """更新历史数据文件"""
        if not new_data_line:
            return False
        
        # 检查是否已存在
        if os.path.exists(history_file_path):
            with open(history_file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                if new_data_line in content:
                    print("ℹ️ 该期数据已存在，跳过")
                    return False
        
        # 追加新数据
        with open(history_file_path, 'a', encoding='utf-8') as f:
            f.write('\n' + new_data_line)
        
        print(f"✅ 已更新历史数据文件")
        return True
    
    def run(self, history_file_path='./lottery-app/src/data/lottery-history.txt'):
        """执行爬取任务"""
        print("=" * 60)
        print("🎯 大乐透开奖号码自动爬取")
        print("=" * 60)
        
        # 1. 获取最新期号信息
        latest_info = self.get_latest_draw_info()
        if not latest_info:
            print("❌ 无法获取最新期号信息")
            return False
        
        print(f"📅 最新期号: {latest_info['period']}")
        
        # 2. 爬取开奖结果
        result = self.crawl_draw_result(latest_info['url'], latest_info['period'])
        if not result:
            print("❌ 爬取失败")
            return False
        
        # 3. 格式化数据
        data_line = self.format_for_history_file(result)
        if not data_line:
            print("❌ 数据格式化失败")
            return False
        
        # 4. 更新历史文件
        success = self.update_history_file(history_file_path, data_line)
        
        if success:
            print("\n" + "=" * 60)
            print("✨ 爬取完成！")
            print(f"📊 新增数据: {data_line}")
            print("=" * 60)
        else:
            print("\nℹ️ 无需更新")
        
        return success


def main():
    """主函数"""
    crawler = LotteryCrawler()
    
    # 设置历史文件路径（相对于项目根目录）
    history_file = './lottery-app/src/data/lottery-history.txt'
    
    # 执行爬取
    crawler.run(history_file)


if __name__ == '__main__':
    main()
