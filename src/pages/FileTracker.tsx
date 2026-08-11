import { useState, useEffect, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { logActivity } from '../lib/activityLogger'
import { sha256Hex } from '../lib/fileIntegrity'
import { runPrivateStorageMaintenance } from '../lib/privateStorageFeature.js'
import {
  acknowledgePrivateStorageReview,
  cleanupUnreferencedPrivateObjects,
  drainPrivateStorageCleanup,
  isDefiniteDatabaseRejection,
  queuePrivateStorageCleanup,
  uploadPrivateObject,
} from '../lib/privateStorage'

interface Asset {
  id: string
  name: string
  category: string
  type: string
  dataUrl?: string
  storagePath?: string
  checksumSha256?: string
  url?: string
  addedAt: string
  size: number
  isMock?: boolean
}

const CATEGORIES = ['All Files', 'Presentations', 'Social Media', 'Brand Assets', 'Templates', 'Documents']

const CATEGORY_COLORS: Record<string, string> = {
  'Presentations': '#FF5900',
  'Social Media': '#FF8A00',
  'Brand Assets': '#6C5CE7',
  'Templates': '#00B894',
  'Documents': '#0984E3',
}

const STORAGE_KEY = 'exodia-file-tracker-assets'
const ASSET_BUCKET = 'marketing-assets'
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024
const SIGNED_URL_TTL_SECONDS = 60 * 60
const PRIVATE_STORAGE_ENABLED = import.meta.env.VITE_PRIVATE_STORAGE_ENABLED === 'true'

type InsertOutcome = 'saved' | 'not_saved' | 'unknown'

class UnknownAssetSaveOutcome extends Error {}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isImage(type: string): boolean { return type.startsWith('image/') }
function isLink(type: string): boolean { return type === 'link' }

function getFileTypeIcon(type: string) {
  if (isLink(type)) return 'link'
  if (isImage(type)) return 'image'
  if (type.includes('pdf')) return 'pdf'
  if (type.includes('spreadsheet') || type.includes('excel') || type.includes('sheet')) return 'sheet'
  if (type.includes('video')) return 'video'
  return 'doc'
}

function getExt(type: string): string {
  if (isLink(type)) return 'URL'
  const map: Record<string, string> = { 'application/pdf': 'PDF', 'image/png': 'PNG', 'image/jpeg': 'JPG', 'image/svg+xml': 'SVG', 'image/gif': 'GIF', 'image/webp': 'WEBP', 'text/plain': 'TXT', 'text/csv': 'CSV' }
  return map[type] || type.split('/').pop()?.toUpperCase() || 'FILE'
}

function renderTypeIcon(type: string, size: number, color: string) {
  const icon = getFileTypeIcon(type)
  switch (icon) {
    case 'link':
      return <svg className={`w-${size} h-${size}`} style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
    case 'image':
      return <svg className={`w-${size} h-${size}`} style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
    case 'pdf':
      return <svg className={`w-${size} h-${size}`} style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
    case 'doc':
      return <svg className={`w-${size} h-${size}`} style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
    case 'sheet':
      return <svg className={`w-${size} h-${size}`} style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
    case 'video':
      return <svg className={`w-${size} h-${size}`} style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
  }
}

function generateId(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8) }

function isValidUrl(str: string): boolean {
  try { new URL(str); return true } catch { return false }
}

function normalizeUrl(str: string): string {
  if (!str.startsWith('http://') && !str.startsWith('https://')) return 'https://' + str
  return str
}

export default function FileTracker() {
  const [localAssets] = useState<Asset[]>(() => {
    if (isSupabaseConfigured) return []
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (!saved) return []
      const parsed = JSON.parse(saved)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })
  const [remoteAssets, setRemoteAssets] = useState<Asset[]>([])
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured)
  const [canonicalReady, setCanonicalReady] = useState(false)
  const [syncError, setSyncError] = useState('')
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All Files')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadMode, setUploadMode] = useState<'file' | 'link'>(
    PRIVATE_STORAGE_ENABLED ? 'file' : 'link',
  )
  const [uploadCategory, setUploadCategory] = useState('Presentations')
  const [uploadError, setUploadError] = useState('')
  const [reconciliationRequired, setReconciliationRequired] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [linkName, setLinkName] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && editInputRef.current) editInputRef.current.focus()
  }, [editingId])

  useEffect(() => {
    if (folderInputRef.current) folderInputRef.current.setAttribute('webkitdirectory', '')
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return
    const client = supabase
    const sync = async () => {
      try {
        setSyncError('')
        await runPrivateStorageMaintenance(
          PRIVATE_STORAGE_ENABLED,
          () => drainPrivateStorageCleanup(client, ASSET_BUCKET),
        )
        const { data, error } = await client
          .from('file_tracker_assets')
          .select('*')
          .or('is_mock.eq.false,is_mock.is.null')
          .order('added_at', { ascending: false })
        if (error) throw error
        const storagePaths = (data || [])
          .map((row: any) => row.storage_path)
          .filter((path: unknown): path is string => typeof path === 'string' && path.length > 0)
        const signedUrls = new Map<string, string>()
        await Promise.all(storagePaths.map(async path => {
          const { data: signedData } = await client.storage
            .from(ASSET_BUCKET)
            .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
          if (signedData?.signedUrl) signedUrls.set(path, signedData.signedUrl)
        }))
        const supabaseAssets = (data || []).map((r: any) => ({
          id: r.id,
          name: r.name,
          category: r.category,
          type: r.type,
          dataUrl: (r.storage_path && signedUrls.get(r.storage_path)) || r.data_url || undefined,
          storagePath: r.storage_path || undefined,
          checksumSha256: r.checksum_sha256 || undefined,
          url: r.url,
          addedAt: r.added_at,
          size: r.size,
          isMock: r.is_mock,
        }))
        setRemoteAssets(supabaseAssets)
        setCanonicalReady(true)
      } catch (err) {
        console.error('Failed to sync file tracker assets:', err)
        setRemoteAssets([])
        setCanonicalReady(false)
        setSyncError('Could not load canonical assets. Preserved browser-only records are quarantined.')
      } finally {
        setIsLoading(false)
      }
    }
    sync()
  }, [])

  const supabaseInsert = async (asset: Asset): Promise<InsertOutcome> => {
    if (!isSupabaseConfigured || !supabase || !canonicalReady || asset.isMock) return 'not_saved'
    const client = supabase
    const row: Record<string, unknown> = {
      id: asset.id,
      name: asset.name,
      category: asset.category,
      type: asset.type,
      data_url: null,
      url: asset.url || null,
      added_at: asset.addedAt,
      size: asset.size,
      is_mock: false,
    }
    if (asset.storagePath) {
      row.storage_path = asset.storagePath
      row.checksum_sha256 = asset.checksumSha256
    }

    let definiteFailure = false
    try {
      const { data, error } = await client
        .from('file_tracker_assets')
        .insert(row)
        .select('id')
        .single()
      if (!error && data?.id === asset.id) return 'saved'
      definiteFailure = isDefiniteDatabaseRejection(error)
    } catch {
      // Verify the client-generated ID before deciding whether cleanup is safe.
    }

    try {
      const { data, error } = await client
        .from('file_tracker_assets')
        .select('*')
        .eq('id', asset.id)
        .maybeSingle()
      if (error) return 'unknown'
      if (!data) return definiteFailure ? 'not_saved' : 'unknown'
      const sameAsset = asset.storagePath
        ? data.storage_path === asset.storagePath
          && data.checksum_sha256 === asset.checksumSha256
        : data.url === (asset.url || null)
      if (sameAsset) return 'saved'
      return definiteFailure ? 'not_saved' : 'unknown'
    } catch {
      return 'unknown'
    }
  }

  const supabaseUpdate = async (id: string, fields: Partial<Pick<Asset, 'name' | 'category'>>): Promise<boolean> => {
    if (!isSupabaseConfigured || !supabase || !canonicalReady) return false
    const dbFields: Partial<Pick<Asset, 'name' | 'category'>> = {}
    if (fields.name !== undefined) dbFields.name = fields.name
    if (fields.category !== undefined) dbFields.category = fields.category
    try {
      const { data, error } = await supabase
        .from('file_tracker_assets')
        .update(dbFields)
        .eq('id', id)
        .select('id')
        .single()
      return !error && data?.id === id
    } catch {
      return false
    }
  }

  const supabaseDelete = async (id: string): Promise<boolean> => {
    if (!isSupabaseConfigured || !supabase || !canonicalReady) return false
    try {
      const { data, error } = await supabase
        .from('file_tracker_assets')
        .delete()
        .eq('id', id)
        .select('id')
        .single()
      return !error && data?.id === id
    } catch {
      return false
    }
  }

  const remoteIds = new Set(remoteAssets.map(asset => asset.id))
  const visibleIds = new Set<string>()
  const allAssets = (isSupabaseConfigured ? remoteAssets : localAssets).filter(asset => {
    if (visibleIds.has(asset.id)) return false
    visibleIds.add(asset.id)
    return true
  })

  const canMutateAsset = (asset: Asset) => canonicalReady && remoteIds.has(asset.id) && !asset.isMock

  const updateRemoteAsset = async (asset: Asset, fields: Partial<Pick<Asset, 'name' | 'category'>>): Promise<boolean> => {
    if (!canMutateAsset(asset)) {
      setSyncError('Legacy browser-only records are view-only.')
      return false
    }
    if (!await supabaseUpdate(asset.id, fields)) {
      setSyncError('Could not save the asset change. The displayed record was not changed.')
      return false
    }
    setSyncError('')
    setRemoteAssets(prev => prev.map(item => item.id === asset.id ? { ...item, ...fields } : item))
    setPreviewAsset(prev => prev?.id === asset.id ? { ...prev, ...fields } : prev)
    return true
  }

  const filtered = allAssets.filter(a => {
    const matchCategory = activeCategory === 'All Files' || a.category === activeCategory
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase())
    return matchCategory && matchSearch
  })

  const categoryCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = cat === 'All Files' ? allAssets.length : allAssets.filter(a => a.category === cat).length
    return acc
  }, {} as Record<string, number>)

  const handleFilesSelected = (files: FileList) => {
    const accepted: File[] = []
    let rejected = 0
    for (let i = 0; i < files.length; i++) {
      if (files[i].size <= MAX_UPLOAD_BYTES) accepted.push(files[i])
      else rejected += 1
    }
    setPendingFiles(prev => [...prev, ...accepted])
    setUploadError(rejected > 0
      ? `${rejected} file${rejected === 1 ? '' : 's'} exceeded the 2 MiB per-file limit and were not selected.`
      : '')
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (folderInputRef.current) folderInputRef.current.value = ''
  }

  const readAndUpload = async (file: File) => {
    if (!PRIVATE_STORAGE_ENABLED) throw new Error('Private Storage is not enabled')
    if (file.size > MAX_UPLOAD_BYTES) throw new Error('File exceeds the 2 MiB upload limit')
    if (!supabase) throw new Error('Supabase is not configured')
    const id = crypto.randomUUID()
    const storagePath = `${crypto.randomUUID()}/${crypto.randomUUID()}`
    const checksumSha256 = await sha256Hex(file)
    const reviewReserved = await queuePrivateStorageCleanup(
      supabase,
      ASSET_BUCKET,
      [storagePath],
      'failed_file_upload',
      id,
      false,
    )
    if (!reviewReserved) {
      throw new Error('Could not reserve a durable upload record')
    }
    const uploadOutcome = await uploadPrivateObject(
      supabase,
      ASSET_BUCKET,
      storagePath,
      file,
      file.type || 'application/octet-stream',
      checksumSha256,
    )
    if (uploadOutcome === 'absent') {
      await acknowledgePrivateStorageReview(supabase, ASSET_BUCKET, [storagePath])
      throw new Error('Storage upload failed')
    }
    if (uploadOutcome === 'unknown') {
      throw new UnknownAssetSaveOutcome()
    }

    const asset: Asset = {
      id,
      name: file.name,
      category: uploadCategory,
      type: file.type || 'application/octet-stream',
      storagePath,
      checksumSha256,
      addedAt: new Date().toISOString(),
      size: file.size,
    }
    const insertOutcome = await supabaseInsert(asset)
    if (insertOutcome === 'unknown') {
      throw new UnknownAssetSaveOutcome()
    }
    if (insertOutcome === 'not_saved') {
      await cleanupUnreferencedPrivateObjects(supabase, ASSET_BUCKET, [storagePath])
      throw new Error('Supabase insert failed')
    }
    await acknowledgePrivateStorageReview(supabase, ASSET_BUCKET, [storagePath])
    const { data: signedData } = await supabase.storage
      .from(ASSET_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)
    if (signedData?.signedUrl) asset.dataUrl = signedData.signedUrl
    setRemoteAssets(prev => [asset, ...prev])
    logActivity('Files', `Uploaded "${file.name}"`)
  }

  const handleUpload = async () => {
    if (reconciliationRequired) {
      setUploadError('Refresh and verify the previous save before trying again.')
      return
    }
    if (!isSupabaseConfigured || !supabase) {
      setUploadError('Supabase is not configured. Uploads and links are unavailable.')
      return
    }
    if (!canonicalReady) {
      setUploadError('Canonical assets have not loaded successfully. Nothing was uploaded.')
      return
    }
    if (uploadMode === 'file') {
      if (pendingFiles.length === 0) { setUploadError('Please select at least one file'); return }
      setUploadError('')
      const files = [...pendingFiles]
      const failedFiles: File[] = []
      let unknownCount = 0
      for (const file of files) {
        try {
          await readAndUpload(file)
        } catch (error) {
          if (error instanceof UnknownAssetSaveOutcome) unknownCount += 1
          else failedFiles.push(file)
        }
      }
      setPendingFiles(failedFiles)
      if (unknownCount > 0) {
        setReconciliationRequired(true)
        setUploadError(
          `${unknownCount} file save outcome${unknownCount === 1 ? ' is' : 's are'} unknown. `
          + 'Private objects were preserved for administrator reconciliation; refresh before retrying.'
          + (failedFiles.length > 0 ? ` ${failedFiles.length} other file upload failed safely.` : ''),
        )
        return
      }
      if (failedFiles.length > 0) {
        setUploadError(`${failedFiles.length} file${failedFiles.length === 1 ? '' : 's'} could not be saved. Please retry.`)
        return
      }
      setShowUpload(false)
    } else {
      const name = linkName.trim()
      if (!name) { setUploadError('Please enter a name for the link'); return }
      const url = normalizeUrl(linkUrl.trim())
      if (!isValidUrl(url)) { setUploadError('Please enter a valid URL'); return }
      const asset: Asset = {
        id: generateId(),
        name,
        category: uploadCategory,
        type: 'link',
        url,
        addedAt: new Date().toISOString(),
        size: 0,
      }
      const insertOutcome = await supabaseInsert(asset)
      if (insertOutcome === 'unknown') {
        setReconciliationRequired(true)
        setLinkName('')
        setLinkUrl('')
        setUploadError('The link save outcome is unknown. Refresh before retrying.')
        return
      }
      if (insertOutcome === 'not_saved') {
        setUploadError('Could not save the link. Please retry.')
        return
      }
      setRemoteAssets(prev => [asset, ...prev])
      setLinkName('')
      setLinkUrl('')
      setUploadError('')
      setShowUpload(false)
      logActivity('Files', `Added link "${name}" (${url})`)
    }
  }

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleDelete = async (id: string) => {
    const asset = allAssets.find(a => a.id === id)
    if (!asset || !canMutateAsset(asset)) {
      setSyncError('Legacy browser-only records are view-only.')
      return
    }
    if (!window.confirm('Delete this file?')) return
    if (!await supabaseDelete(id)) {
      setSyncError('Could not delete the asset. The displayed record was not removed.')
      return
    }
    const cleanupComplete = !asset.storagePath || !supabase
      ? true
      : await runPrivateStorageMaintenance(
        PRIVATE_STORAGE_ENABLED,
        () => drainPrivateStorageCleanup(supabase!, ASSET_BUCKET),
      )
    setSyncError(cleanupComplete
      ? ''
      : 'The asset record was deleted. Its private object remains tracked for automatic cleanup.')
    setRemoteAssets(prev => prev.filter(a => a.id !== id))
    if (previewAsset?.id === id) setPreviewAsset(null)
    logActivity('Files', `Deleted "${asset.name}"`)
  }

  const handleDownload = async (asset: Asset) => {
    if (asset.isMock) return
    let downloadUrl = asset.dataUrl
    if (asset.storagePath && supabase) {
      const { data, error } = await supabase.storage
        .from(ASSET_BUCKET)
        .createSignedUrl(asset.storagePath, 60)
      if (error || !data?.signedUrl) {
        setSyncError('Could not authorize this download. Please retry.')
        return
      }
      downloadUrl = data.signedUrl
    }
    if (!downloadUrl) return
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = asset.name
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  const openLink = (asset: Asset) => {
    if (asset.url) window.open(asset.url, '_blank', 'noopener,noreferrer')
  }

  const startEditing = (asset: Asset) => {
    if (!canMutateAsset(asset)) return
    setEditingId(asset.id)
    setEditValue(asset.name)
  }

  const saveEdit = async () => {
    const trimmed = editValue.trim()
    if (!trimmed || !editingId) { setEditingId(null); return }
    const asset = remoteAssets.find(item => item.id === editingId)
    if (!asset || trimmed === asset.name) { setEditingId(null); return }
    if (!await updateRemoteAsset(asset, { name: trimmed })) return
    setEditingId(null)
  }

  const thumbnailColor = (cat: string) => CATEGORY_COLORS[cat] || '#FF5900'

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F9FAFB' }}>
      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowUpload(false)}>
          <div className="relative rounded-2xl border w-full max-w-lg max-h-[85vh] flex flex-col" style={{ backgroundColor: '#FFFFFF', borderColor: '#CACDD7' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: '#CACDD7' }}>
              <h2 className="text-lg" style={{ color: '#1B1A1C', fontWeight: 700 }}>
                {PRIVATE_STORAGE_ENABLED ? 'Add Asset' : 'Add Link'}
              </h2>
              <button onClick={() => { setShowUpload(false); setPendingFiles([]); setUploadError('') }} className="p-1 rounded-lg transition" style={{ color: '#CACDD7' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              {uploadError && <div role="alert" className="p-3 rounded-lg text-sm" style={{ backgroundColor: '#FF590010', color: '#FF5900', border: '1px solid #FF590030' }}>{uploadError}</div>}
              {/* Mode toggle */}
              <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: '#CACDD7' }}>
                {PRIVATE_STORAGE_ENABLED && (
                  <button onClick={() => setUploadMode('file')} className="flex-1 py-2 text-sm font-medium transition" style={{ backgroundColor: uploadMode === 'file' ? '#FF5900' : 'transparent', color: uploadMode === 'file' ? '#FFFFFF' : '#3E4048' }}>
                    <span className="flex items-center justify-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                      File Upload
                    </span>
                  </button>
                )}
                <button onClick={() => setUploadMode('link')} className="flex-1 py-2 text-sm font-medium transition" style={{ backgroundColor: uploadMode === 'link' ? '#FF5900' : 'transparent', color: uploadMode === 'link' ? '#FFFFFF' : '#3E4048' }}>
                  <span className="flex items-center justify-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    Link / URL
                  </span>
                </button>
              </div>
              {/* File upload section */}
              {uploadMode === 'file' ? (
                <>
                  <div>
                    <label className="block text-sm mb-1.5" style={{ color: '#3E4048', fontWeight: 500 }}>Files</label>
                    <div className="border-2 border-dashed rounded-xl p-5 text-center" style={{ borderColor: '#CACDD7', backgroundColor: 'rgba(202,205,215,0.1)' }}>
                      <input ref={fileInputRef} type="file" multiple onChange={e => { if (e.target.files) handleFilesSelected(e.target.files) }} className="hidden" />
                      <input ref={folderInputRef} type="file" onChange={e => { if (e.target.files) handleFilesSelected(e.target.files) }} className="hidden" />
                      <div className="flex flex-col sm:flex-row gap-3 justify-center mb-3">
                        <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm transition hover:-translate-y-0.5" style={{ backgroundColor: '#FF5900', color: '#FFFFFF', fontWeight: 600 }}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                          Select Files
                        </button>
                        <button onClick={() => folderInputRef.current?.click()} className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm transition hover:-translate-y-0.5" style={{ border: '2px solid #FF5900', color: '#FF5900', fontWeight: 600 }}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                          Select Folder
                        </button>
                      </div>
                      <p className="text-xs" style={{ color: '#CACDD7' }}>Any file type, up to 2 MiB per file</p>
                    </div>
                  </div>
                  {pendingFiles.length > 0 && (
                    <div>
                      <label className="block text-sm mb-1.5" style={{ color: '#3E4048', fontWeight: 500 }}>{pendingFiles.length} file{pendingFiles.length !== 1 ? 's' : ''} selected</label>
                      <div className="max-h-40 overflow-y-auto space-y-1.5 border rounded-lg p-2" style={{ borderColor: '#CACDD7' }}>
                        {pendingFiles.map((f, i) => (
                          <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm" style={{ backgroundColor: 'rgba(202,205,215,0.1)' }}>
                            <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#CACDD7' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            <span className="truncate flex-1" style={{ color: '#1B1A1C' }}>{f.name}</span>
                            <span className="text-xs flex-shrink-0" style={{ color: '#CACDD7' }}>{formatSize(f.size)}</span>
                            <button onClick={() => removePendingFile(i)} className="p-0.5 rounded flex-shrink-0 hover:bg-black/5" style={{ color: '#FF5900' }}>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm mb-1.5" style={{ color: '#3E4048', fontWeight: 500 }}>Name</label>
                    <input type="text" value={linkName} onChange={e => setLinkName(e.target.value)}
                      placeholder="e.g. Google Drive - Brand Assets"
                      className="w-full px-3.5 py-2.5 rounded-lg border outline-none text-sm"
                      style={{ borderColor: '#CACDD7', color: '#1B1A1C' }} />
                  </div>
                  <div>
                    <label className="block text-sm mb-1.5" style={{ color: '#3E4048', fontWeight: 500 }}>URL</label>
                    <input type="url" value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
                      placeholder="https://drive.google.com/..."
                      className="w-full px-3.5 py-2.5 rounded-lg border outline-none text-sm"
                      style={{ borderColor: '#CACDD7', color: '#1B1A1C' }} />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm mb-1.5" style={{ color: '#3E4048', fontWeight: 500 }}>Category</label>
                <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border outline-none text-sm" style={{ borderColor: '#CACDD7', color: '#1B1A1C', backgroundColor: '#FFFFFF' }}>
                  {CATEGORIES.filter(c => c !== 'All Files').map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t flex-shrink-0" style={{ borderColor: '#CACDD7' }}>
              <button onClick={() => { setShowUpload(false); setPendingFiles([]); setLinkName(''); setLinkUrl(''); setUploadError('') }} className="px-4 py-2 rounded-lg text-sm transition" style={{ color: '#3E4048', fontWeight: 500 }}>Cancel</button>
              <button onClick={handleUpload} disabled={reconciliationRequired || !canonicalReady || (uploadMode === 'file' ? pendingFiles.length === 0 : !linkName.trim() || !linkUrl.trim())} className="px-5 py-2 rounded-lg text-sm transition disabled:opacity-50" style={{ backgroundColor: '#FF5900', color: '#FFFFFF', fontWeight: 600 }}>
                {uploadMode === 'file' ? `Upload${pendingFiles.length > 0 ? ` (${pendingFiles.length})` : ''}` : 'Add Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview / Overview modal */}
      {previewAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setPreviewAsset(null)}>
          <div className="relative rounded-2xl border w-full max-w-4xl max-h-[90vh] flex flex-col" style={{ backgroundColor: '#FFFFFF', borderColor: '#CACDD7' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: '#CACDD7' }}>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {renderTypeIcon(previewAsset.type, 6, CATEGORY_COLORS[previewAsset.category] || '#FF5900')}
                <h2 className="text-lg truncate" style={{ color: '#1B1A1C', fontWeight: 700 }}>{previewAsset.name}</h2>
              </div>
              <button onClick={() => setPreviewAsset(null)} className="p-1 rounded-lg transition flex-shrink-0 ml-2" style={{ color: '#CACDD7' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto flex flex-col lg:flex-row">
              <div className="flex-1 min-h-64 lg:min-h-0 flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(202,205,215,0.1)' }}>
                {isLink(previewAsset.type) ? (
                  <div className="text-center">
                    {renderTypeIcon(previewAsset.type, 20, CATEGORY_COLORS[previewAsset.category] || '#FF5900')}
                    <p className="text-sm mt-4 mb-3 max-w-xs break-all" style={{ color: '#3E4048', fontWeight: 500 }}>{previewAsset.url}</p>
                    <button onClick={() => openLink(previewAsset)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm transition hover:-translate-y-0.5" style={{ backgroundColor: '#FF5900', color: '#FFFFFF', fontWeight: 600 }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      Open Link
                    </button>
                  </div>
                ) : previewAsset.dataUrl && isImage(previewAsset.type) ? (
                  <img src={previewAsset.dataUrl} alt={previewAsset.name} className="max-w-full max-h-[40vh] lg:max-h-[55vh] object-contain rounded-lg" />
                ) : (
                  <div className="text-center">
                    {renderTypeIcon(previewAsset.type, 20, '#CACDD7')}
                    <p className="text-sm mt-3" style={{ color: '#3E4048', fontWeight: 500 }}>Preview not available</p>
                    <p className="text-xs mt-1" style={{ color: '#CACDD7' }}>Download the file to view it</p>
                  </div>
                )}
              </div>
              <div className="w-full lg:w-72 flex-shrink-0 border-t lg:border-t-0 lg:border-l p-6 space-y-5 overflow-y-auto" style={{ borderColor: '#CACDD7' }}>
                <div>
                  <label className="text-xs font-semibold tracking-wider uppercase block mb-1.5" style={{ color: '#CACDD7' }}>Name</label>
                  {canMutateAsset(previewAsset) ? (
                    <input type="text" defaultValue={previewAsset.name}
                      onBlur={async e => {
                        const input = e.currentTarget
                        const name = input.value.trim()
                        if (!name || name === previewAsset.name) {
                          input.value = previewAsset.name
                          return
                        }
                        if (!await updateRemoteAsset(previewAsset, { name })) input.value = previewAsset.name
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      className="w-full px-3 py-1.5 rounded-lg border text-sm outline-none"
                      style={{ borderColor: '#CACDD7', color: '#1B1A1C' }} />
                  ) : (
                    <p className="text-sm" style={{ color: '#1B1A1C', fontWeight: 500 }}>{previewAsset.name}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold tracking-wider uppercase block mb-1.5" style={{ color: '#CACDD7' }}>Category</label>
                  {canMutateAsset(previewAsset) ? (
                    <select value={previewAsset.category}
                      onChange={async e => { await updateRemoteAsset(previewAsset, { category: e.currentTarget.value }) }}
                      className="w-full px-3 py-1.5 rounded-lg border text-sm outline-none"
                      style={{ borderColor: '#CACDD7', color: '#1B1A1C' }}>
                      {CATEGORIES.filter(c => c !== 'All Files').map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (
                    <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: `${CATEGORY_COLORS[previewAsset.category]}20`, color: CATEGORY_COLORS[previewAsset.category] }}>{previewAsset.category}</span>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold tracking-wider uppercase block mb-1.5" style={{ color: '#CACDD7' }}>{isLink(previewAsset.type) ? 'URL' : 'File Type'}</label>
                  {isLink(previewAsset.type) ? (
                    <a href={previewAsset.url} target="_blank" rel="noopener noreferrer" className="text-sm underline break-all" style={{ color: '#FF5900' }}>{previewAsset.url}</a>
                  ) : (
                    <p className="text-sm" style={{ color: '#1B1A1C', fontWeight: 500 }}>{previewAsset.type || 'Unknown'} ({getExt(previewAsset.type)})</p>
                  )}
                </div>
                {!isLink(previewAsset.type) && (
                  <div>
                    <label className="text-xs font-semibold tracking-wider uppercase block mb-1.5" style={{ color: '#CACDD7' }}>Size</label>
                    <p className="text-sm" style={{ color: '#1B1A1C', fontWeight: 500 }}>{formatSize(previewAsset.size)}</p>
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold tracking-wider uppercase block mb-1.5" style={{ color: '#CACDD7' }}>Date Added</label>
                  <p className="text-sm" style={{ color: '#1B1A1C', fontWeight: 500 }}>{formatDate(previewAsset.addedAt)}</p>
                </div>
                {!remoteIds.has(previewAsset.id) && (
                  <p className="text-xs" style={{ color: '#B53F00' }}>Legacy browser-only record — view only</p>
                )}
                <div className="pt-3 space-y-2">
                  {isLink(previewAsset.type) && previewAsset.url && (
                    <button onClick={() => openLink(previewAsset)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm transition hover:-translate-y-0.5" style={{ backgroundColor: '#FF5900', color: '#FFFFFF', fontWeight: 600 }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      Open Link
                    </button>
                  )}
                  {!previewAsset.isMock && (previewAsset.dataUrl || previewAsset.storagePath) && !isLink(previewAsset.type) && (
                    <button onClick={() => handleDownload(previewAsset)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm transition hover:-translate-y-0.5" style={{ backgroundColor: '#FF5900', color: '#FFFFFF', fontWeight: 600 }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      Download
                    </button>
                  )}
                  {canMutateAsset(previewAsset) && (
                    <button onClick={() => handleDelete(previewAsset.id)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm transition" style={{ border: '2px solid #FF5900', color: '#FF5900', fontWeight: 600 }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Delete
                    </button>
                  )}
                  </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <div>
        <div className="sticky top-0 z-10 px-4 sm:px-6 py-3 border-b" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="relative sm:max-w-xs lg:max-w-sm flex-shrink-0">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#CACDD7' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" placeholder="Search files..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border outline-none text-sm transition"
                style={{ borderColor: '#CACDD7', color: '#1B1A1C', backgroundColor: '#FFFFFF' }} />
            </div>
            <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0">
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs whitespace-nowrap transition-all flex-shrink-0"
                  style={{
                    backgroundColor: activeCategory === cat ? '#FF5900' : 'rgba(202,205,215,0.25)',
                    color: activeCategory === cat ? '#FFFFFF' : '#3E4048',
                    fontWeight: activeCategory === cat ? 600 : 400,
                  }}>
                  {cat}
                  <span style={{ opacity: 0.6 }}>({categoryCounts[cat]})</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                if (!isSupabaseConfigured || !supabase) {
                  setSyncError('Supabase is not configured. Uploads and links are unavailable.')
                  return
                }
                if (!canonicalReady) {
                  setSyncError('Canonical assets have not loaded successfully. Uploads and links are disabled.')
                  return
                }
                setSyncError('')
                setShowUpload(true)
              }}
              disabled={!canonicalReady || reconciliationRequired}
              title={!isSupabaseConfigured ? 'Supabase is not configured' : reconciliationRequired ? 'Refresh and reconcile the previous save first' : canonicalReady ? (PRIVATE_STORAGE_ENABLED ? 'Upload asset or add link' : 'Add link') : 'Canonical assets are unavailable'}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all hover:-translate-y-0.5 flex-shrink-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              style={{ backgroundColor: '#FF5900', color: '#FFFFFF' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              {PRIVATE_STORAGE_ENABLED ? 'Add Asset' : 'Add Link'}
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {isLoading && (
            <div role="status" className="mb-4 rounded-lg border px-4 py-3 text-sm" style={{ backgroundColor: '#FFFFFF', borderColor: '#CACDD7', color: '#3E4048' }}>
              Syncing assets…
            </div>
          )}
          {syncError && (
            <div role="alert" className="mb-4 rounded-lg border px-4 py-3 text-sm" style={{ backgroundColor: '#FF590010', borderColor: '#FF590030', color: '#B53F00' }}>
              {syncError}
            </div>
          )}
          {isLoading && allAssets.length === 0 ? null : filtered.length === 0 ? (
            <div className="text-center py-24">
              <svg className="w-20 h-20 mx-auto mb-4" style={{ color: '#CACDD7' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-lg" style={{ color: '#3E4048', fontWeight: 500 }}>{allAssets.length === 0 ? 'No assets yet' : 'No files found'}</p>
              <p className="text-sm mt-1" style={{ color: '#CACDD7', fontWeight: 300 }}>{allAssets.length === 0 ? 'Upload a file or add a link to get started' : 'Try a different keyword or category'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(asset => (
                <div key={asset.id}
                  onClick={() => { if (isLink(asset.type) && asset.url) { window.open(asset.url, '_blank', 'noopener,noreferrer') } else { setPreviewAsset(asset) } }}
                  className="rounded-xl border-2 overflow-hidden transition-all duration-200 hover:shadow-lg cursor-pointer"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#CACDD7' }}
                  onMouseEnter={() => setHoveredId(asset.id)} onMouseLeave={() => setHoveredId(null)}>
                  <div className="h-36 flex items-center justify-center overflow-hidden" style={{ backgroundColor: 'rgba(202,205,215,0.2)' }}>
                    {isLink(asset.type) ? (
                      <div className="flex flex-col items-center gap-1" style={{ color: thumbnailColor(asset.category) }}>
                        {renderTypeIcon(asset.type, 8, thumbnailColor(asset.category))}
                        <span className="text-xs" style={{ color: '#CACDD7', fontWeight: 300 }}>URL</span>
                      </div>
                    ) : asset.dataUrl && isImage(asset.type) ? (
                      <img src={asset.dataUrl} alt={asset.name} className="w-full h-full object-contain p-2" />
                    ) : (
                      <div className="flex flex-col items-center gap-1" style={{ color: thumbnailColor(asset.category) }}>
                        {renderTypeIcon(asset.type, 8, thumbnailColor(asset.category))}
                        <span className="text-xs" style={{ color: '#CACDD7', fontWeight: 300 }}>{getExt(asset.type)}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4" onClick={e => e.stopPropagation()}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {editingId === asset.id ? (
                          <input ref={editInputRef} type="text" value={editValue} onChange={e => setEditValue(e.target.value)}
                            onBlur={() => { void saveEdit() }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditingId(null) }}
                            className="w-full px-1.5 py-0.5 rounded border text-sm outline-none"
                            style={{ borderColor: '#FF5900', color: '#1B1A1C' }}
                            onClick={e => e.stopPropagation()} />
                        ) : (
                          <p className={`text-sm truncate ${canMutateAsset(asset) ? 'cursor-pointer hover:underline' : ''}`} style={{ color: '#1B1A1C', fontWeight: 600 }}
                            onClick={e => { e.stopPropagation(); startEditing(asset) }}
                            title={canMutateAsset(asset) ? 'Click to rename' : 'Legacy browser-only record (view only)'}>{asset.name}</p>
                        )}
                      </div>
                      <div className={`flex items-center gap-1 transition-opacity duration-200 ${hoveredId === asset.id ? 'opacity-100' : 'opacity-0'}`}>
                        {!asset.isMock && !isLink(asset.type) && asset.dataUrl && (
                          <button onClick={e => { e.stopPropagation(); handleDownload(asset) }} className="p-1.5 rounded-lg transition hover:scale-105" style={{ color: '#3E4048', backgroundColor: 'rgba(202,205,215,0.3)' }} title="Download">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          </button>
                        )}
                        {canMutateAsset(asset) && (
                          <button onClick={e => { e.stopPropagation(); handleDelete(asset.id) }} className="p-1.5 rounded-lg transition hover:scale-105" style={{ color: '#FF5900', backgroundColor: 'rgba(202,205,215,0.3)' }} title="Delete">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-2">
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: `${CATEGORY_COLORS[asset.category]}20`, color: CATEGORY_COLORS[asset.category] }}>{asset.category}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs" style={{ color: '#CACDD7', fontWeight: 400 }}>{formatDate(asset.addedAt)}</span>
                      {!isLink(asset.type) ? (
                        <span className="text-xs" style={{ color: '#CACDD7', fontWeight: 400 }}>{formatSize(asset.size)}</span>
                      ) : (
                        <span className="text-xs" style={{ color: '#FF5900', fontWeight: 400 }}>Link</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
