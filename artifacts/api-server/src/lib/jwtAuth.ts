import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.SESSION_SECRET ?? "zerorisco-secret-dev";
const REFRESH_SECRET = process.env.REFRESH_SECRET ?? "zerorisco-refresh-secret-dev";

export interface JwtPayload {
  userId: number;
  role: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" }); // Token de acesso expira em 1 hora
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: "30d" }); // Refresh token expira em 30 dias
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, REFRESH_SECRET) as JwtPayload;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Não autorizado" });
    return;
  }
  try {
    const payload = verifyToken(auth.slice(7));
    (req as any).user = payload;
    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      res.status(401).json({ error: "Token expirado", code: "TOKEN_EXPIRED" });
    } else {
      res.status(401).json({ error: "Token inválido" });
    }
  }
}

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (user?.role !== role && user?.role !== "admin") {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    next();
  };
}

export function getUser(req: Request): JwtPayload {
  return (req as any).user;
}
