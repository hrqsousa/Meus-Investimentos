export class CustomSelect {
    constructor(containerId, options, onSelect, initialValue = null) {
        this.container = document.getElementById(containerId);
        this.options = options;
        this.onSelect = onSelect;
        this.value = initialValue;
        this.isOpen = false;
        this.boundClose = this.close.bind(this);

        this.render();
    }

    render() {
        const selectedOption = this.options.find(opt => opt.value === this.value);
        const label = selectedOption ? selectedOption.label : 'Selecione...';

        this.container.classList.add('custom-select');
        this.container.innerHTML = `
      <div class="select-trigger">
        <span>${label}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      <div class="select-options">
        ${this.options.map(opt => `
          <div class="select-option ${opt.value === this.value ? 'selected' : ''}" data-value="${opt.value}">${opt.label}</div>
        `).join('')}
      </div>
    `;

        this.trigger = this.container.querySelector('.select-trigger');
        this.optionsEl = this.container.querySelector('.select-options');
        this.triggerLabel = this.trigger.querySelector('span');

        this.trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        this.container.querySelectorAll('.select-option').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                this.select(el.dataset.value, el.textContent);
            });
        });

        document.addEventListener('click', this.boundClose);
    }

    toggle() {
        this.isOpen = !this.isOpen;
        this.container.classList.toggle('open', this.isOpen);
    }

    close() {
        this.isOpen = false;
        this.container.classList.remove('open');
    }

    select(value, label) {
        this.value = value;
        this.triggerLabel.textContent = label;
        this.close();
        if (this.onSelect) this.onSelect(value);

        this.container.querySelectorAll('.select-option').forEach(el => {
            el.classList.toggle('selected', el.dataset.value === value);
        });
    }

    getValue() {
        return this.value;
    }

    destroy() {
        document.removeEventListener('click', this.boundClose);
    }
}
