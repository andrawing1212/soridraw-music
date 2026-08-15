import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Recursively removes undefined values from an object or array.
 * Firestore does not support undefined values.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (Array.isArray(data)) {
    return data.map(v => sanitizeForFirestore(v)) as any;
  }
  if (data !== null && typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, sanitizeForFirestore(v)])
    ) as any;
  }
  return data;
}
