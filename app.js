let currentType = 'pemasukan';
let selectedCategory = 'Kiriman Ortu';
const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbyCmuIDrz4KiE4fGA_0OgXX2I7QNgkkNc8Llq5LoR1CvTVp0eNbcjgh6djrfUSPZWDV_g/exec';
let apiUrl = localStorage.getItem('MY_DOMPET_API_URL') || DEFAULT_API_URL;
let currentUser = localStorage.getItem('MY_DOMPET_USER') || '';
let transactions = JSON.parse(localStorage.getItem(`MY_DOMPET_TX_${currentUser}`) || '[]');

let financeChartInstance = null;
let doughnutChartInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
  initSidebarState();
  // If no username, show login screen first
  if (!currentUser) {
    showLoginScreen();
    return;
  }

  await initApp();
});

async function initApp() {
  await loadComponents();
  updateConnectionStatus();
  loadTransactions();

  const dateInput = document.getElementById('date');
  if (dateInput && !dateInput.value) dateInput.valueAsDate = new Date();

  const configModal = document.getElementById('configModal');
  if (configModal) {
    configModal.addEventListener('click', (e) => {
      if (e.target === configModal) closeModal();
    });
  }

  const form = document.getElementById('transactionForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSubmitTransaction();
    });
  }

  // Handle navbar glass effect on scroll
  window.addEventListener('scroll', () => {
    const header = document.getElementById('main-header');
    if (header) {
      if (window.scrollY > 10) {
        header.classList.add('bg-white/70', 'backdrop-blur-md', 'shadow-sm');
        header.classList.remove('bg-white', 'shadow-none');
      } else {
        header.classList.add('bg-white', 'shadow-none');
        header.classList.remove('bg-white/70', 'backdrop-blur-md', 'shadow-sm');
      }
    }
  });
}

// ---- Login Screen ----
function showLoginScreen() {
  const overlay = document.createElement('div');
  overlay.className = 'login-overlay';
  overlay.id = 'loginOverlay';
  overlay.innerHTML = `
    <div class="login-card">
      <div class="login-icon">
        <span class="material-symbols-outlined" style="font-size:28px">account_balance_wallet</span>
      </div>
      <h1>DompetKu</h1>
      <p>Masukkan username untuk mulai mencatat keuangan Anda</p>
      <form id="loginForm">
        <input type="text" id="loginUsername" placeholder="Username Anda" autocomplete="off" required>
        <button type="submit">Masuk</button>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('loginUsername');
    const name = input.value.trim().toLowerCase();
    if (!name) return;

    currentUser = name;
    localStorage.setItem('MY_DOMPET_USER', currentUser);
    transactions = JSON.parse(localStorage.getItem(`MY_DOMPET_TX_${currentUser}`) || '[]');

    overlay.remove();
    showNotification(`Selamat datang kembali, ${currentUser}!`, 'success');
    await initApp();
  });
}

// ---- Component Loader ----
async function loadComponents() {
  const sidebarContainer = document.getElementById('sidebar-container');
  if (sidebarContainer) {
    try {
      const res = await fetch('sidebar.html');
      if (res.ok) sidebarContainer.innerHTML = await res.text();
    } catch (err) {
      console.error('Error loading sidebar:', err);
    }
  }

  const headerContainer = document.getElementById('header-container');
  if (headerContainer) {
    try {
      const res = await fetch('header.html');
      if (res.ok) headerContainer.innerHTML = await res.text();
    } catch (err) {
      console.error('Error loading header:', err);
    }
  }

  highlightActiveNav();
  setPageTitle();
  updateConnectionStatus();
  updateMinimizeIcon();
}

function highlightActiveNav() {
  const path = decodeURIComponent(window.location.pathname.toLowerCase());
  let activeId = 'nav-index';

  if (path.includes('input') || path.includes('tambah')) {
    activeId = 'nav-input';
  } else if (path.includes('riwayat')) {
    activeId = 'nav-riwayat';
  }

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  const activeLink = document.getElementById(activeId);
  if (activeLink) activeLink.classList.add('active');
}

function setPageTitle() {
  const titleEl = document.getElementById('page-title');
  if (!titleEl) return;

  const path = decodeURIComponent(window.location.pathname.toLowerCase());
  if (path.includes('input') || path.includes('tambah')) {
    titleEl.textContent = 'Tambah Transaksi Baru';
  } else if (path.includes('riwayat')) {
    titleEl.textContent = 'Riwayat Transaksi';
  } else {
    titleEl.textContent = 'Dashboard';
  }
}

// ---- Sidebar Minimize (Desktop) & Mobile Toggle ----
function toggleSidebarMinimize() {
  document.body.classList.toggle('sidebar-minimized');
  const isMinimized = document.body.classList.contains('sidebar-minimized');
  localStorage.setItem('MY_DOMPET_SIDEBAR_MIN', isMinimized ? 'true' : 'false');
  updateMinimizeIcon();
}

function initSidebarState() {
  if (localStorage.getItem('MY_DOMPET_SIDEBAR_MIN') === 'true') {
    document.body.classList.add('sidebar-minimized');
  } else {
    document.body.classList.remove('sidebar-minimized');
  }
}

function updateMinimizeIcon() {
  const icon = document.getElementById('sidebar-minimize-icon');
  const btn = document.getElementById('sidebar-minimize-btn');
  if (icon) {
    const isMinimized = document.body.classList.contains('sidebar-minimized');
    icon.textContent = isMinimized ? 'dock_to_right' : 'dock_to_left';
    if (btn) {
      btn.title = isMinimized ? 'Perluas Sidebar' : 'Perkecil Sidebar';
    }
  }
}

function toggleSidebar() {
  document.body.classList.toggle('sidebar-open');
}

function setQuickAmount(val) {
  const input = document.getElementById('amount');
  if (input) {
    input.value = new Intl.NumberFormat('id-ID').format(val);
  }
}

// ---- Category selection ----
function selectCategory(btnElement, categoryName) {
  selectedCategory = categoryName;
  const labelEl = document.getElementById('selected-category-name');
  if (labelEl) labelEl.textContent = categoryName;

  const badge = document.getElementById('category-badge');
  if (badge) {
    badge.classList.remove('animate-badge');
    void badge.offsetWidth; // Trigger reflow to restart animation
    badge.classList.add('animate-badge');
  }

  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.className = 'category-btn flex flex-col items-center justify-center p-3.5 rounded-xl bg-white hover:bg-slate-100/90 text-slate-600 border border-slate-200/80 shadow-xs gap-1.5 text-xs font-semibold';
  });

  if (btnElement) {
    btnElement.className = 'category-btn is-active flex flex-col items-center justify-center p-3.5 rounded-xl bg-blue-500 border border-blue-500 text-white shadow-md shadow-blue-500/25 gap-1.5 text-xs font-semibold';
  }
}

// ---- Connection Status ----
function updateConnectionStatus() {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');

  if (dot && text) {
    if (apiUrl && currentUser) {
      dot.classList.add('online');
      text.textContent = currentUser;
    } else if (apiUrl && !currentUser) {
      dot.classList.remove('online');
      text.textContent = 'Set Username';
    } else {
      dot.classList.remove('online');
      text.textContent = 'Belum Terkoneksi';
    }
  }
}

function formatRupiah(number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(number);
}

// ---- Data Loading ----
async function loadTransactions() {
  if (!apiUrl || !currentUser) {
    transactions = [];
    renderApp();
    return;
  }

  // Tampilkan dari cache agar instan (Optimistic UI)
  if (transactions.length > 0) renderApp();

  const now = Date.now();
  const lastSync = sessionStorage.getItem(`MY_DOMPET_LAST_SYNC_${currentUser}`);
  // Cegah request bertubi-tubi ke server jika baru saja reload (throttle 3 detik)
  if (lastSync && (now - parseInt(lastSync) < 3000)) {
    return;
  }
  sessionStorage.setItem(`MY_DOMPET_LAST_SYNC_${currentUser}`, now.toString());

  try {
    const cacheBuster = `_t=${Date.now()}`;
    const res = await fetch(`${apiUrl}?user=${encodeURIComponent(currentUser)}&${cacheBuster}`);
    const result = await res.json();
    if (result.status === 'success' && Array.isArray(result.data)) {
      transactions = result.data;
      localStorage.setItem(`MY_DOMPET_TX_${currentUser}`, JSON.stringify(transactions));
    }
  } catch (err) {
    console.warn('Gagal mengambil data:', err);
  }

  renderApp();
}

// ---- Toast Notification & Confirm Modal Popup System ----
function showNotification(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast-popup toast-${type}`;

  let iconName = 'info';
  if (type === 'success') iconName = 'check_circle';
  if (type === 'error') iconName = 'error';

  toast.innerHTML = `
    <div class="toast-icon">
      <span class="material-symbols-outlined" style="font-size: 20px;">${iconName}</span>
    </div>
    <div class="flex-1 text-slate-800 text-xs font-semibold leading-snug">${message}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

function showConfirmModal(title, message, onConfirm, confirmText = 'Lanjutkan', icon = 'warning') {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-modal-overlay';
  overlay.innerHTML = `
    <div class="confirm-modal-card">
      <div class="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
        <span class="material-symbols-outlined" style="font-size:26px">${icon}</span>
      </div>
      <h3 class="font-bold text-slate-900 text-base mb-1">${title}</h3>
      <p class="text-xs text-slate-500 mb-5 leading-relaxed">${message}</p>
      <div class="flex gap-2.5">
        <button id="cancelConfirmBtn" class="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors">Batal</button>
        <button id="okConfirmBtn" class="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-sm transition-colors">${confirmText}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
  overlay.querySelector('#cancelConfirmBtn').onclick = () => overlay.remove();
  overlay.querySelector('#okConfirmBtn').onclick = () => {
    overlay.remove();
    if (typeof onConfirm === 'function') onConfirm();
  };
}

// ---- Transaction Submit ----
async function handleSubmitTransaction() {
  if (!apiUrl) {
    showNotification('Spreadsheet belum terkoneksi! Silakan buka pengaturan.', 'error');
    openModal();
    return;
  }

  const amountInput = document.getElementById('amount');
  const rawAmountStr = amountInput ? amountInput.value.replace(/\./g, '').replace(/,/g, '') : '0';
  const nominal = parseFloat(rawAmountStr);

  const dateInput = document.getElementById('date');
  const tanggal = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];

  const notesInput = document.getElementById('note');
  const keterangan = notesInput ? notesInput.value.trim() : '';

  if (isNaN(nominal) || nominal <= 0) {
    showNotification('Harap masukkan nominal transaksi yang valid!', 'error');
    return;
  }

  const newTx = {
    id: Date.now().toString(),
    tanggal,
    tipe: currentType,
    kategori: selectedCategory,
    nominal,
    keterangan,
    user: currentUser
  };

  const submitBtn = document.getElementById('submit-btn');
  if (submitBtn) submitBtn.disabled = true;

  // 1. Update UI secara INSTAN (Optimistic Update)
  transactions.push(newTx);
  localStorage.setItem(`MY_DOMPET_TX_${currentUser}`, JSON.stringify(transactions));
  renderApp();

  showNotification('Transaksi berhasil disimpan!', 'success');
  resetForm();

  // 2. Kirim data ke Google Sheets di background
  try {
    const payload = { action: 'add', ...newTx };
    try {
      await fetch(apiUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });
    } catch (postErr) {
      console.warn('POST failed, trying GET fallback:', postErr);
      const params = new URLSearchParams(payload).toString();
      await fetch(`${apiUrl}?${params}`);
    }

    // Refresh sync background setelah 800ms
    await new Promise(res => setTimeout(res, 800));
    sessionStorage.removeItem(`MY_DOMPET_LAST_SYNC_${currentUser}`); // bypass throttle
    await loadTransactions();
  } catch (err) {
    console.error('Gagal sync backend:', err);
    showNotification('Gagal mensinkronkan ke Google Sheets', 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

function closeToast() {
  const toast = document.getElementById('toast-success');
  if (toast) {
    toast.classList.add('hidden');
    toast.classList.remove('flex');
  }
}

function resetForm() {
  const amountInput = document.getElementById('amount');
  if (amountInput) amountInput.value = '0';
  const notesInput = document.getElementById('note');
  if (notesInput) notesInput.value = '';
}

function formatAndCalculate(input) {
  let val = input.value.replace(/\D/g, '');
  if (!val) { input.value = '0'; return; }
  input.value = new Intl.NumberFormat('id-ID').format(parseInt(val, 10));
}

// ---- Delete Transaction ----
async function deleteTransaction(id) {
  if (!apiUrl || !currentUser) {
    showNotification('Spreadsheet atau Username belum disetel!', 'error');
    return;
  }

  showConfirmModal('Hapus Transaksi', 'Apakah Anda yakin ingin menghapus transaksi ini dari catatan?', async () => {
    // 1. Update UI secara INSTAN (Optimistic Delete)
    transactions = transactions.filter(t => String(t.id) !== String(id));
    localStorage.setItem(`MY_DOMPET_TX_${currentUser}`, JSON.stringify(transactions));
    renderApp();
    showNotification('Transaksi berhasil dihapus', 'info');

    // 2. Sync server di background
    try {
      const payload = { action: 'delete', id, user: currentUser };
      try {
        await fetch(apiUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(payload)
        });
      } catch (postErr) {
        console.warn('DELETE POST failed, trying GET fallback:', postErr);
        const params = new URLSearchParams(payload).toString();
        await fetch(`${apiUrl}?${params}`);
      }

      await new Promise(res => setTimeout(res, 800));
      sessionStorage.removeItem(`MY_DOMPET_LAST_SYNC_${currentUser}`); // bypass throttle
      await loadTransactions();
    } catch (err) {
      console.error('Gagal menghapus:', err);
      showNotification('Gagal menghapus dari Google Sheets', 'error');
    }
  }, 'Hapus', 'delete');
}

// ---- Render App ----
function renderApp() {
  const isConnected = Boolean(apiUrl && currentUser);
  let totalIncome = 0, totalExpense = 0;

  transactions.forEach(t => {
    const amt = Number(t.nominal) || 0;
    if (t.tipe === 'pemasukan') totalIncome += amt;
    else totalExpense += amt;
  });

  const netBalance = totalIncome - totalExpense;

  // Summary cards
  const elIncome = document.getElementById('totalIncome') || document.getElementById('summary-income');
  if (elIncome) elIncome.textContent = isConnected ? formatRupiah(totalIncome) : 'Rp 0';

  const elExpense = document.getElementById('totalExpense') || document.getElementById('summary-expense');
  if (elExpense) elExpense.textContent = isConnected ? formatRupiah(totalExpense) : 'Rp 0';

  const elBalance = document.getElementById('netBalance') || document.getElementById('summary-balance');
  if (elBalance) elBalance.textContent = isConnected ? formatRupiah(netBalance) : 'Rp 0';

  renderCharts(totalIncome, totalExpense);
  renderDashboardTable(isConnected, totalIncome);
  renderHistoryTable(isConnected);
}

function renderDashboardTable(isConnected) {
  const tbody = document.getElementById('dashboard-transaction-rows');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!apiUrl) {
    tbody.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-slate-400">
      <div class="flex flex-col items-center gap-2">
        <span class="material-symbols-outlined text-[32px] text-slate-300">link_off</span>
        <p class="font-bold text-slate-700 text-sm">Spreadsheet Belum Terkoneksi</p>
        <p class="text-xs">Klik tombol status di kanan atas untuk menyambungkan.</p>
      </div></td></tr>`;
    return;
  }

  if (transactions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-slate-400 text-xs">Belum ada transaksi untuk "${currentUser}"</td></tr>`;
    return;
  }

  [...transactions].reverse().slice(0, 5).forEach(t => {
    const isIncome = t.tipe === 'pemasukan';
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition-colors text-xs';
    tr.innerHTML = `
      <td class="py-3 px-4"><span class="font-semibold text-slate-900">${t.keterangan || t.kategori}</span></td>
      <td class="py-3 px-4"><span class="inline-flex items-center px-2.5 py-0.5 rounded-full font-bold text-[10px] ${isIncome ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">${t.kategori}</span></td>
      <td class="py-3 px-4 text-slate-500">${t.tanggal}</td>
      <td class="py-3 px-4 text-right font-bold ${isIncome ? 'text-emerald-600' : 'text-rose-600'}">${isIncome ? '+' : '-'} ${formatRupiah(t.nominal)}</td>`;
    tbody.appendChild(tr);
  });
}

function renderHistoryTable(isConnected) {
  const tbody = document.getElementById('transaction-rows');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!apiUrl) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-12 text-center text-slate-400">
      <div class="flex flex-col items-center gap-2">
        <span class="material-symbols-outlined text-[36px] text-slate-300">link_off</span>
        <p class="font-bold text-slate-700 text-sm">Spreadsheet Belum Terkoneksi</p>
        <button onclick="openModal()" class="mt-2 px-3.5 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold">Hubungkan</button>
      </div></td></tr>`;
    return;
  }

  if (transactions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-400 text-xs">Tidak ada transaksi untuk "${currentUser}"</td></tr>`;
    return;
  }

  [...transactions].reverse().forEach(t => {
    const isIncome = t.tipe === 'pemasukan';
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition-colors text-xs';
    tr.setAttribute('data-type', isIncome ? 'in' : 'out');
    tr.innerHTML = `
      <td class="py-3 px-4 md:px-6 whitespace-nowrap text-slate-700 font-semibold">${t.tanggal}</td>
      <td class="py-3 px-4"><span class="font-semibold text-slate-900">${t.keterangan || t.kategori}</span></td>
      <td class="py-3 px-4 whitespace-nowrap"><span class="bg-slate-100 text-slate-700 font-semibold px-2.5 py-1 rounded-full text-[10px]">${t.kategori}</span></td>
      <td class="py-3 px-4 whitespace-nowrap hidden md:table-cell">
        <div class="flex items-center gap-1.5 font-medium text-slate-600">
          <span class="w-1.5 h-1.5 rounded-full ${isIncome ? 'bg-emerald-500' : 'bg-rose-500'}"></span>
          <span>Google Sheet</span>
        </div>
      </td>
      <td class="py-3 px-4 whitespace-nowrap hidden md:table-cell">
        <span class="font-bold px-2.5 py-0.5 rounded-full text-[10px] ${isIncome ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">
          ${isIncome ? 'Pemasukan' : 'Pengeluaran'}
        </span>
      </td>
      <td class="py-3 px-4 md:px-6 text-right whitespace-nowrap font-bold ${isIncome ? 'text-emerald-600' : 'text-rose-600'}">
        <span>${isIncome ? '+' : '-'}${formatRupiah(t.nominal)}</span>
        <button class="ml-1.5 text-slate-400 hover:text-rose-600 transition-colors inline-flex items-center align-middle" onclick="deleteTransaction('${t.id}')" title="Hapus">
          <span class="material-symbols-outlined text-[16px]">delete</span>
        </button>
      </td>`;
    tbody.appendChild(tr);
  });
}

// ---- Charts ----
function renderCharts(totalIncome, totalExpense) {
  const financeCanvas = document.getElementById('financeChart');
  const doughnutCanvas = document.getElementById('doughnutChart');

  if (financeCanvas && window.Chart) {
    if (financeChartInstance) financeChartInstance.destroy();

    const dateMap = {};
    transactions.forEach(t => {
      if (!dateMap[t.tanggal]) dateMap[t.tanggal] = { in: 0, out: 0 };
      const amt = Number(t.nominal) || 0;
      if (t.tipe === 'pemasukan') dateMap[t.tanggal].in += amt;
      else dateMap[t.tanggal].out += amt;
    });

    const dates = Object.keys(dateMap).sort();
    const incomeData = dates.map(d => dateMap[d].in);
    const expenseData = dates.map(d => dateMap[d].out);

    financeChartInstance = new Chart(financeCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: dates.length ? dates : ['Hari Ini'],
        datasets: [
          {
            label: 'Pemasukan',
            data: incomeData.length ? incomeData : [totalIncome],
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 2, tension: 0.3, fill: true
          },
          {
            label: 'Pengeluaran',
            data: expenseData.length ? expenseData : [totalExpense],
            borderColor: '#f43f5e',
            backgroundColor: 'rgba(244, 63, 94, 0.1)',
            borderWidth: 2, tension: 0.3, fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { font: { family: 'Plus Jakarta Sans', size: 11 } } } },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: '#f1f5f9' }, ticks: { font: { family: 'Plus Jakarta Sans', size: 10 } } }
        }
      }
    });
  }

  if (doughnutCanvas && window.Chart) {
    if (doughnutChartInstance) doughnutChartInstance.destroy();

    doughnutChartInstance = new Chart(doughnutCanvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Pemasukan', 'Pengeluaran'],
        datasets: [{ data: [totalIncome, totalExpense], backgroundColor: ['#10b981', '#f43f5e'], borderWidth: 0 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { font: { family: 'Plus Jakarta Sans', size: 11 } } } },
        cutout: '70%'
      }
    });
  }
}

// ---- Config Modal ----
function openModal() {
  const modal = document.getElementById('configModal');
  const inputApi = document.getElementById('apiUrlInput');
  const inputUser = document.getElementById('userInput');
  if (modal) {
    if (inputApi) inputApi.value = apiUrl;
    if (inputUser) inputUser.value = currentUser;
    modal.classList.add('active');
  }
}

function closeModal() {
  const modal = document.getElementById('configModal');
  if (modal) modal.classList.remove('active');
}

function saveApiUrl() {
  const urlInput = document.getElementById('apiUrlInput');
  const userInput = document.getElementById('userInput');

  if (urlInput) {
    apiUrl = urlInput.value.trim() || DEFAULT_API_URL;
    localStorage.setItem('MY_DOMPET_API_URL', apiUrl);
  }

  if (userInput) {
    currentUser = userInput.value.trim().toLowerCase();
    localStorage.setItem('MY_DOMPET_USER', currentUser);
    transactions = JSON.parse(localStorage.getItem(`MY_DOMPET_TX_${currentUser}`) || '[]');
  }

  updateConnectionStatus();
  closeModal();
  showNotification('Pengaturan berhasil disimpan!', 'success');
  loadTransactions();
}

// ---- Logout ----
function logout() {
  showConfirmModal(
    'Konfirmasi Keluar',
    'Apakah Anda yakin ingin keluar dari akun DompetKu?',
    () => {
      localStorage.removeItem('MY_DOMPET_USER');
      currentUser = '';
      window.location.reload();
    },
    'Keluar',
    'logout'
  );
}
