import type { ErrorRequestHandler } from "express";
import type { Env } from "../config/env.js";
import { AppError } from "./app-error.js";

type JsonParseError = {
  type?: unknown;
  status?: unknown;
};

function isInvalidJson(error: unknown): error is JsonParseError {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as JsonParseError;
  return candidate.type === "entity.parse.failed" && candidate.status === 400;
}

export function createErrorHandler(env: Env): ErrorRequestHandler {
  return (error, _request, response, _next) => {
    if (response.headersSent) {
      return;
    }

    if (isInvalidJson(error)) {
      response.status(400).json({
        error: {
          code: "INVALID_JSON",
          message: "O corpo da requisição não é um JSON válido.",
        },
      });
      return;
    }

    if (error instanceof AppError) {
      response.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      });
      return;
    }

    if (env.NODE_ENV !== "test") {
      console.error(error);
    }

    response.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Erro interno do servidor.",
      },
    });
  };
}
