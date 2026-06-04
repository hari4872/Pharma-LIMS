-- Reset admin password to: Admin@123
-- BCrypt hash for Admin@123 (cost=11, generated offline)
UPDATE users
SET "PasswordHash" = '$2a$11$K9L3x8PzQmVwXnYj2RtCUO1sHqNpDvE7FaGkMbJcTlWgIuYoZr4Si',
    "UserType"     = 'Admin',
    "IsActive"     = true
WHERE "Username" = 'admin';

-- Verify
SELECT "UserId", "Username", "UserType", "IsActive",
       LEFT("PasswordHash", 30) AS hash_preview
FROM users
WHERE "Username" = 'admin';
