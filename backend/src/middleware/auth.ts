import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';
import { Request, Response, NextFunction } from "express";

/**
 * Phase 3: Authentication (The "Real" Gatekeeper)
 * 
 * Uses Clerk to verify the Bearer token.
 * Requires CLERK_SECRET_KEY in .env
 */
export const requireAuth = ClerkExpressRequireAuth({
  // Optional: Add custom logic here if needed
  // onError: (err, req, res, next) => { ... }
});
