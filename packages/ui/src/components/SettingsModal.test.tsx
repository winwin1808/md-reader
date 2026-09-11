import React from 'react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SettingsModal } from './SettingsModal';

describe('SettingsModal', () => {
  afterEach(() => {
    cleanup();
  });

  it('opens modal, renders elements, and interacts', () => {
    const onAutoFormatChange = vi.fn();
    render(
      <SettingsModal 
        themePicker={<div data-testid="theme-picker" />} 
        autoFormat={false} 
        onAutoFormatChange={onAutoFormatChange} 
      />
    );

    const gearButton = screen.getByRole('button', { name: /settings/i });
    expect(screen.queryByTestId('theme-picker')).toBeNull();

    fireEvent.click(gearButton);

    expect(screen.getByTestId('theme-picker')).toBeInTheDocument();
    
    const checkbox = screen.getByLabelText(/auto-format/i);
    expect(checkbox).not.toBeChecked();
    
    fireEvent.click(checkbox);
    expect(onAutoFormatChange).toHaveBeenCalledWith(true);
  });

  it('uses proper CSS variables for background and text colors', () => {
    render(
      <SettingsModal 
        themePicker={<div data-testid="theme-picker" />} 
        autoFormat={false} 
        onAutoFormatChange={() => {}} 
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
});
