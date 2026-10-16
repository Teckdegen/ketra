"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { PortionButtons } from "../portion";
import { compact, isoDate, money, percent, shortAddress, stamp } from "@/lib/format";
import { HISTORY_RANGES, type HistoryKind, type HistoryMetric, type HistoryRange, type HistorySeries } from "@/lib/history";
import { BSPY_MARKET_ID, type MarketSnapshot, type VaultSnapshot } from "@/lib/morpho";
import { playTransaction } from "@/lib/sound";
import { displayAmount, parseAmount } from "@/lib/amount";
import { tokenById } from "@/lib/tokens";
import { balanceOf, useWallet } from "@/lib/use-wallet";

const EXPLORER = "https://robinhoodchain.blockscout.com";

function Logo({ src, alt, className = "h-5 w-5" }: { src: string | null; alt: string; className?: string }) {
  if (!src) return null;
  return <img src={src} alt={alt} className={`${className} rounded-full bg-white object-contain`} />;
}

function Badge({ logo, children }: { logo?: string | null; children: React.ReactNode }) {
  return (
    <span className="glass inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] text-[#3a3a3a]">
      <Logo src={logo ?? null} alt="" />
      {children}
    </span>
  );
}

const rangeLabel: Record<HistoryRange, string> = { "30m": "30m", "24h": "24h", "7d": "7D", "1m": "1M", "1y": "1Y" };

function clock(seconds: number, range: HistoryRange) {
  const iso = new Date(seconds * 1000).toISOString();
  if (range === "30m" || range === "24h" || range === "7d") return `${iso.slice(5, 10)} ${iso.slice(11, 16)}`;
  return iso.slice(0, 10);
}

function Chart({ kind, id, metric, format }: { kind: HistoryKind; id: string; metric: HistoryMetric; format: (value: number) => string }) {
  const gradient = useId().replace(/:/g, "");
  const [range, setRange] = useState<HistoryRange>("7d");
  const [result, setResult] = useState<{ request: string; series: HistorySeries | null; failed: boolean } | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const request = `/api/history?kind=${kind}&id=${id}&metric=${metric}&range=${range}`;
  const current = result?.request === request ? result : null;
  const series = current?.series ?? null;
  const failed = current?.failed ?? false;

  useEffect(() => {
    const controller = new AbortController();
    fetch(request, { signal: controller.signal })
      .then((response) => response.json())
      .then((next: HistorySeries) => {
        setHover(null);
        setResult({ request, series: next, failed: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ request, series: null, failed: true });
      });
    return () => controller.abort();
  }, [request]);

  const width = 720;
  const height = 210;
  const plot = { left: 8, right: 84, top: 16, bottom: 12 };
  const points = series?.points ?? [];
  const start = series?.start ?? 0;
  const end = series?.end ?? 1;
  const values = points.map((point) => point.y);
  const low = values.length ? Math.min(...values) : 0;
  const high = values.length ? Math.max(...values) : 1;
  const pad = high === low ? Math.abs(high) * 0.004 || 1 : (high - low) * 0.08;
  const min = low - pad;
  const max = high + pad;
  const span = max - min || 1;
  const xAt = (time: number) => plot.left + ((time - start) / Math.max(end - start, 1)) * (width - plot.left - plot.right);
  const yAt = (value: number) => plot.top + (1 - (value - min) / span) * (height - plot.top - plot.bottom);
  const ticks = [max, min + span / 2, min];
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${xAt(point.x).toFixed(1)},${yAt(point.y).toFixed(1)}`).join(" ");
  const floor = height - plot.bottom;
  const area = points.length > 1 ? `${line} L${xAt(points[points.length - 1].x).toFixed(1)},${floor} L${xAt(points[0].x).toFixed(1)},${floor} Z` : "";
  const active = hover != null ? points[hover] : null;
  const marks = series ? [start, start + (end - start) / 2, end] : [];

  function move(event: React.PointerEvent<SVGSVGElement>) {
    if (points.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    let best = Infinity;
    points.forEach((point, index) => {
      const distance = Math.abs(xAt(point.x) - x);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    setHover(nearest);
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap justify-end gap-1">
        {HISTORY_RANGES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setHover(null);
              setRange(item);
            }}
            className={`rounded-full px-2.5 py-1 text-[12px] ${range === item ? "bg-[#111] text-white" : "text-[#8a8a8a]"}`}
          >
            {rangeLabel[item]}
          </button>
        ))}
      </div>
      {failed ? <p className="py-10 text-[13px] text-[#8a8a8a]">Morpho did not return this window.</p> : null}
      {!failed && points.length === 0 ? <p className="py-10 text-[13px] text-[#8a8a8a]">{series ? "No prints in this window." : "Loading this window."}</p> : null}
      {points.length > 0 && series ? (
        <>
          <div className="relative">
            {active ? (
              <div
                className="glass-field pointer-events-none absolute top-0 z-10 rounded-lg px-2 py-1 text-[12px]"
                style={{ left: `${Math.min(84, Math.max(16, (xAt(active.x) / width) * 100))}%`, transform: "translateX(-50%)" }}
              >
                <span className="block font-medium">{format(active.y)}</span>
                <span className="block text-[#8a8a8a]">{clock(active.x, range)} UTC</span>
              </div>
            ) : null}
            <svg viewBox={`0 0 ${width} ${height}`} className="h-52 w-full touch-none" onPointerMove={move} onPointerLeave={() => setHover(null)}>
              <defs>
                <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#111" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="#111" stopOpacity="0" />
                </linearGradient>
              </defs>
              {ticks.map((tick) => (
                <g key={tick}>
                  <line x1={plot.left} x2={width - plot.right} y1={yAt(tick)} y2={yAt(tick)} stroke="#e6e6e6" strokeWidth="1" />
                  <text x={width - 4} y={yAt(tick) + 4} textAnchor="end" fill="#8a8a8a" fontSize="12">
                    {format(tick)}
                  </text>
                </g>
              ))}
              {area ? <path d={area} fill={`url(#${gradient})`} /> : null}
              {line ? <path d={line} fill="none" stroke="#111" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /> : null}
              {points.length === 1 ? <circle cx={xAt(points[0].x)} cy={yAt(points[0].y)} r="3.5" fill="#111" /> : null}
              {active ? (
                <>
                  <line x1={xAt(active.x)} x2={xAt(active.x)} y1={plot.top} y2={floor} stroke="#111" strokeOpacity="0.25" strokeDasharray="3 3" />
                  <circle cx={xAt(active.x)} cy={yAt(active.y)} r="4" fill="#fff" stroke="#111" strokeWidth="2" />
                </>
              ) : null}
            </svg>
          </div>
          <div className="mt-1 grid grid-cols-3 text-[12px] text-[#8a8a8a]">
            {marks.map((mark, index) => (
              <span key={mark} className={index === 1 ? "text-center" : index === 2 ? "text-right" : ""}>
                {clock(mark, range)}
              </span>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value?: string; detail?: React.ReactNode }) {
  return (
    <div>
      <p className="text-[12px] text-[#8a8a8a]">{label}</p>
      {value ? <p className="mt-1 text-[1.35rem] font-medium tracking-[-0.03em]">{value}</p> : null}
      {detail ? <div className="mt-1 text-[12px] text-[#8a8a8a]">{detail}</div> : null}
    </div>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-[#f2f2f2] py-3 text-[14px] first:border-t-0">
      <span className="text-[#8a8a8a]">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function Address({ value }: { value: string }) {
  if (!value || /^0x0{40}$/i.test(value)) return <span>No address</span>;
  return (
    <a href={`${EXPLORER}/address/${value}`} className="underline decoration-[#ddd] underline-offset-2">
      {shortAddress(value)}
    </a>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-[28px] p-5">
      <h2 className="text-[15px] font-medium">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function DepositCard({
  asset,
  apy,
  disabled,
  kind,
  note,
  disabledLabel = "Deposits are disabled",
}: {
  asset: string;
  apy: number;
  disabled: boolean;
  kind: "morpho" | "steakhouse";
  note: string;
  disabledLabel?: string;
}) {
  const router = useRouter();
  const { data } = useWallet();
  const [amount, setAmount] = useState("");
  const parsed = Number(amount);
  const sized = Number.isFinite(parsed) ? parsed : 0;
  const usdg = tokenById("USDG")!;
  const balance = balanceOf(data, usdg);
  const raw = parseAmount(amount.trim(), usdg.decimals);
  const short = raw != null && balance != null && raw > (parseAmount(balance, usdg.decimals) ?? 0n);

  function review(event: React.FormEvent) {
    event.preventDefault();
    if (disabled || !amount.trim() || short) return;
    playTransaction();
    router.push(`/sign?${new URLSearchParams({ kind, amount: amount.trim() }).toString()}`);
  }

  return (
    <form onSubmit={review} className="glass rounded-[28px] p-4 lg:sticky lg:top-6">
      <p className="text-[13px] font-medium">Deposit {asset}</p>
      <p className="mt-1 text-[12px] leading-5 text-[#8a8a8a]">{note}</p>
      <input
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        inputMode="decimal"
        placeholder="0.00"
        className="mt-3 w-full bg-transparent text-[2rem] leading-none font-medium tracking-[-0.04em] outline-none placeholder:text-[#dedede]"
      />
      <div className="mt-2 flex items-center justify-between text-[12px] text-[#8a8a8a]">
        <span className={short ? "text-[#b4471c]" : ""}>
          Balance {balance == null ? "…" : displayAmount(balance)} {asset}
        </span>
        <PortionButtons onAmount={setAmount} balance={balance} decimals={usdg.decimals} />
      </div>
      <div className="mt-4">
        <Row label="Network" value="Robinhood Chain" />
        <Row label="APY" value={percent(apy)} />
        <Row label="Projected monthly" value={money((sized * apy) / 12)} />
        <Row label="Projected yearly" value={money(sized * apy)} />
      </div>
      <button
        type="submit"
        disabled={disabled || !amount.trim() || short}
        className="mt-4 w-full glass-item rounded-xl py-3 text-[14px] text-[#9a9a9a] enabled:bg-black enabled:text-white"
      >
        {disabled ? disabledLabel : !amount.trim() ? "Enter an amount" : short ? `Not enough ${asset}` : "Review"}
      </button>
    </form>
  );
}

const tabs = ["Overview", "Allocation", "Performance", "Risk", "Activity"] as const;

export function VaultView({ vault }: { vault: VaultSnapshot }) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  const logos = vault.markets.map((market) => market.collateralLogo).filter((logo): logo is string => Boolean(logo));
  const title = vault.name.replace(new RegExp(`\\s${vault.assetSymbol}$`), "");

  return (
    <div>
      <Link href="/supply" className="text-[13px] text-[#8a8a8a]">
        Supply
      </Link>
      <div className="mt-3 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <Logo src={vault.image} alt={vault.curatorName} className="h-10 w-10" />
            <h1 className="text-[2rem] font-medium tracking-[-0.04em]">
              {title} <span className="text-[#b0b0b0]">{vault.assetSymbol}</span>
            </h1>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge>{vault.chain}</Badge>
            <Badge logo={vault.curatorImage}>{vault.curatorName}</Badge>
            <Badge logo={vault.assetLogo}>{vault.assetSymbol}</Badge>
          </div>
          <p className="mt-4 max-w-2xl text-[14px] leading-6 text-[#6f6f6f]">{vault.description}</p>
          {vault.warning ? <p className="mt-3 text-[13px] text-[#9a3b3b]">{vault.warning}</p> : null}

          <div className="mt-6 grid grid-cols-2 gap-5 glass rounded-[28px] p-5 sm:grid-cols-4">
            <Stat label="Total deposits" value={money(vault.totalUsd)} detail={`${compact(vault.totalTokens)} ${vault.assetSymbol}`} />
            <Stat label="Liquidity" value={money(vault.liquidityUsd)} />
            <Stat
              label="Exposure"
              detail={
                <span className="mt-1 flex">
                  {logos.map((logo) => (
                    <img key={logo} src={logo} alt="" className="-ml-1.5 h-6 w-6 rounded-full bg-white object-contain ring-2 ring-white first:ml-0" />
                  ))}
                </span>
              }
            />
            <Stat label="Net APY" value={percent(vault.netApy)} />
          </div>

          <div className="mt-6 flex gap-5 overflow-x-auto border-b border-[#ececec] text-[14px]">
            {tabs.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={`shrink-0 border-b-2 pb-2 ${tab === item ? "border-black font-medium" : "border-transparent text-[#8a8a8a]"}`}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-4">
            {tab === "Overview" ? (
              <>
                <Panel title="Vault configuration">
                  <Row label="Morpho vault version" value="v2" />
                  <Row label="Deployed" value={isoDate(vault.createdAt)} />
                  <Row label="Curator AUM" value={vault.curatorAum == null ? "—" : money(vault.curatorAum)} />
                </Panel>
                <Panel title={`Total deposits (${vault.assetSymbol})`}>
                  <p className="text-[1.6rem] font-medium tracking-[-0.03em]">{money(vault.totalUsd)}</p>
                  <Chart kind="vault" id={vault.address} metric="supply" format={money} />
                </Panel>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
                  <Panel title="Net APY">
                    <p className="text-[1.6rem] font-medium tracking-[-0.03em]">{percent(vault.netApy)}</p>
                    <Chart kind="vault" id={vault.address} metric="apy" format={percent} />
                  </Panel>
                  <Panel title="APY breakdown">
                    <Row label="Native APY" value={percent(vault.nativeApy)} />
                    <Row label="Net APY" value={percent(vault.netApy)} />
                  </Panel>
                </div>
              </>
            ) : null}

            {tab === "Allocation" ? (
              <Panel title="Markets">
                <div className="overflow-x-auto">
                  <div className="grid min-w-[720px] grid-cols-[1.5fr_0.7fr_0.8fr_0.8fr_0.6fr] py-2 text-[12px] text-[#8a8a8a]">
                    <span>Market</span>
                    <span>Allocation</span>
                    <span>Allocated</span>
                    <span>Liquidity</span>
                    <span>APY</span>
                  </div>
                  {vault.markets.map((market) => (
                    <Link
                      key={market.id}
                      href={`/supply/${market.id}`}
                      className="grid min-w-[720px] grid-cols-[1.5fr_0.7fr_0.8fr_0.8fr_0.6fr] items-center border-t border-[#f2f2f2] py-3"
                    >
                      <span className="flex items-center gap-2">
                        <span className="flex">
                          <Logo src={market.collateralLogo} alt={market.collateralSymbol} className="h-6 w-6" />
                          <Logo src={market.loanLogo} alt={market.loanSymbol} className="-ml-1.5 h-6 w-6" />
                        </span>
                        <span>
                          <span className="block text-[14px] font-medium">
                            {market.collateralSymbol} / {market.loanSymbol}
                          </span>
                          <span className="block text-[12px] text-[#8a8a8a]">{market.collateralName}</span>
                        </span>
                      </span>
                      <span className="text-[14px]">{percent(market.allocation)}</span>
                      <span className="text-[14px]">{money(market.supplyUsd)}</span>
                      <span className="text-[14px]">{money(market.liquidityUsd)}</span>
                      <span className="text-[14px]">{percent(market.apy)}</span>
                    </Link>
                  ))}
                  <div className="grid min-w-[720px] grid-cols-[1.5fr_0.7fr_0.8fr_0.8fr_0.6fr] items-center border-t border-[#f2f2f2] py-3">
                    <span className="text-[14px] font-medium">Idle {vault.assetSymbol}</span>
                    <span className="text-[14px]">{percent(vault.totalUsd > 0 ? vault.idleUsd / vault.totalUsd : 0)}</span>
                    <span className="text-[14px]">{money(vault.idleUsd)}</span>
                    <span className="text-[14px]">{money(vault.idleUsd)}</span>
                    <span className="text-[14px]">{percent(0)}</span>
                  </div>
                </div>
              </Panel>
            ) : null}

            {tab === "Performance" ? (
              <Panel title={`Share price (${vault.assetSymbol})`}>
                <p className="text-[1.6rem] font-medium tracking-[-0.03em]">{vault.sharePrice.toFixed(6)}</p>
                <Chart kind="vault" id={vault.address} metric="price" format={(value) => value.toFixed(6)} />
              </Panel>
            ) : null}

            {tab === "Risk" ? (
              <>
                <Panel title="Returns">
                  <Row label="Instant APY" value={percent(vault.netApy)} />
                  <Row label="7D APY" value={percent(vault.weeklyApy)} />
                  <Row label="30D APY" value={percent(vault.monthlyApy)} />
                  <Row label="90D APY" value={percent(vault.ninetyApy)} />
                </Panel>
                <Panel title="Fees">
                  <Row label="Performance fee" value={percent(vault.performanceFee)} />
                  <Row label="Management fee" value={percent(vault.managementFee)} />
                  <Row label="Performance fee recipient" value={<Address value={vault.performanceFeeRecipient} />} />
                  <Row label="Management fee recipient" value={<Address value={vault.managementFeeRecipient} />} />
                </Panel>
                <Panel title="Vault roles">
                  <Row label="Owner" value={<Address value={vault.owner} />} />
                  <Row label="Curator" value={<Address value={vault.curatorAddress} />} />
                  {vault.sentinels.map((sentinel, index) => (
                    <Row key={sentinel} label={`Sentinel ${index + 1}`} value={<Address value={sentinel} />} />
                  ))}
                </Panel>
                <Panel title="Allocators">
                  {vault.allocators.map((allocator, index) => (
                    <Row key={allocator} label={`Allocator ${index + 1}`} value={<Address value={allocator} />} />
                  ))}
                </Panel>
              </>
            ) : null}

            {tab === "Activity" ? (
              <>
                <Panel title="Largest deposits">
                  {vault.holders.map((holder) => (
                    <Row
                      key={holder.address}
                      label={<Address value={holder.address} />}
                      value={
                        <span>
                          {money(holder.assetsUsd)} <span className="text-[#8a8a8a]">{percent(holder.share)}</span>
                        </span>
                      }
                    />
                  ))}
                </Panel>
                <Panel title="Transactions">
                  <div className="overflow-x-auto">
                    <div className="grid min-w-[560px] grid-cols-[1.2fr_0.7fr_0.8fr_0.9fr] py-2 text-[12px] text-[#8a8a8a]">
                      <span>Time</span>
                      <span>Type</span>
                      <span>Amount</span>
                      <span>User</span>
                    </div>
                    {vault.txs.map((tx) => (
                      <a
                        key={`${tx.hash}-${tx.type}-${tx.amount}`}
                        href={`${EXPLORER}/tx/${tx.hash}`}
                        className="grid min-w-[560px] grid-cols-[1.2fr_0.7fr_0.8fr_0.9fr] border-t border-[#f2f2f2] py-3 text-[13px]"
                      >
                        <span>{stamp(tx.timestamp)}</span>
                        <span>{tx.type}</span>
                        <span>
                          {compact(tx.amount)} {vault.assetSymbol}
                        </span>
                        <span>{shortAddress(tx.user)}</span>
                      </a>
                    ))}
                  </div>
                </Panel>
              </>
            ) : null}
          </div>
        </div>

        <DepositCard
          asset={vault.assetSymbol}
          apy={vault.netApy}
          disabled={false}
          kind="steakhouse"
          note="Shares come back to the account."
        />
      </div>
    </div>
  );
}

export function MarketView({ market, vault }: { market: MarketSnapshot; vault: VaultSnapshot | null }) {
  const allocation = vault?.markets.find((item) => item.id.toLowerCase() === market.id.toLowerCase());
  const wired = market.id.toLowerCase() === BSPY_MARKET_ID.toLowerCase();
  const steakhouseName = market.supplyingVaults.find((name) => /steakhouse/i.test(name)) ?? null;
  const steakhouse = Boolean(steakhouseName && vault && steakhouseName.toLowerCase() === vault.name.toLowerCase());
  const listed = !wired && !steakhouse;
  return (
    <div>
      <Link href="/supply" className="text-[13px] text-[#8a8a8a]">
        Supply
      </Link>
      <div className="mt-3 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex">
              <Logo src={market.collateralLogo} alt={market.collateralSymbol} className="h-10 w-10" />
              <Logo src={market.loanLogo} alt={market.loanSymbol} className={`${market.collateralLogo ? "-ml-2" : ""} h-10 w-10`} />
            </span>
            <h1 className="text-[2rem] font-medium tracking-[-0.04em]">
              {market.collateralSymbol} <span className="text-[#b0b0b0]">/ {market.loanSymbol}</span>
            </h1>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge>Robinhood Chain</Badge>
            <Badge logo={market.loanLogo}>{market.loanSymbol}</Badge>
            {market.collateralLogo ? <Badge logo={market.collateralLogo}>{market.collateralSymbol}</Badge> : <Badge>{market.collateralSymbol}</Badge>}
          </div>
          <p className="mt-4 max-w-2xl text-[14px] leading-6 text-[#6f6f6f]">
            {market.loanSymbol} supplied against {market.collateralName || market.collateralSymbol} on Morpho.
            {allocation ? ` ${vault?.name} has ${money(allocation.supplyUsd)} in this market.` : wired ? " The account can supply this market directly." : ""}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-5 glass rounded-[28px] p-5 sm:grid-cols-4">
            <Stat label="Total supply" value={money(market.supplyUsd)} detail={`${compact(market.supplyTokens)} ${market.loanSymbol}`} />
            <Stat label="Liquidity" value={money(market.liquidityUsd)} />
            <Stat label="LLTV" value={percent(market.lltv)} />
            <Stat label="Supply APY" value={percent(market.apy)} />
          </div>

          <div className="mt-5 space-y-4">
            <Panel title={`Supply (${market.loanSymbol})`}>
              <p className="text-[1.6rem] font-medium tracking-[-0.03em]">{money(market.supplyUsd)}</p>
              <Chart kind="market" id={market.id} metric="supply" format={money} />
            </Panel>
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Supply APY">
                <p className="text-[1.6rem] font-medium tracking-[-0.03em]">{percent(market.apy)}</p>
                <Chart kind="market" id={market.id} metric="apy" format={percent} />
              </Panel>
              <Panel title="Market">
                <Row label="Utilization" value={percent(market.utilization)} />
                <Row label="Borrowed" value={money(market.borrowUsd)} />
                <Row label="7D APY" value={percent(market.weeklyApy)} />
                <Row label="30D APY" value={percent(market.monthlyApy)} />
                {allocation ? <Row label="Vault allocation" value={percent(allocation.allocation)} /> : null}
              </Panel>
            </div>
          </div>
        </div>
        <DepositCard
          asset={market.loanSymbol}
          apy={steakhouse ? vault?.netApy ?? market.apy : market.apy}
          disabled={!wired && !steakhouse}
          disabledLabel={listed ? "Not wired" : "Deposits are disabled"}
          kind={wired ? "morpho" : "steakhouse"}
          note={
            wired
              ? "The position is credited to the account."
              : steakhouse
                ? `This deposit goes to ${vault?.name}. The curator allocates the market.`
                : "This market is listed from Morpho. The account is not wired to supply it."
          }
        />
      </div>
    </div>
  );
}
