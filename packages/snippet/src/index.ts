import type {
  CreateBugPayload,
  BugSeverity,
  Viewport,
  ConsoleLog,
  NetworkError,
} from './types';

// Global configuration
interface BuggerConfig {
  publicKey: string;
  origin: string;
  color: string;
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

// Telemetry buffers
class TelemetryBuffer {
  private consoleLogs: ConsoleLog[] = [];
  private networkErrors: NetworkError[] = [];
  private maxSize = 20;

  addConsoleLog(level: 'log' | 'warn' | 'error', message: string) {
    this.consoleLogs.push({
      level,
      message: String(message),
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 20 entries
    if (this.consoleLogs.length > this.maxSize) {
      this.consoleLogs = this.consoleLogs.slice(-this.maxSize);
    }
  }

  addNetworkError(url: string, status?: number, method?: string) {
    this.networkErrors.push({
      url,
      status,
      method,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 20 entries
    if (this.networkErrors.length > this.maxSize) {
      this.networkErrors = this.networkErrors.slice(-this.maxSize);
    }
  }

  getConsoleLogs(): ConsoleLog[] {
    return [...this.consoleLogs];
  }

  getNetworkErrors(): NetworkError[] {
    return [...this.networkErrors];
  }

  clear() {
    this.consoleLogs = [];
    this.networkErrors = [];
  }
}

// Toast notification system
class ToastManager {
  private container: HTMLElement;

  constructor() {
    this.container = this.createContainer();
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10002;
      pointer-events: none;
    `;
    document.body.appendChild(container);
    return container;
  }

  show(message: string, type: 'success' | 'error' = 'success') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      background: ${type === 'success' ? '#10b981' : '#ef4444'};
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      margin-bottom: 8px;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      pointer-events: auto;
      animation: slideIn 0.3s ease-out;
    `;
    
    toast.textContent = message;
    this.container.appendChild(toast);

    // Auto remove after 4 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      }
    }, 4000);
  }
}

// Main Bugger class
class Bugger {
  private config: BuggerConfig;
  private telemetry: TelemetryBuffer;
  private toastManager: ToastManager;
  private button: HTMLElement | null = null;
  private modal: HTMLElement | null = null;
  private isModalOpen = false;
  private isInitialized = false;

  constructor(config: BuggerConfig) {
    this.config = config;
    this.telemetry = new TelemetryBuffer();
    this.toastManager = new ToastManager();
    
    this.setupConsolePatching();
    this.setupNetworkPatching();
    this.addStyles();
  }

  init(): void {
    if (this.isInitialized) return;
    
    this.createFloatingButton();
    this.createModal();
    this.isInitialized = true;
  }

  updateConfig(newConfig: Partial<BuggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.button) {
      this.updateButtonStyles();
    }
  }

  private addStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  private setupConsolePatching(): void {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = (...args) => {
      this.telemetry.addConsoleLog('log', args.join(' '));
      originalLog.apply(console, args);
    };

    console.warn = (...args) => {
      this.telemetry.addConsoleLog('warn', args.join(' '));
      originalWarn.apply(console, args);
    };

    console.error = (...args) => {
      this.telemetry.addConsoleLog('error', args.join(' '));
      originalError.apply(console, args);
    };
  }

  private setupNetworkPatching(): void {
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        
        if (response.status >= 400) {
          const url = typeof args[0] === 'string' ? args[0] : args[0].url;
          const method = args[1]?.method || 'GET';
          this.telemetry.addNetworkError(url, response.status, method);
        }
        
        return response;
      } catch (error) {
        const url = typeof args[0] === 'string' ? args[0] : args[0].url;
        this.telemetry.addNetworkError(url);
        throw error;
      }
    };

    // Patch XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...args: any[]) {
      (this as any)._buggerMethod = method;
      (this as any)._buggerUrl = url.toString();
      return originalXHROpen.call(this, method, url, ...args);
    };

    XMLHttpRequest.prototype.send = function(...args: any[]) {
      const xhr = this;
      
      xhr.addEventListener('error', () => {
        this.telemetry.addNetworkError((xhr as any)._buggerUrl, undefined, (xhr as any)._buggerMethod);
      });
      
      xhr.addEventListener('load', () => {
        if (xhr.status >= 400) {
          this.telemetry.addNetworkError((xhr as any)._buggerUrl, xhr.status, (xhr as any)._buggerMethod);
        }
      });
      
      return originalXHRSend.apply(xhr, args);
    };
  }

  private createFloatingButton(): void {
    this.button = document.createElement('button');
    this.button.innerHTML = '🐛';
    this.button.setAttribute('aria-label', 'Report a bug');
    this.updateButtonStyles();
    
    this.button.addEventListener('click', () => this.openModal());
    this.makeDraggable(this.button);
    
    document.body.appendChild(this.button);
  }

  private updateButtonStyles(): void {
    if (!this.button) return;
    
    const position = this.config.position || 'bottom-right';
    const color = this.config.color || '#4f46e5';
    
    this.button.style.cssText = `
      position: fixed;
      ${position.includes('bottom') ? 'bottom' : 'top'}: 20px;
      ${position.includes('right') ? 'right' : 'left'}: 20px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: none;
      background-color: ${color};
      color: white;
      font-size: 24px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      transition: transform 0.2s ease;
      user-select: none;
    `;

    this.button.addEventListener('mouseenter', () => {
      if (this.button) {
        this.button.style.transform = 'scale(1.1)';
      }
    });

    this.button.addEventListener('mouseleave', () => {
      if (this.button) {
        this.button.style.transform = 'scale(1)';
      }
    });
  }

  private makeDraggable(element: HTMLElement): void {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    element.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = element.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      
      element.style.transition = 'none';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      let newLeft = startLeft + deltaX;
      let newTop = startTop + deltaY;
      
      // Constrain to viewport
      const maxLeft = window.innerWidth - element.offsetWidth;
      const maxTop = window.innerHeight - element.offsetHeight;
      
      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop = Math.max(0, Math.min(newTop, maxTop));
      
      element.style.left = `${newLeft}px`;
      element.style.top = `${newTop}px`;
      element.style.right = 'auto';
      element.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        element.style.transition = 'transform 0.2s ease';
        document.body.style.userSelect = '';
      }
    });
  }

  private createModal(): void {
    this.modal = document.createElement('div');
    this.modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      z-index: 10001;
      display: none;
      justify-content: center;
      align-items: center;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: white;
      padding: 24px;
      border-radius: 8px;
      width: 90%;
      max-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    modalContent.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="margin: 0; color: #333; font-size: 20px; font-weight: 600;">Report a Bug</h2>
        <button id="close-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">&times;</button>
      </div>
      <form id="bug-report-form">
        <div style="margin-bottom: 16px;">
          <label for="title" style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151;">Title *</label>
          <input type="text" id="title" name="title" required 
                 style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; box-sizing: border-box; font-size: 14px;">
        </div>
        <div style="margin-bottom: 16px;">
          <label for="steps" style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151;">Steps to reproduce *</label>
          <textarea id="steps" name="steps" rows="3" required
                    style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; box-sizing: border-box; resize: vertical; font-size: 14px;"></textarea>
        </div>
        <div style="margin-bottom: 16px;">
          <label for="expected" style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151;">Expected behavior *</label>
          <textarea id="expected" name="expected" rows="2" required
                    style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; box-sizing: border-box; resize: vertical; font-size: 14px;"></textarea>
        </div>
        <div style="margin-bottom: 16px;">
          <label for="actual" style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151;">Actual behavior *</label>
          <textarea id="actual" name="actual" rows="2" required
                    style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; box-sizing: border-box; resize: vertical; font-size: 14px;"></textarea>
        </div>
        <div style="margin-bottom: 20px;">
          <label for="severity" style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151;">Severity *</label>
          <select id="severity" name="severity" required
                  style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; box-sizing: border-box; font-size: 14px;">
            <option value="low">Low</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button type="button" id="cancel-report" style="padding: 10px 20px; border: 1px solid #d1d5db; background: white; border-radius: 6px; cursor: pointer; font-size: 14px;">Cancel</button>
          <button type="submit" style="padding: 10px 20px; background: ${this.config.color}; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">Submit</button>
        </div>
      </form>
    `;

    this.modal.appendChild(modalContent);
    document.body.appendChild(this.modal);
    this.attachModalEventListeners();
  }

  private attachModalEventListeners(): void {
    if (!this.modal) return;

    const closeBtn = this.modal.querySelector('#close-modal');
    const cancelBtn = this.modal.querySelector('#cancel-report');
    const form = this.modal.querySelector('#bug-report-form') as HTMLFormElement;

    closeBtn?.addEventListener('click', () => this.closeModal());
    cancelBtn?.addEventListener('click', () => this.closeModal());

    // Close on backdrop click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.closeModal();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isModalOpen) {
        this.closeModal();
      }
    });

    // Submit form
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitBugReport(form);
    });
  }

  private openModal(): void {
    if (this.modal) {
      this.modal.style.display = 'flex';
      this.isModalOpen = true;
      document.body.style.overflow = 'hidden';
      
      // Focus first input
      const firstInput = this.modal.querySelector('input') as HTMLInputElement;
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
      }
    }
  }

  private closeModal(): void {
    if (this.modal) {
      this.modal.style.display = 'none';
      this.isModalOpen = false;
      document.body.style.overflow = '';
      
      // Reset form
      const form = this.modal.querySelector('#bug-report-form') as HTMLFormElement;
      form?.reset();
    }
  }

  private async submitBugReport(form: HTMLFormElement): Promise<void> {
    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    const originalText = submitBtn.textContent;
    
    try {
      submitBtn.textContent = 'Submitting...';
      submitBtn.disabled = true;

      const formData = new FormData(form);
      
      // Collect telemetry
      const viewport: Viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      };

      const payload: CreateBugPayload = {
        title: formData.get('title') as string,
        steps: formData.get('steps') as string,
        expected: formData.get('expected') as string,
        actual: formData.get('actual') as string,
        severity: formData.get('severity') as BugSeverity,
        url: window.location.href,
        userAgent: navigator.userAgent,
        viewport,
        consoleLogs: this.telemetry.getConsoleLogs(),
        networkErrors: this.telemetry.getNetworkErrors(),
        projectPublicKey: this.config.publicKey
      };

      // Try to capture screenshot (optional)
      try {
        const screenshot = await this.captureScreenshot();
        if (screenshot) {
          payload.screenshotDataUrl = screenshot;
        }
      } catch (error) {
        // Screenshot failed, continue without it
        console.warn('Screenshot capture failed:', error);
      }

      const response = await fetch(`${this.config.origin}/api/bugs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bugger-key': 'secret_demo_key' // Demo only - in production this would be handled differently
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        this.toastManager.show(`Bug sent. ID: ${result.id}`, 'success');
        this.closeModal();
        this.telemetry.clear(); // Clear buffers after successful submit
      } else {
        const error = await response.json();
        this.toastManager.show(`Failed to send bug: ${error.error}`, 'error');
      }
    } catch (error) {
      console.error('Error submitting bug report:', error);
      this.toastManager.show('Failed to send bug report. Please try again.', 'error');
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  }

  private async captureScreenshot(): Promise<string | null> {
    try {
      // Dynamically load html2canvas
      const html2canvas = await this.loadHtml2Canvas();
      if (!html2canvas) return null;

      const canvas = await html2canvas(document.body, {
        height: window.innerHeight,
        width: window.innerWidth,
        useCORS: true,
        allowTaint: true,
        scale: 0.5 // Reduce size
      });

      return canvas.toDataURL('image/jpeg', 0.8);
    } catch (error) {
      console.warn('Screenshot capture failed:', error);
      return null;
    }
  }

  private async loadHtml2Canvas(): Promise<any> {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      script.onload = () => {
        resolve((window as any).html2canvas);
      };
      script.onerror = () => {
        resolve(null);
      };
      document.head.appendChild(script);
    });
  }
}

// Auto-initialization from script tag attributes
function autoInit(): void {
  const script = document.querySelector('script[data-bugger-key]') as HTMLScriptElement;
  if (!script) return;

  const publicKey = script.getAttribute('data-bugger-key');
  const origin = script.getAttribute('data-bugger-origin') || window.location.origin;
  const color = script.getAttribute('data-bugger-color') || '#4f46e5';
  const position = (script.getAttribute('data-bugger-position') || 'bottom-right') as any;

  if (!publicKey) {
    console.error('Bugger: data-bugger-key is required');
    return;
  }

  const config: BuggerConfig = {
    publicKey,
    origin,
    color,
    position
  };

  const bugger = new Bugger(config);
  bugger.init();

  // Make it globally available
  (window as any).Bugger = {
    init: (newConfig?: Partial<BuggerConfig>) => {
      if (newConfig) {
        bugger.updateConfig(newConfig);
      }
    }
  };
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoInit);
} else {
  autoInit();
}

// Export for manual initialization
(window as any).Bugger = {
  init: (config: Partial<BuggerConfig> & { publicKey: string }) => {
    const fullConfig: BuggerConfig = {
      publicKey: config.publicKey,
      origin: config.origin || window.location.origin,
      color: config.color || '#4f46e5',
      position: config.position || 'bottom-right'
    };

    const bugger = new Bugger(fullConfig);
    bugger.init();
  }
};