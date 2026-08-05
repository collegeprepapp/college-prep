/**
 * Presentation helpers for uploaded documents, shared by the server (which
 * formats the size label) and the client (which picks the icon).
 */

/** "2.3 MB". Uses decimal units, matching what an OS file dialog shows. */
export function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes < 0) {
    return ''
  }

  if (bytes < 1000) {
    return `${bytes} B`
  }

  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1000
  let unitIndex = 0

  while (value >= 1000 && unitIndex < units.length - 1) {
    value /= 1000
    unitIndex += 1
  }

  // One decimal below 10 ("2.3 MB"), none above ("24 MB") — enough precision to
  // be useful without being noisy.
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unitIndex]}`
}

export type DocumentKind = 'pdf' | 'word' | 'sheet' | 'image' | 'text' | 'other'

/**
 * Classifies by MIME type first, falling back to the file extension — the
 * stored mime_type is whatever the browser declared and can be missing or
 * generic (application/octet-stream).
 */
export function documentKind(
  mimeType: string | null,
  fileName: string
): DocumentKind {
  const mime = (mimeType ?? '').toLowerCase()

  if (mime === 'application/pdf') return 'pdf'
  if (mime.startsWith('image/')) return 'image'
  if (mime.includes('wordprocessing') || mime === 'application/msword')
    return 'word'
  if (mime.includes('spreadsheet') || mime === 'application/vnd.ms-excel')
    return 'sheet'
  if (mime.startsWith('text/')) return 'text'

  const extension = fileName.toLowerCase().split('.').pop() ?? ''

  if (extension === 'pdf') return 'pdf'
  if (['doc', 'docx', 'odt', 'rtf'].includes(extension)) return 'word'
  if (['xls', 'xlsx', 'csv'].includes(extension)) return 'sheet'
  if (['png', 'jpg', 'jpeg', 'webp', 'heic'].includes(extension)) return 'image'
  if (['txt', 'md'].includes(extension)) return 'text'

  return 'other'
}

/**
 * Turns a user's filename into a safe storage key segment.
 *
 * Storage keys reject some characters outright and a '/' would break the
 * <student_id>/<file> convention the RLS policies in migration 016 depend on,
 * so anything outside a conservative set becomes an underscore. The original
 * name is kept in documents.file_name and is what the user sees and downloads.
 */
export function toStorageSafeName(fileName: string): string {
  const cleaned = fileName
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._-]+/, '')

  return (cleaned || 'file').slice(0, 100)
}
