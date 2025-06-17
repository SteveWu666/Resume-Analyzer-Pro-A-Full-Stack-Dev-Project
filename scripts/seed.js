const mongoose = require('mongoose');
require('dotenv').config();

console.log('🔧 正在设置 MongoDB Atlas 数据库...');
console.log('🌐 连接到远程数据库...');

// 检查环境变量
if (!process.env.MONGODB_URI) {
  console.error('❌ 错误: MONGODB_URI 环境变量未设置');
  console.log('💡 请在 .env 文件中设置你的 MongoDB Atlas 连接字符串');
  process.exit(1);
}

// 显示连接信息 (隐藏密码)
let displayUri = process.env.MONGODB_URI.replace(/:([^:@]+)@/, ':***@');
console.log('📍 连接到:', displayUri);

// 连接到 MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function setupDatabase() {
  try {
    const db = mongoose.connection.db;
    
    console.log('📊 正在创建数据库索引...');
    
    // 为用户集合创建索引
    try {
      await db.collection('users').createIndex({ email: 1 }, { unique: true });
      console.log('✅ 用户邮箱唯一索引创建成功');
    } catch (error) {
      console.log('⚠️ 用户邮箱索引已存在或创建失败:', error.message);
    }
    
    // 为简历分析集合创建索引
    try {
      await db.collection('resumeanalyses').createIndex({ userId: 1, createdAt: -1 });
      console.log('✅ 简历分析用户索引创建成功');
    } catch (error) {
      console.log('⚠️ 简历分析用户索引已存在或创建失败:', error.message);
    }
    
    try {
      await db.collection('resumeanalyses').createIndex({ analysisType: 1 });
      console.log('✅ 简历分析类型索引创建成功');
    } catch (error) {
      console.log('⚠️ 简历分析类型索引已存在或创建失败:', error.message);
    }
    
    try {
      await db.collection('resumeanalyses').createIndex({ createdAt: -1 });
      console.log('✅ 简历分析日期索引创建成功');
    } catch (error) {
      console.log('⚠️ 简历分析日期索引已存在或创建失败:', error.message);
    }
    
    // 创建文本搜索索引
    try {
      await db.collection('resumeanalyses').createIndex({ 
        fileName: 'text', 
        analysis: 'text' 
      });
      console.log('✅ 文本搜索索引创建成功');
    } catch (error) {
      console.log('⚠️ 文本搜索索引已存在或创建失败:', error.message);
    }
    
    console.log('\n🎉 MongoDB Atlas 数据库设置完成!');
    console.log('📈 所有索引创建完成，性能已优化');
    console.log('🚀 现在可以启动应用: npm run dev');
    
    // 显示当前数据库统计信息
    try {
      const stats = await db.stats();
      console.log(`\n📊 数据库统计:`);
      console.log(`数据库名称: ${stats.db}`);
      console.log(`集合数量: ${stats.collections}`);
      console.log(`数据大小: ${(stats.dataSize / 1024).toFixed(2)} KB`);
      console.log(`存储大小: ${(stats.storageSize / 1024).toFixed(2)} KB`);
    } catch (error) {
      console.log('⚠️ 无法获取数据库统计信息:', error.message);
    }
    
    // 测试创建和查询操作
    console.log('\n🧪 测试数据库操作...');
    
    try {
      // 测试集合创建
      const testCollection = db.collection('test_connection');
      await testCollection.insertOne({ 
        test: true, 
        timestamp: new Date(),
        message: 'MongoDB Atlas 连接测试成功' 
      });
      
      const testDoc = await testCollection.findOne({ test: true });
      if (testDoc) {
        console.log('✅ 数据库读写测试成功');
        console.log('📝 测试文档:', testDoc.message);
      }
      
      // 清理测试数据
      await testCollection.deleteOne({ test: true });
      console.log('🧹 测试数据清理完成');
      
    } catch (error) {
      console.log('⚠️ 数据库操作测试失败:', error.message);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 数据库设置错误:', error);
    console.log('\n💡 故障排除步骤:');
    console.log('1. 检查 MongoDB Atlas 集群状态是否为运行中(绿色)');
    console.log('2. 验证 .env 文件中的 MONGODB_URI 连接字符串');
    console.log('3. 确认数据库用户名和密码正确');
    console.log('4. 检查 MongoDB Atlas 网络访问设置 (IP 白名单)');
    console.log('5. 验证网络连接是否正常');
    console.log('6. 检查集群是否有足够的存储空间');
    process.exit(1);
  }
}

// 数据库连接事件监听
mongoose.connection.on('connected', () => {
  console.log('🔌 成功连接到 MongoDB Atlas');
  console.log(`📍 主机: ${mongoose.connection.host}`);
  console.log(`📊 数据库: ${mongoose.connection.name}`);
  setupDatabase();
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB Atlas 连接错误:', err.message);
  console.log('\n💡 常见解决方案:');
  console.log('1. 检查网络连接');
  console.log('2. 验证 MONGODB_URI 格式是否正确');
  console.log('3. 确认 MongoDB Atlas 用户名和密码');
  console.log('4. 检查 IP 地址是否在白名单中');
  console.log('5. 确保集群正在运行且可访问');
  
  // 显示连接字符串格式示例
  console.log('\n📝 正确的连接字符串格式:');
  console.log('mongodb+srv://用户名:密码@cluster0.xxxxx.mongodb.net/resume_analyzer?retryWrites=true&w=majority');
  
  process.exit(1);
});

mongoose.connection.on('disconnected', () => {
  console.log('🔌 与 MongoDB Atlas 断开连接');
});

// 优雅关闭连接
process.on('SIGINT', async () => {
  console.log('\n🛑 正在关闭数据库连接...');
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB Atlas 连接已关闭');
  } catch (error) {
    console.error('❌ 关闭连接时出错:', error.message);
  }
  process.exit(0);
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的 Promise 拒绝:', reason);
  process.exit(1);
});