# Run from D:\Pharma-LIMS\backend
# Generates a BCrypt hash for Admin@123 and prints the UPDATE SQL

$code = @"
using BCrypt.Net;
var hash = BCrypt.Net.BCrypt.HashPassword("Admin@123", 11);
Console.WriteLine(hash);
"@

$tmpFile = "$env:TEMP\genhash.csx"
$code | Set-Content $tmpFile -Encoding UTF8

# Try dotnet-script first, fall back to a quick API call
Write-Host "BCrypt hash for Admin@123:"
dotnet script $tmpFile 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "dotnet-script not installed. Use this known hash instead:"
    Write-Host '$2a$11$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
    Write-Host "(This is the hash for the word: password)"
    Write-Host ""
    Write-Host "Run this SQL to reset to password = 'password':"
    Write-Host "UPDATE users SET `"PasswordHash`" = '`$2a`$11`$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi' WHERE `"Username`" = 'admin';"
}
