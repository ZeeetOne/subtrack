'use client'

import { useMemo } from 'react'
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  type TooltipItem,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip)

// Matches the lime-green design system (see spend-charts.tsx COLORS[0])
const PRIMARY = '#aee865'

interface MonthlyTotal {
  month: string // display label, e.g. "Jan 2026"
  total: number
}

interface StatsMonthlyChartProps {
  monthlyTotals: MonthlyTotal[]
  baseCurrency: string
}

const currencyFormatter = (baseCurrency: string) => (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: baseCurrency,
    maximumFractionDigits: 0,
  }).format(value)

/** 12-month totals bar chart for the stats page — same visual language as SpendCharts. */
export function StatsMonthlyChart({ monthlyTotals, baseCurrency }: StatsMonthlyChartProps) {
  const fmt = currencyFormatter(baseCurrency)

  const barData = useMemo(
    () => ({
      labels: monthlyTotals.map((m) => m.month),
      datasets: [
        {
          label: ' Total spend',
          data: monthlyTotals.map((m) => m.total),
          backgroundColor: PRIMARY,
          borderRadius: 6,
          maxBarThickness: 28,
        },
      ],
    }),
    [monthlyTotals]
  )

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a2a10',
        titleFont: { family: "'Geist', sans-serif", size: 13 },
        bodyFont: { family: "'Geist', sans-serif", size: 12, weight: 700 as const },
        padding: 12,
        cornerRadius: 12,
        displayColors: false,
        callbacks: {
          label: (context: TooltipItem<'bar'>) => fmt(context.parsed.y ?? 0),
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

  if (monthlyTotals.every((m) => m.total === 0)) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--muted-foreground)] text-sm font-medium border-2 border-dashed border-[var(--border)] rounded-2xl">
        Not enough data to display chart.
      </div>
    )
  }

  return (
    <div className="w-full h-72">
      <Bar data={barData} options={barOptions} />
    </div>
  )
}
