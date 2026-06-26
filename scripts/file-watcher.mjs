import { watch, existsSync, mkdirSync, renameSync, readFileSync, statSync, readdirSync } from 'fs'
import { join, dirname, extname, basename } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..')

const WATCH_DIR = process.env.WATCHED_LEADS_DIR || join(PROJECT_ROOT, 'watched-leads')
const PROCESSED_DIR = join(WATCH_DIR, 'processed')
const ERRORS_DIR = join(WATCH_DIR, 'errors')
const DEBOUNCE_MS = 2000

let xlsx
try {
  xlsx = (await import('xlsx')).default
} catch {
  console.warn('[file-watcher] xlsx package not available. Only .csv files will be processed.')
  console.warn('[file-watcher] Install with: npm install xlsx')
}

function loadEnv() {
  const envPath = join(PROJECT_ROOT, '.env')
  if (!existsSync(envPath)) {
    console.error(`[file-watcher] No .env file found at ${envPath}`)
    console.error('[file-watcher] Create one with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
    process.exit(1)
  }
  const content = readFileSync(envPath, 'utf-8')
  const env = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim())
  if (lines.length === 0) return { headers: [], rows: [] }
  const parseLine = (line) => {
    const result = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else { inQuotes = !inQuotes }
      } else if (char === ',' && !inQuotes) { result.push(current.trim()); current = '' }
      else { current += char }
    }
    result.push(current.trim())
    return result
  }
  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map(line => {
    const values = parseLine(line)
    const row = {}
    headers.forEach((h, i) => { row[h] = values[i] || '' })
    return row
  })
  return { headers, rows }
}

function parseExcel(filePath) {
  if (!xlsx) throw new Error('xlsx package not installed')
  const workbook = xlsx.readFile(filePath)
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return { headers: [], rows: [] }
  const sheet = workbook.Sheets[sheetName]
  const json = xlsx.utils.sheet_to_json(sheet, { defval: '' })
  if (json.length === 0) return { headers: [], rows: [] }
  const headers = Object.keys(json[0])
  const rows = json.map(row => {
    const r = {}
    headers.forEach(h => { r[h] = String(row[h] ?? '') })
    return r
  })
  return { headers, rows }
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function getUniqueFilename(dir, filename) {
  const name = basename(filename, extname(filename))
  const ext = extname(filename)
  let candidate = filename
  let counter = 0
  while (existsSync(join(dir, candidate))) {
    counter++
    candidate = `${name}_${counter}${ext}`
  }
  return candidate
}

async function processFile(filePath, supabase) {
  const ext = extname(filePath).toLowerCase()
  const fileName = basename(filePath)

  console.log(`[file-watcher] Processing: ${fileName}`)

  let headers, rows
  try {
    if (ext === '.csv') {
      const text = readFileSync(filePath, 'utf-8')
      const parsed = parseCSV(text)
      headers = parsed.headers
      rows = parsed.rows
    } else if (ext === '.xlsx' || ext === '.xls') {
      if (!xlsx) {
        throw new Error('xlsx package is required for Excel files. Run: npm install xlsx')
      }
      const parsed = parseExcel(filePath)
      headers = parsed.headers
      rows = parsed.rows
    } else {
      console.log(`[file-watcher] Skipping unsupported file: ${fileName}`)
      return false
    }
  } catch (err) {
    console.error(`[file-watcher] Error parsing ${fileName}:`, err.message)
    return false
  }

  if (headers.length === 0) {
    console.log(`[file-watcher] Empty or invalid file: ${fileName}`)
    return false
  }

  if (rows.length === 0) {
    console.log(`[file-watcher] No data rows in: ${fileName}`)
    return true
  }

  // Create lead file
  const fileRecord = {
    name: basename(fileName, extname(fileName)),
    columns: headers,
    source: 'csv',
  }

  const { data: fileData, error: fileError } = await supabase
    .from('lead_files')
    .insert(fileRecord)
    .select()
    .single()

  if (fileError) {
    console.error(`[file-watcher] Error creating file record:`, fileError.message)
    return false
  }

  const fileId = fileData.id

  // Deduplicate by email column
  const emailCol = headers.find(h => h.toLowerCase().includes('email'))

  if (emailCol) {
    const { data: allRows } = await supabase
      .from('lead_rows')
      .select('data')

    const existingEmails = new Set()
    if (allRows) {
      allRows.forEach(r => {
        const data = r.data
        if (data[emailCol]) existingEmails.add(data[emailCol].toLowerCase().trim())
      })
    }

    const duplicateRows = []
    const uniqueRows = []
    for (const row of rows) {
      if (row[emailCol]) {
        const email = row[emailCol].toLowerCase().trim()
        if (existingEmails.has(email)) {
          duplicateRows.push(row)
        } else {
          existingEmails.add(email)
          uniqueRows.push(row)
        }
      } else {
        uniqueRows.push(row)
      }
    }

    // Insert deduplicated rows
    if (uniqueRows.length > 0) {
      const rowInserts = uniqueRows.map((row, idx) => ({
        file_id: fileId,
        row_index: idx,
        data: row,
      }))
      const { error: rowsError } = await supabase.from('lead_rows').insert(rowInserts)
      if (rowsError) {
        console.error(`[file-watcher] Error inserting rows:`, rowsError.message)
        return false
      }
    }

    // Route duplicates to "Duplicate Leads" file
    if (duplicateRows.length > 0) {
      const { data: dupFile } = await supabase
        .from('lead_files')
        .select('*')
        .eq('name', 'Duplicate Leads')
        .single()

      let dupFileId
      if (dupFile) {
        dupFileId = dupFile.id
      } else {
        const { data: newDupFile, error: dupFileError } = await supabase
          .from('lead_files')
          .insert([{ name: 'Duplicate Leads', columns: [...headers, 'Source File'], source: 'spreadsheet' }])
          .select()
          .single()
        if (dupFileError) throw dupFileError
        dupFileId = newDupFile.id
      }

      const { data: existingDupRows } = await supabase
        .from('lead_rows')
        .select('row_index')
        .eq('file_id', dupFileId)
        .order('row_index', { ascending: false })
        .limit(1)

      const startIdx = existingDupRows && existingDupRows.length > 0 ? existingDupRows[0].row_index + 1 : 0

      const dupInserts = duplicateRows.map((row, idx) => ({
        file_id: dupFileId,
        row_index: startIdx + idx,
        data: { ...row, 'Source File': fileRecord.name },
      }))

      const { error: dupRowsError } = await supabase.from('lead_rows').insert(dupInserts)
      if (dupRowsError) {
        console.error(`[file-watcher] Error inserting duplicates:`, dupRowsError.message)
      }

      console.log(`[file-watcher] ${duplicateRows.length} duplicate(s) routed to "Duplicate Leads"`)
    }

    console.log(`[file-watcher] Imported ${uniqueRows.length} leads from "${fileName}" (${duplicateRows.length} duplicates skipped)`)
  } else {
    // No email column — insert all rows
    const rowInserts = rows.map((row, idx) => ({
      file_id: fileId,
      row_index: idx,
      data: row,
    }))
    const { error: rowsError } = await supabase.from('lead_rows').insert(rowInserts)
    if (rowsError) {
      console.error(`[file-watcher] Error inserting rows:`, rowsError.message)
      return false
    }
    console.log(`[file-watcher] Imported ${rows.length} leads from "${fileName}" (no email column — no dedup)`)
  }

  return true
}

async function main() {
  ensureDir(WATCH_DIR)
  ensureDir(PROCESSED_DIR)
  ensureDir(ERRORS_DIR)

  const env = loadEnv()
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[file-watcher] Missing Supabase credentials in .env')
    console.error('[file-watcher] Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  console.log(`[file-watcher] Watching directory: ${WATCH_DIR}`)
  console.log('[file-watcher] Supported formats: .csv' + (xlsx ? ', .xlsx, .xls' : ''))
  console.log('[file-watcher] Ready for files...')
  console.log('')

  // Process any files already in the watch directory
  const existingFiles = readdirSync(WATCH_DIR).filter(
    f => !['processed', 'errors'].includes(f) && !f.startsWith('.')
  )
  for (const f of existingFiles) {
    const filePath = join(WATCH_DIR, f)
    if (statSync(filePath).isFile()) {
      const success = await processFile(filePath, supabase)
      const destDir = success ? PROCESSED_DIR : ERRORS_DIR
      const destName = getUniqueFilename(destDir, f)
      renameSync(filePath, join(destDir, destName))
    }
  }

  // Watch for new files
  let timers = {}

  watch(WATCH_DIR, async (eventType, filename) => {
    if (!filename) return
    if (filename.startsWith('.')) return
    if (filename === 'processed' || filename === 'errors') return

    const filePath = join(WATCH_DIR, filename)

    // Skip directories
    try {
      if (statSync(filePath).isDirectory()) return
    } catch {
      return
    }

    const ext = extname(filename).toLowerCase()
    if (ext !== '.csv' && ext !== '.xlsx' && ext !== '.xls') return

    if (timers[filename]) clearTimeout(timers[filename])

    timers[filename] = setTimeout(async () => {
      delete timers[filename]

      // Verify file is fully written and stable
      let stable = false
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const size1 = statSync(filePath).size
          await new Promise(r => setTimeout(r, 500))
          const size2 = statSync(filePath).size
          if (size1 === size2 && size1 > 0) {
            stable = true
            break
          }
        } catch {
          // File might have been moved/deleted
          return
        }
      }

      if (!stable) {
        console.log(`[file-watcher] File "${filename}" did not stabilize, skipping`)
        return
      }

      const success = await processFile(filePath, supabase)
      const destDir = success ? PROCESSED_DIR : ERRORS_DIR
      const destName = getUniqueFilename(destDir, filename)
      try {
        renameSync(filePath, join(destDir, destName))
        console.log(`[file-watcher] ${success ? '✓' : '✗'} ${filename} → ${success ? 'processed/' : 'errors/'}`)
        console.log('')
      } catch (err) {
        console.error(`[file-watcher] Error moving "${filename}":`, err.message)
      }
    }, DEBOUNCE_MS)
  })
}

main().catch(err => {
  console.error('[file-watcher] Fatal error:', err)
  process.exit(1)
})