@echo off
chcp 65001 >nul
echo ========================================
echo    彩票分析器 Android APK 打包工具
echo ========================================
echo.

REM 设置 Java 环境
set JAVA_HOME=C:\Program Files\Java\jdk-17
set PATH=%JAVA_HOME%\bin;%PATH%

REM 检查 Java
java -version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Java，请先安装 JDK 17
    pause
    exit /b 1
)

echo [信息] 使用 Java: %JAVA_HOME%

echo [1/5] 构建 Web 资源...
call npm run build
if %errorlevel% neq 0 (
    echo [错误] Web 构建失败
    pause
    exit /b 1
)

echo [2/5] 同步到 Android 项目...
call npx cap sync android
if %errorlevel% neq 0 (
    echo [错误] 同步失败
    pause
    exit /b 1
)

echo [3/5] 检查 Android SDK...
if not defined ANDROID_HOME (
    echo [提示] 未设置 ANDROID_HOME，尝试使用默认路径...
    if exist "%LOCALAPPDATA%\Android\Sdk" (
        set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
    ) else if exist "%USERPROFILE%\AppData\Local\Android\Sdk" (
        set ANDROID_HOME=%USERPROFILE%\AppData\Local\Android\Sdk
    ) else (
        echo [错误] 未找到 Android SDK
        echo 请先安装 Android Studio 或 Android Command Line Tools
        echo 下载地址：https://developer.android.com/studio#command-tools
        pause
        exit /b 1
    )
    echo [信息] 使用 SDK 路径: %ANDROID_HOME%
)

echo [4/5] 开始打包 APK...
cd android
call gradlew.bat assembleDebug
if %errorlevel% neq 0 (
    echo [错误] APK 打包失败
    cd ..
    pause
    exit /b 1
)

echo [5/5] 打包完成！
cd ..

echo.
echo ========================================
echo    APK 文件位置：
echo    android\app\build\outputs\apk\debug\app-debug.apk
echo ========================================
echo.
echo 提示：这是测试版 APK，可直接安装到手机
echo 如需正式版（签名版），请使用 assembleRelease
echo.
pause
