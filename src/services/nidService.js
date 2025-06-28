const axios = require('axios');
const logger = require('../utils/logger');
const { fetchImageAsBase64, isValidImageUrl } = require('../utils/imageUtils');

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
            logger.info(`Attempting authentication with username: ${this.username}`);
            logger.info(`Base URL: ${this.baseURL}`);
            
            const authPayload = {
                username: this.username,
                password: this.password
            };
            
            logger.info('Authentication payload prepared (password hidden)');
            
            const response = await axios.post(`${this.baseURL}/auth/login`, authPayload, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'NID-Verification-Service/1.0.0'
                },
                timeout: 30000,
                validateStatus: (status) => status < 500 // Accept all status codes below 500
            });

            logger.info(`Authentication response received - Status: ${response.status}`);
            logger.info(`Response data: ${JSON.stringify(response.data, null, 2)}`);

            if (response.data.status === 'OK' && response.data.success?.data?.access_token) {
                this.accessToken = response.data.success.data.access_token;
                // Set token expiry (assuming 1 hour from now, adjust based on actual token expiry)
                this.tokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
                logger.info('Successfully authenticated with NID service');
                return true;
            } else {
                logger.error('Authentication failed: Invalid response format');
                logger.error(`Expected status: OK, got: ${response.data.status}`);
                logger.error(`Expected access_token, got: ${response.data.success?.data?.access_token ? 'present' : 'missing'}`);
                throw new Error('Authentication failed: Invalid response format');
            }
        } catch (error) {
            logger.error('Authentication failed with error:', error.message);
            
            if (error.response) {
                logger.error(`Response status: ${error.response.status}`);
                logger.error(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
                logger.error(`Response headers: ${JSON.stringify(error.response.headers, null, 2)}`);
            } else if (error.request) {
                logger.error('No response received from server');
                logger.error(`Request details: ${JSON.stringify(error.request, null, 2)}`);
            } else {
                logger.error('Error setting up request:', error.message);
            }
            
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
                        'Authorization': `Bearer ${this.accessToken}`,
                        'User-Agent': 'NID-Verification-Service/1.0.0'
                    },
                    timeout: 30000,
                    validateStatus: (status) => status < 500 // Accept all status codes below 500
                }
            );

            // Handle different response status codes
            if (response.status === 406) {
                // 406 means the verification data doesn't match, but we can still get field-level results
                logger.warn(`NID verification data mismatch for ${nid}: Name or DOB doesn't match records`);
                logger.info(`406 Response field results:`, response.data.fieldVerificationResult);
                
                const result = {
                    success: true,
                    verified: response.data.verified || false,
                    data: response.data.data || {},
                    fieldVerificationResult: response.data.fieldVerificationResult || {
                        nameEn: false,
                        dateOfBirth: false
                    },
                    message: 'NID found but verification data does not match'
                };

                // Process photo if available
                if (result.data.photo) {
                    await this.processPhoto(result.data);
                }

                return result;
            }

            if (response.data.status === 'OK') {
                logger.info(`External API response for ${nid}:`, JSON.stringify(response.data, null, 2));
                logger.info(`Response status: ${response.status}`);
                logger.info(`Response data keys:`, Object.keys(response.data));
                logger.info(`Success object keys:`, response.data.success ? Object.keys(response.data.success) : 'No success object');
                
                const result = {
                    success: true,
                    verified: response.data.verified || false,
                    data: response.data.success?.data || {},
                    fieldVerificationResult: response.data.fieldVerificationResult || {}
                };
                
                // Process photo if available
                if (result.data.photo) {
                    await this.processPhoto(result.data);
                }
                
                logger.info(`Parsed result - Verified: ${result.verified}, Field Results:`, result.fieldVerificationResult);
                logger.info(`Full result object:`, JSON.stringify(result, null, 2));
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
            
            // Handle 406 status code from axios error
            if (error.response?.status === 406) {
                logger.warn(`NID verification data mismatch for ${nid}: Name or DOB doesn't match records`);
                logger.info(`406 Error Response field results:`, error.response.data.fieldVerificationResult);
                
                const result = {
                    success: true,
                    verified: error.response.data.verified || false,
                    data: error.response.data.data || {},
                    fieldVerificationResult: error.response.data.fieldVerificationResult || {
                        nameEn: false,
                        dateOfBirth: false
                    },
                    message: 'NID found but verification data does not match'
                };

                // Process photo if available
                if (result.data.photo) {
                    await this.processPhoto(result.data);
                }

                return result;
            }
            
            throw new Error(`NID verification failed: ${error.message}`);
        }
    }

    /**
     * Processes the photo URL by fetching the image and converting it to base64
     * @param {Object} personData - The person data object containing the photo URL
     */
    async processPhoto(personData) {
        try {
            if (!personData.photo || !isValidImageUrl(personData.photo)) {
                logger.warn(`Invalid or missing photo URL: ${personData.photo}`);
                return;
            }

            logger.info(`Processing photo for NID verification`);
            
            // Fetch and convert photo to base64
            const base64Photo = await fetchImageAsBase64(personData.photo);
            
            // Replace the photo URL with base64 data
            personData.photo = base64Photo;
            
            logger.info(`Successfully processed photo and converted to base64`);
        } catch (error) {
            logger.error(`Failed to process photo: ${error.message}`);
            // Keep the original photo URL if processing fails
            // Don't throw error to avoid breaking the main verification flow
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