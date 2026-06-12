using Npgsql;
var cs = "Host=52.230.33.120;Port=5432;Database=limslite;Username=limsliteuser;Password=l!m$#@!23;SSL Mode=Prefer;Trust Server Certificate=true;Timeout=15;Maximum Pool Size=2";
try {
    await using var conn = new NpgsqlConnection(cs);
    await conn.OpenAsync();
    async Task Q(string label, string sql) {
        Console.WriteLine($"== {label} ==");
        await using var cmd = new NpgsqlCommand(sql, conn);
        await using var r = await cmd.ExecuteReaderAsync();
        while (await r.ReadAsync()) {
            var parts = new List<string>();
            for (int i=0;i<r.FieldCount;i++) parts.Add($"{r.GetName(i)}={r.GetValue(i)}");
            Console.WriteLine(string.Join(" | ", parts));
        }
        Console.WriteLine();
    }
    await Q("max_connections", "SHOW max_connections;");
    await Q("superuser_reserved", "SHOW superuser_reserved_connections;");
    await Q("total connections", "SELECT count(*) AS total FROM pg_stat_activity;");
    await Q("by user", "SELECT usename, count(*) FROM pg_stat_activity GROUP BY usename ORDER BY 2 DESC;");
    await Q("by state (limsliteuser)", "SELECT state, count(*) FROM pg_stat_activity WHERE usename='limsliteuser' GROUP BY state ORDER BY 2 DESC;");
    await Q("by app/db (limsliteuser)", "SELECT datname, application_name, state, count(*) FROM pg_stat_activity WHERE usename='limsliteuser' GROUP BY 1,2,3 ORDER BY 4 DESC;");
    await Q("idle ages", "SELECT state, count(*), round(extract(epoch from (now()-max(state_change)))) AS oldest_sec, round(extract(epoch from (now()-min(state_change)))) AS newest_sec FROM pg_stat_activity WHERE usename='limsliteuser' GROUP BY state;");
} catch (Exception ex) {
    Console.WriteLine("CONNECT FAILED: " + ex.Message);
}
