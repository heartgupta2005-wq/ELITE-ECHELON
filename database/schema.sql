-- CivicEngine Database Schema v2 — Role-Based System
-- Database Name: civic_engine

DROP TABLE IF EXISTS remarks;
DROP TABLE IF EXISTS escalations;
DROP TABLE IF EXISTS timeline_logs;
DROP TABLE IF EXISTS complaints;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS users;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(50) NOT NULL DEFAULT '',
    password VARCHAR(255) NOT NULL,
    role ENUM('public','government') DEFAULT 'public',
    is_admin TINYINT(1) DEFAULT 0,
    department_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(500) DEFAULT NULL,
    reputation_score DECIMAL(5,2) DEFAULT 0.00,
    total_resolved INT DEFAULT 0,
    total_sla_breached INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed default departments
INSERT INTO departments (name, description) VALUES 
('Sanitation',        'Garbage collection, sewage, and cleanliness'),
('Infrastructure',    'Roads, bridges, footpaths, and public works'),
('Water & Utilities', 'Water supply, drainage, and utility services'),
('Electricity',       'Power supply, streetlights, and electrical faults'),
('Public Safety',     'Law enforcement support, hazards, and emergencies'),
('Parks & Recreation','Parks, gardens, playgrounds, and green spaces'),
('General',           'Uncategorized or multi-department issues');

-- Add foreign key on users after departments exist
ALTER TABLE users ADD CONSTRAINT fk_user_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS complaints (
    id VARCHAR(50) PRIMARY KEY,
    user_id INT NOT NULL,
    description TEXT NOT NULL,
    image_url VARCHAR(500) DEFAULT NULL,
    lat DECIMAL(10, 8) DEFAULT NULL,
    lng DECIMAL(11, 8) DEFAULT NULL,
    status ENUM('Pending', 'In Progress', 'Resolved', 'Escalated L1', 'Escalated L2') DEFAULT 'Pending',
    category VARCHAR(255) DEFAULT NULL,
    department_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sla_deadline TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS timeline_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    complaint_id VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS remarks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    complaint_id VARCHAR(50) NOT NULL,
    user_id INT NOT NULL,
    user_name VARCHAR(255) DEFAULT NULL,
    remark TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS escalations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    complaint_id VARCHAR(50) NOT NULL,
    level INT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
);

-- Seed government admin (password: admin123)
INSERT INTO users (name, email, phone, password, role, is_admin, department_id)
VALUES ('System Admin', 'admin@civic.gov', '0000000000', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'government', 1, NULL);
