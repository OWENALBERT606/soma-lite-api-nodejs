// src/types/auth.types.ts
import { Request } from "express";

export interface JWTPayload {
  userId: string;
  email: string;
  roles: string[];
  schoolId?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface SanitizedUser {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  imageUrl?: string | null;
  status: string;
  isVerified: boolean;
  createdAt: Date;
}

export interface SchoolAccessInfo {
  schoolId: string;
  schoolName: string;
  schoolCode: string;
  roles: string[];
}