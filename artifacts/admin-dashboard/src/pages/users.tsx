import { useState, useEffect } from "react";
import { useListAdminUsers } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, UserCircle } from "lucide-react";

export function Users() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(handler);
  }, [search]);

  const { data, isLoading } = useListAdminUsers({
    search: debouncedSearch || undefined,
    page,
    limit: 15,
  });

  const formatMoney = (amount: number) => `KES ${amount.toLocaleString()}`;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
      </div>

      <div className="flex items-center bg-card p-4 rounded-lg border">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by phone or username..." 
            className="pl-9 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="text-right">Total Orders</TableHead>
              <TableHead className="text-right">Delivered</TableHead>
              <TableHead className="text-right">Total Spent</TableHead>
              <TableHead className="text-right">Last Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(10)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-10 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-12 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-12 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : !data?.users.length ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              data.users.map((user, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
                        <UserCircle className="w-5 h-5" />
                      </div>
                      <span className="font-medium text-primary">@{user.telegramUsername}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{user.phone}</TableCell>
                  <TableCell className="text-right">{user.totalOrders}</TableCell>
                  <TableCell className="text-right">{user.deliveredOrders}</TableCell>
                  <TableCell className="text-right font-medium text-primary">{formatMoney(user.totalSpent)}</TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
                    {new Date(user.lastOrderAt).toLocaleDateString()}
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
