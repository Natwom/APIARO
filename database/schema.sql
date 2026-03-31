-- Kenya E-Commerce Database Schema

CREATE DATABASE IF NOT EXISTS kenya_ecommerce CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE kenya_ecommerce;

-- Users Table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Categories Table
CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    image_url VARCHAR(500)
);

-- Products Table
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INT DEFAULT 0,
    category_id INT,
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    INDEX idx_price (price),
    INDEX idx_category (category_id)
);

-- Orders Table (Kenya-specific fields)
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    county VARCHAR(100) NOT NULL,
    town VARCHAR(100) NOT NULL,
    specific_location TEXT NOT NULL,
    notes TEXT,
    payment_method ENUM('cod', 'mpesa', 'card') NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status ENUM('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
    terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    sms_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_status (status),
    INDEX idx_phone (phone_number)
);

-- Order Items Table
CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Insert Sample Data
INSERT INTO categories (name, slug, description) VALUES 
('Electronics', 'electronics', 'Phones, laptops, and gadgets'),
('Fashion', 'fashion', 'Clothing, shoes, and accessories'),
('Home & Living', 'home', 'Furniture and home appliances'),
('Agriculture', 'agriculture', 'Farming tools and supplies');

INSERT INTO products (name, description, price, stock_quantity, category_id, image_url) VALUES 
('Samsung Galaxy A54', '6.4" 128GB 8GB RAM 5000mAh', 45999.00, 15, 1, 'https://via.placeholder.com/300x300?text=Galaxy+A54'),
('Nairobi Fashion Kitenge Dress', 'Traditional African print dress', 2500.00, 30, 2, 'https://via.placeholder.com/300x300?text=Kitenge+Dress'),
('Ramtons Cooker', '4 Gas Burners + Electric Oven', 18500.00, 10, 3, 'https://via.placeholder.com/300x300?text=Cooker'),
('Solar Panel Kit', '200W Solar Panel with Battery', 12500.00, 20, 4, 'https://via.placeholder.com/300x300?text=Solar+Kit');

-- Admin user (password: admin123 - hashed version needs bcrypt in real app)
-- This is a placeholder - use proper password hashing in production
INSERT INTO users (email, password_hash, full_name, phone_number) VALUES 
('admin@kenyashop.co.ke', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6G', 'System Admin', '+254712345678');