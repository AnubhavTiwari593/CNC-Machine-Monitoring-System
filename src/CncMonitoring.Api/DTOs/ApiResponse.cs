namespace CncMonitoring.Api.DTOs;

/// <summary>Consistent envelope for all API responses.</summary>
public sealed record ApiResponse<T>(bool Success, T? Data, string? Error, int StatusCode);

public static class ApiResponse
{
    public static ApiResponse<T> Ok<T>(T data) => new(true, data, null, 200);
    public static ApiResponse<T> Fail<T>(string error, int statusCode = 500) => new(false, default, error, statusCode);
    public static ApiResponse<object> NotFound(string message) => new(false, null, message, 404);
}
