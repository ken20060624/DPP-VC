(() => {
  'use strict';

  const demoProduct = {
    id: 'https://dpp-demo.example.com/01/00047199990002/21/FAN-2026-001',
    gtin: '00047199990002',
    serialNumber: 'FAN-2026-001',
    productName: 'LaPO 迷你渦輪隨身風扇',
    modelNumber: 'LF-02',
    brand: 'LaPO',
    countryOfOrigin: 'TW',
    batteryComponent: {
      chemistry: 'Li-ion',
      capacityMah: 5100,
      voltageV: 3.7,
      energyWh: 18.87
    },
    environmentalMetrics: {
      carbonFootprintKgCO2e: 2.1,
      pcrPlasticPercentage: 25,
      recyclabilityPercentage: 88,
      rohsCompliant: true,
      reachCompliant: true
    }
  };

  const checkLabels = {
    proof: '數位簽章',
    proofPurpose: '簽章用途',
    issuerBinding: 'Issuer 綁定',
    time: '有效時間',
    statusListProof: '狀態清單簽章',
    credentialStatus: '撤銷狀態'
  };

  const state = {
    originalCredential: null,
    authorized: false,
    busy: false,
    toastTimer: null
  };

  const byId = id => document.getElementById(id);
  const allActionButtons = () => [...document.querySelectorAll('button')];

  function goToStep(step) {
    if(step === 2 && !state.authorized) {
      showToast('請先在第 1 頁驗證 Operator API Key。', true);
      return;
    }
    for(const page of document.querySelectorAll('.step-page')) {
      page.hidden = Number(page.dataset.page) !== step;
    }
    for(const button of document.querySelectorAll('.workflow-step')) {
      const active = Number(button.dataset.step) === step;
      button.classList.toggle('is-active', active);
      if(active) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    }
    window.scrollTo({top: 0, behavior: 'smooth'});
  }

  async function authorizeOperator() {
    await runBusy(async () => {
      await request('/api/v1/operator/authorize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey()}`,
          'Content-Type': 'application/json'
        },
        body: '{}'
      });
      state.authorized = true;
      addActivity('Operator API Key 授權通過。');
      showToast('授權通過，請填寫產品資料。');
      goToStep(2);
    });
  }

  function setValue(id, value) {
    byId(id).value = value;
  }

  function loadDemo() {
    const product = demoProduct;
    setValue('productId', product.id);
    setValue('gtin', product.gtin);
    setValue('serialNumber', product.serialNumber);
    setValue('productName', product.productName);
    setValue('brand', product.brand);
    setValue('modelNumber', product.modelNumber);
    setValue('countryOfOrigin', product.countryOfOrigin);
    setValue('chemistry', product.batteryComponent.chemistry);
    setValue('capacityMah', product.batteryComponent.capacityMah);
    setValue('voltageV', product.batteryComponent.voltageV);
    setValue('energyWh', product.batteryComponent.energyWh);
    setValue(
      'carbonFootprint',
      product.environmentalMetrics.carbonFootprintKgCO2e
    );
    setValue('pcrPlastic', product.environmentalMetrics.pcrPlasticPercentage);
    setValue(
      'recyclability',
      product.environmentalMetrics.recyclabilityPercentage
    );
    byId('rohsCompliant').checked = true;
    byId('reachCompliant').checked = true;
    addActivity('已載入 Demo 產品資料。');
  }

  function productFromForm() {
    if(!byId('productForm').reportValidity()) {
      throw new Error('請先修正產品資料欄位。');
    }
    return {
      id: byId('productId').value.trim(),
      gtin: byId('gtin').value.trim(),
      serialNumber: byId('serialNumber').value.trim(),
      productName: byId('productName').value.trim(),
      modelNumber: byId('modelNumber').value.trim(),
      brand: byId('brand').value.trim(),
      countryOfOrigin: byId('countryOfOrigin').value.trim().toUpperCase(),
      batteryComponent: {
        chemistry: byId('chemistry').value.trim(),
        capacityMah: Number(byId('capacityMah').value),
        voltageV: Number(byId('voltageV').value),
        energyWh: Number(byId('energyWh').value)
      },
      environmentalMetrics: {
        carbonFootprintKgCO2e: Number(byId('carbonFootprint').value),
        pcrPlasticPercentage: Number(byId('pcrPlastic').value),
        recyclabilityPercentage: Number(byId('recyclability').value),
        rohsCompliant: byId('rohsCompliant').checked,
        reachCompliant: byId('reachCompliant').checked
      }
    };
  }

  function apiKey() {
    const value = byId('apiKey').value;
    if(!value) {
      throw new Error('簽發或撤銷前，請輸入 Operator API Key。');
    }
    return value;
  }

  async function request(url, options = {}) {
    const response = await fetch(url, options);
    const text = await response.text();
    let body;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = {error: {message: text || `HTTP ${response.status}`}};
    }
    if(!response.ok) {
      const error = new Error(
        body.error?.message || body.message || `HTTP ${response.status}`
      );
      error.code = body.error?.code || `HTTP_${response.status}`;
      error.details = body.error?.details;
      throw error;
    }
    return body;
  }

  async function checkReadiness() {
    const element = byId('serviceStatus');
    element.className = 'service-status is-checking';
    element.lastElementChild.textContent = '正在連線';
    try {
      const ready = await request('/ready');
      element.className = 'service-status is-ready';
      element.lastElementChild.textContent = 'Issuer 已就緒';
      const facts = byId('issuerFacts').querySelectorAll('strong');
      facts[0].textContent = ready.issuer;
      facts[0].title = ready.issuer;
      facts[1].textContent = ready.didMethod;
      facts[2].textContent = ready.cryptosuite;
      addActivity(`服務就緒：${ready.didMethod} / ${ready.cryptosuite}`);
    } catch(error) {
      element.className = 'service-status is-error';
      element.lastElementChild.textContent = 'Issuer 未就緒';
      showToast(formatError(error), true);
    }
  }

  async function issueCredential() {
    await runBusy(async () => {
      const product = productFromForm();
      const result = await request('/api/v1/credentials/issue', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({product})
      });
      state.originalCredential = structuredClone(result.credential);
      writeCredential(result.credential);
      addActivity(`已簽發 ${result.credential.id}`);
      showToast('憑證已簽發；可在第 4 頁進行公開驗證。');
      goToStep(3);
    });
  }

  function credentialFromEditor() {
    const raw = byId('credentialJson').value.trim();
    if(!raw) {
      throw new Error('請先簽發或貼上 Credential JSON。');
    }
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error('Credential JSON 格式不正確。');
    }
  }

  async function verifyCredential() {
    const credential = credentialFromEditor();
    const result = await request('/api/v1/credentials/verify', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({credential})
    });
    renderVerification(result);
    addActivity(result.verified ? 'VC 驗證通過。' :
      `VC 驗證失敗：${(result.errors || []).join(', ')}`);
    return result;
  }

  async function verifyFromButton() {
    await runBusy(async () => {
      const result = await verifyCredential();
      showToast(result.verified ? '驗證通過。' : '驗證未通過，請查看檢查結果。',
        !result.verified);
    });
  }

  async function makeTamperedCopy() {
    await runBusy(async () => {
      const credential = credentialFromEditor();
      credential.credentialSubject.productName =
        `${credential.credentialSubject.productName}（已竄改）`;
      writeCredential(credential);
      addActivity('已修改簽章後的產品名稱，產生竄改副本。');
      showToast('已產生竄改副本；請到第 4 頁驗證。');
    });
  }

  function restoreOriginal() {
    if(!state.originalCredential) {
      showToast('目前沒有可還原的原始憑證。', true);
      return;
    }
    writeCredential(state.originalCredential);
    addActivity('已還原原始簽章 VC。');
    showToast('已還原原始憑證，可重新驗證。');
  }

  async function revokeCredential() {
    await runBusy(async () => {
      if(!state.originalCredential) {
        throw new Error('只能撤銷由本頁面簽發的原始憑證。');
      }
      const prefix = 'urn:uuid:';
      const credentialId = state.originalCredential.id;
      if(typeof credentialId !== 'string' || !credentialId.startsWith(prefix)) {
        throw new Error('Credential ID 不是可撤銷的 UUID。');
      }
      const id = credentialId.slice(prefix.length);
      const result = await request(`/api/v1/credentials/${encodeURIComponent(id)}/revoke`, {
        method: 'POST',
        headers: {'Authorization': `Bearer ${apiKey()}`}
      });
      writeCredential(state.originalCredential);
      addActivity(result.alreadyRevoked ? '憑證先前已撤銷。' : '已撤銷原始憑證。');
      showToast('撤銷狀態已寫入；請到第 4 頁重新驗證。');
    });
  }

  function renderVerification(result) {
    byId('resultEmpty').hidden = true;
    byId('verificationResult').hidden = false;
    const badge = byId('verificationBadge');
    badge.className = `verification-badge ${result.verified ? 'is-valid' : 'is-invalid'}`;
    badge.textContent = result.verified ? '✓ 驗證通過' : '× 驗證失敗';
    byId('credentialId').textContent = result.credentialId || '—';
    byId('credentialId').title = result.credentialId || '';
    byId('subjectId').textContent = result.subjectId || '—';
    byId('subjectId').title = result.subjectId || '';

    const checksGrid = byId('checksGrid');
    checksGrid.replaceChildren();
    for(const [key, label] of Object.entries(checkLabels)) {
      const status = result.checks?.[key] || 'not-run';
      const item = document.createElement('div');
      item.className = `check-item is-${status}`;
      const name = document.createElement('span');
      name.textContent = label;
      const value = document.createElement('strong');
      value.textContent = statusLabel(status);
      item.append(name, value);
      checksGrid.append(item);
    }

    const errorList = byId('errorList');
    const errors = result.errors || [];
    errorList.hidden = errors.length === 0;
    errorList.textContent = errors.length ? `錯誤代碼：${errors.join(' · ')}` : '';
  }

  function statusLabel(status) {
    if(status === 'passed') return '通過';
    if(status === 'failed') return '失敗';
    return '未執行';
  }

  function writeCredential(credential) {
    byId('credentialJson').value = JSON.stringify(credential, null, 2);
    resetVerification();
  }

  async function copyCredential() {
    const value = byId('credentialJson').value;
    if(!value) {
      showToast('沒有可複製的憑證。', true);
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      showToast('Credential JSON 已複製。');
    } catch {
      byId('credentialJson').select();
      showToast('瀏覽器未開放剪貼簿，已選取 Credential JSON。', true);
    }
  }

  function clearCredential() {
    byId('credentialJson').value = '';
    resetVerification();
    addActivity('已清除畫面中的 Credential JSON。');
  }

  function resetVerification() {
    byId('resultEmpty').hidden = false;
    byId('verificationResult').hidden = true;
    const badge = byId('verificationBadge');
    badge.className = 'verification-badge is-empty';
    badge.textContent = '尚未驗證';
  }

  function addActivity(message) {
    const log = byId('activityLog');
    log.querySelector('.muted-log')?.remove();
    const item = document.createElement('li');
    const time = document.createElement('time');
    time.textContent = new Intl.DateTimeFormat('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(new Date());
    const text = document.createElement('span');
    text.textContent = message;
    item.append(time, text);
    log.prepend(item);
  }

  function clearActivity() {
    const item = document.createElement('li');
    item.className = 'muted-log';
    item.textContent = '尚無操作紀錄';
    byId('activityLog').replaceChildren(item);
  }

  function showToast(message, isError = false) {
    const toast = byId('toast');
    toast.textContent = message;
    toast.className = `toast${isError ? ' is-error' : ''}`;
    toast.hidden = false;
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 4200);
  }

  function formatError(error) {
    const prefix = error.code ? `${error.code}: ` : '';
    const details = Array.isArray(error.details) ?
      ` ${error.details.map(item => `${item.path}: ${item.message}`).join('；')}` : '';
    return `${prefix}${error.message}${details}`;
  }

  async function runBusy(action) {
    if(state.busy) return;
    state.busy = true;
    allActionButtons().forEach(button => {
      button.disabled = true;
    });
    try {
      await action();
    } catch(error) {
      const message = formatError(error);
      addActivity(`操作失敗：${message}`);
      showToast(message, true);
    } finally {
      allActionButtons().forEach(button => {
        button.disabled = false;
      });
      state.busy = false;
    }
  }

  function bindEvents() {
    byId('authorizeOperator').addEventListener('click', authorizeOperator);
    byId('apiKey').addEventListener('input', () => {
      state.authorized = false;
    });
    byId('credentialJson').addEventListener('input', resetVerification);
    for(const button of document.querySelectorAll('[data-go-step], .workflow-step')) {
      button.addEventListener('click', () =>
        goToStep(Number(button.dataset.goStep || button.dataset.step)));
    }
    byId('loadDemo').addEventListener('click', loadDemo);
    byId('refreshReady').addEventListener('click', checkReadiness);
    byId('issueCredential').addEventListener('click', issueCredential);
    byId('verifyCredential').addEventListener('click', verifyFromButton);
    byId('tamperCredential').addEventListener('click', makeTamperedCopy);
    byId('restoreCredential').addEventListener('click', restoreOriginal);
    byId('revokeCredential').addEventListener('click', revokeCredential);
    byId('copyCredential').addEventListener('click', copyCredential);
    byId('clearCredential').addEventListener('click', clearCredential);
    byId('clearActivity').addEventListener('click', clearActivity);
    byId('toggleApiKey').addEventListener('click', event => {
      const input = byId('apiKey');
      const revealing = input.type === 'password';
      input.type = revealing ? 'text' : 'password';
      event.currentTarget.textContent = revealing ? '隱藏' : '顯示';
    });
  }

  bindEvents();
  loadDemo();
  void checkReadiness();
})();
