@echo off
chcp 65001 >nul
echo ========================================
echo    大乐透数据快速更新工具
echo ========================================
echo.

echo [1/3] 打开中国体彩网...
start "" "https://www.lottery.gov.cn/kj/kjlb.html?dlt"

echo [2/3] 打开数据文件...
start "" "%~dp0src\data\lottery-history.txt"

echo [3/3] 准备就绪！
echo.
echo 操作步骤：
echo   1. 在浏览器中复制最新一期号码（格式：01 12 15 19 26 04 16）
echo   2. 在记事本第一行粘贴新号码
echo   3. 保存文件（Ctrl+S）
echo   4. 刷新网页或重新打包 APK
echo.
echo ========================================
pause
