SELECT "UserId", "Username", "Email", "UserType", "IsActive", LEFT("PasswordHash", 20) AS hash_prefix
FROM users
ORDER BY "UserId"
LIMIT 10;
