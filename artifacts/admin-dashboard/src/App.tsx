import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { Dashboard } from "@/pages/dashboard";
import { Movies } from "@/pages/movies";
import { MovieForm } from "@/pages/movie-form";
import { Orders } from "@/pages/orders";
import { Users } from "@/pages/users";
import { Settings } from "@/pages/settings";
import { AiFeatures } from "@/pages/ai-features";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/movies" component={Movies} />
        <Route path="/movies/add" component={MovieForm} />
        <Route path="/movies/:id/edit" component={MovieForm} />
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
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
