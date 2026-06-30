import type { Request, Response, NextFunction } from "express";

const API_KEY = process.env.API_KEY;

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  if (!API_KEY) {
    next();
    return;
  }

  const key = req.headers["x-api-key"];
  if (key !== API_KEY) {
    res.status(401).json({ error: "Unauthorized: invalid or missing API key" });
    return;
  }

  next();
}
