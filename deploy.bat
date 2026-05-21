@echo off
chcp 65001 >nul
echo ========================================
echo   发财大计 - 一键部署脚本
echo ========================================
echo.

cd /d "%~dp0"

echo [1/4] 检查 Git 状态...
git status
echo.

echo [2/4] 添加所有更改到 Git...
git add .
echo.

echo [3/4] 请输入提交信息（直接回车使用默认信息）:
set /p commit_msg="提交信息: "
if "%commit_msg%"=="" set commit_msg=update: 更新代码

git commit -m "%commit_msg%"
echo.

echo [4/4] 推送到 GitHub（自动触发部署）...
git push origin main
echo.

echo ========================================
echo   部署完成！
echo ========================================
echo.
echo 访问 GitHub Actions 查看部署进度：
echo https://github.com/wangzhengwei-gua/lottery-app/actions
echo.
echo 大约 2-3 分钟后可以访问网站：
echo https://wangzhengwei-gua.github.io/lottery-app/
echo.

pause
