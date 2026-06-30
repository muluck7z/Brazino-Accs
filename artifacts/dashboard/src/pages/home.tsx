import { useGetAccountStats, useListAccounts, getListAccountsQueryKey } from "@workspace/api-client-react";
import { Shield, Key, Mail, Smartphone, ArrowRight, ShieldCheck, Copy, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountCard } from "@/components/account-card";
import { ExtensionDocs } from "@/components/extension-docs";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { AccountForm } from "@/components/account-form";
import { useState } from "react";

export function Home() {
  const { data: stats, isLoading: statsLoading } = useGetAccountStats();
  const { data: accounts, isLoading: accountsLoading } = useListAccounts();
  const [open, setOpen] = useState(false);

  const recentAccounts = accounts?.slice(0, 4) || [];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your Roblox account vault.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="h-4 w-4" />
              Quick Add Account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <AccountForm onSuccess={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total Accounts" 
          value={stats?.total} 
          icon={<Shield className="h-4 w-4 text-primary" />} 
          loading={statsLoading} 
        />
        <StatCard 
          title="With Password" 
          value={stats?.withPassword} 
          icon={<Key className="h-4 w-4 text-muted-foreground" />} 
          loading={statsLoading} 
          subtitle={stats ? `${Math.round((stats.withPassword / (stats.total || 1)) * 100)}% secured` : undefined}
        />
        <StatCard 
          title="With Email" 
          value={stats?.withEmail} 
          icon={<Mail className="h-4 w-4 text-muted-foreground" />} 
          loading={statsLoading} 
        />
        <StatCard 
          title="With Authenticator" 
          value={stats?.withAuthenticator} 
          icon={<Smartphone className="h-4 w-4 text-muted-foreground" />} 
          loading={statsLoading} 
        />
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {/* Recent Accounts */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Recent Additions</h2>
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-primary" asChild>
              <Link href="/accounts">
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          
          <div className="grid gap-3 sm:grid-cols-2">
            {accountsLoading ? (
              Array(4).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-[120px] w-full rounded-xl" />
              ))
            ) : recentAccounts.length > 0 ? (
              recentAccounts.map(account => (
                <AccountCard key={account.id} account={account} compact />
              ))
            ) : (
              <div className="col-span-2 flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 p-8 text-center bg-card/10">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-muted-foreground">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-sm font-semibold">No accounts yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add an account manually or use the extension to sync automatically.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Extension Info */}
        <div className="md:col-span-1 space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Integration</h2>
          <ExtensionDocs />
        </div>
      </div>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  icon, 
  loading, 
  subtitle 
}: { 
  title: string; 
  value?: number; 
  icon: React.ReactNode; 
  loading: boolean;
  subtitle?: string;
}) {
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-sm transition-all hover:border-border/80">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="h-8 w-8 rounded-md bg-accent/50 flex items-center justify-center">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-2xl font-bold font-mono tracking-tight">{value ?? 0}</div>
        )}
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
