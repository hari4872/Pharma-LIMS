using LIMS.Domain.Entities;

namespace LIMS.Application.Interfaces;

// Contract 1 + Contract 4: §11.50 + §11.300 — single service for all e-sig creation
// §11.300: password verified independently of session token
public interface IElectronicSignatureService
{
    // Verifies password independently of session, creates and persists the signature
    // Returns null if password incorrect (caller must return ESIGN_AUTH_FAILED)
    Task<ElectronicSignature?> CreateSignatureAsync(
        int userId,
        string password,         // §11.300: independent of session token
        string meaning,          // §11.50 meaning
        string reason,           // §11.50 reason
        string actionType,
        CancellationToken cancellationToken = default);
}
