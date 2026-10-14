export type FieldError = {
  field: string;
  message: string;
};

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: FieldError[];

  constructor(statusCode: number, code: string, message: string, details?: FieldError[]) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    if (details && details.length > 0) {
      this.details = details;
    }
  }
}
