import { DB, CATEGORIES } from './db.js';

// --- GLOBAL VARIABLES ---
window.Router = {};
window.Actions = {};
window.Views = {};

// ================= INITIALIZATION =================
window.onload = async () => {
    DB.init();            
    window.Router.init(); 
};

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
        if (confirm("DANGER: Wipe all data? This cannot be undone.")) {
            DB.reset();
        }
    },

    // --- GOOGLE SHEETS SYNC (Auto-Connected) ---
    backupToCloud: () => {
        const state = DB.getAll();
        
        // YOUR GOOGLE SCRIPT URL (Pre-filled)
        const scriptURL = "https://script.google.com/macros/s/AKfycbyPwqgAUPZORZjXwpQK2b9S1jYu_fW_XjJfi6EWTWtpY4Zo_-Qb7-3SBmrsHZ48yaRB/exec";

        const btn = document.getElementById('btn-sync');
        const originalText = btn.innerText;
        btn.innerText = "⏳ Syncing...";
        btn.disabled = true;

        // Send Data
        fetch(scriptURL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(state)
        })
        .then(() => {
            alert("✅ Synced to Google Sheets successfully!");
            btn.innerText = originalText;
            btn.disabled = false;
        })
        .catch(err => {
            alert("❌ Sync Failed. Check your internet connection.");
            console.error(err);
            btn.innerText = originalText;
            btn.disabled = false;
        });
    },

    // --- FILE HANDLING ---
    exportJSON: () => {
        const data = JSON.stringify(DB.getAll(), null, 2);
        const blob = new Blob([data], {type: "application/json"});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `ProWallet_Backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    },

    importJSON: (input) => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.accounts && data.transactions) {
                    if(confirm("Overwrite current data with this backup?")) {
                        localStorage.setItem('wallet_app_v1', JSON.stringify(data));
                        alert("Restored Successfully!");
                        location.reload();
                    }
                } else { alert("Invalid Backup File"); }
            } catch (err) { alert("Error reading file"); }
        };
        reader.readAsText(file);
        input.value = ''; 
    },

    // --- PDF PRINT (Fixed: Opens in New Window) ---
    exportPrint: () => {
        window.Views.closeModals();
        const transactions = DB.getTransactions();
        const accounts = DB.getAccounts();
        const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
        const date = new Date().toLocaleDateString();

        let rows = transactions.map(t => {
            const acc = accounts.find(a => a.id === t.accountId)?.name || 'Unknown';
            return `
                <tr>
                    <td>${t.date}</td>
                    <td>${t.category}</td>
                    <td>${acc}</td>
                    <td>${t.note}</td>
                    <td style="color:${t.type === 'expense'?'red':'green'}; text-align:right;">
                        ${t.type === 'expense' ? '-' : '+'} ${DB.formatMoney(t.amount)}
                    </td>
                </tr>`;
        }).join('');

        const html = `<html><head><title>ProWallet Report</title><style>
            body{font-family:sans-serif;padding:20px;}
            table{width:100%;border-collapse:collapse;margin-top:20px;}
            th,td{border:1px solid #ddd;padding:10px;text-align:left;}
            th{background:#f4f4f4;}
            .summary{margin-bottom:20px;padding:15px;background:#f9f9f9;border:1px solid #eee;}
            </style></head><body>
            <h2 style="text-align:center;color:#009688">ProWallet Report</h2>
            <div class="summary" style="text-align:center;">
                <strong>Date:</strong> ${date} <br>
                <strong>Current Balance:</strong> ${DB.formatMoney(totalBalance)}
            </div>
            <table><thead><tr><th>Date</th><th>Category</th><th>Account</th><th>Note</th><th>Amount</th></tr></thead>
            <tbody>${rows}</tbody></table>
            <script>window.onload=()=>{window.print()}<\/script></body></html>`;
        
        // This opens a POPUP window, ensuring your main app doesn't freeze
        const win = window.open('', '_blank', 'width=900,height=700');
        win.document.write(html);
        win.document.close();
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
                    </div>
                `;
            });
        }
        html += `</div>`;
        document.getElementById('main-container').innerHTML = html;
    },

    renderAccounts: () => {
        const accounts = DB.getAccounts();
        let html = `<h2>Accounts Management</h2>
            <button class="btn-primary" onclick="Actions.addAccount()" style="margin-bottom:20px;">+ New Account</button>
            <div class="card" style="padding:0;">
                <table style="width:100%; border-collapse:collapse;">
                    <tr style="background:#f9f9f9; text-align:left;">
                        <th style="padding:15px;">Name</th>
                        <th style="padding:15px;">Balance</th>
                    </tr>
                    ${accounts.map(a => `
                        <tr style="border-bottom:1px solid #eee;">
                            <td style="padding:15px;">${a.name}</td>
                            <td style="padding:15px; font-weight:bold;">${DB.formatMoney(a.balance)}</td>
                        </tr>
                    `).join('')}
                </table>
            </div>
        `;
        document.getElementById('main-container').innerHTML = html;
    },

    renderSettings: () => {
        document.getElementById('modal-settings').classList.add('open');
    },
    
    renderPrintView: () => {
        // Handled by exportPrint
    }
};

function renderTxItem(t) {
    const isExp = t.type === 'expense';
    const colorClass = isExp ? 'exp' : 'inc';
    const sign = isExp ? '-' : '+';
    const accounts = DB.getAccounts();
    const accName = accounts.find(a => a.id === t.accountId)?.name || 'Unknown';
    
    return `
        <div class="tx-item">
            <div style="display:flex; align-items:center;">
                <div class="tx-icon">💳</div>
                <div class="tx-info">
                    <div style="font-weight:600;">${t.category}</div>
                    <div class="text-sm">${t.subcategory} • ${t.date}</div>
                    <div class="text-sm" style="font-size:11px;">${accName}</div>
                </div>
            </div>
            <div style="text-align:right;">
                <div class="tx-amount ${colorClass}">${sign} ${DB.formatMoney(t.amount)}</div>
                <button class="btn-icon" style="font-size:14px;" onclick="Actions.deleteTx('${t.id}')">🗑️</button>
            </div>
        </div>
    `;
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}
