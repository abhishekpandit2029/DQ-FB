import clsx, { type ClassValue } from "clsx";

/** Class name joiner used by every component in the UI kit. */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
