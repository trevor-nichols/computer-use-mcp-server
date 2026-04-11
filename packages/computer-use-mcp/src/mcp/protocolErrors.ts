export class NotificationRejectedError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number,
    public readonly jsonRpcCode: number,
    public readonly data?: unknown,
  ) {
    super(message)
    this.name = 'NotificationRejectedError'
  }
}
