/**
 * 百度统计工具函数
 */

// 百度统计站点 ID（请替换为您的实际 ID）
const BAIDU_TONGJI_ID = import.meta.env.VITE_BAIDU_TONGJI_ID || 'xxxxxxxx';

/**
 * 检测当前运行环境
 * @returns {string} 'apk' | 'web'
 */
export const getPlatform = () => {
  // Capacitor APP 环境检测
  if (window.Capacitor || window.capacitor) {
    return 'apk';
  }
  // 其他 WebView 环境检测
  if (navigator.userAgent.includes('Capacitor') || navigator.userAgent.includes('cordova')) {
    return 'apk';
  }
  return 'web';
};

/**
 * 初始化百度统计
 */
export const initBaiduTongji = () => {
  // 加载百度统计脚本
  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = `https://hm.baidu.com/hm.js?${BAIDU_TONGJI_ID}`;
  script.async = true;
  
  const firstScript = document.getElementsByTagName('script')[0];
  firstScript.parentNode.insertBefore(script, firstScript);

  // 初始化 _hmt 数组
  window._hmt = window._hmt || [];
  
  // 追踪页面浏览
  window._hmt.push(['_setAutoPageview', true]);
  
  // 记录平台信息（用于自定义维度）
  const platform = getPlatform();
  console.log(`[百度统计] 当前平台: ${platform.toUpperCase()}`);
};

/**
 * 追踪事件
 * @param {string} category - 事件分类
 * @param {string} action - 事件动作
 * @param {string} label - 事件标签
 * @param {number} value - 事件值
 */
export const trackEvent = (category, action, label = '', value = 0) => {
  if (window._hmt) {
    // 自动添加平台标识
    const platform = getPlatform();
    const fullLabel = label ? `${label} [${platform}]` : `[${platform}]`;
    window._hmt.push(['_trackEvent', category, action, fullLabel, value]);
  }
};

/**
 * 追踪号码生成
 * @param {string} model - 使用的模型
 * @param {number} groups - 生成的组数
 */
export const trackNumberGeneration = (model, groups) => {
  trackEvent('prediction', 'generate_numbers', model, groups);
};

/**
 * 追踪复制操作
 */
export const trackCopy = () => {
  trackEvent('user_action', 'copy_results', 'clipboard');
};

/**
 * 追踪保存操作
 */
export const trackSave = () => {
  trackEvent('user_action', 'save_results', 'file');
};

/**
 * 追踪数据更新
 * @param {number} dataCount - 数据条数
 */
export const trackDataUpdate = (dataCount) => {
  trackEvent('data_management', 'update_data', 'load_history', dataCount);
};

/**
 * 追踪模型选择
 * @param {array} models - 选中的模型列表
 */
export const trackModelSelection = (models) => {
  trackEvent('settings', 'select_models', models.join(','), models.length);
};

/**
 * 追踪页面访问
 * @param {string} page - 页面路径
 */
export const trackPageView = (page) => {
  if (window._hmt) {
    window._hmt.push(['_trackPageview', page]);
  }
};
