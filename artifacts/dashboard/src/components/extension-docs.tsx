import { useState } from "react";
import { Copy, Check, Code2, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const apiBase = typeof window !== "undefined" ? window.location.origin : "";

const examplePayload = `{
  "username": "RobloxUser123",
  "password": "mypassword",
  "email": "user@email.com",
  "authenticator": "TOTP_SECRET",
  "avatarUrl": "https://...",
  "notes": "Main account"
}`;

const curlExample = `curl -X POST ${apiBase}/api/accounts \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_KEY" \\
  -d '{"username":"RobloxUser","password":"pass"}'`;

export function ExtensionDocs() {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Code2 className="h-4 w-4 text-primary" />
          Extension API
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-xs">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Endpoint</span>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-accent/40 px-3 py-2 font-mono text-foreground">
            <span className="text-primary font-semibold">POST</span>
            <span className="truncate">/api/accounts</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 ml-auto flex-shrink-0"
              onClick={() => copy(`${apiBase}/api/accounts`, "endpoint")}
            >
              {copied === "endpoint" ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Auth Header</span>
          </div>
          <div className="rounded-md bg-accent/40 px-3 py-2 font-mono text-muted-foreground">
            <span className="text-foreground">X-API-Key:</span> YOUR_API_KEY
          </div>
          <p className="mt-1.5 text-muted-foreground">
            Set <code className="text-foreground bg-accent/40 px-1 rounded">API_KEY</code> env var to enable auth.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">JSON Body</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => copy(examplePayload, "payload")}
            >
              {copied === "payload" ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
          <pre className="rounded-md bg-accent/40 px-3 py-2 font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
            {examplePayload}
          </pre>
          <p className="mt-1.5 text-muted-foreground">Only <code className="text-foreground bg-accent/40 px-1 rounded">username</code> is required.</p>
        </div>
      </CardContent>
    </Card>
  );
}
