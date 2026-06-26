import { useParams, Link } from "wouter";
import { Layout } from "../components/layout";
import { useGetOrder, getGetOrderQueryKey } from "@workspace/api-client-react";
import { Loader2, CheckCircle2, AlertCircle, Clock, Send, ShieldCheck, Film } from "lucide-react";
import { motion } from "framer-motion";

export default function OrderStatus() {
  const { id } = useParams<{ id: string }>();

  const { data: order, isLoading } = useGetOrder(id!, {
    query: {
      enabled: !!id,
      refetchInterval: (data) => {
        if (data?.status === 'delivered' || data?.status === 'failed') return false;
        return 3000;
      },
      queryKey: getGetOrderQueryKey(id!)
    }
  });

  if (isLoading || !order) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center">
          <Loader2 className="animate-spin text-primary mb-4" size={40} />
          <p className="text-muted-foreground">Locating your order...</p>
        </div>
      </Layout>
    );
  }

  const stages = [
    { key: 'pending', label: 'Order Created', icon: Clock },
    { key: 'payment_initiated', label: 'Payment Initiated', icon: ShieldCheck },
    { key: 'payment_confirmed', label: 'Payment Confirmed', icon: CheckCircle2 },
    { key: 'delivering', label: 'Delivering to Telegram', icon: Send },
    { key: 'delivered', label: 'Delivered', icon: Film },
  ];

  let currentStageIndex = stages.findIndex(s => s.key === order.status);
  if (currentStageIndex === -1 && order.status !== 'failed') {
    currentStageIndex = 0;
  }

  const isFailed = order.status === 'failed';

  return (
    <Layout>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">

          <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-lg">

            {/* Header / Movie Summary — dark overlay on image, keep white text */}
            <div className="relative h-48 overflow-hidden bg-slate-900">
              <img
                src={order.moviePosterUrl}
                className="absolute inset-0 w-full h-full object-cover opacity-40 blur-sm scale-110"
                alt=""
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/60 to-transparent" />

              <div className="absolute inset-0 flex items-center p-6 gap-6">
                <img
                  src={order.moviePosterUrl}
                  className="w-24 h-36 object-cover rounded-xl shadow-2xl border border-white/20"
                  alt={order.movieTitle}
                />
                <div className="flex-1">
                  <h1 className="text-2xl font-black text-white leading-tight mb-2 line-clamp-2">
                    {order.movieTitle}
                  </h1>
                  <p className="text-white/60 font-mono text-sm">
                    {order.telegramUsername}
                  </p>
                </div>
              </div>
            </div>

            {/* Status Section */}
            <div className="p-8">

              {isFailed ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-6"
                >
                  <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="text-destructive" size={40} />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">Order Failed</h2>
                  <p className="text-destructive mb-8 max-w-xs mx-auto">
                    {order.failureReason || "Payment was not completed successfully. Please try again."}
                  </p>
                  <Link href={`/movie/${order.movieId}`} className="bg-muted hover:bg-muted/80 text-foreground font-bold py-3 px-8 rounded-xl transition-colors">
                    Try Again
                  </Link>
                </motion.div>
              ) : (
                <div className="space-y-8">
                  {order.status === 'delivered' ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center pb-8 pt-4 border-b border-border"
                    >
                      <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="text-emerald-500" size={40} />
                      </div>
                      <h2 className="text-3xl font-black text-foreground mb-2">Success!</h2>
                      <p className="text-emerald-600">Movie delivered to your Telegram.</p>
                      <p className="text-muted-foreground text-sm mt-4">Check your messages from our bot.</p>
                    </motion.div>
                  ) : (
                    <div className="text-center pb-6">
                      <Loader2 className="animate-spin text-primary mx-auto mb-4" size={32} />
                      <h2 className="text-xl font-bold text-foreground mb-1">Processing Order...</h2>
                      <p className="text-muted-foreground text-sm">Please keep this page open.</p>
                    </div>
                  )}

                  <div className="space-y-6">
                    {stages.map((stage, index) => {
                      const isCompleted = index <= currentStageIndex;
                      const isCurrent = index === currentStageIndex && order.status !== 'delivered';
                      const Icon = stage.icon;

                      return (
                        <div key={stage.key} className="flex items-center gap-4 relative">
                          {/* Connection Line */}
                          {index !== stages.length - 1 && (
                            <div className={`absolute left-[19px] top-[40px] bottom-[-24px] w-0.5 ${
                              index < currentStageIndex ? 'bg-primary' : 'bg-border'
                            }`} />
                          )}

                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 z-10 transition-colors duration-500 ${
                            isCurrent ? 'bg-primary/10 border-primary text-primary' :
                            isCompleted ? 'bg-primary border-primary text-white' :
                            'bg-muted border-border text-muted-foreground'
                          }`}>
                            <Icon size={18} />
                          </div>

                          <div className={`flex-1 ${
                            isCurrent ? 'text-foreground' :
                            isCompleted ? 'text-foreground' :
                            'text-muted-foreground'
                          }`}>
                            <p className="font-bold">{stage.label}</p>
                            {isCurrent && (
                              <p className="text-xs text-primary animate-pulse mt-0.5">In progress...</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
