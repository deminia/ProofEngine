import { useState, useRef, useEffect } from "react";

export function Dropdown({ trigger, items = [], align = "right", className = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className={`dropdown-wrapper ${className}`} ref={ref}>
      <div onClick={() => setOpen((prev) => !prev)} style={{ display: "inline-block" }}>
        {trigger}
      </div>
      {open && (
        <div
          className="dropdown-menu"
          style={{
            right: align === "right" ? 0 : "auto",
            left: align === "left" ? 0 : "auto",
          }}
        >
          {items.map((item, idx) => {
            if (item.divider) {
              return <div key={`div-${idx}`} className="dropdown-divider" />;
            }
            return (
              <button
                key={idx}
                type="button"
                className={`dropdown-item ${item.danger ? "danger" : ""}`}
                disabled={item.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  if (item.onClick) item.onClick();
                }}
              >
                {item.icon && <span style={{ marginRight: 4 }}>{item.icon}</span>}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Dropdown;
