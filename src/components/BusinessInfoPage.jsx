import React, { useEffect, useState } from "react";
import {
  X,
  Users,
  Palette,
  Image as ImageIcon,
  LayoutTemplate,
  Lock,
  ShieldCheck,
  CheckCircle2,
  MessageSquare,
  History,
  LayoutDashboard,
  ArrowRight,
  Loader2,
  Check,
} from "lucide-react";
import { useSubscription, PRICE_IDS } from "../subscriptionContext";

const FEATURES = [
  {
    icon: Users,
    title: "Team Workspace",
    description: "Invite your team and keep company designs organized in one shared workspace.",
  },
  {
    icon: Palette,
    title: "Company Brand Kit",
    description: "Store your logos, brand colors, fonts, graphics, and other brand assets.",
  },
  {
    icon: ImageIcon,
    title: "Shared Asset Library",
    description: "Give everyone access to approved company images, logos, product photos, videos, and graphics.",
  },
  {
    icon: LayoutTemplate,
    title: "Company Templates",
    description: "Build reusable templates for social posts, presentations, flyers, marketing materials, and more.",
  },
  {
    icon: Lock,
    title: "Brand-Locked Designs",
    description: "Protect logos, colors, and important elements while allowing employees to customize what they need.",
  },
  {
    icon: ShieldCheck,
    title: "Roles & Permissions",
    description: "Control what Owners, Admins, Designers, Editors, and Viewers can access and change.",
  },
  {
    icon: CheckCircle2,
    title: "Design Approvals",
    description: "Let employees submit designs for review before they're finalized.",
  },
  {
    icon: MessageSquare,
    title: "Team Comments",
    description: "Review designs together, leave feedback, reply to comments, and @mention teammates.",
  },
  {
    icon: History,
    title: "Version History",
    description: "View previous versions and restore earlier designs when needed.",
  },
  {
    icon: LayoutDashboard,
    title: "Business Dashboard",
    description: "See recent designs, team activity, pending approvals, shared resources, and workspace usage.",
  },
];

function WorkspaceMockup() {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="h-2 w-16 rounded-full bg-gray-200" />
        <div className="h-4 w-4 rounded-full bg-amber-100" />
      </div>
      <div className="grid grid-cols-3 gap-1">
        <div className="h-8 rounded-md bg-gray-100" />
        <div className="h-8 rounded-md bg-gray-100" />
        <div className="h-8 rounded-md bg-amber-50 ring-1 ring-inset ring-amber-200" />
      </div>
      <div className="h-1.5 w-10/12 rounded-full bg-gray-100" />
      <div className="h-1.5 w-7/12 rounded-full bg-gray-100" />
    </div>
  );
}

function BrandKitMockup() {
  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {["bg-amber-500", "bg-gray-900", "bg-amber-200", "bg-gray-300"].map((c, i) => (
          <div key={i} className={`h-5 w-5 rounded-full ${c}`} />
        ))}
      </div>
      <div className="space-y-1">
        <div className="h-1.5 w-9/12 rounded-full bg-gray-100" />
        <div className="h-1.5 w-6/12 rounded-full bg-gray-100" />
      </div>
      <div className="flex items-center gap-1.5 rounded-md border border-gray-200 px-1.5 py-1">
        <div className="h-3 w-3 rounded-sm bg-gray-900" />
        <div className="h-1.5 w-14 rounded-full bg-gray-100" />
      </div>
    </div>
  );
}

function TeamMockup() {
  return (
    <div className="space-y-1.5">
      {[
        { role: "Owner", w: "w-16" },
        { role: "Admin", w: "w-12" },
        { role: "Designer", w: "w-14" },
      ].map((row, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="h-4 w-4 shrink-0 rounded-full bg-gray-200" />
          <div className={`h-1.5 ${row.w} rounded-full bg-gray-100`} />
          <span className="ml-auto rounded-full bg-amber-50 px-1.5 py-0.5 text-[8px] font-medium text-amber-700">
            {row.role}
          </span>
        </div>
      ))}
    </div>
  );
}

function ApprovalMockup() {
  const steps = ["Draft", "In Review", "Approved"];
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1">
        {steps.map((step, i) => (
          <React.Fragment key={step}>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[8px] font-medium ${
                i === steps.length - 1 ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
              }`}
            >
              {step}
            </span>
            {i < steps.length - 1 && <div className="h-px flex-1 bg-gray-200" />}
          </React.Fragment>
        ))}
      </div>
      <div className="rounded-md border border-gray-200 p-1.5">
        <div className="mb-1 h-1.5 w-8/12 rounded-full bg-gray-100" />
        <div className="h-1.5 w-5/12 rounded-full bg-gray-100" />
      </div>
    </div>
  );
}

const WORKFLOW_STEPS = [
  { label: "Workspace", Mockup: WorkspaceMockup },
  { label: "Brand Kit", Mockup: BrandKitMockup },
  { label: "Team", Mockup: TeamMockup },
  { label: "Approval", Mockup: ApprovalMockup },
];

export default function BusinessInfoPage({ isOpen, onClose }) {
  const { tier: currentTier, openCheckout } = useSubscription();
  const [cycle, setCycle] = useState("monthly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isCurrent = currentTier === "business";
  const price = cycle === "monthly" ? 19.99 : 199.99 / 12;

  async function handleStart() {
    setError(null);
    setLoading(true);
    try {
      await openCheckout(PRICE_IDS.business[cycle]);
    } catch (err) {
      setError(err.message || "Couldn't start checkout. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white" role="dialog" aria-modal="true">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/95 px-6 py-4 backdrop-blur">
        <span className="text-sm font-semibold text-gray-900">Vaycona Business</span>
        <button
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24">
        <section className="mx-auto max-w-2xl pt-16 text-center sm:pt-20">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
            Vaycona Business
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Your entire creative team. One workspace.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-gray-500">
            Give your team everything they need to create, collaborate, and keep every design
            consistent with your brand.
          </p>
          <button
            className="mt-8 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:pointer-events-none disabled:opacity-60"
            onClick={handleStart}
            disabled={isCurrent || loading}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {isCurrent ? "You're on Business" : "Start Vaycona Business"}
            {!isCurrent && !loading && <ArrowRight size={16} />}
          </button>
        </section>

        <section className="mt-20 sm:mt-24">
          <h2 className="text-center text-xs font-semibold uppercase tracking-wide text-gray-400">
            Inside Vaycona Business
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {WORKFLOW_STEPS.map(({ label, Mockup }, i) => (
              <div key={label} className="rounded-xl border border-gray-200 p-3">
                <div className="mb-2.5 flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-[10px] font-semibold text-white">
                    {i + 1}
                  </span>
                  <span className="text-xs font-semibold text-gray-900">{label}</span>
                </div>
                <div className="rounded-lg bg-gray-50 p-2.5">
                  <Mockup />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20 sm:mt-24">
          <p className="text-center text-sm font-medium text-amber-700">Everything in Vaycona Pro, plus:</p>
          <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex gap-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                  <Icon size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
                  <p className="mt-0.5 text-sm leading-relaxed text-gray-500">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20 rounded-2xl border border-gray-200 bg-gray-50 px-6 py-12 text-center sm:mt-24 sm:px-12">
          <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">
            Bring your brand and your team together.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
            Create faster. Stay consistent. Keep everyone on the same page.
          </p>

          <div className="mt-6 flex justify-center">
            <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
              {[
                { key: "monthly", label: "Monthly" },
                { key: "annual", label: "Annual — 2 months free" },
              ].map((option) => (
                <button
                  key={option.key}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                    cycle === option.key ? "bg-amber-100 text-amber-700" : "text-gray-500 hover:bg-gray-100"
                  }`}
                  onClick={() => setCycle(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="mx-auto mt-4 max-w-sm rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="mt-5">
            <span className="text-2xl font-bold text-gray-900">${price.toFixed(2)}</span>
            <span className="text-sm text-gray-400"> / month</span>
            {cycle === "annual" && (
              <div className="text-xs text-gray-400">billed $199.99/year</div>
            )}
          </div>

          <button
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:pointer-events-none disabled:opacity-60"
            onClick={handleStart}
            disabled={isCurrent || loading}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : isCurrent ? <Check size={16} /> : null}
            {isCurrent ? "You're on Business" : "Start Vaycona Business"}
          </button>
        </section>
      </main>
    </div>
  );
}
