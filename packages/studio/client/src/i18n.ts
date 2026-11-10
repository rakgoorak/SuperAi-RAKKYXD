import { useState, useEffect } from 'react';

export type Locale = 'th' | 'en' | 'ja' | 'zh';

export interface LanguageOption {
  code: Locale;
  label: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'th', label: 'Thai', nativeName: 'ภาษาไทย', flag: '🇹🇭' },
  { code: 'en', label: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'ja', label: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'zh', label: 'Chinese', nativeName: '简体中文', flag: '🇨🇳' },
];

const STORAGE_KEY = 'superai_locale';

// Translations dictionary
export const translations: Record<Locale, Record<string, string>> = {
  th: {
    // Titlebar & Navigation
    'brand.title': 'SuperAi & RAKKYXD',
    'titlebar.sidebar_toggle': 'สลับแถบข้าง',
    'titlebar.sidebar_hide': 'ซ่อนแถบข้าง',
    'titlebar.sidebar_show': 'แสดงแถบข้าง',
    'titlebar.connected': 'เชื่อมต่อแล้ว',
    'titlebar.reconnecting': 'กำลังเชื่อมต่อใหม่',
    'mode.agent': 'ทีม Agent',
    'mode.chat': 'ถามหลาย AI',
    'mode.code': 'Terminal',
    'mode.agent_desc': 'ทีม Agent: ให้ AI แบ่งงานและลงมือทำ',
    'mode.chat_desc': 'ถามหลาย AI: ถามคำถามเดียวเทียบคำตอบ',
    'mode.code_desc': 'Terminal: ผู้ช่วย AI และเขียนโค้ดลงเครื่อง',
    'nav.files': 'ไฟล์',
    'nav.files_desc': 'เปิดไฟล์และแก้ไขด่วน',
    'nav.preview': 'Preview',
    'nav.preview_desc': 'เปิด Preview หน้าเว็บ',
    'nav.terminal': 'Terminal',
    'nav.terminal_desc': 'เปิด Terminal หรือหลายห้อง',
    'nav.new': 'ใหม่',
    'nav.new_desc': 'บทสนทนาใหม่',

    // Sidebar
    'sidebar.heading': 'พื้นที่ทำงาน',
    'sidebar.hide': 'ซ่อนแถบโปรเจกต์',
    'sidebar.add_project': 'เพิ่มโปรเจกต์',
    'sidebar.recent_projects': 'โปรเจกต์ล่าสุด',
    'sidebar.all_conversations': 'ประวัติการสนทนา',
    'sidebar.settings': 'การตั้งค่า',
    'sidebar.start_here': 'เริ่มต้นใช้งาน',

    // Composer & Interactions
    'composer.placeholder': 'ส่งข้อความถึง AI (Enter เพื่อส่ง, Shift+Enter ขึ้นบรรทัดใหม่)...',
    'composer.send': 'ส่ง',
    'composer.stop': 'หยุด',
    'composer.effort': 'ระดับความคิด',
    'composer.permission': 'สิทธิ์การเขียนไฟล์',
    'composer.perm_ask': 'ถามก่อนเขียน',
    'composer.perm_auto': 'เขียนได้ทันที',
    'composer.perm_readonly': 'อ่านอย่างเดียว',
    'composer.dictation_start': 'พูดภาษาไทย',
    'composer.dictation_stop': 'หยุดบันทึก',
    'composer.attach': 'แนบไฟล์',
    'composer.add_context': 'เพิ่มบริบท',

    // Settings
    'settings.title': 'การตั้งค่า',
    'settings.tab_general': 'ทั่วไป',
    'settings.tab_language': 'ภาษา / Language',
    'settings.tab_tools': 'เครื่องมือ AI',
    'settings.tab_mcp': 'MCP Servers',
    'settings.tab_models': 'Model และ Effort',
    'settings.tab_folders': 'โฟลเดอร์',
    'settings.tab_voice': 'เสียง',
    'settings.tab_notify': 'แจ้งเตือนและคำแนะนำ',
    'settings.tab_updates': 'การอัปเดต',
    'settings.done': 'เสร็จแล้ว',
    'settings.auto_saved': 'บันทึกการตั้งค่าอัตโนมัติ',
    'settings.lang_heading': 'เลือกภาษาการแสดงผล (Display Language)',
    'settings.lang_desc': 'เปลี่ยนภาษาเมนูและปุ่มสั่งงานทั้งหมดในโปรแกรมได้ทันที',

    // Updates & Community
    'updates.community_downloads': 'ยอดดาวน์โหลดคอมมูนิตี้',
    'updates.current_version': 'เวอร์ชันที่ใช้อยู่',
    'updates.latest_version': 'เวอร์ชันล่าสุด',
    'updates.check_now': 'ตรวจหาการอัปเดต',
    'updates.up_to_date': 'คุณใช้เวอร์ชันล่าสุดแล้ว',
  },
  en: {
    // Titlebar & Navigation
    'brand.title': 'SuperAi & RAKKYXD',
    'titlebar.sidebar_toggle': 'Toggle sidebar',
    'titlebar.sidebar_hide': 'Hide sidebar',
    'titlebar.sidebar_show': 'Show sidebar',
    'titlebar.connected': 'Connected',
    'titlebar.reconnecting': 'Reconnecting...',
    'mode.agent': 'Agent Team',
    'mode.chat': 'Multi-AI Chat',
    'mode.code': 'Terminal & Code',
    'mode.agent_desc': 'Agent Team: Autonomous multi-agent coordination',
    'mode.chat_desc': 'Multi-AI: Ask once, compare side-by-side',
    'mode.code_desc': 'Terminal: AI assistant & local coding CLI',
    'nav.files': 'Files',
    'nav.files_desc': 'Open file explorer & quick edits',
    'nav.preview': 'Preview',
    'nav.preview_desc': 'Toggle live web preview',
    'nav.terminal': 'Terminal',
    'nav.terminal_desc': 'Open terminal session',
    'nav.new': 'New',
    'nav.new_desc': 'Start a new conversation',

    // Sidebar
    'sidebar.heading': 'Workspaces',
    'sidebar.hide': 'Hide sidebar',
    'sidebar.add_project': 'Open Project',
    'sidebar.recent_projects': 'Recent Projects',
    'sidebar.all_conversations': 'Conversations',
    'sidebar.settings': 'Settings',
    'sidebar.start_here': 'Get Started',

    // Composer & Interactions
    'composer.placeholder': 'Message AI (Enter to send, Shift+Enter for new line)...',
    'composer.send': 'Send',
    'composer.stop': 'Stop',
    'composer.effort': 'Thinking Effort',
    'composer.permission': 'File Permissions',
    'composer.perm_ask': 'Ask before write',
    'composer.perm_auto': 'Auto-write',
    'composer.perm_readonly': 'Read-only',
    'composer.dictation_start': 'Dictate Voice',
    'composer.dictation_stop': 'Stop Recording',
    'composer.attach': 'Attach files',
    'composer.add_context': 'Add context',

    // Settings
    'settings.title': 'Settings',
    'settings.tab_general': 'General',
    'settings.tab_language': 'Language',
    'settings.tab_tools': 'AI Tools',
    'settings.tab_mcp': 'MCP Servers',
    'settings.tab_models': 'Model & Effort',
    'settings.tab_folders': 'Folders',
    'settings.tab_voice': 'Voice & Audio',
    'settings.tab_notify': 'Notifications',
    'settings.tab_updates': 'Updates',
    'settings.done': 'Done',
    'settings.auto_saved': 'Settings saved automatically',
    'settings.lang_heading': 'Display Language',
    'settings.lang_desc': 'Choose your preferred language for the interface and controls.',

    // Updates & Community
    'updates.community_downloads': 'Community Downloads',
    'updates.current_version': 'Current Version',
    'updates.latest_version': 'Latest Version',
    'updates.check_now': 'Check for updates',
    'updates.up_to_date': 'You are on the latest version',
  },
  ja: {
    // Titlebar & Navigation
    'brand.title': 'SuperAi & RAKKYXD',
    'titlebar.sidebar_toggle': 'サイドバー切替',
    'titlebar.sidebar_hide': 'サイドバーを隠す',
    'titlebar.sidebar_show': 'サイドバーを表示',
    'titlebar.connected': '接続済み',
    'titlebar.reconnecting': '再接続中...',
    'mode.agent': 'エージェント',
    'mode.chat': 'マルチAIチャット',
    'mode.code': 'ターミナル',
    'mode.agent_desc': 'エージェントチーム：自律型AIチームによるタスク分割と実行',
    'mode.chat_desc': 'マルチAI：1回質問して複数AIの回答を比較',
    'mode.code_desc': 'ターミナル：AIコーディングアシスタント＆ローカルCLI',
    'nav.files': 'ファイル',
    'nav.files_desc': 'ファイルエクスプローラーと簡易編集',
    'nav.preview': 'プレビュー',
    'nav.preview_desc': 'Webプレビューの切替',
    'nav.terminal': 'ターミナル',
    'nav.terminal_desc': '新しいターミナルセッションを開く',
    'nav.new': '新規',
    'nav.new_desc': '新しい会話を開始',

    // Sidebar
    'sidebar.heading': 'ワークスペース',
    'sidebar.hide': 'サイドバーを隠す',
    'sidebar.add_project': 'プロジェクトを開く',
    'sidebar.recent_projects': '最近のプロジェクト',
    'sidebar.all_conversations': '会話履歴',
    'sidebar.settings': '設定',
    'sidebar.start_here': '使ってみる',

    // Composer & Interactions
    'composer.placeholder': 'AIにメッセージを送信 (Enterで送信、Shift+Enterで改行)...',
    'composer.send': '送信',
    'composer.stop': '停止',
    'composer.effort': '思考レベル',
    'composer.permission': 'ファイル書き込み権限',
    'composer.perm_ask': '書き込み前に確認',
    'composer.perm_auto': '自動書き込み',
    'composer.perm_readonly': '読み取り専用',
    'composer.dictation_start': '音声入力開始',
    'composer.dictation_stop': '録音停止',
    'composer.attach': 'ファイルを添付',
    'composer.add_context': 'コンテキストを追加',

    // Settings
    'settings.title': '設定',
    'settings.tab_general': '一般',
    'settings.tab_language': '言語 (Language)',
    'settings.tab_tools': 'AIツール',
    'settings.tab_mcp': 'MCPサーバー',
    'settings.tab_models': 'モデル＆思考力',
    'settings.tab_folders': 'フォルダー',
    'settings.tab_voice': '音声設定',
    'settings.tab_notify': '通知とアドバイス',
    'settings.tab_updates': 'アップデート',
    'settings.done': '完了',
    'settings.auto_saved': '設定は自動保存されます',
    'settings.lang_heading': '表示言語の選択',
    'settings.lang_desc': 'インターフェースおよびボタンの表示言語を切り替えます。',

    // Updates & Community
    'updates.community_downloads': 'コミュニティダウンロード総数',
    'updates.current_version': '現在のバージョン',
    'updates.latest_version': '最新バージョン',
    'updates.check_now': '更新を確認',
    'updates.up_to_date': '最新バージョンを使用中です',
  },
  zh: {
    // Titlebar & Navigation
    'brand.title': 'SuperAi & RAKKYXD',
    'titlebar.sidebar_toggle': '切换侧边栏',
    'titlebar.sidebar_hide': '隐藏侧边栏',
    'titlebar.sidebar_show': '显示侧边栏',
    'titlebar.connected': '已连接',
    'titlebar.reconnecting': '正在重新连接...',
    'mode.agent': '智能体团队',
    'mode.chat': '多模型对话',
    'mode.code': '终端与代码',
    'mode.agent_desc': '智能体团队：多AI并行拆解和执行任务',
    'mode.chat_desc': '多模型对比：一键提问，并排对比不同模型回答',
    'mode.code_desc': '终端模式：本地开发与AI终端助手',
    'nav.files': '文件',
    'nav.files_desc': '打开文件资源管理器与快速编辑',
    'nav.preview': '网页预览',
    'nav.preview_desc': '开启实时网页预览',
    'nav.terminal': '终端',
    'nav.terminal_desc': '开启终端或多会话',
    'nav.new': '新建',
    'nav.new_desc': '发起新对话',

    // Sidebar
    'sidebar.heading': '工作区',
    'sidebar.hide': '隐藏侧边栏',
    'sidebar.add_project': '打开项目文件夹',
    'sidebar.recent_projects': '最近项目',
    'sidebar.all_conversations': '对话记录',
    'sidebar.settings': '设置',
    'sidebar.start_here': '快速入门',

    // Composer & Interactions
    'composer.placeholder': '给 AI 发送消息 (按 Enter 发送，Shift+Enter 换行)...',
    'composer.send': '发送',
    'composer.stop': '停止',
    'composer.effort': '思考深度',
    'composer.permission': '文件修改权限',
    'composer.perm_ask': '写入前询问',
    'composer.perm_auto': '允许自动写入',
    'composer.perm_readonly': '仅只读',
    'composer.dictation_start': '语音输入',
    'composer.dictation_stop': '停止录音',
    'composer.attach': '添加附件',
    'composer.add_context': '添加上下文',

    // Settings
    'settings.title': '设置',
    'settings.tab_general': '通用',
    'settings.tab_language': '语言 (Language)',
    'settings.tab_tools': 'AI 工具',
    'settings.tab_mcp': 'MCP 服务',
    'settings.tab_models': '模型与深度',
    'settings.tab_folders': '项目文件夹',
    'settings.tab_voice': '语音设置',
    'settings.tab_notify': '通知与建议',
    'settings.tab_updates': '版本更新',
    'settings.done': '完成',
    'settings.auto_saved': '配置已自动保存',
    'settings.lang_heading': '界面显示语言',
    'settings.lang_desc': '选择适合您的软件显示语言，修改后即时生效。',

    // Updates & Community
    'updates.community_downloads': '社区总下载量',
    'updates.current_version': '当前版本',
    'updates.latest_version': '最新版本',
    'updates.check_now': '检查更新',
    'updates.up_to_date': '当前已是最新版本',
  },
};

/**
 * Detect the initial language from localStorage or navigator
 */
export function getInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved && (saved === 'th' || saved === 'en' || saved === 'ja' || saved === 'zh')) {
      return saved;
    }
    const nav = navigator.language?.toLowerCase() || '';
    if (nav.startsWith('th')) return 'th';
    if (nav.startsWith('ja')) return 'ja';
    if (nav.startsWith('zh')) return 'zh';
  } catch {}
  return 'th'; // Default to Thai
}

let currentLocale: Locale = getInitialLocale();
const listeners = new Set<(locale: Locale) => void>();

export function setLocale(locale: Locale): void {
  if (currentLocale === locale) return;
  currentLocale = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {}
  listeners.forEach((fn) => fn(locale));
}

export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Get translation string by key with optional fallback
 */
export function t(key: string, fallback?: string): string {
  const dict = translations[currentLocale] || translations.th;
  if (dict && dict[key]) return dict[key];
  if (translations.en && translations.en[key]) return translations.en[key];
  if (translations.th && translations.th[key]) return translations.th[key];
  return fallback || key;
}

/**
 * React Hook for i18n
 */
export function useTranslation() {
  const [locale, setLocalLocale] = useState<Locale>(currentLocale);

  useEffect(() => {
    const handler = (newLocale: Locale) => setLocalLocale(newLocale);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return {
    locale,
    setLocale,
    t: (key: string, fallback?: string) => t(key, fallback),
    languages: SUPPORTED_LANGUAGES,
  };
}
