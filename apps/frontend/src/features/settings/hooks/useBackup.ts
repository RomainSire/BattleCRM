import { useMutation, useQueryClient } from '@tanstack/react-query'
import { backupApi } from '../lib/api'

/**
 * Export the full account backup and trigger a file download in the browser.
 */
export function useExportBackup() {
  return useMutation({
    mutationFn: () => backupApi.export(),
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename ?? 'battlecrm-export.json.gz'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    },
  })
}

/**
 * Import a backup file (destructive total replacement) and refresh the whole cache.
 */
export function useImportBackup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => backupApi.import(file),
    onSuccess: () => {
      // Every account resource was replaced → invalidate the entire query cache.
      queryClient.invalidateQueries()
    },
  })
}
