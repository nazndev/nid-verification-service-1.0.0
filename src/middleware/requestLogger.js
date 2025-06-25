const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const logger = require('../utils/logger');

const requestLogger = async (req, res, next) => {
    const startTime = Date.now();
    const requestId = uuidv4();
    
    // Add request ID to request object
    req.requestId = requestId;
    
    // Log request start
    logger.info(`Request started - ID: ${requestId}, Method: ${req.method}, Path: ${req.path}, IP: ${req.systemInfo?.ip || 'unknown'}, System: ${req.systemInfo?.systemName || 'unknown'}`);
    
    // Store original send method
    const originalSend = res.send;
    
    // Override send method to capture response
    res.send = function(data) {
        const processingTime = Date.now() - startTime;
        
        // Log the request details
        logRequestToDatabase(req, res, data, processingTime, requestId);
        
        // Call original send method
        return originalSend.call(this, data);
    };
    
    next();
};

const logRequestToDatabase = async (req, res, responseData, processingTime, requestId) => {
    try {
        const requestData = {
            nid: req.body?.nid || null,
            dateOfBirth: req.body?.dateOfBirth || null,
            nameEn: req.body?.nameEn || null
        };

        // Parse response data for JSON storage
        let parsedResponseData = null;
        if (responseData) {
            try {
                parsedResponseData = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
            } catch (e) {
                parsedResponseData = { raw: responseData };
            }
        }

        const logData = {
            request_id: requestId,
            client_ip: req.systemInfo?.ip || 'unknown',
            system_name: req.systemInfo?.systemName || 'unknown',
            nid: requestData.nid || 'N/A',
            request_data: requestData,
            response_data: parsedResponseData,
            status: res.statusCode < 400 ? 'SUCCESS' : 'ERROR',
            error_message: res.statusCode >= 400 ? (typeof responseData === 'string' ? responseData : JSON.stringify(responseData)) : null,
            processing_time_ms: processingTime
        };

        await db.run(`
            INSERT INTO request_logs 
            (request_id, client_ip, system_name, nid, request_data, response_data, status, error_message, processing_time_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            logData.request_id,
            logData.client_ip,
            logData.system_name,
            logData.nid,
            JSON.stringify(logData.request_data),
            JSON.stringify(logData.response_data),
            logData.status,
            logData.error_message,
            logData.processing_time_ms
        ]);

        logger.info(`Request completed - ID: ${requestId}, Status: ${res.statusCode}, Time: ${processingTime}ms`);
    } catch (error) {
        logger.error(`Failed to log request to database: ${error.message}`);
    }
};

module.exports = requestLogger; 