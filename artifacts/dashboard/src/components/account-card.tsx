import { Link } from "wouter";
import { Mail, Key, Smartphone, Shield } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Account {
  id: number;
  username: string;
  password?: string | null;
  email?: string | null;
  authenticator?: string | null;
  avatarUrl?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AccountCardProps {
  account: Account;
  compact?: boolean;
}

export function AccountCard({ account, compact = false }: AccountCardProps) {
  return (
    <Link href={`/accounts/${account.id}`}>
      <Card
        className={cn(
          "group cursor-pointer border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-200",
          "hover:border-primary/40 hover:bg-card/80 hover:shadow-lg hover:shadow-primary/5",
          compact ? "h-[120px]" : "h-[180px]"
        )}
      >
        <CardHeader className={cn("pb-2", compact ? "pt-4 px-4" : "pt-5 px-5")}>
          <div className="flex items-center gap-3">
            <Avatar className={cn("rounded-md flex-shrink-0", compact ? "h-9 w-9" : "h-11 w-11")}>
              {account.avatarUrl && (
                <AvatarImage src={account.avatarUrl} alt={account.username} className="rounded-md object-cover" />
              )}
              <AvatarFallback className="rounded-md bg-primary/15 text-primary font-semibold text-sm">
                {account.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                {account.username}
              </p>
              {account.email && (
                <p className="truncate text-xs text-muted-foreground mt-0.5">{account.email}</p>
              )}
            </div>
          </div>
        </CardHeader>

        {!compact && (
          <CardContent className="px-5 pb-4 pt-0">
            <div className="flex flex-wrap gap-1.5 mt-2">
              {account.password && (
                <SecurityBadge icon={<Key className="h-3 w-3" />} label="Password" />
              )}
              {account.email && (
                <SecurityBadge icon={<Mail className="h-3 w-3" />} label="Email" />
              )}
              {account.authenticator && (
                <SecurityBadge icon={<Smartphone className="h-3 w-3" />} label="2FA" />
              )}
              {!account.password && !account.email && !account.authenticator && (
                <span className="text-xs text-muted-foreground">No credentials stored</span>
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground/70">
              Added {new Date(account.createdAt).toLocaleDateString()}
            </p>
          </CardContent>
        )}

        {compact && (
          <CardContent className="px-4 pb-3 pt-0">
            <div className="flex gap-1.5">
              {account.password && <SecurityDot color="text-primary" title="Password" />}
              {account.email && <SecurityDot color="text-blue-400" title="Email" />}
              {account.authenticator && <SecurityDot color="text-green-400" title="2FA" />}
            </div>
          </CardContent>
        )}
      </Card>
    </Link>
  );
}

function SecurityBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent/60 px-2 py-0.5 text-xs text-muted-foreground">
      {icon}
      {label}
    </span>
  );
}

function SecurityDot({ color, title }: { color: string; title: string }) {
  return (
    <span title={title} className={cn("h-2 w-2 rounded-full bg-current opacity-70", color)} />
  );
}
