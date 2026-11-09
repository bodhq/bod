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
  usersApiV1AdminUsersGet,
} from "@bod/api-client/sdk.gen";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { apiClient } from "@/core/api/client";
import { apiData, apiVoid } from "@/core/api/result";
import { useAuthStore, useAuthUser } from "@/core/auth/store";
import { toast } from "@/core/ui/feedback/toast";

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
  const [section, setSection] = useState<Section>("accounts");
  const [username, setUsername] = useState("");
  const [batchUsernames, setBatchUsernames] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [batchIssuedAccounts, setBatchIssuedAccounts] = useState<IssuedAccount[]>([]);
  const [roleCode, setRoleCode] = useState("");
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
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
    queryKey: ["access", "users"],
    queryFn: async () => apiData(await usersApiV1AdminUsersGet({ client: apiClient })),
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
    queryKey: ["access", "audit"],
    queryFn: async () => apiData(await auditApiV1AdminAuditGet({ client: apiClient })),
    enabled: canReadAudit && activeSection === "audit",
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
  };
  const sections: { id: Section; title: string; visible: boolean }[] = [
    { id: "accounts", title: "Účty", visible: canManageUsers },
    { id: "roles", title: "Role a oprávnění", visible: canManageRoles },
    { id: "audit", title: "Záznamy změn", visible: canReadAudit },
  ];
  const visibleSections = sections.filter((item) => item.visible);
  return {
    setSection,
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
