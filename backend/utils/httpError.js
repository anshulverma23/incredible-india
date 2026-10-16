// Small helper so services can throw errors that carry an HTTP status.
class HttpError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.details = details;
  }
}
const httpError = (statusCode, message, details) => new HttpError(statusCode, message, details);
module.exports = { HttpError, httpError };
