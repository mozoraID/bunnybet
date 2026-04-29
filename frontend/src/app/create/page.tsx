"use client";

import { useState }    from "react";
import { useRouter }   from "next/navigation";
import { useAccount, useWriteContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import toast             from "react-hot-toast";
import { FACTORY_ADDRESS, FACTORY_ABI, txUrl } from "@/lib/contracts";
import { CATEGORIES } from "@/types/market";
import { cn } from "@/lib/utils";

const CATS = CATEGORIES.filter((c) => c !== "All");

function minEnd() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

export default function CreatePage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { writeContract, isPending } = useWriteContract();
  const [form, setForm] = useState({ question: "", description: "", imageUrl: "", category: "Crypto", endDate: "" });
  const [imgErr, setImgErr] = useState(false);

  const up = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const errors: Record<string, string> = {};
  if (form.question.length > 0 && form.question.length < 10) errors.question = "MIN 10 CHARACTERS";
  if (form.question.length > 200) errors.question = "MAX 200 CHARACTERS";
  if (form.endDate && new Date(form.endDate) <= new Date(Date.now() + 30 * 60 * 1000))
    errors.endDate = "MUST BE 30+ MINUTES IN THE FUTURE";

  const isValid = form.question.length >= 10 && !!form.endDate && !errors.question && !errors.endDate;

  function submit() {
    if (!isValid || !isConnected) return;
    const end = BigInt(Math.floor(new Date(form.endDate).getTime() / 1000));
    writeContract(
      { address: FACTORY_ADDRESS, abi: FACTORY_ABI, functionName: "createMarket",
        args: [form.question, form.description, form.imageUrl, form.category, end] },
      {
        onSuccess: (hash) => {
          toast.success(<span>CREATED! <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="underline">VIEW TX</a></span>);
          setTimeout(() => router.push("/"), 3000);
        },
        onError: (e) => toast.error(e.message.split("(")[0].slice(0, 100)),
      }
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 pb-24 md:pb-10">
      <div className="mb-8 border-b border-border-dark pb-8">
        <h1 className="font-sans font-black text-off-white uppercase mb-2"
          style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", lineHeight: "0.95", letterSpacing: "-0.02em" }}>
          CREATE<br />MARKET
        </h1>
        <p className="font-mono text-xs text-dim-2">
          BINARY YES/NO MARKET. ALL TRADES IN USDM.
          EARN 1% OF ALL VOLUME AS CREATOR.
        </p>
      </div>

      {!isConnected ? (
        <div className="terminal-box p-8 text-center space-y-4">
          <p className="font-mono text-xs text-dim-2 tracking-widest">CONNECT WALLET TO CONTINUE</p>
          <ConnectButton />
        </div>
      ) : (
        <div className="space-y-5">

          <Field label="QUESTION" hint={`${form.question.length}/200`} required error={errors.question}>
            <textarea rows={3}
              placeholder='E.G. "WILL BITCOIN HIT $200K BY END OF 2025?"'
              value={form.question} onChange={(e) => up("question", e.target.value)}
              className="w-full bg-ink-3 border border-border-dark px-4 py-3 font-mono text-xs text-off-white placeholder-dim-2 resize-none focus:border-off-white/30 tracking-wide transition-colors"
              maxLength={200}
            />
          </Field>

          <Field label="RESOLUTION CRITERIA" hint="OPTIONAL">
            <textarea rows={4} placeholder="DESCRIBE HOW AND WHEN THIS MARKET RESOLVES..."
              value={form.description} onChange={(e) => up("description", e.target.value)}
              className="w-full bg-ink-3 border border-border-dark px-4 py-3 font-mono text-xs text-off-white placeholder-dim-2 resize-none focus:border-off-white/30 tracking-wide transition-colors"
              maxLength={2000}
            />
          </Field>

          <Field label="CATEGORY">
            <div className="flex flex-wrap gap-1.5">
              {CATS.map((cat) => (
                <button key={cat} type="button" onClick={() => up("category", cat)}
                  className={cn("px-3 py-1.5 font-mono text-xs tracking-widest border transition-all",
                    form.category === cat ? "bg-off-white text-ink border-off-white font-bold" : "border-border-dark text-dim-2 hover:text-off-white")}>
                  {cat.toUpperCase()}
                </button>
              ))}
            </div>
          </Field>

          <Field label="END DATE / TIME" required hint="TRADING CLOSES AT THIS TIME" error={errors.endDate}>
            <input type="datetime-local" value={form.endDate}
              onChange={(e) => up("endDate", e.target.value)} min={minEnd()}
              className="w-full bg-ink-3 border border-border-dark px-4 py-3 font-mono text-xs text-off-white focus:border-off-white/30 transition-colors"
            />
          </Field>

          <Field label="COVER IMAGE URL" hint="OPTIONAL">
            <input type="url" placeholder="HTTPS://EXAMPLE.COM/IMAGE.JPG" value={form.imageUrl}
              onChange={(e) => { up("imageUrl", e.target.value); setImgErr(false); }}
              className="w-full bg-ink-3 border border-border-dark px-4 py-3 font-mono text-xs text-off-white placeholder-dim-2 focus:border-off-white/30 transition-colors"
            />
            {form.imageUrl && !imgErr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.imageUrl} alt="preview" className="mt-2 h-24 w-full object-cover" onError={() => setImgErr(true)} />
            )}
          </Field>

          {/* Fee info */}
          <div className="terminal-box p-4 font-mono text-xs space-y-1">
            <div className="text-off-white font-bold tracking-widest mb-2">FEE STRUCTURE</div>
            <div className="text-dim-2">PLATFORM FEE: 2% PER TRADE → PROTOCOL</div>
            <div className="text-dim-2">CREATOR FEE:  1% PER TRADE → YOU (CLAIMABLE ANYTIME)</div>
            <div className="text-dim-2">NET TO POOL:  97% OF EACH TRADE</div>
          </div>

          <button onClick={submit} disabled={!isValid || isPending}
            className={cn("w-full py-4 font-mono text-xs tracking-widest font-bold transition-all",
              isValid && !isPending
                ? "bg-off-white text-ink hover:bg-cream"
                : "bg-ink-4 text-dim-2 cursor-not-allowed border border-border-dark")}>
            {isPending ? "CREATING..." : "+ CREATE MARKET"}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, required, error, children }: {
  label: string; hint?: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="font-mono text-xs text-dim-2 tracking-widest">
          {label}{required && <span className="text-off-white/60 ml-1">*</span>}
        </label>
        {hint && <span className="font-mono text-[10px] text-dim-2/60">{hint}</span>}
      </div>
      {children}
      {error && <p className="font-mono text-[10px] text-off-white/60 mt-1">⚠ {error}</p>}
    </div>
  );
}
