"use client";
import { useState }    from "react";
import { useRouter }   from "next/navigation";
import { useAccount, useWriteContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import toast             from "react-hot-toast";
import { decodeEventLog, parseAbiItem } from "viem";
import { CalendarDays, ImageIcon, Tag, FileText, HelpCircle, Zap, AlertTriangle } from "lucide-react";
import { FACTORY_ADDRESS, FACTORY_ABI, txUrl } from "@/lib/contracts";
import { CATEGORIES, type Category } from "@/types/market";
import { cn } from "@/lib/utils";

const CATEGORY_OPTIONS = CATEGORIES.filter((c) => c !== "All");

function getMinEnd() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

export default function CreatePage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const [form, setForm] = useState({ question: "", description: "", imageUrl: "", category: "Crypto", endDate: "" });
  const [imgErr, setImgErr] = useState(false);

  const { writeContract, data: txHash, isPending } = useWriteContract();

  const up = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const errors: Record<string, string> = {};
  if (form.question.length > 0 && form.question.length < 10) errors.question = "Min 10 characters";
  if (form.question.length > 200) errors.question = "Max 200 characters";
  if (form.endDate && new Date(form.endDate) <= new Date(Date.now() + 30 * 60 * 1000)) errors.endDate = "Must be at least 30 minutes in the future";

  const isValid = form.question.length >= 10 && form.endDate && !errors.question && !errors.endDate;

  async function handleSubmit() {
    if (!isValid || !isConnected) return;
    const end = BigInt(Math.floor(new Date(form.endDate).getTime() / 1000));
    writeContract(
      { address: FACTORY_ADDRESS, abi: FACTORY_ABI, functionName: "createMarket",
        args: [form.question, form.description, form.imageUrl, form.category, end] },
      {
        onSuccess: async (hash) => {
          toast.success(<span>Market created! <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="underline">View tx</a></span>);
          // Wait briefly then redirect (tx confirmation)
          await new Promise((r) => setTimeout(r, 3000));
          router.push("/");
        },
        onError: (e) => toast.error(e.message.split("(")[0].slice(0, 100)),
      }
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 pb-24 md:pb-10">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Zap size={16} className="text-cyan animate-pulse" />
          <span className="text-xs font-mono text-cyan/70 uppercase tracking-widest">Create Market</span>
        </div>
        <h1 className="text-2xl font-bold gradient-text">New Prediction Market</h1>
        <p className="text-secondary text-sm mt-1">
          All trades use <span className="text-cyan font-bold">USDM stablecoin</span>. You earn 1% of all trading volume as creator fee.
        </p>
      </div>

      {!isConnected ? (
        <div className="glass rounded-xl p-10 text-center space-y-4">
          <div className="text-4xl">🐰</div>
          <p className="text-secondary">Connect your wallet to create a market.</p>
          <ConnectButton />
        </div>
      ) : (
        <div className="space-y-5">
          <Field label="Question" icon={<HelpCircle size={14} />} required hint={`${form.question.length}/200`} error={errors.question}>
            <textarea rows={3} placeholder='e.g. "Will Bitcoin hit $150k by end of 2025?"'
              value={form.question} onChange={(e) => up("question", e.target.value)}
              className="w-full bg-surface-3 border border-border rounded-lg px-4 py-3 text-sm text-primary placeholder-tertiary resize-none" maxLength={200} />
          </Field>

          <Field label="Resolution Criteria" icon={<FileText size={14} />} hint="Optional — how/when does this market resolve?">
            <textarea rows={4} placeholder="Describe the resolution criteria, sources, and edge cases..."
              value={form.description} onChange={(e) => up("description", e.target.value)}
              className="w-full bg-surface-3 border border-border rounded-lg px-4 py-3 text-sm text-primary placeholder-tertiary resize-none" maxLength={2000} />
          </Field>

          <Field label="Category" icon={<Tag size={14} />}>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((cat) => (
                <button key={cat} type="button" onClick={() => up("category", cat)}
                  className={cn("px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                    form.category === cat ? "bg-cyan text-background font-bold shadow-cyan-glow" : "glass text-secondary border border-border hover:text-primary")}>
                  {cat}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Market End Date" icon={<CalendarDays size={14} />} required error={errors.endDate} hint="Trading closes at this time">
            <input type="datetime-local" value={form.endDate} onChange={(e) => up("endDate", e.target.value)}
              min={getMinEnd()} className="w-full bg-surface-3 border border-border rounded-lg px-4 py-3 text-sm text-primary [color-scheme:dark]" />
          </Field>

          <Field label="Cover Image URL" icon={<ImageIcon size={14} />} hint="Optional — direct image link">
            <input type="url" placeholder="https://example.com/image.jpg" value={form.imageUrl}
              onChange={(e) => { up("imageUrl", e.target.value); setImgErr(false); }}
              className="w-full bg-surface-3 border border-border rounded-lg px-4 py-3 text-sm text-primary placeholder-tertiary" />
            {form.imageUrl && !imgErr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.imageUrl} alt="preview" className="mt-2 h-28 w-full object-cover rounded-lg border border-border" onError={() => setImgErr(true)} />
            )}
          </Field>

          <div className="glass-cyan rounded-lg p-4 text-xs text-secondary">
            <p className="text-cyan font-semibold mb-1">💡 How it works</p>
            <p>• All trades use <strong className="text-cyan">USDM</strong> — no ETH price risk for traders.</p>
            <p>• You earn <strong className="text-primary">1% creator fee</strong> on every trade. Claimable anytime.</p>
            <p>• You resolve this market after the end date by calling resolve(true/false).</p>
          </div>

          <button onClick={handleSubmit} disabled={!isValid || isPending}
            className={cn("w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all",
              isValid && !isPending ? "bg-cyan text-background hover:brightness-110 shadow-cyan-glow" : "bg-surface-3 text-tertiary cursor-not-allowed border border-border")}>
            {isPending ? <><span className="animate-spin">◌</span> Creating...</> : <><Zap size={15} />Create Market</>}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, icon, required, hint, error, children }: {
  label: string; icon?: React.ReactNode; required?: boolean; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium text-primary flex items-center gap-1.5">
          {icon}{label}{required && <span className="text-pink text-xs">*</span>}
        </label>
        {hint && <span className="text-xs text-tertiary">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-xs text-pink mt-1 flex items-center gap-1"><AlertTriangle size={11} />{error}</p>}
    </div>
  );
}
