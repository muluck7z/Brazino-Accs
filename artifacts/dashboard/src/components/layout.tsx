import { Link, useLocation } from "wouter";
import { Shield, Home, Users, Code, Info, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  const navigation = [
    { name: "Dashboard", href: "/", icon: Home },
    { name: "Vault", href: "/accounts", icon: Shield },
  ];

  return (
    <div className="flex min-h-screen w-full flex-col bg-background md:flex-row">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-border/50 bg-card/30 backdrop-blur-md md:flex">
        <div className="flex h-16 items-center px-6">
          <Link href="/" className="flex items-center gap-3 font-semibold transition-colors hover:text-primary">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Shield className="h-4 w-4" />
            </div>
            <span className="tracking-tight text-lg">Brazino Accs</span>
          </Link>
        </div>
        
        <Separator className="opacity-50" />

        <ScrollArea className="flex-1 px-4 py-6">
          <nav className="flex flex-col gap-2">
            <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              Overview
            </div>
            {navigation.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link key={item.name} href={item.href}>
                  <div
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                    {item.name}
                  </div>
                </Link>
              );
            })}
          </nav>
        </ScrollArea>
        
        <div className="p-4 mt-auto">
          <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card p-3">
            <Avatar className="h-9 w-9 rounded-md">
              <AvatarFallback className="rounded-md bg-primary/20 text-primary text-xs">ME</AvatarFallback>
            </Avatar>
            <div className="flex flex-col overflow-hidden">
              <span className="truncate text-sm font-medium text-foreground">Admin</span>
              <span className="truncate text-xs text-muted-foreground">Local Vault</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="flex h-16 items-center justify-between border-b border-border/50 bg-card/30 px-6 backdrop-blur-md md:hidden">
          <Link href="/" className="flex items-center gap-3 font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Shield className="h-4 w-4" />
            </div>
            <span>Brazino Accs</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/accounts">
                <Users className="h-5 w-5" />
                <span className="sr-only">Accounts</span>
              </Link>
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-5xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
