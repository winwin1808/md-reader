import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsModal } from './SettingsModal';
import { describe, it, expect, vi } from 'vitest';

describe('SettingsModal', () => {
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
});
