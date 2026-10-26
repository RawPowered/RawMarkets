import type { Request, Response, NextFunction } from "express";
import {
  hasValidAdminToken,
  isAllowedOrigin,
  isLoopbackAddress,
  requestRemoteAddress,
} from "./requestSecurity";

export function requireAdminAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (hasValidAdminToken(req)) {
    next();
    return;
  }

  const origin =
    typeof req.headers.origin === "string"
      ? req.headers.origin
      : typeof req.headers.referer === "string"
        ? req.headers.referer
        : undefined;

  if (origin && !isAllowedOrigin(origin)) {
    res.status(403).json({
      success: false,
      message: "Admin routes require a trusted Origin or valid ADMIN_TOKEN header.",
    });
    return;
  }

  if (isLoopbackAddress(requestRemoteAddress(req))) {
    next();
    return;
  }

  res.status(403).json({
    success: false,
    message: "Admin routes require localhost access or a valid ADMIN_TOKEN header.",
  });
}
