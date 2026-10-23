import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function useNavigationState() {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  // Zrušit pending stav, jakmile reálně dojde ke změně cesty (navigace proběhla)
  useEffect(() => {
    if (pendingPath === pathname) setPendingPath(null);
  }, [pathname, pendingPath]);

  const activePath = pendingPath || pathname;

  const navigate = (href: string) => {
    setPendingPath(href);
    router.push(href);
  };

  return { activePath, navigate };
}
