import { useState } from "react";

function EyeIcon({ open }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 6c4.8 0 8.7 3.4 9.8 5.5a1 1 0 0 1 0 1C20.7 14.6 16.8 18 12 18S3.3 14.6 2.2 12.5a1 1 0 0 1 0-1C3.3 9.4 7.2 6 12 6Zm0 2c-3.7 0-6.9 2.5-7.8 4 .9 1.5 4.1 4 7.8 4s6.9-2.5 7.8-4c-.9-1.5-4.1-4-7.8-4Zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4.2 3.5a1 1 0 0 1 1.4 0l14.9 14.9a1 1 0 0 1-1.4 1.4l-2.4-2.4A11.2 11.2 0 0 1 12 18c-4.8 0-8.7-3.4-9.8-5.5a1 1 0 0 1 0-1c.6-1.1 2-2.7 4-3.8L3.5 4.9a1 1 0 0 1 0-1.4Zm4.4 5.8a6.8 6.8 0 0 0-4.4 2.7c.9 1.5 4.1 4 7.8 4 .9 0 1.8-.1 2.6-.4l-1.8-1.8a2 2 0 0 1-2.8-2.8L8.6 9.3Zm3.4-3.2c4.8 0 8.7 3.4 9.8 5.5a1 1 0 0 1 0 1 12 12 0 0 1-3.8 3.8l-1.5-1.5a9.6 9.6 0 0 0 3.3-2.9c-.9-1.5-4.1-4-7.8-4-.7 0-1.4.1-2.1.2L8.3 6.8A11.5 11.5 0 0 1 12 6.1Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function PasswordField({
  label,
  value,
  onChange,
  required = false,
  minLength,
  placeholder,
  autoComplete,
  disabled = false,
  readOnly = false,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const handleCapsLockState = (event) => {
    if (typeof event?.getModifierState === "function") {
      setCapsLockOn(Boolean(event.getModifierState("CapsLock")));
    }
  };

  return (
    <label className="password-field">
      {label}
      <div className="password-input-wrap">
        <input
          required={required}
          type={showPassword ? "text" : "password"}
          minLength={minLength}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          readOnly={readOnly}
          onChange={onChange}
          onKeyDown={handleCapsLockState}
          onKeyUp={handleCapsLockState}
          onBlur={() => setCapsLockOn(false)}
        />
        <button
          type="button"
          className="password-toggle-btn"
          onClick={() => setShowPassword((prev) => !prev)}
          title={showPassword ? "Ocultar senha" : "Mostrar senha"}
          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
        >
          <EyeIcon open={showPassword} />
        </button>
      </div>
      {capsLockOn && <span className="capslock-hint">Caps Lock ligado</span>}
    </label>
  );
}

