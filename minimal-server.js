// 简化版 server.js 用于测试
const express = require('express');
require('dotenv').config();

console.log('🚀 启动简化版服务器...');

const app = express();
const PORT = process.env.PORT || 3000;

// 基础中间件
app.use(express.json());
app.use(express.static('public'));

console.log('✅ 中间件配置完成');

// 检查环境变量
console.log('🔧 环境变量检查:');
console.log('PORT:', process.env.PORT || 3000);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('MONGODB_URI 存在:', !!process.env.MONGODB_URI);
console.log('JWT_SECRET 存在:', !!process.env.JWT_SECRET);
console.log('DEFAULT_DEEPSEEK_API_KEY 存在:', !!process.env.DEFAULT_DEEPSEEK_API_KEY);

if (process.env.DEFAULT_DEEPSEEK_API_KEY) {
  const apiKey = process.env.DEFAULT_DEEPSEEK_API_KEY;
  console.log('🔑 API密钥信息:');
  console.log('  - 前缀:', apiKey.substring(0, 8) + '...');
  console.log('  - 长度:', apiKey.length);
  console.log('  - 格式检查:', apiKey.startsWith('sk-') ? '✅ 正确' : '❌ 错误');
}

// 简单的健康检查路由
app.get('/api/health', (req, res) => {
  console.log('📡 收到健康检查请求');
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    env: {
      hasMongoUri: !!process.env.MONGODB_URI,
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasApiKey: !!process.env.DEFAULT_DEEPSEEK_API_KEY
    }
  });
});

// 根路由
app.get('/', (req, res) => {
  console.log('📱 收到根路径请求');
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>服务器测试</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 40px; }
            .success { color: green; }
            .error { color: red; }
        </style>
    </head>
    <body>
        <h1>🎯 Resume Analyzer 服务器测试</h1>
        <h2>状态检查</h2>
        <p class="success">✅ 服务器正常运行</p>
        <p class="success">✅ Express 应用启动成功</p>
        <p class="${process.env.MONGODB_URI ? 'success' : 'error'}">
            ${process.env.MONGODB_URI ? '✅' : '❌'} MongoDB URI 配置
        </p>
        <p class="${process.env.DEFAULT_DEEPSEEK_API_KEY ? 'success' : 'error'}">
            ${process.env.DEFAULT_DEEPSEEK_API_KEY ? '✅' : '❌'} DeepSeek API Key 配置
        </p>
        
        <h2>快速测试</h2>
        <button onclick="testHealth()">测试健康检查 API</button>
        <div id="result"></div>
        
        <script>
            async function testHealth() {
                try {
                    const response = await fetch('/api/health');
                    const data = await response.json();
                    document.getElementById('result').innerHTML = 
                        '<h3>API 测试结果:</h3><pre>' + JSON.stringify(data, null, 2) + '</pre>';
                } catch (error) {
                    document.getElementById('result').innerHTML = 
                        '<h3 style="color: red;">API 测试失败:</h3><p>' + error.message + '</p>';
                }
            }
        </script>
    </body>
    </html>
  `);
});

// 错误处理
app.use((error, req, res, next) => {
  console.error('❌ 服务器错误:', error);
  res.status(500).json({ error: '服务器内部错误' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log('=====================================');
  console.log(`🚀 简化版服务器启动成功!`);
  console.log(`📱 访问地址: http://localhost:${PORT}`);
  console.log(`🔧 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log('=====================================');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🛑 收到关闭信号，正在关闭服务器...');
  process.exit(0);
});