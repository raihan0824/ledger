import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { transactionsApi, categoriesApi } from '@/lib/api'
import { formatCurrency, formatDateTime, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Search,
  Filter,
  X,
  ArrowUpDown,
} from 'lucide-react'

export default function TransactionsPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    kind: '',
    channel: '',
    startDate: '',
    endDate: '',
  })
  const [showFilters, setShowFilters] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [sortBy, setSortBy] = useState('datetime_iso')
  const [sortOrder, setSortOrder] = useState('DESC')

  const { data: transactionsData, isLoading } = useQuery({
    queryKey: ['transactions', page, filters, sortBy, sortOrder],
    queryFn: () => transactionsApi.list({
      page,
      limit: 20,
      ...filters,
      sortBy,
      sortOrder,
    }).then(res => res.data),
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list().then(res => res.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => transactionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['transactions'])
    },
  })

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (data.id) {
        return transactionsApi.update(data.id, data)
      }
      return transactionsApi.create(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['transactions'])
      setIsDialogOpen(false)
      setEditingTransaction(null)
    },
  })

  const transactions = transactionsData?.data || []
  const pagination = transactionsData?.pagination || {}
  const categories = categoriesData?.data || []

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')
    } else {
      setSortBy(column)
      setSortOrder('DESC')
    }
  }

  const handleEdit = (transaction) => {
    setEditingTransaction(transaction)
    setIsDialogOpen(true)
  }

  const handleCreate = () => {
    setEditingTransaction({
      kind: 'debit',
      channel: 'manual',
      status: 'completed',
      currency: 'IDR',
      datetime_iso: new Date().toISOString().slice(0, 16),
      category_code: 'other',
    })
    setIsDialogOpen(true)
  }

  const handleSave = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const data = {
      ...editingTransaction,
      kind: formData.get('kind'),
      channel: formData.get('channel'),
      status: formData.get('status'),
      merchant: formData.get('merchant'),
      datetime_iso: new Date(formData.get('datetime_iso')).toISOString(),
      amount_rp: parseInt(formData.get('amount_rp')),
      fee_rp: parseInt(formData.get('fee_rp') || 0),
      total_rp: parseInt(formData.get('amount_rp')) + parseInt(formData.get('fee_rp') || 0),
      category_code: formData.get('category_code'),
      summary: formData.get('summary'),
      notes: formData.get('notes'),
    }
    saveMutation.mutate(data)
  }

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      deleteMutation.mutate(id)
    }
  }

  const clearFilters = () => {
    setFilters({
      search: '',
      category: '',
      kind: '',
      channel: '',
      startDate: '',
      endDate: '',
    })
    setPage(1)
  }

  const hasActiveFilters = Object.values(filters).some(v => v !== '')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Transactions</h1>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Transaction
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by merchant, summary, or reference..."
                  className="pl-9"
                  value={filters.search}
                  onChange={(e) => {
                    setFilters({ ...filters, search: e.target.value })
                    setPage(1)
                  }}
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className={cn(hasActiveFilters && 'border-primary')}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-2">
                    {Object.values(filters).filter(v => v !== '').length}
                  </Badge>
                )}
              </Button>
              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              )}
            </div>

            {showFilters && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 pt-4 border-t">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={filters.category}
                    onValueChange={(value) => {
                      setFilters({ ...filters, category: value === 'all' ? '' : value })
                      setPage(1)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.code} value={cat.code}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={filters.kind}
                    onValueChange={(value) => {
                      setFilters({ ...filters, kind: value === 'all' ? '' : value })
                      setPage(1)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="debit">Expense</SelectItem>
                      <SelectItem value="credit">Income</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Channel</Label>
                  <Input
                    placeholder="Filter by channel"
                    value={filters.channel}
                    onChange={(e) => {
                      setFilters({ ...filters, channel: e.target.value })
                      setPage(1)
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => {
                      setFilters({ ...filters, startDate: e.target.value })
                      setPage(1)
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => {
                      setFilters({ ...filters, endDate: e.target.value })
                      setPage(1)
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('datetime_iso')}
                    >
                      <div className="flex items-center gap-1">
                        Date
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('merchant')}
                    >
                      <div className="flex items-center gap-1">
                        Merchant
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead 
                      className="text-right cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('total_rp')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Amount
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center h-32 text-muted-foreground">
                        No transactions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="font-medium">
                          {formatDateTime(tx.datetime_iso)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={tx.kind === 'credit' ? 'success' : 'destructive'}>
                            {tx.kind === 'credit' ? 'Income' : 'Expense'}
                          </Badge>
                        </TableCell>
                        <TableCell>{tx.merchant || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{tx.category_name || tx.category_code}</Badge>
                        </TableCell>
                        <TableCell>{tx.channel}</TableCell>
                        <TableCell className={cn(
                          "text-right font-medium",
                          tx.kind === 'credit' ? 'text-green-500' : 'text-red-500'
                        )}>
                          {tx.kind === 'credit' ? '+' : '-'}{formatCurrency(tx.total_rp)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(tx)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(tx.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} transactions
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page === pagination.totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTransaction?.id ? 'Edit Transaction' : 'Add Transaction'}
            </DialogTitle>
            <DialogDescription>
              {editingTransaction?.id ? 'Update transaction details' : 'Create a new transaction'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="kind">Type</Label>
                  <Select name="kind" defaultValue={editingTransaction?.kind || 'debit'}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">Expense</SelectItem>
                      <SelectItem value="credit">Income</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select name="status" defaultValue={editingTransaction?.status || 'completed'}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="datetime_iso">Date & Time</Label>
                  <Input
                    type="datetime-local"
                    name="datetime_iso"
                    defaultValue={editingTransaction?.datetime_iso?.slice(0, 16)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="channel">Channel</Label>
                  <Input
                    name="channel"
                    defaultValue={editingTransaction?.channel}
                    placeholder="e.g., bank_transfer, cash"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="merchant">Merchant / Description</Label>
                <Input
                  name="merchant"
                  defaultValue={editingTransaction?.merchant}
                  placeholder="e.g., Grocery Store, Salary"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount_rp">Amount (IDR)</Label>
                  <Input
                    type="number"
                    name="amount_rp"
                    defaultValue={editingTransaction?.amount_rp}
                    placeholder="0"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fee_rp">Fee (IDR)</Label>
                  <Input
                    type="number"
                    name="fee_rp"
                    defaultValue={editingTransaction?.fee_rp || 0}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category_code">Category</Label>
                  <Select name="category_code" defaultValue={editingTransaction?.category_code || 'other'}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.code} value={cat.code}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="summary">Summary</Label>
                <Input
                  name="summary"
                  defaultValue={editingTransaction?.summary}
                  placeholder="Brief description"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  name="notes"
                  defaultValue={editingTransaction?.notes}
                  placeholder="Additional notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
