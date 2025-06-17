// 快速测试 DeepSeek API 密钥
require('dotenv').config();

const testAPI = async () => {
  try {
    const fetch = (await import('node-fetch')).default;
    const apiKey = process.env.DEFAULT_DEEPSEEK_API_KEY;
    
    console.log('🧪 测试 DeepSeek API 密钥...');
    console.log('🔑 API密钥:', apiKey ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}` : '未找到');
    
    if (!apiKey) {
      console.log('❌ 错误: .env 文件中没有找到 DEFAULT_DEEPSEEK_API_KEY');
      return;
    }
    
    if (!apiKey.startsWith('sk-')) {
      console.log('❌ 错误: API密钥格式不正确');
      return;
    }
    
    console.log('📡 正在测试 API 连接...');
    
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'user',
            content: 'Hello, please respond with just "API test successful"'
          }
        ],
        max_tokens: 10
      })
    });
    
    console.log('📊 响应状态码:', response.status);
    console.log('📊 响应状态文本:', response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API 测试成功!');
      console.log('📝 响应内容:', data.choices[0].message.content);
      
      // 检查配额信息
      if (response.headers.get('x-ratelimit-remaining')) {
        console.log('📈 剩余配额:', response.headers.get('x-ratelimit-remaining'));
      }
    } else {
      const errorText = await response.text();
      console.log('❌ API 测试失败');
      console.log('错误详情:', errorText);
      
      // 解析常见错误
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error) {
          console.log('🔍 错误类型:', errorData.error.type);
          console.log('🔍 错误信息:', errorData.error.message);
          
          if (errorData.error.type === 'authentication_error') {
            console.log('💡 建议: API密钥可能无效或已过期，请重新生成');
          } else if (errorData.error.type === 'insufficient_quota') {
            console.log('💡 建议: 账户配额不足，请检查 DeepSeek 账户余额');
          }
        }
      } catch (parseError) {
        console.log('⚠️ 无法解析错误响应');
      }
    }
    
  } catch (error) {
    console.log('❌ 测试过程中出错:', error.message);
    
    if (error.code === 'ENOTFOUND') {
      console.log('💡 建议: 检查网络连接或防火墙设置');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('💡 建议: DeepSeek 服务器可能暂时不可用');
    }
  }
};

// 运行测试
console.log('🎯 DeepSeek API 快速测试工具');
console.log('===============================\n');
testAPI();