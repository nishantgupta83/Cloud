// Enhanced PWA Utilities for Kids Safety App - Part 1
class PWAManager {
  constructor() {
    this.deferredPrompt = null;
    this.isInstalled = false;
    this.isOnline = navigator.onLine;
    this.emergencyMode = false;
    this.networkStatusDebounce = null;
    this.pendingSafetyData = [];
    this.retryAttempts = 0;
    this.maxRetries = 3;
    
    this.setupEventListeners();
    this.initializeSafetyFeatures();
  }

  setupEventListeners() {
    // Install prompt listener
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallButton();
    });

    // App installation listener
    window.addEventListener('appinstalled', () => {
      console.log('PWA installed successfully');
      this.isInstalled = true;
      this.hideInstallButton();
      this.trackInstallation();
    });

    // Network status listeners with debouncing
    window.addEventListener('online', () => {
      clearTimeout(this.networkStatusDebounce);
      this.networkStatusDebounce = setTimeout(() => {
        this.isOnline = true;
        this.handleOnlineStatus();
      }, 1000);
    });

    window.addEventListener('offline', () => {
      clearTimeout(this.networkStatusDebounce);
      this.networkStatusDebounce = setTimeout(() => {
        this.isOnline = false;
        this.handleOfflineStatus();
      }, 1000);
    });

    // Page visibility for safety monitoring
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.onAppBackground();
      } else {
        this.onAppForeground();
      }
    });
  }

  // Initialize safety-specific features
  async initializeSafetyFeatures() {
    try {
      await this.requestNotificationPermission();
      await this.requestLocationPermission();
      this.loadPendingSafetyData();
      this.startSafetyMonitoring();
    } catch (error) {
      console.error('Safety features initialization failed:', error);
    }
  }

  // Enhanced service worker registration with timeout
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registrationPromise = navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Service Worker registration timeout')), 10000)
        );
        
        const registration = await Promise.race([registrationPromise, timeoutPromise]);
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

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          this.handleServiceWorkerMessage(event.data);
        });

        return registration;
      } catch (error) {
        console.error('Service Worker registration failed:', error);
        this.handleServiceWorkerFailure();
        throw error;
      }
    } else {
      throw new Error('Service Worker not supported');
    }
  }

  handleServiceWorkerFailure() {
    console.warn('Falling back to limited functionality without Service Worker');
    // Implement fallback strategies for critical safety features
    this.enableFallbackMode();
  }

  enableFallbackMode() {
    // Enable basic safety features without SW
    this.fallbackMode = true;
    console.log('Safety app running in fallback mode');
  }
}

// Enhanced PWA Utilities - Part 2: Safety & Emergency Features

  // Emergency mode for critical safety alerts
  enableEmergencyMode() {
    this.emergencyMode = true;
    console.log('🚨 Emergency mode activated');
    
    // Override offline limitations
    this.enableEmergencyFeatures();
    this.forceSyncEmergencyData();
    this.notifyEmergencyContacts();
  }

  disableEmergencyMode() {
    this.emergencyMode = false;
    console.log('Emergency mode deactivated');
  }

  enableEmergencyFeatures() {
    // Enable all features regardless of online status
    const emergencyElements = document.querySelectorAll('[data-emergency-feature]');
    emergencyElements.forEach(element => {
      element.disabled = false;
      element.style.opacity = '1';
      element.classList.add('emergency-active');
    });
  }

  // Enhanced safety alert notifications
  async sendSafetyAlert(alertData) {
    const { type, message, level, location, timestamp } = alertData;
    
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(`🚨 ${type} Alert`, {
        body: message,
        icon: '/icons/safety-alert-192.png',
        badge: '/icons/badge-72.png',
        tag: `safety-${type}-${timestamp}`,
        requireInteraction: level === 'critical',
        vibrate: [200, 100, 200, 100, 200],
        actions: [
          { action: 'safe', title: 'I\'m Safe ✅', icon: '/icons/safe.png' },
          { action: 'help', title: 'Need Help 🆘', icon: '/icons/help.png' },
          { action: 'location', title: 'Share Location 📍', icon: '/icons/location.png' }
        ],
        data: { alertData, timestamp: Date.now() }
      });

      notification.onclick = () => this.handleSafetyAlertClick(alertData);
    }

    // Store alert for offline sync
    this.storeSafetyAlert(alertData);
  }

  handleSafetyAlertClick(alertData) {
    // Focus app window
    window.focus();
    
    // Navigate to safety dashboard
    if (window.location.pathname !== '/safety-dashboard') {
      window.location.href = '/safety-dashboard';
    }
    
    // Show alert details
    this.showAlertDetails(alertData);
  }

  // Location services for safety
  async requestLocationPermission() {
    if ('geolocation' in navigator) {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            console.log('Location permission granted');
            this.lastKnownLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              timestamp: Date.now()
            };
            resolve(true);
          },
          (error) => {
            console.error('Location permission denied:', error);
            resolve(false);
          },
          { 
            enableHighAccuracy: true, 
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
          }
        );
      });
    }
    return false;
  }

  // Get current location for safety purposes
  async getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: Date.now()
          };
          this.lastKnownLocation = location;
          resolve(location);
        },
        (error) => {
          // Return last known location if available
          if (this.lastKnownLocation) {
            console.warn('Using last known location due to error:', error);
            resolve(this.lastKnownLocation);
          } else {
            reject(error);
          }
        },
        { 
          enableHighAccuracy: true, 
          timeout: 8000,
          maximumAge: 60000 // 1 minute
        }
      );
    });
  }

  // Safety data management
  storeSafetyAlert(alertData) {
    const safetyAlert = {
      ...alertData,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      stored: Date.now(),
      synced: false
    };
    
    this.pendingSafetyData.push(safetyAlert);
    this.savePendingSafetyData();
  }

  loadPendingSafetyData() {
    const stored = localStorage.getItem('pendingSafetyData');
    if (stored) {
      try {
        this.pendingSafetyData = JSON.parse(stored);
      } catch (error) {
        console.error('Failed to load pending safety data:', error);
        this.pendingSafetyData = [];
      }
    }
  }

  savePendingSafetyData() {
    try {
      localStorage.setItem('pendingSafetyData', JSON.stringify(this.pendingSafetyData));
    } catch (error) {
      console.error('Failed to save pending safety data:', error);
    }
  }

  clearSyncedSafetyData() {
    this.pendingSafetyData = this.pendingSafetyData.filter(item => !item.synced);
    this.savePendingSafetyData();
  }

// Enhanced PWA Utilities - Part 3: Network Handling & Sync

  // Enhanced online status handling
  handleOnlineStatus() {
    console.log('App is online');
    this.hideOfflineIndicator();
    this.syncPendingData();
    this.enableOnlineFeatures();
    this.retryAttempts = 0; // Reset retry counter
  }

  // Enhanced offline status handling
  handleOfflineStatus() {
    console.log('App is offline');
    this.showOfflineIndicator();
    this.disableOnlineFeatures();
    this.enableOfflineMode();
  }

  enableOfflineMode() {
    // Enable offline-capable features
    const offlineElements = document.querySelectorAll('[data-offline-capable]');
    offlineElements.forEach(element => {
      element.classList.add('offline-mode');
    });
    
    // Show offline guidance
    this.showOfflineGuidance();
  }

  showOfflineGuidance() {
    const guidance = document.createElement('div');
    guidance.id = 'offline-guidance';
    guidance.innerHTML = `
      <div style="
        position: fixed;
        bottom: 80px;
        left: 20px;
        right: 20px;
        background: #1f2937;
        color: white;
        padding: 16px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 9998;
      ">
        📱 <strong>Offline Mode:</strong> Emergency features remain active. Your data will sync when connection returns.
        <button onclick="this.parentElement.remove()" style="
          float: right;
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          font-size: 16px;
        ">×</button>
      </div>
    `;
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      const element = document.getElementById('offline-guidance');
      if (element) element.remove();
    }, 10000);
    
    document.body.appendChild(guidance);
  }

  // Enhanced offline indicator
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
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        ">
          📱 You're offline. Emergency features remain active.
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
    
    const guidance = document.getElementById('offline-guidance');
    if (guidance) {
      guidance.remove();
    }
  }

  // Enhanced data sync with retry logic
  async syncPendingData() {
    if (!this.isOnline) return;

    try {
      // Sync safety data first (highest priority)
      await this.syncSafetyData();
      
      // Background sync registration
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('background-sync-safety');
        await registration.sync.register('background-sync-messages');
        await registration.sync.register('background-sync-alerts');
        console.log('Background sync registered');
      }
      
      this.retryAttempts = 0;
    } catch (error) {
      console.error('Data sync failed:', error);
      this.handleSyncFailure();
    }
  }

  // Sync safety data with retry logic
  async syncSafetyData() {
    const pendingData = this.pendingSafetyData.filter(item => !item.synced);
    
    if (pendingData.length === 0) return;

    try {
      const response = await fetch('/api/safety/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          data: pendingData,
          timestamp: Date.now(),
          emergencyMode: this.emergencyMode
        })
      });

      if (response.ok) {
        // Mark as synced
        pendingData.forEach(item => item.synced = true);
        this.clearSyncedSafetyData();
        console.log(`Synced ${pendingData.length} safety records`);
      } else {
        throw new Error(`Sync failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Safety data sync failed:', error);
      this.handleSyncFailure();
    }
  }

  handleSyncFailure() {
    this.retryAttempts++;
    
    if (this.retryAttempts < this.maxRetries) {
      // Exponential backoff
      const delay = Math.pow(2, this.retryAttempts) * 1000;
      setTimeout(() => this.syncPendingData(), delay);
    } else {
      console.error('Max sync retries reached');
      this.showSyncFailureNotification();
    }
  }

  showSyncFailureNotification() {
    const notification = document.createElement('div');
    notification.innerHTML = `
      <div style="
        position: fixed;
        bottom: 20px;
        left: 20px;
        right: 20px;
        background: #dc2626;
        color: white;
        padding: 16px;
        border-radius: 8px;
        z-index: 9999;
      ">
        ⚠️ Unable to sync safety data. Your information is stored locally and will sync when connection improves.
        <button onclick="this.parentElement.remove()" style="
          float: right;
          background: none;
          border: none;
          color: white;
          cursor: pointer;
        ">×</button>
      </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 10000);
  }

  // Force sync for emergency data
  async forceSyncEmergencyData() {
    if (!this.isOnline) {
      console.log('Cannot force sync while offline - data queued');
      return;
    }

    const emergencyData = this.pendingSafetyData.filter(item => 
      !item.synced && (item.level === 'critical' || item.type === 'emergency')
    );

    if (emergencyData.length === 0) return;

    try {
      const response = await fetch('/api/safety/emergency-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Emergency-Mode': 'true'
        },
        body: JSON.stringify({
          data: emergencyData,
          timestamp: Date.now(),
          location: this.lastKnownLocation
        })
      });

      if (response.ok) {
        emergencyData.forEach(item => item.synced = true);
        this.clearSyncedSafetyData();
        console.log('Emergency data synced successfully');
      }
    } catch (error) {
      console.error('Emergency sync failed:', error);
    }
  }

// Enhanced PWA Utilities - Part 4: Final Utilities & Export

  // App lifecycle events
  onAppBackground() {
    console.log('App moved to background');
    this.startBackgroundMonitoring();
  }

  onAppForeground() {
    console.log('App moved to foreground');
    this.stopBackgroundMonitoring();
    this.syncPendingData();
  }

  startBackgroundMonitoring() {
    // Enable background safety monitoring
    this.backgroundMode = true;
  }

  stopBackgroundMonitoring() {
    this.backgroundMode = false;
  }

  startSafetyMonitoring() {
    // Start periodic safety checks
    this.safetyInterval = setInterval(() => {
      this.performSafetyCheck();
    }, 30000); // Every 30 seconds
  }

  performSafetyCheck() {
    // Perform safety-related checks
    if (this.emergencyMode) {
      this.checkEmergencyStatus();
    }
  }

  checkEmergencyStatus() {
    // Check if emergency mode should be maintained
    console.log('Performing emergency status check');
  }

  // Enhanced notification permission with explanation
  async requestNotificationPermission() {
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        // Show explanation before requesting
        this.showNotificationExplanation();
        
        const permission = await Notification.requestPermission();
        console.log('Notification permission:', permission);
        return permission === 'granted';
      }
      return Notification.permission === 'granted';
    }
    return false;
  }

  showNotificationExplanation() {
    // This would typically be a modal or inline explanation
    console.log('Notifications help keep your family safe by alerting you to important safety events');
  }

  // Utility methods
  getAuthToken() {
    return localStorage.getItem('authToken') || '';
  }

  handleServiceWorkerMessage(data) {
    switch (data.type) {
      case 'SAFETY_ALERT':
        this.handleIncomingSafetyAlert(data.payload);
        break;
      case 'SYNC_COMPLETE':
        console.log('Background sync completed');
        break;
      case 'EMERGENCY_MODE':
        this.enableEmergencyMode();
        break;
      default:
        console.log('Unknown SW message:', data);
    }
  }

  handleIncomingSafetyAlert(alertData) {
    this.sendSafetyAlert(alertData);
    if (alertData.level === 'critical') {
      this.enableEmergencyMode();
    }
  }

  // Enable/disable features based on network
  enableOnlineFeatures() {
    const onlineElements = document.querySelectorAll('[data-requires-online]');
    onlineElements.forEach(element => {
      element.disabled = false;
      element.style.opacity = '1';
      element.classList.remove('offline-disabled');
    });
  }

  disableOnlineFeatures() {
    const onlineElements = document.querySelectorAll('[data-requires-online]');
    onlineElements.forEach(element => {
      if (!this.emergencyMode) { // Don't disable in emergency mode
        element.disabled = true;
        element.style.opacity = '0.5';
        element.classList.add('offline-disabled');
      }
    });
  }

  // Install functionality
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

  checkIfInstalled() {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      this.isInstalled = true;
      return true;
    }

    if (window.navigator.standalone === true) {
      this.isInstalled = true;
      return true;
    }

    return false;
  }

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
        <p style="margin: 0 0 10px 0;">🔄 Safety app update available!</p>
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

  // Analytics
  trackInstallation() {
    console.log('Tracking: Safety app installed');
  }

  trackInstallAccepted() {
    console.log('Tracking: Install accepted');
  }

  trackInstallDismissed() {
    console.log('Tracking: Install dismissed');
  }

  // Cleanup
  destroy() {
    if (this.safetyInterval) {
      clearInterval(this.safetyInterval);
    }
    clearTimeout(this.networkStatusDebounce);
  }
}

// Initialize PWA Manager
const pwaManager = new PWAManager();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    pwaManager.registerServiceWorker().catch(console.error);
  });
} else {
  pwaManager.registerServiceWorker().catch(console.error);
}

// Export for use in other modules
export default pwaManager;
