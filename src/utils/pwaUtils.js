// PWA Utilities for Mirror On The Wall
class PWAManager {
  constructor() {
    this.deferredPrompt = null;
    this.isInstalled = false;
    this.isOnline = navigator.onLine;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallButton();
    });

    // Listen for app installation
    window.addEventListener('appinstalled', () => {
      console.log('PWA installed successfully');
      this.isInstalled = true;
      this.hideInstallButton();
      this.trackInstallation();
    });

    // Listen for online/offline status
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.handleOnlineStatus();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.handleOfflineStatus();
    });
  }

  // Register service worker
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        
        console.log('Service Worker registered:', registration);

        // Handle updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              this.showUpdateAvailable();
            }
          });
        });

        return registration;
      } catch (error) {
        console.error('Service Worker registration failed:', error);
        throw error;
      }
    } else {
      throw new Error('Service Worker not supported');
    }
  }

  // Show install button/prompt
  showInstallButton() {
    const installBtn = document.getElementById('install-btn');
    if (installBtn) {
      installBtn.style.display = 'block';
      installBtn.addEventListener('click', () => this.promptInstall());
    }
  }

  hideInstallButton() {
    const installBtn = document.getElementById('install-btn');
    if (installBtn) {
      installBtn.style.display = 'none';
    }
  }

  // Prompt user to install
  async promptInstall() {
    if (!this.deferredPrompt) return;

    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    
    console.log(`Install prompt outcome: ${outcome}`);
    
    if (outcome === 'accepted') {
      this.trackInstallAccepted();
    } else {
      this.trackInstallDismissed();
    }

    this.deferredPrompt = null;
  }

  // Check if app is installed
  checkIfInstalled() {
    // Check if running in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
      this.isInstalled = true;
      return true;
    }

    // Check if running in browser tab
    if (window.navigator.standalone === true) {
      this.isInstalled = true;
      return true;
    }

    return false;
  }

  // Handle online status
  handleOnlineStatus() {
    console.log('App is online');
    this.hideOfflineIndicator();
    this.syncPendingData();
    this.enableOnlineFeatures();
  }

  // Handle offline status
  handleOfflineStatus() {
    console.log('App is offline');
    this.showOfflineIndicator();
    this.disableOnlineFeatures();
  }

  // Show offline indicator
  showOfflineIndicator() {
    let indicator = document.getElementById('offline-indicator');
    
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'offline-indicator';
      indicator.innerHTML = `
        <div style="
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: #f59e0b;
          color: white;
          text-align: center;
          padding: 8px;
          font-size: 14px;
          z-index: 9999;
        ">
          📱 You're offline. Some features may be limited.
        </div>
      `;
      document.body.appendChild(indicator);
    }
  }

  hideOfflineIndicator() {
    const indicator = document.getElementById('offline-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  // Show update available notification
  showUpdateAvailable() {
    const updateNotification = document.createElement('div');
    updateNotification.innerHTML = `
      <div style="
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #3b82f6;
        color: white;
        padding: 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        max-width: 300px;
      ">
        <p style="margin: 0 0 10px 0;">App update available!</p>
        <button onclick="window.location.reload()" style="
          background: white;
          color: #3b82f6;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin-right: 8px;
        ">Update Now</button>
        <button onclick="this.parentElement.parentElement.remove()" style="
          background: transparent;
          color: white;
          border: 1px solid white;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        ">Later</button>
      </div>
    `;
    document.body.appendChild(updateNotification);
  }

  // Sync pending data when online
  async syncPendingData() {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('background-sync-messages');
        await registration.sync.register('background-sync-alerts');
        console.log('Background sync registered');
      } catch (error) {
        console.error('Background sync registration failed:', error);
      }
    }
  }

  // Enable features that require internet
  enableOnlineFeatures() {
    const onlineElements = document.querySelectorAll('[data-requires-online]');
    onlineElements.forEach(element => {
      element.disabled = false;
      element.style.opacity = '1';
    });
  }

  // Disable features that require internet
  disableOnlineFeatures() {
    const onlineElements = document.querySelectorAll('[data-requires-online]');
    onlineElements.forEach(element => {
      element.disabled = true;
      element.style.opacity = '0.5';
    });
  }

  // Request notification permission
  async requestNotificationPermission() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      console.log('Notification permission:', permission);
      return permission === 'granted';
    }
    return false;
  }

  // Subscribe to push notifications
  async subscribeToPush() {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(process.env.REACT_APP_VAPID_PUBLIC_KEY)
      });

      // Send subscription to backend
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription)
      });

      console.log('Push subscription successful');
      return subscription;
    } catch (error) {
      console.error('Push subscription failed:', error);
      throw error;
    }
  }

  // Convert VAPID key
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Analytics tracking
  trackInstallation() {
    // Track app installation
    console.log('Tracking: App installed');
  }

  trackInstallAccepted() {
    // Track install prompt accepted
    console.log('Tracking: Install accepted');
  }

  trackInstallDismissed() {
    // Track install prompt dismissed
    console.log('Tracking: Install dismissed');
  }
}

// Initialize PWA Manager
const pwaManager = new PWAManager();

// Export for use in other modules
export default pwaManager;
