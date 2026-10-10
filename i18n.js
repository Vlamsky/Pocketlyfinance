/**
 * POCKETLY INTERNATIONALIZATION (i18n) ENGINE
 * Comprehensive Multi-Language System with Flag Icons & Instant Live DOM Translation
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
            // Navigation & Header
            nav_dashboard: "Dashboard",
            nav_transactions: "Transactions",
            nav_debts: "Debts & Loans",
            nav_budget: "Budgets & Goals",
            nav_reports: "Analytics",
            nav_connections: "Connections",
            nav_settings: "Settings",
            nav_sign_out: "Sign Out",

            // Dashboard
            net_worth: "Net Worth",
            monthly_income: "Monthly Income",
            monthly_spending: "Monthly Spending",
            accounts_wallets: "Accounts & Wallets",
            add_account: "Add Account",
            recent_activity: "Recent Activity",
            view_all: "View All",
            debts_loans: "Debts & Loans",
            no_transactions: "No transactions found",
            vs_last_month: "vs Last Month",

            // Settings Menu
            settings_title: "Settings & Preferences",
            settings_subtitle: "Manage account and security",
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

            // Language Picker Modal
            lang_modal_title: "Select Language",
            lang_modal_subtitle: "Choose your preferred display language",
            lang_search_placeholder: "Search language or country...",
            lang_popular: "Popular:",
            lang_changed_toast: "Language changed to",

            // Common Actions
            btn_cancel: "Cancel",
            btn_save: "Save",
            btn_proceed: "Proceed",
            btn_delete: "Delete",
            btn_add: "Add",
            btn_edit: "Edit",
            btn_close: "Close"
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

            net_worth: "Total Kekayaan",
            monthly_income: "Pemasukan Bulan Ini",
            monthly_spending: "Pengeluaran Bulan Ini",
            accounts_wallets: "Rekening & Dompet",
            add_account: "Tambah Rekening",
            recent_activity: "Aktivitas Terakhir",
            view_all: "Lihat Semua",
            debts_loans: "Hutang & Piutang",
            no_transactions: "Belum ada transaksi",
            vs_last_month: "dibanding bulan lalu",

            settings_title: "Pengaturan & Preferensi",
            settings_subtitle: "Kelola akun dan keamanan",
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
            btn_close: "Tutup"
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

            net_worth: "Patrimonio Neto",
            monthly_income: "Ingresos del Mes",
            monthly_spending: "Gastos del Mes",
            accounts_wallets: "Cuentas y Billeteras",
            add_account: "Añadir Cuenta",
            recent_activity: "Actividad Reciente",
            view_all: "Ver Todo",
            debts_loans: "Deudas y Préstamos",
            no_transactions: "Sin transacciones",
            vs_last_month: "vs mes anterior",

            settings_title: "Ajustes y Preferencias",
            settings_subtitle: "Gestionar cuenta y seguridad",
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
            settings_backup_json: "Exportar Copia (JSON)",
            settings_restore_json: "Restaurar Copia",
            settings_danger_group: "Cuenta",
            settings_sign_out: "Cerrar Sesión",
            settings_reset_data: "Borrar Todos los Datos",

            lang_modal_title: "Seleccionar Idioma",
            lang_modal_subtitle: "Elige el idioma de la aplicación",
            lang_search_placeholder: "Buscar idioma o país...",
            lang_popular: "Popular:",
            lang_changed_toast: "Idioma cambiado a",

            btn_cancel: "Cancelar",
            btn_save: "Guardar",
            btn_proceed: "Continuar",
            btn_delete: "Eliminar",
            btn_add: "Añadir",
            btn_edit: "Editar",
            btn_close: "Cerrar"
        },
        fr: {
            nav_dashboard: "Tableau de Bord",
            nav_transactions: "Transactions",
            nav_debts: "Dettes & Prêts",
            nav_budget: "Budgets & Objectifs",
            nav_reports: "Analyses",
            nav_connections: "Connexions",
            nav_settings: "Paramètres",
            nav_sign_out: "Déconnexion",

            net_worth: "Valeur Nette",
            monthly_income: "Revenus du Mois",
            monthly_spending: "Dépenses du Mois",
            accounts_wallets: "Comptes & Portefeuilles",
            add_account: "Ajouter un Compte",
            recent_activity: "Activité Récente",
            view_all: "Voir Tout",
            debts_loans: "Dettes & Prêts",
            no_transactions: "Aucune transaction",
            vs_last_month: "par rapport au mois dernier",

            settings_title: "Paramètres & Préférences",
            settings_subtitle: "Gérer le compte et la sécurité",
            settings_preferences: "Préférences",
            settings_language: "Langue",
            settings_categories: "Catégories",
            settings_currency: "Devise",
            settings_theme_color: "Couleur du Thème",
            settings_dark_mode: "Mode Sombre",
            settings_sound_haptics: "Sons & Vibrations",
            settings_security: "Sécurité & Confidentialité",
            settings_app_lock: "Verrouillage (PIN 4 Chiffres)",
            settings_change_pin: "Modifier le Code PIN",
            settings_biometrics: "Déverrouillage Biométrique",
            settings_change_pass: "Changer le Mot de Passe",
            settings_backup_group: "Données & Sauvegarde",
            settings_backup_json: "Sauvegarder (JSON)",
            settings_restore_json: "Restaurer Sauvegarde",
            settings_danger_group: "Compte",
            settings_sign_out: "Déconnexion",
            settings_reset_data: "Réinitialiser les Données",

            lang_modal_title: "Sélectionner la Langue",
            lang_modal_subtitle: "Choisissez votre langue d'affichage",
            lang_search_placeholder: "Rechercher langue ou pays...",
            lang_popular: "Populaire :",
            lang_changed_toast: "Langue changée en",

            btn_cancel: "Annuler",
            btn_save: "Enregistrer",
            btn_proceed: "Continuer",
            btn_delete: "Supprimer",
            btn_add: "Ajouter",
            btn_edit: "Modifier",
            btn_close: "Fermer"
        },
        de: {
            nav_dashboard: "Übersicht",
            nav_transactions: "Transaktionen",
            nav_debts: "Schulden & Kredite",
            nav_budget: "Budgets & Sparziele",
            nav_reports: "Analysen",
            nav_connections: "Kontakte",
            nav_settings: "Einstellungen",
            nav_sign_out: "Abmelden",

            net_worth: "Gesamtvermögen",
            monthly_income: "Monatseinkommen",
            monthly_spending: "Monatsausgaben",
            accounts_wallets: "Konten & Wallets",
            add_account: "Konto Hinzufügen",
            recent_activity: "Letzte Aktivitäten",
            view_all: "Alle Anzeigen",
            debts_loans: "Schulden & Kredite",
            no_transactions: "Keine Transaktionen",
            vs_last_month: "im Vergleich zum Vormonat",

            settings_title: "Einstellungen",
            settings_subtitle: "Konto & Sicherheit verwalten",
            settings_preferences: "Präferenzen",
            settings_language: "Sprache",
            settings_categories: "Kategorien",
            settings_currency: "Währung",
            settings_theme_color: "Designfarbe",
            settings_dark_mode: "Dunkelmodus",
            settings_sound_haptics: "Töne & Haptik",
            settings_security: "Sicherheit & Datenschutz",
            settings_app_lock: "App-Sperre (4-Stelliger PIN)",
            settings_change_pin: "PIN Ändern",
            settings_biometrics: "Biometrie-Entsperrung",
            settings_change_pass: "Passwort Ändern",
            settings_backup_group: "Daten & Backup",
            settings_backup_json: "Backup Erstellen (JSON)",
            settings_restore_json: "Backup Wiederherstellen",
            settings_danger_group: "Konto",
            settings_sign_out: "Abmelden",
            settings_reset_data: "Alle Daten Zurücksetzen",

            lang_modal_title: "Sprache Wählen",
            lang_modal_subtitle: "Wählen Sie Ihre bevorzugte Sprache",
            lang_search_placeholder: "Sprache oder Land suchen...",
            lang_popular: "Beliebt:",
            lang_changed_toast: "Sprache geändert zu",

            btn_cancel: "Abbrechen",
            btn_save: "Speichern",
            btn_proceed: "Fortfahren",
            btn_delete: "Löschen",
            btn_add: "Hinzufügen",
            btn_edit: "Bearbeiten",
            btn_close: "Schließen"
        },
        ja: {
            nav_dashboard: "ダッシュボード",
            nav_transactions: "取引履歴",
            nav_debts: "借入・貸付",
            nav_budget: "予算と目標",
            nav_reports: "財務分析",
            nav_connections: "つながり",
            nav_settings: "設定",
            nav_sign_out: "ログアウト",

            net_worth: "純資産",
            monthly_income: "今月の収入",
            monthly_spending: "今月の支出",
            accounts_wallets: "口座とウォレット",
            add_account: "口座を追加",
            recent_activity: "最近の活動",
            view_all: "すべて表示",
            debts_loans: "借入・貸付",
            no_transactions: "取引はありません",
            vs_last_month: "先月比",

            settings_title: "設定と基本情報",
            settings_subtitle: "アカウントとセキュリティの管理",
            settings_preferences: "環境設定",
            settings_language: "言語 (Language)",
            settings_categories: "カテゴリー",
            settings_currency: "通貨",
            settings_theme_color: "テーマカラー",
            settings_dark_mode: "ダークモード",
            settings_sound_haptics: "効果音と触覚フィードバック",
            settings_security: "セキュリティとプライバシー",
            settings_app_lock: "アプリロック (4桁PIN)",
            settings_change_pin: "PINコードの変更",
            settings_biometrics: "生体認証ロック解除 (Face ID / 指紋)",
            settings_change_pass: "パスワードの変更",
            settings_backup_group: "データとバックアップ",
            settings_backup_json: "データバックアップ (JSON)",
            settings_restore_json: "バックアップの復元",
            settings_danger_group: "アカウント",
            settings_sign_out: "サインアウト",
            settings_reset_data: "全データを初期化",

            lang_modal_title: "言語の選択",
            lang_modal_subtitle: "表示言語を選択してください",
            lang_search_placeholder: "言語または国名を検索...",
            lang_popular: "人気:",
            lang_changed_toast: "言語を変更しました：",

            btn_cancel: "キャンセル",
            btn_save: "保存",
            btn_proceed: "続行",
            btn_delete: "削除",
            btn_add: "追加",
            btn_edit: "編集",
            btn_close: "閉じる"
        },
        ko: {
            nav_dashboard: "대시보드",
            nav_transactions: "거래 내역",
            nav_debts: "부채 및 대출",
            nav_budget: "예산 및 목표",
            nav_reports: "재정 분석",
            nav_connections: "친구 연결",
            nav_settings: "설정",
            nav_sign_out: "로그아웃",

            net_worth: "순자산",
            monthly_income: "이번 달 수입",
            monthly_spending: "이번 달 지출",
            accounts_wallets: "계좌 및 지갑",
            add_account: "계좌 추가",
            recent_activity: "최근 거래",
            view_all: "전체 보기",
            debts_loans: "부채 및 대출",
            no_transactions: "거래 내역이 없습니다",
            vs_last_month: "지난달 대비",

            settings_title: "설정 및 기본 설정",
            settings_subtitle: "계정 및 보안 관리",
            settings_preferences: "기본 설정",
            settings_language: "언어 (Language)",
            settings_categories: "카테고리",
            settings_currency: "통화",
            settings_theme_color: "테마 색상",
            settings_dark_mode: "다크 모드",
            settings_sound_haptics: "사운드 및 햅틱",
            settings_security: "보안 및 개인정보",
            settings_app_lock: "앱 잠금 (4자리 PIN)",
            settings_change_pin: "PIN 번호 변경",
            settings_biometrics: "생체 인식 잠금 해제",
            settings_change_pass: "비밀번호 변경",
            settings_backup_group: "데이터 및 백업",
            settings_backup_json: "데이터 백업 (JSON)",
            settings_restore_json: "백업 복원",
            settings_danger_group: "계정",
            settings_sign_out: "로그아웃",
            settings_reset_data: "모든 데이터 초기화",

            lang_modal_title: "언어 선택",
            lang_modal_subtitle: "원하시는 언어를 선택하세요",
            lang_search_placeholder: "언어 또는 국가 검색...",
            lang_popular: "인기 언어:",
            lang_changed_toast: "언어가 변경되었습니다: ",

            btn_cancel: "취소",
            btn_save: "저장",
            btn_proceed: "진행",
            btn_delete: "삭제",
            btn_add: "추가",
            btn_edit: "수정",
            btn_close: "닫기"
        },
        zh: {
            nav_dashboard: "仪表板",
            nav_transactions: "明细记录",
            nav_debts: "债务与借贷",
            nav_budget: "预算与储蓄",
            nav_reports: "数据分析",
            nav_connections: "好友连接",
            nav_settings: "系统设置",
            nav_sign_out: "退出登录",

            net_worth: "总净资产",
            monthly_income: "本月收入",
            monthly_spending: "本月支出",
            accounts_wallets: "账户与钱包",
            add_account: "添加账户",
            recent_activity: "最新账目",
            view_all: "查看全部",
            debts_loans: "债务与借贷",
            no_transactions: "暂无交易记录",
            vs_last_month: "相比上月",

            settings_title: "设置与偏好",
            settings_subtitle: "管理您的账户与安全设置",
            settings_preferences: "偏好设置",
            settings_language: "语言 (Language)",
            settings_categories: "支出分类",
            settings_currency: "结算货币",
            settings_theme_color: "主题色彩",
            settings_dark_mode: "暗黑模式",
            settings_sound_haptics: "声音与触觉反馈",
            settings_security: "安全与隐私保护",
            settings_app_lock: "应用锁 (4位PIN码)",
            settings_change_pin: "修改PIN密码",
            settings_biometrics: "生物识别解锁 (面容 / 指纹)",
            settings_change_pass: "修改账户密码",
            settings_backup_group: "数据与云备份",
            settings_backup_json: "备份数据 (JSON)",
            settings_restore_json: "恢复备份数据",
            settings_danger_group: "账户管理",
            settings_sign_out: "退出登录",
            settings_reset_data: "重置所有财务数据",

            lang_modal_title: "选择系统语言",
            lang_modal_subtitle: "请选择您偏好的显示语言",
            lang_search_placeholder: "搜索语言或国家...",
            lang_popular: "常用语言:",
            lang_changed_toast: "已成功切换语言为：",

            btn_cancel: "取消",
            btn_save: "保存",
            btn_proceed: "继续",
            btn_delete: "删除",
            btn_add: "添加",
            btn_edit: "编辑",
            btn_close: "关闭"
        },
        ar: {
            nav_dashboard: "لوحة التحكم",
            nav_transactions: "المعاملات",
            nav_debts: "الديون والقروض",
            nav_budget: "الميزانية والأهداف",
            nav_reports: "التحليلات",
            nav_connections: "جهات الاتصال",
            nav_settings: "الإعدادات",
            nav_sign_out: "تسجيل الخروج",

            net_worth: "صافي الثروة",
            monthly_income: "الدخل الشهري",
            monthly_spending: "المصاريف الشهرية",
            accounts_wallets: "الحسابات والمحافظ",
            add_account: "إضافة حساب",
            recent_activity: "النشاط الأخير",
            view_all: "عرض الكل",
            debts_loans: "الديون والقروض",
            no_transactions: "لا توجد معاملات",
            vs_last_month: "مقارنة بالشهر الماضي",

            settings_title: "الإعدادات والتفضيلات",
            settings_subtitle: "إدارة الحساب والأمان",
            settings_preferences: "التفضيلات",
            settings_language: "اللغة",
            settings_categories: "الفئات",
            settings_currency: "العملة",
            settings_theme_color: "لون السمة",
            settings_dark_mode: "الوضع الداكن",
            settings_sound_haptics: "الصوت والاهتزاز",
            settings_security: "الأمان والخصوصية",
            settings_app_lock: "قفل التطبيق (رمز 4 أرقام)",
            settings_change_pin: "تغيير رمز PIN",
            settings_biometrics: "فتح بالبصمة / الوجه",
            settings_change_pass: "تغيير كلمة المرور",
            settings_backup_group: "البيانات والنسخ الاحتياطي",
            settings_backup_json: "نسخ احتياطي (JSON)",
            settings_restore_json: "استعادة النسخة الاحتياطية",
            settings_danger_group: "الحساب",
            settings_sign_out: "تسجيل الخروج",
            settings_reset_data: "إعادة ضبط جميع البيانات",

            lang_modal_title: "اختر اللغة",
            lang_modal_subtitle: "اختر لغة عرض التطبيق",
            lang_search_placeholder: "بحث عن لغة أو دولة...",
            lang_popular: "شائع:",
            lang_changed_toast: "تم تغيير اللغة إلى",

            btn_cancel: "إلغاء",
            btn_save: "حفظ",
            btn_proceed: "متابعة",
            btn_delete: "حذف",
            btn_add: "إضافة",
            btn_edit: "تعديل",
            btn_close: "إغلاق"
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

            net_worth: "Patrimônio Líquido",
            monthly_income: "Receitas do Mês",
            monthly_spending: "Despesas do Mês",
            accounts_wallets: "Contas e Carteiras",
            add_account: "Adicionar Conta",
            recent_activity: "Atividade Recente",
            view_all: "Ver Tudo",
            debts_loans: "Dívidas e Empréstimos",
            no_transactions: "Nenhuma transação encontrada",
            vs_last_month: "em relação ao mês anterior",

            settings_title: "Configurações e Preferências",
            settings_subtitle: "Gerencie conta e segurança",
            settings_preferences: "Preferências",
            settings_language: "Idioma",
            settings_categories: "Categorias",
            settings_currency: "Moeda",
            settings_theme_color: "Cor do Tema",
            settings_dark_mode: "Modo Escuro",
            settings_sound_haptics: "Sons e Vibrações",
            settings_security: "Segurança e Privacidade",
            settings_app_lock: "Bloqueio do App (PIN 4 Dígitos)",
            settings_change_pin: "Alterar Código PIN",
            settings_biometrics: "Desbloqueio Biométrico",
            settings_change_pass: "Alterar Senha",
            settings_backup_group: "Dados e Backup",
            settings_backup_json: "Backup de Dados (JSON)",
            settings_restore_json: "Restaurar Backup",
            settings_danger_group: "Conta",
            settings_sign_out: "Sair",
            settings_reset_data: "Redefinir Todos os Dados",

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
            btn_close: "Fechar"
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

            net_worth: "Чистые Активы",
            monthly_income: "Доходы за месяц",
            monthly_spending: "Расходы за месяц",
            accounts_wallets: "Счета и Кошельки",
            add_account: "Добавить счет",
            recent_activity: "Недавняя активность",
            view_all: "Посмотреть все",
            debts_loans: "Долги и Займы",
            no_transactions: "Транзакций пока нет",
            vs_last_month: "по сравнению с прошлым месяцем",

            settings_title: "Настройки и Параметры",
            settings_subtitle: "Управление аккаунтом и безопасностью",
            settings_preferences: "Предпочтения",
            settings_language: "Язык (Language)",
            settings_categories: "Категории",
            settings_currency: "Валюта",
            settings_theme_color: "Цвет темы",
            settings_dark_mode: "Темная тема",
            settings_sound_haptics: "Звуки и вибрация",
            settings_security: "Безопасность и Конфиденциальность",
            settings_app_lock: "Блокировка (4-значный PIN)",
            settings_change_pin: "Сменить PIN-код",
            settings_biometrics: "Биометрический вход",
            settings_change_pass: "Сменить пароль",
            settings_backup_group: "Данные и Резервное копирование",
            settings_backup_json: "Создать резервную копию (JSON)",
            settings_restore_json: "Восстановить копию",
            settings_danger_group: "Аккаунт",
            settings_sign_out: "Выйти",
            settings_reset_data: "Сбросить все данные",

            lang_modal_title: "Выберите язык",
            lang_modal_subtitle: "Выберите язык интерфейса приложения",
            lang_search_placeholder: "Поиск языка или страны...",
            lang_popular: "Популярные:",
            lang_changed_toast: "Язык изменен на",

            btn_cancel: "Отмена",
            btn_save: "Сохранить",
            btn_proceed: "Продолжить",
            btn_delete: "Удалить",
            btn_add: "Добавить",
            btn_edit: "Изменить",
            btn_close: "Закрыть"
        },
        nl: {
            nav_dashboard: "Overzicht",
            nav_transactions: "Transacties",
            nav_debts: "Schulden & Leningen",
            nav_budget: "Budgetten & Doelen",
            nav_reports: "Rapporten",
            nav_connections: "Connecties",
            nav_settings: "Instellingen",
            nav_sign_out: "Uitloggen",

            net_worth: "Netto Waarde",
            monthly_income: "Inkomsten van de maand",
            monthly_spending: "Uitgaven van de maand",
            accounts_wallets: "Rekeningen & Wallets",
            add_account: "Rekening Toevoegen",
            recent_activity: "Recente Activiteit",
            view_all: "Alles Bekijken",
            debts_loans: "Schulden & Leningen",
            no_transactions: "Geen transacties gevonden",
            vs_last_month: "vergeleken met vorige maand",

            settings_title: "Instellingen & Voorkeuren",
            settings_subtitle: "Beheer account en beveiliging",
            settings_preferences: "Voorkeuren",
            settings_language: "Taal (Language)",
            settings_categories: "Categorieën",
            settings_currency: "Valuta",
            settings_theme_color: "Themakleur",
            settings_dark_mode: "Donkere Modus",
            settings_sound_haptics: "Geluid & Trillingen",
            settings_security: "Beveiliging & Privacy",
            settings_app_lock: "App-vergrendeling (4-Cijferige PIN)",
            settings_change_pin: "PIN Wijzigen",
            settings_biometrics: "Biometrische Ontgrendeling",
            settings_change_pass: "Wachtwoord Wijzigen",
            settings_backup_group: "Gegevens & Back-up",
            settings_backup_json: "Gegevens Back-up (JSON)",
            settings_restore_json: "Back-up Herstellen",
            settings_danger_group: "Account",
            settings_sign_out: "Uitloggen",
            settings_reset_data: "Alle Gegevens Resetten",

            lang_modal_title: "Selecteer Taal",
            lang_modal_subtitle: "Kies uw weergavetaal",
            lang_search_placeholder: "Zoek taal of land...",
            lang_popular: "Populair:",
            lang_changed_toast: "Taal gewijzigd naar",

            btn_cancel: "Annuleren",
            btn_save: "Opslaan",
            btn_proceed: "Doorgaan",
            btn_delete: "Verwijderen",
            btn_add: "Toevoegen",
            btn_edit: "Bewerken",
            btn_close: "Sluiten"
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

        // Update settings row indicator
        updateSettingsRowDisplay();

        // Update document lang attribute
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
        select: setLanguage,
        translate: translateDOM,
        openPicker: openLanguagePicker,
        closePicker: closeLanguagePicker,
        getFlagUrl: getLanguageFlagUrl
    };
})();
