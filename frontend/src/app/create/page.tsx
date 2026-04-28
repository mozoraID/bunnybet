"use client";

import { useState }    from "react";
import { useRouter }   from "next/navigation";
import { useAccount, useWriteContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import toast             from "react-hot-toast";
import {
  CalendarDays, ImageIcon, Tag, FileText, HelpCircle,
  Zap, AlertTriangle, DollarSign,
} from "lucide-react";
import { FACTORY_ADDRESS, FACTORY_ABI, txUrl } from "@/lib/contracts";
import { CATEGORIES } from "@/types/market";
import { cn } from "@/lib/utils";

const CATS = CATEGORIES.filter((c) => c !== "All");

function getMinEnd(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

export default function CreatePage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { writeContract, isPending } = useWriteContract();

  const [form, setForm] = useState({
    question: "", description: "", imageUrl: "",
    category: "Crypto", endDate: "",
  });
  const [imgErr, setImgErr] = useState(false);

  const up = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Validation
  const errors: Record<string, string> = {};
  if (form.question.length > 0 && form.question.length < 10)
    errors.question = "Min 10 characters";
  if (form.question.length > 200)
    errors.question = "Max 200 characters";
  if (form.endDate && new Date(form.endDate) <= new Date(Date.now() + 30 * 60 * 1000))
    errors.endDate = "Must be at least 30 minutes in the future";

  const isValid = form.question.length >= 10 && !!form.endDate
    && !errors.question && !errors.endDate;

  function handleSubmit() {
    if (!isValid || !isConnected) return;
    const end = BigInt(Math.floor(new Date(form.endDate).getTime() / 1000));

    writeContract(
      {
        address:      FACTORY_ADDRESS,
        abi:          FACTORY_ABI,
        functionName: "createMarket",
        args:         [form.question, form.description, form.imageUrl, form.category, end],
      },
      {
        onSuccess: (hash) => {
          toast.success(
            <span>
              Market created!{" "}
              <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="underline">
                View tx
              </a>
            </span>
          );
          setTimeout(() => router.push("/"), 3_000);
        },
        onError: (e) => toast.error(e.message.split("(")[0].slice(0, 100)),
      }
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 pb-24 md:pb-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Create Market</h1>
        <p className="text-secondary text-sm">
          Set up a binary Yes/No prediction market. All trades settle in{" "}
          <span className="text-green font-semibold">USDM</span>.
        </p>
      </div>

      {!isConnected ? (
        <div className="rounded-xl border border-border bg-bg-2 p-10 text-center space-y-4">
          <div className="text-4xl">🐰</div>
          <p className="text-secondary">Connect your wallet to create a market.</p>
          <ConnectButton />
        </div>
      ) : (
        <div className="space-y-5">

          <Field label="Question" icon={<HelpCircle size={14} />} required
            hint={`${form.question.length}/200`} error={errors.question}
          >
            <textarea
              rows={3}
              placeholder='e.g. "Will Bitcoin hit $200k by end of 2025?"'
              value={form.question}
              onChange={(e) => up("question", e.target.value)}
              className="w-full bg-bg-3 border border-border rounded-lg px-4 py-3 text-sm text-white placeholder-tertiary resize-none focus:border-green/35 transition-colors"
              maxLength={200}
            />
          </Field>

          <Field label="Resolution Criteria" icon={<FileText size={14} />}
            hint="How and when does this resolve?"
          >
            <textarea
              rows={4}
              placeholder="Describe the resolution source and criteria clearly…"
              value={form.description}
              onChange={(e) => up("description", e.target.value)}
              className="w-full bg-bg-3 border border-border rounded-lg px-4 py-3 text-sm text-white placeholder-tertiary resize-none focus:border-green/35 transition-colors"
              maxLength={2000}
            />
          </Field>

          <Field label="Category" icon={<Tag size={14} />}>
            <div className="flex flex-wrap gap-2">
              {CATS.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => up("category", cat)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium transition-all border",
                    form.category === cat
                      ? "bg-green text-bg border-green font-bold shadow-green-sm"
                      : "bg-bg-3 text-secondary border-border hover:text-white hover:border-border-hi"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </Field>

          <Field label="End Date" icon={<CalendarDays size={14} />} required
            hint="Trading closes at this time" error={errors.endDate}
          >
            <input
              type="datetime-local"
              value={form.endDate}
              onChange={(e) => up("endDate", e.target.value)}
              min={getMinEnd()}
              className="w-full bg-bg-3 border border-border rounded-lg px-4 py-3 text-sm text-white focus:border-green/35 transition-colors"
            />
          </Field>

          <Field label="Cover Image URL" icon={<ImageIcon size={14} />} hint="Optional">
            <input
              type="url"
              placeholder="https://example.com/image.jpg"
              value={form.imageUrl}
              onChange={(e) => { up("imageUrl", e.target.value); setImgErr(false); }}
              className="w-full bg-bg-3 border border-border rounded-lg px-4 py-3 text-sm text-white placeholder-tertiary focus:border-green/35 transition-colors"
            />
            {form.imageUrl && !imgErr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.imageUrl}
                alt="preview"
                className="mt-2 h-28 w-full object-cover rounded-lg border border-border"
                onError={() => setImgErr(true)}
              />
            )}
          </Field>

          {/* Fee info */}
          <div className="rounded-lg border border-green/15 bg-green/5 p-4 text-xs text-secondary space-y-1.5">
            <p className="text-green font-semibold flex items-center gap-1.5">
              <DollarSign size={12} /> Fee Structure
            </p>
            <p>• <strong className="text-white">2%</strong> platform + <strong className="text-white">1%</strong> creator fee on every trade</p>
            <p>• You earn <strong className="text-green">1% of all volume</strong> as creator — claimable anytime</p>
            <p>• You resolve the market after the end date</p>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!isValid || isPending}
            className={cn(
              "w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all",
              isValid && !isPending
                ? "bg-green text-bg hover:brightness-110 shadow-green-sm"
                : "bg-bg-3 text-tertiary cursor-not-allowed border border-border"
            )}
          >
            {isPending
              ? <><span className="animate-spin">◌</span> Creating…</>
              : <><Zap size={15} /> Create Market</>
            }
          </button>

        </div>
      )}
    </div>
  );
}

function Field({
  label, icon, required, hint, error, children,
}: {
  label:     string;
  icon?:     React.ReactNode;
  required?: boolean;
  hint?:     string;
  error?:    string;
  children:  React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium text-white flex items-center gap-1.5">
          {icon}
          {label}
          {required && <span className="text-red text-xs">*</span>}
        </label>
        {hint && <span className="text-xs text-tertiary">{hint}</span>}
      </div>
      {children}
      {error && (
        <p className="text-xs text-red mt-1 flex items-center gap-1">
          <AlertTriangle size={11} /> {error}
        </p>
      )}
    </div>
  );
}
