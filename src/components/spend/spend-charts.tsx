'use client'

import { useMemo } from 'react'
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Title,
  type TooltipItem,
} from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'
import type { ProcessedSpendEntry } from '@/lib/types'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, Title)

// Chart color palette harmonized with lime-green design system
const COLORS = [
  '#aee865', // Lime (primary)
  '#c89e2a', // Amber (tertiary)
  '#8b5cf6', // Violet
  '#6da030', // Forest green (secondary)
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#ef4444', // Red
  '#a78bfa', // Lavender
]

interface MonthlyTotal {
  month: string // display label, e.g. "Jan 2026"
  total: number
}

interface SpendChartsProps {
  entries: ProcessedSpendEntry[]
  monthlyTotals: MonthlyTotal[]
  baseCurrency: string
}

const currencyFormatter = (baseCurrency: string) => (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: baseCurrency,
    maximumFractionDigits: 0,
  }).format(value)

export function SpendCharts({ entries, monthlyTotals, baseCurrency }: SpendChartsProps) {
  const fmt = currencyFormatter(baseCurrency)

  const doughnutData = useMemo(() => {
    // Group this month's actual spend (incl. one-time) by category
    const categoryTotals: Record<string, number> = {}

    entries.forEach((e) => {
      const cat = e.categoryName || 'Uncategorized'
      categoryTotals[cat] = (categoryTotals[cat] || 0) + e.amountInBase
    })

    const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])

    const labels = sortedCategories.map((item) => item[0])
    const data = sortedCategories.map((item) => item[1])

    return {
      labels,
      datasets: [
        {
          label: ' Spend',
          data,
          backgroundColor: COLORS.slice(0, labels.length).concat(
            Array(Math.max(0, labels.length - COLORS.length)).fill('#94a3b8')
          ),
          borderColor: '#ffffff',
          borderWidth: 3,
          hoverOffset: 4,
        },
      ],
    }
  }, [entries])

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '75%',
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          font: {
            family: "'Geist', sans-serif",
            weight: 700 as const,
            size: 11,
          },
          usePointStyle: true,
          padding: 20,
          color: '#5a6e45', // var(--muted-foreground)
        },
      },
      tooltip: {
        backgroundColor: '#1a2a10',
        titleFont: {
          family: "'Geist', sans-serif",
          size: 13,
        },
        bodyFont: {
          family: "'Geist', sans-serif",
          size: 12,
          weight: 700 as const,
        },
        padding: 12,
        cornerRadius: 12,
        displayColors: true,
        callbacks: {
          label: function (context: TooltipItem<'doughnut'>) {
            let label = context.dataset.label || ''
            if (label) {
              label += ': '
            }
            if (context.parsed !== null) {
              label += fmt(context.parsed)
            }
            return label
          },
        },
      },
    },
    animation: {
      animateScale: true,
      animateRotate: true,
    },
  }

  const barData = useMemo(() => {
    return {
      labels: monthlyTotals.map((m) => m.month),
      datasets: [
        {
          label: ' Total spend',
          data: monthlyTotals.map((m) => m.total),
          backgroundColor: COLORS[0],
          borderRadius: 8,
          maxBarThickness: 36,
        },
      ],
    }
  }, [monthlyTotals])

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a2a10',
        titleFont: {
          family: "'Geist', sans-serif",
          size: 13,
        },
        bodyFont: {
          family: "'Geist', sans-serif",
          size: 12,
          weight: 700 as const,
        },
        padding: 12,
        cornerRadius: 12,
        displayColors: false,
        callbacks: {
          label: function (context: TooltipItem<'bar'>) {
            return fmt(context.parsed.y ?? 0)
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { family: "'Geist', sans-serif", weight: 700 as const, size: 10 },
          color: '#5a6e45',
        },
      },
      y: {
        grid: { color: 'rgba(90, 110, 69, 0.1)' },
        ticks: {
          font: { family: "'Geist', sans-serif", weight: 700 as const, size: 10 },
          color: '#5a6e45',
          callback: (value: string | number) => fmt(Number(value)),
        },
      },
    },
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6">
        <h3 className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest mb-4">
          This month by category
        </h3>
        {doughnutData.labels.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-[var(--muted-foreground)] text-sm font-medium border-2 border-dashed border-[var(--border)] rounded-2xl">
            Not enough data to display chart.
          </div>
        ) : (
          <div className="w-full h-72">
            <Doughnut data={doughnutData} options={doughnutOptions} />
          </div>
        )}
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6">
        <h3 className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest mb-4">
          Last 6 months
        </h3>
        {barData.labels.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-[var(--muted-foreground)] text-sm font-medium border-2 border-dashed border-[var(--border)] rounded-2xl">
            Not enough data to display chart.
          </div>
        ) : (
          <div className="w-full h-72">
            <Bar data={barData} options={barOptions} />
          </div>
        )}
      </div>
    </div>
  )
}
