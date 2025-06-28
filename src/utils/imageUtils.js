const axios = require('axios');
const logger = require('./logger');

/**
 * Fetches an image from a URL and converts it to base64
 * @param {string} imageUrl - The URL of the image to fetch
 * @returns {Promise<string>} - Base64 encoded image data
 */
async function fetchImageAsBase64(imageUrl) {
    try {
        logger.info(`Fetching image from URL: ${imageUrl}`);
        
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: {
                'User-Agent': 'NID-Verification-Service/1.0.0'
            }
        });

        // Get the content type from response headers
        const contentType = response.headers['content-type'] || 'image/jpeg';
        
        // Convert the image buffer to base64
        const base64Image = Buffer.from(response.data, 'binary').toString('base64');
        
        // Create the data URL format
        const dataUrl = `data:${contentType};base64,${base64Image}`;
        
        logger.info(`Successfully converted image to base64. Size: ${base64Image.length} characters`);
        
        return dataUrl;
    } catch (error) {
        logger.error(`Failed to fetch image from ${imageUrl}: ${error.message}`);
        
        if (error.response) {
            logger.error(`Response status: ${error.response.status}`);
            logger.error(`Response headers: ${JSON.stringify(error.response.headers)}`);
        }
        
        throw new Error(`Failed to fetch image: ${error.message}`);
    }
}

/**
 * Validates if a URL is a valid image URL
 * @param {string} url - The URL to validate
 * @returns {boolean} - True if the URL is valid
 */
function isValidImageUrl(url) {
    try {
        const urlObj = new URL(url);
        const validProtocols = ['http:', 'https:'];
        const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
        
        // Check if protocol is valid
        if (!validProtocols.includes(urlObj.protocol)) {
            return false;
        }
        
        // Check if URL has a valid image extension
        const hasValidExtension = validExtensions.some(ext => 
            urlObj.pathname.toLowerCase().includes(ext)
        );
        
        return hasValidExtension;
    } catch (error) {
        return false;
    }
}

module.exports = {
    fetchImageAsBase64,
    isValidImageUrl
}; 