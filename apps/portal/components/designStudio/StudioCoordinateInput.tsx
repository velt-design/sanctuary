import { useState } from "react";
export function displayStudioCoordinate(raw:string):string {
 const n=Number(raw);
 return raw.trim()!==''&&Number.isFinite(n)?String(Math.round(n*10)/10):raw;
}

/** Formatting never writes a rounded value back unless the user actually edits. */
export default function StudioCoordinateInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (raw: string) => void;
  label: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      aria-label={label}
      value={focused ? value : displayStudioCoordinate(value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
