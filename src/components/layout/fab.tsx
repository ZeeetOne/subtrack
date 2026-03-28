'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { ExpenseForm } from '@/components/expenses/expense-form'

export function FAB() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-28 right-6 z-50 h-14 w-14 rounded-2xl shadow-xl shadow-[var(--primary)]/30 md:bottom-10 md:right-10 bg-[var(--primary)] hover:bg-[var(--primary-container)] transition-colors duration-200"
        size="icon"
      >
        <Plus className="w-8 h-8 text-white" />
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Add Expense"
      >
        <ExpenseForm onSuccess={() => setIsOpen(false)} onCancel={() => setIsOpen(false)} />
      </Modal>
    </>
  )
}
