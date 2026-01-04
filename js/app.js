import { DB, Security, CATEGORIES } from './db.js';

// --- GLOBAL VARIABLES FOR UI ---
window.Auth = {};
window.Router = {};
window.Actions = {};
window.Views = {};

// ================= INITIALIZATION =================
window.onload = async () => {
    DB.init(); // Load data from LocalStorage
    await Auth.check(); // Check if PIN is needed
};

// ================= AUTH (SECURITY) =================
let inputBuffer = '';

window.Auth = {
    check: async () => {
        if (Security.getHash()) {
            document.getElementById('auth-title').innerText = "Enter PIN to Unlock";
            document.getElementById('auth-desc').innerText = "Secure Access";
        } else {
            document.getElementById('auth-title').innerText = "Setup New PIN";
            document.getElementById('auth-desc').innerText = "Create a 4-digit PIN";
        }
    },

    input: (num) => {
        if (inputBuffer.length < 4) {
            inputBuffer += num;
            updateAuthDots();
        }
        if (inputBuffer.length === 4) processAuth();
    },

    clear: () => {
        inputBuffer = '';
        updateAuthDots();
    },

    logout: () => location.reload()
};

function updateAuthDots() {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((d, i) => {
        if (i < inputBuffer.length) d.classList.add('filled');
        else d.classList.remove('filled');
    });
}

async function processAuth() {
    if (!Security.getHash()) {
        await Security.setPin(inputBuffer);
        unlockApp();
    } else {
        const isValid = await Security.verifyPin(inputBuffer);
        if (isValid) {
            unlockApp();
        } else {
            document.getElementById('auth-title').innerText = "Incorrect PIN";
            document.getElementById('auth-title').style.color = "#E53935";
            setTimeout(() => {
                window.Auth.clear();
                document.getElementById('auth-title').innerText = "Enter PIN to Unlock";
                document.getElementById('auth-title').style.color = "#263238";
            }, 1000);
        }
    }
}

function unlockApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    window.Router.init();
}

// ================= ACTIONS (CONTROLLER) =================
window.Actions = {
    addTransaction: (e) => {
        e.preventDefault();
        const type = document.getElementById('btn-exp').classList.contains('active') ? 'expense' : 'income';
        
        const txData = {
            type: type,
            amount: parseFloat(document.getElementById('inp-amt').value),
            date: document.getElementById('inp-date').value,
            category: document.getElementById('inp-cat').value,
            subcategory: document.getElementById('inp-sub').value,
            accountId: document.getElementById('inp-acc').value,
            note: document.getElementById('inp-note').value
        };

        DB.addTransaction(txData); 
        window.Views.closeModals();
        window.Router.refresh();
        showToast("Saved Successfully");
    },

    addAccount: () => {
        const name = prompt("Account Name (e.g., Bank Asia):");
        if (name) {
            DB.addAccount(name);
            window.Router.refresh();
        }
    },

    deleteTx: (id) => {
        if (confirm("Delete this record?")) {
            DB.deleteTransaction(id);
            window.Router.refresh();
        }
    },

    resetData: () => {
        if (confirm("DANGER: Wipe all data?")) DB.reset();
    },

    exportJSON: () => {
        const data = JSON.stringify(DB.getAll());
        const blob = new Blob([data], {type: "application/json"});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    },

    exportPrint: () => {
        window.Views.closeModals();
        window.Views.renderPrintView();
        setTimeout(() => window.print(), 500);
    }
};

// ================= ROUTER & VIEWS =================
window.Router = {
    init: () => window.Router.go('dashboard'),
    refresh: () => {
        const hash = window.location.hash || '#dashboard';
        window.Router.go(hash.replace('#', ''));
    },
    go: (route) => {
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        // Find the nav item that matches this route and activate it (simplified)
        const navMap = {'dashboard': 0, 'transactions': 1, 'analytics': 2, 'accounts': 3, 'settings': 4};
        const navs = document.querySelectorAll('aside .nav-item');
        if(navs[navMap[route]]) navs[navMap[route]].classList.add('active');

        if(route === 'dashboard') window.Views.renderDashboard();
        if(route === 'transactions') window.Views.renderTransactions();
        if(route === 'analytics') window.Views.renderAnalytics();
        if(route === 'accounts') window.Views.renderAccounts();
        if(route === 'settings') window.Views.renderSettings();
    }
};

window.Views = {
    setTxType: (type) => {
        document.getElementById('btn-exp').classList.toggle('active', type === 'expense');
        document.getElementById('btn-inc').classList.toggle('active', type === 'income');
        
        // Restore button colors
        document.getElementById('btn-exp').style.background = type === 'expense' ? 'var(--primary)' : 'transparent';
        document.getElementById('btn-exp').style.color = type === 'expense' ? 'white' : 'inherit';
        document.getElementById('btn-inc').style.background = type === 'income' ? 'var(--success)' : 'transparent';
        document.getElementById('btn-inc').style.color = type === 'income' ? 'white' : 'inherit';
    },

    openAddModal: () => {
        const selCat = document.getElementById('inp-cat');
        selCat.innerHTML = '<option value="">Select Category</option>';
        Object.keys(CATEGORIES).forEach(k => selCat.add(new Option(k, k)));

        const selAcc = document.getElementById('inp-acc');
        selAcc.innerHTML = '';
        DB.getAccounts().forEach(a => {
            selAcc.add(new Option(`${a.name} (${DB.formatMoney(a.balance)})`, a.id));
        });

        document.getElementById('inp-date').valueAsDate = new Date();
        window.Views.setTxType('expense');
        document.getElementById('modal-txn').classList.add('open');
    },

    updateSubCats: () => {
        const cat = document.getElementById('inp-cat').value;
        const selSub = document.getElementById('inp-sub');
        selSub.innerHTML = '';
        if(cat && CATEGORIES[cat]) {
            CATEGORIES[cat].forEach(s => selSub.add(new Option(s, s)));
        }
    },

    closeModals: () => {
        document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('open'));
        if(document.querySelector('.print-header').style.display === 'block') window.Router.go('dashboard');
    },

    // --- RESTORED ORIGINAL DESIGNS ---
    renderDashboard: () => {
        const accounts = DB.getAccounts();
        const transactions = DB.getTransactions();
        const total = accounts.reduce((sum, a) => sum + a.balance, 0);
        const recent = transactions.slice(0, 5);

        let html = `
            <div class="card" style="background: linear-gradient(135deg, var(--primary), var(--primary-dark)); color:white;">
                <div class="text-sm">Total Balance</div>
                <div class="text-lg currency" style="margin: 10px 0;">${DB.formatMoney(total)}</div>
                <div class="text-sm" style="opacity:0.8">Overview of all accounts</div>
            </div>

            <h3>Accounts</h3>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap:15px; margin-bottom:25px;">
                ${accounts.map(a => `
                    <div class="card" style="margin:0; padding:15px;">
                        <div class="text-sm">${a.name}</div>
                        <div style="font-weight:bold; font-size:1.1rem;">${DB.formatMoney(a.balance)}</div>
                    </div>
                `).join('')}
                <div class="card" style="margin:0; padding:15px; display:flex; align-items:center; justify-content:center; cursor:pointer; border:1px dashed #ccc;" onclick="Actions.addAccount()">
                    + Add
                </div>
            </div>

            <h3>Recent Transactions</h3>
            <div class="card" style="padding:0 20px;">
                ${recent.length ? '' : '<p style="padding:20px 0; color:#999;">No transactions found.</p>'}
                ${recent.map(t => renderTxItem(t)).join('')}
            </div>
        `;
        document.getElementById('main-container').innerHTML = html;
    },

    renderTransactions: () => {
        const list = DB.getTransactions();
        let html = `<h2>All Transactions</h2><div class="card" style="padding:0 20px;">`;
        html += list.length ? '' : '<p style="padding:20px 0; color:#999;">No records.</p>';
        html += list.map(t => renderTxItem(t)).join('');
        html += `</div>`;
        document.getElementById('main-container').innerHTML = html;
    },

    renderAnalytics: () => {
        const cats = {};
        let totalExp = 0;
        DB.getTransactions().filter(t => t.type === 'expense').forEach(t => {
            cats[t.category] = (cats[t.category] || 0) + t.amount;
            totalExp += t.amount;
        });

        let html = `<h2>Expense Analytics</h2><div class="card">`;
        if(totalExp === 0) html += `<p class="text-sm">No expense data.</p>`;
        else {
            Object.entries(cats).sort((a,b) => b[1] - a[1]).forEach(([cat, amt]) => {
                const pct = ((amt / totalExp) * 100).toFixed(1);
                html += `
                    <div class="bar-container">
                        <div class="bar-label">
                            <span>${cat}</span>
                            <span>${DB.formatMoney(amt)} (${pct}%)</span>
                        </div>
                        <div class="bar-track">
                            <div class="bar-fill" style="width:${pct}%"></div>
                        </div>
