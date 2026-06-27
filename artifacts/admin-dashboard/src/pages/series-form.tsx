import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useGetSeries,
  useCreateSeries,
  useUpdateSeries,
  useAiGenerateDescription,
  getListSeriesQueryKey,
  getGetSeriesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

const episodeSchema = z.object({
  episodeNumber: z.coerce.number().min(1),
  title: z.string().min(1, "Episode title required"),
  duration: z.string().min(1, "Duration required"),
  telegramFileId: z.string().optional(),
});

const seasonSchema = z.object({
  seasonNumber: z.coerce.number().min(1),
  episodes: z.array(episodeSchema),
});

const seriesSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  posterUrl: z.string().url("Must be a valid URL"),
  bannerUrl: z.string().url().optional().or(z.literal("")),
  youtubeTrailerId: z.string().optional(),
  genre: z.string().min(1, "At least one genre is required"),
  quality: z.enum(["720p", "1080p", "4K"]),
  rating: z.coerce.number().min(0).max(10).optional().or(z.literal("")),
  year: z.coerce.number().min(1900).max(2100),
  status: z.enum(["Ongoing", "Completed", "Cancelled"]).default("Ongoing"),
  featured: z.boolean().default(false),
  pricePerSeason: z.coerce.number().min(0, "Price required"),
  seasons: z.array(seasonSchema),
});

type SeriesFormValues = z.infer<typeof seriesSchema>;

function stripYoutubeUrl(input: string): string {
  if (!input) return "";
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
  ];
  for (const p of patterns) {
    const m = input.match(p);
    if (m) return m[1];
  }
  return input;
}

export function SeriesForm() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const { data: existing, isLoading } = useGetSeries(id!, {
    query: { enabled: isEdit, queryKey: getGetSeriesQueryKey(id!) },
  });

  const createSeries = useCreateSeries();
  const updateSeries = useUpdateSeries();
  const generateDesc = useAiGenerateDescription();
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [expandedSeasons, setExpandedSeasons] = useState<Set<number>>(new Set([0]));

  const form = useForm<SeriesFormValues>({
    resolver: zodResolver(seriesSchema),
    defaultValues: {
      title: "",
      description: "",
      posterUrl: "",
      bannerUrl: "",
      youtubeTrailerId: "",
      genre: "",
      quality: "1080p",
      rating: undefined,
      year: new Date().getFullYear(),
      status: "Ongoing",
      featured: false,
      pricePerSeason: 0,
      seasons: [],
    },
  });

  const { fields: seasonFields, append: appendSeason, remove: removeSeason } = useFieldArray({
    control: form.control,
    name: "seasons",
  });

  // Pre-fill from Research Assistant
  useEffect(() => {
    if (isEdit) return;
    const raw = localStorage.getItem("cinevault_prefill");
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      if (d.type !== "series") return;
      localStorage.removeItem("cinevault_prefill");

      const mappedSeasons = (d.seasons || []).map((s: any) => ({
        seasonNumber: s.seasonNumber,
        episodes: (s.episodes || []).map((e: any) => ({
          episodeNumber: e.episodeNumber,
          title: e.title || `Episode ${e.episodeNumber}`,
          duration: e.duration || "45m",
          telegramFileId: "",
        })),
      }));

      // Map TMDb status to our enum
      const statusMap: Record<string, "Ongoing" | "Completed" | "Cancelled"> = {
        "Returning Series": "Ongoing",
        "Ended": "Completed",
        "Canceled": "Cancelled",
        "In Production": "Ongoing",
      };

      form.reset({
        title: d.title || "",
        description: d.ai?.seoDescription || d.overview || "",
        posterUrl: d.posterUrl || "",
        bannerUrl: d.bannerUrl || "",
        youtubeTrailerId: d.youtubeTrailerId || "",
        genre: (d.genres || []).join(", "),
        quality: "1080p",
        rating: d.tmdbRating || undefined,
        year: d.year || new Date().getFullYear(),
        status: statusMap[d.status] || "Ongoing",
        featured: d.ai?.featured || false,
        pricePerSeason: d.ai?.suggestedPriceKes || 300,
        seasons: mappedSeasons,
      });

      // Expand all imported seasons
      setExpandedSeasons(new Set(mappedSeasons.map((_: any, i: number) => i)));
    } catch {}
  }, [isEdit, form]);

  useEffect(() => {
    if (existing) {
      form.reset({
        title: existing.title ?? "",
        description: existing.description ?? "",
        posterUrl: existing.posterUrl ?? "",
        bannerUrl: existing.bannerUrl ?? "",
        youtubeTrailerId: existing.youtubeTrailerId ?? "",
        genre: existing.genre?.join(", ") ?? "",
        quality: (existing.quality as "720p" | "1080p" | "4K") ?? "1080p",
        rating: existing.rating ?? undefined,
        year: existing.year ?? new Date().getFullYear(),
        status: (existing.status as "Ongoing" | "Completed" | "Cancelled") ?? "Ongoing",
        featured: existing.featured ?? false,
        pricePerSeason: existing.pricePerSeason ?? 0,
        seasons: existing.seasons?.map((s) => ({
          seasonNumber: s.seasonNumber,
          episodes: s.episodes?.map((e) => ({
            episodeNumber: e.episodeNumber,
            title: e.title,
            duration: e.duration,
            telegramFileId: e.telegramFileId ?? "",
          })) ?? [],
        })) ?? [],
      });
      setExpandedSeasons(new Set(existing.seasons?.map((_, i) => i) ?? []));
    }
  }, [existing, form]);

  const handleGenerateDescription = () => {
    const title = form.getValues("title");
    const genre = form.getValues("genre");
    const year = form.getValues("year");
    if (!title) { toast({ title: "Enter a title first", variant: "destructive" }); return; }
    setGeneratingDesc(true);
    generateDesc.mutate(
      { data: { title, genre, year: Number(year), existingDescription: form.getValues("description") } },
      {
        onSuccess: (data: any) => {
          form.setValue("description", data.text ?? "");
          setGeneratingDesc(false);
        },
        onError: () => {
          toast({ title: "AI generation failed", variant: "destructive" });
          setGeneratingDesc(false);
        },
      }
    );
  };

  const addSeason = () => {
    const nextNum = (seasonFields.length ?? 0) + 1;
    appendSeason({ seasonNumber: nextNum, episodes: [] });
    setExpandedSeasons((prev) => new Set([...prev, seasonFields.length]));
  };

  const toggleSeason = (idx: number) => {
    setExpandedSeasons((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const onSubmit = (values: SeriesFormValues) => {
    const payload = {
      ...values,
      genre: values.genre.split(",").map((g) => g.trim()).filter(Boolean),
      bannerUrl: values.bannerUrl || null,
      youtubeTrailerId: values.youtubeTrailerId ? stripYoutubeUrl(values.youtubeTrailerId) : null,
      rating: values.rating ? Number(values.rating) : null,
      seasons: values.seasons.map((s) => ({
        seasonNumber: Number(s.seasonNumber),
        episodes: s.episodes.map((e) => ({
          episodeNumber: Number(e.episodeNumber),
          title: e.title,
          duration: e.duration,
          telegramFileId: e.telegramFileId || null,
        })),
      })),
    };

    if (isEdit) {
      updateSeries.mutate(
        { id: id!, data: payload as any },
        {
          onSuccess: () => {
            toast({ title: "Series updated" });
            queryClient.invalidateQueries({ queryKey: getListSeriesQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetSeriesQueryKey(id!) });
            navigate("/series");
          },
          onError: () => toast({ title: "Failed to update series", variant: "destructive" }),
        }
      );
    } else {
      createSeries.mutate(
        { data: payload as any },
        {
          onSuccess: () => {
            toast({ title: "Series created" });
            queryClient.invalidateQueries({ queryKey: getListSeriesQueryKey() });
            navigate("/series");
          },
          onError: () => toast({ title: "Failed to create series", variant: "destructive" }),
        }
      );
    }
  };

  const isSaving = createSeries.isPending || updateSeries.isPending;
  const posterUrl = form.watch("posterUrl");

  if (isEdit && isLoading) {
    return <div className="space-y-4"><Skeleton className="h-96 w-full" /></div>;
  }

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          {isEdit ? "Edit Series" : "Add Series"}
        </h1>
        <Button variant="outline" onClick={() => navigate("/series")}>
          Cancel
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

          {/* Basic Info */}
          <Card>
            <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Title</FormLabel>
                    <FormControl><Input {...field} data-testid="series-title" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <FormLabel>Description</FormLabel>
                      <Button type="button" variant="ghost" size="sm" onClick={handleGenerateDescription} disabled={generatingDesc} className="h-7 text-xs gap-1">
                        <Sparkles className="w-3 h-3" />
                        {generatingDesc ? "Generating..." : "Generate with AI"}
                      </Button>
                    </div>
                    <FormControl><Textarea {...field} rows={4} data-testid="series-description" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="genre" render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Genres (comma-separated)</FormLabel>
                    <FormControl><Input {...field} placeholder="Drama, Thriller, Crime" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="year" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Release Year</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="quality" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quality</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="720p">720p</SelectItem>
                        <SelectItem value="1080p">1080p</SelectItem>
                        <SelectItem value="4K">4K</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Ongoing">Ongoing</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="pricePerSeason" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price per Season (KES)</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="rating" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rating (0-10, optional)</FormLabel>
                    <FormControl><Input type="number" step="0.1" min="0" max="10" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="featured" render={({ field }) => (
                  <FormItem className="flex items-center gap-3 md:col-span-2">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0">Featured on homepage</FormLabel>
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          {/* Media */}
          <Card>
            <CardHeader><CardTitle>Media</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="posterUrl" render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Poster URL</FormLabel>
                    <div className="flex gap-3">
                      <FormControl><Input {...field} placeholder="https://..." /></FormControl>
                      {posterUrl && (
                        <img src={posterUrl} alt="Poster preview" className="w-10 h-14 object-cover rounded flex-shrink-0" onError={(e) => (e.currentTarget.style.display = "none")} />
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="bannerUrl" render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Banner URL (optional)</FormLabel>
                    <FormControl><Input {...field} placeholder="https://..." /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="youtubeTrailerId" render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>YouTube Trailer URL or ID (optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="dQw4w9WgXcQ or https://youtube.com/watch?v=..."
                        onChange={(e) => field.onChange(stripYoutubeUrl(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          {/* Seasons & Episodes */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Seasons & Episodes</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addSeason}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Season
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {seasonFields.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No seasons yet. Click "Add Season" to get started.
                </p>
              )}

              {seasonFields.map((seasonField, sIdx) => (
                <SeasonEditor
                  key={seasonField.id}
                  sIdx={sIdx}
                  form={form}
                  expanded={expandedSeasons.has(sIdx)}
                  onToggle={() => toggleSeason(sIdx)}
                  onRemove={() => removeSeason(sIdx)}
                />
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate("/series")}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : isEdit ? "Update Series" : "Create Series"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

function SeasonEditor({
  sIdx,
  form,
  expanded,
  onToggle,
  onRemove,
}: {
  sIdx: number;
  form: any;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const { fields: episodeFields, append: appendEpisode, remove: removeEpisode } = useFieldArray({
    control: form.control,
    name: `seasons.${sIdx}.episodes`,
  });

  const seasonNum = form.watch(`seasons.${sIdx}.seasonNumber`);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Season header */}
      <div
        className="flex items-center justify-between p-4 bg-card cursor-pointer select-none"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          <span className="font-medium text-sm">Season {seasonNum}</span>
          <Badge variant="secondary" className="text-xs">{episodeFields.length} episode{episodeFields.length !== 1 ? "s" : ""}</Badge>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {expanded && (
        <div className="p-4 space-y-4 border-t border-border">
          {/* Season number field */}
          <div className="flex items-center gap-3">
            <FormField
              control={form.control}
              name={`seasons.${sIdx}.seasonNumber`}
              render={({ field }) => (
                <FormItem className="flex-shrink-0 w-36">
                  <FormLabel className="text-xs">Season Number</FormLabel>
                  <FormControl><Input type="number" {...field} className="h-8" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Episodes */}
          {episodeFields.length === 0 && (
            <p className="text-xs text-muted-foreground">No episodes yet.</p>
          )}
          {episodeFields.map((epField, eIdx) => (
            <div key={epField.id} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground block mb-1">Ep#</label>
                <FormField
                  control={form.control}
                  name={`seasons.${sIdx}.episodes.${eIdx}.episodeNumber`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl><Input type="number" {...field} className="h-8" /></FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <div className="col-span-5">
                <label className="text-xs text-muted-foreground block mb-1">Title</label>
                <FormField
                  control={form.control}
                  name={`seasons.${sIdx}.episodes.${eIdx}.title`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl><Input {...field} className="h-8" placeholder="Episode title" /></FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground block mb-1">Duration</label>
                <FormField
                  control={form.control}
                  name={`seasons.${sIdx}.episodes.${eIdx}.duration`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl><Input {...field} className="h-8" placeholder="45m" /></FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <div className="col-span-3">
                <label className="text-xs text-muted-foreground block mb-1">Telegram File ID</label>
                <FormField
                  control={form.control}
                  name={`seasons.${sIdx}.episodes.${eIdx}.telegramFileId`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl><Input {...field} className="h-8" placeholder="Optional" /></FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <div className="col-span-1 flex justify-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => removeEpisode(eIdx)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => appendEpisode({
              episodeNumber: episodeFields.length + 1,
              title: "",
              duration: "",
              telegramFileId: "",
            })}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Episode
          </Button>
        </div>
      )}
    </div>
  );
}
