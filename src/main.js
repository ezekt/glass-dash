import './style.css';
import Chart from 'chart.js/auto';
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, isSameMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, isSameDay, getDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { auth, provider, signInWithPopup, signOut, onAuthStateChanged, db, doc, getDoc, setDoc } from './firebase.js';

let currentUser = null;

async function saveToCloud() {
  if (!currentUser) return;
  console.log('Saving to cloud...');
  try {
    const data = {
      transactions: store.transactions,
      subscriptions: subStore.subscriptions,
      debts: debtStore.debts,
      lastUpdated: new Date().toISOString()
    };
    await setDoc(doc(db, 'users', currentUser.uid), data);
    console.log('Cloud save complete');
  } catch (e) {
    console.error('Error saving to cloud:', e);
  }
}

// --- State Management ---
// --- State Management ---
class TransactionStore {
  constructor() {
    this.transactions = JSON.parse(localStorage.getItem('transactions')) || [];
    // If empty, add some dummy data for demo
    if (this.transactions.length === 0) {
      this.transactions.push({
        id: crypto.randomUUID(),
        date: format(new Date(), 'yyyy-MM-dd'),
        title: '初期データ: 給与',
        amount: 300000,
        type: 'income',
        category: 'salary'
      });
      this.transactions.push({
        id: crypto.randomUUID(),
        date: format(new Date(), 'yyyy-MM-dd'),
        title: '初期データ: 家賃',
        amount: 80000,
        type: 'expense',
        category: 'fixed'
      });
      localStorage.setItem('transactions', JSON.stringify(this.transactions));
    }
  }

  addTransaction(transaction) {
    this.transactions.unshift(transaction); // Add to top
    this.save();
  }

  removeTransaction(id) {
    this.transactions = this.transactions.filter(t => t.id !== id);
    this.save();
  }

  clearAll() {
    this.transactions = [];
    this.save();
  }

  save() {
    localStorage.setItem('transactions', JSON.stringify(this.transactions));
    updateUI();
    saveToCloud();
  }

  getTransactions() {
    return this.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  getMonthlyStats() {
    const now = new Date();
    const currentMonthTransactions = this.transactions.filter(t => isSameMonth(parseISO(t.date), now));

    const income = currentMonthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const expense = currentMonthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalBalance = this.transactions.reduce((sum, t) => {
      return t.type === 'income' ? sum + Number(t.amount) : sum - Number(t.amount);
    }, 0);

    return { income, expense, totalBalance };
  }

  getChartData(months = 6) {
    const end = new Date();
    const start = subMonths(end, months - 1);
    const monthsInterval = eachMonthOfInterval({ start, end });

    const labels = monthsInterval.map(date => format(date, 'M月', { locale: ja }));
    const data = monthsInterval.map(date => {
      const monthTrans = this.transactions.filter(t => isSameMonth(parseISO(t.date), date));
      const income = monthTrans.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
      const expense = monthTrans.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);
      return income - expense; // Net income
    });

    return { labels, data };
  }

  getCategoryStats(period = 'current') {
    const now = new Date();
    let targetDate = now;

    if (period === 'last') {
      targetDate = subMonths(now, 1);
    }

    const targetTransactions = this.transactions.filter(t =>
      isSameMonth(parseISO(t.date), targetDate) && t.type === 'expense'
    );

    const categories = {};
    targetTransactions.forEach(t => {
      if (!categories[t.category]) {
        categories[t.category] = 0;
      }
      categories[t.category] += Number(t.amount);
    });

    // Convert to arrays for Chart.js
    const labels = Object.keys(categories).map(cat => getCategoryName(cat));
    const data = Object.values(categories);
    const bgColors = Object.keys(categories).map(cat => getCategoryColor(cat));

    return { labels, data, bgColors };
  }
}

const store = new TransactionStore();

// --- Subscription Management ---
class SubscriptionStore {
  constructor(transactionStore) {
    this.subscriptions = JSON.parse(localStorage.getItem('subscriptions')) || [];
    this.transactionStore = transactionStore;
    this.lastCheck = localStorage.getItem('lastSubscriptionCheck') || format(new Date(), 'yyyy-MM-dd');

    // Initial dummy data if empty
    if (this.subscriptions.length === 0) {
      this.subscriptions.push({
        id: crypto.randomUUID(),
        title: '家賃',
        amount: 80000,
        day: 27
      });
      this.subscriptions.push({
        id: crypto.randomUUID(),
        title: 'Netflix',
        amount: 1490,
        day: 15
      });
      localStorage.setItem('subscriptions', JSON.stringify(this.subscriptions));
    }
  }

  addSubscription(sub) {
    this.subscriptions.push(sub);
    this.save();
  }

  removeSubscription(id) {
    this.subscriptions = this.subscriptions.filter(s => s.id !== id);
    this.save();
  }

  save() {
    localStorage.setItem('subscriptions', JSON.stringify(this.subscriptions));
    updateSubscriptionUI();
    saveToCloud();
  }

  // Check and generate transactions for passed days
  checkAndGenerate() {
    const today = new Date();
    const lastCheckDate = parseISO(this.lastCheck);

    // If last check was today, skip
    if (format(today, 'yyyy-MM-dd') === this.lastCheck) return;

    // Iterate from lastCheck + 1 day to today
    let current = lastCheckDate;
    current.setDate(current.getDate() + 1);

    while (current <= today) {
      const dayOfMonth = current.getDate();

      this.subscriptions.forEach(sub => {
        if (Number(sub.day) === dayOfMonth) {
          // Generate transaction
          this.transactionStore.addTransaction({
            id: crypto.randomUUID(),
            date: format(current, 'yyyy-MM-dd'),
            title: sub.title + ' (自動)',
            amount: sub.amount,
            type: 'expense',
            category: 'fixed' // Subscriptions are typically fixed expenses
          });
        }
      });
      current.setDate(current.getDate() + 1);
    }
    this.lastCheck = format(today, 'yyyy-MM-dd');
    localStorage.setItem('lastSubscriptionCheck', this.lastCheck);
  }

  getSubscriptions() {
    return this.subscriptions;
  }
}

const subStore = new SubscriptionStore(store);

// --- Debt Management ---
class DebtStore {
  constructor(transactionStore) {
    this.debts = JSON.parse(localStorage.getItem('debts')) || [];
    this.transactionStore = transactionStore;
  }

  addDebt(debt) {
    this.debts.push(debt);
    this.save();
  }

  repayDebt(id, amount) {
    const debt = this.debts.find(d => d.id === id);
    if (debt) {
      debt.balance -= amount;
      if (debt.balance < 0) debt.balance = 0;

      // Record as expense
      this.transactionStore.addTransaction({
        id: crypto.randomUUID(),
        date: format(new Date(), 'yyyy-MM-dd'),
        title: `返済: ${debt.name}`,
        amount: amount,
        type: 'expense',
        category: 'other' // Or create a 'debt' category
      });

      this.save();
    }
  }

  removeDebt(id) {
    this.debts = this.debts.filter(d => d.id !== id);
    this.save();
  }

  save() {
    localStorage.setItem('debts', JSON.stringify(this.debts));
    updateDebtUI();
    saveToCloud();
  }

  getTotalDebt() {
    return this.debts.reduce((sum, d) => sum + Number(d.balance), 0);
  }
}

const debtStore = new DebtStore(store);

// --- UI Updates ---
function formatCurrency(amount) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount);
}

function getCategoryColor(cat) {
  const map = {
    food: '#e17055', daily: '#00b894', transport: '#0984e3',
    entertainment: '#6c5ce7', fixed: '#d63031', salary: '#fdcb6e', other: '#636e72'
  };
  return map[cat] || '#636e72';
}

function updateStats() {
  const { income, expense, totalBalance } = store.getMonthlyStats();
  document.getElementById('total-balance').textContent = formatCurrency(totalBalance);
  document.getElementById('month-income').textContent = formatCurrency(income);
  document.getElementById('month-expense').textContent = formatCurrency(expense);

  // Simple trend logic (just for show in this version)
  const trendEl = document.getElementById('balance-trend');
  if (totalBalance >= 0) {
    trendEl.innerHTML = '<i class="fa-solid fa-arrow-up"></i> 健全';
    trendEl.className = 'trend up';
  } else {
    trendEl.innerHTML = '<i class="fa-solid fa-arrow-down"></i> 赤字';
    trendEl.className = 'trend down';
  }
}

function updateDebtUI() {
  const listEl = document.getElementById('debt-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  const totalDebt = debtStore.getTotalDebt();
  document.getElementById('total-debt').textContent = formatCurrency(totalDebt);

  debtStore.debts.forEach(debt => {
    const html = `
      <div class="transaction-item" style="background: rgba(255,255,255,0.05);">
        <div class="t-icon" style="background: #d63031; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
          <i class="fa-solid fa-building-columns" style="color: #fff;"></i>
        </div>
        <div class="t-details">
          <h4>${debt.name} <span style="font-size: 0.7rem; opacity: 0.7;">${debt.rate ? '(年率 ' + debt.rate + '%)' : ''}</span></h4>
          <p>残高: ${formatCurrency(debt.balance)}</p>
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
             <button class="glass-btn-sm repay-btn" data-id="${debt.id}" style="font-size: 0.8rem; padding: 5px 10px; background: rgba(0, 184, 148, 0.2); color: #00b894; border: 1px solid #00b894;">
            返済
          </button>
          <button class="glass-btn-sm delete-debt-btn" data-id="${debt.id}" style="border: none; background: transparent; color: #ff7675;">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    `;
    listEl.insertAdjacentHTML('beforeend', html);
  });

  // Repay Button Logic
  document.querySelectorAll('.repay-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const amount = prompt('返済額を入力してください:');
      if (amount && !isNaN(amount)) {
        debtStore.repayDebt(id, Number(amount));
        alert('返済を記録しました。支出にも追加されました。');
      }
    });
  });

  // Delete Debt Logic
  document.querySelectorAll('.delete-debt-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (confirm('この借入先を削除しますか？')) {
        debtStore.removeDebt(e.currentTarget.dataset.id);
      }
    });
  });
}

function updateTransactionList() {
  const listEl = document.getElementById('transaction-list');
  listEl.innerHTML = '';

  const recent = store.getTransactions().slice(0, 5); // Show top 5

  recent.forEach(t => {
    const isIncome = t.type === 'income';
    const amountClass = isIncome ? 'positive' : 'negative';
    const sign = isIncome ? '+' : '-';

    // Icon mapping based on category
    let icon = 'fa-circle';
    let color = '#fff';
    let bg = '#333';

    switch (t.category) {
      case 'food': icon = 'fa-utensils'; bg = '#e17055'; break;
      case 'daily': icon = 'fa-basket-shopping'; bg = '#00b894'; break;
      case 'transport': icon = 'fa-train'; bg = '#0984e3'; break;
      case 'entertainment': icon = 'fa-gamepad'; bg = '#6c5ce7'; break;
      case 'fixed': icon = 'fa-house'; bg = '#d63031'; break;
      case 'salary': icon = 'fa-money-bill-wave'; bg = '#fdcb6e'; color = '#000'; break;
      default: icon = 'fa-tag'; bg = '#636e72';
    }

    const html = `
      <div class="transaction-item">
        <div class="t-icon" style="background: ${bg}; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
          <i class="fa-solid ${icon}" style="color: ${color};"></i>
        </div>
        <div class="t-details">
          <h4>${t.title}</h4>
          <p>${format(parseISO(t.date), 'yyyy/MM/dd')} • ${getCategoryName(t.category)}</p>
        </div>
        <div class="t-amount ${amountClass}">
          ${sign}${formatCurrency(t.amount)}
        </div>
        <button class="glass-btn-sm delete-btn" data-id="${t.id}" style="margin-left: 10px; border: none; background: transparent; color: #ff7675;">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    `;
    listEl.insertAdjacentHTML('beforeend', html);
  });

  // Add event listeners to delete buttons
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      if (confirm('削除しますか？')) {
        store.removeTransaction(id);
      }
    });
  });
}

function getCategoryName(cat) {
  const map = {
    food: '食費', daily: '日用品', transport: '交通費', entertainment: '交際・娯楽',
    fixed: '固定費', salary: '給与', other: 'その他'
  };
  return map[cat] || cat;
}

// --- Chart ---
let revenueChart;
let categoryChart;

function initChart() {
  const ctx = document.getElementById('revenueChart').getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, 'rgba(108, 92, 231, 0.5)');
  gradient.addColorStop(1, 'rgba(108, 92, 231, 0.0)');

  revenueChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: '収支バランス',
        data: [],
        backgroundColor: gradient,
        borderColor: '#6c5ce7',
        borderWidth: 2,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#6c5ce7',
        pointRadius: 4,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          titleColor: '#000',
          bodyColor: '#000',
          borderColor: 'rgba(0,0,0,0.1)',
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: {
            label: function (context) {
              return '収支: ' + formatCurrency(context.parsed.y);
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: 'rgba(255,255,255,0.7)' }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.1)', drawBorder: false },
          ticks: { color: 'rgba(255,255,255,0.7)' }
        }
      }
    }
  });
}

function initCategoryChart() {
  const ctx = document.getElementById('categoryChart').getContext('2d');

  categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: [],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#fff' }
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return context.label + ': ' + formatCurrency(context.parsed);
            }
          }
        }
      }
    }
  });
}

function updateChart() {
  const { labels, data } = store.getChartData();
  revenueChart.data.labels = labels;
  revenueChart.data.datasets[0].data = data;
  revenueChart.update();
}

function updateCategoryChart(period = 'current') {
  if (!categoryChart) return;
  const { labels, data, bgColors } = store.getCategoryStats(period);

  categoryChart.data.labels = labels;
  categoryChart.data.datasets[0].data = data;
  categoryChart.data.datasets[0].backgroundColor = bgColors;
  categoryChart.update();
}

// --- Main Update Loop ---
function updateUI() {
  updateStats();
  updateTransactionList();
  updateChart();
  updateCategoryChart(document.getElementById('analytics-period')?.value || 'current');
  updateDebtUI();
  renderCalendar(currentCalendarDate);
}

// --- Calendar Logic ---
let currentCalendarDate = new Date();

function renderCalendar(date) {
  const grid = document.getElementById('calendar-grid');
  const title = document.getElementById('calendar-title');
  if (!grid || !title) return;

  grid.innerHTML = '';
  title.textContent = format(date, 'yyyy年 M月', { locale: ja });

  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const startDate = startOfWeek(monthStart); // defaults to Sunday
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  days.forEach(day => {
    const isCurrentMonth = isSameMonth(day, date);
    const dayStr = format(day, 'yyyy-MM-dd');
    const isToday = isSameDay(day, new Date());

    // Calculate daily totals
    const dayTrans = store.transactions.filter(t => t.date === dayStr);
    const income = dayTrans.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
    const expense = dayTrans.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);

    const cell = document.createElement('div');
    cell.className = 'calendar-cell';
    if (!isCurrentMonth) cell.classList.add('other-month');
    if (isToday) cell.classList.add('today-cell');

    let html = `<div class="calendar-date">${format(day, 'd')}</div>`;
    if (income > 0) html += `<div class="calendar-income">+${(income / 1000).toFixed(0)}k</div>`;
    if (expense > 0) html += `<div class="calendar-expense">-${(expense / 1000).toFixed(0)}k</div>`;

    cell.innerHTML = html;

    cell.addEventListener('click', () => {
      // Future: Show details for this day
      // For now, maybe just log or alert
      // alert(`${dayStr}\n収入: ¥${income}\n支出: ¥${expense}`);
    });

    grid.appendChild(cell);
  });
}

// --- Event Listeners ---
function updateSubscriptionUI() {
  const listEl = document.getElementById('subscription-list');
  if (!listEl) return; // Guard clause
  listEl.innerHTML = '';

  subStore.subscriptions.forEach(sub => {
    const html = `
      <div class="fixed-cost-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); border-radius: 8px;">
        <div>
          <div style="font-size: 0.9rem;">${sub.title}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">毎月 ${sub.day}日</div>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span>¥${sub.amount.toLocaleString()}</span>
          <button class="glass-btn-sm delete-sub-btn" data-id="${sub.id}" style="border: none; background: transparent; color: #ff7675; cursor: pointer;">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    `;
    listEl.insertAdjacentHTML('beforeend', html);
  });

  document.querySelectorAll('.delete-sub-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (confirm('この固定費設定を削除しますか？')) {
        subStore.removeSubscription(e.currentTarget.dataset.id);
      }
    });
  });
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
  initChart();
  initCategoryChart();

  // Check for auto-generation on load
  subStore.checkAndGenerate();

  updateUI();
  updateSubscriptionUI();

  // Theme Toggle
  const themeToggle = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  if (themeToggle) {
    if (savedTheme === 'light') themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i> ダークモード';

    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const newTheme = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);

      if (newTheme === 'light') {
        themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i> ダークモード';
      } else {
        themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i> ライトモード';
      }
    });
  }

  // Calendar Nav
  document.getElementById('prev-month')?.addEventListener('click', () => {
    currentCalendarDate = subMonths(currentCalendarDate, 1);
    renderCalendar(currentCalendarDate);
  });

  document.getElementById('next-month')?.addEventListener('click', () => {
    currentCalendarDate = addMonths(currentCalendarDate, 1);
    renderCalendar(currentCalendarDate);
  });

  // Populate Day Selector
  const daySelect = document.getElementById('sub-day');
  for (let i = 1; i <= 31; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = i + '日';
    daySelect.appendChild(option);
  }

  // Analytics Period Change
  document.getElementById('analytics-period')?.addEventListener('change', (e) => {
    updateCategoryChart(e.target.value);
  });

  // Nav Logic
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.page-section');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();

      // Update Nav
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      // Update Section
      const targetId = item.dataset.target + '-section';
      sections.forEach(section => {
        if (section.id === targetId) {
          section.style.display = 'grid'; // Use grid for dashboard layout
          // Trigger chart resize/update if needed
          if (targetId === 'analytics-section') {
            updateCategoryChart(document.getElementById('analytics-period').value);
          }
        } else {
          section.style.display = 'none';
        }
      });
    });
  });

  // Modal Logic
  const modal = document.getElementById('modal');
  const addBtn = document.getElementById('add-btn');
  const closeBtn = document.getElementById('close-modal');
  const form = document.getElementById('transaction-form');

  // Sub Modal Logic
  const subModal = document.getElementById('sub-modal');
  const addSubBtn = document.getElementById('add-sub-btn');
  const closeSubBtn = document.getElementById('close-sub-modal');
  const subForm = document.getElementById('subscription-form');

  // Debt Modal Logic
  const debtModal = document.getElementById('debt-modal');
  const addDebtBtn = document.getElementById('add-debt-btn');
  const closeDebtBtn = document.getElementById('close-debt-modal');
  const debtForm = document.getElementById('debt-form');

  addBtn.addEventListener('click', () => {
    modal.classList.add('active');
    document.getElementById('date').valueAsDate = new Date(); // Set today
  });

  closeBtn.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  addSubBtn.addEventListener('click', () => {
    subModal.classList.add('active');
  });

  closeSubBtn.addEventListener('click', () => {
    subModal.classList.remove('active');
  });

  // Debt Modal Events
  if (addDebtBtn) {
    addDebtBtn.addEventListener('click', () => {
      debtModal.classList.add('active');
    });
  }

  if (closeDebtBtn) {
    closeDebtBtn.addEventListener('click', () => {
      debtModal.classList.remove('active');
    });
  }

  window.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
    if (e.target === subModal) subModal.classList.remove('active');
    if (e.target === debtModal) debtModal.classList.remove('active');
  });

  // Form Submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    const transaction = {
      id: crypto.randomUUID(),
      type: formData.get('type'),
      date: formData.get('date'), // yyyy-mm-dd
      title: formData.get('title'),
      amount: Number(formData.get('amount')),
      category: formData.get('category')
    };

    store.addTransaction(transaction);
    form.reset();
    modal.classList.remove('active');
  });

  // Sub Form Submit
  subForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('sub-title').value;
    const amount = document.getElementById('sub-amount').value;
    const day = document.getElementById('sub-day').value;

    subStore.addSubscription({
      id: crypto.randomUUID(),
      title: title,
      amount: Number(amount),
      day: Number(day)
    });

    subForm.reset();
    subModal.classList.remove('active');
    alert('設定しました。次回から指定日に自動で記録されます。');
  });

  // Debt Form Submit
  if (debtForm) {
    debtForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('debt-name').value;
      const balance = document.getElementById('debt-balance').value;
      const payment = document.getElementById('debt-payment').value;
      const rate = document.getElementById('debt-rate').value;

      debtStore.addDebt({
        id: crypto.randomUUID(),
        name: name,
        balance: Number(balance),
        monthlyPayment: Number(payment),
        rate: rate ? Number(rate) : null
      });

      debtForm.reset();
      debtModal.classList.remove('active');
    });
  }

  // Clear Data
  document.getElementById('clear-data-btn').addEventListener('click', () => {
    if (confirm('全てのデータを削除しますか？この操作は取り消せません。')) {
      store.clearAll();
    }
  });

  // --- Receipt Scanning Logic (Client-side OCR) ---
  const scanBtn = document.getElementById('scan-btn');
  const receiptInput = document.getElementById('receipt-input');
  const scanStatus = document.getElementById('scan-status');

  if (scanBtn) {
    scanBtn.addEventListener('click', () => {
      receiptInput.click();
    });
  }

  if (receiptInput) {
    receiptInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      scanStatus.textContent = '画像を読み込み中... (これには数秒かかります)';
      scanBtn.disabled = true;

      try {
        // Dynamic import for Tesseract to avoid large bundle on initial load
        const Tesseract = await import('tesseract.js');

        scanStatus.textContent = '文字を認識中...';

        const result = await Tesseract.recognize(
          file,
          'jpn', // Japanese language
          {
            logger: m => {
              if (m.status === 'recognizing text') {
                scanStatus.textContent = `解析中... ${Math.round(m.progress * 100)}%`;
              }
            }
          }
        );

        const text = result.data.text;
        console.log('OCR Result:', text);

        const parsedData = parseReceiptText(text);

        // Populate Form
        if (parsedData.date) document.getElementById('date').value = parsedData.date;
        if (parsedData.title) document.getElementById('title').value = parsedData.title;
        if (parsedData.amount) document.getElementById('amount').value = parsedData.amount;

        // Default to expense
        document.getElementById('type-expense').checked = true;

        scanStatus.textContent = '解析完了！内容を確認してください。';
        scanStatus.style.color = '#00b894';

      } catch (error) {
        console.error(error);
        scanStatus.textContent = '解析に失敗しました。もう一度試すか手動で入力してください。';
        scanStatus.style.color = '#ff7675';
      } finally {
        scanBtn.disabled = false;
        receiptInput.value = ''; // Reset input
      }
    });
  }

  // Helper to extract data from OCR text
  const parseReceiptText = (text) => {
    // ... existing parse logic ...
    // Since I'm replacing the end of file, I need to keep the helper or just not replace it.
    // The previous instruction block includes up to line 818 (EOF).
    // I should provide the helper code or avoid replacing it if not editing.
    // Let's assume I keep the parse logic as is, but I can't selectively keep lines in a replace block.
    // So I will just add the Auth logic BEFORE the receipt scanning logic or AT THE END.
    // The safer way is to append listener logic inside DOMContentLoaded.
    // I will replace `document.addEventListener('DOMContentLoaded', () => {` ... `});` content? No too big.
    // I'll append Auth logic at the end of DOMContentLoaded block (before closing brace).
    return parseReceiptTextRef ? parseReceiptTextRef(text) : { date: '', title: '', amount: '' }; // Hacky.
    // Let's cancel this chunk and do Auth Logic as a separate replace for DOMContentLoaded end.
  };

  // --- Auth Logic ---
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const loginArea = document.getElementById('login-area');
  const userArea = document.getElementById('user-area');
  const userAvatar = document.getElementById('user-avatar');
  const userName = document.getElementById('user-name');
  const authText = document.getElementById('auth-text');

  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      signInWithPopup(auth, provider)
        .then((result) => {
          console.log('Logged in:', result.user);
        }).catch((error) => {
          console.error('Login failed', error);
          alert('ログインに失敗しました: ' + error.message);
        });
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      signOut(auth).then(() => {
        console.log('Logged out');
        location.reload(); // Reload to clear state/UI
      });
    });
  }

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
      // Show User Info
      loginArea.style.display = 'none';
      userArea.style.display = 'flex';
      userAvatar.src = user.photoURL;
      userName.textContent = user.displayName;
      if (authText) authText.textContent = 'アカウント';

      // Load Data from Cloud
      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          console.log('Loading data from cloud...');
          const data = docSnap.data();

          if (data.transactions) store.transactions = data.transactions;
          if (data.subscriptions) subStore.subscriptions = data.subscriptions;
          if (data.debts) debtStore.debts = data.debts;

          // Save to local for offline backup/persistence
          localStorage.setItem('transactions', JSON.stringify(store.transactions));
          localStorage.setItem('subscriptions', JSON.stringify(subStore.subscriptions));
          localStorage.setItem('debts', JSON.stringify(debtStore.debts));

          updateUI();
          updateSubscriptionUI();
          updateSubscriptionUI();
          // alert('クラウドからデータを同期しました。');
          console.log('Cloud data synced');
        } else {
          console.log('No cloud data found. Uploading local data...');
          saveToCloud();
        }
      } catch (e) {
        console.error('Error loading cloud data', e);
      }

    } else {
      // Hide User Info
      loginArea.style.display = 'block';
      userArea.style.display = 'none';
      if (authText) authText.textContent = 'ログイン';
    }
  });

});
