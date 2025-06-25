# NID Verification Service

A robust and secure API service for verifying National ID (NID) information with the Bangladesh Election Commission's external service. This service provides IP-based access control, comprehensive request logging, and automatic NID type detection (10-digit vs 17-digit).

## Features

- 🔒 **IP-based Access Control**: Only whitelisted IP addresses can access the service
- 📊 **Comprehensive Logging**: All requests are logged with system identification and processing times
- 🔄 **Automatic NID Type Detection**: Automatically detects 10-digit or 17-digit NID based on length
- 🛡️ **Security**: Rate limiting, input validation, and secure headers
- 📈 **Monitoring**: Health checks and service statistics
- 🔐 **External Service Integration**: Seamless integration with Bangladesh Election Commission API
- 🚀 **High Performance**: MySQL database with connection pooling for national-level scalability

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- MySQL (v8.0 or higher)
- Git

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd nid-service-simple
```

2. Install dependencies:
```bash
npm install
```

3. Set up the database:
```bash
# Create MySQL database
mysql -u root -p
CREATE DATABASE nid_service CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'nid_service_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON nid_service.* TO 'nid_service_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

4. Run the setup script:
```bash
npm run setup
```

5. Configure your environment variables in `.env`:
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# External NID Service Configuration
NID_SERVICE_BASE_URL=https://prportal.nidw.gov.bd/partner-service/rest
NID_SERVICE_USERNAME=your_username
NID_SERVICE_PASSWORD=your_password

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h

# MySQL Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=nid_service_user
DB_PASSWORD=your_secure_password
DB_NAME=nid_service

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
```

6. Add allowed IP addresses to the database:
```sql
-- The service will create default localhost entries automatically
-- For production, add your client IPs:
INSERT INTO allowed_ips (ip_address, system_name, description) 
VALUES ('192.168.1.100', 'Production System', 'Main production server');
```

## Usage

### Start the service:
```bash
# Development mode
npm run dev

# Production mode
npm start
```

### API Endpoints

#### 1. Verify NID
**POST** `/api/nid/verify`

Verify NID information with external service.

**Request Body:**
```json
{
  "nid": "19911xxxxxxx000015",
  "dateOfBirth": "xxxx-xx-xx",
  "nameEn": "Nazmul Hasan Nazim"
}
```

**Response:**
```json
{
  "success": true,
  "requestId": "uuid-here",
  "data": {
    "nid": "19911xxxxxxx000015",
    "nidType": "17-digit",
    "verified": true,
    "verificationDetails": {
      "nameEn": true,
      "dateOfBirth": true
    },
    "personDetails": {
      "nationalId": "236xxxx740",
      "pin": "19911xxxxxxx000015",
      "photo": "https://..."
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "system": "Your System Name"
}
```

#### 2. Health Check
**GET** `/api/nid/health`

Check service health and external service connectivity.

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "NID Verification Service",
  "externalService": "connected"
}
```

#### 3. Service Status
**GET** `/api/nid/status`

Get service statistics and performance metrics.

**Response:**
```json
{
  "success": true,
  "status": "operational",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "statistics": {
    "totalRequests": 150,
    "successRequests": 145,
    "errorRequests": 5,
    "successRate": "96.67%",
    "averageProcessingTime": "1250ms"
  }
}
```

## Configuration

### Adding Allowed IPs

To add new IP addresses to the whitelist:

```sql
INSERT INTO allowed_ips (ip_address, system_name, description) 
VALUES ('192.168.1.100', 'Production System', 'Main production server');
```

### Rate Limiting

Configure rate limiting in your `.env` file:
- `RATE_LIMIT_WINDOW_MS`: Time window in milliseconds (default: 15 minutes)
- `RATE_LIMIT_MAX_REQUESTS`: Maximum requests per window (default: 100)

### Database Optimization

For high-traffic scenarios, consider these MySQL optimizations:

```sql
-- Optimize connection pool settings
SET GLOBAL max_connections = 1000;
SET GLOBAL innodb_buffer_pool_size = '2G';

-- Add indexes for better performance
CREATE INDEX idx_created_at_status ON request_logs(created_at, status);
CREATE INDEX idx_system_name_created_at ON request_logs(system_name, created_at);
```

## Security Features

1. **IP Whitelisting**: Only pre-approved IP addresses can access the service
2. **Rate Limiting**: Prevents abuse with configurable limits
3. **Input Validation**: Comprehensive validation for all inputs
4. **Secure Headers**: Helmet.js for security headers
5. **Request Logging**: All requests are logged with full details
6. **Error Handling**: Secure error responses without sensitive information
7. **Database Security**: Prepared statements prevent SQL injection

## Logging

The service uses Winston for structured logging. Logs are stored in:
- `./logs/combined.log` - All logs
- `./logs/error.log` - Error logs only

Log levels can be configured via `LOG_LEVEL` environment variable.

## Error Codes

| Code | Description |
|------|-------------|
| `IP_NOT_AUTHORIZED` | IP address not in whitelist |
| `VALIDATION_ERROR` | Input validation failed |
| `VERIFICATION_FAILED` | External service verification failed |
| `SERVICE_UNAVAILABLE` | External service unavailable |
| `RATE_LIMIT_EXCEEDED` | Rate limit exceeded |
| `INTERNAL_ERROR` | Internal server error |

## Testing

### Using curl:

```bash
# Health check
curl -X GET http://localhost:3000/api/nid/health

# Verify NID (replace with your actual data)
curl -X POST http://localhost:3000/api/nid/verify \
  -H "Content-Type: application/json" \
  -d '{
    "nid": "19911xxxxxxx000015",
    "dateOfBirth": "xxxx-xx-xx",
    "nameEn": "Nazmul Hasan Nazim"
  }'

# Get service status
curl -X GET http://localhost:3000/api/nid/status
```

### Run automated tests:
```bash
npm run test:api
```

## Production Deployment

### 1. Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js and MySQL
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs mysql-server

# Secure MySQL installation
sudo mysql_secure_installation
```

### 2. Database Setup
```bash
# Create dedicated database and user
sudo mysql -u root -p
CREATE DATABASE nid_service CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'nid_service'@'localhost' IDENTIFIED BY 'strong_password_here';
GRANT ALL PRIVILEGES ON nid_service.* TO 'nid_service'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 3. Application Deployment
```bash
# Clone and setup application
git clone <repository-url>
cd nid-service-simple
npm install
npm run setup

# Use PM2 for process management
npm install -g pm2
pm2 start src/server.js --name "nid-service"
pm2 startup
pm2 save
```

### 4. Nginx Configuration
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5. SSL Configuration
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com
```

### 6. Monitoring Setup
```bash
# Install monitoring tools
npm install -g pm2-logrotate
pm2 install pm2-logrotate

# Configure log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## High Availability Setup

For national-level service, consider:

1. **Load Balancer**: Use HAProxy or Nginx for load balancing
2. **Database Replication**: Set up MySQL master-slave replication
3. **Multiple Instances**: Deploy multiple application instances
4. **Monitoring**: Use tools like Prometheus + Grafana
5. **Backup Strategy**: Automated database backups

## Troubleshooting

### Common Issues:

1. **IP not authorized**: Add your IP to the `allowed_ips` table
2. **Database connection errors**: Check MySQL service and credentials
3. **External service errors**: Check credentials and network connectivity
4. **Rate limiting**: Adjust limits in environment configuration
5. **Memory issues**: Optimize MySQL buffer pool size

### Logs:

Check the log files for detailed error information:
```bash
tail -f ./logs/combined.log
tail -f ./logs/error.log
pm2 logs nid-service
```

### Database Queries:

```sql
-- Check recent requests
SELECT * FROM request_logs ORDER BY created_at DESC LIMIT 10;

-- Check system performance
SELECT system_name, COUNT(*) as requests, AVG(processing_time_ms) as avg_time 
FROM request_logs 
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
GROUP BY system_name;

-- Check error rates
SELECT status, COUNT(*) as count 
FROM request_logs 
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
GROUP BY status;
```

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions, please create an issue in the repository or contact the development team. 