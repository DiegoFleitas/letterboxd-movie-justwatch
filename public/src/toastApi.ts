export interface ToastApi {
  success?(msg: string): void;
  error?(msg: string): void;
  loading?(msg: string): string | number;
  dismissLoading?(id: string | number): void;
  messageWithLink?(data: { text: string; url?: string; title?: string }): void;
}

let impl: ToastApi | null = null;

export function setToastImpl(api: ToastApi | null): void {
  impl = api;
}

export function getToastImpl(): ToastApi | null {
  return impl;
}
