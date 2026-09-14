import React, { useState } from 'react';
import type { ColorTheme } from '../theme/ThemeProvider';
import { ThemePicker } from './ThemePicker';

export type FontFamily = 'sans' | 'serif' | 'mono';

export interface ReaderSettings {
  // Display
  mode?: 'light' | 'dark' | 'system';
  colorTheme?: ColorTheme;
  fontFamily?: FontFamily;
  autoFormatMd?: boolean;

  // Core Rendering
  stripFrontmatter?: boolean;
  displayMetadata?: boolean;
  advancedTables?: boolean;
  taskLists?: boolean;

  // Content & Media
  enableMath?: boolean;
  enableMermaid?: boolean;
  enablePlantUml?: boolean;
  enableGraphviz?: boolean;
  githubAlerts?: boolean;
  localizeAlerts?: boolean;

  // Reading Aids
  typographer?: boolean;
  externalLinks?: boolean;
  showWordCount?: boolean;
  autoHideWordCount?: boolean;
  showReadingProgress?: boolean;
  celebrationConfetti?: boolean;

  // Presentation
  slideBgColor?: string;
  slideTextColor?: string;
  slideHeadingColor?: string;
  slideAccentColor?: string;
  slideFont?: string;
  slideBgImage?: string;
  slideImageOpacity?: number;
}

export interface SettingsModalProps {
  settings?: ReaderSettings;
  onSettingChange?: <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => void;
  // Legacy / convenience props:
  mode?: 'light' | 'dark' | 'system';
  colorTheme?: ColorTheme;
  fontFamily?: FontFamily;
  autoFormatMd?: boolean;
  autoFormat?: boolean;
  onModeChange?: (mode: 'light' | 'dark' | 'system') => void;
  onColorThemeChange?: (colorTheme: ColorTheme) => void;
  onAutoFormatChange?: (autoFormat: boolean) => void;
  onFontFamilyChange?: (fontFamily: FontFamily) => void;
  themePicker?: React.ReactNode;
}

type TabId = 'display' | 'core' | 'media' | 'reading' | 'presentation';

interface TabItem {
  id: TabId;
  label: string;
}

const TABS: TabItem[] = [
  { id: 'display', label: 'Giao diện' },
  { id: 'core', label: 'Core Rendering' },
  { id: 'media', label: 'Nội dung & Sơ đồ' },
  { id: 'reading', label: 'Hỗ trợ đọc' },
  { id: 'presentation', label: 'Trình chiếu' },
];

function ToggleRow({
  id,
  title,
  description,
  checked,
  onChange,
}: {
  id: string;
  title: string;
  description: string;
  checked?: boolean;
  onChange: (checked: boolean) => void;
}): React.JSX.Element {
  return (
    <div className="settings-row">
      <div className="settings-row-info">
        <label htmlFor={id} className="settings-row-label">
          {title}
        </label>
        <div className="settings-row-desc">{description}</div>
      </div>
      <label className="settings-toggle-switch">
        <input
          id={id}
          type="checkbox"
          checked={Boolean(checked)}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="settings-toggle-slider" />
      </label>
    </div>
  );
}

function InputRow({
  id,
  title,
  description,
  value,
  type = 'text',
  onChange,
}: {
  id: string;
  title: string;
  description: string;
  value?: string | number;
  type?: 'text' | 'number';
  onChange: (val: string | number | undefined) => void;
}): React.JSX.Element {
  return (
    <div className="settings-row">
      <div className="settings-row-info">
        <label htmlFor={id} className="settings-row-label">
          {title}
        </label>
        <div className="settings-row-desc">{description}</div>
      </div>
      <input
        id={id}
        type={type}
        className="settings-input-field"
        value={value ?? ''}
        onChange={(e) => {
          if (type === 'number') {
            const val = e.target.value === '' ? undefined : Number(e.target.value);
            onChange(val);
          } else {
            onChange(e.target.value);
          }
        }}
      />
    </div>
  );
}

export function SettingsModal(props: SettingsModalProps): React.JSX.Element {
  const {
    settings,
    onSettingChange,
    mode,
    onModeChange,
    colorTheme,
    autoFormatMd,
    fontFamily = 'sans',
    onColorThemeChange,
    onAutoFormatChange,
    onFontFamilyChange,
    themePicker,
    autoFormat,
  } = props;

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('display');

  const currentMode = settings?.mode ?? mode;
  const currentColorTheme = settings?.colorTheme ?? colorTheme;
  const currentFontFamily = settings?.fontFamily ?? fontFamily;
  const currentAutoFormat =
    typeof settings?.autoFormatMd === 'boolean'
      ? settings.autoFormatMd
      : typeof autoFormatMd === 'boolean'
      ? autoFormatMd
      : Boolean(autoFormat);

  const handleSettingChange = <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => {
    onSettingChange?.(key, value);
    if (key === 'mode' && onModeChange) {
      onModeChange(value as 'light' | 'dark' | 'system');
    }
    if (key === 'colorTheme' && onColorThemeChange) {
      onColorThemeChange(value as ColorTheme);
    }
    if (key === 'fontFamily' && onFontFamilyChange) {
      onFontFamilyChange(value as FontFamily);
    }
    if (key === 'autoFormatMd' && onAutoFormatChange) {
      onAutoFormatChange(Boolean(value));
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title="Settings"
        aria-label="Settings"
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: 'var(--md-bg)',
          border: '1px solid var(--md-border)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--md-fg)',
          padding: 0,
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="settings-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            className="settings-dialog"
            style={{
              background: 'var(--md-bg)',
              color: 'var(--md-fg)',
              padding: '24px 28px',
              borderRadius: '16px',
              border: '1px solid var(--md-border)',
              boxShadow: '0 24px 48px -12px rgba(0,0,0,0.25)',
              minWidth: '340px',
            }}
          >
            <div
              className="settings-header"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}
            >
              <h2 title="Settings" className="settings-title" style={{ margin: 0, fontSize: '18px' }}>
                Cài đặt
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
                className="settings-close-btn"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '18px',
                  color: 'var(--md-fg)',
                }}
              >
                ✕
              </button>
            </div>

            <div role="tablist" className="settings-tabs">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={activeTab === tab.id}
                  aria-controls={`panel-${tab.id}`}
                  className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="settings-content" role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
              {activeTab === 'display' && (
                <div className="settings-section">
                  {currentMode && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '14px', marginBottom: '8px', fontWeight: 500 }}>Chế độ hiển thị</div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {([
                          { key: 'light', label: 'Sáng' },
                          { key: 'dark', label: 'Tối' },
                          { key: 'system', label: 'Hệ thống' },
                        ] as const).map((opt) => {
                          const isSelected = currentMode === opt.key;
                          return (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => {
                                onModeChange?.(opt.key);
                                handleSettingChange('mode', opt.key);
                              }}
                              aria-pressed={isSelected}
                              style={{
                                flex: 1,
                                padding: '6px 12px',
                                borderRadius: '8px',
                                border: isSelected
                                  ? '2px solid var(--md-link, #0969da)'
                                  : '1px solid var(--md-border, #d0d7de)',
                                background: isSelected
                                  ? 'var(--md-surface-subtle, rgba(125, 125, 125, 0.1))'
                                  : 'transparent',
                                color: 'inherit',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: isSelected ? 600 : 400,
                              }}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div style={{ marginBottom: '16px' }}>
                    {themePicker ??
                      (currentColorTheme ? (
                        <ThemePicker
                          currentTheme={currentColorTheme}
                          onSelect={(t) => {
                            onColorThemeChange?.(t);
                            handleSettingChange('colorTheme', t);
                          }}
                        />
                      ) : null)}
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '14px', marginBottom: '8px', fontWeight: 500 }}>Kiểu phông chữ</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {([
                        { key: 'sans', label: 'Sans-serif' },
                        { key: 'serif', label: 'Serif' },
                        { key: 'mono', label: 'Monospace' },
                      ] as const).map((opt) => {
                        const isSelected = currentFontFamily === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => {
                              onFontFamilyChange?.(opt.key);
                              handleSettingChange('fontFamily', opt.key);
                            }}
                            aria-pressed={isSelected}
                            style={{
                              flex: 1,
                              padding: '6px 12px',
                              borderRadius: '8px',
                              border: isSelected
                                ? '2px solid var(--md-link, #0969da)'
                                : '1px solid var(--md-border, #d0d7de)',
                              background: isSelected
                                ? 'var(--md-surface-subtle, rgba(125, 125, 125, 0.1))'
                                : 'transparent',
                              color: 'inherit',
                              cursor: 'pointer',
                              fontSize: '13px',
                              fontWeight: isSelected ? 600 : 400,
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={currentAutoFormat}
                      onChange={(e) => {
                        onAutoFormatChange?.(e.target.checked);
                        handleSettingChange('autoFormatMd', e.target.checked);
                      }}
                    />
                    Auto-format .md files
                  </label>
                </div>
              )}

              {activeTab === 'core' && (
                <div className="settings-section">
                  <ToggleRow
                    id="settings-stripFrontmatter"
                    title="Front Matter"
                    description="Strip YAML front matter (---) blocks instead of rendering them as text"
                    checked={settings?.stripFrontmatter}
                    onChange={(val) => handleSettingChange('stripFrontmatter', val)}
                  />
                  <ToggleRow
                    id="settings-displayMetadata"
                    title="Display Metadata"
                    description="Show YAML front matter as a formatted metadata card at the top of the document"
                    checked={settings?.displayMetadata}
                    onChange={(val) => handleSettingChange('displayMetadata', val)}
                  />
                  <ToggleRow
                    id="settings-advancedTables"
                    title="Advanced Tables"
                    description="Extended table features: multiline cells, rowspan, headerless tables"
                    checked={settings?.advancedTables}
                    onChange={(val) => handleSettingChange('advancedTables', val)}
                  />
                  <ToggleRow
                    id="settings-taskLists"
                    title="Task Lists"
                    description="Render GitHub-style task lists with checkboxes"
                    checked={settings?.taskLists}
                    onChange={(val) => handleSettingChange('taskLists', val)}
                  />
                </div>
              )}

              {activeTab === 'media' && (
                <div className="settings-section">
                  <ToggleRow
                    id="settings-enableMath"
                    title="Math Equations"
                    description="Render LaTeX math equations ($...$ inline, $$...$$ display)"
                    checked={settings?.enableMath}
                    onChange={(val) => handleSettingChange('enableMath', val)}
                  />
                  <ToggleRow
                    id="settings-enableMermaid"
                    title="Mermaid Diagrams"
                    description="Render flowcharts, sequence diagrams, class diagrams, and more"
                    checked={settings?.enableMermaid}
                    onChange={(val) => handleSettingChange('enableMermaid', val)}
                  />
                  <ToggleRow
                    id="settings-enablePlantUml"
                    title="PlantUML Diagrams"
                    description="Render PlantUML sequence, class, activity, state, and use-case diagrams via a public diagram server (consent required)"
                    checked={settings?.enablePlantUml}
                    onChange={(val) => handleSettingChange('enablePlantUml', val)}
                  />
                  <ToggleRow
                    id="settings-enableGraphviz"
                    title="Graphviz Diagrams"
                    description="Render DOT-language graphs locally via WebAssembly"
                    checked={settings?.enableGraphviz}
                    onChange={(val) => handleSettingChange('enableGraphviz', val)}
                  />
                  <ToggleRow
                    id="settings-githubAlerts"
                    title="GitHub Alerts"
                    description="Render [!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION] blocks"
                    checked={settings?.githubAlerts}
                    onChange={(val) => handleSettingChange('githubAlerts', val)}
                  />
                  <ToggleRow
                    id="settings-localizeAlerts"
                    title="Localize Alert Titles"
                    description="Display alert block titles in the selected language"
                    checked={settings?.localizeAlerts}
                    onChange={(val) => handleSettingChange('localizeAlerts', val)}
                  />
                </div>
              )}

              {activeTab === 'reading' && (
                <div className="settings-section">
                  <ToggleRow
                    id="settings-typographer"
                    title="Typographer"
                    description="Auto-convert typography: (c) → ©, (tm) → ™, -- → –, --- → —, and smart quotes"
                    checked={settings?.typographer}
                    onChange={(val) => handleSettingChange('typographer', val)}
                  />
                  <ToggleRow
                    id="settings-externalLinks"
                    title="External Link Indicators"
                    description="Show preview icons next to external links"
                    checked={settings?.externalLinks}
                    onChange={(val) => handleSettingChange('externalLinks', val)}
                  />
                  <ToggleRow
                    id="settings-showWordCount"
                    title="Show word count"
                    description="Display word count, character count, and reading time"
                    checked={settings?.showWordCount}
                    onChange={(val) => handleSettingChange('showWordCount', val)}
                  />
                  <ToggleRow
                    id="settings-autoHideWordCount"
                    title="Auto-hide word count"
                    description="Hide the word count bar when scrolled near the bottom of the page"
                    checked={settings?.autoHideWordCount}
                    onChange={(val) => handleSettingChange('autoHideWordCount', val)}
                  />
                  <ToggleRow
                    id="settings-showReadingProgress"
                    title="Show reading progress"
                    description="Display a progress bar at the top showing your reading position"
                    checked={settings?.showReadingProgress}
                    onChange={(val) => handleSettingChange('showReadingProgress', val)}
                  />
                  <ToggleRow
                    id="settings-celebrationConfetti"
                    title="Celebration animation"
                    description="Show confetti animation when you reach the end of a document"
                    checked={settings?.celebrationConfetti}
                    onChange={(val) => handleSettingChange('celebrationConfetti', val)}
                  />
                </div>
              )}

              {activeTab === 'presentation' && (
                <div className="settings-section">
                  <InputRow
                    id="settings-slideBgColor"
                    title="Background Color"
                    description="Slide background color (leave empty for theme default)"
                    value={settings?.slideBgColor}
                    onChange={(val) => handleSettingChange('slideBgColor', val as string)}
                  />
                  <InputRow
                    id="settings-slideTextColor"
                    title="Text Color"
                    description="Body text color"
                    value={settings?.slideTextColor}
                    onChange={(val) => handleSettingChange('slideTextColor', val as string)}
                  />
                  <InputRow
                    id="settings-slideHeadingColor"
                    title="Heading Color"
                    description="Heading text color (h1, h2, h3)"
                    value={settings?.slideHeadingColor}
                    onChange={(val) => handleSettingChange('slideHeadingColor', val as string)}
                  />
                  <InputRow
                    id="settings-slideAccentColor"
                    title="Accent Color"
                    description="Progress bar, links, inline code, and blockquotes"
                    value={settings?.slideAccentColor}
                    onChange={(val) => handleSettingChange('slideAccentColor', val as string)}
                  />
                  <InputRow
                    id="settings-slideFont"
                    title="Slide Font"
                    description="Font for slide content"
                    value={settings?.slideFont}
                    onChange={(val) => handleSettingChange('slideFont', val as string)}
                  />
                  <InputRow
                    id="settings-slideBgImage"
                    title="Background Image URL"
                    description="Image URL for slide background (leave empty for none)"
                    value={settings?.slideBgImage}
                    onChange={(val) => handleSettingChange('slideBgImage', val as string)}
                  />
                  <InputRow
                    id="settings-slideImageOpacity"
                    title="Image Opacity"
                    description="How visible the background image is (0% = hidden, 100% = full)"
                    type="number"
                    value={settings?.slideImageOpacity}
                    onChange={(val) => handleSettingChange('slideImageOpacity', val as number)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
