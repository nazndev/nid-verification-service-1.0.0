const axios = require('axios');
const logger = require('../utils/logger');

class NIDService {
    constructor() {
        this.baseURL = process.env.NID_SERVICE_BASE_URL;
        this.username = process.env.NID_SERVICE_USERNAME;
        this.password = process.env.NID_SERVICE_PASSWORD;
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    async authenticate() {
        try {
            const response = await axios.post(`${this.baseURL}/auth/login`, {
                username: this.username,
                password: this.password
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.data.status === 'OK' && response.data.success?.data?.access_token) {
                this.accessToken = response.data.success.data.access_token;
                // Set token expiry (assuming 1 hour from now, adjust based on actual token expiry)
                this.tokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
                logger.info('Successfully authenticated with NID service');
                return true;
            } else {
                throw new Error('Authentication failed: Invalid response format');
            }
        } catch (error) {
            logger.error('Authentication failed:', error.message);
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }

    async ensureValidToken() {
        if (!this.accessToken || (this.tokenExpiry && new Date() >= this.tokenExpiry)) {
            await this.authenticate();
        }
    }

    async verifyNID(nid, dateOfBirth, nameEn) {
        try {
            await this.ensureValidToken();

            // Determine NID type based on length
            const nidType = nid.length === 17 ? 'nid17Digit' : 'nid10Digit';
            
            const requestPayload = {
                identify: {
                    [nidType]: nid
                },
                verify: {
                    nameEn: nameEn,
                    dateOfBirth: dateOfBirth
                }
            };

            logger.info(`Verifying NID: ${nid} (${nidType})`);

            const response = await axios.post(
                `${this.baseURL}/voter/demographic/verification`,
                requestPayload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );

            if (response.data.status === 'OK') {
                const result = {
                    success: true,
                    verified: response.data.success?.verified || false,
                    data: response.data.success?.data || {},
                    fieldVerificationResult: response.data.success?.fieldVerificationResult || {}
                };
                
                logger.info(`NID verification successful for ${nid}`);
                return result;
            } else {
                throw new Error(`Verification failed: ${response.data.statusCode || 'Unknown error'}`);
            }
        } catch (error) {
            logger.error(`NID verification failed for ${nid}:`, error.message);
            
            // If it's an authentication error, try to re-authenticate once
            if (error.response?.status === 401) {
                logger.info('Token expired, attempting re-authentication...');
                this.accessToken = null;
                this.tokenExpiry = null;
                return await this.verifyNID(nid, dateOfBirth, nameEn);
            }
            
            throw new Error(`NID verification failed: ${error.message}`);
        }
    }

    validateNID(nid) {
        if (!nid || typeof nid !== 'string') {
            return { valid: false, error: 'NID is required and must be a string' };
        }

        const cleanNID = nid.replace(/\s/g, '');
        
        if (cleanNID.length !== 10 && cleanNID.length !== 17) {
            return { valid: false, error: 'NID must be either 10 or 17 digits' };
        }

        if (!/^\d+$/.test(cleanNID)) {
            return { valid: false, error: 'NID must contain only digits' };
        }

        return { valid: true, nid: cleanNID };
    }

    validateDateOfBirth(dateOfBirth) {
        if (!dateOfBirth) {
            return { valid: false, error: 'Date of birth is required' };
        }

        const date = new Date(dateOfBirth);
        if (isNaN(date.getTime())) {
            return { valid: false, error: 'Invalid date format. Use YYYY-MM-DD' };
        }

        const today = new Date();
        if (date > today) {
            return { valid: false, error: 'Date of birth cannot be in the future' };
        }

        // Check if person is at least 18 years old
        const minAge = new Date();
        minAge.setFullYear(minAge.getFullYear() - 18);
        if (date > minAge) {
            return { valid: false, error: 'Person must be at least 18 years old' };
        }

        return { valid: true, date: dateOfBirth };
    }

    validateNameEn(nameEn) {
        if (!nameEn || typeof nameEn !== 'string') {
            return { valid: false, error: 'Name is required and must be a string' };
        }

        const cleanName = nameEn.trim();
        if (cleanName.length < 2) {
            return { valid: false, error: 'Name must be at least 2 characters long' };
        }

        if (cleanName.length > 100) {
            return { valid: false, error: 'Name must be less than 100 characters' };
        }

        // Basic validation for English characters, spaces, dots, and common punctuation
        if (!/^[a-zA-Z\s\.\-']+$/.test(cleanName)) {
            return { valid: false, error: 'Name contains invalid characters' };
        }

        return { valid: true, name: cleanName };
    }
}

module.exports = new NIDService(); 