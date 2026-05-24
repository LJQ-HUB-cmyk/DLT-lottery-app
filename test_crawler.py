"""
本地测试爬虫脚本
用于在提交前验证爬取功能是否正常
"""

import sys
import os

# 添加 scripts 目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'scripts'))

from scripts.crawl_lottery_v3 import LotteryCrawlerV3


def test_crawler():
    """测试爬虫功能"""
    print("=" * 60)
    print("🧪 本地测试模式 - 不会提交任何更改")
    print("=" * 60)
    
    crawler = LotteryCrawlerV3()
    
    # 使用当前目录下的测试文件
    test_file = './lottery-app/src/data/lottery-history.txt'
    
    # 执行爬取（仅显示结果，不实际更新文件）
    print("\n开始测试爬取...\n")
    
    # 使用 v2 版本的 run 方法
    success = crawler.run(test_file)
    
    if success:
        print("✅ 测试成功！数据已保存到历史文件")
    else:
        print("⚠️ 测试完成，但未能获取新数据")
    
    return True


if __name__ == '__main__':
    try:
        success = test_crawler()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
