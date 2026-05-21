@echo off
chcp 65001 >nul
echo ========================================
echo    彩票分析器 - Netlify 一键部署
echo ========================================
echo.

REM 检查 dist 文件夹是否存在
if not exist "dist" (
    echo [1/2] 正在构建项目...
    call npm run build
    if %errorlevel% neq 0 (
        echo [错误] 构建失败
        pause
        exit /b 1
    )
    echo [完成] 构建成功！
    echo.
) else (
    echo [提示] dist 文件夹已存在，跳过构建
    echo.
)

echo [2/2] 准备打开 Netlify 上传页面...
echo.
echo 请执行以下操作：
echo   1. 浏览器会自动打开 Netlify 上传页面
echo   2. 将 dist 文件夹拖拽到网页上的虚线框内
echo   3. 等待部署完成，即可获得访问链接
echo.
echo 按任意键打开浏览器...
pause >nul

REM 打开 Netlify Drop 页面
start https://app.netlify.com/drop

REM 打开 dist 文件夹所在位置
explorer "%CD%"

echo.
echo ========================================
echo 浏览器和文件夹已打开！
echo 现在可以将 dist 文件夹拖拽到浏览器中了
echo ========================================
echo.
pause
