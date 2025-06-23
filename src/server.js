require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const ipWhitelist = require('./middleware/ipWhitelist');
const requestLogger = require('./middleware/requestLogger');
const nidRoutes = require('./routes/nidRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
    origin: false, // Disable CORS for security since we're using IP whitelist
    credentials: true
}));

// Trust proxy configuration - only trust specific proxies
app.set('trust proxy', (ip) => {
    // Trust localhost and private IP ranges
    return ip === '127.0.0.1' || 
           ip === '::1' || 
           ip.startsWith('10.') || 
           ip.startsWith('192.168.') || 
           ip.startsWith('172.16.') || 
           ip.startsWith('172.17.') || 
           ip.startsWith('172.18.') || 
           ip.startsWith('172.19.') || 
           ip.startsWith('172.20.') || 
           ip.startsWith('172.21.') || 
           ip.startsWith('172.22.') || 
           ip.startsWith('172.23.') || 
           ip.startsWith('172.24.') || 
           ip.startsWith('172.25.') || 
           ip.startsWith('172.26.') || 
           ip.startsWith('172.27.') || 
           ip.startsWith('172.28.') || 
           ip.startsWith('172.29.') || 
           ip.startsWith('172.30.') || 
           ip.startsWith('172.31.');
});

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
    message: {
        success: false,
        error: 'Too many requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use the real IP address for rate limiting
        return req.ip || req.connection.remoteAddress || 'unknown';
    }
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Custom middleware
app.use(ipWhitelist);
app.use(requestLogger);

// Routes
app.use('/api/nid', nidRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'NID Verification Service API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
            verify: 'POST /api/nid/verify',
            health: 'GET /api/nid/health',
            status: 'GET /api/nid/status'
        }
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        code: 'ENDPOINT_NOT_FOUND',
        timestamp: new Date().toISOString()
    });
});

// Global error handler
app.use((error, req, res, next) => {
    logger.error('Unhandled error:', error);
    
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
});

// Start server
app.listen(PORT, () => {
    logger.info(`NID Verification Service started on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Health check available at: http://localhost:${PORT}/api/nid/health`);
});

module.exports = app; 