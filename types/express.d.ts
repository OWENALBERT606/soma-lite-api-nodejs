import { Request } from "express";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    roles: string[];
    schoolId?: string | null;
  };
}


