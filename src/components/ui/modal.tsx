'use client'

import * as React from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative w-full sm:max-w-md bg-[var(--card)] rounded-t-[1.75rem] sm:rounded-2xl overflow-hidden shadow-[0_-8px_60px_rgba(0,0,0,0.18)] sm:shadow-[0_8px_60px_rgba(0,0,0,0.18)] animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 sm:zoom-in-95 duration-300">

        {/* Mobile drag pill */}
        <div className="flex justify-center pt-3.5 pb-1 sm:hidden">
          <div className="w-9 h-[3px] rounded-full bg-[var(--border)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 sm:pt-6">
          <h2 className="text-[15px] font-semibold text-[var(--foreground)] tracking-[-0.01em]">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[var(--muted)] flex items-center justify-center hover:bg-[var(--border)] transition-colors"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
          </button>
        </div>

        {/* Separator */}
        <div className="mx-6 h-px bg-[var(--border)]" />

        {/* Scrollable content */}
        <div className="px-6 pt-5 pb-8 max-h-[82vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}
