import { useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import { setToastImpl } from "./toastApi.js";
import { useAppState } from "./AppStateContext.jsx";

const toastStyle = {
  background: "#10161d",
  color: "#d9e8ed",
  border: "1px solid #222c38",
  borderRadius: "12px",
  boxShadow: "0 18px 48px rgba(0,0,0,.6)",
};
const toastOptions = {
  position: "top-right",
  duration: 3000,
  style: toastStyle,
  className: "app-toast",
  icon: "",
  iconTheme: { primary: "#fbc500", secondary: "#10161d" },
};

export function ToastProvider({ children }) {
  const { searchSubs: openSubsSearch } = useAppState();

  useEffect(() => {
    setToastImpl({
      success: (msg) => toast.success(String(msg ?? ""), toastOptions),
      error: (msg) =>
        toast.error(String(msg ?? ""), {
          ...toastOptions,
          style: { ...toastStyle, borderColor: "#b91c1c" },
          iconTheme: { primary: "#ef4444", secondary: "#10161d" },
        }),
      loading: (msg) =>
        toast.loading(msg ?? "Please wait...", {
          position: "top-right",
          style: toastStyle,
        }),
      dismissLoading: (id) => toast.dismiss(id),
      messageWithLink: (data) => {
        if (!data || typeof data !== "object" || data.error) {
          const fallback =
            data?.text ?? data?.error ?? (typeof data === "string" ? data : "");
          toast.success(String(fallback || "Done"), toastOptions);
          return;
        }
        const url = data.url;
        const text = data.text ?? "";
        const title = data.title;
        toast.custom(
          (t) => (
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
