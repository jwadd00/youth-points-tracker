"use client";

export default function ConfirmSubmitButton({
  children,
  className = "btn danger",
  message = "are you sure??"
}) {
  return (
    <button
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
      type="submit"
    >
      {children}
    </button>
  );
}
