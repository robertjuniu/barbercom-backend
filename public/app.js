const dialog = document.querySelector('[data-dialog-return]');
for (const form of document.querySelectorAll('[data-photo-form]')) {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const file = form.querySelector('input[type=file]').files[0];
    const status = form.querySelector('[data-photo-status]');
    const button = form.querySelector('button');
    if (!file || !['image/jpeg', 'image/png'].includes(file.type) || file.size > 2097152) {
      status.textContent = 'Escolha uma foto JPEG ou PNG de até 2 MB.'; return;
    }
    button.disabled = true;
    try {
      const response = await fetch(form.action, { method: 'POST', headers: { 'Content-Type': file.type, 'X-CSRF-Token': form.elements._csrf.value }, body: file });
      const result = await response.json();
      if (!response.ok) throw new Error(result.erro);
      window.location.reload();
    } catch (error) { status.textContent = error.message; button.disabled = false; }
  });
}
if (dialog) {
  dialog.showModal();
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    window.location.assign(dialog.dataset.dialogReturn);
  });
}
for (const image of document.querySelectorAll('.avatar img')) {
  image.addEventListener('error', () => { image.hidden = true; });
}
for (const option of document.querySelectorAll('[data-offer-option]')) {
  const update = () => {
    const fields = option.closest('.offer-option').querySelector('.offer-values');
    fields.hidden = !option.checked;
    for (const input of fields.querySelectorAll('input')) {
      input.disabled = !option.checked;
      input.required = option.checked;
    }
  };
  option.addEventListener('change', update);
  update();
}

const actionStatus = document.querySelector('[data-action-status]');
for (const option of document.querySelectorAll('[data-full-day]')) {
  const update = () => {
    const fields = option.closest('form').querySelector('[data-time-fields]');
    fields.hidden = option.checked;
    for (const input of fields.querySelectorAll('input')) {
      input.disabled = option.checked;
      input.required = !option.checked;
    }
  };
  option.addEventListener('change', update);
  update();
}
let statusTimer;
for (const form of document.querySelectorAll('[data-toggle-form]')) {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button');
    if (button.disabled) return;
    const card = form.closest('article');
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    clearTimeout(statusTimer);
    actionStatus.textContent = '';
    actionStatus.hidden = true;
    try {
      const response = await fetch(form.action, {
        method: 'POST', headers: { Accept: 'application/json' },
        body: new URLSearchParams(new FormData(form))
      });
      if (response.redirected && new URL(response.url).pathname === '/login') {
        window.location.assign('/login');
        return;
      }
      if (!response.ok) throw new Error('Não foi possível confirmar a alteração. Recarregue para conferir.');
      const result = await response.json();
      if (typeof result.ativo !== 'boolean') throw new Error('Resposta inesperada. Recarregue a página.');
      const badge = card.querySelector('.badge');
      badge.classList.toggle('active', result.ativo);
      badge.classList.toggle('inactive', !result.ativo);
      badge.textContent = `● ${result.ativo ? form.dataset.activeLabel : form.dataset.inactiveLabel}`;
      button.classList.toggle('danger', result.ativo);
      button.classList.toggle('reactivate', !result.ativo);
      const action = result.ativo ? 'Inativar' : 'Reativar';
      button.querySelector('[data-toggle-label]').textContent = action;
      button.setAttribute('aria-label', `${action} ${card.querySelector('h2').textContent.trim()}`);
      button.setAttribute('aria-pressed', String(result.ativo));
      const field = form.elements.namedItem('ativa') ?? form.elements.namedItem('ativo');
      field.value = String(!result.ativo);
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        card.animate([{ transform: 'scale(1)' }, { transform: 'scale(.985)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-out' });
      }
      actionStatus.textContent = result.mensagem;
      actionStatus.className = 'action-toast success';
      statusTimer = setTimeout(() => { actionStatus.hidden = true; }, 2800);
    } catch (error) {
      actionStatus.textContent = error.message === 'Failed to fetch' ? 'Sem conexão. Recarregue para conferir a situação.' : error.message;
      actionStatus.className = 'action-toast error';
    } finally {
      actionStatus.hidden = !actionStatus.textContent;
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  });
}
