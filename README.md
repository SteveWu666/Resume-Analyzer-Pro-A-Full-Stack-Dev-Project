# Resume Analyzer Pro

AI-powered resume analysis tool that provides professional feedback and scoring using DeepSeek AI.

## Features

- **AI Analysis**: 4 analysis types (Comprehensive, Skills, Experience, Formatting)
- **Smart Scoring**: 1-100 score with detailed feedback
- **User Dashboard**: Analysis history and statistics
- **Responsive Design**: Works on all devices
- **PDF Processing**: Upload and analyze PDF resumes instantly

## Tech Stack

**Backend**: Node.js, Express, MongoDB, JWT  
**Frontend**: Vanilla JavaScript, HTML5, CSS3  
**AI**: DeepSeek API with custom prompts  
**Deployment**: Vercel + MongoDB Atlas

## Quick Start

```bash
git clone https://github.com/yourusername/resume-analyzer-pro.git
cd resume-analyzer-pro
npm install
cp .env.example .env
# Configure your environment variables
npm start
```

## Environment Variables

```env
MONGODB_URI=your-mongodb-connection
JWT_SECRET=your-jwt-secret
DEFAULT_DEEPSEEK_API_KEY=your-deepseek-key
```

## Key Highlights

- Professional HR-level analysis using custom AI prompts
- Secure user authentication and data storage
- Real-time PDF processing and text extraction
- Mobile-responsive design with smooth UX
- Comprehensive error handling and validation

## API Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/analyze` - Resume analysis
- `GET /api/dashboard` - User statistics
- `GET /api/history` - Analysis history
