import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter } from 'wouter';

import Home from './pages/home';
import MovieDetail from './pages/movie-detail';
import SeriesBrowse from './pages/series-browse';
import SeriesDetail from './pages/series-detail';
import OrderStatus from './pages/order-status';
import Purchases from './pages/purchases';
import { Layout } from './components/layout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

function NotFound() {
  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
        <h1 className="text-6xl font-black text-primary mb-4">404</h1>
        <p className="text-xl text-muted-foreground mb-8">This page got lost in the vault.</p>
        <a href="/" className="bg-muted hover:bg-muted/70 text-foreground font-bold py-3 px-8 rounded-xl transition-colors">
          Return Home
        </a>
      </div>
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/movie/:id" component={MovieDetail} />
      <Route path="/series" component={SeriesBrowse} />
      <Route path="/series/:id" component={SeriesDetail} />
      <Route path="/order/:id" component={OrderStatus} />
      <Route path="/purchases" component={Purchases} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Router />
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
