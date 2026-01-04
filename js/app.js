import { DB, Security, CATEGORIES } from './db.js';

// --- GLOBAL VARIABLES FOR UI ---
// We attach these to 'window' so your HTML onclick="" attributes still work
window.Auth = {};
window.Router = {};
window.Actions = {};
window.Views = {};

// ================= INITIALIZATION =================
window.onload = async () => {
    DB.init();
    await Auth.check();
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
        // Setup Mode
        await Security.setPin(inputBuffer);
        unlockApp();
    } else {
        // Verify Mode
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

        DB.addTransaction(txData); // Call the DB!
        
        window.Views.closeModals();
        window.Router.refresh();
        showToast("Saved Successfully");
    },

    addAccount: () => {
        const name = prompt("Account Name (e.g., Bank Asia):");
        if (name) {
            DB.addAccount(name); // Call the DB!
            window.Router.refresh();
        }
    },

    deleteTx: (id) => {
        if (confirm("Delete this record?")) {
            DB.deleteTransaction(id); // Call the DB!
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
// (I am condensing this part as it relies on the DB getters now)

window.Router = {
    init: () => window.Router.go('dashboard'),
    refresh: () => {
        const hash = window.location.hash || '#dashboard';
        window.Router.go(hash.replace('#', ''));
    },
    go: (route) => {
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        if(route === 'dashboard') window.Views.renderDashboard();
        if(route === 'transactions') window.Views.renderTransactions();
        if(route === 'analytics') window.Views.renderAnalytics();
        if(route === 'accounts') window.Views.renderAccounts();
        if(route === 'settings') window.Views.renderSettings();
    }
};

window.Views = {
    currentTxType: 'expense',
    
    setTxType: (type) => {
        // (Copy UI toggle logic from original file here, or keep it simple)
        document.getElementById('btn-exp').classList.toggle('active', type === 'expense');
        document.getElementById('btn-inc').classList.toggle('active', type === 'income');
        // Add styling logic back if needed
    },

    openAddModal: () => {
        // Populate Categories from DB/Constants
        const selCat = document.getElementById('inp-cat');
        selCat.innerHTML = '<option value="">Select Category</option>';
        Object.keys(CATEGORIES).forEach(k => selCat.add(new Option(k, k)));

        // Populate Accounts from DB
        const selAcc = document.getElementById('inp-acc');
        selAcc.innerHTML = '';
        DB.getAccounts().forEach(a => {
            selAcc.add(new Option(`${a.name} (${DB.formatMoney(a.balance)})`, a.id));
        });

        document.getElementById('inp-date').valueAsDate = new Date();
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

    // --- RENDER FUNCTIONS (Use DB.get...) ---
    renderDashboard: () => {
        const accounts = DB.getAccounts();
        const transactions = DB.getTransactions();
        const total = accounts.reduce((sum, a) => sum + a.balance, 0);
        const recent = transactions.slice(0, 5);

        // ... (Insert your HTML generation code here using 'total' and 'recent') ...
        // Example:
        document.getElementById('main-container').innerHTML = `
            <div class="card" style="background: linear-gradient(135deg, var(--primary), var(--primary-dark)); color:white;">
                <div class="text-sm">Total Balance</div>
                <div class="text-lg currency" style="margin: 10px 0;">${DB.formatMoney(total)}</div>
            </div>
            <h3>Recent Transactions</h3>
            <div class="card">
                ${recent.map(t => renderTxItem(t)).join('')}
            </div>
        `;
    },

    renderTransactions: () => {
        const list = DB.getTransactions();
        document.getElementById('main-container').innerHTML = `
            <h2>All Transactions</h2>
            <div class="card">${list.map(t => renderTxItem(t)).join('')}</div>
        `;
    },

    renderAccounts: () => {
        const accounts = DB.getAccounts();
        // ... Generate HTML using 'accounts' ...
        document.getElementById('main-container').innerHTML = `
            <h2>Accounts</h2>
            <button class="btn-primary" onclick="Actions.addAccount()">+ Add</button>
            ${accounts.map(a => `<div>${a.name}: ${DB.formatMoney(a.balance)}</div>`).join('')}
        `;
    },
    
    renderAnalytics: () => {
         // Logic using DB.getTransactions()
         document.getElementById('main-container').innerHTML = "<h2>Analytics</h2><p>Coming soon...</p>"; 
    },

    renderSettings: () => {
        document.getElementById('modal-settings').classList.add('open');
    },
    
    renderPrintView: () => {
        // Logic using DB.getTransactions()
        // ...
    }
};

// Helper for HTML generation
function renderTxItem(t) {
    const isExp = t.type === 'expense';
    const sign = isExp ? '-' : '+';
    // We can't access DB easily inside map unless we pass accounts, 
    // so for now just show accountId or look it up before mapping.
    return `
        <div class="tx-item">
            <div>${t.category} <small>(${t.date})</small></div>
            <div class="${isExp ? 'exp' : 'inc'}">${sign} ${DB.formatMoney(t.amount)}</div>
            <button onclick="Actions.deleteTx('${t.id}')">X</button>
        </div>
    `;
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}
