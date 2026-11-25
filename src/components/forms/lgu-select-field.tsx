import { Select, Field } from "@/components/ui/select";

// The "LGU" picker that four dialogs each re-implemented. Renders nothing
// when the dialog is opened from an LGU's own page (fixed LGU).
export function LguSelectField({
  value,
  onChange,
  options,
  fixed,
  extra = [],
}: {
  value: string;
  onChange: (id: string) => void;
  options: { id: string; name: string }[];
  fixed?: boolean;
  extra?: { value: string; label: string }[]; // appended after the LGUs
}) {
  if (fixed) return null;
  return (
    <Field label="LGU">
      <Select value={value} onChange={(e) => onChange(e.target.value)} required>
        <option value="" disabled>
          Select LGU
        </option>
        {options.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
        {extra.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}
