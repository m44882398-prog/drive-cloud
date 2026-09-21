"use client";

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      richColors
      position="top-right"
      expand
      closeButton
      toastOptions={{
        duration: 4000,
      }}
    />
  );
}
