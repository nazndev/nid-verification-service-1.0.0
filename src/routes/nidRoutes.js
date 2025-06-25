const express = require('express');
const { body, validationResult } = require('express-validator');
const nidService = require('../services/nidService');
const logger = require('../utils/logger');

const router = express.Router();

// Validation rules
const validationRules = [
    body('nid')
        .notEmpty()
        .withMessage('NID is required')
        .isString()
        .withMessage('NID must be a string')
        .custom((value) => {
            const cleanNID = value.replace(/\s/g, '');
            if (cleanNID.length !== 10 && cleanNID.length !== 17) {
                throw new Error('NID must be either 10 or 17 digits');
            }
            if (!/^\d+$/.test(cleanNID)) {
                throw new Error('NID must contain only digits');
            }
            return true;
        }),
    body('dateOfBirth')
        .notEmpty()
        .withMessage('Date of birth is required')
        .isISO8601()
        .withMessage('Date of birth must be in YYYY-MM-DD format')
        .custom((value) => {
            const date = new Date(value);
            const today = new Date();
            if (date > today) {
                throw new Error('Date of birth cannot be in the future');
            }
            
            // Check if person is at least 18 years old
            const minAge = new Date();
            minAge.setFullYear(minAge.getFullYear() - 18);
            if (date > minAge) {
                throw new Error('Person must be at least 18 years old');
            }
            return true;
        }),
    body('nameEn')
        .notEmpty()
        .withMessage('Name is required')
        .isString()
        .withMessage('Name must be a string')
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s\.\-']+$/)
        .withMessage('Name contains invalid characters. Only English letters, spaces, dots, hyphens, and apostrophes are allowed')
];

/**
 * @route POST /api/nid/verify
 * @desc Verify NID with external service
 * @access Private (IP whitelisted)
 */
router.post('/verify', validationRules, async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array(),
                code: 'VALIDATION_ERROR'
            });
        }

        const { nid, dateOfBirth, nameEn } = req.body;
        
        logger.info(`NID verification request - ID: ${req.requestId}, NID: ${nid}, System: ${req.systemInfo?.systemName}`);

        // Clean the NID (remove spaces)
        const cleanNID = nid.replace(/\s/g, '');
        
        // Determine NID type for logging
        const nidType = cleanNID.length === 17 ? '17-digit' : '10-digit';
        logger.info(`Processing ${nidType} NID: ${cleanNID}`);

        // Call the NID service
        const result = await nidService.verifyNID(cleanNID, dateOfBirth, nameEn);

        // Prepare response
        const response = {
            success: true,
            requestId: req.requestId,
            data: {
                nid: cleanNID,
                nidType: nidType,
                verified: result.verified,
                verificationDetails: {
                    nameEn: result.fieldVerificationResult?.nameEn || false,
                    dateOfBirth: result.fieldVerificationResult?.dateOfBirth || false
                },
                personDetails: result.data || {}
            },
            timestamp: new Date().toISOString(),
            system: req.systemInfo?.systemName
        };

        // Add message if verification data doesn't match
        if (result.message) {
            response.message = result.message;
        }

        logger.info(`NID verification completed successfully - ID: ${req.requestId}, Verified: ${result.verified}`);
        
        return res.status(200).json(response);

    } catch (error) {
        logger.error(`NID verification failed - ID: ${req.requestId}, Error: ${error.message}`);
        
        // Determine appropriate error response
        let statusCode = 500;
        let errorCode = 'INTERNAL_ERROR';
        
        if (error.message.includes('Authentication failed')) {
            statusCode = 503;
            errorCode = 'SERVICE_UNAVAILABLE';
        } else if (error.message.includes('Verification failed')) {
            statusCode = 400;
            errorCode = 'VERIFICATION_FAILED';
        }

        return res.status(statusCode).json({
            success: false,
            error: error.message,
            code: errorCode,
            requestId: req.requestId,
            timestamp: new Date().toISOString(),
            system: req.systemInfo?.systemName
        });
    }
});

/**
 * @route GET /api/nid/health
 * @desc Health check endpoint
 * @access Private (IP whitelisted)
 */
router.get('/health', async (req, res) => {
    try {
        // Test external service connectivity
        await nidService.ensureValidToken();
        
        return res.status(200).json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
            service: 'NID Verification Service',
            externalService: 'connected'
        });
    } catch (error) {
        logger.error(`Health check failed: ${error.message}`);
        return res.status(503).json({
            success: false,
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString(),
            service: 'NID Verification Service',
            externalService: 'disconnected'
        });
    }
});

/**
 * @route GET /api/nid/status
 * @desc Get service status and statistics
 * @access Private (IP whitelisted)
 */
router.get('/status', async (req, res) => {
    try {
        const db = require('../config/database');
        
        // Get basic statistics
        const totalRequests = await db.get('SELECT COUNT(*) as count FROM request_logs');
        const successRequests = await db.get('SELECT COUNT(*) as count FROM request_logs WHERE status = "SUCCESS"');
        const errorRequests = await db.get('SELECT COUNT(*) as count FROM request_logs WHERE status = "ERROR"');
        const avgProcessingTime = await db.get('SELECT AVG(processing_time_ms) as avg_time FROM request_logs WHERE processing_time_ms IS NOT NULL');
        
        return res.status(200).json({
            success: true,
            status: 'operational',
            timestamp: new Date().toISOString(),
            statistics: {
                totalRequests: totalRequests.count,
                successRequests: successRequests.count,
                errorRequests: errorRequests.count,
                successRate: totalRequests.count > 0 ? ((successRequests.count / totalRequests.count) * 100).toFixed(2) + '%' : '0%',
                averageProcessingTime: avgProcessingTime.avg_time ? Math.round(avgProcessingTime.avg_time) + 'ms' : 'N/A'
            }
        });
    } catch (error) {
        logger.error(`Status check failed: ${error.message}`);
        return res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router; 