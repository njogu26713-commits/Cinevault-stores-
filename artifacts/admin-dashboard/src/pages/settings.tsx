import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useGetAdminSettings, useUpdateAdminSettings, getGetAdminSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const settingsSchema = z.object({
  mpesaConsumerKey: z.string().optional(),
  mpesaConsumerSecret: z.string().optional(),
  mpesaShortcode: z.string().optional(),
  mpesaPasskey: z.string().optional(),
  mpesaCallbackUrl: z.string().url().optional().or(z.literal("")),
  telegramBotToken: z.string().optional(),
  telegramChannelId: z.string().optional(),
  adminUsername: z.string().min(3),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional().or(z.literal("")),
});

type SettingsValues = z.infer<typeof settingsSchema>;

interface DetectedChannel {
  id: string;
  title: string;
  type: string;
  username?: string;
}

interface DetectResult {
  channels: DetectedChannel[];
  botName: string;
  updatesChecked: number;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useGetAdminSettings({
    query: { queryKey: getGetAdminSettingsQueryKey() },
  });

  const updateSettings = useUpdateAdminSettings();

  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      mpesaConsumerKey: "",
      mpesaConsumerSecret: "",
      mpesaShortcode: "",
      mpesaPasskey: "",
      mpesaCallbackUrl: "",
      telegramBotToken: "",
      telegramChannelId: "",
      adminUsername: "",
      currentPassword: "",
      newPassword: "",
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({ ...settings, currentPassword: "", newPassword: "" });
    }
  }, [settings, form]);

  const onSubmit = (values: SettingsValues) => {
    updateSettings.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast({ title: "Settings saved" });
          queryClient.invalidateQueries({ queryKey: getGetAdminSettingsQueryKey() });
          form.setValue("currentPassword", "");
          form.setValue("newPassword", "");
        },
        onError: () => {
          toast({ title: "Failed to save settings", variant: "destructive" });
        },
      }
    );
  };

  // ── Channel detection state ──────────────────────────────────────────────
  const [detecting, setDetecting] = useState(false);
  const [detectResult, setDetectResult] = useState<DetectResult | null>(null);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [savingChannel, setSavingChannel] = useState<string | null>(null);

  const detectChannel = async () => {
    setDetecting(true);
    setDetectResult(null);
    setDetectError(null);
    try {
      const res = await fetch(`${BASE}/api/admin/telegram/detect-channel`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Detection failed");
      setDetectResult(data);
    } catch (err: any) {
      setDetectError(err.message || "Unknown error");
    } finally {
      setDetecting(false);
    }
  };

  const useChannel = async (channel: DetectedChannel) => {
    setSavingChannel(channel.id);
    try {
      const res = await fetch(`${BASE}/api/admin/telegram/save-channel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: channel.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      form.setValue("telegramChannelId", channel.id);
      queryClient.invalidateQueries({ queryKey: getGetAdminSettingsQueryKey() });
      toast({ title: `Channel saved`, description: `${channel.title} (${channel.id})` });
      setDetectResult(null);
    } catch (err: any) {
      toast({ title: "Failed to save channel", description: err.message, variant: "destructive" });
    } finally {
      setSavingChannel(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="telegram" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="mpesa">M-Pesa API</TabsTrigger>
              <TabsTrigger value="telegram">Telegram Bot</TabsTrigger>
              <TabsTrigger value="admin">Admin Account</TabsTrigger>
            </TabsList>

            {/* ── M-Pesa tab ── */}
            <TabsContent value="mpesa" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>M-Pesa Daraja Configuration</CardTitle>
                  <CardDescription>
                    Configure your Safaricom Daraja API credentials for payments.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="mpesaShortcode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shortcode / Till Number</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mpesaConsumerKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Consumer Key</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            {...field}
                            placeholder={settings?.mpesaConsumerKey ? "••••••••" : ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mpesaConsumerSecret"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Consumer Secret</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            {...field}
                            placeholder={settings?.mpesaConsumerSecret ? "••••••••" : ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mpesaPasskey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Passkey</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            {...field}
                            placeholder={settings?.mpesaPasskey ? "••••••••" : ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mpesaCallbackUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Callback URL</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormDescription>
                          Where Daraja sends payment confirmations (e.g.
                          https://api.cinevault.co.ke/api/payments/callback)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Telegram tab ── */}
            <TabsContent value="telegram" className="mt-6 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Telegram Bot Configuration</CardTitle>
                  <CardDescription>
                    Set up the bot that delivers movies to customers.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="telegramBotToken"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bot Token</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            {...field}
                            placeholder={settings?.telegramBotToken ? "••••••••" : ""}
                          />
                        </FormControl>
                        <FormDescription>From @BotFather</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="telegramChannelId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Channel ID</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="e.g. -1001234567890"
                            data-testid="telegram-channel-id-input"
                          />
                        </FormControl>
                        <FormDescription>
                          The channel or group where your bot uploads movies.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* ── Auto-detect wizard ── */}
              <Card className="border-dashed border-muted-foreground/30">
                <CardHeader>
                  <CardTitle className="text-base">Auto-detect Channel ID</CardTitle>
                  <CardDescription>
                    Add your bot as an admin to the channel, then click Detect to find it
                    automatically.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Steps */}
                  <ol className="space-y-2 text-sm text-muted-foreground list-none">
                    <li className="flex gap-3 items-start">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold mt-0.5">
                        1
                      </span>
                      Open your Telegram channel settings and go to <strong className="text-foreground">Administrators</strong>
                    </li>
                    <li className="flex gap-3 items-start">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold mt-0.5">
                        2
                      </span>
                      Add your bot as an administrator (it needs at least <strong className="text-foreground">Post Messages</strong> permission)
                    </li>
                    <li className="flex gap-3 items-start">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold mt-0.5">
                        3
                      </span>
                      Click <strong className="text-foreground">Detect Channel</strong> below — the bot will scan recent activity to find your channel
                    </li>
                  </ol>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={detectChannel}
                    disabled={detecting}
                    data-testid="detect-channel-btn"
                    className="w-full"
                  >
                    {detecting ? "Scanning Telegram..." : "Detect Channel"}
                  </Button>

                  {/* Error */}
                  {detectError && (
                    <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                      {detectError}
                    </div>
                  )}

                  {/* Results */}
                  {detectResult && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Checked {detectResult.updatesChecked} recent updates for{" "}
                        <strong>{detectResult.botName}</strong>
                      </p>

                      {detectResult.channels.length === 0 ? (
                        <div className="rounded-md bg-muted/40 p-4 text-sm text-center text-muted-foreground space-y-2">
                          <p>No channels found yet.</p>
                          <p className="text-xs">
                            Make sure you added the bot as admin, then send one message to the
                            channel and try again.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Found {detectResult.channels.length} channel
                            {detectResult.channels.length !== 1 ? "s" : ""}
                          </p>
                          {detectResult.channels.map((ch) => (
                            <div
                              key={ch.id}
                              className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3"
                            >
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{ch.title}</p>
                                <p className="text-xs text-muted-foreground font-mono">
                                  {ch.id}
                                  {ch.username && (
                                    <span className="ml-2 text-muted-foreground/60">
                                      @{ch.username}
                                    </span>
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Badge variant="secondary" className="text-xs capitalize">
                                  {ch.type}
                                </Badge>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => useChannel(ch)}
                                  disabled={savingChannel === ch.id}
                                  data-testid={`use-channel-${ch.id}`}
                                >
                                  {savingChannel === ch.id ? "Saving..." : "Use This"}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Admin account tab ── */}
            <TabsContent value="admin" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Admin Account</CardTitle>
                  <CardDescription>Update your login credentials.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="adminUsername"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="pt-4 border-t border-border space-y-4">
                    <h3 className="text-sm font-medium">Change Password</h3>
                    <FormField
                      control={form.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Password</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end">
            <Button type="submit" disabled={updateSettings.isPending}>
              {updateSettings.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
