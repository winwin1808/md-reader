import React from 'react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SettingsModal } from './SettingsModal';


const section = (name: string) => screen.getByRole('region', { name });

describe('SettingsModal', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const defaultProps = {
    mode: 'light' as const,
    colorTheme: 'navy' as const,
    autoFormatMd: false,
    fontFamily: 'sans' as const,
    onModeChange: vi.fn(),
    onColorThemeChange: vi.fn(),
    onAutoFormatChange: vi.fn(),
    onFontFamilyChange: vi.fn(),
  };

  it('opens modal, renders elements, and interacts', () => {
    const onAutoFormatChange = vi.fn();
    render(
      <SettingsModal 
        {...defaultProps}
        autoFormatMd={false}
        onAutoFormatChange={onAutoFormatChange} 
      />
    );

    const gearButton = screen.getByRole('button', { name: /settings/i });
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(gearButton);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    
    const checkbox = screen.getByLabelText(/Định dạng lại Markdown khi lưu/i);
    expect(checkbox).not.toBeChecked();
    
    fireEvent.click(checkbox);
    expect(onAutoFormatChange).toHaveBeenCalledWith(true);
  });

  it('renders font family options and triggers onFontFamilyChange', () => {
    const onFontFamilyChange = vi.fn();
    render(
      <SettingsModal
        {...defaultProps}
        fontFamily="sans"
        onFontFamilyChange={onFontFamilyChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));

    expect(screen.getByText('Phông chữ thân')).toBeInTheDocument();
    const look = within(section('Chữ và màu'));
    const sansBtn = look.getByRole('button', { name: 'Không chân (IBM Plex Sans)' });
    const serifBtn = look.getByRole('button', { name: 'Có chân (Literata)' });
    const monoBtn = look.getByRole('button', { name: 'Đơn cách (IBM Plex Mono)' });

    expect(sansBtn).toBeInTheDocument();
    expect(serifBtn).toBeInTheDocument();
    expect(monoBtn).toBeInTheDocument();

    fireEvent.click(serifBtn);
    expect(onFontFamilyChange).toHaveBeenCalledWith('serif');

    fireEvent.click(monoBtn);
    expect(onFontFamilyChange).toHaveBeenCalledWith('mono');

    fireEvent.click(sansBtn);
    expect(onFontFamilyChange).toHaveBeenCalledWith('sans');
  });

  it('is a labelled modal dialog with one Đóng button and Esc closes', () => {
    const onOpenChange = vi.fn();
    render(<SettingsModal {...defaultProps} open onOpenChange={onOpenChange} />);
    const dialog = screen.getByRole('dialog', { name: 'Cài đặt' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getAllByRole('button', { name: 'Đóng' })).toHaveLength(1);
    expect(dialog.textContent).not.toContain('\u2715');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('close button closes the dialog', () => {
    render(<SettingsModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('traps Tab inside the dialog', () => {
    render(<SettingsModal {...defaultProps} open />);
    const dialog = screen.getByRole('dialog');
    const items = Array.from(dialog.querySelectorAll<HTMLElement>('button, input'));
    const last = items[items.length - 1]!;
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(items[0]!, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('renders the five section headings in order', () => {
    render(<SettingsModal {...defaultProps} open />);
    const hs = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(hs).toEqual(['Chữ và màu', 'Nội dung trong tài liệu', 'Khi mở file .md', 'Hỗ trợ đọc', 'Trình chiếu']);
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('every listed key has a control in its section and fires the same onChange', () => {
    const onSettingChange = vi.fn();
    render(
      <SettingsModal
        {...defaultProps}
        open
        settings={{ contrast: 'standard', settingsVersion: 2 }}
        onSettingChange={onSettingChange}
      />,
    );
    const toggles: Array<[string, string, string]> = [
      ['Nội dung trong tài liệu', 'stripFrontmatter', 'settings-stripFrontmatter'],
      ['Nội dung trong tài liệu', 'displayMetadata', 'settings-displayMetadata'],
      ['Nội dung trong tài liệu', 'enableMath', 'settings-enableMath'],
      ['Nội dung trong tài liệu', 'enableMermaid', 'settings-enableMermaid'],
      ['Nội dung trong tài liệu', 'githubAlerts', 'settings-githubAlerts'],
      ['Nội dung trong tài liệu', 'localizeAlerts', 'settings-localizeAlerts'],
      ['Nội dung trong tài liệu', 'typographer', 'settings-typographer'],
      ['Nội dung trong tài liệu', 'externalLinks', 'settings-externalLinks'],
      ['Khi mở file .md', 'alwaysOpenApp', 'settings-alwaysOpenApp'],
      ['Khi mở file .md', 'autoFormatMd', 'settings-autoFormatMd'],
      ['Khi mở file .md', 'formatOnSave', 'settings-formatOnSave'],
      ['Hỗ trợ đọc', 'showWordCount', 'settings-showWordCount'],
      ['Hỗ trợ đọc', 'autoHideWordCount', 'settings-autoHideWordCount'],
      ['Hỗ trợ đọc', 'showReadingProgress', 'settings-showReadingProgress'],
      ['Hỗ trợ đọc', 'celebrationConfetti', 'settings-celebrationConfetti'],
    ];
    for (const [sec, key, id] of toggles) {
      const el = section(sec).querySelector<HTMLInputElement>(`#${id}`);
      expect(el, key).not.toBeNull();
      fireEvent.click(el!);
      expect(onSettingChange).toHaveBeenCalledWith(key, true);
    }
    const slides = section('Trình chiếu');
    for (const key of ['slideBgColor', 'slideTextColor', 'slideHeadingColor', 'slideAccentColor', 'slideFont', 'slideBgImage']) {
      const el = slides.querySelector<HTMLInputElement>(`#settings-${key}`);
      expect(el, key).not.toBeNull();
      fireEvent.change(el!, { target: { value: 'x' } });
      expect(onSettingChange).toHaveBeenCalledWith(key, 'x');
    }
    fireEvent.change(slides.querySelector<HTMLInputElement>('#settings-slideImageOpacity')!, { target: { value: '40' } });
    expect(onSettingChange).toHaveBeenCalledWith('slideImageOpacity', 40);

    const look = section('Chữ và màu');
    fireEvent.click(within(look).getByRole('button', { name: 'Tối' }));
    expect(onSettingChange).toHaveBeenCalledWith('mode', 'dark');
    fireEvent.click(within(look).getByRole('button', { name: 'Có chân (Literata)' }));
    expect(onSettingChange).toHaveBeenCalledWith('fontFamily', 'serif');
  });

  it('shows an index at >= 900px that scrolls the section into view', () => {
    window.matchMedia = ((q: string) => ({
      matches: q.includes('900'),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    const spy = vi.fn();
    Element.prototype.scrollIntoView = spy;
    render(<SettingsModal {...defaultProps} open />);
    const nav = screen.getByRole('navigation', { name: 'Mục cài đặt' });
    const buttons = within(nav).getAllByRole('button');
    expect(buttons).toHaveLength(5);
    expect(buttons[0]).toHaveAttribute('aria-current', 'true');
    fireEvent.click(buttons[3]!);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ block: 'start' }));
    expect(spy.mock.instances[0]).toBe(section('Hỗ trợ đọc'));
    expect(buttons[3]).toHaveAttribute('aria-current', 'true');
    // @ts-expect-error cleanup
    delete window.matchMedia;
  });

  it('uses Vietnamese labels with descriptions and no English title-case text', () => {
    render(<SettingsModal {...defaultProps} open settings={{ contrast: 'standard', settingsVersion: 2 }} />);
    const labels = [
      'Ẩn phần thông tin đầu file (frontmatter)', 'Hiện thông tin đầu file thành thẻ', 'Hiển thị công thức toán',
      'Vẽ sơ đồ Mermaid', 'Hộp ghi chú kiểu GitHub ([!NOTE], [!WARNING]…)', 'Tiêu đề ghi chú bằng tiếng Việt',
      'Dấu câu đẹp (ngoặc kép cong, gạch dài)', 'Đánh dấu và mở liên kết ngoài ở thẻ mới',
      'Luôn mở file .md trong MD Reader', 'Định dạng lại Markdown khi lưu', 'Định dạng Markdown khi bấm Lưu',
      'Hiện số từ và thời gian đọc', 'Tự ẩn khi đọc tới cuối', 'Thanh tiến độ đọc', 'Pháo giấy khi đọc xong',
      'Nền trang chiếu', 'Chữ', 'Tiêu đề', 'Màu nhấn', 'Phông chữ trang chiếu', 'Ảnh nền (URL)', 'Độ mờ ảnh nền',
    ];
    for (const l of labels) expect(screen.getByLabelText(l), l).toBeInTheDocument();
    for (const n of ['Sáng', 'Tối', 'Theo hệ thống', 'Có chân (Literata)', 'Không chân (IBM Plex Sans)', 'Đơn cách (IBM Plex Mono)']) {
      expect(screen.getByRole('button', { name: n }), n).toBeInTheDocument();
    }
    for (const d of ['Bấm vào link .md sẽ mở thẳng tab đọc thay vì xem trên trang.', 'Chỉ khi bạn bấm Lưu, không trong lúc gõ.',
      'Không đổi nội dung file, chỉ đổi cách hiển thị.', 'Tắt nếu tài liệu có nhiều sơ đồ và mở chậm.']) {
      expect(screen.getByText(d)).toBeInTheDocument();
    }
    const text = (screen.getByRole('dialog').textContent ?? '').replace(/IBM Plex (Sans|Mono)|MD Reader|Playfair Display/g, '');
    expect(text.match(/[A-Z][a-z]+ [A-Z][a-z]+/g)).toBeNull();
  });

  it('settings.css has no outline: none and no rgba( literal', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/theme/settings.css'), 'utf8');
    expect(css).not.toMatch(/outline:\s*none/);
    expect(css).not.toContain('rgba(');
  });

  it('triggers onSettingChange when toggling switches or typing in fields', () => {
    const onSettingChange = vi.fn();
    render(
      <SettingsModal
        {...defaultProps}
        settings={{
          contrast: 'standard',
          settingsVersion: 2,
          stripFrontmatter: false,
          enableMath: false,
          formatOnSave: false,
          enableMermaid: false,
          slideFont: 'Georgia',
        }}
        onSettingChange={onSettingChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));

    // Removed dead rows
    expect(screen.queryByLabelText(/advanced tables/i)).toBeNull();
    expect(screen.queryByLabelText(/task lists/i)).toBeNull();

    // Display tab: format on save
    const fmt = screen.getByLabelText(/Định dạng Markdown khi bấm Lưu/i);
    expect(fmt).not.toBeChecked();
    fireEvent.click(fmt);
    expect(onSettingChange).toHaveBeenCalledWith('formatOnSave', true);

    // Media tab toggle
    const mathCheckbox = screen.getByLabelText(/công thức toán/i);
    fireEvent.click(mathCheckbox);
    expect(onSettingChange).toHaveBeenCalledWith('enableMath', true);
    expect(screen.queryByLabelText(/plantuml/i)).toBeNull();
    expect(screen.queryByLabelText(/graphviz/i)).toBeNull();
    const mermaidCheckbox = screen.getByLabelText(/sơ đồ Mermaid/i);
    expect(mermaidCheckbox).not.toBeChecked();
    fireEvent.click(mermaidCheckbox);
    expect(onSettingChange).toHaveBeenCalledWith('enableMermaid', true);

    // Presentation tab input
    const fontInput = screen.getByLabelText(/Phông chữ trang chiếu/i);
    expect(fontInput).toHaveValue('Georgia');
    fireEvent.change(fontInput, { target: { value: 'Inter' } });
    expect(onSettingChange).toHaveBeenCalledWith('slideFont', 'Inter');
  });

  it('calls both legacy handlers and onSettingChange when changing display settings', () => {
    const onSettingChange = vi.fn();
    const onModeChange = vi.fn();
    const onFontFamilyChange = vi.fn();
    const onAutoFormatChange = vi.fn();

    render(
      <SettingsModal
        mode="light"
        fontFamily="sans"
        autoFormatMd={false}
        onModeChange={onModeChange}
        onFontFamilyChange={onFontFamilyChange}
        onAutoFormatChange={onAutoFormatChange}
        onSettingChange={onSettingChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));

    // Mode
    fireEvent.click(screen.getByRole('button', { name: 'Tối' }));
    expect(onModeChange).toHaveBeenCalledTimes(1);
    expect(onModeChange).toHaveBeenCalledWith('dark');
    expect(onSettingChange).toHaveBeenCalledWith('mode', 'dark');

    // Font
    fireEvent.click(within(section('Chữ và màu')).getByRole('button', { name: 'Có chân (Literata)' }));
    expect(onFontFamilyChange).toHaveBeenCalledTimes(1);
    expect(onFontFamilyChange).toHaveBeenCalledWith('serif');
    expect(onSettingChange).toHaveBeenCalledWith('fontFamily', 'serif');

    // Auto format
    const checkbox = screen.getByLabelText(/Định dạng lại Markdown khi lưu/i);
    fireEvent.click(checkbox);
    expect(onAutoFormatChange).toHaveBeenCalledTimes(1);
    expect(onAutoFormatChange).toHaveBeenCalledWith(true);
    expect(onSettingChange).toHaveBeenCalledWith('autoFormatMd', true);
  });

  it('supports visual color picking, font presets, opacity slider, and image url clear in presentation tab', () => {
    const onSettingChange = vi.fn();
    render(
      <SettingsModal
        {...defaultProps}
        settings={{
          contrast: 'standard',
          settingsVersion: 2,
          slideBgColor: '#000000',
          slideImageOpacity: 80,
          slideBgImage: 'https://example.com/bg.png',
        }}
        onSettingChange={onSettingChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));

    // Color quick preset
    const blueBtn = screen.getAllByTitle('#2563eb')[0]!;
    fireEvent.click(blueBtn);
    expect(onSettingChange).toHaveBeenCalledWith('slideBgColor', '#2563eb');

    // Font preset button
    const monoFontBtn = within(section('Trình chiếu')).getByRole('button', { name: 'Đơn cách' });
    fireEvent.click(monoFontBtn);
    expect(onSettingChange).toHaveBeenCalledWith('slideFont', expect.stringContaining('monospace'));

    // Image opacity number change
    const opacityInput = screen.getByLabelText(/Độ mờ ảnh nền/i);
    fireEvent.change(opacityInput, { target: { value: '50' } });
    expect(onSettingChange).toHaveBeenCalledWith('slideImageOpacity', 50);

    // Image URL clear button
    const clearImgBtn = screen.getByTitle('Xóa ảnh nền');
    fireEvent.click(clearImgBtn);
    expect(onSettingChange).toHaveBeenCalledWith('slideBgImage', undefined);
  });

  it('toggles alwaysOpenApp setting and triggers callbacks', () => {
    const onSettingChange = vi.fn();
    const onAlwaysOpenAppChange = vi.fn();
    render(
      <SettingsModal
        {...defaultProps}
        alwaysOpenApp={false}
        onSettingChange={onSettingChange}
        onAlwaysOpenAppChange={onAlwaysOpenAppChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    const checkbox = screen.getByLabelText(/Luôn mở file .md/i);
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(onSettingChange).toHaveBeenCalledWith('alwaysOpenApp', true);
    expect(onAlwaysOpenAppChange).toHaveBeenCalledWith(true);
  });

  it('defaults alwaysOpenApp to false when not provided', () => {
    render(<SettingsModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    const checkbox = screen.getByLabelText(/Luôn mở file .md/i);
    expect(checkbox).not.toBeChecked();
  });
});
