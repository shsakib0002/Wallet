/**
 * SECURE WALLET BD - LOGIC + VIEWS (YNAB STYLE)
 */

// 1. CONFIGURATION & CONSTANTS
const DB_KEY = "wallet_bd_v1";
const CLIENT_ID = '837032535848-8qoo6tf9rs0ljs2srks5d8k791rjgqpc.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

const CATEGORIES = {
    "Transportation (Bangladesh)": ["Bus", "Train", "CNG / Auto Rickshaw", "Rickshaw", "Private Car", "Microbus", "Motorcycle", "Bicycle", "Launch / Ferry", "Ride Share (Uber / Pathao / Bolt)"],
    "Food": ["Fruits & Vegetables", "Meat & Fish", "Cooking", "Sauces & Pickles", "Dairy & Eggs", "Breakfast", "Snacks", "Beverages", "Frozen & Canned", "Diabetic Food", "Ice Cream"],
    "Cleaning Supplies": ["Dishwashing", "Laundry", "Toilet Cleaners", "Floor & Glass", "Air Fresheners", "Trash Bags", "Shoe Care"],
    "Home & Kitchen": ["Kitchen Accessories", "Appliances", "Tools & Hardware", "Lights & Electrical", "Gardening", "Organizer"],
    "Baby Care": ["Diapers", "Baby Food", "Skincare", "Oral Care", "Newborn Essentials"],
    "Personal Care": ["Men's Care", "Women's Care", "Handwash", "Oral Care", "Skin Care", "Hair Products"],
    "Stationery & Office": ["Writing", "Printing", "Paper Supplies", "Office Electronics", "School Supplies"],
    "Pet Care": ["Cat Food", "Dog Food", "Grooming", "Accessories"],
    "Health & Wellness": ["Medicines", "Supplements", "Medical Devices", "Antiseptics", "Masks & Safety"],
    "Vehicle Essentials": ["Fuel", "Service", "Insurance", "Parking", "Toll", "Spare Parts"]
};

// 2. STATE MANAGEMENT
let State = { accounts: [], transactions: [], pinHash: null };
const Store = {
    load: () => {
        const raw = localStorage.getItem(DB_KEY);
        if (raw) { try { State = JSON.parse(raw); } catch(e){ Store.reset(); } }
        else {
            State.accounts = [{ id: '1', name: 'Cash Wallet', type: 'Cash', balance: 0 }, { id: '2', name: 'bKash', type: 'Mobile', balance: 0 }];
            State.transactions = [];
            Store.save();
        }
    },
    save: () => localStorage.setItem(DB_KEY, JSON.stringify(State)),
    reset: () => { localStorage.removeItem(DB_KEY); location.reload(); }
};

// 3. GOOGLE AUTH & SYNC (Identical Logic)
let tokenClient;
const GoogleAuth = {
    init: () => {
        if(!tokenClient) {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID, scope: SCOPES,
                callback: (response) => {
                    if (response.access_token) {
                        sessionStorage.setItem('g_access_token', response.access_token);
                        GoogleAuth.updateUI(true);
                    } else alert("Google Auth Failed");
                },
            });
        }
    },
    signIn: () => { if(tokenClient) tokenClient.requestAccessToken({ prompt: '' }); },
    signOut: () => {
        sessionStorage.removeItem('g_access_token');
        const token = google.accounts.oauth2.getToken();
        if (token) google.accounts.oauth2.revoke(token.access_token);
        GoogleAuth.updateUI(false);
    },
    checkSession: () => GoogleAuth.updateUI(!!sessionStorage.getItem('g_access_token')),
    updateUI: (isSignedIn) => {
        const authDiv = document.getElementById('g-auth-section');
        const syncDiv = document.getElementById('g-sync-section');
        if (isSignedIn) {
            document.getElementById('btn-g-login').style.display = 'none';
            document.getElementById('btn-g-logout').style.display = 'inline-block';
            syncDiv.style.display = 'block';
            const savedId = localStorage.getItem('g_sheet_id');
            if(savedId) document.getElementById('inp-sheet-id').value = savedId;
        } else {
            document.getElementById('btn-g-login').style.display = 'inline-block';
            document.getElementById('btn-g-logout').style.display = 'none';
            syncDiv.style.display = 'none';
        }
    }
};

const GoogleSync = {
    setStatus: (msg, type) => {
        const el = document.getElementById('sync-status-msg');
        el.innerHTML = msg;
        el.style.color = type === 'success' ? 'green' : type === 'loading' ? 'blue' : 'red';
    },
    appendData: async (sheetId, range, data) => {
        const token = sessionStorage.getItem('g_access_token');
        if(!token) throw new Error("Not Logged In");
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: data })
        });
        if (!response.ok) { const err = await response.json(); throw new Error(err.error.message); }
        return await response.json();
    },
    syncAll: async () => {
        const sheetId = document.getElementById('inp-sheet-id').value.trim();
        if(!sheetId) return alert("Please enter a valid Google Sheet ID");
        GoogleSync.setStatus("Syncing...", "loading");
        try {
            const txRows = State.transactions.map(t => [t.date, t.category, t.subcategory, t.amount, State.accounts.find(a => a.id == t.accountId)?.name || 'Unknown', t.type, new Date().toISOString()]);
            if(txRows.length > 0) await GoogleSync.appendData(sheetId, "Transactions", txRows);
            const accRows = State.accounts.map(a => [a.name, a.balance, new Date().toISOString()]);
            await GoogleSync.appendData(sheetId, "Accounts", accRows);
            await GoogleSync.appendData(sheetId, "Metadata", [["Last Sync", new Date().toISOString()], ["Total Transactions", State.transactions.length]]);
            GoogleSync.setStatus("Sync Complete!", "success");
            localStorage.setItem('g_sheet_id', sheetId);
        } catch (error) {
            console.error(error);
            GoogleSync.setStatus("Error: " + error.message, "error");
        }
    }
};

// 4. APP AUTH (PIN)
const Auth = {
    buffer: "",
    init: async () => {
        Store.load(); GoogleAuth.checkSession();
        if (State.pinHash) document.getElementById('auth-title').innerText = "Enter PIN to Unlock";
        else document.getElementById('auth-title').innerText = "Setup Security PIN";
    },
    enter: (num) => {
        if (Auth.buffer.length < 4) { Auth.buffer += num; Auth.updateDots(); }
        if (Auth.buffer.length === 4) Auth.verify();
    },
    clear: () => { Auth.buffer = ""; Auth.updateDots(); },
    updateDots: () => document.querySelectorAll('.pin-dot').forEach((d, i) => d.classList.toggle('filled', i < Auth.buffer.length)),
    verify: async () => {
        const hash = await App.hash(Auth.buffer);
        if (!State.pinHash) { State.pinHash = hash; Store.save(); Auth.unlock(); }
        else {
            if (hash === State.pinHash) Auth.unlock();
            else {
                document.getElementById('auth-title').innerText = "Incorrect PIN";
                setTimeout(() => { Auth.clear(); document.getElementById('auth-title').innerText = "Enter PIN to Unlock"; }, 1000);
            }
        }
    },
    unlock: () => {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app').style.display = 'flex';
        GoogleAuth.init();
        Router.go('dashboard');
    },
    logout: () => location.reload()
};

// 5. CORE LOGIC
const App = {
    currentType: 'expense',
    hash: async (str) => {
        const buf = new TextEncoder().encode(str);
        const hashBuf = await crypto.subtle.digest('SHA-256', buf);
        const hashArr = Array.from(new Uint8Array(hashBuf));
        return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
    },
    formatMoney: (num) => new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT' }).format(num),
    
    openTxModal: () => {
        const catSel = document.getElementById('inp-cat');
        catSel.innerHTML = '<option value="">Select Category</option>';
        Object.keys(CATEGORIES).forEach(k => catSel.add(new Option(k, k)));
        const accSel = document.getElementById('inp-acc-from');
        const toSel = document.getElementById('inp-acc-to');
        accSel.innerHTML = ''; toSel.innerHTML = '';
        State.accounts.forEach(a => {
            const opt = `${a.name} (${App.formatMoney(a.balance)})`;
            accSel.add(new Option(opt, a.id));
            toSel.add(new Option(a.name, a.id));
        });
        document.getElementById('inp-date').valueAsDate = new Date();
        App.setTxType('expense');
        document.getElementById('modal-tx').style.display = 'flex';
    },
    setTxType: (type) => {
        App.currentType = type;
        const isExp = type === 'expense'; const isInc = type === 'income'; const isTrf = type === 'transfer';
        document.getElementById('fields-cat').style.display = (isTrf) ? 'none' : 'block';
        document.getElementById('fields-to').style.display = (isTrf) ? 'block' : 'none';
        document.getElementById('btn-exp').className = `btn ${isExp?'btn-primary':'btn-outline'}`;
        document.getElementById('btn-inc').className = `btn ${isInc?'btn-primary':'btn-outline'}`;
        document.getElementById('btn-trf').className = `btn ${isTrf?'btn-primary':'btn-outline'}`;
    },
    updateSub: () => {
        const cat = document.getElementById('inp-cat').value;
        const sub = document.getElementById('inp-sub');
        sub.innerHTML = '';
        if(cat && CATEGORIES[cat]) CATEGORIES[cat].forEach(s => sub.add(new Option(s, s)));
    },
    submitTx: (e) => {
        e.preventDefault();
        const amt = parseFloat(document.getElementById('inp-amt').value);
        const date = document.getElementById('inp-date').value;
        const note = document.getElementById('inp-note').value;
        const fromAcc = document.getElementById('inp-acc-from').value;
        const toAcc = document.getElementById('inp-acc-to').value;
        const cat = document.getElementById('inp-cat').value;
        const sub = document.getElementById('inp-sub').value;
        
        const fromIdx = State.accounts.findIndex(a => a.id === fromAcc);
        const toIdx = State.accounts.findIndex(a => a.id === toAcc);

        if (App.currentType === 'transfer') {
            if (fromAcc === toAcc) return alert("Cannot transfer to same account");
            if (State.accounts[fromIdx].balance < amt) return alert("Insufficient funds");
            State.accounts[fromIdx].balance -= amt;
            State.accounts[toIdx].balance += amt;
            State.transactions.unshift({
                id: Date.now(), date, type: 'transfer', amount: amt, accountId: fromAcc,
                category: 'Transfer', subcategory: `To: ${State.accounts[toIdx].name}`, note
            });
        } else {
            const targetIdx = App.currentType === 'expense' ? fromIdx : toIdx;
            const targetId = App.currentType === 'expense' ? fromAcc : toAcc;
            if (App.currentType === 'expense') {
                if (State.accounts[targetIdx].balance < amt) return alert("Insufficient funds");
                State.accounts[targetIdx].balance -= amt;
            } else {
                State.accounts[targetIdx].balance += amt;
            }
            State.transactions.unshift({
                id: Date.now(), date, type: App.currentType, amount: amt, accountId: targetId,
                category: cat, subcategory: sub, note
            });
        }
        Store.save();
        App.closeModals();
        Router.refresh();
    },
    submitAcc: (e) => {
        e.preventDefault();
        const name = document.getElementById('acc-name').value;
        const type = document.getElementById('acc-type').value;
        const bal = parseFloat(document.getElementById('acc-bal').value);
        State.accounts.push({ id: Date.now().toString(), name, type, balance: bal });
        Store.save();
        App.closeModals();
        Router.refresh();
    },
    deleteTx: (id) => {
        if(!confirm("Delete this transaction?")) return;
        const tx = State.transactions.find(t => t.id == id);
        const acc = State.accounts.find(a => a.id === tx.accountId);
        if(acc) {
            if (tx.type === 'expense') acc.balance += tx.amount;
            else if (tx.type === 'income') acc.balance -= tx.amount;
            else if (tx.type === 'transfer') { alert("Transfer delete feature limit."); return; }
        }
        State.transactions = State.transactions.filter(t => t.id != id);
        Store.save();
        Router.refresh();
    },
    closeModals: () => document.querySelectorAll('.modal-overlay').forEach(el => el.style.display = 'none'),
    printReport: () => {
        App.closeModals();
        const date = new Date();
        document.getElementById('print-date').innerText = `Generated: ${date.toDateString()}`;
        const tbody = document.getElementById('print-body');
        tbody.innerHTML = State.transactions.map(t => {
            const accName = State.accounts.find(a => a.id == t.accountId)?.name || 'Unknown';
            return `<tr><td>${t.date}</td><td>${t.type.toUpperCase()}</td><td>${t.category}</td><td>${accName}</td><td>${App.formatMoney(t.amount)}</td></tr>`;
        }).join('');
        window.print();
    },
    reset: () => { if(confirm("DANGER: Delete all data?")) Store.reset(); }
};

// 6. VIEWS (YNAB STYLE)
const Views = {
    dashboard: () => {
        const total = State.accounts.reduce((s, a) => s + a.balance, 0);
        const recent = State.transactions.slice(0, 10);
        
        // Accounts List HTML
        const accHTML = State.accounts.map(a => `
            <div class="acc-box">
                <div>
                    <div style="font-weight:700; color:var(--text-main);">${a.name}</div>
                    <div class="text-light">${a.type}</div>
                </div>
                <div style="font-weight:700; color:var(--text-main); font-size:16px;">
                    ${App.formatMoney(a.balance)}
                </div>
            </div>
        `).join('');

        // Recent Transactions HTML
        const txHTML = recent.length ? recent.map(t => Views.txRow(t)).join('') : '<tr><td colspan="5" style="text-align:center; padding:20px;">No recent transactions</td></tr>';

        return `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h1>Dashboard</h1>
                <div class="card" style="background:var(--text-main); color:white; margin:0; padding:15px 25px;">
                    <div class="text-light" style="color:rgba(255,255,255,0.7); font-size:11px; text-transform:uppercase; letter-spacing:1px;">Total Balance</div>
                    <div style="font-size:24px; font-weight:700; margin-top:4px;">${App.formatMoney(total)}</div>
                </div>
            </div>

            <div style="display:flex; gap:20px; margin-bottom:20px; align-items:center;">
                <h2 style="margin:0;">My Accounts</h2>
                <button class="btn btn-primary" onclick="document.getElementById('modal-acc').style.display='flex'">+ Add Account</button>
            </div>

            <div class="grid-4" style="margin-bottom:40px;">
                ${accHTML}
            </div>

            <h2>Recent Transactions</h2>
            <div class="card" style="padding:0;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width:100px;">Date</th>
                            <th>Category</th>
                            <th>Account</th>
                            <th>Note</th>
                            <th style="text-align:right;">Amount</th>
                            <th style="width:50px;"></th>
                        </tr>
                    </thead>
                    <tbody>${txHTML}</tbody>
                </table>
            </div>
        `;
    },

    txRow: (t) => {
        const isExp = t.type === 'expense';
        const acc = State.accounts.find(a => a.id == t.accountId)?.name || 'Unknown';
        return `
            <tr>
                <td style="color:var(--text-light); font-size:12px;">${t.date}</td>
                <td>
                    <div style="font-weight:600;">${t.category}</div>
                    <div class="text-light" style="font-size:11px;">${t.subcategory || ''}</div>
                </td>
                <td class="text-light">${acc}</td>
                <td class="text-light">${t.note || '-'}</td>
                <td class="amount ${isExp ? 'exp' : 'inc'}">${isExp?'-':'+'}${App.formatMoney(t.amount)}</td>
                <td style="text-align:center;">
                    <button class="btn-text" onclick="App.deleteTx('${t.id}')" title="Delete">&times;</button>
                </td>
            </tr>
        `;
    },

    transactions: () => {
        const txHTML = State.transactions.map(t => Views.txRow(t)).join('');
        return `
            <h1>All Transactions</h1>
            <div class="card" style="padding:0;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th><th>Category</th><th>Account</th><th>Note</th><th style="text-align:right;">Amount</th><th></th>
                        </tr>
                    </thead>
                    <tbody>${txHTML}</tbody>
                </table>
            </div>
        `;
    },

    analytics: () => {
        const cats = {}; let total = 0;
        State.transactions.filter(t => t.type === 'expense').forEach(t => {
            cats[t.category] = (cats[t.category] || 0) + t.amount;
            total += t.amount;
        });
        const rows = Object.entries(cats).sort((a,b) => b[1]-a[1]).map(([k,v]) => {
            const pct = ((v/total)*100).toFixed(0);
            return `
            <div style="margin-bottom:20px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-weight:600; font-size:13px;">
                    <span>${k}</span>
                    <span>${App.formatMoney(v)} (${pct}%)</span>
                </div>
                <div style="height:8px; background:#eee; border-radius:4px; overflow:hidden;">
                    <div style="height:100%; background:var(--primary); width:${pct}%"></div>
                </div>
            </div>`;
        }).join('');
        return `<h1>Analytics</h1><div class="card">${rows || '<p class="text-light">No expense data available.</p>'}</div>`;
    },

    accounts: () => {
        return `
            <h1>Accounts</h1>
            <button class="btn btn-primary" style="margin-bottom:20px;" onclick="document.getElementById('modal-acc').style.display='flex'">+ New Account</button>
            <div class="grid-2">
                ${State.accounts.map(a => `
                    <div class="card">
                        <div style="font-size:13px; color:var(--text-light); text-transform:uppercase; letter-spacing:0.5px;">${a.type}</div>
                        <div style="font-size:20px; font-weight:700; margin:10px 0;">${a.name}</div>
                        <div style="font-size:24px; font-weight:700; color:var(--text-main);">${App.formatMoney(a.balance)}</div>
                    </div>
                `).join('')}
            </div>
        `;
    },
    settings: () => {
        document.getElementById('modal-set').style.display = 'flex';
        return '';
    }
};

// 7. ROUTER
const Router = {
    go: (view) => { document.getElementById('main-view').innerHTML = Views[view](); },
    refresh: () => Router.go('dashboard')
};

// INIT
Auth.init();
