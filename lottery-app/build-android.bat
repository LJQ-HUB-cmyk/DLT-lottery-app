@echo off
chcp 65001 >nul
echo ========================================
echo    彩票分析器 Android APK 打包工具
echo ========================================
echo.

REM 如果未设置 ANDROID_HOME，尝试自动设置
if not defined ANDROID_HOME (
    if exist "D:\commandlinetools-win-14742923_latest" (
        set ANDROID_HOME=D:\commandlinetools-win-14742923_latest
    )
)

REM 设置 Java 环境 - 自动检测 JDK 17 路径
set JAVA_FOUND=0

if exist "C:\Program Files\Java\jdk-17" (
    set JAVA_HOME=C:\Program Files\Java\jdk-17
    set JAVA_FOUND=1
) else if exist "C:\Program Files\Java\jdk-17.*" (
    for /d %%i in ("C:\Program Files\Java\jdk-17.*") do (
        set JAVA_HOME=%%i
        set JAVA_FOUND=1
        goto :java_found
    )
) else if defined JAVA_HOME (
    REM 使用系统环境变量
    set JAVA_FOUND=1
)

:java_found
if %JAVA_FOUND% equ 0 (
    echo [错误] 未找到 JDK 17，请先安装 JDK 17
    echo 下载地址：https://adoptium.net/temurin/releases/?version=17
    pause
    exit /b 1
)

set PATH=%JAVA_HOME%\bin;%PATH%
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

REM 首先检查系统环境变量
if defined ANDROID_HOME (
    echo [信息] 使用环境变量 ANDROID_HOME: %ANDROID_HOME%
    goto :android_found
)

echo [提示] 未设置 ANDROID_HOME，尝试查找...

REM 尝试常见的 Android SDK 位置
if exist "%LOCALAPPDATA%\Android\Sdk" (
    set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
) else if exist "%USERPROFILE%\AppData\Local\Android\Sdk" (
    set ANDROID_HOME=%USERPROFILE%\AppData\Local\Android\Sdk
) else if exist "D:\commandlinetools-win-14742923_latest" (
    set ANDROID_HOME=D:\commandlinetools-win-14742923_latest
) else (
    REM 尝试通配符匹配
    for /d %%i in ("D:\commandlinetools-win-*") do (
        set ANDROID_HOME=%%i
        goto :android_found
    )
    
    if exist "C:\Android\Sdk" (
        set ANDROID_HOME=C:\Android\Sdk
    ) else (
        echo [错误] 未找到 Android SDK
        echo.
        echo 请设置 ANDROID_HOME 环境变量或安装 Android SDK
        echo 常见位置：
        echo   - %%LOCALAPPDATA%%\Android\Sdk (Android Studio 默认)
        echo   - D:\commandlinetools-win-* (命令行工具)
        echo   - C:\Android\Sdk
        echo.
        echo 设置方法：
        echo   setx ANDROID_HOME "你的SDK路径"
        echo.
        pause
        exit /b 1
    )
)

:android_found
echo [信息] 使用 SDK 路径: %ANDROID_HOME%

echo [4/5] 清理构建缓存...
cd android
call gradlew.bat clean
if %errorlevel% neq 0 (
    echo [警告] 清理缓存失败，继续打包...
)

echo [5/5] 开始打包 APK...
call gradlew.bat assembleDebug
if %errorlevel% neq 0 (
    echo [错误] APK 打包失败
    cd ..
    pause
    exit /b 1
)

echo [6/6] Build completed!
cd ..

REM Get APK path
set APK_PATH=%cd%\android\app\build\outputs\apk\debug\
set ORIGINAL_APK=%APK_PATH%app-debug.apk
set NEW_APK=%APK_PATH%发财大计.apk

REM Rename APK to "发财大计.apk"
if exist "%ORIGINAL_APK%" (
    echo.
    echo [信息] 重命名 APK 文件...
    copy "%ORIGINAL_APK%" "%NEW_APK%" >nul
    if %errorlevel% equ 0 (
        echo [成功] APK 已重命名为: 发财大计.apk
    ) else (
        echo [警告] 重命名失败，使用原始文件名
        set NEW_APK=%ORIGINAL_APK%
    )
) else (
    echo [警告] 未找到 APK 文件
)

echo.
echo ========================================
echo    APK Build Successful!
echo ========================================
echo.
echo APK Location:
echo %APK_PATH%
echo.
echo Files in directory:
dir "%APK_PATH%*.apk" /b
echo.
echo ========================================
echo.
echo Tip: This is a debug APK, you can install it directly to your phone
echo For release version (signed), use: gradlew.bat assembleRelease
echo.

REM Open the folder automatically
echo Opening APK folder...
start "" "%APK_PATH%"

echo.
pause
