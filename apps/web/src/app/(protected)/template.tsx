import type { ReactNode } from "react";

export default function ProtectedTemplate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
