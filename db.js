/**
 * db.js - The Data Layer (Updated with Compatibility Fix)
 */

export const CATEGORIES = {
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

const DB_KEY = "wallet_app_v1";

// Internal State
let State = {
    accounts: [],
    transactions: [],
    preferences: { currency: "৳", pinHash: null, theme: "light" }
};

export const DB = {
    init: () => {
        const data = localStorage.getItem(DB_KEY);
        if (data) {
            try {
                const parsed = JSON.parse(data);
                // Merge to ensure structure exists even if old data is loaded
                State = { ...State, ...parsed, preferences: { ...State.preferences, ...parsed.preferences } };
            } catch (e) {
                console.error("Data corrupted, resetting.");
                DB.reset();
            }
        } else {
            // Default Data setup
            State.accounts = [
                { id: 'def1', name: 'Cash Wallet', type: 'Cash', balance: 0 },
                { id: 'def2', name: 'bKash Personal', type: 'Mobile', balance: 0 }
            ];
            State.transactions = [];
            DB.save();
        }
        return State;
    },

    save: () => {
        localStorage.setItem(DB_KEY, JSON.stringify(State));
    },

    reset: () => {
        localStorage.removeItem(DB_KEY);
        location.reload();
    },

    getAll: () => State,
    getTransactions: () => State.transactions,
    getAccounts: () => State.accounts,

    addTransaction: (txData) => {
        const newTx = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            ...txData
        };

        const accIndex = State.accounts.findIndex(a => a.id === newTx.accountId);
        if (accIndex > -1) {
            if (newTx.type === 'expense') State.accounts[accIndex].balance -= newTx.amount;
            else State.accounts[accIndex].balance += newTx.amount;
        }

        State.transactions.unshift(newTx);
        DB.save();
        return newTx;
    },

    deleteTransaction: (id) => {
        const tx = State.transactions.find(t => t.id === id);
        if (!tx) return;

        const accIndex = State.accounts.findIndex(a => a.id === tx.accountId);
        if (accIndex > -1) {
            if (tx.type === 'expense') State.accounts[accIndex].balance += tx.amount;
            else State.accounts[accIndex].balance -= tx.amount;
        }

        State.transactions = State.transactions.filter(t => t.id !== id);
        DB.save();
    },

    addAccount: (name) => {
        const newAcc = { 
            id: Date.now().toString(36) + Math.random().toString(36).substr(2), 
            name, 
            type: 'Bank', 
            balance: 0 
        };
        State.accounts.push(newAcc);
        DB.save();
    },

    formatMoney: (num) => {
        return new Intl.NumberFormat('en-BD', { 
            style: 'currency', 
            currency: 'BDT' 
        }).format(num);
    }
};

// Security Logic (Updated with Fallback)
export const Security = {
    getHash: () => State.preferences.pinHash,
    
    setPin: async (pin) => {
        const hash = await Security.hashPin(pin);
        State.preferences.pinHash = hash;
        DB.save();
    },

    verifyPin: async (inputPin) => {
        const hash = await Security.hashPin(inputPin);
        return hash === State.preferences.pinHash;
    },

    hashPin: async (pin) => {
        // CHECK: If crypto API is available (Secure Context / HTTPS)
        if (window.crypto && window.crypto.subtle) {
            try {
                const msgBuffer = new TextEncoder().encode(pin);
                const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            } catch (e) {
                console.warn("Crypto failed, using fallback");
            }
        }
        
        // FALLBACK: Simple encoding for local testing (File Protocol)
        // This ensures the app doesn't crash if you open it directly
        return btoa("wallet_simple_hash_" + pin);
    }
};
