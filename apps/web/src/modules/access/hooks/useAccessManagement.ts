import type { IssuedAccount, RoleRead, UserPatch, UserRead } from "@bod/api-client/types.gen";

import {
  auditApiV1AdminAuditGet,
  createRoleApiV1AdminRolesPost,
  createUserApiV1AdminUsersPost,
  deleteRoleApiV1AdminRolesCodeDelete,
  deleteUserApiV1AdminUsersUserIdDelete,
  generateUsersApiV1AdminUsersGeneratePost,
  permissionsApiV1AdminPermissionsGet,
  resetPasswordApiV1AdminUsersUserIdResetPasswordPost,
  rolesApiV1AdminRolesGet,
  updateRoleApiV1AdminRolesCodePut,
  updateUserApiV1AdminUsersUserIdPatch,
  userApiV1AdminUsersUserIdGet,
  usersApiV1AdminUsersGet,
} from "@bod/api-client/sdk.gen";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { apiClient } from "@/core/api/client";
import { apiData, apiVoid } from "@/core/api/result";
import { useAuthStore, useAuthUser } from "@/core/auth/store";
import { toast } from "@/core/ui/feedback/toast";
import { collectPages, PAGE_SIZE } from "@/modules/shared/records/api";

const isCurrentSession = (version: number | undefined) =>
  version === useAuthStore.getState().sessionVersion;
const sessionMutation = {
  onMutate: () => useAuthStore.getState().sessionVersion,
  onError: (error: Error, _variables: unknown, version: number | undefined) => {
    if (isCurrentSession(version)) toast.error(error.message);
  },
};

type Section = "accounts" | "roles" | "audit";
export function useAccessManagement() {
  const user = useAuthUser();
  const queryClient = useQueryClient();
  const [auditScope] = useState(() =>
    typeof window === "undefined"
      ? { entity: "", record: "" }
      : {
          entity: new URLSearchParams(window.location.search).get("entity") ?? "",
          record: new URLSearchParams(window.location.search).get("record") ?? "",
        },
  );
  const [section, setSection] = useState<Section>(() =>
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("section") === "audit"
      ? "audit"
      : "accounts",
  );
  const [accountsOffset, setAccountsOffset] = useState(0);
  const [auditOffset, setAuditOffset] = useState(0);
  const [accountsSearch, setAccountsSearch] = useState("");
  const [username, setUsername] = useState("");
  const [batchUsernames, setBatchUsernames] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [batchIssuedAccounts, setBatchIssuedAccounts] = useState<IssuedAccount[]>([]);
  const [roleCode, setRoleCode] = useState("");
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [roleSchoolScope, setRoleSchoolScope] = useState<
    NonNullable<RoleRead["school_role_code"]> | ""
  >("");
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const canManageUsers = user?.permissions?.includes("users.manage") ?? false;
  const canManageRoles = user?.permissions?.includes("roles.manage") ?? false;
  const canReadAudit = user?.permissions?.includes("audit.read") ?? false;
  const activeSection: Section =
    (section === "accounts" && canManageUsers) ||
    (section === "roles" && canManageRoles) ||
    (section === "audit" && canReadAudit)
      ? section
      : canManageUsers
        ? "accounts"
        : canManageRoles
          ? "roles"
          : "audit";
  const accountsQuery = useQuery({
    queryKey: ["access", "users", accountsSearch.trim() ? "all" : accountsOffset],
    queryFn: async ({ signal }) =>
      accountsSearch.trim()
        ? collectPages(
            async (offset, limit) =>
              apiData(
                await usersApiV1AdminUsersGet({
                  client: apiClient,
                  signal,
                  query: { offset, limit },
                }),
              ),
            signal,
          )
        : apiData(
            await usersApiV1AdminUsersGet({
              client: apiClient,
              signal,
              query: { offset: accountsOffset, limit: PAGE_SIZE },
            }),
          ),
    enabled: canManageUsers && activeSection === "accounts",
  });
  const rolesQuery = useQuery({
    queryKey: ["access", "roles"],
    queryFn: async () => apiData(await rolesApiV1AdminRolesGet({ client: apiClient })),
    enabled: canManageRoles && (activeSection === "roles" || activeSection === "accounts"),
  });
  const permissionsQuery = useQuery({
    queryKey: ["access", "permissions"],
    queryFn: async () => apiData(await permissionsApiV1AdminPermissionsGet({ client: apiClient })),
    enabled: canManageRoles && activeSection === "roles",
  });
  const auditQuery = useQuery({
    queryKey: ["access", "audit", auditOffset, auditScope],
    queryFn: async ({ signal }) => {
      if (auditScope.entity || auditScope.record) {
        const rows = await collectPages(
          async (offset, limit) =>
            apiData(
              await auditApiV1AdminAuditGet({
                client: apiClient,
                signal,
                query: { offset, limit },
              }),
            ),
          signal,
        );
        return rows
          .filter(
            (event) =>
              (!auditScope.entity || event.entity_type === auditScope.entity) &&
              (!auditScope.record || event.entity_id === auditScope.record),
          )
          .slice(auditOffset, auditOffset + PAGE_SIZE);
      }
      return apiData(
        await auditApiV1AdminAuditGet({
          client: apiClient,
          signal,
          query: { offset: auditOffset, limit: PAGE_SIZE },
        }),
      );
    },
    enabled: canReadAudit && activeSection === "audit",
  });
  const actorIds = [
    ...new Set(
      (auditQuery.data ?? []).flatMap((event) =>
        event.actor_user_id ? [event.actor_user_id] : [],
      ),
    ),
  ].sort();
  const auditActors = useQuery({
    queryKey: ["access", "audit-actors", actorIds],
    enabled: canManageUsers && activeSection === "audit" && actorIds.length > 0,
    queryFn: async ({ signal }) => {
      const users: UserRead[] = [];
      for (let offset = 0; offset < actorIds.length; offset += 4) {
        signal.throwIfAborted();
        const batch = await Promise.all(
          actorIds.slice(offset, offset + 4).map(async (id) => {
            const result = await userApiV1AdminUsersUserIdGet({
              client: apiClient,
              signal,
              path: { user_id: id },
            });
            if (result.response?.status === 404) return null;
            return apiData(result);
          }),
        );
        users.push(...batch.filter((actor): actor is UserRead => actor !== null));
      }
      return Object.fromEntries(
        users.map((actor) => [
          actor.id,
          actor.display_name ||
            [actor.first_name, actor.last_name].filter(Boolean).join(" ") ||
            actor.username,
        ]),
      );
    },
  });
  const refresh = async (...keys: string[][]) => {
    await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  };
  const createAccount = useMutation({
    ...sessionMutation,
    mutationFn: async () => {
      const result = await createUserApiV1AdminUsersPost({
        client: apiClient,
        body: { username: username.trim(), role_codes: selectedRole ? [selectedRole] : [] },
      });
      return apiData(result);
    },
    onSuccess: async ({ temporary_password }, _variables, version) => {
      if (!isCurrentSession(version)) return;
      setTemporaryPassword(temporary_password);
      setUsername("");
      await refresh(["access", "users"]);
      if (isCurrentSession(version)) toast.success("Účet byl vytvořen.");
    },
  });
  const createAccounts = useMutation({
    ...sessionMutation,
    mutationFn: async () => {
      const usernames = batchUsernames
        .split(/[\n,;]/)
        .map((name) => name.trim())
        .filter(Boolean);
      if (usernames.length < 1 || usernames.length > 100) {
        throw new Error("Zadejte 1 až 100 uživatelských jmen.");
      }
      const result = await generateUsersApiV1AdminUsersGeneratePost({
        client: apiClient,
        body: {
          users: usernames.map((name) => ({
            username: name,
            role_codes: selectedRole ? [selectedRole] : [],
          })),
        },
      });
      return apiData(result);
    },
    onSuccess: async (accounts, _variables, version) => {
      if (!isCurrentSession(version)) return;
      setBatchIssuedAccounts(accounts);
      setBatchUsernames("");
      await refresh(["access", "users"]);
      if (isCurrentSession(version)) toast.success(`Vytvořeno účtů: ${accounts.length}.`);
    },
  });
  const updateAccount = useMutation({
    ...sessionMutation,
    mutationFn: async ({ account, patch }: { account: UserRead; patch: UserPatch }) => {
      const result = await updateUserApiV1AdminUsersUserIdPatch({
        client: apiClient,
        path: { user_id: account.id },
        body: patch,
      });
      apiVoid(result);
    },
    onSuccess: (_data, _variables, version) =>
      isCurrentSession(version) ? refresh(["access", "users"]) : undefined,
  });
  const deleteAccount = useMutation({
    ...sessionMutation,
    mutationFn: async (account: UserRead) => {
      const result = await deleteUserApiV1AdminUsersUserIdDelete({
        client: apiClient,
        path: { user_id: account.id },
      });
      apiVoid(result);
    },
    onSuccess: async (_data, _variables, version) => {
      if (!isCurrentSession(version)) return;
      await refresh(["access", "users"]);
      if (isCurrentSession(version)) toast.success("Účet byl odstraněn.");
    },
  });
  const resetPassword = useMutation({
    ...sessionMutation,
    mutationFn: async (account: UserRead) => {
      const result = await resetPasswordApiV1AdminUsersUserIdResetPasswordPost({
        client: apiClient,
        path: { user_id: account.id },
      });
      return apiData(result);
    },
    onSuccess: ({ temporary_password }, _variables, version) => {
      if (isCurrentSession(version)) setTemporaryPassword(temporary_password);
    },
  });
  const saveRole = useMutation({
    ...sessionMutation,
    mutationFn: async () => {
      if (editingRole) {
        const result = await updateRoleApiV1AdminRolesCodePut({
          client: apiClient,
          path: { code: editingRole },
          body: {
            name: roleName.trim(),
            description: roleDescription.trim() || null,
            permission_codes: rolePermissions,
            school_role_code: roleSchoolScope || null,
          },
        });
        apiVoid(result);
      } else {
        const result = await createRoleApiV1AdminRolesPost({
          client: apiClient,
          body: {
            code: roleCode.trim(),
            name: roleName.trim(),
            description: roleDescription.trim() || null,
            permission_codes: rolePermissions,
            school_role_code: roleSchoolScope || null,
          },
        });
        apiVoid(result);
      }
    },
    onSuccess: async (_data, _variables, version) => {
      if (!isCurrentSession(version)) return;
      setEditingRole(null);
      setRoleCode("");
      setRoleName("");
      setRoleDescription("");
      setRolePermissions([]);
      setRoleSchoolScope("");
      await refresh(["access", "roles"], ["access", "permissions"], ["access", "users"]);
      if (isCurrentSession(version)) toast.success("Role byla uložena.");
    },
  });
  const deleteRole = useMutation({
    ...sessionMutation,
    mutationFn: async (role: RoleRead) => {
      const result = await deleteRoleApiV1AdminRolesCodeDelete({
        client: apiClient,
        path: { code: role.code },
      });
      apiVoid(result);
    },
    onSuccess: async (_data, _variables, version) => {
      if (!isCurrentSession(version)) return;
      await refresh(["access", "roles"], ["access", "users"]);
      if (isCurrentSession(version)) toast.success("Role byla odstraněna.");
    },
  });
  const beginEditRole = (role: RoleRead) => {
    setEditingRole(role.code);
    setRoleCode(role.code);
    setRoleName(role.name);
    setRoleDescription(role.description ?? "");
    setRolePermissions(role.permission_codes ?? []);
    setRoleSchoolScope(role.school_role_code ?? "");
  };
  const sections: { id: Section; title: string; visible: boolean }[] = [
    { id: "accounts", title: "Účty", visible: canManageUsers },
    { id: "roles", title: "Role a oprávnění", visible: canManageRoles },
    { id: "audit", title: "Záznamy změn", visible: canReadAudit },
  ];
  const visibleSections = sections.filter((item) => item.visible);
  return {
    setSection,
    accountsOffset,
    setAccountsOffset,
    auditOffset,
    setAuditOffset,
    accountsSearch,
    setAccountsSearch,
    auditActors,
    auditScope,
    username,
    setUsername,
    batchUsernames,
    setBatchUsernames,
    selectedRole,
    setSelectedRole,
    temporaryPassword,
    setTemporaryPassword,
    batchIssuedAccounts,
    setBatchIssuedAccounts,
    roleCode,
    setRoleCode,
    roleName,
    setRoleName,
    roleDescription,
    setRoleDescription,
    roleSchoolScope,
    setRoleSchoolScope,
    rolePermissions,
    setRolePermissions,
    editingRole,
    setEditingRole,
    canManageUsers,
    canManageRoles,
    canReadAudit,
    activeSection,
    accountsQuery,
    rolesQuery,
    permissionsQuery,
    auditQuery,
    createAccount,
    createAccounts,
    updateAccount,
    deleteAccount,
    resetPassword,
    saveRole,
    deleteRole,
    beginEditRole,
    visibleSections,
  };
}
