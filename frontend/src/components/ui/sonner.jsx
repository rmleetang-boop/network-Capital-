import { Toaster as Sonner, toast } from "sonner"

// Explicit, theme-independent styling so toasts are ALWAYS readable across browsers.
// (Chrome rendered the previous `bg-background`/`text-foreground` token variant as
// near-invisible light-grey on white because no <ThemeProvider> is mounted.)
const Toaster = ({
  ...props
}) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      richColors
      closeButton
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            "group toast bg-white border border-gray-200 text-slate-900 shadow-xl rounded-2xl font-medium",
          title: "text-slate-900 font-semibold",
          description: "text-slate-700",
          actionButton:
            "bg-primary text-white font-semibold rounded-full px-3 py-1.5",
          cancelButton:
            "bg-gray-100 text-slate-700 rounded-full px-3 py-1.5",
          error: "border-red-300 bg-red-50 text-red-900",
          success: "border-emerald-300 bg-emerald-50 text-emerald-900",
          warning: "border-amber-300 bg-amber-50 text-amber-900",
          info: "border-blue-300 bg-blue-50 text-blue-900",
        },
      }}
      {...props} />
  );
}

export { Toaster, toast }
