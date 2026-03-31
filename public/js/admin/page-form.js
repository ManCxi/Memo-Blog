document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('page-form-page');
  initPageSettingsDrawer();
});

function initPageSettingsDrawer() {
  const drawer = document.getElementById('pageSettingsDrawer');
  const overlay = document.getElementById('pageSettingsOverlay');
  if (!drawer || !overlay) return;

  drawer.setAttribute('aria-hidden', 'true');
  try {
    drawer.inert = true;
  } catch (_) {}

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePageSettings();
  });
}

function openPageSettings() {
  const drawer = document.getElementById('pageSettingsDrawer');
  const overlay = document.getElementById('pageSettingsOverlay');
  if (!drawer || !overlay) return;
  drawer.classList.add('is-open');
  overlay.classList.add('is-open');
  drawer.setAttribute('aria-hidden', 'false');
  try {
    drawer.inert = false;
  } catch (_) {}
  document.body.classList.add('article-settings-open');

  setTimeout(() => {
    const focusable = drawer.querySelector(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable && typeof focusable.focus === 'function') focusable.focus();
  }, 0);
}

function closePageSettings() {
  const drawer = document.getElementById('pageSettingsDrawer');
  const overlay = document.getElementById('pageSettingsOverlay');
  if (!drawer || !overlay) return;

  const active = document.activeElement;
  if (active && drawer.contains(active) && typeof active.blur === 'function') active.blur();
  const opener = document.getElementById('openPageSettingsBtn');
  if (opener && typeof opener.focus === 'function') opener.focus();

  drawer.classList.remove('is-open');
  overlay.classList.remove('is-open');
  drawer.setAttribute('aria-hidden', 'true');
  try {
    drawer.inert = true;
  } catch (_) {}
  document.body.classList.remove('article-settings-open');
}

