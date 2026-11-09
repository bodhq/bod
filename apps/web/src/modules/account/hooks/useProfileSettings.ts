import type { ProfilePatch, UserPublic } from "@bod/api-client/types.gen";

import {
  deleteMyAvatarApiV1UsersMeAvatarDelete,
  updateProfileApiV1UsersMePatch,
  uploadMyAvatarApiV1UsersMeAvatarPut,
} from "@bod/api-client/sdk.gen";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { apiClient } from "@/core/api/client";
import { apiData, apiVoid } from "@/core/api/result";
import { useSwitchRole } from "@/core/auth/hooks/useSwitchRole";
import { hasSameAuthContext, useAuthStore, useAuthUser } from "@/core/auth/store";
import { toast } from "@/core/ui/feedback/toast";

type ProfileValues = Pick<
  ProfilePatch,
  "display_name" | "first_name" | "last_name" | "email" | "phone"
>;
function profileValues(user: UserPublic | null): ProfileValues {
  return {
    display_name: user?.display_name ?? "",
    first_name: user?.first_name ?? "",
    last_name: user?.last_name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
  };
}
export function useProfileSettings() {
  const user = useAuthUser();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<ProfileValues>(() => profileValues(user));
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const identity = useRef(user?.id);
  useEffect(() => {
    if (identity.current !== user?.id) {
      identity.current = user?.id;
      setValues(profileValues(user));
    }
  }, [user]);
  const syncUser = (next: Partial<UserPublic>) => {
    const current = useAuthStore.getState().user;
    if (current && current.id === user?.id && current.active_role === user?.active_role) {
      const updated = { ...current, ...next };
      if (!hasSameAuthContext(current, updated)) queryClient.clear();
      useAuthStore.getState().setUser(updated);
    }
  };
  const saveProfile = useMutation({
    onMutate: () => useAuthStore.getState().sessionVersion,
    mutationFn: async () => {
      const body: ProfilePatch = {
        display_name: values.display_name?.trim() || null,
        first_name: values.first_name?.trim() || null,
        last_name: values.last_name?.trim() || null,
        email: values.email?.trim() || null,
        phone: values.phone?.trim() || null,
      };
      const result = await updateProfileApiV1UsersMePatch({ client: apiClient, body });
      return apiData(result);
    },
    onSuccess: (data, _variables, version) => {
      if (version !== useAuthStore.getState().sessionVersion) return;
      syncUser(data);
      setValues(profileValues(data));
      toast.success("Osobní údaje byly uloženy.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const uploadAvatar = useMutation({
    onMutate: () => useAuthStore.getState().sessionVersion,
    mutationFn: async (file: File) => {
      const result = await uploadMyAvatarApiV1UsersMeAvatarPut({
        client: apiClient,
        body: file,
        headers: { "Content-Type": file.type },
      });
      return apiData(result);
    },
    onSuccess: (data, _variables, version) => {
      if (version !== useAuthStore.getState().sessionVersion) return;
      setAvatarError(null);
      syncUser(data);
      toast.success("Profilová fotografie byla změněna.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteAvatar = useMutation({
    onMutate: () => useAuthStore.getState().sessionVersion,
    mutationFn: async () => {
      const result = await deleteMyAvatarApiV1UsersMeAvatarDelete({ client: apiClient });
      apiVoid(result);
    },
    onSuccess: (_data, _variables, version) => {
      if (version !== useAuthStore.getState().sessionVersion) return;
      syncUser({ avatar_url: null });
      toast.success("Profilová fotografie byla odebrána.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const switchRole = useSwitchRole();
  const setField = (field: keyof ProfileValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };
  return {
    user,
    values,
    avatarError,
    setAvatarError,
    saveProfile,
    uploadAvatar,
    deleteAvatar,
    switchRole,
    setField,
  };
}
