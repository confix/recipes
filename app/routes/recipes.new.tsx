import { useState } from "react";
import { Form, Link, redirect } from "react-router";

import { AddableComboBox } from "~/components/addable-combobox";
import { INGREDIENT_ROLES, type IngredientRole } from "~/db/schema/app";
import { requireUser } from "~/lib/auth.server";
import { createRecipe, getIngredientVocabulary } from "~/lib/recipes.server";
import { inferRole, parseIngredientLine, parseQuantityField } from "~/lib/parse-freeform";

import type { Route } from "./+types/recipes.new";

export function meta() {
  return [{ title: "New recipe · Recipes" }];
}

/** Common baking/cooking units seeded into the unit combobox alongside the
 * user's own. They can still type anything. */
const COMMON_UNITS = [
  "g", "kg", "ml", "l", "tsp", "tbsp", "cup", "oz", "lb", "pinch", "clove", "slice",
];

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const vocab = await getIngredientVocabulary(user.id);
  return {
    nameSuggestions: vocab.names,
    unitSuggestions: [...new Set([...COMMON_UNITS, ...vocab.units])],
  };
}

function validRole(value: string): IngredientRole {
  return (INGREDIENT_ROLES as readonly string[]).includes(value)
    ? (value as IngredientRole)
    : "other";
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();

  const title = String(form.get("title") ?? "").trim();
  if (!title) return { error: "A title is required." };

  // Repeating rows submit parallel arrays; zip them by index. getAll preserves
  // DOM order, which is the row order.
  const names = form.getAll("ing-name").map(String);
  const qtys = form.getAll("ing-qty").map(String);
  const units = form.getAll("ing-unit").map(String);
  // Roles are only submitted when the "Baking recipe?" disclosure is open, in
  // which case every row has a select. When it's closed (the common case),
  // roles is empty and we infer from the name — so general cooking never has
  // to think about baking roles at all.
  const roles = form.getAll("ing-role").map(String);
  const rolesProvided = roles.length === names.length;

  const ingredients = names
    .map((rawName, i) => {
      const name = rawName.trim();
      return {
        name,
        quantity: parseQuantityField(qtys[i] ?? ""),
        unit: (units[i] ?? "").trim() || null,
        role: rolesProvided ? validRole(roles[i] ?? "other") : inferRole(name),
        note: null,
        groupName: null,
        sortOrder: i,
      };
    })
    .filter((row) => row.name); // drop empty rows

  if (ingredients.length === 0) {
    return { error: "Add at least one ingredient." };
  }

  const stepTexts = form.getAll("step-text").map(String);
  const stepTemps = form.getAll("step-temp").map(String);
  const stepMins = form.getAll("step-min").map(String);
  const steps = stepTexts
    .map((text, i) => ({
      text: text.trim(),
      temperatureC: Number(stepTemps[i]) || null,
      minutes: Number(stepMins[i]) || null,
      sortOrder: i,
    }))
    .filter((s) => s.text);

  const id = await createRecipe(user.id, {
    title,
    description: String(form.get("description") ?? "").trim() || null,
    servings: Number(form.get("servings")) || null,
    ingredients,
    steps,
  });

  throw redirect(`/recipes/${id}`);
}

type IngRow = {
  key: string;
  quantity: string;
  unit: string;
  name: string;
  role: IngredientRole;
};
type StepRow = { key: string; text: string; temp: string; min: string };

function blankIng(): IngRow {
  return { key: crypto.randomUUID(), quantity: "", unit: "", name: "", role: "other" };
}
function blankStep(): StepRow {
  return { key: crypto.randomUUID(), text: "", temp: "", min: "" };
}

export default function NewRecipe({ loaderData, actionData }: Route.ComponentProps) {
  const { nameSuggestions, unitSuggestions } = loaderData;
  const [ings, setIngs] = useState<IngRow[]>(() => [blankIng(), blankIng(), blankIng()]);
  const [steps, setSteps] = useState<StepRow[]>(() => [blankStep(), blankStep()]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  // Baking roles are opt-in. Off by default so general cooking never sees
  // them; when turned on, seed each row from name inference so the baker is
  // adjusting good guesses rather than starting from scratch.
  const [showRoles, setShowRoles] = useState(false);

  function enableRoles() {
    setIngs((rows) =>
      rows.map((r) => (r.role === "other" && r.name ? { ...r, role: inferRole(r.name) } : r)),
    );
    setShowRoles(true);
  }

  function updateIng(key: string, patch: Partial<IngRow>) {
    setIngs((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeIng(key: string) {
    setIngs((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== key) : rows));
  }

  /**
   * Paste-to-prefill: the freeform parser's proper home. It populates editable
   * rows the user then reviews — never writes to the database blind. This is
   * the "every path ends at a review form" principle applied to manual entry.
   */
  function prefillFromPaste() {
    const parsed = pasteText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const p = parseIngredientLine(line);
        return {
          key: crypto.randomUUID(),
          quantity: p.quantity != null ? String(p.quantity) : "",
          unit: p.unit ?? "",
          name: p.name,
          role: p.role ?? "other",
        } satisfies IngRow;
      });
    if (parsed.length) setIngs(parsed);
    setPasteText("");
    setPasteOpen(false);
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link to="/" className="text-sm text-neutral-500 underline">
        ← Collection
      </Link>
      <h1 className="mt-4 mb-6 text-2xl font-semibold">New recipe</h1>

      <Form method="post" className="flex flex-col gap-5">
        <label className="flex flex-col gap-1 text-sm">
          Title
          <input
            name="title"
            required
            className="rounded border border-neutral-300 px-3 py-2"
          />
        </label>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Description
            <input
              name="description"
              className="rounded border border-neutral-300 px-3 py-2"
            />
          </label>
          <label className="flex w-28 flex-col gap-1 text-sm">
            Servings
            <input
              name="servings"
              type="number"
              min={1}
              className="rounded border border-neutral-300 px-3 py-2"
            />
          </label>
        </div>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">Ingredients</h2>
            <button
              type="button"
              onClick={() => setPasteOpen((v) => !v)}
              className="text-xs text-neutral-500 underline"
            >
              Paste a list
            </button>
          </div>

          {pasteOpen ? (
            <div className="mb-3 rounded border border-neutral-200 bg-neutral-50 p-3">
              <p className="mb-1 text-xs text-neutral-500">
                One ingredient per line — we'll split quantity, unit and name
                into rows you can fix before saving.
              </p>
              <textarea
                rows={5}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={"500 g bread flour\n375 g water\n10 g salt"}
                className="w-full rounded border border-neutral-300 px-2 py-1 font-mono text-sm"
              />
              <button
                type="button"
                onClick={prefillFromPaste}
                className="mt-2 rounded bg-neutral-900 px-3 py-1 text-sm text-white"
              >
                Fill rows
              </button>
            </div>
          ) : null}

          {/* Column headers */}
          <div className="mb-1 flex gap-2 px-1 text-xs text-neutral-400">
            <span className="w-16">Qty</span>
            <span className="w-24">Unit</span>
            <span className="flex-1">Ingredient</span>
            {showRoles ? <span className="w-28">Role</span> : null}
            <span className="w-6" />
          </div>

          <div className="flex flex-col gap-2">
            {ings.map((row) => (
              <div key={row.key} className="flex items-start gap-2">
                <input
                  name="ing-qty"
                  value={row.quantity}
                  onChange={(e) => updateIng(row.key, { quantity: e.target.value })}
                  inputMode="decimal"
                  placeholder="500"
                  aria-label="Quantity"
                  className="w-16 rounded border border-neutral-300 px-2 py-1 text-sm"
                />
                <div className="w-24">
                  <AddableComboBox
                    name="ing-unit"
                    ariaLabel="Unit"
                    value={row.unit}
                    onChange={(v) => updateIng(row.key, { unit: v })}
                    suggestions={unitSuggestions}
                    placeholder="g"
                  />
                </div>
                <div className="flex-1">
                  <AddableComboBox
                    name="ing-name"
                    ariaLabel="Ingredient name"
                    value={row.name}
                    onChange={(v) => updateIng(row.key, { name: v })}
                    suggestions={nameSuggestions}
                    placeholder="bread flour"
                  />
                </div>
                {showRoles ? (
                  <select
                    name="ing-role"
                    value={row.role}
                    onChange={(e) =>
                      updateIng(row.key, { role: e.target.value as IngredientRole })
                    }
                    aria-label="Role"
                    className="w-28 rounded border border-neutral-300 px-1 py-1 text-sm"
                  >
                    {INGREDIENT_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                ) : null}
                <button
                  type="button"
                  onClick={() => removeIng(row.key)}
                  aria-label="Remove ingredient"
                  className="w-6 py-1 text-neutral-400 hover:text-red-600"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIngs((r) => [...r, blankIng()])}
              className="text-sm text-neutral-600 underline"
            >
              + Add ingredient
            </button>
            {showRoles ? (
              <span className="text-xs text-neutral-400">
                Roles set — baker's percentages will show on the recipe.
              </span>
            ) : (
              <button
                type="button"
                onClick={enableRoles}
                className="text-xs text-neutral-500 underline"
              >
                Baking recipe? Set flour/liquid roles for baker's %
              </button>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-medium">Steps</h2>
          <div className="flex flex-col gap-2">
            {steps.map((row, i) => (
              <div key={row.key} className="flex items-start gap-2">
                <span className="w-5 pt-2 text-sm text-neutral-400">{i + 1}.</span>
                <textarea
                  name="step-text"
                  value={row.text}
                  onChange={(e) =>
                    setSteps((rows) =>
                      rows.map((r) =>
                        r.key === row.key ? { ...r, text: e.target.value } : r,
                      ),
                    )
                  }
                  rows={2}
                  aria-label={`Step ${i + 1}`}
                  placeholder="Mix flour and water, rest 30 min"
                  className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm"
                />
                <input
                  name="step-temp"
                  value={row.temp}
                  onChange={(e) =>
                    setSteps((rows) =>
                      rows.map((r) =>
                        r.key === row.key ? { ...r, temp: e.target.value } : r,
                      ),
                    )
                  }
                  type="number"
                  aria-label="Temperature °C"
                  placeholder="°C"
                  className="w-16 rounded border border-neutral-300 px-2 py-1 text-sm"
                />
                <input
                  name="step-min"
                  value={row.min}
                  onChange={(e) =>
                    setSteps((rows) =>
                      rows.map((r) =>
                        r.key === row.key ? { ...r, min: e.target.value } : r,
                      ),
                    )
                  }
                  type="number"
                  aria-label="Minutes"
                  placeholder="min"
                  className="w-16 rounded border border-neutral-300 px-2 py-1 text-sm"
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSteps((r) => [...r, blankStep()])}
            className="mt-2 text-sm text-neutral-600 underline"
          >
            + Add step
          </button>
        </section>

        {actionData?.error ? (
          <p role="alert" className="text-sm text-red-600">
            {actionData.error}
          </p>
        ) : null}

        <div>
          <button className="rounded bg-neutral-900 px-4 py-2 text-white">
            Save recipe
          </button>
        </div>
      </Form>
    </main>
  );
}
