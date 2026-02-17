let impl = null;

export function setToastImpl(api) {
  impl = api;
}

export function getToastImpl() {
  return impl;
}
