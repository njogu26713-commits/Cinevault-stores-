import { useState } from "react";
import { useGetAiAnalytics, useGetAiRecommendations, getGetAiAnalyticsQueryKey, getGetAiRecommendationsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp, Lightbulb, BarChart3, Star } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";
import { Link } from "wouter";

export function AiFeatures() {
  const { data: analytics, isLoading: analyticsLoading } = useGetAiAnalytics({
    query: { queryKey: getGetAiAnalyticsQueryKey() }
  });

  const { data: recommendations, isLoading: recLoading } = useGetAiRecommendations({
    query: { queryKey: getGetAiRecommendationsQueryKey() }
  });

  if (analyticsLoading || recLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">AI Insights & Operations</h1>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[400px] w-full md:col-span-2" />
        </div>
      </div>
    );
  }

  const formatMoney = (amount: number) => `KES ${amount.toLocaleString()}`;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-2">
        <Sparkles className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">AI Insights & Operations</h1>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Lightbulb className="w-5 h-5" />
              Strategic Insight
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{analytics?.insight}</p>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <TrendingUp className="w-5 h-5" />
              Revenue Optimization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{analytics?.revenueInsight}</p>
          </CardContent>
        </Card>

        {/* AI Recommendations for Featuring */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              Recommendations for Hero Section
            </CardTitle>
            <CardDescription>{recommendations?.reasoning}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {recommendations?.recommendations.map((rec) => (
                <div key={rec.movieId} className="flex flex-col gap-3 p-4 rounded-lg border bg-card/50">
                  <div className="flex gap-3">
                    <img src={rec.posterUrl} alt={rec.title} className="w-16 h-24 object-cover rounded bg-muted" />
                    <div>
                      <h4 className="font-medium text-sm line-clamp-2">{rec.title}</h4>
                      <Badge variant="secondary" className="mt-1">Match Score: {rec.score}/10</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3">{rec.reason}</p>
                  <Link href={`/movies/${rec.movieId}/edit`} className="mt-auto pt-2">
                    <Button variant="outline" size="sm" className="w-full text-xs h-8">
                      Feature Movie
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Genre Popularity vs Revenue */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Genre Performance (Revenue)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] mt-4">
              {analytics?.popularGenres && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.popularGenres} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="genre" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      angle={-45}
                      textAnchor="end"
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `K${value/1000}k`}
                    />
                    <RechartsTooltip 
                      cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      formatter={(value: number) => [formatMoney(value), 'Revenue']}
                    />
                    <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                      {analytics.popularGenres.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
