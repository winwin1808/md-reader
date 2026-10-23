import React from 'react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SettingsModal } from './SettingsModal';


describe('SettingsModal', () => {
  afterEach(() => {
    cleanup();
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
    
    const checkbox = screen.getByLabelText(/auto-format/i);
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

    expect(screen.getByText('Kiểu phông chữ')).toBeInTheDocument();
    const sansBtn = screen.getByRole('button', { name: 'Sans-serif' });
    const serifBtn = screen.getByRole('button', { name: 'Serif' });
    const monoBtn = screen.getByRole('button', { name: 'Monospace' });

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

  it('uses proper CSS variables for background and text colors', () => {
    render(
      <SettingsModal 
        {...defaultProps}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    
    // The dialog content is the first child of the dialog overlay
    const dialog = screen.getByRole('dialog');
    const content = dialog.firstChild as HTMLElement;
    
    expect(content).toHaveStyle({
      background: 'var(--md-bg)',
      color: 'var(--md-fg)',
    });

    const closeBtn = screen.getByRole('button', { name: /close/i });
    expect(closeBtn).toHaveStyle({
      color: 'var(--md-fg)',
    });

    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('applies polished styling to trigger button, backdrop, and modal container', () => {
    render(
      <SettingsModal 
        {...defaultProps}
      />
    );

    const gearButton = screen.getByRole('button', { name: /settings/i });
    expect(gearButton.style.borderRadius).toBe('10px');
    expect(gearButton.style.boxShadow).toBe('0 4px 12px rgba(0,0,0,0.08)');
    expect(gearButton.style.backdropFilter).toBe('blur(8px)');
    expect(gearButton.style.cursor).toBe('pointer');

    fireEvent.click(gearButton);

    const dialog = screen.getByRole('dialog');
    expect(dialog.style.backgroundColor).toBe('rgba(0, 0, 0, 0.45)');
    expect(dialog.style.backdropFilter).toBe('blur(8px)');

    const modalContainer = dialog.firstChild as HTMLElement;
    expect(modalContainer.style.borderRadius).toBe('16px');
    expect(modalContainer.style.border).toBe('1px solid var(--md-border)');
    expect(modalContainer.style.boxShadow).toBe('0 24px 48px -12px rgba(0,0,0,0.25)');
    expect(modalContainer.style.padding).toBe('24px 28px');
    expect(modalContainer.style.minWidth).toBe('340px');
  });

  it('supports 5-tab navigation and displays respective sections', () => {
    render(<SettingsModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));

    // 5 tabs should be visible
    const displayTab = screen.getByRole('tab', { name: /giao diện/i });
    const coreTab = screen.getByRole('tab', { name: /core rendering/i });
    const mediaTab = screen.getByRole('tab', { name: /nội dung & sơ đồ/i });
    const readingTab = screen.getByRole('tab', { name: /hỗ trợ đọc/i });
    const presentationTab = screen.getByRole('tab', { name: /trình chiếu/i });

    expect(displayTab).toBeInTheDocument();
    expect(coreTab).toBeInTheDocument();
    expect(mediaTab).toBeInTheDocument();
    expect(readingTab).toBeInTheDocument();
    expect(presentationTab).toBeInTheDocument();

    // Default tab is display
    expect(screen.getByText('Chế độ hiển thị')).toBeInTheDocument();

    // Switch to Core tab
    fireEvent.click(coreTab);
    expect(screen.getByText('Front Matter')).toBeInTheDocument();
    expect(screen.getByText('Strip YAML front matter (---) blocks instead of rendering them as text')).toBeInTheDocument();
    expect(screen.getByText('Display Metadata')).toBeInTheDocument();
    expect(screen.queryByText("Advanced Tables")).toBeNull();
    expect(screen.queryByText("Task Lists")).toBeNull();

    // Switch to Media tab
    fireEvent.click(mediaTab);
    expect(screen.getByText('Math Equations')).toBeInTheDocument();
    expect(screen.getByText('Render LaTeX math equations ($...$ inline, $$...$$ display)')).toBeInTheDocument();
    expect(screen.getByText('Mermaid Diagrams')).toBeInTheDocument();
    expect(screen.queryByText("PlantUML Diagrams")).toBeNull();
    expect(screen.queryByText("Graphviz Diagrams")).toBeNull();
    expect(screen.getByText('GitHub Alerts')).toBeInTheDocument();
    expect(screen.getByText('Localize Alert Titles')).toBeInTheDocument();

    // Switch to Reading tab
    fireEvent.click(readingTab);
    expect(screen.getByText('Typographer')).toBeInTheDocument();
    expect(screen.getByText('External Link Indicators')).toBeInTheDocument();
    expect(screen.getByText('Show word count')).toBeInTheDocument();
    expect(screen.getByText('Auto-hide word count')).toBeInTheDocument();
    expect(screen.getByText('Show reading progress')).toBeInTheDocument();
    expect(screen.getByText('Celebration animation')).toBeInTheDocument();

    // Switch to Presentation tab
    fireEvent.click(presentationTab);
    expect(screen.getByText('Background Color')).toBeInTheDocument();
    expect(screen.getByText('Text Color')).toBeInTheDocument();
    expect(screen.getByText('Heading Color')).toBeInTheDocument();
    expect(screen.getByText('Accent Color')).toBeInTheDocument();
    expect(screen.getByText('Slide Font')).toBeInTheDocument();
    expect(screen.getByText('Background Image URL')).toBeInTheDocument();
    expect(screen.getByText('Image Opacity')).toBeInTheDocument();
  });

  it('triggers onSettingChange when toggling switches or typing in fields', () => {
    const onSettingChange = vi.fn();
    render(
      <SettingsModal
        {...defaultProps}
        settings={{
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
    fireEvent.click(screen.getByRole('tab', { name: /core rendering/i }));
    expect(screen.queryByLabelText(/advanced tables/i)).toBeNull();
    expect(screen.queryByLabelText(/task lists/i)).toBeNull();

    // Display tab: format on save
    fireEvent.click(screen.getByRole('tab', { name: /giao diện/i }));
    const fmt = screen.getByLabelText(/Định dạng Markdown khi lưu/i);
    expect(fmt).not.toBeChecked();
    fireEvent.click(fmt);
    expect(onSettingChange).toHaveBeenCalledWith('formatOnSave', true);

    // Media tab toggle
    fireEvent.click(screen.getByRole('tab', { name: /nội dung & sơ đồ/i }));
    const mathCheckbox = screen.getByLabelText(/math equations/i);
    fireEvent.click(mathCheckbox);
    expect(onSettingChange).toHaveBeenCalledWith('enableMath', true);
    expect(screen.queryByLabelText(/plantuml/i)).toBeNull();
    expect(screen.queryByLabelText(/graphviz/i)).toBeNull();
    const mermaidCheckbox = screen.getByLabelText(/mermaid diagrams/i);
    expect(mermaidCheckbox).not.toBeChecked();
    fireEvent.click(mermaidCheckbox);
    expect(onSettingChange).toHaveBeenCalledWith('enableMermaid', true);

    // Presentation tab input
    fireEvent.click(screen.getByRole('tab', { name: /trình chiếu/i }));
    const fontInput = screen.getByLabelText(/slide font/i);
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
    fireEvent.click(screen.getByRole('button', { name: 'Serif' }));
    expect(onFontFamilyChange).toHaveBeenCalledTimes(1);
    expect(onFontFamilyChange).toHaveBeenCalledWith('serif');
    expect(onSettingChange).toHaveBeenCalledWith('fontFamily', 'serif');

    // Auto format
    const checkbox = screen.getByLabelText(/auto-format/i);
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
          slideBgColor: '#000000',
          slideImageOpacity: 80,
          slideBgImage: 'https://example.com/bg.png',
        }}
        onSettingChange={onSettingChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    fireEvent.click(screen.getByRole('tab', { name: /trình chiếu/i }));

    // Color quick preset
    const blueBtn = screen.getAllByTitle('#2563eb')[0]!;
    fireEvent.click(blueBtn);
    expect(onSettingChange).toHaveBeenCalledWith('slideBgColor', '#2563eb');

    // Font preset button
    const monoFontBtn = screen.getByRole('button', { name: 'Monospace' });
    fireEvent.click(monoFontBtn);
    expect(onSettingChange).toHaveBeenCalledWith('slideFont', expect.stringContaining('monospace'));

    // Image opacity number change
    const opacityInput = screen.getByLabelText(/image opacity/i);
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
    const checkbox = screen.getByLabelText(/always open app/i);
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(onSettingChange).toHaveBeenCalledWith('alwaysOpenApp', true);
    expect(onAlwaysOpenAppChange).toHaveBeenCalledWith(true);
  });

  it('defaults alwaysOpenApp to false when not provided', () => {
    render(<SettingsModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    const checkbox = screen.getByLabelText(/always open app/i);
    expect(checkbox).not.toBeChecked();
  });
});
