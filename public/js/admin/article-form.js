/**
 * Article Form Management
 * Includes editor initialization, date picker, category/tag management, and preview logic.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Mark current page for scoped CSS fixes
  document.body.classList.add('article-form-page');

  // 1. Initialize Date Picker
  initDatePicker();

  // 2. Initialize Editors
  initEditor();
  initMarkdownEditor();

  // 2.5 Initialize settings drawer
  initArticleSettingsDrawer();

  // 3. Category Dropdown Click Outside
  document.addEventListener('click', (e) => {
    const box = document.getElementById('categorySelect');
    if (!box) return;
    if (!box.contains(e.target)) closeCategoryDropdown();
  });
});

function initArticleSettingsDrawer() {
  const drawer = document.getElementById('articleSettingsDrawer');
  const overlay = document.getElementById('articleSettingsOverlay');
  if (!drawer || !overlay) return;

  // Keep drawer unfocusable when closed (prevents aria-hidden + focused descendant warnings)
  drawer.setAttribute('aria-hidden', 'true');
  try {
    drawer.inert = true;
  } catch (_) {}

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeArticleSettings();
  });

  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    const tagBox = document.getElementById('tagSelect');
    if (tagBox && !tagBox.contains(e.target)) closeTagDropdown();
    const catBox = document.getElementById('categorySelect');
    if (catBox && !catBox.contains(e.target)) closeCategoryDropdown();
  });

  // Initialize tag label once (selected tags -> trigger text)
  setTimeout(updateTagSelectLabel, 0);
}

function openArticleSettings() {
  const drawer = document.getElementById('articleSettingsDrawer');
  const overlay = document.getElementById('articleSettingsOverlay');
  if (!drawer || !overlay) return;
  drawer.classList.add('is-open');
  overlay.classList.add('is-open');
  drawer.setAttribute('aria-hidden', 'false');
  try {
    drawer.inert = false;
  } catch (_) {}
  document.body.classList.add('article-settings-open');

  // Move focus into the drawer for accessibility
  setTimeout(() => {
    const focusable = drawer.querySelector(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable && typeof focusable.focus === 'function') focusable.focus();
  }, 0);
}

function closeArticleSettings() {
  const drawer = document.getElementById('articleSettingsDrawer');
  const overlay = document.getElementById('articleSettingsOverlay');
  if (!drawer || !overlay) return;

  // If focus is inside drawer, move it away before hiding from AT
  const active = document.activeElement;
  if (active && drawer.contains(active) && typeof active.blur === 'function') active.blur();
  const opener = document.getElementById('openArticleSettingsBtn');
  if (opener && typeof opener.focus === 'function') opener.focus();

  drawer.classList.remove('is-open');
  overlay.classList.remove('is-open');
  drawer.setAttribute('aria-hidden', 'true');
  try {
    drawer.inert = true;
  } catch (_) {}
  document.body.classList.remove('article-settings-open');
}

function toggleTagDropdown(event) {
  if (event) event.stopPropagation();
  const box = document.getElementById('tagSelect');
  if (!box) return;
  const willOpen = !box.classList.contains('open');
  if (willOpen) closeCategoryDropdown();
  box.classList.toggle('open', willOpen);
  if (willOpen) openFloatingDropdown('tagSelectTrigger', 'tagSelectMenu');
  else closeFloatingDropdown('tagSelectMenu');
}

function closeTagDropdown() {
  const box = document.getElementById('tagSelect');
  if (box) box.classList.remove('open');
  closeFloatingDropdown('tagSelectMenu');
}

function openFloatingDropdown(triggerId, menuId) {
  const trigger = document.getElementById(triggerId);
  const menu = document.getElementById(menuId);
  if (!trigger || !menu) return;

  // Attach menu to body so it's not clipped by overflow containers (e.g. drawer body)
  if (!menu.dataset.portalOriginalParentId) {
    const parent = menu.parentElement;
    if (parent && parent.id) menu.dataset.portalOriginalParentId = parent.id;
  }
  if (menu.parentElement !== document.body) document.body.appendChild(menu);

  menu.classList.add('floating-dropdown');
  positionFloatingDropdown(trigger, menu);

  const onReposition = () => positionFloatingDropdown(trigger, menu);
  const drawerBody = document.querySelector('.article-settings-drawer-body');
  const onDrawerScroll = () => positionFloatingDropdown(trigger, menu);
  const onWindowScroll = () => positionFloatingDropdown(trigger, menu);

  menu._floatingHandlers = { onReposition, onDrawerScroll, onWindowScroll, drawerBody };
  window.addEventListener('resize', onReposition, { passive: true });
  window.addEventListener('scroll', onWindowScroll, { passive: true, capture: true });
  if (drawerBody) drawerBody.addEventListener('scroll', onDrawerScroll, { passive: true });
}

function closeFloatingDropdown(menuId) {
  const menu = document.getElementById(menuId);
  if (!menu) return;

  const handlers = menu._floatingHandlers;
  if (handlers) {
    window.removeEventListener('resize', handlers.onReposition);
    window.removeEventListener('scroll', handlers.onWindowScroll, true);
    if (handlers.drawerBody) {
      handlers.drawerBody.removeEventListener('scroll', handlers.onDrawerScroll);
    }
    delete menu._floatingHandlers;
  }

  menu.classList.remove('floating-dropdown');
  menu.style.top = '';
  menu.style.left = '';
  menu.style.width = '';
  menu.style.maxHeight = '';
  menu.style.transformOrigin = '';

  const parentId = menu.dataset.portalOriginalParentId;
  const parent = parentId ? document.getElementById(parentId) : null;
  if (parent) parent.appendChild(menu);
}

function positionFloatingDropdown(trigger, menu) {
  const r = trigger.getBoundingClientRect();
  const gap = 6;
  const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  const menuWidth = Math.min(Math.max(r.width, 220), 520);
  let left = r.left;
  if (left + menuWidth > vw - 8) left = Math.max(8, vw - 8 - menuWidth);
  menu.style.position = 'fixed';
  // Smart placement: open downward if enough space, otherwise open upward.
  const spaceBelow = vh - (r.bottom + gap) - 8;
  const spaceAbove = r.top - gap - 8;
  const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
  const top = openUp ? Math.max(8, Math.round(r.top - gap)) : Math.round(r.bottom + gap);
  menu.style.top = `${top}px`;
  menu.style.transformOrigin = openUp ? 'bottom right' : 'top right';
  menu.style.left = `${Math.round(left)}px`;
  menu.style.width = `${Math.round(menuWidth)}px`;
  // Constrain height to available viewport space
  const maxH = Math.max(160, Math.floor(openUp ? spaceAbove : spaceBelow));
  menu.style.maxHeight = `${maxH}px`;
}

function updateTagSelectLabel() {
  const label = document.getElementById('tagSelectLabel');
  const menu = document.getElementById('tagSelectMenu');
  if (!label || !menu) return;
  const checked = Array.from(menu.querySelectorAll('input[name="tagIds"]:checked'));
  if (checked.length === 0) {
    label.textContent = '请选择标签';
    return;
  }
  if (checked.length <= 3) {
    const names = checked
      .map((el) => {
        const span = el.parentElement ? el.parentElement.querySelector('span') : null;
        return span ? span.textContent.replace(/^#\s*/, '# ') : '';
      })
      .filter(Boolean);
    label.textContent = names.join('，');
  } else {
    label.textContent = `已选择 ${checked.length} 个标签`;
  }
}

/**
 * Initialize Air Datepicker for publishedAt field
 */
function initDatePicker() {
  const publishedAtPicker = document.getElementById('publishedAtPicker');
  if (!publishedAtPicker) return;

  const publishedValueInput = document.getElementById('publishedAtValue');
  const initialRaw =
    publishedValueInput && publishedValueInput.value ? publishedValueInput.value : '';
  const initialDate = initialRaw ? new Date(initialRaw.replace(' ', 'T')) : new Date();

  const zhLocale = {
    days: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
    daysShort: ['日', '一', '二', '三', '四', '五', '六'],
    daysMin: ['日', '一', '二', '三', '四', '五', '六'],
    months: [
      '一月',
      '二月',
      '三月',
      '四月',
      '五月',
      '六月',
      '七月',
      '八月',
      '九月',
      '十月',
      '十一月',
      '十二月',
    ],
    monthsShort: [
      '一月',
      '二月',
      '三月',
      '四月',
      '五月',
      '六月',
      '七月',
      '八月',
      '九月',
      '十月',
      '十一月',
      '十二月',
    ],
    today: '今天',
    clear: '清除',
    dateFormat: 'yyyy-MM-dd',
    timeFormat: 'HH:mm',
    firstDay: 1,
  };

  if (window.AirDatepicker) {
    new AirDatepicker('#publishedAtPicker', {
      locale: zhLocale,
      view: 'days',
      minView: 'days',
      autoClose: true,
      timepicker: true,
      dateFormat: 'yyyy-MM-dd',
      altField: '#publishedAtValue',
      altFieldDateFormat(date) {
        const p = (n) => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
      },
      selectedDates: Number.isNaN(initialDate.getTime()) ? [new Date()] : [initialDate],
    });
  }
}

/**
 * Initialize WangEditor
 */
let htmlEditorInitStarted = false;

function initEditor(force = false) {
  if (window.editor || htmlEditorInitStarted) return;
  if (!force && getEditorType() === 'markdown') return;
  htmlEditorInitStarted = true;
  setTimeout(() => {
    if (!window.wangEditor) {
      console.error('WangEditor script not loaded properly.');
      htmlEditorInitStarted = false;
      return;
    }
    const { createEditor, createToolbar } = window.wangEditor;

    const editorConfig = {
      placeholder: '请输入文章内容...',
      MENU_CONF: {
        uploadImage: {
          customUpload(file, insertFn) {
            const fd = new FormData();
            fd.append('file', file);
            fetch('/admin/media/upload', {
              method: 'POST',
              headers: {
                'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content,
              },
              body: fd,
            })
              .then((r) => r.json())
              .then((d) => {
                if (d.ok) {
                  insertFn(d.url, d.filename, d.url);
                } else {
                  alert('上传失败: ' + d.message);
                }
              })
              .catch((e) => alert('上传出错: ' + e.message));
          },
        },
      },
    };

    const hiddenContent = document.getElementById('hiddenContent');
    const editor = createEditor({
      selector: '#editor-container',
      html: (hiddenContent ? hiddenContent.value : '') || '',
      config: editorConfig,
      mode: 'default',
    });

    editor.on('change', () => {
      const html = editor.getHtml();
      if (getEditorType() === 'html' && hiddenContent) hiddenContent.value = html;
    });

    // Register custom media library menu for WangEditor
    const { Boot } = window.wangEditor;
    class MediaLibraryMenu {
      constructor() {
        this.title = '从媒体库选择';
        this.iconSvg =
          '<svg viewBox="0 0 1024 1024"><path d="M928 160H96c-17.7 0-32 14.3-32 32v640c0 17.7 14.3 32 32 32h832c17.7 0 32-14.3 32-32V192c0-17.7-14.3-32-32-32zM153.8 809.1l170.9-204 90.9 90.9L642.7 444l227.5 315.1H153.8zM736 384c-44.2 0-80-35.8-80-80s35.8-80 80-80 80 35.8 80 80-35.8 80-80 80z"></path></svg>';
        this.tag = 'button';
      }
      getValue(editor) {
        return '';
      }
      isActive(editor) {
        return false;
      }
      isDisabled(editor) {
        return false;
      }
      exec(editor, value) {
        if (typeof window.openAttachmentPicker === 'function') {
          window.openAttachmentPicker(
            (url) => {
              editor.restoreSelection();
              editor.insertNode({
                type: 'image',
                src: url,
                alt: '图片',
                style: { width: '100%' },
                children: [{ text: '' }],
              });
            },
            { accept: 'image' }
          );
        } else {
          alert('媒体库组件未加载');
        }
      }
    }
    try {
      Boot.registerMenu({
        key: 'mediaLibrary',
        factory() {
          return new MediaLibraryMenu();
        },
      });
    } catch (e) {}

    const toolbar = createToolbar({
      editor,
      selector: '#editor-toolbar',
      config: {
        insertKeys: {
          index: 23, // Position near image menu
          keys: ['mediaLibrary'],
        },
      },
      mode: 'default',
    });

    // Expose to window for preview and form submission
    window.editor = editor;

    // Synchronize data before form submission (safety precaution)
    const articleForm = document.getElementById('articleForm');
    if (articleForm) {
      articleForm.addEventListener('submit', function () {
        if (getEditorType() === 'html' && hiddenContent) {
          hiddenContent.value = editor.getHtml();
        } else if (getEditorType() === 'markdown' && easyMDE) {
          hiddenContent.value = easyMDE.value();
        }
      });
    }
  }, 100);
}

let easyMDE = null;

function refreshMarkdownEditorViewport() {
  if (!easyMDE || !easyMDE.codemirror) return;
  const cm = easyMDE.codemirror;
  if (typeof cm.setSize === 'function') {
    cm.setSize(null, '100%');
  }
  if (typeof cm.getWrapperElement === 'function') {
    const wrapper = cm.getWrapperElement();
    if (wrapper) {
      wrapper.style.height = '100%';
      wrapper.style.minHeight = '0';
    }
  }
  if (typeof cm.getScrollerElement === 'function') {
    const scroller = cm.getScrollerElement();
    if (scroller) {
      scroller.style.maxHeight = '100%';
      scroller.style.overflowY = 'auto';
      scroller.style.overflowX = 'auto';
    }
  }
  if (typeof cm.refresh === 'function') {
    cm.refresh();
  }
}

function syncEasyMDEFullscreenState(targetEditor) {
  const editor = targetEditor || easyMDE;
  if (!editor || !editor.codemirror) return;
  const cm = editor.codemirror;
  let isFullscreen = false;
  if (typeof cm.isFullScreen === 'function') {
    isFullscreen = !!cm.isFullScreen();
  } else if (typeof cm.getWrapperElement === 'function') {
    const wrapper = cm.getWrapperElement();
    isFullscreen = !!(wrapper && wrapper.classList.contains('CodeMirror-fullscreen'));
  }
  document.body.classList.toggle('editor-is-fullscreen', isFullscreen);
}

/**
 * Initialize EasyMDE for Markdown editing
 */
function initMarkdownEditor() {
  const textarea = document.getElementById('markdown-editor');
  if (!textarea) return;

  const hiddenContent = document.getElementById('hiddenContent');
  const initialValue = hiddenContent ? hiddenContent.value : '';

  if (window.EasyMDE) {
    easyMDE = new window.EasyMDE({
      element: textarea,
      // Avoid loading FontAwesome from CDN (offline friendly).
      // Toolbar may show no icons, but editor functionality remains.
      autoDownloadFontAwesome: false,
      spellChecker: false,
      placeholder: '在此输入 Markdown 内容...',
      autofocus: false,
      status: false, // Hide status bar for cleaner look
      autosave: {
        enabled: false,
      },
      renderingConfig: {
        singleLineBreaks: false,
        codeSyntaxHighlighting: true,
      },
      initialValue: initialValue,
      minHeight: 'auto', // Let CSS flex-box handle the height
      toolbar: [
        {
          name: 'bold',
          action: window.EasyMDE.toggleBold,
          className: 'fa fa-bold',
          title: '加粗 (Ctrl-B)',
        },
        {
          name: 'italic',
          action: window.EasyMDE.toggleItalic,
          className: 'fa fa-italic',
          title: '斜体 (Ctrl-I)',
        },
        {
          name: 'heading',
          action: window.EasyMDE.toggleHeadingSmaller,
          className: 'fa fa-header',
          title: '标题 (Ctrl-H)',
        },
        '|',
        {
          name: 'quote',
          action: window.EasyMDE.toggleBlockquote,
          className: 'fa fa-quote-left',
          title: "引用 (Ctrl-')",
        },
        {
          name: 'unordered-list',
          action: window.EasyMDE.toggleUnorderedList,
          className: 'fa fa-list-ul',
          title: '无序列表 (Ctrl-L)',
        },
        {
          name: 'ordered-list',
          action: window.EasyMDE.toggleOrderedList,
          className: 'fa fa-list-ol',
          title: '有序列表 (Ctrl-Alt-L)',
        },
        '|',
        {
          name: 'link',
          action: window.EasyMDE.drawLink,
          className: 'fa fa-link',
          title: '创建链接 (Ctrl-K)',
        },
        {
          name: 'image',
          action: function (editor) {
            if (typeof window.openAttachmentPicker === 'function') {
              window.openAttachmentPicker(
                function (url) {
                  const targetEditor = editor || window.easyMDE;
                  if (!targetEditor || !targetEditor.codemirror) {
                    console.error('EasyMDE instance not found for insertion');
                    return;
                  }
                  // Ensure editor is focused
                  targetEditor.codemirror.focus();
                  // Format URL
                  const imageUrl = url.startsWith('http') || url.startsWith('/') ? url : '/' + url;
                  // Insert at cursor using the underlying CodeMirror instance
                  targetEditor.codemirror.replaceSelection(`![图片描述](${imageUrl})`);
                  // Refresh to sync value
                  targetEditor.codemirror.refresh();
                },
                { accept: 'image' }
              );
            } else {
              // Fallback to default if picker not found
              window.EasyMDE.drawImage(editor);
            }
          },
          className: 'fa fa-picture-o',
          title: '插入媒体库图片 (Ctrl-Alt-I)',
        },
        {
          name: 'table',
          action: window.EasyMDE.drawTable,
          className: 'fa fa-table',
          title: '插入表格',
        },
        '|',
        {
          name: 'preview',
          action: window.EasyMDE.togglePreview,
          className: 'fa fa-eye no-disable',
          title: '实时预览 (Ctrl-P)',
        },
        {
          name: 'side-by-side',
          action: window.EasyMDE.toggleSideBySide,
          className: 'fa fa-columns no-disable no-mobile',
          title: '分栏预览 (F9)',
        },
        {
          name: 'fullscreen',
          action(editor) {
            window.EasyMDE.toggleFullScreen(editor);
            setTimeout(() => syncEasyMDEFullscreenState(editor || easyMDE), 0);
          },
          className: 'fa fa-arrows-alt no-disable no-mobile',
          title: '全屏模式 (F11)',
        },
        '|',
        {
          name: 'guide',
          action: 'https://www.markdownguide.org/basic-syntax/',
          className: 'fa fa-question-circle',
          title: 'Markdown 指南',
        },
      ],
    });

    if (easyMDE && easyMDE.codemirror && typeof easyMDE.codemirror.on === 'function') {
      easyMDE.codemirror.on('keydown', (_, event) => {
        if (event && (event.key === 'F11' || event.key === 'Escape')) {
          setTimeout(() => syncEasyMDEFullscreenState(easyMDE), 0);
        }
      });
    }
  } else {
    textarea.value = initialValue || '';
    easyMDE = {
      value(v) {
        if (typeof v === 'undefined') return textarea.value;
        textarea.value = v;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      },
      codemirror: {
        on(event, handler) {
          if (event === 'change') textarea.addEventListener('input', handler);
        },
      },
    };
  }
  easyMDE.codemirror.on('change', () => {
    if (getEditorType() === 'markdown' && hiddenContent) {
      hiddenContent.value = easyMDE.value();
    }
  });

  setTimeout(refreshMarkdownEditorViewport, 100);
}

/**
 * Get current active editor type
 */
function getEditorType() {
  const selected = document.querySelector('input[name="editorType"]:checked');
  return selected ? selected.value : 'html';
}

/**
 * Switch between HTML and Markdown editors
 */
function switchEditor(type) {
  const wangArea = document.getElementById('wang-editor-area');
  const mdArea = document.getElementById('markdown-editor-area');
  const importBtn = document.getElementById('importMdBtn');
  const hiddenContent = document.getElementById('hiddenContent');

  // Determine previous type based on visibility
  const prevType = wangArea && wangArea.classList.contains('d-none') ? 'markdown' : 'html';
  if (type === prevType) return;

  // 1. Sync current content to hiddenContent
  if (prevType === 'html' && window.editor) {
    hiddenContent.value = window.editor.getHtml();
  } else if (prevType === 'markdown') {
    hiddenContent.value = easyMDE
      ? easyMDE.value()
      : document.getElementById('markdown-editor').value;
  }

  const content = hiddenContent.value.trim();

  // 2. Perform Conversion
  if (type === 'markdown' && prevType === 'html') {
    const Turndown = window.TurndownService || window.Turndown;
    if (Turndown) {
      const turndownService = new Turndown({
        headingStyle: 'atx',
        hr: '---',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
      });

      turndownService.addRule('codeblock', {
        filter: 'pre',
        replacement: function (content, node) {
          const codeElem = node.querySelector('code');
          const code = codeElem
            ? codeElem.innerText || codeElem.textContent
            : node.innerText || node.textContent;
          let lang = '';
          if (codeElem) {
            const cls = codeElem.className || '';
            const match = cls.match(/language-(\w+)/);
            if (match) lang = match[1];
          }
          return '\n\n```' + lang + '\n' + code.trim() + '\n```\n\n';
        },
      });

      turndownService.addRule('headings', {
        filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        replacement: function (content, node) {
          const level = node.nodeName.charAt(1);
          return '\n\n' + '#'.repeat(level) + ' ' + content.trim() + '\n\n';
        },
      });

      let rawHtml = hiddenContent.value.replace(/&nbsp;/g, ' ');
      if (rawHtml.includes('&lt;') && !rawHtml.includes('<')) {
        const decoder = document.createElement('div');
        decoder.innerHTML = rawHtml;
        rawHtml = decoder.textContent;
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(rawHtml, 'text/html');
      let markdown = turndownService.turndown(doc.body);
      markdown = markdown.replace(/\n{3,}/g, '\n\n').trim();
      hiddenContent.value = markdown;
    } else {
      alert('转换引擎 (Turndown) 加载失败，无法执行格式转换。');
      const radio = document.querySelector(`input[name="editorType"][value="${prevType}"]`);
      if (radio) radio.checked = true;
      return;
    }
  } else if (type === 'html' && prevType === 'markdown') {
    const Marked = window.marked;
    if (Marked) {
      const markdown = hiddenContent.value;
      const html = Marked.parse
        ? Marked.parse(markdown)
        : typeof Marked === 'function'
          ? Marked(markdown)
          : markdown;
      hiddenContent.value = html.trim();
    }
  }

  // 3. UI Toggle and Final Sync
  if (type === 'markdown') {
    if (wangArea) wangArea.classList.add('d-none');
    if (mdArea) mdArea.classList.remove('d-none');
    if (importBtn) importBtn.classList.remove('d-none');
    if (easyMDE) {
      easyMDE.value(hiddenContent.value);
      setTimeout(refreshMarkdownEditorViewport, 0);
    } else {
      const ta = document.getElementById('markdown-editor');
      if (ta) ta.value = hiddenContent.value;
    }
  } else {
    if (wangArea) wangArea.classList.remove('d-none');
    if (mdArea) mdArea.classList.add('d-none');
    if (importBtn) importBtn.classList.add('d-none');
    if (!window.editor) {
      initEditor(true);
      setTimeout(() => {
        if (window.editor) window.editor.setHtml(hiddenContent.value);
      }, 120);
    } else {
      window.editor.setHtml(hiddenContent.value);
    }
  }
}

function triggerMdImport() {
  const input = document.getElementById('mdFileInput');
  if (input) input.click();
}

/**
 * Handle selected Markdown file
 */
function handleMdFile(input) {
  const file = input.files[0];
  if (!file) return;

  if (!file.name.toLowerCase().endsWith('.md')) {
    alert('请选择 .md 后缀的 Markdown 文件');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target.result;
    if (easyMDE) {
      easyMDE.value(content);
      const hiddenContent = document.getElementById('hiddenContent');
      if (hiddenContent) hiddenContent.value = content;
    }
    input.value = '';
  };
  reader.readAsText(file);
}

/**
 * Update cover preview image
 */
function updateCoverPreview(url) {
  const box = document.getElementById('coverPickerBox');
  const clearBtn = document.getElementById('coverClearBtn');
  if (clearBtn) clearBtn.classList.toggle('d-none', !url);
  if (!box) return;

  if (url) {
    box.innerHTML = `
      <img src="${url}" alt="封面">
      <button type="button" class="cover-picker-clear" id="coverClearBtn" onclick="event.stopPropagation(); setCover('');">移除</button>
    `;
  } else {
    box.innerHTML = `
      <div class="cover-picker-hint">
        <div class="cover-picker-title">点击选择封面图片</div>
        <div class="cover-picker-sub">从附件库选择一张图片作为封面</div>
      </div>
      <button type="button" class="cover-picker-clear d-none" id="coverClearBtn" onclick="event.stopPropagation(); setCover('');">移除</button>
    `;
  }
}

function setCover(url) {
  const input = document.getElementById('coverUrl');
  if (input) input.value = url || '';
  updateCoverPreview(url || '');
}

/**
 * Open article preview modal
 */
function openPreviewModal() {
  const type = getEditorType();
  const hiddenContent = document.getElementById('hiddenContent');
  const content =
    type === 'markdown'
      ? easyMDE
        ? easyMDE.value()
        : ''
      : window.editor
        ? window.editor.getHtml()
        : hiddenContent
          ? hiddenContent.value
          : '';

  if (!content && content !== '') {
    alert('编辑器内容获取异常，请刷新页面重试。');
    return;
  }
  const modal = document.getElementById('previewModal');
  if (!modal) return;
  modal.style.display = 'flex';
  const iframe = document.getElementById('preview-iframe');

  const send = () => {
    if (!iframe || !iframe.contentWindow) return;
    const categoryInput = document.getElementById('categoryIdInput');
    const categoryLabel = document.getElementById('categorySelectLabel');
    const categoryName =
      categoryInput && categoryInput.value
        ? categoryLabel
          ? categoryLabel.textContent.trim()
          : ''
        : '';
    const tagNames = Array.from(document.querySelectorAll('input[name="tagIds"]:checked'))
      .map((el) => {
        const label = document.querySelector(`label[for="${el.id}"]`);
        return label ? label.textContent.replace('# ', '') : '';
      })
      .filter((t) => t);

    iframe.contentWindow.postMessage(
      {
        type: 'PREVIEW_ARTICLE',
        title: document.querySelector('input[name="title"]').value || '未命名文章',
        content: content,
        editorType: type, // Pass editor type to preview
        cover: document.getElementById('coverUrl').value,
        categoryName: categoryName,
        tagNames: tagNames,
        pinned: document.querySelector('input[name="pinned"]').checked,
      },
      '*'
    );
  };

  const onReady = (e) => {
    if (e && e.data && e.data.type === 'PREVIEW_READY') {
      window.removeEventListener('message', onReady);
      send();
    }
  };
  window.addEventListener('message', onReady);

  iframe.onload = send;
  iframe.src = '/article-preview?t=' + Date.now();
}

function closePreviewModal() {
  const modal = document.getElementById('previewModal');
  if (modal) modal.style.display = 'none';
}

function setPreviewDevice(device) {
  const container = document.getElementById('preview-container');
  const iframeWrap = document.getElementById('preview-iframe-wrap');
  if (!container || !iframeWrap) return;

  const btns = document.querySelectorAll('.preview-device-btn');
  btns.forEach((b) => {
    b.style.background = 'transparent';
    b.style.color = 'var(--text-tertiary)';
    b.style.fontWeight = 'normal';
    b.style.pointerEvents = 'auto';
    b.style.boxShadow = 'none';
  });

  const activeBtn = document.querySelector(`.preview-device-btn[data-device="${device}"]`);
  if (activeBtn) {
    activeBtn.style.background = 'var(--surface-1-bg)';
    activeBtn.style.color = '#0A7AFF';
    activeBtn.style.fontWeight = '500';
    activeBtn.style.pointerEvents = 'none';
    activeBtn.style.boxShadow = 'var(--surface-shadow-2)';
  }

  if (device === 'desktop') {
    iframeWrap.style.width = '100%';
    iframeWrap.style.height = '100%';
    iframeWrap.style.border = 'none';
    iframeWrap.style.borderRadius = '0';
    container.style.paddingTop = '0';
  } else if (device === 'tablet') {
    iframeWrap.style.width = '768px';
    iframeWrap.style.height = '90%';
    iframeWrap.style.border = '12px solid #333';
    iframeWrap.style.borderRadius = '32px';
    container.style.paddingTop = '24px';
  } else {
    iframeWrap.style.width = '375px';
    iframeWrap.style.height = '90%';
    iframeWrap.style.border = '12px solid #333';
    iframeWrap.style.borderRadius = '32px';
    container.style.paddingTop = '24px';
  }
}

// ── Category / Tag AJAX Management ──

function openAddCategoryModal() {
  const modal = document.getElementById('addCategoryModal');
  if (modal) modal.style.display = 'flex';
}

function closeAddCategoryModal() {
  const modal = document.getElementById('addCategoryModal');
  if (modal) {
    modal.style.display = 'none';
    const input = document.getElementById('newCategoryName');
    if (input) input.value = '';
  }
}

function toggleCategoryDropdown(event) {
  if (event) event.stopPropagation();
  const box = document.getElementById('categorySelect');
  if (!box) return;
  const willOpen = !box.classList.contains('open');
  if (willOpen) closeTagDropdown();
  box.classList.toggle('open', willOpen);
  if (willOpen) openFloatingDropdown('categorySelectTrigger', 'categorySelectMenu');
  else closeFloatingDropdown('categorySelectMenu');
}

function closeCategoryDropdown() {
  const box = document.getElementById('categorySelect');
  if (box) box.classList.remove('open');
  closeFloatingDropdown('categorySelectMenu');
}

function selectCategoryOption(el) {
  const value = el.getAttribute('data-value') || '';
  const label = el.getAttribute('data-label') || '不选分类';
  const input = document.getElementById('categoryIdInput');
  const text = document.getElementById('categorySelectLabel');
  if (input) input.value = value;
  if (text) text.textContent = label;
  document.querySelectorAll('#categorySelectMenu .category-option').forEach((btn) => {
    btn.classList.toggle('active', btn === el);
  });
  closeCategoryDropdown();
}

/**
 * Re-render category dropdown menu
 */
function renderCategoryMenu(categories, selectedId) {
  const menu = document.getElementById('categorySelectMenu');
  const input = document.getElementById('categoryIdInput');
  const label = document.getElementById('categorySelectLabel');
  if (!menu || !input || !label) return;

  const selected = categories.find((cat) => String(cat.id) === String(selectedId || ''));
  const finalValue = selected ? String(selected.id) : '';
  const finalLabel = selected ? selected.name : '不选分类';

  input.value = finalValue;
  label.textContent = finalLabel;

  let html = `<button type="button" class="category-option ${finalValue ? '' : 'active'}" data-value="" data-label="不选分类" onclick="selectCategoryOption(this)">不选分类</button>`;
  categories.forEach((cat) => {
    const active = String(cat.id) === finalValue ? ' active' : '';
    html += `<button type="button" class="category-option${active}" data-value="${cat.id}" data-label="${String(cat.name).replace(/"/g, '&quot;')}" onclick="selectCategoryOption(this)">${String(cat.name).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</button>`;
  });
  menu.innerHTML = html;
}

async function submitNewCategory() {
  const input = document.getElementById('newCategoryName');
  const name = input ? input.value.trim() : '';
  if (!name) return alert('名称不能为空');

  const btn = document.getElementById('submitCategoryBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerText = '创建中...';
  }

  try {
    const res = await fetch('/admin/categories?ajax=1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content,
      },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (data.ok) {
      await refreshCategoryList(data.category.id);
      closeAddCategoryModal();
    } else {
      alert(data.message || '创建失败');
    }
  } catch (err) {
    alert('网络错误');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '确认创建';
    }
  }
}

async function refreshCategoryList(selectedId) {
  try {
    const res = await fetch('/admin/categories/list');
    const data = await res.json();
    if (data.ok) {
      renderCategoryMenu(data.categories || [], selectedId);
    }
  } catch (err) {
    console.error('Refresh categories failed', err);
  }
}

function openAddTagModal() {
  const modal = document.getElementById('addTagModal');
  if (modal) modal.style.display = 'flex';
}

function closeAddTagModal() {
  const modal = document.getElementById('addTagModal');
  if (modal) {
    modal.style.display = 'none';
    const input = document.getElementById('newTagName');
    if (input) input.value = '';
  }
}

async function submitNewTag() {
  const input = document.getElementById('newTagName');
  const name = input ? input.value.trim() : '';
  if (!name) return alert('名称不能为空');

  const btn = document.getElementById('submitTagBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerText = '创建中...';
  }

  try {
    const res = await fetch('/admin/tags?ajax=1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content,
      },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (data.ok) {
      const checkedIds = Array.from(document.querySelectorAll('input[name="tagIds"]:checked')).map(
        (el) => el.value
      );
      if (!checkedIds.includes(String(data.tag.id))) checkedIds.push(String(data.tag.id));
      await refreshTagList(checkedIds);
      closeAddTagModal();
    } else {
      alert(data.message || '创建失败');
    }
  } catch (err) {
    alert('网络错误');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '确认创建';
    }
  }
}

async function refreshTagList(checkedIds) {
  try {
    const res = await fetch('/admin/tags/list');
    const data = await res.json();
    if (data.ok) {
      const menu = document.getElementById('tagSelectMenu');
      if (!menu) return;
      let html = '';
      data.tags.forEach((tag) => {
        const isChecked = checkedIds.includes(String(tag.id));
        const safeName = String(tag.name).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        html += `
          <label class="tag-option">
            <input type="checkbox" name="tagIds" form="articleForm" id="tag_${tag.id}" value="${tag.id}" ${isChecked ? 'checked' : ''} onchange="updateTagSelectLabel()">
            <span># ${safeName}</span>
          </label>
        `;
      });
      menu.innerHTML = html;
      updateTagSelectLabel();
    }
  } catch (err) {
    console.error('Refresh tags failed', err);
  }
}
