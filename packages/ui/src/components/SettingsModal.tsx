import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Contrast } from '../theme/ThemeProvider';
import { PalettePicker } from './ThemePicker';
import { normalizeServerUrl } from '@md-reader/core';
import { Icon } from './Icon';

export type FontFamily = 'sans' | 'serif' | 'mono';

export type PageWidth = 'narrow' | 'medium' | 'wide' | 'full';

export interface ReaderSettings {
  // Display
  mode?: 'light' | 'dark' | 'system';
  contrast: Contrast;
  settingsVersion: number;
  fontFamily?: FontFamily;
  pageWidth?: PageWidth;
  autoFormatMd?: boolean;
  formatOnSave?: boolean;
  alwaysOpenApp?: boolean;

  // Core Rendering
  stripFrontmatter?: boolean;
  displayMetadata?: boolean;

  // Content & Media
  enableMath?: boolean;
  enableMermaid?: boolean;
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

  // Collaboration
  serverUrl?: string;
  displayName?: string;
}

export interface SettingsModalProps {
  settings?: ReaderSettings;
  onSettingChange?: <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => void;
  // Legacy / convenience props:
  mode?: 'light' | 'dark' | 'system';
  fontFamily?: FontFamily;
  autoFormatMd?: boolean;
  autoFormat?: boolean;
  alwaysOpenApp?: boolean;
  onModeChange?: (mode: 'light' | 'dark' | 'system') => void;
  onAutoFormatChange?: (autoFormat: boolean) => void;
  onFontFamilyChange?: (fontFamily: FontFamily) => void;
  onAlwaysOpenAppChange?: (alwaysOpenApp: boolean) => void;
  themePicker?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultServerUrl?: string;
}

const SECTIONS = [
  { id: 'look', label: 'Chữ và màu' },
  { id: 'content', label: 'Nội dung trong tài liệu' },
  { id: 'open', label: 'Khi mở file .md' },
  { id: 'aids', label: 'Hỗ trợ đọc' },
  { id: 'slides', label: 'Trình chiếu' },
  { id: 'collab', label: 'Cộng tác' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

function ToggleRow({
  id,
  title,
  description,
  checked,
  onChange,
}: {
  id: string;
  title: string;
  description?: string;
  checked?: boolean;
  onChange: (checked: boolean) => void;
}): React.JSX.Element {
  return (
    <div className="settings-row">
      <div className="settings-row-info">
        <label htmlFor={id} className="settings-row-label">
          {title}
        </label>
        {description && <div className="settings-row-desc">{description}</div>}
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
  description?: string;
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
        {description && <div className="settings-row-desc">{description}</div>}
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

const QUICK_COLORS = ['#ffffff', '#000000', '#0f172a', '#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

function ColorPickerRow({
  id,
  title,
  description,
  value,
  onChange,
}: {
  id: string;
  title: string;
  description?: string;
  value?: string;
  onChange: (val: string | undefined) => void;
}): React.JSX.Element {
  const isDefault = !value;
  const pickerColor = value && value.startsWith('#') && (value.length === 7 || value.length === 4) ? value : '#000000';

  return (
    <div className="settings-row settings-row-top">
      <div className="settings-row-info">
        <label htmlFor={id} className="settings-row-label">
          {title}
        </label>
        {description && <div className="settings-row-desc">{description}</div>}
        <div className="settings-swatches">
          {QUICK_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              title={c}
              aria-label={`Chọn màu ${c}`}
              className="settings-swatch"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      <div className="settings-color-ctl">
        <label
          htmlFor={`${id}-color`}
          className={isDefault ? 'settings-color-well is-default' : 'settings-color-well'}
          style={{ backgroundColor: value || 'transparent' }}
          title="Bấm để chọn màu"
        >
          <input
            id={`${id}-color`}
            type="color"
            value={pickerColor}
            onChange={(e) => onChange(e.target.value)}
            className="settings-color-native"
          />
        </label>
        <input
          id={id}
          type="text"
          className="settings-input-field settings-input-color"
          placeholder="Mặc định"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value ? e.target.value : undefined)}
        />
        {!isDefault && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            title="Đặt lại màu mặc định"
            className="settings-icon-btn"
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

const FONT_PRESETS = [
  { label: 'Mặc định', value: '' },
  { label: 'Không chân / Inter', value: 'Inter, system-ui, sans-serif' },
  { label: 'Có chân / Merriweather', value: 'Georgia, Cambria, serif' },
  { label: 'Đơn cách / JetBrains', value: 'ui-monospace, Menlo, monospace' },
  { label: 'Roboto', value: 'Roboto, sans-serif' },
  { label: 'Playfair Display', value: 'Playfair Display, serif' },
];

function FontSelectRow({
  id,
  title,
  description,
  value,
  onChange,
}: {
  id: string;
  title: string;
  description?: string;
  value?: string;
  onChange: (val: string | undefined) => void;
}): React.JSX.Element {
  return (
    <div className="settings-row settings-row-top">
      <div className="settings-row-info">
        <label htmlFor={id} className="settings-row-label">
          {title}
        </label>
        {description && <div className="settings-row-desc">{description}</div>}
        <div className="settings-chips">
          {FONT_PRESETS.filter((f) => f.value).map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={() => onChange(f.value)}
              className={value === f.value ? 'settings-chip is-selected' : 'settings-chip'}
            >
              {f.label.split(' / ')[0]}
            </button>
          ))}
        </div>
      </div>
      <div className="settings-font-ctl">
        <input
          id={id}
          type="text"
          className="settings-input-field settings-input-font"
          placeholder="Mặc định theo giao diện"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value ? e.target.value : undefined)}
        />
      </div>
    </div>
  );
}

function SliderNumberRow({
  id,
  title,
  description,
  value,
  onChange,
}: {
  id: string;
  title: string;
  description?: string;
  value?: number;
  onChange: (val: number | undefined) => void;
}): React.JSX.Element {
  const currentVal = value ?? 100;

  return (
    <div className="settings-row">
      <div className="settings-row-info">
        <label htmlFor={id} className="settings-row-label">
          {title}
        </label>
        {description && <div className="settings-row-desc">{description}</div>}
      </div>
      <div className="settings-slider-ctl">
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={currentVal}
          onChange={(e) => onChange(Number(e.target.value))}
          className="settings-range"
        />
        <input
          id={id}
          type="number"
          min="0"
          max="100"
          className="settings-input-field settings-input-pct"
          value={value ?? ''}
          placeholder="100"
          onChange={(e) => {
            const val = e.target.value === '' ? undefined : Number(e.target.value);
            onChange(val);
          }}
        />
        <span className="settings-unit">%</span>
      </div>
    </div>
  );
}

function ImageInputRow({
  id,
  title,
  description,
  value,
  onChange,
}: {
  id: string;
  title: string;
  description?: string;
  value?: string;
  onChange: (val: string | undefined) => void;
}): React.JSX.Element {
  const hasImg = Boolean(value && value.trim());

  return (
    <div className="settings-row settings-row-top">
      <div className="settings-row-info">
        <label htmlFor={id} className="settings-row-label">
          {title}
        </label>
        {description && <div className="settings-row-desc">{description}</div>}
      </div>
      <div className="settings-image-ctl">
        <div className="settings-image-line">
          <input
            id={id}
            type="text"
            className="settings-input-field settings-input-url"
            placeholder="https://..."
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value ? e.target.value : undefined)}
          />
          {hasImg && (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              title="Xóa ảnh nền"
              className="settings-icon-btn is-bordered"
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
        {hasImg && (
          <div className="settings-image-preview" style={{ backgroundImage: `url(${value})` }} />
        )}
      </div>
    </div>
  );
}

function useModalOpen(open: boolean | undefined, onOpenChange: ((open: boolean) => void) | undefined): [boolean, (v: boolean) => void] {
  const [inner, setInner] = useState(false)
  const controlled = open !== undefined
  const isOpen = controlled ? Boolean(open) : inner
  const returnRef = useRef<Element | null>(null)
  useEffect(() => {
    if (isOpen) {
      returnRef.current = document.activeElement
      return
    }
    const el = returnRef.current as HTMLElement | null
    returnRef.current = null
    if (el && el.isConnected && typeof el.focus === 'function') el.focus()
  }, [isOpen])
  const setIsOpen = (v: boolean) => {
    if (!controlled) setInner(v)
    onOpenChange?.(v)
  }
  return [isOpen, setIsOpen]
}

export function SettingsModal(props: SettingsModalProps): React.JSX.Element {
  const {
    settings,
    onSettingChange,
    mode,
    onModeChange,
    autoFormatMd,
    fontFamily = 'sans',
    onAutoFormatChange,
    onFontFamilyChange,
    themePicker,
    autoFormat,
    alwaysOpenApp,
    onAlwaysOpenAppChange,
  } = props;

  const [isOpen, setIsOpen] = useModalOpen(props.open, props.onOpenChange);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [current, setCurrent] = useState<SectionId>('look');
  const [wide, setWide] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 900px)');
    if (!mq) return;
    setWide(Boolean(mq.matches));
    const on = () => setWide(Boolean(mq.matches));
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  useEffect(() => {
    if (isOpen) dialogRef.current?.querySelector<HTMLElement>('button, input')?.focus();
  }, [isOpen]);

  const lockRef = useRef(false);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unlock = () => {
    lockRef.current = false;
    if (lockTimer.current) clearTimeout(lockTimer.current);
    lockTimer.current = null;
  };
  useEffect(() => {
    const body = bodyRef.current;
    if (!isOpen || !body) return;
    body.addEventListener('scrollend', unlock);
    return () => body.removeEventListener('scrollend', unlock);
  }, [isOpen]);
  useEffect(() => () => { if (lockTimer.current) clearTimeout(lockTimer.current); }, []);

  const goTo = (id: SectionId) => {
    setCurrent(id);
    lockRef.current = true;
    if (lockTimer.current) clearTimeout(lockTimer.current);
    lockTimer.current = setTimeout(unlock, 600);
    sectionRefs.current[id]?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  };

  const handleScroll = () => {
    const body = bodyRef.current;
    if (!body || lockRef.current) return;
    if (body.scrollHeight > body.clientHeight && body.scrollTop + body.clientHeight >= body.scrollHeight - 2) {
      setCurrent(SECTIONS[SECTIONS.length - 1]!.id);
      return;
    }
    let found: SectionId = SECTIONS[0].id;
    for (const s of SECTIONS) {
      const el = sectionRefs.current[s.id];
      if (el && el.offsetTop - body.offsetTop <= body.scrollTop + 8) found = s.id;
    }
    setCurrent(found);
  };

  const handleTrap = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const items = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>('button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])') ?? [],
    ).filter((el) => !(el as HTMLInputElement).disabled);
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const currentMode = settings?.mode ?? mode;
  const currentContrast: Contrast = settings?.contrast ?? 'standard';
  const currentFontFamily = settings?.fontFamily ?? fontFamily;
  const currentAutoFormat =
    typeof settings?.autoFormatMd === 'boolean'
      ? settings.autoFormatMd
      : typeof autoFormatMd === 'boolean'
      ? autoFormatMd
      : Boolean(autoFormat);
  const currentAlwaysOpenApp =
    typeof settings?.alwaysOpenApp === 'boolean'
      ? settings.alwaysOpenApp
      : typeof alwaysOpenApp === 'boolean'
      ? alwaysOpenApp
      : false;

  const serverUrlRaw = settings?.serverUrl ?? '';
  const serverUrlInvalid = serverUrlRaw !== '' && normalizeServerUrl(serverUrlRaw) === null;

  const handleSettingChange = <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => {
    onSettingChange?.(key, value);
    if (key === 'mode' && onModeChange) {
      onModeChange(value as 'light' | 'dark' | 'system');
    }
    if (key === 'fontFamily' && onFontFamilyChange) {
      onFontFamilyChange(value as FontFamily);
    }
    if (key === 'autoFormatMd' && onAutoFormatChange) {
      onAutoFormatChange(Boolean(value));
    }
    if (key === 'alwaysOpenApp' && onAlwaysOpenAppChange) {
      onAlwaysOpenAppChange(Boolean(value));
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const modalContent = isOpen ? (
    <div
      className="settings-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsOpen(false);
      }}
    >
      <div
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        ref={dialogRef}
        onKeyDown={handleTrap}
      >
        <div className="settings-header">
          <h2 id="settings-title" className="settings-title">Cài đặt</h2>
          <button type="button" onClick={() => setIsOpen(false)} aria-label="Đóng" className="settings-close-btn">
            <Icon name="close" />
          </button>
        </div>
        <div className="settings-layout">
          {wide && (
            <nav className="settings-index" aria-label="Mục cài đặt">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="settings-index-item"
                  aria-current={current === s.id ? 'true' : undefined}
                  onClick={() => goTo(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </nav>
          )}
          <div className="settings-body" ref={bodyRef} onScroll={handleScroll}>
<section aria-labelledby="settings-h-look" id="settings-sec-look" data-section={"look"} className="settings-group" ref={(el) => { sectionRefs.current['look'] = el }}>
<h3 id="settings-h-look" className="settings-group-title">Chữ và màu</h3>
                  <div className="settings-field">
                    {themePicker ?? (
                      <PalettePicker
                        mode={currentMode ?? 'light'}
                        contrast={currentContrast}
                        onModeChange={(m) => handleSettingChange('mode', m)}
                        onContrastChange={(c) => handleSettingChange('contrast', c)}
                      />
                    )}
                  </div>
                  <div className="settings-field">
                    <span id="settings-l-font" className="settings-field-label">Phông chữ thân</span>
                    <div className="settings-btn-group" role="group" aria-labelledby="settings-l-font">
                      {([
                        { key: 'sans', label: 'Không chân (IBM Plex Sans)' },
                        { key: 'serif', label: 'Có chân (Literata)' },
                        { key: 'mono', label: 'Đơn cách (IBM Plex Mono)' },
                      ] as const).map((opt) => {
                        const isSelected = currentFontFamily === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => {
                              handleSettingChange('fontFamily', opt.key);
                            }}
                            aria-pressed={isSelected}
                            className="settings-choice"
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="settings-field">
                    <span id="settings-l-width" className="settings-field-label">Độ rộng trang</span>
                    <div className="settings-btn-group" role="radiogroup" aria-labelledby="settings-l-width">
                      {([
                        { key: 'narrow', label: 'Hẹp' },
                        { key: 'medium', label: 'Vừa' },
                        { key: 'wide', label: 'Rộng' },
                        { key: 'full', label: 'Toàn khung' },
                      ] as const).map((opt) => {
                        const isSelected = (settings?.pageWidth ?? 'medium') === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            onClick={() => handleSettingChange('pageWidth', opt.key)}
                            className="settings-choice"
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
</section>
<section aria-labelledby="settings-h-content" id="settings-sec-content" data-section={"content"} className="settings-group" ref={(el) => { sectionRefs.current['content'] = el }}>
<h3 id="settings-h-content" className="settings-group-title">Nội dung trong tài liệu</h3>
                  <ToggleRow
                    id="settings-stripFrontmatter"
                    title="Ẩn phần thông tin đầu file (frontmatter)"
                    checked={settings?.stripFrontmatter}
                    onChange={(val) => handleSettingChange('stripFrontmatter', val)}
                  />
                  <ToggleRow
                    id="settings-displayMetadata"
                    title="Hiện thông tin đầu file thành thẻ"
                    checked={settings?.displayMetadata}
                    onChange={(val) => handleSettingChange('displayMetadata', val)}
                  />                  <ToggleRow
                    id="settings-enableMath"
                    title="Hiển thị công thức toán"
                    checked={settings?.enableMath}
                    onChange={(val) => handleSettingChange('enableMath', val)}
                  />
                  <ToggleRow
                    id="settings-enableMermaid"
                    title="Vẽ sơ đồ Mermaid"
                    description="Tắt nếu tài liệu có nhiều sơ đồ và mở chậm."
                    checked={settings?.enableMermaid}
                    onChange={(val) => handleSettingChange('enableMermaid', val)}
                  />
                  <ToggleRow
                    id="settings-githubAlerts"
                    title="Hộp ghi chú kiểu GitHub ([!NOTE], [!WARNING]…)"
                    checked={settings?.githubAlerts}
                    onChange={(val) => handleSettingChange('githubAlerts', val)}
                  />
                  <ToggleRow
                    id="settings-localizeAlerts"
                    title="Tiêu đề ghi chú bằng tiếng Việt"
                    checked={settings?.localizeAlerts}
                    onChange={(val) => handleSettingChange('localizeAlerts', val)}
                  />                  <ToggleRow
                    id="settings-typographer"
                    title="Dấu câu đẹp (ngoặc kép cong, gạch dài)"
                    description="Không đổi nội dung file, chỉ đổi cách hiển thị."
                    checked={settings?.typographer}
                    onChange={(val) => handleSettingChange('typographer', val)}
                  />
                  <ToggleRow
                    id="settings-externalLinks"
                    title="Đánh dấu và mở liên kết ngoài ở thẻ mới"
                    checked={settings?.externalLinks}
                    onChange={(val) => handleSettingChange('externalLinks', val)}
                  />
</section>
<section aria-labelledby="settings-h-open" id="settings-sec-open" data-section={"open"} className="settings-group" ref={(el) => { sectionRefs.current['open'] = el }}>
<h3 id="settings-h-open" className="settings-group-title">Khi mở file .md</h3>
                  <ToggleRow
                    id="settings-autoFormatMd"
                    title="Tự động hiển thị file .md đẹp"
                    description="Tắt thì trang .md giữ nguyên dạng văn bản thô, không được thay bằng trình đọc."
                    checked={currentAutoFormat}
                    onChange={(val) => handleSettingChange('autoFormatMd', val)}
                  />

                  <ToggleRow
                    id="settings-formatOnSave"
                    title="Chỉnh lại Markdown khi bấm Lưu"
                    description="Khi bạn bấm Lưu, nội dung file được chuẩn hóa (khoảng trắng, danh sách…); không chạy lúc đang gõ."
                    checked={settings?.formatOnSave ?? currentAutoFormat}
                    onChange={(val) => handleSettingChange('formatOnSave', val)}
                  />

                  <ToggleRow
                    id="settings-alwaysOpenApp"
                    title="Luôn mở file .md trong MD Reader"
                    description="Bấm vào link .md sẽ mở thẳng tab đọc thay vì xem trên trang."
                    checked={currentAlwaysOpenApp}
                    onChange={(val) => handleSettingChange('alwaysOpenApp', val)}
                  />
</section>
<section aria-labelledby="settings-h-aids" id="settings-sec-aids" data-section={"aids"} className="settings-group" ref={(el) => { sectionRefs.current['aids'] = el }}>
<h3 id="settings-h-aids" className="settings-group-title">Hỗ trợ đọc</h3>
                  <ToggleRow
                    id="settings-showWordCount"
                    title="Hiện số từ và thời gian đọc"
                    checked={settings?.showWordCount}
                    onChange={(val) => handleSettingChange('showWordCount', val)}
                  />
                  <ToggleRow
                    id="settings-autoHideWordCount"
                    title="Tự ẩn khi đọc tới cuối"
                    checked={settings?.autoHideWordCount}
                    onChange={(val) => handleSettingChange('autoHideWordCount', val)}
                  />
                  <ToggleRow
                    id="settings-showReadingProgress"
                    title="Thanh tiến độ đọc"
                    checked={settings?.showReadingProgress}
                    onChange={(val) => handleSettingChange('showReadingProgress', val)}
                  />
                  <ToggleRow
                    id="settings-celebrationConfetti"
                    title="Pháo giấy khi đọc xong"
                    checked={settings?.celebrationConfetti}
                    onChange={(val) => handleSettingChange('celebrationConfetti', val)}
                  />
</section>
<section aria-labelledby="settings-h-slides" id="settings-sec-slides" data-section={"slides"} className="settings-group" ref={(el) => { sectionRefs.current['slides'] = el }}>
<h3 id="settings-h-slides" className="settings-group-title">Trình chiếu</h3>
                  <ColorPickerRow
                    id="settings-slideBgColor"
                    title="Nền trang chiếu"
                    value={settings?.slideBgColor}
                    onChange={(val) => handleSettingChange('slideBgColor', val)}
                  />
                  <ColorPickerRow
                    id="settings-slideTextColor"
                    title="Chữ"
                    value={settings?.slideTextColor}
                    onChange={(val) => handleSettingChange('slideTextColor', val)}
                  />
                  <ColorPickerRow
                    id="settings-slideHeadingColor"
                    title="Tiêu đề"
                    value={settings?.slideHeadingColor}
                    onChange={(val) => handleSettingChange('slideHeadingColor', val)}
                  />
                  <ColorPickerRow
                    id="settings-slideAccentColor"
                    title="Màu nhấn"
                    value={settings?.slideAccentColor}
                    onChange={(val) => handleSettingChange('slideAccentColor', val)}
                  />
                  <FontSelectRow
                    id="settings-slideFont"
                    title="Phông chữ trang chiếu"
                    value={settings?.slideFont}
                    onChange={(val) => handleSettingChange('slideFont', val)}
                  />
                  <ImageInputRow
                    id="settings-slideBgImage"
                    title="Ảnh nền (URL)"
                    value={settings?.slideBgImage}
                    onChange={(val) => handleSettingChange('slideBgImage', val)}
                  />
                  <SliderNumberRow
                    id="settings-slideImageOpacity"
                    title="Độ mờ ảnh nền"
                    value={settings?.slideImageOpacity}
                    onChange={(val) => handleSettingChange('slideImageOpacity', val)}
                  />
</section>
<section aria-labelledby="settings-h-collab" id="settings-sec-collab" data-section={"collab"} className="settings-group" ref={(el) => { sectionRefs.current['collab'] = el }}>
<h3 id="settings-h-collab" className="settings-group-title">Cộng tác</h3>
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <label htmlFor="settings-displayName" className="settings-row-label">Tên hiển thị</label>
                      <div id="settings-displayName-desc" className="settings-row-desc">Hiện cho người cùng xem và trong lịch sử sửa.</div>
                    </div>
                    <input
                      id="settings-displayName"
                      type="text"
                      className="settings-input-field"
                      maxLength={40}
                      placeholder="Bạn"
                      aria-describedby="settings-displayName-desc"
                      value={settings?.displayName ?? ''}
                      onChange={(e) => handleSettingChange('displayName', e.target.value)}
                    />
                  </div>
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <label htmlFor="settings-serverUrl" className="settings-row-label">Máy chủ đồng bộ</label>
                      <div id="settings-serverUrl-desc" className="settings-row-desc">Tài liệu đã chia sẻ vẫn dùng máy chủ lúc bật chia sẻ.</div>
                      {serverUrlInvalid && (
                        <div role="alert" className="settings-row-desc">Địa chỉ phải bắt đầu bằng https:// (http:// chỉ cho localhost)</div>
                      )}
                    </div>
                    <input
                      id="settings-serverUrl"
                      type="text"
                      className="settings-input-field"
                      placeholder={props.defaultServerUrl}
                      aria-invalid={serverUrlInvalid ? 'true' : undefined}
                      aria-describedby="settings-serverUrl-desc"
                      value={settings?.serverUrl ?? ''}
                      onChange={(e) => handleSettingChange('serverUrl', e.target.value)}
                    />
                  </div>
</section>
          </div>
        </div>
      </div>
    </div>
  ) : null;


  return (
    <>
      {props.open === undefined && <button
        type="button"
        onClick={() => setIsOpen(true)}
        title="Cài đặt"
        aria-label="Cài đặt"
        className="settings-trigger"
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
      </button>}
      {isOpen && (typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent)}
    </>
  );
}
