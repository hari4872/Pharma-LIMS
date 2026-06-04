using BCrypt.Net;
var hash = "$2a$11$nd2usQZQH5d8PaivzHaA3usHEPlqbkRhvClfXUCO0K0owFcsfENtO";
var password = "Admin@123";
var result = BCrypt.Net.BCrypt.Verify(password, hash);
Console.WriteLine($"Verify result: {result}");