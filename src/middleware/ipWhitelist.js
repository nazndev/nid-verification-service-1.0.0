const db = require('../config/database');
const logger = require('../utils/logger');

const ipWhitelist = async (req, res, next) => {
    try {
        const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 
                        (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
                        (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : null);

        logger.info(`Request from IP: ${clientIP}`);

        // Check if IP is in whitelist
        const allowedIP = await db.get(
            'SELECT * FROM allowed_ips WHERE ip_address = ? AND is_active = 1',
            [clientIP]
        );

        if (!allowedIP) {
            logger.warn(`Access denied for IP: ${clientIP}`);
            return res.status(403).json({
                success: false,
                error: 'Access denied. Your IP address is not authorized to access this service.',
                code: 'IP_NOT_AUTHORIZED'
            });
        }

        // Add system information to request for logging
        req.systemInfo = {
            ip: clientIP,
            systemName: allowedIP.system_name,
            description: allowedIP.description
        };

        logger.info(`Access granted for IP: ${clientIP} (${allowedIP.system_name})`);
        next();
    } catch (error) {
        logger.error('Error in IP whitelist middleware:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error during IP validation',
            code: 'IP_VALIDATION_ERROR'
        });
    }
};

module.exports = ipWhitelist; 