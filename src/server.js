const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const { Server } = require('socket.io');

const path = require('path');

// Load environment variables explicitly from backend root
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('./config/db');
const { initializeSocket } = require('./socket/socketHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

// Import routes
const authRoutes = require('./routes/authRoutes');
const childRoutes = require('./routes/childRoutes');
const storyRoutes = require('./routes/storyRoutes');

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const io = new Server(server, {
  cors: {
    origin: [
      clientUrl,
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'https://childrenstorybooksgenerator.vercel.app',
      /childrenstorybooksgenerator.*\.vercel\.app$/,
    ],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  },
});
initializeSocket(io);

// Security & Utility Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl) or matching clientUrl/localhost
    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1') || origin === clientUrl) {
      return callback(null, true);
    }
    return callback(null, true); // Dev-friendly
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// Global API rate limiting
app.use('/api', apiLimiter);

// Root and Health check endpoints (for Render / Vercel uptime checks)
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'AI Storybook Backend',
    message: 'Backend server is running smoothly! ✨',
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'AI Storybook Backend',
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/children', childRoutes);
app.use('/api/stories', storyRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Global Error Handler]', err.stack || err.message);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'An unexpected server error occurred',
  });
});

// 404 Route Handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint ${req.originalUrl} not found`,
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`✨ AI Storybook Generator Backend Online! ✨`);
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`🔌 Socket.io ready for live story progress`);
  console.log(`=============================================`);
});

module.exports = { app, server };
