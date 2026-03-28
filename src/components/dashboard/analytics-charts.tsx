'use client'

import { useMemo } from 'react'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  Title,
  type TooltipItem,
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import type { ProcessedExpense } from '@/lib/types'

ChartJS.register(ArcElement, Tooltip, Legend, Title)

interface AnalyticsChartsProps {
  expenses: ProcessedExpense[]
  baseCurrency: string
}

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

export function AnalyticsCharts({ expenses, baseCurrency }: AnalyticsChartsProps) {
  const chartData = useMemo(() => {
    // Filter out one-time expenses for the recurring breakdown
    const recurringExpenses = expenses.filter(e => e.billing_cycle !== 'one-time' && e.is_active)
    
    // Group by category and sum the monthlyInBase amounts
    const categoryTotals: Record<string, number> = {}
    
    recurringExpenses.forEach(e => {
      const cat = e.category || 'Uncategorized'
      categoryTotals[cat] = (categoryTotals[cat] || 0) + e.monthlyInBase
    })

    // Sort categories by total value descending
    const sortedCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])

    const labels = sortedCategories.map(item => item[0])
    const data = sortedCategories.map(item => item[1])

    return {
      labels,
      datasets: [
        {
          label: ' Monthly Burn',
          data,
          backgroundColor: COLORS.slice(0, labels.length).concat(Array(Math.max(0, labels.length - COLORS.length)).fill('#94a3b8')),
          borderColor: '#ffffff',
          borderWidth: 3,
          hoverOffset: 4,
        }
      ]
    }
  }, [expenses])

  const options = {
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
            size: 11
          },
          usePointStyle: true,
          padding: 20,
          color: '#5a6e45' // var(--muted-foreground)
        }
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
          label: function(context: TooltipItem<'doughnut'>) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed !== null) {
              label += new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: baseCurrency,
                maximumFractionDigits: 0
              }).format(context.parsed);
            }
            return label;
          }
        }
      }
    },
    animation: {
      animateScale: true,
      animateRotate: true
    }
  }

  if (chartData.labels.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--muted-foreground)] text-sm font-medium border-2 border-dashed border-[var(--border)] rounded-2xl">
        Not enough data to display chart.
      </div>
    )
  }

  return (
    <div className="w-full h-72">
      <Doughnut data={chartData} options={options} />
    </div>
  )
}
