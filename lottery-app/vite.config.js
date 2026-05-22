/*
 * @Author: wangzhengwei 2350907807@qq.com
 * @Date: 2026-05-22 09:35:35
 * @LastEditors: wangzhengwei 2350907807@qq.com
 * @LastEditTime: 2026-05-22 13:58:27
 * @FilePath: \lottery-app\lottery-app\vite.config.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // 支持 GitHub Pages 部署
  assetsInclude: ['**/*.txt'], // 支持导入 txt 文件
  server: {
    proxy: {
      '/api/lottery': {
        target: 'https://webapi.sporttery.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/lottery/, '/gateway/lottery/getHistoryPageListV1.qry')
      }
    }
  }
})
