export class UIManager {
    constructor(onSearch, onApiKey) {
        this.onSearch = onSearch;
        this.onApiKey = onApiKey;
        this.searchCanvas = null;
    }

    setup() {
        // Setup API Key UI
        const apiInput = document.getElementById('api-key-input');
        const validateBtn = document.getElementById('validate-key-btn');
        const enterBtn = document.getElementById('enter-museum-btn');
        const blocker = document.getElementById('blocker');
        const instructions = document.getElementById('instructions');
        const apiStatus = document.getElementById('api-status');

        if (validateBtn && apiInput) {
            // Stop propagation on input click to prevent entering app
            apiInput.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            validateBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent entering app
                const key = apiInput.value.trim();
                if (key) {
                    if (this.onApiKey) {
                        this.onApiKey(key);
                    }
                    if (apiStatus) {
                        apiStatus.textContent = "Key set!";
                        apiStatus.style.color = "lightgreen";
                    }
                    if (enterBtn) {
                        enterBtn.disabled = false;
                        enterBtn.style.opacity = "1";
                        enterBtn.style.cursor = "pointer";
                    }
                } else {
                    if (apiStatus) {
                        apiStatus.textContent = "Please enter a key";
                        apiStatus.style.color = "red";
                    }
                }
            });
        }

        if (enterBtn) {
            enterBtn.addEventListener('click', () => {
                if (blocker) blocker.style.display = 'none';
                this.requestPointerLock();
            });
        }

        // Setup overlay search
        const overlaySubmit = document.getElementById('search-overlay-submit');
        const overlayInput = document.getElementById('search-input-field');
        const overlayClose = document.getElementById('search-overlay-close');
        const overlay = document.getElementById('search-overlay');
        
        // Stop clicks on overlay from propagating to the world
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
        
        if (overlaySubmit && overlayInput) {
            const submitSearch = () => {
                const country = overlayInput.value;
                if (country) {
                    if (this.onSearch) {
                        this.onSearch(country);
                    }
                    overlayInput.value = '';
                    if (overlay) overlay.style.display = 'none';
                    // Re-request pointer lock
                    this.requestPointerLock();
                }
            };
            
            overlaySubmit.addEventListener('click', (e) => {
                e.stopPropagation();
                submitSearch();
            });
            overlayInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') submitSearch();
            });
        }
        
        if (overlayClose && overlay) {
            overlayClose.addEventListener('click', (e) => {
                e.stopPropagation();
                overlay.style.display = 'none';
                overlayInput.value = '';
                // Re-request pointer lock
                this.requestPointerLock();
            });
        }
    }

    requestPointerLock() {
        document.body.requestPointerLock = document.body.requestPointerLock || 
                                          document.body.mozRequestPointerLock || 
                                          document.body.webkitRequestPointerLock;
        document.body.requestPointerLock();
    }

    activateSearchInput() {
        // Show overlay input immediately (before exiting pointer lock)
        const overlay = document.getElementById('search-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
        }
        
        // Exit pointer lock to show cursor
        document.exitPointerLock();
        
        // Focus input after a short delay
        const input = document.getElementById('search-input-field');
        if (input) {
            setTimeout(() => input.focus(), 100);
        }
    }

    setLoading(visible) {
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            if (visible) {
                loadingIndicator.classList.add('visible');
            } else {
                loadingIndicator.classList.remove('visible');
            }
        }
    }

    isOverlayVisible() {
        const overlay = document.getElementById('search-overlay');
        return overlay && overlay.style.display === 'flex';
    }

    createSearchCanvas() {
        this.searchCanvas = document.createElement('canvas');
        this.searchCanvas.width = 1024;
        this.searchCanvas.height = 512;
        
        this.drawSearchCanvas();
        
        return this.searchCanvas;
    }
    
    drawSearchCanvas() {
        if (!this.searchCanvas) return;
        const ctx = this.searchCanvas.getContext('2d');
        
        // Background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, this.searchCanvas.width, this.searchCanvas.height);
        
        // Title
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('LANDMARK SEARCH', this.searchCanvas.width / 2, 80);
        
        // Subtitle
        ctx.font = '24px Arial';
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText('Click here to search for a country', this.searchCanvas.width / 2, 130);
        
        // Search box visual
        const boxX = this.searchCanvas.width / 2 - 300;
        const boxY = 180;
        const boxWidth = 600;
        const boxHeight = 80;
        
        // Search box background
        ctx.fillStyle = '#2a2a2a';
        ctx.strokeStyle = '#555555';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 10);
        ctx.fill();
        ctx.stroke();
        
        // Placeholder text
        ctx.fillStyle = '#888888';
        ctx.font = '32px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('Enter a country name...', boxX + 30, boxY + 52);
        
        // Search icon
        ctx.strokeStyle = '#888888';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(boxX + boxWidth - 60, boxY + 40, 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(boxX + boxWidth - 45, boxY + 55);
        ctx.lineTo(boxX + boxWidth - 35, boxY + 65);
        ctx.stroke();
        
        // Instructions
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Walk up and click to activate search', this.searchCanvas.width / 2, 350);
        
        // Decorative border
        ctx.strokeStyle = '#b8860B';
        ctx.lineWidth = 8;
        ctx.strokeRect(20, 20, this.searchCanvas.width - 40, this.searchCanvas.height - 40);
    }
}
