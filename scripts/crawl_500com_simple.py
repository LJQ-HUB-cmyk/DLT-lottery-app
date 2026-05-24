"""
大乐透开奖号码爬取 - 500.com专用版
直接从500.com获取指定期号的开奖结果
"""

import requests
from bs4 import BeautifulSoup
import re
import os
from datetime import datetime


def fetch_500com_result(period):
    """从500.com获取指定期号的开奖结果"""
    
    url = f'http://kaijiang.500.com/shtml/dlt/{period}.shtml'
    
    print(f"🔍 访问: {url}")
    
    try:
        response = requests.get(url, timeout=10, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        response.encoding = 'utf-8'
        
        if response.status_code != 200:
            print(f"❌ 请求失败，状态码: {response.status_code}")
            return None
        
        print(f"✅ 页面获取成功")
        
        # 解析HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 方法1: 从标题中提取
        title = soup.find('title')
        if title:
            title_text = title.get_text()
            print(f"📄 页面标题: {title_text[:100]}")
            
            # 匹配类似 "大乐透26056期开奖结果 06 07 18 21 30 + 01 05"
            pattern = r'(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s*[+]\s*(\d{2})\s+(\d{2})'
            match = re.search(pattern, title_text)
            
            if match:
                front = [int(x) for x in match.groups()[:5]]
                back = [int(x) for x in match.groups()[5:]]
                
                print(f"✅ 从标题找到号码:")
                print(f"   前区: {' '.join([str(n).zfill(2) for n in front])}")
                print(f"   后区: {' '.join([str(n).zfill(2) for n in back])}")
                
                return {
                    'period': period,
                    'front': front,
                    'back': back,
                    'source': '500.com(title)'
                }
        
        # 方法2: 从页面文本中提取
        text = soup.get_text()
        
        # 查找包含期号和号码的模式
        # 匹配 "06 07 18 21 30 + 01 05" 或 "06 07 18 21 30 01 05"
        patterns = [
            r'(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s*[+]\s*(\d{2})\s+(\d{2})',
            r'(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})',
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text)
            
            if matches:
                # 取第一个匹配
                first = matches[0]
                nums = [int(x) for x in first]
                front = nums[:5]
                back = nums[5:]
                
                # 验证号码范围
                if all(1 <= n <= 35 for n in front) and all(1 <= n <= 12 for n in back):
                    print(f"✅ 从页面找到号码:")
                    print(f"   前区: {' '.join([str(n).zfill(2) for n in front])}")
                    print(f"   后区: {' '.join([str(n).zfill(2) for n in back])}")
                    
                    return {
                        'period': period,
                        'front': front,
                        'back': back,
                        'source': '500.com(text)'
                    }
        
        print("❌ 未能提取到号码")
        return None
        
    except Exception as e:
        print(f"❌ 爬取失败: {e}")
        import traceback
        traceback.print_exc()
        return None


def format_result(result):
    """格式化结果"""
    if not result:
        return None
    
    front_str = ' '.join([str(n).zfill(2) for n in result['front']])
    back_str = ' '.join([str(n).zfill(2) for n in result['back']])
    
    return f"{front_str} {back_str}"


def update_history_file(history_file, new_line):
    """更新历史文件"""
    if not new_line:
        return False
    
    os.makedirs(os.path.dirname(history_file), exist_ok=True)
    
    if not os.path.exists(history_file):
        with open(history_file, 'w', encoding='utf-8') as f:
            f.write(new_line)
        print(f"📝 创建新文件")
        return True
    
    with open(history_file, 'r', encoding='utf-8') as f:
        content = f.read()
        lines = [line.strip() for line in content.strip().split('\n') if line.strip()]
    
    if new_line in lines:
        print("ℹ️ 数据已存在")
        return False
    
    if lines:
        print(f"📊 当前最新: {lines[-1]}")
    
    with open(history_file, 'a', encoding='utf-8') as f:
        f.write('\n' + new_line)
    
    print("✅ 数据已添加")
    return True


def main():
    """主函数"""
    print("=" * 70)
    print("🎯 大乐透开奖号码爬取 - 500.com版")
    print(f"📅 时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)
    
    # 获取26056期
    period = '26056'
    print(f"\n📅 获取第 {period} 期数据\n")
    
    result = fetch_500com_result(period)
    
    if not result:
        print("\n❌ 爬取失败")
        return False
    
    # 格式化
    formatted = format_result(result)
    print(f"\n📝 格式化: {formatted}")
    
    # 更新文件
    history_file = './lottery-app/src/data/lottery-history.txt'
    success = update_history_file(history_file, formatted)
    
    if success:
        with open(history_file, 'r', encoding='utf-8') as f:
            total = len([l for l in f.readlines() if l.strip()])
        print(f"📈 历史数据总数: {total} 期")
    
    print("\n" + "=" * 70)
    print("✅ 完成！")
    print("=" * 70)
    
    return success


if __name__ == '__main__':
    main()
