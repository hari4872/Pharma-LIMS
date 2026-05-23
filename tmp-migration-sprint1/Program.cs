using Npgsql;

var connStr = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "connstr.txt")).Trim();
var sqlFile = args.Length > 0 ? args[0] : "migration.sql";
var sql = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, sqlFile)).Trim();

await using var conn = new NpgsqlConnection(connStr);
await conn.OpenAsync();
await using var cmd = new NpgsqlCommand(sql, conn);
var result = await cmd.ExecuteScalarAsync();
Console.WriteLine($"Result: {result}");
Console.WriteLine("Migration completed.");
