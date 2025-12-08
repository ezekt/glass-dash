import './style.css';
import Chart from 'chart.js/auto';
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, isSameMonth } from 'date-fns';
import { ja } from 'date-fns/locale';

// --- State Management ---
class TransactionStore {
  constructor() {
    this.transactions = JSON.parse(localStorage.getItem('transactions')) || [];
    // If empty, add some dummy data for demo
    if (this.transactions.length === 0) {
      this.addTransaction({
        id: crypto.randomUUID(),
        date: format(new Date(), 'yyyy-MM-dd'),
        title: '初期データ: 給与',
        amount: 300000,
        type: 'income',
        category: 'salary'
      });
      this.addTransaction({
        id: crypto.randomUUID(),
        date: format(new Date(), 'yyyy-MM-dd'),
        title: '初期データ: 家賃',
        amount: 80000,
        type: 'expense',
        category: 'fixed'
      });
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
}

const store = new TransactionStore();

// --- UI Updates ---
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount);
};

const updateStats = () => {
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
};

const updateTransactionList = () => {
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
};

const getCategoryName = (cat) => {
  const map = {
    food: '食費', daily: '日用品', transport: '交通費', entertainment: '交際・娯楽',
    fixed: '固定費', salary: '給与', other: 'その他'
  };
  return map[cat] || cat;
};

// --- Chart ---
let revenueChart;
const initChart = () => {
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
};

const updateChart = () => {
  const { labels, data } = store.getChartData();
  revenueChart.data.labels = labels;
  revenueChart.data.datasets[0].data = data;
  revenueChart.update();
};

// --- Main Update Loop ---
const updateUI = () => {
  updateStats();
  updateTransactionList();
  updateChart();
};

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
  initChart();
  updateUI();

  // Modal Logic
  const modal = document.getElementById('modal');
  const addBtn = document.getElementById('add-btn');
  const closeBtn = document.getElementById('close-modal');
  const form = document.getElementById('transaction-form');

  addBtn.addEventListener('click', () => {
    modal.classList.add('active');
    document.getElementById('date').valueAsDate = new Date(); // Set today
  });

  closeBtn.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
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

  // Clear Data
  document.getElementById('clear-data-btn').addEventListener('click', () => {
    if (confirm('全てのデータを削除しますか？この操作は取り消せません。')) {
      store.clearAll();
    }
  });

  // Nav Logic
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
    });
  });

  // --- Receipt Scanning Logic (Client-side OCR) ---
  const scanBtn = document.getElementById('scan-btn');
  const receiptInput = document.getElementById('receipt-input');
  const scanStatus = document.getElementById('scan-status');

  scanBtn.addEventListener('click', () => {
    receiptInput.click();
  });

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

  // Helper to extract data from OCR text
  const parseReceiptText = (text) => {
    const lines = text.split(/\r\n|\n/);
    const data = { date: '', title: '', amount: '' };

    // 1. Date Extraction
    // Look for YYYY/MM/DD, YYYY-MM-DD, YYYY年MM月DD日
    const dateRegex = /(\d{4})[\/\-\.年]\s?(\d{1,2})[\/\-\.月]\s?(\d{1,2})/;
    const dateMatch = text.match(dateRegex);
    if (dateMatch) {
      const year = dateMatch[1];
      const month = dateMatch[2].padStart(2, '0');
      const day = dateMatch[3].padStart(2, '0');
      data.date = `${year}-${month}-${day}`;
    } else {
      // Fallback to today
      data.date = format(new Date(), 'yyyy-MM-dd');
    }

    // 2. Amount Extraction
    // Look for "合計", "小計", "お買上" followed by numbers
    // Or just look for the largest number that looks like a price
    let maxAmount = 0;
    const amountRegex = /[¥￥]?\s?([0-9,]+)/g;

    // Filter lines that might contain the total
    const totalKeywords = ['合計', '合', '計', '小計', 'お買上', '支払'];
    let foundTotalLine = false;

    for (const line of lines) {
      // Remove spaces for keyword check
      const cleanLine = line.replace(/\s/g, '');

      // Check for total keywords
      if (totalKeywords.some(k => cleanLine.includes(k))) {
        const matches = [...line.matchAll(amountRegex)];
        for (const match of matches) {
          const num = parseInt(match[1].replace(/,/g, ''), 10);
          if (!isNaN(num) && num > maxAmount) {
            maxAmount = num;
            foundTotalLine = true;
          }
        }
      }
    }

    // If no explicit "Total" line found, try to find the largest number in the whole text
    // (Riskier but better than nothing)
    if (!foundTotalLine || maxAmount === 0) {
      const allMatches = [...text.matchAll(amountRegex)];
      for (const match of allMatches) {
        const num = parseInt(match[1].replace(/,/g, ''), 10);
        // Basic sanity check: ignore phone numbers (usually start with 0 and long) or dates
        if (!isNaN(num) && num > 100 && num < 1000000) {
          if (num > maxAmount) maxAmount = num;
        }
      }
    }

    if (maxAmount > 0) {
      data.amount = maxAmount;
    }

    // 3. Title Extraction (Hardest part without AI)
    // Usually the first non-empty line, or lines containing "店"
    for (const line of lines) {
      const clean = line.trim();
      if (clean.length > 2 && !clean.match(/[\d\/\-\.]/)) {
        // Avoid lines that are just numbers or symbols
        data.title = clean;
        break; // Take the first valid looking line
      }
    }

    return data;
  };
});
