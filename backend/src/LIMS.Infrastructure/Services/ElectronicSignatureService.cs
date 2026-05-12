using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Infrastructure.Services;

// Contract 1 + §11.300: single service — password verified independently of session token
public class ElectronicSignatureService : IElectronicSignatureService
{
    private readonly LimsDbContext _db;
    public ElectronicSignatureService(LimsDbContext db) => _db = db;

    public async Task<ElectronicSignature?> CreateSignatureAsync(
        int userId, string password, string meaning, string reason, string actionType,
        CancellationToken cancellationToken = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.UserId == userId && u.IsActive, cancellationToken);
        if (user is null) return null;

        // §11.300: verify password independently — BCrypt hash comparison
        if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
            return null;

        var sig = new ElectronicSignature
        {
            UserId = userId,
            FullName = user.FullName,
            SignedAt = DateTimeOffset.UtcNow,   // Contract 2: UTC server-side
            Meaning = meaning,
            Reason = reason,
            ActionType = actionType
        };

        _db.ElectronicSignatures.Add(sig);
        await _db.SaveChangesAsync(cancellationToken);

        return sig;
    }
}
