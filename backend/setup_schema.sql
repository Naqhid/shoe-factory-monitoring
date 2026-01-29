-- Setup Tables Schema

-- Forms Master Table
CREATE TABLE IF NOT EXISTS forms_master (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- User Rights Table
CREATE TABLE IF NOT EXISTS user_rights (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    form_id INT NOT NULL,
    read_permission BOOLEAN DEFAULT FALSE,
    write_permission BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (form_id) REFERENCES forms_master(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_form (user_id, form_id)
);

-- Insert default forms (can be used to seed the forms_master table)
INSERT IGNORE INTO forms_master (code, name) VALUES
('FRM001', 'Customer Master'),
('FRM002', 'Group Master'),
('FRM003', 'Leather Master'),
('FRM004', 'Style Master'),
('FRM005', 'Color Master'),
('FRM006', 'Work Centre Master'),
('FRM007', 'Machine Centre Master'),
('FRM008', 'Employee Master'),
('FRM009', 'TV Dashboard'),
('FRM010', 'Reports'),
('FRM011', 'Production Routing'),
('FRM012', 'Production Planning'),
('FRM013', 'Line Setup Form'),
('FRM014', 'Mobile Live Dashboard'),
('FRM015', 'Users'),
('FRM016', 'Forms Master'),
('FRM017', 'User Rights');
