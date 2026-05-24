"""
大乐透开奖号码自动爬取 - Selenium版本
使用无头浏览器获取JavaScript渲染后的页面
"""

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import os
import re
from datetime import datetime


class LotteryCrawlerSelenium:
    """使用Selenium的大乐透爬虫"""
    
    def __init__(self, headless=True):
        self.headless = headless
        self.driver = None
        
    def setup_driver(self):
        """配置Chrome驱动"""
        options = Options()
        
        if self.headless:
            options.add_argument('--headless')  # 无头模式
        
        # 其他优化选项
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--window-size=1920,1080')
        options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        
        try:
            self.driver = webdriver.Chrome(options=options)
            self.driver.set_page_load_timeout(30)
            print("✅ Chrome驱动初始化成功")
            return True
        except Exception as e:
            print(f"❌ Chrome驱动初始化失败: {e}")
            print("💡 提示: 需要安装Chrome和ChromeDriver")
            return False
    
    def fetch_from_cz89(self):
        """从牛彩网获取数据"""
        url = 'https://m.cz89.com/kaijiang/dlt'
        
        try:
            print(f"🔍 访问: {url}")
            self.driver.get(url)
            
            # 等待页面加载
            time.sleep(3)
            
            # 获取页面源码
            html = self.driver.page_source
            
            # 解析HTML
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, 'html.parser')
            
            # 提取期号
            period = None
            text = soup.get_text()
            period_match = re.search(r'(\d{5})期', text)
            if period_match:
                period = period_match.group(1)
                print(f"📅 期号: {period}")
            
            # 提取号码 - 尝试多种方法
            numbers = self.extract_numbers(soup, text)
            
            if numbers and period:
                return {
                    'period': period,
                    'front': numbers[:5],
                    'back': numbers[5:],
                    'source': '牛彩网(Selenium)'
                }
            
            return None
            
        except Exception as e:
            print(f"❌ 爬取失败: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def extract_numbers(self, soup, text):
        """从页面中提取号码"""
        
        # 方法1: 查找特定class的元素
        ball_classes = ['ball', 'kjnum', 'result-num', 'code']
        
        for class_name in ball_classes:
            elements = soup.find_all(class_=re.compile(class_name, re.I))
            
            numbers = []
            for elem in elements:
                num_text = elem.get_text().strip()
                if num_text.isdigit():
                    num = int(num_text)
                    if 1 <= num <= 35:  # 前区范围
                        numbers.append(num)
                    elif 1 <= num <= 12 and len(numbers) >= 5:  # 后区范围
                        numbers.append(num)
                
                if len(numbers) == 7:
                    break
            
            if len(numbers) == 7:
                print(f"✅ 找到号码: {' '.join([str(n).zfill(2) for n in numbers])}")
                return numbers
        
        # 方法2: 从文本中查找数字模式
        pattern = r'(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})'
        matches = re.findall(pattern, text)
        
        if matches:
            first = matches[0]
            numbers = [int(x) for x in first]
            
            # 验证
            front = numbers[:5]
            back = numbers[5:]
            
            if all(1 <= n <= 35 for n in front) and all(1 <= n <= 12 for n in back):
                print(f"✅ 从文本找到: {' '.join([str(n).zfill(2) for n in numbers])}")
                return numbers
        
        return None
    
    def format_result(self, result):
        """格式化结果"""
        if not result:
            return None
        
        front_str = ' '.join([str(n).zfill(2) for n in result['front']])
        back_str = ' '.join([str(n).zfill(2) for n in result['back']])
        
        return f"{front_str} {back_str}"
    
    def check_and_update(self, history_file, new_line):
        """检查并更新文件"""
        if not new_line:
            return False, "数据为空"
        
        os.makedirs(os.path.dirname(history_file), exist_ok=True)
        
        if not os.path.exists(history_file):
            with open(history_file, 'w', encoding='utf-8') as f:
                f.write(new_line)
            return True, "新建文件"
        
        with open(history_file, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = [line.strip() for line in content.strip().split('\n') if line.strip()]
        
        if new_line in lines:
            return False, "数据已存在"
        
        if lines:
            print(f"📊 当前最新: {lines[-1]}")
        
        with open(history_file, 'a', encoding='utf-8') as f:
            f.write('\n' + new_line)
        
        return True, "数据已更新"
    
    def run(self, history_file='./lottery-app/src/data/lottery-history.txt'):
        """执行爬取"""
        print("=" * 70)
        print("🎯 大乐透自动爬取 - Selenium版")
        print(f"📅 时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 70)
        
        # 初始化驱动
        if not self.setup_driver():
            return False
        
        try:
            # 获取数据
            result = self.fetch_from_cz89()
            
            if not result:
                print("\n❌ 未能获取数据")
                return False
            
            # 显示结果
            print(f"\n✅ 第 {result['period']} 期:")
            print(f"   前区: {' '.join([str(n).zfill(2) for n in result['front']])}")
            print(f"   后区: {' '.join([str(n).zfill(2) for n in result['back']])}")
            
            # 格式化
            formatted = self.format_result(result)
            print(f"\n📝 格式: {formatted}")
            
            # 更新文件
            success, message = self.check_and_update(history_file, formatted)
            
            print(f"\n{'=' * 70}")
            if success:
                print(f"✨ {message}")
                with open(history_file, 'r', encoding='utf-8') as f:
                    total = len([l for l in f.readlines() if l.strip()])
                print(f"📈 总计: {total} 期")
            else:
                print(f"ℹ️ {message}")
            print(f"{'=' * 70}\n")
            
            return success
            
        finally:
            # 关闭浏览器
            if self.driver:
                self.driver.quit()
                print("🔒 浏览器已关闭")


def main():
    """主函数"""
    crawler = LotteryCrawlerSelenium(headless=True)
    history_file = './lottery-app/src/data/lottery-history.txt'
    crawler.run(history_file)


if __name__ == '__main__':
    main()
