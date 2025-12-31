import React from "react";
import { cn } from "@/lib/utils"; // if you have cn; if not, remove cn usage

type AppLogoProps = {
  className?: string;
  sizeClassName?: string; // for inner img size
};

export function AppLogo({ className, sizeClassName }: AppLogoProps) {
  return (
    <div
      className={cn(
        "h-12 w-12 rounded-lg bg-primary flex items-center justify-center",
        className
      )}
    >
      {/* Using the .ico from public folder */}
      <img
        src="/favicon.ico"
        alt="SmartVend logo"
        className={cn("h-7 w-7", sizeClassName)}
      />
    </div>
  );
}
