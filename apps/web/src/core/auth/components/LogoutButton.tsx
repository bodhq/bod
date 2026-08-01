"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/core/ui/Button";
import { useAuth } from "../hooks/useAuth";

export const LogoutButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, onClick, ...props }, ref) => {
    const { logoutAsync, isPending } = useAuth();

    const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try {
        await logoutAsync();
      } catch (_err) {
        // error handled by useAuth
      }
      if (onClick) {
        onClick(e);
      }
    };

    return (
      <Button ref={ref} onClick={handleClick} isLoading={isPending} {...props}>
        {children || "Odhlásit se"}
      </Button>
    );
  },
);

LogoutButton.displayName = "LogoutButton";
