import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { X, Smartphone, Send, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateOrder } from "@workspace/api-client-react";
import { type Movie } from "@workspace/api-client-react";
import { formatKes } from "../lib/utils";
import { QualityBadge } from "./movie-card";

const checkoutSchema = z.object({
  telegramUsername: z.string()
    .min(2, "Username is too short")
    .startsWith("@", "Username must start with @")
    .regex(/^@[a-zA-Z0-9_]{5,32}$/, "Invalid Telegram username"),
  phone: z.string()
    .regex(/^(07\d{8}|01\d{8}|254\d{9})$/, "Enter a valid Safaricom number (e.g. 0712345678)")
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

export function CheckoutModal({
  movie,
  isOpen,
  onClose
}: {
  movie: Movie;
  isOpen: boolean;
  onClose: () => void
}) {
  const [, setLocation] = useLocation();
  const createOrder = useCreateOrder();
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { telegramUsername: "@", phone: "" }
  });

  const onSubmit = (data: CheckoutForm) => {
    setServerError(null);
    createOrder.mutate({
      data: {
        movieId: movie.id,
        telegramUsername: data.telegramUsername,
        phone: data.phone
      }
    }, {
      onSuccess: (order) => {
        onClose();
        setLocation(`/order/${order.id}`);
      },
      onError: (err: any) => {
        setServerError(err?.message || "Failed to initiate payment. Try again.");
      }
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm"
            onClick={onClose}
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl pointer-events-auto overflow-hidden flex flex-col"
            >
              <div className="p-6 pb-0 flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Complete Purchase</h2>
                  <p className="text-sm text-muted-foreground mt-1">Instant delivery to your Telegram</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 bg-muted hover:bg-muted/70 rounded-full text-muted-foreground transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 pt-4 flex gap-4 border-b border-border bg-muted/40 mt-4">
                <img
                  src={movie.posterUrl}
                  alt={movie.title}
                  className="w-16 h-24 object-cover rounded shadow-lg"
                />
                <div className="flex flex-col justify-center">
                  <h3 className="font-bold text-foreground line-clamp-1">{movie.title}</h3>
                  <div className="flex gap-2 items-center mt-2">
                    <QualityBadge quality={movie.quality} />
                    <span className="text-xs text-muted-foreground">{movie.fileSize}</span>
                  </div>
                  <p className="text-xl font-black text-primary mt-2">{formatKes(movie.price)}</p>
                </div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
                {serverError && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">
                    {serverError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Send size={14} className="text-[#0088cc]" />
                    Telegram Username
                  </label>
                  <input
                    {...register("telegramUsername")}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                    placeholder="@username"
                  />
                  {errors.telegramUsername && <p className="text-xs text-destructive">{errors.telegramUsername.message}</p>}
                  <p className="text-[10px] text-muted-foreground">The movie file will be sent directly to this Telegram account.</p>
                  <a
                    href={`https://t.me/${import.meta.env.VITE_BOT_USERNAME ?? 'CineVaultBot'}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 mt-1.5 text-[11px] text-[#0088cc] hover:underline font-medium"
                  >
                    <Send size={11} />
                    First time? Start the bot so we can message you →
                  </a>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Smartphone size={14} className="text-[#52b520]" />
                    M-Pesa Phone Number
                  </label>
                  <input
                    {...register("phone")}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#52b520]/40 transition-all"
                    placeholder="07XX XXX XXX"
                  />
                  {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={createOrder.isPending}
                  className="w-full bg-[#52b520] hover:bg-[#48a01c] text-white font-bold py-3.5 rounded-xl shadow-[0_4px_14px_0_rgba(82,181,32,0.25)] transition-all active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-2 mt-2"
                >
                  {createOrder.isPending ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Initiating Payment...
                    </>
                  ) : (
                    "Pay with M-Pesa"
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
