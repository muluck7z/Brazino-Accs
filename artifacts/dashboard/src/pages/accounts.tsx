import { useListAccounts } from "@workspace/api-client-react";
import { AccountCard } from "@/components/account-card";
import { Input } from "@/components/ui/input";
import { Search, ShieldX } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function Accounts() {
  const { data: accounts, isLoading } = useListAccounts();
  const [search, setSearch] = useState("");

  const filteredAccounts = accounts?.filter(acc => 
    acc.username.toLowerCase().includes(search.toLowerCase()) || 
    acc.email?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Account Vault</h1>
          <p className="text-muted-foreground mt-1">Manage and access all your saved accounts.</p>
        </div>
        <div className="relative w-full md:w-[300px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search accounts..."
            className="pl-9 bg-card/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array(8).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-[180px] w-full rounded-xl" />
          ))}
        </div>
      ) : filteredAccounts.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredAccounts.map(account => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      ) : (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/10 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-muted-foreground mb-4">
            <ShieldX className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight">No accounts found</h2>
          <p className="text-muted-foreground mt-2 max-w-sm">
            {search ? `No accounts match "${search}". Try another search term.` : "Your vault is empty. Add an account from the dashboard to get started."}
          </p>
        </div>
      )}
    </div>
  );
}
