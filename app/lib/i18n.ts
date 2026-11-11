import { Fragment, createElement, type ReactNode } from "react";
import { useRouteLoaderData } from "react-router";

/**
 * UI translations. A plain typed dictionary rather than an i18n library: two
 * locales, everything rendered on the server first, nothing to lazy-load.
 *
 * `en` is the source of truth. `de` is typed against its keys, so a missing
 * translation is a compile error rather than a blank label.
 *
 * Interpolation is `{name}`. `rich()` substitutes React nodes (links, <em>)
 * for placeholders. Plurals use `_one` / `_other` suffixes chosen by
 * Intl.PluralRules; call them through `tn()` with the base key.
 *
 * Long legal text (privacy policy) is not in here: it is written per locale
 * in its route, because it is prose with structure, not UI labels.
 */

export const LOCALES = ["en", "de"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_NAMES: Record<Locale, string> = { en: "English", de: "Deutsch" };

/** Cookie that pins an explicit language choice (the footer switcher). */
export const LOCALE_COOKIE = "lang";

export function isLocale(value: unknown): value is Locale {
  return (LOCALES as readonly unknown[]).includes(value);
}

const en = {
  "app.tagline": "A private recipe box your AI assistant can read, write and remember",
  "app.description":
    "A private recipe collection your AI assistant can search, save to and log cooks in, over MCP. Scale recipes, share them by link, and cook from a page that keeps your screen awake.",

  "footer.imprint": "Imprint",
  "footer.privacy": "Privacy",
  "footer.language": "Language",

  "ui.erratum": "Erratum.",
  "ui.note": "Note.",
  "kind.bake": "Bake",
  "kind.cook": "Cook",
  "auth.eyebrow": "Recipes · a private collection",

  "error.oops": "Oops!",
  "error.title": "Error",
  "error.notFound": "The requested page could not be found.",
  "error.unexpected": "An unexpected error occurred.",
  "error.eyebrow": "Recipes · an erratum",
  "error.back": "Return to the index",

  "landing.connect": "Connect",
  "landing.signIn": "Sign in",
  "landing.createAccount": "Create account",
  "landing.edition": "Volume I · the invite-only edition",
  "landing.taglineBefore": "a private recipe box that your",
  "landing.taglineAssistant": "AI assistant",
  "landing.taglineAfter": "can read, write, and remember",
  "landing.begin": "Begin a collection",
  "landing.connectAssistant": "Connect your assistant",
  "landing.contents": "Contents",
  "landing.chapter": "Chapter {n}",
  "landing.ch.foreword": "Foreword",
  "landing.ch.conversation": "A conversation in the kitchen",
  "landing.ch.mcp": "Connecting your assistant",
  "landing.ch.tools": "What it can reach for",
  "landing.foreword":
    "Every cook keeps a box of recipes: the dal you make on Tuesdays, the loaf you have been tuning for a year, the thing a friend once wrote on a napkin. This is that box, with one difference. Your assistant can open it.",
  "landing.plain.title": "Plain pages.",
  "landing.plain.body":
    "Each recipe is a markdown file with a little frontmatter. You can export it, keep it under version control, and read it anywhere.",
  "landing.meaning.title": "Found by meaning.",
  "landing.meaning.body":
    "Look things up by name or ingredient, or by a vague craving such as “something warming with chickpeas”.",
  "landing.bakers.title": "For bakers.",
  "landing.bakers.body":
    "Give a bake its formula in grams, and baker’s percentages and hydration are worked out for you.",
  "landing.scale.title": "Any amount.",
  "landing.scale.body":
    "Halve it, double it, or cook for six: ingredients and formula scale with one tap, the method stays as written.",
  "landing.share.title": "Passed on.",
  "landing.share.body":
    "Share a recipe as a link anyone can read. Friends with an account import their own copy; your cooking notes stay yours.",
  "landing.stove.title": "At the stove.",
  "landing.stove.body":
    "Each recipe page uses large type in one column, and it can keep your phone’s screen awake while you cook.",
  "landing.you": "You",
  "landing.assistant": "Assistant",
  "landing.line1": "Something cosy for tonight? Like that dal, but with more heat.",
  "landing.stage1": "The assistant consults the index, by likeness.",
  "landing.line2":
    "You have a {recipe} that you rated five stars. It is close to the dal and spicier, and takes about forty minutes. Here is the page.",
  "landing.line2.recipe": "Chana Masala",
  "landing.line3": "Perfect. Make it for six, and log it for tonight, five stars.",
  "landing.stage2": "The assistant scales the recipe and writes in the cooking log.",
  "landing.line4": "Done: 600 g chickpeas, three onions. That is the seventh time you have made it.",
  "landing.mcpIntro":
    "Recipes is a remote MCP server. Add it to your client, sign in once and allow access. From then on, your assistant works with your own collection and no one else’s.",
  "landing.scripts": "Prefer scripts? After signing in you can issue a personal API token and use the REST API at {path}.",
  "landing.colophon": "Colophon",
  "landing.colophonText":
    "Set in Fraunces and Newsreader. Recipes are kept private to your account unless you share them. Sign-up is by invitation.",

  "mcp.serves": "Serves",
  "mcp.servesValue": "any MCP client",
  "mcp.time": "Time",
  "mcp.timeValue": "one minute",
  "mcp.keys": "Keys to paste",
  "mcp.keysValue": "none",
  "mcp.ingredients": "Ingredients",
  "mcp.address": "The server address, which every client below needs:",
  "mcp.method": "Method",
  "mcp.claude.title": "Claude.ai & Claude Desktop",
  "mcp.claude.1": "Open {path} and choose {action}.",
  "mcp.claude.1.path": "Settings → Connectors",
  "mcp.claude.1.action": "Add custom connector",
  "mcp.claude.2": "Paste the address and save.",
  "mcp.claude.3": "Sign in here when asked, and allow access.",
  "mcp.code.title": "Claude Code",
  "mcp.code.1": "In a terminal, run:",
  "mcp.code.2": "Inside Claude Code, run {command} and sign in.",
  "mcp.other.title": "Any other client",
  "mcp.other.1": "Add a remote server using the Streamable HTTP transport and the address.",
  "mcp.other.2": "Sign-in is OAuth with dynamic client registration; the client opens it for you.",
  "mcp.copy": "Copy",
  "mcp.copied": "Copied",
  "tool.search_recipes": "keyword and natural-language search",
  "tool.find_similar": "recipes like this one, or like a description",
  "tool.get_recipe": "read the full markdown, with a link to its page",
  "tool.scale_recipe": "the ingredients for any number of servings",
  "tool.save_recipe": "create or edit a recipe",
  "tool.log_cook": "record that you made it, with a rating",
  "tool.share_recipe": "a public link to pass a recipe on",
  "tool.unshare_recipe": "switch that link off again",
  "tool.list_tags": "every tag in your collection",
  "tool.delete_recipe": "remove a recipe",

  "home.signOut": "Sign out",
  "home.collectionOf": "The collection of {name}",
  "home.privateCollection": "A private collection",
  "home.the": "The",
  "home.index": "Index",
  "home.count_one": "{count} recipe, set down and cooked from.",
  "home.count_other": "{count} recipes, set down and cooked from.",
  "home.searchHint": "Search by name, ingredient, or a vague craving.",
  "home.searchPlaceholder": "lentils, or a craving",
  "home.searchLabel": "Search recipes",
  "home.lookUp": "Look up",
  "home.entriesFor": "Entries for “{query}”",
  "home.contents": "Contents",
  "home.clear": "Clear search",
  "home.time": "Time",
  "home.noneFound": "Nothing under that heading.",
  "home.blank": "The pages are still blank.",
  "home.noneFoundHint": "Try fewer words, or describe the dish instead.",
  "home.blankHint": "Add recipes through an MCP client or the API (see below).",
  "home.no": "No. {n}",
  "home.made": "made {count}× · last {date}",
  "home.notMade": "not yet made",
  "home.rated": "rated {rating} of 5",
  "home.appendix": "Appendix {letter}",
  "home.connectTitle": "Connecting an assistant",
  "home.connectDescription": "Add Recipes to Claude or any MCP client, then search and save recipes from a chat.",
  "home.tokensTitle": "API tokens",
  "home.tokensDescription": "For scripts: send {header} to {path}.",
  "home.copyNow": "Copy this now — it will not be shown again:",
  "home.tokenPlaceholder": "name it, e.g. laptop",
  "home.tokenLabel": "Token name",
  "home.issue": "Issue token",
  "home.tokenNameRequired": "Give the token a name.",
  "home.used": "used {date}",
  "home.neverUsed": "never used",
  "home.revoke": "Revoke",

  "login.title": "Welcome back",
  "login.metaTitle": "Sign in",
  "login.subtitle": "Sign in to your recipe collection.",
  "login.newHere": "New here?",
  "login.createAccount": "Create an account",
  "login.signingIn": "Signing in…",
  "login.signIn": "Sign in",
  "signup.title": "Create your account",
  "signup.metaTitle": "Create account",
  "signup.subtitle": "Sign-up is invite-only. Use the email address you were invited with.",
  "signup.haveAccount": "Already have an account?",
  "signup.signIn": "Sign in",
  "signup.creating": "Creating account…",
  "signup.create": "Create account",
  "field.name": "Name",
  "field.email": "Email",
  "field.password": "Password",
  "field.passwordHint": "At least 8 characters.",
  "auth.err.required": "Email and password are required.",
  "auth.err.incorrect": "Incorrect email or password.",
  "auth.err.exists": "An account with this email already exists. Sign in instead.",
  "auth.err.passwordShort": "The password must be at least 8 characters.",
  "auth.err.invalidEmail": "That doesn’t look like a valid email address.",
  "auth.err.notInvited": "Sign-up is invite-only, and this email is not on the list.",
  "auth.err.signIn": "Could not sign you in. Please try again.",
  "auth.err.signUp": "Could not create your account. Please try again.",
  "auth.err.noSession": "Signed in but no session was issued. Please try again.",

  "authorize.metaTitle": "Connect an app",
  "authorize.eyebrow": "Recipes · a request for access",
  "authorize.title": "Connect {client}?",
  "authorize.verified": "Verified domain: {domain}",
  "authorize.unverified": "The app chose this name itself; it is not verified.",
  "authorize.can": "It will be able to {verbs} recipes in the collection of {email}.",
  "authorize.verbs": "read, create, change, share and delete",
  "authorize.redirect": "You will be sent back to {host}.",
  "authorize.loopback":
    "That is an app on this computer. Only continue if you just started the connection yourself.",
  "authorize.deny": "Deny",
  "authorize.allow": "Allow",
  "authorize.failed": "Could not connect",
  "authorize.expired": "This sign-in link has expired. Start again from the app.",
  "authorize.wrong": "Something went wrong. Start again from the app.",

  "awake.on": "Keep screen on",
  "awake.refused": "Couldn’t keep the screen on",

  "recipe.back": "index",
  "recipe.backThe": "The ",
  "recipe.problems": "This recipe file has problems:",
  "recipe.variationOf": "a variation on",
  "recipe.serves": "Serves",
  "recipe.active": "Active",
  "recipe.total": "Total",
  "recipe.hydration": "Hydration",
  "recipe.formula": "The formula",
  "recipe.ingredient": "Ingredient",
  "recipe.grams": "Grams",
  "recipe.bakers": "Baker’s %",
  "recipe.source": "Source:",
  "recipe.notes": "Kitchen notes",
  "recipe.stars": "{rating} of 5",
  "recipe.notFound": "No such recipe.",

  "scale.label": "Amount",
  "scale.custom": "Other amount",
  "scale.apply": "Scale",
  "scale.scaled": "Scaled {factor}: ingredients and formula only — times and temperatures in the method are as written.",
  "scale.reset": "Back to the original",

  "share.title": "Pass it on",
  "share.intro":
    "Make a link anyone can open, no account needed. Friends with an account can import their own copy. Your kitchen notes stay private.",
  "share.create": "Create a share link",
  "share.active": "Anyone with this link can read this recipe:",
  "share.linkLabel": "Share link",
  "share.native": "Share…",
  "share.revoke": "Stop sharing",
  "share.revokeHint": "The link stops working at once. Copies others already imported stay theirs.",

  "shared.eyebrow": "A recipe passed on",
  "shared.import": "Add to my collection",
  "shared.importHint": "Saves your own copy, to change, scale and log as you like.",
  "shared.signIn": "Sign in to add it",
  "shared.signInHint": "Have an account? Sign in to save a copy to your own collection.",
  "shared.yours": "This is your recipe.",
  "shared.open": "Open in your collection",
  "shared.gone": "This share link no longer works.",

  "imprint.title": "Imprint",
  "imprint.eyebrow": "Impressum",
  "imprint.info": "Information pursuant to § 5 DDG",
  "imprint.private": "Recipes is a private, non-commercial project. Accounts are by invitation only.",
  "imprint.personal": "This is a personal website. For quebi GmbH, see the imprint at {link}.",
  "imprint.responsible": "Responsible for content pursuant to § 18 (2) MStV",
  "imprint.atAddress": "{name}, at the address above.",
  "imprint.recipes": "Your recipes",
  "imprint.recipesText":
    "Each recipe belongs to the account that saved it and is visible only to that account, unless its owner shares it by link. Shared recipes are their owner’s content. The operator does not publish or review what users store; to report unlawful content, write to the email address above.",

  "privacy.title": "Privacy policy",
  "privacy.eyebrow": "Datenschutzerklärung",

  "legal.back": "← Back",
  "legal.email": "Email",
} as const;

export type TKey = keyof typeof en;
type Dict = Record<TKey, string>;

const de: Dict = {
  "app.tagline": "Eine private Rezeptkiste, die dein KI-Assistent lesen, beschreiben und sich merken kann",
  "app.description":
    "Eine private Rezeptsammlung, in der dein KI-Assistent über MCP suchen, speichern und dein Kochen festhalten kann. Rezepte umrechnen, per Link teilen und am Herd mit wachem Bildschirm kochen.",

  "footer.imprint": "Impressum",
  "footer.privacy": "Datenschutz",
  "footer.language": "Sprache",

  "ui.erratum": "Erratum.",
  "ui.note": "Hinweis.",
  "kind.bake": "Backen",
  "kind.cook": "Kochen",
  "auth.eyebrow": "Recipes · eine private Sammlung",

  "error.oops": "Hoppla!",
  "error.title": "Fehler",
  "error.notFound": "Diese Seite gibt es nicht.",
  "error.unexpected": "Ein unerwarteter Fehler ist aufgetreten.",
  "error.eyebrow": "Recipes · ein Erratum",
  "error.back": "Zurück zum Register",

  "landing.connect": "Verbinden",
  "landing.signIn": "Anmelden",
  "landing.createAccount": "Konto anlegen",
  "landing.edition": "Band I · die Ausgabe auf Einladung",
  "landing.taglineBefore": "eine private Rezeptkiste, die dein",
  "landing.taglineAssistant": "KI-Assistent",
  "landing.taglineAfter": "lesen, beschreiben und sich merken kann",
  "landing.begin": "Sammlung beginnen",
  "landing.connectAssistant": "Assistenten verbinden",
  "landing.contents": "Inhalt",
  "landing.chapter": "Kapitel {n}",
  "landing.ch.foreword": "Vorwort",
  "landing.ch.conversation": "Ein Gespräch in der Küche",
  "landing.ch.mcp": "Den Assistenten verbinden",
  "landing.ch.tools": "Wonach er greifen kann",
  "landing.foreword":
    "Wer kocht, hat eine Rezeptkiste: das Dal für dienstags, das Brot, an dem du seit einem Jahr feilst, das, was dir jemand mal auf eine Serviette geschrieben hat. Das hier ist diese Kiste, mit einem Unterschied: Dein Assistent kann sie öffnen.",
  "landing.plain.title": "Schlichte Seiten.",
  "landing.plain.body":
    "Jedes Rezept ist eine Markdown-Datei mit etwas Frontmatter. Du kannst sie exportieren, versionieren und überall lesen.",
  "landing.meaning.title": "Nach Bedeutung gefunden.",
  "landing.meaning.body":
    "Such nach Name oder Zutat – oder nach einer vagen Lust wie „etwas Wärmendes mit Kichererbsen“.",
  "landing.bakers.title": "Für Bäcker.",
  "landing.bakers.body":
    "Gib einem Gebäck seine Rezeptur in Gramm, und Bäckerprozente und Hydration werden für dich ausgerechnet.",
  "landing.scale.title": "Jede Menge.",
  "landing.scale.body":
    "Halbieren, verdoppeln oder für sechs kochen: Zutaten und Rezeptur rechnen sich mit einem Tipp um, die Zubereitung bleibt, wie sie ist.",
  "landing.share.title": "Weitergegeben.",
  "landing.share.body":
    "Teile ein Rezept als Link, den alle lesen können. Freunde mit Konto übernehmen eine eigene Kopie; deine Küchennotizen bleiben deine.",
  "landing.stove.title": "Am Herd.",
  "landing.stove.body":
    "Jede Rezeptseite hat große Schrift in einer Spalte und kann den Bildschirm deines Handys wach halten, während du kochst.",
  "landing.you": "Du",
  "landing.assistant": "Assistent",
  "landing.line1": "Was Gemütliches für heute Abend? Wie das Dal, aber schärfer.",
  "landing.stage1": "Der Assistent schlägt im Register nach – nach Ähnlichkeit.",
  "landing.line2":
    "Du hast ein {recipe}, das du mit fünf Sternen bewertet hast. Es ist nah am Dal, schärfer, und dauert etwa vierzig Minuten. Hier ist die Seite.",
  "landing.line2.recipe": "Chana Masala",
  "landing.line3": "Perfekt. Für sechs Personen, bitte, und trag es für heute ein, fünf Sterne.",
  "landing.stage2": "Der Assistent rechnet das Rezept um und schreibt ins Kochtagebuch.",
  "landing.line4": "Erledigt: 600 g Kichererbsen, drei Zwiebeln. Das ist das siebte Mal, dass du es kochst.",
  "landing.mcpIntro":
    "Recipes ist ein entfernter MCP-Server. Füg ihn in deinem Client hinzu, melde dich einmal an und erlaube den Zugriff. Ab dann arbeitet dein Assistent mit deiner eigenen Sammlung und mit keiner anderen.",
  "landing.scripts": "Lieber Skripte? Nach der Anmeldung kannst du ein persönliches API-Token ausstellen und die REST-API unter {path} nutzen.",
  "landing.colophon": "Kolophon",
  "landing.colophonText":
    "Gesetzt in Fraunces und Newsreader. Rezepte bleiben privat in deinem Konto, solange du sie nicht teilst. Registrierung nur auf Einladung.",

  "mcp.serves": "Für",
  "mcp.servesValue": "jeden MCP-Client",
  "mcp.time": "Zeit",
  "mcp.timeValue": "eine Minute",
  "mcp.keys": "Schlüssel zum Einfügen",
  "mcp.keysValue": "keine",
  "mcp.ingredients": "Zutaten",
  "mcp.address": "Die Serveradresse, die jeder Client unten braucht:",
  "mcp.method": "Zubereitung",
  "mcp.claude.title": "Claude.ai & Claude Desktop",
  "mcp.claude.1": "Öffne {path} und wähle {action}.",
  "mcp.claude.1.path": "Einstellungen → Konnektoren",
  "mcp.claude.1.action": "Benutzerdefinierten Konnektor hinzufügen",
  "mcp.claude.2": "Adresse einfügen und speichern.",
  "mcp.claude.3": "Melde dich hier an, wenn du gefragt wirst, und erlaube den Zugriff.",
  "mcp.code.title": "Claude Code",
  "mcp.code.1": "Im Terminal ausführen:",
  "mcp.code.2": "In Claude Code {command} ausführen und anmelden.",
  "mcp.other.title": "Jeder andere Client",
  "mcp.other.1": "Einen entfernten Server mit dem Streamable-HTTP-Transport und der Adresse hinzufügen.",
  "mcp.other.2": "Die Anmeldung läuft über OAuth mit dynamischer Client-Registrierung; der Client öffnet sie für dich.",
  "mcp.copy": "Kopieren",
  "mcp.copied": "Kopiert",
  "tool.search_recipes": "Suche nach Stichwort und in natürlicher Sprache",
  "tool.find_similar": "Rezepte wie dieses oder wie eine Beschreibung",
  "tool.get_recipe": "das ganze Markdown lesen, mit Link zur Seite",
  "tool.scale_recipe": "die Zutaten für beliebig viele Portionen",
  "tool.save_recipe": "ein Rezept anlegen oder ändern",
  "tool.log_cook": "festhalten, dass du es gekocht hast, mit Bewertung",
  "tool.share_recipe": "ein öffentlicher Link zum Weitergeben",
  "tool.unshare_recipe": "diesen Link wieder abschalten",
  "tool.list_tags": "alle Schlagwörter deiner Sammlung",
  "tool.delete_recipe": "ein Rezept entfernen",

  "home.signOut": "Abmelden",
  "home.collectionOf": "Die Sammlung von {name}",
  "home.privateCollection": "Eine private Sammlung",
  "home.the": "Das",
  "home.index": "Register",
  "home.count_one": "{count} Rezept, aufgeschrieben und nachgekocht.",
  "home.count_other": "{count} Rezepte, aufgeschrieben und nachgekocht.",
  "home.searchHint": "Such nach Name, Zutat oder einer vagen Lust.",
  "home.searchPlaceholder": "Linsen, oder eine Lust",
  "home.searchLabel": "Rezepte durchsuchen",
  "home.lookUp": "Nachschlagen",
  "home.entriesFor": "Einträge zu „{query}“",
  "home.contents": "Inhalt",
  "home.clear": "Suche löschen",
  "home.time": "Zeit",
  "home.noneFound": "Unter diesem Stichwort steht nichts.",
  "home.blank": "Die Seiten sind noch leer.",
  "home.noneFoundHint": "Versuch es mit weniger Wörtern oder beschreib das Gericht.",
  "home.blankHint": "Füge Rezepte über einen MCP-Client oder die API hinzu (siehe unten).",
  "home.no": "Nr. {n}",
  "home.made": "{count}× gekocht · zuletzt {date}",
  "home.notMade": "noch nicht gekocht",
  "home.rated": "mit {rating} von 5 bewertet",
  "home.appendix": "Anhang {letter}",
  "home.connectTitle": "Einen Assistenten verbinden",
  "home.connectDescription": "Füge Recipes zu Claude oder einem anderen MCP-Client hinzu und such und speichere Rezepte im Chat.",
  "home.tokensTitle": "API-Tokens",
  "home.tokensDescription": "Für Skripte: {header} an {path} senden.",
  "home.copyNow": "Jetzt kopieren – es wird nicht noch einmal angezeigt:",
  "home.tokenPlaceholder": "benennen, z. B. Laptop",
  "home.tokenLabel": "Name des Tokens",
  "home.issue": "Token ausstellen",
  "home.tokenNameRequired": "Gib dem Token einen Namen.",
  "home.used": "benutzt am {date}",
  "home.neverUsed": "nie benutzt",
  "home.revoke": "Widerrufen",

  "login.title": "Willkommen zurück",
  "login.metaTitle": "Anmelden",
  "login.subtitle": "Melde dich bei deiner Rezeptsammlung an.",
  "login.newHere": "Neu hier?",
  "login.createAccount": "Konto anlegen",
  "login.signingIn": "Anmeldung läuft…",
  "login.signIn": "Anmelden",
  "signup.title": "Konto anlegen",
  "signup.metaTitle": "Konto anlegen",
  "signup.subtitle": "Registrierung nur auf Einladung. Nimm die E-Mail-Adresse, mit der du eingeladen wurdest.",
  "signup.haveAccount": "Schon ein Konto?",
  "signup.signIn": "Anmelden",
  "signup.creating": "Konto wird angelegt…",
  "signup.create": "Konto anlegen",
  "field.name": "Name",
  "field.email": "E-Mail",
  "field.password": "Passwort",
  "field.passwordHint": "Mindestens 8 Zeichen.",
  "auth.err.required": "E-Mail und Passwort sind erforderlich.",
  "auth.err.incorrect": "E-Mail oder Passwort ist falsch.",
  "auth.err.exists": "Zu dieser E-Mail gibt es schon ein Konto. Melde dich stattdessen an.",
  "auth.err.passwordShort": "Das Passwort muss mindestens 8 Zeichen lang sein.",
  "auth.err.invalidEmail": "Das sieht nicht nach einer gültigen E-Mail-Adresse aus.",
  "auth.err.notInvited": "Registrierung nur auf Einladung, und diese E-Mail steht nicht auf der Liste.",
  "auth.err.signIn": "Anmeldung fehlgeschlagen. Bitte versuch es noch einmal.",
  "auth.err.signUp": "Das Konto konnte nicht angelegt werden. Bitte versuch es noch einmal.",
  "auth.err.noSession": "Angemeldet, aber es wurde keine Sitzung erstellt. Bitte versuch es noch einmal.",

  "authorize.metaTitle": "App verbinden",
  "authorize.eyebrow": "Recipes · eine Zugriffsanfrage",
  "authorize.title": "{client} verbinden?",
  "authorize.verified": "Bestätigte Domain: {domain}",
  "authorize.unverified": "Die App hat sich diesen Namen selbst gegeben; er ist nicht bestätigt.",
  "authorize.can": "Sie kann Rezepte in der Sammlung von {email} {verbs}.",
  "authorize.verbs": "lesen, anlegen, ändern, teilen und löschen",
  "authorize.redirect": "Danach geht es zurück zu {host}.",
  "authorize.loopback":
    "Das ist eine App auf diesem Computer. Mach nur weiter, wenn du die Verbindung gerade selbst gestartet hast.",
  "authorize.deny": "Ablehnen",
  "authorize.allow": "Erlauben",
  "authorize.failed": "Verbindung fehlgeschlagen",
  "authorize.expired": "Dieser Anmeldelink ist abgelaufen. Starte noch einmal in der App.",
  "authorize.wrong": "Etwas ist schiefgegangen. Starte noch einmal in der App.",

  "awake.on": "Bildschirm wach halten",
  "awake.refused": "Bildschirm konnte nicht wach gehalten werden",

  "recipe.back": "Register",
  "recipe.backThe": "Zum ",
  "recipe.problems": "Diese Rezeptdatei hat Fehler:",
  "recipe.variationOf": "eine Variation von",
  "recipe.serves": "Für",
  "recipe.active": "Aktiv",
  "recipe.total": "Gesamt",
  "recipe.hydration": "Hydration",
  "recipe.formula": "Die Rezeptur",
  "recipe.ingredient": "Zutat",
  "recipe.grams": "Gramm",
  "recipe.bakers": "Bäcker-%",
  "recipe.source": "Quelle:",
  "recipe.notes": "Küchennotizen",
  "recipe.stars": "{rating} von 5",
  "recipe.notFound": "Dieses Rezept gibt es nicht.",

  "scale.label": "Menge",
  "scale.custom": "Andere Menge",
  "scale.apply": "Umrechnen",
  "scale.scaled": "Umgerechnet {factor}: nur Zutaten und Rezeptur – Zeiten und Temperaturen in der Zubereitung stehen wie im Original.",
  "scale.reset": "Zurück zum Original",

  "share.title": "Weitergeben",
  "share.intro":
    "Erstelle einen Link, den alle öffnen können, ganz ohne Konto. Freunde mit Konto können eine eigene Kopie übernehmen. Deine Küchennotizen bleiben privat.",
  "share.create": "Link zum Teilen erstellen",
  "share.active": "Alle mit diesem Link können das Rezept lesen:",
  "share.linkLabel": "Link zum Teilen",
  "share.native": "Teilen…",
  "share.revoke": "Nicht mehr teilen",
  "share.revokeHint": "Der Link funktioniert sofort nicht mehr. Kopien, die andere schon übernommen haben, bleiben ihre.",

  "shared.eyebrow": "Ein weitergegebenes Rezept",
  "shared.import": "In meine Sammlung übernehmen",
  "shared.importHint": "Speichert deine eigene Kopie zum Ändern, Umrechnen und Festhalten.",
  "shared.signIn": "Anmelden zum Übernehmen",
  "shared.signInHint": "Du hast ein Konto? Melde dich an, um eine Kopie in deiner Sammlung zu speichern.",
  "shared.yours": "Das ist dein Rezept.",
  "shared.open": "In deiner Sammlung öffnen",
  "shared.gone": "Dieser Link zum Teilen funktioniert nicht mehr.",

  "imprint.title": "Impressum",
  "imprint.eyebrow": "Imprint",
  "imprint.info": "Angaben gemäß § 5 DDG",
  "imprint.private": "Recipes ist ein privates, nicht-kommerzielles Projekt. Konten gibt es nur auf Einladung.",
  "imprint.personal": "Dies ist eine private Website. Für die quebi GmbH siehe das Impressum auf {link}.",
  "imprint.responsible": "Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV",
  "imprint.atAddress": "{name}, Anschrift wie oben.",
  "imprint.recipes": "Deine Rezepte",
  "imprint.recipesText":
    "Jedes Rezept gehört dem Konto, das es gespeichert hat, und ist nur für dieses Konto sichtbar, es sei denn, es wird per Link geteilt. Geteilte Rezepte sind Inhalte ihrer Eigentümer. Der Betreiber veröffentlicht oder prüft nicht, was Nutzer speichern; rechtswidrige Inhalte bitte an die oben genannte E-Mail-Adresse melden.",

  "privacy.title": "Datenschutzerklärung",
  "privacy.eyebrow": "Privacy policy",

  "legal.back": "← Zurück",
  "legal.email": "E-Mail",
};

const DICTS: Record<Locale, Dict> = { en, de };

type Vars = Record<string, string | number>;

export function translate(locale: Locale, key: TKey, vars?: Vars): string {
  const template = DICTS[locale][key] ?? en[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in vars ? String(vars[name]) : m,
  );
}

/** Base keys of every `_one`/`_other` pair, e.g. "home.count". */
export type PluralKey = {
  [K in TKey]: K extends `${infer B}_one` ? B : never;
}[TKey];

export function translatePlural(locale: Locale, key: PluralKey, count: number, vars?: Vars) {
  const rule = new Intl.PluralRules(locale).select(count) === "one" ? "one" : "other";
  return translate(locale, `${key}_${rule}` as TKey, { count, ...vars });
}

/** Like translate(), but placeholders may be React nodes (links, emphasis). */
export function translateRich(
  locale: Locale,
  key: TKey,
  vars: Record<string, ReactNode>,
): ReactNode {
  const parts = DICTS[locale][key].split(/\{(\w+)\}/g);
  return createElement(
    Fragment,
    null,
    ...parts.map((part, i) =>
      createElement(Fragment, { key: i }, i % 2 ? (vars[part] ?? `{${part}}`) : part),
    ),
  );
}

export interface Translator {
  locale: Locale;
  t: (key: TKey, vars?: Vars) => string;
  tn: (key: PluralKey, count: number, vars?: Vars) => string;
  rich: (key: TKey, vars: Record<string, ReactNode>) => ReactNode;
}

export function getTranslator(locale: Locale): Translator {
  return {
    locale,
    t: (key, vars) => translate(locale, key, vars),
    tn: (key, count, vars) => translatePlural(locale, key, count, vars),
    rich: (key, vars) => translateRich(locale, key, vars),
  };
}

/**
 * The translator for components. The locale is resolved once, on the server,
 * by the root loader and read back here, so the server render and hydration
 * agree. Falls back to the default where the root has no data (an error
 * boundary that caught a root loader failure).
 */
export function useT(): Translator {
  const data = useRouteLoaderData("root") as { locale?: Locale } | undefined;
  return getTranslator(isLocale(data?.locale) ? data.locale : DEFAULT_LOCALE);
}
