"use client";

// A GET form whose checkboxes and dropdowns apply as soon as they change, so the
// shop's filters work without pressing a button. Typing in the search box still
// waits for Enter or the button.
export default function AutoSubmitForm({ children, ...props }) {
  return (
    <form
      {...props}
      onChange={(e) => {
        if (e.target.type === "checkbox" || e.target.tagName === "SELECT")
          e.currentTarget.requestSubmit();
      }}
    >
      {children}
    </form>
  );
}
