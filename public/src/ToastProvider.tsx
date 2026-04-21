import React, { useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import { setToastImpl } from "./toastApi";
import { sanitizeHrefForToast } from "./htmlSafeForToast";
import { TOAST_DEFAULT_DURATION_MS } from "./animation/timing";
import { WaitCue } from "./WaitCue";

const toastStyle = {
  background: "#10161d",
  color: "#d9e8ed",
  border: "1px solid #222c38",
  borderRadius: "12px",
  boxShadow: "0 18px 48px rgba(0,0,0,.6)",
};
const toastOptions = {
  position: "top-right" as const,
  duration: TOAST_DEFAULT_DURATION_MS,
  style: toastStyle,
  className: "app-toast",
  icon: "",
  iconTheme: { primary: "#fbc500", secondary: "#10161d" },
};

export function ToastProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  useEffect(() => {
    setToastImpl({
      success: (msg: string) => toast.success(String(msg ?? ""), toastOptions),
      error: (msg: string) =>
        toast.error(String(msg ?? ""), {
          ...toastOptions,
          style: { ...toastStyle, borderColor: "#b91c1c" },
          iconTheme: { primary: "#ef4444", secondary: "#10161d" },
        }),
      loading: (msg: string) =>
        toast.loading(msg ?? "Please wait...", {
          position: "top-right",
          style: toastStyle,
          icon: <WaitCue size="xs" />,
        }),
      dismissLoading: (id: string) => toast.dismiss(id),
      messageWithLink: (
        data:
          | { url?: string; text?: string; title?: string; year?: string | number; error?: string }
          | string
          | null,
      ) => {
        if (!data || typeof data !== "object" || (data as { error?: string }).error) {
          const d = data as { text?: string; error?: string } | undefined;
          const fallback = d?.text ?? d?.error ?? (typeof data === "string" ? data : "");
          toast.success(String(fallback || "Done"), toastOptions);
          return;
        }
        const url = data.url;
        const text = data.text ?? "";
        toast.custom(
          () => (
            <a
              href={sanitizeHrefForToast(url)}
              target="_blank"
              rel="noopener noreferrer"
              className="app-toast-link"
            >
              {text}
            </a>
          ),
          { duration: Infinity, position: "top-right", style: toastStyle },
        );
      },
    });
    return () => setToastImpl(null);
  }, []);

  return (
    <>
      {children}
      <Toaster
        position="top-right"
        containerClassName="toaster-container"
        toastOptions={toastOptions}
      />
    </>
  );
}
