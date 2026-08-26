import { AGENT_TOKEN_TTL_DAYS } from "@/lib/auth/agent-tokens";
import { AGENT_SUBSCRIPTION, isAgentBuyable } from "@/lib/billing/catalog";
import { SubscribeButton } from "@/components/agent/SubscribeButton";

// State 2: the workspace holds a licence but not the agent add-on.
//
// This is the surface the add-on is SOLD from, and the one place we can tell a
// customer what they will actually need BEFORE they pay. The old panel said
// "get in touch" with nothing to click; a dead end at the exact moment demand
// appears.

const CONTACT = "regulatory.sidekick@notjustany.tech";

function Row({
  have,
  what,
  who,
}: {
  have: "yes" | "no" | "byo";
  what: React.ReactNode;
  who: string;
}) {
  const [mark, cls] =
    have === "yes"
      ? ["✓", "text-teal-600"]
      : have === "no"
        ? ["—", "text-coral"]
        : ["→", "text-muted"];
  return (
    <tr className="border-t border-line">
      <td className={`py-2.5 pr-3 align-top text-base font-bold ${cls}`}>
        {mark}
      </td>
      <td className="py-2.5 pr-4 align-top text-sm text-ink">{what}</td>
      <td className="py-2.5 align-top text-xs text-muted">{who}</td>
    </tr>
  );
}

export function AgentUpsell({ orgName }: { orgName: string }) {
  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-teal-900">
          Let an AI agent draft your QMS
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Agent access gives your own AI assistant a scoped, admin-approved key
          to this workspace. It reads the plan (what&apos;s next, why it
          matters, which clause it satisfies), drafts the documents into a folder
          on <span className="font-medium text-teal-800">your machine</span>, and
          reports progress back here. Nothing you draft leaves your computer.
        </p>

        <div className="mt-5 rounded-xl border border-line bg-tint p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-teal-800">
            What it takes
          </div>
          <table className="mt-2 w-full border-collapse">
            <tbody>
              <Row
                have="yes"
                what={
                  <>
                    <b className="text-teal-900">Full access</b>: the plan, the
                    275 templates, the clause matrix
                  </>
                }
                who={`${orgName} already has this`}
              />
              <Row
                have="no"
                what={
                  <>
                    <b className="text-teal-900">Agent access</b>: a separate
                    monthly add-on to your licence
                  </>
                }
                who="Not switched on yet"
              />
              <Row
                have="byo"
                what={
                  <>
                    <b className="text-teal-900">An AI assistant</b> that
                    supports MCP, such as Claude Desktop or Claude Code
                  </>
                }
                who="Your own subscription, not ours"
              />
            </tbody>
          </table>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            That last line matters, so we say it before you buy rather than
            after: we supply the plan, the templates and the guardrails; you
            bring the assistant that does the drafting. We never charge you per
            document and never generate your regulatory content on our servers.
          </p>
        </div>

        <p className="mt-4 font-display text-lg font-semibold text-teal-900">
          {AGENT_SUBSCRIPTION.headline}
        </p>

        <SubscribeButton
          buyable={isAgentBuyable()}
          contact={CONTACT}
          orgName={orgName}
        />
      </section>

      <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h3 className="font-display text-base font-semibold text-teal-900">
          What the agent can and can&apos;t do
        </h3>
        <ul className="mt-3 flex flex-col gap-2.5 text-sm text-muted">
          {[
            [
              "It drafts, you approve.",
              "Every document lands as a draft in your own folder. It can move an activity to In progress, but only a person can mark one Done.",
            ],
            [
              "It never invents a fact.",
              "No dates, signatures, results or batch numbers. Anything it doesn't know becomes a marked open question for you to answer.",
            ],
            [
              "Forms stay empty.",
              "Templates and procedures get drafted. Forms and registers get built as empty structures; filling one in advance would fabricate a quality record.",
            ],
            [
              "Everything is audited.",
              `Keys are admin-approved, expire after ${AGENT_TOKEN_TTL_DAYS} days, are revocable at any time, and every action appears in your Activity log against the person who created the key.`,
            ],
          ].map(([t, d]) => (
            <li key={t} className="flex gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
              <span>
                <b className="text-teal-900">{t}</b> {d}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
