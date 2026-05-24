// ========== SERVICE WORKER REGISTRATION & FORCE UPDATE ==========
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then((registration) => {
                console.log('✅ SW registered:', registration.scope);

                // Check for updates on every page load
                registration.update();

                // If a new SW is waiting, force it to activate immediately
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('🔄 New SW waiting, forcing activation...');
                            newWorker.postMessage({ action: 'skipWaiting' });
                        }
                    });
                });
            })
            .catch((err) => console.log('❌ SW failed:', err));
    });

    // When new SW takes control, reload once to get fresh content
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
            refreshing = true;
            console.log('🔄 New SW activated, reloading page...');
            window.location.reload();
        }
    });
}

// ========== PWA INSTALL BANNER ==========
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
            position:fixed;top:0;left:0;right:0;background:linear-gradient(90deg,#ff6b00,#ff8533);
            color:white;padding:14px 20px;display:flex;
            justify-content:space-between;align-items:center;
            z-index:99999;font-family:sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.15);
        ">
            <span style="font-weight:600;font-size:0.95rem;">
                📲 Install Apiaro for a better experience!
            </span>
            <div style="display:flex;gap:10px;">
                <button id="pwa-install-btn" style="
                    background:white;color:#ff6b00;border:none;padding:8px 16px;
                    border-radius:8px;font-weight:700;cursor:pointer;
                ">Install</button>
                <button id="pwa-dismiss-btn" style="
                    background:rgba(255,255,255,0.2);color:white;border:none;
                    padding:8px 12px;border-radius:8px;cursor:pointer;font-weight:600;
                ">✕</button>
            </div>
        </div>
    `;
    document.body.appendChild(banner);
    document.body.style.paddingTop = '58px';

    document.getElementById('pwa-install-btn').addEventListener('click', installPWA);
    document.getElementById('pwa-dismiss-btn').addEventListener('click', dismissPWA);
}

function installPWA() {
    if (!deferredPrompt) {
        alert('To install Apiaro:\n\n📱 Android Chrome: Tap menu (⋮) → "Add to Home screen"\n🍎 iPhone Safari: Tap Share → "Add to Home Screen"');
        return;
    }
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choice) => {
        if (choice.outcome === 'accepted') {
            console.log('User installed Apiaro');
        }
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