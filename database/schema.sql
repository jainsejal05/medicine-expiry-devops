CREATE DATABASE IF NOT EXISTS medicine_db;

USE medicine_db;

-- ===== Users table (auth + roles + approval workflow) =====
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) NOT NULL DEFAULT 'pharmacist',      -- 'admin' or 'pharmacist'
    status VARCHAR(20) NOT NULL DEFAULT 'pending',        -- 'pending', 'approved', 'rejected'
    pharmacist_id VARCHAR(20) UNIQUE DEFAULT NULL,         -- e.g. PH-0001, assigned on approval
    city VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===== Medicine table (each row belongs to the pharmacist who added it) =====
CREATE TABLE IF NOT EXISTS medicine (
    id INT AUTO_INCREMENT PRIMARY KEY,
    medicine_name VARCHAR(100) NOT NULL,
    batch_number VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'Other',
    quantity INT NOT NULL DEFAULT 0,
    manufacturing_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    supplier VARCHAR(100),
    owner_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===== Stock requests between pharmacists =====
CREATE TABLE IF NOT EXISTS stock_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    from_user_id INT NOT NULL,
    to_user_id INT NOT NULL,
    medicine_name VARCHAR(100) NOT NULL,
    quantity INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',   -- 'pending', 'available', 'not_available'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
