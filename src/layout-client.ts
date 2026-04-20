// ============================================================
// SOVEREIGN OS PLATFORM — LAYOUT CLIENT SCRIPT MODULE
// P22: Extracted from monolithic layout.ts for better maintainability.
//      All client-side JS behaviours: dark mode, sidebar toggle, nav
//      filter (debounced), page loader (scaleX), toast API, shortcuts.
//      Returns a string to be inlined in the HTML <script> tag.
// ============================================================

export function getLayoutScript(): string {
  return `
    // Dark mode — restore from localStorage before first paint
    (function() {
      var saved = localStorage.getItem('sovereign-theme')
      if (saved) {
        document.getElementById('html-root').setAttribute('data-theme', saved)
        var btn = document.getElementById('dark-mode-btn')
        if (btn) btn.textContent = saved === 'light' ? '🌙' : '☀️'
      }
    })()

    function toggleDarkMode() {
      var root = document.getElementById('html-root')
      var btn = document.getElementById('dark-mode-btn')
      var cur = root.getAttribute('data-theme')
      var next = cur === 'dark' ? 'light' : 'dark'
      root.setAttribute('data-theme', next)
      if (btn) btn.textContent = next === 'light' ? '🌙' : '☀️'
      localStorage.setItem('sovereign-theme', next)
    }

    // Mobile sidebar
    function toggleSidebar() {
      var s = document.getElementById('sidebar')
      var o = document.getElementById('sidebar-overlay')
      if (s) s.classList.toggle('open')
      if (o) o.classList.toggle('active')
    }
    function closeSidebar() {
      var s = document.getElementById('sidebar')
      var o = document.getElementById('sidebar-overlay')
      if (s) s.classList.remove('open')
      if (o) o.classList.remove('active')
    }

    // Keyboard shortcuts: / focuses header search, Escape closes/blurs
    document.addEventListener('keydown', function(e) {
      var tag = document.activeElement ? document.activeElement.tagName : ''
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault()
        var inp = document.getElementById('header-search-input')
        if (inp) { inp.focus(); inp.select(); }
      }
      if (e.key === 'Escape') {
        var inp = document.getElementById('header-search-input')
        if (inp && document.activeElement === inp) inp.blur()
        closeSidebar()
      }
    })

    // P21: CSS max-height collapsible nav groups — zero JS layout blocking
    function toggleNavGroup(id) {
      var items = document.getElementById('items-' + id)
      var chevron = document.getElementById('chevron-' + id)
      if (!items) return
      var isCollapsed = items.classList.contains('collapsed')
      requestAnimationFrame(function() {
        items.classList.toggle('collapsed', !isCollapsed)
        if (chevron) {
          chevron.classList.toggle('open', !isCollapsed)
          chevron.classList.toggle('closed', isCollapsed)
          chevron.textContent = !isCollapsed ? '▾' : '▸'
        }
        var header = document.querySelector('#group-' + id + ' .nav-group-header')
        if (header) header.setAttribute('aria-expanded', String(!isCollapsed))
        try { localStorage.setItem('nav-group-' + id, !isCollapsed ? 'open' : 'closed') } catch(e) {}
      })
    }

    // Restore nav group states from localStorage on load
    ;(function() {
      var groups = ['core','governance','tenants','observability','workflows','notifications','search','platform']
      groups.forEach(function(id) {
        try {
          var state = localStorage.getItem('nav-group-' + id)
          var items = document.getElementById('items-' + id)
          var chevron = document.getElementById('chevron-' + id)
          if (!items) return
          if (state === 'closed') {
            items.classList.add('collapsed')
            if (chevron) { chevron.textContent = '▸'; chevron.classList.add('closed'); chevron.classList.remove('open') }
          } else if (state === 'open') {
            items.classList.remove('collapsed')
            if (chevron) { chevron.textContent = '▾'; chevron.classList.add('open'); chevron.classList.remove('closed') }
          }
        } catch(e) {}
      })
    })()

    // Toast API (P16) — exposed on window for route pages to call
    function showToast(title, msg, type, duration) {
      duration = duration || 4000
      var icons = { green: '✅', red: '❌', yellow: '⚠️', blue: 'ℹ️' }
      var container = document.getElementById('toast-container')
      if (!container) return
      var toast = document.createElement('div')
      toast.className = 'toast toast-' + (type || 'blue')
      toast.innerHTML = '<span class="toast-icon">' + (icons[type] || 'ℹ️') + '</span>' +
        '<div class="toast-body"><div class="toast-title">' + title + '</div><div class="toast-msg">' + (msg || '') + '</div></div>' +
        '<button class="toast-close" onclick="this.closest(\\'.toast\\').remove()">×</button>'
      container.appendChild(toast)
      setTimeout(function() { if (toast.parentNode) toast.remove() }, duration)
    }
    window.showToast = showToast

    // Auto-show toast from URL params ?toast_ok / ?toast_err
    ;(function() {
      var u = new URLSearchParams(window.location.search)
      if (u.get('toast_ok')) showToast(decodeURIComponent(u.get('toast_ok')), '', 'green')
      if (u.get('toast_err')) showToast(decodeURIComponent(u.get('toast_err')), '', 'red')
    })()

    // P21: Mobile search visibility — debounced resize (150ms) + passive flag
    ;(function() {
      function checkSearchVisibility() {
        var wrap = document.querySelector('.header-search-wrap')
        var iconBtn = document.getElementById('search-icon-btn')
        if (!wrap || !iconBtn) return
        var style = window.getComputedStyle(wrap)
        iconBtn.style.display = style.display === 'none' ? 'inline-flex' : 'none'
      }
      var _resizeTimer
      function debouncedResize() {
        clearTimeout(_resizeTimer)
        _resizeTimer = setTimeout(checkSearchVisibility, 150)
      }
      checkSearchVisibility()
      window.addEventListener('resize', debouncedResize, { passive: true })
    })()

    // P18+P21: Page transition loader bar — scaleX GPU, no layout recalc
    ;(function() {
      var loader = document.getElementById('page-loader')
      if (!loader) return
      document.addEventListener('click', function(e) {
        var a = e.target.closest('a[href]')
        if (!a) return
        var href = a.getAttribute('href')
        if (!href || href.startsWith('#') || href.startsWith('javascript') || href.startsWith('mailto') || a.target === '_blank') return
        if (href.startsWith('http') && !href.includes(window.location.hostname)) return
        loader.className = 'loading'
      })
      document.addEventListener('submit', function(e) {
        if (e.target && e.target.tagName === 'FORM') loader.className = 'loading'
      })
      window.addEventListener('pageshow', function() {
        loader.className = 'done'
        setTimeout(function() { loader.className = '' }, 350)
      })
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
          loader.className = 'done'
          setTimeout(function() { loader.className = '' }, 350)
        })
      } else {
        loader.className = 'done'
        setTimeout(function() { loader.className = '' }, 350)
      }
    })()

    // P18+P21: Nav filter — debounced 120ms + requestAnimationFrame batch DOM writes
    ;(function() {
      var input = document.getElementById('nav-filter')
      if (!input) return
      var _filterTimer
      input.addEventListener('input', function() {
        var val = this.value
        clearTimeout(_filterTimer)
        _filterTimer = setTimeout(function() {
          requestAnimationFrame(function() {
            var q = val.toLowerCase().trim()
            var allItems = document.querySelectorAll('.nav-item[data-nav-label]')
            var allGroups = document.querySelectorAll('.nav-group')
            if (!q) {
              allItems.forEach(function(item) { item.style.display = '' })
              allGroups.forEach(function(group) { group.style.display = '' })
              return
            }
            allGroups.forEach(function(group) {
              var id = group.id.replace('group-', '')
              var items = group.querySelectorAll('.nav-item[data-nav-label]')
              var hasMatch = false
              items.forEach(function(item) {
                var label = item.getAttribute('data-nav-label') || ''
                if (label.includes(q)) {
                  item.style.display = ''
                  hasMatch = true
                } else {
                  item.style.display = 'none'
                }
              })
              if (hasMatch) {
                group.style.display = ''
                var groupItems = document.getElementById('items-' + id)
                if (groupItems) groupItems.classList.remove('collapsed')
                var chevron = document.getElementById('chevron-' + id)
                if (chevron) { chevron.textContent = '▾'; chevron.classList.add('open'); chevron.classList.remove('closed') }
              } else {
                group.style.display = 'none'
              }
            })
          })
        }, 120)
      })
      // Escape clears filter
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') { this.value = ''; this.dispatchEvent(new Event('input')); this.blur() }
      })
    })()

    // P22: Lightweight perf observer — records navigation timing to /api/perf (non-blocking)
    ;(function() {
      if (!window.performance || !window.performance.getEntriesByType) return
      window.addEventListener('load', function() {
        try {
          var nav = performance.getEntriesByType('navigation')[0]
          if (!nav) return
          var metrics = {
            page: window.location.pathname,
            ttfb: Math.round(nav.responseStart - nav.requestStart),
            dom_ready: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
            load: Math.round(nav.loadEventEnd - nav.startTime)
          }
          // Fire-and-forget, non-blocking, non-critical
          var body = JSON.stringify(metrics)
          if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/perf', body)
          } else {
            fetch('/api/perf', { method: 'POST', body: body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(function(){})
          }
        } catch(e) {}
      }, { once: true, passive: true })
    })()
  `
}
