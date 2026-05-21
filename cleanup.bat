@echo off
chcp 65001 >nul
echo ========================================
echo   清理工程中的无用文件
echo ========================================
echo.

cd /d "%~dp0"

echo 正在删除以下无用文件...
echo.

REM 删除重复的文档文件
echo - DEPLOYMENT.md
del /f /q DEPLOYMENT.md 2>nul

echo - GITHUB-PAGES-DEPLOY.md
del /f /q GITHUB-PAGES-DEPLOY.md 2>nul

echo - ANALYTICS.md
del /f /q ANALYTICS.md 2>nul

echo - BAIDU-ANALYTICS.md
del /f /q BAIDU-ANALYTICS.md 2>nul

echo - QUICK-START-ANALYTICS.md
del /f /q QUICK-START-ANALYTICS.md 2>nul

echo - 快速配置-百度统计.md
del /f /q "快速配置-百度统计.md" 2>nul

echo - DEPLOY.md
del /f /q DEPLOY.md 2>nul

REM 删除 Netlify 相关文件
echo - netlify.toml
del /f /q netlify.toml 2>nul

echo - deploy-netlify.bat
del /f /q deploy-netlify.bat 2>nul

REM 删除 Python 分析器
echo - lottery_analyzer.py
del /f /q lottery_analyzer.py 2>nul

REM 删除 Capacitor 相关文件
echo - lottery-app\android\
rmdir /s /q lottery-app\android 2>nul

echo - lottery-app\ios\
rmdir /s /q lottery-app\ios 2>nul

echo - lottery-app\build-android.bat
del /f /q lottery-app\build-android.bat 2>nul

REM 删除根目录的 node_modules
echo - node_modules\
rmdir /s /q node_modules 2>nul

REM 删除根目录的 package.json 和 package-lock.json
echo - package.json
del /f /q package.json 2>nul

echo - package-lock.json
del /f /q package-lock.json 2>nul

echo.
echo ========================================
echo   清理完成！
echo ========================================
echo.
echo 以下文件已删除：
echo - 重复的文档文件（DEPLOYMENT.md, GITHUB-PAGES-DEPLOY.md 等）
echo - Netlify 相关文件（deploy-netlify.bat, netlify.toml）
echo - Python 分析器（lottery_analyzer.py）
echo - Capacitor 构建文件（android/, ios/）
echo - 根目录的 node_modules
echo - 根目录的 package.json 和 package-lock.json
echo.

pause
