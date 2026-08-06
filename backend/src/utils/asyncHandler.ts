import { NextFunction, Request, RequestHandler, Response } from "express";

/** Forwards rejected promises from async route handlers to the error middleware. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
