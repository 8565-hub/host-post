// 配置
const config = {
  // 每页显示数量
  itemPerPage: 24,
  // api 接口
  api: '',
  // 表格 ID
  sheets: ['14hKgkoJjox6ST9Ig8FDS-J8IAFT1T6p8VWvf4cionJc'],
  // api 密钥
  apiKey: 'AIzaSyARlM__LDyTFbZ7nmOCbBVx6CCMSywFQRE'
}

const photos = []

// 当前筛选条件
const activeFilters = { type: [], copyright: [], religion: [] }
// 搜索关键词
let searchQuery = ''
// 当前可见图片
let visiblePhotos = []

// 当前 lightbox 索引
let currentLbIndex = 0

// 当前页面
let currentPage = 1

// 类型颜色列表
const typeColors = {}
// 教派颜色列表
const religionColors = {}

const copyrightLabels = {
  free: '免版权',
  protected: '有版权'
}

const groupLabels = {
  type: '类型',
  copyright: '版权',
  religion: '教派'
}

// 随机生成颜色
function randomColor () {
  const hex = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0')
  return `#${hex}`
}

/**
 * @description 根据类型生成颜色，并且缓存
 * @param {string} type - 类型
 * @returns {string} 颜色 hex
 */
function typeColor (type) {
  if (!typeColors[type]) {
    typeColors[type] = randomColor()
  }
  return typeColors[type]
}

/**
 * @description 根据教派生成颜色，并且缓存
 * @param {string} type - 教派
 * @returns {string} 颜色 hex
 */
function religionColor (type) {
  if (!type) return '#888'
  if (!religionColors[type]) {
    religionColors[type] = randomColor()
  }
  return religionColors[type]
}

// 生成作者头像缩写
function initials (name) {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// HTML 转义
function escape (text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// 高亮搜索关键词
function highlight (text, query) {
  if (!query) return escape(text)
  return escape(text).replace(new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>')
}

/**
 * @description 版权徽章
 * @param {string} type - 类型
 * @returns {string} svg 图标
 */
function copyrightBadge (type) {
  if (type === '可以') return '<span class="copyright-badge free"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9"/><path d="M14.5 9.5a4 4 0 1 0 0 5"/></svg>免版权</span>'
  return '<span class="copyright-badge protected"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9"/><path d="M12 8v4m0 4h.01"/></svg>版权保护</span>'
}

/**
 * @description 格式化缩略图链接
 * @param {string} link - 云端链接
 * @param {number} type - 类型
 *   1 - 小缩略图
 *   2 - 原图
 * @returns {string} 缩略图链接
 */
function formatThumb (link, type) {
  const fileId = link.replace(/.+\/d\/|\/.+/g, '')
  switch (type) {
    case 1:
      return `https://lh3.googleusercontent.com/d/${fileId}=w200`
    case 2:
      return `https://lh3.googleusercontent.com/d/${fileId}`
  }
}

// 自适应画廊列数量
function getColumnCount () {
  const width = document.getElementById('gallery-grid').offsetWidth || window.innerWidth
  if (width < 600) return 1
  if (width < 900) return 2
  return 5
}

/**
 * @description 按列重新排列数组
 * @param {Array<any>} arr - 原始数组
 * @returns {Array<any>} 返回按照指定列数重排后的数组
 */
function reorderColumns (arr) {
  const cols = getColumnCount()
  const rows = Math.ceil(arr.length / cols)
  const buckets = Array.from({ length: cols }, () => [])
  arr.forEach((item, index) => {
    buckets[index % cols].push(item)
  })
  const result = []
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < cols; column++) {
      if (buckets[column][row] !== undefined) result.push(buckets[column][row])
    }
  }
  return result
}

// 记录点击缓存，防止重复点击
const clickCache = {}
/**
 * @description 打开链接，并且保存记数
 * @param {string} link - 链接
 */
function openLink (link) {
  window.open(link, '_target')
  if (!clickCache[link]) {
    fetch(`${config.api}?link=${link}`)
    clickCache[link] = true
  }
}

// 懒加载
const imgObserver = new IntersectionObserver(
  (entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return
      const img = entry.target
      const realSrc = img.dataset.src
      if (!realSrc) return
      img.src = realSrc
      img.onload = () => img.classList.add('img-loaded')
      img.onerror = () => img.classList.add('img-loaded')
      obs.unobserve(img)
    })
  },
  // 预加载
  { rootMargin: '200px 0px' }
)

// 总页数
function getTotalPages () {
  return Math.max(1, Math.ceil(visiblePhotos.length / config.itemPerPage))
}

/**
 * @description 跳转页面
 * @param {number} num - 页面序号
 */
function goPage (num) {
  const total = getTotalPages()
  if (num < 1 || num > total) return
  currentPage = num
  renderCurrentPage()
  // 滚动到顶部
  document.getElementById('gallery-anchor').scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// 渲染当前页
function renderCurrentPage () {
  const grid = document.getElementById('gallery-grid')
  // 取消旧图片监听
  grid.querySelectorAll('img[data-src]').forEach(img => imgObserver.unobserve(img))

  // 分页切片
  const start = (currentPage - 1) * config.itemPerPage
  const pagePhotos = visiblePhotos.slice(start, start + config.itemPerPage)

  // 按列布局排序
  const ordered = reorderColumns(pagePhotos)

  // 渲染 HTML
  grid.innerHTML = ordered.map(p => buildCard(p, visiblePhotos.indexOf(p))).join('')
  // 重新监听新图片
  grid.querySelectorAll('img[data-src]').forEach(img => imgObserver.observe(img))

  updatePaginationUI()
}

// 分页界面
function updatePaginationUI () {
  const total = getTotalPages()
  const bar = document.getElementById('pagination-bar')

  // 如果只有一个页面就隐藏
  bar.style.display = total <= 1 ? 'none' : 'flex'

  // 上一页 / 下一页按钮状态
  document.getElementById('pg-prev').disabled = currentPage <= 1
  document.getElementById('pg-next').disabled = currentPage >= total

  // 页码按钮
  const nums = document.getElementById('pg-numbers')
  let pages = []
  // 最多显示 7 个
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
  } else {
    pages = [1]

    // 当前页前面是否需要省略号
    if (currentPage > 3) pages.push('…')

    // 当前页面附近的范围
    const start = Math.max(2, currentPage - 1)
    const end = Math.min(total - 1, currentPage + 1)

    for (let i = start; i <= end; i++) pages.push(i)

    // 当前页后面是否需要省略号
    if (currentPage < total - 2) pages.push('…')
    pages.push(total)
  }

  nums.innerHTML = pages
    .map(p => {
      if (p === '…') return '<span class="page-info">…</span>'
      return `<button class="page-btn${p === currentPage ? ' active' : ''}" onclick="goPage(${p})">${p}</button>`
    })
    .join('')
}

// 创建筛选器按钮
function renderFilterChips () {
  const types = [...new Set(photos.map(p => p.type))]
  const religions = [...new Set(photos.map(p => p.religion))]
  document.getElementById('chips-copyright').innerHTML = [
    { value: '可以', label: '免版权', color: 'var(--color-free)' },
    { value: '不可以', label: '有版权', color: 'var(--color-copy)' }
  ]
    .map(
      item => `
    <button class="filter-chip" data-group="copyright" data-value="${item.value}" onclick="toggleChip('copyright','${item.value}',this)">
      <span class="chip-dot" style="background:${item.color}"></span>${item.label}
      <svg class="chip-check" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
    </button>`
    )
    .join('')

  document.getElementById('chips-religion').innerHTML = religions
    .map(
      item => `
    <button class="filter-chip" data-group="religion" data-value="${item}" onclick="toggleChip('religion','${item}',this)">
      <span class="chip-dot" style="background:${religionColor(item)}"></span>${item}
      <svg class="chip-check" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
    </button>`
    )
    .join('')

  document.getElementById('chips-type').innerHTML = types
    .map(
      item => `
    <button class="filter-chip" data-group="type" data-value="${item}" onclick="toggleChip('type','${item}',this)">
      <span class="chip-dot" style="background:${typeColor(item)}"></span>${item}
      <svg class="chip-check" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
    </button>`
    )
    .join('')
}

/**
 * @description 点击筛选标签，更新筛选结果
 * @param {string} group - 筛选分组名称
 * @param {string} value - 当前标签对应的筛选条件
 * @param {HTMLElement} btn - 被点击的按钮
 */
function toggleChip (group, value, btn) {
  const arr = activeFilters[group]
  const idx = arr.indexOf(value)
  if (idx === -1) {
    arr.push(value)
    btn.classList.add('active')
  } else {
    arr.splice(idx, 1)
    btn.classList.remove('active')
  }
  updateActiveTags()
  applyFilters()
}

// 更新标签
function updateActiveTags () {
  const container = document.getElementById('active-tags')
  const row = document.getElementById('active-tags-row')
  let total = 0
  let html = ''
  Object.entries(activeFilters).forEach(([group, vals]) => {
    vals.forEach(value => {
      total++
      const label = group === 'copyright' ? copyrightLabels[value] || value : value
      html += `<span class="active-tag">${groupLabels[group] || group}: ${label}
        <span class="active-tag-remove" onclick="removeFilter('${group}','${value}')">✕</span>
      </span>`
    })
  })
  container.innerHTML = html
  row.classList.toggle('visible', total > 0)
}

/**
 * @description 移除筛选条件
 * @param {string} group - 筛选分组名称
 * @param {string} value - 需要移除的筛选条件
 */
function removeFilter (group, value) {
  const arr = activeFilters[group]
  const idx = arr.indexOf(value)
  if (idx !== -1) arr.splice(idx, 1)
  const chip = document.querySelector(`.filter-chip[data-group="${group}"][data-value="${value}"]`)
  if (chip) chip.classList.remove('active')
  updateActiveTags()
  applyFilters()
}

// 清除全部筛选条件
function clearAllFilters () {
  Object.keys(activeFilters).forEach(g => (activeFilters[g] = []))
  document.querySelectorAll('.filter-chip.active').forEach(c => c.classList.remove('active'))
  updateActiveTags()
  applyFilters()
}

// 筛选逻辑
function applyFilters () {
  visiblePhotos = photos.filter(info => {
    const { author, title, desc, copyright, type, religion } = info

    if (activeFilters.type.length && !activeFilters.type.includes(type)) return false
    if (activeFilters.copyright.length && !activeFilters.copyright.includes(copyright)) return false
    if (activeFilters.religion.length && !activeFilters.religion.includes(religion)) return false
    if (searchQuery) {
      const hay = [title, desc, author, type, religion].join(' ').toLowerCase()
      if (!hay.includes(searchQuery)) return false
    }
    return true
  })
  renderGallery()
}

// 搜索功能
let searchTimer
document.getElementById('search-input').addEventListener('input', function () {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchQuery = this.value.trim().toLowerCase()
    document.getElementById('search-clear').classList.toggle('visible', searchQuery.length > 0)
    applyFilters()
  }, 250)
})

document.getElementById('search-clear').addEventListener('click', function () {
  document.getElementById('search-input').value = ''
  searchQuery = ''
  this.classList.remove('visible')
  applyFilters()
  document.getElementById('search-input').focus()
})

/**
 * @description 卡片渲染
 * @param {Object} info - 详细信息
 * @param {number} index - 当前信息索引
 * @returns {string} 组装好的卡片 HTML
 */
function buildCard (info, index) {
  const keyword = searchQuery

  const { date, author, link, title, desc, copyright, thumb, type, religion, clicks } = info
  return `<div class="gallery-item"
       onclick="openLightbox(${index})"
       ondblclick="window.open('${link}','_blank','noopener')"
       tabindex="0" role="button" aria-label="${title}"
       onkeydown="if(event.key==='Enter') openLightbox(${index})">
    <div class="card-image-wrap">
      <img data-src="${formatThumb(thumb, 1)}" src="" alt="${title}" />
      <div class="img-skeleton"></div>
      <div class="card-type-badge" style="background:${typeColor(type)}dd">${type}</div>
      
    </div>
    <div class="card-body" ondblclick="event.stopPropagation()" onclick="event.stopPropagation()">
      <h3 class="card-title" onclick="openLink('${link}')">${highlight(title, keyword)}</h3>
      <div class="card-meta">
        <span>${date}</span>
        <span class="card-meta-sep">·</span>
        <span style="color:${religionColor(religion)};font-weight:600;">${religion}</span>
      </div>
      <p class="card-desc">${highlight(desc, keyword)}</p>
      <div class="card-footer">
        <div class="card-author">
          <div class="author-avatar">${initials(author)}</div>
          <span class="author-name">${highlight(author, keyword)}</span>
        </div>
        <span class="click-count">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          ${clicks || 0}
        </span>
        ${copyrightBadge(copyright)}
      </div>
    </div>
  </div>`
}

// 画廊渲染入口
function renderGallery () {
  const grid = document.getElementById('gallery-grid')
  const empty = document.getElementById('empty-state')
  const countEl = document.getElementById('visible-count')

  grid.querySelectorAll('img[data-src]').forEach(img => imgObserver.unobserve(img))
  countEl.textContent = visiblePhotos.length

  if (visiblePhotos.length === 0) {
    grid.style.display = 'none'
    grid.innerHTML = ''
    empty.style.display = 'flex'
    document.getElementById('pagination-bar').style.display = 'none'
    return
  }
  grid.style.display = ''
  empty.style.display = 'none'
  currentPage = 1
  renderCurrentPage()
}

/**
 * @description 查看大图
 * @param {number} index - 索引
 */
function openLightbox (index) {
  currentLbIndex = index
  updateLightbox()
  document.getElementById('lightbox').classList.add('open')
  document.body.style.overflow = 'hidden'
}

function updateLightbox () {
  const info = visiblePhotos[currentLbIndex]
  if (!info) return
  const { date, author, link, url, title, desc, copyright, thumb, type, religion, clicks } = info

  const lbImg = document.getElementById('lb-img')

  // 加载小缩略图
  lbImg.src = formatThumb(thumb, 1)
  const thumbHD = formatThumb(thumb, 2)

  // 后台加载高清图，加载完成后替换
  const hd = new Image()
  hd.src = thumbHD
  hd.onload = () => {
    // 确认正在看同一张图，防止快速翻页时的竞争
    if (document.getElementById('lb-img').src !== hd.src) {
      lbImg.src = thumbHD
    } else {
      lbImg.src = thumbHD
    }
    lbImg.style.filter = 'none'
  }

  // 其余元数据更新保持不变
  lbImg.alt = title
  document.getElementById('lb-title').textContent = title
  document.getElementById('lb-title').setAttribute('onclick', `openLink('${link}')`)
  document.getElementById('lb-date').textContent = date
  document.getElementById('lb-type-text').textContent = type + ' · ' + religion
  document.getElementById('lb-desc').textContent = desc
  document.getElementById('lb-link').href = url
  document.getElementById('lb-author-name').textContent = author
  document.getElementById('lb-author-avatar').textContent = initials(author)
  document.getElementById('lb-copyright-row').innerHTML = copyrightBadge(copyright)
  document.getElementById('lb-click-count').textContent = '已浏览 ' + (clicks || 0) + ' 次'
  const badge = document.getElementById('lb-type-badge')
  badge.textContent = type
  badge.style.background = typeColor(type) + 'cc'
  document.getElementById('lb-prev').style.display = currentLbIndex > 0 ? 'flex' : 'none'
  document.getElementById('lb-next').style.display = currentLbIndex < visiblePhotos.length - 1 ? 'flex' : 'none'
}

function closeLightbox () {
  document.getElementById('lightbox').classList.remove('open')
  document.body.style.overflow = ''
}

// 切换图片
function navigateLightbox (dir) {
  const newIndex = currentLbIndex + dir
  if (newIndex < 0 || newIndex >= visiblePhotos.length) return

  currentLbIndex = newIndex
  const img = document.getElementById('lb-img')
  img.style.opacity = '0'
  img.style.transition = 'opacity .15s ease'
  setTimeout(() => {
    updateLightbox()
    img.style.opacity = '1'
  }, 150)
}

document.getElementById('lightbox').addEventListener('click', event => {
  if (event.target === event.currentTarget) closeLightbox()
})

document.addEventListener('keydown', event => {
  if (!document.getElementById('lightbox').classList.contains('open')) return
  if (event.key === 'Escape') closeLightbox()
  if (event.key === 'ArrowLeft') navigateLightbox(-1)
  if (event.key === 'ArrowRight') navigateLightbox(1)
})

// 切换主题
;(function () {
  const toggleBtn = document.querySelector('[data-theme-toggle]')
  const rootElement = document.documentElement
  let theme = matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'
  rootElement.setAttribute('data-theme', theme)
  function updateBtn () {
    if (!toggleBtn) return
    toggleBtn.setAttribute('aria-label', 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode')
    toggleBtn.innerHTML = theme === 'dark' ? '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>' : '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
  }
  updateBtn()
  toggleBtn &&
    toggleBtn.addEventListener('click', () => {
      theme = theme === 'dark' ? 'light' : 'dark'
      rootElement.setAttribute('data-theme', theme)
      updateBtn()
    })
})()

async function init () {
  // 显示加载状态
  const overlay = document.getElementById('loading-overlay')
  const subtitle = document.getElementById('loading-subtitle')

  photos.length = 0

  subtitle.textContent = '正在加载数据…'
  // 获取数据
  const requests = config.sheets.map(sheetId =>
    fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/data!A3:K?key=${config.apiKey}`)
      .then(response => response.json())
      .then(json => {
        return json.values
      })
  )

  const results = await (await Promise.all(requests)).flat()

  for (let i = 0; i < results.length; i++) {
    const [date, author, link, url, title, desc, copyright, thumb, type, religion, clicks] = results[i]
    if (!religion || !title) continue
    photos.push({ id: i + 1, date, author, link, url, title, desc, copyright, thumb, type, religion, clicks })
  }

  // 按照日期从新到旧排序
  photos.sort((a, b) => b.date.localeCompare(a.date))

  renderFilterChips()
  applyFilters()

  // 加载完成
  overlay.classList.add('hidden')
}
init()
