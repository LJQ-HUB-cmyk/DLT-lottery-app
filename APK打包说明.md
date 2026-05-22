# Android APK 打包说明

## 快速开始

### 方法一：双击批处理文件（推荐）
1. 确保在 `e:\lottery-app` 目录下
2. 双击运行 `build-android.bat` 文件
3. 等待构建完成，窗口会显示结果并等待按键退出

### 方法二：使用 PowerShell 脚本
```powershell
.\build-android.ps1
```

## 环境要求

1. **JDK 17**
   - 必须安装 JDK 17（其他版本可能导致构建失败）
   - 下载地址：https://www.oracle.com/java/technologies/downloads/#java17

2. **Android SDK**
   - 需要安装 Android SDK
   - 可以通过安装 Android Studio 获得
   - 或者下载 Command Line Tools：https://developer.android.com/studio#command-tools

3. **Node.js 和 npm**
   - 用于构建 Web 资源

## 打包流程

脚本会自动执行以下步骤：

1. ✅ 构建 React Web 应用（npm run build）
2. ✅ 同步到 Android 项目（npx cap sync android）
3. ✅ 检查 Android SDK 环境
4. ✅ 使用 Gradle 编译 APK
5. ✅ 输出 APK 文件

## 输出文件

- **调试版 APK**: `lottery-app/android/app/build/outputs/apk/debug/app-debug.apk`
- 文件大小：约 3.58 MB
- 可直接安装到 Android 手机进行测试

## 常见问题

### 1. Java 版本错误
**问题**: 提示 "Unsupported class file major version"
**解决**: 确保使用 JDK 17，而不是其他版本

### 2. Gradle 下载失败
**问题**: 下载 Gradle 时出现网络错误
**解决**: 脚本会自动使用本地缓存的 Gradle，无需重新下载

### 3. 依赖下载失败
**问题**: 无法下载 Maven 依赖
**解决**: 已配置阿里云镜像源，如果仍有问题请检查网络连接

### 4. Android SDK 未找到
**问题**: 提示未找到 Android SDK
**解决**: 安装 Android Studio 或设置 ANDROID_HOME 环境变量

## 生成正式版 APK

如需生成签名的正式版 APK，请修改脚本中的：
```
gradle clean assembleDebug
```
改为：
```
gradle clean assembleRelease
```

然后需要配置签名信息（在 `android/app/build.gradle` 中）。

## 手动打包步骤

如果需要手动执行打包：

```powershell
# 1. 进入项目目录
cd e:\lottery-app\lottery-app

# 2. 构建 Web 应用
npm run build

# 3. 同步到 Android
npx cap sync android

# 4. 设置环境变量
$env:JAVA_HOME = "C:\Program Files\Java\jdk-17"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"

# 5. 进入 Android 目录并构建
cd android
gradle clean assembleDebug

# 6. APK 生成位置
# android/app/build/outputs/apk/debug/app-debug.apk
```

## 技术支持

如有问题，请检查：
1. Java 版本是否为 17
2. Android SDK 是否正确安装
3. 网络连接是否正常
4. 查看构建输出的错误信息
