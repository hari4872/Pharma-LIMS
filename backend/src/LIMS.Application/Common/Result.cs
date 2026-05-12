namespace LIMS.Application.Common;

public class Result<T>
{
    public bool IsSuccess { get; }
    public T? Value { get; }
    public string? ErrorCode { get; }
    public string? ErrorMessage { get; }

    private Result(T value) { IsSuccess = true; Value = value; }
    private Result(string errorCode, string errorMessage) { IsSuccess = false; ErrorCode = errorCode; ErrorMessage = errorMessage; }

    public static Result<T> Success(T value) => new(value);
    public static Result<T> Failure(string errorCode, string message) => new(errorCode, message);
}

public class Result
{
    public bool IsSuccess { get; }
    public string? ErrorCode { get; }
    public string? ErrorMessage { get; }

    private Result() { IsSuccess = true; }
    private Result(string errorCode, string errorMessage) { IsSuccess = false; ErrorCode = errorCode; ErrorMessage = errorMessage; }

    public static Result Success() => new();
    public static Result Failure(string errorCode, string message) => new(errorCode, message);
}
