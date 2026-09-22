"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

type PasswordInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string | null;
  minLength?: number;
  autoComplete?: string;
};

export default function PasswordInput({ id, label, value, onChange, placeholder, error, minLength, autoComplete }: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          minLength={minLength}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm outline-none ring-0 focus:border-slate-900"
        />
        <button
          type="button"
          className="absolute inset-y-0 right-3 flex items-center text-slate-500"
          onClick={() => setShowPassword((current) => !current)}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
