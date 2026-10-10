/**
 * POCKETLY INTERNATIONALIZATION (i18n) ENGINE
 * Comprehensive Multi-Language System with Flag Icons & Instant Live DOM Translation
 * Supports 12 languages across Dashboard, Transactions, Debts, Budgets, Analytics, and Settings
 */
(function() {
    'use strict';

    const LANG_STORAGE_KEY = 'pocketly_lang';

    // 12 Supported Languages with Country Flags from flagcdn
    const LANGUAGES = [
        { code: 'en', name: 'English (US)', native: 'English', flag: 'us', locale: 'en-US' },
        { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia', flag: 'id', locale: 'id-ID' },
        { code: 'es', name: 'Spanish', native: 'Español', flag: 'es', locale: 'es-ES' },
        { code: 'fr', name: 'French', native: 'Français', flag: 'fr', locale: 'fr-FR' },
        { code: 'de', name: 'German', native: 'Deutsch', flag: 'de', locale: 'de-DE' },
        { code: 'ja', name: 'Japanese', native: '日本語', flag: 'jp', locale: 'ja-JP' },
        { code: 'ko', name: 'Korean', native: '한국어', flag: 'kr', locale: 'ko-KR' },
        { code: 'zh', name: 'Chinese (Simplified)', native: '简体中文', flag: 'cn', locale: 'zh-CN' },
        { code: 'ar', name: 'Arabic', native: 'العربية', flag: 'sa', locale: 'ar-SA' },
        { code: 'pt', name: 'Portuguese (Brazil)', native: 'Português', flag: 'br', locale: 'pt-BR' },
        { code: 'ru', name: 'Russian', native: 'Русский', flag: 'ru', locale: 'ru-RU' },
        { code: 'nl', name: 'Dutch', native: 'Nederlands', flag: 'nl', locale: 'nl-NL' }
    ];

    // Translation Dictionaries
    const TRANSLATIONS = {
        en: {
            nav_dashboard: "Dashboard",
            nav_transactions: "Transactions",
            nav_debts: "Debts & Loans",
            nav_budget: "Budgets & Goals",
            nav_reports: "Analytics",
            nav_connections: "Connections",
            nav_settings: "Settings",
            nav_sign_out: "Sign Out",
            user_popup_title: "My Account",

            page_dashboard: "Dashboard",
            page_transactions: "Transaction History",
            page_debts: "Debts & Loans",
            page_budget: "Budget Plan",
            page_reports: "Analytics",
            page_connections: "Connections",
            page_account: "User Settings",
            page_currency: "Currency",
            page_categories: "Categories",
            page_theme: "Theme Accent",

            net_worth: "Net Worth",
            monthly_income: "Monthly Income",
            monthly_spending: "Monthly Spending",
            accounts_wallets: "Accounts & Wallets",
            add_account: "Add Account",
            recent_activity: "Recent Transactions",
            view_all: "View All",
            debts_loans: "Debts & Loans",
            lent_receivable: "Lent (Receivable)",
            borrowed_payable: "Borrowed (Payable)",
            no_transactions: "No transactions found",
            vs_last_month: "vs Last Month",

            trans_list_tab: "Transaction List",
            trans_calendar_tab: "Financial Calendar",
            search_transactions_ph: "Search transactions...",
            btn_export_pdf: "Export PDF Statement",
            btn_filter_sort: "Filter & Sort",
            btn_new_transaction: "New Transaction",
            financial_calendar: "Financial Calendar",
            btn_today: "Today",
            select_date_msg: "Select a date to view daily details.",
            weekday_sun: "Sun", weekday_mon: "Mon", weekday_tue: "Tue", weekday_wed: "Wed", weekday_thu: "Thu", weekday_fri: "Fri", weekday_sat: "Sat",

            debt_subtitle: "Receivables & Payables",
            total_lent: "Total Lent",
            total_borrowed: "Total Borrowed",
            net_position: "Net Position",
            due_soon: "Due Soon",
            search_records_ph: "Search records...",
            all_types: "All Types",
            lent: "Lent",
            borrowed: "Borrowed",
            status_active: "Active",
            status_settled: "Settled",

            savings_goals_title: "Savings Goals",
            category_budgets_title: "Category Budgets",
            btn_new_goal: "New Goal",
            btn_set_budget: "Set Budget Limit",

            total_income: "Total Income",
            total_expenses: "Total Expenses",
            net_savings: "Net Savings",
            savings_rate: "Savings Rate",
            of_total_income: "of total income",
            cash_flow_trends: "Cash Flow Trends",
            spending_breakdown: "Spending Breakdown",
            top_5_expenses: "Top 5 Expenses",
            top_category: "Top Category",

            con_subtitle: "Friends & Requests",
            tab_friends: "Friends",
            tab_requests: "Requests",
            search_friends_ph: "Search friends...",

            settings_title: "Settings",
            settings_subtitle: "Preferences & Account",
            settings_preferences: "Preferences",
            settings_language: "Language",
            settings_categories: "Categories",
            settings_currency: "Currency",
            settings_theme_color: "Theme Color",
            settings_dark_mode: "Dark Mode",
            settings_sound_haptics: "Sound & Haptics",
            settings_security: "Security & Privacy",
            settings_app_lock: "App Lock (4-Digit PIN)",
            settings_change_pin: "Change PIN Passcode",
            settings_biometrics: "Biometric Unlock (Face ID / Fingerprint)",
            settings_change_pass: "Change Password",
            settings_backup_group: "Data & Backup",
            settings_backup_json: "Backup Data (JSON)",
            settings_restore_json: "Restore Backup",
            settings_danger_group: "Account",
            settings_sign_out: "Sign Out",
            settings_reset_data: "Reset All Data",

            currency_subtitle: "Live Exchange Rates",
            currency_sync_text: "Live rates connected",
            currency_sync_btn: "Sync",
            mid_market_rate: "Mid-Market Rate",
            conv_from: "From",
            conv_converted: "Converted",
            theme_subtitle: "System-Wide Color Palette",
            theme_preview_title: "Live UI Preview",
            theme_preview_desc: "Simulate dynamic theme colors applied across buttons, icons, docks, and cards",
            theme_curated: "Curated Palettes",
            cat_subtitle: "Category Studio & Catalog",
            cat_new_title: "New Category",
            cat_name_ph: "Category name...",
            btn_add_category: "Add Category",
            cat_saved_title: "Saved Categories",

            lang_modal_title: "Select Language",
            lang_modal_subtitle: "Choose your preferred display language",
            lang_search_placeholder: "Search language or country...",
            lang_popular: "Popular:",
            lang_changed_toast: "Language changed to",

            btn_cancel: "Cancel",
            btn_save: "Save",
            btn_proceed: "Proceed",
            btn_delete: "Delete",
            btn_add: "Add",
            btn_edit: "Edit",
            btn_close: "Close",

            filter_all_months: "All Months",
            filter_this_month: "This Month",
            filter_last_month: "Last Month",
            filter_last_3_months: "Last 3 Months",
            filter_this_year: "This Year",
            filter_all_accounts: "All Accounts",
            month_01: "Jan", month_02: "Feb", month_03: "Mar", month_04: "Apr", month_05: "May", month_06: "Jun",
            month_07: "Jul", month_08: "Aug", month_09: "Sep", month_10: "Oct", month_11: "Nov", month_12: "Dec"
        },
        id: {
            nav_dashboard: "Dasbor",
            nav_transactions: "Transaksi",
            nav_debts: "Hutang & Piutang",
            nav_budget: "Anggaran & Target",
            nav_reports: "Analisis",
            nav_connections: "Koneksi",
            nav_settings: "Pengaturan",
            nav_sign_out: "Keluar",
            user_popup_title: "Akun Saya",

            page_dashboard: "Dasbor",
            page_transactions: "Riwayat Transaksi",
            page_debts: "Hutang & Piutang",
            page_budget: "Rencana Anggaran",
            page_reports: "Analisis",
            page_connections: "Koneksi",
            page_account: "Pengaturan Pengguna",
            page_currency: "Mata Uang",
            page_categories: "Kategori",
            page_theme: "Warna Tema",

            net_worth: "Total Kekayaan",
            monthly_income: "Pemasukan Bulan Ini",
            monthly_spending: "Pengeluaran Bulan Ini",
            accounts_wallets: "Rekening & Dompet",
            add_account: "Tambah Rekening",
            recent_activity: "Aktivitas Terakhir",
            view_all: "Lihat Semua",
            debts_loans: "Hutang & Piutang",
            lent_receivable: "Dipinjamkan (Piutang)",
            borrowed_payable: "Dipinjam (Hutang)",
            no_transactions: "Belum ada transaksi",
            vs_last_month: "dibanding bulan lalu",

            trans_list_tab: "Daftar Transaksi",
            trans_calendar_tab: "Kalender Keuangan",
            search_transactions_ph: "Cari transaksi...",
            btn_export_pdf: "Ekspor Laporan PDF",
            btn_filter_sort: "Filter & Urutkan",
            btn_new_transaction: "Transaksi Baru",
            financial_calendar: "Kalender Keuangan",
            btn_today: "Hari Ini",
            select_date_msg: "Pilih tanggal untuk melihat rincian harian.",
            weekday_sun: "Min", weekday_mon: "Sen", weekday_tue: "Sel", weekday_wed: "Rab", weekday_thu: "Kam", weekday_fri: "Jum", weekday_sat: "Sab",

            debt_subtitle: "Piutang & Hutang",
            total_lent: "Total Dipinjamkan",
            total_borrowed: "Total Dipinjam",
            net_position: "Posisi Bersih",
            due_soon: "Segera Jatuh Tempo",
            search_records_ph: "Cari data catatan...",
            all_types: "Semua Tipe",
            lent: "Dipinjamkan",
            borrowed: "Dipinjam",
            status_active: "Aktif",
            status_settled: "Lunas",

            savings_goals_title: "Target Menabung",
            category_budgets_title: "Anggaran Kategori",
            btn_new_goal: "Target Baru",
            btn_set_budget: "Atur Batas Anggaran",

            total_income: "Total Pemasukan",
            total_expenses: "Total Pengeluaran",
            net_savings: "Tabungan Bersih",
            savings_rate: "Rasio Tabungan",
            of_total_income: "dari total pemasukan",
            cash_flow_trends: "Tren Arus Kas",
            spending_breakdown: "Rincian Pengeluaran",
            top_5_expenses: "5 Pengeluaran Terbesar",
            top_category: "Kategori Utama",

            con_subtitle: "Teman & Permintaan",
            tab_friends: "Teman",
            tab_requests: "Permintaan",
            search_friends_ph: "Cari teman...",

            settings_title: "Pengaturan",
            settings_subtitle: "Preferensi & Akun",
            settings_preferences: "Preferensi",
            settings_language: "Bahasa",
            settings_categories: "Kategori",
            settings_currency: "Mata Uang",
            settings_theme_color: "Warna Tema",
            settings_dark_mode: "Mode Gelap",
            settings_sound_haptics: "Suara & Getar (Haptics)",
            settings_security: "Keamanan & Privasi",
            settings_app_lock: "Kunci Aplikasi (PIN 4-Digit)",
            settings_change_pin: "Ganti PIN Keamanan",
            settings_biometrics: "Buka Biometrik (Face ID / Sidik Jari)",
            settings_change_pass: "Ganti Kata Sandi",
            settings_backup_group: "Data & Cadangan",
            settings_backup_json: "Cadangkan Data (JSON)",
            settings_restore_json: "Pulihkan Cadangan",
            settings_danger_group: "Akun",
            settings_sign_out: "Keluar",
            settings_reset_data: "Reset Semua Data",

            currency_subtitle: "Kurs Mata Uang Real-time",
            currency_sync_text: "Kurs live terhubung",
            currency_sync_btn: "Sinkron",
            mid_market_rate: "Kurs Pasar Tengah",
            conv_from: "Dari",
            conv_converted: "Dikonversi",
            theme_subtitle: "Palet Warna Sistem",
            theme_preview_title: "Pratinjau UI Langsung",
            theme_preview_desc: "Simulasikan warna tema dinamis pada tombol, ikon, dock, dan kartu",
            theme_curated: "Palet Pilihan",
            cat_subtitle: "Studio & Katalog Kategori",
            cat_new_title: "Kategori Baru",
            cat_name_ph: "Nama kategori...",
            btn_add_category: "Tambah Kategori",
            cat_saved_title: "Kategori Tersimpan",

            lang_modal_title: "Pilih Bahasa",
            lang_modal_subtitle: "Pilih bahasa tampilan aplikasi Anda",
            lang_search_placeholder: "Cari bahasa atau negara...",
            lang_popular: "Populer:",
            lang_changed_toast: "Bahasa diubah ke",

            btn_cancel: "Batal",
            btn_save: "Simpan",
            btn_proceed: "Lanjutkan",
            btn_delete: "Hapus",
            btn_add: "Tambah",
            btn_edit: "Ubah",
            btn_close: "Tutup",

            filter_all_months: "Semua Bulan",
            filter_this_month: "Bulan Ini",
            filter_last_month: "Bulan Lalu",
            filter_last_3_months: "3 Bulan Terakhir",
            filter_this_year: "Tahun Ini",
            filter_all_accounts: "Semua Rekening",
            month_01: "Jan", month_02: "Feb", month_03: "Mar", month_04: "Apr", month_05: "Mei", month_06: "Jun",
            month_07: "Jul", month_08: "Agu", month_09: "Sep", month_10: "Okt", month_11: "Nov", month_12: "Des"
        },
        es: {
            nav_dashboard: "Panel",
            nav_transactions: "Transacciones",
            nav_debts: "Deudas y Préstamos",
            nav_budget: "Presupuestos y Metas",
            nav_reports: "Estadísticas",
            nav_connections: "Contactos",
            nav_settings: "Ajustes",
            nav_sign_out: "Cerrar Sesión",
            user_popup_title: "Mi Cuenta",

            page_dashboard: "Panel",
            page_transactions: "Historial de Transacciones",
            page_debts: "Deudas y Préstamos",
            page_budget: "Plan de Presupuesto",
            page_reports: "Estadísticas",
            page_connections: "Contactos",
            page_account: "Ajustes de Usuario",
            page_currency: "Moneda",
            page_categories: "Categorías",
            page_theme: "Color del Tema",

            net_worth: "Patrimonio Neto",
            monthly_income: "Ingresos del Mes",
            monthly_spending: "Gastos del Mes",
            accounts_wallets: "Cuentas y Billeteras",
            add_account: "Añadir Cuenta",
            recent_activity: "Transacciones Recientes",
            view_all: "Ver Todo",
            debts_loans: "Deudas y Préstamos",
            lent_receivable: "Prestado (Por Cobrar)",
            borrowed_payable: "Debido (Por Pagar)",
            no_transactions: "Sin transacciones",
            vs_last_month: "vs mes anterior",

            trans_list_tab: "Lista de Transacciones",
            trans_calendar_tab: "Calendario Financiero",
            search_transactions_ph: "Buscar transacciones...",
            btn_export_pdf: "Exportar Informe PDF",
            btn_filter_sort: "Filtrar y Ordenar",
            btn_new_transaction: "Nueva Transacción",
            financial_calendar: "Calendario Financiero",
            btn_today: "Hoy",
            select_date_msg: "Seleccione una fecha para ver detalles diarios.",
            weekday_sun: "Dom", weekday_mon: "Lun", weekday_tue: "Mar", weekday_wed: "Mié", weekday_thu: "Jue", weekday_fri: "Vie", weekday_sat: "Sáb",

            debt_subtitle: "Cobros y Pagos",
            total_lent: "Total Prestado",
            total_borrowed: "Total Deuda",
            net_position: "Posición Neta",
            due_soon: "Por Vencer",
            search_records_ph: "Buscar registros...",
            all_types: "Todos los Tipos",
            lent: "Prestado",
            borrowed: "Deuda",
            status_active: "Activo",
            status_settled: "Liquidado",

            savings_goals_title: "Metas de Ahorro",
            category_budgets_title: "Presupuestos de Categoría",
            btn_new_goal: "Nueva Meta",
            btn_set_budget: "Fijar Presupuesto",

            total_income: "Ingresos Totales",
            total_expenses: "Gastos Totales",
            net_savings: "Ahorro Neto",
            savings_rate: "Tasa de Ahorro",
            of_total_income: "de los ingresos totales",
            cash_flow_trends: "Tendencias de Flujo",
            spending_breakdown: "Desglose de Gastos",
            top_5_expenses: "Top 5 Gastos",
            top_category: "Categoría Principal",

            con_subtitle: "Amigos y Solicitudes",
            tab_friends: "Amigos",
            tab_requests: "Solicitudes",
            search_friends_ph: "Buscar amigos...",

            settings_title: "Ajustes",
            settings_subtitle: "Preferencias y Cuenta",
            settings_preferences: "Preferencias",
            settings_language: "Idioma",
            settings_categories: "Categorías",
            settings_currency: "Moneda",
            settings_theme_color: "Color del Tema",
            settings_dark_mode: "Modo Oscuro",
            settings_sound_haptics: "Sonido y Vibración",
            settings_security: "Seguridad y Privacidad",
            settings_app_lock: "Bloqueo de App (PIN 4 Dígitos)",
            settings_change_pin: "Cambiar Código PIN",
            settings_biometrics: "Desbloqueo Biométrico",
            settings_change_pass: "Cambiar Contraseña",
            settings_backup_group: "Datos y Copia",
            settings_backup_json: "Copia de Seguridad (JSON)",
            settings_restore_json: "Restaurar Copia",
            settings_danger_group: "Cuenta",
            settings_sign_out: "Cerrar Sesión",
            settings_reset_data: "Restablecer Datos",

            currency_subtitle: "Tipos de Cambio en Vivo",
            currency_sync_text: "Tasas en vivo conectadas",
            currency_sync_btn: "Sincronizar",
            mid_market_rate: "Tasa del Mercado Medio",
            conv_from: "De",
            conv_converted: "Convertido",
            theme_subtitle: "Paleta de Colores del Sistema",
            theme_preview_title: "Vista Previa en Vivo",
            theme_preview_desc: "Simule colores dinámicos en botones, iconos y tarjetas",
            theme_curated: "Paletas Seleccionadas",
            cat_subtitle: "Estudio y Catálogo de Categorías",
            cat_new_title: "Nueva Categoría",
            cat_name_ph: "Nombre de categoría...",
            btn_add_category: "Añadir Categoría",
            cat_saved_title: "Categorías Guardadas",

            lang_modal_title: "Seleccionar Idioma",
            lang_modal_subtitle: "Elija su idioma de visualización preferido",
            lang_search_placeholder: "Buscar idioma o país...",
            lang_popular: "Popular:",
            lang_changed_toast: "Idioma cambiado a",

            btn_cancel: "Cancelar",
            btn_save: "Guardar",
            btn_proceed: "Continuar",
            btn_delete: "Eliminar",
            btn_add: "Añadir",
            btn_edit: "Editar",
            btn_close: "Cerrar",

            filter_all_months: "Todos los Meses",
            filter_this_month: "Este Mes",
            filter_last_month: "Mes Anterior",
            filter_last_3_months: "Últimos 3 Meses",
            filter_this_year: "Este Año",
            filter_all_accounts: "Todas las Cuentas",
            month_01: "Ene", month_02: "Feb", month_03: "Mar", month_04: "Abr", month_05: "May", month_06: "Jun",
            month_07: "Jul", month_08: "Ago", month_09: "Sep", month_10: "Oct", month_11: "Nov", month_12: "Dic"
        },
        fr: {
            nav_dashboard: "Tableau de Bord",
            nav_transactions: "Transactions",
            nav_debts: "Dettes et Prêts",
            nav_budget: "Budgets et Objectifs",
            nav_reports: "Analyses",
            nav_connections: "Connexions",
            nav_settings: "Paramètres",
            nav_sign_out: "Déconnexion",
            user_popup_title: "Mon Compte",

            page_dashboard: "Tableau de Bord",
            page_transactions: "Historique des Transactions",
            page_debts: "Dettes et Prêts",
            page_budget: "Plan Budgétaire",
            page_reports: "Analyses",
            page_connections: "Connexions",
            page_account: "Paramètres Utilisateur",
            page_currency: "Devise",
            page_categories: "Catégories",
            page_theme: "Couleur du Thème",

            net_worth: "Valeur Nette",
            monthly_income: "Revenus du Mois",
            monthly_spending: "Dépenses du Mois",
            accounts_wallets: "Comptes et Portefeuilles",
            add_account: "Ajouter un Compte",
            recent_activity: "Transactions Récentes",
            view_all: "Voir Tout",
            debts_loans: "Dettes et Prêts",
            lent_receivable: "Prêté (À Recevoir)",
            borrowed_payable: "Emprunté (À Payer)",
            no_transactions: "Aucune transaction",
            vs_last_month: "vs mois dernier",

            trans_list_tab: "Liste des Transactions",
            trans_calendar_tab: "Calendrier Financier",
            search_transactions_ph: "Rechercher des transactions...",
            btn_export_pdf: "Exporter Relevé PDF",
            btn_filter_sort: "Filtrer et Trier",
            btn_new_transaction: "Nouvelle Transaction",
            financial_calendar: "Calendrier Financier",
            btn_today: "Aujourd'hui",
            select_date_msg: "Sélectionnez une date pour voir les détails.",
            weekday_sun: "Dim", weekday_mon: "Lun", weekday_tue: "Mar", weekday_wed: "Mer", weekday_thu: "Jeu", weekday_fri: "Ven", weekday_sat: "Sam",

            debt_subtitle: "Créances et Dettes",
            total_lent: "Total Prêté",
            total_borrowed: "Total Emprunté",
            net_position: "Position Nette",
            due_soon: "Échéance Proche",
            search_records_ph: "Rechercher des enregistrements...",
            all_types: "Tous les Types",
            lent: "Prêté",
            borrowed: "Emprunté",
            status_active: "Actif",
            status_settled: "Réglé",

            savings_goals_title: "Objectifs d'Épargne",
            category_budgets_title: "Budgets par Catégorie",
            btn_new_goal: "Nouvel Objectif",
            btn_set_budget: "Fixer un Budget",

            total_income: "Revenu Total",
            total_expenses: "Dépenses Totales",
            net_savings: "Épargne Nette",
            savings_rate: "Taux d'Épargne",
            of_total_income: "du revenu total",
            cash_flow_trends: "Flux de Trésorerie",
            spending_breakdown: "Répartition des Dépenses",
            top_5_expenses: "Top 5 des Dépenses",
            top_category: "Catégorie Principale",

            con_subtitle: "Amis et Demandes",
            tab_friends: "Amis",
            tab_requests: "Demandes",
            search_friends_ph: "Rechercher des amis...",

            settings_title: "Paramètres",
            settings_subtitle: "Préférences et Compte",
            settings_preferences: "Préférences",
            settings_language: "Langue",
            settings_categories: "Catégories",
            settings_currency: "Devise",
            settings_theme_color: "Couleur du Thème",
            settings_dark_mode: "Mode Sombre",
            settings_sound_haptics: "Sons et Vibrations",
            settings_security: "Sécurité et Confidentialité",
            settings_app_lock: "Verrouillage par Code PIN",
            settings_change_pin: "Modifier le Code PIN",
            settings_biometrics: "Déverrouillage Biométrique",
            settings_change_pass: "Changer le Mot de Passe",
            settings_backup_group: "Données et Sauvegarde",
            settings_backup_json: "Sauvegarde des Données (JSON)",
            settings_restore_json: "Restaurer Sauvegarde",
            settings_danger_group: "Compte",
            settings_sign_out: "Déconnexion",
            settings_reset_data: "Réinitialiser les Données",

            currency_subtitle: "Taux de Change en Direct",
            currency_sync_text: "Taux en direct connectés",
            currency_sync_btn: "Synchroniser",
            mid_market_rate: "Taux Moyen du Marché",
            conv_from: "De",
            conv_converted: "Converti",
            theme_subtitle: "Palette de Couleurs Système",
            theme_preview_title: "Aperçu de l'Interface",
            theme_preview_desc: "Simulez les couleurs dynamiques appliquées aux boutons, icônes et cartes",
            theme_curated: "Palettes Recommandées",
            cat_subtitle: "Studio et Catalogue de Catégories",
            cat_new_title: "Nouvelle Catégorie",
            cat_name_ph: "Nom de la catégorie...",
            btn_add_category: "Ajouter une Catégorie",
            cat_saved_title: "Catégories Enregistrées",

            lang_modal_title: "Choisir la Langue",
            lang_modal_subtitle: "Sélectionnez votre langue d'affichage",
            lang_search_placeholder: "Rechercher une langue ou un pays...",
            lang_popular: "Populaire:",
            lang_changed_toast: "Langue changée en",

            btn_cancel: "Annuler",
            btn_save: "Enregistrer",
            btn_proceed: "Continuer",
            btn_delete: "Supprimer",
            btn_add: "Ajouter",
            btn_edit: "Modifier",
            btn_close: "Fermer",

            filter_all_months: "Tous les Mois",
            filter_this_month: "Ce Mois-ci",
            filter_last_month: "Mois Dernier",
            filter_last_3_months: "3 Derniers Mois",
            filter_this_year: "Cette Année",
            filter_all_accounts: "Tous les Comptes",
            month_01: "Jan", month_02: "Fév", month_03: "Mar", month_04: "Avr", month_05: "Mai", month_06: "Juin",
            month_07: "Juil", month_08: "Août", month_09: "Sep", month_10: "Oct", month_11: "Nov", month_12: "Déc"
        },
        de: {
            nav_dashboard: "Übersicht",
            nav_transactions: "Transaktionen",
            nav_debts: "Schulden & Kredite",
            nav_budget: "Budgets & Ziele",
            nav_reports: "Statistiken",
            nav_connections: "Kontakte",
            nav_settings: "Einstellungen",
            nav_sign_out: "Abmelden",
            user_popup_title: "Mein Konto",

            page_dashboard: "Übersicht",
            page_transactions: "Transaktionsverlauf",
            page_debts: "Schulden & Kredite",
            page_budget: "Budgetplanung",
            page_reports: "Statistiken",
            page_connections: "Kontakte",
            page_account: "Benutzereinstellungen",
            page_currency: "Währung",
            page_categories: "Kategorien",
            page_theme: "Design-Akzent",

            net_worth: "Gesamtvermögen",
            monthly_income: "Monatseinnahmen",
            monthly_spending: "Monatsausgaben",
            accounts_wallets: "Konten & Wallets",
            add_account: "Konto hinzufügen",
            recent_activity: "Letzte Transaktionen",
            view_all: "Alle anzeigen",
            debts_loans: "Schulden & Kredite",
            lent_receivable: "Verliehen (Forderung)",
            borrowed_payable: "Geliehen (Verbindlichkeit)",
            no_transactions: "Keine Transaktionen",
            vs_last_month: "ggü. Vormonat",

            trans_list_tab: "Transaktionsliste",
            trans_calendar_tab: "Finanzkalender",
            search_transactions_ph: "Transaktionen suchen...",
            btn_export_pdf: "PDF-Auszug exportieren",
            btn_filter_sort: "Filtern & Sortieren",
            btn_new_transaction: "Neue Transaktion",
            financial_calendar: "Finanzkalender",
            btn_today: "Heute",
            select_date_msg: "Datum auswählen, um Details anzuzeigen.",
            weekday_sun: "So", weekday_mon: "Mo", weekday_tue: "Di", weekday_wed: "Mi", weekday_thu: "Do", weekday_fri: "Fr", weekday_sat: "Sa",

            debt_subtitle: "Forderungen & Verbindlichkeiten",
            total_lent: "Gesamt Verliehen",
            total_borrowed: "Gesamt Geliehen",
            net_position: "Nettoposition",
            due_soon: "Bald fällig",
            search_records_ph: "Einträge suchen...",
            all_types: "Alle Typen",
            lent: "Verliehen",
            borrowed: "Geliehen",
            status_active: "Aktiv",
            status_settled: "Beglichen",

            savings_goals_title: "Sparziele",
            category_budgets_title: "Kategorie-Budgets",
            btn_new_goal: "Neues Ziel",
            btn_set_budget: "Budget festlegen",

            total_income: "Gesamteinnahmen",
            total_expenses: "Gesamtausgaben",
            net_savings: "Netto-Ersparnis",
            savings_rate: "Sparquote",
            of_total_income: "des Gesamteinkommens",
            cash_flow_trends: "Cashflow-Trends",
            spending_breakdown: "Ausgabenverteilung",
            top_5_expenses: "Top 5 Ausgaben",
            top_category: "Hauptkategorie",

            con_subtitle: "Freunde & Anfragen",
            tab_friends: "Freunde",
            tab_requests: "Anfragen",
            search_friends_ph: "Freunde suchen...",

            settings_title: "Einstellungen",
            settings_subtitle: "Präferenzen & Konto",
            settings_preferences: "Präferenzen",
            settings_language: "Sprache",
            settings_categories: "Kategorien",
            settings_currency: "Währung",
            settings_theme_color: "Akzentfarbe",
            settings_dark_mode: "Dunkelmodus",
            settings_sound_haptics: "Töne & Haptik",
            settings_security: "Sicherheit & Datenschutz",
            settings_app_lock: "App-Sperre (4-stellige PIN)",
            settings_change_pin: "PIN-Code ändern",
            settings_biometrics: "Biometrische Entsperrung",
            settings_change_pass: "Passwort ändern",
            settings_backup_group: "Daten & Sicherung",
            settings_backup_json: "Daten sichern (JSON)",
            settings_restore_json: "Sicherung wiederherstellen",
            settings_danger_group: "Konto",
            settings_sign_out: "Abmelden",
            settings_reset_data: "Alle Daten zurücksetzen",

            currency_subtitle: "Echtzeit-Wechselkurse",
            currency_sync_text: "Live-Kurse aktiv",
            currency_sync_btn: "Synchronisieren",
            mid_market_rate: "Mittelkurs",
            conv_from: "Von",
            conv_converted: "Umgerechnet",
            theme_subtitle: "Systemweite Farbpalette",
            theme_preview_title: "Live-Vorschau",
            theme_preview_desc: "Dynamische Farbakzente für Schaltflächen, Docks und Karten testen",
            theme_curated: "Kuratierte Paletten",
            cat_subtitle: "Kategoriestudio & Katalog",
            cat_new_title: "Neue Kategorie",
            cat_name_ph: "Kategoriename...",
            btn_add_category: "Kategorie hinzufügen",
            cat_saved_title: "Gespeicherte Kategorien",

            lang_modal_title: "Sprache auswählen",
            lang_modal_subtitle: "Wählen Sie Ihre bevorzugte Anzeigesprache",
            lang_search_placeholder: "Sprache oder Land suchen...",
            lang_popular: "Beliebt:",
            lang_changed_toast: "Sprache geändert zu",

            btn_cancel: "Abbrechen",
            btn_save: "Speichern",
            btn_proceed: "Weiter",
            btn_delete: "Löschen",
            btn_add: "Hinzufügen",
            btn_edit: "Bearbeiten",
            btn_close: "Schließen",

            filter_all_months: "Alle Monate",
            filter_this_month: "Diesen Monat",
            filter_last_month: "Letzten Monat",
            filter_last_3_months: "Letzte 3 Monate",
            filter_this_year: "Dieses Jahr",
            filter_all_accounts: "Alle Konten",
            month_01: "Jan", month_02: "Feb", month_03: "Mär", month_04: "Apr", month_05: "Mai", month_06: "Jun",
            month_07: "Jul", month_08: "Aug", month_09: "Sep", month_10: "Okt", month_11: "Nov", month_12: "Dez"
        },
        ja: {
            nav_dashboard: "ダッシュボード",
            nav_transactions: "取引一覧",
            nav_debts: "負債と融資",
            nav_budget: "予算と目標",
            nav_reports: "分析",
            nav_connections: "つながり",
            nav_settings: "設定",
            nav_sign_out: "ログアウト",
            user_popup_title: "マイアカウント",

            page_dashboard: "ダッシュボード",
            page_transactions: "取引履歴",
            page_debts: "負債と融資",
            page_budget: "予算プラン",
            page_reports: "分析",
            page_connections: "つながり",
            page_account: "ユーザー設定",
            page_currency: "通貨",
            page_categories: "カテゴリー",
            page_theme: "テーマカラー",

            net_worth: "総資産",
            monthly_income: "今月の収入",
            monthly_spending: "今月の支出",
            accounts_wallets: "口座・ウォレット",
            add_account: "口座を追加",
            recent_activity: "最近の取引",
            view_all: "すべて見る",
            debts_loans: "負債と融資",
            lent_receivable: "貸付 (未収)",
            borrowed_payable: "借入 (未払)",
            no_transactions: "取引がありません",
            vs_last_month: "前月比",

            trans_list_tab: "取引一覧",
            trans_calendar_tab: "財務カレンダー",
            search_transactions_ph: "取引を検索...",
            btn_export_pdf: "PDFレポートを出力",
            btn_filter_sort: "フィルターと並べ替え",
            btn_new_transaction: "新規取引",
            financial_calendar: "財務カレンダー",
            btn_today: "今日",
            select_date_msg: "日付を選択して詳細を表示します。",
            weekday_sun: "日", weekday_mon: "月", weekday_tue: "火", weekday_wed: "水", weekday_thu: "木", weekday_fri: "金", weekday_sat: "土",

            debt_subtitle: "未収金と未払金",
            total_lent: "貸付合計",
            total_borrowed: "借入合計",
            net_position: "純残高",
            due_soon: "期日近し",
            search_records_ph: "履歴を検索...",
            all_types: "すべての種類",
            lent: "貸付",
            borrowed: "借入",
            status_active: "進行中",
            status_settled: "清算済",

            savings_goals_title: "貯蓄目標",
            category_budgets_title: "カテゴリ予算",
            btn_new_goal: "新しい目標",
            btn_set_budget: "予算を設定",

            total_income: "総収入",
            total_expenses: "総支出",
            net_savings: "純貯蓄",
            savings_rate: "貯蓄率",
            of_total_income: "総収入に対して",
            cash_flow_trends: "キャッシュフロートレンド",
            spending_breakdown: "支出の内訳",
            top_5_expenses: "支出上位5件",
            top_category: "主なカテゴリ",

            con_subtitle: "フレンドとリクエスト",
            tab_friends: "フレンド",
            tab_requests: "リクエスト",
            search_friends_ph: "フレンドを検索...",

            settings_title: "設定",
            settings_subtitle: "設定とアカウント",
            settings_preferences: "基本設定",
            settings_language: "言語",
            settings_categories: "カテゴリー",
            settings_currency: "通貨",
            settings_theme_color: "テーマカラー",
            settings_dark_mode: "ダークモード",
            settings_sound_haptics: "効果音と触覚フィードバック",
            settings_security: "セキュリティとプライバシー",
            settings_app_lock: "アプリロック (4桁PIN)",
            settings_change_pin: "PINコードを変更",
            settings_biometrics: "生体認証ログイン",
            settings_change_pass: "パスワードを変更",
            settings_backup_group: "データとバックアップ",
            settings_backup_json: "データをバックアップ (JSON)",
            settings_restore_json: "バックアップを復元",
            settings_danger_group: "アカウント",
            settings_sign_out: "ログアウト",
            settings_reset_data: "すべてのデータを初期化",

            currency_subtitle: "リアルタイム為替レート",
            currency_sync_text: "為替レート接続中",
            currency_sync_btn: "同期",
            mid_market_rate: "中間市場レート",
            conv_from: "換算元",
            conv_converted: "換算先",
            theme_subtitle: "システムカラーパレット",
            theme_preview_title: "リアルタイムUIプレビュー",
            theme_preview_desc: "ボタンやカードに適用されるテーマカラーをシミュレート",
            theme_curated: "厳選パレット",
            cat_subtitle: "カテゴリースタジオ",
            cat_new_title: "新規カテゴリー",
            cat_name_ph: "カテゴリー名...",
            btn_add_category: "カテゴリーを追加",
            cat_saved_title: "保存済みカテゴリー",

            lang_modal_title: "言語を選択",
            lang_modal_subtitle: "アプリの表示言語を選択してください",
            lang_search_placeholder: "言語や国名を検索...",
            lang_popular: "人気:",
            lang_changed_toast: "言語を変更しました:",

            btn_cancel: "キャンセル",
            btn_save: "保存",
            btn_proceed: "進む",
            btn_delete: "削除",
            btn_add: "追加",
            btn_edit: "編集",
            btn_close: "閉じる",

            filter_all_months: "すべての月",
            filter_this_month: "今月",
            filter_last_month: "先月",
            filter_last_3_months: "過去3ヶ月",
            filter_this_year: "今年",
            filter_all_accounts: "すべての口座",
            month_01: "1月", month_02: "2月", month_03: "3月", month_04: "4月", month_05: "5月", month_06: "6月",
            month_07: "7月", month_08: "8月", month_09: "9月", month_10: "10月", month_11: "11月", month_12: "12月"
        },
        ko: {
            nav_dashboard: "대시보드",
            nav_transactions: "거래 내역",
            nav_debts: "부채 및 대출",
            nav_budget: "예산 및 목표",
            nav_reports: "통계 분석",
            nav_connections: "친구 연결",
            nav_settings: "설정",
            nav_sign_out: "로그아웃",
            user_popup_title: "내 계정",

            page_dashboard: "대시보드",
            page_transactions: "거래 내역",
            page_debts: "부채 및 대출",
            page_budget: "예산 계획",
            page_reports: "통계 분석",
            page_connections: "친구 연결",
            page_account: "사용자 설정",
            page_currency: "통화",
            page_categories: "카테고리",
            page_theme: "테마 색상",

            net_worth: "순자산",
            monthly_income: "이번 달 수입",
            monthly_spending: "이번 달 지출",
            accounts_wallets: "계좌 및 지갑",
            add_account: "계좌 추가",
            recent_activity: "최근 거래",
            view_all: "전체 보기",
            debts_loans: "부채 및 대출",
            lent_receivable: "빌려준 돈 (미수금)",
            borrowed_payable: "빌린 돈 (미지급)",
            no_transactions: "거래 내역이 없습니다",
            vs_last_month: "지난달 대비",

            trans_list_tab: "거래 목록",
            trans_calendar_tab: "재정 캘린더",
            search_transactions_ph: "거래 검색...",
            btn_export_pdf: "PDF 보고서 내보내기",
            btn_filter_sort: "필터 및 정렬",
            btn_new_transaction: "새 거래",
            financial_calendar: "재정 캘린더",
            btn_today: "오늘",
            select_date_msg: "날짜를 선택하여 일일 내역을 확인하세요.",
            weekday_sun: "일", weekday_mon: "월", weekday_tue: "화", weekday_wed: "수", weekday_thu: "목", weekday_fri: "금", weekday_sat: "토",

            debt_subtitle: "미수금 및 미지급금",
            total_lent: "빌려준 총액",
            total_borrowed: "빌린 총액",
            net_position: "순잔액",
            due_soon: "기한 임박",
            search_records_ph: "기록 검색...",
            all_types: "모든 유형",
            lent: "빌려줌",
            borrowed: "빌림",
            status_active: "진행 중",
            status_settled: "정산 완료",

            savings_goals_title: "저축 목표",
            category_budgets_title: "카테고리별 예산",
            btn_new_goal: "새 목표",
            btn_set_budget: "예산 한도 설정",

            total_income: "총 수입",
            total_expenses: "총 지출",
            net_savings: "순 저축",
            savings_rate: "저축률",
            of_total_income: "총 수입 대비",
            cash_flow_trends: "현금 흐름 추세",
            spending_breakdown: "지출 구성",
            top_5_expenses: "상위 5대 지출",
            top_category: "주요 카테고리",

            con_subtitle: "친구 및 요청",
            tab_friends: "친구",
            tab_requests: "요청",
            search_friends_ph: "친구 검색...",

            settings_title: "설정",
            settings_subtitle: "환경설정 및 계정",
            settings_preferences: "환경설정",
            settings_language: "언어",
            settings_categories: "카테고리",
            settings_currency: "통화",
            settings_theme_color: "테마 색상",
            settings_dark_mode: "다크 모드",
            settings_sound_haptics: "효과음 및 햅틱",
            settings_security: "보안 및 개인정보",
            settings_app_lock: "앱 잠금 (4자리 PIN)",
            settings_change_pin: "PIN 비밀번호 변경",
            settings_biometrics: "생체 인식 잠금 해제",
            settings_change_pass: "비밀번호 변경",
            settings_backup_group: "데이터 및 백업",
            settings_backup_json: "데이터 백업 (JSON)",
            settings_restore_json: "백업 복원",
            settings_danger_group: "계정",
            settings_sign_out: "로그아웃",
            settings_reset_data: "모든 데이터 초기화",

            currency_subtitle: "실시간 환율",
            currency_sync_text: "실시간 환율 연결됨",
            currency_sync_btn: "동기화",
            mid_market_rate: "중간 시장 환율",
            conv_from: "기준",
            conv_converted: "변환 금액",
            theme_subtitle: "시스템 색상 팔레트",
            theme_preview_title: "실시간 UI 미리보기",
            theme_preview_desc: "버튼, 독 및 카드에 적용되는 동적 테마 색상을 미리 확인하세요",
            theme_curated: "엄선된 팔레트",
            cat_subtitle: "카테고리 스튜디오",
            cat_new_title: "새 카테고리",
            cat_name_ph: "카테고리 이름...",
            btn_add_category: "카테고리 추가",
            cat_saved_title: "저장된 카테고리",

            lang_modal_title: "언어 선택",
            lang_modal_subtitle: "표시할 언어를 선택하세요",
            lang_search_placeholder: "언어 또는 국가 검색...",
            lang_popular: "인기:",
            lang_changed_toast: "언어가 다음으로 변경되었습니다:",

            btn_cancel: "취소",
            btn_save: "저장",
            btn_proceed: "계속",
            btn_delete: "삭제",
            btn_add: "추가",
            btn_edit: "수정",
            btn_close: "닫기",

            filter_all_months: "전체 월",
            filter_this_month: "이번 달",
            filter_last_month: "지난달",
            filter_last_3_months: "최근 3개월",
            filter_this_year: "올해",
            filter_all_accounts: "모든 계좌",
            month_01: "1월", month_02: "2월", month_03: "3월", month_04: "4월", month_05: "5월", month_06: "6월",
            month_07: "7월", month_08: "8월", month_09: "9월", month_10: "10월", month_11: "11월", month_12: "12월"
        },
        zh: {
            nav_dashboard: "仪表盘",
            nav_transactions: "交易记录",
            nav_debts: "债务与借贷",
            nav_budget: "预算与目标",
            nav_reports: "数据分析",
            nav_connections: "好友连接",
            nav_settings: "设置",
            nav_sign_out: "退出登录",
            user_popup_title: "我的账户",

            page_dashboard: "仪表盘",
            page_transactions: "交易历史",
            page_debts: "债务与借贷",
            page_budget: "预算计划",
            page_reports: "数据分析",
            page_connections: "好友连接",
            page_account: "用户设置",
            page_currency: "货币",
            page_categories: "分类",
            page_theme: "主题配色",

            net_worth: "净资产",
            monthly_income: "本月收入",
            monthly_spending: "本月支出",
            accounts_wallets: "账户与钱包",
            add_account: "添加账户",
            recent_activity: "近期交易",
            view_all: "查看全部",
            debts_loans: "债务与借贷",
            lent_receivable: "借出 (应收)",
            borrowed_payable: "借入 (应付)",
            no_transactions: "暂无交易记录",
            vs_last_month: "环比上月",

            trans_list_tab: "交易列表",
            trans_calendar_tab: "财务日历",
            search_transactions_ph: "搜索交易...",
            btn_export_pdf: "导出PDF报表",
            btn_filter_sort: "筛选与排序",
            btn_new_transaction: "新增交易",
            financial_calendar: "财务日历",
            btn_today: "今天",
            select_date_msg: "选择日期查看每日明细。",
            weekday_sun: "日", weekday_mon: "一", weekday_tue: "二", weekday_wed: "三", weekday_thu: "四", weekday_fri: "五", weekday_sat: "六",

            debt_subtitle: "应收与应付款项",
            total_lent: "借出总额",
            total_borrowed: "借入总额",
            net_position: "净差额",
            due_soon: "即将到期",
            search_records_ph: "搜索记录...",
            all_types: "所有类型",
            lent: "借出",
            borrowed: "借入",
            status_active: "进行中",
            status_settled: "已结清",

            savings_goals_title: "储蓄目标",
            category_budgets_title: "分类预算",
            btn_new_goal: "新建目标",
            btn_set_budget: "设定预算上限",

            total_income: "总收入",
            total_expenses: "总支出",
            net_savings: "净储蓄",
            savings_rate: "储蓄率",
            of_total_income: "占总收入",
            cash_flow_trends: "现金流走势",
            spending_breakdown: "支出结构明细",
            top_5_expenses: "前5大支出",
            top_category: "主要分类",

            con_subtitle: "好友与请求",
            tab_friends: "好友",
            tab_requests: "请求",
            search_friends_ph: "搜索好友...",

            settings_title: "设置",
            settings_subtitle: "偏好与账户",
            settings_preferences: "偏好设置",
            settings_language: "语言",
            settings_categories: "分类管理",
            settings_currency: "结算货币",
            settings_theme_color: "主题色彩",
            settings_dark_mode: "深色模式",
            settings_sound_haptics: "音效与触感反馈",
            settings_security: "安全与隐私",
            settings_app_lock: "应用锁 (4位PIN码)",
            settings_change_pin: "修改PIN密码",
            settings_biometrics: "生物识别解锁",
            settings_change_pass: "修改登录密码",
            settings_backup_group: "数据与备份",
            settings_backup_json: "备份数据 (JSON)",
            settings_restore_json: "恢复备份",
            settings_danger_group: "账户操作",
            settings_sign_out: "退出登录",
            settings_reset_data: "重置所有数据",

            currency_subtitle: "实时汇率换算",
            currency_sync_text: "实时汇率已连接",
            currency_sync_btn: "同步",
            mid_market_rate: "中间市场汇率",
            conv_from: "原币种",
            conv_converted: "折合金额",
            theme_subtitle: "全站色彩方案",
            theme_preview_title: "实时界面预览",
            theme_preview_desc: "预览应用于按钮、底栏和卡片的主题色彩",
            theme_curated: "精选调色板",
            cat_subtitle: "分类工作台与目录",
            cat_new_title: "新建分类",
            cat_name_ph: "分类名称...",
            btn_add_category: "添加分类",
            cat_saved_title: "已保存分类",

            lang_modal_title: "选择显示语言",
            lang_modal_subtitle: "请选择您偏好的界面语言",
            lang_search_placeholder: "搜索语言或国家...",
            lang_popular: "常用:",
            lang_changed_toast: "语言已切换为",

            btn_cancel: "取消",
            btn_save: "保存",
            btn_proceed: "确定",
            btn_delete: "删除",
            btn_add: "添加",
            btn_edit: "编辑",
            btn_close: "关闭",

            filter_all_months: "全部月份",
            filter_this_month: "本月",
            filter_last_month: "上月",
            filter_last_3_months: "近3个月",
            filter_this_year: "今年",
            filter_all_accounts: "所有账户",
            month_01: "1月", month_02: "2月", month_03: "3月", month_04: "4月", month_05: "5月", month_06: "6月",
            month_07: "7月", month_08: "8月", month_09: "9月", month_10: "10月", month_11: "11月", month_12: "12月"
        },
        ar: {
            nav_dashboard: "لوحة التحكم",
            nav_transactions: "المعاملات",
            nav_debts: "الديون والقروض",
            nav_budget: "الميزانيات والأهداف",
            nav_reports: "التحليلات",
            nav_connections: "جهات الاتصال",
            nav_settings: "الإعدادات",
            nav_sign_out: "تسجيل الخروج",
            user_popup_title: "حسابي",

            page_dashboard: "لوحة التحكم",
            page_transactions: "سجل المعاملات",
            page_debts: "الديون والقروض",
            page_budget: "خطة الميزانية",
            page_reports: "التحليلات",
            page_connections: "جهات الاتصال",
            page_account: "إعدادات المستخدم",
            page_currency: "العملة",
            page_categories: "الفئات",
            page_theme: "سمة الألوان",

            net_worth: "صافي الثروة",
            monthly_income: "دخل هذا الشهر",
            monthly_spending: "مصروفات هذا الشهر",
            accounts_wallets: "الحسابات والمحافظ",
            add_account: "إضافة حساب",
            recent_activity: "آخر المعاملات",
            view_all: "عرض الكل",
            debts_loans: "الديون والقروض",
            lent_receivable: "مُقرض (مستحق لك)",
            borrowed_payable: "مُقترض (مستحق عليك)",
            no_transactions: "لا توجد معاملات",
            vs_last_month: "مقارنة بالشهر الماضي",

            trans_list_tab: "قائمة المعاملات",
            trans_calendar_tab: "التقويم المالي",
            search_transactions_ph: "البحث في المعاملات...",
            btn_export_pdf: "تصدير تقرير PDF",
            btn_filter_sort: "تصفية وترتيب",
            btn_new_transaction: "معاملة جديدة",
            financial_calendar: "التقويم المالي",
            btn_today: "اليوم",
            select_date_msg: "حدد تاريخاً لعرض التفاصيل اليومية.",
            weekday_sun: "الأحد", weekday_mon: "الإثنين", weekday_tue: "الثلاثاء", weekday_wed: "الأربعاء", weekday_thu: "الخميس", weekday_fri: "الجمعة", weekday_sat: "السبت",

            debt_subtitle: "المستحقات والالتزامات",
            total_lent: "إجمالي المُقرض",
            total_borrowed: "إجمالي المُقترض",
            net_position: "المركز الصافي",
            due_soon: "يستحق قريباً",
            search_records_ph: "البحث في السجلات...",
            all_types: "جميع الأنواع",
            lent: "مُقرض",
            borrowed: "مُقترض",
            status_active: "نشط",
            status_settled: "مُسدد",

            savings_goals_title: "أهداف الادخار",
            category_budgets_title: "ميزانيات الفئات",
            btn_new_goal: "هدف جديد",
            btn_set_budget: "تحديد الميزانية",

            total_income: "إجمالي الدخل",
            total_expenses: "إجمالي المصروفات",
            net_savings: "صافي الادخار",
            savings_rate: "معدل الادخار",
            of_total_income: "من إجمالي الدخل",
            cash_flow_trends: "اتجاهات التدفق النقدي",
            spending_breakdown: "توزيع المصروفات",
            top_5_expenses: "أعلى 5 مصروفات",
            top_category: "الفئة الرئيسية",

            con_subtitle: "الأصدقاء والطلبات",
            tab_friends: "الأصدقاء",
            tab_requests: "الطلبات",
            search_friends_ph: "البحث عن أصدقاء...",

            settings_title: "الإعدادات",
            settings_subtitle: "التفضيلات والحساب",
            settings_preferences: "التفضيلات",
            settings_language: "اللغة",
            settings_categories: "الفئات",
            settings_currency: "العملة",
            settings_theme_color: "لون السمة",
            settings_dark_mode: "الوضع الداكن",
            settings_sound_haptics: "الأصوات والاهتزازات",
            settings_security: "الأمان والخصوصية",
            settings_app_lock: "قفل التطبيق (رمز PIN)",
            settings_change_pin: "تغيير رمز PIN",
            settings_biometrics: "فتح بالبصمة أو الوجه",
            settings_change_pass: "تغيير كلمة المرور",
            settings_backup_group: "البيانات والنسخ الاحتياطي",
            settings_backup_json: "نسخ احتياطي للبيانات (JSON)",
            settings_restore_json: "استعادة النسخة الاحتياطية",
            settings_danger_group: "الحساب",
            settings_sign_out: "تسجيل الخروج",
            settings_reset_data: "إعادة تعيين جميع البيانات",

            currency_subtitle: "أسعار الصرف المباشرة",
            currency_sync_text: "الأسعار المباشرة متصلة",
            currency_sync_btn: "تحديث",
            mid_market_rate: "سعر السوق المتوسط",
            conv_from: "من",
            conv_converted: "محول إلى",
            theme_subtitle: "لوحة ألوان النظام",
            theme_preview_title: "معاينة مباشرة للواجهة",
            theme_preview_desc: "محاكاة ألوان السمة عبر الأزرار والبطاقات",
            theme_curated: "لوحات ألوان مختارة",
            cat_subtitle: "استوديو ودليل الفئات",
            cat_new_title: "فئة جديدة",
            cat_name_ph: "اسم الفئة...",
            btn_add_category: "إضافة فئة",
            cat_saved_title: "الفئات المحفوظة",

            lang_modal_title: "اختيار اللغة",
            lang_modal_subtitle: "اختر لغة العرض المفضلة لديك",
            lang_search_placeholder: "ابحث عن لغة أو دولة...",
            lang_popular: "شائع:",
            lang_changed_toast: "تم تغيير اللغة إلى",

            btn_cancel: "إلغاء",
            btn_save: "حفظ",
            btn_proceed: "متابعة",
            btn_delete: "حذف",
            btn_add: "إضافة",
            btn_edit: "تعديل",
            btn_close: "إغلاق",

            filter_all_months: "جميع الأشهر",
            filter_this_month: "هذا الشهر",
            filter_last_month: "الشهر الماضي",
            filter_last_3_months: "آخر 3 أشهر",
            filter_this_year: "هذا العام",
            filter_all_accounts: "جميع الحسابات",
            month_01: "يناير", month_02: "فبراير", month_03: "مارس", month_04: "أبريل", month_05: "مايو", month_06: "يونيو",
            month_07: "يوليو", month_08: "أغسطس", month_09: "سبتمبر", month_10: "أكتوبر", month_11: "نوفمبر", month_12: "ديسمبر"
        },
        pt: {
            nav_dashboard: "Painel",
            nav_transactions: "Transações",
            nav_debts: "Dívidas e Empréstimos",
            nav_budget: "Orçamentos e Metas",
            nav_reports: "Relatórios",
            nav_connections: "Conexões",
            nav_settings: "Configurações",
            nav_sign_out: "Sair",
            user_popup_title: "Minha Conta",

            page_dashboard: "Painel",
            page_transactions: "Histórico de Transações",
            page_debts: "Dívidas e Empréstimos",
            page_budget: "Plano de Orçamento",
            page_reports: "Relatórios",
            page_connections: "Conexões",
            page_account: "Configurações de Usuário",
            page_currency: "Moeda",
            page_categories: "Categorias",
            page_theme: "Cor do Tema",

            net_worth: "Patrimônio Líquido",
            monthly_income: "Renda Mensal",
            monthly_spending: "Gastos Mensais",
            accounts_wallets: "Contas e Carteiras",
            add_account: "Adicionar Conta",
            recent_activity: "Transações Recentes",
            view_all: "Ver Tudo",
            debts_loans: "Dívidas e Empréstimos",
            lent_receivable: "Emprestado (A Receber)",
            borrowed_payable: "Devido (A Pagar)",
            no_transactions: "Nenhuma transação encontrada",
            vs_last_month: "vs mês anterior",

            trans_list_tab: "Lista de Transações",
            trans_calendar_tab: "Calendário Financeiro",
            search_transactions_ph: "Pesquisar transações...",
            btn_export_pdf: "Exportar Relatório PDF",
            btn_filter_sort: "Filtrar e Ordenar",
            btn_new_transaction: "Nova Transação",
            financial_calendar: "Calendário Financeiro",
            btn_today: "Hoje",
            select_date_msg: "Selecione uma data para ver os detalhes diários.",
            weekday_sun: "Dom", weekday_mon: "Seg", weekday_tue: "Ter", weekday_wed: "Qua", weekday_thu: "Qui", weekday_fri: "Sex", weekday_sat: "Sáb",

            debt_subtitle: "Recebíveis e Pagamentos",
            total_lent: "Total Emprestado",
            total_borrowed: "Total Devido",
            net_position: "Posição Líquida",
            due_soon: "Vencendo em Breve",
            search_records_ph: "Pesquisar registros...",
            all_types: "Todos os Tipos",
            lent: "Emprestado",
            borrowed: "Devido",
            status_active: "Ativo",
            status_settled: "Quitado",

            savings_goals_title: "Metas de Poupança",
            category_budgets_title: "Orçamentos por Categoria",
            btn_new_goal: "Nova Meta",
            btn_set_budget: "Definir Orçamento",

            total_income: "Receita Total",
            total_expenses: "Despesas Totais",
            net_savings: "Economia Líquida",
            savings_rate: "Taxa de Poupança",
            of_total_income: "da receita total",
            cash_flow_trends: "Tendências de Fluxo",
            spending_breakdown: "Divisão de Gastos",
            top_5_expenses: "Top 5 Despesas",
            top_category: "Categoria Principal",

            con_subtitle: "Amigos e Solicitações",
            tab_friends: "Amigos",
            tab_requests: "Solicitações",
            search_friends_ph: "Pesquisar amigos...",

            settings_title: "Configurações",
            settings_subtitle: "Preferências e Conta",
            settings_preferences: "Preferências",
            settings_language: "Idioma",
            settings_categories: "Categorias",
            settings_currency: "Moeda",
            settings_theme_color: "Cor do Tema",
            settings_dark_mode: "Modo Escuro",
            settings_sound_haptics: "Sons e Vibrações",
            settings_security: "Segurança e Privacidade",
            settings_app_lock: "Bloqueio do App (PIN de 4 dígitos)",
            settings_change_pin: "Alterar Código PIN",
            settings_biometrics: "Desbloqueio Biométrico",
            settings_change_pass: "Alterar Senha",
            settings_backup_group: "Dados e Backup",
            settings_backup_json: "Backup de Dados (JSON)",
            settings_restore_json: "Restaurar Backup",
            settings_danger_group: "Conta",
            settings_sign_out: "Sair",
            settings_reset_data: "Redefinir Todos os Dados",

            currency_subtitle: "Taxas de Câmbio em Tempo Real",
            currency_sync_text: "Taxas ao vivo conectadas",
            currency_sync_btn: "Sincronizar",
            mid_market_rate: "Taxa Média de Mercado",
            conv_from: "De",
            conv_converted: "Convertido",
            theme_subtitle: "Paleta de Cores do Sistema",
            theme_preview_title: "Prévia da Interface",
            theme_preview_desc: "Simule cores dinâmicas aplicadas a botões, docks e cartões",
            theme_curated: "Paletas Selecionadas",
            cat_subtitle: "Estúdio e Catálogo de Categorias",
            cat_new_title: "Nova Categoria",
            cat_name_ph: "Nome da categoria...",
            btn_add_category: "Adicionar Categoria",
            cat_saved_title: "Categorias Salvas",

            lang_modal_title: "Selecionar Idioma",
            lang_modal_subtitle: "Escolha o idioma de exibição do aplicativo",
            lang_search_placeholder: "Pesquisar idioma ou país...",
            lang_popular: "Popular:",
            lang_changed_toast: "Idioma alterado para",

            btn_cancel: "Cancelar",
            btn_save: "Salvar",
            btn_proceed: "Prosseguir",
            btn_delete: "Excluir",
            btn_add: "Adicionar",
            btn_edit: "Editar",
            btn_close: "Fechar",

            filter_all_months: "Todos os Meses",
            filter_this_month: "Este Mês",
            filter_last_month: "Mês Anterior",
            filter_last_3_months: "Últimos 3 Meses",
            filter_this_year: "Este Ano",
            filter_all_accounts: "Todas as Contas",
            month_01: "Jan", month_02: "Fev", month_03: "Mar", month_04: "Abr", month_05: "Mai", month_06: "Jun",
            month_07: "Jul", month_08: "Ago", month_09: "Set", month_10: "Out", month_11: "Nov", month_12: "Dez"
        },
        ru: {
            nav_dashboard: "Панель",
            nav_transactions: "Транзакции",
            nav_debts: "Долги и Займы",
            nav_budget: "Бюджеты и Цели",
            nav_reports: "Аналитика",
            nav_connections: "Контакты",
            nav_settings: "Настройки",
            nav_sign_out: "Выйти",
            user_popup_title: "Мой аккаунт",

            page_dashboard: "Панель",
            page_transactions: "История транзакций",
            page_debts: "Долги и займы",
            page_budget: "План бюджета",
            page_reports: "Аналитика",
            page_connections: "Контакты",
            page_account: "Настройки пользователя",
            page_currency: "Валюта",
            page_categories: "Категории",
            page_theme: "Цвет темы",

            net_worth: "Чистые активы",
            monthly_income: "Доходы за месяц",
            monthly_spending: "Расходы за месяц",
            accounts_wallets: "Счета и кошельки",
            add_account: "Добавить счет",
            recent_activity: "Недавние транзакции",
            view_all: "Смотреть все",
            debts_loans: "Долги и займы",
            lent_receivable: "Дано в долг (К получению)",
            borrowed_payable: "Взято в долг (К выплате)",
            no_transactions: "Транзакций не найдено",
            vs_last_month: "по сравнению с прошлым месяцем",

            trans_list_tab: "Список транзакций",
            trans_calendar_tab: "Финансовый календарь",
            search_transactions_ph: "Поиск транзакций...",
            btn_export_pdf: "Экспорт PDF отчета",
            btn_filter_sort: "Фильтр и сортировка",
            btn_new_transaction: "Новая транзакция",
            financial_calendar: "Финансовый календарь",
            btn_today: "Сегодня",
            select_date_msg: "Выберите дату для просмотра подробностей.",
            weekday_sun: "Вс", weekday_mon: "Пн", weekday_tue: "Вт", weekday_wed: "Ср", weekday_thu: "Чт", weekday_fri: "Пт", weekday_sat: "Сб",

            debt_subtitle: "Дебиторская и кредиторская задолженность",
            total_lent: "Всего дано",
            total_borrowed: "Всего взято",
            net_position: "Чистый баланс",
            due_soon: "Скоро срок",
            search_records_ph: "Поиск записей...",
            all_types: "Все типы",
            lent: "Дано в долг",
            borrowed: "Взято в долг",
            status_active: "Активен",
            status_settled: "Погашен",

            savings_goals_title: "Цели накоплений",
            category_budgets_title: "Бюджеты категорий",
            btn_new_goal: "Новая цель",
            btn_set_budget: "Задать бюджет",

            total_income: "Общий доход",
            total_expenses: "Общие расходы",
            net_savings: "Чистые сбережения",
            savings_rate: "Норма сбережений",
            of_total_income: "от общего дохода",
            cash_flow_trends: "Динамика денежного потока",
            spending_breakdown: "Структура расходов",
            top_5_expenses: "Топ 5 расходов",
            top_category: "Главная категория",

            con_subtitle: "Друзья и запросы",
            tab_friends: "Друзья",
            tab_requests: "Запросы",
            search_friends_ph: "Поиск друзей...",

            settings_title: "Настройки",
            settings_subtitle: "Предпочтения и аккаунт",
            settings_preferences: "Предпочтения",
            settings_language: "Язык",
            settings_categories: "Категории",
            settings_currency: "Валюта",
            settings_theme_color: "Цвет темы",
            settings_dark_mode: "Темная тема",
            settings_sound_haptics: "Звуки и вибрация",
            settings_security: "Безопасность и конфиденциальность",
            settings_app_lock: "Блокировка приложения (4-значный PIN)",
            settings_change_pin: "Изменить PIN-код",
            settings_biometrics: "Биометрическая разблокировка",
            settings_change_pass: "Изменить пароль",
            settings_backup_group: "Данные и резервное копирование",
            settings_backup_json: "Резервная копия (JSON)",
            settings_restore_json: "Восстановить копию",
            settings_danger_group: "Аккаунт",
            settings_sign_out: "Выйти",
            settings_reset_data: "Сбросить все данные",

            currency_subtitle: "Курсы валют в реальном времени",
            currency_sync_text: "Курсы подключены",
            currency_sync_btn: "Синхронизировать",
            mid_market_rate: "Среднерыночный курс",
            conv_from: "Из",
            conv_converted: "Конвертировано",
            theme_subtitle: "Системная цветовая палитра",
            theme_preview_title: "Предпросмотр интерфейса",
            theme_preview_desc: "Оцените применение темы на кнопках и карточках",
            theme_curated: "Подобранные палитры",
            cat_subtitle: "Студия и каталог категорий",
            cat_new_title: "Новая категория",
            cat_name_ph: "Название категории...",
            btn_add_category: "Добавить категорию",
            cat_saved_title: "Сохраненные категории",

            lang_modal_title: "Выбор языка",
            lang_modal_subtitle: "Выберите предпочитаемый язык приложения",
            lang_search_placeholder: "Поиск языка или страны...",
            lang_popular: "Популярные:",
            lang_changed_toast: "Язык изменен на",

            btn_cancel: "Отмена",
            btn_save: "Сохранить",
            btn_proceed: "Продолжить",
            btn_delete: "Удалить",
            btn_add: "Добавить",
            btn_edit: "Изменить",
            btn_close: "Закрыть",

            filter_all_months: "Все месяцы",
            filter_this_month: "Этот месяц",
            filter_last_month: "Прошлый месяц",
            filter_last_3_months: "Последние 3 месяца",
            filter_this_year: "Этот год",
            filter_all_accounts: "Все счета",
            month_01: "Янв", month_02: "Фев", month_03: "Мар", month_04: "Апр", month_05: "Май", month_06: "Июн",
            month_07: "Июл", month_08: "Авг", month_09: "Сен", month_10: "Окт", month_11: "Ноя", month_12: "Дек"
        },
        nl: {
            nav_dashboard: "Dashboard",
            nav_transactions: "Transacties",
            nav_debts: "Schulden & Leningen",
            nav_budget: "Budgetten & Doelen",
            nav_reports: "Statistieken",
            nav_connections: "Connecties",
            nav_settings: "Instellingen",
            nav_sign_out: "Uitloggen",
            user_popup_title: "Mijn Account",

            page_dashboard: "Dashboard",
            page_transactions: "Transactiegeschiedenis",
            page_debts: "Schulden & Leningen",
            page_budget: "Budgetplan",
            page_reports: "Statistieken",
            page_connections: "Connecties",
            page_account: "Gebruikersinstellingen",
            page_currency: "Valuta",
            page_categories: "Categorieën",
            page_theme: "Themakleur",

            net_worth: "Netto Vermogen",
            monthly_income: "Maandelijkse Inkomsten",
            monthly_spending: "Maandelijkse Uitgaven",
            accounts_wallets: "Rekeningen & Portemonnees",
            add_account: "Rekening Toevoegen",
            recent_activity: "Recente Transacties",
            view_all: "Alles Bekijken",
            debts_loans: "Schulden & Leningen",
            lent_receivable: "Uitgeleend (Te Ontvangen)",
            borrowed_payable: "Geleend (Te Betalen)",
            no_transactions: "Geen transacties gevonden",
            vs_last_month: "t.o.v. vorige maand",

            trans_list_tab: "Transactielijst",
            trans_calendar_tab: "Financiële Kalender",
            search_transactions_ph: "Zoek transacties...",
            btn_export_pdf: "Exporteer PDF-overzicht",
            btn_filter_sort: "Filteren & Sorteren",
            btn_new_transaction: "Nieuwe Transactie",
            financial_calendar: "Financiële Kalender",
            btn_today: "Vandaag",
            select_date_msg: "Selecteer een datum om dagelijkse details te bekijken.",
            weekday_sun: "Zo", weekday_mon: "Ma", weekday_tue: "Di", weekday_wed: "Wo", weekday_thu: "Do", weekday_fri: "Vr", weekday_sat: "Za",

            debt_subtitle: "Vorderingen & Schulden",
            total_lent: "Totaal Uitgeleend",
            total_borrowed: "Totaal Geleend",
            net_position: "Netto Positie",
            due_soon: "Binnenkort Vervallen",
            search_records_ph: "Zoek gegevens...",
            all_types: "Alle Typen",
            lent: "Uitgeleend",
            borrowed: "Geleend",
            status_active: "Actief",
            status_settled: "Afgehandeld",

            savings_goals_title: "Spardoelen",
            category_budgets_title: "Categoriebudgetten",
            btn_new_goal: "Nieuw Doel",
            btn_set_budget: "Budget Instellen",

            total_income: "Totale Inkomsten",
            total_expenses: "Totale Uitgaven",
            net_savings: "Netto Besparing",
            savings_rate: "Spaarquote",
            of_total_income: "van totale inkomsten",
            cash_flow_trends: "Kasstroomtrends",
            spending_breakdown: "Uitgavenverdeling",
            top_5_expenses: "Top 5 Uitgaven",
            top_category: "Topcategorie",

            con_subtitle: "Vrienden & Verzoeken",
            tab_friends: "Vrienden",
            tab_requests: "Verzoeken",
            search_friends_ph: "Zoek vrienden...",

            settings_title: "Instellingen",
            settings_subtitle: "Voorkeuren & Account",
            settings_preferences: "Voorkeuren",
            settings_language: "Taal",
            settings_categories: "Categorieën",
            settings_currency: "Valuta",
            settings_theme_color: "Themakleur",
            settings_dark_mode: "Donkere Modus",
            settings_sound_haptics: "Geluid & Haptiek",
            settings_security: "Beveiliging & Privacy",
            settings_app_lock: "App-vergrendeling (4-cijferige pincode)",
            settings_change_pin: "Pincode Wijzigen",
            settings_biometrics: "Biometrische Ontgrendeling",
            settings_change_pass: "Wachtwoord Wijzigen",
            settings_backup_group: "Gegevens & Back-up",
            settings_backup_json: "Gegevens Back-uppen (JSON)",
            settings_restore_json: "Back-up Herstellen",
            settings_danger_group: "Account",
            settings_sign_out: "Uitloggen",
            settings_reset_data: "Alle Gegevens Resetten",

            currency_subtitle: "Live Wisselkoersen",
            currency_sync_text: "Live koersen verbonden",
            currency_sync_btn: "Synchroniseren",
            mid_market_rate: "Middenkoers",
            conv_from: "Van",
            conv_converted: "Omgerekend",
            theme_subtitle: "Systeembreed Kleurenpalet",
            theme_preview_title: "Live UI Voorbeeld",
            theme_preview_desc: "Simuleer dynamische themakleuren op knoppen, docks en kaarten",
            theme_curated: "Geselecteerde Paletten",
            cat_subtitle: "Categoriestudio & Catalogus",
            cat_new_title: "Nieuwe Categorie",
            cat_name_ph: "Categorienaam...",
            btn_add_category: "Categorie Toevoegen",
            cat_saved_title: "Opgeslagen Categorieën",

            lang_modal_title: "Selecteer Taal",
            lang_modal_subtitle: "Kies uw gewenste weergavetaal",
            lang_search_placeholder: "Zoek taal of land...",
            lang_popular: "Populair:",
            lang_changed_toast: "Taal gewijzigd naar",

            btn_cancel: "Annuleren",
            btn_save: "Opslaan",
            btn_proceed: "Doorgaan",
            btn_delete: "Verwijderen",
            btn_add: "Toevoegen",
            btn_edit: "Bewerken",
            btn_close: "Sluiten",

            filter_all_months: "Alle Maanden",
            filter_this_month: "Deze Maand",
            filter_last_month: "Vorige Maand",
            filter_last_3_months: "Laatste 3 Maanden",
            filter_this_year: "Dit Jaar",
            filter_all_accounts: "Alle Rekeningen",
            month_01: "Jan", month_02: "Feb", month_03: "Mrt", month_04: "Apr", month_05: "Mei", month_06: "Jun",
            month_07: "Jul", month_08: "Aug", month_09: "Sep", month_10: "Okt", month_11: "Nov", month_12: "Dec"
        }
    };

    let currentLanguage = localStorage.getItem(LANG_STORAGE_KEY) || 'en';

    function getLanguageFlagUrl(flagCode) {
        return `https://flagcdn.com/w40/${flagCode}.png`;
    }

    function getTranslation(key, fallback = '') {
        const langDict = TRANSLATIONS[currentLanguage] || TRANSLATIONS.en;
        return langDict[key] || TRANSLATIONS.en[key] || fallback;
    }

    function getPageTitle(pageId) {
        const pageKeyMap = {
            'dashboard': 'page_dashboard',
            'transactions': 'page_transactions',
            'debts': 'page_debts',
            'budget': 'page_budget',
            'reports': 'page_reports',
            'connections': 'page_connections',
            'account': 'page_account',
            'currencySettings': 'page_currency',
            'categorySettings': 'page_categories',
            'themeSettings': 'page_theme'
        };
        const key = pageKeyMap[pageId];
        if (key) {
            return getTranslation(key);
        }
        return pageId;
    }

    // Live update of DOM elements with data-i18n attributes
    function translateDOM() {
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = getTranslation(key);
            if (translation) {
                // If element has inner icon, only update the text node
                const icon = el.querySelector('i');
                if (icon) {
                    const textNode = Array.from(el.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
                    if (textNode) {
                        textNode.nodeValue = ' ' + translation;
                    } else {
                        el.appendChild(document.createTextNode(' ' + translation));
                    }
                } else {
                    el.innerText = translation;
                }
            }
        });

        // Translate placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const translation = getTranslation(key);
            if (translation) el.placeholder = translation;
        });

        // Translate titles / aria-labels
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            const translation = getTranslation(key);
            if (translation) {
                el.title = translation;
                el.setAttribute('aria-label', translation);
            }
        });

        // Update Month Filter select options
        const monthFilter = document.getElementById('monthFilter');
        if (monthFilter) {
            const monthValues = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
            Array.from(monthFilter.options).forEach(opt => {
                if (opt.value === 'All') {
                    opt.text = getTranslation('filter_all_months', 'All Months');
                } else if (monthValues.includes(opt.value)) {
                    opt.text = getTranslation('month_' + opt.value, opt.text);
                }
            });
        }

        // Update Analytics Report Period select options
        const reportPeriod = document.getElementById('reportPeriod');
        if (reportPeriod) {
            Array.from(reportPeriod.options).forEach(opt => {
                const text = getTranslation('filter_' + opt.value);
                if (text) opt.text = text;
            });
        }

        // Update Analytics Report Account select
        const reportAccount = document.getElementById('reportAccount');
        if (reportAccount) {
            const allOpt = Array.from(reportAccount.options).find(o => o.value === 'All');
            if (allOpt) allOpt.text = getTranslation('filter_all_accounts', 'All Accounts');
        }

        // Update Debt Filters
        const debtKindFilter = document.getElementById('debtKindFilter');
        if (debtKindFilter) {
            Array.from(debtKindFilter.options).forEach(opt => {
                if (opt.value === 'all') opt.text = getTranslation('all_types', 'All Types');
                if (opt.value === 'lent') opt.text = getTranslation('lent', 'Lent');
                if (opt.value === 'borrowed') opt.text = getTranslation('borrowed', 'Borrowed');
            });
        }

        const debtStatusFilter = document.getElementById('debtStatusFilter');
        if (debtStatusFilter) {
            Array.from(debtStatusFilter.options).forEach(opt => {
                if (opt.value === 'active') opt.text = getTranslation('status_active', 'Active');
                if (opt.value === 'paid') opt.text = getTranslation('status_settled', 'Settled');
                if (opt.value === 'all') opt.text = getTranslation('all_types', 'All');
            });
        }

        // Update Active Page Title
        const activeSection = document.querySelector('.content-section.active');
        if (activeSection && activeSection.id) {
            const pageTitle = document.getElementById('pageTitle');
            if (pageTitle) {
                pageTitle.innerText = getPageTitle(activeSection.id);
            }
        }

        // Update settings row indicator
        updateSettingsRowDisplay();

        // Update document lang attribute & RTL support
        document.documentElement.lang = currentLanguage;
        if (currentLanguage === 'ar') {
            document.documentElement.setAttribute('dir', 'rtl');
        } else {
            document.documentElement.removeAttribute('dir');
        }
    }

    // Update Settings UI row (flag + language name)
    function updateSettingsRowDisplay() {
        const langObj = LANGUAGES.find(l => l.code === currentLanguage) || LANGUAGES[0];
        const flagImg = document.getElementById('settingsLangFlagImg');
        const textEl = document.getElementById('settingsLanguageText');

        if (flagImg) {
            flagImg.src = getLanguageFlagUrl(langObj.flag);
            flagImg.alt = langObj.name;
        }
        if (textEl) {
            textEl.innerText = langObj.native;
        }
    }

    // Change language programmatically or on user select
    function setLanguage(code) {
        const target = LANGUAGES.find(l => l.code === code);
        if (!target) return;

        currentLanguage = target.code;
        localStorage.setItem(LANG_STORAGE_KEY, currentLanguage);

        translateDOM();
        closeLanguagePicker();

        if (window.PocketlyAudio && typeof window.PocketlyAudio.playSuccessChime === 'function') {
            window.PocketlyAudio.playSuccessChime();
        }

        if (window.showAlert) {
            showAlert(`${getTranslation('lang_changed_toast', 'Language changed to')} ${target.native} (${target.name})`, false);
        }
    }

    // Modal: Open Picker
    function openLanguagePicker() {
        const modal = document.getElementById('languagePickerModal');
        if (!modal) return;

        const searchInput = document.getElementById('languagePickerSearchInput');
        if (searchInput) searchInput.value = '';

        renderLanguageList('');
        modal.classList.add('show');

        setTimeout(() => {
            if (searchInput) searchInput.focus();
        }, 120);
    }

    // Modal: Close Picker
    function closeLanguagePicker() {
        const modal = document.getElementById('languagePickerModal');
        if (modal) modal.classList.remove('show');
    }

    // Render language card list with search filter
    function renderLanguageList(filterText = '') {
        const container = document.getElementById('languagePickerList');
        if (!container) return;

        const query = filterText.toLowerCase().trim();
        const filtered = LANGUAGES.filter(l => {
            if (!query) return true;
            return l.name.toLowerCase().includes(query) ||
                   l.native.toLowerCase().includes(query) ||
                   l.code.toLowerCase().includes(query);
        });

        if (filtered.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 30px 16px; color: var(--text-grey);">
                    <i class="fa-solid fa-earth-americas" style="font-size: 2rem; margin-bottom: 8px; opacity: 0.5;"></i>
                    <p style="font-size: 0.9rem; margin: 0;">No matching language found.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(lang => {
            const isSelected = (lang.code === currentLanguage);
            return `
                <div class="currency-premium-card lang-picker-card ${isSelected ? 'active-currency' : ''}" 
                     onclick="window.PocketlyI18n.select('${lang.code}')" 
                     role="button" 
                     tabindex="0">
                    <div class="currency-flag-circle">
                        <img src="${getLanguageFlagUrl(lang.flag)}" alt="${lang.name}" class="currency-flag-img" loading="lazy">
                    </div>
                    <div class="currency-card-main">
                        <div class="currency-header-line">
                            <span class="currency-code-pill">${lang.code.toUpperCase()}</span>
                            <span class="currency-title-name">${lang.native}</span>
                        </div>
                        <div class="currency-detail-line">
                            <span class="currency-country-name">${lang.name}</span>
                        </div>
                    </div>
                    ${isSelected ? `
                        <div style="color: var(--primary-color); font-size: 1.15rem; margin-left: auto; display: flex; align-items: center;">
                            <i class="fa-solid fa-circle-check"></i>
                        </div>
                    ` : `
                        <div style="color: var(--border-color); font-size: 1.15rem; margin-left: auto; display: flex; align-items: center;">
                            <i class="fa-regular fa-circle"></i>
                        </div>
                    `}
                </div>
            `;
        }).join('');
    }

    function initI18n() {
        // Initial DOM translation
        translateDOM();

        // Search input event
        const searchInput = document.getElementById('languagePickerSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                renderLanguageList(e.target.value);
                const clearBtn = document.getElementById('languagePickerSearchClear');
                if (clearBtn) clearBtn.style.display = e.target.value ? 'block' : 'none';
            });
        }

        const clearBtn = document.getElementById('languagePickerSearchClear');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (searchInput) {
                    searchInput.value = '';
                    searchInput.focus();
                }
                clearBtn.style.display = 'none';
                renderLanguageList('');
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initI18n);
    } else {
        initI18n();
    }

    // Public API
    window.PocketlyI18n = {
        getLanguages: () => LANGUAGES,
        getCurrentLanguage: () => currentLanguage,
        t: getTranslation,
        getPageTitle: getPageTitle,
        select: setLanguage,
        translate: translateDOM,
        openPicker: openLanguagePicker,
        closePicker: closeLanguagePicker,
        getFlagUrl: getLanguageFlagUrl
    };
})();
