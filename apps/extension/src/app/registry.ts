export async function getRecentFiles(): Promise<any[]> {
  try {
    const result = await chrome.storage.local.get('recentFiles') as { recentFiles?: any[] };
    return result.recentFiles || [];
  } catch (error) {
    console.error('Failed to get recent files', error);
    return [];
  }
}

export async function addRecentFile(file: { id: string, name: string, lastOpened: number }): Promise<void> {
  try {
    const recentFiles = await getRecentFiles();
    const filteredFiles = recentFiles.filter(f => f.id !== file.id);
    filteredFiles.unshift(file);
    const updatedFiles = filteredFiles.slice(0, 10);
    await chrome.storage.local.set({ recentFiles: updatedFiles });
  } catch (error) {
    console.error('Failed to add recent file', error);
  }
}
