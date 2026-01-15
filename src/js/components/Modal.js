export class Modal {
    constructor() {
        this.createOverlay();
    }

    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';
        this.overlay.innerHTML = `
      <div class="modal-content">
        <header class="modal-header">
          <h2 class="modal-title"></h2>
          <button class="modal-close">&times;</button>
        </header>
        <div class="modal-body"></div>
      </div>
    `;

        document.body.appendChild(this.overlay);

        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });

        this.overlay.querySelector('.modal-close').addEventListener('click', () => this.close());
    }

    open(title, contentHTML) {
        if (!document.body.contains(this.overlay)) {
            document.body.appendChild(this.overlay);
        }

        this.overlay.querySelector('.modal-title').textContent = title;
        this.overlay.querySelector('.modal-body').innerHTML = contentHTML;

        this.overlay.classList.add('open');
    }

    close() {
        this.overlay.classList.remove('open');
        setTimeout(() => {
            if (this.overlay && this.overlay.parentNode) {
                this.overlay.parentNode.removeChild(this.overlay);
            }
        }, 300);
    }
}
