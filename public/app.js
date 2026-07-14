const elements = {
  form: document.querySelector('#convert-form'),
  fileInput: document.querySelector('#html-file'),
  chooseFile: document.querySelector('#choose-file'),
  dropZone: document.querySelector('#drop-zone'),
  fileLabel: document.querySelector('#file-label'),
  fileDetail: document.querySelector('#file-detail'),
  convertButton: document.querySelector('#convert-button'),
  landscape: document.querySelector('#landscape'),
  progress: document.querySelector('#progress'),
  list: document.querySelector('#pdf-list'),
  emptyState: document.querySelector('#empty-state'),
  count: document.querySelector('#pdf-count'),
  refresh: document.querySelector('#refresh-list'),
  dialog: document.querySelector('#preview-dialog'),
  previewTitle: document.querySelector('#preview-title'),
  previewFrame: document.querySelector('#pdf-preview'),
  previewDownload: document.querySelector('#preview-download'),
  closePreview: document.querySelector('#close-preview'),
  toast: document.querySelector('#toast'),
}

let selectedFile = null
let toastTimer

window.lucide.createIcons()
loadPdfList()

elements.chooseFile.addEventListener('click', (event) => {
  event.stopPropagation()
  elements.fileInput.click()
})

elements.dropZone.addEventListener('click', () => elements.fileInput.click())
elements.fileInput.addEventListener('change', () =>
  selectFile(elements.fileInput.files[0]),
)

for (const eventName of ['dragenter', 'dragover']) {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault()
    elements.dropZone.classList.add('dragging')
  })
}

for (const eventName of ['dragleave', 'drop']) {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault()
    elements.dropZone.classList.remove('dragging')
  })
}

elements.dropZone.addEventListener('drop', (event) =>
  selectFile(event.dataTransfer.files[0]),
)

document.querySelector('#page-mode').addEventListener('change', () => {
  const fullPage = getMode() === 'full-page'
  elements.landscape.disabled = fullPage
  if (fullPage) elements.landscape.checked = false
})

elements.form.addEventListener('submit', async (event) => {
  event.preventDefault()
  if (!selectedFile) return

  setConverting(true)
  try {
    const query = new URLSearchParams({
      filename: selectedFile.name,
      mode: getMode(),
      landscape: String(elements.landscape.checked),
    })
    const response = await fetch(`/api/pdfs?${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: selectedFile,
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || '转换失败。')

    await loadPdfList()
    showToast(`${result.item.name} 已生成`)
  } catch (error) {
    showToast(error.message, true)
  } finally {
    setConverting(false)
  }
})

elements.refresh.addEventListener('click', loadPdfList)
elements.closePreview.addEventListener('click', closePreview)
elements.dialog.addEventListener('close', () => {
  elements.previewFrame.removeAttribute('src')
})
elements.dialog.addEventListener('click', (event) => {
  if (event.target === elements.dialog) closePreview()
})

function selectFile(file) {
  if (!file) return
  if (!/\.html?$/i.test(file.name)) {
    showToast('请选择 .html 或 .htm 文件。', true)
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('HTML 文件不能超过 10 MB。', true)
    return
  }

  selectedFile = file
  elements.fileLabel.textContent = file.name
  elements.fileDetail.textContent = `${formatBytes(file.size)} · HTML`
  elements.dropZone.classList.add('has-file')
  elements.convertButton.disabled = false
}

async function loadPdfList() {
  elements.refresh.disabled = true
  elements.refresh.querySelector('svg')?.classList.add('spin')
  try {
    const response = await fetch('/api/pdfs', { cache: 'no-store' })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || '无法读取 PDF 列表。')
    renderList(result.items)
  } catch (error) {
    showToast(error.message, true)
  } finally {
    elements.refresh.disabled = false
    elements.refresh.querySelector('svg')?.classList.remove('spin')
  }
}

function renderList(items) {
  elements.list.replaceChildren()
  elements.count.textContent = `${items.length} 个文件`
  elements.emptyState.hidden = items.length > 0

  for (const item of items) {
    const row = document.createElement('div')
    row.className = 'pdf-row'

    const fileCell = document.createElement('div')
    fileCell.className = 'file-cell'
    fileCell.innerHTML =
      '<span class="file-symbol"><i data-lucide="file-text"></i></span>'
    const fileName = document.createElement('strong')
    fileName.textContent = item.name
    fileName.title = item.name
    fileCell.append(fileName)

    const mode = document.createElement('span')
    mode.className = 'mode-badge'
    mode.textContent = formatMode(item)

    const size = document.createElement('span')
    size.className = 'muted-cell'
    size.textContent = formatBytes(item.size)

    const date = document.createElement('span')
    date.className = 'muted-cell'
    date.textContent = formatDate(item.createdAt)

    const actions = document.createElement('div')
    actions.className = 'row-actions'
    actions.append(
      createActionButton('eye', '查看 PDF', () => openPreview(item)),
      createDownloadButton(item),
    )

    row.append(fileCell, mode, size, date, actions)
    elements.list.append(row)
  }

  window.lucide.createIcons()
}

function createActionButton(icon, label, onClick) {
  const button = document.createElement('button')
  button.className = 'icon-button'
  button.type = 'button'
  button.title = label
  button.setAttribute('aria-label', label)
  button.innerHTML = `<i data-lucide="${icon}"></i>`
  button.addEventListener('click', onClick)
  return button
}

function createDownloadButton(item) {
  const link = document.createElement('a')
  link.className = 'icon-button'
  link.href = item.downloadUrl
  link.download = item.name
  link.title = '下载 PDF'
  link.setAttribute('aria-label', `下载 ${item.name}`)
  link.innerHTML = '<i data-lucide="download"></i>'
  return link
}

function openPreview(item) {
  elements.previewTitle.textContent = item.name
  elements.previewFrame.src = item.viewUrl
  elements.previewDownload.href = item.downloadUrl
  elements.previewDownload.download = item.name
  elements.previewDownload.setAttribute('aria-label', `下载 ${item.name}`)
  elements.dialog.showModal()
}

function closePreview() {
  elements.dialog.close()
}

function setConverting(converting) {
  elements.progress.hidden = !converting
  elements.convertButton.disabled = converting || !selectedFile
  elements.fileInput.disabled = converting
  elements.chooseFile.disabled = converting
}

function getMode() {
  return document.querySelector('input[name="mode"]:checked').value
}

function formatMode(item) {
  if (item.mode === 'full-page') return '完整长页'
  return item.landscape ? `${item.mode} 横向` : item.mode
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(value) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function showToast(message, error = false) {
  clearTimeout(toastTimer)
  elements.toast.textContent = message
  elements.toast.classList.toggle('error', error)
  elements.toast.hidden = false
  toastTimer = setTimeout(() => {
    elements.toast.hidden = true
  }, 3800)
}
