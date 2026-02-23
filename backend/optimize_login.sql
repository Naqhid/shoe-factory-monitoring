-- Add index to users table for faster login queries
-- This will significantly speed up the login process

-- Add index on code column (used for login)
ALTER TABLE users ADD INDEX idx_users_code (code);

-- Add index on email column (also used for login)
ALTER TABLE users ADD INDEX idx_users_email (email);

-- Add composite index for login query optimization
ALTER TABLE users ADD INDEX idx_users_login (code, email, password);

-- Verify indexes were created
SHOW INDEX FROM users;
