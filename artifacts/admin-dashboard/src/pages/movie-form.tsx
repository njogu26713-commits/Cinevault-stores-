import { useState, useEffect } from "react";
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
  featured: z.boolean().default(false),
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
      featured: false,
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
        language: "English", // API doesn't have language, defaulting
        quality: movie.quality as any,
        fileSize: movie.fileSize,
        price: movie.price,
        posterUrl: movie.posterUrl,
        bannerUrl: movie.bannerUrl || "",
        youtubeTrailerId: movie.youtubeTrailerId || "",
        featured: movie.featured,
        rating: movie.rating || 0,
      });
    }
  }, [movie, form]);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [telegramFileId, setTelegramFileId] = useState<string | null>(null);

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
      featured: values.featured,
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setIsUploading(true);
    setUploadProgress(0);
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      // Simulate progress since fetch doesn't support upload progress natively easily without XHR
      const progressInterval = setInterval(() => {
        setUploadProgress(p => {
          if (p >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return p + 10;
        });
      }, 500);

      const res = await fetch(`/api/admin/movies/${id}/upload-file`, {
        method: "POST",
        body: formData
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!res.ok) throw new Error("Upload failed");
      
      const data = await res.json();
      setTelegramFileId(data.telegramFileId);
      toast({ title: "File uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: getGetMovieQueryKey(id) });
    } catch (err) {
      console.error(err);
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setIsUploading(false);
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
              </Form>
            </CardContent>
          </Card>

          {isEditing && (
            <Card>
              <CardHeader>
                <CardTitle>Movie File</CardTitle>
                <CardDescription>Upload to Telegram</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {telegramFileId ? (
                  <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-md border border-border">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">File Uploaded</p>
                      <p className="text-xs text-muted-foreground truncate">{telegramFileId}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-destructive/10 text-destructive rounded-md border border-destructive/20">
                    <FileVideo className="w-5 h-5" />
                    <p className="text-sm">No file uploaded yet</p>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="relative">
                    <Input 
                      type="file" 
                      accept="video/*" 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                      onChange={handleFileUpload}
                      disabled={isUploading}
                    />
                    <Button variant="outline" className="w-full" disabled={isUploading}>
                      <Upload className="w-4 h-4 mr-2" />
                      {isUploading ? "Uploading..." : "Select File"}
                    </Button>
                  </div>
                  {isUploading && (
                    <div className="space-y-1">
                      <Progress value={uploadProgress} className="h-2" />
                      <p className="text-xs text-center text-muted-foreground">{uploadProgress}%</p>
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
