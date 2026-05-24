"""
手动添加大乐透开奖结果
用于在自动爬虫不可用时，快速添加最新开奖数据
"""

import os
from datetime import datetime


def manual_add_result():
    """手动添加开奖结果到历史文件"""
    
    print("=" * 60)
    print("🎯 手动添加大乐透开奖结果")
    print("=" * 60)
    
    # 获取用户输入
    print("\n请输入开奖号码（每两个数字之间用空格分隔）：")
    
    while True:
        try:
            front_input = input("\n前区5个号码 (例如: 07 09 23 27 32): ").strip()
            back_input = input("后区2个号码 (例如: 02 08): ").strip()
            
            # 解析号码
            front_nums = [int(x) for x in front_input.split()]
            back_nums = [int(x) for x in back_input.split()]
            
            # 验证
            if len(front_nums) != 5:
                print("❌ 前区必须是5个号码")
                continue
            
            if len(back_nums) != 2:
                print("❌ 后区必须是2个号码")
                continue
            
            # 验证号码范围
            if any(n < 1 or n > 35 for n in front_nums):
                print("❌ 前区号码必须在 1-35 之间")
                continue
            
            if any(n < 1 or n > 12 for n in back_nums):
                print("❌ 后区号码必须在 1-12 之间")
                continue
            
            # 检查重复
            all_nums = front_nums + back_nums
            if len(all_nums) != len(set(all_nums)):
                print("❌ 号码不能重复")
                continue
            
            break
            
        except ValueError:
            print("❌ 请输入有效的数字")
    
    # 格式化
    formatted = ' '.join([str(n).zfill(2) for n in front_nums + back_nums])
    
    print(f"\n✅ 格式化后的数据: {formatted}")
    
    # 确认
    confirm = input("\n是否添加到历史文件？(y/n): ").strip().lower()
    
    if confirm != 'y':
        print("❌ 已取消")
        return False
    
    # 文件路径
    history_file = './lottery-app/src/data/lottery-history.txt'
    
    # 检查文件是否存在
    if not os.path.exists(history_file):
        print(f"\n⚠️ 文件不存在，将创建新文件: {history_file}")
        
        # 创建目录（如果不存在）
        os.makedirs(os.path.dirname(history_file), exist_ok=True)
        
        with open(history_file, 'w', encoding='utf-8') as f:
            f.write(formatted)
        
        print("✅ 文件已创建并添加数据")
    else:
        # 读取现有内容
        with open(history_file, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.strip().split('\n')
        
        # 检查是否已存在
        if formatted in lines:
            print("ℹ️ 该期数据已存在于历史文件中")
            return False
        
        # 显示最后一行（最新数据）
        if lines:
            print(f"\n📊 当前最新数据: {lines[-1]}")
        
        # 追加新数据
        with open(history_file, 'a', encoding='utf-8') as f:
            f.write('\n' + formatted)
        
        print("✅ 数据已成功添加")
    
    # 显示统计信息
    with open(history_file, 'r', encoding='utf-8') as f:
        total_lines = len(f.readlines())
    
    print(f"\n{'=' * 60}")
    print(f"📊 历史数据总数: {total_lines} 期")
    print(f"📅 更新时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'=' * 60}\n")
    
    print("下一步:")
    print("1. 运行 git add .")
    print("2. 运行 git commit -m '更新开奖数据'")
    print("3. 运行 git push\n")
    
    return True


def batch_add_results():
    """批量添加多期开奖结果"""
    
    print("=" * 60)
    print("📦 批量添加开奖结果")
    print("=" * 60)
    print("\n提示: 每行输入一期的号码，格式: XX XX XX XX XX XX XX")
    print("例如: 07 09 23 27 32 02 08")
    print("输入空行结束\n")
    
    results = []
    
    while True:
        line = input(f"第 {len(results) + 1} 期: ").strip()
        
        if not line:
            break
        
        try:
            nums = [int(x) for x in line.split()]
            
            if len(nums) != 7:
                print("❌ 每期必须是7个号码（5+2）")
                continue
            
            # 验证范围
            if any(n < 1 or n > 35 for n in nums[:5]):
                print("❌ 前区号码必须在 1-35 之间")
                continue
            
            if any(n < 1 or n > 12 for n in nums[5:]):
                print("❌ 后区号码必须在 1-12 之间")
                continue
            
            formatted = ' '.join([str(n).zfill(2) for n in nums])
            results.append(formatted)
            print(f"✅ 已记录: {formatted}")
            
        except ValueError:
            print("❌ 请输入有效的数字")
    
    if not results:
        print("\n❌ 未输入任何数据")
        return False
    
    # 确认
    print(f"\n共输入 {len(results)} 期数据:")
    for i, result in enumerate(results, 1):
        print(f"  {i}. {result}")
    
    confirm = input("\n是否全部添加？(y/n): ").strip().lower()
    
    if confirm != 'y':
        print("❌ 已取消")
        return False
    
    # 添加到文件
    history_file = './lottery-app/src/data/lottery-history.txt'
    
    with open(history_file, 'a', encoding='utf-8') as f:
        for result in results:
            f.write('\n' + result)
    
    print(f"\n✅ 成功添加 {len(results)} 期数据")
    
    # 显示统计
    with open(history_file, 'r', encoding='utf-8') as f:
        total_lines = len(f.readlines())
    
    print(f"📊 历史数据总数: {total_lines} 期")
    
    return True


if __name__ == '__main__':
    import sys
    
    print("选择操作模式:")
    print("1. 单期添加")
    print("2. 批量添加")
    
    choice = input("\n请选择 (1/2): ").strip()
    
    if choice == '2':
        batch_add_results()
    else:
        manual_add_result()
