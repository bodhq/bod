import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function useNavigationState() {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  // Zrušit pending stav, jakmile reálně dojde ke změně cesty (navigace proběhla)
  useEffect(() => {
    setPendingPath(null);
  }, [pathname]);

  const activePath = pendingPath || pathname;

  const navigate = (href: string) => {
    setPendingPath(href);
    router.push(href);
  };

  return { activePath, navigate };
}
