import React, { useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import { setToastImpl } from "./toastApi";
import { useAppState } from "./AppStateContext";

const toastStyle = {
  background: "#10161d",
  color: "#d9e8ed",
  border: "1px solid #222c38",
  borderRadius: "12px",
  boxShadow: "0 18px 48px rgba(0,0,0,.6)",
};
const toastOptions = {
  position: "top-right" as const,
  duration: 3000,
  style: toastStyle,
  className: "app-toast",
  icon: "",
  iconTheme: { primary: "#fbc500", secondary: "#10161d" },
};

export function ToastProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const { searchSubs: openSubsSearch } = useAppState();

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
        }),
      dismissLoading: (id: string) => toast.dismiss(id),
      messageWithLink: (data: { url?: string; text?: string; title?: string; error?: string } | string | null) => {
        if (!data || typeof data !== "object" || (data as { error?: string }).error) {
          const d = data as { text?: string; error?: string } | undefined;
          const fallback = d?.text ?? d?.error ?? (typeof data === "string" ? data : "");
          toast.success(String(fallback || "Done"), toastOptions);
          return;
        }
        const url = data.url;
        const text = data.text ?? "";
        const title = data.title;
        toast.custom(
          () => (
            <a
              href={url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                if (openSubsSearch && title) openSubsSearch(title);
              }}
              className="app-toast-link"
            >
              {text}
            </a>
          ),
          { duration: Infinity, position: "top-right", style: toastStyle }
        );
      },
    });
    return () => setToastImpl(null);
  }, [openSubsSearch]);

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
