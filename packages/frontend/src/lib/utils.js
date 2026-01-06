import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount, currency = 'IDR') {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(num) {
  return new Intl.NumberFormat('id-ID').format(num)
}

export function formatDate(date, options = {}) {
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options
  }).format(new Date(date))
}

export function formatDateTime(date) {
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function getPercentage(value, total) {
  if (total === 0) return 0
  return Math.round((value / total) * 100)
}

export function getBudgetStatus(spent, budget) {
  const percentage = getPercentage(spent, budget)
  if (percentage >= 100) return 'exceeded'
  if (percentage >= 80) return 'warning'
  if (percentage >= 50) return 'caution'
  return 'safe'
}
