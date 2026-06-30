import { useState } from "react";
import { useCreateAccount, useUpdateAccount, getListAccountsQueryKey, getGetAccountStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Eye, EyeOff, Loader2 } from "lucide-react";

interface AccountFormProps {
  onSuccess?: () => void;
  initialData?: {
    id: number;
    username: string;
    password?: string | null;
    email?: string | null;
    authenticator?: string | null;
    avatarUrl?: string | null;
    notes?: string | null;
  };
}

export function AccountForm({ onSuccess, initialData }: AccountFormProps) {
  const queryClient = useQueryClient();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();

  const isEdit = !!initialData;

  const [form, setForm] = useState({
    username: initialData?.username ?? "",
    password: initialData?.password ?? "",
    email: initialData?.email ?? "",
    authenticator: initialData?.authenticator ?? "",
    avatarUrl: initialData?.avatarUrl ?? "",
    notes: initialData?.notes ?? "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const data = {
      username: form.username,
      ...(form.password ? { password: form.password } : {}),
      ...(form.email ? { email: form.email } : {}),
      ...(form.authenticator ? { authenticator: form.authenticator } : {}),
      ...(form.avatarUrl ? { avatarUrl: form.avatarUrl } : {}),
      ...(form.notes ? { notes: form.notes } : {}),
    };

    if (isEdit && initialData) {
      await updateAccount.mutateAsync(
        { id: initialData.id, data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetAccountStatsQueryKey() });
            onSuccess?.();
          },
        }
      );
    } else {
      await createAccount.mutateAsync(
        { data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetAccountStatsQueryKey() });
            onSuccess?.();
          },
        }
      );
    }
  }

  const isPending = createAccount.isPending || updateAccount.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit Account" : "Add Account"}</DialogTitle>
        <DialogDescription>
          {isEdit ? "Update the account details below." : "Manually add a Roblox account to your vault."}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="username">Username *</Label>
          <Input
            id="username"
            placeholder="RobloxUsername"
            value={form.username}
            onChange={set("username")}
            required
            className="bg-card/50"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Account password"
              value={form.password}
              onChange={set("password")}
              className="bg-card/50 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="account@email.com"
            value={form.email}
            onChange={set("email")}
            className="bg-card/50"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="authenticator">Authenticator / 2FA Key</Label>
          <div className="relative">
            <Input
              id="authenticator"
              type={showAuth ? "text" : "password"}
              placeholder="TOTP secret or backup code"
              value={form.authenticator}
              onChange={set("authenticator")}
              className="bg-card/50 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowAuth((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAuth ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="avatarUrl">Avatar URL</Label>
          <Input
            id="avatarUrl"
            placeholder="https://..."
            value={form.avatarUrl}
            onChange={set("avatarUrl")}
            className="bg-card/50"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            placeholder="Optional notes about this account..."
            value={form.notes}
            onChange={set("notes")}
            className="bg-card/50 resize-none"
            rows={2}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isPending || !form.username} className="gap-2">
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? "Save Changes" : "Add Account"}
        </Button>
      </div>
    </form>
  );
}
