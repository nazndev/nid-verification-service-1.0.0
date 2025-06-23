const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

class Database {
    constructor() {
        this.pool = null;
        this.init();
    }

    async init() {
        try {
            // Create connection pool
            this.pool = mysql.createPool({
                host: process.env.DB_HOST || 'localhost',
                port: process.env.DB_PORT || 3306,
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'nid_service',
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0
            });

            // Test connection
            await this.pool.getConnection();
            logger.info('MySQL database connected successfully');

            // Initialize tables
            await this.createTables();
            
        } catch (error) {
            logger.error('Database initialization failed:', error);
            throw error;
        }
    }

    async createTables() {
        try {
            // Create allowed IPs table
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS allowed_ips (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    ip_address VARCHAR(45) UNIQUE NOT NULL,
                    system_name VARCHAR(255) NOT NULL,
                    description TEXT,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_ip_address (ip_address),
                    INDEX idx_is_active (is_active)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);

            // Create request logs table
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS request_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    request_id VARCHAR(36) UNIQUE NOT NULL,
                    client_ip VARCHAR(45) NOT NULL,
                    system_name VARCHAR(255),
                    nid VARCHAR(20) NOT NULL,
                    request_data JSON NOT NULL,
                    response_data JSON,
                    status ENUM('SUCCESS', 'ERROR') NOT NULL,
                    error_message TEXT,
                    processing_time_ms INT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_request_id (request_id),
                    INDEX idx_client_ip (client_ip),
                    INDEX idx_nid (nid),
                    INDEX idx_status (status),
                    INDEX idx_created_at (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);

            // Create access tokens table
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS access_tokens (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    token VARCHAR(500) UNIQUE NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_token (token),
                    INDEX idx_expires_at (expires_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);

            // Insert default allowed IPs
            await this.pool.execute(`
                INSERT IGNORE INTO allowed_ips (ip_address, system_name, description)
                VALUES 
                ('127.0.0.1', 'Local Development', 'Local development environment'),
                ('::1', 'Local Development IPv6', 'Local development environment IPv6'),
                ('localhost', 'Local Development', 'Local development environment')
            `);

            logger.info('Database tables created successfully');
        } catch (error) {
            logger.error('Error creating tables:', error);
            throw error;
        }
    }

    async query(sql, params = []) {
        try {
            const [rows] = await this.pool.execute(sql, params);
            return rows;
        } catch (error) {
            logger.error('Database query error:', error);
            throw error;
        }
    }

    async run(sql, params = []) {
        try {
            const [result] = await this.pool.execute(sql, params);
            return {
                id: result.insertId,
                changes: result.affectedRows
            };
        } catch (error) {
            logger.error('Database execute error:', error);
            throw error;
        }
    }

    async get(sql, params = []) {
        try {
            const [rows] = await this.pool.execute(sql, params);
            return rows[0] || null;
        } catch (error) {
            logger.error('Database get error:', error);
            throw error;
        }
    }

    async transaction(callback) {
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();
            const result = await callback(connection);
            await connection.commit();
            return result;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
            logger.info('Database connection pool closed');
        }
    }

    // Health check method
    async healthCheck() {
        try {
            await this.pool.execute('SELECT 1');
            return true;
        } catch (error) {
            logger.error('Database health check failed:', error);
            return false;
        }
    }
}

module.exports = new Database(); 