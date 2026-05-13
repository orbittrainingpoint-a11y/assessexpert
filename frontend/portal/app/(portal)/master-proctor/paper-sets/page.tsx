'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { assessmentsApi } from '@/lib/api'
import { SetsList } from '@/components/paper-sets/SetsList'
import { SetEditor } from '@/components/paper-sets/SetEditor'

export default function PaperSetsPage() {
  const [activeSetId, setActiveSetId] = useState<string | null>(null)

  const { data: atData } = useQuery({
    queryKey: ['at-list-ps'],
    queryFn: () => assessmentsApi.getAll({ limit: 200 }).then(r => r.data),
  })
  const atList: any[] = atData?.assessmentTypes || atData || []

  if (activeSetId) {
    return <SetEditor setId={activeSetId} onBack={() => setActiveSetId(null)} />
  }
  return <SetsList assessmentTypes={atList} onOpenSet={setActiveSetId} />
}
