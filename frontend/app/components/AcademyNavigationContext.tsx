"use client";
import { createContext } from "react";
export const AcademyNavigationContext = createContext<(() => void) | null>(
  null,
);
