import { useEffect } from "react";
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

export function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: settings, isLoading } = useGetAdminSettings({
    query: { queryKey: getGetAdminSettingsQueryKey() }
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
    }
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        ...settings,
        currentPassword: "",
        newPassword: "",
      });
    }
  }, [settings, form]);

  const onSubmit = (values: SettingsValues) => {
    updateSettings.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: "Settings updated successfully" });
        queryClient.invalidateQueries({ queryKey: getGetAdminSettingsQueryKey() });
        form.setValue("currentPassword", "");
        form.setValue("newPassword", "");
      },
      onError: () => {
        toast({ title: "Failed to update settings", variant: "destructive" });
      }
    });
  };

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-[400px] w-full" /></div>;
  }

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="mpesa" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="mpesa">M-Pesa API</TabsTrigger>
              <TabsTrigger value="telegram">Telegram Bot</TabsTrigger>
              <TabsTrigger value="admin">Admin Account</TabsTrigger>
            </TabsList>
            
            <TabsContent value="mpesa" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>M-Pesa Daraja Configuration</CardTitle>
                  <CardDescription>Configure your Safaricom Daraja API credentials for payments.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="mpesaShortcode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shortcode / Till Number</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
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
                        <FormControl><Input type="password" {...field} placeholder={settings?.mpesaConsumerKey ? "********" : ""} /></FormControl>
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
                        <FormControl><Input type="password" {...field} placeholder={settings?.mpesaConsumerSecret ? "********" : ""} /></FormControl>
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
                        <FormControl><Input type="password" {...field} placeholder={settings?.mpesaPasskey ? "********" : ""} /></FormControl>
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
                        <FormControl><Input {...field} /></FormControl>
                        <FormDescription>Where Daraja sends payment confirmations (e.g. https://api.cinevault.co.ke/api/payments/callback)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="telegram" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Telegram Bot Configuration</CardTitle>
                  <CardDescription>Set up the bot that delivers movies to customers.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="telegramBotToken"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bot Token</FormLabel>
                        <FormControl><Input type="password" {...field} placeholder={settings?.telegramBotToken ? "********" : ""} /></FormControl>
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
                        <FormLabel>Channel ID (Optional)</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormDescription>For logging purchases or broadcasting</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

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
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="pt-4 border-t border-border mt-4 space-y-4">
                    <h3 className="text-sm font-medium">Change Password</h3>
                    <FormField
                      control={form.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Password</FormLabel>
                          <FormControl><Input type="password" {...field} /></FormControl>
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
                          <FormControl><Input type="password" {...field} /></FormControl>
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
