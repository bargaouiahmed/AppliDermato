namespace api.Src.SelfCheckin.Services;

public sealed class SelfCheckinException(string code, string message, int statusCode = StatusCodes.Status400BadRequest)
    : Exception(message)
{
    public string Code { get; } = string.IsNullOrWhiteSpace(code) ? "SELF_CHECKIN_ERROR" : code.Trim();
    public int StatusCode { get; } = statusCode;
}

