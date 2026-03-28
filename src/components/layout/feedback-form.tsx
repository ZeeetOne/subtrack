'use client'

import { useState } from 'react'
import { submitFeedback } from '@/lib/actions/profile'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { Send } from 'lucide-react'

export function FeedbackForm() {
  const [feedback, setFeedback] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit() {
    if (!feedback) return
    setIsLoading(true)
    const result = await submitFeedback({ message: feedback })
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Thank you for your feedback!')
      setFeedback('')
    }
    setIsLoading(false)
  }

  return (
    <Card className="border border-[var(--border)] bg-[var(--card)] rounded-2xl overflow-hidden">
      <CardContent className="p-8 space-y-4">
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Tell us what you think about SubTrack..."
          className="w-full min-h-[200px] rounded-xl border border-[var(--border)] bg-white p-4 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[var(--primary)] text-[var(--foreground)] resize-none placeholder:text-[var(--muted-foreground)]"
        />
        <Button
          className="w-full h-11 rounded-xl bg-[var(--primary)] text-white font-sans font-semibold uppercase tracking-widest transition-opacity hover:opacity-80 flex items-center justify-center gap-2"
          onClick={handleSubmit}
          disabled={isLoading || !feedback}
        >
          {isLoading ? 'Sending...' : (
            <>
              <Send className="w-4 h-4" />
              Send Feedback
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
