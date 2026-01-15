import { icons } from './icons.js';
import { loginWithGoogle, logout } from './firebase/auth.js';
import { store } from './store.js';
import { openImportModal } from './components/ImportModal.js';
import { Modal } from './components/Modal.js';
import { generateReport } from './services/reportGenerator.js';

export function renderSettings(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const state = store.getState();
  const user = state.user;
  const isDarkMode = document.documentElement.classList.contains('dark-mode');

  container.innerHTML = `
    <div style="max-width: 600px; margin: 0 auto;">
      
      <!-- Account Section -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <div class="card-header">
          <span class="card-title">Conta</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 1rem; align-items: flex-start;">
            ${user ? `
                <div style="display: flex; align-items: center; gap: 1rem;">
                    ${user.photo ? `<img src="${user.photo}" style="width: 48px; height: 48px; border-radius: 50%;">` : ''}
                    <div>
                        <div style="font-weight: 600; font-size: 1rem;">${user.name}</div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">${user.email}</div>
                    </div>
                </div>
                <button class="btn" id="btnLogout" style="border: 1px solid var(--danger-color); color: var(--danger-color); width: auto; align-self: flex-start; padding: 0.5rem 1rem; font-size: 0.9rem;">
                    Sair
                </button>
            ` : `
               <p style="color: var(--text-secondary); font-size: 0.9rem;">
                 Faça login para sincronizar seus dados em todos os dispositivos.
               </p>
               <button id="btnLogin" class="btn btn-primary" style="background-color: #fff; color: #757575; border: 1px solid #ddd; display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-radius: 4px; font-family: 'Roboto', sans-serif; font-weight: 500; cursor: pointer;">
                 <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18" alt="G">
                 <span>Entrar com Google</span>
               </button>
            `}
        </div>
      </div>

      <!-- Preferences Section -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <div class="card-header">
          <span class="card-title">Preferências</span>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0;">
           <div>
             <div style="font-weight: 500;">Modo Escuro</div>
             <div style="font-size: 0.8rem; color: var(--text-secondary);">Alterar aparência do aplicativo</div>
           </div>
           
           <label class="switch">
             <input type="checkbox" id="darkModeToggle" ${isDarkMode ? 'checked' : ''}>
             <span class="slider round"></span>
           </label>
        </div>
      </div>

      <!-- Emergency Reserve Section -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <div class="card-header">
          <span class="card-title">Reserva de Emergência</span>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0;">
           <div>
             <div style="font-weight: 500;">Incluir Tesouro Selic</div>
             <div style="font-size: 0.8rem; color: var(--text-secondary);">Contabilizar títulos Selic no patrimônio da reserva</div>
           </div>
           
           <label class="switch">
             <input type="checkbox" id="toggleSelicReserve" ${state.reserveSettings.includeSelic ? 'checked' : ''}>
             <span class="slider round"></span>
           </label>
        </div>
      </div>

      <!-- Data Section -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <div class="card-header">
          <span class="card-title">Dados</span>
        </div>
        
        <div style="margin-bottom: 1.5rem;">
          <div style="font-weight: 500; margin-bottom: 0.5rem; color: var(--text-primary);">Integrações</div>
          
           <div style="margin-bottom: 1rem;">
             <label style="display: block; font-size: 0.9rem; margin-bottom: 4px; color: var(--text-secondary);">URL da Planilha (CSV)</label>
             <div style="display: flex; gap: 8px;">
                 <input type="text" id="inp-sheet-url" class="form-input" placeholder="https://docs.google.com/.../pub?output=csv" value="${(user && user.settings && user.settings.sheetCsvUrl) || localStorage.getItem('sheetCsvUrl') || ''}" style="flex: 1; font-size: 0.9rem;">
                 <button id="btn-save-sheet" class="btn btn-primary" style="padding: 0 1.5rem;">Salvar</button>
             </div>
             <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">
                Link público CSV da sua planilha Google para atualização automática de cotações.
             </p>
          </div>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <div style="font-weight: 500; margin-bottom: 0.5rem; color: var(--text-primary);">Relatórios</div>
          <button id="btn-export-report" class="btn btn-primary" style="width: 100%; justify-content: space-between; padding: 0.75rem 1rem;">
             <div style="display: flex; align-items: center;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                Baixar Relatório Completo (PDF)
             </div>
             <span style="font-size: 0.75rem; background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 12px; font-weight: 500;">Novo</span>
          </button>
        </div>

       <div style="border-top: 1px solid var(--border-color); padding-top: 1rem;">
           <div style="font-weight: 500; margin-bottom: 0.5rem; color: var(--text-primary);">Importar Dados</div>
           <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem; line-height: 1.5;">
             Importe seus ativos via planilha CSV. Suporta Renda Fixa (e em breve Renda Variável).
           </p>
           <button id="btnImportWizard" class="btn btn-primary" style="width: 100%; justify-content: center; padding: 0.75rem 1rem;">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;">
                 <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                 <polyline points="14 2 14 8 20 8"></polyline>
                 <line x1="12" y1="18" x2="12" y2="12"></line>
                 <line x1="9" y1="15" x2="15" y2="15"></line>
              </svg>
              Assistente de Importação
           </button>
        </div>
      </div>

      <!-- About Section -->
      <div style="text-align: center; margin-top: 2rem; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; color: var(--text-secondary); opacity: 0.8;">
          <div style="width: 32px; height: 32px; filter: grayscale(1); opacity: 0.5;">${icons.logo || ''}</div>
          <div style="font-weight: 500; font-size: 0.9rem;">Meus Investimentos</div>
          <div style="font-size: 0.8rem; font-family: monospace; opacity: 0.6;">v2.0.0</div>
      </div>
    </div>
  `;

  // Attach Event Listeners
  const btnLogin = document.getElementById('btnLogin');
  if (btnLogin) {
    btnLogin.addEventListener('click', async () => {
      try {
        await loginWithGoogle();
        // Do NOT manually renderSettings here. 
        // The store subscription in main.js will trigger when Auth State changes.
      } catch (e) {
        console.error(e);
        alert('Erro ao fazer login. Verifique o console.');
      }
    });
  }

  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      await logout();
      // Store subscription handles re-render
    });
  }

  const toggle = document.getElementById('darkModeToggle');
  if (toggle) {
    toggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        document.documentElement.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light');
      }
    });
  }

  const toggleSelic = document.getElementById('toggleSelicReserve');
  if (toggleSelic) {
    toggleSelic.addEventListener('change', (e) => {
      store.updateReserveSettings({ includeSelic: e.target.checked });
    });
  }

  const btnImport = document.getElementById('btnImportWizard');
  if (btnImport) {
    console.log('Botão Importar encontrado. Adicionando listener.');
    btnImport.addEventListener('click', () => {
      console.log('Botão Importar clicado!');
      try {
        openImportModal();
      } catch (e) {
        console.error("Erro ao chamar openImportModal:", e);
        alert(e.message);
      }
    });
  } else {
    console.error('Botão Importar NÃO encontrado no DOM.');
  }

  const btnSaveSheet = document.getElementById('btn-save-sheet');
  const sheetInp = document.getElementById('inp-sheet-url');

  if (btnSaveSheet && sheetInp) {
    const modal = new Modal(); // Instantiate modal helper
    btnSaveSheet.addEventListener('click', () => {
      const url = sheetInp.value.trim();
      if (url) {
        // Updated to use Store -> Firestore
        store.updateSettings({ sheetCsvUrl: url });
        localStorage.setItem('sheetCsvUrl', url); // Keep local backup for now/offline? Optional.

        modal.open('Sucesso', `<p style="color: var(--success-color); font-weight: 500;">Link da planilha salvo com sucesso!</p><div style="margin-top:1rem; font-size: 0.9rem;">Agora você pode atualizar suas cotações na tela de Renda Variável.</div>`);
      } else {
        store.updateSettings({ sheetCsvUrl: '' });
        localStorage.removeItem('sheetCsvUrl');
        modal.open('Informação', `<p>Link removido.</p>`);
      }
    });
  }

  const btnExport = document.getElementById('btn-export-report');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      try {
        generateReport(store.getState());
      } catch (e) {
        console.error(e);
        alert('Erro ao gerar relatório: ' + e.message);
      }
    });
  }
}

