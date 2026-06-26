import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { X, Smartphone, Send, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateOrder } from "@workspace/api-client-react";
import { type Movie } from "@workspace/api-client-react/src/generated/api.schemas";
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
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xl"
            onClick={onClose}
          />
          
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-card border border-white/10 rounded-2xl shadow-2xl pointer-events-auto overflow-hidden flex flex-col"
            >
              <div className="p-6 pb-0 flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-white">Complete Purchase</h2>
                  <p className="text-sm text-white/50 mt-1">Instant delivery to your Telegram</p>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/70 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 pt-4 flex gap-4 border-b border-white/5 bg-background/30 mt-4">
                <img 
                  src={movie.posterUrl} 
                  alt={movie.title} 
                  className="w-16 h-24 object-cover rounded shadow-lg"
                />
                <div className="flex flex-col justify-center">
                  <h3 className="font-bold text-white line-clamp-1">{movie.title}</h3>
                  <div className="flex gap-2 items-center mt-2">
                    <QualityBadge quality={movie.quality} />
                    <span className="text-xs text-white/50">{movie.fileSize}</span>
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
                  <label className="text-sm font-medium text-white/80 flex items-center gap-2">
                    <Send size={14} className="text-[#0088cc]" />
                    Telegram Username
                  </label>
                  <input
                    {...register("telegramUsername")}
                    className="w-full bg-background border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    placeholder="@username"
                  />
                  {errors.telegramUsername && <p className="text-xs text-destructive">{errors.telegramUsername.message}</p>}
                  <p className="text-[10px] text-white/40">The movie file will be sent directly to this Telegram account.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-white/80 flex items-center gap-2">
                    <Smartphone size={14} className="text-[#52b520]" />
                    M-Pesa Phone Number
                  </label>
                  <input
                    {...register("phone")}
                    className="w-full bg-background border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#52b520]/50 transition-all"
                    placeholder="07XX XXX XXX"
                  />
                  {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={createOrder.isPending}
                  className="w-full bg-[#52b520] hover:bg-[#48a01c] text-white font-bold py-3.5 rounded-xl shadow-[0_4px_14px_0_rgba(82,181,32,0.39)] transition-all active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-2 mt-2"
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
