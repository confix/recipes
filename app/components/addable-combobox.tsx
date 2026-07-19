import {
  Button,
  ComboBox,
  Input,
  ListBox,
  ListBoxItem,
  Popover,
} from "react-aria-components";

/**
 * A type-ahead that suggests from a known vocabulary but lets you add anything
 * new — "pick or add". Used for ingredient names and units, which are
 * open-ended sets that grow as the user enters recipes. (Roles, a closed set
 * of seven, stay a plain <select>.)
 *
 * Design decisions worth knowing:
 * - The value is CONTROLLED via `value`/`onChange`, so the paste-to-prefill
 *   flow can populate rows programmatically and the parent owns row state.
 * - Filtering is handled by ComboBox itself: pass the full list as
 *   `defaultItems` (uncontrolled items) and it filters by the input text. We
 *   never pass `items` — that would make us own filtering.
 * - Each suggestion's id IS its text, so selecting a suggestion and typing it
 *   by hand converge on the same value.
 * - Form submission goes through our OWN hidden input, not ComboBox's `name`.
 *   With allowsCustomValue, RAC's hidden-input semantics (selectedKey vs input
 *   text) are fiddly; a single hidden input we control is predictable and
 *   keeps getAll() ordering intact for the repeating-row parse.
 */
export function AddableComboBox({
  name,
  value,
  onChange,
  suggestions,
  ariaLabel,
  placeholder,
  className,
  required,
}: {
  /** Form field name for the hidden input. Repeats across rows; read with getAll(). */
  name: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  ariaLabel: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
}) {
  const items = suggestions.map((s) => ({ id: s, name: s }));

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <ComboBox
        aria-label={ariaLabel}
        allowsCustomValue
        inputValue={value}
        onInputChange={onChange}
        defaultItems={items}
        // Menu trigger on focus surfaces the full vocabulary immediately, which
        // is the point — the user wants to see what they've used before.
        menuTrigger="focus"
        className={className}
      >
        <div className="relative flex">
          <Input
            placeholder={placeholder}
            required={required}
            className="w-full rounded border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-neutral-500"
          />
          <Button
            aria-label="Show suggestions"
            className="absolute inset-y-0 right-0 px-2 text-neutral-400"
          >
            ▾
          </Button>
        </div>
        <Popover className="max-h-56 w-[var(--trigger-width)] overflow-auto rounded border border-neutral-200 bg-white shadow-lg">
          <ListBox
            renderEmptyState={() => (
              <div className="px-3 py-2 text-sm text-neutral-400">
                Type to add a new one
              </div>
            )}
            className="p-1 outline-none"
          >
            {(item: { id: string; name: string }) => (
              <ListBoxItem
                id={item.id}
                textValue={item.name}
                className="cursor-pointer rounded px-2 py-1 text-sm outline-none data-[focused]:bg-neutral-100"
              >
                {item.name}
              </ListBoxItem>
            )}
          </ListBox>
        </Popover>
      </ComboBox>
    </>
  );
}
