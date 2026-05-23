using Npgsql;

var conn = new NpgsqlConnection("Host=ep-silent-morning-aqzq6po9-pooler.c-8.us-east-1.aws.neon.tech;Database=neondb;Username=neondb_owner;Password=npg_OTjlcQw9BR7p;SSL Mode=Require;Trust Server Certificate=true");
await conn.OpenAsync();

var cmd1 = new NpgsqlCommand(@"ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS ""FieldDefinitionsJson"" text NULL", conn);
await cmd1.ExecuteNonQueryAsync();
Console.WriteLine("Column added (or already exists).");

var cmd2 = new NpgsqlCommand(@"INSERT INTO ""__EFMigrationsHistory""(""MigrationId"",""ProductVersion"") VALUES ('20260523100000_Add_FormTemplate_FieldDefinitions','8.0.0') ON CONFLICT DO NOTHING", conn);
await cmd2.ExecuteNonQueryAsync();
Console.WriteLine("Migration history recorded.");
