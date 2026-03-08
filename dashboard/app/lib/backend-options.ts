export const BACKEND_DEFAULT = '_default';

export const BACKEND_OPTIONS = [
  { value: BACKEND_DEFAULT, label: 'Default (platform)' },
  { value: 'claude', label: 'Claude' },
  { value: 'codex', label: 'Codex' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'pi', label: 'Pi' },
] as const;
