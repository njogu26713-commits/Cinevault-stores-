import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { Dashboard } from "@/pages/dashboard";
import { Movies } from "@/pages/movies";
import { MovieForm } from "@/pages/movie-form";
import { SeriesList } from "@/pages/series";
import { SeriesForm } from "@/pages/series-form";
import { Orders } from "@/pages/orders";
import { Users } from "@/pages/users";
import { Settings } from "@/pages/settings";
import { AiFeatures } from "@/pages/ai-features";
import { Login } from "@/pages/login";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/hooks/use-auth";

const queryClient = new QueryClient();

function ProtectedRouter() {
  const { loading, authenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authenticated) {
    return <Login />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/movies" component={Movies} />
        <Route path="/movies/add" component={MovieForm} />
        <Route path="/movies/:id/edit" component={MovieForm} />
        <Route path="/series" component={SeriesList} />
        <Route path="/series/add" component={SeriesForm} />
        <Route path="/series/:id/edit" component={SeriesForm} />
        <Route path="/orders" component={Orders} />
        <Route path="/users" component={Users} />
        <Route path="/settings" component={Settings} />
        <Route path="/ai" component={AiFeatures} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <ProtectedRouter />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
