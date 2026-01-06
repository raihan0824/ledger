import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { budgetsApi, categoriesApi, settingsApi } from '@/lib/api'
import { formatCurrency, getPercentage } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
  PiggyBank,
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react'

export default function BudgetsPage() {
  const queryClient = useQueryClient()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState(null)

  const { data: budgetData, isLoading: loadingBudgets } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => budgetsApi.list().then(res => res.data),
  })

  const { data: summaryData } = useQuery({
    queryKey: ['budget-summary'],
    queryFn: () => budgetsApi.summary().then(res => res.data),
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list().then(res => res.data),
  })

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (data.id) {
        return budgetsApi.update(data.id, data)
      }
      return budgetsApi.create(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['budgets'])
      queryClient.invalidateQueries(['budget-summary'])
      setIsDialogOpen(false)
      setEditingBudget(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => budgetsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['budgets'])
      queryClient.invalidateQueries(['budget-summary'])
    },
  })

  const budgets = budgetData?.data || []
  const period = budgetData?.period || {}
  const summary = summaryData?.data || {}
  const categories = categoriesData?.data || []

  // Categories that don't have a budget yet
  const availableCategories = categories.filter(
    cat => !budgets.some(b => b.category_code === cat.code)
  )

  const handleCreate = () => {
    setEditingBudget({ amount_rp: 0, category_code: '', period_type: 'monthly' })
    setIsDialogOpen(true)
  }

  const handleEdit = (budget) => {
    setEditingBudget(budget)
    setIsDialogOpen(true)
  }

  const handleSave = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const data = {
      ...editingBudget,
      category_code: formData.get('category_code'),
      amount_rp: parseInt(formData.get('amount_rp')),
      period_type: formData.get('period_type'),
    }
    saveMutation.mutate(data)
  }

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this budget?')) {
      deleteMutation.mutate(id)
    }
  }

  const totalBudget = summary.totalBudget || 0
  const totalSpent = summary.totalSpent || 0
  const totalPercentage = getPercentage(totalSpent, totalBudget)
  const isOverBudget = totalSpent > totalBudget
  const isWarning = totalPercentage >= 80 && !isOverBudget

  if (loadingBudgets) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Budgets</h1>
        <Button onClick={handleCreate} disabled={availableCategories.length === 0}>
          <Plus className="h-4 w-4 mr-2" />
          Add Budget
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBudget)}</div>
            <p className="text-xs text-muted-foreground">Monthly allocation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            {isOverBudget ? (
              <TrendingUp className="h-4 w-4 text-red-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-green-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${isOverBudget ? 'text-red-500' : ''}`}>
              {formatCurrency(totalSpent)}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalPercentage}% of budget used
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining</CardTitle>
            {isOverBudget ? (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${isOverBudget ? 'text-red-500' : 'text-green-500'}`}>
              {formatCurrency(Math.abs(summary.remaining || 0))}
              {isOverBudget && ' over'}
            </div>
            <p className="text-xs text-muted-foreground">
              {isOverBudget ? 'Over budget!' : 'Still available'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Overall Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Budget Progress</CardTitle>
          <CardDescription>
            Budget period: Day {period.startDay} to Day {period.startDay - 1}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Spent: {formatCurrency(totalSpent)}</span>
              <span>Budget: {formatCurrency(totalBudget)}</span>
            </div>
            <Progress
              value={Math.min(totalPercentage, 100)}
              indicatorClassName={
                isOverBudget ? 'bg-red-500' :
                isWarning ? 'bg-yellow-500' :
                'bg-green-500'
              }
            />
            {isOverBudget && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                You've exceeded your budget by {formatCurrency(totalSpent - totalBudget)}
              </p>
            )}
            {isWarning && (
              <p className="text-sm text-yellow-500 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                Warning: You've used {totalPercentage}% of your budget
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Budget List */}
      <Card>
        <CardHeader>
          <CardTitle>Category Budgets</CardTitle>
          <CardDescription>
            Set spending limits for each category
          </CardDescription>
        </CardHeader>
        <CardContent>
          {budgets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <PiggyBank className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No budgets set yet</p>
              <p className="text-sm">Click "Add Budget" to create your first budget</p>
            </div>
          ) : (
            <div className="space-y-6">
              {budgets.map((budget) => {
                const spent = parseInt(budget.actual_spent) || 0
                const total = parseInt(budget.amount_rp) || 1
                const percentage = Math.min(getPercentage(spent, total), 100)
                const isOver = spent > total
                const isWarn = percentage >= 80 && !isOver

                return (
                  <div key={budget.id} className="space-y-3 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          isOver ? 'bg-red-100 dark:bg-red-950' :
                          isWarn ? 'bg-yellow-100 dark:bg-yellow-950' :
                          'bg-green-100 dark:bg-green-950'
                        }`}>
                          <PiggyBank className={`h-5 w-5 ${
                            isOver ? 'text-red-600' :
                            isWarn ? 'text-yellow-600' :
                            'text-green-600'
                          }`} />
                        </div>
                        <div>
                          <h3 className="font-semibold">{budget.category_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {budget.period_type} budget
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isOver && <Badge variant="destructive">Over Budget</Badge>}
                        {isWarn && <Badge variant="warning">Warning</Badge>}
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(budget)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(budget.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className={isOver ? 'text-red-500 font-medium' : ''}>
                          Spent: {formatCurrency(spent)}
                        </span>
                        <span>Budget: {formatCurrency(total)}</span>
                      </div>
                      <Progress
                        value={percentage}
                        indicatorClassName={
                          isOver ? 'bg-red-500' :
                          isWarn ? 'bg-yellow-500' :
                          'bg-green-500'
                        }
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{percentage}% used</span>
                        <span>
                          {isOver
                            ? `${formatCurrency(spent - total)} over`
                            : `${formatCurrency(total - spent)} remaining`
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Budget Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBudget?.id ? 'Edit Budget' : 'Add Budget'}
            </DialogTitle>
            <DialogDescription>
              Set a spending limit for a category
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="category_code">Category</Label>
                <Select
                  name="category_code"
                  defaultValue={editingBudget?.category_code}
                  disabled={!!editingBudget?.id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {editingBudget?.id ? (
                      <SelectItem value={editingBudget.category_code}>
                        {editingBudget.category_name}
                      </SelectItem>
                    ) : (
                      availableCategories.map((cat) => (
                        <SelectItem key={cat.code} value={cat.code}>
                          {cat.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount_rp">Budget Amount (IDR)</Label>
                <Input
                  type="number"
                  name="amount_rp"
                  defaultValue={editingBudget?.amount_rp}
                  placeholder="Enter budget amount"
                  min="0"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="period_type">Period Type</Label>
                <Select name="period_type" defaultValue={editingBudget?.period_type || 'monthly'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : 'Save Budget'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
