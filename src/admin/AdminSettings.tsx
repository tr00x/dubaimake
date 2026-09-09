import { useState, useEffect } from "react";
import client from "../api/client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Bot, Users, Save, Trash2, Plus, Eye, EyeOff, Copy, Check, Lock, ShieldCheck } from "lucide-react";

export default function AdminSettings() {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [botToken, setBotToken] = useState("");
  const [managerWhatsapp, setManagerWhatsapp] = useState("");
  const [managerTelegram, setManagerTelegram] = useState("");
  const [chatIds, setChatIds] = useState<string[]>([]);
  const [captchaMode, setCaptchaMode] = useState("auto");
  const [turnstileSiteKey, setTurnstileSiteKey] = useState("");
  const [turnstileSecretKey, setTurnstileSecretKey] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [newChatId, setNewChatId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await client.get("/admin/env");
      if (res.data.TELEGRAM_BOT_TOKEN) {
        setBotToken(res.data.TELEGRAM_BOT_TOKEN);
      }
      if (res.data.MANAGER_WHATSAPP) {
        setManagerWhatsapp(res.data.MANAGER_WHATSAPP);
      }
      if (res.data.MANAGER_TELEGRAM) {
        setManagerTelegram(res.data.MANAGER_TELEGRAM);
      }
      if (res.data.TELEGRAM_CHAT_ID) {
        const ids = res.data.TELEGRAM_CHAT_ID.split(",").map((id: string) => id.trim()).filter(Boolean);
        setChatIds(ids);
      }
      if (res.data.ADMIN_USERNAME) {
        setUsername(res.data.ADMIN_USERNAME);
      }
      if (res.data.CAPTCHA_MODE) {
        setCaptchaMode(res.data.CAPTCHA_MODE);
      }
      if (res.data.TURNSTILE_SITE_KEY) {
        setTurnstileSiteKey(res.data.TURNSTILE_SITE_KEY);
      }
      if (res.data.TURNSTILE_SECRET_KEY) {
        setTurnstileSecretKey(res.data.TURNSTILE_SECRET_KEY);
      }
    } catch (error) {
      console.error("Failed to fetch settings", error);
      toast.error(t('admin.settings.load_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddChatId = () => {
    if (!newChatId.trim()) return;
    const id = newChatId.trim();
    if (chatIds.includes(id)) {
      toast.error(t('admin.settings.id_exists'));
      return;
    }
    setChatIds([...chatIds, id]);
    setNewChatId("");
  };

  const handleRemoveChatId = (idToRemove: string) => {
    setChatIds(chatIds.filter(id => id !== idToRemove));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const chatIdString = chatIds.join(",");
      const payload: any = {
        TELEGRAM_BOT_TOKEN: botToken,
        TELEGRAM_CHAT_ID: chatIdString,
        MANAGER_WHATSAPP: managerWhatsapp,
        MANAGER_TELEGRAM: managerTelegram,
        CAPTCHA_MODE: captchaMode,
        TURNSTILE_SITE_KEY: turnstileSiteKey.trim(),
        TURNSTILE_SECRET_KEY: turnstileSecretKey.trim()
      };
      
      if (username) payload.ADMIN_USERNAME = username;
      if (password) payload.ADMIN_PASSWORD = password;

      await client.post("/admin/env", payload);
      toast.success(t('admin.settings.saved_success'));
      setPassword(""); // Clear password field after save for security
    } catch (error) {
      console.error("Failed to save settings", error);
      toast.error(t('admin.settings.save_error'));
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(t('admin.settings.copied'));
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">{t('catalog.loading')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">{t('admin.settings.title')}</h2>
          <p className="admin-page-desc">{t('admin.settings.desc')}</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Admin Access Section */}
        <section className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-icon icon-blue">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="admin-card-title">{t('admin.settings.access_title')}</h2>
              <p className="admin-card-subtitle">
                {t('admin.settings.access_subtitle')}
              </p>
            </div>
          </div>

          <div className="admin-settings-grid" style={{ maxWidth: '600px' }}>
            <div>
              <label className="admin-label mb-2">{t('admin.settings.username')}</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('admin.settings.username_placeholder')}
                className="admin-input"
              />
            </div>
            <div>
              <label className="admin-label mb-2">{t('admin.settings.password')}</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showToken ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('admin.settings.password_placeholder')}
                  className="admin-input"
                  style={{ paddingRight: '3rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="admin-action-icon-btn"
                  title={showToken ? "Hide" : "Show"}
                  style={{ position: 'absolute', right: '0.5rem' }}
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Manager Contacts Section */}
        <section className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-icon icon-green">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="admin-card-title">{t('admin.settings.manager_contacts_title')}</h2>
              <p className="admin-card-subtitle">
                {t('admin.settings.manager_contacts_subtitle')}
              </p>
            </div>
          </div>

          <div className="admin-settings-grid" style={{ maxWidth: '600px' }}>
            <div>
              <label className="admin-label mb-2">{t('admin.settings.whatsapp_link')}</label>
              <input
                type="text"
                value={managerWhatsapp}
                onChange={(e) => setManagerWhatsapp(e.target.value)}
                placeholder={t('admin.settings.whatsapp_placeholder')}
                className="admin-input"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('admin.settings.whatsapp_instruction')}
              </p>
            </div>
            <div>
              <label className="admin-label mb-2">{t('admin.settings.telegram_link')}</label>
              <input
                type="text"
                value={managerTelegram}
                onChange={(e) => setManagerTelegram(e.target.value)}
                placeholder={t('admin.settings.telegram_placeholder')}
                className="admin-input"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('admin.settings.telegram_instruction')}
              </p>
            </div>
          </div>
        </section>

        {/* Telegram Bot Section */}
        <section className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-icon icon-blue">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h2 className="admin-card-title">{t('admin.settings.telegram_title')}</h2>
              <p className="admin-card-subtitle">
                {t('admin.settings.telegram_subtitle')}
              </p>
            </div>
          </div>

          <div className="admin-settings-grid" style={{ maxWidth: '600px' }}>
            <div>
              <label className="admin-label mb-2">{t('admin.settings.bot_token')}</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showToken ? "text" : "password"}
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="123456789:ABCdefGhIjkLmnOpQrStUvWxYz"
                  className="admin-input"
                  style={{ paddingRight: '6rem', fontFamily: 'monospace' }}
                />
                <div style={{ position: 'absolute', right: '0.5rem', display: 'flex', gap: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="admin-action-icon-btn"
                    title={showToken ? "Hide" : "Show"}
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  {botToken && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(botToken)}
                      className="admin-action-icon-btn"
                      title="Copy"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {t('admin.settings.get_token')} <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">@BotFather</a>
              </p>
            </div>
          </div>
        </section>

        {/* Recipients Section */}
        <section className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-icon icon-purple">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="admin-card-title">{t('admin.settings.recipients_title')}</h2>
              <p className="admin-card-subtitle">
                {t('admin.settings.recipients_subtitle')}
              </p>
            </div>
          </div>

          <div className="admin-settings-grid" style={{ maxWidth: '600px' }}>
            <div className="admin-settings-row">
              <input
                value={newChatId}
                onChange={(e) => setNewChatId(e.target.value)}
                placeholder={t('admin.settings.enter_chat_id')}
                className="admin-input"
                style={{ fontFamily: 'monospace' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddChatId();
                  }
                }}
              />
              <button 
                onClick={handleAddChatId}
                disabled={!newChatId.trim()}
                className="admin-button"
                style={{ width: 'auto', marginTop: 0 }}
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('admin.settings.add')}
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{t('admin.settings.active_recipients')} ({chatIds.length})</div>
              
              {chatIds.length === 0 ? (
                <div className="admin-empty-state">
                   <span>{t('admin.settings.no_recipients')}</span>
                </div>
              ) : (
                <div className="grid gap-2">
                  {chatIds.map((id) => (
                    <div 
                      key={id} 
                      className="admin-list-item"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-mono text-xs">
                          ID
                        </div>
                        <span className="font-mono text-sm text-gray-900">{id}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveChatId(id)}
                        className="admin-action-icon-btn delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="admin-tip">
               <p>
                  💡 {t('admin.settings.how_to_get_id')} <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer">@userinfobot</a>. 
                  {t('admin.settings.start_bot_reminder')}
               </p>
            </div>
          </div>
        </section>

        {/* Anti-spam / Captcha Section */}
        <section className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-icon icon-green">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="admin-card-title">{t('admin.settings.antispam_title')}</h2>
              <p className="admin-card-subtitle">
                {t('admin.settings.antispam_subtitle')}
              </p>
            </div>
          </div>

          <div className="admin-settings-grid" style={{ maxWidth: '600px' }}>
            <div>
              <label className="admin-label mb-2" htmlFor="captcha-mode">{t('admin.settings.captcha_mode')}</label>
              <select
                id="captcha-mode"
                value={captchaMode}
                onChange={(e) => setCaptchaMode(e.target.value)}
                className="admin-input"
              >
                <option value="auto">{t('admin.settings.captcha_mode_auto')}</option>
                <option value="builtin">{t('admin.settings.captcha_mode_builtin')}</option>
                <option value="turnstile">{t('admin.settings.captcha_mode_turnstile')}</option>
                <option value="off">{t('admin.settings.captcha_mode_off')}</option>
              </select>
            </div>
            <div>
              <label className="admin-label mb-2" htmlFor="turnstile-site-key">{t('admin.settings.turnstile_site_key')}</label>
              <input
                id="turnstile-site-key"
                type="text"
                value={turnstileSiteKey}
                onChange={(e) => setTurnstileSiteKey(e.target.value)}
                placeholder="0x4AAAAAAA..."
                className="admin-input"
                style={{ fontFamily: 'monospace' }}
                autoComplete="off"
              />
            </div>
            <div>
              <label className="admin-label mb-2" htmlFor="turnstile-secret-key">{t('admin.settings.turnstile_secret_key')}</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  id="turnstile-secret-key"
                  type={showSecret ? "text" : "password"}
                  value={turnstileSecretKey}
                  onChange={(e) => setTurnstileSecretKey(e.target.value)}
                  placeholder="0x4AAAAAAA..."
                  className="admin-input"
                  style={{ paddingRight: '3rem', fontFamily: 'monospace' }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="admin-action-icon-btn"
                  title={showSecret ? "Hide" : "Show"}
                  style={{ position: 'absolute', right: '0.5rem' }}
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('admin.settings.turnstile_instruction')} <a href="https://dash.cloudflare.com/?to=/:account/turnstile" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Cloudflare Turnstile</a>
              </p>
            </div>

            <div className="admin-tip">
              <p>🛡️ {t('admin.settings.antispam_note')}</p>
            </div>
          </div>
        </section>

        <div className="admin-save-bar">
          <button 
            onClick={handleSave} 
            disabled={saving} 
            className="admin-button"
            style={{ width: 'auto', paddingLeft: '2rem', paddingRight: '2rem' }}
          >
            {saving ? (
              <>
                <div className="spinner" />
                {t('admin.settings.saving')}
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {t('admin.settings.save_changes')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}