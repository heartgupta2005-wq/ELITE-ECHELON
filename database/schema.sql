-- Database Name: civic_engine

DROP TABLE IF EXISTS escalations;
DROP TABLE IF EXISTS timeline_logs;
DROP TABLE IF EXISTS complaints;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS users;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(50) NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    reputation_score DECIMAL(5,2) DEFAULT 0.00,
    total_resolved INT DEFAULT 0,
    total_sla_breached INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO departments (name) VALUES 
('Sanitation'),
('Infrastructure'),
('Water & Utilities'),
('General');

CREATE TABLE IF NOT EXISTS complaints (
    id VARCHAR(50) PRIMARY KEY, -- e.g., CIV-20260417-1234
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
    FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE TABLE IF NOT EXISTS timeline_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    complaint_id VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL, -- 'Submitted', 'Categorized', 'Assigned', 'Status Change', 'Escalated'
    description TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS escalations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    complaint_id VARCHAR(50) NOT NULL,
    level INT NOT NULL, -- 1 or 2
    reason TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
);
