const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Test data
const testCases = [
    {
        name: '17-digit NID Test',
        data: {
            nid: '*****************',
            dateOfBirth: 'xxxx-xx-xx',
            nameEn: 'Nazmul Hasan Nazim'
        }
    },
    {
        name: '10-digit NID Test',
        data: {
            nid: '1234567890',
            dateOfBirth: '1985-06-15',
            nameEn: 'Nazmul Nazim'
        }
    }
];

async function testHealth() {
    try {
        console.log(' Testing health endpoint...');
        const response = await axios.get(`${BASE_URL}/api/nid/health`);
        console.log(' Health check passed:', response.data);
        return true;
    } catch (error) {
        console.log(' Health check failed:', error.response?.data || error.message);
        return false;
    }
}

async function testStatus() {
    try {
        console.log('\n Testing status endpoint...');
        const response = await axios.get(`${BASE_URL}/api/nid/status`);
        console.log(' Status check passed:', response.data);
        return true;
    } catch (error) {
        console.log(' Status check failed:', error.response?.data || error.message);
        return false;
    }
}

async function testNIDVerification(testCase) {
    try {
        console.log(`\n Testing NID verification: ${testCase.name}`);
        console.log('Request data:', testCase.data);
        
        const response = await axios.post(`${BASE_URL}/api/nid/verify`, testCase.data, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log(' Verification successful:', {
            requestId: response.data.requestId,
            verified: response.data.data.verified,
            nidType: response.data.data.nidType,
            system: response.data.system
        });
        
        return true;
    } catch (error) {
        console.log(' Verification failed:', error.response?.data || error.message);
        return false;
    }
}

async function runTests() {
    console.log(' Starting API Tests\n');
    
    // Test health endpoint
    const healthOk = await testHealth();
    if (!healthOk) {
        console.log('\n Health check failed. Make sure the service is running.');
        return;
    }
    
    // Test status endpoint
    await testStatus();
    
    // Test NID verification
    for (const testCase of testCases) {
        await testNIDVerification(testCase);
    }
    
    console.log('\n All tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = {
    testHealth,
    testStatus,
    testNIDVerification,
    runTests
}; 