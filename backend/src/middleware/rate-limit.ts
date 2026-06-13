import { Request, Response, NextFunction } from "express";

interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message?: string;
}

const limiters = new Map<string, number[]>();

// Periodically clean up stale limiter entries to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of limiters.entries()) {
    const windowStart = now - 3600000; // 1 hour threshold for max cleanup window
    const activeTimestamps = timestamps.filter((t) => t > windowStart);
    
    if (activeTimestamps.length === 0) {
      limiters.delete(ip);
    } else {
      limiters.set(ip, activeTimestamps);
    }
  }
}, 600000); // Run every 10 minutes

export function rateLimiter(options: RateLimiterOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
    const now = Date.now();
    const windowStart = now - options.windowMs;

    let requests = limiters.get(ip) || [];

    // Filter out request timestamps older than the sliding window
    requests = requests.filter((timestamp) => timestamp > windowStart);

    if (requests.length >= options.max) {
      return res.status(429).json({
        message: options.message || "Too many requests. Please try again later.",
      });
    }

    requests.push(now);
    limiters.set(ip, requests);

    next();
  };
}
