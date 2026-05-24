"""
快速测试Selenium - 直接获取26056期数据
"""

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import time
from bs4 import BeautifulSoup
import re

def test_selenium():
    """测试Selenium获取26056期数据"""
    
    print("=" * 70)
    print("🧪 Selenium快速测试 - 第26056期")
    print("=" * 70)
    
    # 配置Chrome
    options = Options()
    options.add_argument('--headless')  # 无头模式
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--window-size=1920,1080')
    
    driver = None
    
    try:
        print("\n🚀 启动Chrome浏览器...")
        driver = webdriver.Chrome(options=options)
        print("✅ Chrome启动成功")
        
        # 访问牛彩网
        url = 'https://m.cz89.com/kaijiang/dlt'
        print(f"\n🔍 访问: {url}")
        driver.get(url)
        
        # 等待页面加载
        print("⏳ 等待页面加载...")
        time.sleep(5)
        
        # 获取页面源码
        html = driver.page_source
        print(f"✅ 页面加载完成，大小: {len(html)} bytes")
        
        # 解析HTML
        soup = BeautifulSoup(html, 'html.parser')
        
        # 提取文本
        text = soup.get_text()
        
        # 查找26056期相关的数据
        print("\n🔎 搜索26056期数据...")
        
        # 方法1: 查找包含26056的行
        if '26056' in text:
            print("✅ 找到26056期")
            
            # 查找附近的数字模式
            # 匹配类似 "02 06 14 22 24 08 11" 的格式
            pattern = r'(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})'
            matches = re.findall(pattern, text)
            
            print(f"\n找到 {len(matches)} 个号码组合:")
            for i, match in enumerate(matches[:10], 1):
                nums = [int(x) for x in match]
                front = nums[:5]
                back = nums[5:]
                
                # 验证是否是大乐透号码
                if all(1 <= n <= 35 for n in front) and all(1 <= n <= 12 for n in back):
                    print(f"  {i}. {' '.join([str(n).zfill(2) for n in nums])} ✅ 可能是大乐透")
                else:
                    print(f"  {i}. {' '.join([str(n).zfill(2) for n in nums])}")
        else:
            print("❌ 未找到26056期")
        
        # 保存HTML以便分析
        with open('test_page.html', 'w', encoding='utf-8') as f:
            f.write(html)
        print(f"\n💾 页面已保存到 test_page.html")
        
        print("\n" + "=" * 70)
        print("✅ 测试完成！")
        print("=" * 70)
        
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        
    finally:
        if driver:
            driver.quit()
            print("🔒 浏览器已关闭")


if __name__ == '__main__':
    test_selenium()
