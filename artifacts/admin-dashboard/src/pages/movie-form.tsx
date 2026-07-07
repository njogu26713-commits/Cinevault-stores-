import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useGetMovie, useCreateMovie, useUpdateMovie, useAiGenerateDescription, getGetMovieQueryKey, getListMoviesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Upload, FileVideo, Film, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  genre: z.string().min(1, "Genre is required"),
  year: z.coerce.number().min(1900).max(2100),
  duration: z.string().min(1, "Duration is required"),
  language: z.string().min(1, "Language is required"),
  quality: z.enum(["720p", "1080p", "4K"]),
  fileSize: z.string().min(1, "File size is required"),
  price: z.coerce.number().min(0),
  posterUrl: z.string().url("Must be a valid URL"),
  bannerUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  youtubeTrailerId: z.string().optional().or(z.literal("")),
  tmdbId: z.string().optional().or(z.literal("")),
  subtitleUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  featured: z.boolean().default(false),
  comingSoon: z.boolean().default(false),
  rating: z.coerce.number().min(0).max(10).optional().or(z.literal(0)),
});

type FormValues = z.infer<typeof formSchema>;

export function MovieForm() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const { data: movie, isLoading: isMovieLoading } = useGetMovie(id || "", {
    query: { enabled: isEditing, queryKey: getGetMovieQueryKey(id || "") }
  });

  const createMovie = useCreateMovie();
  const updateMovie = useUpdateMovie();
  const generateDesc = useAiGenerateDescription();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      genre: "",
      year: new Date().getFullYear(),
      duration: "2h 00m",
      language: "English",
      quality: "1080p",
      fileSize: "1.5 GB",
      price: 100,
      posterUrl: "",
      bannerUrl: "",
      youtubeTrailerId: "",
      tmdbId: "",
      subtitleUrl: "",
      featured: false,
      comingSoon: false,
      rating: 0,
    },
  });

  useEffect(() => {
    if (movie) {
      form.reset({
        title: movie.title,
        description: movie.description,
        genre: movie.genre.join(", "),
        year: movie.year,
        duration: movie.duration,
        language: "English",
        quality: movie.quality as any,
        fileSize: movie.fileSize,
        price: movie.price,
        posterUrl: movie.posterUrl,
        bannerUrl: movie.bannerUrl || "",
        youtubeTrailerId: movie.youtubeTrailerId || "",
        tmdbId: (movie as any).tmdbId || "",
        subtitleUrl: (movie as any).subtitleUrl || "",
        featured: movie.featured,
        comingSoon: (movie as any).comingSoon || false,
        rating: movie.rating || 0,
      });
    }
  }, [movie, form]);

  // Pre-fill from Research Assistant
  useEffect(() => {
    if (id) return; // only on add
    const raw = localStorage.getItem("cinevault_prefill");
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      if (d.type !== "movie") return;
      localStorage.removeItem("cinevault_prefill");
      form.reset({
        title: d.title || "",
        description: d.ai?.seoDescription || d.overview || "",
        genre: (d.genres || []).join(", "),
        year: d.year || new Date().getFullYear(),
        duration: d.runtime || "2h 00m",
        language: d.language === "EN" ? "English" : (d.language || "English"),
        quality: "1080p",
        fileSize: "1.5 GB",
        price: d.ai?.suggestedPriceKes || 200,
        posterUrl: d.posterUrl || "",
        bannerUrl: d.bannerUrl || "",
        youtubeTrailerId: d.youtubeTrailerId || "",
        featured: d.ai?.featured || false,
        rating: d.tmdbRating || 0,
      });
    } catch {}
  }, [id, form]);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<"idle" | "to_server" | "to_telegram" | "complete" | "error">("idle");
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [uploadFileSizeMB, setUploadFileSizeMB] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [telegramFileId, setTelegramFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sseRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (movie?.telegramFileId) {
      setTelegramFileId(movie.telegramFileId);
    }
  }, [movie]);

  const onSubmit = (values: FormValues) => {
    // Process youtube ID
    let ytId = values.youtubeTrailerId;
    if (ytId && ytId.includes("youtube.com/watch?v=")) {
      ytId = new URLSearchParams(ytId.split("?")[1]).get("v") || ytId;
    } else if (ytId && ytId.includes("youtu.be/")) {
      ytId = ytId.split("youtu.be/")[1]?.split("?")[0] || ytId;
    }

    const payload = {
      title: values.title,
      description: values.description,
      genre: values.genre.split(",").map(g => g.trim()).filter(Boolean),
      year: values.year,
      duration: values.duration,
      quality: values.quality,
      fileSize: values.fileSize,
      price: values.price,
      posterUrl: values.posterUrl,
      bannerUrl: values.bannerUrl || null,
      youtubeTrailerId: ytId || null,
      tmdbId: values.tmdbId || null,
      subtitleUrl: values.subtitleUrl || null,
      featured: values.featured,
      comingSoon: values.comingSoon,
      rating: values.rating || null,
    };

    if (isEditing && id) {
      updateMovie.mutate({ id, data: payload }, {
        onSuccess: () => {
          toast({ title: "Movie updated successfully" });
          queryClient.invalidateQueries({ queryKey: getListMoviesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMovieQueryKey(id) });
          setLocation("/movies");
        },
        onError: () => toast({ title: "Failed to update movie", variant: "destructive" })
      });
    } else {
      createMovie.mutate({ data: payload }, {
        onSuccess: (newMovie) => {
          toast({ title: "Movie created successfully" });
          queryClient.invalidateQueries({ queryKey: getListMoviesQueryKey() });
          // Redirect to edit page to allow uploading
          setLocation(`/movies/${newMovie.id}/edit`);
        },
        onError: () => toast({ title: "Failed to create movie", variant: "destructive" })
      });
    }
  };

  const handleGenerateDesc = () => {
    const title = form.getValues("title");
    const genreStr = form.getValues("genre");
    const year = form.getValues("year");
    
    if (!title || !genreStr) {
      toast({ title: "Title and Genre required", description: "Please fill out title and genre first.", variant: "destructive" });
      return;
    }

    const genres = genreStr.split(",").map(g => g.trim()).filter(Boolean);

    generateDesc.mutate({
      data: { title, genre: genres, year, existingDescription: form.getValues("description") }
    }, {
      onSuccess: (res) => {
        form.setValue("description", res.text, { shouldValidate: true, shouldDirty: true });
        toast({ title: "Description generated!" });
      },
      onError: () => toast({ title: "Failed to generate description", variant: "destructive" })
    });
  };

  const CHUNK_SIZE = 50 * 1024 * 1024; // 50 MB per chunk

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    e.target.value = "";

    sseRef.current?.close();
    sseRef.current = null;

    setUploadPhase("to_server");
    setUploadProgress(0);
    setUploadError("");
    setUploadSpeed(0);
    setUploadFileSizeMB((file.size / 1024 / 1024).toFixed(1));

    const uploadId = crypto.randomUUID();
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    try {
      // Phase 1: send file in 50 MB chunks — each request finishes in seconds
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const chunk = file.slice(start, start + CHUNK_SIZE);

        const formData = new FormData();
        formData.append("chunk", chunk);

        // Retry each chunk up to 3 times on transient failure
        let lastErr: Error | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await new Promise<void>((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.upload.addEventListener("progress", (event) => {
                if (event.lengthComputable) {
                  const overall = Math.round(((i + event.loaded / event.total) / totalChunks) * 100);
                  setUploadProgress(overall);
                }
              });
              xhr.addEventListener("load", () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                  setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
                  resolve();
                } else {
                  try { reject(new Error(JSON.parse(xhr.responseText).error || "Chunk upload failed")); }
                  catch { reject(new Error(`Chunk ${i} upload failed (HTTP ${xhr.status})`)); }
                }
              });
              xhr.addEventListener("error", () => reject(new Error(`Network error on chunk ${i}`)));
              xhr.addEventListener("abort", () => reject(new Error(`Chunk ${i} upload aborted`)));
              xhr.open("POST", `/api/admin/mtproto/chunks/${uploadId}/${i}`);
              xhr.send(formData);
            });
            lastErr = null;
            break; // success
          } catch (err: any) {
            lastErr = err;
            if (attempt < 2) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          }
        }
        if (lastErr) throw lastErr;
      }

      // Phase 2: tell server to assemble chunks and start Telegram upload
      setUploadPhase("to_telegram");
      setUploadProgress(0);

      const finalizeRes = await fetch(`/api/admin/mtproto/movies/${id}/upload-chunked`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId, totalChunks, filename: file.name, mimeType: file.type || "video/mp4" }),
      });

      if (!finalizeRes.ok) {
        const err = await finalizeRes.json().catch(() => ({}));
        throw new Error((err as any).error || "Finalize failed");
      }

      const { jobId } = await finalizeRes.json();

      // SSE for Telegram upload progress (same as before)
      const sse = new EventSource(`/api/admin/mtproto/upload-progress/${jobId}`);
      sseRef.current = sse;

      sse.onmessage = (evt) => {
        try {
          const progress = JSON.parse(evt.data) as {
            phase: string; percent?: number; speedMBps?: number;
            fileSizeMB?: string; fileId?: string; error?: string;
          };
          if (progress.phase === "uploading_to_telegram") {
            setUploadProgress(progress.percent ?? 0);
            setUploadSpeed(progress.speedMBps ?? 0);
            if (progress.fileSizeMB) setUploadFileSizeMB(progress.fileSizeMB);
          } else if (progress.phase === "complete") {
            setUploadPhase("complete");
            setUploadProgress(100);
            setTelegramFileId(progress.fileId || "");
            toast({ title: "Uploaded to Telegram successfully!" });
            queryClient.invalidateQueries({ queryKey: getGetMovieQueryKey(id) });
            sse.close();
            sseRef.current = null;
          } else if (progress.phase === "error") {
            setUploadPhase("error");
            const rawErr = progress.error ?? "Upload failed";
            const isSessionExpired = rawErr.includes("SESSION_EXPIRED");
            setUploadError(isSessionExpired ? "Telegram session expired — reconnect in Settings → Telegram Connect" : rawErr);
            toast({
              title: isSessionExpired ? "Telegram session expired" : "Upload failed",
              description: isSessionExpired ? "Go to Settings → Telegram Connect and sign in again." : rawErr,
              variant: "destructive",
            });
            sse.close();
            sseRef.current = null;
          }
        } catch {}
      };

      sse.onerror = () => {
        setUploadPhase("error");
        setUploadError("Lost connection to server");
        sse.close();
        sseRef.current = null;
      };
    } catch (err: any) {
      setUploadPhase("error");
      setUploadError(err.message || "Upload failed");
      toast({ title: err.message || "Upload failed", variant: "destructive" });
    }
  };

  if (isEditing && isMovieLoading) {
    return <div className="space-y-6"><Skeleton className="h-[600px] w-full" /></div>;
  }

  const posterPreview = form.watch("posterUrl");
  const bannerPreview = form.watch("bannerUrl");

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">{isEditing ? "Edit Movie" : "Add Movie"}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLocation("/movies")}>Cancel</Button>
          <Button onClick={form.handleSubmit(onSubmit)} disabled={createMovie.isPending || updateMovie.isPending}>
            {isEditing ? "Save Changes" : "Create Movie"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Movie Title</FormLabel>
                        <FormControl><Input placeholder="e.g. Inception" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="genre"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Genre (comma separated)</FormLabel>
                          <FormControl><Input placeholder="e.g. Sci-Fi, Action" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="year"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Release Year</FormLabel>
                          <FormControl><Input type="number" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between items-center">
                          <FormLabel>Description</FormLabel>
                          <Button 
                            type="button" 
                            variant="secondary" 
                            size="sm" 
                            className="h-7 text-xs"
                            onClick={handleGenerateDesc}
                            disabled={generateDesc.isPending}
                          >
                            <Sparkles className="w-3 h-3 mr-1 text-primary" />
                            Generate with AI
                          </Button>
                        </div>
                        <FormControl>
                          <Textarea 
                            placeholder="Movie synopsis..." 
                            className="h-32 resize-none" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Technical Details & Pricing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="quality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quality</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select quality" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="720p">720p</SelectItem>
                              <SelectItem value="1080p">1080p</SelectItem>
                              <SelectItem value="4K">4K</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="duration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duration</FormLabel>
                          <FormControl><Input placeholder="e.g. 2h 15m" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="fileSize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>File Size</FormLabel>
                          <FormControl><Input placeholder="e.g. 2.1 GB" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Price (KES)</FormLabel>
                          <FormControl><Input type="number" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="language"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Language</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="rating"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rating (0-10)</FormLabel>
                          <FormControl><Input type="number" step="0.1" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="youtubeTrailerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>YouTube Trailer (URL or ID)</FormLabel>
                        <FormControl><Input placeholder="e.g. dQw4w9WgXcQ" {...field} /></FormControl>
                        <FormDescription>Full URL will be stripped to ID on save</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tmdbId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>TMDB ID (for VidSrc fallback)</FormLabel>
                        <FormControl><Input placeholder="e.g. 603" {...field} /></FormControl>
                        <FormDescription>If no Telegram file is attached, the player will stream via VidSrc using this ID.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subtitleUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subtitle URL (Optional)</FormLabel>
                        <FormControl><Input placeholder="https://example.com/subtitle.vtt" {...field} /></FormControl>
                        <FormDescription>Link to a .vtt (WebVTT) subtitle file. Displayed in the player.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </form>
          </Form>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Media</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Form {...form}>
                <FormField
                  control={form.control}
                  name="posterUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Poster URL</FormLabel>
                      <FormControl><Input placeholder="https://..." {...field} /></FormControl>
                      <div className="mt-2 w-full aspect-[2/3] bg-muted rounded-md border border-dashed flex items-center justify-center overflow-hidden">
                        {posterPreview ? (
                          <img src={posterPreview} alt="Poster preview" className="w-full h-full object-cover" />
                        ) : (
                          <Film className="w-10 h-10 text-muted-foreground opacity-50" />
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="bannerUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Banner URL (Optional)</FormLabel>
                      <FormControl><Input placeholder="https://..." {...field} /></FormControl>
                      <div className="mt-2 w-full aspect-video bg-muted rounded-md border border-dashed flex items-center justify-center overflow-hidden">
                        {bannerPreview ? (
                          <img src={bannerPreview} alt="Banner preview" className="w-full h-full object-cover" />
                        ) : (
                          <Film className="w-10 h-10 text-muted-foreground opacity-50" />
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Visibility</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <FormField
                  control={form.control}
                  name="featured"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Featured Movie</FormLabel>
                        <FormDescription>Display in hero section</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="comingSoon"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 mt-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Coming Soon</FormLabel>
                        <FormDescription>Show in Coming Soon row — not yet available for purchase</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </Form>
            </CardContent>
          </Card>

          {isEditing && (
            <Card>
              <CardHeader>
                <CardTitle>Movie File</CardTitle>
                <CardDescription>Upload directly via MTProto — no file size limit (up to 4 GB)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* File status */}
                {telegramFileId ? (
                  <div className="flex items-center gap-3 p-3 bg-green-500/10 rounded-md border border-green-500/20">
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-600">File linked</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{telegramFileId}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-destructive/10 text-destructive rounded-md border border-destructive/20">
                    <FileVideo className="w-5 h-5" />
                    <p className="text-sm">No file linked yet</p>
                  </div>
                )}

                {/* Manual File ID entry */}
                <div className="space-y-1">
                  <label className="text-sm font-medium">Paste File ID</label>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="BQACAgIAAxkBAAI..."
                      defaultValue={telegramFileId ?? ""}
                      id="manual-file-id"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={async () => {
                        const input = document.getElementById("manual-file-id") as HTMLInputElement;
                        const fileId = input?.value?.trim();
                        if (!fileId || !id) return;
                        try {
                          const res = await fetch(`/api/admin/movies/${id}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ telegramFileId: fileId }),
                          });
                          if (!res.ok) throw new Error(await res.text());
                          setTelegramFileId(fileId);
                          queryClient.invalidateQueries({ queryKey: getGetMovieQueryKey(id) });
                          toast({ title: "File ID saved!" });
                        } catch {
                          toast({ title: "Failed to save File ID", variant: "destructive" });
                        }
                      }}
                    >
                      Save
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Forward the file from your Telegram channel to your bot — it will reply with the File ID to paste here.
                  </p>
                </div>

                {/* MTProto Direct Upload */}
                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Upload via MTProto</p>
                    <span className="text-xs text-muted-foreground">Supports up to 4 GB</span>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*,.mkv,.avi,.mp4,.mov,.wmv"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploadPhase === "to_server" || uploadPhase === "to_telegram"}
                  />

                  {/* Idle / error / complete state — show button */}
                  {(uploadPhase === "idle" || uploadPhase === "complete" || uploadPhase === "error") && (
                    <Button
                      type="button"
                      className="w-full"
                      variant={telegramFileId ? "outline" : "default"}
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="upload-file-btn"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {telegramFileId ? "Replace File" : "Select & Upload to Telegram"}
                    </Button>
                  )}

                  {/* Error message */}
                  {uploadPhase === "error" && uploadError && (
                    <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                      <span>⚠ {uploadError}</span>
                    </div>
                  )}

                  {/* Phase 1: client → server */}
                  {uploadPhase === "to_server" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Uploading to server…</span>
                        <span className="font-mono font-medium">{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} className="h-2" />
                      {uploadFileSizeMB && (
                        <p className="text-xs text-muted-foreground text-right">{uploadFileSizeMB} MB total</p>
                      )}
                    </div>
                  )}

                  {/* Phase 2: server → Telegram */}
                  {uploadPhase === "to_telegram" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                          Sending to Telegram…
                        </span>
                        <span className="font-mono font-medium">{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        {uploadSpeed > 0 && <span>{uploadSpeed} MB/s</span>}
                        {uploadFileSizeMB && <span>{uploadFileSizeMB} MB</span>}
                      </div>
                    </div>
                  )}

                  {/* Success */}
                  {uploadPhase === "complete" && (
                    <div className="flex items-center gap-2 text-xs text-green-600 bg-green-500/10 border border-green-500/20 rounded-md px-3 py-2">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Upload complete! File linked to this movie.</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {!isEditing && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground text-center">
                  Save the movie first to upload the video file.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
