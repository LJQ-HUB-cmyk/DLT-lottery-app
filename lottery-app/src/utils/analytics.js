/**
 * Google Analytics 工具函数
 */

// Google Analytics 测量 ID（请替换为您的实际 ID）
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-XXXXXXXXXX';

/**
 * 初始化 Google Analytics
 */
export const initGA = () => {
  // 加载 Google Analytics 脚本
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  // 初始化 gtag
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: true,
  });

  // 将 gtag 挂载到 window 对象
  window.gtag = gtag;
};

/**
 * 追踪页面浏览
 * @param {string} pagePath - 页面路径
 * @param {string} pageTitle - 页面标题
 */
export const trackPageView = (pagePath, pageTitle) => {
  if (window.gtag) {
    window.gtag('event', 'page_view', {
      page_path: pagePath,
      page_title: pageTitle,
    });
  }
};

/**
 * 追踪事件
 * @param {string} eventName - 事件名称
 * @param {object} params - 事件参数
 */
export const trackEvent = (eventName, params = {}) => {
  if (window.gtag) {
    window.gtag('event', eventName, params);
  }
};

/**
 * 追踪号码生成
 * @param {string} model - 使用的模型
 * @param {number} groups - 生成的组数
 */
export const trackNumberGeneration = (model, groups) => {
  trackEvent('generate_numbers', {
    event_category: 'prediction',
    event_label: model,
    value: groups,
    model_name: model,
    group_count: groups,
  });
};

/**
 * 追踪复制操作
 */
export const trackCopy = () => {
  trackEvent('copy_results', {
    event_category: 'user_action',
    event_label: 'copy_to_clipboard',
  });
};

/**
 * 追踪保存操作
 */
export const trackSave = () => {
  trackEvent('save_results', {
    event_category: 'user_action',
    event_label: 'save_to_file',
  });
};

/**
 * 追踪数据更新
 * @param {number} dataCount - 数据条数
 */
export const trackDataUpdate = (dataCount) => {
  trackEvent('update_data', {
    event_category: 'data_management',
    event_label: 'load_history_data',
    value: dataCount,
  });
};

/**
 * 追踪模型选择
 * @param {array} models - 选中的模型列表
 */
export const trackModelSelection = (models) => {
  trackEvent('select_models', {
    event_category: 'settings',
    event_label: models.join(','),
    model_count: models.length,
  });
};
