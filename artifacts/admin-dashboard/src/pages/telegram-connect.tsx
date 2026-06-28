import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  Wifi,
  WifiOff,
  Loader2,
  Send,
  Key,
  Phone,
  Lock,
  AlertCircle,
  Copy,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

interface MtprotoStatus {
  state: "disconnected" | "code_sent" | "awaiting_2fa" | "connected" | "error";
  error: string | null;
  sessionString: string;
  hasApiCredentials: boolean;
}

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? res.statusText);
  }
  return res.json();
}

export function TelegramConnect() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: status, isLoading, refetch } = useQuery<MtprotoStatus>({
    queryKey: ["mtproto-status"],
    queryFn: () => apiFetch("/api/admin/mtproto/status"),
    refetchInterval: 10000,
  });

  const sendCode = useMutation({
    mutationFn: () => apiFetch("/api/admin/mtproto/auth/send-code", {
      method: "POST",
      body: JSON.stringify({ phone }),
    }),
    onSuccess: () => {
      toast({ title: "Code sent to your Telegram app" });
      queryClient.invalidateQueries({ queryKey: ["mtproto-status"] });
      refetch();
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const verifyCode = useMutation({
    mutationFn: () => apiFetch("/api/admin/mtproto/auth/verify-code", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
    onSuccess: (data: { requires2FA: boolean }) => {
      if (data.requires2FA) {
        toast({ title: "2FA required — enter your password" });
      } else {
        toast({ title: "Connected to Telegram!" });
      }
      queryClient.invalidateQueries({ queryKey: ["mtproto-status"] });
      refetch();
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const verifyPassword = useMutation({
    mutationFn: () => apiFetch("/api/admin/mtproto/auth/verify-password", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
    onSuccess: () => {
      toast({ title: "Connected to Telegram!" });
      queryClient.invalidateQueries({ queryKey: ["mtproto-status"] });
      refetch();
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const disconnect = useMutation({
    mutationFn: () => apiFetch("/api/admin/mtproto/auth/disconnect", { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Disconnected from Telegram" });
      setPhone(""); setCode(""); setPassword("");
      queryClient.invalidateQueries({ queryKey: ["mtproto-status"] });
      refetch();
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const copySession = () => {
    if (!status?.sessionString) return;
    navigator.clipboard.writeText(status.sessionString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Session string copied!" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const state = status?.state ?? "disconnected";
  const isConnected = state === "connected";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Connect Telegram (MTProto)</h1>
        <p className="text-muted-foreground text-sm">
          Connect your Telegram user account to upload movies directly — no file size limits, automatic progress tracking.
        </p>
      </div>

      {/* Status card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isConnected ? (
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Wifi className="w-5 h-5 text-green-500" />
                </div>
              ) : state === "error" ? (
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <WifiOff className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="font-medium text-sm">
                  {isConnected ? "Connected" :
                    state === "code_sent" ? "Waiting for verification code" :
                    state === "awaiting_2fa" ? "Waiting for 2FA password" :
                    state === "error" ? "Connection error" :
                    "Not connected"}
                </p>
                {status?.error && (
                  <p className="text-xs text-destructive">{status.error}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
              {isConnected && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnect.mutate()}
                  disabled={disconnect.isPending}
                >
                  {disconnect.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Disconnect"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API credentials check */}
      {!status?.hasApiCredentials && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-500" />
              API Credentials Required
            </CardTitle>
            <CardDescription>
              Set <code className="bg-muted px-1 rounded text-xs">TELEGRAM_API_ID</code> and{" "}
              <code className="bg-muted px-1 rounded text-xs">TELEGRAM_API_HASH</code> in your
              Replit Secrets to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ol className="text-sm space-y-2 text-muted-foreground list-decimal list-inside">
              <li>Go to <strong>my.telegram.org</strong> and sign in with your phone number</li>
              <li>Click <strong>API development tools</strong></li>
              <li>Create a new application (any name/description)</li>
              <li>Copy the <strong>App api_id</strong> and <strong>App api_hash</strong></li>
              <li>Add them to Replit Secrets as <code className="bg-muted px-1 rounded text-xs">TELEGRAM_API_ID</code> and <code className="bg-muted px-1 rounded text-xs">TELEGRAM_API_HASH</code></li>
              <li>Restart the server</li>
            </ol>
            <Button variant="outline" size="sm" asChild>
              <a href="https://my.telegram.org" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3 h-3 mr-1.5" />
                Open my.telegram.org
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Auth flow */}
      {status?.hasApiCredentials && !isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {state === "code_sent" ? (
                <span className="flex items-center gap-2"><Send className="w-4 h-4 text-primary" /> Enter Verification Code</span>
              ) : state === "awaiting_2fa" ? (
                <span className="flex items-center gap-2"><Lock className="w-4 h-4 text-primary" /> Two-Step Verification</span>
              ) : (
                <span className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /> Sign In with Phone</span>
              )}
            </CardTitle>
            <CardDescription>
              {state === "code_sent"
                ? "Telegram sent a code to your app or SMS. Enter it below."
                : state === "awaiting_2fa"
                ? "Your account has two-step verification enabled."
                : "Enter your Telegram phone number to receive a login code."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step 1: Phone */}
            {(state === "disconnected" || state === "error") && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Phone Number</label>
                  <Input
                    type="tel"
                    placeholder="+254 7XX XXX XXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendCode.mutate()}
                  />
                  <p className="text-xs text-muted-foreground">Include country code (e.g. +254 for Kenya)</p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => sendCode.mutate()}
                  disabled={sendCode.isPending || !phone.trim()}
                >
                  {sendCode.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending Code…</>
                  ) : (
                    <><Send className="w-4 h-4 mr-2" /> Send Verification Code</>
                  )}
                </Button>
              </div>
            )}

            {/* Step 2: Code */}
            {state === "code_sent" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Verification Code</label>
                  <Input
                    type="text"
                    placeholder="12345"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && verifyCode.mutate()}
                    maxLength={6}
                    className="text-center text-lg font-mono tracking-widest"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">Check your Telegram app for the code</p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => verifyCode.mutate()}
                  disabled={verifyCode.isPending || !code.trim()}
                >
                  {verifyCode.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying…</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4 mr-2" /> Verify Code</>
                  )}
                </Button>
                <Button variant="ghost" size="sm" className="w-full" onClick={() => { setCode(""); sendCode.mutate(); }}>
                  Resend code
                </Button>
              </div>
            )}

            {/* Step 3: 2FA */}
            {state === "awaiting_2fa" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Two-Step Verification Password</label>
                  <Input
                    type="password"
                    placeholder="Your 2FA password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && verifyPassword.mutate()}
                    autoFocus
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => verifyPassword.mutate()}
                  disabled={verifyPassword.isPending || !password.trim()}
                >
                  {verifyPassword.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying…</>
                  ) : (
                    <><Lock className="w-4 h-4 mr-2" /> Verify Password</>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Connected: session info */}
      {isConnected && (
        <>
          <Card className="border-green-500/30 bg-green-500/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Ready to Upload
              </CardTitle>
              <CardDescription>
                Your Telegram account is connected. You can now upload movies and episodes of any size directly from the admin panel.
              </CardDescription>
            </CardHeader>
          </Card>

          {status?.sessionString && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Save Session (Recommended)
                </CardTitle>
                <CardDescription>
                  Save this session string as the <code className="bg-muted px-1 rounded text-xs">TELEGRAM_SESSION</code> secret so you stay connected across server restarts without re-authenticating.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <div className="font-mono text-xs bg-muted rounded-md p-3 pr-12 break-all max-h-24 overflow-auto select-all border border-border">
                    {status.sessionString}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={copySession}
                  >
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Click the copy button above</li>
                  <li>Go to Replit Secrets and add <code className="bg-muted px-0.5 rounded">TELEGRAM_SESSION</code> with this value</li>
                  <li>The server will auto-connect on next restart</li>
                </ol>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
