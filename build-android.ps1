# 彩票分析器 Android APK 打包工具
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   彩票分析器 Android APK 打包工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 设置 Java 环境
$JAVA_HOME = "C:\Program Files\Java\jdk-17"
if (Test-Path $JAVA_HOME) {
    $env:JAVA_HOME = $JAVA_HOME
    $env:PATH = "$JAVA_HOME\bin;" + $env:PATH
    Write-Host "[信息] 使用 Java: $JAVA_HOME" -ForegroundColor Green
} else {
    # 尝试使用系统默认 Java
    Write-Host "[提示] 未找到 JDK 17，使用系统默认 Java" -ForegroundColor Yellow
}

# 检查 Java
try {
    $javaVersion = java -version 2>&1
    if ($javaVersion -match 'version "17') {
        Write-Host "[信息] Java 环境正常 (JDK 17)" -ForegroundColor Green
    } else {
        Write-Host "[警告] 检测到非 JDK 17 版本，可能导致构建失败" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[错误] 未检测到 Java，请先安装 JDK 17" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit 1
}

# 切换到项目目录
Set-Location "e:\lottery-app\lottery-app"

Write-Host ""
Write-Host "[1/5] 构建 Web 资源..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[错误] Web 构建失败" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit 1
}

Write-Host ""
Write-Host "[2/5] 同步到 Android 项目..." -ForegroundColor Cyan
npx cap sync android
if ($LASTEXITCODE -ne 0) {
    Write-Host "[错误] 同步失败" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit 1
}

Write-Host ""
Write-Host "[3/5] 检查 Android SDK..." -ForegroundColor Cyan
if (-not $env:ANDROID_HOME) {
    Write-Host "[提示] 未设置 ANDROID_HOME，尝试使用默认路径..." -ForegroundColor Yellow
    if (Test-Path "$env:LOCALAPPDATA\Android\Sdk") {
        $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
    } elseif (Test-Path "$env:USERPROFILE\AppData\Local\Android\Sdk") {
        $env:ANDROID_HOME = "$env:USERPROFILE\AppData\Local\Android\Sdk"
    } else {
        Write-Host "[错误] 未找到 Android SDK" -ForegroundColor Red
        Write-Host "请先安装 Android Studio 或 Android Command Line Tools" -ForegroundColor Yellow
        Write-Host "下载地址：https://developer.android.com/studio#command-tools" -ForegroundColor Yellow
        Read-Host "按回车键退出"
        exit 1
    }
    Write-Host "[信息] 使用 SDK 路径: $env:ANDROID_HOME" -ForegroundColor Green
}

Write-Host ""
Write-Host "[4/5] 开始打包 APK..." -ForegroundColor Cyan
Set-Location "android"

# 设置 Gradle 环境变量
$env:ANDROID_HOME = $env:ANDROID_HOME
$env:PATH = "$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\tools;$env:ANDROID_HOME\tools\bin;$env:PATH"

# 查找本地 Gradle
$gradlePath = ""
$gradleVersions = @("8.0.2", "8.1.2", "8.5", "7.6")
foreach ($version in $gradleVersions) {
    $gradleDir = Get-ChildItem "$env:USERPROFILE\.gradle\wrapper\dists\gradle-$version-*" -Directory -ErrorAction SilentlyContinue
    if ($gradleDir) {
        foreach ($dir in $gradleDir) {
            $gradleBin = "$($dir.FullName)\gradle-$version\bin\gradle.bat"
            if (Test-Path $gradleBin) {
                $gradlePath = "$($dir.FullName)\gradle-$version\bin"
                Write-Host "[信息] 使用本地 Gradle $version" -ForegroundColor Green
                break
            }
        }
    }
    if ($gradlePath) { break }
}

if ($gradlePath) {
    $env:PATH = "$gradlePath;" + $env:PATH
    # 执行 Gradle 构建
    gradle clean assembleDebug
} else {
    Write-Host "[提示] 未找到本地 Gradle，使用 Gradle Wrapper（可能需要下载）" -ForegroundColor Yellow
    .\gradlew.bat clean assembleDebug
}
if ($LASTEXITCODE -ne 0) {
    Write-Host "[错误] APK 打包失败" -ForegroundColor Red
    Set-Location ".."
    Read-Host "按回车键退出"
    exit 1
}

Set-Location ".."

Write-Host ""
Write-Host "[5/5] 打包完成！" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   APK 文件位置：" -ForegroundColor Cyan
$apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
Write-Host "   $apkPath" -ForegroundColor Yellow
if (Test-Path $apkPath) {
    $apkSize = [math]::Round((Get-Item $apkPath).Length/1MB, 2)
    Write-Host "   文件大小: ${apkSize} MB" -ForegroundColor White
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "提示：这是测试版 APK，可直接安装到手机" -ForegroundColor White
Write-Host "如需正式版（签名版），请使用 assembleRelease" -ForegroundColor White
Write-Host ""

Read-Host "按回车键退出"
