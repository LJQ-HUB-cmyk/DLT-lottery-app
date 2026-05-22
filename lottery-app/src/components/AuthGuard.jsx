import { useState, useEffect } from 'react';

// 授权码配置（从环境变量读取）
const VALID_AUTH_CODE = import.meta.env.VITE_AUTH_CODE || '888888';

function AuthGuard({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 检查本地存储中是否已有授权
    const savedAuth = localStorage.getItem('lottery_auth');
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const handleAuth = (e) => {
    e.preventDefault();
    
    if (authCode === VALID_AUTH_CODE) {
      // 授权成功
      localStorage.setItem('lottery_auth', 'true');
      setIsAuthenticated(true);
      setError('');
    } else {
      // 授权失败
      setError('授权码错误，请重试！');
      setAuthCode('');
    }
  };

  if (isLoading) {
    return (
      <div className="auth-loading">
        <div className="loading-spinner"></div>
        <p>加载中...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>🧧 发财大计</h1>
            <p>需要授权才能访问</p>
          </div>
          
          <form onSubmit={handleAuth} className="auth-form">
            <div className="auth-input-group">
              <label htmlFor="authCode">请输入授权码：</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                id="authCode"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                placeholder="请输入授权码"
                autoComplete="off"
                autoFocus
              />
            </div>
            
            {error && <div className="auth-error">{error}</div>}
            
            <button type="submit" className="auth-submit-btn">
              验证授权
            </button>
          </form>
          
          <div className="auth-footer">
            <p>© 2026 发财大计 - 王正伟</p>
          </div>
        </div>
      </div>
    );
  }

  // 已授权，显示主应用
  return (
    <>
      {children}
    </>
  );
}

export default AuthGuard;
