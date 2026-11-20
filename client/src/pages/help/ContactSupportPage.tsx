import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Copy, Mail, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/Input";

const SUPPORT_EMAIL = "pvsram346@gmail.com";

export function supportDraft(
  subject: string,
  message: string,
  category: string,
) {
  const title = `[GullyBid · ${category}] ${subject.replace(/[\r\n]+/g, " ").trim()}`;
  const body = `${message.trim()}\n\nCategory: ${category}\n\nPlease include the tournament or auction link if relevant. Do not include passwords or access tokens.`;
  return {
    title,
    body,
    mailto: `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`,
  };
}

/** No pretend ticket API: prepare a draft, then let the user send it. */
export default function ContactSupportPage() {
  const [draft, setDraft] = useState<ReturnType<typeof supportDraft> | null>(
    null,
  );
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">(
    "idle",
  );
  const textRef = useRef<HTMLTextAreaElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (draft) headingRef.current?.focus();
  }, [draft]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setCopyState("idle");
    setDraft(
      supportDraft(
        String(data.get("subject") || ""),
        String(data.get("message") || ""),
        String(data.get("category") || "General"),
      ),
    );
  };
  const copy = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(
        `To: ${SUPPORT_EMAIL}\nSubject: ${draft.title}\n\n${draft.body}`,
      );
      setCopyState("copied");
    } catch {
      setCopyState("manual");
      textRef.current?.focus();
      textRef.current?.select();
    }
  };
  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs font-semibold tracking-[.2em] text-emerald-800">
          A LITTLE HELP GOES A LONG WAY
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          Let’s get you
          <br />
          back to the game.
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-7 text-slate-600">
          Have a question or found an issue? Prepare a message below and send it
          from your email app. You can also email{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="break-all font-medium text-emerald-800 underline underline-offset-4"
          >
            {SUPPORT_EMAIL}
          </a>{" "}
          directly.
        </p>
      </div>
      <div className="grid items-start gap-8 xl:grid-cols-[1.5fr_1fr]">
        <form
          onSubmit={submit}
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
        >
          <div>
            <label
              htmlFor="support-category"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              What can we help with?
            </label>
            <select
              id="support-category"
              name="category"
              className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800"
            >
              <option>General question</option>
              <option>Auction or bidding</option>
              <option>Player or franchise registration</option>
              <option>Account access</option>
              <option>Bug report</option>
              <option>Feedback</option>
            </select>
          </div>
          <Input
            name="subject"
            label="Subject"
            placeholder="A short summary"
            required
            maxLength={120}
          />
          <div>
            <label
              htmlFor="support-message"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Your message
            </label>
            <textarea
              id="support-message"
              name="message"
              required
              maxLength={2000}
              rows={7}
              aria-describedby="support-message-hint"
              placeholder="Tell us what happened, what you expected, and the tournament or auction link, if relevant."
              className="block w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm leading-7 text-slate-900"
            />
            <p
              id="support-message-hint"
              className="mt-2 text-xs leading-5 text-slate-500"
            >
              Up to 2,000 characters. Never include passwords, access tokens, or
              sensitive financial details.
            </p>
          </div>
          <button type="submit" className="gb-button gb-button--ink w-full">
            <Mail size={17} aria-hidden="true" />
            Prepare email draft
          </button>
          <p className="text-xs leading-6 text-slate-500">
            This form doesn’t submit a ticket or upload files. You’ll send the
            message yourself from your email app and can attach screenshots
            there.
          </p>
        </form>
        <aside className="space-y-6">
          <div className="rounded-2xl border border-emerald-900/10 bg-emerald-950 p-6 text-white">
            <ShieldCheck
              className="h-6 w-6 text-amber-200"
              aria-hidden="true"
            />
            <h2 className="mt-5 text-lg font-medium">
              In the middle of an auction?
            </h2>
            <p className="mt-3 text-sm leading-7 text-emerald-100/85">
              Check your connection and the room’s current state before
              repeating an action. If a bid or decision is uncertain, reconnect
              and review the latest state or history first.
            </p>
            <Link
              to="/help/bidding"
              className="mt-5 inline-flex items-center gap-2 text-sm text-amber-200"
            >
              Read the bidding guide
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-800">
              A helpful message includes
            </h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              {[
                "The tournament or auction link",
                "What you were trying to do",
                "What happened and when",
                "Your browser and device",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check
                    size={16}
                    className="mt-1 shrink-0 text-emerald-700"
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
      {draft && (
        <section
          aria-labelledby="draft-title"
          className="rounded-2xl border border-emerald-900/15 bg-white p-5 sm:p-7"
        >
          <div role="status">
            <h2
              ref={headingRef}
              tabIndex={-1}
              id="draft-title"
              className="text-xl font-semibold text-slate-900"
            >
              Your email draft is ready.
            </h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Nothing has been sent yet. Open your email app to review and send,
              or copy the draft into your preferred email service.
            </p>
          </div>
          <p className="mt-4 break-all text-sm text-slate-600">
            To: <strong>{SUPPORT_EMAIL}</strong>
          </p>
          <label
            htmlFor="support-draft"
            className="mt-4 block text-sm font-medium text-slate-700"
          >
            Subject & message
          </label>
          <textarea
            ref={textRef}
            id="support-draft"
            readOnly
            value={`${draft.title}\n\n${draft.body}`}
            rows={8}
            className="mt-2 block w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700"
          />
          <div className="mt-5 flex flex-wrap gap-3">
            <a className="gb-button gb-button--ink" href={draft.mailto}>
              Open email app
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
            <button
              type="button"
              className="gb-button border-slate-300 bg-white text-slate-800"
              onClick={copy}
            >
              <Copy size={16} aria-hidden="true" />
              {copyState === "copied" ? "Draft copied" : "Copy draft"}
            </button>
          </div>
          <p role="status" className="mt-3 text-xs leading-6 text-slate-500">
            {copyState === "copied"
              ? "Draft copied. Paste it into an email to send it."
              : copyState === "manual"
                ? "Automatic copying is unavailable. Select and copy the draft above."
                : "If your email app doesn’t open, copy the draft and email it directly."}
          </p>
        </section>
      )}
    </div>
  );
}
