// HTTP error carrying a status code. Services throw it; app.onError maps it to
// a JSON response.
export class HttpError extends Error {
  statusCode: number
  constructor(statusCode: number, message: string) {
    super(message)
    this.statusCode = statusCode
    this.name = 'HttpError'
  }
}
