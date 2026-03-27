/**
 * Article Form Management
 * Includes editor initialization, date picker, category/tag management, and preview logic.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Date Picker
  initDatePicker();

  // 2. Initialize WangEditor
  initEditor();

  // 3. Category Dropdown Click Outside
  document.addEventListener('click', (e) => {
    const box = document.getElementById('categorySelect');
    if (!box) return;
    if (!box.contains(e.target)) closeCategoryDropdown();
  });
});

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
function initEditor() {
  // Wait a little bit to ensure window.wangEditor is loaded from the CDN or local libs
  setTimeout(() => {
    if (!window.wangEditor) {
      console.error('WangEditor script not loaded properly.');
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
              headers: { 'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content },
              body: fd
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
      if (hiddenContent) hiddenContent.value = html;
    });

    const toolbar = createToolbar({
      editor,
      selector: '#editor-toolbar',
      config: {},
      mode: 'default',
    });

    // Expose to window for preview and form submission
    window.editor = editor;

    // Synchronize data before form submission (safety precaution)
    const articleForm = document.getElementById('articleForm');
    if (articleForm) {
      articleForm.addEventListener('submit', function () {
        if (hiddenContent) hiddenContent.value = editor.getHtml();
      });
    }
  }, 100);
}

/**
 * Update cover preview image
 */
function updateCoverPreview(url) {
  const preview = document.getElementById('coverPreview');
  if (!preview) return;
  if (url) {
    preview.innerHTML = `<img src="${url}" alt="封面" style="width:100%;height:auto;display:block;">`;
  } else {
    preview.innerHTML = '暂无封面';
  }
}

/**
 * Open article preview modal
 */
function openPreviewModal() {
  if (!window.editor) {
    alert('编辑器尚未加载完成，请稍候再试。');
    return;
  }
  const modal = document.getElementById('previewModal');
  if (!modal) return;
  modal.style.display = 'flex';
  const iframe = document.getElementById('preview-iframe');

  const send = () => {
    if (!iframe || !iframe.contentWindow || !window.editor) return;
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
        content: window.editor.getHtml(),
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
  box.classList.toggle('open');
}

function closeCategoryDropdown() {
  const box = document.getElementById('categorySelect');
  if (box) box.classList.remove('open');
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
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
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
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
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
      const group = document.querySelector('.checkbox-group');
      if (!group) return;
      let html = '';
      data.tags.forEach((tag) => {
        const isChecked = checkedIds.includes(String(tag.id));
        html += `
                    <div class="checkbox-chip">
                        <input type="checkbox" name="tagIds" form="articleForm"
                            id="tag_${tag.id}" value="${tag.id}"
                            ${isChecked ? 'checked' : ''}>
                        <label for="tag_${tag.id}"># ${tag.name}</label>
                    </div>`;
      });
      group.innerHTML = html;
    }
  } catch (err) {
    console.error('Refresh tags failed', err);
  }
}
