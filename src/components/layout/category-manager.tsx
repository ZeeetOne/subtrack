'use client'

import { useState, useEffect } from 'react'
import { getCategories, createCategory, deleteCategory } from '@/lib/actions/expense'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Plus, Trash2, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Category {
  id: string
  name: string
  icon?: string
  color?: string
  user_id?: string
}

export function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([])
  const [newCategory, setNewCategory] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    loadCategories()
  }, [])

  async function loadCategories() {
    const result = await getCategories()
    if (result.data) {
      setCategories(result.data)
    }
  }

  async function handleAddCategory() {
    if (!newCategory.trim()) return
    setIsLoading(true)
    const result = await createCategory({ name: newCategory.trim() })
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Category added!')
      setNewCategory('')
      loadCategories()
    }
    setIsLoading(false)
  }

  async function handleDeleteCategory(id: string) {
    const result = await deleteCategory(id)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Category removed')
      loadCategories()
    }
  }

  return (
    <Card className="border border-[var(--border)] bg-[var(--card)] rounded-2xl overflow-hidden">
      <CardHeader className="p-8 pb-4">
        <CardTitle className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Categories</CardTitle>
        <CardDescription className="text-xs font-medium text-[var(--muted-foreground)]">
          Manage your custom expense categories.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-8 pt-0 space-y-6">
        <div className="flex gap-2">
          <Input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="New category name…"
            className="h-11 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium focus-visible:ring-1 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-0"
            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
          />
          <Button
            onClick={handleAddCategory}
            disabled={isLoading || !newCategory.trim()}
            className="h-11 w-11 rounded-xl bg-[var(--primary)] text-white p-0 flex items-center justify-center"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-2">
          {categories.map((cat) => (
            <div 
              key={cat.id} 
              className="flex items-center justify-between p-4 bg-[var(--background)] rounded-2xl group transition-all hover:bg-[var(--accent)]"
            >
              <div className="flex items-center">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center mr-3"
                  style={{ backgroundColor: cat.color || 'var(--primary-container)', color: 'white' }}
                >
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">{cat.name}</p>
                  {!cat.user_id && <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-tight">Default</p>}
                </div>
              </div>
              
              {cat.user_id && (
                <button 
                  onClick={() => handleDeleteCategory(cat.id)}
                  className="text-[var(--destructive)] opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-[var(--destructive)]/10 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
