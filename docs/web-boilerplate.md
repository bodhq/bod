# Tvorba nového Frontend Modulu (Boilerplate)

Stejně jako na backendu, i frontend dodržuje **Vertical Slicing**. Každý byznys modul (např. `timetable`, `users`, `grades`) má svou přesně danou 4-vrstvou strukturu. Zabraňuje to vzniku "špagetového kódu" v UI.

Tento tahák použijte při vytváření nové funkce na frontendu.

## 1. Vytvoření složky modulu
Ve složce `apps/web/src/modules/` vytvořte novou složku, například `users`.

## 2. Vrstva 1: API (Data Access)
Soubor `apps/web/src/modules/users/api.ts` slouží jako most mezi frontendem a backendem.

```typescript
import { getUsersApiV1UsersGet } from "@bod/api-client";
import { env } from "@/env";

export async function fetchUsers() {
  const { data, error } = await getUsersApiV1UsersGet({
    baseUrl: env.NEXT_PUBLIC_API_BASE_URL
  });

  if (error) {
    throw new Error("Nepodařilo se načíst uživatele");
  }

  return data;
}
```

## 3. Vrstva 2: Logika a Stav (Hooks)
Ve složce `hooks/` vytvořte např. `useUsers.ts`. Toto je "mozek".

```typescript
import { useState, useEffect } from "react";
import { fetchUsers } from "../api";
import type { UserPublic } from "@bod/api-client";

export function useUsers() {
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchUsers().then((data) => {
      if (data) setUsers(data);
      setIsLoading(false);
    });
  }, []);

  return { users, isLoading };
}
```

## 4. Vrstva 3: Prezentační UI (Komponenty)
Ve složce `components/` vytvořte "hloupá kreslítka" (neprovádí výpočty, jen barví Tailwindem).

```tsx
"use client";

import { useUsers } from "../hooks/useUsers";

export function UserList() {
  const { users, isLoading } = useUsers();

  if (isLoading) return <div>Načítám...</div>;

  return (
    <ul className="space-y-2">
      {users.map(user => (
        <li key={user.id} className="text-lime-400 bg-gray-800 p-2 rounded">
          {user.email}
        </li>
      ))}
    </ul>
  );
}
```

## 5. Vrstva 4: Next.js App Router (Stránky)
Ve složce `apps/web/src/app/` vytvořte složku s URL cestou, např. `users/page.tsx`.
Tato vrstva tvoří "lepidlo" a dodává metadata.

```tsx
import { UserList } from "@/modules/users/components/UserList";

export const metadata = {
  title: "Uživatelé | bod",
};

export default function UsersPage() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-4">Seznam uživatelů</h1>
      <UserList />
    </main>
  );
}
```
