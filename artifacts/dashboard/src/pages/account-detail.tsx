import { useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetAccount,
  getGetAccountQueryKey,
  useDeleteAccount,
  getListAccountsQueryKey,
  getGetAccountStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { AccountForm } from "@/components/account-form";
import { ArrowLeft, Eye, EyeOff, Mail, Key, Smartphone, Copy, Check, Pencil, Trash2, FileText, Link, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function AccountDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const id = parseInt(params.id ?? "0", 10);

  const { data: account, isLoading } = useGetAccount(id, {
    query: { enabled: !!id, queryKey: getGetAccountQueryKey(id) },
  });

  const deleteAccount = useDeleteAccount();
  const [editOpen, setEditOpen] = useState(false);

  async function handleDelete() {
    await deleteAccount.mutateAsync(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAccountStatsQueryKey() });
          navigate("/accounts");
        },
      }
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array(4).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
        <h2 className="text-xl font-semibold">Account not found</h2>
        <p className="text-muted-foreground mt-2">This account may have been deleted.</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate("/accounts")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Vault
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/accounts")} className="gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 border-border/50">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <AccountForm
                initialData={account}
                onSuccess={() => {
                  setEditOpen(false);
                  queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey(id) });
                  queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
                }}
              />
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-2">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove <strong>{account.username}</strong> from your vault. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                  {deleteAccount.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Profile Card */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 rounded-xl">
              {account.avatarUrl && (
                <AvatarImage src={account.avatarUrl} alt={account.username} className="rounded-xl object-cover" />
              )}
              <AvatarFallback className="rounded-xl bg-primary/15 text-primary font-bold text-2xl">
                {account.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{account.username}</h1>
              <p className="text-sm text-muted-foreground">
                Added {new Date(account.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </p>
              <div className="flex gap-1.5 mt-2">
                {account.password && <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/5">Password</Badge>}
                {account.email && <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400 bg-blue-500/5">Email</Badge>}
                {account.authenticator && <Badge variant="outline" className="text-xs border-green-500/30 text-green-400 bg-green-500/5">2FA</Badge>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credential Fields */}
      <div className="grid gap-4 md:grid-cols-2">
        {account.password && (
          <CredentialField icon={<Key className="h-4 w-4" />} label="Password" value={account.password} secret />
        )}
        {account.email && (
          <CredentialField icon={<Mail className="h-4 w-4" />} label="Email" value={account.email} />
        )}
        {account.authenticator && (
          <CredentialField icon={<Smartphone className="h-4 w-4" />} label="Authenticator / 2FA" value={account.authenticator} secret />
        )}
        {account.avatarUrl && (
          <CredentialField icon={<Link className="h-4 w-4" />} label="Avatar URL" value={account.avatarUrl} />
        )}
      </div>

      {account.notes && (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" /> Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground whitespace-pre-wrap">{account.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CredentialField({
  icon,
  label,
  value,
  secret = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  secret?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const displayValue = secret && !visible ? "•".repeat(Math.min(value.length, 16)) : value;

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          {icon} {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 pb-4">
        <div className="flex items-center gap-2">
          <span className={cn("flex-1 font-mono text-sm truncate", secret && !visible ? "tracking-widest text-muted-foreground" : "text-foreground")}>
            {displayValue}
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {secret && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setVisible((v) => !v)}>
                {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copy}>
              {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
