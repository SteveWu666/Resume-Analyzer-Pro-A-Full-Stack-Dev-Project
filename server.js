const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const pdf = require('pdf-parse');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Starting Resume Analyzer Server...');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

console.log('✅ Middleware configured');

// Environment variables check
console.log('🔧 Environment Variables Check:');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);
console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
console.log('DEFAULT_DEEPSEEK_API_KEY exists:', !!process.env.DEFAULT_DEEPSEEK_API_KEY);

if (process.env.DEFAULT_DEEPSEEK_API_KEY) {
  const apiKey = process.env.DEFAULT_DEEPSEEK_API_KEY;
  console.log('🔑 DeepSeek API Key configured successfully');
  console.log('  - Prefix:', apiKey.substring(0, 8) + '...');
  console.log('  - Length:', apiKey.length);
  console.log('  - Format:', apiKey.startsWith('sk-') ? '✅ Valid' : '❌ Invalid');
} else {
  console.log('❌ Warning: DEFAULT_DEEPSEEK_API_KEY not configured - resume analysis will be unavailable');
}

// MongoDB Atlas connection configuration
const connectDB = async () => {
  try {
    console.log('🔌 Connecting to MongoDB Atlas...');
    
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });
    
    console.log('✅ Successfully connected to MongoDB Atlas');
    console.log(`📍 Database host: ${conn.connection.host}`);
    console.log(`📊 Database name: ${conn.connection.name}`);
    
    if (conn.connection.name !== 'resume_analyzer') {
      console.log('⚠️ Warning: Database name is not resume_analyzer');
    }
    
    return true;
  } catch (error) {
    console.error('❌ MongoDB Atlas connection failed:', error.message);
    console.log('💡 Starting server in offline mode (limited functionality)');
    return false;
  }
};

// Simplified User Schema (removed deepseekApiKey field)
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Resume Analysis Schema
const resumeAnalysisSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  analysisType: { type: String, required: true },
  extractedText: { type: String, required: true },
  analysis: { type: String, required: true },
  score: { type: Number },
  tags: [String],
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const ResumeAnalysis = mongoose.model('ResumeAnalysis', resumeAnalysisSchema);

// File upload configuration
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'), false);
    }
  }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// DeepSeek API helper function - English version
const analyzeWithDeepSeek = async (prompt) => {
  try {
    const fetch = (await import('node-fetch')).default;
    
    // Check if API key is configured
    if (!process.env.DEFAULT_DEEPSEEK_API_KEY) {
      throw new Error('DeepSeek API key not configured');
    }
    
    console.log('🔗 Calling DeepSeek API...');
    
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEFAULT_DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are an expert HR professional. Use the following scoring criteria: Score Range: 90-100 (Excellent), 80-89 (Very Good), 70-79 (Good), 60-69 (Fair), 50-59 (Needs Work), <50 (Poor). For Comprehensive Analysis, evaluate: Content Quality (25%), Achievement Demo (20%), Format (15%), ATS Optimization (15%), Language (15%), Completeness (10%). Provide specific scores for each category and overall score.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ DeepSeek API Error:', errorData);
      throw new Error(`DeepSeek API Error: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ DeepSeek API call successful');
    return data.choices[0].message.content;
  } catch (error) {
    console.error('❌ DeepSeek API call failed:', error);
    throw new Error(`Analysis failed: ${error.message}`);
  }
};

// API Routes

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString(),
    hasDefaultApiKey: !!process.env.DEFAULT_DEEPSEEK_API_KEY
  });
});

// Simplified user registration (removed API key field)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    console.log('📝 Registration request received:', { email, name });

    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection unavailable' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user (without API key)
    const user = new User({
      email,
      password: hashedPassword,
      name
    });

    await user.save();
    console.log('✅ User created successfully:', user.email);

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: user._id, email: user.email, name: user.name }
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// User login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Login request received:', { email });

    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection unavailable' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    console.log('✅ User logged in successfully:', user.email);

    res.json({
      message: 'Login successful',
      token,
      user: { 
        id: user._id, 
        email: user.email, 
        name: user.name
      }
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Simplified resume analysis route (only uses default API key)
app.post('/api/analyze', authenticateToken, upload.single('resume'), async (req, res) => {
  try {
    const { analysisType } = req.body;
    
    console.log('📋 Resume analysis request received:', { 
      userId: req.user.userId, 
      analysisType,
      fileName: req.file?.originalname
    });

    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required' });
    }

    // Check if default API key is configured
    if (!process.env.DEFAULT_DEEPSEEK_API_KEY) {
      console.log('❌ DEFAULT_DEEPSEEK_API_KEY not configured');
      return res.status(500).json({ 
        error: 'AI analysis service not configured. Please contact administrator.' 
      });
    }

    // Validate API key format
    if (!process.env.DEFAULT_DEEPSEEK_API_KEY.startsWith('sk-')) {
      console.log('❌ Default API key format error');
      return res.status(500).json({ 
        error: 'System configuration error. Please contact administrator.' 
      });
    }

    console.log('🔑 Using system default API key for analysis');

    // Extract text from PDF
    console.log('📄 Extracting text from PDF...');
    const pdfData = await pdf(req.file.buffer);
    const extractedText = pdfData.text;

    if (!extractedText.trim()) {
      return res.status(400).json({ error: 'Could not extract text from PDF' });
    }

    console.log('✅ PDF text extraction successful, length:', extractedText.length);

    // Generate analysis prompts - English version
    const prompts = {
      comprehensive: `Please conduct a comprehensive analysis of this resume. Provide detailed feedback on:

1. **Overall Impression & Strengths**
   - First impression when reviewing the resume
   - Key strengths and standout qualities
   - Most compelling aspects of the candidate's profile

2. **Areas for Improvement**
   - Specific sections that need enhancement
   - Missing information that should be included
   - Content that could be better organized or presented

3. **Skills Assessment**
   - Technical skills relevance and depth
   - Soft skills presentation and evidence
   - Skills gaps for the candidate's target roles
   - Recommendations for skill development

4. **Experience Evaluation**
   - Career progression and growth trajectory
   - Achievement descriptions and quantifiable impact
   - Relevance to target positions
   - Work experience presentation quality

5. **Format & Structure Analysis**
   - Overall layout and visual appeal
   - Section organization and flow
   - Readability and professional presentation
   - ATS (Applicant Tracking System) compatibility

6. **Specific Recommendations**
   - Actionable steps to improve the resume
   - Industry-specific suggestions
   - Content optimization strategies

7. **Overall Score (1-100)**

Resume Content:
${extractedText}`,

      skills: `Please focus specifically on analyzing the skills section of this resume. Provide detailed evaluation on:

1. **Technical Skills Analysis**
   - Relevance of listed technical skills to target roles
   - Depth and breadth of technical expertise
   - Current vs. outdated technologies
   - Skill categorization and organization

2. **Soft Skills Presentation**
   - How soft skills are demonstrated through examples
   - Evidence and context provided for soft skills claims
   - Balance between technical and interpersonal skills

3. **Skills Gaps & Opportunities**
   - Missing skills that are highly valued in the candidate's field
   - Emerging technologies or methodologies to consider
   - Skills that could be better highlighted or repositioned

4. **Skills Organization & Presentation**
   - Clarity and structure of skills section
   - Use of categories, levels, or proficiency indicators
   - Visual presentation and readability

5. **Industry Alignment**
   - How well skills align with current industry demands
   - Competitive advantage of the skill set
   - Market relevance and transferability

6. **Improvement Recommendations**
   - Specific skills to add, remove, or reorganize
   - Ways to better demonstrate skill proficiency
   - Strategic skill development suggestions

7. **Skills Score (1-100)**

Resume Content:
${extractedText}`,

      experience: `Please analyze the work experience section of this resume in detail. Focus on:

1. **Career Progression Analysis**
   - Logical career advancement and growth trajectory
   - Role progression and increasing responsibilities
   - Career transitions and their strategic value
   - Timeline consistency and employment gaps

2. **Achievement Descriptions & Impact**
   - Quality of accomplishment statements
   - Use of quantifiable metrics and results
   - Demonstration of value delivered to employers
   - Evidence of problem-solving and initiative

3. **Relevance to Target Roles**
   - Alignment with likely career objectives
   - Transferable skills and experiences
   - Industry experience and domain knowledge
   - Leadership and collaboration examples

4. **Content Quality & Presentation**
   - Clarity and conciseness of descriptions
   - Use of strong action verbs and professional language
   - Consistency in formatting and style
   - Appropriate level of detail for each role

5. **Professional Brand & Narrative**
   - Coherent professional story and positioning
   - Unique value proposition demonstration
   - Consistency with overall career theme

6. **Areas of Concern**
   - Employment gaps or frequent job changes
   - Lack of progression or stagnation indicators
   - Missing context or insufficient detail
   - Potential red flags for employers

7. **Strategic Recommendations**
   - How to better position work experience
   - Content to add, modify, or remove
   - Ways to strengthen achievement statements

8. **Experience Score (1-100)**

Resume Content:
${extractedText}`,

      formatting: `Please evaluate the format and structure of this resume with focus on:

1. **Overall Layout & Visual Appeal**
   - Professional appearance and first impression
   - Use of white space and visual hierarchy
   - Font choices, sizing, and consistency
   - Overall design aesthetic and modern appeal

2. **Section Organization & Flow**
   - Logical order and progression of sections
   - Appropriate section headers and transitions
   - Information architecture and user experience
   - Strategic placement of key information

3. **Readability & Accessibility**
   - Ease of scanning and information retrieval
   - Text density and paragraph structure
   - Use of bullet points and formatting elements
   - Clarity of contact information and key details

4. **Professional Standards**
   - Adherence to industry formatting conventions
   - Appropriate length and content density
   - Consistency in style and presentation
   - Professional tone and language usage

5. **ATS (Applicant Tracking System) Compatibility**
   - Machine-readable format considerations
   - Keyword optimization and placement
   - Section headers and standard terminology
   - File format and technical compatibility

6. **Content Structure & Hierarchy**
   - Information prioritization and emphasis
   - Strategic use of formatting for key points
   - Balance between sections and content areas
   - Effective use of formatting to guide attention

7. **Industry & Role Appropriateness**
   - Format suitability for target industries
   - Creative vs. conservative formatting choices
   - Alignment with professional expectations

8. **Specific Formatting Recommendations**
   - Concrete suggestions for layout improvements
   - Technical formatting adjustments
   - Content reorganization strategies

9. **Format Score (1-100)**

Resume Content:
${extractedText}`
    };

    // Analyze with DeepSeek
    const analysis = await analyzeWithDeepSeek(prompts[analysisType]);
    
    // Extract score from analysis results
    const scoreMatch = analysis.match(/(?:score|rating)[:\s]*(\d+)/i) || 
                      analysis.match(/(\d+)\/100/i) ||
                      analysis.match(/(\d+)\s*out\s*of\s*100/i) ||
                      analysis.match(/(\d+)\s*points/i);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : null;

    console.log('✅ Analysis completed, score:', score);

    // Save to database
    let analysisId = null;
    if (mongoose.connection.readyState === 1) {
      try {
        const resumeAnalysis = new ResumeAnalysis({
          userId: req.user.userId,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          analysisType,
          extractedText: extractedText.substring(0, 2000),
          analysis,
          score,
          tags: [analysisType]
        });

        await resumeAnalysis.save();
        analysisId = resumeAnalysis._id;
        console.log('💾 Analysis results saved to database');
      } catch (dbError) {
        console.log('⚠️ Database save failed, but analysis successful');
      }
    }

    res.json({
      success: true,
      analysis: {
        id: analysisId,
        fileName: req.file.originalname,
        analysisType,
        analysis,
        score,
        createdAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Analysis error:', error);
    res.status(500).json({ error: error.message || 'Analysis failed' });
  }
});

// Get resume history
app.get('/api/history', authenticateToken, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection unavailable' });
    }

    const { page = 1, limit = 10, analysisType } = req.query;
    
    const query = { userId: req.user.userId };
    if (analysisType && analysisType !== 'all') {
      query.analysisType = analysisType;
    }

    const analyses = await ResumeAnalysis.find(query)
      .select('-extractedText')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ResumeAnalysis.countDocuments(query);

    res.json({
      analyses,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('❌ History fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Get single analysis result
app.get('/api/analysis/:id', authenticateToken, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(404).json({ error: 'Database connection unavailable' });
    }

    const analysis = await ResumeAnalysis.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    res.json(analysis);
  } catch (error) {
    console.error('❌ Analysis fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch analysis' });  
  }
});

// Delete analysis record
app.delete('/api/analysis/:id', authenticateToken, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection unavailable' });
    }

    const result = await ResumeAnalysis.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!result) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    console.log('🗑️ Analysis record deleted successfully:', req.params.id);
    res.json({ message: 'Analysis deleted successfully' });
  } catch (error) {
    console.error('❌ Delete error:', error);
    res.status(500).json({ error: 'Failed to delete analysis' });
  }
});

// Get dashboard statistics
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        totalAnalyses: 0,
        analysisTypeStats: [],
        averageScore: 0,
        recentAnalyses: []
      });
    }

    const userId = req.user.userId;
    
    const totalAnalyses = await ResumeAnalysis.countDocuments({ userId });
    
    const analysisTypeStats = await ResumeAnalysis.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: '$analysisType', count: { $sum: 1 } } }
    ]);

    const averageScore = await ResumeAnalysis.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), score: { $ne: null } } },
      { $group: { _id: null, avgScore: { $avg: '$score' } } }
    ]);

    const recentAnalyses = await ResumeAnalysis.find({ userId })
      .select('fileName analysisType score createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      totalAnalyses,
      analysisTypeStats,
      averageScore: averageScore[0]?.avgScore || 0,
      recentAnalyses
    });
  } catch (error) {
    console.error('❌ Dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Serve frontend files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
  }
  console.error('❌ Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, async () => {
  console.log('=====================================');
  console.log(`🚀 Server started successfully!`);
  console.log(`📱 Access URL: http://localhost:${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('=====================================');
  
  // Connect to database asynchronously
  const dbConnected = await connectDB();
  if (dbConnected) {
    console.log('🎉 All services started successfully!');
  } else {
    console.log('⚠️ Server started but database connection failed (limited functionality)');
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutdown signal received...');
  try {
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.log('⚠️ Error closing database connection');
  }
  process.exit(0);
});