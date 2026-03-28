'use client'

import { useState, useRef, useEffect } from 'react'

interface InfoButtonProps {
  text: string
}

export function InfoButton({ text }: InfoButtonProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-[18px] h-[18px] rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] text-[10px] font-bold flex items-center justify-center hover:bg-[var(--border)] transition-colors leading-none"
        aria-label="More info"
      >
        !
      </button>
      {open && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-52 bg-[var(--foreground)] text-[var(--card)] text-[11px] font-medium rounded-xl px-3.5 py-2.5 shadow-xl z-20 leading-relaxed">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-[var(--foreground)]" />
        </div>
      )}
    </div>
  )
}
