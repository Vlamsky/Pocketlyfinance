import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile, sendPasswordResetEmail, deleteUser, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, where, deleteDoc, doc, updateDoc, getDoc, getDocs, writeBatch, setDoc, increment, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getStorage, 
    ref as sRef, // Alias sRef agar tidak bentrok dengan ref database
    uploadBytes, 
    getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAh7Ocsq2DXjJsivyo5KUyzsEazgvZOJ3U",
  authDomain: "keuanganku-4b44c.firebaseapp.com",
  projectId: "keuanganku-4b44c",
  storageBucket: "keuanganku-4b44c.firebasestorage.app",
  messagingSenderId: "592535635578",
  appId: "1:592535635578:web:6ed1296f1f48358e9c5dc3"
};

const cachedUser = localStorage.getItem("firebase:authUser:" + firebaseConfig.apiKey + ":[DEFAULT]");
if (cachedUser) {
    const loader = document.getElementById('initialLoader');
    if(loader) loader.style.display = 'none';
}
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Expose PocketlyAuth for App Lock and security modules
window.PocketlyAuth = {
    get auth() { return auth; },
    get currentUser() { return auth.currentUser; },
    signOut: () => signOut(auth),
    verifyPassword: async (password) => {
        if (!auth.currentUser || !auth.currentUser.email) {
            throw new Error('NO_USER');
        }
        const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
        await reauthenticateWithCredential(auth.currentUser, credential);
        return true;
    }
};

let currentUser = null;
let isRegistering = false; 
let rawTransactions = [];
let rawBudgets = []; 
let accounts = [];
let rawFriends = []; 
let incomeChart = null;
let cashFlowChartInstance = null;
let spendingChartInstance = null;
let isLoginMode = true;
let isReturningToTransaction = false;
let isPrivacyMode = localStorage.getItem('pocketly_privacy_mode') === 'true';
let currentPage = 1;
const ITEMS_PER_PAGE = 20;
let currentCurrency = localStorage.getItem('pocketly_currency') || 'IDR';
let currentLocale = localStorage.getItem('pocketly_locale') || 'en-US';
let currentThemeAccent = localStorage.getItem('pocketly_theme_accent') || 'blue';
const defaultCategories = [
    "Food & Drink", "Transportation", "Shopping", "Beauty", 
    "Bills & Utilities", "Entertainment", "Health", "Education", 
    "Salary", "Investment", "Adjustment", "Transfer", "Others"
];
let userCategories = JSON.parse(localStorage.getItem('pocketly_categories')) || defaultCategories;
let exchangeRates = {
    'IDR': 1,
    'USD': 0.000064,  // Kurs estimasi: Rp 15.600
    'EUR': 0.000059   // Kurs estimasi: Rp 16.900
};
async function legacyFetchLiveRates() {
    try {
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/IDR');
        const data = await response.json();
        if(data && data.rates) {
            exchangeRates = data.rates;
            localStorage.setItem('pocketly_rates', JSON.stringify(data.rates));
            console.log("Rates updated:", exchangeRates);
        }
    } catch (error) {
        console.log("Using offline/cached rates");
        const cached = localStorage.getItem('pocketly_rates');
        if(cached) exchangeRates = JSON.parse(cached);
    }
}
const CATEGORY_ICONS = {
    "Food & Drink": "fa-burger",
    "Transportation": "fa-car",
    "Shopping": "fa-bag-shopping",
    "Beauty": "fa-wand-magic-sparkles",
    "Bills & Utilities": "fa-lightbulb",
    "Entertainment": "fa-film",
    "Health": "fa-pills",
    "Education": "fa-graduation-cap",
    "Salary": "fa-money-bill",
    "Investment": "fa-chart-line",
    "Others": "fa-box",
    "Adjustment": "fa-sliders",
    "Transfer": "fa-money-bill-transfer",
    "Financial Goal": "fa-bullseye"
};

const sidebar = document.getElementById('sidebar'); 
const mobileOverlay = document.getElementById('mobileOverlay'); 
const menuToggle = document.getElementById('menuToggle'); 
const closeSidebarBtn = document.getElementById('closeSidebarBtn');

const userMenu = document.getElementById('userPopupMenu');
const headerProfileTrigger = document.getElementById('headerProfileTrigger'); 
const mobileBottomNav = document.getElementById('mobileBottomNav');
const userTrigger = document.getElementById('userProfileTrigger');
const storage = getStorage(app);

window.toggleMenu = function() { 
    if(sidebar) sidebar.classList.toggle('active'); 
    if(mobileOverlay) mobileOverlay.classList.toggle('active'); 
}

if(menuToggle) menuToggle.addEventListener('click', window.toggleMenu); 
if(closeSidebarBtn) closeSidebarBtn.addEventListener('click', window.toggleMenu); 
if(mobileOverlay) mobileOverlay.addEventListener('click', window.toggleMenu);

document.querySelectorAll('.nav-link[data-target]').forEach(link => {
    link.onclick = (e) => { 
        e.preventDefault(); 
        
        // 1. Hapus class active dari semua link
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        
        // 2. Tambah class active ke link yang diklik
        link.classList.add('active');

        // 3. Pindah Halaman
        switchPage(link.dataset.target); 
        
        // 4. Tutup sidebar di mobile jika perlu
        if(window.innerWidth <= 768) window.toggleMenu(); 
    };
});

document.addEventListener('change', function(e) { 
    if (e.target && (e.target.id === 'yearFilter' || e.target.id === 'monthFilter' || 
        e.target.id === 'transSort' || e.target.id === 'transFilterType' || 
        e.target.id === 'transFilterAccount' || e.target.id === 'transFilterCategory')) {
        currentPage = 1; 
        updateDashboard();
    }
    
    if (e.target && e.target.id === 'inputType') {
        handleInputTypeChange(e.target.value);
    }
    if (e.target && e.target.id === 'inputAccount') {
        if(e.target.value === 'NEW_ACCOUNT') { 
            const transModal = document.getElementById('transactionModal');
            if(transModal) transModal.classList.remove('show'); 
            
            document.getElementById('accModalTitle').innerText = "Add Account"; 
            document.getElementById('btnSaveAcc').innerText = "Create"; 
            document.getElementById('editAccId').value = ""; 
            document.getElementById('accountForm').reset(); 
            document.getElementById('accountModal').classList.add('show'); 
            isReturningToTransaction = true; 
            e.target.value = ""; 
        }
    }
    if (e.target && (e.target.id === 'reportPeriod' || e.target.id === 'reportAccount')) {
        updateReportsPage();
    }
}); 

const searchInput = document.getElementById('searchTransaction');
if(searchInput) searchInput.addEventListener('input', () => {
    currentPage = 1;
    updateDashboard();
});

function setActiveNav(targetId) {
    // 1. Reset semua menu menjadi tidak aktif
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.b-nav-item').forEach(l => l.classList.remove('active'));

    // 2. Aktifkan menu Sidebar (Desktop) yang sesuai
    const sidebarLink = document.querySelector(`.nav-link[data-target="${targetId}"]`);
    if(sidebarLink) sidebarLink.classList.add('active');

    // 3. Aktifkan menu Bottom Dock (Mobile) yang sesuai
    const bottomLink = document.querySelector(`.b-nav-item[data-target="${targetId}"]`);
    if(bottomLink) bottomLink.classList.add('active');
}

window.switchPage = function(targetId, addToHistory = true) {
    if (targetId !== 'notifications') {
        window.lastVisitedPage = targetId;
    }
    // --- [PERBAIKAN UTAMA] Tutup semua popup sebelum pindah halaman ---
    closeAllModals(); 
    // ------------------------------------------------------------------

    // 1. Reset Navigasi
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.b-nav-item').forEach(l => l.classList.remove('active'));

    // 2. Aktifkan Menu Sidebar & Bottom Nav
    const sidebarLink = document.querySelector(`.nav-link[data-target="${targetId}"]`);
    if(sidebarLink) sidebarLink.classList.add('active');

    const bottomLink = document.querySelector(`.b-nav-item[data-target="${targetId}"]`);
    if(bottomLink) bottomLink.classList.add('active');

    // 3. Pindah Halaman (Sembunyikan lama, tampilkan baru)
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    const targetSection = document.getElementById(targetId);
    if(targetSection) targetSection.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 4. Update Judul Header
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        if (window.PocketlyI18n && typeof window.PocketlyI18n.getPageTitle === 'function') {
            pageTitle.innerText = window.PocketlyI18n.getPageTitle(targetId);
        } else {
            const titles = { 
                'dashboard': 'Dashboard', 
                'transactions': 'Transaction History', 
                'budget': 'Budget Plan', 
                'account': 'User Settings', 
                'reports': 'Analytics', 
                'connections': 'Connections',
                'languageSettings': 'Language'
            };
            if (titles[targetId]) pageTitle.innerText = titles[targetId];
        }
    }

    // 5. Logic Khusus Halaman Reports
    if (targetId === 'reports') {
        setTimeout(() => {
            if(typeof initReportFilters === 'function') initReportFilters();
            if(typeof updateReportsPage === 'function') updateReportsPage();
            if(typeof initCustomSelects === 'function') initCustomSelects();
        }, 50);
    }

    // 6. Kontrol Visibilitas Profil Header
    const profileTrigger = document.getElementById('headerProfileTrigger');
    if (profileTrigger) {
        profileTrigger.style.display = (targetId === 'dashboard') ? 'flex' : 'none';
    }

    // 7. Kontrol Filter & Notifikasi
    const sharedControls = document.getElementById('sharedControls');
    if (sharedControls) {
        if (targetId === 'transactions' && typeof currentTransactionView !== 'undefined' && currentTransactionView === 'calendar') {
            sharedControls.style.display = 'none';
        } else {
            sharedControls.style.display = (targetId === 'dashboard' || targetId === 'transactions') ? 'flex' : 'none';
        }
    }

    const analyticsControls = document.getElementById('analyticsControls');
    if (analyticsControls) {
        analyticsControls.style.display = (targetId === 'reports') ? 'flex' : 'none';
    }

    const notifCenterBtn = document.getElementById('btnOpenNotificationCenter');
    if (notifCenterBtn) {
        const primaryViews = ['dashboard', 'transactions', 'budget', 'reports'];
        notifCenterBtn.style.display = primaryViews.includes(targetId) ? 'inline-flex' : 'none';
    }
    const legacyGoalBtn = document.getElementById('btnOpenGoalInvites');
    if (legacyGoalBtn) {
        legacyGoalBtn.style.display = 'none';
    }
    if (window.PocketlyNotification && typeof window.PocketlyNotification.updateCenter === 'function') {
        window.PocketlyNotification.updateCenter();
    }

    // 7b. Sembunyikan top app header pada halaman Settings & subpages agar tidak dobel
    const settingsSubpages = ['account', 'connections', 'currencySettings', 'themeSettings', 'categorySettings', 'languageSettings', 'notifications'];
    const isSettings = settingsSubpages.includes(targetId);
    document.body.classList.toggle('is-settings-view', isSettings);
    const topAppHeader = document.querySelector('header');
    if (topAppHeader) {
        topAppHeader.style.display = isSettings ? 'none' : 'flex';
    }

    if (targetId === 'languageSettings' && window.PocketlyI18n && typeof window.PocketlyI18n.renderLanguagePage === 'function') {
        window.PocketlyI18n.renderLanguagePage();
    }

    if (targetId === 'notifications' && window.PocketlyNotification && typeof window.PocketlyNotification.updateCenter === 'function') {
        window.PocketlyNotification.updateCenter();
        window.PocketlyNotification.syncSettingsUI();
    }

    if (targetId === 'account' && window.PocketlyAppLock && typeof window.PocketlyAppLock.syncSettingsUI === 'function') {
        window.PocketlyAppLock.syncSettingsUI();
    }

    
    // 8. Refresh Dropdown Custom
    setTimeout(() => {
        if(typeof initCustomSelects === 'function') initCustomSelects();
    }, 100);

    // 9. Update History Browser
    if (addToHistory) {
        window.history.pushState({ pageId: targetId }, "", `#${targetId}`);
    }
};

if (headerProfileTrigger) {
    headerProfileTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        if(window.innerWidth <= 768) {
             const sidebar = document.getElementById('sidebar');
             if(sidebar && sidebar.classList.contains('active')) window.toggleMenu();
        }
        switchPage('account');
    });
}
window.addEventListener('popstate', (event) => {
    if (event.state && event.state.pageId) {
        switchPage(event.state.pageId, false);
    } else {
        const hash = window.location.hash.substring(1);
        if (hash) {
            switchPage(hash, false);
        } else {
            switchPage('dashboard', false);
        }
    }
});

if(userTrigger) {
    userTrigger.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        // Toggle class 'show' pada menu
        userMenu.classList.toggle('show'); 
        // Toggle class 'active' pada kartu profil (untuk rotasi panah)
        userTrigger.classList.toggle('active'); 
    });

    // Tutup menu jika klik di luar
    window.addEventListener('click', (e) => { 
        if (!userTrigger.contains(e.target) && !userMenu.contains(e.target)) { 
            userMenu.classList.remove('show'); 
            userTrigger.classList.remove('active'); 
        } 
    });
}

const btnLogout = document.getElementById('btnPopupLogout');
if(btnLogout) {
    const newBtnLogout = btnLogout.cloneNode(true);
    btnLogout.parentNode.replaceChild(newBtnLogout, btnLogout);

    newBtnLogout.addEventListener('click', (e) => { 
        e.preventDefault(); 

        if(userMenu) userMenu.classList.remove('show'); 

        showConfirm(
            "Sign Out?",                          
            "Are you sure you want to log out?",  
            "Sign Out",                           
            () => signOut(auth)                   
        ); 
    });
}
const btnConnections = document.getElementById('btnGoToConnections');
if(btnConnections) btnConnections.addEventListener('click', (e) => {
    e.preventDefault();
    if(userMenu) userMenu.classList.remove('show'); 
    if(userTrigger) userTrigger.classList.remove('active');
    switchPage('connections');

});

const btnSettings = document.getElementById('btnGoToSettings');
if(btnSettings) btnSettings.addEventListener('click', (e) => {
    e.preventDefault();
    if(userMenu) userMenu.classList.remove('show'); 
    if(userTrigger) userTrigger.classList.remove('active');
    switchPage('account');
});

async function loadUserProfile() {
    try {
        const docSnap = await getDoc(doc(db, "user_profiles", currentUser.uid));
        if (docSnap.exists()) {
            const data = docSnap.data();
            const displayName = data.displayName || currentUser.displayName || "User";
            // Ambil 2 huruf pertama sebagai inisial
            const initials = displayName.substring(0, Math.min(displayName.length, 2)).toUpperCase();
            
            const nameInput = document.getElementById('updateNameInput');
            if(nameInput) nameInput.value = displayName;

            const idInput = document.getElementById('updateUserID');
            if(idInput) idInput.value = data.userID || "";

            // --- BAGIAN PERBAIKAN PREVIEW MODAL ---
            const previewImg = document.getElementById('settingsUserAvatar');
            const previewInitials = document.getElementById('settingsProfileInitials');

            if (data.photoURL && previewImg && previewInitials) {
                // KASUS 1: User PUNYA FOTO
                previewImg.src = data.photoURL;      // Isi sumber gambar
                previewImg.style.display = 'block';  // Tampilkan gambar (menutupi inisial)
            } else if (previewInitials && previewImg) {
                // KASUS 2: User TIDAK PUNYA FOTO (Pakai Inisial)
                previewInitials.innerText = initials; // Isi teks inisial
                previewImg.style.display = 'none';    // Sembunyikan tag gambar
            }
            // ------------------------------------

            // Update Avatar di Header Dashboard (Pojok Kanan Atas)
            const headerAvatar = document.getElementById('headerAvatar');
            if (headerAvatar) {
                if (data.photoURL) {
                    headerAvatar.innerHTML = `<img src="${data.photoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                } else {
                    headerAvatar.innerText = initials;
                }
            }

            // Update Username Text
            const profileNameEl = document.getElementById('displayProfileName');
            if(profileNameEl) {
                profileNameEl.innerText = data.userID ? "@" + data.userID : displayName;
            }

            // Update Mini Avatar di Sidebar Desktop
            document.querySelectorAll('.user-avatar-mini').forEach(el => {
                if (data.photoURL) {
                    el.innerHTML = `<img src="${data.photoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                } else {
                    el.innerHTML = `<div class="default-avatar-mini">${initials}</div>`;
                }
            });
        }
    } catch (err) {
        console.log("Error loading profile:", err);
    }
}

let foundTargetUser = null; 

function listenToFriends() {
    const q = query(collection(db, "connections"), where("uid", "==", currentUser.uid));
    
    onSnapshot(q, (snapshot) => {
        rawFriends = [];
        
        snapshot.docs.forEach(doc => {
            rawFriends.push({ id: doc.id, ...doc.data() });
        });

        renderFriendsList(rawFriends);
    });
}

function renderFriendsList(data = rawFriends) {
    const listContainer = document.getElementById('friendsList');
    if(!listContainer) return;
    
    listContainer.innerHTML = '';
    const safeData = Array.isArray(data) ? data : (rawFriends || []);
    const tFunc = (window.PocketlyI18n && typeof window.PocketlyI18n.t === 'function')
        ? window.PocketlyI18n.t
        : (k, fb) => fb;

    if(safeData.length === 0) {
        listContainer.innerHTML = `
        <div class="con-empty-state">
            <div class="con-empty-icon"><i class="fa-solid fa-user-group"></i></div>
            <div class="con-empty-title">${tFunc('no_connections_yet', 'No connections yet')}</div>
            <div class="con-empty-sub">${tFunc('add_friends_sub', 'Add friends using their @userid')}</div>
        </div>`;
    } else {
        safeData.forEach(f => {
            let avatarHTML = f.photoURL 
                ? `<img src="${f.photoURL}" alt="${f.friendName || 'Friend'}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`
                : `<i class="fa-solid fa-user"></i>`;

            listContainer.innerHTML += `
            <div class="friend-glass-card">
                <button class="friend-card-remove-btn" onclick="deleteFriend('${f.id}')" title="${tFunc('remove_connection', 'Remove Connection')}" aria-label="${tFunc('remove_connection', 'Remove')}">
                    <i class="fa-solid fa-user-minus"></i>
                </button>
                <div class="friend-card-avatar">${avatarHTML}</div>
                <div class="friend-card-name" title="${f.friendName}">${f.friendName}</div>
                <div class="friend-card-id">@${f.friendID}</div>
                <div class="friend-status">
                    <i class="fa-solid fa-link" style="font-size:0.65rem;"></i> ${tFunc('friend_connected', 'Connected')}
                </div>
            </div>`;
        });
    }
}

const searchFriendInput = document.getElementById('searchFriend');
if (searchFriendInput) {
    searchFriendInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        
        const filtered = rawFriends.filter(f => 
            (f.friendName && f.friendName.toLowerCase().includes(term)) || 
            (f.friendID && f.friendID.toLowerCase().includes(term))
        );
        
        renderFriendsList(filtered);
    });
}

function listenToRequests() {
    const q = query(collection(db, "friend_requests"), 
        where("toUID", "==", currentUser.uid),
        where("status", "==", "pending")
    );

    onSnapshot(q, (snapshot) => {
        // Update Badge Tab
        const tabBadge = document.getElementById('tabRequestBadge');
        if (tabBadge) {
            tabBadge.innerText = snapshot.size;
            tabBadge.style.display = snapshot.empty ? 'none' : 'inline-block';
        }

        // Render ke Tab Requests
        const listContainer = document.getElementById('requestsListTab');
        
        // Update Badge Utama
        const mainBadge = document.getElementById('requestBadge');
        if(mainBadge) mainBadge.style.display = snapshot.empty ? 'none' : 'block';

        if (!listContainer) return;

        const tFunc = (window.PocketlyI18n && typeof window.PocketlyI18n.t === 'function')
            ? window.PocketlyI18n.t
            : (k, fb) => fb;

        if (snapshot.empty) {
            listContainer.innerHTML = `
            <div class="con-empty-state">
                <div class="con-empty-icon"><i class="fa-regular fa-bell-slash"></i></div>
                <div class="con-empty-title">${tFunc('no_pending_requests', 'No pending requests')}</div>
                <div class="con-empty-sub">${tFunc('invites_appear_here', 'Invitations will appear here')}</div>
            </div>`;
        } else {
            listContainer.innerHTML = ''; 
            snapshot.docs.forEach(doc => {
                const req = doc.data();
                
                let avatarHTML = req.fromPhoto 
                    ? `<img src="${req.fromPhoto}" alt="${req.fromName || 'User'}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`
                    : `<i class="fa-solid fa-user"></i>`;

                listContainer.innerHTML += `
                <div class="friend-glass-card">
                    <div class="friend-card-avatar" style="border-color:#3b82f6;">${avatarHTML}</div>
                    <div class="friend-card-name" title="${req.fromName}">${req.fromName}</div>
                    <div class="friend-card-id">@${req.fromID}</div>
                    
                    <div class="friend-request-actions">
                        <button class="btn-primary full-width con-action-btn con-confirm-btn" onclick="respondRequest('${doc.id}', 'accept', '${req.fromUID}', '${req.fromName}', '${req.fromID}', '${req.fromPhoto || ''}')">
                            <i class="fa-solid fa-check"></i> ${tFunc('btn_accept', 'Accept')}
                        </button>
                        <button class="btn-secondary full-width con-action-btn con-decline-btn" onclick="respondRequest('${doc.id}', 'reject')">
                            <i class="fa-solid fa-xmark"></i> ${tFunc('btn_decline', 'Decline')}
                        </button>
                    </div>
                </div>`;
            });
        }
    });
}

function listenToGoalInvites() {
    const q = query(collection(db, "goal_invites"), 
        where("toUID", "==", currentUser.uid),
        where("status", "==", "pending")
    );

    onSnapshot(q, (snapshot) => {
        if (window.PocketlyNotification) {
            window.PocketlyNotification.rawGoalInvites = snapshot.empty ? [] : snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            window.PocketlyNotification.updateCenter();
        }
        
        const badge = document.getElementById('goalInviteBadge');
        const listContainer = document.getElementById('modalGoalInviteList');

        if (snapshot.empty) {
            if(badge) badge.style.display = 'none'; 
            
            if(listContainer) {
                listContainer.innerHTML = `<p style="text-align:center; color:#999; padding:20px;">No new invitations.</p>`;
            }
        } else {
            if(badge) badge.style.display = 'block'; 
            
            if(listContainer) {
                listContainer.innerHTML = ''; 
                
                snapshot.docs.forEach(doc => {
                    const invite = doc.data();
                    
                    listContainer.innerHTML += `
                    <div class="friend-card invite-card-highlight">
                        <div class="friend-avatar">
                            <i class="fa-solid fa-bullseye"></i>
                        </div>
                        <div class="friend-info">
                            <h4 style="font-size:0.9rem;">Join "${invite.budgetName}"?</h4>
                            <span style="font-size:0.75rem;">Invited by: <b>${invite.fromName}</b></span>
                        </div>
                        
                        <div class="friend-actions" style="gap:8px; display: flex; align-items: center;">
                            <button class="btn-small" style="background:var(--green); color:white; border:none; width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:50%;" 
                                onclick="respondGoalInvite('${doc.id}', 'accept', '${invite.budgetID}', '${invite.budgetName}')" title="Join Goal">
                                <i class="fa-solid fa-check"></i>
                            </button>
                            <button class="btn-small" style="background:var(--red); color:white; border:none; width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:50%;" 
                                onclick="respondGoalInvite('${doc.id}', 'reject')" title="Ignore">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    </div>`;
                });
            }
        }
    });
}

window.respondGoalInvite = async (inviteID, action, budgetID, budgetName) => {
    try {
        const batch = writeBatch(db);
        const inviteRef = doc(db, "goal_invites", inviteID);

        if (action === 'accept') {
            const budgetRef = doc(db, "budgets", budgetID);

            const { arrayUnion } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            
            batch.update(budgetRef, {
                participants: arrayUnion(currentUser.uid)
            });

            batch.delete(inviteRef);
            
            await batch.commit();
            showAlert(`You have joined "${budgetName}"!`, false);
        } else {
            await deleteDoc(inviteRef);
            showAlert("Invitation removed.", false);
        }
    } catch (err) {
        console.error("Error responding invite:", err);
        showAlert("Error processing response.", true);
    }
};

function updateTotalNotificationBadge() {
    setTimeout(() => {
        const friendList = document.getElementById('modalRequestList');
        let realFriendCount = 0;
        if (friendList) {
             const isFriendEmpty = friendList.querySelector('p') !== null;
             realFriendCount = isFriendEmpty ? 0 : friendList.children.length;
        }

        const goalList = document.getElementById('modalGoalInviteList');
        let realGoalCount = 0;
        if (goalList) {
             const isGoalEmpty = goalList.querySelector('p') !== null;
             realGoalCount = isGoalEmpty ? 0 : goalList.children.length;
        }

        const total = realFriendCount + realGoalCount;
        const badge = document.getElementById('requestBadge');

        if (badge) {
            if (total > 0) {
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }

        const goalBadge = document.getElementById('goalInviteBadge');
        if (goalBadge) {
             if (realGoalCount > 0) {
                 goalBadge.style.display = 'block';
             } else {
                 goalBadge.style.display = 'none';
             }
        }

    }, 500); 
}

window.openRequestsModal = () => {
    document.getElementById('requestsModal').classList.add('show');
};

const reqClose = document.querySelector('.req-close');
if(reqClose) reqClose.onclick = () => document.getElementById('requestsModal').classList.remove('show');

document.getElementById('btnCheckUser').addEventListener('click', async () => {
    const targetID = document.getElementById('searchFriendID').value.trim().toLowerCase();
    const btnCheck = document.getElementById('btnCheckUser');
    const btnSend = document.getElementById('btnSendInvite');
    const resultArea = document.getElementById('searchResultArea');

    if(!targetID) return showAlert("Please enter a User ID", true);
    if(targetID === document.getElementById('updateUserID').value) return showAlert("You cannot invite yourself!", true);

    btnCheck.innerText = "Checking...";
    
    try {
        const q = query(collection(db, "user_profiles"), where("userID", "==", targetID));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            showAlert("User ID not found.", true);
            resultArea.style.display = 'none';
            btnSend.style.display = 'none';
            foundTargetUser = null;
        } else {
            const userDoc = snapshot.docs[0];
            foundTargetUser = { uid: userDoc.id, ...userDoc.data() };
            
            resultArea.style.display = 'block';
            document.getElementById('foundName').innerText = foundTargetUser.displayName;
            document.getElementById('foundID').innerText = "@" + foundTargetUser.userID;
            
            // UBAH DISINI: Avatar Hasil Pencarian
            if(foundTargetUser.photoURL) {
                document.getElementById('foundAvatar').innerHTML = `<img src="${foundTargetUser.photoURL}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            } else {
                // Gunakan innerHTML untuk memasukkan ikon
                document.getElementById('foundAvatar').innerHTML = `<i class="fa-solid fa-user" style="font-size: 1.5rem;"></i>`;
            }

            btnCheck.style.display = 'none';
            btnSend.style.display = 'block';
        }
    } catch (err) {
        console.error(err);
        showAlert("Error checking user.", true);
    } finally {
        btnCheck.innerText = "Check User";
    }
});
document.getElementById('friendForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!foundTargetUser) return;

    const btnSend = document.getElementById('btnSendInvite');
    const originalText = btnSend.innerText;
    
    try {
        btnSend.innerText = "Checking...";
        btnSend.disabled = true;

        const qConn = query(collection(db, "connections"), 
            where("uid", "==", currentUser.uid), 
            where("friendUID", "==", foundTargetUser.uid)
        );
        const snapConn = await getDocs(qConn);
        
        if (!snapConn.empty) {
            throw new Error("This user is already in your friend list!");
        }

        const qReqOut = query(collection(db, "friend_requests"), 
            where("fromUID", "==", currentUser.uid), 
            where("toUID", "==", foundTargetUser.uid),
            where("status", "==", "pending")
        );
        const snapReqOut = await getDocs(qReqOut);
        
        if (!snapReqOut.empty) {
            throw new Error("You already sent a request to this user.");
        }

        const qReqIn = query(collection(db, "friend_requests"), 
            where("fromUID", "==", foundTargetUser.uid), 
            where("toUID", "==", currentUser.uid),
            where("status", "==", "pending")
        );
        const snapReqIn = await getDocs(qReqIn);

        if (!snapReqIn.empty) {
            throw new Error("This user already invited you! Check your inbox.");
        }

        btnSend.innerText = "Sending...";

        const myProfileSnap = await getDoc(doc(db, "user_profiles", currentUser.uid));
        const myData = myProfileSnap.data();
        
        await addDoc(collection(db, "friend_requests"), {
            fromUID: currentUser.uid,
            fromName: currentUser.displayName,
            fromID: myData.userID || "unknown",
            fromPhoto: myData.photoURL || "",
            toUID: foundTargetUser.uid,
            status: 'pending',
            createdAt: new Date().toISOString()
        });

        showAlert("Invitation sent successfully!", false);
        document.getElementById('friendModal').classList.remove('show');
        
        document.getElementById('friendForm').reset();
        document.getElementById('searchResultArea').style.display = 'none';
        document.getElementById('btnCheckUser').style.display = 'block';
        document.getElementById('btnSendInvite').style.display = 'none';
        
    } catch(err) {
        showAlert(getFriendlyMessage(err), true);
    } finally {
        btnSend.innerText = originalText;
        btnSend.disabled = false;
    }
});

window.respondRequest = async (requestDocID, action, senderUID, senderName, senderID, senderPhoto) => {
    try {
        const batch = writeBatch(db);
        const requestRef = doc(db, "friend_requests", requestDocID);

        if (action === 'reject') {
            batch.delete(requestRef);
            await batch.commit();
            showAlert("Request rejected.", false);
        } 
        else if (action === 'accept') {
            const myConnRef = doc(collection(db, "connections"));
            batch.set(myConnRef, {
                uid: currentUser.uid,          
                friendUID: senderUID,          
                friendName: senderName,
                friendID: senderID,
                photoURL: senderPhoto,
                createdAt: new Date().toISOString()
            });

            const myProfileSnap = await getDoc(doc(db, "user_profiles", currentUser.uid));
            const myData = myProfileSnap.data();
            
            const friendConnRef = doc(collection(db, "connections"));
            batch.set(friendConnRef, {
                uid: senderUID,                
                friendUID: currentUser.uid,     
                friendName: currentUser.displayName,
                friendID: myData.userID || "unknown",
                photoURL: myData.photoURL || "",
                createdAt: new Date().toISOString()
            });

            batch.delete(requestRef);

            await batch.commit();
            showAlert(`You are now connected with ${senderName}!`, false);
        }
    } catch (err) {
        console.error(err);
        showAlert("Error processing request.", true);
    }
};

window.deleteFriend = (id) => {
    showConfirm(
        "Remove Connection?",                                              // 1. Judul
        "Unfriend this person? You will also be removed from their list.", // 2. Pesan
        "Unfriend",                                                        // 3. Teks Tombol Merah
        async () => {                                                      // 4. Callback (Aksi)
            try {
                const connRef = doc(db, "connections", id);
                const connSnap = await getDoc(connRef);
                
                if (!connSnap.exists()) {
                    showAlert("Connection not found/already deleted.", true);
                    return;
                }

                const connData = connSnap.data();
                const friendUID = connData.friendUID; 

                const batch = writeBatch(db);

                // Hapus koneksi di sisi kita
                batch.delete(connRef);

                // Cari dan hapus koneksi di sisi teman (Mirroring)
                const q = query(collection(db, "connections"), 
                    where("uid", "==", friendUID), 
                    where("friendUID", "==", currentUser.uid)
                );
                
                const reverseSnap = await getDocs(q);
                reverseSnap.forEach(doc => {
                    batch.delete(doc.ref); 
                });

                await batch.commit();
                
                showAlert("Friend removed successfully.", false);

            } catch (err) {
                console.error(err);
                showAlert("Error removing friend: " + err.message, true);
            }
        }
    );
};

window.openAddFriendModal = () => {
    document.getElementById('friendForm').reset();
    document.getElementById('searchResultArea').style.display = 'none';
    document.getElementById('btnCheckUser').style.display = 'block';
    document.getElementById('btnSendInvite').style.display = 'none';
    document.getElementById('friendModal').classList.add('show');
};

window.switchConnectionTab = function(tabName) {
    document.querySelectorAll('.con-tab').forEach(btn => btn.classList.remove('active'));
    const targetBtn = tabName === 'friends' ? document.getElementById('tabBtnFriends') : document.getElementById('tabBtnRequests');
    if (targetBtn) targetBtn.classList.add('active');

    document.querySelectorAll('.con-tab-content').forEach(content => content.classList.remove('active'));
    const targetContent = document.getElementById(`tab-${tabName}`);
    if (targetContent) targetContent.classList.add('active');
};

onAuthStateChanged(auth, (user) => {
    const loader = document.getElementById('initialLoader');
    const authScreen = document.getElementById('authScreen');
    const appScreen = document.getElementById('appScreen');

    try {
        if (isRegistering) return; 

        if (user) {
            currentUser = user;
            authScreen.style.display = 'none';
            appScreen.style.display = 'block';
            document.getElementById('authScreen').style.display = 'none';
            document.getElementById('appScreen').style.display = 'block';
            populateCategorySelects();
            fetchLiveRates();

            if(mobileBottomNav) {
                if(window.innerWidth <= 768) {
                    mobileBottomNav.style.display = 'flex'; 
                } else {
                    mobileBottomNav.style.display = 'none';
                }
            }
            
            // --- VARIABEL NAMA USER ---
            const dName = user.displayName || user.email.split('@')[0];
            
            // --- SINKRONISASI ELEMEN LAMA ANDA ---
            const headerAvatar = document.getElementById('headerAvatar');
            if(headerAvatar) {
                const initials = dName.substring(0, 2).toUpperCase();
                headerAvatar.innerText = initials;
            }

            const elUserDisplay = document.getElementById('userNameDisplay');
            if(elUserDisplay) elUserDisplay.innerText = dName;
            
            const elUpdateName = document.getElementById('updateNameInput');
            if(elUpdateName) elUpdateName.value = user.displayName || "";
            
            const elSidebarName = document.getElementById('sidebarUserName');
            if(elSidebarName) elSidebarName.innerText = dName;
            
            const elSidebarEmail = document.getElementById('sidebarUserEmail');
            if(elSidebarEmail) elSidebarEmail.innerText = user.email;

            const settingsNameEl = document.getElementById('settingsUserName');
            const settingsEmailEl = document.getElementById('settingsUserEmail');
            const settingsAvatarEl = document.getElementById('settingsUserAvatar');

            if (settingsNameEl) settingsNameEl.textContent = dName;
            if (settingsEmailEl) settingsEmailEl.textContent = user.email;
            
            if (settingsAvatarEl) {
                if (user.photoURL) {
                    settingsAvatarEl.src = user.photoURL;
                } else {
                    const fallbackName = encodeURIComponent(dName);
                    settingsAvatarEl.src = `https://ui-avatars.com/api/?name=${fallbackName}&background=3b82f6&color=fff&size=150`;
                }
            }
            initFilters(); 
            listenToAccounts(); 
            listenToTransactions(); 
            listenToBudgets(); 
            loadUserProfile(); 
            listenToFriends(); 
            listenToRequests();
            listenToGoalInvites();
            
            setTimeout(initCustomSelects, 500);

            const hash = window.location.hash.substring(1); 
            if (hash) {
                switchPage(hash, false);
            } else {
                switchPage('dashboard', false);
            }

            // App Lock: notify authenticated user session
            if (window.PocketlyAppLock && typeof window.PocketlyAppLock.onUserAuth === 'function') {
                window.PocketlyAppLock.onUserAuth(user);
            }
        } else {
            currentUser = null; 
            appScreen.style.display = 'none';
            authScreen.style.display = 'flex';
            if(mobileBottomNav) {
                mobileBottomNav.style.display = 'none';
            }
            if(window.history.pushState) window.history.pushState(null, null, window.location.href.split('#')[0]);

            // App Lock: dismiss lock overlay immediately on logout / unauthenticated
            if (window.PocketlyAppLock && typeof window.PocketlyAppLock.onSignOut === 'function') {
                window.PocketlyAppLock.onSignOut();
            }
        }
    } catch (error) {
        console.error("Auth State Error:", error);
    } finally {
        // FINALLY: Pastikan loader hilang apapun yang terjadi
        window.__pocketlyAppReady = true;
        if(loader) loader.style.display = 'none'; 
    }
});

let currentCaptchaAnswer = "";

function generateCaptcha() {
    const canvas = document.getElementById('captchaCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let captchaStr = '';
    for (let i = 0; i < 5; i++) {
        captchaStr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    currentCaptchaAnswer = captchaStr;
    ctx.fillStyle = 'rgba(255,255,255,0.0)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 22px "Outfit", sans-serif';
    ctx.fillStyle = '#64748b';
    for(let i=0; i<5; i++) {
        ctx.save();
        ctx.translate(15 + (i * 20), 28);
        ctx.rotate((Math.random() - 0.5) * 0.5);
        ctx.fillText(captchaStr[i], 0, 0);
        ctx.restore();
    }
    for(let i=0; i<4; i++){
        ctx.beginPath();
        ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
        ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
        ctx.strokeStyle = `rgba(100,116,139,0.3)`;
        ctx.stroke();
    }
}

const refreshCaptchaBtn = document.getElementById('refreshCaptchaBtn');
if (refreshCaptchaBtn) refreshCaptchaBtn.addEventListener('click', generateCaptcha);

document.getElementById('authForm').addEventListener('submit', async (e) => {
    e.preventDefault(); 
    const email = document.getElementById('email').value; 
    const password = document.getElementById('password').value; 
    const authBtn = document.getElementById('authBtn');
    const switchBtn = document.getElementById('switchBtn');
    const btnText = authBtn.querySelector('.btn-text');
    const btnArrow = authBtn.querySelector('.auth-btn-arrow');
    const btnSpin = authBtn.querySelector('.btn-loading-spin');
    
    try { 
        if (btnText) btnText.style.display = 'none';
        if (btnArrow) btnArrow.style.display = 'none';
        if (btnSpin) btnSpin.style.display = 'inline-block';
        authBtn.disabled = true;

        if(isLoginMode) {
            isRegistering = false;
            await signInWithEmailAndPassword(auth, email, password);
            localStorage.setItem('pocketly_last_user_email', email);
            saveBiometricCredentials(email, password);
        } else { 
            // --- BAGIAN REGISTER ---
            const fullName = document.getElementById('fullName').value; 
            const usernameInput = document.getElementById('regUsername').value.trim().toLowerCase();
            const confirmPass = document.getElementById('confirmPassword').value;
            const captchaInput = document.getElementById('captchaInput').value.trim();

            if(!fullName) throw new Error("Full Name is required."); 
            if(!usernameInput) throw new Error("Username is required.");
            if(password !== confirmPass) throw new Error(currentLocale === 'id-ID' ? "Kata sandi tidak cocok." : "Passwords do not match.");
            if(captchaInput.toLowerCase() !== currentCaptchaAnswer.toLowerCase()) {
                generateCaptcha();
                document.getElementById('captchaInput').value = '';
                throw new Error(currentLocale === 'id-ID' ? "Kode CAPTCHA salah, coba lagi." : "Incorrect CAPTCHA, please try again.");
            }

            // Validasi format username (huruf, angka, underscore saja)
            if (!/^[a-z0-9_]+$/.test(usernameInput)) {
                throw new Error("Username can only contain letters, numbers, and underscores (_).");
            }

            isRegistering = true; 

            // 1. DAFTAR AUTH DULU
            const cred = await createUserWithEmailAndPassword(auth, email, password);  
            saveBiometricCredentials(email, password);  
            
            try {
                // 2. SETELAH LOGIN, BARU CEK USERNAME DI DATABASE
                const q = query(collection(db, "user_profiles"), where("userID", "==", usernameInput));
                const snap = await getDocs(q);
                
                // 3. JIKA USERNAME SUDAH ADA
                if (!snap.empty) {
                    await deleteUser(cred.user);
                    throw new Error("Username is already taken! Please choose another.");
                }

                // 4. JIKA USERNAME AMAN, LANJUT SIMPAN PROFIL
                await updateProfile(cred.user, { displayName: fullName }); 

                await setDoc(doc(db, "user_profiles", cred.user.uid), {
                    uid: cred.user.uid,
                    displayName: fullName,
                    email: email,
                    userID: usernameInput, 
                    photoURL: "",
                    createdAt: new Date().toISOString()
                });

                await signOut(auth); 
                
                showAlert("Account created successfully! Please login.", false);
                
                if(switchBtn) switchBtn.click(); 
                document.getElementById('authForm').reset();
                document.getElementById('email').value = email; 
                
            } catch (innerError) {
                if (auth.currentUser) {
                    // Cleanup rollback if necessary
                }
                throw innerError;
            }
            
            setTimeout(() => { isRegistering = false; }, 1000);
        } 
    } catch (err) { 
        if (typeof window.triggerAuthShake === 'function') window.triggerAuthShake();
        showAlert(getFriendlyMessage(err), true); 
    } finally { 
        if (btnText) {
            btnText.style.display = 'inline';
            const lang = currentLocale === 'id-ID' ? 'id-ID' : 'en-US';
            const t = authTranslations[lang] || authTranslations['en-US'];
            btnText.innerText = isLoginMode ? t.authBtnLogin : t.authBtnRegister;
        }
        if (btnArrow) btnArrow.style.display = 'inline-block';
        if (btnSpin) btnSpin.style.display = 'none';
        authBtn.disabled = false;
    }
});

const authTranslations = {
    'id-ID': {
        authTitleLogin: "Masuk ke Pocketly",
        authTitleRegister: "Buat Akun",
        authSubtitle: "Kelola keuangan Anda dengan bijak.",
        authSubtitleLogin: "Kelola keuangan Anda dengan bijak.",
        authSubtitleRegister: "Mulai perjalanan finansial cerdas Anda.",
        authBtnLogin: "Masuk",
        authBtnRegister: "Daftar",
        switchTextLogin: "Belum punya akun? ",
        switchBtnLogin: "Buat Akun",
        switchTextRegister: "Sudah punya akun? ",
        switchBtnRegister: "Masuk",
        lblFullName: "Nama Lengkap",
        lblUserId: "ID Pengguna",
        lblEmail: "Alamat Email",
        lblPassword: "Kata Sandi",
        lblConfirmPass: "Konfirmasi Kata Sandi",
        lblCaptcha: "Verifikasi Anda Manusia",
        forgotPass: "Lupa Kata Sandi?",
        plFullName: "misal John Doe",
        plUserId: "username123",
        plEmail: "nama@email.com",
        plConfirmPass: "Ulangi kata sandi",
        plCaptcha: "Masukkan kode di atas",
        errEmailReq: "Tolong ketik email Anda di kolom Alamat Email di atas, lalu klik Lupa Kata Sandi lagi.",
        msgResetSent: "Link reset sudah dikirim ke email {email}. Cek email/spam Anda.",
        errEmailNotFound: "Email tidak ditemukan. Silakan cek penulisan atau daftar dulu.",
        errInvalidEmail: "Format email tidak valid.",
        errGeneral: "Error: "
    },
    'en-US': {
        authTitleLogin: "Login to Pocketly",
        authTitleRegister: "Create Account",
        authSubtitle: "Manage your finance wisely.",
        authSubtitleLogin: "Manage your finance wisely.",
        authSubtitleRegister: "Start your smart financial journey.",
        authBtnLogin: "Login",
        authBtnRegister: "Register",
        switchTextLogin: "New here? ",
        switchBtnLogin: "Create Account",
        switchTextRegister: "Already have an account? ",
        switchBtnRegister: "Login",
        lblFullName: "Full Name",
        lblUserId: "User ID",
        lblEmail: "Email Address",
        lblPassword: "Password",
        lblConfirmPass: "Confirm Password",
        lblCaptcha: "Verify you are human",
        forgotPass: "Forgot Password?",
        plFullName: "e.g. John Doe",
        plUserId: "username123",
        plEmail: "name@email.com",
        plConfirmPass: "Repeat password",
        plCaptcha: "Enter the code above",
        errEmailReq: "Please type your email in the Email Address field above, then click Forgot Password again.",
        msgResetSent: "Reset link sent to {email}. Check your inbox or spam folder.",
        errEmailNotFound: "Email not found. Please check your spelling or register.",
        errInvalidEmail: "Invalid email format.",
        errGeneral: "Error: "
    }
};

window.updateAuthLanguage = function() {
    const lang = currentLocale === 'id-ID' ? 'id-ID' : 'en-US';
    const t = authTranslations[lang];
    
    const authSubtitle = document.getElementById('authSubtitle');
    if (authSubtitle) authSubtitle.innerText = isLoginMode ? (t.authSubtitleLogin || t.authSubtitle) : (t.authSubtitleRegister || t.authSubtitle);
    const forgotLink = document.getElementById('forgotPasswordLink');
    if (forgotLink) forgotLink.innerText = t.forgotPass;
    
    const formLabels = document.querySelectorAll('#authForm label');
    if (formLabels.length >= 6) {
        formLabels[0].innerText = t.lblFullName;
        formLabels[1].innerText = t.lblUserId;
        formLabels[2].innerText = t.lblEmail;
        formLabels[3].innerText = t.lblPassword;
        formLabels[4].innerText = t.lblConfirmPass;
        formLabels[5].innerText = t.lblCaptcha;
    }
    
    const fnInput = document.getElementById('fullName');
    if (fnInput) fnInput.placeholder = t.plFullName;
    const unInput = document.getElementById('regUsername');
    if (unInput) unInput.placeholder = t.plUserId;
    const emInput = document.getElementById('email');
    if (emInput) emInput.placeholder = t.plEmail;
    const cpInput = document.getElementById('confirmPassword');
    if (cpInput) cpInput.placeholder = t.plConfirmPass;
    const capInput = document.getElementById('captchaInput');
    if (capInput) capInput.placeholder = t.plCaptcha;
    
    const authTitle = document.getElementById('authTitle');
    const authBtn = document.getElementById('authBtn');
    const switchText = document.getElementById('switchText');
    const switchBtn = document.getElementById('switchBtn');
    
    if (isLoginMode) { 
        if (authTitle) authTitle.innerText = t.authTitleLogin; 
        if (authBtn) {
            const btnText = authBtn.querySelector('.btn-text');
            if (btnText) btnText.innerText = t.authBtnLogin;
            else authBtn.innerHTML = `<span class="btn-text">${t.authBtnLogin}</span> <i class="fa-solid fa-arrow-right auth-btn-arrow"></i><span class="btn-loading-spin" style="display:none;"><i class="fa-solid fa-circle-notch fa-spin"></i></span>`;
        }
        if (switchText) switchText.innerText = t.switchTextLogin; 
        if (switchBtn) switchBtn.innerText = t.switchBtnLogin; 
    } else { 
        if (authTitle) authTitle.innerText = t.authTitleRegister; 
        if (authBtn) {
            const btnText = authBtn.querySelector('.btn-text');
            if (btnText) btnText.innerText = t.authBtnRegister;
            else authBtn.innerHTML = `<span class="btn-text">${t.authBtnRegister}</span> <i class="fa-solid fa-arrow-right auth-btn-arrow"></i><span class="btn-loading-spin" style="display:none;"><i class="fa-solid fa-circle-notch fa-spin"></i></span>`;
        }
        if (switchText) switchText.innerText = t.switchTextRegister; 
        if (switchBtn) switchBtn.innerText = t.switchBtnRegister; 
    }
};

window.setAuthMode = function(mode) {
    isLoginMode = (mode === 'login');
    const authForm = document.getElementById('authForm');
    if (authForm) {
        authForm.classList.toggle('is-login-mode', isLoginMode);
        authForm.classList.toggle('is-register-mode', !isLoginMode);
    }
    const tabLogin = document.getElementById('tabAuthLogin');
    const tabRegister = document.getElementById('tabAuthRegister');
    if (tabLogin && tabRegister) {
        tabLogin.classList.toggle('active', isLoginMode);
        tabRegister.classList.toggle('active', !isLoginMode);
    }
    const tabGlider = document.getElementById('authTabGlider');
    if (tabGlider) {
        tabGlider.style.transform = isLoginMode ? 'translate3d(0, 0, 0)' : 'translate3d(100%, 0, 0)';
    }
    
    // Smooth, gentle micro-feedback on brand badge (subtle pulse, zero rotation/blur)
    const brandBadge = document.getElementById('authBrandBadge');
    if (brandBadge) {
        brandBadge.classList.remove('badge-switch-active');
        void brandBadge.offsetWidth;
        brandBadge.classList.add('badge-switch-active');
        setTimeout(() => brandBadge.classList.remove('badge-switch-active'), 280);
    }
    const heroContent = document.querySelector('.auth-hero-content');
    if (heroContent) {
        heroContent.classList.remove('title-switch-active');
        void heroContent.offsetWidth;
        heroContent.classList.add('title-switch-active');
        setTimeout(() => heroContent.classList.remove('title-switch-active'), 240);
    }

    if (window.PocketlyAudio) {
        window.PocketlyAudio.playCardTap();
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate([15, 30, 20]); } catch(e) {}
    }

    const rowNameUser = document.getElementById('rowNameUser');
    const rowPassFields = document.getElementById('rowPassFields');
    const nameField = document.getElementById('nameField'); 
    const usernameField = document.getElementById('usernameField'); 
    const forgotRow = document.getElementById('forgotPassRow'); 
    const forgotLink = document.getElementById('forgotPasswordLink'); 
    const confirmPasswordField = document.getElementById('confirmPasswordField');
    const captchaField = document.getElementById('captchaField');
    const passMeter = document.getElementById('passStrengthMeter');
    const socialArea = document.getElementById('authSocialArea');
    if (socialArea) socialArea.style.display = 'none';
    
    if (isLoginMode) { 
        if (typeof window !== 'undefined' && window.scrollY > 20) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        if (rowNameUser) rowNameUser.style.display = "none";
        if (nameField) nameField.style.display = "none"; 
        if (usernameField) usernameField.style.display = "none"; 
        if (confirmPasswordField) confirmPasswordField.style.display = "none";
        if (captchaField) captchaField.style.display = "none";
        if (forgotRow) {
            forgotRow.style.display = "flex";
            forgotRow.classList.remove('forgot-row-fade-in');
            void forgotRow.offsetWidth;
            forgotRow.classList.add('forgot-row-fade-in');
        }
        if (forgotLink) forgotLink.style.display = "block";
        if (rowPassFields) rowPassFields.style.gridTemplateColumns = "1fr";
        if (passMeter) passMeter.style.display = "none";
    } else { 
        if (rowNameUser) {
            rowNameUser.style.display = "grid";
            rowNameUser.classList.remove('field-cascade-down');
            void rowNameUser.offsetWidth;
            rowNameUser.classList.add('field-cascade-down');
        }
        if (nameField) nameField.style.display = "block"; 
        if (usernameField) usernameField.style.display = "block"; 
        if (confirmPasswordField) {
            confirmPasswordField.style.display = "block";
            confirmPasswordField.classList.remove('field-slide-right');
            void confirmPasswordField.offsetWidth;
            confirmPasswordField.classList.add('field-slide-right');
        }
        if (captchaField) {
            captchaField.style.display = "block";
            captchaField.classList.remove('captcha-cascade-down');
            void captchaField.offsetWidth;
            captchaField.classList.add('captcha-cascade-down');
        }
        if (forgotRow) forgotRow.style.display = "none";
        if (forgotLink) forgotLink.style.display = "none";
        if (rowPassFields) rowPassFields.style.gridTemplateColumns = "";
        if (passMeter) {
            passMeter.style.display = "flex";
            passMeter.classList.remove('pass-meter-expand');
            void passMeter.offsetWidth;
            passMeter.classList.add('pass-meter-expand');
        }
        generateCaptcha();
    } 
    const backBtn = document.getElementById('authHeroBackBtn');
    if (backBtn) {
        backBtn.style.opacity = isLoginMode ? "0" : "1";
        backBtn.style.pointerEvents = isLoginMode ? "none" : "auto";
        backBtn.style.transform = isLoginMode ? "scale(0.85)" : "scale(1)";
    }
    if (typeof window.initBiometricAuthUI === 'function') {
        window.initBiometricAuthUI();
    }
    if (typeof window.updateAuthLanguage === 'function') {
        window.updateAuthLanguage();
    }
};

window.handleAuthBack = function() {
    if (!isLoginMode) {
        window.setAuthMode('login');
    }
};

const switchBtnEl = document.getElementById('switchBtn');
if (switchBtnEl) {
    switchBtnEl.addEventListener('click', (e) => { 
        e.preventDefault();
        window.setAuthMode(isLoginMode ? 'register' : 'login');
    });
}

// Shake form on error
window.triggerAuthShake = function() {
    const authForm = document.getElementById('authForm');
    if (authForm) {
        authForm.classList.remove('auth-shake-error');
        void authForm.offsetWidth;
        authForm.classList.add('auth-shake-error');
        setTimeout(() => authForm.classList.remove('auth-shake-error'), 550);
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate([40, 60, 40]); } catch(e) {}
    }
};

// 3D Parallax & Gyroscope Badge Tilt
(function initBadgeParallax() {
    function setupParallax() {
        const hero = document.querySelector('.auth-wave-hero');
        const badge = document.getElementById('authBrandBadge');
        if (!hero || !badge) return;
        const shine = badge.querySelector('.badge-glass-shine');

        function applyTilt(xRatio, yRatio) {
            const tiltX = -yRatio * 16;
            const tiltY = xRatio * 16;
            badge.style.transform = `perspective(600px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) scale(1.05)`;
            if (shine) {
                shine.style.transform = `translate(${tiltY * 2}px, ${tiltX * 2}px)`;
                shine.style.opacity = Math.min((Math.abs(xRatio) + Math.abs(yRatio)) * 0.8, 0.75);
            }
        }

        function resetTilt() {
            badge.style.transform = '';
            if (shine) shine.style.opacity = '0';
        }

        hero.addEventListener('mousemove', (e) => {
            const rect = hero.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;
            applyTilt(x * 2, y * 2);
        });

        hero.addEventListener('mouseleave', resetTilt);

        hero.addEventListener('touchmove', (e) => {
            if (!e.touches || !e.touches[0]) return;
            const touch = e.touches[0];
            const rect = hero.getBoundingClientRect();
            const x = (touch.clientX - rect.left) / rect.width - 0.5;
            const y = (touch.clientY - rect.top) / rect.height - 0.5;
            applyTilt(x * 2, y * 2);

            const blob1 = hero.querySelector('.liquid-blob.blob-1');
            const blob2 = hero.querySelector('.liquid-blob.blob-2');
            if (blob1) blob1.style.transform = `translate3d(${x * 30}px, ${y * 30}px, 0)`;
            if (blob2) blob2.style.transform = `translate3d(${-x * 25}px, ${-y * 25}px, 0)`;
        }, { passive: true });

        hero.addEventListener('touchend', resetTilt);

        if (window.DeviceOrientationEvent) {
            window.addEventListener('deviceorientation', (e) => {
                if (e.gamma == null || e.beta == null) return;
                const gammaRatio = Math.max(-1, Math.min(1, e.gamma / 30));
                const betaRatio = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
                applyTilt(gammaRatio, betaRatio);
            }, { passive: true });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupParallax);
    } else {
        setupParallax();
    }
})();

// Live Validation Indicator (Email)
(function initLiveEmailValidation() {
    function setupValidation() {
        const emailInput = document.getElementById('email');
        const indicator = document.getElementById('emailValidIndicator');
        if (!emailInput || !indicator) return;

        emailInput.addEventListener('input', () => {
            const val = emailInput.value.trim();
            const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
            indicator.classList.toggle('is-valid', isValid);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupValidation);
    } else {
        setupValidation();
    }
})();

// Password Strength Meter
(function initPasswordStrength() {
    function setupStrength() {
        const passInput = document.getElementById('password');
        const fill = document.getElementById('strengthFill');
        const label = document.getElementById('strengthLabel');
        if (!passInput || !fill || !label) return;

        passInput.addEventListener('input', () => {
            if (isLoginMode) return;
            const val = passInput.value;
            if (!val) {
                fill.style.width = '0%';
                label.innerText = 'Weak';
                label.style.color = 'var(--text-grey)';
                return;
            }

            let score = 0;
            if (val.length >= 8) score++;
            if (/[A-Z]/.test(val)) score++;
            if (/[0-9]/.test(val)) score++;
            if (/[^A-Za-z0-9]/.test(val)) score++;

            if (score <= 1) {
                fill.style.width = '25%';
                fill.style.background = '#ef4444';
                label.innerText = 'Weak';
                label.style.color = '#ef4444';
            } else if (score === 2) {
                fill.style.width = '50%';
                fill.style.background = '#f59e0b';
                label.innerText = 'Fair';
                label.style.color = '#f59e0b';
            } else if (score === 3) {
                fill.style.width = '75%';
                fill.style.background = '#3b82f6';
                label.innerText = 'Good';
                label.style.color = '#3b82f6';
            } else {
                fill.style.width = '100%';
                fill.style.background = '#10b981';
                label.innerText = 'Strong';
                label.style.color = '#10b981';
                if (window.PocketlyAudio) window.PocketlyAudio.playCardTap();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupStrength);
    } else {
        setupStrength();
    }
})();

// Biometric Credential Storage & Direct Login
function saveBiometricCredentials(email, password) {
    try {
        if (!email || !password) return;
        const payload = JSON.stringify({ email: email.trim(), password: password, t: Date.now() });
        const encoded = btoa(unescape(encodeURIComponent(payload)));
        localStorage.setItem('pocketly_biometric_credentials', encoded);
        localStorage.setItem('pocketly_biometric_enabled', 'true');
        localStorage.setItem('pocketly_last_user_email', email.trim());
    } catch (e) {
        console.warn('[Biometric] Save credentials error:', e);
    }
}

function getBiometricCredentials() {
    try {
        const raw = localStorage.getItem('pocketly_biometric_credentials');
        if (!raw) return null;
        const decoded = decodeURIComponent(escape(atob(raw)));
        const parsed = JSON.parse(decoded);
        if (parsed && parsed.email && parsed.password) {
            return parsed;
        }
    } catch (e) {
        console.warn('[Biometric] Parse credentials error:', e);
    }
    return null;
}

// Biometric Quick Login UI & Handler
window.initBiometricAuthUI = function() {
    const bioBtn = document.getElementById('btnBiometricLogin');
    if (!bioBtn) return;
    bioBtn.style.display = isLoginMode ? 'inline-flex' : 'none';
};

window.handleBiometricAuth = async function() {
    if (window.PocketlyAudio && typeof window.PocketlyAudio.playCardTap === 'function') {
        window.PocketlyAudio.playCardTap();
    }

    const creds = getBiometricCredentials();
    if (!creds || !creds.email || !creds.password) {
        const savedEmail = localStorage.getItem('pocketly_last_user_email') || localStorage.getItem('pocketly_saved_email');
        if (savedEmail) {
            const emailInput = document.getElementById('email');
            if (emailInput) {
                emailInput.value = savedEmail;
                const indicator = document.getElementById('emailValidIndicator');
                if (indicator) indicator.classList.add('is-valid');
            }
        }
        const msg = (typeof currentLocale !== 'undefined' && currentLocale === 'id-ID')
            ? "Silakan login dengan email & kata sandi terlebih dahulu satu kali untuk mengaktifkan login biometrik langsung."
            : "Please log in with your email & password once to enable direct biometric login.";
        if (typeof showAlert === 'function') showAlert(msg, true);
        const passInput = document.getElementById('password');
        if (passInput) passInput.focus();
        return;
    }

    // Direct Login Execution (Bypasses email, password, and PIN screen)
    const performDirectLogin = async () => {
        const authBtn = document.getElementById('authBtn');
        const btnText = authBtn ? authBtn.querySelector('.btn-text') : null;
        const btnArrow = authBtn ? authBtn.querySelector('.auth-btn-arrow') : null;
        const btnSpin = authBtn ? authBtn.querySelector('.btn-loading-spin') : null;

        try {
            if (btnText) btnText.style.display = 'none';
            if (btnArrow) btnArrow.style.display = 'none';
            if (btnSpin) btnSpin.style.display = 'inline-block';
            if (authBtn) authBtn.disabled = true;

            const emailInput = document.getElementById('email');
            const passInput = document.getElementById('password');
            if (emailInput) emailInput.value = creds.email;
            if (passInput) passInput.value = creds.password;

            // 1. Bypass PIN Lock: User already authenticated via Biometrics!
            if (window.PocketlyAppLock && typeof window.PocketlyAppLock.bypassNextLock === 'function') {
                window.PocketlyAppLock.bypassNextLock();
            }

            // 2. Direct Sign In via Firebase
            isRegistering = false;
            await signInWithEmailAndPassword(auth, creds.email, creds.password);

            if (window.PocketlyAudio && typeof window.PocketlyAudio.playSuccessChime === 'function') {
                window.PocketlyAudio.playSuccessChime();
            }

            // 3. Immediately ensure lock screen is hidden and app is unlocked
            if (window.PocketlyAppLock && typeof window.PocketlyAppLock.unlockApp === 'function') {
                window.PocketlyAppLock.unlockApp();
            }
        } catch (err) {
            console.error('[Biometric] Direct login failed:', err);
            const msg = (typeof currentLocale !== 'undefined' && currentLocale === 'id-ID')
                ? "Gagal login otomatis. Silakan masukkan kata sandi akun Anda."
                : "Automatic login failed. Please enter your account password.";
            if (typeof showAlert === 'function') showAlert(msg, true);
        } finally {
            if (btnText) btnText.style.display = '';
            if (btnArrow) btnArrow.style.display = '';
            if (btnSpin) btnSpin.style.display = 'none';
            if (authBtn) authBtn.disabled = false;
        }
    };

    // 1. Android Native BiometricPrompt (Fingerprint / Face ID)
    if (window.AndroidNative && typeof window.AndroidNative.authenticateBiometric === 'function') {
        window.__pocketlyBioCallback = function(success, errorMsg) {
            window.__pocketlyBioCallback = null;
            if (success) {
                performDirectLogin();
            } else if (errorMsg && errorMsg !== 'Gunakan PIN' && errorMsg !== 'User canceled') {
                if (typeof showAlert === 'function') showAlert(errorMsg, true);
            }
        };

        const title = (typeof currentLocale !== 'undefined' && currentLocale === 'id-ID') 
            ? 'Masuk ke Pocketly' 
            : 'Login to Pocketly';
        const subtitle = (typeof currentLocale !== 'undefined' && currentLocale === 'id-ID') 
            ? 'Sentuh sensor sidik jari atau gunakan Face ID untuk langsung masuk' 
            : 'Touch fingerprint sensor or use Face ID to log in directly';
        window.AndroidNative.authenticateBiometric(title, subtitle);
        return;
    }

    // 2. Web fallback (WebAuthn or simulation)
    if (window.PublicKeyCredential) {
        try {
            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);
            const options = {
                publicKey: {
                    challenge: challenge,
                    timeout: 60000,
                    userVerification: 'preferred'
                }
            };
            const assertion = await navigator.credentials.get(options);
            if (assertion) {
                performDirectLogin();
                return;
            }
        } catch (e) {
            console.debug('[Biometric] WebAuthn get fallback:', e.message);
        }
    }

    // Direct login fallback
    performDirectLogin();
};

// Social Login Handler
window.handleSocialLogin = function(provider) {
    if (window.PocketlyAudio) window.PocketlyAudio.playCardTap();
    showAlert(currentLocale === 'id-ID' 
        ? `Menghubungkan autentikasi ${provider}... Silakan gunakan email dan kata sandi akun Pocketly Anda.` 
        : `Connecting with ${provider}... Please use your Pocketly account email and password.`, false);
};

document.addEventListener('DOMContentLoaded', () => {
    window.updateAuthLanguage();
    if (typeof window.initBiometricAuthUI === 'function') {
        window.initBiometricAuthUI();
    }
    const lastEmail = localStorage.getItem('pocketly_last_user_email');
    if (lastEmail) {
        const emailInput = document.getElementById('email');
        if (emailInput && !emailInput.value) {
            emailInput.value = lastEmail;
            const indicator = document.getElementById('emailValidIndicator');
            if (indicator) indicator.classList.add('is-valid');
        }
    }
    if (!isLoginMode) generateCaptcha();
});
const changePasswordModal = document.getElementById('changePasswordModal');
const closeChangePasswordBtn = document.getElementById('closeChangePasswordBtn');
const saveNewPasswordBtn = document.getElementById('saveNewPasswordBtn');
const oldPasswordInput = document.getElementById('oldPasswordInput');
const newPasswordInput = document.getElementById('newPasswordInput');
const confirmNewPasswordInput = document.getElementById('confirmNewPasswordInput');

document.getElementById('btnChangePass').addEventListener('click', () => {
    oldPasswordInput.value = '';
    newPasswordInput.value = '';
    confirmNewPasswordInput.value = '';
    changePasswordModal.style.display = 'flex';
});

closeChangePasswordBtn.addEventListener('click', () => {
    changePasswordModal.style.display = 'none';
});

saveNewPasswordBtn.addEventListener('click', async () => {
    const oldPassword = oldPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmNewPassword = confirmNewPasswordInput.value;

    if (!oldPassword || !newPassword || !confirmNewPassword) {
        return showAlert('All fields are required.', true);
    }

    if (newPassword !== confirmNewPassword) {
        return showAlert('New passwords do not match.', true);
    }

    if (newPassword.length < 6) {
        return showAlert('Password should be at least 6 characters.', true);
    }

    const btn = saveNewPasswordBtn;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';
    btn.disabled = true;

    try {
        const credential = EmailAuthProvider.credential(currentUser.email, oldPassword);
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, newPassword);
        saveBiometricCredentials(currentUser.email, newPassword);
        
        changePasswordModal.style.display = 'none';
        showAlert('Password updated successfully.', false);
    } catch (err) {
        let msg = err.message;
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
            msg = 'Incorrect old password.';
        }
        showAlert(msg, true);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});

// In-app Forgot Password Handler
(() => {
    const inAppForgotBtn = document.getElementById('inAppForgotPasswordLink');
    if (inAppForgotBtn) {
        inAppForgotBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const changeModal = document.getElementById('changePasswordModal');
            if (changeModal) changeModal.style.display = 'none';

            const resetModal = document.getElementById('resetPasswordModal');
            const resetEmailInput = document.getElementById('resetEmail');
            const userEmail = (typeof currentUser !== 'undefined' && currentUser?.email) || (typeof auth !== 'undefined' && auth?.currentUser?.email) || '';
            if (resetEmailInput && userEmail) {
                resetEmailInput.value = userEmail;
            }
            if (resetModal) resetModal.classList.add('show');
        });
    }

    const resetForm = document.getElementById('resetPasswordForm');
    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('resetEmail');
            const email = emailInput?.value.trim();
            if (!email) return showAlert("Please enter your email.", true);

            const submitBtn = resetForm.querySelector('button[type="submit"]');
            const originalText = submitBtn ? submitBtn.innerText : 'Send Reset Link';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = 'Sending...';
            }

            try {
                await sendPasswordResetEmail(auth, email);
                const resetModal = document.getElementById('resetPasswordModal');
                if (resetModal) resetModal.classList.remove('show');
                showAlert(`Password reset link sent to ${email}. Check your inbox.`, false);
            } catch (err) {
                showAlert(err.message || "Failed to send reset link.", true);
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = originalText;
                }
            }
        });
    }

    const resetCloseBtn = document.querySelector('.r-close');
    if (resetCloseBtn) {
        resetCloseBtn.addEventListener('click', () => {
            const resetModal = document.getElementById('resetPasswordModal');
            if (resetModal) resetModal.classList.remove('show');
        });
    }
})();

document.getElementById('saveProfileBtn').addEventListener('click', async () => {
    const newName = document.getElementById('updateNameInput').value.trim();
    let rawUserID = document.getElementById('updateUserID').value.trim();
    const fileInput = document.getElementById('fileInputProfile');
    const file = fileInput.files[0]; // Ambil file yang dipilih
    const btn = document.getElementById('saveProfileBtn');

    // --- Validasi Input ---
    if (!newName) return showAlert("Name cannot be empty.", true);
    if (!rawUserID) return showAlert("User ID cannot be empty.", true);
    if (!/^[a-zA-Z0-9_]+$/.test(rawUserID)) {
        return showAlert("User ID can only contain letters, numbers, and underscores.", true);
    }
    const finalUserID = rawUserID.toLowerCase();

    const originalBtnText = btn.innerText;
    btn.innerText = "Saving...";
    btn.disabled = true;
    
    try {
        // 1. Cek Ketersediaan User ID (Jika berubah)
        const userDocRef = doc(db, "user_profiles", currentUser.uid);
        const currentDocSnap = await getDoc(userDocRef);
        let currentUserID = currentDocSnap.exists() ? currentDocSnap.data().userID : null;

        if (finalUserID !== currentUserID) {
             const qCheck = query(collection(db, "user_profiles"), where("userID", "==", finalUserID));
             const snapCheck = await getDocs(qCheck);
             if (!snapCheck.empty) {
                  throw new Error(`User ID "@${rawUserID}" is already taken.`);
             }
        }

        // --- MULAI PROSES UBAH GAMBAR (TANPA FIREBASE STORAGE) ---
        // Default ke URL lama yang ada di Firestore, atau fallback ke Auth photoURL
        let newPhotoURL = currentDocSnap.exists() && currentDocSnap.data().photoURL 
            ? currentDocSnap.data().photoURL 
            : currentUser.photoURL;

        // 2. Jika ada file baru dipilih, Kompres & Ubah ke Base64
        if (file) {
            btn.innerText = "Processing Image...";
            
            newPhotoURL = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        // Gunakan Canvas untuk mengecilkan resolusi gambar
                        const canvas = document.createElement('canvas');
                        const MAX_WIDTH = 200; // Ukuran kotak foto profil maksimal
                        const MAX_HEIGHT = 200;
                        let width = img.width;
                        let height = img.height;

                        if (width > height) {
                            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                        } else {
                            if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                        }

                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        // Konversi ke format Base64 JPEG (kualitas 80%) agar sangat ringan
                        resolve(canvas.toDataURL('image/jpeg', 0.8));
                    };
                    img.onerror = error => reject(error);
                    img.src = event.target.result;
                };
                reader.onerror = error => reject(error);
                reader.readAsDataURL(file); // Baca file sebagai URL Data
            });
            console.log("Foto berhasil diproses menjadi teks Base64!");
        }

        btn.innerText = "Updating Profile...";

        // 3. Siapkan Objek Update untuk Auth dan Firestore
        const authUpdateData = {
            displayName: newName,
        };

        const firestoreUpdateData = { 
            uid: currentUser.uid, 
            displayName: newName,
            email: currentUser.email,
            userID: finalUserID,
            photoURL: newPhotoURL
        };

        // A. Update Firebase Auth Core
        await updateProfile(currentUser, authUpdateData);
        
        // B. Update Firestore Data User
        await setDoc(userDocRef, firestoreUpdateData, { merge: true }); 

        // C. Update data teman (Batch Write)
        const qFriends = query(collection(db, "connections"), where("friendUID", "==", currentUser.uid));
        const friendSnaps = await getDocs(qFriends);
        const batch = writeBatch(db);
        friendSnaps.forEach(docSnap => {
            batch.update(docSnap.ref, {
                friendName: newName,
                friendID: finalUserID,
                photoURL: newPhotoURL // <-- Foto di HP teman juga akan terupdate realtime
            });
        });
        if (!friendSnaps.empty) await batch.commit();

        // --- UPDATE UI SECARA LANGSUNG ---
        document.getElementById('settingsUserName').innerText = newName;
        if(newPhotoURL) document.getElementById('settingsUserAvatar').src = newPhotoURL;

        const elSidebarName = document.getElementById('sidebarUserName');
        if(elSidebarName) elSidebarName.innerText = newName;

        loadUserProfile();

        document.getElementById('editProfileModal').classList.remove('show');
        showAlert("Profile updated successfully!", false);

    } catch (err) {
        console.error("Error updating profile:", err);
        showAlert(err.message, true);
    } finally {
        btn.innerText = originalBtnText;
        btn.disabled = false;
    }
});

async function resetAllData() {
    if (!currentUser) throw new Error("No authenticated user.");

    const safeDeleteCollection = async (collectionName) => {
        try {
            const q = query(collection(db, collectionName), where("uid", "==", currentUser.uid));
            const snapshot = await getDocs(q);
            if (snapshot.empty) return;

            const BATCH_SIZE = 400;
            const chunks = [];
            for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
                chunks.push(snapshot.docs.slice(i, i + BATCH_SIZE));
            }

            for (const chunk of chunks) {
                try {
                    const batch = writeBatch(db);
                    chunk.forEach(docSnap => batch.delete(docSnap.ref));
                    await batch.commit();
                } catch (batchErr) {
                    console.warn(`[Reset] Batch delete failed for ${collectionName}, falling back to single deletes:`, batchErr);
                    for (const docSnap of chunk) {
                        try {
                            await deleteDoc(docSnap.ref);
                        } catch (docErr) {
                            console.warn(`[Reset] Could not delete doc ${docSnap.id} in ${collectionName}:`, docErr);
                        }
                    }
                }
            }
        } catch (colErr) {
            console.warn(`[Reset] Could not query or delete collection ${collectionName}:`, colErr);
        }
    };

    // 1. Delete personal financial records
    await safeDeleteCollection("transactions");
    await safeDeleteCollection("accounts");
    await safeDeleteCollection("debts");

    // 2. Delete owned budgets
    await safeDeleteCollection("budgets");

    // 3. Gracefully leave shared budgets where user is participant
    try {
        const sharedBudgetsQ = query(
            collection(db, "budgets"),
            where("participants", "array-contains", currentUser.uid)
        );
        const sharedSnaps = await getDocs(sharedBudgetsQ);
        for (const docSnap of sharedSnaps.docs) {
            const data = docSnap.data();
            if (data.uid !== currentUser.uid) {
                try {
                    await updateDoc(docSnap.ref, {
                        participants: arrayRemove(currentUser.uid)
                    });
                } catch (leaveErr) {
                    console.warn(`[Reset] Could not leave shared budget ${docSnap.id}:`, leaveErr);
                }
            }
        }
    } catch (sharedErr) {
        console.warn("[Reset] Could not query shared budgets:", sharedErr);
    }

    // 4. Clear local caches
    try {
        localStorage.removeItem('pocketly_cached_dashboard');
        localStorage.removeItem('pocketly_offline_transactions');
        localStorage.removeItem('pocketly_rates_updated_at');
    } catch (e) {
        console.warn('[Reset] Local storage cache clear error:', e);
    }

    // 5. Trigger live UI updates
    if (typeof updateDashboard === 'function') {
        setTimeout(updateDashboard, 50);
    }

    return true;
}

const btnReset = document.getElementById('btnResetData');
if(btnReset) {
    const newBtnReset = btnReset.cloneNode(true);
    btnReset.parentNode.replaceChild(newBtnReset, btnReset);

    newBtnReset.addEventListener('click', () => { 
        showConfirm(
            "Reset All Data?",                    // 1. Judul
            "This will delete ALL transactions and budgets permanently. Your account will remain.", // 2. Pesan
            "Reset Everything",                   // 3. Tombol
            async () => {                         // 4. Aksi
                try { 
                    await resetAllData(); 
                    showAlert("All financial data has been reset successfully.", false); 
                } catch(err) { 
                    showAlert("Failed to reset data: " + err.message, true); 
                } 
            }
        ); 
    });
}

/* --- FIX: DELETE USER PERMANENT (Danger Zone) --- */
const btnDelAcc = document.getElementById('btnDeleteAccount');
if(btnDelAcc) {
    const newBtnDel = btnDelAcc.cloneNode(true);
    btnDelAcc.parentNode.replaceChild(newBtnDel, btnDelAcc);

    newBtnDel.addEventListener('click', () => { 
        showConfirm(
            "Delete Account?",
            "Permanently delete your account and all data? This cannot be undone.",
            "Delete Forever",
            async () => { 
                try { 
                    await resetAllData(); 
                    await deleteUser(currentUser); 
                    showAlert("Account deleted.", false); 
                } catch(err) { 
                    if(err.code === 'auth/requires-recent-login') 
                        showAlert("Please re-login to delete account.", true); 
                    else 
                        showAlert("Failed: " + err.message, true); 
                } 
            }
        ); 
    });
}
function initCustomSelects() {
    const targetSelects = document.querySelectorAll(
        'select.clean-select, select.date-select, .form-group select, .filter-group select, .filter-group-item select'
    );
    targetSelects.forEach(select => {
        setupSearchableSelect(select);
    });
}

function setupSearchableSelect(select) {
    if (!select) return;

    // Filter bulan dan tahun di header dibuat read-only (tap-to-pick clean dropdown)
    const isReadOnly = select.id === 'yearFilter' || select.id === 'monthFilter' || select.id === 'reportPeriod' || select.id === 'reportAccount';

    // If already initialized, update/sync options and value
    if (select.dataset.searchableInit === 'true') {
        if (typeof select.__syncSearchable === 'function') {
            select.__syncSearchable();
        }
        return;
    }
    select.dataset.searchableInit = 'true';

    // Strictly hide native select from UI
    select.classList.add('s-select-native-hidden');
    select.style.setProperty('display', 'none', 'important');

    // Remove any accidental pre-existing sibling wrapper
    if (select.nextElementSibling && select.nextElementSibling.classList.contains('s-select-wrapper')) {
        select.nextElementSibling.remove();
    }

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 's-select-wrapper';
    if (select.closest('#sharedControls') || select.closest('#analyticsControls') || select.classList.contains('date-select')) {
        wrapper.classList.add('header-filter-select');
    }
    if (isReadOnly) {
        wrapper.classList.add('s-select-readonly');
    }

    // Trigger input & chevron
    const trigger = document.createElement('div');
    trigger.className = 's-select-trigger';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 's-select-input';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = select.getAttribute('placeholder') || 'Choose...';

    if (isReadOnly) {
        input.readOnly = true;
        input.setAttribute('inputmode', 'none');
        input.tabIndex = 0;
    }

    const chevron = document.createElement('i');
    chevron.className = 'fa-solid fa-chevron-down s-select-chevron';

    trigger.appendChild(input);
    trigger.appendChild(chevron);
    wrapper.appendChild(trigger);

    // Dropdown menu
    const dropdown = document.createElement('div');
    dropdown.className = 's-select-dropdown';

    const optionsContainer = document.createElement('div');
    optionsContainer.className = 's-select-options';

    const emptyMsg = document.createElement('div');
    emptyMsg.className = 's-select-empty';
    emptyMsg.textContent = 'No matching options';
    emptyMsg.style.display = 'none';

    dropdown.appendChild(optionsContainer);
    dropdown.appendChild(emptyMsg);
    wrapper.appendChild(dropdown);

    // Insert wrapper next to select
    select.parentNode.insertBefore(wrapper, select.nextSibling);

    // Render options function:
    // If filterText is empty, render ALL options so user can choose like a standard dropdown.
    function renderOptions(filterText = '') {
        optionsContainer.innerHTML = '';
        const options = Array.from(select.options);
        const query = (filterText || '').trim().toLowerCase();
        let matchCount = 0;
        let selectedEl = null;

        options.forEach(opt => {
            if (opt.disabled && !opt.value) return; // skip blank disabled placeholder
            const text = opt.textContent.trim();
            const val = opt.value;
            const matches = !query || text.toLowerCase().includes(query) || val.toLowerCase().includes(query);

            if (matches) {
                matchCount++;
                const optEl = document.createElement('div');
                optEl.className = 's-select-option';
                if (opt.selected) {
                    optEl.classList.add('selected');
                    selectedEl = optEl;
                }
                optEl.dataset.value = val;
                optEl.textContent = text;

                optEl.addEventListener('mousedown', (e) => {
                    e.preventDefault(); // prevent input blur before mousedown fires
                    selectOption(val, text);
                });

                optionsContainer.appendChild(optEl);
            }
        });

        emptyMsg.style.display = matchCount === 0 ? 'block' : 'none';

        if (selectedEl) {
            selectedEl.scrollIntoView({ block: 'nearest' });
        }
    }

    function syncDisplay() {
        const selectedOpt = select.options[select.selectedIndex];
        if (selectedOpt && (selectedOpt.value || selectedOpt.textContent)) {
            input.value = selectedOpt.textContent.trim();
        } else {
            input.value = '';
        }
    }

    function selectOption(val, text) {
        select.value = val;
        input.value = text;
        closeDropdown();
        select.dispatchEvent(new Event('change', { bubbles: true }));
        select.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function openDropdown() {
        // Close other open searchable dropdowns
        document.querySelectorAll('.s-select-wrapper.open').forEach(w => {
            if (w !== wrapper) w.classList.remove('open');
        });
        wrapper.classList.add('open');
        // ALWAYS render ALL options on opening so user sees the complete list
        renderOptions('');
    }

    function closeDropdown() {
        if (!wrapper.classList.contains('open')) return;
        wrapper.classList.remove('open');
        const selectedOpt = select.options[select.selectedIndex];
        if (selectedOpt && (selectedOpt.value || selectedOpt.textContent)) {
            input.value = selectedOpt.textContent.trim();
        } else {
            input.value = '';
        }
    }

    if (isReadOnly) {
        // Pure tap-to-pick: click opens or closes without opening on-screen keyboard
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            if (wrapper.classList.contains('open')) {
                closeDropdown();
            } else {
                openDropdown();
            }
        });
    } else {
        // Chevron click toggles dropdown with all options
        chevron.addEventListener('click', (e) => {
            e.stopPropagation();
            if (wrapper.classList.contains('open')) {
                closeDropdown();
            } else {
                openDropdown();
                input.focus();
            }
        });

        // Input events: focus / click opens dropdown with all options and selects text for quick replacement
        input.addEventListener('focus', () => {
            openDropdown();
            setTimeout(() => input.select(), 10);
        });
        input.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!wrapper.classList.contains('open')) {
                openDropdown();
            }
            input.select();
        });

        // Real-time typing to filter
        input.addEventListener('input', () => {
            if (!wrapper.classList.contains('open')) {
                wrapper.classList.add('open');
            }
            renderOptions(input.value);
        });
    }

    // Keyboard navigation (ArrowDown, ArrowUp, Enter, Escape)
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeDropdown();
            input.blur();
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!wrapper.classList.contains('open')) openDropdown();
            const opts = optionsContainer.querySelectorAll('.s-select-option');
            if (opts.length > 0) {
                const current = optionsContainer.querySelector('.s-select-option.focused');
                let nextIdx = 0;
                if (current) {
                    current.classList.remove('focused');
                    const idx = Array.from(opts).indexOf(current);
                    nextIdx = (idx + 1) % opts.length;
                }
                opts[nextIdx].classList.add('focused');
                opts[nextIdx].scrollIntoView({ block: 'nearest' });
            }
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!wrapper.classList.contains('open')) openDropdown();
            const opts = optionsContainer.querySelectorAll('.s-select-option');
            if (opts.length > 0) {
                const current = optionsContainer.querySelector('.s-select-option.focused');
                let prevIdx = opts.length - 1;
                if (current) {
                    current.classList.remove('focused');
                    const idx = Array.from(opts).indexOf(current);
                    prevIdx = (idx - 1 + opts.length) % opts.length;
                }
                opts[prevIdx].classList.add('focused');
                opts[prevIdx].scrollIntoView({ block: 'nearest' });
            }
            return;
        }
        if (e.key === 'Enter') {
            if (wrapper.classList.contains('open')) {
                e.preventDefault();
                const focused = optionsContainer.querySelector('.s-select-option.focused');
                if (focused) {
                    selectOption(focused.dataset.value, focused.textContent.trim());
                } else {
                    const first = optionsContainer.querySelector('.s-select-option');
                    if (first) selectOption(first.dataset.value, first.textContent.trim());
                }
            }
        }
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            closeDropdown();
        }
    });

    // Watch for programmatic changes on select (e.g. select.value = ...)
    select.addEventListener('change', syncDisplay);
    select.__syncSearchable = syncDisplay;

    // Observe changes to select's child options via MutationObserver
    const observer = new MutationObserver(() => {
        syncDisplay();
    });
    observer.observe(select, { childList: true, subtree: true });

    // Initial sync
    syncDisplay();
}

function updatePrivacyUI() {
    const btnPrivacy = document.getElementById('togglePrivacyBtn');
    const privacyIcon = document.getElementById('togglePrivacyIcon');
    if (privacyIcon) {
        privacyIcon.className = isPrivacyMode ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
    }
    if (btnPrivacy) {
        btnPrivacy.classList.remove('fa-eye', 'fa-eye-slash', 'fa-solid');
        btnPrivacy.classList.toggle('privacy-active', isPrivacyMode);
        btnPrivacy.setAttribute('title', isPrivacyMode ? 'Show Balances' : 'Hide Balances');
    }

    const total = (accounts || []).reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
    const totalDisplay = document.getElementById('displayTotalBalance');
    if (totalDisplay) {
        totalDisplay.innerText = formatRupiah(total);
    }

    if (typeof renderAccountsFromCache === 'function') {
        renderAccountsFromCache();
    }
    if (typeof updateDashboard === 'function') {
        updateDashboard();
    }
}
window.updatePrivacyUI = updatePrivacyUI;
window.addEventListener('DOMContentLoaded', updatePrivacyUI);

const btnPrivacy = document.getElementById('togglePrivacyBtn');
if (btnPrivacy) {
    btnPrivacy.addEventListener('click', () => {
        isPrivacyMode = !isPrivacyMode;
        localStorage.setItem('pocketly_privacy_mode', isPrivacyMode ? 'true' : 'false');
        updatePrivacyUI();
    });
}

function legacyFormatRupiah(num) { 
    // 1. Cek Privacy Mode
    if (isPrivacyMode) {
        const symbol = (currentCurrency === 'IDR') ? 'Rp' : (currentCurrency === 'USD' ? '$' : (currentCurrency === 'EUR' ? '€' : currentCurrency));
        return `${symbol} ••••••••`;
    } 

    // 2. Ambil Rate Sesuai Mata Uang yang Dipilih
    // Jika tidak ada di list, default ke 1 (IDR)
    const rate = exchangeRates[currentCurrency] || 1;
    
    // 3. Konversi Nilai (Base IDR * Rate)
    const convertedValue = num * rate;

    // 4. Format Sesuai Locale Negara
    return new Intl.NumberFormat(currentLocale, { 
        style: 'currency', 
        currency: currentCurrency, 
        // Jika Rupiah (IDR), hilangkan desimal (koma nol-nol)
        // Jika USD/EUR, biarkan ada 2 desimal sen (0.99) agar akurat
        minimumFractionDigits: currentCurrency === 'IDR' ? 0 : 2,
        maximumFractionDigits: currentCurrency === 'IDR' ? 0 : 2 
    }).format(convertedValue); 
}
function formatDateIndo(dateString) { if(!dateString) return "-"; const [year, month, day] = dateString.split('-'); return `${day}/${month}/${year}`; }

function getFriendlyMessage(error) {
    if (!error) return "An unexpected error occurred.";
    console.error("Original Error:", error); 

    const code = error.code || "";
    switch (code) {
        case 'auth/invalid-email':
            return "Invalid email address format.";
        case 'auth/user-not-found':
            return "Account not found. Please register first.";
        case 'auth/wrong-password':
        case 'auth/invalid-credential': 
            return "Incorrect email or password.";
        case 'auth/email-already-in-use':
            return "Email is already registered. Please login instead.";
        case 'auth/weak-password':
            return "Password is too weak (minimum 6 characters).";
        case 'auth/network-request-failed':
            return "Network connection error. Please check your internet connection.";
        case 'auth/too-many-requests':
            return "Too many failed attempts. Please try again later.";
        case 'auth/requires-recent-login':
            return "Session expired. Please logout and login again.";
        case 'permission-denied':
        case 'firestore/permission-denied':
            return "Access denied: You do not have permission to modify or delete this shared data.";
    }

    const msg = (typeof error === 'string' ? error : (error.message || "")).trim();
    
    if (msg.includes("Missing or insufficient permissions") || msg.includes("permission-denied")) {
        return "Access denied: You are not the owner of this goal or do not have permission to withdraw or delete shared funds.";
    }
    if (msg.includes("Username is already taken")) return "Username is already taken! Please choose another.";
    if (msg.includes("Full Name is required")) return "Full Name cannot be empty.";
    if (msg.includes("already in your friend list")) return "This user is already in your friend list.";
    if (msg.includes("already sent a request")) return "You have already sent a request to this user.";
    if (msg.includes("already invited you")) return "This user already invited you! Check your inbox.";
    if (msg.includes("cannot invite yourself")) return "You cannot invite yourself.";
    if (msg.includes("Insufficient balance") || msg.includes("Insufficient funds")) return "Insufficient balance for this transaction!";
    if (msg.includes("Source account not found")) return "Source account not found.";
    if (msg.includes("Destination account not found")) return "Destination account not found.";
    
    return msg.replace("Firebase: ", "").replace("Error: ", "").trim();
}

const exportMenuBtn = document.getElementById('exportMenuBtn');
const exportDropdown = document.getElementById('exportDropdown');
const btnExportCSV = document.getElementById('btnExportCSV');
const btnExportPDF = document.getElementById('btnExportPDF');

if (exportMenuBtn && exportDropdown) { 
    exportMenuBtn.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        
        // 1. TUTUP FILTER (Jika terbuka)
        const filterPopup = document.getElementById('transFilterPopup');
        const filterBtn = document.getElementById('transFilterToggleBtn');
        if (filterPopup) filterPopup.classList.remove('show');
        if (filterBtn) filterBtn.classList.remove('active');

        // 2. TUTUP MODAL ADD (Jika terbuka - jarang terjadi tapi untuk keamanan)
        const transModal = document.getElementById('transactionModal');
        if (transModal) transModal.classList.remove('show');

        // 3. Buka/Tutup Export
        exportDropdown.classList.toggle('show'); 
    });
    
    // Klik di luar menutup export (Kode lama tetap dipertahankan)
    window.addEventListener('click', (e) => { 
        if (!exportMenuBtn.contains(e.target) && !exportDropdown.contains(e.target)) { 
            exportDropdown.classList.remove('show'); 
        } 
    }); 
}

window.exportTransactionsCSV = function() {
    if (typeof rawTransactions === 'undefined' || rawTransactions.length === 0) {
        showAlert("No transactions recorded yet to export.", true);
        return;
    }

    const headers = ["Date", "Type", "Category", "Account", "Description", "Amount", "Currency"];
    const rows = [];

    const sortedData = [...rawTransactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    sortedData.forEach(t => {
        const accName = accounts.find(a => a.id === t.accountId)?.name || 'Unknown';
        const dateFormatted = t.date || "-";
        const safeDesc = (t.desc || "").replace(/"/g, '""');
        const safeCat = (t.category || "Others").replace(/"/g, '""');
        const safeAcc = accName.replace(/"/g, '""');
        const typeStr = (t.type || "expense").toUpperCase();
        const amt = Number(t.amount || 0);

        rows.push([
            `"${dateFormatted}"`,
            `"${typeStr}"`,
            `"${safeCat}"`,
            `"${safeAcc}"`,
            `"${safeDesc}"`,
            amt,
            `"${currentCurrency || 'IDR'}"`
        ].join(','));
    });

    const rawCsvText = [headers.join(','), ...rows].join('\n');
    const dateStamp = new Date().toISOString().split('T')[0];
    const csvFileName = `Pocketly_Transactions_${dateStamp}.csv`;

    if (window.PocketlyDownloader && window.PocketlyDownloader.isNative()) {
        window.PocketlyDownloader.saveText(rawCsvText, csvFileName, 'text/csv');
    } else {
        const csvContent = "data:text/csv;charset=utf-8," + rawCsvText;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", csvFileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    const expDropdown = document.getElementById('exportDropdown');
    if (expDropdown) expDropdown.classList.remove('show');

    showAlert("Transactions exported to CSV successfully!", false);
};

// --- EXPORT PDF STATEMENT: MODAL, SCOPE FILTERING & MONTHLY ADVISORY ---
const ENG_MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

function formatYmEng(ymStr) {
    if (!ymStr || typeof ymStr !== 'string' || !ymStr.includes('-')) return ymStr || '-';
    const parts = ymStr.split('-');
    const y = parts[0];
    const m = parseInt(parts[1], 10);
    const mName = ENG_MONTH_NAMES[m - 1] || parts[1];
    return `${mName} ${y}`;
}

window.triggerMonthPicker = function(inputId) {
    const el = document.getElementById(inputId);
    if (!el) return;
    try {
        if (typeof el.showPicker === 'function') {
            el.showPicker();
        } else {
            el.focus();
        }
    } catch (e) {
        el.focus();
    }
};

window.currentExportPdfMode = 'month';

window.setExportPdfMode = function(mode) {
    window.currentExportPdfMode = mode;

    const tabMonth = document.getElementById('tabExportMonth');
    const tabRange = document.getElementById('tabExportRange');
    const tabAll = document.getElementById('tabExportAll');

    if (tabMonth) tabMonth.classList.toggle('active', mode === 'month');
    if (tabRange) tabRange.classList.toggle('active', mode === 'range');
    if (tabAll) tabAll.classList.toggle('active', mode === 'all');

    const viewMonth = document.getElementById('exportPdfMonthView');
    const viewRange = document.getElementById('exportPdfRangeView');
    const viewAll = document.getElementById('exportPdfAllView');

    if (viewMonth) viewMonth.style.display = mode === 'month' ? 'block' : 'none';
    if (viewRange) viewRange.style.display = mode === 'range' ? 'block' : 'none';
    if (viewAll) viewAll.style.display = mode === 'all' ? 'block' : 'none';

    window.updateExportPdfScope();
};

window.setExportPdfPreset = function(preset) {
    const singleInput = document.getElementById('exportPdfSingleMonth');
    const startInput = document.getElementById('exportPdfStartMonth');
    const endInput = document.getElementById('exportPdfEndMonth');
    const now = new Date();

    const getYm = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    if (preset === 'thisMonth') {
        window.setExportPdfMode('month');
        if (singleInput) singleInput.value = getYm(now);
    } else if (preset === 'lastMonth') {
        window.setExportPdfMode('month');
        const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        if (singleInput) singleInput.value = getYm(d);
    } else if (preset === 'last3Months') {
        window.setExportPdfMode('range');
        const s = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        if (startInput) startInput.value = getYm(s);
        if (endInput) endInput.value = getYm(now);
    } else if (preset === 'last6Months') {
        window.setExportPdfMode('range');
        const s = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        if (startInput) startInput.value = getYm(s);
        if (endInput) endInput.value = getYm(now);
    } else if (preset === 'thisYear') {
        window.setExportPdfMode('range');
        if (startInput) startInput.value = `${now.getFullYear()}-01`;
        if (endInput) endInput.value = getYm(now);
    }
    window.updateExportPdfScope();
};

window.getScopedExportTransactions = function() {
    const allTrans = (typeof rawTransactions !== 'undefined' && Array.isArray(rawTransactions)) 
        ? rawTransactions 
        : [];
    const mode = window.currentExportPdfMode || 'month';
    const singleInput = document.getElementById('exportPdfSingleMonth');
    const startInput = document.getElementById('exportPdfStartMonth');
    const endInput = document.getElementById('exportPdfEndMonth');

    let scoped = [];
    let periodLabel = '';
    let fileSuffix = '';
    let daysInPeriod = 30;

    if (mode === 'month') {
        const ym = singleInput ? singleInput.value : '';
        if (ym) {
            scoped = allTrans.filter(t => t.date && t.date.startsWith(ym));
            periodLabel = (window.PocketlyI18n && typeof window.PocketlyI18n.formatMonthYear === 'function') ? window.PocketlyI18n.formatMonthYear(ym) : formatYmEng(ym);
            fileSuffix = ym;
            const parts = ym.split('-');
            daysInPeriod = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10), 0).getDate();
        } else {
            periodLabel = 'Month Not Selected';
            fileSuffix = 'This_Month';
        }
    } else if (mode === 'range') {
        let sYm = startInput ? startInput.value : '';
        let eYm = endInput ? endInput.value : '';
        if (sYm && eYm) {
            if (sYm > eYm) {
                const temp = sYm; sYm = eYm; eYm = temp;
                if (startInput) startInput.value = sYm;
                if (endInput) endInput.value = eYm;
            }
            scoped = allTrans.filter(t => {
                if (!t.date) return false;
                const ym = t.date.slice(0, 7);
                return ym >= sYm && ym <= eYm;
            });
            const sLbl = (window.PocketlyI18n && typeof window.PocketlyI18n.formatMonthYear === 'function') ? window.PocketlyI18n.formatMonthYear(sYm) : formatYmEng(sYm);
            const eLbl = (window.PocketlyI18n && typeof window.PocketlyI18n.formatMonthYear === 'function') ? window.PocketlyI18n.formatMonthYear(eYm) : formatYmEng(eYm);
            periodLabel = `${sLbl} - ${eLbl}`;
            fileSuffix = `${sYm}_to_${eYm}`;
            const sParts = sYm.split('-');
            const eParts = eYm.split('-');
            const sDate = new Date(parseInt(sParts[0], 10), parseInt(sParts[1], 10) - 1, 1);
            const eDate = new Date(parseInt(eParts[0], 10), parseInt(eParts[1], 10), 0);
            daysInPeriod = Math.max(1, Math.round((eDate - sDate) / (1000 * 60 * 60 * 24)));
        } else {
            periodLabel = 'Incomplete Range';
            fileSuffix = 'Range';
        }
    } else {
        scoped = [...allTrans];
        periodLabel = (window.PocketlyI18n && window.PocketlyI18n.t('export_all_time_title')) || 'All Historical Data (All-Time)';
        fileSuffix = 'AllTime';
        daysInPeriod = 90;
    }

    return { scoped, periodLabel, fileSuffix, daysInPeriod, mode };
};

window.updateExportPdfScope = function() {
    const { scoped, periodLabel } = window.getScopedExportTransactions();

    let inc = 0;
    let exp = 0;
    scoped.forEach(t => {
        const a = Number(t.amount || 0);
        if (t.type === 'income') inc += a;
        else if (t.type === 'expense') exp += a;
    });
    const net = inc - exp;

    const periodTagEl = document.getElementById('exportScopePeriodTag');
    const countEl = document.getElementById('exportScopeCount');
    const incEl = document.getElementById('exportScopeIncome');
    const expEl = document.getElementById('exportScopeExpense');
    const netEl = document.getElementById('exportScopeNet');

    if (periodTagEl) periodTagEl.textContent = periodLabel;
    const countStr = scoped.length === 1
        ? ((window.PocketlyI18n && window.PocketlyI18n.t('stat_transaction_single')) || 'Transaction')
        : ((window.PocketlyI18n && window.PocketlyI18n.t('stat_transactions')) || 'Transactions');
    if (countEl) countEl.textContent = `${scoped.length} ${countStr}`;
    if (incEl) incEl.textContent = typeof formatCurrency === 'function' ? formatCurrency(inc) : `Rp${inc.toLocaleString()}`;
    if (expEl) expEl.textContent = typeof formatCurrency === 'function' ? formatCurrency(exp) : `Rp${exp.toLocaleString()}`;
    if (netEl) {
        const prefix = net > 0 ? '+ ' : '';
        netEl.textContent = `${prefix}${typeof formatCurrency === 'function' ? formatCurrency(net) : `Rp${net.toLocaleString()}`}`;
        const parentItem = netEl.closest('.export-stat-item');
        if (parentItem) {
            parentItem.className = `export-stat-item ${net >= 0 ? 'blue' : 'red'}`;
        }
    }
};

window.openExportPdfModal = function() {
    const modal = document.getElementById('exportPdfModal');
    if (!modal) return;

    const now = new Date();
    const curYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const singleInput = document.getElementById('exportPdfSingleMonth');
    const startInput = document.getElementById('exportPdfStartMonth');
    const endInput = document.getElementById('exportPdfEndMonth');

    if (singleInput && !singleInput.value) {
        singleInput.value = curYm;
    }
    if (startInput && !startInput.value) {
        const s = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        startInput.value = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}`;
    }
    if (endInput && !endInput.value) {
        endInput.value = curYm;
    }

    const expDropdown = document.getElementById('exportDropdown');
    if (expDropdown) expDropdown.classList.remove('show');

    window.setExportPdfMode(window.currentExportPdfMode || 'month');
    modal.classList.add('show');
    if (typeof ensurePoppinsFont === 'function') {
        ensurePoppinsFont().catch(() => {});
    }
    if (typeof getPocketlyLogoDataUrl === 'function') {
        getPocketlyLogoDataUrl().catch(() => {});
    }
};

window.closeExportPdfModal = function() {
    const modal = document.getElementById('exportPdfModal');
    if (modal) modal.classList.remove('show');
};

// Hook backdrop click and Esc for exportPdfModal
const exportModalElem = document.getElementById('exportPdfModal');
if (exportModalElem) {
    exportModalElem.addEventListener('click', (e) => {
        if (e.target === exportModalElem) window.closeExportPdfModal();
    });
}

// Redirect all standard exportTransactionsPDF calls to the new interactive modal
window.exportTransactionsPDF = function() {
    window.openExportPdfModal();
};

// Cache and loader for Pocketly logo image in PDF headers
let cachedPocketlyLogo = null;
function getPocketlyLogoDataUrl() {
    if (cachedPocketlyLogo) return Promise.resolve(cachedPocketlyLogo);
    return new Promise((resolve) => {
        const existingImg = document.querySelector('img[src*="logo-new.png"]');
        if (existingImg && existingImg.complete && existingImg.naturalWidth > 0) {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 160;
                canvas.height = 160;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(existingImg, 0, 0, 160, 160);
                cachedPocketlyLogo = canvas.toDataURL('image/png');
                resolve(cachedPocketlyLogo);
                return;
            } catch (e) {}
        }

        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 160;
                canvas.height = 160;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, 160, 160);
                cachedPocketlyLogo = canvas.toDataURL('image/png');
                resolve(cachedPocketlyLogo);
            } catch (e) {
                resolve(img);
            }
        };
        img.onerror = () => resolve(null);
        img.src = 'logo-new.png';
    });
}

// Helper to guarantee Poppins font is loaded into the jsPDF document
async function ensurePoppinsFont(doc) {
    let fontName = 'helvetica';
    try {
        let regB64 = window.POPPINS_REGULAR_B64;
        let boldB64 = window.POPPINS_BOLD_B64;

        if (!regB64 || !boldB64) {
            // Asynchronous fetch fallback from CDN
            const [regRes, boldRes] = await Promise.all([
                fetch('https://cdn.jsdelivr.net/fontsource/fonts/poppins@latest/latin-400-normal.ttf'),
                fetch('https://cdn.jsdelivr.net/fontsource/fonts/poppins@latest/latin-600-normal.ttf')
            ]);
            if (regRes.ok && boldRes.ok) {
                const [regBuf, boldBuf] = await Promise.all([regRes.arrayBuffer(), boldRes.arrayBuffer()]);
                const toB64 = (buf) => {
                    let binary = '';
                    const bytes = new Uint8Array(buf);
                    const len = bytes.byteLength;
                    const chunkSize = 0x8000;
                    for (let i = 0; i < len; i += chunkSize) {
                        binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunkSize, len)));
                    }
                    return window.btoa(binary);
                };
                regB64 = toB64(regBuf);
                boldB64 = toB64(boldBuf);
                window.POPPINS_REGULAR_B64 = regB64;
                window.POPPINS_BOLD_B64 = boldB64;
            }
        }

        if (doc && regB64 && boldB64) {
            doc.addFileToVFS('Poppins-Regular.ttf', regB64);
            doc.addFont('Poppins-Regular.ttf', 'Poppins', 'normal');
            doc.addFileToVFS('Poppins-Bold.ttf', boldB64);
            doc.addFont('Poppins-Bold.ttf', 'Poppins', 'bold');
            fontName = 'Poppins';
        }
    } catch (e) {
        console.warn('Poppins font registration fallback to helvetica:', e);
        fontName = 'helvetica';
    }
    return fontName;
}

// Convert ArrayBuffer to Base64 in safe chunks
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    const chunkSize = 0x8000;
    for (let i = 0; i < len; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunkSize, len)));
    }
    return window.btoa(binary);
}

// Dynamic multi-language font loader for jsPDF
async function ensurePdfFontForLanguage(doc, lang) {
    window._POCKETLY_FONT_CACHE = window._POCKETLY_FONT_CACHE || {};

    const FONT_MAP = {
        ja: {
            url: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-jp@latest/japanese-400-normal.ttf',
            file: 'NotoSansJP.ttf',
            name: 'NotoSansJP'
        },
        ko: {
            url: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-kr@latest/korean-400-normal.ttf',
            file: 'NotoSansKR.ttf',
            name: 'NotoSansKR'
        },
        zh: {
            url: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-sc@latest/chinese-simplified-400-normal.ttf',
            file: 'NotoSansSC.ttf',
            name: 'NotoSansSC'
        },
        ar: {
            url: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-arabic@latest/arabic-400-normal.ttf',
            file: 'NotoSansArabic.ttf',
            name: 'NotoSansArabic'
        },
        ru: {
            url: 'https://cdn.jsdelivr.net/fontsource/fonts/roboto@latest/cyrillic-400-normal.ttf',
            file: 'RobotoCyrillic.ttf',
            name: 'RobotoCyrillic'
        }
    };

    const cfg = FONT_MAP[lang];
    if (cfg) {
        let b64 = window._POCKETLY_FONT_CACHE[lang];
        if (!b64) {
            try {
                const res = await fetch(cfg.url);
                if (res.ok) {
                    const buf = await res.arrayBuffer();
                    b64 = arrayBufferToBase64(buf);
                    window._POCKETLY_FONT_CACHE[lang] = b64;
                }
            } catch (err) {
                console.warn(`Could not fetch custom PDF font for ${lang}:`, err);
            }
        }
        if (b64 && doc) {
            try {
                doc.addFileToVFS(cfg.file, b64);
                doc.addFont(cfg.file, cfg.name, 'normal');
                doc.addFont(cfg.file, cfg.name, 'bold');
                return cfg.name;
            } catch (err) {
                console.warn(`Could not register custom font ${cfg.name}:`, err);
            }
        }
    }

    // Default to Poppins for Latin languages (en, id, es, fr, de, pt, nl)
    return await ensurePoppinsFont(doc);
}

// Complete PDF Internationalization (12 Languages)
const PDF_I18N = {
    statementTitle: {
        en: "Personal Financial Statement",
        id: "Laporan Keuangan Pribadi",
        es: "Estado Financiero Personal",
        fr: "État Financier Personnel",
        de: "Persönlicher Finanzbericht",
        ja: "個人財務諸表",
        ko: "개인 재무 보고서",
        zh: "个人财务报表",
        ar: "البيان المالي الشخصي",
        pt: "Relatório Financeiro Pessoal",
        ru: "Личный финансовый отчет",
        nl: "Persoonlijk Financieel Overzicht"
    },
    account: {
        en: "Account",
        id: "Akun",
        es: "Cuenta",
        fr: "Compte",
        de: "Konto",
        ja: "アカウント",
        ko: "계정",
        zh: "账户",
        ar: "الحساب",
        pt: "Conta",
        ru: "Аккаунт",
        nl: "Rekening"
    },
    period: {
        en: "Period",
        id: "Periode",
        es: "Período",
        fr: "Période",
        de: "Zeitraum",
        ja: "対象期間",
        ko: "기간",
        zh: "期间",
        ar: "الفترة",
        pt: "Período",
        ru: "Период",
        nl: "Periode"
    },
    generated: {
        en: "Generated",
        id: "Dibuat",
        es: "Generado",
        fr: "Généré",
        de: "Erstellt",
        ja: "作成日時",
        ko: "생성일",
        zh: "生成于",
        ar: "تم الإنشاء",
        pt: "Gerado",
        ru: "Создано",
        nl: "Gegenereerd"
    },
    totalIncome: {
        en: "TOTAL INCOME",
        id: "TOTAL PEMASUKAN",
        es: "INGRESOS TOTALES",
        fr: "REVENUS TOTAUX",
        de: "GESAMTEINNAHMEN",
        ja: "総収入",
        ko: "총 수입",
        zh: "总收入",
        ar: "إجمالي الدخل",
        pt: "RECEITA TOTAL",
        ru: "ОБЩИЙ ДОХОД",
        nl: "TOTALE INKOMSTEN"
    },
    verifiedCredits: {
        en: "{n} verified credit(s)",
        id: "{n} pemasukan terverifikasi",
        es: "{n} ingreso(s) verificado(s)",
        fr: "{n} crédit(s) vérifié(s)",
        de: "{n} verifizierte Buchung(en)",
        ja: "{n} 件の入金記録",
        ko: "{n} 건의 입금 기록",
        zh: "{n} 笔已验证收入",
        ar: "{n} عملية إيداع موثقة",
        pt: "{n} crédito(s) verificado(s)",
        ru: "{n} подтвержд. поступлений",
        nl: "{n} geverifieerde bijschrijving(en)"
    },
    totalExpenses: {
        en: "TOTAL EXPENSES",
        id: "TOTAL PENGELUARAN",
        es: "GASTOS TOTALES",
        fr: "DÉPENSES TOTALES",
        de: "GESAMTAUSGABEN",
        ja: "総支出",
        ko: "총 지출",
        zh: "总支出",
        ar: "إجمالي المصروفات",
        pt: "DESPESAS TOTAIS",
        ru: "ОБЩИЕ РАСХОДЫ",
        nl: "TOTALE UITGAVEN"
    },
    dailyAvg: {
        en: "Avg. {amt} / day",
        id: "Rata-rata {amt} / hari",
        es: "Prom. {amt} / día",
        fr: "Moy. {amt} / jour",
        de: "Durchschn. {amt} / Tag",
        ja: "平均 {amt} / 日",
        ko: "일평균 {amt}",
        zh: "日均 {amt}",
        ar: "متوسط {amt} / يوم",
        pt: "Média {amt} / dia",
        ru: "Ср. {amt} / день",
        nl: "Gem. {amt} / dag"
    },
    netSavings: {
        en: "NET SAVINGS ({pct}%)",
        id: "TABUNGAN BERSIH ({pct}%)",
        es: "AHORRO NETO ({pct}%)",
        fr: "ÉPARGNE NETTE ({pct}%)",
        de: "NETTO-ERSPARNIS ({pct}%)",
        ja: "純貯蓄額 ({pct}%)",
        ko: "순저축액 ({pct}%)",
        zh: "净储蓄 ({pct}%)",
        ar: "صافي المدخرات ({pct}%)",
        pt: "ECONOMIA LÍQUIDA ({pct}%)",
        ru: "ЧИСТЫЕ НАКОПЛЕНИЯ ({pct}%)",
        nl: "NETTO BESPARING ({pct}%)"
    },
    incomeSaved: {
        en: "{pct}% of income saved",
        id: "{pct}% pendapatan tersimpan",
        es: "{pct}% de ingresos ahorrados",
        fr: "{pct}% des revenus épargnés",
        de: "{pct}% des Einkommens gespart",
        ja: "収入の {pct}% を貯蓄",
        ko: "수입의 {pct}% 저축",
        zh: "储蓄率达到 {pct}%",
        ar: "تم ادخار {pct}% من الدخل",
        pt: "{pct}% da renda economizada",
        ru: "{pct}% дохода сохранено",
        nl: "{pct}% van inkomsten gespaard"
    },
    deficitDetected: {
        en: "Deficit flow detected",
        id: "Arus defisit terdeteksi",
        es: "Flujo deficitario detectado",
        fr: "Flux déficitaire détecté",
        de: "Defizit festgestellt",
        ja: "赤字フローが検出されました",
        ko: "적자 흐름 감지됨",
        zh: "检测到支出赤字",
        ar: "تم اكتشاف عجز مالي",
        pt: "Fluxo deficitário detectado",
        ru: "Обнаружен дефицит",
        nl: "Tekort geconstateerd"
    },
    cashHealthStatus: {
        en: "Cash Health Status",
        id: "Status Kesehatan Kas",
        es: "Estado de Salud Financiera",
        fr: "État de Santé Financière",
        de: "Finanzieller Gesundheitsstatus",
        ja: "財務健全ステータス",
        ko: "재무 건전성 상태",
        zh: "财务健康状况",
        ar: "حالة الصحة المالية",
        pt: "Status da Saúde Financeira",
        ru: "Статус финансового здоровья",
        nl: "Financiële Gezondheid"
    },
    savingsRetention: {
        en: "Savings Retention",
        id: "Retensi Tabungan",
        es: "Retención de Ahorros",
        fr: "Rétention d'Épargne",
        de: "Sparquote",
        ja: "貯蓄維持率",
        ko: "저축 유지율",
        zh: "储蓄留存率",
        ar: "معدل الاحتفاظ بالمدخرات",
        pt: "Retenção de Economias",
        ru: "Удержание накоплений",
        nl: "Spaarretentie"
    },
    activePeriod: {
        en: "Active Period",
        id: "Periode Aktif",
        es: "Período Activo",
        fr: "Période Active",
        de: "Aktiver Zeitraum",
        ja: "対象日数",
        ko: "활동 기간",
        zh: "统计周期",
        ar: "الفترة النشطة",
        pt: "Período Ativo",
        ru: "Активный период",
        nl: "Actieve Periode"
    },
    daysSuffix: {
        en: "{n} Days",
        id: "{n} Hari",
        es: "{n} Días",
        fr: "{n} Jours",
        de: "{n} Tage",
        ja: "{n} 日間",
        ko: "{n} 일",
        zh: "{n} 天",
        ar: "{n} أيام",
        pt: "{n} Dias",
        ru: "{n} дн.",
        nl: "{n} Dagen"
    },
    ratings: {
        optimal: {
            en: "Optimal Discipline",
            id: "Disiplin Optimal",
            es: "Disciplina Óptima",
            fr: "Discipline Optimale",
            de: "Optimale Disziplin",
            ja: "極めて優秀な規律",
            ko: "최적의 절제력",
            zh: "极佳自律",
            ar: "انضباط ممتاز",
            pt: "Disciplina Ideal",
            ru: "Отличная дисциплина",
            nl: "Optimale Discipline"
        },
        balanced: {
            en: "Balanced Pace",
            id: "Keseimbangan Baik",
            es: "Ritmo Equilibrado",
            fr: "Rythme Équilibré",
            de: "Ausgewogener Rhythmus",
            ja: "バランス良好",
            ko: "균형 잡힌 페이스",
            zh: "稳健平衡",
            ar: "وتيرة متوازنة",
            pt: "Ritmo Equilibrado",
            ru: "Хороший баланс",
            nl: "Evenwichtig Tempo"
        },
        caution: {
            en: "Caution Advised",
            id: "Perlu Kehati-hatian",
            es: "Precaución Sugerida",
            fr: "Prudence Recommandée",
            de: "Vorsicht Geraten",
            ja: "支出に注意",
            ko: "주의 필요",
            zh: "建议审慎",
            ar: "الحذر مطلوب",
            pt: "Cautela Recomendada",
            ru: "Требуется осторожность",
            nl: "Voorzichtigheid Geboden"
        },
        action: {
            en: "Action Required",
            id: "Perlu Evaluasi",
            es: "Acción Requerida",
            fr: "Action Requise",
            de: "Handlungsbedarf",
            ja: "早急な見直し推奨",
            ko: "조치 필요",
            zh: "急需调整",
            ar: "يتطلب اتخاذ إجراء",
            pt: "Ação Necessária",
            ru: "Требуются меры",
            nl: "Actie Vereist"
        }
    },
    sec1Title: {
        en: "1. Spending Breakdown by Category",
        id: "1. Rincian Pengeluaran berdasarkan Kategori",
        es: "1. Desglose de Gastos por Categoría",
        fr: "1. Répartition des Dépenses par Catégorie",
        de: "1. Ausgabenaufschlüsselung nach Kategorie",
        ja: "1. カテゴリ別支出内訳",
        ko: "1. 카테고리별 지출 내역",
        zh: "1. 分类支出明细",
        ar: "1. تفاصيل النفقات حسب الفئة",
        pt: "1. Detalhamento de Gastos por Categoria",
        ru: "1. Структура расходов по категориям",
        nl: "1. Uitgavenoverzicht per Categorie"
    },
    sec1Subtitle: {
        en: "Distribution of outgoing expenses categorized for this statement period",
        id: "Distribusi pengeluaran yang dikelompokkan selama periode laporan ini",
        es: "Distribución de gastos clasificados para este período del estado",
        fr: "Distribution des dépenses classées pour cette période de relevé",
        de: "Verteilung der Ausgaben kategorisiert für diesen Berichtszeitraum",
        ja: "当対象期間におけるカテゴリ別の支出配分",
        ko: "해당 보고 기간 동안 분류된 지출 항목 분포",
        zh: "统计周期内按类别分类的资金支出分布",
        ar: "توزيع المصروفات المصنفة خلال فترة هذا الكشف",
        pt: "Distribuição das despesas categorizadas para este período do relatório",
        ru: "Распределение расходов по категориям за отчетный период",
        nl: "Verdeling van de uitgaven gecategoriseerd voor deze periode"
    },
    tableHeadCat: {
        en: ["Category", "Amount Spent", "% of Total", "Budget Status"],
        id: ["Kategori", "Jumlah Terpakai", "% dari Total", "Status Anggaran"],
        es: ["Categoría", "Monto Gastado", "% del Total", "Estado de Presupuesto"],
        fr: ["Catégorie", "Montant Dépensé", "% du Total", "Statut du Budget"],
        de: ["Kategorie", "Ausgegebener Betrag", "% von Gesamt", "Budgetstatus"],
        ja: ["カテゴリ", "支出金額", "全体割合", "予算状況"],
        ko: ["카테고리", "지출액", "전체 비율", "예산 상태"],
        zh: ["类别", "支出金额", "占比", "预算状态"],
        ar: ["الفئة", "المبلغ المصروف", "% من الإجمالي", "حالة الميزانية"],
        pt: ["Categoria", "Valor Gasto", "% do Total", "Status do Orçamento"],
        ru: ["Категория", "Сумма расходов", "% от итога", "Статус бюджета"],
        nl: ["Categorie", "Besteed Bedrag", "% van Totaal", "Budgetstatus"]
    },
    statusNormal: {
        en: "Normal (<20%)",
        id: "Wajar (<20%)",
        es: "Normal (<20%)",
        fr: "Normal (<20%)",
        de: "Normal (<20%)",
        ja: "標準的 (<20%)",
        ko: "적정 (<20%)",
        zh: "正常 (<20%)",
        ar: "طبيعي (<20%)",
        pt: "Normal (<20%)",
        ru: "В норме (<20%)",
        nl: "Normaal (<20%)"
    },
    statusModerate: {
        en: "Moderate (20-35%)",
        id: "Moderat (20-35%)",
        es: "Moderado (20-35%)",
        fr: "Modéré (20-35%)",
        de: "Moderat (20-35%)",
        ja: "中程度 (20-35%)",
        ko: "보통 (20-35%)",
        zh: "中等 (20-35%)",
        ar: "متوسط (20-35%)",
        pt: "Moderado (20-35%)",
        ru: "Умеренно (20-35%)",
        nl: "Gematigd (20-35%)"
    },
    statusHigh: {
        en: "High Share (>35%)",
        id: "Porsi Tinggi (>35%)",
        es: "Proporción Alta (>35%)",
        fr: "Part Élevée (>35%)",
        de: "Hoher Anteil (>35%)",
        ja: "高比率 (>35%)",
        ko: "높은 비중 (>35%)",
        zh: "偏高占比 (>35%)",
        ar: "نسبة عالية (>35%)",
        pt: "Alta Parcela (>35%)",
        ru: "Высокая доля (>35%)",
        nl: "Hoog Aandeel (>35%)"
    },
    noCategorizedExpenses: {
        en: "No Categorized Expenses",
        id: "Tidak Ada Pengeluaran",
        es: "Sin Gastos Categorizados",
        fr: "Aucune Dépense Catégorisée",
        de: "Keine kategorisierten Ausgaben",
        ja: "記録された支出はありません",
        ko: "분류된 지출 없음",
        zh: "暂无分类支出",
        ar: "لا توجد نفقات مصنفة",
        pt: "Sem Despesas Categorizadas",
        ru: "Нет категорий расходов",
        nl: "Geen gecategoriseerde uitgaven"
    },
    totalExpensesRow: {
        en: "Total Expenses",
        id: "Total Pengeluaran",
        es: "Gastos Totales",
        fr: "Dépenses Totales",
        de: "Gesamtausgaben",
        ja: "支出合計",
        ko: "총 지출액",
        zh: "总支出",
        ar: "إجمالي النفقات",
        pt: "Total de Despesas",
        ru: "Всего расходов",
        nl: "Totale Uitgaven"
    },
    sustainablyFunded: {
        en: "Sustainably Funded",
        id: "Terdanai Aman",
        es: "Financiado Sosteniblemente",
        fr: "Financé Durablement",
        de: "Nachhaltig Finanziert",
        ja: "収支黒字で安全",
        ko: "안정적 충당",
        zh: "资金充裕安全",
        ar: "تمويل مستدام",
        pt: "Financiado com Segurança",
        ru: "Устойчивый баланс",
        nl: "Duurzaam Gefinancierd"
    },
    exceedsIncome: {
        en: "Exceeds Income",
        id: "Melebihi Pemasukan",
        es: "Excede los Ingresos",
        fr: "Dépasse les Revenus",
        de: "Übersteigt Einnahmen",
        ja: "収入を超過",
        ko: "수입 초과",
        zh: "超出当期收入",
        ar: "يتجاوز الدخل",
        pt: "Excede a Renda",
        ru: "Превышает доход",
        nl: "Overschrijdt Inkomsten"
    },
    sec2Title: {
        en: "2. Financial Health Assessment & Action Plan",
        id: "2. Evaluasi Kesehatan Finansial & Rencana Aksi",
        es: "2. Evaluación de Salud Financiera y Plan de Acción",
        fr: "2. Évaluation de la Santé Financière et Plan d'Action",
        de: "2. Finanzielle Bewertung & Aktionsplan",
        ja: "2. 財務健全度評価とアクションプラン",
        ko: "2. 재무 건전성 평가 및 실행 계획",
        zh: "2. 财务健康评估与行动建议",
        ar: "2. تقييم الصحة المالية وخطة العمل",
        pt: "2. Avaliação de Saúde Financeira e Plano de Ação",
        ru: "2. Оценка финансового здоровья и план действий",
        nl: "2. Financiële Gezondheidsbeoordeling & Actieplan"
    },
    sec2Subtitle: {
        en: "Personalized takeaways and practical next steps tailored to your monthly cash flow",
        id: "Wawasan khusus dan langkah praktis yang disesuaikan dengan arus kas Anda",
        es: "Conclusiones personalizadas y pasos prácticos adaptados a tu flujo de caja",
        fr: "Points clés personnalisés et étapes pratiques adaptées à votre trésorerie",
        de: "Personalisierte Erkenntnisse und praktische Schritte für Ihren Cashflow",
        ja: "あなたの収支パターンに合わせた実践的なインサイトと次の一歩",
        ko: "월간 현금 흐름에 맞춘 맞춤형 분석 및 실천 단계",
        zh: "根据您的收支现金流定制的个性化见解与实用行动建议",
        ar: "رؤى مخصصة وخطوات عملية مصممة وفقا لتدفقك النقدي الشهري",
        pt: "Insights personalizados e passos práticos adaptados ao seu fluxo de caixa",
        ru: "Персональные выводы и практические шаги на основе ваших финансов",
        nl: "Persoonlijke inzichten en praktische vervolgstappen voor uw cashflow"
    },
    narrativeExcellent: {
        en: "Outstanding run in {period}! You kept {pct}% of your income tucked away, finishing with a net cash surplus of {net}. Your main outflow was {cat} ({catPct}% of spend), but your strong financial discipline kept you comfortably in the green.",
        id: "Pencapaian luar biasa di {period}! Anda berhasil menyisihkan {pct}% pendapatan, menghasilkan surplus bersih {net}. Pengeluaran terbesar adalah {cat} ({catPct}% dari belanja), namun kedisiplinan keuangan Anda membuat posisi tetap aman.",
        es: "¡Excelente desempeño en {period}! Guardaste el {pct}% de tus ingresos, logrando un superávit neto de {net}. El gasto principal fue {cat} ({catPct}% del total), pero tu disciplina financiera te mantuvo en terreno positivo.",
        fr: "Excellente gestion en {period} ! Vous avez conservé {pct}% de vos revenus, avec un surplus net de {net}. La dépense principale a été {cat} ({catPct}% du total), mais votre rigueur vous maintient dans le vert.",
        de: "Hervorragende Leistung im {period}! Sie haben {pct}% Ihres Einkommens gespart und einen Nettoüberschuss von {net} erzielt. Größter Posten war {cat} ({catPct}% der Ausgaben), doch Ihre Disziplin hält Sie klar im Plus.",
        ja: "{period}は素晴らしい成果でした！収入の{pct}%を手元に残し、{net}の純剰余金を確保しました。主な支出は{cat}（支出の{catPct}%）でしたが、優れた規律により健全な黒字を維持しています。",
        ko: "{period} 동안 탁월한 성과를 거두었습니다! 수입의 {pct}%를 저축하여 {net}의 순 흑자를 기록했습니다. 주요 지출은 {cat}(지출의 {catPct}%)이었으나, 뛰어난 재정 절제력으로 안전하게 흑자를 유지했습니다.",
        zh: "{period} 表现非常出色！您留存了 {pct}% 的当期收入，实现了 {net} 的净资金盈余。最大单项支出为 {cat}（占支出的 {catPct}%），良好的财务自律让您的资产稳步增长。",
        ar: "أداء متميز في {period}! لقد ادخرت {pct}% من دخلك محققا فائضا صافيا قدره {net}. كانت النفقات الرئيسية في {cat} ({catPct}% من الإنفاق)، لكن انضباطك المالي أبقى ميزانيتك بأمان تام.",
        pt: "Excelente desempenho em {period}! Você guardou {pct}% da sua renda, alcançando um superávit líquido de {net}. O maior gasto foi {cat} ({catPct}% do total), mas sua disciplina manteve você no azul com folga.",
        ru: "Отличный результат за {period}! Вы сохранили {pct}% дохода с чистым профицитом {net}. Основные траты пришлись на категорию {cat} ({catPct}% расходов), но строгая дисциплина помогла остаться в надежном плюсе.",
        nl: "Uitstekend resultaat in {period}! U heeft {pct}% van uw inkomen behouden met een netto surplus van {net}. De grootste uitgave was {cat} ({catPct}% van de uitgaven), maar uw discipline houdt u ruim in het groen."
    },
    narrativeSolid: {
        en: "Solid financial balance in {period}! You saved {pct}% of what you brought in ({net} net surplus). Your biggest spending went toward {cat} at {catPct}%. With steady habits already working, minor trims can unlock extra cash even faster.",
        id: "Keseimbangan keuangan yang solid di {period}! Anda menabung {pct}% dari pemasukan (surplus bersih {net}). Pengeluaran terbesar pada {cat} sebesar {catPct}%. Kebiasaan baik Anda sudah terbentuk, sedikit penyesuaian akan mempercepat tabungan.",
        es: "¡Equilibrio financiero sólido en {period}! Ahorraste el {pct}% de tus ingresos (superávit neto de {net}). El mayor gasto fue {cat} con un {catPct}%. Con estos buenos hábitos, pequeños ajustes liberarán aún más fondos.",
        fr: "Solide équilibre financier en {period} ! Vous avez épargné {pct}% de vos rentrées (surplus net de {net}). La plus grosse dépense concerne {cat} à {catPct}%. Avec ces bonnes habitudes, de légers ajustements libéreront encore plus de fonds.",
        de: "Solide finanzielle Balance im {period}! Sie haben {pct}% Ihrer Einnahmen gespart ({net} Nettoüberschuss). Die größte Ausgabe war {cat} mit {catPct}%. Ihre guten Gewohnheiten greifen bereits, kleine Anpassungen sparen noch mehr.",
        ja: "{period}は安定した健全な財務バランスです！収入の{pct}%を貯蓄に回し（純剰余金 {net}）、最大の支出は{cat}（{catPct}%）でした。良い習慣が定着しており、少しの支出見直しでさらに資金を増やせます。",
        ko: "{period} 동안 견고한 재정 균형을 유지했습니다! 수입의 {pct}%를 저축했습니다({net} 순 흑자). 최대 지출은 {cat}({catPct}%)이었습니다. 좋은 습관이 자리잡아 작은 조정으로도 더 많은 여유 자금을 확보할 수 있습니다.",
        zh: "{period} 财务收支非常稳健！您留存了收入的 {pct}%（净盈余 {net}）。支出最多的类别是 {cat}（占比 {catPct}%）。良好的习惯已见成效，微小的优化即可释放更多储备金。",
        ar: "توازن مالي قوي في {period}! لقد وفرت {pct}% من إجمالي دخلك (فائض صافٍ قدره {net}). كانت أكبر نفقاتك في {cat} بنسبة {catPct}%. مع عاداتك الثابتة، يمكن لتقليص بسيط أن يوفر أموالا إضافية بسرعة.",
        pt: "Equilíbrio financeiro sólido em {period}! Você economizou {pct}% da sua receita (superávit líquido de {net}). O maior gasto foi em {cat} com {catPct}%. Seus bons hábitos já funcionam bem; pequenos ajustes trarão ainda mais resultados.",
        ru: "Уверенный финансовый баланс за {period}! Вы отложили {pct}% доходов (чистый профицит {net}). Больше всего ушло на {cat}  -  {catPct}%. Ваши привычки работают стабильно, а точечная оптимизация освободит еще больше средств.",
        nl: "Solide financiële balans in {period}! U spaarde {pct}% van uw inkomsten (netto surplus van {net}). De grootste kostenpost was {cat} met {catPct}%. Met deze goede gewoontes levert een kleine bijsturing direct extra cash op."
    },
    narrativeModest: {
        en: "You kept things afloat this month with a modest {net} surplus ({pct}% saved). Most outflows went into {cat} ({catPct}%). Giving yourself a bit more buffer next month will give your wallet much more breathing room.",
        id: "Arus kas tetap terkendali bulan ini dengan surplus {net} ({pct}% tersimpan). Sebagian besar keluar untuk {cat} ({catPct}%). Menyiapkan cadangan sedikit lebih besar bulan depan akan membuat dompet Anda jauh lebih lega.",
        es: "Mantuviste la estabilidad este mes con un modesto superávit de {net} ({pct}% ahorrado). La mayor salida fue en {cat} ({catPct}%). Darte un poco más de margen el próximo mes te dará mucha más tranquilidad.",
        fr: "Vous avez maintenu le cap ce mois-ci avec un léger surplus de {net} ({pct}% épargné). La majeure partie des sorties est allée à {cat} ({catPct}%). Prévoir une marge supplémentaire le mois prochain vous apportera un vrai confort.",
        de: "Sie haben die Finanzen im Plus gehalten mit einem moderaten Überschuss von {net} ({pct}% gespart). Die meisten Ausgaben flossen in {cat} ({catPct}%). Ein etwas größeres Polster nächsten Monat bringt deutliche Entlastung.",
        ja: "今月は小幅な余剰（{net}、貯蓄率{pct}%）で維持できました。支出の大半は{cat}（{catPct}%）でした。来月は少し余裕を持たせることで、家計にさらに安心感が生まれます。",
        ko: "이번 달은 {net}의 완만한 흑자(저축률 {pct}%)로 균형을 지켰습니다. 대부분의 지출은 {cat}({catPct}%)에 집중되었습니다. 다음 달에는 완충 여유를 조금 더 확보하면 훨씬 여유로워집니다.",
        zh: "本周期保持了基本收支平稳，实现了小幅资金盈余 {net}（储蓄率 {pct}%）。主要支出流向了 {cat}（占比 {catPct}%）。下个月适当预留更多缓冲金，财务状况将更加从容。",
        ar: "حافظت على توازنك المالي هذا الشهر بفائض معتدل قدره {net} ({pct}% مدخرات). ذهب معظم الإنفاق إلى {cat} ({catPct}%). منح نفسك مساحة أمان أكبر الشهر المقبل سيمنحك راحة مالية أكبر.",
        pt: "Você manteve as contas no azul com um superávit moderado de {net} ({pct}% poupado). A maior parte saiu em {cat} ({catPct}%). Criar uma folga um pouco maior no próximo mês trará muito mais tranquilidade.",
        ru: "Финансы остались под контролем со скромным профицитом {net} (сохранено {pct}%). Основная доля пришлась на {cat} ({catPct}%). Небольшой дополнительный запас в следующем месяце обеспечит комфортный резерв.",
        nl: "U hield de balans op peil met een bescheiden overschot van {net} ({pct}% gespaard). Het merendeel ging naar {cat} ({catPct}%). Een iets ruimere buffer volgende maand geeft meteen meer financiële ademruimte."
    },
    narrativeDeficit: {
        en: "Outflows outpaced income by {net} in {period}. Occasional heavy spending cycles happen, especially with {cat} taking up {catPct}% of total costs. The best move now is steadying the ship with a couple of painless spending cuts next month.",
        id: "Pengeluaran melebihi pemasukan sebesar {net} di {period}. Pengeluaran besar sesekali wajar terjadi, terutama {cat} yang mencapai {catPct}% total biaya. Langkah terbaik sekarang adalah menstabilkan kembali dengan sedikit penghematan bulan depan.",
        es: "Los gastos superaron a los ingresos por {net} en {period}. Períodos de gastos elevados ocurren, especialmente con {cat} absorbiendo el {catPct}% de los costes. La mejor medida ahora es estabilizar la situación con recortes moderados.",
        fr: "Les dépenses ont dépassé les revenus de {net} en {period}. Des pics ponctuels peuvent arriver, surtout avec {cat} représentant {catPct}% du total. L'essentiel est de redresser la barre le mois prochain grâce à quelques ajustements ciblés.",
        de: "Ausgaben überstiegen Einnahmen um {net} im {period}. Phasen erhöhter Ausgaben kommen vor, insbesondere da {cat} {catPct}% ausmachte. Empfohlen wird nun eine Stabilisierung durch moderate Einsparungen im nächsten Monat.",
        ja: "{period}の支出は収入を{net}上回りました。特に{cat}が支出全体の{catPct}%を占めています。来月は無理のない範囲で支出を見直し、収支バランスを整えましょう。",
        ko: "{period} 동안 지출이 수입을 {net} 초과했습니다. 특히 {cat} 항목이 전체 비용의 {catPct}%를 차지했습니다. 다음 달에는 부담 없는 범위에서 지출을 조절하여 수지를 안정화하는 것을 권장합니다.",
        zh: "{period} 的总开支超出了收入 {net}。高支出周期偶有发生，尤其是 {cat} 占据了总支出的 {catPct}%。当下最有效的策略是通过温和精简开支，在下个周期迅速恢复收支平衡。",
        ar: "تجاوزت المصروفات الدخل بمقدار {net} في {period}. فترات الإنفاق المرتفع واردة أحيانا، خاصة مع استحواذ {cat} على {catPct}% من التكاليف. الحل الأمثل الآن هو إعادة التوازن بخطوات ترشيد بسيطة للشهر المقبل.",
        pt: "As despesas superaram as receitas em {net} em {period}. Picos esporádicos acontecem, principalmente com {cat} representando {catPct}% dos custos. O melhor passo agora é reequilibrar o caixa com pequenos cortes no próximo mês.",
        ru: "Расходы превысили доходы на {net} за {period}. Периоды крупных трат случаются, особенно с долей {cat} в {catPct}%. Оптимальный шаг  -  восстановить баланс парой комфортных сокращений расходов в следующем месяце.",
        nl: "De uitgaven overstegen de inkomsten met {net} in {period}. Periodieke uitschieters komen voor, zeker met {cat} op {catPct}% van de kosten. Breng de situatie volgende maand weer in balans met gerichte besparingen."
    },
    stepFoodTitle: {
        en: "Dial In Your Food & Dining Rhythm", id: "Atur Ritme Makan & Jajan", es: "Ajusta el Ritmo de Alimentación", fr: "Ajustez vos Repas & Sorties", de: "Ernährungs- & Gastro-Ausgaben Optimieren", ja: "食費・外食のリズムを整える", ko: "식비 및 외식 습관 조절하기", zh: "合理规划餐饮与外食开销", ar: "تنظيم ميزانية الطعام والمطاعم", pt: "Ajuste os Gastos com Alimentação", ru: "Оптимизируйте траты на питание", nl: "Eten & Horeca Uitgaven Balanceren"
    },
    stepFoodDesc: {
        en: "Food took {amt} ({pct}% of spend). Swapping just 2-3 outside meals a week for easy home cooking easily frees up {save} next month without feeling restrictive.",
        id: "Makan & minum mencapai {amt} ({pct}% pengeluaran). Mengganti 2-3 kali makan di luar dengan masak sendiri bisa menghemat {save} bulan depan tanpa terasa berat.",
        es: "La comida sumó {amt} ({pct}% del gasto). Cambiar solo 2 o 3 comidas fuera por cocina en casa liberará fácilmente {save} el próximo mes sin privaciones.",
        fr: "L'alimentation a représenté {amt} ({pct}% des dépenses). Cuisiner chez vous 2 ou 3 fois de plus par semaine permet d'économiser facilement {save} le mois prochain.",
        de: "Essen & Trinken machten {amt} aus ({pct}%). Bereits 2-3 selbst gekochte Mahlzeiten pro Woche sparen nächsten Monat mühelos {save} ein.",
        ja: "食費は{amt}（支出の{pct}%）でした。週に2〜3回の外食を自炊に替えるだけで、来月無理なく{save}を節約できます。",
        ko: "식비가 {amt}(지출의 {pct}%)를 차지했습니다. 주 2~3회 외식을 집밥으로 전환하면 다음 달 부담 없이 {save}의 여유 자금을 확보할 수 있습니다.",
        zh: "餐饮支出达 {amt}（占 {pct}%）。每周只需减少 2 至 3 次外食并亲自下厨，下个月即可轻松省下 {save}。",
        ar: "استحوذ الطعام على {amt} ({pct}% من الإنفاق). استبدال وجبتين أو 3 خارج المنزل بالطهي المنزلي يوفر {save} الشهر القادم بكل أريحية.",
        pt: "Alimentação consumiu {amt} ({pct}% do total). Trocar 2 a 3 refeições fora por preparo caseiro na semana pode liberar {save} no próximo mês.",
        ru: "На еду ушло {amt} ({pct}% расходов). Замена 2–3 приемов пищи вне дома домашней готовкой легко освободит {save} в следующем месяце.",
        nl: "Eten & drinken bedroeg {amt} ({pct}% van het totaal). Vervang wekelijks 2-3 etentjes buiten de deur om moeiteloos {save} vrij te spelen."
    },
    stepShoppingTitle: {
        en: "Use the 48-Hour Cart Rule", id: "Gunakan Aturan Keranjang 48 Jam", es: "Aplica la Regla de las 48 Horas", fr: "Appliquez la Règle des 48 Heures", de: "Die 48-Stunden-Warenkorb-Regel Nutzen", ja: "48時間カートルールを実践する", ko: "48시간 장바구니 규칙 적용하기", zh: "践行 48 小时购物车冷静期", ar: "تطبيق قاعدة سلة التسوق لـ 48 ساعة", pt: "Use a Regra das 48 Horas no Carrinho", ru: "Правило 48 часов перед покупкой", nl: "Pas de 48-Uurs Winkelmandregel Toe"
    },
    stepShoppingDesc: {
        en: "Shopping totaled {amt}. Before checking out on non-essential items, wait 48 hours. Most impulse desires cool off naturally, leaving more money directly in your pocket.",
        id: "Belanja mencapai {amt}. Sebelum membeli barang non-esensial, tunggu 48 jam. Keinginan impulsif biasanya mereda dengan sendirinya, menjaga dompet Anda tetap aman.",
        es: "Las compras sumaron {amt}. Antes de pagar artículos no esenciales, espera 48 horas. La mayoría de compras impulsivas se disipan solas, protegiendo tu dinero.",
        fr: "Les achats ont totalisé {amt}. Attendez 48 heures avant de finaliser un achat non essentiel. Les envies impulsives s'estompent naturellement.",
        de: "Einkäufe beliefen sich auf {amt}. Warten Sie vor dem Kauf nicht zwingender Dinge 48 Stunden. Spontane Kaufimpulse verfliegen meist von selbst.",
        ja: "ショッピングの合計は{amt}でした。不要不急の買い物は48時間置くことで衝動買いが自然と収まり、手元に残る資金が増えます。",
        ko: "쇼핑 지출이 {amt}에 달했습니다. 비필수품 구매 전 48시간을 기다려보세요. 충동구매 욕구가 자연스럽게 가라앉아 자금을 지킬 수 있습니다.",
        zh: "购物总计 {amt}。在结算非必需品前请等待 48 小时，冲动消费倾向会自然降温，直接保留更多现金流。",
        ar: "بلغ إجمالي التسوق {amt}. انتظر 48 ساعة قبل شراء أي غرض غير ضروري، فمعظم الرغبات اللحظية تتلاشى ذاتيا ويبقى المال في جيبك.",
        pt: "Compras totalizaram {amt}. Antes de comprar itens não essenciais, aguarde 48 horas. Desejos impulsivos costumam esfriar sozinhos, poupando seu dinheiro.",
        ru: "Покупки составили {amt}. Подождите 48 часов перед оплатой спонтанных товаров. Большинство импульсивных желаний остывает само собой.",
        nl: "Aankopen bedroegen {amt}. Wacht bij niet-essentiële uitgaven 48 uur. Veel impulsen verdwijnen vanzelf, waardoor u geld in uw zak houdt."
    },
    stepTransportTitle: {
        en: "Streamline Commute & Travel Expenses", id: "Optimalkan Biaya Transportasi", es: "Optimiza Gastos de Transporte y Viajes", fr: "Optimisez vos Déplacements et Trajets", de: "Fahrt- und Pendelkosten Straffen", ja: "交通・移動費を最適化する", ko: "교통 및 이동 비용 최적화하기", zh: "合理优化通勤与出行支出", ar: "تنظيم مصاريف التنقل والمواصلات", pt: "Otimize Gastos com Transporte", ru: "Оптимизируйте транспортные расходы", nl: "Optimaliseer Reiskosten & Vervoer"
    },
    stepTransportDesc: {
        en: "Travel expenses reached {amt} ({pct}%). Bundling weekly errands and reviewing transit pass options can easily shave 10-15% off this category next month.",
        id: "Transportasi mencapai {amt} ({pct}%). Menggabungkan rute perjalanan atau mengevaluasi opsi tiket langganan dapat menghemat 10-15% pos ini di bulan depan.",
        es: "El transporte alcanzó {amt} ({pct}%). Agrupar gestiones semanales y revisar abonos de transporte puede ahorrar un 10-15% el próximo mes.",
        fr: "Les transports ont atteint {amt} ({pct}%). Regrouper vos trajets et comparer les abonnements permet d'économiser facilement 10 à 15% le mois prochain.",
        de: "Mobilität lag bei {amt} ({pct}%). Erledigungen bündeln und Tarifoptionen prüfen kann die Kosten im nächsten Monat problemlos um 10-15% senken.",
        ja: "移動費は{amt}（{pct}%）でした。移動のまとめや定期券・交通手段の見直しにより、来月10〜15%の削減が期待できます。",
        ko: "교통비가 {amt}({pct}%)에 달했습니다. 이동 동선을 묶고 대중교통 정기권 등을 점검하면 다음 달 10~15%를 쉽게 절감할 수 있습니다.",
        zh: "交通出行开支为 {amt}（占 {pct}%）。合并每周外出行程并评估通票优惠，可在下个月轻松减少 10-15% 的此类支出。",
        ar: "بلغت تكاليف النقل {amt} ({pct}%). تنظيم المشاوير الأسبوعية ومراجعة خيارات الاشتراكات يخفض هذه الفئة بنسبة 10-15% الشهر القادم.",
        pt: "Transporte atingiu {amt} ({pct}%). Agrupar deslocamentos e revisar opções de passes pode cortar facilmente de 10% a 15% deste grupo no próximo mês.",
        ru: "Транспорт составил {amt} ({pct}%). Объединение поездок и ревизия проездных тарифов могут сэкономить 10–15% на этой статье в следующем месяце.",
        nl: "Vervoer bedroeg {amt} ({pct}%). Combineer ritten en bekijk abonnementsopties om volgende maand gemakkelijk 10-15% te besparen."
    },
    stepBillsTitle: {
        en: "Audit Hidden Recurring Drains", id: "Audit Tagihan & Langganan Rutin", es: "Revisa Gastos Fijos y Suscripciones", fr: "Auditez les Prélèvements Récurrents", de: "Wiederkehrende Fixkosten Überprüfen", ja: "固定費・サブスクリプションを点検する", ko: "고정비 및 정기 구독 점검하기", zh: "排查隐形定期订阅扣款", ar: "مراجعة الاشتراكات والفواتير المتكررة", pt: "Faça uma Auditoria nas Assinaturas", ru: "Проверьте регулярные подписки", nl: "Onderzoek Vaste Lasten & Abonnementen"
    },
    stepBillsDesc: {
        en: "Fixed lifestyle costs took {amt}. Take 5 minutes to audit recurring subscriptions and service plans - canceling just 1 or 2 unused services stops unnecessary monthly leak.",
        id: "Biaya rutin mencapai {amt}. Luangkan 5 menit memeriksa langganan bulanan - membatalkan 1 atau 2 layanan yang jarang dipakai akan menghentikan kebocoran rutin.",
        es: "Los costes fijos sumaron {amt}. Revisa 5 minutos tus suscripciones y planes: cancelar solo 1 o 2 servicios sin uso frenará fugas mensuales innecesarias.",
        fr: "Les coûts récurrents ont pris {amt}. Prenez 5 minutes pour examiner vos abonnements : en résilier un ou deux inutilisés stoppe immédiatement les fuites.",
        de: "Fixe Kosten lagen bei {amt}. Nehmen Sie sich 5 Minuten für einen Abo-Check: 1-2 ungenutzte Dienste zu kündigen beendet unnötige monatliche Verluste.",
        ja: "固定費・生活費は{amt}でした。使っていない定期サービスやプランを点検して1〜2個解約するだけで、毎月の無駄な出費を止められます。",
        ko: "고정 생활비가 {amt}에 달했습니다. 정기 구독 목록을 점검하여 사용하지 않는 서비스 1~2개만 정리해도 불필요한 지출 누수를 막을 수 있습니다.",
        zh: "固定生活开支为 {amt}。花 5 分钟排查自动续费订阅，取消 1 到 2 项闲置服务，即可立即截断不必要的每月资金流失。",
        ar: "استهلكت المصاريف الثابتة {amt}. خصص 5 دقائق لمراجعة الاشتراكات المتكررة، فإلغاء خدمة أو اثنتين غير مستخدمتين يوقف الهدر الشهري تماما.",
        pt: "Custos fixos levaram {amt}. Dedique 5 minutos para auditar assinaturas ativas: cancelar apenas 1 ou 2 serviços não usados estanca vazamentos mensais.",
        ru: "Фиксированные расходы составили {amt}. Уделите 5 минут ревизии подписок: отмена 1–2 неиспользуемых сервисов моментально остановит утечку денег.",
        nl: "Vaste lasten kostten {amt}. Neem 5 minuten om abonnementen te controleren: het opzeggen van 1 of 2 ongebruikte diensten stopt direct onnodige lekken."
    },
    stepEntertainmentTitle: {
        en: "Set a Clear Weekend Fun Allowance", id: "Tentukan Kuota Hiburan Akhir Pekan", es: "Define un Presupuesto de Ocio para Finde", fr: "Définissez un Budget Plaisir pour le Week-end", de: "Klares Wochenend-Spaßbudget Festlegen", ja: "週末の娯楽予算をあらかじめ設定する", ko: "주말 여가 예산 상한 설정하기", zh: "设立明确的周末娱乐消费限额", ar: "تحديد ميزانية واضحة للترفيه في عطلة الأسبوع", pt: "Defina uma Cota de Lazer para Fins de Semana", ru: "Выделите лимит на отдых в выходные", nl: "Stel een Vaste Weekend-Uitgavenpot In"
    },
    stepEntertainmentDesc: {
        en: "Leisure spending totaled {amt}. Enjoying your earnings is essential - set a dedicated weekend quota so you can treat yourself freely without budget guilt.",
        id: "Hiburan mencapai {amt}. Menikmati hasil kerja itu penting - tetapkan kuota khusus agar bisa bersenang-senang tanpa rasa bersalah.",
        es: "El ocio totalizó {amt}. Disfrutar lo ganado es vital: fija una cuota para el fin de semana y diviértete con total tranquilidad sin culpa.",
        fr: "Les loisirs ont totalisé {amt}. Profiter de vos gains est essentiel : fixez un montant dédié au week-end pour vous faire plaisir sans culpabiliser.",
        de: "Freizeit belief sich auf {amt}. Sich etwas zu gönnen ist wichtig: Ein festes Wochenend-Budget erlaubt Genuss ganz ohne schlechtes Gewissen.",
        ja: "レジャー支出は{amt}でした。楽しみは大切です。週末専用の上限枠を決めることで、罪悪感なく有意義に楽しめます。",
        ko: "여가 지출이 {amt}였습니다. 보상을 즐기는 것은 중요하므로, 주말 전용 한도를 정해두면 죄책감 없이 자유롭게 즐길 수 있습니다.",
        zh: "休闲娱乐支出共计 {amt}。享受劳动成果至关重要，设定专属的周末娱乐额度，让您无需为消费感到内疚。",
        ar: "بلغ إنفاق الترفيه {amt}. الاستمتاع بدخلك أمر ضروري، حدد حصة مخصصة لعطلة نهاية الأسبوع لتكافئ نفسك بحرية ودون أي شعور بالذنب.",
        pt: "Gastos com lazer somaram {amt}. Aproveitar o que ganha é vital: defina uma cota de fim de semana para se divertir sem culpa orçamentária.",
        ru: "Развлечения составили {amt}. Наслаждаться доходом важно: задайте фиксированную сумму на выходные, чтобы отдыхать без чувства вины.",
        nl: "Vrije tijd kostte {amt}. Genieten van uw inkomen is belangrijk: stel een weekendbudget in zodat u zorgeloos en zonder schuldgevoel kunt ontspannen."
    },
    stepDefaultTitle: {
        en: "Put a Friendly Soft Cap on {cat}", id: "Beri Batas Anggaran untuk {cat}", es: "Establece un Límite Flexible para {cat}", fr: "Fixez un Plafond Souple sur {cat}", de: "Setzen Sie ein Budgetlimit für {cat}", ja: "{cat}の支出枠を設定する", ko: "{cat} 지출 목표 한도 설정하기", zh: "为 {cat} 设立适度支出限额", ar: "وضع حد مرن للإنفاق على {cat}", pt: "Defina um Teto Flexível para {cat}", ru: "Установите комфортный лимит на {cat}", nl: "Stel een Zacht Plafond In voor {cat}"
    },
    stepDefaultDesc: {
        en: "{cat} was your biggest cash outflow at {amt} ({pct}%). Setting a target in Pocketly to keep it under {target} frees up extra cash effortlessly.",
        id: "{cat} adalah pos pengeluaran terbesar ({amt}, {pct}%). Menetapkan target di Pocketly di bawah {target} akan membuka ruang tabungan baru.",
        es: "{cat} fue tu mayor gasto con {amt} ({pct}%). Poner una meta en Pocketly para mantenerlo bajo {target} liberará dinero sin esfuerzo.",
        fr: "{cat} a été votre plus grosse sortie avec {amt} ({pct}%). Fixer un objectif dans Pocketly sous {target} libérera du disponible sans effort.",
        de: "{cat} war der größte Ausgabenposten mit {amt} ({pct}%). Ein Zielwert unter {target} in Pocketly schafft sofort spürbare Erleichterung.",
        ja: "{cat}が最大の支出（{amt}、{pct}%）でした。Pocketlyで{target}以内を目標に設定すると、無理なく資金の余裕が生まれます。",
        ko: "{cat} 항목이 최대 지출({amt}, {pct}%)이었습니다. Pocketly에서 {target} 이하로 목표를 정하면 자연스럽게 여유 자금이 형성됩니다.",
        zh: "{cat} 是最大单项开销，共 {amt}（占 {pct}%）。在 Pocketly 中设定将其控制在 {target} 以内的目标，将轻松省出结余。",
        ar: "كانت {cat} أكبر تدفق خارج بقيمة {amt} ({pct}%). تحديد هدف في Pocketly لإبقائها دون {target} يوفر فائضا ماليا بسهولة.",
        pt: "{cat} foi sua maior saída com {amt} ({pct}%). Definir uma meta no Pocketly para mantê-lo abaixo de {target} liberará caixa com facilidade.",
        ru: "{cat}  -  крупнейшая статья расходов: {amt} ({pct}%). Цель в Pocketly удержать ее ниже {target} легко высвободит средства.",
        nl: "{cat} was de grootste kostenpost met {amt} ({pct}%). Stel in Pocketly een doel in onder {target} om moeiteloos extra cash te besparen."
    },
    stepDeficitTitle: {
        en: "Run a Quick 7-Day Low-Spend Sprint", id: "Jalankan Tantangan Hemat 7 Hari", es: "Haz un Sprint de 7 Días de Bajo Gasto", fr: "Lancez un Défi de 7 Jours de Dépenses Minimales", de: "Starten Sie einen 7-Tage Spar-Sprint", ja: "7日間の節約スプリントを実施する", ko: "7일간의 지출 다이어트 스프린트", zh: "开展为期 7 天的低消费挑战", ar: "بدء تحدي إنفاق منخفض لمدة 7 أيام", pt: "Faça um Desafio de Baixo Gasto de 7 Dias", ru: "Проведите 7-дневный экономный спринт", nl: "Start een 7-Dagen Spaarchallenge"
    },
    stepDeficitDesc: {
        en: "To shake off the {amt} deficit, pick one upcoming week to stick strictly to essentials. It resets your cash momentum fast and restores balance across your accounts.",
        id: "Untuk menutup defisit {amt}, pilih satu minggu untuk fokus hanya pada kebutuhan pokok. Ini memulihkan kembali keseimbangan kas Anda dengan cepat.",
        es: "Para superar el déficit de {amt}, elige una semana para ceñirte solo a lo esencial. Recuperarás el control y la estabilidad en tus cuentas.",
        fr: "Pour combler le déficit de {amt}, consacrez une semaine prochaine à l'essentiel. Cela rééquilibre rapidement votre trésorerie globale.",
        de: "Um das Defizit von {amt} auszugleichen, beschränken Sie sich eine Woche lang aufs Wesentliche. Das stellt die finanzielle Balance rasch wieder her.",
        ja: "{amt}の赤字を解消するため、来週は必需品のみで過ごす期間を作ってみましょう。収支のリズムが迅速に整います。",
        ko: "{amt}의 적자를 해소하기 위해 다음 주에는 필수 지출에만 집중하는 기간을 가져보세요. 현금 흐름의 균형이 빠르게 회복됩니다.",
        zh: "为了消除 {amt} 的赤字，选定接下来的一周严格仅支付刚需开销，这将迅速重塑现金流势头并恢复收支平衡。",
        ar: "لتجاوز عجز {amt}، خصص أسبوعا قادما للتركيز فقط على الأساسيات، فهذا يستعيد توازن التدفق النقدي في حساباتك سريعا.",
        pt: "Para superar o déficit de {amt}, escolha uma semana para focar apenas no essencial. Isso recupera o ritmo do seu caixa e equilibra as contas.",
        ru: "Чтобы закрыть дефицит в {amt}, проведите одну неделю строго на базовых тратах. Это быстро вернет баланс вашим счетам.",
        nl: "Om het tekort van {amt} weg te werken, kiest u één week waarin u alleen de basis betaalt. Zo herstelt u snel het evenwicht op uw rekeningen."
    },
    stepLowSaveTitle: {
        en: "Save First, Spend What Remains", id: "Tabung di Awal, Belanja Sisanya", es: "Ahorra Primero, Gasta lo que Quede", fr: "Épargnez d'Abord, Dépensez le Reste", de: "Zuerst Sparen, den Rest Ausgeben", ja: "「先取り貯蓄」を徹底する", ko: "먼저 저축하고 남은 돈으로 지출하기", zh: "先存后花，锁定第一笔储蓄", ar: "ادخر أولا ثم أنفق ما تبقى", pt: "Poupe Primeiro, Gaste o que Restar", ru: "Сначала откладывайте, потом тратьте", nl: "Spaar Eerst, Geef de Rest Uit"
    },
    stepLowSaveDesc: {
        en: "Instead of saving whatever happens to be left over, transfer {amt} (10%) right on payday. Treating savings like a bill changes the whole game.",
        id: "Alih-alih menabung sisa uang di akhir bulan, sisihkan {amt} (10%) langsung saat gajian. Perlakukan tabungan layaknya tagihan wajib.",
        es: "En lugar de ahorrar lo que sobre, transfiere {amt} (10%) el mismo día de cobro. Tratar el ahorro como un pago obligatorio lo cambia todo.",
        fr: "Au lieu d'épargner ce qu'il reste, virez {amt} (10%) dès la réception de vos revenus. Traiter l'épargne comme une facture change la donne.",
        de: "Statt Reste zu sparen, legen Sie {amt} (10%) direkt am Zahltag zurück. Ersparnisse wie eine feste Rechnung zu behandeln verändert alles.",
        ja: "月末に残った分を貯金するのではなく、給料日にまず{amt}（10%）を別口座へ移動させましょう。習慣が劇的に変わります。",
        ko: "월말에 남은 돈을 저축하는 대신, 급여일에 {amt}(10%)를 바로 이체하세요. 저축을 고정 청구서처럼 취급하면 결과가 완전히 달라집니다.",
        zh: "不要等到月末有节余才存钱，发薪日当天立即转出 {amt}（10%）。把储蓄当作第一张必须支付的账单，效果显著。",
        ar: "بدلا من ادخار ما يتبقى صدفة، حول {amt} (10%) فور استلام دخلك. التعامل مع الادخار كفاتورة واجبة يغير المعادلة تماما.",
        pt: "Em vez de poupar só o que sobrar, transfira {amt} (10%) logo no dia do pagamento. Tratar a poupança como boleto muda todo o jogo.",
        ru: "Вместо накопления остатков переводите {amt} (10%) сразу в день дохода. Отношение к сбережениям как к обязательному счету изменит всё.",
        nl: "Spaar niet alleen wat overblijft, maar maak direct op de betaaldag {amt} (10%) over. Sparen behandelen als een vaste rekening maakt het verschil."
    },
    stepHighSaveTitle: {
        en: "Put That Idle Cash to Work", id: "Optimalkan Dana Menganggur", es: "Pon a Trabajar el Dinero Inactivo", fr: "Faites Travailler votre Trésorerie Oisive", de: "Lassen Sie freies Kapital für sich Arbeiten", ja: "余剰資金を賢く運用する", ko: "유휴 자금을 현명하게 굴리기", zh: "让闲置资金产生持续复利", ar: "استثمار السيولة الفائضة بحكمة", pt: "Coloque o Dinheiro Parado para Render", ru: "Заставьте свободные деньги работать", nl: "Laat Vrij Vermogen voor U Werken"
    },
    stepHighSaveDesc: {
        en: "You accumulated {amt} in surplus funds. Rather than letting it sit idle, consider routing a chunk into high-yield accounts or investments so it compounds on autopilot.",
        id: "Anda mengumpulkan surplus {amt}. Daripada dibiarkan menganggur, alokasikan sebagian ke instrumen investasi agar berkembang secara otomatis.",
        es: "Acumulaste {amt} de superávit. En lugar de dejarlo inactivo, destina una parte a cuentas remuneradas o inversiones para que crezca solo.",
        fr: "Vous avez dégagé {amt} de surplus. Plutôt que de le laisser dormir, placez-en une partie sur des comptes rémunérés ou en investissement.",
        de: "Sie haben {amt} Überschuss erwirtschaftet. Lassen Sie das Geld nicht ungenutzt liegen, sondern investieren Sie es für automatisches Wachstum.",
        ja: "{amt}の手元資金が蓄積されました。普通預金に眠らせず、高利回り口座や投資信託への配分を検討して資産形成を加速させましょう。",
        ko: "{amt}의 잉여 자금을 마련했습니다. 유휴 자금으로 두기보다 고금리 예금이나 투자로 연결하여 복리 효과를 누려보세요.",
        zh: "您积累了 {amt} 的盈余资金。与其让它闲置，不如将其配置至稳健理财或投资工具中，让财富自动复利增值。",
        ar: "حققت فائضا ماليا قدره {amt}. بدلا من تركه راكدا، وجه جزءا منه لحسابات ذات عائد أو استثمارات لينمو تلقائيا.",
        pt: "Você acumulou {amt} de superávit. Em vez de deixar parado, aplique uma parcela em investimentos para render juros compostos.",
        ru: "Вы накопили профицит {amt}. Вместо хранения на обычном счете направьте часть в накопительные или инвестиционные инструменты.",
        nl: "U heeft een surplus van {amt} opgebouwd. Laat het niet stilzitten, maar zet een deel weg op hoogrenderende rekeningen of beleggingen."
    },
    stepModSaveTitle: {
        en: "Automate Your Payday Savings Split", id: "Otomatiskan Alokasi Tabungan Gajian", es: "Automatiza tu Ahorro el Día de Pago", fr: "Automatisez votre Épargne le Jour de Paie", de: "Automatisieren Sie den Sparanteil am Zahltag", ja: "給与受取時の自動積立を設定する", ko: "급여일 자동 저축 이체 설정하기", zh: "设置发薪日自动储蓄分流", ar: "أتمتة استقطاع المدخرات يوم الراتب", pt: "Automatize sua Poupança no Pagamento", ru: "Автоматизируйте сбережения в день зарплаты", nl: "Automatiseer Uw Spaarinleg op de Betaaldag"
    },
    stepModSaveDesc: {
        en: "Transfer {amt} (20%) directly into savings the moment income lands. Locking it in early guarantees your savings target without daily effort.",
        id: "Sisihkan {amt} (20%) langsung ke tabungan saat pemasukan diterima. Otomatisasi menjamin target tercapai tanpa repot.",
        es: "Transfiere {amt} (20%) directo al ahorro en cuanto entre el dinero. Asegurarlo de inicio garantiza tu meta sin esfuerzo constante.",
        fr: "Virez {amt} (20%) sur votre épargne dès que le revenu arrive. Ce virement automatique garantit votre objectif sans effort quotidien.",
        de: "Überweisen Sie {amt} (20%) sofort bei Geldeingang aufs Sparkonto. Das sichert Ihr Sparziel automatisch ohne tägliche Mühe.",
        ja: "収入が入った直後に{amt}（20%）を自動で貯蓄へ回しましょう。自動化により無理なく目標が達成できます。",
        ko: "수입이 입금되는 즉시 {amt}(20%)를 저축 계좌로 자동 이체하세요. 초기에 고정하면 매일 신경 쓰지 않아도 목표를 달성할 수 있습니다.",
        zh: "收入到账后立即自动划转 {amt}（20%）至储蓄账户。提前锁定储蓄份额，无需每日耗费心力即可稳妥达标。",
        ar: "حول {amt} (20%) مباشرة لحساب التوفير فور وصول الدخل. حجز المبلغ مبكرا يضمن تحقيق هدفك دون جهد يومي.",
        pt: "Transfira {amt} (20%) para a poupança assim que a renda entrar. Guardar no início garante sua meta sem esforço diário.",
        ru: "Переводите {amt} (20%) в сбережения сразу при поступлении дохода. Это гарантирует достижение финансовой цели без лишних усилий.",
        nl: "Maak {amt} (20%) direct over naar spaargeld zodra het inkomen binnenkomt. Dit garandeert uw doel zonder dagelijkse moeite."
    },
    stepBufferTitle: {
        en: "Build a Starter Peace-of-Mind Buffer", id: "Bangun Dana Darurat Pemula", es: "Crea un Fondo Básico de Emergencia", fr: "Constituez un Matelas de Sécurité Initial", de: "Bauen Sie ein Starter-Notfallpolster Auf", ja: "安心のための初期バッファーを作る", ko: "초기 비상 안심 자금 마련하기", zh: "建立基础应急安全储备金", ar: "بناء صندوق طوارئ أولي للشعور بالأمان", pt: "Construa uma Reserva Inicial de Emergência", ru: "Создайте стартовую подушку безопасности", nl: "Bouw een Eerste Veiligheidsbuffer Op"
    },
    stepBufferDesc: {
        en: "Start small: aim for a quick {amt} starter cushion. Even a 2-week emergency reserve protects you from unexpected expenses without resorting to debt.",
        id: "Mulai dari target terjangkau: kumpulkan dana darurat awal sebesar {amt}. Cadangan 2 minggu melindungi Anda dari pengeluaran mendadak.",
        es: "Empieza poco a poco: apunta a un colchón inicial de {amt}. Una reserva de solo 2 semanas te protege ante imprevistos sin endeudarte.",
        fr: "Commencez petit : visez un premier coussin de {amt}. Même une réserve de 2 semaines vous protège des imprévus sans recourir à l'emprunt.",
        de: "Fangen Sie klein an: Ein erstes Polster von {amt} reicht schon. Selbst eine 2-Wochen-Reserve schützt vor Schulden bei Überraschungen.",
        ja: "まずは小さく：{amt}の準備金を目標にしましょう。2週間分の生活防衛資金があるだけで不意の出費にも安心です。",
        ko: "작게 시작하세요: {amt}의 초기 비상금을 목표로 삼으세요. 2주 치의 예비 자금만으로도 빚 없이 예상치 못한 지출에 대비할 수 있습니다.",
        zh: "从小处着手：先建立一个 {amt} 的应急小金库。哪怕仅有 2 周的生活预备金，也能在意外支出发生时免于负债。",
        ar: "ابدأ خطوة بخطوة: استهدف وسادة أمان أولية بقيمة {amt}. احتياطي أسبوعين فقط يحميك من المصاريف المفاجئة دون اللجوء للديون.",
        pt: "Comece pequeno: mire numa reserva inicial de {amt}. Mesmo uma reserva para 2 semanas protege você de imprevistos sem contrair dívidas.",
        ru: "Начните с малого: ориентируйтесь на стартовый резерв в {amt}. Запас даже на 2 недели защитит от непредвиденных трат без долгов.",
        nl: "Begin klein: mik op een startbuffer van {amt}. Zelfs een reserve voor 2 weken beschermt u tegen onverwachte kosten zonder schulden."
    },
    stepBuffer3mTitle: {
        en: "Grow Toward Your 3-Month Safety Cushion", id: "Capai Dana Cadangan 3 Bulan", es: "Avanza hacia tu Colchón de 3 Meses", fr: "Développez votre Réserve de 3 Mois", de: "Auf ein 3-Monats-Sicherheitspolster Hinarbeiten", ja: "3ヶ月分の生活防衛資金を目指す", ko: "3개월 치 생활 방어 자금 완성하기", zh: "稳步积累 3 个月生活安全垫", ar: "الوصول لاحتياطي أمان يكفي لـ 3 أشهر", pt: "Caminhe para sua Reserva de 3 Meses", ru: "Стремитесь к 3-месячной подушке безопасности", nl: "Groei Naar Uw 3-Maanden Veiligheidsbuffer"
    },
    stepBuffer3mDesc: {
        en: "Your recommended 3-month living buffer is {amt}. Channeling half your monthly surplus will have you fully covered and financially resilient in no time.",
        id: "Target dana darurat 3 bulan hidup Anda adalah {amt}. Mengalokasikan separuh surplus bulanan akan membuat keuangan Anda sangat aman.",
        es: "Tu fondo recomendado para 3 meses es {amt}. Destinar la mitad de tu superávit mensual te brindará una gran solidez financiera en poco tiempo.",
        fr: "Votre coussin de précaution recommandé de 3 mois est de {amt}. Y consacrer la moitié de votre surplus vous rendra serein rapidement.",
        de: "Ihr empfohlenes 3-Monats-Polster beträgt {amt}. Die Hälfte des monatlichen Überschusses dorthin zu leiten sorgt für schnelle finanzielle Resilienz.",
        ja: "推奨される3ヶ月分の生活防衛資金は{amt}です。毎月の余剰金の半分を充てることで、早期に盤石な安心感が手に入ります。",
        ko: "권장하는 3개월 치 생활 방어 자금은 {amt}입니다. 매월 흑자의 절반을 적립하면 머지않아 든든한 재정적 안정성을 확보하게 됩니다.",
        zh: "建议准备的 3 个月生活缓冲金为 {amt}。将每月盈余的一半注入其中，很快便能构建起坚韧的家庭财务防线。",
        ar: "احتياطي الأمان الموصى به لـ 3 أشهر هو {amt}. توجيه نصف فائضك الشهري إليه سيمنحك استقرارا ومرونة مالية في وقت قياسي.",
        pt: "Sua reserva recomendada para 3 meses é de {amt}. Destinar metade do seu superávit mensal trará tranquilidade financeira rapidamente.",
        ru: "Рекомендуемый 3-месячный резерв составляет {amt}. Направление половины ежемесячного профицита обеспечит полную устойчивость.",
        nl: "Uw aanbevolen 3-maandenbuffer is {amt}. Als u de helft van uw maandelijkse overschot hierin steekt, bent u in een mum van tijd financieel weerbaar."
    },
    footerConfidential: {
        en: "Pocketly Personal Finance Statement  |  Confidential  |  Period: {period}",
        id: "Laporan Keuangan Pribadi Pocketly  |  Rahasia  |  Periode: {period}",
        es: "Estado Financiero Personal Pocketly  |  Confidencial  |  Período: {period}",
        fr: "Relevé Financier Personnel Pocketly  |  Confidentiel  |  Période : {period}",
        de: "Pocketly Persönlicher Finanzbericht  |  Vertraulich  |  Zeitraum: {period}",
        ja: "Pocketly 個人財務諸表  |  社外秘  |  対象期間: {period}",
        ko: "Pocketly 개인 재무 보고서  |  대외비  |  기간: {period}",
        zh: "Pocketly 个人财务报表  |  机密文件  |  周期: {period}",
        ar: "كشف المالية الشخصية من Pocketly  |  سري  |  الفترة: {period}",
        pt: "Relatório Financeiro Pessoal Pocketly  |  Confidencial  |  Período: {period}",
        ru: "Личный финансовый отчет Pocketly  |  Конфиденциально  |  Период: {period}",
        nl: "Pocketly Persoonlijk Financieel Overzicht  |  Vertrouwelijk  |  Periode: {period}"
    },
    pageOf: {
        en: "Page {i} of {totalPages}",
        id: "Halaman {i} dari {totalPages}",
        es: "Página {i} de {totalPages}",
        fr: "Page {i} sur {totalPages}",
        de: "Seite {i} von {totalPages}",
        ja: "{i} / {totalPages} ページ",
        ko: "{i} / {totalPages} 페이지",
        zh: "第 {i} 页 / 共 {totalPages} 页",
        ar: "صفحة {i} من {totalPages}",
        pt: "Página {i} de {totalPages}",
        ru: "Стр. {i} из {totalPages}",
        nl: "Pagina {i} van {totalPages}"
    },
    p2Title: {
        en: "Transaction History Ledger",
        id: "Buku Besar Riwayat Transaksi",
        es: "Libro de Historial de Transacciones",
        fr: "Grand Livre d'Historique des Transactions",
        de: "Transaktionshistorie & Hauptbuch",
        ja: "取引履歴台帳",
        ko: "거래 내역 원장",
        zh: "交易历史明细账",
        ar: "سجل تاريخ المعاملات",
        pt: "Livro de Histórico de Transações",
        ru: "Журнал истории транзакций",
        nl: "Transactiegeschiedenis Grootboek"
    },
    p2Recorded: {
        en: "{n} Transactions Recorded",
        id: "{n} Transaksi Tercatat",
        es: "{n} Transacciones Registradas",
        fr: "{n} Transactions Enregistrées",
        de: "{n} Transaktionen Erfasst",
        ja: "{n} 件の取引を記録",
        ko: "{n} 건의 거래 기록됨",
        zh: "已记录 {n} 笔交易",
        ar: "تم تسجيل {n} معاملة",
        pt: "{n} Transações Registradas",
        ru: "Записано транзакций: {n}",
        nl: "{n} Transacties Vastgelegd"
    },
    p2Summary: {
        en: "Income: +{inc}   |   Expenses: -{exp}   |   Net: {net}",
        id: "Pemasukan: +{inc}   |   Pengeluaran: -{exp}   |   Bersih: {net}",
        es: "Ingresos: +{inc}   |   Gastos: -{exp}   |   Neto: {net}",
        fr: "Revenus : +{inc}   |   Dépenses : -{exp}   |   Net : {net}",
        de: "Einnahmen: +{inc}   |   Ausgaben: -{exp}   |   Netto: {net}",
        ja: "収入: +{inc}   |   支出: -{exp}   |   純収支: {net}",
        ko: "수입: +{inc}   |   지출: -{exp}   |   순액: {net}",
        zh: "收入: +{inc}   |   支出: -{exp}   |   净额: {net}",
        ar: "الدخل: +{inc}   |   المصروفات: -{exp}   |   الصافي: {net}",
        pt: "Receita: +{inc}   |   Despesas: -{exp}   |   Líquido: {net}",
        ru: "Доход: +{inc}   |   Расход: -{exp}   |   Итог: {net}",
        nl: "Inkomsten: +{inc}   |   Uitgaven: -{exp}   |   Netto: {net}"
    },
    p2TableHead: {
        en: ["Date", "Description", "Category", "Account", "Amount"],
        id: ["Tanggal", "Keterangan", "Kategori", "Akun", "Jumlah"],
        es: ["Fecha", "Descripción", "Categoría", "Cuenta", "Monto"],
        fr: ["Date", "Description", "Catégorie", "Compte", "Montant"],
        de: ["Datum", "Beschreibung", "Kategorie", "Konto", "Betrag"],
        ja: ["日付", "取引詳細", "カテゴリ", "口座", "金額"],
        ko: ["날짜", "내용", "카테고리", "계좌", "금액"],
        zh: ["日期", "描述", "类别", "账户", "金额"],
        ar: ["التاريخ", "الوصف", "الفئة", "الحساب", "المبلغ"],
        pt: ["Data", "Descrição", "Categoria", "Conta", "Valor"],
        ru: ["Дата", "Описание", "Категория", "Счет", "Сумма"],
        nl: ["Datum", "Omschrijving", "Categorie", "Rekening", "Bedrag"]
    },
    preparingPdf: {
        en: "Preparing PDF...",
        id: "Menyiapkan PDF...",
        es: "Preparando PDF...",
        fr: "Préparation du PDF...",
        de: "PDF wird vorbereitet...",
        ja: "PDFを準備中...",
        ko: "PDF 준비 중...",
        zh: "正在生成 PDF...",
        ar: "جارٍ تجهيز ملف PDF...",
        pt: "Preparando PDF...",
        ru: "Подготовка PDF...",
        nl: "PDF voorbereiden..."
    }
};

function getPdfText(key, lang, fallback) {
    if (PDF_I18N[key] && PDF_I18N[key][lang]) {
        return PDF_I18N[key][lang];
    }
    if (PDF_I18N[key] && PDF_I18N[key]['en']) {
        return PDF_I18N[key]['en'];
    }
    return fallback || '';
}

function formatPdfTemplate(str, params) {
    if (!str) return '';
    let result = str;
    for (const [k, v] of Object.entries(params || {})) {
        result = result.replaceAll('{' + k + '}', v);
    }
    return result;
}

window.generateExportPdf = async function() {
    if (typeof rawTransactions === 'undefined' || rawTransactions.length === 0) {
        showAlert("No transactions recorded yet in Pocketly.", true);
        return;
    }
    if (!window.jspdf) {
        showAlert("PDF library is loading. Please wait a moment and try again.", true);
        return;
    }

    const { scoped, periodLabel, fileSuffix, daysInPeriod } = window.getScopedExportTransactions();

    if (scoped.length === 0) {
        showAlert(`No transactions found for period "${periodLabel}". Please select another month or range.`, true);
        return;
    }

    const activeLang = (typeof PocketlyI18n !== 'undefined' && PocketlyI18n.getCurrentLanguage)
        ? PocketlyI18n.getCurrentLanguage()
        : 'en';
    const activeLocale = (typeof PocketlyI18n !== 'undefined' && PocketlyI18n.getCurrentLocale)
        ? PocketlyI18n.getCurrentLocale()
        : (currentLocale || 'en-US');

    const btnGenerate = document.getElementById('btnConfirmGeneratePdf');
    const prepPdfText = (PDF_I18N.preparingPdf && PDF_I18N.preparingPdf[activeLang]) || 'Preparing PDF...';
    if (btnGenerate) {
        btnGenerate.disabled = true;
        btnGenerate.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>${prepPdfText}</span>`;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // Ensure font matching active language & Pocketly logo are loaded
        const [activeFont, logoDataUrl] = await Promise.all([
            ensurePdfFontForLanguage(doc, activeLang),
            getPocketlyLogoDataUrl()
        ]);

        const pageWidth = 210;
        const pageHeight = 297;
        const marginX = 14;
        const contentWidth = pageWidth - (marginX * 2); // 182mm

        const userName = (typeof currentUser !== 'undefined' && currentUser) 
            ? (currentUser.displayName || "Pocketly User") 
            : "Pocketly User";
        const currencyCode = currentCurrency || 'IDR';

        // Helper for formatting money in PDF with active locale
        const formatPdfMoney = (num) => {
            const meta = (typeof CURRENCY_META !== 'undefined' && CURRENCY_META[currencyCode]) 
                ? CURRENCY_META[currencyCode] 
                : { locale: 'en-US', decimals: 0 };
            const rate = (typeof exchangeRates !== 'undefined' && exchangeRates[currencyCode]) 
                ? Number(exchangeRates[currencyCode]) 
                : 1;
            const converted = Number(num || 0) * rate;
            try {
                return new Intl.NumberFormat(activeLocale || meta.locale || 'en-US', {
                    style: 'currency',
                    currency: currencyCode,
                    minimumFractionDigits: meta.decimals || 0,
                    maximumFractionDigits: meta.decimals || 0
                }).format(converted);
            } catch (e) {
                return `${currencyCode} ${Math.round(converted).toLocaleString()}`;
            }
        };

        // Helper to format date according to active language/locale
        const formatTableDate = (dStr) => {
            if (!dStr) return '-';
            try {
                const parts = dStr.split('-');
                if (parts.length === 3) {
                    const year = parseInt(parts[0], 10);
                    const month = parseInt(parts[1], 10) - 1;
                    const day = parseInt(parts[2], 10);
                    const d = new Date(year, month, day);
                    return d.toLocaleDateString(activeLocale, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });
                }
            } catch (e) {}
            return dStr;
        };

        // 1. Compute Scoped Financial Metrics
        let totalIncome = 0;
        let totalExpense = 0;
        let totalTransfer = 0;
        let incomeCount = 0;
        let expenseCount = 0;
        let transferCount = 0;
        const catTotals = {};

        scoped.forEach(t => {
            const amt = Number(t.amount || 0);
            const tType = String(t.type || 'expense').toLowerCase();
            if (tType === 'income') {
                totalIncome += amt;
                incomeCount++;
            } else if (tType === 'transfer') {
                totalTransfer += amt;
                transferCount++;
            } else {
                totalExpense += amt;
                expenseCount++;
                const cat = t.category || 'Others';
                catTotals[cat] = (catTotals[cat] || 0) + amt;
            }
        });

        const netCashFlow = totalIncome - totalExpense;
        const isNetPositive = netCashFlow >= 0;
        const savingsRate = totalIncome > 0 ? Math.round((netCashFlow / totalIncome) * 100) : 0;
        const dailyBurnRate = daysInPeriod > 0 ? Math.round(totalExpense / daysInPeriod) : 0;

        // Top categories sorted
        const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
        const topCat = sortedCats[0] || null;
        const topCatPercent = (topCat && totalExpense > 0) ? Math.round((topCat[1] / totalExpense) * 100) : 0;

        // Financial Health Score Calculation (0 - 100)
        let healthScore = 50;
        if (savingsRate >= 30) healthScore += 35;
        else if (savingsRate >= 20) healthScore += 25;
        else if (savingsRate >= 10) healthScore += 15;
        else if (savingsRate >= 0) healthScore += 5;
        else healthScore -= 20;

        if (totalExpense > 0) {
            if (topCatPercent <= 30) healthScore += 15;
            else if (topCatPercent <= 45) healthScore += 10;
            else if (topCatPercent > 60) healthScore -= 10;
        } else if (totalIncome > 0) {
            healthScore += 15;
        }

        healthScore = Math.min(100, Math.max(15, healthScore));

        let healthRatingKey = 'optimal';
        if (healthScore >= 75) {
            healthRatingKey = 'optimal';
        } else if (healthScore >= 55) {
            healthRatingKey = 'balanced';
        } else if (healthScore >= 40) {
            healthRatingKey = 'caution';
        } else {
            healthRatingKey = 'action';
        }
        const healthRating = (PDF_I18N.ratings[healthRatingKey] && PDF_I18N.ratings[healthRatingKey][activeLang]) 
            || PDF_I18N.ratings[healthRatingKey]['en'];

        const todayFormatted = new Date().toLocaleDateString(activeLocale, { day: 'numeric', month: 'short', year: 'numeric' });
        const cleanRefSuffix = fileSuffix.replace(/[^A-Za-z0-9]/g, '').slice(0, 8) || 'MAIN';
        const statementId = `PKT-${cleanRefSuffix}-${Math.floor(1000 + Math.random() * 9000)}`;

        // ==========================================
        // PAGE 1: MINIMALIST & SEQUENTIAL FINANCIAL STATEMENT
        // ==========================================

        // --- 1. CLEAN BRAND & METADATA HEADER WITH LOGO ---
        let brandStartX = marginX;
        if (logoDataUrl) {
            try {
                // Crisp square logo icon (9.5mm x 9.5mm)
                doc.addImage(logoDataUrl, 'PNG', marginX, 14.5, 9.5, 9.5);
                brandStartX = marginX + 12;
            } catch (e) {
                console.warn('Could not add logo to PDF:', e);
            }
        }

        doc.setFont(activeFont, "bold");
        doc.setFontSize(16);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text("POCKETLY", brandStartX, 19.5);

        doc.setFont(activeFont, "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139); // slate-500
        doc.text(getPdfText('statementTitle', activeLang, "Personal Financial Statement"), brandStartX, 24);

        // Header Right Metadata
        const accountLabel = getPdfText('account', activeLang, 'Account');
        const periodHeaderLabel = getPdfText('period', activeLang, 'Period');
        const generatedLabel = getPdfText('generated', activeLang, 'Generated');

        doc.setFont(activeFont, "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text(`${accountLabel}: ${userName}`, marginX + contentWidth, 19, { align: 'right' });

        doc.setFont(activeFont, "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`${periodHeaderLabel}: ${periodLabel}  |  ${generatedLabel}: ${todayFormatted}`, marginX + contentWidth, 24, { align: 'right' });

        // Hairline Divider
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.setLineWidth(0.3);
        doc.line(marginX, 27.5, marginX + contentWidth, 27.5);

        // --- 2. EXECUTIVE CASH FLOW OVERVIEW (3 CARDS + STATUS RIBBON) ---
        const kpiY = 32;
        const kpiH = 22;
        const kpiGap = 4;
        const kpiW = (contentWidth - (2 * kpiGap)) / 3; // ~58mm each

        const renderKpiCard = (x, label, value, subtext, accentColor) => {
            doc.setFillColor(248, 250, 252); // slate-50
            doc.setDrawColor(226, 232, 240); // slate-200
            doc.setLineWidth(0.3);
            doc.roundedRect(x, kpiY, kpiW, kpiH, 2, 2, 'FD');

            // Top Color Accent Bar
            doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
            doc.roundedRect(x, kpiY, kpiW, 1.4, 1, 1, 'F');

            // Label
            doc.setFont(activeFont, "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
            doc.text(label, x + 5, kpiY + 7);

            // Prominent Amount
            doc.setFont(activeFont, "bold");
            doc.setFontSize(12);
            doc.setTextColor(15, 23, 42); // slate-900
            doc.text(value, x + 5, kpiY + 14.5);

            // Subtitle
            doc.setFont(activeFont, "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(100, 116, 139);
            doc.text(subtext, x + 5, kpiY + 19);
        };

        const incomeSubtitle = formatPdfTemplate(getPdfText('verifiedCredits', activeLang, "{n} verified credit(s)"), { n: incomeCount });
        renderKpiCard(
            marginX,
            getPdfText('totalIncome', activeLang, "TOTAL INCOME"),
            `+ ${formatPdfMoney(totalIncome)}`,
            incomeSubtitle,
            [5, 150, 105] // emerald
        );

        const expenseSubtitle = formatPdfTemplate(getPdfText('dailyAvg', activeLang, "Avg. {amt} / day"), { amt: formatPdfMoney(dailyBurnRate) });
        renderKpiCard(
            marginX + kpiW + kpiGap,
            getPdfText('totalExpenses', activeLang, "TOTAL EXPENSES"),
            `- ${formatPdfMoney(totalExpense)}`,
            expenseSubtitle,
            [220, 38, 38] // rose
        );

        const savingsTitle = formatPdfTemplate(getPdfText('netSavings', activeLang, "NET SAVINGS ({pct}%)"), { pct: savingsRate });
        const savingsSubtitle = isNetPositive
            ? formatPdfTemplate(getPdfText('incomeSaved', activeLang, "{pct}% of income saved"), { pct: savingsRate })
            : getPdfText('deficitDetected', activeLang, "Deficit flow detected");

        renderKpiCard(
            marginX + (kpiW + kpiGap) * 2,
            savingsTitle,
            `${isNetPositive ? '+ ' : ''}${formatPdfMoney(netCashFlow)}`,
            savingsSubtitle,
            isNetPositive ? [37, 99, 235] : [220, 38, 38] // blue or rose
        );

        // Status Strip Ribbon directly beneath cards
        const stripY = 57.5;
        doc.setFillColor(241, 245, 249); // slate-100
        doc.roundedRect(marginX, stripY, contentWidth, 6.5, 1.5, 1.5, 'F');
        doc.setFont(activeFont, "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(51, 65, 85);

        const statusLabel = getPdfText('cashHealthStatus', activeLang, 'Cash Health Status');
        const retentionLabel = getPdfText('savingsRetention', activeLang, 'Savings Retention');
        const activePeriodLabel = getPdfText('activePeriod', activeLang, 'Active Period');
        const daysLabel = formatPdfTemplate(getPdfText('daysSuffix', activeLang, '{n} Days'), { n: daysInPeriod });

        doc.text(
            `${statusLabel}: ${healthRating} (${healthScore}/100)   •   ${retentionLabel}: ${savingsRate}%   •   ${activePeriodLabel}: ${daysLabel}`,
            marginX + (contentWidth / 2),
            stripY + 4.5,
            { align: 'center' }
        );

        // --- 3. SECTION 1: SPENDING BREAKDOWN BY CATEGORY ---
        const s1TitleY = 69;
        doc.setFont(activeFont, "bold");
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(getPdfText('sec1Title', activeLang, "1. Spending Breakdown by Category"), marginX, s1TitleY);

        doc.setFont(activeFont, "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(getPdfText('sec1Subtitle', activeLang, "Distribution of outgoing expenses categorized for this statement period"), marginX, s1TitleY + 4.5);

        const catRows = sortedCats.slice(0, 5).map(([rawCat, amt]) => {
            const numPct = totalExpense > 0 ? (amt / totalExpense) * 100 : 0;
            const pctStr = numPct.toFixed(1) + "%";
            let status = getPdfText('statusNormal', activeLang, "Normal (<20%)");
            if (numPct > 35) status = getPdfText('statusHigh', activeLang, "High Share (>35%)");
            else if (numPct > 20) status = getPdfText('statusModerate', activeLang, "Moderate (20-35%)");

            const translatedCat = (typeof PocketlyI18n !== 'undefined' && PocketlyI18n.translateCategory)
                ? PocketlyI18n.translateCategory(rawCat)
                : rawCat;

            return [translatedCat, formatPdfMoney(amt), pctStr, status];
        });

        if (catRows.length === 0) {
            catRows.push([
                getPdfText('noCategorizedExpenses', activeLang, "No Categorized Expenses"),
                formatPdfMoney(0),
                "0.0%",
                getPdfText('statusNormal', activeLang, "Normal (<20%)")
            ]);
        }

        // Summary row
        catRows.push([
            getPdfText('totalExpensesRow', activeLang, "Total Expenses"),
            formatPdfMoney(totalExpense),
            "100.0%",
            isNetPositive 
                ? getPdfText('sustainablyFunded', activeLang, "Sustainably Funded") 
                : getPdfText('exceedsIncome', activeLang, "Exceeds Income")
        ]);

        const tableCatHead = PDF_I18N.tableHeadCat[activeLang] || PDF_I18N.tableHeadCat['en'];

        doc.autoTable({
            head: [tableCatHead],
            body: catRows,
            startY: s1TitleY + 7.5,
            margin: { left: marginX, right: marginX },
            theme: 'grid',
            headStyles: {
                font: activeFont,
                fillColor: [241, 245, 249], // soft slate-100
                textColor: [30, 41, 59], // dark slate
                fontSize: 8,
                fontStyle: 'bold',
                halign: 'left'
            },
            styles: {
                font: activeFont,
                fontSize: 8,
                cellPadding: 2.2,
                lineColor: [226, 232, 240],
                textColor: [51, 65, 85]
            },
            columnStyles: {
                0: { cellWidth: 62, fontStyle: 'bold', textColor: [15, 23, 42] },
                1: { cellWidth: 46, halign: 'right', fontStyle: 'bold' },
                2: { cellWidth: 34, halign: 'center' },
                3: { cellWidth: 40, halign: 'center' }
            },
            alternateRowStyles: {
                fillColor: [250, 250, 252]
            },
            didParseCell: function(data) {
                // Total row styling
                if (data.row.index === catRows.length - 1 && data.section === 'body') {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [241, 245, 249];
                    if (data.column.index === 0 || data.column.index === 1) {
                        data.cell.styles.textColor = [15, 23, 42];
                    }
                }
                // Status color based on numeric calculation
                if (data.column.index === 3 && data.section === 'body' && data.row.index < catRows.length - 1) {
                    const rowData = sortedCats[data.row.index];
                    if (rowData) {
                        const amt = rowData[1];
                        const numPct = totalExpense > 0 ? (amt / totalExpense) * 100 : 0;
                        if (numPct > 35) data.cell.styles.textColor = [220, 38, 38];
                        else if (numPct > 20) data.cell.styles.textColor = [37, 99, 235];
                        else data.cell.styles.textColor = [5, 150, 105];
                    }
                }
            }
        });

        // --- 4. SECTION 2: FINANCIAL HEALTH ASSESSMENT & ACTION PLAN ---
        const s2TitleY = doc.lastAutoTable.finalY + 7;
        doc.setFont(activeFont, "bold");
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(getPdfText('sec2Title', activeLang, "2. Financial Health Assessment & Action Plan"), marginX, s2TitleY);

        doc.setFont(activeFont, "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(getPdfText('sec2Subtitle', activeLang, "Personalized takeaways and practical next steps tailored to your monthly cash flow"), marginX, s2TitleY + 4.5);

        const card2Y = s2TitleY + 7.5;
        const card2H = 58;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(marginX, card2Y, contentWidth, card2H, 2.5, 2.5, 'FD');

        // Dynamic Narrative Generator (Contextual & Localized)
        const rawTopName = topCat ? String(topCat[0]).trim() : 'General Expenses';
        const topName = (typeof PocketlyI18n !== 'undefined' && PocketlyI18n.translateCategory)
            ? PocketlyI18n.translateCategory(rawTopName)
            : rawTopName;
        const topAmt = topCat ? topCat[1] : 0;
        const topLower = rawTopName.toLowerCase();

        let narrativeOverview = "";
        if (savingsRate >= 35) {
            narrativeOverview = formatPdfTemplate(getPdfText('narrativeExcellent', activeLang), {
                period: periodLabel,
                pct: savingsRate,
                net: formatPdfMoney(netCashFlow),
                cat: topName,
                catPct: topCatPercent
            });
        } else if (savingsRate >= 15) {
            narrativeOverview = formatPdfTemplate(getPdfText('narrativeSolid', activeLang), {
                period: periodLabel,
                pct: savingsRate,
                net: formatPdfMoney(netCashFlow),
                cat: topName,
                catPct: topCatPercent
            });
        } else if (savingsRate >= 0) {
            narrativeOverview = formatPdfTemplate(getPdfText('narrativeModest', activeLang), {
                period: periodLabel,
                pct: savingsRate,
                net: formatPdfMoney(netCashFlow),
                cat: topName,
                catPct: topCatPercent
            });
        } else {
            narrativeOverview = formatPdfTemplate(getPdfText('narrativeDeficit', activeLang), {
                period: periodLabel,
                pct: savingsRate,
                net: formatPdfMoney(Math.abs(netCashFlow)),
                cat: topName,
                catPct: topCatPercent
            });
        }

        doc.setFont(activeFont, "normal");
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        const narrativeLines = doc.splitTextToSize(narrativeOverview, contentWidth - 14);
        doc.text(narrativeLines, marginX + 6, card2Y + 6.5);

        // Divider inside card
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.line(marginX + 6, card2Y + 13.5, marginX + contentWidth - 6, card2Y + 13.5);

        // 3 Dynamic Action Steps Tailored to Actual Context & Localized
        let dynamicStep1 = { title: "", desc: "" };
        if (topLower.includes('food') || topLower.includes('dining') || topLower.includes('makan') || topLower.includes('restaurant') || topLower.includes('cafe') || topLower.includes('grocer')) {
            dynamicStep1.title = getPdfText('stepFoodTitle', activeLang);
            dynamicStep1.desc = formatPdfTemplate(getPdfText('stepFoodDesc', activeLang), {
                amt: formatPdfMoney(topAmt),
                pct: topCatPercent,
                save: formatPdfMoney(Math.round(topAmt * 0.2))
            });
        } else if (topLower.includes('shop') || topLower.includes('belanja') || topLower.includes('fashion') || topLower.includes('cloth') || topLower.includes('elec') || topLower.includes('hobby')) {
            dynamicStep1.title = getPdfText('stepShoppingTitle', activeLang);
            dynamicStep1.desc = formatPdfTemplate(getPdfText('stepShoppingDesc', activeLang), {
                amt: formatPdfMoney(topAmt)
            });
        } else if (topLower.includes('trans') || topLower.includes('travel') || topLower.includes('fuel') || topLower.includes('bensin') || topLower.includes('ride') || topLower.includes('vehicle')) {
            dynamicStep1.title = getPdfText('stepTransportTitle', activeLang);
            dynamicStep1.desc = formatPdfTemplate(getPdfText('stepTransportDesc', activeLang), {
                amt: formatPdfMoney(topAmt),
                pct: topCatPercent
            });
        } else if (topLower.includes('bill') || topLower.includes('util') || topLower.includes('rent') || topLower.includes('sewa') || topLower.includes('housing') || topLower.includes('cicilan') || topLower.includes('tagihan')) {
            dynamicStep1.title = getPdfText('stepBillsTitle', activeLang);
            dynamicStep1.desc = formatPdfTemplate(getPdfText('stepBillsDesc', activeLang), {
                amt: formatPdfMoney(topAmt)
            });
        } else if (topLower.includes('entert') || topLower.includes('hiburan') || topLower.includes('game') || topLower.includes('movie') || topLower.includes('leisure')) {
            dynamicStep1.title = getPdfText('stepEntertainmentTitle', activeLang);
            dynamicStep1.desc = formatPdfTemplate(getPdfText('stepEntertainmentDesc', activeLang), {
                amt: formatPdfMoney(topAmt)
            });
        } else {
            dynamicStep1.title = formatPdfTemplate(getPdfText('stepDefaultTitle', activeLang), { cat: topName });
            dynamicStep1.desc = formatPdfTemplate(getPdfText('stepDefaultDesc', activeLang), {
                cat: topName,
                amt: formatPdfMoney(topAmt),
                pct: topCatPercent,
                target: formatPdfMoney(Math.round(topAmt * 0.85))
            });
        }

        let dynamicStep2 = { title: "", desc: "" };
        if (savingsRate < 0) {
            dynamicStep2.title = getPdfText('stepDeficitTitle', activeLang);
            dynamicStep2.desc = formatPdfTemplate(getPdfText('stepDeficitDesc', activeLang), {
                amt: formatPdfMoney(Math.abs(netCashFlow))
            });
        } else if (savingsRate < 15) {
            dynamicStep2.title = getPdfText('stepLowSaveTitle', activeLang);
            dynamicStep2.desc = formatPdfTemplate(getPdfText('stepLowSaveDesc', activeLang), {
                amt: formatPdfMoney(Math.round(totalIncome * 0.1))
            });
        } else if (savingsRate >= 35) {
            dynamicStep2.title = getPdfText('stepHighSaveTitle', activeLang);
            dynamicStep2.desc = formatPdfTemplate(getPdfText('stepHighSaveDesc', activeLang), {
                amt: formatPdfMoney(netCashFlow)
            });
        } else {
            dynamicStep2.title = getPdfText('stepModSaveTitle', activeLang);
            dynamicStep2.desc = formatPdfTemplate(getPdfText('stepModSaveDesc', activeLang), {
                amt: formatPdfMoney(Math.round(totalIncome * 0.2))
            });
        }

        let dynamicStep3 = { title: "", desc: "" };
        if (savingsRate < 10) {
            dynamicStep3.title = getPdfText('stepBufferTitle', activeLang);
            dynamicStep3.desc = formatPdfTemplate(getPdfText('stepBufferDesc', activeLang), {
                amt: formatPdfMoney(Math.round(totalExpense * 0.5))
            });
        } else {
            dynamicStep3.title = getPdfText('stepBuffer3mTitle', activeLang);
            dynamicStep3.desc = formatPdfTemplate(getPdfText('stepBuffer3mDesc', activeLang), {
                amt: formatPdfMoney(totalExpense * 3)
            });
        }

        let actY = card2Y + 16.5;
        const drawActionStep = (stepNum, title, desc) => {
            // Step Number Badge
            doc.setFillColor(224, 231, 255); // indigo-100
            doc.roundedRect(marginX + 6, actY, 6.5, 6.5, 1, 1, 'F');
            doc.setFont(activeFont, "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(67, 56, 202); // indigo-700
            doc.text(String(stepNum), marginX + 8.5, actY + 4.7);

            // Title
            doc.setFont(activeFont, "bold");
            doc.setFontSize(8);
            doc.setTextColor(15, 23, 42);
            doc.text(title, marginX + 15, actY + 3.8);

            // Description
            doc.setFont(activeFont, "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);
            const descLines = doc.splitTextToSize(desc, contentWidth - 22);
            doc.text(descLines, marginX + 15, actY + 7.8);

            actY += 13;
        };

        drawActionStep("1", dynamicStep1.title, dynamicStep1.desc);
        drawActionStep("2", dynamicStep2.title, dynamicStep2.desc);
        drawActionStep("3", dynamicStep3.title, dynamicStep3.desc);

        // Page 1 Footer
        const footerConfText = formatPdfTemplate(getPdfText('footerConfidential', activeLang), { period: periodLabel });
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.line(marginX, pageHeight - 10, marginX + contentWidth, pageHeight - 10);
        doc.setFont(activeFont, "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(footerConfText, marginX, pageHeight - 6);
        doc.text(formatPdfTemplate(getPdfText('pageOf', activeLang), { i: 1, totalPages: 2 }), marginX + contentWidth, pageHeight - 6, { align: 'right' });

        // ==========================================
        // PAGE 2+: DETAILED TRANSACTION HISTORY LEDGER
        // ==========================================
        doc.addPage();

        // Minimalist Header on Page 2 with Logo
        let p2TitleX = marginX;
        if (logoDataUrl) {
            try {
                doc.addImage(logoDataUrl, 'PNG', marginX, 15, 8.5, 8.5);
                p2TitleX = marginX + 11;
            } catch (e) {}
        }

        doc.setFont(activeFont, "bold");
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text(getPdfText('p2Title', activeLang, "Transaction History Ledger"), p2TitleX, 20);

        doc.setFont(activeFont, "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        const p2Sub = `${periodLabel}  |  ${formatPdfTemplate(getPdfText('p2Recorded', activeLang), { n: scoped.length })}`;
        doc.text(p2Sub, p2TitleX, 24.5);

        // Header Right Quick Summary
        doc.setFont(activeFont, "bold");
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        const p2Summary = formatPdfTemplate(getPdfText('p2Summary', activeLang), {
            inc: formatPdfMoney(totalIncome),
            exp: formatPdfMoney(totalExpense),
            net: `${isNetPositive ? '+' : ''}${formatPdfMoney(netCashFlow)}`
        });
        doc.text(p2Summary, marginX + contentWidth, 21, { align: 'right' });

        // Hairline Divider
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(marginX, 27.5, marginX + contentWidth, 27.5);

        const sortedTransactions = [...scoped].sort((a, b) => new Date(b.date) - new Date(a.date));
        const transRows = [];

        sortedTransactions.forEach(t => {
            const accName = (typeof accounts !== 'undefined' && Array.isArray(accounts)) 
                ? (accounts.find(a => a.id === t.accountId)?.name || 'Account')
                : 'Account';
            const dateFormatted = formatTableDate(t.date);
            const rawType = String(t.type || 'expense').toLowerCase();
            const sign = rawType === 'income' ? '+ ' : (rawType === 'transfer' ? '' : '- ');
            const amtStr = `${sign}${formatPdfMoney(t.amount)}`;
            const descStr = t.desc || '-';
            const catName = t.category || 'Others';
            const catStr = (typeof PocketlyI18n !== 'undefined' && PocketlyI18n.translateCategory)
                ? PocketlyI18n.translateCategory(catName)
                : catName;

            transRows.push([
                dateFormatted,
                descStr,
                catStr,
                accName,
                amtStr,
                rawType // hidden index 5 for colorizing
            ]);
        });

        const p2Head = PDF_I18N.p2TableHead[activeLang] || PDF_I18N.p2TableHead['en'];

        doc.autoTable({
            head: [p2Head],
            body: transRows,
            startY: 32,
            margin: { left: marginX, right: marginX, bottom: 15 },
            theme: 'grid',
            headStyles: {
                font: activeFont,
                fillColor: [15, 23, 42], // deep slate
                textColor: [255, 255, 255],
                fontSize: 8,
                fontStyle: 'bold',
                halign: 'left'
            },
            styles: {
                font: activeFont,
                fontSize: 8,
                cellPadding: 2.5,
                lineColor: [226, 232, 240],
                textColor: [51, 65, 85]
            },
            columnStyles: {
                0: { cellWidth: 24, halign: 'center' },
                1: { cellWidth: 58 },
                2: { cellWidth: 32, fontStyle: 'bold', textColor: [15, 23, 42] },
                3: { cellWidth: 30, textColor: [100, 116, 139] },
                4: { cellWidth: 38, halign: 'right', fontStyle: 'bold' }
            },
            alternateRowStyles: {
                fillColor: [250, 250, 252]
            },
            didParseCell: function(data) {
                if (data.section === 'body') {
                    // Colorize amount cleanly based on transaction type
                    if (data.column.index === 4) {
                        const rawType = String(data.row.raw[5] || '').toLowerCase();
                        if (rawType === 'income') data.cell.styles.textColor = [5, 150, 105]; // emerald
                        else if (rawType === 'transfer') data.cell.styles.textColor = [79, 70, 229]; // indigo
                        else data.cell.styles.textColor = [220, 38, 38]; // rose
                    }
                }
            }
        });

        // Footers & Page Numbering on all pages
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.2);
            doc.line(marginX, pageHeight - 10, marginX + contentWidth, pageHeight - 10);

            doc.setFont(activeFont, "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(148, 163, 184);
            doc.text(footerConfText, marginX, pageHeight - 6);
            doc.text(formatPdfTemplate(getPdfText('pageOf', activeLang), { i: i, totalPages: totalPages }), marginX + contentWidth, pageHeight - 6, { align: 'right' });
        }

        // Save file with clean filename
        const safeSuffix = fileSuffix.replace(/[^a-zA-Z0-9_\-]/g, '_');
        const pdfFileName = `Pocketly_Statement_${safeSuffix}.pdf`;

        if (window.PocketlyDownloader && window.PocketlyDownloader.isNative()) {
            const pdfBlob = doc.output('blob');
            window.PocketlyDownloader.saveBlob(pdfBlob, pdfFileName, 'application/pdf');
        } else {
            doc.save(pdfFileName);
        }

        window.closeExportPdfModal();
        showAlert(`Financial statement for "${periodLabel}" downloaded successfully!`, false);
    } catch (err) {
        console.error("Error generating PDF:", err);
        showAlert(`Failed to generate PDF: ${err.message || 'An unexpected error occurred'}`, true);
    } finally {
        if (btnGenerate) {
            btnGenerate.disabled = false;
            const dlText = (typeof PocketlyI18n !== 'undefined' && PocketlyI18n.t)
                ? PocketlyI18n.t('btn_download_statement', 'Download Statement PDF')
                : 'Download Statement PDF';
            btnGenerate.innerHTML = `<i class="fa-solid fa-file-arrow-down"></i> <span>${dlText}</span>`;
        }
    }
};

if (btnExportCSV) { btnExportCSV.addEventListener('click', window.exportTransactionsCSV); }
if (btnExportPDF) { btnExportPDF.addEventListener('click', window.openExportPdfModal); }

const btnExportPDF_Header = document.getElementById('btnExportPDF_Header');
if (btnExportPDF_Header) {
    btnExportPDF_Header.addEventListener('click', window.openExportPdfModal);
}

const darkModeToggle = document.getElementById('darkModeToggle');
const metaThemeColor = document.getElementById('themeColorMeta'); // Ambil elemen meta

// Helper for synchronized status bar and navigation bar theming
const updateMetaTheme = (isDark) => {
    if (typeof window.updateSystemBars === 'function') {
        window.updateSystemBars(isDark);
    } else if (metaThemeColor) {
        metaThemeColor.setAttribute('content', isDark ? '#0b0f19' : '#f8fafc');
    }
};

if(localStorage.getItem('theme') === 'dark') { 
    document.body.classList.add('dark-mode'); 
    if(darkModeToggle) darkModeToggle.checked = true; 
    updateMetaTheme(true); // Set Dark saat load
} else {
    document.body.classList.remove('dark-mode');
    if(darkModeToggle) darkModeToggle.checked = false;
    updateMetaTheme(false); // Set Light saat load
}

if(darkModeToggle) darkModeToggle.addEventListener('change', () => { 
    if(darkModeToggle.checked) { 
        document.body.classList.add('dark-mode'); 
        localStorage.setItem('theme', 'dark'); 
        updateMetaTheme(true); // Ubah status bar & nav bar jadi Gelap
    } else { 
        document.body.classList.remove('dark-mode'); 
        localStorage.setItem('theme', 'light'); 
        updateMetaTheme(false); // Ubah status bar & nav bar jadi Terang
    } 
});

const soundEffectsToggle = document.getElementById('soundEffectsToggle');
if (soundEffectsToggle) {
    if (window.PocketlyAudio) {
        soundEffectsToggle.checked = !window.PocketlyAudio.isMuted();
    }
    soundEffectsToggle.addEventListener('change', () => {
        if (window.PocketlyAudio) {
            const isMuted = window.PocketlyAudio.toggleMute();
            soundEffectsToggle.checked = !isMuted;
            if (!isMuted) {
                window.PocketlyAudio.playSuccessChime();
            }
        }
    });
}
function handleInputTypeChange(type) {
    const catGroup = document.getElementById('categoryGroup');
    const targetGroup = document.getElementById('targetAccountGroup');
    const accLabel = document.getElementById('accountLabel');
    if (type === 'transfer') {
        if (catGroup) catGroup.style.display = 'none';
        if (targetGroup) targetGroup.style.display = 'block';
        if (accLabel) {
            accLabel.innerText = (window.PocketlyI18n && window.PocketlyI18n.t('trans_lbl_from_account')) || "From Account";
            accLabel.setAttribute('data-i18n', 'trans_lbl_from_account');
        }
        const inputCat = document.getElementById('inputCategory');
        if (inputCat) inputCat.removeAttribute('required');
    } else {
        if (catGroup) catGroup.style.display = 'block';
        if (targetGroup) targetGroup.style.display = 'none';
        if (accLabel) {
            accLabel.innerText = (window.PocketlyI18n && window.PocketlyI18n.t('trans_lbl_account')) || "Account";
            accLabel.setAttribute('data-i18n', 'trans_lbl_account');
        }
        const inputCat = document.getElementById('inputCategory');
        if (inputCat) inputCat.setAttribute('required', 'true');
    }
    setTimeout(initCustomSelects, 100);
}

window.showAlert = function(message, isError = true) {
    const alertBox = document.getElementById('customAlert');
    const title = document.getElementById('alertTitle');
    const msg = document.getElementById('alertMessage');
    const icon = document.getElementById('alertIcon');
    if (!alertBox || !msg) return;

    const translate = (txt) => (window.PocketlyI18n && typeof window.PocketlyI18n.translateText === 'function') ? window.PocketlyI18n.translateText(txt) : txt;
    const t = (key, fallback) => (window.PocketlyI18n && typeof window.PocketlyI18n.t === 'function') ? window.PocketlyI18n.t(key, fallback) : fallback;

    if (isError) {
        title.innerText = t('alert_error_title', 'Oops!');
        title.style.color = "var(--red)";
        icon.className = "fa-solid fa-circle-exclamation text-red";
        icon.style.color = "var(--red)";
    } else {
        title.innerText = t('alert_success_title', 'Success');
        title.style.color = "var(--green)";
        icon.className = "fa-solid fa-circle-check text-green";
        icon.style.color = "var(--green)";
        if (window.PocketlyAudio && typeof window.PocketlyAudio.playSuccessChime === 'function') {
            window.PocketlyAudio.playSuccessChime();
        }
    }

    const alertBtn = alertBox.querySelector('button') || alertBox.querySelector('.btn-primary');
    if (alertBtn) {
        alertBtn.innerText = t('alert_got_it', 'Got it');
    }

    msg.innerText = translate(message);
    alertBox.style.zIndex = '999999';
    alertBox.classList.add('show');
};
window.closeAlert = () => {
    const alertBox = document.getElementById('customAlert');
    if (alertBox) alertBox.classList.remove('show');
};

let confirmCallback = null;

window.showConfirm = (title, message, btnText, callback) => {
    const modal = document.getElementById('confirmationModal') || document.getElementById('customConfirm');
    
    const translate = (txt) => (window.PocketlyI18n && typeof window.PocketlyI18n.translateText === 'function') ? window.PocketlyI18n.translateText(txt) : txt;
    const t = (key, fallback) => (window.PocketlyI18n && typeof window.PocketlyI18n.t === 'function') ? window.PocketlyI18n.t(key, fallback) : fallback;

    if (!modal) {
        if (confirm(translate(message))) {
            if (callback) callback();
        }
        return;
    }

    const titleEl = modal.querySelector('#confirmTitle') || modal.querySelector('#confirmActionTitle'); 
    const msgEl = modal.querySelector('#confirmMessage') || modal.querySelector('#confirmActionMessage');
    const btnEl = modal.querySelector('#btnConfirmAction') || modal.querySelector('#confirmYesBtn');
    const cancelBtn = modal.querySelector('#confirmCancelBtn') || modal.querySelector('.btn-secondary') || modal.querySelector('[onclick*="closeConfirm"]');

    if (titleEl) titleEl.innerText = translate(title);
    if (msgEl) msgEl.innerText = translate(message);
    if (btnEl) btnEl.innerText = translate(btnText || "Delete");
    if (cancelBtn) cancelBtn.innerText = t('btn_cancel', 'Cancel');

    confirmCallback = callback;
    modal.classList.add('show');
};

window.closeConfirmModal = () => {
    const modal = document.getElementById('confirmationModal') || document.getElementById('customConfirm');
    if (modal) modal.classList.remove('show');
    confirmCallback = null;
};
window.closeConfirm = window.closeConfirmModal;


const btnConfirmAction = document.getElementById('btnConfirmAction');
if (btnConfirmAction) {
    // Hapus listener lama (cloning element) untuk mencegah duplikasi
    const newBtn = btnConfirmAction.cloneNode(true);
    btnConfirmAction.parentNode.replaceChild(newBtn, btnConfirmAction);

    newBtn.addEventListener('click', () => {
        if (confirmCallback) {
            confirmCallback();
        }
        window.closeConfirmModal();
    });
}
const confirmYesBtn = document.getElementById('confirmYesBtn');
if (confirmYesBtn) {
    confirmYesBtn.addEventListener('click', () => {
        if (confirmCallback) {
            confirmCallback();
        }
        window.closeConfirmModal();
    });
}

function initFilters() {
    const yearSelect = document.getElementById('yearFilter');
    if (!yearSelect) return;
    yearSelect.innerHTML = '';
    const currentYear = new Date().getFullYear();
    for (let i = currentYear - 3; i <= currentYear + 3; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.innerText = i;
        yearSelect.appendChild(opt);
    }
    yearSelect.value = currentYear;
}

// --- 1. HELPER: Menentukan Gaya Kartu Apple Wallet & Bank Brand ---
function getAccountStyle(name) {
    const n = (name || '').toLowerCase();

    // 1. Bank Central Asia (BCA)
    if (n.includes('bca')) {
        return {
            themeClass: 'card-wallet-bca',
            network: 'PASPOR',
            cardType: 'DEBIT CARD',
            icon: 'fa-building-columns'
        };
    }

    // 2. Bank Mandiri
    if (n.includes('mandiri')) {
        return {
            themeClass: 'card-wallet-mandiri',
            network: 'MANDIRI',
            cardType: 'DEBIT CARD',
            icon: 'fa-building-columns'
        };
    }

    // 3. Bank Rakyat Indonesia (BRI)
    if (n.includes('bri')) {
        return {
            themeClass: 'card-wallet-bri',
            network: 'BRIMO',
            cardType: 'DEBIT CARD',
            icon: 'fa-building-columns'
        };
    }

    // 4. Bank Negara Indonesia (BNI)
    if (n.includes('bni')) {
        return {
            themeClass: 'card-wallet-bni',
            network: 'BNI PLUS',
            cardType: 'DEBIT CARD',
            icon: 'fa-building-columns'
        };
    }

    // 5. Bank Digital (Jago, Blu, Seabank, Jenius, Neobank, Allo, Line Bank)
    if (n.includes('jago') || n.includes('blu') || n.includes('seabank') || n.includes('sea bank') || n.includes('jenius') || n.includes('neobank') || n.includes('superbank') || n.includes('allobank') || n.includes('line bank')) {
        return {
            themeClass: 'card-wallet-digital',
            network: 'VISA DIGITAL',
            cardType: 'SMART DEBIT',
            icon: 'fa-microchip'
        };
    }

    // 6. E-Wallet (GoPay, OVO, Dana, ShopeePay, LinkAja, Doku, Flip, etc.)
    if (n.includes('gopay') || n.includes('ovo') || n.includes('dana') || n.includes('shopeepay') || n.includes('linkaja') || n.includes('isaku') || n.includes('sakuku') || n.includes('doku') || n.includes('flip') || n.includes('paytren')) {
        return {
            themeClass: 'card-wallet-ewallet',
            network: 'E-WALLET',
            cardType: 'INSTANT PAY',
            icon: 'fa-mobile-screen'
        };
    }

    // 7. Cash / Uang Tunai / Dompet Fisik
    if (n.includes('cash') || n.includes('tunai') || n.includes('dompet') || n.includes('petty') || n.includes('brankas')) {
        return {
            themeClass: 'card-wallet-cash',
            network: 'POCKET CASH',
            cardType: 'PHYSICAL CASH',
            icon: 'fa-money-bill-wave'
        };
    }

    // 8. Bank Lainnya (CIMB, Danamon, Permata, Panin, BSI, OCBC, Maybank, BTN, UOB, HSBC, Mega, dll.)
    if (n.includes('cimb') || n.includes('danamon') || n.includes('permata') || n.includes('panin') || n.includes('bsi') || n.includes('ocbc') || n.includes('maybank') || n.includes('btn') || n.includes('uob') || n.includes('hsbc') || n.includes('mega') || n.includes('bukopin') || n.includes('muamalat')) {
        return {
            themeClass: 'card-wallet-bca',
            network: 'GPN / DEBIT',
            cardType: 'DEBIT CARD',
            icon: 'fa-building-columns'
        };
    }

    // Default
    return {
        themeClass: 'card-wallet-default',
        network: 'POCKETLY',
        cardType: 'PRIMARY WALLET',
        icon: 'fa-wallet'
    };
}

// Helper Generator HTML Kartu Apple Wallet
function generateWalletCardHTML(account) {
    const rawName = account.name || 'Account';
    const safeNameDisplay = (typeof escapeHTML === 'function') ? escapeHTML(rawName) : rawName;
    const safeNameJs = (typeof escapeForJsString === 'function') ? escapeForJsString(rawName) : rawName.replace(/'/g, "\\'");
    const style = getAccountStyle(rawName);
    const balanceNum = Number(account.balance) || 0;
    
    let last4 = '8829';
    if (account.id) {
        const idClean = String(account.id).replace(/[^a-zA-Z0-9]/g, '');
        if (idClean.length >= 4) {
            last4 = idClean.slice(-4).toUpperCase();
        }
    }

    return `
    <div class="apple-wallet-card ${style.themeClass}" onclick="window.handleCardClick(event, '${account.id}', '${safeNameJs}', ${balanceNum}, '${style.icon}')" role="button" tabindex="0" aria-label="${safeNameDisplay} card">
        <div class="awc-ambient-shine"></div>
        <div class="awc-top">
            <div class="awc-brand">
                <div class="awc-icon-badge">
                    <i class="fa-solid ${style.icon}"></i>
                </div>
                <div class="awc-brand-names">
                    <span class="awc-bank-name">${safeNameDisplay}</span>
                    <span class="awc-card-type">${style.cardType}</span>
                </div>
            </div>
            <div class="awc-top-right">
                <span class="awc-nfc" title="Contactless"><i class="fa-solid fa-wifi"></i></span>
                <button type="button" class="awc-menu-btn" onclick="window.openAccountActions(event, '${account.id}', '${safeNameJs}', ${balanceNum}, '${style.icon}')" title="Card Options" aria-label="Card Options">
                    <i class="fa-solid fa-ellipsis-vertical"></i>
                </button>
            </div>
        </div>
        <div class="awc-middle">
            <div class="awc-chip">
                <div class="awc-chip-line horizontal"></div>
                <div class="awc-chip-line vertical"></div>
            </div>
            <div class="awc-card-number">
                <span>••••</span>
                <span>••••</span>
                <span>••••</span>
                <span class="awc-digits">${last4}</span>
            </div>
        </div>
        <div class="awc-bottom">
            <div class="awc-balance-col">
                <span class="awc-balance-label">AVAILABLE BALANCE</span>
                <span class="awc-balance-value">${formatRupiah(account.balance)}</span>
            </div>
            <div class="awc-network">
                <span class="awc-network-tag">${style.network}</span>
            </div>
        </div>
    </div>`;
}

function getWalletAddCardHTML() {
    const title = (window.PocketlyI18n && window.PocketlyI18n.t('add_account')) || 'Add Account';
    const sub = (window.PocketlyI18n && window.PocketlyI18n.t('add_account_sub')) || 'Bank, E-Wallet or Cash';
    return `
    <div class="apple-wallet-card awc-add-card" onclick="window.triggerAddAccountFromWallet()" role="button" tabindex="0" title="${title}">
        <div class="awc-add-inner">
            <div class="awc-add-icon">
                <i class="fa-solid fa-plus"></i>
            </div>
            <span class="awc-add-title" data-i18n="add_account">${title}</span>
            <span class="awc-add-sub" data-i18n="add_account_sub">${sub}</span>
        </div>
    </div>`;
}

window.handleCardClick = function(event, id, name, balance, icon) {
    if (window.PocketlyAudio && typeof window.PocketlyAudio.playCardTap === 'function') {
        window.PocketlyAudio.playCardTap();
    }
    window.openAccountActions(event, id, name, balance, icon);
};

window.triggerAddAccountFromWallet = function() {
    if (window.PocketlyAudio && typeof window.PocketlyAudio.playCardTap === 'function') {
        window.PocketlyAudio.playCardTap();
    }
    const btn = document.getElementById('openAccountModalBtn');
    if (btn) btn.click();
};

function listenToAccounts() {
    const q = query(collection(db, "accounts"), where("uid", "==", currentUser.uid));
    
    onSnapshot(q, (snapshot) => {
        accounts = [];
        const accList = document.getElementById('accountList'); 
        
        const accSelect = document.getElementById('inputAccount'); 
        const toAccSelect = document.getElementById('inputToAccount'); 
        const filterAccSelect = document.getElementById('transFilterAccount');
        
        let htmlContent = ''; 
        
        const selAccText = (window.PocketlyI18n && window.PocketlyI18n.t('trans_select_account_placeholder')) || 'Select Account';
        const newAccText = (window.PocketlyI18n && window.PocketlyI18n.t('trans_create_new_account')) || '+ Create New Account...';
        const selDestText = (window.PocketlyI18n && window.PocketlyI18n.t('trans_select_dest_placeholder')) || 'Select Destination Account';
        const allAccText = (window.PocketlyI18n && window.PocketlyI18n.t('opt_all_accounts')) || 'All Accounts';

        const defaultOpt = `<option value="" disabled selected data-i18n="trans_select_account_placeholder">${selAccText}</option><option value="NEW_ACCOUNT" style="font-weight:bold; color:var(--blue-accent);" data-i18n="trans_create_new_account">${newAccText}</option>`; 
        if(accSelect) accSelect.innerHTML = defaultOpt; 
        if(toAccSelect) toAccSelect.innerHTML = `<option value="" disabled selected data-i18n="trans_select_dest_placeholder">${selDestText}</option>`; 
        if (filterAccSelect) filterAccSelect.innerHTML = `<option value="all" data-i18n="opt_all_accounts">${allAccText}</option>`;
        
        snapshot.docs.forEach(doc => {
            const data = doc.data(); 
            const accountObj = { id: doc.id, ...data };
            accounts.push(accountObj); 
            
            // RENDER KARTU APPLE WALLET
            htmlContent += generateWalletCardHTML(accountObj);
            
            // Update Dropdown (Sama seperti sebelumnya)
            const opt = document.createElement('option'); 
            opt.value = doc.id; 
            opt.innerText = `${data.name} (${formatRupiah(data.balance)})`; 
            if(accSelect) accSelect.appendChild(opt); 
            if(toAccSelect) toAccSelect.appendChild(opt.cloneNode(true));
            
            if(filterAccSelect) { 
                const filterOpt = document.createElement('option'); 
                filterOpt.value = doc.id; 
                filterOpt.innerText = data.name; 
                filterAccSelect.appendChild(filterOpt); 
            }
        });
        
        if(accList) accList.innerHTML = htmlContent + getWalletAddCardHTML();
        
        const total = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0); 
        const totalDisplay = document.getElementById('displayTotalBalance'); 
        if(totalDisplay) totalDisplay.innerText = formatRupiah(total);
        
        const reportsSection = document.getElementById('reports'); 
        if (reportsSection && reportsSection.classList.contains('active')) { 
            initReportFilters(); 
            updateReportsPage(); 
        }
        
        setTimeout(initCustomSelects, 100);
        calculateRealtimeGrowth();
    });
}

function listenToTransactions() {
    const q = query(collection(db, "transactions"), where("uid", "==", currentUser.uid));
    onSnapshot(q, (snapshot) => { rawTransactions = []; snapshot.docs.forEach(doc => rawTransactions.push({ id: doc.id, ...doc.data() })); updateDashboard(); const reportsSection = document.getElementById('reports'); if (reportsSection && reportsSection.classList.contains('active')) { updateReportsPage(); } });
}

function updateDashboard() {
    // 1. Ambil Element Filter
    const yearSelect = document.getElementById('yearFilter'); 
    const monthSelect = document.getElementById('monthFilter'); 
    if(!yearSelect || !monthSelect) return;

    const selectedYear = yearSelect.value; 
    const selectedMonth = monthSelect.value;
    
    // 2. Ambil Element Pencarian & Filter Lanjutan
    const searchInput = document.getElementById('searchTransaction'); 
    const sortSelect = document.getElementById('transSort'); 
    const typeSelect = document.getElementById('transFilterType'); 
    const accSelect = document.getElementById('transFilterAccount'); 
    const catSelect = document.getElementById('transFilterCategory');
    
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : ""; 
    const sortBy = sortSelect ? sortSelect.value : "newest"; 
    const filterType = typeSelect ? typeSelect.value : "all"; 
    const filterAcc = accSelect ? accSelect.value : "all"; 
    const filterCat = catSelect ? catSelect.value : "all";
    
    // 3. Proses Filter Data
    let filteredData = rawTransactions.filter(t => {
        const tDate = t.date; 
        const tYear = tDate.split('-')[0]; 
        const tMonth = tDate.split('-')[1]; 
        
        if (String(tYear) !== String(selectedYear)) return false; 
        if (selectedMonth !== 'All' && String(tMonth) !== String(selectedMonth)) return false; 
        
        if (searchTerm !== "") { 
            const desc = (t.desc || "").toLowerCase(); 
            const cat = (t.category || "").toLowerCase(); 
            if (!desc.includes(searchTerm) && !cat.includes(searchTerm)) return false; 
        }
        
        if (filterType !== 'all' && t.type !== filterType) return false; 
        if (filterAcc !== 'all') { 
            if (t.accountId !== filterAcc && t.targetAccountId !== filterAcc) return false; 
        } 
        if (filterCat !== 'all' && t.category !== filterCat) return false; 
        
        return true;
    });

    // 4. Proses Sorting
    filteredData.sort((a, b) => { 
        if (sortBy === 'newest') return new Date(b.date) - new Date(a.date); 
        if (sortBy === 'oldest') return new Date(a.date) - new Date(b.date); 
        if (sortBy === 'highest') return b.amount - a.amount; 
        if (sortBy === 'lowest') return a.amount - b.amount; 
        return 0; 
    });

    // 5. Hitung Total Income/Expense & Update UI Atas
    let income = 0; 
    let expense = 0; 
    filteredData.forEach(t => { 
        if (t.type === 'income') income += Number(t.amount); 
        else if (t.type === 'expense') expense += Number(t.amount); 
    });
    
    const incDisplay = document.getElementById('displayIncome'); 
    if(incDisplay) {
        if (typeof window.animateCountUp === 'function') window.animateCountUp('displayIncome', income);
        else incDisplay.innerText = formatRupiah(income);
    }
    
    const expDisplay = document.getElementById('displaySpending'); 
    if(expDisplay) {
        if (typeof window.animateCountUp === 'function') window.animateCountUp('displaySpending', expense);
        else expDisplay.innerText = formatRupiah(expense);
    }

    const total = (accounts || []).reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
    const totalDisplay = document.getElementById('displayTotalBalance');
    if (totalDisplay) {
        if (typeof window.animateCountUp === 'function') window.animateCountUp('displayTotalBalance', total);
        else totalDisplay.innerText = formatRupiah(total);
    }
    
    // Update Chart & Budget Progress
    // (Pastikan fungsi renderChart sudah kosong/dihapus isinya jika tidak pakai chart donut lagi)
    if(typeof renderChart === 'function') renderChart(income, expense); 
    if(typeof renderSmartBudgets === 'function') renderSmartBudgets(selectedMonth, selectedYear); 
    if(typeof renderDashboardRecentTransactions === 'function') renderDashboardRecentTransactions(filteredData);

    // 6. Pagination Logic
    const totalItems = filteredData.length; 
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE); 
    
    if (currentPage < 1) currentPage = 1; 
    if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
    
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE; 
    const endIdx = startIdx + ITEMS_PER_PAGE; 
    const paginatedData = filteredData.slice(startIdx, endIdx);

    // --- PERUBAHAN UTAMA: RENDER KE LIST CONTAINER (BUKAN TABEL) ---
    const listContainer = document.getElementById('transactionListContainer'); 
    
    if(!listContainer) return; 
    listContainer.innerHTML = ''; // Reset isi container

    if(totalItems === 0) { 
        // Tampilan Kosong (Empty State)
        listContainer.innerHTML = `
            <div style="text-align:center; padding:50px 20px; color:var(--text-grey);">
                <i class="fa-solid fa-receipt" style="font-size:3rem; margin-bottom:15px; opacity:0.2;"></i>
                <p>No transactions found.</p>
            </div>`; 
    } else {
        // --- LOGIKA GROUPING TANGGAL ---
        let lastDate = '';
        const today = new Date().toISOString().split('T')[0];
        
        // Hitung Kemarin
        const yesterdayDate = new Date(); 
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterday = yesterdayDate.toISOString().split('T')[0];

        const activeLocale = (window.PocketlyI18n && typeof window.PocketlyI18n.getCurrentLocale === 'function')
            ? window.PocketlyI18n.getCurrentLocale()
            : 'en-US';
        const tFunc = (window.PocketlyI18n && typeof window.PocketlyI18n.t === 'function')
            ? window.PocketlyI18n.t
            : (k, fb) => fb;

        paginatedData.forEach(t => {
            // A. Cek Header Tanggal (Sticky Header)
            if (t.date !== lastDate) {
                let dateLabel = ''; 
                if (t.date === today) dateLabel = tFunc('date_today', 'Today');
                else if (t.date === yesterday) dateLabel = tFunc('date_yesterday', 'Yesterday');
                else {
                    const dObj = new Date(t.date + 'T00:00:00');
                    const options = { day: 'numeric', month: 'short', year: 'numeric' };
                    dateLabel = dObj.toLocaleDateString(activeLocale, options);
                }
                listContainer.innerHTML += `<div class="date-header-sticky">${dateLabel}</div>`;
                lastDate = t.date;
            }

            // B. Setup Variabel Tampilan
            const accName = accounts.find(a => a.id === t.accountId)?.name || 'Unknown'; 
            
            let iconClass = CATEGORY_ICONS[t.category] || "fa-bag-shopping";
            let iconBg = "#f1f5f9"; 
            let iconColor = "#64748b";
            let amountClass = "text-dark";
            let amountSign = "";
            let categoryLabel = (window.PocketlyI18n && typeof window.PocketlyI18n.translateCategory === 'function')
                ? window.PocketlyI18n.translateCategory(t.category)
                : (t.category || '-');

            if(t.type === 'income') { 
                iconBg = "rgba(16, 185, 129, 0.1)"; iconColor = "#10b981"; 
                amountClass = "text-pastel-green"; amountSign = "+";
            } else if (t.type === 'expense') { 
                iconBg = "rgba(244, 63, 94, 0.1)"; iconColor = "#f43f5e"; 
                amountClass = "text-pastel-red"; amountSign = "-";
            } else if (t.type === 'transfer') { 
                iconBg = "rgba(59, 130, 246, 0.1)"; iconColor = "#3b82f6";
                iconClass = "fa-arrow-right-arrow-left";
                amountClass = "text-pastel-blue"; amountSign = "";
                categoryLabel = (window.PocketlyI18n && typeof window.PocketlyI18n.translateCategory === 'function')
                    ? window.PocketlyI18n.translateCategory('Transfer')
                    : "Transfer";
            }

            // C. Cek Status Locked
            const isSystemRefund = t.category === 'Adjustment' && (t.desc || "").toLowerCase().includes('refund');
            const isGoalTransaction = t.category === 'Financial Goal';
            const isDebtTransaction = t.category === 'Debt / Loan';
            const isLocked = isSystemRefund || isGoalTransaction || isDebtTransaction;
            let lockIconHTML = "";

            // D. Render HTML Item dengan Swipe Support
            listContainer.innerHTML += `
            <div class="swipe-item-container" data-id="${t.id}" data-locked="${isLocked}">
                <div class="swipe-action-reveal swipe-action-left">
                    <button type="button" class="swipe-act-btn btn-swipe-edit" title="Edit" onclick="event.stopPropagation(); window.handleSwipeEdit('${t.id}')">
                        <i class="fa-solid fa-pen"></i>
                        <span>Edit</span>
                    </button>
                </div>
                <div class="swipe-action-reveal swipe-action-right">
                    <button type="button" class="swipe-act-btn btn-swipe-delete" title="Delete" onclick="event.stopPropagation(); window.handleSwipeDelete('${t.id}')">
                        <i class="fa-solid fa-trash-can"></i>
                        <span>Delete</span>
                    </button>
                </div>
                <div class="swipe-item-content trans-item-row" onclick="window.handleSwipeItemClick(event, '${t.id}')" style="cursor: pointer;">
                    <div class="ti-left">
                        <div class="ti-icon" style="background:${iconBg}; color:${iconColor};">
                            <i class="fa-solid ${iconClass}"></i>
                        </div>
                        <div class="ti-info">
                            <div class="ti-desc">
                                ${lockIconHTML} ${t.desc}
                            </div>
                            <div class="ti-sub">
                                <span class="cat-badge-outline">${categoryLabel}</span>
                                <span>•</span>
                                <span>${accName}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="ti-right">
                        <div class="ti-amount ${amountClass}">
                            ${amountSign} ${formatRupiah(t.amount)}
                        </div>
                    </div>
                </div>
            </div>`;
        });

        // 7. Update Kontrol Pagination & Realtime Growth Badge
        updatePaginationControls(totalItems, totalPages);
        
        if(typeof calculateRealtimeGrowth === 'function') {
            calculateRealtimeGrowth(selectedMonth, selectedYear);
        }
    }
}

function renderDashboardRecentTransactions(data) {
    const listContainer = document.getElementById('dashRecentTransactionsList');
    if (!listContainer) return;

    if (!data || data.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align:center; padding:30px 10px; color:var(--text-grey);">
                <i class="fa-solid fa-receipt" style="font-size:2rem; margin-bottom:10px; opacity:0.2;"></i>
                <p>No recent transactions.</p>
            </div>`;
        return;
    }

    const recent = data.slice(0, 4);
    listContainer.innerHTML = recent.map(t => {
        const accName = accounts.find(a => a.id === t.accountId)?.name || 'Unknown';
        let amountClass = "text-dark";
        let amountSign = "";
        let categoryLabel = t.category || '-';

        if (t.type === 'income') {
            amountClass = "text-pastel-green";
            amountSign = "+";
        } else if (t.type === 'expense') {
            amountClass = "text-pastel-red";
            amountSign = "-";
        } else if (t.type === 'transfer') {
            amountClass = "text-pastel-blue";
            amountSign = "";
            categoryLabel = "Transfer";
        }

        // Format short date: e.g. "23 Jun"
        let shortDate = '';
        if (t.date) {
            const parts = t.date.split('-');
            if (parts.length === 3) {
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const day = parseInt(parts[2], 10);
                const monthIdx = parseInt(parts[1], 10) - 1;
                const mStr = months[monthIdx] || parts[1];
                shortDate = `${day} ${mStr}`;
            } else {
                shortDate = t.date;
            }
        } else {
            shortDate = '-';
        }

        const isSystemRefund = t.category === 'Adjustment' && (t.desc || "").toLowerCase().includes('refund');
        const isGoalTransaction = t.category === 'Financial Goal';
        const isDebtTransaction = t.category === 'Debt / Loan';
        const isLocked = isSystemRefund || isGoalTransaction || isDebtTransaction;

        return `
            <div class="swipe-item-container" data-id="${t.id}" data-locked="${isLocked}">
                <div class="swipe-action-reveal swipe-action-left">
                    <button type="button" class="swipe-act-btn btn-swipe-edit" title="Edit" onclick="event.stopPropagation(); window.handleSwipeEdit('${t.id}')">
                        <i class="fa-solid fa-pen"></i>
                        <span>Edit</span>
                    </button>
                </div>
                <div class="swipe-action-reveal swipe-action-right">
                    <button type="button" class="swipe-act-btn btn-swipe-delete" title="Delete" onclick="event.stopPropagation(); window.handleSwipeDelete('${t.id}')">
                        <i class="fa-solid fa-trash-can"></i>
                        <span>Delete</span>
                    </button>
                </div>
                <div class="swipe-item-content retro-transaction-item" onclick="window.handleSwipeItemClick(event, '${t.id}')" style="cursor: pointer;">
                    <div class="rti-left">
                        <div class="rti-date">${shortDate}</div>
                        <div class="rti-info">
                            <h4>${escapeHTML(t.desc || '')}</h4>
                            <span>${escapeHTML(categoryLabel)} • ${escapeHTML(accName)}</span>
                        </div>
                    </div>
                    <div class="rti-right ${amountClass}">
                        ${amountSign}${formatRupiah(t.amount)}
                    </div>
                </div>
            </div>`;
    }).join('');
}

// ==========================================================================
// INTERACTIVE ENGINE: ODOMETER, SKELETON, SWIPE GESTURES, PULL TO REFRESH
// ==========================================================================

// 1. Odometer Count-Up Animation
window.animateCountUp = function(elementId, targetValue, duration = 650) {
    const el = document.getElementById(elementId);
    if (!el) return;

    if (window.isPrivacyMode) {
        el.innerText = formatRupiah(targetValue);
        el.dataset.numericValue = targetValue;
        return;
    }

    const startValue = parseFloat(el.dataset.numericValue) || 0;
    if (Math.abs(startValue - targetValue) < 0.01) {
        el.innerText = formatRupiah(targetValue);
        el.dataset.numericValue = targetValue;
        return;
    }

    el.dataset.numericValue = targetValue;
    el.classList.remove('odometer-pulse');
    void el.offsetWidth;
    el.classList.add('odometer-pulse');

    const startTime = performance.now();

    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        const current = startValue + (targetValue - startValue) * ease;

        el.innerText = formatRupiah(current);

        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        } else {
            el.innerText = formatRupiah(targetValue);
            setTimeout(() => el.classList.remove('odometer-pulse'), 300);
        }
    }

    requestAnimationFrame(updateCounter);
};

// 2. Skeleton Shimmer Generator
window.showTransactionSkeleton = function(containerId, count = 3) {
    const container = document.getElementById(containerId);
    if (!container) return;
    let html = '<div class="skeleton-shimmer-wrapper">';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="skeleton-row-card">
                <div class="skeleton-shimmer-elem skeleton-icon-circle"></div>
                <div class="skeleton-info-lines">
                    <div class="skeleton-shimmer-elem skeleton-line-title"></div>
                    <div class="skeleton-shimmer-elem skeleton-line-sub"></div>
                </div>
                <div class="skeleton-shimmer-elem skeleton-amount-block"></div>
            </div>`;
    }
    html += '</div>';
    container.innerHTML = html;
};

// 3. Swipe Gesture System
window.closeAllSwipeItems = function(exceptContainer = null) {
    document.querySelectorAll('.swipe-item-container.is-open').forEach(c => {
        if (c !== exceptContainer) {
            const content = c.querySelector('.swipe-item-content');
            if (content) content.style.transform = '';
            c.classList.remove('is-open', 'swiped-left', 'swiped-right');
        }
    });
};

window.handleSwipeItemClick = function(e, id) {
    const container = e.currentTarget.closest('.swipe-item-container');
    if (container && container.classList.contains('is-open')) {
        e.stopPropagation();
        const content = container.querySelector('.swipe-item-content');
        if (content) content.style.transform = '';
        container.classList.remove('is-open', 'swiped-left', 'swiped-right');
        return;
    }
    if (typeof window.openTransactionDetail === 'function') {
        window.openTransactionDetail(id);
    }
};

window.handleSwipeDelete = function(id) {
    window.closeAllSwipeItems();
    if (typeof window.askDeleteTrans === 'function') {
        window.askDeleteTrans(id);
    }
};

window.handleSwipeEdit = function(id) {
    window.closeAllSwipeItems();
    const t = (rawTransactions || []).find(x => x.id === id);
    if (!t) return;
    const safeDesc = (t.desc || '').replace(/'/g, "\\'");
    const safeCat = t.category ? t.category.replace(/'/g, "\\'") : "";
    if (typeof window.openEditTrans === 'function') {
        window.openEditTrans(t.id, safeDesc, t.amount, t.date, t.type, t.accountId, safeCat);
    }
};

(function initSwipeGestures() {
    let activeContainer = null;
    let startX = 0;
    let startY = 0;
    let isHorizontalSwipe = false;
    let initialTranslate = 0;

    document.addEventListener('touchstart', (e) => {
        const container = e.target.closest('.swipe-item-container');
        if (!container) {
            window.closeAllSwipeItems();
            return;
        }

        window.closeAllSwipeItems(container);

        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        isHorizontalSwipe = false;
        activeContainer = container;

        const content = container.querySelector('.swipe-item-content');
        if (content) {
            const matrix = window.getComputedStyle(content).transform;
            if (matrix && matrix !== 'none') {
                const match = matrix.match(/matrix.*\((.+)\)/);
                if (match) {
                    const values = match[1].split(', ');
                    initialTranslate = parseFloat(values[4]) || 0;
                } else {
                    initialTranslate = 0;
                }
            } else {
                initialTranslate = 0;
            }
        }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!activeContainer) return;
        const touch = e.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;

        if (!isHorizontalSwipe) {
            if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
                isHorizontalSwipe = true;
                activeContainer.classList.add('is-swiping');
            } else if (Math.abs(dy) > 10) {
                activeContainer = null;
                return;
            }
        }

        if (isHorizontalSwipe) {
            let targetX = initialTranslate + dx;
            const isLocked = activeContainer.getAttribute('data-locked') === 'true';

            if (isLocked) {
                targetX = targetX * 0.15;
            } else {
                if (targetX < -95) targetX = -95 - (Math.abs(targetX + 95) * 0.2);
                if (targetX > 95) targetX = 95 + ((targetX - 95) * 0.2);
            }

            const content = activeContainer.querySelector('.swipe-item-content');
            if (content) {
                content.style.transform = `translateX(${targetX}px)`;
            }
        }
    }, { passive: false });

    document.addEventListener('touchend', () => {
        if (!activeContainer) return;
        activeContainer.classList.remove('is-swiping');
        const content = activeContainer.querySelector('.swipe-item-content');
        if (!content) { activeContainer = null; return; }

        const matrix = window.getComputedStyle(content).transform;
        let currentTranslate = 0;
        if (matrix && matrix !== 'none') {
            const match = matrix.match(/matrix.*\((.+)\)/);
            if (match) {
                const values = match[1].split(', ');
                currentTranslate = parseFloat(values[4]) || 0;
            }
        }

        const isLocked = activeContainer.getAttribute('data-locked') === 'true';

        if (!isLocked && currentTranslate < -42) {
            content.style.transform = 'translateX(-74px)';
            activeContainer.classList.add('is-open', 'swiped-left');
            activeContainer.classList.remove('swiped-right');
            if (window.PocketlyAudio) window.PocketlyAudio.playCardTap();
        } else if (!isLocked && currentTranslate > 42) {
            content.style.transform = 'translateX(74px)';
            activeContainer.classList.add('is-open', 'swiped-right');
            activeContainer.classList.remove('swiped-left');
            if (window.PocketlyAudio) window.PocketlyAudio.playCardTap();
        } else {
            content.style.transform = '';
            activeContainer.classList.remove('is-open', 'swiped-left', 'swiped-right');
        }

        activeContainer = null;
    }, { passive: true });
})();

// 4. Pull to Refresh Gesture System
(function initPullToRefresh() {
    let startY = 0;
    let isPulling = false;
    let pullDistance = 0;
    const threshold = 65;

    window.addEventListener('DOMContentLoaded', () => {
        const mainContent = document.querySelector('.main-content');
        if (!mainContent) return;

        const ptrIndicator = document.getElementById('ptrIndicator');
        const ptrIcon = document.getElementById('ptrIcon');
        const ptrLabel = document.getElementById('ptrLabel');

        mainContent.addEventListener('touchstart', (e) => {
            if (mainContent.scrollTop <= 0) {
                startY = e.touches[0].clientY;
                isPulling = false;
                pullDistance = 0;
            }
        }, { passive: true });

        mainContent.addEventListener('touchmove', (e) => {
            if (mainContent.scrollTop > 0) return;
            const currentY = e.touches[0].clientY;
            const diff = currentY - startY;

            if (diff > 12 && mainContent.scrollTop <= 0) {
                isPulling = true;
                pullDistance = Math.pow(diff, 0.85);

                if (ptrIndicator) {
                    ptrIndicator.style.height = `${Math.min(pullDistance, 72)}px`;
                    ptrIndicator.style.opacity = `${Math.min(pullDistance / 35, 1)}`;
                    ptrIndicator.classList.add('active');
                }

                if (ptrIcon) {
                    const rotation = Math.min((pullDistance / threshold) * 180, 180);
                    ptrIcon.style.transform = `rotate(${rotation}deg)`;
                }

                if (ptrLabel) {
                    ptrLabel.innerText = pullDistance >= threshold ? "Release to refresh" : "Pull to refresh";
                }
            }
        }, { passive: true });

        mainContent.addEventListener('touchend', () => {
            if (!isPulling) return;
            isPulling = false;

            if (pullDistance >= threshold) {
                if (ptrIndicator) ptrIndicator.style.height = '50px';
                if (ptrIcon) {
                    ptrIcon.style.transform = '';
                    ptrIcon.classList.add('is-spinning');
                }
                if (ptrLabel) ptrLabel.innerText = "Refreshing...";

                if (window.PocketlyAudio) {
                    window.PocketlyAudio.playCardTap();
                }

                if (typeof window.showTransactionSkeleton === 'function') {
                    window.showTransactionSkeleton('dashRecentTransactionsList', 3);
                }

                setTimeout(() => {
                    if (typeof updateDashboard === 'function') updateDashboard();
                    if (typeof renderAccountsFromCache === 'function') renderAccountsFromCache();
                    if (typeof calculateRealtimeGrowth === 'function') calculateRealtimeGrowth();

                    setTimeout(() => {
                        if (ptrIndicator) {
                            ptrIndicator.style.height = '0px';
                            ptrIndicator.style.opacity = '0';
                            ptrIndicator.classList.remove('active');
                        }
                        if (ptrIcon) {
                            ptrIcon.classList.remove('is-spinning');
                            ptrIcon.style.transform = '';
                        }
                        if (ptrLabel) ptrLabel.innerText = "Pull to refresh";
                    }, 350);
                }, 600);
            } else {
                if (ptrIndicator) {
                    ptrIndicator.style.height = '0px';
                    ptrIndicator.style.opacity = '0';
                    ptrIndicator.classList.remove('active');
                }
                if (ptrIcon) {
                    ptrIcon.style.transform = '';
                }
            }
            pullDistance = 0;
        }, { passive: true });
    });
})();

function renderDashboardActiveDebts() {
    const listContainer = document.getElementById('dashActiveDebtsList');
    if (!listContainer) return;

    const activeDebts = rawDebts.filter(debt => getDebtStatus(debt) === 'active');
    
    if (activeDebts.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align:center; padding:30px 10px; color:var(--text-grey);">
                <i class="fa-solid fa-hand-holding-dollar" style="font-size:2rem; margin-bottom:10px; opacity:0.2;"></i>
                <p>No active debts.</p>
            </div>`;
        return;
    }

    // Sort by due date (soonest first)
    activeDebts.sort((a, b) => {
        const dateA = a.dueDate || '9999-12-31';
        const dateB = b.dueDate || '9999-12-31';
        return dateA.localeCompare(dateB);
    });

    const showList = activeDebts.slice(0, 10);
    listContainer.innerHTML = showList.map(debt => {
        const remaining = Math.max(0, Number(debt.remaining ?? debt.principal ?? 0));
        const isLent = debt.kind === 'lent';
        const label = isLent ? "You Lent to" : "You Borrowed from";
        const amountClass = isLent ? "text-pastel-green" : "text-pastel-red";
        const icon = isLent ? "fa-arrow-down" : "fa-arrow-up";
        const iconColor = isLent ? "var(--green)" : "var(--red)";

        return `
            <div class="retro-transaction-item" onclick="switchPage('debts')" style="cursor: pointer;">
                <div class="rti-left">
                    <div class="rti-date" style="background:var(--hover-bg); color:${iconColor};">
                        <i class="fa-solid ${icon}"></i>
                    </div>
                    <div class="rti-info">
                        <h4>${escapeHTML(debt.partyName || 'Unknown')}</h4>
                        <span>${label}</span>
                    </div>
                </div>
                <div class="rti-right ${amountClass}">
                    ${formatRupiah(remaining)}
                </div>
            </div>`;
    }).join('');
}

function calculateRealtimeGrowth(selectedMonth, selectedYear) {
    // 1. Ambil Total Saldo SAAT INI (Realtime dari Database)
    const currentTotal = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);

    // Default ke Bulan Ini jika parameter kosong atau "All"
    const now = new Date();
    if (!selectedMonth || selectedMonth === 'All') {
        selectedMonth = String(now.getMonth() + 1).padStart(2, '0');
        selectedYear = now.getFullYear();
    }

    // 2. Hitung "Future Flow" (Transaksi yang terjadi SETELAH bulan yang dipilih)
    // Logika: Kita harus membatalkan transaksi masa depan untuk tahu saldo di akhir bulan tersebut
    let flowAfterSelectedMonth = 0;

    rawTransactions.forEach(t => {
        const tDate = new Date(t.date);
        const tMonth = tDate.getMonth() + 1; // 1-12
        const tYear = tDate.getFullYear();

        // Cek apakah transaksi ini terjadi SETELAH bulan filter?
        // (Tahun Transaksi > Tahun Filter) ATAU (Tahun Sama TAPI Bulan Transaksi > Bulan Filter)
        if (tYear > selectedYear || (tYear == selectedYear && tMonth > parseInt(selectedMonth))) {
            if (t.type === 'income') flowAfterSelectedMonth += Number(t.amount);
            if (t.type === 'expense') flowAfterSelectedMonth -= Number(t.amount);
            // Transfer tidak mengubah Total Net Worth, jadi diabaikan
        }
    });

    // 3. REKONSTRUKSI SALDO (Historical Balance)
    // Saldo Akhir Bulan Terpilih = Saldo Sekarang - Transaksi Masa Depan
    const historicClosingBalance = currentTotal - flowAfterSelectedMonth;

    // 4. Hitung "Month Flow" (Arus kas SELAMA bulan yang dipilih)
    let flowInSelectedMonth = 0;

    rawTransactions.forEach(t => {
        const tDate = new Date(t.date);
        const tMonth = String(tDate.getMonth() + 1).padStart(2, '0');
        const tYear = tDate.getFullYear();

        if (String(tYear) === String(selectedYear) && String(tMonth) === String(selectedMonth)) {
            if (t.type === 'income') flowInSelectedMonth += Number(t.amount);
            if (t.type === 'expense') flowInSelectedMonth -= Number(t.amount);
        }
    });

    // Saldo Awal Bulan Terpilih = Saldo Akhir - Arus Kas Bulan Itu
    const historicOpeningBalance = historicClosingBalance - flowInSelectedMonth;

    // 5. Hitung Persentase Pertumbuhan
    // Rumus: ((Saldo Akhir - Saldo Awal) / Saldo Awal) * 100
    let percentChange = 0;

    if (historicOpeningBalance !== 0) {
        percentChange = ((historicClosingBalance - historicOpeningBalance) / Math.abs(historicOpeningBalance)) * 100;
    } else if (historicClosingBalance > 0) {
        percentChange = 100; // Jika dulunya 0 sekarang ada uang, anggap naik 100%
    }

    // 6. Update UI Badge
    const badge = document.getElementById('growthBadge');
    const icon = document.getElementById('growthIcon');
    const text = document.getElementById('growthText');
    
    if (!badge || !icon || !text) return;

    // Reset Class
    badge.className = 'growth-badge'; 

    // Cari Nama Bulan untuk Label
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthIndex = parseInt(selectedMonth) - 1;
    const monthLabel = monthNames[monthIndex] || "Selected";

    let badgeText = "";
    if (percentChange > 0) {
        badge.classList.add('positive');
        icon.className = 'fa-solid fa-arrow-trend-up';
        badgeText = `+${percentChange.toFixed(1)}% in ${monthLabel}`;
    } else if (percentChange < 0) {
        badge.classList.add('negative');
        icon.className = 'fa-solid fa-arrow-trend-down';
        badgeText = `${percentChange.toFixed(1)}% in ${monthLabel}`;
    } else {
        badge.classList.add('neutral');
        icon.className = 'fa-solid fa-minus';
        badgeText = `0% in ${monthLabel}`;
    }

    text.innerText = badgeText;
}

document.getElementById('transactionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Ambil value dari form
    const type = document.getElementById('inputType').value;
    const rawInputAmount = Number(document.getElementById('inputAmount').value);
    const accId = document.getElementById('inputAccount').value;
    const desc = document.getElementById('inputDesc').value;
    const date = document.getElementById('inputDate').value;
    const btn = document.getElementById('btnSaveTrans');
    const editId = document.getElementById('editTransId').value;
    const oldAmount = Number(document.getElementById('originalAmount').value);

    if (isNaN(rawInputAmount) || rawInputAmount <= 0) {
        showAlert("Please enter a valid amount!", true);
        return;
    }

    const amount = (editId && oldAmount && rawInputAmount === convertFromIdrToBase(oldAmount))
        ? oldAmount
        : convertToIdrFromBase(rawInputAmount);

    if(!accId || accId === "NEW_ACCOUNT") { showAlert("Please select a source account!", true); return; }
    
    // Validasi Transfer & Kategori
    if(type === 'transfer') { 
        const targetAccId = document.getElementById('inputToAccount').value; 
        if(!targetAccId || targetAccId === accId) { showAlert("Please select a different destination account!", true); return; } 
    } else { 
        const category = document.getElementById('inputCategory').value; 
        if(!category) { showAlert("Please select a category!", true); return; } 
    }

    btn.innerText = "Processing...";
    btn.disabled = true;

    try {
        // 1. Ambil Data Akun Terbaru (Penting agar saldo sinkron)
        const accRef = doc(db, "accounts", accId); 
        const accSnap = await getDoc(accRef);
        if (!accSnap.exists()) throw new Error("Source account not found.");
        
        let currentBal = Number(accSnap.data().balance);

        // --- LOGIKA EDIT TRANSAKSI ---
        if (editId) {
             const oldType = document.getElementById('originalType').value;

             // A. KEMBALIKAN SALDO KE POSISI SEBELUM TRANSAKSI (REVERT)
             if (oldType === 'expense') {
                 currentBal += oldAmount; // Uang belanja dikembalikan
             } else if (oldType === 'income') {
                 currentBal -= oldAmount; // Uang masuk ditarik kembali
             }
             // Catatan: Transfer tidak disupport edit saldo otomatis di sini karena kompleks (melibatkan 2 akun), 
             // jadi sebaiknya user hapus & buat baru untuk transfer. Tapi logic di atas aman untuk Income/Expense.

             // B. TERAPKAN TRANSAKSI BARU (APPLY NEW)
             if (type === 'expense') { 
                 if (currentBal < amount) { showAlert("Insufficient balance!", true); btn.innerText = "Update"; btn.disabled = false; return; } 
                 currentBal -= amount; 
             } else if (type === 'income') { 
                 currentBal += amount; 
             }

             // C. UPDATE DATABASE (FIX: Gunakan currentBal yang sudah dihitung, JANGAN increment)
             await updateDoc(accRef, { balance: currentBal });
             
             // D. Update Dokumen Transaksi
             await updateDoc(doc(db, "transactions", editId), { 
                 type, 
                 category: document.getElementById('inputCategory').value, 
                 amount, 
                 desc, 
                 date, 
                 accountId: accId,
                 inputCurrency: currentCurrency,
                 originalInputAmount: rawInputAmount
             });
             
             showAlert("Transaction updated & balance adjusted correctly!", false);

        } else {
            // --- LOGIKA TRANSAKSI BARU (ADD) ---
            if (type === 'transfer') {
                const targetAccId = document.getElementById('inputToAccount').value; 
                const targetAccRef = doc(db, "accounts", targetAccId); 
                const targetSnap = await getDoc(targetAccRef);
                if(!targetSnap.exists()) throw new Error("Destination account not found"); 
                
                let targetBal = Number(targetSnap.data().balance);
                if(currentBal < amount) { showAlert("Insufficient source balance!", true); btn.innerText = "Save"; btn.disabled = false; return; }
                
                await updateDoc(accRef, { balance: currentBal - amount }); 
                await updateDoc(targetAccRef, { balance: targetBal + amount });
                
                await addDoc(collection(db, "transactions"), { 
                    uid: currentUser.uid, type: 'transfer', amount, desc, date, 
                    accountId: accId, targetAccountId: targetAccId,
                    inputCurrency: currentCurrency,
                    originalInputAmount: rawInputAmount
                });
            } else {
                const category = document.getElementById('inputCategory').value;
                
                if (type === 'expense') { 
                    if (currentBal < amount) { showAlert("Insufficient balance!", true); btn.innerText = "Save"; btn.disabled = false; return; } 
                    currentBal -= amount; 
                } else if (type === 'income') { 
                    currentBal += amount; 
                }
                
                await updateDoc(accRef, { balance: currentBal });
                await addDoc(collection(db, "transactions"), { 
                    uid: currentUser.uid, type, category, amount, desc, date, accountId: accId,
                    inputCurrency: currentCurrency,
                    originalInputAmount: rawInputAmount
                });
            }
            showAlert("Transaction saved!", false);
        }
        
        document.getElementById('transactionModal').classList.remove('show'); 
        e.target.reset();

    } catch(err) { 
        console.error(err);
        showAlert(getFriendlyMessage(err), true); 
    } finally { 
        btn.innerText = "Save"; 
        btn.disabled = false;
    }
});

function listenToBudgets() {
    const q = query(
        collection(db, "budgets"), 
        where("participants", "array-contains", currentUser.uid)
    );
    
    onSnapshot(q, (snapshot) => {
        rawBudgets = [];
        snapshot.docs.forEach(doc => {
            rawBudgets.push({ id: doc.id, ...doc.data() });
        });
        updateDashboard();
    });
}

function renderSmartBudgets(filterMonth, filterYear) {
    const yearSelect = document.getElementById('yearFilter'); 
    const monthSelect = document.getElementById('monthFilter'); 
    filterMonth = filterMonth || (monthSelect ? monthSelect.value : 'All');
    filterYear = filterYear || (yearSelect ? yearSelect.value : String(new Date().getFullYear()));

    const goalsList = document.getElementById('goalsList'); 
    const budgetsList = document.getElementById('budgetsList'); 
    
    if (goalsList) goalsList.innerHTML = ''; 
    if (budgetsList) budgetsList.innerHTML = '';

    const tFunc = (window.PocketlyI18n && typeof window.PocketlyI18n.t === 'function')
        ? window.PocketlyI18n.t
        : (k, fb) => fb;

    // 1. RENDER SAVINGS GOAL CONTAINERS
    const goals = rawBudgets.filter(b => b.type === 'goal');
    if (goals.length === 0 && goalsList) {
        goalsList.innerHTML = `
            <div class="goal-budget-container" style="text-align: center; padding: 36px 20px;">
                <div style="font-size: 2.2rem; color: var(--text-muted); margin-bottom: 10px;">🎯</div>
                <h4 style="margin-bottom: 6px; font-size: 1.1rem;">${tFunc('no_goals_active', 'No Savings Goals Active')}</h4>
                <p style="color: var(--text-grey); font-size: 0.88rem; max-width: 360px; margin: 0 auto 18px auto;">
                    ${tFunc('no_goals_desc', 'Create a savings goal container to track vacation funds, emergency reserves, or collaborative goals with friends.')}
                </p>
                <button class="btn-primary" onclick="openCreateBudgetModal('goal')" style="border-radius: var(--radius-pill); padding: 8px 22px;">
                    <i class="fa-solid fa-plus"></i> ${tFunc('btn_create_first_goal', 'Create First Goal Container')}
                </button>
            </div>`;
    } else if (goalsList) {
        let goalsHtml = '';
        goals.forEach(b => {
            const currentAmount = Number(b.current || 0);
            const target = Number(b.target || 0);
            const percent = target > 0 ? (currentAmount / target) * 100 : 0;
            const remaining = Math.max(0, target - currentAmount);
            const isShared = b.visibility === 'shared';
            const safeName = (b.name || 'Goal').replace(/'/g, "\\'");
            const isOwner = b.uid === currentUser.uid;

            let statusText = tFunc('status_in_progress', 'In Progress');
            let statusBadgeClass = 'safe';
            if (percent >= 100) {
                statusText = tFunc('status_achieved', 'Achieved! 🎉');
                statusBadgeClass = 'safe';
            } else if (percent >= 75) {
                statusText = tFunc('status_almost_there', 'Almost There');
                statusBadgeClass = 'warning';
            } else if (percent >= 50) {
                statusText = tFunc('status_halfway', 'Halfway');
                statusBadgeClass = 'warning';
            } else {
                statusText = `${Math.round(percent)}% ${tFunc('saved_word', 'Saved')}`;
                statusBadgeClass = 'unbudgeted';
            }

            const participantCount = Array.isArray(b.participants) ? b.participants.length : 1;
            const sharedIconHTML = isShared 
                ? `<span onclick="window.showGoalParticipants(event, '${b.id}')" class="shared-goal-badge-btn" title="View Goal Members (${participantCount})">
                    <i class="fa-solid fa-user-group" style="color: var(--primary-color); font-size: 0.8rem;"></i>
                    <small style="color: var(--primary-color); font-size: 0.72rem; font-weight: 700;">${participantCount}</small>
                  </span>`
                : '';

            const rightActionButtonHTML = (isShared && !isOwner)
                ? `<button type="button" class="btn-subtle-danger btn-circle-action" onclick="window.leaveSharedGoal('${b.id}')" title="Leave Shared Goal" aria-label="Leave Shared Goal">
                    <i class="fa-solid fa-arrow-right-from-bracket"></i>
                  </button>`
                : `<button type="button" class="btn-subtle-danger btn-circle-action" onclick="window.askDeleteBudget('${b.id}')" title="Delete Goal" aria-label="Delete Goal">
                    <i class="fa-solid fa-trash-can"></i>
                  </button>`;

            goalsHtml += `
                <div class="goal-budget-container" id="goal-container-${b.id}">
                    <div class="cat-container-header">
                        <div class="cat-title-left">
                            <div class="cat-header-icon" style="background: rgba(16,185,129,0.14); color: #10b981;">
                                <i class="fa-solid fa-bullseye"></i>
                            </div>
                            <div>
                                <div style="display:flex; align-items:center; gap:6px;">
                                    <h3 class="cat-header-title">${escapeHTML(b.name)}</h3>
                                    ${sharedIconHTML}
                                </div>
                                <span class="cat-status-badge ${statusBadgeClass}">${statusText}</span>
                            </div>
                        </div>
                    </div>

                    <div class="cat-container-body">
                        <div class="cat-metrics-grid">
                            <div class="cat-metric-item">
                                <small>${tFunc('current_saved', 'Current Saved')}</small>
                                <div class="cat-metric-value text-green">${formatRupiah(currentAmount)}</div>
                            </div>
                            <div class="cat-metric-item">
                                <small>${tFunc('target_goal', 'Target Goal')}</small>
                                <div class="cat-metric-value text-dark">${formatRupiah(target)}</div>
                            </div>
                            <div class="cat-metric-item">
                                <small>${percent >= 100 ? tFunc('milestone', 'Milestone') : tFunc('remaining_needed', 'Remaining Needed')}</small>
                                <div class="cat-metric-value ${percent >= 100 ? 'text-green' : 'text-blue'}">
                                    ${percent >= 100 ? tFunc('status_achieved', 'Goal Reached! 🎉') : formatRupiah(remaining)}
                                </div>
                            </div>
                            <div class="cat-metric-item">
                                <small>${tFunc('goal_progress', 'Goal Progress')}</small>
                                <div class="cat-metric-value text-secondary">${Math.round(percent)}% ${tFunc('saved_word', 'Saved')}</div>
                            </div>
                        </div>

                        <div class="cat-progress-wrapper">
                            <div class="cat-progress-labels">
                                <span style="font-weight:700; color:${percent >= 100 ? '#10b981' : 'var(--primary-color)'};">
                                    ${percent >= 100 ? tFunc('target_fully_achieved', 'Target fully achieved!') : `${Math.round(percent)}% ${tFunc('pct_of_target_saved', 'of target saved')}`}
                                </span>
                                <span style="color:var(--text-grey); font-size:0.82rem;">
                                    ${percent >= 100 ? tFunc('ready_to_fulfill', 'Ready to fulfill') : `${formatRupiah(remaining)} ${tFunc('left_to_save', 'left to save')}`}
                                </span>
                            </div>
                            <div class="progress-bar-bg" style="height: 10px;">
                                <div class="progress-bar-fill ${percent >= 100 ? 'success' : 'safe'}" style="width: ${Math.min(percent, 100)}%;"></div>
                            </div>
                        </div>
                    </div>

                    <div class="cat-container-footer">
                        <div class="cat-footer-actions-left">
                            <button type="button" class="btn-secondary btn-circle-action" onclick="window.openEditBudget('${b.id}', '${safeName}', ${target}, ${currentAmount}, 'goal')" title="Edit Goal" aria-label="Edit Goal">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button type="button" class="btn-outline-warning btn-circle-action" onclick="window.openTopupBudget('${b.id}', '${safeName}', ${currentAmount}, 'goal', 'withdraw')" title="Withdraw Funds" aria-label="Withdraw Funds">
                                <i class="fa-solid fa-arrow-up-from-bracket"></i>
                            </button>
                            <button type="button" class="btn-primary btn-circle-action" onclick="window.openTopupBudget('${b.id}', '${safeName}', ${currentAmount}, 'goal', 'deposit')" title="Add Funds" aria-label="Add Funds">
                                <i class="fa-solid fa-plus"></i>
                            </button>
                        </div>
                        <div class="cat-footer-actions-right">
                            ${rightActionButtonHTML}
                        </div>
                    </div>
                </div>`;
        });
        goalsList.innerHTML = goalsHtml;
    }

    // 2. RENDER CATEGORY BUDGET CARDS (Only show categories with an active budget limit set by user)
    if (budgetsList) {
        const categoryBudgets = rawBudgets.filter(b => b.type === 'budget');

        if (categoryBudgets.length === 0) {
            budgetsList.innerHTML = `
                <div class="category-budget-container" style="text-align: center; padding: 36px 20px;">
                    <div style="font-size: 2.2rem; color: var(--text-muted); margin-bottom: 10px;">📉</div>
                    <h4 style="margin-bottom: 6px; font-size: 1.1rem;">${tFunc('no_cat_budgets_active', 'No Category Budgets Set')}</h4>
                    <p style="color: var(--text-grey); font-size: 0.88rem; max-width: 360px; margin: 0 auto 18px auto;">
                        ${tFunc('no_cat_budgets_desc', "No spending limits configured yet. Click 'Set Budget Limit' to establish monthly limits for your categories.")}
                    </p>
                    <button class="btn-primary" onclick="openCreateBudgetModal('budget')" style="border-radius: var(--radius-pill); padding: 8px 22px;">
                        <i class="fa-solid fa-plus"></i> ${tFunc('btn_set_budget_limit', 'Set Budget Limit')}
                    </button>
                </div>`;
        } else {
            let categoriesHtml = '';
            categoryBudgets.forEach(budgetItem => {
                const cat = budgetItem.name;
                const icon = typeof getCategoryIcon === 'function' ? getCategoryIcon(cat) : (CATEGORY_ICONS[cat] || 'fa-box');
                const color = typeof getCategoryColor === 'function' ? getCategoryColor(cat) : '#2563eb';
                
                // Calculate total expenses for this category in selected month & year
                const catExpenses = rawTransactions.filter(t => {
                    if (t.category !== cat || t.type !== 'expense') return false;
                    const [tYear, tMonth] = t.date.split('-');
                    const monthMatch = (filterMonth === 'All') || (tMonth === filterMonth);
                    const yearMatch = (String(tYear) === String(filterYear));
                    return monthMatch && yearMatch;
                });
                const spent = catExpenses.reduce((sum, t) => sum + Number(t.amount || 0), 0);

                const safeName = cat.replace(/'/g, "\\'");
                const limit = Number(budgetItem.target || 0);
                const percent = limit > 0 ? (spent / limit) * 100 : 0;
                const remaining = limit - spent;
                const isOver = remaining < 0;

                let progressClass = 'safe';
                let statusLabel = tFunc('on_track', 'On Track');
                let statusBadgeClass = 'safe';

                if (percent >= 100) { progressClass = 'danger'; statusLabel = tFunc('over_budget', 'Over Budget'); statusBadgeClass = 'danger'; }
                else if (percent >= 80) { progressClass = 'danger'; statusLabel = tFunc('near_limit', 'Near Limit'); statusBadgeClass = 'warning'; }
                else if (percent >= 50) { progressClass = 'warning'; statusLabel = tFunc('moderate', 'Moderate'); statusBadgeClass = 'warning'; }
                else { progressClass = 'safe'; statusLabel = tFunc('on_track', 'On Track'); statusBadgeClass = 'safe'; }

                // Recent 3 transactions peek for this category container
                let recentTxnsHTML = '';
                if (catExpenses.length > 0) {
                    const sortedRecent = [...catExpenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
                    const itemsList = sortedRecent.map(t => `
                        <div class="cat-txn-mini-item" onclick="openTransactionDetail('${t.id}')">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="font-weight:600; color:var(--text-dark);">${escapeHTML(t.desc || cat)}</span>
                                <small style="color:var(--text-grey); font-size:0.75rem;">${t.date}</small>
                            </div>
                            <span style="font-weight:700; color:var(--red); font-family:var(--font-mono);">- ${formatRupiah(t.amount)}</span>
                        </div>
                    `).join('');

                    recentTxnsHTML = `
                        <div class="cat-recent-txns">
                            <div class="cat-txns-title">${tFunc('recent_activity_total', 'Recent Activity')} (${catExpenses.length} total)</div>
                            ${itemsList}
                        </div>
                    `;
                }

                const catDisplayName = (window.PocketlyI18n && typeof window.PocketlyI18n.translateCategory === 'function')
                    ? window.PocketlyI18n.translateCategory(cat)
                    : cat;

                categoriesHtml += `
                    <div class="category-budget-container" id="cat-container-${safeName.replace(/\s+/g, '-')}">
                        <div class="cat-container-header">
                            <div class="cat-title-left">
                                <div class="cat-header-icon" style="background: ${hexToRgba(color, 0.14)}; color: ${color};">
                                    <i class="fa-solid ${icon}"></i>
                                </div>
                                <div>
                                    <h3 class="cat-header-title">${escapeHTML(catDisplayName)}</h3>
                                    <span class="cat-status-badge ${statusBadgeClass}">${statusLabel}</span>
                                </div>
                            </div>
                        </div>

                        <div class="cat-container-body">
                            <div class="cat-metrics-grid">
                                <div class="cat-metric-item">
                                    <small>${tFunc('monthly_spent', 'Monthly Spent')}</small>
                                    <div class="cat-metric-value text-dark">${formatRupiah(spent)}</div>
                                </div>
                                <div class="cat-metric-item">
                                    <small>${tFunc('budget_limit', 'Budget Limit')}</small>
                                    <div class="cat-metric-value">${formatRupiah(limit)}</div>
                                </div>
                                <div class="cat-metric-item">
                                    <small>${isOver ? tFunc('over_budget', 'Over Budget') : tFunc('remaining', 'Remaining')}</small>
                                    <div class="cat-metric-value ${isOver ? 'text-red' : 'text-green'}">
                                        ${isOver ? `+${formatRupiah(Math.abs(remaining))}` : formatRupiah(remaining)}
                                    </div>
                                </div>
                                <div class="cat-metric-item">
                                    <small>${tFunc('total_records', 'Total Records')}</small>
                                    <div class="cat-metric-value text-secondary">${catExpenses.length}</div>
                                </div>
                            </div>

                            <div class="cat-progress-wrapper">
                                <div class="cat-progress-labels">
                                    <span style="font-weight:700; color:${isOver ? 'var(--red)' : (percent >= 80 ? 'var(--yellow)' : 'var(--green)')};">
                                        ${percent.toFixed(0)}% ${tFunc('pct_of_limit_spent', 'of limit spent')}
                                    </span>
                                    <span style="color:var(--text-grey); font-size:0.82rem;">
                                        ${isOver ? tFunc('over_budget_limit', 'Over budget limit') : `${formatRupiah(remaining)} ${tFunc('left_word', 'left')}`}
                                    </span>
                                </div>
                                <div class="progress-bar-bg" style="height: 10px;">
                                    <div class="progress-bar-fill ${progressClass}" style="width: ${Math.min(percent, 100)}%;"></div>
                                </div>
                            </div>

                            ${recentTxnsHTML}
                        </div>

                        <div class="cat-container-footer">
                            <div class="cat-footer-actions-left">
                                <button type="button" class="btn-secondary btn-circle-action" onclick="window.openEditBudget('${budgetItem.id}', '${safeName}', ${limit}, ${spent}, 'budget')" title="Edit Limit" aria-label="Edit Limit">
                                    <i class="fa-solid fa-pen"></i>
                                </button>
                            </div>
                            <div class="cat-footer-actions-right">
                                <button type="button" class="btn-subtle-danger btn-circle-action" onclick="window.askDeleteBudget('${budgetItem.id}')" title="Delete Limit" aria-label="Delete Limit">
                                    <i class="fa-solid fa-trash-can"></i>
                                </button>
                            </div>
                        </div>
                    </div>`;
            });
            budgetsList.innerHTML = categoriesHtml;
        }
    }
}

window.toggleBudgetType = function() {
    const typeSelect = document.getElementById('budgetType'); 
    if (!typeSelect) return; 
    const type = typeSelect.value;
    
    const goalGroup = document.getElementById('goalNameGroup'); 
    const catGroup = document.getElementById('budgetCategoryGroup'); 
    const goalToggle = document.getElementById('goalTypeToggleGroup'); 
    const partnerGroup = document.getElementById('partnerSelectionGroup');

    if (type === 'goal') {
        goalGroup.style.display = 'block';
        catGroup.style.display = 'none';
        goalToggle.style.display = 'block'; 
    } else {
        goalGroup.style.display = 'none';
        catGroup.style.display = 'block';
        goalToggle.style.display = 'none';
        partnerGroup.style.display = 'none';
    }
    setTimeout(initCustomSelects, 50);
};

window.togglePartnerSelection = function() {
    const visibility = document.getElementById('goalVisibility').value;
    const partnerGroup = document.getElementById('partnerSelectionGroup');
    
    if (visibility === 'shared') {
        partnerGroup.style.display = 'block';
        renderPartnerChecklist();
    } else {
        partnerGroup.style.display = 'none';
    }
};

async function renderPartnerChecklist() {
    const container = document.getElementById('partnerChecklist');
    if (!container) return;

    container.innerHTML = `
        <div id="multiSelectWrapper" class="multi-select-wrapper">
            <div class="multi-select-trigger" onclick="toggleMultiDropdown()">
                <span id="multiSelectedText" style="color:var(--text-grey);">Select Participants...</span>
            </div>
            <div id="multiOptionsList" class="multi-select-options">
                <div style="padding:12px; text-align:center; color:var(--text-grey);">Loading...</div>
            </div>
        </div>
    `;

    try {
        const q = query(collection(db, "connections"), where("uid", "==", currentUser.uid));
        const snap = await getDocs(q);
        const listContainer = document.getElementById('multiOptionsList');

        if (snap.empty) {
            listContainer.innerHTML = `<div style="padding:15px; text-align:center;">No friends found.</div>`;
            return;
        }

        listContainer.innerHTML = '';

        snap.forEach(doc => {
            const friend = doc.data();

            const itemDiv = document.createElement('div');
            itemDiv.className = 'multi-option-item';

            itemDiv.onclick = (e) => {
                if (e.target.type !== 'checkbox') {
                    const cb = itemDiv.querySelector('input');
                    cb.checked = !cb.checked;
                    updateMultiSelectText();
                }
            };

            itemDiv.innerHTML = `
                <div class="multi-item-left">
                    <span class="m-name">${friend.friendName}</span>
                    <span class="m-username">@${friend.friendID}</span>
                </div>
                <input type="checkbox" name="goalPartners" value="${friend.friendUID}" class="m-checkbox" onchange="updateMultiSelectText()">
            `;

            listContainer.appendChild(itemDiv);
        }); 

    } catch (err) {
        console.error(err);
        const listContainer = document.getElementById('multiOptionsList');
        if (listContainer) listContainer.innerHTML = '<div style="padding:10px; text-align:center; color:red;">Error loading</div>';
    }
}

window.toggleMultiDropdown = function() {
    const wrapper = document.getElementById('multiSelectWrapper');
    if(wrapper) wrapper.classList.toggle('active');
};

window.updateMultiSelectText = function() {
    const checkedBoxes = document.querySelectorAll('input[name="goalPartners"]:checked');
    const textSpan = document.getElementById('multiSelectedText');
    
    if (checkedBoxes.length === 0) {
        textSpan.innerText = "Select Participants...";
        textSpan.style.color = "var(--text-grey)";
        textSpan.style.fontWeight = "400";
    } else {
        const names = Array.from(checkedBoxes).map(cb => {
            return cb.parentElement.querySelector('.m-name').innerText;
        });
        
        const displayText = names.join(', ');
        textSpan.innerText = displayText.length > 30 ? displayText.substring(0, 30) + '...' : displayText;
        textSpan.style.color = "var(--text-dark)";
        textSpan.style.fontWeight = "600";
    }
};

window.addEventListener('click', function(e) {
    const wrapper = document.getElementById('multiSelectWrapper');
    if (wrapper && !wrapper.contains(e.target)) {
        wrapper.classList.remove('active');
    }
});

window.openCreateBudgetModal = (type, preselectedCategory = '') => { 
    document.getElementById('budgetForm').reset(); 
    document.getElementById('editBudgetId').value = ""; 
    const targetInput = document.getElementById('budgetTarget');
    if (targetInput) {
        targetInput.value = '';
        targetInput.dataset.originalIdr = '';
    }
    
    const goalTitle = (window.PocketlyI18n && window.PocketlyI18n.t('budget_modal_goal_title')) || "New Savings Goal";
    const budgetTitle = (window.PocketlyI18n && window.PocketlyI18n.t('budget_modal_limit_title')) || "Set Budget Limit";
    const title = type === 'goal' ? goalTitle : budgetTitle;
    document.getElementById('budgetModalTitle').innerText = title; 
    document.getElementById('btnSaveBudget').innerText = (window.PocketlyI18n && window.PocketlyI18n.t('btn_save_plan')) || "Save Plan"; 
    
    const typeSelect = document.getElementById('budgetType'); 
    if (typeSelect) { 
        typeSelect.value = type; 
        if (typeof toggleBudgetType === 'function') toggleBudgetType();
    } 

    if (type === 'budget' && preselectedCategory) {
        const catSelect = document.getElementById('budgetCategorySelect');
        if (catSelect) catSelect.value = preselectedCategory;
    }
    
    const planGroup = document.getElementById('planTypeGroup'); 
    if (planGroup) { planGroup.style.display = 'none'; } 
    
    // --- TAMBAHAN: BUKA KUNCI VISIBILITY SAAT BUAT BARU ---
    const visSelect = document.getElementById('goalVisibility');
    if(visSelect) {
        visSelect.disabled = false; // Boleh pilih Personal/Shared
        visSelect.value = 'personal'; // Default
    }
    // -----------------------------------------------------

    if (typeof updateFormCurrencyIndicators === 'function') updateFormCurrencyIndicators();
    document.getElementById('budgetModal').classList.add('show'); 
};

// Tambahkan 'async' di depan
window.openEditBudget = async (id, name, target, current, type) => { 
    document.getElementById('budgetModalTitle').innerText = (window.PocketlyI18n && window.PocketlyI18n.t('budget_modal_edit_title')) || "Edit Budget Plan"; 
    document.getElementById('btnSaveBudget').innerText = (window.PocketlyI18n && window.PocketlyI18n.t('btn_update_plan')) || "Update Plan"; 
    document.getElementById('editBudgetId').value = id; 
    
    const typeSelect = document.getElementById('budgetType'); 
    if (typeSelect) { 
        typeSelect.value = type || 'goal'; 
        const event = new Event('change'); 
        typeSelect.dispatchEvent(event); 
    } 
    
    const planGroup = document.getElementById('planTypeGroup'); 
    if (planGroup) { planGroup.style.display = 'none'; } 
    
    if (type === 'goal') { 
        document.getElementById('budgetName').value = name; 
    } else { 
        document.getElementById('budgetCategorySelect').value = name; 
    } 
    
    const targetInput = document.getElementById('budgetTarget');
    if (targetInput) {
        targetInput.value = convertFromIdrToBase(target);
        targetInput.dataset.originalIdr = String(target);
    }

    // --- LOGIKA PENGAMANAN VISIBILITY ---
    const visSelect = document.getElementById('goalVisibility');
    const partnerGroup = document.getElementById('partnerSelectionGroup');
    
    if (visSelect) {
        // 1. Kunci dropdown agar tidak bisa diubah
        visSelect.disabled = true; 
        
        // 2. Ambil data asli dari database untuk memastikan status visibility
        try {
            const docRef = doc(db, "budgets", id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                visSelect.value = data.visibility || 'personal';
                
                // Jika Shared, kita sembunyikan checklist partner 
                // (karena fitur edit member belum didukung logic database)
                if (data.visibility === 'shared') {
                    // Opsional: Tampilkan pesan info
                    // showAlert("Note: Participants cannot be changed while editing.", false);
                }
            }
        } catch (e) {
            console.error("Error fetching visibility", e);
        }
    }
    
    // Sembunyikan checklist teman saat Edit (Untuk keamanan)
    if (partnerGroup) partnerGroup.style.display = 'none';
    // ------------------------------------

    if (typeof updateFormCurrencyIndicators === 'function') updateFormCurrencyIndicators();
    document.getElementById('budgetModal').classList.add('show'); 
    setTimeout(initCustomSelects, 100); 
};

document.getElementById('budgetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editBudgetId').value;
    const type = document.getElementById('budgetType').value;
    const visibility = document.getElementById('goalVisibility').value; // Ambil status visibility
    
    let name = (type === 'goal') ? document.getElementById('budgetName').value : document.getElementById('budgetCategorySelect').value;
    const rawTarget = Number(document.getElementById('budgetTarget').value);
    const origIdr = Number(document.getElementById('budgetTarget').dataset.originalIdr || 0);

    if (isNaN(rawTarget) || rawTarget <= 0) {
        showAlert("Target / Limit amount must be greater than 0.", true);
        return;
    }

    const target = (id && origIdr && rawTarget === convertFromIdrToBase(origIdr))
        ? origIdr
        : convertToIdrFromBase(rawTarget);
    
    // Ambil teman yang dicentang
    const selectedPartners = Array.from(document.querySelectorAll('input[name="goalPartners"]:checked')).map(cb => cb.value);

    try {
        if (!name) throw new Error("Please enter a name or select a category.");

        const btn = document.getElementById('btnSaveBudget');
        btn.innerText = "Processing...";
        btn.disabled = true;

        // Data Dasar
        const data = {
            name,
            target,
            type,
            updatedAt: new Date().toISOString()
        };

        if(id) {
            await updateDoc(doc(db, "budgets", id), data);
            showAlert(type === 'budget' ? `Budget limit for ${name} updated successfully!` : "Goal plan updated successfully!", false);
        } else {
            // Prevent duplicate budgets for the same category
            if (type === 'budget') {
                const existing = rawBudgets.find(b => b.type === 'budget' && b.name === name);
                if (existing) {
                    await updateDoc(doc(db, "budgets", existing.id), data);
                    showAlert(`Budget limit for ${name} updated successfully!`, false);
                    document.getElementById('budgetModal').classList.remove('show');
                    e.target.reset();
                    return;
                }
            }

            data.visibility = visibility;
            data.current = 0; 
            data.uid = currentUser.uid;
            data.ownerName = currentUser.displayName;
            data.participants = [currentUser.uid]; 

            const docRef = await addDoc(collection(db, "budgets"), data);

            if (visibility === 'shared' && selectedPartners.length > 0) {
                const batch = writeBatch(db);
                selectedPartners.forEach(friendUID => {
                    const inviteRef = doc(collection(db, "goal_invites"));
                    batch.set(inviteRef, {
                        fromUID: currentUser.uid,
                        fromName: currentUser.displayName,
                        toUID: friendUID,
                        budgetID: docRef.id,
                        budgetName: name,
                        status: 'pending',
                        createdAt: new Date().toISOString()
                    });
                });
                await batch.commit();

                showAlert("Goal created! Invitations sent to friends.", false);
            } else {
                showAlert(type === 'budget' ? `Budget limit for ${name} set successfully!` : "Financial Goal created successfully!", false);
            }
        }

        document.getElementById('budgetModal').classList.remove('show');
        e.target.reset();
    } catch(err) { 
        console.error(err);
        showAlert(getFriendlyMessage(err), true); 
    } finally {
        const btn = document.getElementById('btnSaveBudget');
        btn.innerText = "Save Plan";
        btn.disabled = false;
    }
});

// --- FUNGSI UNTUK MEMBUKA MODAL TOP UP / WITHDRAW ---
window.openTopupBudget = (id, name, current, type, defaultAction = 'deposit') => {
    // 0. Validasi Khusus Withdraw pada Saving Goal
    if (type === 'goal' && defaultAction === 'withdraw') {
        const budgetItem = (typeof rawBudgets !== 'undefined' && Array.isArray(rawBudgets)) ? rawBudgets.find(b => b.id === id) : null;
        if (budgetItem) {
            if (Number(budgetItem.current || 0) <= 0) {
                showAlert("This goal currently has a balance of Rp 0. There are no funds available to withdraw.", true);
                return;
            }
            if (budgetItem.visibility === 'shared') {
                const userContrib = (budgetItem.contributions && budgetItem.contributions[currentUser.uid]) || 0;
                if (userContrib <= 0) {
                    showAlert("You do not have any contributed balance in this shared goal. You cannot withdraw other members' funds.", true);
                    return;
                }
            }
        }
    }

    // 1. Reset Form agar bersih
    document.getElementById('topupBudgetForm').reset();
    
    // 2. Isi Input Tersembunyi (Hidden Fields)
    document.getElementById('topupBudgetId').value = id;
    document.getElementById('topupCurrentVal').value = current;
    document.getElementById('topupType').value = type;

    // 3. Populate Dropdown Akun (Ambil dari variabel global 'accounts')
    const accSelect = document.getElementById('topupAccount');
    const selAccText = (window.PocketlyI18n && window.PocketlyI18n.t('trans_select_account_placeholder')) || 'Select Account';
    accSelect.innerHTML = `<option value="" disabled selected data-i18n="trans_select_account_placeholder">${selAccText}</option>`; // Reset opsi
    
    if (accounts && accounts.length > 0) {
        accounts.forEach(acc => {
            const opt = document.createElement('option');
            opt.value = acc.id;
            opt.innerText = `${acc.name} (${formatRupiah(acc.balance)})`;
            accSelect.appendChild(opt);
        });
    } else {
        accSelect.innerHTML += '<option disabled>No accounts found</option>';
    }

    // 4. Set Default Tampilan ke 'deposit' atau 'withdraw'
    const actionSelect = document.getElementById('topupActionType');
    if (actionSelect) actionSelect.value = defaultAction;
    window.toggleTopupLabel(); // Panggil fungsi helper label

    // 5. Tampilkan Modal
    document.getElementById('topupBudgetModal').classList.add('show');
    
    // 6. Refresh Custom Select (agar dropdown tampil cantik)
    setTimeout(initCustomSelects, 100);
};

window.showGoalParticipants = async (event, budgetId) => {
    if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation();
    }

    const modal = document.getElementById('participantsModal');
    const nameEl = document.getElementById('participantsModalGoalName');
    const subtitleEl = document.getElementById('participantsModalSubtitle');
    const totalSavedEl = document.getElementById('participantsModalTotalSaved');
    const targetEl = document.getElementById('participantsModalTarget');
    const countBadge = document.getElementById('participantsCountBadge');
    const listEl = document.getElementById('participantsList');
    const footerEl = document.getElementById('participantsFooterActions');

    if (!modal || !listEl) return;

    modal.classList.add('show');
    listEl.innerHTML = `
        <div style="padding: 28px 16px; text-align: center; color: var(--text-grey);">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 1.4rem; color: var(--primary-color); margin-bottom: 10px; display: block;"></i>
            <span>Loading members...</span>
        </div>
    `;
    if (footerEl) footerEl.style.display = 'none';

    try {
        let goal = rawBudgets.find(b => b.id === budgetId);
        if (!goal) {
            const snap = await getDoc(doc(db, "budgets", budgetId));
            if (snap.exists()) {
                goal = { id: snap.id, ...snap.data() };
            }
        }

        if (!goal) {
            listEl.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--red);">Goal not found.</div>`;
            return;
        }

        const participants = Array.isArray(goal.participants) ? [...goal.participants] : [goal.uid];
        if (goal.uid && !participants.includes(goal.uid)) {
            participants.unshift(goal.uid);
        }

        const totalSaved = Number(goal.current || 0);
        const targetAmount = Number(goal.target || 0);
        const isOwner = (goal.uid === currentUser.uid);

        if (nameEl) nameEl.innerText = goal.name || "Shared Goal";
        if (subtitleEl) subtitleEl.innerText = `${participants.length} member${participants.length > 1 ? 's' : ''} saving together`;
        if (totalSavedEl) totalSavedEl.innerText = formatRupiah(totalSaved);
        if (targetEl) targetEl.innerText = formatRupiah(targetAmount);
        if (countBadge) countBadge.innerText = `${participants.length} Member${participants.length > 1 ? 's' : ''}`;

        // Fetch user profiles for participants in parallel
        const memberProfiles = await Promise.all(participants.map(async (uid) => {
            let profileData = { uid, displayName: "Member", userID: uid.substring(0, 8), photoURL: "" };
            if (uid === currentUser.uid) {
                profileData.displayName = currentUser.displayName || "You";
                profileData.photoURL = currentUser.photoURL || "";
                try {
                    const mySnap = await getDoc(doc(db, "user_profiles", uid));
                    if (mySnap.exists()) {
                        const d = mySnap.data();
                        if (d.displayName) profileData.displayName = d.displayName;
                        if (d.userID) profileData.userID = d.userID;
                        if (d.photoURL) profileData.photoURL = d.photoURL;
                    }
                } catch (e) { /* ignore */ }
            } else {
                try {
                    const userSnap = await getDoc(doc(db, "user_profiles", uid));
                    if (userSnap.exists()) {
                        const d = userSnap.data();
                        if (d.displayName) profileData.displayName = d.displayName;
                        if (d.userID) profileData.userID = d.userID;
                        if (d.photoURL) profileData.photoURL = d.photoURL;
                    }
                } catch (e) {
                    console.warn("Could not fetch profile for", uid, e);
                }
            }

            const contribution = (goal.contributions && goal.contributions[uid]) ? Number(goal.contributions[uid]) : 0;
            return {
                ...profileData,
                isGoalOwner: (uid === goal.uid),
                isMe: (uid === currentUser.uid),
                contribution
            };
        }));

        // Sort: Owner first, then currentUser, then by contribution desc
        memberProfiles.sort((a, b) => {
            if (a.isGoalOwner) return -1;
            if (b.isGoalOwner) return 1;
            if (a.isMe) return -1;
            if (b.isMe) return 1;
            return b.contribution - a.contribution;
        });

        let html = '';
        memberProfiles.forEach(m => {
            const pct = totalSaved > 0 ? Math.round((m.contribution / totalSaved) * 100) : 0;
            const initial = (m.displayName || "M").charAt(0).toUpperCase();

            html += `
                <div class="participant-card-item">
                    <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
                        <div class="participant-avatar-wrap">
                            ${m.photoURL ? `<img src="${m.photoURL}" alt="${escapeHTML(m.displayName)}" style="width: 100%; height: 100%; object-fit: cover;">` : `<span>${initial}</span>`}
                        </div>
                        <div style="min-width: 0;">
                            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                <span style="font-weight: 700; font-size: 0.92rem; color: var(--text-dark);">${escapeHTML(m.displayName)}</span>
                                ${m.isGoalOwner ? `<span class="participant-badge-owner"><i class="fa-solid fa-crown" style="font-size: 0.65rem;"></i> Owner</span>` : ''}
                                ${m.isMe ? `<span class="participant-badge-you">You</span>` : ''}
                            </div>
                            <div style="font-size: 0.76rem; color: var(--text-grey);">@${escapeHTML(m.userID)}</div>
                        </div>
                    </div>
                    <div style="text-align: right; flex-shrink: 0; margin-left: 10px;">
                        <div style="font-size: 0.88rem; font-weight: 700; color: #10b981;">${formatRupiah(m.contribution)}</div>
                        <small style="font-size: 0.72rem; color: var(--text-grey);">${pct}% share</small>
                    </div>
                </div>
            `;
        });

        listEl.innerHTML = html;

        // Footer Actions
        if (footerEl) {
            if (!isOwner) {
                const myContrib = (goal.contributions && goal.contributions[currentUser.uid]) ? Number(goal.contributions[currentUser.uid]) : 0;
                footerEl.style.display = 'block';
                footerEl.innerHTML = `
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <button type="button" class="btn-danger full-width" onclick="window.leaveSharedGoal('${goal.id}')" style="display: flex; align-items: center; justify-content: center; gap: 8px; border-radius: var(--radius-pill); font-weight: 700; padding: 11px 18px;">
                            <i class="fa-solid fa-arrow-right-from-bracket"></i> Leave This Shared Goal
                        </button>
                        <p style="margin: 0; text-align: center; font-size: 0.78rem; color: var(--text-grey);">
                            ${myContrib > 0 ? `You have ${formatRupiah(myContrib)} saved. You will be prompted to withdraw your balance before leaving.` : 'Leaving will remove this goal from your dashboard.'}
                        </p>
                    </div>
                `;
            } else {
                footerEl.style.display = 'block';
                footerEl.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 0.82rem; color: var(--text-grey); padding: 4px 0;">
                        <i class="fa-solid fa-crown" style="color: #f59e0b;"></i>
                        <span>You are the creator and owner of this shared goal.</span>
                    </div>
                `;
            }
        }
    } catch (err) {
        console.error("Error showing goal participants:", err);
        listEl.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--red);">Failed to load members list.</div>`;
    }
};

window.leaveSharedGoal = async (budgetId) => {
    try {
        let goal = rawBudgets.find(b => b.id === budgetId);
        if (!goal) {
            const snap = await getDoc(doc(db, "budgets", budgetId));
            if (snap.exists()) {
                goal = { id: snap.id, ...snap.data() };
            }
        }

        if (!goal) {
            showAlert("Goal not found.", true);
            return;
        }

        // 1. Creator cannot leave their own goal
        if (goal.uid === currentUser.uid) {
            showAlert("As the creator, you cannot leave this goal. You can delete or manage the goal from the actions menu.", true);
            return;
        }

        // 2. Check if user still has contributed funds
        const userContribution = (goal.contributions && goal.contributions[currentUser.uid]) ? Number(goal.contributions[currentUser.uid]) : 0;
        if (userContribution > 0) {
            showConfirm(
                "Active Balance Remaining",
                `You still have ${formatRupiah(userContribution)} contributed in "${goal.name}". Please withdraw your funds first before leaving so your balance is safely returned to your account.`,
                "Withdraw Funds Now",
                () => {
                    const partModal = document.getElementById('participantsModal');
                    if (partModal) partModal.classList.remove('show');
                    window.openTopupBudget(goal.id, goal.name, goal.current, 'goal', 'withdraw');
                }
            );
            return;
        }

        // 3. Confirm leaving
        showConfirm(
            "Leave Shared Goal?",
            `Are you sure you want to leave "${goal.name}"? This goal will be removed from your dashboard.`,
            "Leave Goal",
            async () => {
                try {
                    const batch = writeBatch(db);
                    const budgetRef = doc(db, "budgets", budgetId);

                    batch.update(budgetRef, {
                        participants: arrayRemove(currentUser.uid)
                    });

                    // Remove any invitations linked to this user for this goal
                    const qInv = query(
                        collection(db, "goal_invites"),
                        where("budgetID", "==", budgetId),
                        where("toUID", "==", currentUser.uid)
                    );
                    const snapInv = await getDocs(qInv);
                    snapInv.docs.forEach(d => batch.delete(d.ref));

                    await batch.commit();

                    const partModal = document.getElementById('participantsModal');
                    if (partModal) partModal.classList.remove('show');

                    showAlert(`You have left "${goal.name}".`, false);
                } catch (err) {
                    console.error("Error leaving shared goal:", err);
                    showAlert(getFriendlyMessage(err), true);
                }
            }
        );
    } catch (err) {
        console.error("Error in leaveSharedGoal:", err);
        showAlert(getFriendlyMessage(err), true);
    }
};

window.toggleTopupLabel = () => {
    const action = document.getElementById('topupActionType').value;
    const lbl = document.getElementById('lblTopupAccount');
    const btn = document.getElementById('btnTopupAction');
    const modalTitle = document.getElementById('topupModalTitle');
    
    if (action === 'deposit') {
        if (modalTitle) modalTitle.innerText = (window.PocketlyI18n && window.PocketlyI18n.t('topup_deposit_title')) || "Deposit to Savings Goal";
        if (lbl) lbl.innerText = (window.PocketlyI18n && window.PocketlyI18n.t('topup_account_label')) || "Source Account (Deduct from)";
        if (btn) {
            const btnText = (window.PocketlyI18n && window.PocketlyI18n.t('btn_deposit_to_goal')) || "Deposit to Goal";
            btn.innerHTML = `<i class="fa-solid fa-arrow-down"></i> ${btnText}`;
            btn.className = "btn-primary full-width";
        }
    } else {
        if (modalTitle) modalTitle.innerText = (window.PocketlyI18n && window.PocketlyI18n.t('topup_withdraw_title')) || "Withdraw from Savings Goal";
        if (lbl) lbl.innerText = (window.PocketlyI18n && window.PocketlyI18n.t('topup_dest_account_label')) || "Destination Account (Deposit to)";
        if (btn) {
            const btnText = (window.PocketlyI18n && window.PocketlyI18n.t('btn_withdraw_funds')) || "Withdraw Funds";
            btn.innerHTML = `<i class="fa-solid fa-arrow-up-from-bracket"></i> ${btnText}`;
            btn.className = "btn-warning full-width";
        }
    }
};
document.getElementById('topupBudgetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('topupBudgetId').value;
    const action = document.getElementById('topupActionType').value; 
    const rawAmount = Number(document.getElementById('topupAmount').value);
    const amount = convertToIdrFromBase(rawAmount);
    const accId = document.getElementById('topupAccount').value;
    const type = document.getElementById('topupType').value;

    if (isNaN(rawAmount) || rawAmount <= 0 || amount <= 0) {
        showAlert("Amount must be greater than 0.", true);
        return;
    }

    const btn = document.getElementById('btnTopupAction');
    const originalText = btn.innerText;
    btn.innerText = "Processing...";
    btn.disabled = true;

    try {
        const batch = writeBatch(db);
        const budgetRef = doc(db, "budgets", id);
        
        const budgetSnap = await getDoc(budgetRef);
        const budgetData = budgetSnap.data();
        
        const accRef = doc(db, "accounts", accId);
        const accSnap = await getDoc(accRef);
        if (!accSnap.exists()) throw new Error("Account not found.");
        
        const currentBalance = Number(accSnap.data().balance);
        const userContribution = (budgetData.contributions && budgetData.contributions[currentUser.uid]) || 0;

        if (action === 'deposit') {
            // --- DEPOSIT LOGIC ---
            if (currentBalance < amount) throw new Error("Insufficient funds in source account.");

            batch.update(accRef, { balance: currentBalance - amount });
            
            batch.update(budgetRef, { 
                current: increment(amount),
                [`contributions.${currentUser.uid}`]: increment(amount)
            });

            const transRef = doc(collection(db, "transactions"));
            batch.set(transRef, { 
                uid: currentUser.uid, 
                type: 'transfer', 
                amount: amount, 
                desc: `Deposit to Goal: ${budgetData.name}`, 
                date: new Date().toISOString().split('T')[0], 
                accountId: accId, 
                category: 'Financial Goal',
                budgetId: id
            });

            if (window.PocketlyAudio && typeof window.PocketlyAudio.playGoalCelebration === 'function') {
                window.PocketlyAudio.playGoalCelebration();
            }
            showAlert(`Successfully deposited ${formatRupiah(amount)} to goal!`, false);

        } else {
            // --- WITHDRAW LOGIC ---
            if (budgetData.visibility === 'shared') {
                if (userContribution <= 0) {
                    throw new Error("You do not have any contributed balance in this shared goal to withdraw.");
                }
                if (amount > userContribution) {
                    throw new Error(`You cannot withdraw other members' funds. Your contribution limit is ${formatRupiah(userContribution)}.`);
                }
            } else {
                if (Number(budgetData.current || 0) < amount) {
                    throw new Error(`Withdrawal amount exceeds goal balance (${formatRupiah(budgetData.current || 0)}).`);
                }
            }

            batch.update(accRef, { balance: currentBalance + amount });
            
            batch.update(budgetRef, { 
                current: increment(-amount),
                [`contributions.${currentUser.uid}`]: increment(-amount)
            });

            const transRef = doc(collection(db, "transactions"));
            batch.set(transRef, { 
                uid: currentUser.uid, type: 'income', amount: amount, 
                desc: `Withdraw from Goal: ${budgetData.name}`, 
                date: new Date().toISOString().split('T')[0], 
                accountId: accId, category: 'Financial Goal' 
            });
            showAlert(`Successfully withdrew ${formatRupiah(amount)} to your account!`, false);
        }

        await batch.commit();
        document.getElementById('topupBudgetModal').classList.remove('show');
        e.target.reset();

    } catch(err) {
        console.error(err);
        showAlert(getFriendlyMessage(err), true);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
});

document.getElementById('accountForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editAccId').value;
    const nameInput = document.getElementById('accName').value.trim();
    
    const btn = document.getElementById('btnSaveAcc');
    const originalText = btn.innerText;
    btn.innerText = "Processing...";
    btn.disabled = true;

    try {
        if (id) {
            // --- LOGIC EDIT ACCOUNT ---

            // 1. Validasi Duplikat
            const duplicateAccount = accounts.find(a => 
                a.name.toLowerCase() === nameInput.toLowerCase() && 
                a.id !== id 
            );

            if (duplicateAccount) {
                throw new Error(`Account name "${nameInput}" already exists!`);
            }
            
            const accRef = doc(db, "accounts", id);
            
            // 2. Ambil nama lama
            const accSnap = await getDoc(accRef);
            if (!accSnap.exists()) throw new Error("Account not found");
            const oldName = accSnap.data().name;

            // 3. Update Nama Akun
            await updateDoc(accRef, {
                name: nameInput
            });

            // 4. Update Riwayat Transaksi (FIXED PERMISSION ERROR)
            if (oldName !== nameInput) {
                // PERBAIKAN DI SINI: Tambahkan where "uid" agar lolos security rules
                const qTrans = query(
                    collection(db, "transactions"), 
                    where("accountId", "==", id),
                    where("uid", "==", currentUser.uid) // <--- INI KUNCINYA
                );
                
                const transSnap = await getDocs(qTrans);
                
                const batch = writeBatch(db);
                let batchCount = 0;

                transSnap.docs.forEach((docSnap) => {
                    const tData = docSnap.data();
                    let currentDesc = tData.desc || "";

                    if (currentDesc.includes(oldName)) {
                        const newDesc = currentDesc.replace(oldName, nameInput);
                        batch.update(docSnap.ref, { desc: newDesc });
                        batchCount++;
                    }
                });

                if (batchCount > 0) {
                    await batch.commit();
                }
            }

            showAlert("Account updated successfully", false);

        } else {
            // --- LOGIC ADD ACCOUNT (Tidak berubah) ---
            const rawBalanceInput = Number(document.getElementById('accBalance').value);
            const balanceInput = convertToIdrFromBase(rawBalanceInput);
            const existingAcc = accounts.find(a => a.name.toLowerCase() === nameInput.toLowerCase());
            
            if (existingAcc) {
                const newTotalBalance = Number(existingAcc.balance) + balanceInput;
                await updateDoc(doc(db, "accounts", existingAcc.id), {
                    balance: newTotalBalance
                });
                
                if (balanceInput > 0) {
                    await addDoc(collection(db, "transactions"), {
                        uid: currentUser.uid,
                        type: 'income',
                        category: 'Adjustment',
                        amount: balanceInput,
                        desc: `Balance Adjustment: ${nameInput}`,
                        date: new Date().toISOString().split('T')[0],
                        accountId: existingAcc.id,
                        createdAt: new Date().toISOString()
                    });
                }
                showAlert(`Account '${existingAcc.name}' merged & transaction recorded.`, false);
                
            } else {
                const newAccRef = await addDoc(collection(db, "accounts"), {
                    uid: currentUser.uid,
                    name: nameInput,
                    balance: balanceInput,
                    createdAt: new Date().toISOString()
                });

                if (balanceInput > 0) {
                    await addDoc(collection(db, "transactions"), {
                        uid: currentUser.uid,
                        type: 'income',
                        category: 'Adjustment',
                        amount: balanceInput,
                        desc: `Initial Balance: ${nameInput}`,
                        date: new Date().toISOString().split('T')[0],
                        accountId: newAccRef.id,
                        createdAt: new Date().toISOString()
                    });
                }

                showAlert("New account created & initial balance recorded!", false);
            }
        }
        
        document.getElementById('accountModal').classList.remove('show');
        e.target.reset();
        
        if (isReturningToTransaction) {
            document.getElementById('transactionModal').classList.add('show');
            isReturningToTransaction = false;
        }
    } catch (err) {
        console.error(err);
        showAlert(err.message, true);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
});


function renderChart(inc, exp) {
    // Kita gunakan data inc/exp untuk membuat garis grafik simulasi
    // Karena DB tidak menyimpan histori saldo harian, kita buat "Dummy Visual" yang cantik
    const ctx = document.getElementById('balanceSparkline');
    if(!ctx) return;
    
    // Hapus instance lama jika ada (kita pakai variabel global incomeChart u/ menampung ini sekarang)
    if(incomeChart) incomeChart.destroy();

    // Data Simulasi agar grafik terlihat "naik turun" cantik
    const labels = ['D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'Yesterday', 'Today'];
    const totalNow = inc - exp; // Hanya estimasi kasar untuk visual
    const dataPoints = [
        totalNow * 0.85, 
        totalNow * 0.9, 
        totalNow * 0.88, 
        totalNow * 0.95, 
        totalNow * 0.92, 
        totalNow * 0.98, 
        totalNow
    ];

    incomeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                data: dataPoints,
                borderColor: 'rgba(255, 255, 255, 0.8)', // Garis Putih
                borderWidth: 2,
                backgroundColor: 'rgba(255, 255, 255, 0.1)', // Fill Putih Transparan
                fill: true,
                tension: 0.4, // Melengkung halus
                pointRadius: 0, // Hilangkan titik agar bersih
                pointHoverRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: {
                x: { display: false }, // Sembunyikan sumbu X
                y: { display: false }  // Sembunyikan sumbu Y
            },
            layout: { padding: 0 }
        }
    });
}

let currentActionAccount = null;

window.openAccountActions = function(event, id, name, balance, icon) {
    if (event) {
        event.stopPropagation();
    }
    currentActionAccount = { id, name, balance, icon };

    const modal = document.getElementById('accountActionSheet');
    if (!modal) return;

    const iconEl = document.getElementById('actionSheetIcon');
    const nameEl = document.getElementById('actionSheetName');
    const balEl = document.getElementById('actionSheetBalance');

    if (iconEl) iconEl.className = `fa-solid ${icon || 'fa-wallet'}`;
    if (nameEl) nameEl.textContent = name;
    if (balEl) balEl.textContent = formatRupiah(balance);

    modal.classList.add('show');
};

window.closeAccountActionSheet = function() {
    const modal = document.getElementById('accountActionSheet');
    if (modal) modal.classList.remove('show');
    currentActionAccount = null;
};

window.onActionSheetEdit = function() {
    if (!currentActionAccount) return;
    const { id, name, balance } = currentActionAccount;
    closeAccountActionSheet();
    openEditAccount(id, name, balance);
};

window.onActionSheetDelete = function() {
    if (!currentActionAccount) return;
    const { id } = currentActionAccount;
    closeAccountActionSheet();
    askDeleteAccount(id);
};

window.openEditAccount = (id, name, balance) => { 
    document.getElementById('accModalTitle').innerText = (window.PocketlyI18n && window.PocketlyI18n.t('btn_edit_account')) || "Edit Account"; 
    document.getElementById('btnSaveAcc').innerText = (window.PocketlyI18n && window.PocketlyI18n.t('btn_update_name')) || "Update Name"; // Ubah teks tombol biar jelas
    document.getElementById('editAccId').value = id; 
    document.getElementById('accName').value = name; 
    
    document.getElementById('balanceGroup').style.display = 'none'; // Sembunyikan input
    document.getElementById('accBalance').removeAttribute('required'); // Matikan validasi required

    document.getElementById('accountModal').classList.add('show'); 
    setTimeout(initCustomSelects, 100); 
};

window.openEditTrans = (id, desc, amount, date, type, accId, category) => {
    // 1. Cek Transfer (Belum support edit)
    if(type === 'transfer') { 
        showAlert("Editing Transfers is not supported yet. Please delete and recreate.", true); 
        return; 
    } 
    
    // 2. Setup Judul & Tombol
    document.getElementById('transModalTitle').innerText = (window.PocketlyI18n && window.PocketlyI18n.t('btn_edit_record')) || "Edit Record"; 
    document.getElementById('btnSaveTrans').innerText = (window.PocketlyI18n && window.PocketlyI18n.t('btn_update')) || "Update"; 
    document.getElementById('editTransId').value = id; 
    
    // 3. Set Nilai Input Form
    const inputDesc = document.getElementById('inputDesc');
    const inputAmount = document.getElementById('inputAmount');
    const inputDate = document.getElementById('inputDate');

    inputDesc.value = desc; 
    inputAmount.value = convertFromIdrToBase(amount); 
    inputDate.value = date; 
    
    // 4. Ambil Elemen Dropdown
    const typeSelect = document.getElementById('inputType');
    const catSelect = document.getElementById('inputCategory');
    const accSelect = document.getElementById('inputAccount');

    // Set Nilai Dropdown
    typeSelect.value = type; 
    accSelect.value = accId; 
    catSelect.value = category || ""; 
    
    // Simpan nilai asli untuk keperluan backend (Revert Saldo)
    document.getElementById('originalAmount').value = amount; 
    document.getElementById('originalType').value = type; 
    if (typeof updateFormCurrencyIndicators === 'function') updateFormCurrencyIndicators(); 

    // --- 5. LOGIKA PENGAMANAN (LOCKING) ---
    // Pastikan string 'Adjustment' sama persis dengan value di database kamu
    const isAdjustment = (category === 'Adjustment'); 

    if (isAdjustment) {
        // JIKA ADJUSTMENT: Kunci semua KECUALI Amount & Desc
        document.getElementById('transModalTitle').innerText = (window.PocketlyI18n && window.PocketlyI18n.t('btn_correct_balance')) || "Correct Initial Balance"; 
        
        typeSelect.disabled = true;      // Type terkunci
        catSelect.disabled = true;       // Category terkunci
        accSelect.disabled = true;       // Account terkunci
        inputDate.disabled = true;       // Date terkunci
        
        // Amount & Desc TETAP BISA DIEDIT (untuk perbaikan typo)
        inputAmount.disabled = false;
        inputDesc.disabled = false;

    } else {
        // JIKA TRANSAKSI BIASA
        document.getElementById('transModalTitle').innerText = "Edit Record";

        typeSelect.disabled = false;     // Boleh ganti Type
        catSelect.disabled = false;      // Boleh ganti Category
        inputDate.disabled = false;      // Boleh ganti Tanggal
        inputAmount.disabled = false;
        inputDesc.disabled = false;
        
        // Akun tetap kita kunci saat edit (sesuai request sebelumnya demi keamanan saldo)
        accSelect.disabled = true;       
    }

    // 6. Tampilkan Modal
    document.getElementById('transactionModal').classList.add('show'); 

    setTimeout(() => {
        if (typeof initCustomSelects === 'function') {
            initCustomSelects(); 
        }
    }, 100); 
};

window.askDeleteAccount = (id) => {
    showConfirm(
        "Delete Account?",  // Judul
        "This will permanently remove the account and revert all related transfer history. Are you sure?", // Pesan
        "Delete Account",   // Teks Tombol
        async () => {
            try {
                // ... (LOGIC DELETE AKUN TETAP SAMA SEPERTI SEBELUMNYA) ...
                const batch = writeBatch(db);
                
                // Revert Outgoing
                const qOwn = query(collection(db, "transactions"), where("accountId", "==", id), where("uid", "==", currentUser.uid));
                const snapOwn = await getDocs(qOwn);
                snapOwn.forEach(docSnap => {
                    const t = docSnap.data();
                    if (t.type === 'transfer' && t.targetAccountId) {
                        batch.update(doc(db, "accounts", t.targetAccountId), { balance: increment(-Number(t.amount)) });
                    }
                    batch.delete(docSnap.ref);
                });

                // Revert Incoming
                const qIncoming = query(collection(db, "transactions"), where("targetAccountId", "==", id), where("uid", "==", currentUser.uid));
                const snapIncoming = await getDocs(qIncoming);
                snapIncoming.forEach(docSnap => {
                    const t = docSnap.data();
                    if (t.accountId) {
                        batch.update(doc(db, "accounts", t.accountId), { balance: increment(Number(t.amount)) });
                    }
                    batch.delete(docSnap.ref);
                });

                // Hapus Akun
                batch.delete(doc(db, "accounts", id));
                await batch.commit();
                
                showAlert("Account deleted successfully.", false);
            } catch (err) {
                console.error(err);
                showAlert("Failed to delete: " + err.message, true);
            }
        }
    );
};

const transFilterBtn = document.getElementById('transFilterToggleBtn'); 
const transFilterPopup = document.getElementById('transFilterPopup'); 
const closeTransFilterBtn = document.getElementById('closeTransFilterBtn'); 
const resetTransFilterBtn = document.getElementById('resetTransFilter');

// Fungsi Helper Scroll (Hanya Kunci Scroll di HP)
function lockScroll(isLocked) {
    if (window.innerWidth <= 768) { 
        document.body.style.overflow = isLocked ? 'hidden' : ''; 
        document.body.style.touchAction = isLocked ? 'none' : ''; 
    }
}

// FUNGSI BARU: Hitung Posisi Popup di Desktop
function positionPopupDesktop() {
    if (window.innerWidth > 768 && transFilterBtn && transFilterPopup) {
        const rect = transFilterBtn.getBoundingClientRect(); // Ambil koordinat tombol
        
        // Atur posisi popup tepat di bawah tombol
        transFilterPopup.style.position = 'fixed';
        transFilterPopup.style.top = `${rect.bottom + 10}px`; 
        transFilterPopup.style.left = `${rect.right - 300}px`; // Geser ke kiri agar rata kanan dengan tombol (asumsi lebar popup 300px)
        transFilterPopup.style.transform = 'none'; // Matikan centering mobile
        transFilterPopup.style.margin = '0';
    } else {
        // Reset style inline jika pindah ke mobile (agar CSS mobile yang menang)
        transFilterPopup.style.position = '';
        transFilterPopup.style.top = '';
        transFilterPopup.style.left = '';
        transFilterPopup.style.transform = '';
        transFilterPopup.style.margin = '';
    }
}

if (transFilterBtn) { 
    transFilterBtn.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        
        // 1. TUTUP EXPORT (Wajib)
        const exportDrop = document.getElementById('exportDropdown');
        if (exportDrop) exportDrop.classList.remove('show');

        // 2. TUTUP MODAL ADD (Jika terbuka)
        const transModal = document.getElementById('transactionModal');
        if (transModal) transModal.classList.remove('show');
        
        // 3. Logika Buka/Tutup Filter (Kode Lama + Posisining)
        if (!transFilterPopup.classList.contains('show')) {
            if(typeof positionPopupDesktop === 'function') positionPopupDesktop(); 
            transFilterPopup.classList.add('show');
            transFilterBtn.classList.add('active');
            if(typeof lockScroll === 'function') lockScroll(true); 
        } else {
            transFilterPopup.classList.remove('show');
            transFilterBtn.classList.remove('active');
            if(typeof lockScroll === 'function') lockScroll(false); 
        }
    });

    // Update posisi jika layar di-resize (agar popup tidak lari saat window digeser)
    window.addEventListener('resize', () => {
        if (transFilterPopup.classList.contains('show')) {
            positionPopupDesktop();
        }
    });

    // 2. TOMBOL CLOSE (X)
    if (closeTransFilterBtn) { 
        closeTransFilterBtn.addEventListener('click', () => { 
            transFilterPopup.classList.remove('show'); 
            transFilterBtn.classList.remove('active');
            lockScroll(false); 
        }); 
    } 
    
    // 3. TOMBOL RESET
    if (resetTransFilterBtn) { 
        resetTransFilterBtn.addEventListener('click', () => { 
            // Reset nilai filter
            document.getElementById('transSort').value = 'newest'; 
            document.getElementById('transFilterType').value = 'all'; 
            document.getElementById('transFilterAccount').value = 'all'; 
            document.getElementById('transFilterCategory').value = 'all'; 
            
            setTimeout(initCustomSelects, 50);
            updateDashboard(); 
        }); 
    } 
    
    // 4. KLIK DI LUAR POPUP (TUTUP)
    window.addEventListener('click', (e) => { 
        if (transFilterPopup && transFilterPopup.classList.contains('show') && 
            !transFilterPopup.contains(e.target) && !transFilterBtn.contains(e.target)) { 
            
            transFilterPopup.classList.remove('show'); 
            transFilterBtn.classList.remove('active');
            lockScroll(false); 
        } 
    }); 
}

function initReportFilters() { 
    const rptAccSelect = document.getElementById('reportAccount'); 
    if (!rptAccSelect) return; 
    const allAccountsText = (window.PocketlyI18n && typeof window.PocketlyI18n.t === 'function')
        ? window.PocketlyI18n.t('filter_all_accounts', 'All Accounts')
        : 'All Accounts';
    rptAccSelect.innerHTML = `<option value="All">${allAccountsText}</option>`; 
    accounts.forEach(acc => { 
        const opt = document.createElement('option'); 
        opt.value = acc.id; 
        opt.innerText = acc.name; 
        rptAccSelect.appendChild(opt); 
    }); 
    if (typeof initCustomSelects === 'function') initCustomSelects(); 
    if (typeof rptAccSelect.__syncSearchable === 'function') rptAccSelect.__syncSearchable();
}
function updateReportsPage() { const periodEl = document.getElementById('reportPeriod'); const accountIdEl = document.getElementById('reportAccount'); if (!periodEl || !accountIdEl) return; const period = periodEl.value; const accountId = accountIdEl.value; let filtered = filterTransactionsByPeriod(rawTransactions, period); if (accountId !== 'All') filtered = filtered.filter(t => t.accountId === accountId); calculateReportSummary(filtered); renderCashFlowChart(filtered); renderSpendingBreakdown(filtered); renderTopSpending(filtered); }
function filterTransactionsByPeriod(data, period) { const now = new Date(); now.setHours(23, 59, 59, 999); let startDate = new Date(); startDate.setHours(0, 0, 0, 0); if (period === 'this_month') { startDate.setDate(1); } else if (period === 'last_month') { startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1); const endDate = new Date(now.getFullYear(), now.getMonth(), 0); endDate.setHours(23, 59, 59, 999); return data.filter(t => { const d = new Date(t.date + "T00:00:00"); return d >= startDate && d <= endDate; }); } else if (period === 'last_3_months') { startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1); } else if (period === 'this_year') { startDate = new Date(now.getFullYear(), 0, 1); } return data.filter(t => { const d = new Date(t.date + "T00:00:00"); return d >= startDate && d <= now; }); }
function calculateReportSummary(data) {
    let income = 0;
    let expense = 0;
    
    data.forEach(t => {
        if (t.category === 'Adjustment') return; 
        if (t.type === 'income') income += Number(t.amount);
        if (t.type === 'expense') expense += Number(t.amount);
    });

    const netSavings = income - expense;
    let savingsRate = 0;
    if (income > 0) savingsRate = ((netSavings / income) * 100);
    
    // Clamp value
    if (savingsRate < 0) savingsRate = 0;
    if (savingsRate > 100) savingsRate = 100;

    // Update Angka
    document.getElementById('rptTotalIncome').innerText = formatRupiah(income);
    document.getElementById('rptTotalExpense').innerText = formatRupiah(expense);
    document.getElementById('rptNetSavings').innerText = formatRupiah(netSavings);
    
    // Update Teks Persentase Saja (Hapus update circle)
    document.getElementById('rptSavingsRateText').innerText = savingsRate.toFixed(1) + "%";
}
function renderCashFlowChart(data) {
    const ctx = document.getElementById('cashFlowChart');
    if(!ctx) return;

    const tFunc = (window.PocketlyI18n && typeof window.PocketlyI18n.t === 'function')
        ? window.PocketlyI18n.t
        : (k, fb) => fb;

    const dailyData = {};
    data.forEach(t => {
        if (t.category === 'Adjustment') return; 
        const d = t.date;
        if (!dailyData[d]) dailyData[d] = { income: 0, expense: 0 };
        if (t.type === 'income') dailyData[d].income += Number(t.amount);
        if (t.type === 'expense') dailyData[d].expense += Number(t.amount);
    });

    const sortedDates = Object.keys(dailyData).sort();
    const incomes = sortedDates.map(d => dailyData[d].income);
    const expenses = sortedDates.map(d => dailyData[d].expense);
    const labels = sortedDates.map(d => {
        const dateObj = new Date(d);
        return `${dateObj.getDate()}/${dateObj.getMonth()+1}`;
    });

    if (cashFlowChartInstance) cashFlowChartInstance.destroy();
    
    // --- BUAT GRADIENT (Canvas Context) ---
    const context = ctx.getContext('2d');
    
    // Gradient Hijau (Income)
    const gradientInc = context.createLinearGradient(0, 0, 0, 400);
    gradientInc.addColorStop(0, 'rgba(16, 185, 129, 0.4)'); // Atas
    gradientInc.addColorStop(1, 'rgba(16, 185, 129, 0.0)'); // Bawah

    // Gradient Merah (Expense)
    const gradientExp = context.createLinearGradient(0, 0, 0, 400);
    gradientExp.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
    gradientExp.addColorStop(1, 'rgba(239, 68, 68, 0.0)');

    cashFlowChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: tFunc('chart_income', 'Income'),
                    data: incomes,
                    borderColor: '#10b981',
                    backgroundColor: gradientInc, // Pakai Gradient
                    tension: 0.4, // KURVA HALUS (Smooth Spline)
                    fill: true,   // Area Chart
                    pointRadius: 2,
                    pointHoverRadius: 5,
                    borderWidth: 2
                },
                {
                    label: tFunc('chart_expense', 'Expense'),
                    data: expenses,
                    borderColor: '#ef4444',
                    backgroundColor: gradientExp, // Pakai Gradient
                    tension: 0.4, // KURVA HALUS
                    fill: true,   // Area Chart
                    pointRadius: 2,
                    pointHoverRadius: 5,
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { 
                    position: 'top', 
                    align: 'end',
                    labels: { usePointStyle: true, boxWidth: 8, font: { size: 10 } } 
                },
                tooltip: {
                    backgroundColor: 'rgba(30, 41, 59, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1
                }
            },
            scales: {
                x: { 
                    grid: { display: false }, // HILANGKAN GRID VERTIKAL
                    ticks: { maxTicksLimit: 7, color: '#94a3b8', font: { size: 10 } }
                },
                y: { 
                    beginAtZero: true,
                    grid: { 
                        color: 'rgba(200, 200, 200, 0.05)', // Grid horizontal tipis sekali
                        drawBorder: false 
                    },
                    ticks: { display: false } // Sembunyikan angka Y axis agar lebih bersih
                }
            }
        }
    });
}
function legacyRenderSpendingBreakdown(data) {
    const ctx = document.getElementById('spendingBreakdownChart');
    if(!ctx) return;

    const catData = {};
    
    // 1. Filter Data (Hanya Expense & Bukan Adjustment)
    data.filter(t => t.type === 'expense' && t.category !== 'Adjustment').forEach(t => {
        if (!catData[t.category]) catData[t.category] = 0;
        catData[t.category] += Number(t.amount);
    });

    // 2. Sorting & Grouping "Others"
    let labels = [];
    let values = [];
    let otherValue = 0;
    
    const sortedCats = Object.entries(catData).sort((a, b) => b[1] - a[1]);
    
    // (Kode Logic Update Center Label DIHAPUS disini)

    sortedCats.forEach(([cat, val], index) => {
        // Ambil 4 kategori teratas, sisanya masuk Others
        if (index < 4) {
            labels.push(cat);
            values.push(val);
        } else {
            otherValue += val;
        }
    });

    if (otherValue > 0) {
        labels.push("Others");
        values.push(otherValue);
    }

    if (spendingChartInstance) spendingChartInstance.destroy();

    // 3. Render Chart Kosong jika tidak ada data
    if (values.length === 0) {
        spendingChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: [], datasets: [{ data: [1], backgroundColor: ['rgba(200,200,200,0.1)'], borderWidth: 0 }] },
            options: { cutout: '70%', events: [] }
        });
        return;
    }

    // 4. Render Chart Utama
    spendingChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'
                ],
                borderWidth: 2,
                borderColor: localStorage.getItem('theme') === 'dark' ? '#1f2937' : '#ffffff',
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%', 
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { 
                        boxWidth: 10, 
                        usePointStyle: true, 
                        font: { size: 10 },
                        padding: 15
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            let value = context.raw || 0;
                            
                            // PERUBAHAN DISINI:
                            // Menampilkan Format Rupiah (Nominal), bukan Persen
                            return `${label}: ${formatRupiah(value)}`;
                        }
                    },
                    backgroundColor: 'rgba(30, 41, 59, 0.9)',
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: true
                }
            }
        }
    });
}
/* --- RENDER TOP 5 SPENDING (DESKTOP VS MOBILE LAYOUT) --- */
function legacyRenderTopSpending(data) { 
    const listContainer = document.getElementById('topSpendingList'); 
    if(!listContainer) return; 
    
    listContainer.innerHTML = ''; 
    const tFunc = (window.PocketlyI18n && typeof window.PocketlyI18n.t === 'function')
        ? window.PocketlyI18n.t
        : (k, fb) => fb;
    
    // Ambil Top 5 Expense
    const top5 = data.filter(t => t.type === 'expense')
                     .sort((a, b) => b.amount - a.amount)
                     .slice(0, 5); 
    
    if (top5.length === 0) { 
        listContainer.innerHTML = `
            <div style="text-align:center; padding:40px; color:var(--text-grey);">
                <i class="fa-solid fa-money-bill-wave" style="font-size:2rem; margin-bottom:10px; opacity:0.3;"></i>
                <p>${tFunc('no_expenses_found', 'No expenses found.')}</p>
            </div>`; 
        return; 
    } 
    
    top5.forEach(t => { 
        const iconClass = CATEGORY_ICONS[t.category] || "fa-bag-shopping";
        const safeDesc = (t.desc || "").replace(/'/g, "\\'");
        
        listContainer.innerHTML += `
        <div class="spending-item" onclick="jumpToTransaction('${safeDesc}')" title="View Details">
            
            <div class="spi-icon">
                <i class="fa-solid ${iconClass}"></i>
            </div>
            
            <div class="spi-info-wrapper">
                
                <div class="spi-text-desktop">
                    <div class="spi-row-primary">${t.desc || "No description"}</div>
                    <div class="spi-row-secondary">
                        ${t.category} • ${formatDateIndo(t.date)}
                    </div>
                </div>

                <div class="spi-text-mobile">
                    <div class="spi-row-primary">${t.category}</div>
                    <div class="spi-row-secondary">${t.desc || "No description"}</div>
                </div>

            </div>

            <div class="spi-amount-right">
                ${formatRupiah(t.amount)}
            </div>

        </div>`; 
    }); 
}
function updatePaginationControls(totalItems, totalPages) {
    const controls = document.getElementById('paginationControls');
    const btnPrev = document.getElementById('btnPrevPage');
    const btnNext = document.getElementById('btnNextPage');
    const info = document.getElementById('pageInfo');
    const pagesContainer = document.getElementById('paginationPagesList');
    if (!controls) return;

    if (!totalItems || totalItems <= ITEMS_PER_PAGE || totalPages <= 1) {
        controls.style.display = 'none';
        return;
    }

    controls.style.display = 'flex';

    if (btnPrev) {
        btnPrev.disabled = (currentPage <= 1);
        btnPrev.setAttribute('aria-disabled', currentPage <= 1 ? 'true' : 'false');
    }
    if (btnNext) {
        btnNext.disabled = (currentPage >= totalPages);
        btnNext.setAttribute('aria-disabled', currentPage >= totalPages ? 'true' : 'false');
    }

    if (info) {
        const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
        const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);
        info.innerHTML = `Showing <strong>${startItem}–${endItem}</strong> of <strong>${totalItems}</strong> • Page <strong>${currentPage}</strong> of <strong>${totalPages}</strong>`;
    }

    if (pagesContainer) {
        let pagesHtml = '';
        const pages = generatePaginationRange(currentPage, totalPages);
        pages.forEach(p => {
            if (p === '...') {
                pagesHtml += `<span class="pagination-ellipsis" aria-hidden="true">&hellip;</span>`;
            } else {
                const isActive = (p === currentPage);
                pagesHtml += `<button type="button" class="pagination-page-btn ${isActive ? 'active' : ''}" onclick="goToPage(${p})" aria-label="Page ${p}" ${isActive ? 'aria-current="page"' : ''}>${p}</button>`;
            }
        });
        pagesContainer.innerHTML = pagesHtml;
    }
}

function generatePaginationRange(current, total) {
    if (total <= 5) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current <= 3) {
        return [1, 2, 3, 4, '...', total];
    }
    if (current >= total - 2) {
        return [1, '...', total - 3, total - 2, total - 1, total];
    }
    return [1, '...', current - 1, current, current + 1, '...', total];
}

function triggerTransactionListAnimation() {
    const listContainer = document.getElementById('transactionListContainer');
    if (!listContainer) return;
    listContainer.classList.remove('trans-list-animating');
    // Force DOM reflow to re-trigger CSS keyframe animation
    void listContainer.offsetWidth;
    listContainer.classList.add('trans-list-animating');
}

window.goToPage = function(targetPage) {
    if (targetPage < 1 || targetPage === currentPage) return;
    currentPage = targetPage;
    triggerTransactionListAnimation();
    updateDashboard();
    const tableSection = document.getElementById('transactions');
    if (tableSection) {
        tableSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

window.changePage = function(direction) {
    const newPage = currentPage + direction;
    if (newPage < 1) return;
    currentPage = newPage;
    triggerTransactionListAnimation();
    updateDashboard();
    const tableSection = document.getElementById('transactions');
    if (tableSection) {
        tableSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

window.askDeleteTrans = (id) => {
    showConfirm(
        "Remove Transaction?", // Judul Beda
        "Removing this record will revert the balance on your account. Do you want to proceed?", // Pesan Beda
        "Yes, Remove",         // Tombol Beda
        async () => {
            try {
                // ... (LOGIC DELETE TRANSAKSI TETAP SAMA) ...
                const transRef = doc(db, "transactions", id);
                const transSnap = await getDoc(transRef);

                if (!transSnap.exists()) { showAlert("Transaction already deleted.", true); return; }

                const t = transSnap.data();
                const amount = Number(t.amount);

                if (t.accountId) {
                    const accRef = doc(db, "accounts", t.accountId);
                    const accSnap = await getDoc(accRef);
                    if (accSnap.exists()) {
                        let newBal = Number(accSnap.data().balance);
                        if (t.type === 'income') newBal -= amount;
                        else newBal += amount; // Expense & Transfer (Source) balik
                        await updateDoc(accRef, { balance: newBal });
                    }
                }

                if (t.type === 'transfer' && t.targetAccountId) {
                    const targetRef = doc(db, "accounts", t.targetAccountId);
                    const targetSnap = await getDoc(targetRef);
                    if (targetSnap.exists()) {
                        await updateDoc(targetRef, { balance: Number(targetSnap.data().balance) - amount });
                    }
                }

                await deleteDoc(transRef);
                showAlert("Transaction removed and balance updated.", false);
            } catch (err) {
                console.error(err);
                showAlert("Failed to delete: " + err.message, true);
            }
        }
    );
};

window.openTransactionDetail = (id) => {
    const t = rawTransactions.find(x => x.id === id);
    if (!t) return;

    // 1. Setup Variabel Dasar
    const accName = accounts.find(a => a.id === t.accountId)?.name || 'Unknown';
    let iconClass = CATEGORY_ICONS[t.category] || "fa-bag-shopping";
    let iconBg = "#f1f5f9"; 
    let iconColor = "#64748b";
    let typeLabel = "Expense";
    let sign = "-";
    let amountColor = "var(--red)";

    // 2. Setup Elemen HTML
    const targetRow = document.getElementById('detailTargetRow');
    const targetSpan = document.getElementById('detailTargetAccount');
    const labelAccount = document.getElementById('labelDetailAccount');
    
    // Ambil elemen label "To Account" untuk diubah dinamis
    // (Pastikan kamu sudah menambahkan ID 'detailTargetRow' di HTML sesuai langkah sebelumnya)
    const targetLabelEl = targetRow ? targetRow.querySelector('span:first-child') : null;

    // Reset Tampilan Default
    if (targetRow) targetRow.style.display = 'none'; 
    if (labelAccount) labelAccount.innerText = "Account";
    if (targetLabelEl) targetLabelEl.innerText = "To Account"; // Reset label

    // 3. Logika Tipe Transaksi
    if (t.type === 'income') {
        iconBg = "rgba(16, 185, 129, 0.1)"; iconColor = "#10b981";
        typeLabel = "Income"; sign = "+"; amountColor = "var(--green)";
    } 
    else if (t.type === 'transfer') {
        iconBg = "rgba(59, 130, 246, 0.1)"; iconColor = "#3b82f6";
        iconClass = "fa-arrow-right-arrow-left";
        typeLabel = "Transfer"; sign = ""; amountColor = "var(--blue-accent)";
        
        let targetName = 'Unknown';
        
        // --- LOGIKA BARU: CEK APAKAH INI SAVING GOAL? ---
        if (t.category === 'Financial Goal') {
            // Ubah label "To Account" jadi "To Goal" agar lebih relevan
            if (targetLabelEl) targetLabelEl.innerText = "To Goal";
            
            // Coba ambil nama goal dari deskripsi (Format: "Deposit to Goal: iPhone 15")
            if (t.desc && t.desc.includes(':')) {
                const parts = t.desc.split(':');
                if (parts.length > 1) {
                    targetName = parts[1].trim(); // Ambil teks setelah titik dua
                }
            } else {
                // Jika format deskripsi beda (misal manual), tampilkan generic
                targetName = "Savings Goal";
            }
        } else {
            // Jika Transfer antar bank biasa
            targetName = accounts.find(a => a.id === t.targetAccountId)?.name || 'Unknown';
        }
        
        // Update UI
        if (labelAccount) labelAccount.innerText = "From Account";
        if (targetSpan) targetSpan.innerText = targetName;
        if (targetRow) targetRow.style.display = 'flex';
    }

    // 4. Isi Konten Modal (Sama seperti sebelumnya)
    const iconWrapper = document.getElementById('detailIconWrapper');
    if (iconWrapper) { iconWrapper.style.background = iconBg; iconWrapper.style.color = iconColor; }
    
    const detailIcon = document.getElementById('detailIcon');
    if (detailIcon) detailIcon.className = `fa-solid ${iconClass}`;
    
    const amountEl = document.getElementById('detailAmount');
    if (amountEl) { amountEl.innerText = `${sign} ${formatRupiah(t.amount)}`; amountEl.style.color = amountColor; }

    const badgeEl = document.getElementById('detailTypeBadge');
    if (badgeEl) { badgeEl.innerText = typeLabel; badgeEl.style.background = iconBg; badgeEl.style.color = iconColor; }

    document.getElementById('detailDesc').innerText = t.desc;
    document.getElementById('detailCategory').innerText = t.category || '-';
    document.getElementById('detailAccount').innerText = accName;
    document.getElementById('detailDate').innerText = formatDateIndo(t.date);

    // 5. Cek Status Locked (Sama seperti sebelumnya)
    const isSystemRefund = t.category === 'Adjustment' && (t.desc || "").toLowerCase().includes('refund');
    const isGoalTransaction = t.category === 'Financial Goal';
    const isDebtTransaction = t.category === 'Debt / Loan';
    const isLocked = isSystemRefund || isGoalTransaction || isDebtTransaction;

    const btnGroup = document.getElementById('detailActionButtons');
    const lockedMsg = document.getElementById('detailLockedMsg');

    if (isLocked) {
        if(btnGroup) btnGroup.style.display = 'none';
        if(lockedMsg) lockedMsg.style.display = 'block';
    } else {
        if(btnGroup) btnGroup.style.display = 'flex';
        if(lockedMsg) lockedMsg.style.display = 'none';
        const btnEdit = document.getElementById('btnDetailEdit');
        if (btnEdit) {
            const newBtnEdit = btnEdit.cloneNode(true);
            btnEdit.parentNode.replaceChild(newBtnEdit, btnEdit);
            newBtnEdit.addEventListener('click', () => {
                document.getElementById('transactionDetailModal').classList.remove('show');
                const safeDesc = t.desc.replace(/'/g, "\\'");
                const safeCat = t.category ? t.category.replace(/'/g, "\\'") : "";
                if (typeof window.openEditTrans === 'function') {
                    window.openEditTrans(t.id, safeDesc, t.amount, t.date, t.type, t.accountId, safeCat);
                }
            });
        }

        const btnDelete = document.getElementById('btnDetailDelete');
        if (btnDelete) {
            const newBtnDelete = btnDelete.cloneNode(true);
            btnDelete.parentNode.replaceChild(newBtnDelete, btnDelete);
            newBtnDelete.addEventListener('click', () => {
                document.getElementById('transactionDetailModal').classList.remove('show');
                if (typeof window.askDeleteTrans === 'function') {
                    setTimeout(() => { window.askDeleteTrans(t.id); }, 100);
                }
            });
        }
    }

    document.getElementById('transactionDetailModal').classList.add('show');
};

const detailCloseBtn = document.querySelector('.detail-close');
if(detailCloseBtn) {
    const newClose = detailCloseBtn.cloneNode(true);
    detailCloseBtn.parentNode.replaceChild(newClose, detailCloseBtn);
    
    newClose.onclick = () => {
        document.getElementById('transactionDetailModal').classList.remove('show');
    };
}

const btnOpenTransFix = document.getElementById('openTransModalBtn');
if (btnOpenTransFix) {
    const newBtn = btnOpenTransFix.cloneNode(true);
    btnOpenTransFix.parentNode.replaceChild(newBtn, btnOpenTransFix);

    newBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const filterPopup = document.getElementById('transFilterPopup');
        if (filterPopup) filterPopup.classList.remove('show');
        const exportDrop = document.getElementById('exportDropdown');
        if (exportDrop) exportDrop.classList.remove('show');
        document.getElementById('transModalTitle').innerText = (window.PocketlyI18n && window.PocketlyI18n.t('btn_add_record')) || "Add Record";
        document.getElementById('btnSaveTrans').innerText = (window.PocketlyI18n && window.PocketlyI18n.t('btn_save')) || "Save";
        document.getElementById('editTransId').value = "";
        document.getElementById('originalAmount').value = "";
        document.getElementById('transactionForm').reset();
        document.getElementById('inputType').disabled = false;      
        document.getElementById('inputCategory').disabled = false;  
        document.getElementById('inputAccount').disabled = false;   
        document.getElementById('inputDate').disabled = false;      
        document.getElementById('inputAmount').disabled = false;
        document.getElementById('inputDesc').disabled = false;
        if (typeof updateFormCurrencyIndicators === 'function') updateFormCurrencyIndicators();
        document.getElementById('transactionModal').classList.add('show');
        setTimeout(initCustomSelects, 100);
    });
}

const btnOpenAccFix = document.getElementById('openAccountModalBtn');
if(btnOpenAccFix) {
    const newBtnAcc = btnOpenAccFix.cloneNode(true);
    btnOpenAccFix.parentNode.replaceChild(newBtnAcc, btnOpenAccFix);
    newBtnAcc.addEventListener('click', () => {
        document.getElementById('accModalTitle').innerText = (window.PocketlyI18n && window.PocketlyI18n.t('acc_modal_title')) || "Add Account";
        document.getElementById('btnSaveAcc').innerText = (window.PocketlyI18n && window.PocketlyI18n.t('btn_create')) || "Create";
        document.getElementById('editAccId').value = "";
        document.getElementById('accountForm').reset();
        document.getElementById('balanceGroup').style.display = 'block'; 
        document.getElementById('accBalance').setAttribute('required', 'true'); // Nyalakan validasi
        if (typeof updateFormCurrencyIndicators === 'function') updateFormCurrencyIndicators();
        const modal = document.getElementById('accountModal');
        if(modal) modal.classList.add('show');
    });
}

document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const modal = this.closest('.modal');
        if(modal) modal.classList.remove('show');
    });
});

window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('show');
    }
});

window.toggleCardMenu = function(event, rawId) {
    if (event) event.stopPropagation();
    const targetMenuId = `menu-${rawId}`;
    const menu = document.getElementById(targetMenuId);
    document.querySelectorAll('.card-menu-dropdown').forEach(el => {
        if (el.id !== targetMenuId) el.classList.remove('show');
    });
    if (menu) {
        menu.classList.toggle('show');
    } else {
        console.error("Menu tidak ditemukan untuk ID:", targetMenuId);
    }
};

window.addEventListener('click', () => {
    document.querySelectorAll('.card-menu-dropdown').forEach(el => el.classList.remove('show'));
});

window.addEventListener('click', () => {
    document.querySelectorAll('.card-menu-dropdown').forEach(el => el.classList.remove('show'));
    document.querySelectorAll('.retro-account-card').forEach(el => el.classList.remove('z-active'));
});

window.askDeleteBudget = async (id) => {
    try {
        const docRef = doc(db, "budgets", id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) { showAlert("Savings goal or plan not found.", true); return; }
        const data = docSnap.data();

        // 1. Cek kepemilikan (Hanya pembuat/owner yang berhak menghapus Goals)
        const isOwner = !data.uid || data.uid === currentUser.uid;
        if (!isOwner) {
            if (data.visibility === 'shared') {
                showConfirm(
                    "Leave Shared Goal?",
                    `Only the creator can delete this goal. Would you like to leave "${data.name}" instead?`,
                    "Leave Goal",
                    () => {
                        window.leaveSharedGoal(id);
                    }
                );
                return;
            }
            showAlert("Only the owner (creator) can delete this shared goal. You cannot delete a goal created by another member.", true);
            return;
        }

        // 2. Jika ada saldo tersimpan pada Goals
        if (data.type === 'goal' && Number(data.current || 0) > 0) {
            // Jika ini tabungan bersama (shared) dan masih ada saldo kontribusi dari anggota lain
            if (data.visibility === 'shared' && data.contributions) {
                const otherContribs = Object.entries(data.contributions).filter(([uid, amt]) => uid !== currentUser.uid && Number(amt) > 0);
                if (otherContribs.length > 0) {
                    showAlert("This shared goal still holds funds contributed by other members. All members must withdraw their contributions before this goal can be deleted.", true);
                    return;
                }
            }

            document.getElementById('refundBudgetId').value = id;
            document.getElementById('refundAmountValue').value = data.current;
            document.getElementById('refundGoalName').value = data.name;
            document.getElementById('refundAmountDisplay').innerText = formatRupiah(data.current);
            const refundSelect = document.getElementById('refundAccountSelect');
            refundSelect.innerHTML = '<option value="" disabled selected>Select Destination Account</option>';
            accounts.forEach(acc => {
                const opt = document.createElement('option');
                opt.value = acc.id;
                opt.innerText = `${acc.name} (${formatRupiah(acc.balance)})`;
                refundSelect.appendChild(opt);
            });
            document.getElementById('refundModal').classList.add('show');
            setTimeout(initCustomSelects, 100); 
        } 
        else {
            showConfirm(
                "Delete Plan?", 
                `Are you sure you want to stop tracking '${data.name}'? This action is permanent.`, 
                "Delete Plan",  
                async () => {
                    await deleteDoc(docRef);
                    showAlert("Plan deleted successfully.", false);
                }
            );
        }
    } 
    catch (err) {
        console.error(err);
        showAlert(getFriendlyMessage(err), true);
    }
};

const refundForm = document.getElementById('refundForm');
if (refundForm) {
    refundForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const budgetId = document.getElementById('refundBudgetId').value;
        const amount = Number(document.getElementById('refundAmountValue').value);
        const goalName = document.getElementById('refundGoalName').value;
        const targetAccId = document.getElementById('refundAccountSelect').value;
        if (!targetAccId) {
            showAlert("Please select an account to receive the refunded balance.", true);
            return;
        }
        const btn = e.target.querySelector('button[type="submit"]');
        if(btn) { btn.innerText = "Processing..."; btn.disabled = true; }
        try {
            const batch = writeBatch(db);
            const accRef = doc(db, "accounts", targetAccId);
            batch.update(accRef, { balance: increment(amount) });
            const transRef = doc(collection(db, "transactions"));
            batch.set(transRef, {
                uid: currentUser.uid,
                type: 'income', 
                category: 'Adjustment', 
                amount: amount,
                desc: `Refund from deleted goal: ${goalName}`,
                date: new Date().toISOString().split('T')[0],
                accountId: targetAccId,
                createdAt: new Date().toISOString()
            });
            const budgetRef = doc(db, "budgets", budgetId);
            batch.delete(budgetRef);
            await batch.commit();
            document.getElementById('refundModal').classList.remove('show');
            showAlert(`Goal deleted successfully. ${formatRupiah(amount)} has been refunded to your account.`, false);
        } catch (err) {
            console.error(err);
            showAlert(getFriendlyMessage(err), true);
        } finally {
            if(btn) { btn.innerText = "Refund Funds & Delete Goal"; btn.disabled = false; }
        }
    });
}

const refundClose = document.querySelector('.refund-close');
if(refundClose) {
    refundClose.onclick = () => document.getElementById('refundModal').classList.remove('show');
}

window.openGoalInvitesModal = () => {
    const modal = document.getElementById('goalInvitesModal');
    if (modal) {
        modal.classList.add('show');
        const list = document.getElementById('modalGoalInviteList');
        if(list) list.scrollTop = 0;
    } else {
        console.error("Modal ID 'goalInvitesModal' not found!");
    }
};

const inviteCloseBtn = document.querySelector('.gi-close');
if (inviteCloseBtn) {
    inviteCloseBtn.onclick = () => {
        document.getElementById('goalInvitesModal').classList.remove('show');
    };
}

window.jumpToTransaction = (desc) => {
    switchPage('transactions');
    const searchInput = document.getElementById('searchTransaction');
    if(searchInput) {
        searchInput.value = desc; 
        const event = new Event('input', {
            bubbles: true,
            cancelable: true,
        });
        searchInput.dispatchEvent(event);
    }
};

const togglePassBtn = document.getElementById('toggleLoginPass');
if(togglePassBtn) {
    const newToggle = togglePassBtn.cloneNode(true);
    togglePassBtn.parentNode.replaceChild(newToggle, togglePassBtn);
    newToggle.addEventListener('click', function() {
        const input = this.parentElement.querySelector('input');
        if (input.type === "password") {
            input.type = "text"; 
            this.classList.remove('fa-eye');
            this.classList.add('fa-eye-slash');
        } else {
            input.type = "password"; 
            this.classList.remove('fa-eye-slash');
            this.classList.add('fa-eye');
        }
    });
}

const toggleConfirmPassBtn = document.getElementById('toggleConfirmPass');
if(toggleConfirmPassBtn) {
    const newToggle = toggleConfirmPassBtn.cloneNode(true);
    toggleConfirmPassBtn.parentNode.replaceChild(newToggle, toggleConfirmPassBtn);
    newToggle.addEventListener('click', function() {
        const input = this.parentElement.querySelector('input');
        if (input.type === "password") {
            input.type = "text"; 
            this.classList.remove('fa-eye');
            this.classList.add('fa-eye-slash');
        } else {
            input.type = "password"; 
            this.classList.remove('fa-eye-slash');
            this.classList.add('fa-eye');
        }
    });
}

const forgotLink = document.getElementById('forgotPasswordLink');
if (forgotLink) {
    const newForgotLink = forgotLink.cloneNode(true);
    forgotLink.parentNode.replaceChild(newForgotLink, forgotLink);
    newForgotLink.addEventListener('click', async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('email').value.trim();
        
        const lang = currentLocale === 'id-ID' ? 'id-ID' : 'en-US';
        const t = authTranslations[lang] || authTranslations['id-ID'];

        if (!emailInput) {
            showAlert(t.errEmailReq, true);
            document.getElementById('email').focus();
            return;
        }
        
        newForgotLink.style.pointerEvents = 'none';
        newForgotLink.innerText = 'Sending...';
        
        try {
            await sendPasswordResetEmail(auth, emailInput);
            showAlert(t.msgResetSent.replace('{email}', emailInput), false);
        } catch (err) {
            console.error("Forgot password error:", err);
            if (err.code === 'auth/user-not-found') {
                showAlert(t.errEmailNotFound, true);
            } else if (err.code === 'auth/invalid-email') {
                showAlert(t.errInvalidEmail, true);
            } else {
                showAlert(t.errGeneral + err.message, true);
            }
        } finally {
            newForgotLink.style.pointerEvents = 'auto';
            newForgotLink.innerText = t.forgotPass;
        }
    });
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(el => {
        el.classList.remove('show');
    });
    const filterPopup = document.getElementById('transFilterPopup');
    if (filterPopup) filterPopup.classList.remove('show');
    const filterBtn = document.getElementById('transFilterToggleBtn');
    if (filterBtn) filterBtn.classList.remove('active');
    const userMenu = document.getElementById('userPopupMenu');
    if (userMenu) userMenu.classList.remove('show');
    const userTrigger = document.getElementById('userProfileTrigger');
    if (userTrigger) userTrigger.classList.remove('active');
    document.querySelectorAll('.card-menu-dropdown').forEach(el => {
        el.classList.remove('show');
    });
    const exportDrop = document.getElementById('exportDropdown');
    if (exportDrop) exportDrop.classList.remove('show');
}

window.openEditProfileModal = async () => {
    const modal = document.getElementById('editProfileModal');
    const nameInput = document.getElementById('updateNameInput');
    const idInput = document.getElementById('updateUserID');
    const emailInput = document.getElementById('updateEmailInput');
    const previewImg = document.getElementById('previewAvatarImg');
    const fileInput = document.getElementById('fileInputProfile');

    if(!currentUser) return;

    // 1. Reset Form
    nameInput.value = currentUser.displayName || "";
    emailInput.value = currentUser.email || "";
    fileInput.value = ""; 
    idInput.value = "Loading..."; 
    
    modal.classList.add('show');

    // 2. Tarik data TERBARU dari Firestore (Termasuk foto Base64)
    try {
         const userDocRef = doc(db, "user_profiles", currentUser.uid);
         const userDocSnap = await getDoc(userDocRef);
         
         if (userDocSnap.exists()) {
             const data = userDocSnap.data();
             idInput.value = data.userID || "";
             
             // TAMPILKAN FOTO DARI DATABASE DI MODAL EDIT
             if (data.photoURL) {
                 previewImg.src = data.photoURL;
             } else {
                 const fallbackName = encodeURIComponent(data.displayName || 'U');
                 previewImg.src = `https://ui-avatars.com/api/?name=${fallbackName}&background=3b82f6&color=fff&size=150`;
             }
         } else {
             idInput.value = "";
         }
    } catch (error) {
        console.error("Error fetching User data:", error);
        idInput.value = "";
    }
};


const btnSettingsLogout = document.getElementById('btnSettingsLogout');
if(btnSettingsLogout) {
    btnSettingsLogout.addEventListener('click', () => {
        showConfirm(
            "Sign Out?",
            "Are you sure you want to sign out from Pocketly?",
            "Sign Out",
            () => signOut(auth) 
        );
    });
}


window.changeCurrency = (code, symbol, locale) => {
    currentCurrency = code;
    currentLocale = locale;
    localStorage.setItem('pocketly_currency', code);
    localStorage.setItem('pocketly_locale', locale);
    const textEl = document.getElementById('currentCurrencyText');
    if(textEl) textEl.innerText = `${code} (${symbol})`;
    updateDashboard();   
    listenToAccounts();   
    listenToTransactions(); 
    if (typeof window.updateAuthLanguage === 'function') {
        window.updateAuthLanguage();
    }
    document.getElementById('currencyModal')?.classList.remove('show');
    const contoh = formatRupiah(100000);
    showAlert(`Currency changed to ${code}. Example: Rp 100k ≈ ${contoh}`, false);
};

const savedCurr = localStorage.getItem('pocketly_currency') || 'IDR';
const currTextEl = document.getElementById('currentCurrencyText');
if(currTextEl) currTextEl.innerText = savedCurr;


function legacyRenderManageCategories() {
    const list = document.getElementById('manageCategoryList');
    if(!list) return;
    list.innerHTML = '';
    userCategories.forEach((cat, index) => {
        const isSystem = ["Adjustment", "Transfer", "Financial Goal"].includes(cat);
        const deleteBtn = isSystem ? '' : 
            `<button class="btn-delete-cat" onclick="deleteCategory(${index})"><i class="fa-solid fa-trash"></i></button>`;

        list.innerHTML += `
            <div class="cat-manage-item">
                <span>${cat}</span>
                ${deleteBtn}
            </div>
        `;
    });
}

window.addNewCategory = () => {
    const input = document.getElementById('newCatName');
    const name = input.value.trim();

    if(!name) return showAlert("Category name cannot be empty", true);
    if(userCategories.includes(name)) return showAlert("Category already exists", true);

    const iconSelect = document.getElementById('newCatIcon');
    const colorInput = document.getElementById('newCatColor');
    const icon = iconSelect ? iconSelect.value : 'fa-box';
    const color = colorInput ? colorInput.value : '#2563eb';

    userCategories.push(name);
    if (typeof categoryConfig === 'object') {
        categoryConfig[name] = { icon, color };
        localStorage.setItem('pocketly_category_config', JSON.stringify(categoryConfig));
    }
    saveCategories();
    
    input.value = '';
    if (typeof window.updateCatStudioPreview === 'function') window.updateCatStudioPreview();
    renderManageCategories(); 
    populateCategorySelects(); 
};

window.deleteCategory = (index) => {
    const catName = userCategories[index];
    if(confirm(`Delete category "${catName}"?`)) {
        userCategories.splice(index, 1);
        saveCategories();
        renderManageCategories();
        populateCategorySelects();
    }
};

function legacySaveCategories() {
    localStorage.setItem('pocketly_categories', JSON.stringify(userCategories));
}
function legacyPopulateCategorySelects() {
    const transSelect = document.getElementById('inputCategory');
    const filterSelect = document.getElementById('transFilterCategory');
    const budgetSelect = document.getElementById('budgetCategorySelect');
    const generateOptions = (includeAll = false) => {
        let html = includeAll ? '<option value="all">All Categories</option>' : '<option value="" disabled selected>Select Category</option>';
        userCategories.forEach(cat => {
            html += `<option value="${cat}">${cat}</option>`;
        });
        return html;
    };
    if(transSelect) transSelect.innerHTML = generateOptions(false);
    if(filterSelect) filterSelect.innerHTML = generateOptions(true);
    if(budgetSelect) budgetSelect.innerHTML = generateOptions(false);
    setTimeout(initCustomSelects, 100); 
}

window.changeCurrency = (code, symbol, locale) => {
    console.log("Changing currency to:", code); 
    localStorage.setItem('pocketly_currency', code);
    localStorage.setItem('pocketly_locale', locale);
    if(typeof currentCurrency !== 'undefined') currentCurrency = code;
    if(typeof currentLocale !== 'undefined') currentLocale = locale;
    const textEl = document.getElementById('currentCurrencyText');
    if(textEl) textEl.innerText = `${code} (${symbol})`;
    if(typeof updateDashboard === 'function') updateDashboard();
    if(typeof listenToAccounts === 'function') listenToAccounts();
    const modal = document.getElementById('currencyModal');
    if(modal) modal.classList.remove('show');
    if(typeof showAlert === 'function') {
        showAlert(`Currency changed to ${code}`, false);
    } else {
        alert(`Currency changed to ${code}`);
    }
};

function initSettingsFeatures() {
    const btnCurr = document.getElementById('btnSettingsCurrency');
    if (btnCurr && !btnCurr.dataset.currencyNavBound) {
        btnCurr.dataset.currencyNavBound = 'true';
        btnCurr.addEventListener('click', () => switchPage('currencySettings'));
    } else if (!btnCurr) {
        console.warn("Warning: Tombol Currency tidak ditemukan di HTML.");
    }
    const btnCat = document.getElementById('btnSettingsCategories');
    if (btnCat) {
        btnCat.onclick = () => {
            switchPage('categorySettings');
            setTimeout(renderManageCategories, 50);
        };
    }

    const btnLogout = document.getElementById('btnSettingsLogout');
    if (btnLogout) {
        btnLogout.onclick = () => {
            if (typeof showConfirm === 'function') {
                showConfirm(
                    "Sign Out?",
                    "Are you sure you want to sign out?",
                    "Sign Out",
                    () => {
                        signOut(auth).then(() => {
                            console.log("Signed out successfully");
                        }).catch((err) => {
                            console.error("Sign out error", err);
                            alert("Error signing out: " + err.message);
                        });
                    }
                );
            } else {
                if(confirm("Are you sure you want to sign out?")) {
                    signOut(auth);
                }
            }
        };
    } else {
        console.warn("Warning: Tombol Sign Out (btnSettingsLogout) tidak ditemukan di HTML.");
    }
    const savedCurr = localStorage.getItem('pocketly_currency') || 'IDR';
    const savedSym = savedCurr === 'IDR' ? 'Rp' : (savedCurr === 'USD' ? '$' : '€');
    const currTextEl = document.getElementById('currentCurrencyText');
    if(currTextEl) currTextEl.innerText = `${savedCurr} (${savedSym})`;
}

initSettingsFeatures();

const fileInputProfile = document.getElementById('fileInputProfile');
const previewAvatarImg = document.getElementById('previewAvatarImg');

if(fileInputProfile && previewAvatarImg) {
    fileInputProfile.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if(file) {
            if(file.size > 2 * 1024 * 1024) {
                showAlert("File is too big! Max 2MB.", true);
                this.value = ""; 
                return;
            }
            previewAvatarImg.src = URL.createObjectURL(file);
        }
    });
}

// --- FITUR INPUT SUARA ---
const btnVoiceRecord = document.getElementById('btnVoiceRecord');
const voiceRecordModal = document.getElementById('voiceRecordModal');
const btnStartListening = document.getElementById('btnStartListening');
const voiceStatusText = document.getElementById('voiceStatusText');

if (btnVoiceRecord && voiceRecordModal) {
    btnVoiceRecord.addEventListener('click', () => {
        voiceRecordModal.classList.add('show');
        if (voiceStatusText) voiceStatusText.innerText = "Tap the microphone to start";
        if (btnStartListening) btnStartListening.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    });
}

if (btnStartListening) {
    btnStartListening.addEventListener('click', async () => {
        // Ensure Microphone permission is granted on Android / Browser
        if (window.PocketlyAudioHelper && typeof window.PocketlyAudioHelper.ensureMicrophonePermission === 'function') {
            const hasMic = await window.PocketlyAudioHelper.ensureMicrophonePermission();
            if (!hasMic) {
                if (voiceStatusText) voiceStatusText.innerText = "Permission needed";
                showAlert("Microphone permission is required. Please enable it in Settings.", true);
                return;
            }
        } else if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(track => track.stop());
            } catch (permErr) {
                console.warn('[Voice Record] Microphone permission denied:', permErr);
                if (voiceStatusText) voiceStatusText.innerText = "Permission needed";
                showAlert("Microphone permission is required. Please allow access.", true);
                return;
            }
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            showAlert("Your device does not support voice input.", true);
            return;
        }

        try {
            const recognition = new SpeechRecognition();
            recognition.lang = 'id-ID';
            recognition.start();

            btnStartListening.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            if (voiceStatusText) voiceStatusText.innerText = "Listening...";

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript.toLowerCase();
                if (voiceStatusText) voiceStatusText.innerText = "Processing...";
                processSmartInput(transcript);
                voiceRecordModal.classList.remove('show');
                btnStartListening.innerHTML = '<i class="fa-solid fa-microphone"></i>';
            };

            recognition.onerror = (err) => {
                console.warn('[SpeechRecognition] Error:', err);
                btnStartListening.innerHTML = '<i class="fa-solid fa-microphone"></i>';
                if (voiceStatusText) voiceStatusText.innerText = "Failed. Try again.";
                if (err && err.error === 'not-allowed') {
                    if (window.AndroidNative && typeof window.AndroidNative.requestMicrophonePermission === 'function') {
                        window.AndroidNative.requestMicrophonePermission();
                    }
                    showAlert("Microphone permission is not granted. Please allow microphone in settings.", true);
                } else {
                    showAlert("Failed to detect voice. Please try speaking again.", true);
                }
            };
        } catch (recErr) {
            console.error('[SpeechRecognition] Start failed:', recErr);
            btnStartListening.innerHTML = '<i class="fa-solid fa-microphone"></i>';
            if (voiceStatusText) voiceStatusText.innerText = "Failed. Try again.";
            showAlert("Failed to start voice recognition: " + (recErr.message || "Unknown error"), true);
        }
    });
}

// --- FUNGSI PARSER SUARA PINTAR ---
function processSmartInput(text) {
    let amount = 0;
    let category = "Others";
    let type = "expense";
    let accountId = ""; 
    
    // Ubah ke huruf kecil untuk memudahkan pencarian
    let rawText = text.toLowerCase(); 

    // 1. EKSTRAK NOMINAL (Format: 5000, 5k, 50ribu, 5 juta)
    const amountRegex = /(\d+[\d\.,]*)\s*(k|ribu|rbu|juta|jt)?/i;
    const amountMatch = rawText.match(amountRegex);
    
    if (amountMatch) {
        // Bersihkan koma/titik
        let numStr = amountMatch[1].replace(/[.,]/g, ''); 
        amount = parseInt(numStr);
        
        let multiplier = amountMatch[2] ? amountMatch[2].toLowerCase() : "";
        if (multiplier === 'k' || multiplier === 'ribu' || multiplier === 'rbu') {
            amount *= 1000;
        } else if (multiplier === 'juta' || multiplier === 'jt') {
            amount *= 1000000;
        }
        
        // HAPUS angka dari kalimat deskripsi
        rawText = rawText.replace(amountMatch[0], '').trim();
    }

    // 2. EKSTRAK NAMA AKUN (Mencocokkan ucapan dengan data akun di Firebase)
    // Variabel `accounts` sudah ada di kodemu (menyimpan daftar akun)
    let matchedKeyword = "";
    for (let acc of accounts) {
        let accName = acc.name.toLowerCase();
        
        // Buat Alias cerdas (Misal user bilang "cash", kita cari akun bernama "Cash" atau "Tunai")
        let aliasRegex = new RegExp(`(${accName}|cash|tunai|dompet)`, 'i');
        
        if (rawText.includes(accName)) {
            accountId = acc.id; // Simpan ID akun Firebase
            matchedKeyword = accName;
            break;
        } else if (accName.includes('cash') && rawText.match(/cash|tunai/)) {
            accountId = acc.id;
            matchedKeyword = rawText.match(/cash|tunai/)[0];
            break;
        }
    }

    if (accountId) {
        rawText = rawText.replace(new RegExp(matchedKeyword, 'i'), '').trim();
    }

    // 3. EKSTRAK KATEGORI & TIPE
    if (rawText.match(/\b(makan|minum|gorengan|kopi|nasi|air|jajan|kue|rokok|food|warteg|bakso|mie|galon|beras|sayur|buah|gofood|grabfood|shopeefood|ngopi|sarapan)\b/i)) {
        category = "Food & Drink";
        type = "expense";
    } else if (rawText.match(/\b(bensin|parkir|gojek|grab|maxim|tol|kereta|krl|angkot|bis|bus|pesawat|tiket|ojek|bbm|pertalite|pertamax|tambal ban|bengkel)\b/i)) {
        category = "Transportation";
        type = "expense";
    } else if (rawText.match(/\b(baju|sepatu|buku|shopee|tokopedia|belanja|tas|celana|jaket|indomaret|alfamart|superindo|pasar|minimarket)\b/i)) {
        category = "Shopping";
        type = "expense";
    } else if (rawText.match(/\b(skincare|kosmetik|makeup|salon|potong rambut|barbershop|pijat|cukur|spa|creambath|parfum|sabun|sampo)\b/i)) {
        category = "Beauty";
        type = "expense";
    } else if (rawText.match(/\b(pulsa|kuota|listrik|wifi|tagihan|bpjs|pdam|cicilan|paylater|kos|kontrakan|sewa|token|pajak|paket data)\b/i)) {
        category = "Bills & Utilities";
        type = "expense";
    } else if (rawText.match(/\b(bioskop|nonton|main|game|topup|jalan-jalan|liburan|hotel|hiburan|karaoke|piknik|netflix|spotify)\b/i)) {
        category = "Entertainment";
        type = "expense";
    } else if (rawText.match(/\b(obat|dokter|rs|rumah sakit|apotek|klinik|vitamin|bidan|periksa|kesehatan|masker)\b/i)) {
        category = "Health";
        type = "expense";
    } else if (rawText.match(/\b(spp|sekolah|les|kursus|fotocopy|print|alat tulis|kuliah|buku pelajaran)\b/i)) {
        category = "Education";
        type = "expense";
    } else if (rawText.match(/\b(reksadana|saham|crypto|kripto|emas|deposito|bibit|ajaib|investasi)\b/i)) {
        category = "Investment";
        type = "expense"; 
    } else if (rawText.match(/\b(nabung|tabungan|simpenan|celengan|impian)\b/i)) {
        category = "Financial Goal";
        type = "expense"; 
    } else if (rawText.match(/\b(transfer|tf|kirim|pindah dana)\b/i)) {
        category = "Transfer";
        type = "transfer"; // Sesuaikan type ini dengan struktur database-mu
    } else if (rawText.match(/\b(penyesuaian|koreksi|selisih|sisa)\b/i)) {
        category = "Adjustment";
        type = "adjustment"; // Sesuaikan type ini dengan struktur database-mu
    } else if (rawText.match(/\b(gaji|dikasih|bonus|jual|thr|untung|cair|proyek|kembalian|bayaran|profit|dividen|hasil)\b/i)) {
        category = "Salary";
        type = "income";
    } else if (rawText.match(/\b(sedekah|infaq|donasi|sumbangan|kondangan|amplop|zakat|amal|kas|nyumbang)\b/i)) {
        category = "Others";
        type = "expense";
    } else {
        category = "Others";
        type = "expense"; 
    }

    // 4. BERSIHKAN DESKRIPSI (Menghilangkan spasi ganda)
    let finalDesc = rawText.replace(/\s+/g, ' ').trim();
    if(finalDesc) {
        // Buat huruf pertama jadi kapital (cth: "beli gorengan" -> "Beli gorengan")
        finalDesc = finalDesc.charAt(0).toUpperCase() + finalDesc.slice(1);
    } else {
        finalDesc = "Transaksi (Auto-Voice)";
    }

    // 5. ISI FORM OTOMATIS
    document.getElementById('openTransModalBtn').click(); // Buka Modal
    
    setTimeout(() => {
        // Isi Data
        document.getElementById('inputType').value = type;
        document.getElementById('inputAmount').value = (typeof convertFromIdrToBase === 'function' ? convertFromIdrToBase(amount) : amount) || "";
        document.getElementById('inputDesc').value = finalDesc;
        
        // Set Tanggal ke Hari Ini
        document.getElementById('inputDate').value = new Date().toISOString().split('T')[0];
        
        // PENTING: Tunggu sedikit agar DOM menyesuaikan, lalu isi Kategori & Akun
        setTimeout(() => {
            document.getElementById('inputCategory').value = category;
            
            // Jika akun terdeteksi, pilih dropdown-nya. Jika tidak, biarkan user milih sendiri.
            if(accountId) {
                document.getElementById('inputAccount').value = accountId;
            }
            
            // RE-RENDER CUSTOM DROPDOWN (Penting agar UI Glassmorphism-mu berubah sesuai input)
            if(typeof initCustomSelects === 'function') initCustomSelects();
        }, 50);
    }, 200);
}

// --- FITUR SCAN STRUK (OCR) ---
const btnScanReceipt = document.getElementById('btnScanReceipt');
const inputReceiptImage = document.getElementById('inputReceiptImage');

// --- FUNGSI KOMPRESI GAMBAR (Ngebut!) ---
// Mengecilkan resolusi foto kamera agar Tesseract bisa baca dalam 2-3 detik
function compressImage(file, maxWidth) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Perkecil gambar jika lebarnya melebihi maxWidth
                if (width > maxWidth) {
                    height = Math.round((maxWidth / width) * height);
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                
                // Opsional: Beri background putih agar teks struk lebih kontras
                ctx.fillStyle = "white";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, width, height);
                
                // Konversi ke format JPEG dengan kualitas 80% (Sangat ringan)
                resolve(canvas.toDataURL('image/jpeg', 0.8)); 
            };
        };
    });
}

// --- FITUR SCAN STRUK (OCR) YANG SUDAH DI-UPGRADE ---
if (btnScanReceipt) {
    const imageOptionsPopup = document.getElementById('imageOptionsPopup');
    const btnUploadGallery = document.getElementById('btnUploadGallery');
    const btnOpenCamera = document.getElementById('btnOpenCamera');
    const inputReceiptImage = document.getElementById('inputReceiptImage');
    const inputCameraImage = document.getElementById('inputCameraImage');

    if (imageOptionsPopup) {
        btnScanReceipt.addEventListener('click', (e) => {
            e.stopPropagation();
            imageOptionsPopup.classList.toggle('show');
        });

        if (btnUploadGallery) {
            btnUploadGallery.addEventListener('click', (e) => {
                e.stopPropagation();
                imageOptionsPopup.classList.remove('show');
                if (inputReceiptImage) inputReceiptImage.click();
            });
        }

        if (btnOpenCamera) {
            btnOpenCamera.addEventListener('click', (e) => {
                e.stopPropagation();
                imageOptionsPopup.classList.remove('show');
                if (inputCameraImage) {
                    inputCameraImage.click();
                } else if (inputReceiptImage) {
                    inputReceiptImage.setAttribute('capture', 'environment');
                    inputReceiptImage.click();
                }
            });
        }
        
        document.addEventListener('click', (e) => {
            if (!btnScanReceipt.contains(e.target) && !imageOptionsPopup.contains(e.target)) {
                imageOptionsPopup.classList.remove('show');
            }
        });
    } else {
        btnScanReceipt.addEventListener('click', () => {
            if (inputReceiptImage) inputReceiptImage.click();
        });
    }

    async function processReceiptFile(file) {
        if (!file) return;

        btnScanReceipt.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-blue"></i>';
        showAlert("Processing receipt... Please wait a moment.", false);

        try {
            if (!window.Tesseract || typeof window.Tesseract.recognize !== 'function') {
                showAlert('OCR library is still loading. Please wait a moment, then try again.', true);
                return;
            }
            const compressedImage = await compressImage(file, 800);

            const { data: { text } } = await window.Tesseract.recognize(compressedImage, 'ind');
            const lowerText = text.toLowerCase();
            
            let amount = 0;
            let category = "Shopping"; 
            let finalDesc = "Scanned Receipt";
            let type = "expense";
            const lines = lowerText.split('\n');
            
            for (let i = lines.length - 1; i >= 0; i--) {
                const line = lines[i];
                if ((line.includes('total') || line.includes('lunas') || line.includes('bayar')) && 
                    !line.includes('sub') && 
                    !line.includes('diskon')) {
                    
                    const match = line.match(/(\d{1,3}(?:[.,]\d{3})*)/);
                    if (match && match[1]) {
                        amount = parseInt(match[1].replace(/[.,]/g, ''));
                        break; 
                    }
                }
            }

            if (lowerText.match(/mcdonald|kfc|starbucks|mixue|janji jiwa|kenangan|restoran|cafe|kopi|warung|mcd|burger king|hokben|chatime|bakso|sate|food court|rm|rumah makan|gofood|grabfood|shopeefood/)) {
                category = "Food & Drink";
                finalDesc = "Food & Drink (Receipt)";

            } else if (lowerText.match(/spbu|pertamina|shell|vivo|bp|parkir|secure parking|tiket|kai|lion|citilink|garuda|tol|jasa marga|grab|gojek|maxim|bluebird|bengkel|ahass|cuci mobil/)) {
                category = "Transportation";
                finalDesc = "Transportation/Fuel (Receipt)";

            } else if (lowerText.match(/alfamart|indomaret|alfamidi|superindo|hypermart|transmart|carrefour|lottemart|yogya|matahari|miniso|mr diy|toko|mall|belanja/)) {
                category = "Shopping";
                finalDesc = "Groceries/Shopping (Receipt)";

            } else if (lowerText.match(/guardian|watsons|sociolla|erha|natasha|zap|salon|barbershop|klinik kecantikan|skincare|kosmetik|potong rambut/)) {
                category = "Beauty";
                finalDesc = "Beauty & Care (Receipt)";

            } else if (lowerText.match(/pln|pdam|telkom|indihome|first media|biznet|bpjs|token|tagihan|pascabayar|telkomsel|indosat|xl|smartfren|pulsa/)) {
                category = "Bills & Utilities";
                finalDesc = "Bills & Utilities (Receipt)";

            } else if (lowerText.match(/xxi|cgv|cinepolis|bioskop|timezone|funworld|ancol|dufan|tiket masuk|karcis|netflix|spotify/)) {
                category = "Entertainment";
                finalDesc = "Entertainment (Receipt)";

            } else if (lowerText.match(/apotek|k24|kimia farma|century|rumah sakit|klinik|rsud|puskesmas|dokter|betadine|hansaplast|kapas|obat|panadol|tolak angin|plester|paracetamol|vitamin|resep/)) {
                category = "Health";
                finalDesc = "Health & Pharmacy (Receipt)";

            } else if (lowerText.match(/gramedia|gunung agung|toga mas|spp|buku|alat tulis|fotocopy|print|atk|sekolah|kampus|universitas/)) {
                category = "Education";
                finalDesc = "Education/Stationery (Receipt)";

            } else if (lowerText.match(/reksadana|bibit|ajaib|bareksa|ipot|indodax|tokocrypto|emas|antam|pegadaian|saham/)) {
                category = "Investment";
                finalDesc = "Investment/Assets (Receipt)";

            } else if (lowerText.match(/transfer|atm|bca|mandiri|bni|bri|bsi|dana|gopay|ovo|shopeepay|linkaja|tarik tunai|setor tunai|flip/)) {
                category = "Transfer";
                finalDesc = "Transfer/Top Up (Receipt)";

            } else if (lowerText.match(/slip gaji|payroll|tunjangan|bonus|thr|dividen/)) {
                category = "Salary";
                finalDesc = "Income/Salary (Receipt)";

            } else if (lowerText.match(/nabung|celengan|simpanan/)) {
                category = "Financial Goal";
                finalDesc = "Savings/Goal (Receipt)";

            } else if (lowerText.match(/koreksi|penyesuaian|selisih/)) {
                category = "Adjustment";
                finalDesc = "Balance Adjustment (Receipt)";

            } else {
                category = "Others";
                finalDesc = "Other Expense (Receipt)";
            }
            document.getElementById('openTransModalBtn').click();
            
            setTimeout(() => {
                document.getElementById('inputType').value = type;
                document.getElementById('inputAmount').value = (typeof convertFromIdrToBase === 'function' ? convertFromIdrToBase(amount) : amount) || "";
                document.getElementById('inputDesc').value = finalDesc;
                document.getElementById('inputDate').value = new Date().toISOString().split('T')[0];
                
                setTimeout(() => {
                    document.getElementById('inputCategory').value = category;
                    
                    if(typeof initCustomSelects === 'function') initCustomSelects();
                    
                    if(amount > 0) {
                        const formattedAmount = (typeof formatCurrency === 'function') ? formatCurrency(amount) : 'Rp ' + amount.toLocaleString('id-ID');
                        showAlert(`Receipt scanned successfully! Amount: ${formattedAmount}`, false);
                    } else {
                        showAlert("Receipt scanned. Please review amount and category.", false);
                    }
                }, 50);
            }, 300);

        } catch (err) {
            console.error("OCR Error:", err);
            showAlert("Failed to process receipt image.", true);
        } finally {
            btnScanReceipt.innerHTML = '<i class="fa-solid fa-camera"></i>';
            if (inputReceiptImage) inputReceiptImage.value = '';
            if (inputCameraImage) inputCameraImage.value = '';
        }
    }

    if (inputReceiptImage) {
        inputReceiptImage.addEventListener('change', (e) => {
            processReceiptFile(e.target.files[0]);
        });
    }
    if (inputCameraImage) {
        inputCameraImage.addEventListener('change', (e) => {
            processReceiptFile(e.target.files[0]);
        });
    }
}
/* =========================================
   POCKETLY FEATURE PACK
   Debt / Loan Tracker, Calendar, JSON Backup,
   Category Icon + Color, Live Currency Rates
   ========================================= */

let rawDebts = [];
let debtUnsubscribe = null;
let calendarSelectedDate = formatLocalISO(new Date());
let calendarControlsReady = false;
let categoryConfig = {};

const FALLBACK_RATES = {
    IDR: 1,
    USD: 0.000064,
    EUR: 0.000059,
    SGD: 0.000086,
    MYR: 0.00030,
    JPY: 0.0098,
    GBP: 0.000050,
    AUD: 0.000097,
    CAD: 0.000087,
    CHF: 0.000052,
    CNY: 0.00046,
    HKD: 0.00050,
    KRW: 0.088,
    THB: 0.0023,
    PHP: 0.0037,
    VND: 1.62,
    INR: 0.0054,
    NZD: 0.000106,
    AED: 0.00024,
    SAR: 0.00024,
    ZAR: 0.0012,
    BRL: 0.00035,
    MXN: 0.0012,
    TRY: 0.0022,
    RUB: 0.0058,
    SEK: 0.00068,
    NOK: 0.00068,
    DKK: 0.00044,
    PLN: 0.00025,
    TWD: 0.0021,
    // New additions
    QAR: 0.00023,
    KWD: 0.0000196,
    BHD: 0.0000241,
    OMR: 0.0000246,
    EGP: 0.0031,
    PKR: 0.018,
    BDT: 0.0070,
    LKR: 0.021,
    NPR: 0.0086,
    MMK: 0.134,
    KHR: 0.26,
    LAK: 1.41,
    HUF: 0.023,
    CZK: 0.0015,
    RON: 0.00030,
    HRK: 0.00044,
    BGN: 0.000115,
    ISK: 0.0089,
    UAH: 0.0027,
    ILS: 0.00024,
    CLP: 0.062,
    ARS: 0.065,
    COP: 0.26,
    PEN: 0.00024,
    UYU: 0.0028,
    NGN: 0.099,
    KES: 0.0083,
    GHS: 0.00099,
    MAD: 0.00063,
    TND: 0.000196
};

const CURRENCY_META = {
    IDR: { symbol: 'Rp', locale: 'id-ID', name: 'Indonesian Rupiah', decimals: 0, country: 'Indonesia', flag: '🇮🇩' },
    USD: { symbol: '$', locale: 'en-US', name: 'US Dollar', decimals: 2, country: 'United States', flag: '🇺🇸' },
    EUR: { symbol: '€', locale: 'de-DE', name: 'Euro', decimals: 2, country: 'European Union', flag: '🇪🇺' },
    SGD: { symbol: 'S$', locale: 'en-SG', name: 'Singapore Dollar', decimals: 2, country: 'Singapore', flag: '🇸🇬' },
    MYR: { symbol: 'RM', locale: 'ms-MY', name: 'Malaysian Ringgit', decimals: 2, country: 'Malaysia', flag: '🇲🇾' },
    JPY: { symbol: '¥', locale: 'ja-JP', name: 'Japanese Yen', decimals: 0, country: 'Japan', flag: '🇯🇵' },
    GBP: { symbol: '£', locale: 'en-GB', name: 'British Pound', decimals: 2, country: 'United Kingdom', flag: '🇬🇧' },
    AUD: { symbol: 'A$', locale: 'en-AU', name: 'Australian Dollar', decimals: 2, country: 'Australia', flag: '🇦🇺' },
    CAD: { symbol: 'C$', locale: 'en-CA', name: 'Canadian Dollar', decimals: 2, country: 'Canada', flag: '🇨🇦' },
    CHF: { symbol: 'CHF', locale: 'de-CH', name: 'Swiss Franc', decimals: 2, country: 'Switzerland', flag: '🇨🇭' },
    CNY: { symbol: '¥', locale: 'zh-CN', name: 'Chinese Yuan', decimals: 2, country: 'China', flag: '🇨🇳' },
    HKD: { symbol: 'HK$', locale: 'zh-HK', name: 'Hong Kong Dollar', decimals: 2, country: 'Hong Kong', flag: '🇭🇰' },
    KRW: { symbol: '₩', locale: 'ko-KR', name: 'South Korean Won', decimals: 0, country: 'South Korea', flag: '🇰🇷' },
    THB: { symbol: '฿', locale: 'th-TH', name: 'Thai Baht', decimals: 2, country: 'Thailand', flag: '🇹🇭' },
    PHP: { symbol: '₱', locale: 'en-PH', name: 'Philippine Peso', decimals: 2, country: 'Philippines', flag: '🇵🇭' },
    VND: { symbol: '₫', locale: 'vi-VN', name: 'Vietnamese Dong', decimals: 0, country: 'Vietnam', flag: '🇻🇳' },
    INR: { symbol: '₹', locale: 'en-IN', name: 'Indian Rupee', decimals: 2, country: 'India', flag: '🇮🇳' },
    NZD: { symbol: 'NZ$', locale: 'en-NZ', name: 'New Zealand Dollar', decimals: 2, country: 'New Zealand', flag: '🇳🇿' },
    AED: { symbol: 'د.إ', locale: 'ar-AE', name: 'UAE Dirham', decimals: 2, country: 'United Arab Emirates', flag: '🇦🇪' },
    SAR: { symbol: '﷼', locale: 'ar-SA', name: 'Saudi Riyal', decimals: 2, country: 'Saudi Arabia', flag: '🇸🇦' },
    ZAR: { symbol: 'R', locale: 'en-ZA', name: 'South African Rand', decimals: 2, country: 'South Africa', flag: '🇿🇦' },
    BRL: { symbol: 'R$', locale: 'pt-BR', name: 'Brazilian Real', decimals: 2, country: 'Brazil', flag: '🇧🇷' },
    MXN: { symbol: 'MX$', locale: 'es-MX', name: 'Mexican Peso', decimals: 2, country: 'Mexico', flag: '🇲🇽' },
    TRY: { symbol: '₺', locale: 'tr-TR', name: 'Turkish Lira', decimals: 2, country: 'Türkiye', flag: '🇹🇷' },
    RUB: { symbol: '₽', locale: 'ru-RU', name: 'Russian Ruble', decimals: 2, country: 'Russia', flag: '🇷🇺' },
    SEK: { symbol: 'kr', locale: 'sv-SE', name: 'Swedish Krona', decimals: 2, country: 'Sweden', flag: '🇸🇪' },
    NOK: { symbol: 'kr', locale: 'nb-NO', name: 'Norwegian Krone', decimals: 2, country: 'Norway', flag: '🇳🇴' },
    DKK: { symbol: 'kr', locale: 'da-DK', name: 'Danish Krone', decimals: 2, country: 'Denmark', flag: '🇩🇰' },
    PLN: { symbol: 'zł', locale: 'pl-PL', name: 'Polish Zloty', decimals: 2, country: 'Poland', flag: '🇵🇱' },
    TWD: { symbol: 'NT$', locale: 'zh-TW', name: 'New Taiwan Dollar', decimals: 2, country: 'Taiwan', flag: '🇹🇼' },
    // Middle East & Africa
    QAR: { symbol: 'QR', locale: 'ar-QA', name: 'Qatari Riyal', decimals: 2, country: 'Qatar', flag: '🇶🇦' },
    KWD: { symbol: 'KD', locale: 'ar-KW', name: 'Kuwaiti Dinar', decimals: 3, country: 'Kuwait', flag: '🇰🇼' },
    BHD: { symbol: 'BD', locale: 'ar-BH', name: 'Bahraini Dinar', decimals: 3, country: 'Bahrain', flag: '🇧🇭' },
    OMR: { symbol: 'ر.ع.', locale: 'ar-OM', name: 'Omani Rial', decimals: 3, country: 'Oman', flag: '🇴🇲' },
    EGP: { symbol: 'E£', locale: 'ar-EG', name: 'Egyptian Pound', decimals: 2, country: 'Egypt', flag: '🇪🇬' },
    NGN: { symbol: '₦', locale: 'en-NG', name: 'Nigerian Naira', decimals: 2, country: 'Nigeria', flag: '🇳🇬' },
    KES: { symbol: 'KSh', locale: 'en-KE', name: 'Kenyan Shilling', decimals: 2, country: 'Kenya', flag: '🇰🇪' },
    GHS: { symbol: 'GH₵', locale: 'en-GH', name: 'Ghanaian Cedi', decimals: 2, country: 'Ghana', flag: '🇬🇭' },
    MAD: { symbol: 'MAD', locale: 'ar-MA', name: 'Moroccan Dirham', decimals: 2, country: 'Morocco', flag: '🇲🇦' },
    TND: { symbol: 'DT', locale: 'ar-TN', name: 'Tunisian Dinar', decimals: 3, country: 'Tunisia', flag: '🇹🇳' },
    ILS: { symbol: '₪', locale: 'he-IL', name: 'Israeli Shekel', decimals: 2, country: 'Israel', flag: '🇮🇱' },
    // South & Southeast Asia
    PKR: { symbol: '₨', locale: 'ur-PK', name: 'Pakistani Rupee', decimals: 2, country: 'Pakistan', flag: '🇵🇰' },
    BDT: { symbol: '৳', locale: 'bn-BD', name: 'Bangladeshi Taka', decimals: 2, country: 'Bangladesh', flag: '🇧🇩' },
    LKR: { symbol: 'Rs', locale: 'si-LK', name: 'Sri Lankan Rupee', decimals: 2, country: 'Sri Lanka', flag: '🇱🇰' },
    NPR: { symbol: 'Rs', locale: 'ne-NP', name: 'Nepalese Rupee', decimals: 2, country: 'Nepal', flag: '🇳🇵' },
    MMK: { symbol: 'K', locale: 'my-MM', name: 'Myanmar Kyat', decimals: 0, country: 'Myanmar', flag: '🇲🇲' },
    KHR: { symbol: '៛', locale: 'km-KH', name: 'Cambodian Riel', decimals: 0, country: 'Cambodia', flag: '🇰🇭' },
    LAK: { symbol: '₭', locale: 'lo-LA', name: 'Lao Kip', decimals: 0, country: 'Laos', flag: '🇱🇦' },
    // Europe
    HUF: { symbol: 'Ft', locale: 'hu-HU', name: 'Hungarian Forint', decimals: 0, country: 'Hungary', flag: '🇭🇺' },
    CZK: { symbol: 'Kč', locale: 'cs-CZ', name: 'Czech Koruna', decimals: 2, country: 'Czech Republic', flag: '🇨🇿' },
    RON: { symbol: 'lei', locale: 'ro-RO', name: 'Romanian Leu', decimals: 2, country: 'Romania', flag: '🇷🇴' },
    BGN: { symbol: 'лв', locale: 'bg-BG', name: 'Bulgarian Lev', decimals: 2, country: 'Bulgaria', flag: '🇧🇬' },
    ISK: { symbol: 'kr', locale: 'is-IS', name: 'Icelandic Króna', decimals: 0, country: 'Iceland', flag: '🇮🇸' },
    UAH: { symbol: '₴', locale: 'uk-UA', name: 'Ukrainian Hryvnia', decimals: 2, country: 'Ukraine', flag: '🇺🇦' },
    // Americas
    CLP: { symbol: '$', locale: 'es-CL', name: 'Chilean Peso', decimals: 0, country: 'Chile', flag: '🇨🇱' },
    ARS: { symbol: '$', locale: 'es-AR', name: 'Argentine Peso', decimals: 2, country: 'Argentina', flag: '🇦🇷' },
    COP: { symbol: '$', locale: 'es-CO', name: 'Colombian Peso', decimals: 0, country: 'Colombia', flag: '🇨🇴' },
    PEN: { symbol: 'S/', locale: 'es-PE', name: 'Peruvian Sol', decimals: 2, country: 'Peru', flag: '🇵🇪' },
    UYU: { symbol: '$U', locale: 'es-UY', name: 'Uruguayan Peso', decimals: 2, country: 'Uruguay', flag: '🇺🇾' },
};

const ENHANCED_DEFAULT_CATEGORIES = [
    'Food & Drink', 'Transportation', 'Shopping', 'Beauty', 'Bills & Utilities',
    'Entertainment', 'Health', 'Education', 'Salary', 'Investment', 'Adjustment',
    'Transfer', 'Financial Goal', 'Debt / Loan', 'Others'
];

const DEFAULT_CATEGORY_CONFIG = {
    'Food & Drink': { icon: 'fa-burger', color: '#f97316' },
    'Transportation': { icon: 'fa-car', color: '#06b6d4' },
    'Shopping': { icon: 'fa-bag-shopping', color: '#ec4899' },
    'Beauty': { icon: 'fa-wand-magic-sparkles', color: '#d946ef' },
    'Bills & Utilities': { icon: 'fa-lightbulb', color: '#f59e0b' },
    'Entertainment': { icon: 'fa-film', color: '#8b5cf6' },
    'Health': { icon: 'fa-pills', color: '#ef4444' },
    'Education': { icon: 'fa-graduation-cap', color: '#3b82f6' },
    'Salary': { icon: 'fa-money-bill-wave', color: '#10b981' },
    'Investment': { icon: 'fa-chart-line', color: '#14b8a6' },
    'Adjustment': { icon: 'fa-sliders', color: '#64748b' },
    'Transfer': { icon: 'fa-money-bill-transfer', color: '#3b82f6' },
    'Financial Goal': { icon: 'fa-bullseye', color: '#22c55e' },
    'Debt / Loan': { icon: 'fa-hand-holding-dollar', color: '#0f766e' },
    'Others': { icon: 'fa-box', color: '#94a3b8' }
};

const CATEGORY_ICON_CATALOG = [
    // Food & Dining
    { icon: 'fa-burger', label: 'Burger', group: 'food' },
    { icon: 'fa-pizza-slice', label: 'Pizza', group: 'food' },
    { icon: 'fa-utensils', label: 'Dining', group: 'food' },
    { icon: 'fa-mug-hot', label: 'Coffee', group: 'food' },
    { icon: 'fa-wine-glass', label: 'Drinks', group: 'food' },
    { icon: 'fa-ice-cream', label: 'Dessert', group: 'food' },
    { icon: 'fa-apple-whole', label: 'Groceries', group: 'food' },
    { icon: 'fa-bowl-rice', label: 'Meal', group: 'food' },
    { icon: 'fa-cookie-bite', label: 'Snack', group: 'food' },
    { icon: 'fa-beer-mug-empty', label: 'Beverage', group: 'food' },

    // Transportation
    { icon: 'fa-car', label: 'Car', group: 'transport' },
    { icon: 'fa-bus', label: 'Bus', group: 'transport' },
    { icon: 'fa-train', label: 'Train', group: 'transport' },
    { icon: 'fa-plane', label: 'Flight', group: 'transport' },
    { icon: 'fa-gas-pump', label: 'Fuel', group: 'transport' },
    { icon: 'fa-bicycle', label: 'Bike', group: 'transport' },
    { icon: 'fa-motorcycle', label: 'Motorbike', group: 'transport' },
    { icon: 'fa-taxi', label: 'Taxi', group: 'transport' },
    { icon: 'fa-ship', label: 'Ferry', group: 'transport' },

    // Shopping & Lifestyle
    { icon: 'fa-bag-shopping', label: 'Shopping', group: 'shopping' },
    { icon: 'fa-cart-shopping', label: 'Supermarket', group: 'shopping' },
    { icon: 'fa-shirt', label: 'Clothing', group: 'shopping' },
    { icon: 'fa-gem', label: 'Jewelry', group: 'shopping' },
    { icon: 'fa-wand-magic-sparkles', label: 'Beauty', group: 'shopping' },
    { icon: 'fa-gift', label: 'Gift', group: 'shopping' },
    { icon: 'fa-tag', label: 'Promo', group: 'shopping' },
    { icon: 'fa-shoe-prints', label: 'Shoes', group: 'shopping' },
    { icon: 'fa-glasses', label: 'Fashion', group: 'shopping' },

    // Bills & Utilities
    { icon: 'fa-lightbulb', label: 'Electricity', group: 'bills' },
    { icon: 'fa-droplet', label: 'Water', group: 'bills' },
    { icon: 'fa-wifi', label: 'Internet', group: 'bills' },
    { icon: 'fa-mobile-screen', label: 'Phone', group: 'bills' },
    { icon: 'fa-house', label: 'Home/Rent', group: 'bills' },
    { icon: 'fa-tv', label: 'Streaming', group: 'bills' },
    { icon: 'fa-wrench', label: 'Repairs', group: 'bills' },
    { icon: 'fa-fire-burner', label: 'Gas', group: 'bills' },
    { icon: 'fa-shield-halved', label: 'Insurance', group: 'bills' },

    // Entertainment & Hobbies
    { icon: 'fa-film', label: 'Cinema', group: 'fun' },
    { icon: 'fa-gamepad', label: 'Gaming', group: 'fun' },
    { icon: 'fa-music', label: 'Music', group: 'fun' },
    { icon: 'fa-ticket', label: 'Events', group: 'fun' },
    { icon: 'fa-headphones', label: 'Audio', group: 'fun' },
    { icon: 'fa-palette', label: 'Art', group: 'fun' },
    { icon: 'fa-camera', label: 'Photo', group: 'fun' },
    { icon: 'fa-dice', label: 'Hobby', group: 'fun' },

    // Health & Wellness
    { icon: 'fa-pills', label: 'Medicine', group: 'health' },
    { icon: 'fa-heart-pulse', label: 'Health', group: 'health' },
    { icon: 'fa-hospital', label: 'Clinic', group: 'health' },
    { icon: 'fa-dumbbell', label: 'Gym/Sport', group: 'health' },
    { icon: 'fa-spa', label: 'Spa/Care', group: 'health' },
    { icon: 'fa-tooth', label: 'Dental', group: 'health' },
    { icon: 'fa-paw', label: 'Pets', group: 'health' },
    { icon: 'fa-baby', label: 'Baby', group: 'health' },

    // Work & Study
    { icon: 'fa-graduation-cap', label: 'Education', group: 'work' },
    { icon: 'fa-book', label: 'Books', group: 'work' },
    { icon: 'fa-briefcase', label: 'Work', group: 'work' },
    { icon: 'fa-laptop', label: 'Laptop', group: 'work' },
    { icon: 'fa-building', label: 'Office', group: 'work' },
    { icon: 'fa-award', label: 'Course', group: 'work' },

    // Finance & Investment
    { icon: 'fa-money-bill-wave', label: 'Cash/Salary', group: 'finance' },
    { icon: 'fa-chart-line', label: 'Investment', group: 'finance' },
    { icon: 'fa-piggy-bank', label: 'Savings', group: 'finance' },
    { icon: 'fa-wallet', label: 'Wallet', group: 'finance' },
    { icon: 'fa-coins', label: 'Coins', group: 'finance' },
    { icon: 'fa-credit-card', label: 'Card', group: 'finance' },
    { icon: 'fa-vault', label: 'Deposit', group: 'finance' },
    { icon: 'fa-hand-holding-dollar', label: 'Debt/Loan', group: 'finance' },
    { icon: 'fa-money-bill-transfer', label: 'Transfer', group: 'finance' },
    { icon: 'fa-bullseye', label: 'Goal', group: 'finance' },

    // Other & General
    { icon: 'fa-box', label: 'Box', group: 'other' },
    { icon: 'fa-box-open', label: 'Misc', group: 'other' },
    { icon: 'fa-sliders', label: 'Adjustment', group: 'other' },
    { icon: 'fa-umbrella-beach', label: 'Vacation', group: 'other' },
    { icon: 'fa-star', label: 'Starred', group: 'other' },
    { icon: 'fa-bell', label: 'Notice', group: 'other' },
    { icon: 'fa-key', label: 'Key', group: 'other' },
    { icon: 'fa-clock', label: 'Routine', group: 'other' }
];

const CATEGORY_ICON_OPTIONS = CATEGORY_ICON_CATALOG.map((item) => [item.icon, item.label]);

const SYSTEM_CATEGORIES = ['Adjustment', 'Transfer', 'Financial Goal', 'Debt / Loan'];

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));
}

function escapeForJsString(value) {
    return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ');
}

function parseJSONSafe(text, fallback) {
    try { return JSON.parse(text); } catch (error) { return fallback; }
}

function formatLocalISO(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function todayISO() {
    return formatLocalISO(new Date());
}

function toLocalDate(dateString) {
    if (!dateString) return null;
    return new Date(`${dateString}T00:00:00`);
}

function hexToRgba(hex, alpha = 0.12) {
    const normalized = String(hex || '#64748b').replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return `rgba(100, 116, 139, ${alpha})`;
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const themePresets = {
    sapphire: {
        name: 'Sapphire Blue',
        tagline: 'Fintech & Modern Classic',
        accent: '#2563eb',
        rgb: '37, 99, 235',
        dark: '#1d4ed8',
        light: 'rgba(37, 99, 235, 0.12)',
        glow: 'rgba(37, 99, 235, 0.32)'
    },
    emerald: {
        name: 'Emerald Green',
        tagline: 'Wealth, Growth & Prosperity',
        accent: '#10b981',
        rgb: '16, 185, 129',
        dark: '#059669',
        light: 'rgba(16, 185, 129, 0.12)',
        glow: 'rgba(16, 185, 129, 0.32)'
    },
    purple: {
        name: 'Purple Haze',
        tagline: 'Royal Violet & Creative Vibe',
        accent: '#8b5cf6',
        rgb: '139, 92, 246',
        dark: '#7c3aed',
        light: 'rgba(139, 92, 246, 0.12)',
        glow: 'rgba(139, 92, 246, 0.32)'
    },
    sunset: {
        name: 'Sunset Orange',
        tagline: 'Vibrant Warmth & Dynamic Flow',
        accent: '#f97316',
        rgb: '249, 115, 22',
        dark: '#ea580c',
        light: 'rgba(249, 115, 22, 0.12)',
        glow: 'rgba(249, 115, 22, 0.32)'
    },
    rose: {
        name: 'Rose Pink',
        tagline: 'Elegant Ruby & Soft Charm',
        accent: '#ec4899',
        rgb: '236, 72, 153',
        dark: '#db2777',
        light: 'rgba(236, 72, 153, 0.12)',
        glow: 'rgba(236, 72, 153, 0.32)'
    },
    cyan: {
        name: 'Ocean Teal',
        tagline: 'Crisp Breeze & Deep Clarity',
        accent: '#06b6d4',
        rgb: '6, 182, 212',
        dark: '#0891b2',
        light: 'rgba(6, 182, 212, 0.12)',
        glow: 'rgba(6, 182, 212, 0.32)'
    },
    crimson: {
        name: 'Crimson Flame',
        tagline: 'Bold Contrast & High Energy',
        accent: '#ef4444',
        rgb: '239, 68, 68',
        dark: '#dc2626',
        light: 'rgba(239, 68, 68, 0.12)',
        glow: 'rgba(239, 68, 68, 0.32)'
    },
    amber: {
        name: 'Cyber Amber',
        tagline: 'Golden Luxe & Premium Sunburst',
        accent: '#f59e0b',
        rgb: '245, 158, 11',
        dark: '#d97706',
        light: 'rgba(245, 158, 11, 0.12)',
        glow: 'rgba(245, 158, 11, 0.32)'
    },
    indigo: {
        name: 'Deep Indigo',
        tagline: 'High-Tech Focus & Precision',
        accent: '#6366f1',
        rgb: '99, 102, 241',
        dark: '#4f46e5',
        light: 'rgba(99, 102, 241, 0.12)',
        glow: 'rgba(99, 102, 241, 0.32)'
    },
    slate: {
        name: 'Titanium Slate',
        tagline: 'Minimalist Stealth & Modern Grey',
        accent: '#64748b',
        rgb: '100, 116, 139',
        dark: '#475569',
        light: 'rgba(100, 116, 139, 0.12)',
        glow: 'rgba(100, 116, 139, 0.32)'
    }
};

window.applyThemeAccent = function(themeKey, isInitial = false) {
    let key = themeKey;
    if (key === 'blue' || !themePresets[key]) {
        key = (themePresets[key] ? key : 'sapphire');
    }
    const theme = themePresets[key] || themePresets.sapphire;
    currentThemeAccent = key;
    localStorage.setItem('pocketly_theme_accent', key);

    // Full Application-Wide System Theming (like Mobile Phone OS)
    const root = document.documentElement;
    root.style.setProperty('--primary-color', theme.accent);
    root.style.setProperty('--primary-dark', theme.dark);
    root.style.setProperty('--primary-color-dark', theme.dark);
    root.style.setProperty('--primary-gradient', `linear-gradient(135deg, ${theme.accent} 0%, ${theme.dark} 100%)`);
    root.style.setProperty('--blue-accent', theme.accent);
    root.style.setProperty('--blue-accent-rgb', theme.rgb);
    root.style.setProperty('--blue-accent-dark', theme.dark);
    root.style.setProperty('--blue-accent-light', theme.light);
    root.style.setProperty('--blue-accent-glow', theme.glow);
    root.style.setProperty('--theme-color', theme.accent);
    root.style.setProperty('--theme-color-rgb', theme.rgb);
    root.style.setProperty('--theme-color-dark', theme.dark);
    root.style.setProperty('--theme-color-light', theme.light);
    root.style.setProperty('--theme-color-glow', theme.glow);

    // Set data attribute and theme class on body
    root.setAttribute('data-theme-color', key);
    if (document.body) {
        document.body.className = document.body.className.replace(/\btheme-[a-z0-9_-]+/g, '').trim();
        document.body.classList.add(`theme-${key}`);
    }

    // Update Mobile OS header status bar meta
    const themeMeta = document.getElementById('themeColorMeta') || document.querySelector('meta[name="theme-color"]');
    if (themeMeta && !document.body.classList.contains('dark-mode')) {
        themeMeta.setAttribute('content', theme.accent);
    }

    // Update Settings page indicators
    const themeTextEl = document.getElementById('currentThemeText');
    if (themeTextEl) themeTextEl.innerText = theme.name;

    const themeIconBox = document.getElementById('settingsThemeIconBox');
    if (themeIconBox) {
        themeIconBox.style.backgroundColor = theme.light;
        themeIconBox.style.color = theme.accent;
        themeIconBox.style.borderColor = theme.accent;
    }

    // Update Live Theme Preview card
    const previewBadge = document.getElementById('themeLivePreviewBadge');
    if (previewBadge) {
        previewBadge.innerHTML = `
            <span class="preview-badge-dot" style="background: ${theme.accent}; box-shadow: 0 0 10px ${theme.accent};"></span>
            <span class="preview-badge-name">${theme.name}</span>
            <span class="preview-badge-hex">${theme.accent.toUpperCase()}</span>
        `;
    }

    // Refresh active theme cards highlight
    document.querySelectorAll('.theme-card-premium').forEach(card => {
        if (card.dataset.theme === key) {
            card.classList.add('active-theme');
            card.setAttribute('aria-selected', 'true');
        } else {
            card.classList.remove('active-theme');
            card.setAttribute('aria-selected', 'false');
        }
    });

    // If not initial load and charts are initialized, redraw them to reflect theme accent changes
    if (!isInitial) {
        if (typeof rawTransactions !== 'undefined' && rawTransactions.length > 0) {
            if (typeof updateReportsPage === 'function') updateReportsPage();
        }
    }
};

window.renderThemeSettingsPage = function() {
    const container = document.getElementById('themePageList');
    if (!container) return;

    container.innerHTML = '';
    const currentKey = (currentThemeAccent === 'blue' ? 'sapphire' : (themePresets[currentThemeAccent] ? currentThemeAccent : 'sapphire'));

    Object.entries(themePresets).forEach(([key, theme], index) => {
        const isActive = (key === currentKey);
        const card = document.createElement('div');
        card.className = `theme-card-premium ${isActive ? 'active-theme' : ''}`;
        card.dataset.theme = key;
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-selected', isActive ? 'true' : 'false');
        card.style.animationDelay = `${index * 35}ms`;
        card.onclick = () => window.applyThemeAccent(key);
        card.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                window.applyThemeAccent(key);
            }
        };

        card.innerHTML = `
            <div class="theme-card-header">
                <div class="theme-color-swatches" aria-hidden="true">
                    <span class="theme-swatch main" style="background: ${theme.accent}; box-shadow: 0 2px 8px ${theme.glow};"></span>
                    <span class="theme-swatch dark" style="background: ${theme.dark};"></span>
                    <span class="theme-swatch light" style="background: ${theme.light}; border-color: ${theme.accent};"></span>
                </div>
                <div class="theme-header-actions">
                    <div class="theme-hex-badge">${theme.accent.toUpperCase()}</div>
                    <div class="theme-status-indicator" title="Selected"><i class="fa-solid fa-circle-check"></i></div>
                </div>
            </div>
            <div class="theme-info">
                <h4>${theme.name}</h4>
                <p class="theme-tagline">${theme.tagline}</p>
            </div>
        `;
        container.appendChild(card);
    });

    // Ensure preview is updated with active theme
    const activeTheme = themePresets[currentKey] || themePresets.sapphire;
    const previewBadge = document.getElementById('themeLivePreviewBadge');
    if (previewBadge) {
        previewBadge.innerHTML = `
            <span class="preview-badge-dot" style="background: ${activeTheme.accent}; box-shadow: 0 0 10px ${activeTheme.accent};"></span>
            <span class="preview-badge-name">${activeTheme.name}</span>
            <span class="preview-badge-hex">${activeTheme.accent.toUpperCase()}</span>
        `;
    }
};

function loadEnhancedPreferences() {
    applyThemeAccent(currentThemeAccent, true);
    const cachedRates = parseJSONSafe(localStorage.getItem('pocketly_rates') || '{}', {});
    exchangeRates = { ...FALLBACK_RATES, ...exchangeRates, ...cachedRates };

    categoryConfig = parseJSONSafe(localStorage.getItem('pocketly_category_config') || '{}', {});
    if (!Array.isArray(userCategories) || userCategories.length === 0) {
        userCategories = [...ENHANCED_DEFAULT_CATEGORIES];
    }
    ensureDefaultEnhancedCategories();
    syncCategoryIconMap();
    updateCurrencyText();
    updateCurrencyRateStatus();
    renderCurrencyOptions();
}

function ensureDefaultEnhancedCategories() {
    let changed = false;
    ENHANCED_DEFAULT_CATEGORIES.forEach((cat) => {
        if (!userCategories.includes(cat)) {
            userCategories.push(cat);
            changed = true;
        }
    });

    userCategories.forEach((cat) => {
        if (!categoryConfig[cat]) {
            categoryConfig[cat] = DEFAULT_CATEGORY_CONFIG[cat] || { icon: 'fa-box', color: '#64748b' };
            changed = true;
        } else {
            categoryConfig[cat] = {
                icon: categoryConfig[cat].icon || DEFAULT_CATEGORY_CONFIG[cat]?.icon || 'fa-box',
                color: categoryConfig[cat].color || DEFAULT_CATEGORY_CONFIG[cat]?.color || '#64748b'
            };
        }
    });

    if (changed) saveCategories();
}

function syncCategoryIconMap() {
    Object.keys(DEFAULT_CATEGORY_CONFIG).forEach((cat) => {
        CATEGORY_ICONS[cat] = DEFAULT_CATEGORY_CONFIG[cat].icon;
    });
    Object.keys(categoryConfig || {}).forEach((cat) => {
        if (categoryConfig[cat]?.icon) CATEGORY_ICONS[cat] = categoryConfig[cat].icon;
    });
}

function getCategoryConfig(category) {
    if (!categoryConfig[category]) {
        categoryConfig[category] = DEFAULT_CATEGORY_CONFIG[category] || { icon: CATEGORY_ICONS[category] || 'fa-box', color: '#64748b' };
    }
    return categoryConfig[category];
}

function getCategoryIcon(category) {
    return getCategoryConfig(category).icon || CATEGORY_ICONS[category] || 'fa-box';
}

function getCategoryColor(category) {
    return getCategoryConfig(category).color || '#64748b';
}

function saveCategories() {
    localStorage.setItem('pocketly_categories', JSON.stringify(userCategories));
    localStorage.setItem('pocketly_category_config', JSON.stringify(categoryConfig));
    syncCategoryIconMap();
}

function getCategoryIconLabel(iconClass) {
    const found = CATEGORY_ICON_CATALOG.find((item) => item.icon === iconClass);
    if (found) return found.label;
    const itemOld = CATEGORY_ICON_OPTIONS.find(([icon]) => icon === iconClass);
    if (itemOld) return itemOld[1];
    return (iconClass || 'fa-box').replace(/^fa-/, '').replace(/-/g, ' ');
}

function buildIconOptions(selectedIcon) {
    return CATEGORY_ICON_CATALOG.map((item) => {
        const selected = item.icon === selectedIcon ? 'selected' : '';
        return `<option value="${item.icon}" ${selected}>${escapeHTML(item.label)}</option>`;
    }).join('');
}

window.getCategoryIconLabel = getCategoryIconLabel;

// --- CATEGORY ICON PICKER MODAL CONTROLLER ---
let currentIconPickerTarget = null; // 'newCat' or category index
let currentIconPickerGroup = 'all';

const ICON_PICKER_GROUPS = [
    { id: 'all', label: 'All', icon: 'fa-border-all' },
    { id: 'food', label: 'Food', icon: 'fa-utensils' },
    { id: 'transport', label: 'Transport', icon: 'fa-car' },
    { id: 'shopping', label: 'Shopping', icon: 'fa-bag-shopping' },
    { id: 'bills', label: 'Bills', icon: 'fa-lightbulb' },
    { id: 'fun', label: 'Fun', icon: 'fa-gamepad' },
    { id: 'health', label: 'Health', icon: 'fa-heart-pulse' },
    { id: 'work', label: 'Work', icon: 'fa-briefcase' },
    { id: 'finance', label: 'Finance', icon: 'fa-wallet' },
    { id: 'other', label: 'Other', icon: 'fa-box' }
];

window.openCategoryIconPicker = function(target) {
    currentIconPickerTarget = target;
    const modal = document.getElementById('categoryIconPickerModal');
    if (!modal) return;

    let activeIcon = 'fa-box';
    if (target === 'newCat') {
        activeIcon = document.getElementById('newCatIcon')?.value || 'fa-box';
    } else if (typeof target === 'number') {
        activeIcon = document.getElementById(`catIcon-${target}`)?.value || 'fa-box';
    }

    renderIconPickerTabs();
    renderIconPickerGrid(activeIcon);

    const searchInput = document.getElementById('iconPickerSearchInput');
    if (searchInput) {
        searchInput.value = '';
        const clearBtn = document.getElementById('iconPickerSearchClear');
        if (clearBtn) clearBtn.style.display = 'none';
    }

    modal.classList.add('show');
    setTimeout(() => {
        if (searchInput) searchInput.focus();
    }, 120);
};

window.closeCategoryIconPicker = function() {
    const modal = document.getElementById('categoryIconPickerModal');
    if (modal) modal.classList.remove('show');
    currentIconPickerTarget = null;
};

// Auto close on backdrop click or Escape key
(() => {
    document.addEventListener('click', (e) => {
        const modal = document.getElementById('categoryIconPickerModal');
        if (modal && e.target === modal) {
            window.closeCategoryIconPicker();
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('categoryIconPickerModal');
            if (modal && modal.classList.contains('show')) {
                window.closeCategoryIconPicker();
            }
        }
    });
})();

window.selectCategoryIcon = function(iconClass) {
    const label = getCategoryIconLabel(iconClass);
    if (currentIconPickerTarget === 'newCat') {
        const hiddenInput = document.getElementById('newCatIcon');
        if (hiddenInput) hiddenInput.value = iconClass;
        const iconDisplay = document.getElementById('newCatIconDisplay');
        if (iconDisplay) iconDisplay.className = `fa-solid ${iconClass}`;
        const iconLabel = document.getElementById('newCatIconLabel');
        if (iconLabel) iconLabel.innerText = label;
        window.updateCatStudioPreview();
    } else if (typeof currentIconPickerTarget === 'number') {
        const index = currentIconPickerTarget;
        const hiddenInput = document.getElementById(`catIcon-${index}`);
        if (hiddenInput) hiddenInput.value = iconClass;
        const iconDisplay = document.getElementById(`catIconDisplay-${index}`);
        if (iconDisplay) iconDisplay.className = `fa-solid ${iconClass}`;
        const iconText = document.getElementById(`catIconText-${index}`);
        if (iconText) iconText.innerText = label;
        window.previewCategoryEdit(index);
        window.saveCategoryEdit(index);
    }
    window.closeCategoryIconPicker();
};

function renderIconPickerTabs() {
    const container = document.getElementById('iconPickerCategoryTabs');
    if (!container) return;
    container.innerHTML = ICON_PICKER_GROUPS.map(grp => `
        <button type="button" class="icon-picker-tab ${grp.id === currentIconPickerGroup ? 'active' : ''}" 
            onclick="setIconPickerGroup('${grp.id}')">
            <i class="fa-solid ${grp.icon}"></i>
            <span>${grp.label}</span>
        </button>
    `).join('');
}

window.setIconPickerGroup = function(group) {
    currentIconPickerGroup = group;
    renderIconPickerTabs();
    window.filterIconPickerGrid();
};

window.filterIconPickerGrid = function() {
    const searchInput = document.getElementById('iconPickerSearchInput');
    const query = (searchInput?.value || '').trim().toLowerCase();
    const clearBtn = document.getElementById('iconPickerSearchClear');
    if (clearBtn) clearBtn.style.display = query ? 'block' : 'none';

    let activeIcon = 'fa-box';
    if (currentIconPickerTarget === 'newCat') {
        activeIcon = document.getElementById('newCatIcon')?.value || 'fa-box';
    } else if (typeof currentIconPickerTarget === 'number') {
        activeIcon = document.getElementById(`catIcon-${currentIconPickerTarget}`)?.value || 'fa-box';
    }

    renderIconPickerGrid(activeIcon, query);
};

window.clearIconPickerSearch = function() {
    const searchInput = document.getElementById('iconPickerSearchInput');
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
    }
    window.filterIconPickerGrid();
};

function renderIconPickerGrid(activeIcon = 'fa-box', searchQuery = '') {
    const grid = document.getElementById('iconPickerGrid');
    if (!grid) return;

    let items = CATEGORY_ICON_CATALOG;
    if (currentIconPickerGroup !== 'all') {
        items = items.filter(item => item.group === currentIconPickerGroup);
    }
    if (searchQuery) {
        items = items.filter(item => 
            item.label.toLowerCase().includes(searchQuery) || 
            item.icon.toLowerCase().includes(searchQuery) ||
            item.group.toLowerCase().includes(searchQuery)
        );
    }

    if (items.length === 0) {
        grid.innerHTML = `
            <div class="icon-picker-empty">
                <i class="fa-solid fa-icons"></i>
                <p>No icons found for "${escapeHTML(searchQuery)}"</p>
                <button type="button" class="btn-secondary" style="font-size:0.78rem; padding:5px 14px; margin-top:8px;" onclick="clearIconPickerSearch()">Clear Search</button>
            </div>
        `;
        return;
    }

    grid.innerHTML = items.map(item => {
        const isSelected = item.icon === activeIcon;
        return `
            <button type="button" class="icon-picker-item ${isSelected ? 'selected' : ''}" 
                onclick="selectCategoryIcon('${item.icon}')" title="${escapeHTML(item.label)}">
                <div class="icon-picker-symbol">
                    <i class="fa-solid ${item.icon}"></i>
                </div>
                <span class="icon-picker-label">${escapeHTML(item.label)}</span>
                ${isSelected ? '<span class="icon-picker-check"><i class="fa-solid fa-check"></i></span>' : ''}
            </button>
        `;
    }).join('');
}

window.updateCatStudioPreview = function() {
    const name = document.getElementById('newCatName')?.value.trim() || 'Preview';
    const icon = document.getElementById('newCatIcon')?.value || 'fa-box';
    const color = document.getElementById('newCatColor')?.value || '#2563eb';
    
    const dot = document.getElementById('catStudioDot');
    const label = document.getElementById('catStudioLabel');
    if (dot) {
        dot.style.background = color;
        dot.innerHTML = `<i class="fa-solid ${icon}"></i>`;
    }
    if (label) {
        label.innerText = name;
    }
    const colorSwatch = document.getElementById('newCatColorSwatch');
    if (colorSwatch) colorSwatch.style.background = color;
    const colorLabel = document.getElementById('newCatColorLabel');
    if (colorLabel) colorLabel.innerText = getCategoryColorName(color);
};

function setupNewCategoryControls() {
    const hiddenInput = document.getElementById('newCatIcon');
    const icon = hiddenInput?.value || 'fa-box';
    const iconDisplay = document.getElementById('newCatIconDisplay');
    if (iconDisplay) iconDisplay.className = `fa-solid ${icon}`;
    const iconLabel = document.getElementById('newCatIconLabel');
    if (iconLabel) iconLabel.innerText = getCategoryIconLabel(icon);

    const hiddenColor = document.getElementById('newCatColor');
    const color = hiddenColor?.value || '#2563eb';
    const colorSwatch = document.getElementById('newCatColorSwatch');
    if (colorSwatch) colorSwatch.style.background = color;
    const colorLabel = document.getElementById('newCatColorLabel');
    if (colorLabel) colorLabel.innerText = getCategoryColorName(color);

    window.updateCatStudioPreview();
}

function renderManageCategories() {
    ensureDefaultEnhancedCategories();
    setupNewCategoryControls();
    const list = document.getElementById('manageCategoryList');
    if (!list) return;

    const tFunc = (window.PocketlyI18n && typeof window.PocketlyI18n.t === 'function')
        ? window.PocketlyI18n.t
        : (k, fb) => fb;

    list.innerHTML = '';
    userCategories.forEach((cat, index) => {
        const config = getCategoryConfig(cat);
        const isSystem = (typeof SYSTEM_CATEGORIES !== 'undefined' && SYSTEM_CATEGORIES.includes(cat));
        const safeCat = escapeHTML(cat);
        const disabledName = isSystem ? 'disabled' : '';
        const deleteOrLock = isSystem
            ? `<span class="category-system-lock" title="${tFunc('action_system_category', 'System Category')}"><i class="fa-solid fa-lock"></i></span>`
            : `<button class="btn-delete-cat" onclick="deleteCategory(${index})" title="${tFunc('btn_delete', 'Delete')}"><i class="fa-solid fa-trash-can"></i></button>`;

        const saveButton = `<button type="button" class="btn-save-cat icon-only" onclick="saveCategoryEdit(${index})" title="${tFunc('action_save_changes', 'Save changes')}" aria-label="${tFunc('action_save_changes', 'Save changes')}"><i class="fa-solid fa-check"></i></button>`;

        list.innerHTML += `
            <div class="cat-manage-item enhanced">
                <div class="cat-card-header-row">
                    <div class="cat-icon-preview clickable-icon-badge" id="catPreview-${index}" style="background:${config.color};" onclick="openCategoryColorPicker(${index})" title="${tFunc('action_change_color', 'Change color')}">
                        <i class="fa-solid ${config.icon}"></i>
                    </div>
                    <input class="cat-name-input" id="catName-${index}" value="${safeCat}" ${disabledName} placeholder="Category Name" onchange="saveCategoryEdit(${index})">
                    <div class="cat-action-end">
                        ${saveButton}
                        ${deleteOrLock}
                    </div>
                </div>
                <div class="cat-card-controls-row">
                    <div class="cat-card-pickers-grid">
                        <div class="cat-picker-cell">
                            <button type="button" class="cat-icon-select-trigger mini" onclick="openCategoryIconPicker(${index})" title="${tFunc('action_change_icon', 'Change icon')}">
                                <span class="icon-trigger-badge mini"><i class="fa-solid ${config.icon}" id="catIconDisplay-${index}"></i></span>
                                <span class="icon-trigger-label" id="catIconText-${index}">${escapeHTML(getCategoryIconLabel(config.icon))}</span>
                                <i class="fa-solid fa-chevron-down icon-trigger-chevron"></i>
                            </button>
                            <input type="hidden" id="catIcon-${index}" value="${config.icon}">
                        </div>
                        <div class="cat-picker-cell">
                            <button type="button" class="cat-color-select-trigger mini" id="catColorBtn-${index}" onclick="openCategoryColorPicker(${index})" title="${tFunc('action_change_color', 'Change color')}">
                                <span class="color-trigger-swatch mini" id="catColorSwatch-${index}" style="background:${config.color};"></span>
                                <span class="color-trigger-label" id="catColorLabel-${index}">${escapeHTML(getCategoryColorName(config.color))}</span>
                                <i class="fa-solid fa-chevron-down color-trigger-chevron"></i>
                            </button>
                            <input type="hidden" id="catColor-${index}" value="${config.color}">
                        </div>
                    </div>
                </div>
            </div>`;
    });

    const countEl = document.getElementById('categoryCountText');
    if (countEl) countEl.innerText = `${userCategories.length} ${tFunc('categories_unit', 'categories')}`;
}

window.previewCategoryEdit = function(index) {
    const icon = document.getElementById(`catIcon-${index}`)?.value || 'fa-box';
    const color = document.getElementById(`catColor-${index}`)?.value || '#64748b';
    const preview = document.getElementById(`catPreview-${index}`);
    if (preview) {
        preview.style.background = color;
        preview.innerHTML = `<i class="fa-solid ${icon}"></i>`;
    }
    const colorSwatch = document.getElementById(`catColorSwatch-${index}`);
    if (colorSwatch) colorSwatch.style.background = color;
    const colorLabel = document.getElementById(`catColorLabel-${index}`);
    if (colorLabel) colorLabel.innerText = getCategoryColorName(color);
};

// --- Category Color Picker Suite ---
const CURATED_CATEGORY_COLORS = [
    { name: 'Sapphire Blue', hex: '#2563eb' },
    { name: 'Sky Blue', hex: '#3b82f6' },
    { name: 'Ocean Cyan', hex: '#0284c7' },
    { name: 'Aqua Teal', hex: '#06b6d4' },
    { name: 'Deep Teal', hex: '#0d9488' },
    { name: 'Emerald Green', hex: '#10b981' },
    { name: 'Forest Green', hex: '#059669' },
    { name: 'Mint Green', hex: '#16a34a' },
    { name: 'Lime', hex: '#84cc16' },
    { name: 'Warm Amber', hex: '#f59e0b' },
    { name: 'Sun Gold', hex: '#eab308' },
    { name: 'Sunset Orange', hex: '#f97316' },
    { name: 'Tangerine', hex: '#ea580c' },
    { name: 'Coral Red', hex: '#ef4444' },
    { name: 'Ruby Red', hex: '#dc2626' },
    { name: 'Rose', hex: '#e11d48' },
    { name: 'Crimson', hex: '#f43f5e' },
    { name: 'Hot Pink', hex: '#ec4899' },
    { name: 'Fuchsia', hex: '#d946ef' },
    { name: 'Violet', hex: '#a855f7' },
    { name: 'Purple', hex: '#8b5cf6' },
    { name: 'Indigo', hex: '#6366f1' },
    { name: 'Slate Grey', hex: '#64748b' },
    { name: 'Obsidian', hex: '#334155' }
];

function getCategoryColorName(hex) {
    if (!hex) return 'Blue';
    const normalized = hex.toLowerCase();
    const match = CURATED_CATEGORY_COLORS.find(c => c.hex.toLowerCase() === normalized);
    return match ? match.name : hex.toUpperCase();
}

let currentColorPickerTarget = null;
let colorPickerInitialState = null;
let colorPickerDraftHex = null;

window.openCategoryColorPicker = function(target) {
    currentColorPickerTarget = target;
    const modal = document.getElementById('categoryColorPickerModal');
    if (!modal) return;

    let activeHex = '#2563eb';
    let activeIcon = 'fa-box';

    if (target === 'newCat') {
        activeHex = document.getElementById('newCatColor')?.value || '#2563eb';
        activeIcon = document.getElementById('newCatIcon')?.value || 'fa-box';
    } else if (typeof target === 'number') {
        activeHex = document.getElementById(`catColor-${target}`)?.value || '#2563eb';
        activeIcon = document.getElementById(`catIcon-${target}`)?.value || 'fa-box';
    }

    if (!activeHex.startsWith('#')) activeHex = '#' + activeHex;

    // Save initial state so we can fully revert if closed without clicking "Done"
    colorPickerInitialState = {
        target: target,
        hex: activeHex,
        name: getCategoryColorName(activeHex),
        icon: activeIcon
    };
    colorPickerDraftHex = activeHex;

    updateColorPickerPreview(activeHex, activeIcon);
    syncStudioSlidersToHex(activeHex);
    renderVibrantTones(activeHex);

    const hexInput = document.getElementById('customColorHexInput');
    if (hexInput) hexInput.value = activeHex.replace('#', '').toUpperCase();

    modal.classList.add('show');
};

function updateColorPickerPreview(hex, iconClass) {
    const dot = document.getElementById('colorPickerPreviewDot');
    const iconEl = document.getElementById('colorPickerPreviewIcon');
    const nameEl = document.getElementById('colorPickerPreviewName');
    const hexEl = document.getElementById('colorPickerPreviewHex');

    if (dot) dot.style.background = hex;
    if (iconEl && iconClass) iconEl.className = `fa-solid ${iconClass}`;
    if (nameEl) nameEl.innerText = getCategoryColorName(hex);
    if (hexEl) hexEl.innerText = hex.toUpperCase();
}

function renderColorPickerSwatches(activeHex) {
    // Top curated swatches removed in favor of Custom Color Studio and Vibrant Spectrum
}

const VIBRANT_SPECTRUM_COLORS = [
    { hex: '#ef4444', name: 'Crimson Red' },
    { hex: '#f97316', name: 'Sunset Orange' },
    { hex: '#f59e0b', name: 'Amber Gold' },
    { hex: '#84cc16', name: 'Lime Zest' },
    { hex: '#10b981', name: 'Emerald Green' },
    { hex: '#14b8a6', name: 'Teal Gem' },
    { hex: '#06b6d4', name: 'Electric Cyan' },
    { hex: '#0284c7', name: 'Sky Blue' },
    { hex: '#2563eb', name: 'Sapphire Blue' },
    { hex: '#6366f1', name: 'Indigo Dream' },
    { hex: '#8b5cf6', name: 'Royal Violet' },
    { hex: '#d946ef', name: 'Fuchsia Neon' },
    { hex: '#ec4899', name: 'Hot Pink' },
    { hex: '#64748b', name: 'Slate Gray' },
    { hex: '#1e293b', name: 'Obsidian' },
    { hex: '#78350f', name: 'Bronze Wood' }
];

let currentPickerHue = 220;
let currentPickerLightness = 53;

function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex) {
    let c = (hex || '').replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    if (c.length !== 6) return { h: 220, s: 80, l: 53 };
    const r = parseInt(c.substring(0, 2), 16) / 255;
    const g = parseInt(c.substring(2, 4), 16) / 255;
    const b = parseInt(c.substring(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h = Math.round(h * 60);
    }
    s = Math.round(s * 100);
    l = Math.round(l * 100);
    return { h: (h + 360) % 360, s, l };
}

window.handleHueSliderChange = function(hueVal) {
    currentPickerHue = parseInt(hueVal, 10) || 0;
    const hueDisplay = document.getElementById('hueValueDisplay');
    if (hueDisplay) hueDisplay.innerText = `${currentPickerHue}°`;
    updateStudioSlidersBackground();
    applyStudioColorFromSliders();
};

window.handleLightnessSliderChange = function(lightVal) {
    currentPickerLightness = parseInt(lightVal, 10) || 50;
    const lightDisplay = document.getElementById('lightnessValueDisplay');
    if (lightDisplay) lightDisplay.innerText = `${currentPickerLightness}%`;
    applyStudioColorFromSliders();
};

function updateStudioSlidersBackground() {
    const lightSlider = document.getElementById('customLightnessSlider');
    if (lightSlider) {
        lightSlider.style.background = `linear-gradient(to right, #0b0f19, hsl(${currentPickerHue}, 85%, 50%), #ffffff)`;
    }
}

function applyStudioColorFromSliders() {
    const hex = hslToHex(currentPickerHue, 85, currentPickerLightness);
    const hexInput = document.getElementById('customColorHexInput');
    if (hexInput && document.activeElement !== hexInput) {
        hexInput.value = hex.replace('#', '').toUpperCase();
    }
    window.setCategoryColorDraft(hex, getCategoryColorName(hex), false);
    highlightVibrantTone(hex);
}

window.handleCustomColorHexInput = function(val) {
    const clean = val.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    const hexInput = document.getElementById('customColorHexInput');
    if (hexInput && hexInput.value !== clean) {
        hexInput.value = clean;
    }
    if (clean.length === 6) {
        const hex = '#' + clean;
        syncStudioSlidersToHex(hex);
        window.setCategoryColorDraft(hex, getCategoryColorName(hex), false);
        highlightVibrantTone(hex);
    }
};

function syncStudioSlidersToHex(hex) {
    const { h, l } = hexToHsl(hex);
    currentPickerHue = h;
    currentPickerLightness = Math.min(85, Math.max(15, l));

    const hueSlider = document.getElementById('customHueSlider');
    const lightSlider = document.getElementById('customLightnessSlider');
    const hueDisplay = document.getElementById('hueValueDisplay');
    const lightDisplay = document.getElementById('lightnessValueDisplay');

    if (hueSlider) hueSlider.value = String(currentPickerHue);
    if (lightSlider) lightSlider.value = String(currentPickerLightness);
    if (hueDisplay) hueDisplay.innerText = `${currentPickerHue}°`;
    if (lightDisplay) lightDisplay.innerText = `${currentPickerLightness}%`;

    updateStudioSlidersBackground();
}

function renderVibrantTones(activeHex) {
    const container = document.getElementById('vibrantTonesGrid');
    if (!container) return;
    const norm = (activeHex || '').toLowerCase();
    container.innerHTML = VIBRANT_SPECTRUM_COLORS.map(c => {
        const isSelected = c.hex.toLowerCase() === norm;
        return `
            <button type="button" class="vibrant-tone-btn ${isSelected ? 'active' : ''}"
                data-hex="${c.hex.toLowerCase()}"
                style="background: ${c.hex};"
                onclick="selectVibrantTone('${c.hex}', '${escapeHTML(c.name)}')"
                title="${escapeHTML(c.name)}" aria-label="${escapeHTML(c.name)}">
            </button>
        `;
    }).join('');
}

window.selectVibrantTone = function(hex, name) {
    if (window.PocketlyAudio && typeof window.PocketlyAudio.playCardTap === 'function') {
        window.PocketlyAudio.playCardTap();
    }
    syncStudioSlidersToHex(hex);
    const hexInput = document.getElementById('customColorHexInput');
    if (hexInput) hexInput.value = hex.replace('#', '').toUpperCase();
    window.setCategoryColorDraft(hex, name || getCategoryColorName(hex), false);
    highlightVibrantTone(hex);
};

function highlightVibrantTone(hex) {
    const norm = (hex || '').toLowerCase();
    document.querySelectorAll('.vibrant-tone-btn').forEach(btn => {
        const btnHex = (btn.getAttribute('data-hex') || '').toLowerCase();
        btn.classList.toggle('active', btnHex === norm);
    });
}

// Update the draft color selection and live UI preview, WITHOUT committing to database
window.setCategoryColorDraft = function(hex, name, updateSliders = true) {
    if (!hex) return;
    if (!hex.startsWith('#')) hex = '#' + hex;
    colorPickerDraftHex = hex;

    let activeIcon = 'fa-box';
    if (currentColorPickerTarget === 'newCat') {
        const hiddenInput = document.getElementById('newCatColor');
        if (hiddenInput) hiddenInput.value = hex;
        const swatch = document.getElementById('newCatColorSwatch');
        if (swatch) swatch.style.background = hex;
        const label = document.getElementById('newCatColorLabel');
        if (label) label.innerText = name || getCategoryColorName(hex);
        activeIcon = document.getElementById('newCatIcon')?.value || 'fa-box';
        if (typeof window.updateCatStudioPreview === 'function') window.updateCatStudioPreview();
    } else if (typeof currentColorPickerTarget === 'number') {
        const index = currentColorPickerTarget;
        const hiddenInput = document.getElementById(`catColor-${index}`);
        if (hiddenInput) hiddenInput.value = hex;
        const swatch = document.getElementById(`catColorSwatch-${index}`);
        if (swatch) swatch.style.background = hex;
        const label = document.getElementById(`catColorLabel-${index}`);
        if (label) label.innerText = name || getCategoryColorName(hex);
        activeIcon = document.getElementById(`catIcon-${index}`)?.value || 'fa-box';
        if (typeof window.previewCategoryEdit === 'function') window.previewCategoryEdit(index);
    }

    updateColorPickerPreview(hex, activeIcon);

    if (updateSliders) {
        syncStudioSlidersToHex(hex);
        highlightVibrantTone(hex);
    }

    const hexInput = document.getElementById('customColorHexInput');
    if (hexInput && document.activeElement !== hexInput) {
        hexInput.value = hex.replace('#', '').toUpperCase();
    }
};

// Backwards-compatibility aliases
window.selectCategoryColor = function(hex, name) {
    window.setCategoryColorDraft(hex, name, true);
};
window.handleCustomColorNative = function(hex) {
    window.setCategoryColorDraft(hex, getCategoryColorName(hex), true);
};
window.handleCustomColorCommit = function(hex) {
    window.setCategoryColorDraft(hex, getCategoryColorName(hex), true);
};
window.handleCustomColorHex = function(val) {
    window.handleCustomColorHexInput(val);
};

// CONFIRM & SAVE: Only saves when user explicitly clicks "Done"
window.commitAndCloseCategoryColorPicker = function() {
    const modal = document.getElementById('categoryColorPickerModal');
    const finalHex = colorPickerDraftHex || (colorPickerInitialState ? colorPickerInitialState.hex : '#2563eb');
    const finalName = getCategoryColorName(finalHex);

    if (currentColorPickerTarget === 'newCat') {
        const hiddenInput = document.getElementById('newCatColor');
        if (hiddenInput) hiddenInput.value = finalHex;
        const swatch = document.getElementById('newCatColorSwatch');
        if (swatch) swatch.style.background = finalHex;
        const label = document.getElementById('newCatColorLabel');
        if (label) label.innerText = finalName;
        if (typeof window.updateCatStudioPreview === 'function') window.updateCatStudioPreview();
    } else if (typeof currentColorPickerTarget === 'number') {
        const index = currentColorPickerTarget;
        const hiddenInput = document.getElementById(`catColor-${index}`);
        if (hiddenInput) hiddenInput.value = finalHex;
        const swatch = document.getElementById(`catColorSwatch-${index}`);
        if (swatch) swatch.style.background = finalHex;
        const label = document.getElementById(`catColorLabel-${index}`);
        if (label) label.innerText = finalName;
        if (typeof window.previewCategoryEdit === 'function') window.previewCategoryEdit(index);

        // SAVE TO DATABASE / LOCALSTORAGE NOW!
        if (typeof window.saveCategoryEdit === 'function') {
            window.saveCategoryEdit(index);
        }
    }

    // Reset initial state so subsequent close won't revert
    colorPickerInitialState = null;
    colorPickerDraftHex = null;
    currentColorPickerTarget = null;

    if (modal) modal.classList.remove('show');
};

// DISCARD / REVERT: Runs when user closes (X button, backdrop click, Escape key)
window.closeCategoryColorPicker = function() {
    const modal = document.getElementById('categoryColorPickerModal');

    // If there is an active uncommitted initial state, REVERT to original color
    if (colorPickerInitialState) {
        const { target, hex, name } = colorPickerInitialState;
        if (target === 'newCat') {
            const hiddenInput = document.getElementById('newCatColor');
            if (hiddenInput) hiddenInput.value = hex;
            const swatch = document.getElementById('newCatColorSwatch');
            if (swatch) swatch.style.background = hex;
            const label = document.getElementById('newCatColorLabel');
            if (label) label.innerText = name;
            if (typeof window.updateCatStudioPreview === 'function') window.updateCatStudioPreview();
        } else if (typeof target === 'number') {
            const index = target;
            const hiddenInput = document.getElementById(`catColor-${index}`);
            if (hiddenInput) hiddenInput.value = hex;
            const swatch = document.getElementById(`catColorSwatch-${index}`);
            if (swatch) swatch.style.background = hex;
            const label = document.getElementById(`catColorLabel-${index}`);
            if (label) label.innerText = name;
            if (typeof window.previewCategoryEdit === 'function') window.previewCategoryEdit(index);
        }
        // Do NOT call saveCategoryEdit!
    }

    colorPickerInitialState = null;
    colorPickerDraftHex = null;
    currentColorPickerTarget = null;

    if (modal) modal.classList.remove('show');
};

// Auto close on backdrop click or Escape key for color picker
(() => {
    document.addEventListener('click', (e) => {
        const modal = document.getElementById('categoryColorPickerModal');
        if (modal && e.target === modal) {
            window.closeCategoryColorPicker();
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('categoryColorPickerModal');
            if (modal && modal.classList.contains('show')) {
                window.closeCategoryColorPicker();
            }
        }
    });
})();

async function renameCategoryInData(oldName, newName) {
    if (!currentUser || oldName === newName) return;
    const batchJobs = [];

    rawTransactions
        .filter((t) => t.uid === currentUser.uid && t.category === oldName && t.id)
        .forEach((t) => batchJobs.push({ ref: doc(db, 'transactions', t.id), data: { category: newName } }));

    rawBudgets
        .filter((b) => b.uid === currentUser.uid && b.type === 'budget' && b.name === oldName && b.id)
        .forEach((b) => batchJobs.push({ ref: doc(db, 'budgets', b.id), data: { name: newName, updatedAt: new Date().toISOString() } }));

    for (let i = 0; i < batchJobs.length; i += 400) {
        const batch = writeBatch(db);
        batchJobs.slice(i, i + 400).forEach((job) => batch.update(job.ref, job.data));
        await batch.commit();
    }
}

window.saveCategoryEdit = async function(index) {
    const oldName = userCategories[index];
    if (!oldName) return;
    const isSystem = SYSTEM_CATEGORIES.includes(oldName);
    const nameInput = document.getElementById(`catName-${index}`);
    const iconInput = document.getElementById(`catIcon-${index}`);
    const colorInput = document.getElementById(`catColor-${index}`);

    const newName = isSystem ? oldName : (nameInput?.value || '').trim();
    const newIcon = iconInput?.value || 'fa-box';
    const newColor = colorInput?.value || '#64748b';

    if (!newName) return showAlert('Category name cannot be empty.', true);
    if (!isSystem && userCategories.some((cat, i) => i !== index && cat.toLowerCase() === newName.toLowerCase())) {
        return showAlert('Category already exists.', true);
    }

    try {
        if (oldName !== newName) {
            await renameCategoryInData(oldName, newName);
            delete categoryConfig[oldName];
            userCategories[index] = newName;
        }
        categoryConfig[newName] = { icon: newIcon, color: newColor };
        saveCategories();
        populateCategorySelects();
        renderManageCategories();
        refreshAllMoneyDisplays();
        showAlert('Category updated.', false);
    } catch (error) {
        console.error(error);
        showAlert('Failed to update category: ' + error.message, true);
    }
};

window.addNewCategory = function() {
    const input = document.getElementById('newCatName');
    const iconInput = document.getElementById('newCatIcon');
    const colorInput = document.getElementById('newCatColor');
    const name = (input?.value || '').trim();
    const icon = iconInput?.value || 'fa-box';
    const color = colorInput?.value || '#3b82f6';

    if (!name) return showAlert('Category name cannot be empty.', true);
    if (userCategories.some((cat) => cat.toLowerCase() === name.toLowerCase())) {
        return showAlert('Category already exists.', true);
    }

    userCategories.push(name);
    categoryConfig[name] = { icon, color };
    saveCategories();
    if (input) input.value = '';
    const newCatIconEl = document.getElementById('newCatIcon');
    if (newCatIconEl) newCatIconEl.value = 'fa-box';
    const newCatIconDisplay = document.getElementById('newCatIconDisplay');
    if (newCatIconDisplay) newCatIconDisplay.className = 'fa-solid fa-box';
    const newCatIconLabel = document.getElementById('newCatIconLabel');
    if (newCatIconLabel) newCatIconLabel.innerText = 'Box';
    if (colorInput) colorInput.value = '#3b82f6';
    renderManageCategories();
    populateCategorySelects();
    window.updateCatStudioPreview();
    showAlert('Category added.', false);
};

window.deleteCategory = function(index) {
    const catName = userCategories[index];
    if (!catName || SYSTEM_CATEGORIES.includes(catName)) return;
    showConfirm(
        'Delete Category?',
        `Delete "${catName}" from your category list? Existing transactions will keep their old label.`,
        'Delete',
        () => {
            userCategories.splice(index, 1);
            delete categoryConfig[catName];
            saveCategories();
            renderManageCategories();
            populateCategorySelects();
            refreshAllMoneyDisplays();
        }
    );
};

function populateCategorySelects() {
    ensureDefaultEnhancedCategories();
    const transSelect = document.getElementById('inputCategory');
    const filterSelect = document.getElementById('transFilterCategory');
    const budgetSelect = document.getElementById('budgetCategorySelect');

    const optionLabel = (cat) => {
        const config = getCategoryConfig(cat);
        const item = CATEGORY_ICON_OPTIONS.find(([icon]) => icon === config.icon);
        const prefix = item ? item[1] : 'Category';
        const translatedCat = (window.PocketlyI18n && typeof window.PocketlyI18n.translateCategory === 'function')
            ? window.PocketlyI18n.translateCategory(cat)
            : cat;
        return `${prefix} - ${translatedCat}`;
    };

    const generateOptions = (includeAll = false, forBudget = false) => {
        const allText = (window.PocketlyI18n && window.PocketlyI18n.t('opt_all_categories')) || 'All Categories';
        const selText = (window.PocketlyI18n && window.PocketlyI18n.t('trans_select_category_placeholder')) || 'Select Category';
        let html = includeAll 
            ? `<option value="all" data-i18n="opt_all_categories">${allText}</option>` 
            : `<option value="" disabled selected data-i18n="trans_select_category_placeholder">${selText}</option>`;
        const list = forBudget 
            ? userCategories.filter(c => c !== 'Salary' && c !== 'Investment' && c !== 'Transfer' && c !== 'Adjustment')
            : userCategories;
        list.forEach((cat) => {
            html += `<option value="${escapeHTML(cat)}">${escapeHTML(optionLabel(cat))}</option>`;
        });
        return html;
    };

    if (transSelect) transSelect.innerHTML = generateOptions(false, false);
    if (filterSelect) filterSelect.innerHTML = generateOptions(true, false);
    if (budgetSelect) budgetSelect.innerHTML = generateOptions(false, true);
    setTimeout(initCustomSelects, 100);
}

function updateCurrencyText() {
    const meta = CURRENCY_META[currentCurrency] || CURRENCY_META.IDR;
    const textEl = document.getElementById('currentCurrencyText');
    if (textEl) textEl.innerText = `${currentCurrency} (${meta.symbol})`;

    const currentNameEl = document.getElementById('currentCurrencyName');
    if (currentNameEl) currentNameEl.innerText = `${meta.name} - ${meta.country || currentCurrency}`;

    const selectedBadge = document.getElementById('selectedCurrencyBadge');
    if (selectedBadge) selectedBadge.innerText = `${currentCurrency} ${meta.symbol}`;

    document.querySelectorAll('.currency-item').forEach((item) => {
        const code = item.dataset.currency;
        item.classList.toggle('active-currency', code === currentCurrency);
    });

    if (typeof updateFormCurrencyIndicators === 'function') {
        updateFormCurrencyIndicators();
    }
}

function formatCurrencySample(code, amountInIdr = 100000) {
    const meta = CURRENCY_META[code] || CURRENCY_META.IDR;
    const rate = Number(exchangeRates[code]) || Number(FALLBACK_RATES[code]) || 1;
    const value = amountInIdr * rate;
    return new Intl.NumberFormat(meta.locale || 'en-US', {
        style: 'currency',
        currency: code,
        minimumFractionDigits: meta.decimals,
        maximumFractionDigits: meta.decimals
    }).format(value);
}

function getCurrencyFlagUrl(code) {
    const meta = CURRENCY_META[code] || {};
    const code2 = (meta.code2 || (code ? code.substring(0, 2) : 'id')).toLowerCase();
    return `https://flagcdn.com/w40/${code2}.png`;
}
window.getCurrencyFlagUrl = getCurrencyFlagUrl;

function renderCurrencyOptions() {
    const list = document.getElementById('currencyPageList');
    if (!list) return;
    const search = (document.getElementById('currencySearchInput')?.value || '').toLowerCase().trim();
    const entries = Object.entries(CURRENCY_META).filter(([code, meta]) => {
        const haystack = `${code} ${meta.name} ${meta.country || ''} ${meta.symbol}`.toLowerCase();
        return !search || haystack.includes(search);
    });

    const tFunc = (window.PocketlyI18n && typeof window.PocketlyI18n.t === 'function')
        ? window.PocketlyI18n.t
        : (k, fb) => fb;

    const countEl = document.getElementById('currencyCountText');
    if (countEl) countEl.innerText = `${entries.length} ${tFunc('currencies_available', 'currencies available')}`;

    if (entries.length === 0) {
        list.innerHTML = `<div class="currency-empty-state"><i class="fa-solid fa-magnifying-glass"></i><p>${tFunc('no_currency_found', 'No currency found.')}</p></div>`;
        return;
    }

    list.innerHTML = entries.map(([code, meta]) => {
        const isActive = code === currentCurrency;
        const rate = Number(exchangeRates[code]) || Number(FALLBACK_RATES[code]) || 1;
        let ratePreview = '';
        if (code === 'IDR') {
            ratePreview = `${tFunc('base_currency', 'Base Currency')} (1.00)`;
        } else {
            const idrPerUnit = (1 / rate);
            ratePreview = `1 ${code} ≈ ${idrPerUnit >= 1 ? Math.round(idrPerUnit).toLocaleString('id-ID') : idrPerUnit.toFixed(4)} IDR`;
        }

        return `
            <button type="button" class="currency-premium-card ${isActive ? 'active-currency' : ''}" data-currency="${code}" onclick="changeCurrency('${code}', '${escapeForJsString(meta.symbol)}', '${escapeForJsString(meta.locale)}')">
                <div class="currency-flag-circle">
                    <img src="${getCurrencyFlagUrl(code)}" alt="${code}" class="currency-flag-img" loading="lazy">
                </div>
                <div class="currency-card-main">
                    <div class="currency-header-line">
                        <span class="currency-code-pill">${code}</span>
                        <span class="currency-title-name">${escapeHTML(meta.name)}</span>
                    </div>
                    <div class="currency-detail-line">
                        <span class="currency-country-name">${escapeHTML(meta.country || code)}</span>
                        <span class="currency-dot-separator">&bull;</span>
                        <span class="currency-rate-snippet">${ratePreview}</span>
                    </div>
                </div>
                <div class="currency-select-status">
                    ${isActive ? `<span class="currency-active-indicator"><i class="fa-solid fa-circle-check"></i> ${tFunc('active_status', 'Active')}</span>` : '<i class="fa-solid fa-chevron-right currency-arrow-icon"></i>'}
                </div>
            </button>`;
    }).join('');
    updateCurrencyText();
}

function updateCurrencyRateStatus(message = '') {
    const statusEl = document.getElementById('currencyRateStatus');
    if (!statusEl) return;
    if (message) {
        statusEl.innerText = message;
        return;
    }
    const updatedAt = localStorage.getItem('pocketly_rates_updated_at');
    if (updatedAt) {
        const dateText = new Date(updatedAt).toLocaleString(currentLocale || 'id-ID', { dateStyle: 'medium', timeStyle: 'short' });
        statusEl.innerText = `Last synced: ${dateText}. Base currency: IDR.`;
    } else {
        statusEl.innerText = 'Using fallback rates until the first sync completes.';
    }
}

async function fetchLiveRates(force = false) {
    const cachedRates = parseJSONSafe(localStorage.getItem('pocketly_rates') || '{}', {});
    if (Object.keys(cachedRates).length > 0) {
        exchangeRates = { ...FALLBACK_RATES, ...cachedRates };
    } else {
        exchangeRates = { ...FALLBACK_RATES, ...exchangeRates };
    }

    updateCurrencyRateStatus('Syncing live exchange rates...');

    try {
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/IDR', { cache: force ? 'reload' : 'default' });
        if (!response.ok) throw new Error(`Rate server returned ${response.status}`);
        const data = await response.json();
        if (!data || !data.rates) throw new Error('Invalid rate response');
        exchangeRates = { ...FALLBACK_RATES, ...data.rates, IDR: 1 };
        localStorage.setItem('pocketly_rates', JSON.stringify(exchangeRates));
        localStorage.setItem('pocketly_rates_updated_at', new Date().toISOString());
        updateCurrencyRateStatus();
        renderCurrencyOptions();
        refreshAllMoneyDisplays();
        return exchangeRates;
    } catch (error) {
        console.warn('Live rate sync failed:', error);
        const updatedAt = localStorage.getItem('pocketly_rates_updated_at');
        updateCurrencyRateStatus(updatedAt ? 'Live sync failed. Using cached exchange rates.' : 'Live sync failed. Using fallback exchange rates.');
        renderCurrencyOptions();
        return exchangeRates;
    }
}

function formatRupiah(num) {
    if (isPrivacyMode) {
        const symbol = (currentCurrency === 'IDR') ? 'Rp' : (currentCurrency === 'USD' ? '$' : (currentCurrency === 'EUR' ? '€' : currentCurrency));
        return `${symbol} ••••••••`;
    }
    const meta = CURRENCY_META[currentCurrency] || CURRENCY_META.IDR;
    const rate = Number(exchangeRates[currentCurrency]) || Number(FALLBACK_RATES[currentCurrency]) || 1;
    const convertedValue = Number(num || 0) * rate;
    return new Intl.NumberFormat(currentLocale || meta.locale, {
        style: 'currency',
        currency: currentCurrency,
        minimumFractionDigits: meta.decimals,
        maximumFractionDigits: meta.decimals
    }).format(convertedValue);
}

function convertFromIdrToBase(amountInIdr) {
    const num = Number(amountInIdr || 0);
    if (!num || isNaN(num)) return 0;
    if (currentCurrency === 'IDR') return Math.round(num);
    const meta = CURRENCY_META[currentCurrency] || CURRENCY_META.IDR || { decimals: 2 };
    const rate = Number(exchangeRates[currentCurrency]) || Number(FALLBACK_RATES[currentCurrency]) || 1;
    const decimals = typeof meta.decimals === 'number' ? meta.decimals : 2;
    const converted = num * rate;
    return Number(converted.toFixed(decimals));
}

function convertToIdrFromBase(amountInCurrent) {
    const num = Number(amountInCurrent || 0);
    if (!num || isNaN(num)) return 0;
    if (currentCurrency === 'IDR') return Math.round(num);
    const rate = Number(exchangeRates[currentCurrency]) || Number(FALLBACK_RATES[currentCurrency]) || 1;
    if (rate <= 0) return Math.round(num);
    return Math.round(num / rate);
}

function updateFormCurrencyIndicators() {
    const meta = CURRENCY_META[currentCurrency] || CURRENCY_META.IDR || { symbol: 'Rp', decimals: 0 };
    const symbol = meta.symbol || currentCurrency;
    const badgeText = `${currentCurrency} (${symbol})`;
    const isDecimal = (meta.decimals || 0) > 0;
    const stepVal = isDecimal ? "any" : "1";
    const minVal = isDecimal ? "0.01" : "1";
    const placeholderVal = isDecimal ? "0.00" : "0";

    const badgeIds = [
        'transAmountCurrency',
        'accBalanceCurrency',
        'budgetCurrency',
        'topupCurrency',
        'debtPrincipalCurrency',
        'debtPaymentCurrency'
    ];
    badgeIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.textContent = badgeText;
    });

    const inputIds = [
        'inputAmount',
        'accBalance',
        'budgetTarget',
        'topupAmount',
        'debtPrincipal',
        'debtPaymentAmount'
    ];
    inputIds.forEach((id) => {
        const input = document.getElementById(id);
        if (input) {
            input.setAttribute('step', stepVal);
            input.setAttribute('min', minVal);
            input.setAttribute('placeholder', placeholderVal);
        }
    });
}

window.convertFromIdrToBase = convertFromIdrToBase;
window.convertToIdrFromBase = convertToIdrFromBase;
window.updateFormCurrencyIndicators = updateFormCurrencyIndicators;
window.formatCurrency = formatRupiah;

window.updateCurrencyConverter = function() {
    const inputEl = document.getElementById('convertAmount');
    const resultEl = document.getElementById('convertResult');
    const labelEl = document.getElementById('convertTargetLabel');
    const infoEl = document.getElementById('converterRateInfo');
    if (!inputEl || !resultEl) return;
    
    const amount = parseFloat(inputEl.value) || 0;
    const targetCode = currentCurrency === 'IDR' ? 'USD' : currentCurrency;
    const rate = exchangeRates[targetCode] || 1;
    const converted = amount * rate;
    
    labelEl.innerText = targetCode;
    const meta = CURRENCY_META[targetCode] || { decimals: 2 };
    resultEl.value = new Intl.NumberFormat(currentLocale || 'en-US', {
        minimumFractionDigits: meta.decimals,
        maximumFractionDigits: meta.decimals
    }).format(converted);
    infoEl.innerText = `1 IDR = ${rate.toPrecision(5)} ${targetCode}`;
}

window.changeCurrency = async function(code, symbol, locale) {
    const meta = CURRENCY_META[code] || { symbol, locale, decimals: 2 };
    currentCurrency = code;
    currentLocale = locale || meta.locale || 'id-ID';
    localStorage.setItem('pocketly_currency', code);
    localStorage.setItem('pocketly_locale', currentLocale);
    updateCurrencyText();
    renderCurrencyOptions();
    window.updateCurrencyConverter();
    await fetchLiveRates(true);
    refreshAllMoneyDisplays();
    updateCurrencyRateStatus(`Currency updated to ${code}. Values use the latest available rate from the IDR base.`);
};

function renderAccountsFromCache() {
    const accList = document.getElementById('accountList');
    const accSelect = document.getElementById('inputAccount');
    const toAccSelect = document.getElementById('inputToAccount');
    const filterAccSelect = document.getElementById('transFilterAccount');

    let htmlContent = '';
    const selAccText = (window.PocketlyI18n && window.PocketlyI18n.t('trans_select_account_placeholder')) || 'Select Account';
    const newAccText = (window.PocketlyI18n && window.PocketlyI18n.t('trans_create_new_account')) || '+ Create New Account...';
    const selDestText = (window.PocketlyI18n && window.PocketlyI18n.t('trans_select_dest_placeholder')) || 'Select Destination Account';
    const allAccText = (window.PocketlyI18n && window.PocketlyI18n.t('opt_all_accounts')) || 'All Accounts';

    const defaultOpt = `<option value="" disabled selected data-i18n="trans_select_account_placeholder">${selAccText}</option><option value="NEW_ACCOUNT" style="font-weight:bold; color:var(--blue-accent);" data-i18n="trans_create_new_account">${newAccText}</option>`;
    if (accSelect) accSelect.innerHTML = defaultOpt;
    if (toAccSelect) toAccSelect.innerHTML = `<option value="" disabled selected data-i18n="trans_select_dest_placeholder">${selDestText}</option>`;
    if (filterAccSelect) filterAccSelect.innerHTML = `<option value="all" data-i18n="opt_all_accounts">${allAccText}</option>`;

    accounts.forEach((data) => {
        htmlContent += generateWalletCardHTML(data);

        const opt = document.createElement('option');
        opt.value = data.id;
        opt.innerText = `${data.name} (${formatRupiah(data.balance)})`;
        if (accSelect) accSelect.appendChild(opt);
        if (toAccSelect) toAccSelect.appendChild(opt.cloneNode(true));
        if (filterAccSelect) {
            const filterOpt = document.createElement('option');
            filterOpt.value = data.id;
            filterOpt.innerText = data.name;
            filterAccSelect.appendChild(filterOpt);
        }
    });

    if (accList) accList.innerHTML = htmlContent + getWalletAddCardHTML();
    const total = accounts.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
    const totalDisplay = document.getElementById('displayTotalBalance');
    if (totalDisplay) totalDisplay.innerText = formatRupiah(total);
    populateDebtAccountSelects();
    setTimeout(initCustomSelects, 100);
}

function refreshAllMoneyDisplays() {
    updateCurrencyText();
    renderCurrencyOptions();
    renderAccountsFromCache();
    if (typeof updateDashboard === 'function') updateDashboard();
    if (typeof renderDebtTracker === 'function') renderDebtTracker();
    if (typeof renderCalendar === 'function') renderCalendar();
    const reportsSection = document.getElementById('reports');
    if (reportsSection && reportsSection.classList.contains('active') && typeof updateReportsPage === 'function') {
        updateReportsPage();
    }
}

function populateDebtAccountSelects(selectedId = '') {
    const selectIds = ['debtAccount', 'debtPaymentAccount'];
    selectIds.forEach((id) => {
        const select = document.getElementById(id);
        if (!select) return;
        const defaultLabel = id === 'debtAccount'
            ? ((window.PocketlyI18n && window.PocketlyI18n.t('debt_account_select_placeholder')) || 'Select linked account')
            : ((window.PocketlyI18n && window.PocketlyI18n.t('debt_payment_select_placeholder')) || 'Select Account');
        const dataI18nKey = id === 'debtAccount' ? 'debt_account_select_placeholder' : 'debt_payment_select_placeholder';
        select.innerHTML = `<option value="" disabled selected data-i18n="${dataI18nKey}">${defaultLabel}</option>`;
        accounts.forEach((acc) => {
            const opt = document.createElement('option');
            opt.value = acc.id;
            opt.innerText = `${acc.name} (${formatRupiah(acc.balance)})`;
            if (selectedId && selectedId === acc.id) opt.selected = true;
            select.appendChild(opt);
        });
        if (typeof select.__syncSearchable === 'function') {
            select.__syncSearchable();
        }
    });
}

function listenToDebts() {
    if (!currentUser) return;
    if (typeof debtUnsubscribe === 'function') debtUnsubscribe();
    const qDebts = query(collection(db, 'debts'), where('uid', '==', currentUser.uid));
    debtUnsubscribe = onSnapshot(qDebts, (snapshot) => {
        rawDebts = [];
        snapshot.docs.forEach((docSnap) => rawDebts.push({ id: docSnap.id, ...docSnap.data() }));
        renderDebtTracker();
        renderCalendar();
        if (window.PocketlyNotification && typeof window.PocketlyNotification.updateCenter === 'function') {
            window.PocketlyNotification.updateCenter();
        }
    }, (error) => {
        console.error('Debt listener error:', error);
        rawDebts = [];
        renderDebtTracker();
    });
}

function getDebtStatus(debt) {
    const remaining = Number(debt.remaining ?? debt.principal ?? 0);
    if (remaining <= 0 || debt.status === 'paid') return 'paid';
    return 'active';
}

function getDebtDueLabel(debt) {
    if (!debt.dueDate) return 'No due date';
    const due = toLocalDate(debt.dueDate);
    const today = toLocalDate(todayISO());
    const diffDays = Math.ceil((due - today) / 86400000);
    if (diffDays < 0) return `${Math.abs(diffDays)} day(s) overdue`;
    if (diffDays === 0) return 'Due today';
    if (diffDays <= 7) return `Due in ${diffDays} day(s)`;
    return formatDateIndo(debt.dueDate);
}

function renderDebtTracker() {
    const list = document.getElementById('debtList');
    if (!list) return;

    const search = (document.getElementById('debtSearch')?.value || '').toLowerCase().trim();
    const kindFilter = document.getElementById('debtKindFilter')?.value || 'all';
    const statusFilter = document.getElementById('debtStatusFilter')?.value || 'active';

    let receivable = 0;
    let payable = 0;
    let dueSoon = 0;
    const today = toLocalDate(todayISO());
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    rawDebts.forEach((debt) => {
        const remaining = Math.max(0, Number(debt.remaining ?? debt.principal ?? 0));
        if (getDebtStatus(debt) === 'active') {
            if (debt.kind === 'lent') receivable += remaining;
            if (debt.kind === 'borrowed') payable += remaining;
            if (debt.dueDate) {
                const due = toLocalDate(debt.dueDate);
                if (due && due <= nextWeek) dueSoon += 1;
            }
        }
    });

    const elReceivable = document.getElementById('debtTotalReceivable');
    const elPayable = document.getElementById('debtTotalPayable');
    const elNet = document.getElementById('debtNetPosition');
    const elDue = document.getElementById('debtDueSoonCount');
    if (elReceivable) elReceivable.innerText = formatRupiah(receivable);
    if (elPayable) elPayable.innerText = formatRupiah(payable);
    if (elNet) {
        const net = receivable - payable;
        elNet.innerText = (net > 0 ? '+' : '') + formatRupiah(net);
        elNet.style.color = net > 0 ? 'var(--green)' : (net < 0 ? 'var(--red)' : 'var(--text-dark)');
    }
    if (elDue) {
        elDue.innerText = String(dueSoon);
        const cardDue = elDue.closest('.debt-summary-card');
        if (cardDue) {
            if (dueSoon > 0) cardDue.classList.add('has-due');
            else cardDue.classList.remove('has-due');
        }
    }

    const dashReceivable = document.getElementById('dashDebtReceivable');
    const dashPayable = document.getElementById('dashDebtPayable');
    if (dashReceivable) dashReceivable.innerText = formatRupiah(receivable);
    if (dashPayable) dashPayable.innerText = formatRupiah(payable);
    if (typeof renderDashboardActiveDebts === 'function') renderDashboardActiveDebts();

    let filtered = rawDebts.filter((debt) => {
        const status = getDebtStatus(debt);
        if (kindFilter !== 'all' && debt.kind !== kindFilter) return false;
        if (statusFilter !== 'all' && status !== statusFilter) return false;
        if (search) {
            const haystack = `${debt.partyName || ''} ${debt.notes || ''} ${debt.kind || ''} ${status}`.toLowerCase();
            if (!haystack.includes(search)) return false;
        }
        return true;
    });

    filtered.sort((a, b) => {
        const statusA = getDebtStatus(a) === 'paid' ? 1 : 0;
        const statusB = getDebtStatus(b) === 'paid' ? 1 : 0;
        if (statusA !== statusB) return statusA - statusB;
        const dateA = a.dueDate || '9999-12-31';
        const dateB = b.dueDate || '9999-12-31';
        return dateA.localeCompare(dateB);
    });

    if (filtered.length === 0) {
        list.innerHTML = '';
        return;
    }

    list.innerHTML = filtered.map((debt, idx) => {
        const principal = Number(debt.principal || 0);
        const remaining = Math.max(0, Number(debt.remaining ?? principal));
        const paid = Math.max(0, principal - remaining);
        const percent = principal > 0 ? Math.min(100, (paid / principal) * 100) : 0;
        const status = getDebtStatus(debt);
        const isLent = debt.kind === 'lent';
        const badgeClass = status === 'paid' ? 'paid' : debt.kind;
        const badgeLabel = status === 'paid' ? 'Settled' : (isLent ? 'Receivable' : 'Payable');
        const avatarColor = status === 'paid' ? 'var(--primary-color)' : (isLent ? 'var(--green)' : 'var(--red)');
        const accountName = accounts.find((acc) => acc.id === debt.accountId)?.name || 'Unlinked';
        const safeParty = escapeHTML(debt.partyName || 'Unknown');
        const safeNotes = escapeHTML(debt.notes || '');
        const paymentButton = status === 'paid'
            ? `<button type="button" class="btn-secondary btn-action-pill" disabled><i class="fa-solid fa-check"></i> Settled</button>`
            : `<button type="button" class="btn-primary btn-action-pill" onclick="openDebtPayment('${debt.id}')"><i class="fa-solid fa-money-bill-wave"></i> Payment</button>`;

        const animDelay = Math.min(idx * 0.05, 0.35);
        const isOverdue = Boolean(debt.dueDate && toLocalDate(debt.dueDate) < today && status !== 'paid');

        return `
            <div class="debt-card glass-effect-card" style="animation-delay: ${animDelay}s;">
                <div class="debt-card-header">
                    <div class="debt-party">
                        <div class="debt-avatar" style="background:${avatarColor};">
                            <i class="fa-solid ${isLent ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                        </div>
                        <div class="debt-party-info">
                            <h4>${safeParty}</h4>
                            <span><i class="fa-solid fa-wallet"></i> ${escapeHTML(accountName)}</span>
                        </div>
                    </div>
                    <span class="debt-badge ${badgeClass}">${badgeLabel}</span>
                </div>

                <div class="debt-amount-row">
                    <div>
                        <small>Remaining</small>
                        <div class="debt-remaining">${formatRupiah(remaining)}</div>
                    </div>
                    <div class="debt-principal">
                        <small>Principal</small>
                        <span>${formatRupiah(principal)}</span>
                    </div>
                </div>

                <div class="debt-progress-bg">
                    <div class="debt-progress-fill ${status === 'paid' ? 'paid' : (isLent ? 'lent' : 'borrowed')}" style="width:${percent}%"></div>
                </div>

                <div class="debt-meta-grid">
                    <div class="debt-meta"><small>Started</small><span>${formatDateIndo(debt.startDate)}</span></div>
                    <div class="debt-meta"><small>Due</small><span class="${isOverdue ? 'overdue' : ''}">${escapeHTML(getDebtDueLabel(debt))}</span></div>
                </div>

                ${safeNotes ? `<div class="debt-note"><i class="fa-regular fa-comment-dots"></i> ${safeNotes}</div>` : ''}

                <div class="debt-actions">
                    ${paymentButton}
                    <div class="debt-card-icon-actions">
                        <button type="button" class="btn-secondary btn-circle-action" onclick="openEditDebt('${debt.id}')" title="Edit" aria-label="Edit">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button type="button" class="btn-subtle-danger btn-circle-action" onclick="askDeleteDebt('${debt.id}')" title="Delete" aria-label="Delete">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            </div>`;
    }).join('');
}

window.openDebtModal = function() {
    const form = document.getElementById('debtForm');
    if (form) form.reset();
    const modal = document.getElementById('debtModal');
    const title = document.getElementById('debtModalTitle');
    const saveBtn = document.getElementById('btnSaveDebt');
    const editId = document.getElementById('editDebtId');
    const affectRow = document.getElementById('debtAffectBalanceRow');
    if (title) title.innerText = (window.PocketlyI18n && window.PocketlyI18n.t('debt_modal_title')) || 'Add Debt / Loan';
    if (saveBtn) saveBtn.innerText = (window.PocketlyI18n && window.PocketlyI18n.t('debt_save_btn')) || 'Save Record';
    if (editId) editId.value = '';
    if (affectRow) affectRow.style.display = 'flex';
    const startDate = document.getElementById('debtStartDate');
    if (startDate) startDate.value = todayISO();
    if (document.getElementById('debtPrincipal')) {
        document.getElementById('debtPrincipal').dataset.originalIdr = '';
    }
    if (typeof updateFormCurrencyIndicators === 'function') updateFormCurrencyIndicators();
    populateDebtAccountSelects();
    if (modal) modal.classList.add('show');
    setTimeout(initCustomSelects, 100);
};

window.openEditDebt = function(id) {
    const debt = rawDebts.find((item) => item.id === id);
    if (!debt) return showAlert('Debt record not found.', true);
    const titleEl = document.getElementById('debtModalTitle');
    const saveBtn = document.getElementById('btnSaveDebt');
    if (titleEl) titleEl.innerText = (window.PocketlyI18n && window.PocketlyI18n.t('debt_modal_edit_title')) || 'Edit Debt / Loan';
    if (saveBtn) saveBtn.innerText = (window.PocketlyI18n && window.PocketlyI18n.t('debt_update_btn')) || 'Update Record';
    document.getElementById('editDebtId').value = id;
    document.getElementById('debtKind').value = debt.kind || 'lent';
    document.getElementById('debtPartyName').value = debt.partyName || '';
    const pVal = Number(debt.principal || 0);
    document.getElementById('debtPrincipal').value = convertFromIdrToBase(pVal);
    document.getElementById('debtPrincipal').dataset.originalIdr = String(pVal);
    document.getElementById('debtStartDate').value = debt.startDate || todayISO();
    document.getElementById('debtDueDate').value = debt.dueDate || '';
    document.getElementById('debtNotes').value = debt.notes || '';
    const affectRow = document.getElementById('debtAffectBalanceRow');
    if (affectRow) affectRow.style.display = 'none';
    if (typeof updateFormCurrencyIndicators === 'function') updateFormCurrencyIndicators();
    populateDebtAccountSelects(debt.accountId || '');
    const accountSelect = document.getElementById('debtAccount');
    if (accountSelect && debt.accountId) accountSelect.value = debt.accountId;
    document.getElementById('debtModal').classList.add('show');
    setTimeout(initCustomSelects, 100);
};

window.askDeleteDebt = function(id) {
    const debt = rawDebts.find((item) => item.id === id);
    if (!debt) return;
    showConfirm(
        'Delete Debt Tracker?',
        `Delete the tracker for ${debt.partyName || 'this record'}? Existing balance transactions will be kept for audit history.`,
        'Delete Tracker',
        async () => {
            try {
                await deleteDoc(doc(db, 'debts', id));
                showAlert('Debt tracker deleted.', false);
            } catch (error) {
                console.error(error);
                showAlert('Failed to delete debt tracker: ' + error.message, true);
            }
        }
    );
};

const debtForm = document.getElementById('debtForm');
if (debtForm) {
    debtForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const editId = document.getElementById('editDebtId').value;
        const kind = document.getElementById('debtKind').value;
        const partyName = document.getElementById('debtPartyName').value.trim();
        const rawPrincipal = Number(document.getElementById('debtPrincipal').value);
        const origIdr = Number(document.getElementById('debtPrincipal').dataset.originalIdr || 0);

        if (!partyName) return showAlert('Please enter a person or institution name.', true);
        if (isNaN(rawPrincipal) || rawPrincipal <= 0) return showAlert('Principal amount must be greater than 0.', true);

        const principal = (editId && origIdr && rawPrincipal === convertFromIdrToBase(origIdr))
            ? origIdr
            : convertToIdrFromBase(rawPrincipal);

        const accountId = document.getElementById('debtAccount').value;
        const startDate = document.getElementById('debtStartDate').value;
        const dueDate = document.getElementById('debtDueDate').value;
        const notes = document.getElementById('debtNotes').value.trim();
        const affectBalance = document.getElementById('debtAffectBalance').checked;
        const btn = document.getElementById('btnSaveDebt');
        const originalText = btn.innerText;

        if (!startDate) return showAlert('Please choose a start date.', true);
        if (!editId && affectBalance && !accountId) return showAlert('Please select an account or disable account balance update.', true);

        btn.innerText = 'Processing...';
        btn.disabled = true;

        try {
            if (editId) {
                const oldDebt = rawDebts.find((item) => item.id === editId);
                const oldPrincipal = Number(oldDebt?.principal || principal);
                const oldRemaining = Number(oldDebt?.remaining ?? oldPrincipal);
                const paid = Math.max(0, oldPrincipal - oldRemaining);
                const newRemaining = Math.max(0, principal - paid);
                await updateDoc(doc(db, 'debts', editId), {
                    kind,
                    partyName,
                    principal,
                    remaining: newRemaining,
                    accountId: accountId || '',
                    startDate,
                    dueDate: dueDate || '',
                    notes,
                    status: newRemaining <= 0 ? 'paid' : 'active',
                    updatedAt: new Date().toISOString()
                });
                showAlert('Debt / loan updated.', false);
            } else {
                const batch = writeBatch(db);
                const debtRef = doc(collection(db, 'debts'));
                const now = new Date().toISOString();
                batch.set(debtRef, {
                    uid: currentUser.uid,
                    kind,
                    partyName,
                    principal,
                    remaining: principal,
                    accountId: accountId || '',
                    startDate,
                    dueDate: dueDate || '',
                    notes,
                    status: 'active',
                    payments: [],
                    createdAt: now,
                    updatedAt: now
                });

                if (affectBalance && accountId) {
                    const accRef = doc(db, 'accounts', accountId);
                    const accSnap = await getDoc(accRef);
                    if (!accSnap.exists()) throw new Error('Linked account not found.');
                    const currentBalance = Number(accSnap.data().balance || 0);
                    const newBalance = kind === 'lent' ? currentBalance - principal : currentBalance + principal;
                    if (kind === 'lent' && newBalance < 0) throw new Error('Insufficient balance in linked account.');
                    batch.update(accRef, { balance: newBalance });
                    const transRef = doc(collection(db, 'transactions'));
                    batch.set(transRef, {
                        uid: currentUser.uid,
                        type: kind === 'lent' ? 'expense' : 'income',
                        category: 'Debt / Loan',
                        amount: principal,
                        desc: kind === 'lent' ? `Loan to ${partyName}` : `Loan from ${partyName}`,
                        date: startDate,
                        accountId,
                        debtId: debtRef.id,
                        createdAt: now,
                        locked: true
                    });
                }

                await batch.commit();
                showAlert('Debt / loan saved.', false);
            }
            document.getElementById('debtModal').classList.remove('show');
            debtForm.reset();
        } catch (error) {
            console.error(error);
            showAlert(getFriendlyMessage(error), true);
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });
}

window.openDebtPayment = function(id) {
    const debt = rawDebts.find((item) => item.id === id);
    if (!debt) return showAlert('Debt record not found.', true);
    const remaining = Math.max(0, Number(debt.remaining ?? debt.principal ?? 0));
    if (remaining <= 0) return showAlert('This debt is already paid.', false);
    document.getElementById('paymentDebtId').value = id;
    document.getElementById('debtPaymentAmount').value = convertFromIdrToBase(remaining);
    document.getElementById('debtPaymentAmount').dataset.remainingIdr = String(remaining);
    if (typeof updateFormCurrencyIndicators === 'function') updateFormCurrencyIndicators();
    document.getElementById('debtPaymentDate').value = todayISO();
    document.getElementById('debtPaymentNote').value = '';
    const collTitle = (window.PocketlyI18n && window.PocketlyI18n.t('record_collection_title')) || 'Record Collection';
    const repayTitle = (window.PocketlyI18n && window.PocketlyI18n.t('record_repayment_title')) || 'Record Repayment';
    const titleEl = document.getElementById('debtPaymentTitle');
    if (titleEl) titleEl.innerText = debt.kind === 'lent' ? collTitle : repayTitle;
    const context = document.getElementById('debtPaymentContext');
    if (context) {
        const lblRemaining = (window.PocketlyI18n && window.PocketlyI18n.t('debt_context_remaining')) || 'Remaining';
        const lblAction = (window.PocketlyI18n && window.PocketlyI18n.t('debt_context_action')) || 'Action:';
        const actionText = debt.kind === 'lent' 
            ? ((window.PocketlyI18n && window.PocketlyI18n.t('debt_context_received')) || 'Money received from borrower')
            : ((window.PocketlyI18n && window.PocketlyI18n.t('debt_context_paid_back')) || 'Money paid back to lender');
        context.innerHTML = `
            <b>${escapeHTML(debt.partyName || 'Debt')}</b><br>
            ${lblRemaining}: <b>${formatRupiah(remaining)}</b><br>
            ${lblAction} ${actionText}`;
    }
    populateDebtAccountSelects(debt.accountId || '');
    const accountSelect = document.getElementById('debtPaymentAccount');
    if (accountSelect && debt.accountId) accountSelect.value = debt.accountId;
    document.getElementById('debtPaymentModal').classList.add('show');
    setTimeout(initCustomSelects, 100);
};

const debtPaymentForm = document.getElementById('debtPaymentForm');
if (debtPaymentForm) {
    debtPaymentForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const debtId = document.getElementById('paymentDebtId').value;
        const debt = rawDebts.find((item) => item.id === debtId);
        if (!debt) return showAlert('Debt record not found.', true);

        const accountId = document.getElementById('debtPaymentAccount').value;
        const rawAmount = Number(document.getElementById('debtPaymentAmount').value);
        const remainingIdr = Number(document.getElementById('debtPaymentAmount').dataset.remainingIdr || remaining);
        const date = document.getElementById('debtPaymentDate').value;
        const note = document.getElementById('debtPaymentNote').value.trim();
        const remaining = Math.max(0, Number(debt.remaining ?? debt.principal ?? 0));
        const btn = document.getElementById('btnSaveDebtPayment');
        const originalText = btn.innerText;

        if (!accountId) return showAlert('Please select a payment account.', true);
        if (isNaN(rawAmount) || rawAmount <= 0) return showAlert('Payment amount must be greater than 0.', true);

        const amount = (rawAmount === convertFromIdrToBase(remainingIdr))
            ? remainingIdr
            : convertToIdrFromBase(rawAmount);

        if (amount > remaining) return showAlert('Payment cannot exceed remaining balance.', true);
        if (!date) return showAlert('Please select a payment date.', true);

        btn.innerText = 'Processing...';
        btn.disabled = true;

        try {
            const accRef = doc(db, 'accounts', accountId);
            const accSnap = await getDoc(accRef);
            if (!accSnap.exists()) throw new Error('Payment account not found.');
            const currentBalance = Number(accSnap.data().balance || 0);
            const isCollecting = debt.kind === 'lent';
            const newBalance = isCollecting ? currentBalance + amount : currentBalance - amount;
            if (!isCollecting && newBalance < 0) throw new Error('Insufficient balance for repayment.');

            const newRemaining = Math.max(0, remaining - amount);
            const now = new Date().toISOString();
            const paymentRecord = { amount, date, accountId, note, createdAt: now, kind: debt.kind };
            const batch = writeBatch(db);
            batch.update(accRef, { balance: newBalance });
            batch.update(doc(db, 'debts', debtId), {
                remaining: newRemaining,
                status: newRemaining <= 0 ? 'paid' : 'active',
                payments: arrayUnion(paymentRecord),
                updatedAt: now
            });
            const transRef = doc(collection(db, 'transactions'));
            batch.set(transRef, {
                uid: currentUser.uid,
                type: isCollecting ? 'income' : 'expense',
                category: 'Debt / Loan',
                amount,
                desc: isCollecting ? `Debt payment from ${debt.partyName}` : `Loan repayment to ${debt.partyName}`,
                date,
                accountId,
                debtId,
                createdAt: now,
                locked: true
            });

            await batch.commit();
            document.getElementById('debtPaymentModal').classList.remove('show');
            debtPaymentForm.reset();
            showAlert('Payment saved and account balance updated.', false);
        } catch (error) {
            console.error(error);
            showAlert(getFriendlyMessage(error), true);
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });
}

function initCalendarControls() {
    if (calendarControlsReady) return;
    const monthSelect = document.getElementById('calendarMonth');
    const yearSelect = document.getElementById('calendarYear');
    if (!monthSelect || !yearSelect) return;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    monthSelect.innerHTML = monthNames.map((name, index) => `<option value="${String(index + 1).padStart(2, '0')}">${name}</option>`).join('');

    const now = new Date();
    const startYear = now.getFullYear() - 3;
    const endYear = now.getFullYear() + 5;
    yearSelect.innerHTML = '';
    for (let year = startYear; year <= endYear; year++) {
        yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
    }
    monthSelect.value = String(now.getMonth() + 1).padStart(2, '0');
    yearSelect.value = String(now.getFullYear());

    monthSelect.addEventListener('change', () => renderCalendar());
    yearSelect.addEventListener('change', () => renderCalendar());

    document.getElementById('calendarPrevMonth')?.addEventListener('click', () => shiftCalendarMonth(-1));
    document.getElementById('calendarNextMonth')?.addEventListener('click', () => shiftCalendarMonth(1));
    document.getElementById('btnCalendarToday')?.addEventListener('click', () => {
        const today = new Date();
        monthSelect.value = String(today.getMonth() + 1).padStart(2, '0');
        yearSelect.value = String(today.getFullYear());
        calendarSelectedDate = todayISO();
        renderCalendar();
    });
    calendarControlsReady = true;
}

function shiftCalendarMonth(delta) {
    const monthSelect = document.getElementById('calendarMonth');
    const yearSelect = document.getElementById('calendarYear');
    if (!monthSelect || !yearSelect) return;
    const date = new Date(Number(yearSelect.value), Number(monthSelect.value) - 1 + delta, 1);
    monthSelect.value = String(date.getMonth() + 1).padStart(2, '0');
    yearSelect.value = String(date.getFullYear());
    renderCalendar();
}

function getCalendarDayData(dateString) {
    const transactions = rawTransactions.filter((t) => t.date === dateString);
    const dueDebts = rawDebts.filter((d) => getDebtStatus(d) === 'active' && d.dueDate === dateString);
    let income = 0;
    let expense = 0;
    let transfer = 0;
    transactions.forEach((t) => {
        if (t.type === 'income') income += Number(t.amount || 0);
        else if (t.type === 'expense') expense += Number(t.amount || 0);
        else if (t.type === 'transfer') transfer += Number(t.amount || 0);
    });
    return { transactions, dueDebts, income, expense, transfer };
}

function renderCalendar() {
    initCalendarControls();
    const grid = document.getElementById('calendarGrid');
    const monthSelect = document.getElementById('calendarMonth');
    const yearSelect = document.getElementById('calendarYear');
    if (!grid || !monthSelect || !yearSelect) return;

    const year = Number(yearSelect.value);
    const monthIndex = Number(monthSelect.value) - 1;
    if (Number.isNaN(year) || Number.isNaN(monthIndex)) return;

    const firstDay = new Date(year, monthIndex, 1);
    const start = new Date(firstDay);
    start.setDate(firstDay.getDate() - firstDay.getDay());
    const today = todayISO();
    let html = '';

    for (let i = 0; i < 42; i++) {
        const current = new Date(start);
        current.setDate(start.getDate() + i);
        const dateString = formatLocalISO(current);
        const data = getCalendarDayData(dateString);
        const outside = current.getMonth() !== monthIndex;
        const selected = dateString === calendarSelectedDate;
        const dots = [];
        if (data.income > 0) dots.push('<span class="calendar-dot" style="background:#10b981"></span>');
        if (data.expense > 0) dots.push('<span class="calendar-dot" style="background:#ef4444"></span>');
        if (data.transfer > 0) dots.push('<span class="calendar-dot" style="background:#3b82f6"></span>');
        if (data.dueDebts.length > 0) dots.push('<span class="calendar-dot" style="background:#f59e0b"></span>');

        html += `
            <div class="calendar-day ${outside ? 'outside-month' : ''} ${dateString === today ? 'today' : ''} ${selected ? 'selected' : ''}" onclick="selectCalendarDate('${dateString}')">
                <div class="calendar-day-number"><span>${current.getDate()}</span>${data.dueDebts.length ? '<i class="fa-solid fa-bell" style="color:#f59e0b; font-size:0.75rem;"></i>' : ''}</div>
                <div class="calendar-dot-row">${dots.join('')}</div>
                <div class="calendar-day-money">
                    ${data.income ? `<span class="cal-income">+ ${formatRupiah(data.income)}</span>` : ''}
                    ${data.expense ? `<span class="cal-expense">- ${formatRupiah(data.expense)}</span>` : ''}
                    ${data.dueDebts.length ? `<span class="cal-debt">${data.dueDebts.length} due</span>` : ''}
                </div>
            </div>`;
    }
    grid.innerHTML = html;
    renderCalendarDaySummary(calendarSelectedDate);
}

window.selectCalendarDate = function(dateString) {
    calendarSelectedDate = dateString;
    renderCalendar();
};

function renderCalendarDaySummary(dateString) {
    const summary = document.getElementById('calendarDaySummary');
    if (!summary) return;
    const data = getCalendarDayData(dateString);
    const dateObj = toLocalDate(dateString);
    const activeLocale = (window.PocketlyI18n && typeof window.PocketlyI18n.getCurrentLocale === 'function')
        ? window.PocketlyI18n.getCurrentLocale()
        : (currentLocale || 'en-US');
    const tFunc = (window.PocketlyI18n && typeof window.PocketlyI18n.t === 'function')
        ? window.PocketlyI18n.t
        : (k, fb) => fb;
    const dateTitle = dateObj ? dateObj.toLocaleDateString(activeLocale, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }) : dateString;

    const transactionItems = data.transactions.map((t) => {
        const icon = getCategoryIcon(t.category || (t.type === 'transfer' ? 'Transfer' : 'Others'));
        const color = t.type === 'income' ? '#10b981' : (t.type === 'expense' ? getCategoryColor(t.category || 'Others') : '#3b82f6');
        const sign = t.type === 'income' ? '+' : (t.type === 'expense' ? '-' : '');
        const accName = accounts.find((a) => a.id === t.accountId)?.name || 'Unknown';
        const catTranslated = (window.PocketlyI18n && typeof window.PocketlyI18n.translateCategory === 'function')
            ? window.PocketlyI18n.translateCategory(t.category || (t.type === 'transfer' ? 'Transfer' : 'Others'))
            : (t.category || t.type);
        return `
            <div class="calendar-event-item" onclick="openTransactionDetail('${t.id}')" style="cursor:pointer;">
                <div class="calendar-event-icon" style="background:${hexToRgba(color, 0.12)}; color:${color};"><i class="fa-solid ${icon}"></i></div>
                <div>
                    <h4>${escapeHTML(t.desc || catTranslated || 'Transaction')}</h4>
                    <p>${escapeHTML(catTranslated)} - ${escapeHTML(accName)} - <b>${sign} ${formatRupiah(t.amount)}</b></p>
                </div>
            </div>`;
    });

    const debtItems = data.dueDebts.map((d) => `
        <div class="calendar-event-item" onclick="switchPage('debts')" style="cursor:pointer;">
            <div class="calendar-event-icon" style="background:rgba(245,158,11,0.12); color:#f59e0b;"><i class="fa-solid fa-bell"></i></div>
            <div>
                <h4>${escapeHTML(d.partyName || 'Debt due')}</h4>
                <p>${d.kind === 'lent' ? tFunc('collect_receivable', 'Collect receivable') : tFunc('pay_loan', 'Pay loan')} - <b>${formatRupiah(d.remaining ?? d.principal)}</b></p>
            </div>
        </div>`);

    summary.innerHTML = `
        <h3 class="calendar-summary-date">${escapeHTML(dateTitle)}</h3>
        <div class="calendar-summary-stats">
            <div class="calendar-summary-stat"><small>${tFunc('income_stat', 'Income')}</small><span class="text-green">${formatRupiah(data.income)}</span></div>
            <div class="calendar-summary-stat"><small>${tFunc('expense_stat', 'Expense')}</small><span class="text-red">${formatRupiah(data.expense)}</span></div>
            <div class="calendar-summary-stat"><small>${tFunc('transfer_stat', 'Transfer')}</small><span class="text-blue">${formatRupiah(data.transfer)}</span></div>
            <div class="calendar-summary-stat"><small>${tFunc('debt_due_stat', 'Debt Due')}</small><span>${data.dueDebts.length}</span></div>
        </div>
        <div class="calendar-event-list">
            ${transactionItems.join('')}
            ${debtItems.join('')}
            ${transactionItems.length === 0 && debtItems.length === 0 ? `<div class="empty-calendar-summary"><i class="fa-solid fa-calendar-check"></i><p>${tFunc('no_activity_date', 'No activity on this date.')}</p></div>` : ''}
        </div>`;
}

async function collectDocsForBackup(collectionName, customQuery = null) {
    try {
        const qRef = customQuery || query(collection(db, collectionName), where('uid', '==', currentUser.uid));
        const snapshot = await getDocs(qRef);
        return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    } catch (error) {
        console.warn(`Skipping export for collection ${collectionName} due to error:`, error.message);
        return [];
    }
}

function downloadJSON(filename, data) {
    const jsonString = JSON.stringify(data, null, 2);
    if (window.PocketlyDownloader) {
        window.PocketlyDownloader.saveText(jsonString, filename, 'application/json');
    } else {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

async function exportBackupJSON() {
    if (!currentUser) return showAlert('Please login first.', true);
    try {
        const btn = document.getElementById('btnExportJSON_Settings');
        if (btn) btn.style.pointerEvents = 'none';
        const budgetsQuery = query(collection(db, 'budgets'), where('participants', 'array-contains', currentUser.uid));
        const backup = {
            app: 'Pocketly Finance',
            version: 2,
            exportedAt: new Date().toISOString(),
            user: { uid: currentUser.uid, email: currentUser.email, displayName: currentUser.displayName || '' },
            preferences: {
                currency: currentCurrency,
                locale: currentLocale,
                userCategories,
                categoryConfig,
                exchangeRates,
                themeAccent: currentThemeAccent,
                ratesUpdatedAt: localStorage.getItem('pocketly_rates_updated_at') || ''
            },
            data: {
                accounts: await collectDocsForBackup('accounts'),
                transactions: await collectDocsForBackup('transactions'),
                budgets: await collectDocsForBackup('budgets', budgetsQuery),
                debts: await collectDocsForBackup('debts')
            }
        };
        downloadJSON(`Pocketly_Backup_${new Date().toISOString().split('T')[0]}.json`, backup);
        showAlert('Backup JSON exported successfully.', false);
    } catch (error) {
        console.error(error);
        showAlert('Failed to export backup: ' + error.message, true);
    } finally {
        const btn = document.getElementById('btnExportJSON_Settings');
        if (btn) btn.style.pointerEvents = '';
    }
}

async function deleteCurrentBackupData() {
    const collections = ['transactions', 'accounts', 'budgets', 'debts'];
    for (const collectionName of collections) {
        try {
            const qRef = query(collection(db, collectionName), where('uid', '==', currentUser.uid));
            const snapshot = await getDocs(qRef);
            for (let i = 0; i < snapshot.docs.length; i += 400) {
                const batch = writeBatch(db);
                snapshot.docs.slice(i, i + 400).forEach((docSnap) => batch.delete(docSnap.ref));
                await batch.commit();
            }
        } catch (error) {
            console.warn(`Skipping deletion for collection ${collectionName} due to error:`, error.message);
        }
    }
}

function cleanImportedDoc(collectionName, item) {
    const clean = { ...item };
    delete clean.id;
    clean.uid = currentUser.uid;
    if (collectionName === 'budgets') {
        clean.uid = currentUser.uid;
        clean.ownerName = currentUser.displayName || clean.ownerName || 'User';
        clean.visibility = clean.visibility || 'personal';
        clean.participants = [currentUser.uid];
        if (!clean.type) clean.type = 'goal';
        if (typeof clean.current === 'undefined') clean.current = 0;
    }
    if (collectionName === 'debts') {
        clean.payments = Array.isArray(clean.payments) ? clean.payments : [];
        clean.status = clean.status || (Number(clean.remaining || 0) <= 0 ? 'paid' : 'active');
    }
    return clean;
}

async function writeImportedCollection(collectionName, items = []) {
    if (!Array.isArray(items) || items.length === 0) return;
    for (let i = 0; i < items.length; i += 400) {
        const batch = writeBatch(db);
        items.slice(i, i + 400).forEach((item) => {
            const ref = item.id ? doc(db, collectionName, item.id) : doc(collection(db, collectionName));
            batch.set(ref, cleanImportedDoc(collectionName, item));
        });
        await batch.commit();
    }
}

async function importBackupJSON(file, replaceExisting) {
    const text = await file.text();
    const backup = JSON.parse(text);
    if (!backup || !backup.data) throw new Error('Invalid Pocketly backup file.');
    if (replaceExisting) await deleteCurrentBackupData();

    const prefs = backup.preferences || {};
    if (Array.isArray(prefs.userCategories)) userCategories = prefs.userCategories;
    if (prefs.categoryConfig && typeof prefs.categoryConfig === 'object') categoryConfig = prefs.categoryConfig;
    if (prefs.currency && CURRENCY_META[prefs.currency]) {
        currentCurrency = prefs.currency;
        currentLocale = prefs.locale || CURRENCY_META[prefs.currency].locale;
        localStorage.setItem('pocketly_currency', currentCurrency);
        localStorage.setItem('pocketly_locale', currentLocale);
    }
    if (prefs.exchangeRates && typeof prefs.exchangeRates === 'object') {
        exchangeRates = { ...FALLBACK_RATES, ...prefs.exchangeRates };
        localStorage.setItem('pocketly_rates', JSON.stringify(exchangeRates));
        if (prefs.ratesUpdatedAt) localStorage.setItem('pocketly_rates_updated_at', prefs.ratesUpdatedAt);
    }
    if (prefs.themeAccent && themePresets[prefs.themeAccent]) {
        currentThemeAccent = prefs.themeAccent;
        localStorage.setItem('pocketly_theme_accent', currentThemeAccent);
        applyThemeAccent(currentThemeAccent, false);
    }
    ensureDefaultEnhancedCategories();
    saveCategories();

    await writeImportedCollection('accounts', backup.data.accounts || []);
    await writeImportedCollection('transactions', backup.data.transactions || []);
    await writeImportedCollection('budgets', backup.data.budgets || []);
    await writeImportedCollection('debts', backup.data.debts || []);

    populateCategorySelects();
    updateCurrencyText();
    refreshAllMoneyDisplays();
}

const btnExportJSONSettings = document.getElementById('btnExportJSON_Settings');
if (btnExportJSONSettings) {
    btnExportJSONSettings.addEventListener('click', exportBackupJSON);
}

const btnImportJSONSettings = document.getElementById('btnImportJSON_Settings');
const backupDropzone = document.getElementById('backupDropzone');
const backupJsonFileInput = document.getElementById('backupJsonFile');
const dropzoneTextMain = document.getElementById('dropzoneTextMain');
const dropzoneTextSub = document.getElementById('dropzoneTextSub');
const dropzoneFileBadge = document.getElementById('dropzoneFileBadge');

function resetBackupDropzoneUI() {
    if (backupDropzone) backupDropzone.classList.remove('has-file', 'drag-over');
    if (dropzoneTextMain) dropzoneTextMain.innerText = 'Choose Backup File';
    if (dropzoneTextSub) dropzoneTextSub.innerText = 'Click to browse or drop .json file';
    if (dropzoneFileBadge) dropzoneFileBadge.style.display = 'none';
}

if (backupJsonFileInput) {
    backupJsonFileInput.addEventListener('change', () => {
        const file = backupJsonFileInput.files[0];
        if (file) {
            if (backupDropzone) backupDropzone.classList.add('has-file');
            if (dropzoneTextMain) dropzoneTextMain.innerText = file.name;
            if (dropzoneTextSub) dropzoneTextSub.innerText = `${(file.size / 1024).toFixed(1)} KB • Pocketly Backup`;
            if (dropzoneFileBadge) dropzoneFileBadge.style.display = 'inline-block';
        } else {
            resetBackupDropzoneUI();
        }
    });
}

if (backupDropzone) {
    backupDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        backupDropzone.classList.add('drag-over');
    });
    backupDropzone.addEventListener('dragleave', () => {
        backupDropzone.classList.remove('drag-over');
    });
    backupDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        backupDropzone.classList.remove('drag-over');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            backupJsonFileInput.files = e.dataTransfer.files;
            backupJsonFileInput.dispatchEvent(new Event('change'));
        }
    });
}

if (btnImportJSONSettings) {
    btnImportJSONSettings.addEventListener('click', () => {
        const form = document.getElementById('backupImportForm');
        if (form) form.reset();
        resetBackupDropzoneUI();
        document.getElementById('backupImportModal').classList.add('show');
    });
}

const backupImportForm = document.getElementById('backupImportForm');
if (backupImportForm) {
    backupImportForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const file = document.getElementById('backupJsonFile').files[0];
        const replaceExisting = document.getElementById('backupReplaceExisting').checked;
        if (!file) return showAlert('Please choose a JSON backup file.', true);
        const runImport = async () => {
            const btn = document.getElementById('btnRunBackupImport');
            const originalText = btn.innerText;
            btn.innerText = 'Importing...';
            btn.disabled = true;
            try {
                await importBackupJSON(file, replaceExisting);
                document.getElementById('backupImportModal').classList.remove('show');
                showAlert('Backup imported successfully.', false);
            } catch (error) {
                console.error(error);
                showAlert('Import failed: ' + error.message, true);
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        };

        if (replaceExisting) {
            showConfirm(
                'Replace Current Data?',
                'This will delete your current accounts, transactions, budgets, and debts before importing the backup.',
                'Replace & Import',
                runImport
            );
        } else {
            runImport();
        }
    });
}


let currentTransactionView = 'list';
function setTransactionView(view = 'list') {
    const normalized = view === 'calendar' ? 'calendar' : 'list';
    currentTransactionView = normalized;

    const switcher = document.getElementById('transViewSwitch');
    if (switcher) {
        switcher.setAttribute('data-active', normalized);
    }

    document.querySelectorAll('.trans-view-tab').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.transView === normalized);
    });
    document.querySelectorAll('.transaction-subview').forEach((panel) => {
        panel.classList.toggle('active', panel.id === (normalized === 'calendar' ? 'transactionCalendarView' : 'transactionListView'));
    });

    const sharedControls = document.getElementById('sharedControls');
    const transHeaderRow = document.querySelector('.trans-header-row');
    if (normalized === 'calendar') {
        if (sharedControls) sharedControls.style.display = 'none';
        if (transHeaderRow) transHeaderRow.style.display = 'none';
        setTimeout(renderCalendar, 50);
    } else {
        if (sharedControls) sharedControls.style.display = 'flex';
        if (transHeaderRow) transHeaderRow.style.display = 'flex';
        if (typeof updateDashboard === 'function') setTimeout(updateDashboard, 20);
    }
}
window.setTransactionView = setTransactionView;

function initHorizontalScrolls() {
    ['accountList', 'dashActiveDebtsList'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.dataset.wheelBound) {
            el.dataset.wheelBound = 'true';
            el.addEventListener('wheel', (evt) => {
                if (evt.deltaY !== 0 && el.scrollWidth > el.clientWidth) {
                    evt.preventDefault();
                    el.scrollLeft += evt.deltaY;
                }
            }, { passive: false });
        }
    });
}
window.addEventListener('DOMContentLoaded', initHorizontalScrolls);
initHorizontalScrolls();

document.getElementById('transactionListTab')?.addEventListener('click', () => setTransactionView('list'));
document.getElementById('transactionCalendarTab')?.addEventListener('click', () => setTransactionView('calendar'));
document.getElementById('currencySearchInput')?.addEventListener('input', renderCurrencyOptions);

const btnRefreshRates = document.getElementById('btnRefreshRates');
if (btnRefreshRates) {
    btnRefreshRates.addEventListener('click', async () => {
        btnRefreshRates.disabled = true;
        btnRefreshRates.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Refreshing';
        await fetchLiveRates(true);
        btnRefreshRates.disabled = false;
        btnRefreshRates.innerHTML = '<i class="fa-solid fa-rotate"></i> Refresh';
        updateCurrencyRateStatus('Exchange rates refreshed successfully.');
    });
}

const openDebtModalBtn = document.getElementById('openDebtModalBtn');
if (openDebtModalBtn) openDebtModalBtn.addEventListener('click', window.openDebtModal);

document.getElementById('debtSearch')?.addEventListener('input', renderDebtTracker);
document.getElementById('debtKindFilter')?.addEventListener('change', renderDebtTracker);
document.getElementById('debtStatusFilter')?.addEventListener('change', renderDebtTracker);

const originalSwitchPagePocketly = window.switchPage;
window.switchPage = function(targetId, addToHistory = true) {
    if (targetId === 'calendar') {
        originalSwitchPagePocketly('transactions', addToHistory);
        setTransactionView('calendar');
        return;
    }

    originalSwitchPagePocketly(targetId, addToHistory);
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        if (window.PocketlyI18n && typeof window.PocketlyI18n.getPageTitle === 'function') {
            pageTitle.innerText = window.PocketlyI18n.getPageTitle(targetId);
        } else {
            const extendedTitles = {
                debts: 'Debts & Loans',
                currencySettings: 'Currency',
                categorySettings: 'Categories',
                themeSettings: 'Theme Accent',
                languageSettings: 'Language',
                notifications: 'Notifications'
            };
            if (extendedTitles[targetId]) pageTitle.innerText = extendedTitles[targetId];
        }
    }

    const settingsSubpages = ['account', 'connections', 'currencySettings', 'themeSettings', 'categorySettings', 'languageSettings', 'notifications'];
    const isSettings = settingsSubpages.includes(targetId);
    document.body.classList.toggle('is-settings-view', isSettings);
    const topAppHeader = document.querySelector('header');
    if (topAppHeader) {
        topAppHeader.style.display = isSettings ? 'none' : 'flex';
    }
    if (targetId === 'debts') setTimeout(renderDebtTracker, 50);
    if (targetId === 'transactions') setTimeout(() => setTransactionView(currentTransactionView), 80);
    if (targetId === 'currencySettings') {
        setTimeout(() => {
            renderCurrencyOptions();
            updateCurrencyRateStatus();
        }, 50);
    }
    if (targetId === 'categorySettings') setTimeout(renderManageCategories, 50);
    if (targetId === 'themeSettings') setTimeout(renderThemeSettingsPage, 50);
    if (targetId === 'notifications') {
        setTimeout(() => {
            if (window.PocketlyNotification && typeof window.PocketlyNotification.updateCenter === 'function') {
                window.PocketlyNotification.updateCenter();
                window.PocketlyNotification.syncSettingsUI();
            }
        }, 50);
    }
};

// Keep custom category colors visible in transaction lists by extending the old dashboard renderer after it runs.
const originalUpdateDashboardPocketly = updateDashboard;
updateDashboard = function() {
    originalUpdateDashboardPocketly();
    document.querySelectorAll('.trans-item-row').forEach((row) => {
        const categoryText = row.querySelector('.cat-badge-outline')?.innerText?.trim();
        const iconEl = row.querySelector('.ti-icon');
        if (categoryText && iconEl && categoryText !== 'Transfer') {
            const color = getCategoryColor(categoryText);
            iconEl.style.color = color;
            iconEl.style.background = hexToRgba(color, 0.12);
        }
    });
    if (window.PocketlyNotification && typeof window.PocketlyNotification.updateCenter === 'function') {
        window.PocketlyNotification.updateCenter();
    }
};

loadEnhancedPreferences();
renderCurrencyOptions();
initCalendarControls();
populateCategorySelects();
renderDebtTracker();
renderCalendar();
setTransactionView(currentTransactionView);

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loadEnhancedPreferences();
        listenToDebts();
        fetchLiveRates(false);
        setTimeout(() => {
            populateCategorySelects();
            renderDebtTracker();
            renderCalendar();
            if (window.PocketlyNotification && typeof window.PocketlyNotification.updateCenter === 'function') {
                window.PocketlyNotification.updateCenter();
                window.PocketlyNotification.syncSettingsUI();
            }
        }, 400);
    } else {
        rawDebts = [];
        if (typeof debtUnsubscribe === 'function') debtUnsubscribe();
        debtUnsubscribe = null;
        renderDebtTracker();
    }
});

// Override analytics spending visualizations so category color customization is reflected in reports.
function renderSpendingBreakdown(data) {
    const ctx = document.getElementById('spendingBreakdownChart');
    if (!ctx) return;

    const catData = {};
    data.filter((t) => t.type === 'expense' && t.category !== 'Adjustment').forEach((t) => {
        const cat = t.category || 'Others';
        if (!catData[cat]) catData[cat] = 0;
        catData[cat] += Number(t.amount || 0);
    });

    let labels = [];
    let values = [];
    let otherValue = 0;
    Object.entries(catData).sort((a, b) => b[1] - a[1]).forEach(([cat, val], index) => {
        if (index < 4) {
            labels.push(cat);
            values.push(val);
        } else {
            otherValue += val;
        }
    });
    if (otherValue > 0) {
        labels.push('Others');
        values.push(otherValue);
    }

    if (spendingChartInstance) spendingChartInstance.destroy();
    if (values.length === 0) {
        spendingChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: [], datasets: [{ data: [1], backgroundColor: ['rgba(200,200,200,0.1)'], borderWidth: 0 }] },
            options: { cutout: '70%', events: [] }
        });
        return;
    }

    spendingChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: labels.map((label) => getCategoryColor(label)),
                borderWidth: 2,
                borderColor: localStorage.getItem('theme') === 'dark' ? '#1f2937' : '#ffffff',
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 10, usePointStyle: true, font: { size: 10 }, padding: 15 }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label || ''}: ${formatRupiah(context.raw || 0)}`;
                        }
                    },
                    backgroundColor: 'rgba(30, 41, 59, 0.9)',
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: true
                }
            }
        }
    });
}

function renderTopSpending(data) {
    const listContainer = document.getElementById('topSpendingList');
    if (!listContainer) return;
    listContainer.innerHTML = '';
    const tFunc = (window.PocketlyI18n && typeof window.PocketlyI18n.t === 'function')
        ? window.PocketlyI18n.t
        : (k, fb) => fb;
    const top5 = data.filter((t) => t.type === 'expense')
        .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
        .slice(0, 5);

    if (top5.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align:center; padding:40px; color:var(--text-grey);">
                <i class="fa-solid fa-money-bill-wave" style="font-size:2rem; margin-bottom:10px; opacity:0.3;"></i>
                <p>${tFunc('no_expenses_found', 'No expenses found.')}</p>
            </div>`;
        return;
    }

    top5.forEach((t) => {
        const iconClass = getCategoryIcon(t.category || 'Others');
        const color = getCategoryColor(t.category || 'Others');
        const safeDescJs = escapeForJsString(t.desc || '');
        const catTranslated = (window.PocketlyI18n && typeof window.PocketlyI18n.translateCategory === 'function')
            ? window.PocketlyI18n.translateCategory(t.category || 'Others')
            : (t.category || 'Others');
        listContainer.innerHTML += `
        <div class="spending-item" onclick="jumpToTransaction('${safeDescJs}')" title="View Details">
            <div class="spi-icon" style="background:${hexToRgba(color, 0.12)}; color:${color};">
                <i class="fa-solid ${iconClass}"></i>
            </div>
            <div class="spi-info-wrapper">
                <div class="spi-text-desktop">
                    <div class="spi-row-primary">${escapeHTML(t.desc || 'No description')}</div>
                    <div class="spi-row-secondary">${escapeHTML(catTranslated)} - ${formatDateIndo(t.date)}</div>
                </div>
                <div class="spi-text-mobile">
                    <div class="spi-row-primary">${escapeHTML(catTranslated)}</div>
                    <div class="spi-row-secondary">${escapeHTML(t.desc || 'No description')}</div>
                </div>
            </div>
            <div class="spi-amount-right">${formatRupiah(t.amount)}</div>
        </div>`;
    });
}

// Bind event listeners for converter
document.getElementById('convertAmount')?.addEventListener('input', window.updateCurrencyConverter);

/* --- NEW CURRENCY CONVERTER WIDGET --- */

/* --- NEW CURRENCY CONVERTER WIDGET & POPUP PICKER --- */

function updateConverterPillDisplay(target, code) {
    const flagEl = document.getElementById(target === 'from' ? 'convFlagFrom' : 'convFlagTo');
    const codeEl = document.getElementById(target === 'from' ? 'convCodeFrom' : 'convCodeTo');
    const hiddenEl = document.getElementById(target === 'from' ? 'convSelectFrom' : 'convSelectTo');
    
    if (hiddenEl) hiddenEl.value = code;
    if (codeEl) codeEl.innerText = code;
    if (flagEl) {
        flagEl.innerHTML = `<img src="${getCurrencyFlagUrl(code)}" alt="${code}" class="currency-flag-img">`;
    }
}
window.updateConverterPillDisplay = updateConverterPillDisplay;

let currentCurrencyPickerTarget = 'from'; // 'from' | 'to' | 'wallet'

window.openCurrencyPicker = function(target) {
    currentCurrencyPickerTarget = target;
    const modal = document.getElementById('currencyPickerModal');
    if (!modal) return;

    let selectedCode = 'USD';
    if (target === 'from') {
        selectedCode = document.getElementById('convSelectFrom')?.value || 'USD';
    } else if (target === 'to') {
        selectedCode = document.getElementById('convSelectTo')?.value || 'IDR';
    } else if (target === 'wallet') {
        selectedCode = currentCurrency;
    }

    renderCurrencyPickerList(selectedCode);

    const searchInput = document.getElementById('currencyPickerSearchInput');
    if (searchInput) {
        searchInput.value = '';
        const clearBtn = document.getElementById('currencyPickerSearchClear');
        if (clearBtn) clearBtn.style.display = 'none';
    }

    modal.classList.add('show');
    setTimeout(() => {
        if (searchInput) searchInput.focus();
    }, 120);
};

window.closeCurrencyPicker = function() {
    const modal = document.getElementById('currencyPickerModal');
    if (modal) modal.classList.remove('show');
};

window.selectPickerCurrency = function(code) {
    const meta = CURRENCY_META[code] || {};
    if (currentCurrencyPickerTarget === 'from') {
        updateConverterPillDisplay('from', code);
        if (typeof window.triggerCurrencyConvert === 'function') window.triggerCurrencyConvert('from');
    } else if (currentCurrencyPickerTarget === 'to') {
        updateConverterPillDisplay('to', code);
        if (typeof window.triggerCurrencyConvert === 'function') window.triggerCurrencyConvert('select');
    } else if (currentCurrencyPickerTarget === 'wallet') {
        changeCurrency(code, meta.symbol, meta.locale);
    }
    window.closeCurrencyPicker();
};

function renderCurrencyPickerList(selectedCode = 'USD', searchQuery = '') {
    const container = document.getElementById('currencyPickerList');
    if (!container) return;

    const query = (searchQuery || '').toLowerCase().trim();
    const entries = Object.entries(CURRENCY_META).filter(([code, meta]) => {
        const text = `${code} ${meta.name} ${meta.country || ''} ${meta.symbol}`.toLowerCase();
        return !query || text.includes(query);
    });

    if (entries.length === 0) {
        container.innerHTML = `
            <div class="currency-picker-empty">
                <i class="fa-solid fa-coins"></i>
                <p>No currencies found for "${escapeHTML(searchQuery)}"</p>
            </div>
        `;
        return;
    }

    container.innerHTML = entries.map(([code, meta]) => {
        const isSelected = (code === selectedCode);
        const rate = Number(exchangeRates[code]) || Number(FALLBACK_RATES[code]) || 1;
        const idrRate = (1 / rate);
        const rateFormatted = (code === 'IDR') ? 'Base' : `1 ${code} ≈ ${idrRate >= 1 ? Math.round(idrRate).toLocaleString('id-ID') : idrRate.toFixed(4)} IDR`;

        return `
            <button type="button" class="currency-picker-row ${isSelected ? 'selected' : ''}" onclick="selectPickerCurrency('${code}')">
                <div class="cp-flag-circle">
                    <img src="${getCurrencyFlagUrl(code)}" alt="${code}" class="currency-flag-img">
                </div>
                <div class="cp-info">
                    <div class="cp-top">
                        <span class="cp-code">${code}</span>
                        <span class="cp-name">${escapeHTML(meta.name)}</span>
                    </div>
                    <div class="cp-bottom">
                        <span>${escapeHTML(meta.country || code)} (${escapeHTML(meta.symbol)})</span>
                        <span class="cp-rate-tag">${rateFormatted}</span>
                    </div>
                </div>
                <div class="cp-check">
                    ${isSelected ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-chevron-right"></i>'}
                </div>
            </button>
        `;
    }).join('');
}

window.filterCurrencyPickerList = function() {
    const searchInput = document.getElementById('currencyPickerSearchInput');
    const query = (searchInput?.value || '').trim();
    const clearBtn = document.getElementById('currencyPickerSearchClear');
    if (clearBtn) clearBtn.style.display = query ? 'block' : 'none';

    let selectedCode = 'USD';
    if (currentCurrencyPickerTarget === 'from') {
        selectedCode = document.getElementById('convSelectFrom')?.value || 'USD';
    } else if (currentCurrencyPickerTarget === 'to') {
        selectedCode = document.getElementById('convSelectTo')?.value || 'IDR';
    } else if (currentCurrencyPickerTarget === 'wallet') {
        selectedCode = currentCurrency;
    }

    renderCurrencyPickerList(selectedCode, query);
};

window.clearCurrencyPickerSearch = function() {
    const searchInput = document.getElementById('currencyPickerSearchInput');
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
    }
    window.filterCurrencyPickerList();
};

// Wire backdrop click & Escape for currency picker modal
(() => {
    document.addEventListener('click', (e) => {
        const modal = document.getElementById('currencyPickerModal');
        if (modal && e.target === modal) {
            window.closeCurrencyPicker();
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('currencyPickerModal');
            if (modal && modal.classList.contains('show')) {
                window.closeCurrencyPicker();
            }
        }
    });
})();

function initCurrencyConverter() {
    const selFrom = document.getElementById('convSelectFrom');
    const selTo = document.getElementById('convSelectTo');
    const inputFrom = document.getElementById('convInputFrom');
    const inputTo = document.getElementById('convInputTo');
    const btnSwap = document.getElementById('btnSwapCurrency');
    
    if (!selFrom || !selTo || typeof CURRENCY_META === 'undefined') return;

    // Set initial display
    const fromCode = selFrom.value || 'USD';
    const toCode = selTo.value || 'IDR';
    updateConverterPillDisplay('from', fromCode);
    updateConverterPillDisplay('to', toCode);

    // Calculate function
    function doConvert(source) {
        const curFrom = selFrom.value || 'USD';
        const curTo = selTo.value || 'IDR';
        
        const rateFrom = Number(exchangeRates[curFrom]) || Number(FALLBACK_RATES[curFrom]) || 1;
        const rateTo = Number(exchangeRates[curTo]) || Number(FALLBACK_RATES[curTo]) || 1;
        
        const rateFactor = rateTo / rateFrom;
        
        if (source === 'from' || source === 'select') {
            const valFrom = parseFloat(inputFrom.value) || 0;
            const valTo = valFrom * rateFactor;
            
            const toMeta = CURRENCY_META[curTo] || { decimals: 2 };
            inputTo.value = (valTo % 1 === 0) ? valTo.toString() : valTo.toFixed(Math.min(toMeta.decimals, 4));
        } else if (source === 'to') {
            const valTo = parseFloat(inputTo.value) || 0;
            const valFrom = valTo / rateFactor;
            
            const fromMeta = CURRENCY_META[curFrom] || { decimals: 2 };
            inputFrom.value = (valFrom % 1 === 0) ? valFrom.toString() : valFrom.toFixed(Math.min(fromMeta.decimals, 4));
        }
        
        updateRateText(curFrom, curTo, rateFactor);
    }

    window.triggerCurrencyConvert = doConvert;
    
    function updateRateText(fromCode, toCode, rateFactor) {
        const textEl = document.getElementById('convRateText');
        const timeEl = document.getElementById('convRateTime');
        
        if (textEl) {
            let formatted = '';
            if (rateFactor >= 100) {
                formatted = rateFactor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            } else if (rateFactor >= 1) {
                formatted = rateFactor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
            } else {
                formatted = rateFactor.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
            }
            textEl.innerText = `1 ${fromCode} = ${formatted} ${toCode}`;
        }
        if (timeEl) {
            const now = new Date();
            const timeString = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':');
            timeEl.innerText = timeString + ' WIB';
        }
    }

    inputFrom.oninput = () => doConvert('from');
    inputTo.oninput = () => doConvert('to');
    
    if (btnSwap) {
        btnSwap.onclick = () => {
            btnSwap.classList.add('rotating');
            setTimeout(() => btnSwap.classList.remove('rotating'), 350);

            const tempFrom = selFrom.value;
            const tempTo = selTo.value;
            updateConverterPillDisplay('from', tempTo);
            updateConverterPillDisplay('to', tempFrom);

            const tempVal = inputFrom.value;
            inputFrom.value = inputTo.value;
            doConvert('from');
        };
    }
    
    // Initial calculate
    doConvert('select');
}

// Run initialization
setTimeout(initCurrencyConverter, 1000); // Initial
document.getElementById('btnRefreshRates')?.addEventListener('click', () => {
    setTimeout(initCurrencyConverter, 1500); // Update when refresh button is clicked
});

window.startDemoMode = function() {
    window.isDemoMode = true;
    currentUser = {
        uid: 'demo_user_alva_2026',
        displayName: 'Alexander Ray',
        email: 'alexander@pocketly.id',
        photoURL: ''
    };

    // 1. Setup Demo Accounts
    accounts = [
        { id: 'acc_bca', name: 'BCA Prioritas', balance: 45250000, uid: currentUser.uid },
        { id: 'acc_mandiri', name: 'Mandiri Utama', balance: 18500000, uid: currentUser.uid },
        { id: 'acc_gopay', name: 'GoPay Wallet', balance: 1750000, uid: currentUser.uid },
        { id: 'acc_dana', name: 'Dana Dompet', balance: 850000, uid: currentUser.uid },
        { id: 'acc_cash', name: 'Uang Tunai', balance: 1200000, uid: currentUser.uid }
    ];

    // 2. Setup Demo Transactions
    rawTransactions = [
        { id: 't1', date: '2026-10-07', desc: 'Gaji Bulanan Pro', amount: 25000000, type: 'income', category: 'Salary', account: 'BCA Prioritas', uid: currentUser.uid },
        { id: 't2', date: '2026-10-06', desc: 'Dividen Portofolio Saham', amount: 3500000, type: 'income', category: 'Investment', account: 'Mandiri Utama', uid: currentUser.uid },
        { id: 't3', date: '2026-10-06', desc: 'Belanja Bulanan Supermarket', amount: 1850000, type: 'expense', category: 'Shopping', account: 'BCA Prioritas', uid: currentUser.uid },
        { id: 't4', date: '2026-10-05', desc: 'Makan Malam Sushi Tei', amount: 480000, type: 'expense', category: 'Food & Drink', account: 'GoPay Wallet', uid: currentUser.uid },
        { id: 't5', date: '2026-10-04', desc: 'Isi Bensin & Tol Mobil', amount: 650000, type: 'expense', category: 'Transportation', account: 'Mandiri Utama', uid: currentUser.uid },
        { id: 't6', date: '2026-10-03', desc: 'Tagihan Listrik & Internet Fiber', amount: 920000, type: 'expense', category: 'Bills & Utilities', account: 'BCA Prioritas', uid: currentUser.uid },
        { id: 't7', date: '2026-10-02', desc: 'Nongkrong Artisan Coffee', amount: 95000, type: 'expense', category: 'Food & Drink', account: 'Dana Dompet', uid: currentUser.uid },
        { id: 't8', date: '2026-10-01', desc: 'Langganan Gym & Kebugaran', amount: 550000, type: 'expense', category: 'Health', account: 'GoPay Wallet', uid: currentUser.uid },
        { id: 't9', date: '2026-09-28', desc: 'Bonus Kinerja Q3', amount: 10000000, type: 'income', category: 'Salary', account: 'BCA Prioritas', uid: currentUser.uid },
        { id: 't10', date: '2026-09-25', desc: 'Buku & Kursus Desain AI', amount: 420000, type: 'expense', category: 'Education', account: 'BCA Prioritas', uid: currentUser.uid }
    ];

    // 3. Setup Demo Debts
    rawDebts = [
        {
            id: 'd1',
            kind: 'lent',
            partyName: 'Budi Santoso',
            principal: 5000000,
            remaining: 3000000,
            accountName: 'BCA Prioritas',
            startDate: '2026-09-15',
            dueDate: '2026-10-15',
            notes: 'Pinjaman modal usaha',
            status: 'active',
            history: [{ amount: 2000000, date: '2026-10-01', note: 'Cicilan 1' }],
            uid: currentUser.uid
        },
        {
            id: 'd2',
            kind: 'borrowed',
            partyName: 'Cicilan Laptop Pro',
            principal: 15000000,
            remaining: 6000000,
            accountName: 'Mandiri Utama',
            startDate: '2026-08-01',
            dueDate: '2026-10-25',
            notes: 'Cicilan 0% 12 bulan',
            status: 'active',
            history: [{ amount: 9000000, date: '2026-09-25', note: 'Cicilan berjalan' }],
            uid: currentUser.uid
        }
    ];

    // 4. Setup Demo Budgets & Goals
    rawBudgets = [
        {
            id: 'g1',
            type: 'goal',
            name: 'Liburan Musim Semi Jepang',
            target: 35000000,
            current: 24500000,
            visibility: 'shared',
            partners: ['Sarah Jenkins'],
            uid: currentUser.uid
        },
        {
            id: 'g2',
            type: 'goal',
            name: 'Dana Darurat 6 Bulan',
            target: 60000000,
            current: 45000000,
            visibility: 'personal',
            partners: [],
            uid: currentUser.uid
        },
        {
            id: 'b1',
            type: 'budget',
            name: 'Food & Drink',
            target: 3500000,
            current: 1850000,
            category: 'Food & Drink',
            uid: currentUser.uid
        },
        {
            id: 'b2',
            type: 'budget',
            name: 'Transportation',
            target: 1500000,
            current: 1200000,
            category: 'Transportation',
            uid: currentUser.uid
        },
        {
            id: 'b3',
            type: 'budget',
            name: 'Shopping',
            target: 2500000,
            current: 2350000,
            category: 'Shopping',
            uid: currentUser.uid
        }
    ];

    // 5. Setup Demo Friends
    rawFriends = [
        { id: 'f1', name: 'Sarah Jenkins', userID: 'sarah_j', email: 'sarah@example.com', avatar: 'SJ' },
        { id: 'f2', name: 'David Kusuma', userID: 'davidk', email: 'david@example.com', avatar: 'DK' }
    ];

    // 6. Update Profile UI
    const headerAvatar = document.getElementById('headerAvatar');
    if (headerAvatar) headerAvatar.innerText = 'AR';
    const sidebarAvatar = document.getElementById('sidebarAvatar');
    if (sidebarAvatar) sidebarAvatar.innerText = 'AR';
    const sidebarUserName = document.getElementById('sidebarUserName');
    if (sidebarUserName) sidebarUserName.innerText = 'Alexander Ray';
    const sidebarUserEmail = document.getElementById('sidebarUserEmail');
    if (sidebarUserEmail) sidebarUserEmail.innerText = 'alexander@pocketly.id';
    const settingsUserName = document.getElementById('settingsUserName');
    if (settingsUserName) settingsUserName.innerText = 'Alexander Ray';
    const settingsUserEmail = document.getElementById('settingsUserEmail');
    if (settingsUserEmail) settingsUserEmail.innerText = 'alexander@pocketly.id';
    const settingsProfileInitials = document.getElementById('settingsProfileInitials');
    if (settingsProfileInitials) settingsProfileInitials.innerText = 'AR';

    // 7. Update Select Options
    const accSelect = document.getElementById('inputAccount');
    const toAccSelect = document.getElementById('inputToAccount');
    const filterAccSelect = document.getElementById('transFilterAccount');
    const debtAccSelect = document.getElementById('debtAccount');
    const debtPayAccSelect = document.getElementById('debtPaymentAccount');
    const reportAccSelect = document.getElementById('reportAccount');
    const topupAccSelect = document.getElementById('topupAccount');
    const refundAccSelect = document.getElementById('refundAccountSelect');

    const defaultOpt = `<option value="" disabled selected>Select Account</option><option value="NEW_ACCOUNT" style="font-weight:bold; color:var(--blue-accent);">+ Add New Account</option>`;

    if (accSelect) accSelect.innerHTML = defaultOpt + accounts.map(a => `<option value="${a.name}">${a.name} (${formatRupiah(a.balance)})</option>`).join('');
    if (toAccSelect) toAccSelect.innerHTML = `<option value="" disabled selected>Select Destination Account</option>` + accounts.map(a => `<option value="${a.name}">${a.name}</option>`).join('');
    const allAccountsText = (window.PocketlyI18n && typeof window.PocketlyI18n.t === 'function')
        ? window.PocketlyI18n.t('filter_all_accounts', 'All Accounts')
        : 'All Accounts';
    if (filterAccSelect) filterAccSelect.innerHTML = `<option value="all">${allAccountsText}</option>` + accounts.map(a => `<option value="${a.name}">${a.name}</option>`).join('');
    if (debtAccSelect) debtAccSelect.innerHTML = accounts.map(a => `<option value="${a.name}">${a.name}</option>`).join('');
    if (debtPayAccSelect) debtPayAccSelect.innerHTML = accounts.map(a => `<option value="${a.name}">${a.name}</option>`).join('');
    if (reportAccSelect) {
        reportAccSelect.innerHTML = `<option value="All">${allAccountsText}</option>` + accounts.map(a => `<option value="${a.name}">${a.name}</option>`).join('');
        if (typeof reportAccSelect.__syncSearchable === 'function') reportAccSelect.__syncSearchable();
    }
    if (topupAccSelect) topupAccSelect.innerHTML = accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    if (refundAccSelect) refundAccSelect.innerHTML = accounts.map(a => `<option value="${a.name}">${a.name}</option>`).join('');

    // 8. Render Account Cards
    renderAccountsFromCache();

    // 9. Hide Auth Screen, Show App Screen
    const authScreen = document.getElementById('authScreen');
    if (authScreen) authScreen.style.display = 'none';
    const appScreen = document.getElementById('appScreen');
    if (appScreen) appScreen.style.display = 'block';

    const mobileBottomNav = document.getElementById('mobileBottomNav');
    if (mobileBottomNav) {
        mobileBottomNav.style.display = (window.innerWidth <= 860) ? 'flex' : 'none';
    }

    initFilters();
    updatePrivacyUI();
    populateCategorySelects();
    updateDashboard();
    renderSmartBudgets();
    renderDebtTracker();
    renderFriendsList();
    renderCurrencyOptions();
    renderThemeSettingsPage();
    renderManageCategories();
    if (typeof renderCalendar === 'function') renderCalendar();
    if (typeof updateReportsPage === 'function') updateReportsPage();
    if (typeof initCurrencyConverter === 'function') initCurrencyConverter();
    initCustomSelects();

    window.switchPage('dashboard', false);
};

window.initCustomSelects = initCustomSelects;
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(initCustomSelects, 150);
});

// ============================================================================
// POCKETLY NOTIFICATION ENGINE & CENTRAL NOTIFICATION CENTER
// ============================================================================
window.PocketlyNotification = {
    rawGoalInvites: [],
    currentFilter: 'all', // 'all' | 'unread'
    activeNotifications: [],
    sentSystemNotifIds: new Set(),

    getPreferences() {
        try {
            const raw = localStorage.getItem('pocketly_notif_prefs');
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        return {
            systemNotif: false,
            budgetAlerts: true,
            debtAlerts: true,
            goalAlerts: true,
            inviteAlerts: true,
            dailyReminder: true
        };
    },

    savePreference(key, value) {
        const prefs = this.getPreferences();
        prefs[key] = value;
        localStorage.setItem('pocketly_notif_prefs', JSON.stringify(prefs));
        this.updateCenter();
        this.syncSettingsUI();
    },

    getReadIds() {
        try {
            const raw = localStorage.getItem('pocketly_read_notif_ids');
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        return [];
    },

    isRead(id) {
        return this.getReadIds().includes(id);
    },

    markRead(id) {
        const ids = this.getReadIds();
        if (!ids.includes(id)) {
            ids.push(id);
            localStorage.setItem('pocketly_read_notif_ids', JSON.stringify(ids));
        }
        if (window.PocketlyAudio && typeof window.PocketlyAudio.play === 'function') {
            window.PocketlyAudio.play('click');
        }
        this.updateCenter();
    },

    markAllRead() {
        const all = this.generateNotifications();
        const ids = Array.from(new Set([...this.getReadIds(), ...all.map(n => n.id)]));
        localStorage.setItem('pocketly_read_notif_ids', JSON.stringify(ids));
        if (window.PocketlyAudio && typeof window.PocketlyAudio.play === 'function') {
            window.PocketlyAudio.play('success');
        }
        this.updateCenter();
    },

    setFilter(filter) {
        this.currentFilter = filter;
        const filterPills = {
            'all': 'pillFilterAll',
            'unread': 'pillFilterUnread',
            'budget': 'pillFilterBudget',
            'debt': 'pillFilterDebt',
            'goal': 'pillFilterGoal',
            'reminder': 'pillFilterReminder'
        };
        Object.entries(filterPills).forEach(([key, pillId]) => {
            const el = document.getElementById(pillId);
            if (el) el.classList.toggle('active', filter === key);
        });
        if (window.PocketlyAudio && typeof window.PocketlyAudio.play === 'function') {
            window.PocketlyAudio.play('click');
        }
        this.render();
    },

    getFilteredNotifications() {
        const list = this.activeNotifications || [];
        switch (this.currentFilter) {
            case 'unread':
                return list.filter(n => !this.isRead(n.id));
            case 'budget':
                return list.filter(n => n.id.startsWith('budget_') || n.categoryKey === 'notif_cat_budget' || n.category === 'Batas Anggaran' || n.category === 'Budget Limit');
            case 'debt':
                return list.filter(n => n.id.startsWith('debt_') || n.categoryKey === 'notif_cat_debt' || n.category === 'Hutang & Piutang' || n.category === 'Debts & Loans');
            case 'goal':
                return list.filter(n => n.id.startsWith('goal_') || n.id.startsWith('invite_') || n.categoryKey === 'notif_cat_goal' || n.categoryKey === 'notif_cat_collab' || n.category === 'Target Tabungan' || n.category === 'Kolaborasi');
            case 'reminder':
                return list.filter(n => n.id.startsWith('daily_') || n.id.startsWith('security_') || n.categoryKey === 'notif_cat_daily' || n.categoryKey === 'notif_cat_security' || n.category === 'Pengingat Harian' || n.category === 'Keamanan Akun');
            case 'all':
            default:
                return list;
        }
    },

    openCenter() {
        if (typeof window.navigateToNotifications === 'function') {
            window.navigateToNotifications();
        } else if (typeof switchPage === 'function') {
            switchPage('notifications');
        }
    },

    closeCenter() {
        if (typeof window.navigateBackFromNotifications === 'function') {
            window.navigateBackFromNotifications();
        } else if (typeof switchPage === 'function') {
            switchPage(window.lastVisitedPage || 'dashboard');
        }
    },

    openSettings() {
        if (typeof window.navigateToNotifications === 'function') {
            window.navigateToNotifications();
        }
        const drawer = document.getElementById('notifPreferencesDrawer');
        if (drawer) drawer.style.display = 'block';
    },

    closeSettings() {
        const drawer = document.getElementById('notifPreferencesDrawer');
        if (drawer) drawer.style.display = 'none';
    },

    async requestSystemPermission() {
        const lang = (window.PocketlyI18n && typeof window.PocketlyI18n.getCurrentLanguage === 'function')
            ? window.PocketlyI18n.getCurrentLanguage()
            : 'id';
        const isZh = lang === 'zh';
        const isId = lang === 'id';

        // 1. Native Android Local Notifications (Capacitor)
        if (window.PocketlyNativeNotification && window.PocketlyNativeNotification.isAvailable()) {
            try {
                const granted = await window.PocketlyNativeNotification.requestPermission();
                window.__nativeNotifPerm = granted ? 'granted' : 'denied';
                this.savePreference('systemNotif', granted);
                this.syncSettingsUI();

                if (granted) {
                    if (typeof showAlert === 'function') {
                        const grantedMsg = isZh
                            ? '系统通知权限已开启！'
                            : (isId ? 'Izin notifikasi Android berhasil diaktifkan!' : 'Android notification permission enabled successfully!');
                        showAlert(grantedMsg, false);
                    }
                    const welcomeTitle = isZh ? 'Pocketly 财务' : 'Pocketly Finance';
                    const welcomeBody = isZh
                        ? '系统通知已激活。当预算达到上限或款项到期时，您将收到实时提醒。'
                        : (isId
                            ? 'Notifikasi sistem aktif. Anda akan menerima peringatan penting batas anggaran dan hutang secara real-time.'
                            : 'System notifications active. You will receive real-time alerts for budget limits and debt due dates.');
                    this.sendPushNotification(welcomeTitle, {
                        body: welcomeBody,
                        tag: 'welcome_notif'
                    });
                    return true;
                } else {
                    if (typeof showAlert === 'function') {
                        const deniedMsg = isZh
                            ? '未授予通知权限。请在系统设置中允许Pocketly发送通知。'
                            : (isId ? 'Izin notifikasi tidak diberikan. Harap aktifkan izin di Pengaturan Android.' : 'Notification permission was denied. Please enable it in Android Settings.');
                        showAlert(deniedMsg, true);
                    }
                    return false;
                }
            } catch (err) {
                console.error('[Notification] Native permission request error:', err);
                return false;
            }
        }

        // 2. Standard Web Notifications API Fallback
        if (!('Notification' in window)) {
            if (typeof showAlert === 'function') {
                const unsupportedMsg = isZh
                    ? '当前浏览器不支持 Web Notifications API。'
                    : (isId ? 'Browser ini tidak mendukung Web Notifications API.' : 'This browser does not support the Web Notifications API.');
                showAlert(unsupportedMsg, true);
            }
            return false;
        }
        try {
            const permission = await Notification.requestPermission();
            this.syncSettingsUI();
            if (permission === 'granted') {
                this.savePreference('systemNotif', true);
                if (typeof showAlert === 'function') {
                    const grantedMsg = isZh
                        ? '浏览器通知权限已开启！'
                        : (isId ? 'Notifikasi browser berhasil diaktifkan!' : 'Browser notifications enabled successfully!');
                    showAlert(grantedMsg, false);
                }
                const welcomeBody = isZh
                    ? '系统通知已激活。当预算达到上限或款项到期时，您将收到实时提醒。'
                    : (isId
                        ? 'Notifikasi sistem aktif. Anda akan menerima peringatan penting batas anggaran dan hutang secara real-time.'
                        : 'System notifications active. You will receive real-time alerts for budget limits and debt due dates.');
                this.sendPushNotification('Pocketly Finance', {
                    body: welcomeBody,
                    tag: 'welcome_notif'
                });
                return true;
            } else {
                this.savePreference('systemNotif', false);
                if (typeof showAlert === 'function') {
                    const deniedMsg = isZh
                        ? '浏览器未授予通知权限。'
                        : (isId ? 'Izin notifikasi tidak diberikan oleh browser.' : 'Notification permission was denied by the browser.');
                    showAlert(deniedMsg, true);
                }
                return false;
            }
        } catch (err) {
            console.error('Request notification permission error:', err);
            return false;
        }
    },

    sendPushNotification(title, options = {}) {
        const prefs = this.getPreferences();
        if (!prefs.systemNotif) return;

        // 1. Native Android Local Notifications (Capacitor)
        if (window.PocketlyNativeNotification && window.PocketlyNativeNotification.isAvailable()) {
            try {
                window.PocketlyNativeNotification.schedule(title, options.body || '', options.id, options);
                return;
            } catch (e) {
                console.warn('[Notification] Native push schedule warning:', e);
            }
        }

        // 2. Standard Web Notifications API Fallback
        if (!('Notification' in window)) return;
        if (Notification.permission !== 'granted') return;

        try {
            const n = new Notification(title, {
                icon: options.icon || 'icons/icon-192.png',
                badge: options.badge || 'icons/icon-192.png',
                tag: options.tag || ('pocketly_' + Date.now()),
                ...options
            });
            n.onclick = () => {
                window.focus();
                n.close();
                if (typeof window.navigateToNotifications === 'function') {
                    window.navigateToNotifications();
                } else if (typeof switchPage === 'function') {
                    switchPage('notifications');
                }
            };
        } catch (e) {
            console.warn('[Notification] Push display warning:', e);
        }
    },

    sendTestNotification() {
        const lang = (window.PocketlyI18n && typeof window.PocketlyI18n.getCurrentLanguage === 'function')
            ? window.PocketlyI18n.getCurrentLanguage()
            : 'id';
        const isZh = lang === 'zh';
        const isId = lang === 'id';
        const testTitle = isZh ? 'Pocketly 测试通知' : (isId ? 'Uji Coba Notifikasi Pocketly' : 'Pocketly Test Notification');
        const testBody = isZh
            ? 'Pocketly 通知系统运行正常，随时准备为您提供财务提醒！'
            : (isId
                ? 'Sistem notifikasi Pocketly berfungsi dengan baik dan siap memberikan peringatan finansial!'
                : 'Pocketly notification system is working smoothly and ready for alerts!');
        const toastMsg = isZh ? '测试通知已发送。' : (isId ? 'Notifikasi uji coba telah dikirim.' : 'Test notification sent.');

        this.sendPushNotification(testTitle, {
            body: testBody,
            tag: 'test_notification_' + Date.now()
        });
        if (typeof showAlert === 'function') {
            showAlert(toastMsg, false);
        }
    },

    _t(key, fallback) {
        return (window.PocketlyI18n && typeof window.PocketlyI18n.t === 'function')
            ? window.PocketlyI18n.t(key, fallback)
            : fallback;
    },

    generateNotifications() {
        const list = [];
        const prefs = this.getPreferences();
        const now = new Date();
        const currentYear = String(now.getFullYear());
        const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
        const monthKey = `${currentYear}-${currentMonth}`;
        const todayStr = `${currentYear}-${currentMonth}-${String(now.getDate()).padStart(2, '0')}`;
        const lang = (window.PocketlyI18n && typeof window.PocketlyI18n.getCurrentLanguage === 'function')
            ? window.PocketlyI18n.getCurrentLanguage()
            : 'id';
        const isZh = lang === 'zh';
        const isId = lang === 'id';

        // 1. Budget Alerts
        if (prefs.budgetAlerts && Array.isArray(rawBudgets) && Array.isArray(rawTransactions)) {
            const categoryBudgets = rawBudgets.filter(b => b.type === 'budget');
            categoryBudgets.forEach(b => {
                const limit = Number(b.target || 0);
                if (limit <= 0) return;
                const catExpenses = rawTransactions.filter(t => {
                    if (t.category !== b.name || t.type !== 'expense') return false;
                    return t.date && t.date.startsWith(monthKey);
                });
                const spent = catExpenses.reduce((sum, t) => sum + Number(t.amount || 0), 0);
                const percent = Math.round((spent / limit) * 100);

                if (percent >= 100) {
                    list.push({
                        id: `budget_over_${b.id}_${monthKey}`,
                        categoryKey: 'notif_cat_budget',
                        category: isZh ? '预算上限' : (isId ? 'Batas Anggaran' : 'Budget Limit'),
                        priority: 'danger',
                        icon: 'fa-solid fa-triangle-exclamation',
                        title: isZh ? `预算超支: ${b.name}` : (isId ? `Limit Anggaran Terlampaui: ${b.name}` : `Budget Limit Exceeded: ${b.name}`),
                        message: isZh
                            ? `支出 ${b.name} 已超出月度限额 ${percent}% (已用 ${formatRupiah(spent)} / 限额 ${formatRupiah(limit)})。建议控制该分类支出。`
                            : (isId
                                ? `Pengeluaran ${b.name} telah melebihi batas bulanan sebesar ${percent}% (${formatRupiah(spent)} dari target ${formatRupiah(limit)}). Batasi pengeluaran untuk kategori ini.`
                                : `Spending for ${b.name} has exceeded your monthly limit by ${percent}% (${formatRupiah(spent)} of ${formatRupiah(limit)}). Consider limiting further expenses.`),
                        time: isZh ? '本月' : (isId ? 'Bulan ini' : 'This month'),
                        actionTextKey: 'notif_act_view_budget',
                        actionText: isZh ? '查看预算' : (isId ? 'Lihat Anggaran' : 'View Budget'),
                        action: () => {
                            switchPage('budget');
                            PocketlyNotification.closeCenter();
                        }
                    });
                } else if (percent >= 80) {
                    list.push({
                        id: `budget_warn_${b.id}_${monthKey}`,
                        categoryKey: 'notif_cat_budget',
                        category: isZh ? '预算上限' : (isId ? 'Batas Anggaran' : 'Budget Limit'),
                        priority: 'warning',
                        icon: 'fa-solid fa-circle-exclamation',
                        title: isZh ? `接近预算上限: ${b.name}` : (isId ? `Mendekati Limit: ${b.name}` : `Approaching Limit: ${b.name}`),
                        message: isZh
                            ? `支出 ${b.name} 已达到月度限额的 ${percent}% (已用 ${formatRupiah(spent)} / 限额 ${formatRupiah(limit)})。请注意合理规划支出。`
                            : (isId
                                ? `Pengeluaran ${b.name} sudah mencapai ${percent}% (${formatRupiah(spent)} dari target ${formatRupiah(limit)}). Tetap waspada sebelum batas terlewati.`
                                : `Spending for ${b.name} has reached ${percent}% (${formatRupiah(spent)} of ${formatRupiah(limit)}). Stay mindful before the limit is exceeded.`),
                        time: isZh ? '本月' : (isId ? 'Bulan ini' : 'This month'),
                        actionTextKey: 'notif_act_view_budget',
                        actionText: isZh ? '查看预算' : (isId ? 'Lihat Anggaran' : 'View Budget'),
                        action: () => {
                            switchPage('budget');
                            PocketlyNotification.closeCenter();
                        }
                    });
                }
            });
        }

        // 2. Debt & Loan Alerts
        if (prefs.debtAlerts && Array.isArray(rawDebts)) {
            const activeDebts = rawDebts.filter(d => (typeof getDebtStatus === 'function' ? getDebtStatus(d) : d.status) === 'active');
            activeDebts.forEach(d => {
                if (!d.dueDate) return;
                const due = new Date(d.dueDate + 'T00:00:00');
                const todayMidnight = new Date();
                todayMidnight.setHours(0, 0, 0, 0);
                due.setHours(0, 0, 0, 0);
                const diffDays = Math.round((due - todayMidnight) / 86400000);
                const remaining = Number(d.remaining ?? d.principal ?? 0);
                const party = d.partyName || d.name || (isZh ? '相关联系人' : (isId ? 'Pihak Terkait' : 'Contact'));
                const kindText = isZh
                    ? (d.kind === 'borrowed' ? '您应付给' : '您应收自')
                    : (isId
                        ? (d.kind === 'borrowed' ? 'Hutang Anda kepada' : 'Piutang Anda dari')
                        : (d.kind === 'borrowed' ? 'Your debt to' : 'Your receivable from'));

                if (diffDays < 0) {
                    list.push({
                        id: `debt_overdue_${d.id}`,
                        categoryKey: 'notif_cat_debt',
                        category: isZh ? '债务与借贷' : (isId ? 'Hutang & Piutang' : 'Debts & Loans'),
                        priority: 'danger',
                        icon: 'fa-solid fa-clock-rotate-left',
                        title: isZh ? `已逾期: ${party}` : (isId ? `Lewat Jatuh Tempo: ${party}` : `Overdue: ${party}`),
                        message: isZh
                            ? `${kindText} ${party} 的款项 ${formatRupiah(remaining)} 已逾期 ${Math.abs(diffDays)} 天。请尽快处理。`
                            : (isId
                                ? `${kindText} ${party} sebesar ${formatRupiah(remaining)} telah melewati jatuh tempo ${Math.abs(diffDays)} hari. Segera selesaikan pembayaran.`
                                : `${kindText} ${party} of ${formatRupiah(remaining)} is overdue by ${Math.abs(diffDays)} days. Please settle payment promptly.`),
                        time: isZh ? `逾期 ${Math.abs(diffDays)} 天` : (isId ? `${Math.abs(diffDays)} hari lewat` : `${Math.abs(diffDays)}d overdue`),
                        actionTextKey: 'notif_act_view_details',
                        actionText: isZh ? '查看详情' : (isId ? 'Lihat Rincian' : 'View Details'),
                        action: () => {
                            switchPage('dashboard');
                            PocketlyNotification.closeCenter();
                            setTimeout(() => {
                                const widget = document.getElementById('debtTrackerWidget');
                                if (widget) widget.scrollIntoView({ behavior: 'smooth' });
                            }, 250);
                        }
                    });
                } else if (diffDays === 0) {
                    list.push({
                        id: `debt_today_${d.id}`,
                        categoryKey: 'notif_cat_debt',
                        category: isZh ? '债务与借贷' : (isId ? 'Hutang & Piutang' : 'Debts & Loans'),
                        priority: 'warning',
                        icon: 'fa-solid fa-calendar-day',
                        title: isZh ? `今日到期: ${party}` : (isId ? `Jatuh Tempo Hari Ini: ${party}` : `Due Today: ${party}`),
                        message: isZh
                            ? `${kindText} ${party} 的款项 ${formatRupiah(remaining)} 今日到期！`
                            : (isId
                                ? `${kindText} ${party} sebesar ${formatRupiah(remaining)} jatuh tempo hari ini!`
                                : `${kindText} ${party} of ${formatRupiah(remaining)} is due today!`),
                        time: isZh ? '今天' : (isId ? 'Hari ini' : 'Today'),
                        actionTextKey: 'notif_act_view_details',
                        actionText: isZh ? '查看详情' : (isId ? 'Lihat Rincian' : 'View Details'),
                        action: () => {
                            switchPage('dashboard');
                            PocketlyNotification.closeCenter();
                        }
                    });
                } else if (diffDays <= 3) {
                    list.push({
                        id: `debt_soon_${d.id}`,
                        categoryKey: 'notif_cat_debt',
                        category: isZh ? '债务与借贷' : (isId ? 'Hutang & Piutang' : 'Debts & Loans'),
                        priority: 'warning',
                        icon: 'fa-solid fa-hourglass-half',
                        title: isZh ? `即将到期: ${party}` : (isId ? `Jatuh Tempo Segera: ${party}` : `Due Soon: ${party}`),
                        message: isZh
                            ? `${kindText} ${party} 的款项 ${formatRupiah(remaining)} 将在 ${diffDays} 天后 (${d.dueDate}) 到期。`
                            : (isId
                                ? `${kindText} ${party} sebesar ${formatRupiah(remaining)} akan jatuh tempo dalam ${diffDays} hari (${d.dueDate}).`
                                : `${kindText} ${party} of ${formatRupiah(remaining)} is due in ${diffDays} days (${d.dueDate}).`),
                        time: isZh ? `${diffDays}天后到期` : (isId ? `H-${diffDays}` : `In ${diffDays}d`),
                        actionTextKey: 'notif_act_view_details',
                        actionText: isZh ? '查看详情' : (isId ? 'Lihat Rincian' : 'View Details'),
                        action: () => {
                            switchPage('dashboard');
                            PocketlyNotification.closeCenter();
                        }
                    });
                }
            });
        }

        // 3. Savings Goal Milestones
        if (prefs.goalAlerts && Array.isArray(rawBudgets)) {
            const goals = rawBudgets.filter(b => b.type === 'goal');
            goals.forEach(b => {
                const target = Number(b.target || 0);
                const current = Number(b.current || 0);
                if (target <= 0) return;
                const percent = Math.round((current / target) * 100);

                if (percent >= 100) {
                    list.push({
                        id: `goal_100_${b.id}`,
                        categoryKey: 'notif_cat_goal',
                        category: isZh ? '储蓄目标' : (isId ? 'Target Tabungan' : 'Savings Goal'),
                        priority: 'success',
                        icon: 'fa-solid fa-trophy',
                        title: isZh ? `目标达成: ${b.name}! 🎉` : (isId ? `Target Tercapai: ${b.name}! 🎉` : `Goal Reached: ${b.name}! 🎉`),
                        message: isZh
                            ? `太棒了！储蓄目标“${b.name}”已达成100% (${formatRupiah(current)})。恭喜您达成财务目标！`
                            : (isId
                                ? `Luar biasa! Target tabungan "${b.name}" telah terkumpul 100% (${formatRupiah(current)}). Sasaran finansial Anda telah tercapai!`
                                : `Incredible! Your savings goal "${b.name}" has reached 100% (${formatRupiah(current)}). Target achieved!`),
                        time: isZh ? '已达成' : (isId ? 'Pencapaian' : 'Completed'),
                        actionTextKey: 'notif_act_open_savings',
                        actionText: isZh ? '前往储蓄' : (isId ? 'Buka Tabungan' : 'Open Savings'),
                        action: () => {
                            switchPage('budget');
                            PocketlyNotification.closeCenter();
                        }
                    });
                } else if (percent >= 75) {
                    list.push({
                        id: `goal_75_${b.id}`,
                        categoryKey: 'notif_cat_goal',
                        category: isZh ? '储蓄目标' : (isId ? 'Target Tabungan' : 'Savings Goal'),
                        priority: 'primary',
                        icon: 'fa-solid fa-rocket',
                        title: isZh ? `75% 里程碑: ${b.name}` : (isId ? `Milestone 75%: ${b.name}` : `75% Milestone: ${b.name}`),
                        message: isZh
                            ? `“${b.name}”储蓄进度已达到 ${percent}% (${formatRupiah(current)} / ${formatRupiah(target)})。距离最终目标仅一步之遥！`
                            : (isId
                                ? `Tabungan "${b.name}" sudah mencapai ${percent}% (${formatRupiah(current)} dari ${formatRupiah(target)}). Sedikit lagi menuju target lengkap!`
                                : `Savings for "${b.name}" reached ${percent}% (${formatRupiah(current)} of ${formatRupiah(target)}). Almost there!`),
                        time: isZh ? '里程碑' : 'Milestone',
                        actionTextKey: 'notif_act_view_savings',
                        actionText: isZh ? '查看储蓄' : (isId ? 'Lihat Tabungan' : 'View Savings'),
                        action: () => {
                            switchPage('budget');
                            PocketlyNotification.closeCenter();
                        }
                    });
                } else if (percent >= 50) {
                    list.push({
                        id: `goal_50_${b.id}`,
                        categoryKey: 'notif_cat_goal',
                        category: isZh ? '储蓄目标' : (isId ? 'Target Tabungan' : 'Savings Goal'),
                        priority: 'primary',
                        icon: 'fa-solid fa-flag-checkered',
                        title: isZh ? `进度过半 (50%): ${b.name}` : (isId ? `Setengah Jalan (50%): ${b.name}` : `Halfway There (50%): ${b.name}`),
                        message: isZh
                            ? `“${b.name}”储蓄已达成一半 (${formatRupiah(current)})。请继续保持良好的储蓄习惯！`
                            : (isId
                                ? `Tabungan "${b.name}" telah mencapai separuh target (${formatRupiah(current)}). Pertahankan kedisiplinan menabung Anda!`
                                : `Savings for "${b.name}" reached half of your target (${formatRupiah(current)}). Keep up the great discipline!`),
                        time: isZh ? '里程碑' : 'Milestone',
                        actionTextKey: 'notif_act_view_savings',
                        actionText: isZh ? '查看储蓄' : (isId ? 'Lihat Tabungan' : 'View Savings'),
                        action: () => {
                            switchPage('budget');
                            PocketlyNotification.closeCenter();
                        }
                    });
                }
            });
        }

        // 4. Shared Goal Invitations
        if (prefs.inviteAlerts && Array.isArray(this.rawGoalInvites) && this.rawGoalInvites.length > 0) {
            this.rawGoalInvites.forEach(inv => {
                list.push({
                    id: `invite_${inv.id}`,
                    categoryKey: 'notif_cat_collab',
                    category: isZh ? '协同合作' : (isId ? 'Kolaborasi' : 'Collaboration'),
                    priority: 'purple',
                    icon: 'fa-solid fa-user-group',
                    title: isZh ? `共同储蓄邀请: ${inv.budgetName || '共同目标'}` : (isId ? `Undangan Tabungan: ${inv.budgetName || 'Target Bersama'}` : `Savings Invite: ${inv.budgetName || 'Shared Target'}`),
                    message: isZh
                        ? `${inv.fromName || '好友'} 邀请您共同参与“${inv.budgetName || '目标'}”储蓄计划。`
                        : (isId
                            ? `${inv.fromName || 'Seorang teman'} mengundang Anda untuk berkolaborasi menabung dalam target "${inv.budgetName || 'Target'}".`
                            : `${inv.fromName || 'A friend'} invited you to save together in target "${inv.budgetName || 'Target'}".`),
                    time: isZh ? '新邀请' : (isId ? 'Undangan Baru' : 'New Invite'),
                    actionTextKey: 'notif_act_review_invite',
                    actionText: isZh ? '查看邀请' : (isId ? 'Tinjau Undangan' : 'Review Invite'),
                    action: () => {
                        PocketlyNotification.closeCenter();
                        if (typeof openGoalInvitesModal === 'function') openGoalInvitesModal();
                    }
                });
            });
        }

        // 5. Daily Expense Log Reminder
        if (prefs.dailyReminder && Array.isArray(rawTransactions)) {
            const hasExpenseToday = rawTransactions.some(t => t.type === 'expense' && t.date === todayStr);
            if (!hasExpenseToday) {
                list.push({
                    id: `daily_reminder_${todayStr}`,
                    categoryKey: 'notif_cat_daily',
                    category: isZh ? '每日提醒' : (isId ? 'Pengingat Harian' : 'Daily Reminder'),
                    priority: 'info',
                    icon: 'fa-solid fa-receipt',
                    title: isZh ? '记录今日支出' : (isId ? 'Catat Pengeluaran Hari Ini' : "Log Today's Spending"),
                    message: isZh
                        ? '今天还没有记录任何支出。及时记账可以让您的财务状况井井有条。'
                        : (isId
                            ? 'Belum ada transaksi pengeluaran yang dicatat hari ini. Catat pengeluaran Anda agar cash flow tetap terdata dengan rapi.'
                            : 'No expenses recorded yet today. Track your transactions so your cash flow stays organized.'),
                    time: isZh ? '今天' : (isId ? 'Hari ini' : 'Today'),
                    actionTextKey: 'notif_act_add_trans',
                    actionText: isZh ? '记一笔' : (isId ? 'Tambah Transaksi' : 'Add Transaction'),
                    action: () => {
                        PocketlyNotification.closeCenter();
                        const fab = document.getElementById('openTransModalBtn') || document.getElementById('mobileAddFab');
                        if (fab) fab.click();
                        else {
                            const modal = document.getElementById('transactionModal');
                            if (modal) modal.classList.add('show');
                        }
                    }
                });
            }
        }

        // 6. Security Suggestion Tip
        const isPinEnabled = localStorage.getItem('pocketly_pin_enabled') === 'true';
        if (!isPinEnabled) {
            list.push({
                id: 'security_pin_tip',
                categoryKey: 'notif_cat_security',
                category: isZh ? '账户安全' : (isId ? 'Keamanan Akun' : 'Account Security'),
                priority: 'info',
                icon: 'fa-solid fa-shield-halved',
                title: isZh ? '保护您的财务数据' : (isId ? 'Lindungi Data Finansial Anda' : 'Protect Your Financial Data'),
                message: isZh
                    ? '在设置中开启应用锁 (4位PIN码)，守护您的账户余额与私密财务记录。'
                    : (isId
                        ? 'Aktifkan App Lock (PIN 4-Digit) di Pengaturan untuk melindungi privasi saldo serta seluruh catatan finansial Anda.'
                        : 'Enable App Lock (4-Digit PIN) in Settings to safeguard your balances and private records.'),
                time: isZh ? '推荐' : (isId ? 'Rekomendasi' : 'Recommended'),
                actionTextKey: 'notif_act_open_settings',
                actionText: isZh ? '前往设置' : (isId ? 'Buka Pengaturan' : 'Open Settings'),
                action: () => {
                    PocketlyNotification.closeCenter();
                    switchPage('account');
                }
            });
        }

        return list;
    },

    updatePushStatusBadge() {
        const badge = document.getElementById('statNotifPushStatus');
        const dot = document.getElementById('statPushDot');
        const quickBtn = document.getElementById('btnQuickPermRequest');
        const iconBox = document.getElementById('statPushIconBox');
        const statusSub = document.getElementById('statNotifPushSub');

        let perm = 'default';
        if (window.__nativeNotifPerm) {
            perm = window.__nativeNotifPerm;
        } else if (window.PocketlyNativeNotification && window.PocketlyNativeNotification.isAvailable()) {
            perm = 'default';
        } else if ('Notification' in window) {
            perm = Notification.permission;
        } else {
            if (badge) badge.innerText = this._t('notif_push_unsupported', 'Push: N/A');
            if (dot) dot.className = 'metric-dot red';
            if (quickBtn) quickBtn.style.display = 'none';
            if (statusSub) statusSub.innerText = this._t('notif_status_inapp_only', 'Hanya in-app alert');
            return;
        }

        if (perm === 'granted') {
            if (badge) badge.innerText = this._t('notif_push_active', 'Push: Aktif');
            if (dot) dot.className = 'metric-dot green';
            if (quickBtn) quickBtn.style.display = 'none';
            if (statusSub) statusSub.innerText = this._t('notif_status_active_inapp', 'Sistem & in-app');
            if (iconBox) iconBox.className = 'notif-ov-icon-box bg-green';
        } else if (perm === 'denied') {
            if (badge) badge.innerText = this._t('notif_push_disabled', 'Push: Mati');
            if (dot) dot.className = 'metric-dot red';
            if (quickBtn) quickBtn.style.display = 'none';
            if (statusSub) statusSub.innerText = this._t('notif_status_inapp_only', 'Izin ditolak');
            if (iconBox) iconBox.className = 'notif-ov-icon-box bg-red';
        } else {
            if (badge) badge.innerText = this._t('notif_push_enable', 'Aktifkan Push');
            if (dot) dot.className = 'metric-dot yellow';
            if (quickBtn) quickBtn.style.display = 'inline-flex';
            if (statusSub) statusSub.innerText = this._t('notif_push_enable', 'Ketuk untuk mengaktifkan');
            if (iconBox) iconBox.className = 'notif-ov-icon-box bg-yellow';
        }
    },

    updateCenter() {
        this.activeNotifications = this.generateNotifications();
        const unreadList = this.activeNotifications.filter(n => !this.isRead(n.id));
        const unreadCount = unreadList.length;

        // Update header bell badge
        const badge = document.getElementById('notifCenterBadge');
        if (badge) {
            if (unreadCount > 0) {
                badge.innerText = unreadCount > 99 ? '99+' : unreadCount;
                badge.style.display = 'inline-flex';
            } else {
                badge.style.display = 'none';
            }
        }

        // Update settings page row badge
        const settingBadge = document.getElementById('settingNotifBadge');
        if (settingBadge) {
            if (unreadCount > 0) {
                settingBadge.innerText = unreadCount;
                settingBadge.style.display = 'inline-block';
            } else {
                settingBadge.style.display = 'none';
            }
        }

        // Update page unread pill in header banner
        const pageUnreadPill = document.getElementById('notifPageUnreadPill');
        if (pageUnreadPill) {
            if (unreadCount > 0) {
                pageUnreadPill.innerText = `${unreadCount} ${this._t('notif_mini_new', 'Baru')}`;
                pageUnreadPill.style.display = 'inline-flex';
            } else {
                pageUnreadPill.style.display = 'none';
            }
        }

        // Update Overview Metric strip
        const statTotal = document.getElementById('statNotifTotal');
        const statUnread = document.getElementById('statNotifUnread');
        const statUnreadSub = document.getElementById('statNotifUnreadSub');
        if (statTotal) statTotal.innerText = this.activeNotifications.length;
        if (statUnread) statUnread.innerText = unreadCount;
        if (statUnreadSub) {
            statUnreadSub.innerText = unreadCount > 0 ? `${unreadCount} ${this._t('notif_unreviewed_count', 'belum dibaca')}` : this._t('notif_all_reviewed', 'Semua telah ditinjau');
        }

        // Update push status badge
        this.updatePushStatusBadge();

        // Update filter counters
        const countAll = document.getElementById('pageCountAll') || document.getElementById('notifCountAll');
        const countUnread = document.getElementById('pageCountUnread') || document.getElementById('notifCountUnread');
        const countBudget = document.getElementById('pageCountBudget');
        const countDebt = document.getElementById('pageCountDebt');
        const countGoal = document.getElementById('pageCountGoal');
        const countReminder = document.getElementById('pageCountReminder');

        if (countAll) countAll.innerText = this.activeNotifications.length;
        if (countUnread) countUnread.innerText = unreadCount;
        if (countBudget) countBudget.innerText = this.activeNotifications.filter(n => n.id.startsWith('budget_') || n.categoryKey === 'notif_cat_budget' || n.category === 'Batas Anggaran' || n.category === 'Budget Limit').length;
        if (countDebt) countDebt.innerText = this.activeNotifications.filter(n => n.id.startsWith('debt_') || n.categoryKey === 'notif_cat_debt' || n.category === 'Hutang & Piutang' || n.category === 'Debts & Loans').length;
        if (countGoal) countGoal.innerText = this.activeNotifications.filter(n => n.id.startsWith('goal_') || n.id.startsWith('invite_') || n.categoryKey === 'notif_cat_goal' || n.categoryKey === 'notif_cat_collab' || n.category === 'Target Tabungan' || n.category === 'Kolaborasi').length;
        if (countReminder) countReminder.innerText = this.activeNotifications.filter(n => n.id.startsWith('daily_') || n.id.startsWith('security_') || n.categoryKey === 'notif_cat_daily' || n.categoryKey === 'notif_cat_security' || n.category === 'Pengingat Harian' || n.category === 'Keamanan Akun').length;

        // Trigger push notification for unread high priority items not yet sent in session
        const prefs = this.getPreferences();
        if (prefs.systemNotif && ((window.PocketlyNativeNotification && window.PocketlyNativeNotification.isAvailable()) || ('Notification' in window && Notification.permission === 'granted'))) {
            unreadList.forEach(item => {
                if ((item.priority === 'danger' || item.priority === 'warning') && !this.sentSystemNotifIds.has(item.id)) {
                    this.sentSystemNotifIds.add(item.id);
                    this.sendPushNotification(item.title, {
                        body: item.message,
                        tag: item.id
                    });
                }
            });
        }

        this.render();
    },

    render() {
        const container = document.getElementById('notificationsPageList') || document.getElementById('notificationListContainer');
        if (!container) return;

        const escapeStr = (str) => {
            if (!str) return '';
            return String(str).replace(/[&<>"']/g, m => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }[m]));
        };

        const displayed = this.getFilteredNotifications();

        if (displayed.length === 0) {
            let emptyHeading = this._t('notif_empty_all_title', 'Tidak Ada Notifikasi');
            let emptyDesc = this._t('notif_empty_all_desc', 'Semua pemberitahuan dan peringatan finansial telah ditinjau.');

            if (this.currentFilter === 'unread') {
                emptyHeading = this._t('notif_empty_unread_title', 'Semua Sudah Ditinjau');
                emptyDesc = this._t('notif_empty_unread_desc', 'Tidak ada notifikasi baru yang belum dibaca.');
            } else if (this.currentFilter === 'budget') {
                emptyHeading = this._t('notif_empty_budget_title', 'Anggaran Berjalan Aman');
                emptyDesc = this._t('notif_empty_budget_desc', 'Tidak ada kategori pengeluaran yang mendekati batas limit.');
            } else if (this.currentFilter === 'debt') {
                emptyHeading = this._t('notif_empty_debt_title', 'Tidak Ada Jatuh Tempo');
                emptyDesc = this._t('notif_empty_debt_desc', 'Semua catatan hutang dan piutang dalam kondisi aman.');
            } else if (this.currentFilter === 'goal') {
                emptyHeading = this._t('notif_empty_goal_title', 'Belum Ada Milestone Baru');
                emptyDesc = this._t('notif_empty_goal_desc', 'Terus tingkatkan tabungan untuk mencapai target finansial.');
            } else if (this.currentFilter === 'reminder') {
                emptyHeading = this._t('notif_empty_reminder_title', 'Catatan Hari Ini Lengkap');
                emptyDesc = this._t('notif_empty_reminder_desc', 'Tidak ada pengingat catatan transaksi yang tertunda.');
            }

            container.innerHTML = `
                <div class="notif-empty-box">
                    <div class="notif-empty-icon-wrap">
                        <i class="fa-regular fa-bell-slash"></i>
                    </div>
                    <h4>${escapeStr(emptyHeading)}</h4>
                    <p>${escapeStr(emptyDesc)}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = displayed.map((item, index) => {
            const isUnread = !this.isRead(item.id);
            const priorityClass = item.priority || 'primary';
            const actionId = `notif_act_${item.id.replace(/[^a-zA-Z0-9_]/g, '_')}`;
            const categoryLabel = item.categoryKey ? this._t(item.categoryKey, item.category) : (item.category || '');
            const actionLabel = item.actionTextKey ? this._t(item.actionTextKey, item.actionText) : (item.actionText || '');
            const markReadTitle = this._t('notif_btn_mark_read', 'Tandai sudah dibaca');

            return `
                <div class="notif-card-item ${isUnread ? 'is-unread ' + priorityClass : ''}" style="--item-idx: ${index};">
                    <div class="notif-avatar-sq ${priorityClass}">
                        <i class="${item.icon}"></i>
                    </div>
                    <div class="notif-body-col">
                        <div class="notif-row-top">
                            <span class="notif-cat-chip">${escapeStr(categoryLabel)}</span>
                            <span class="notif-time-text">${escapeStr(item.time)}</span>
                            ${isUnread ? '<span class="notif-unread-glow-dot" title="Belum dibaca"></span>' : ''}
                        </div>
                        <h4 class="notif-item-title">${escapeStr(item.title)}</h4>
                        <p class="notif-item-desc">${escapeStr(item.message)}</p>
                        <div class="notif-item-footer">
                            ${actionLabel ? `
                                <button type="button" class="notif-action-chip" id="${actionId}">
                                    <span>${escapeStr(actionLabel)}</span>
                                    <i class="fa-solid fa-arrow-right"></i>
                                </button>
                            ` : '<span></span>'}
                            ${isUnread ? `
                                <button type="button" class="notif-dismiss-icon-btn" onclick="PocketlyNotification.markRead('${item.id}')" title="${escapeStr(markReadTitle)}" aria-label="${escapeStr(markReadTitle)}">
                                    <i class="fa-solid fa-check"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Wire action handlers cleanly
        displayed.forEach(item => {
            if (item.actionText && typeof item.action === 'function') {
                const actionId = `notif_act_${item.id.replace(/[^a-zA-Z0-9_]/g, '_')}`;
                const btn = document.getElementById(actionId);
                if (btn) {
                    btn.addEventListener('click', () => {
                        PocketlyNotification.markRead(item.id);
                        item.action();
                    });
                }
            }
        });
    },

    syncSettingsUI() {
        const prefs = this.getPreferences();
        const toggleBudget = document.getElementById('pageToggleNotifBudget') || document.getElementById('toggleNotifBudget');
        const toggleDebt = document.getElementById('pageToggleNotifDebt') || document.getElementById('toggleNotifDebt');
        const toggleGoal = document.getElementById('pageToggleNotifGoal') || document.getElementById('toggleNotifGoal');
        const toggleInvite = document.getElementById('pageToggleNotifInvite') || document.getElementById('toggleNotifInvite');
        const toggleDaily = document.getElementById('pageToggleNotifDaily') || document.getElementById('toggleNotifDaily');

        if (toggleBudget) toggleBudget.checked = prefs.budgetAlerts !== false;
        if (toggleDebt) toggleDebt.checked = prefs.debtAlerts !== false;
        if (toggleGoal) toggleGoal.checked = prefs.goalAlerts !== false;
        if (toggleInvite) toggleInvite.checked = prefs.inviteAlerts !== false;
        if (toggleDaily) toggleDaily.checked = prefs.dailyReminder !== false;

        this.updatePushStatusBadge();

        const updateStatusText = (perm) => {
            const statusText = document.getElementById('settingsNotifStatusText');
            if (!statusText) return;
            if (perm === 'granted') {
                statusText.innerText = this._t('notif_status_active_inapp', 'Aktif (Sistem & In-App)');
            } else if (perm === 'denied') {
                statusText.innerText = this._t('notif_status_inapp_only', 'Hanya In-App (Browser diblokir)');
            } else {
                statusText.innerText = this._t('notif_status_inapp_active', 'In-App aktif');
            }
        };

        if (window.PocketlyNativeNotification && window.PocketlyNativeNotification.isAvailable()) {
            window.PocketlyNativeNotification.checkPermission().then(status => {
                if (status) {
                    window.__nativeNotifPerm = (status === 'granted') ? 'granted' : (status === 'denied' ? 'denied' : 'default');
                    this.updatePushStatusBadge();
                    updateStatusText(window.__nativeNotifPerm);
                }
            }).catch(() => {});
        }

        const perm = window.__nativeNotifPerm || (('Notification' in window) ? Notification.permission : 'default');
        updateStatusText(perm);
    }
};

// Global navigation and drawer triggers
window.navigateToNotifications = () => {
    if (window.PocketlyAudio && typeof window.PocketlyAudio.play === 'function') {
        window.PocketlyAudio.play('click');
    }
    window.switchPage('notifications');
};

window.navigateBackFromNotifications = () => {
    if (window.PocketlyAudio && typeof window.PocketlyAudio.play === 'function') {
        window.PocketlyAudio.play('click');
    }
    const fallback = (window.lastVisitedPage && window.lastVisitedPage !== 'notifications')
        ? window.lastVisitedPage
        : 'dashboard';
    window.switchPage(fallback);
};

window.toggleNotificationPreferencesDrawer = () => {
    const drawer = document.getElementById('notifPreferencesDrawer');
    if (!drawer) return;
    const isHidden = drawer.style.display === 'none' || getComputedStyle(drawer).display === 'none';
    drawer.style.display = isHidden ? 'block' : 'none';
    if (window.PocketlyAudio && typeof window.PocketlyAudio.play === 'function') {
        window.PocketlyAudio.play('click');
    }
    if (isHidden && window.PocketlyNotification && typeof window.PocketlyNotification.syncSettingsUI === 'function') {
        window.PocketlyNotification.syncSettingsUI();
    }
};

window.openNotificationCenterModal = () => window.navigateToNotifications();
window.closeNotificationCenterModal = () => window.navigateBackFromNotifications();
window.openNotificationSettingsModal = () => window.PocketlyNotification.openSettings();
window.closeNotificationSettingsModal = () => window.PocketlyNotification.closeSettings();
window.markAllNotificationsRead = () => window.PocketlyNotification.markAllRead();
window.markNotificationRead = (id) => window.PocketlyNotification.markRead(id);
window.setNotificationFilter = (filter) => window.PocketlyNotification.setFilter(filter);
window.saveNotificationPref = (key, val) => window.PocketlyNotification.savePreference(key, val);
window.requestSystemNotificationPermission = () => window.PocketlyNotification.requestSystemPermission();
window.sendTestNotification = () => window.PocketlyNotification.sendTestNotification();

// Initial boot check
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            window.PocketlyNotification.updateCenter();
            window.PocketlyNotification.syncSettingsUI();
        }, 300);
    });
} else {
    setTimeout(() => {
        window.PocketlyNotification.updateCenter();
        window.PocketlyNotification.syncSettingsUI();
    }, 300);
}



