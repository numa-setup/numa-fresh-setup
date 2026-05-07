import { type Response, type NextFunction } from "express";
import { verifyAccessToken } from "../lib/auth.js";
import { type AuthRequest } from "./authenticate.js";

/**
 * Like `authenticate` but does not 401 on missing/invalid tokens.
 * Populates req.user when a valid token is present, otherwise leaves it undefined.
 */
export function optionalAuthenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return next();
    const token = header.slice(7);
    const payload = verifyAccessToken(token);
    if (payload) req.user = payload;
  } catch {
    // ignore
  }
  next();
}
