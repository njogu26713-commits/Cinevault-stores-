import { useState } from "react";
import { useListAdminOrders } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";

export function Orders() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [page, setPage] = useState(1);

  // Debounce search
  useState(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(handler);
  }, [search]);

  const { data, isLoading } = useListAdminOrders({
    search: debouncedSearch || undefined,
    status: status !== "all" ? status : undefined,
    paymentStatus: paymentStatus !== "all" ? paymentStatus : undefined,
    page,
    limit: 15,
  });

  const formatMoney = (amount: number) => `KES ${amount.toLocaleString()}`;

  const getStatusColor = (s: string) => {
    switch (s) {
      case "delivered": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "delivering": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "failed": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    }
  };

  const getPaymentStatusColor = (s: string) => {
    switch (s) {
      case "confirmed": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "failed": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-4 rounded-lg border">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by phone, username, or movie..." 
            className="pl-9 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Delivery Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Delivery</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="delivering">Delivering</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={paymentStatus} onValueChange={setPaymentStatus}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Payment Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payments</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="initiated">Initiated</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID / Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Movie</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Delivery</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(10)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-10 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-10 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-10 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                </TableRow>
              ))
            ) : !data?.orders.length ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No orders found.
                </TableCell>
              </TableRow>
            ) : (
              data.orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <div className="font-mono text-xs text-muted-foreground">{order.id.slice(-6)}</div>
                    <div className="text-xs">{new Date(order.createdAt).toLocaleDateString()}</div>
                    <div className="text-[10px] text-muted-foreground">{new Date(order.createdAt).toLocaleTimeString()}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{order.phone}</div>
                    <div className="text-xs text-primary">@{order.telegramUsername}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <img src={order.moviePosterUrl} alt={order.movieTitle} className="w-6 h-9 object-cover rounded bg-muted" />
                      <span className="text-sm font-medium">{order.movieTitle}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{formatMoney(order.amount)}</div>
                    {order.mpesaReceiptNumber && (
                      <div className="text-xs font-mono text-muted-foreground">{order.mpesaReceiptNumber}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize ${getPaymentStatusColor(order.paymentStatus)}`}>
                      {order.paymentStatus.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge variant="outline" className={`capitalize ${getStatusColor(order.status)}`}>
                        {order.status.replace("_", " ")}
                      </Badge>
                      {order.failureReason && (
                        <p className="text-[10px] text-destructive max-w-[150px] truncate" title={order.failureReason}>
                          {order.failureReason}
                        </p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button 
            variant="outline" 
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            Previous
          </Button>
          <div className="flex items-center text-sm">
            Page {page} of {data.totalPages}
          </div>
          <Button 
            variant="outline" 
            disabled={page === data.totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
