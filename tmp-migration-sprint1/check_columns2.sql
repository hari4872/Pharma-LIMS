SELECT table_name, column_name
FROM information_schema.columns
WHERE table_name IN ('samples', 'laboratories')
ORDER BY table_name, ordinal_position
LIMIT 10;
