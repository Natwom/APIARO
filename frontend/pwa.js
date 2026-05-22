// Register Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(reg => console.log('✅ SW registered:', reg.scope))
    .catch(err => console.log('❌ SW failed:', err));
}

// PWA Install Banner
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBanner();
});

function showInstallBanner() {
  if (window.matchMedia('(display-mode: standalone)').matches) return;
  if (document.getElementById('pwa-install-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.innerHTML = `
    <div style="
      position:fixed;top:0;left:0;right:0;background:#ff6b00;
      color:white;padding:12px 20px;display:flex;
      justify-content:space-between;align-items:center;
      z-index:99999;font-family:sans-serif;box-shadow:0 2px 10px rgba(0,0,0,0.2);
    ">
      <span style="font-weight:600;font-size:0.95rem;">
        📲 Install Apiaro for a better experience!
      </span>
      <div style="display:flex;gap:10px;">
        <button id="pwa-install-btn" style="
          background:white;color:#ff6b00;border:none;padding:8px 16px;
          border-radius:4px;font-weight:600;cursor:pointer;
        ">Install</button>
        <button id="pwa-dismiss-btn" style="
          background:transparent;color:white;border:1px solid white;
          padding:8px 12px;border-radius:4px;cursor:pointer;
        ">✕</button>
      </div>
    </div>
  `;
  document.body.appendChild(banner);
  document.body.style.paddingTop = '50px';

  document.getElementById('pwa-install-btn').addEventListener('click', installPWA);
  document.getElementById('pwa-dismiss-btn').addEventListener('click', dismissPWA);
}

function installPWA() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then((choice) => {
    if (choice.outcome === 'accepted') console.log('User installed Apiaro');
    deferredPrompt = null;
    dismissPWA();
  });
}

function dismissPWA() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.remove();
  document.body.style.paddingTop = '0';
}

window.addEventListener('appinstalled', () => {
  dismissPWA();
  deferredPrompt = null;
  console.log('Apiaro was installed');
});
