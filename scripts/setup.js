#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🚀 NID Verification Service Setup\n');

// Check if .env exists
if (fs.existsSync('.env')) {
    console.log('⚠️  .env file already exists. Do you want to overwrite it? (y/N)');
    rl.question('', (answer) => {
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
            runSetup();
        } else {
            console.log('Setup cancelled.');
            rl.close();
        }
    });
} else {
    runSetup();
}

function runSetup() {
    console.log('\n📝 Please provide the following configuration details:\n');

    const questions = [
        {
            name: 'PORT',
            question: 'Server port (default: 3000): ',
            default: '3000'
        },
        {
            name: 'NID_SERVICE_USERNAME',
            question: 'NID Service Username: ',
            required: true
        },
        {
            name: 'NID_SERVICE_PASSWORD',
            question: 'NID Service Password: ',
            required: true,
            hidden: true
        },
        {
            name: 'DB_HOST',
            question: 'MySQL Host (default: localhost): ',
            default: 'localhost'
        },
        {
            name: 'DB_PORT',
            question: 'MySQL Port (default: 3306): ',
            default: '3306'
        },
        {
            name: 'DB_USER',
            question: 'MySQL Username (default: root): ',
            default: 'root'
        },
        {
            name: 'DB_PASSWORD',
            question: 'MySQL Password: ',
            required: true,
            hidden: true
        },
        {
            name: 'DB_NAME',
            question: 'MySQL Database Name (default: nid_service): ',
            default: 'nid_service'
        },
        {
            name: 'JWT_SECRET',
            question: 'JWT Secret (leave empty for auto-generation): ',
            default: generateJWTSecret()
        },
        {
            name: 'RATE_LIMIT_MAX_REQUESTS',
            question: 'Rate limit max requests per 15 minutes (default: 100): ',
            default: '100'
        }
    ];

    const answers = {};
    let currentQuestion = 0;

    function askQuestion() {
        if (currentQuestion >= questions.length) {
            createEnvFile(answers);
            return;
        }

        const q = questions[currentQuestion];
        const prompt = q.question;

        if (q.hidden) {
            // For password input, we'll use a simple approach
            rl.question(prompt, (answer) => {
                answers[q.name] = answer || q.default;
                currentQuestion++;
                askQuestion();
            });
        } else {
            rl.question(prompt, (answer) => {
                answers[q.name] = answer || q.default;
                currentQuestion++;
                askQuestion();
            });
        }
    }

    askQuestion();
}

function generateJWTSecret() {
    return require('crypto').randomBytes(64).toString('hex');
}

function createEnvFile(answers) {
    const envContent = `# Server Configuration
PORT=${answers.PORT}
NODE_ENV=development

# External NID Service Configuration
NID_SERVICE_BASE_URL=https://prportal.nidw.gov.bd/partner-service/rest
NID_SERVICE_USERNAME=${answers.NID_SERVICE_USERNAME}
NID_SERVICE_PASSWORD=${answers.NID_SERVICE_PASSWORD}

# JWT Configuration
JWT_SECRET=${answers.JWT_SECRET}
JWT_EXPIRES_IN=24h

# MySQL Database Configuration
DB_HOST=${answers.DB_HOST}
DB_PORT=${answers.DB_PORT}
DB_USER=${answers.DB_USER}
DB_PASSWORD=${answers.DB_PASSWORD}
DB_NAME=${answers.DB_NAME}

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=${answers.RATE_LIMIT_MAX_REQUESTS}

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
`;

    fs.writeFileSync('.env', envContent);
    console.log('\n✅ .env file created successfully!');

    // Create logs directory
    const logsDir = './logs';
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
        console.log(`📁 Created directory: ${logsDir}`);
    }

    console.log('\n🎉 Setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Create MySQL database: CREATE DATABASE ' + answers.DB_NAME + ';');
    console.log('2. Install dependencies: npm install');
    console.log('3. Start the service: npm run dev');
    console.log('4. Test the health endpoint: curl http://localhost:3000/api/nid/health');
    console.log('\n📚 For more information, see README.md');

    rl.close();
} 