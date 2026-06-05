"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  ArrowLeftRight,
  Coins,
  ExternalLink,
  FileText,
  FolderTree,
  Layers,
  Loader2,
  Network,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useHistory } from "@/hooks/useHistory";
import { cn, formatUSD, shortenAddress } from "@/lib/utils";
import type { HistoryEvent, PerpsApiResponse, Portfolio } from "@/types";

type VaultKind = "overview" | "holding" | "protocol" | "chain" | "perp" | "transaction" | "authored";

interface VaultNote {
  id: string;
  kind: VaultKind;
  title: string;
  subtitle: string;
  excerpt: string;
  body?: string;
  valueUsd?: number;
  links: string[];
  tags: string[];
  facts: Array<{ label: string; value: string }>;
  timestamp?: string;
  explorerUrl?: string;
}

interface StoredVaultNote {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface GraphPlacement {
  note: VaultNote;
  x: number;
  y: number;
  depth: number;
  layer: "focus" | "inner" | "outer";
}

const KIND_META: Record<VaultKind, { label: string; icon: LucideIcon }> = {
  overview: { label: "Home", icon: Wallet },
  holding: { label: "Tokens", icon: Coins },
  protocol: { label: "Protocols", icon: Layers },
  chain: { label: "Networks", icon: Network },
  perp: { label: "Trades", icon: ArrowLeftRight },
  transaction: { label: "Transactions", icon: Activity },
  authored: { label: "My Notes", icon: FileText },
};

const FILTERS: Array<{ id: "all" | VaultKind; label: string }> = [
  { id: "all", label: "All notes" },
  { id: "holding", label: "Tokens" },
  { id: "protocol", label: "Protocols" },
  { id: "transaction", label: "Tx history" },
  { id: "chain", label: "Networks" },
  { id: "perp", label: "Trades" },
  { id: "authored", label: "My notes" },
];

function holdingId(aggregateKey: string) {
  return `holding:${aggregateKey}`;
}

function chainId(slug: string) {
  return `chain:${slug}`;
}

function protocolId(id: string, chainSlug: string) {
  return `protocol:${chainSlug}:${id}`;
}

function uniqueLinks(ids: Array<string | undefined>): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

function noteStorageKey(address: string) {
  return `walletfolio-vault-notes:${address.trim().toLowerCase()}`;
}

function formatWhen(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function loadAuthoredNotes(address: string): StoredVaultNote[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(noteStorageKey(address)) ?? "[]") as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((note): note is StoredVaultNote => {
      if (!note || typeof note !== "object") return false;
      const candidate = note as Partial<StoredVaultNote>;
      return typeof candidate.id === "string" && typeof candidate.title === "string" && typeof candidate.content === "string";
    });
  } catch {
    return [];
  }
}

function saveAuthoredNotes(address: string, notes: StoredVaultNote[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(noteStorageKey(address), JSON.stringify(notes));
  }
}

function buildTransactionNote(
  event: HistoryEvent,
  index: number,
  holdingIdsBySymbol: Map<string, string>
): VaultNote {
  const tokenLinks = [event.tokenSymbol, event.toTokenSymbol]
    .filter((symbol): symbol is string => Boolean(symbol))
    .map((symbol) => holdingIdsBySymbol.get(symbol.toUpperCase()))
    .filter((id): id is string => Boolean(id));

  return {
    id: `transaction:${event.id}:${index}`,
    kind: "transaction",
    title: event.description || `${event.type} transaction`,
    subtitle: `${event.chainName} / ${formatWhen(event.timestamp)}`,
    excerpt: `A ${event.type} activity record linked to ${event.chainName}${event.tokenSymbol ? ` and ${event.tokenSymbol}` : ""}.`,
    valueUsd: event.usdValue,
    timestamp: event.timestamp,
    explorerUrl: event.explorerUrl,
    tags: [event.type, event.chainName, event.status, event.tokenSymbol, event.toTokenSymbol]
      .filter((tag): tag is string => Boolean(tag)),
    links: uniqueLinks([chainId(event.chainSlug), ...tokenLinks]),
    facts: [
      { label: "Type", value: event.type },
      { label: "Status", value: event.status },
      { label: "Network", value: event.chainName },
      { label: "Token", value: event.tokenSymbol ?? "Not identified" },
      ...(event.toTokenSymbol ? [{ label: "Received", value: event.toTokenSymbol }] : []),
      ...(event.txHash ? [{ label: "Hash", value: `${event.txHash.slice(0, 10)}...${event.txHash.slice(-6)}` }] : []),
    ],
  };
}

function buildVaultNotes(
  address: string,
  portfolio: Portfolio,
  events: HistoryEvent[],
  perps?: PerpsApiResponse | null
): VaultNote[] {
  const holdingIdsBySymbol = new Map<string, string>();
  for (const holding of portfolio.aggregated) {
    const symbol = holding.symbol.toUpperCase();
    if (!holdingIdsBySymbol.has(symbol)) holdingIdsBySymbol.set(symbol, holdingId(holding.aggregateKey));
  }
  const txNotes = events.map((event, index) => buildTransactionNote(event, index, holdingIdsBySymbol));

  const holdingNotes = portfolio.aggregated.map((holding) => {
    const noteId = holdingId(holding.aggregateKey);
    const positionChains = holding.positions.map((position) => chainId(position.chainSlug));
    const positionProtocols = holding.positions.map((position) =>
      position.protocolId ? protocolId(position.protocolId, position.chainSlug) : undefined
    );
    const relatedTxs = txNotes
      .filter((note) => note.links.includes(noteId))
      .slice(0, 8)
      .map((note) => note.id);

    return {
      id: noteId,
      kind: "holding" as const,
      title: holding.symbol,
      subtitle: holding.name,
      excerpt: `${holding.symbol} is held across ${holding.positions.length} tracked position${holding.positions.length === 1 ? "" : "s"}.`,
      valueUsd: holding.totalUsdValue,
      tags: [
        holding.isStablecoin ? "stablecoin" : "token",
        holding.walletUsdValue > 0 ? "wallet" : undefined,
        holding.defiUsdValue > 0 ? "defi" : undefined,
      ].filter((tag): tag is string => Boolean(tag)),
      links: uniqueLinks([...positionChains, ...positionProtocols, ...relatedTxs]),
      facts: [
        { label: "Balance", value: holding.totalBalance.toLocaleString("en-US", { maximumFractionDigits: 6 }) },
        { label: "Wallet value", value: formatUSD(holding.walletUsdValue) },
        { label: "DeFi value", value: formatUSD(holding.defiUsdValue) },
        { label: "Positions", value: String(holding.positions.length) },
        ...(holding.price !== undefined ? [{ label: "Price", value: formatUSD(holding.price) }] : []),
      ],
    };
  });

  const protocolNotes = portfolio.protocols.map((protocol) => ({
    id: protocolId(protocol.protocolId, protocol.chainSlug),
    kind: "protocol" as const,
    title: protocol.protocolName,
    subtitle: `${protocol.category} / ${protocol.chainName}`,
    excerpt: `${protocol.protocolName} holds tracked DeFi exposure with ${formatUSD(protocol.netUsdValue)} net value.`,
    valueUsd: protocol.netUsdValue,
    tags: [protocol.category, protocol.chainName, protocol.riskLevel].filter((tag): tag is string => Boolean(tag)),
    links: uniqueLinks([
      chainId(protocol.chainSlug),
      ...[...protocol.deposits, ...protocol.staked, ...protocol.locked, ...protocol.rewards, ...protocol.borrows]
        .map((position) => holdingIdsBySymbol.get(position.symbol.toUpperCase())),
    ]),
    facts: [
      { label: "Net value", value: formatUSD(protocol.netUsdValue) },
      { label: "Deposits", value: formatUSD(protocol.totalDepositUsd) },
      { label: "Borrowed", value: formatUSD(protocol.totalBorrowUsd) },
      { label: "Staked", value: formatUSD(protocol.totalStakedUsd) },
      ...(protocol.healthFactor !== undefined ? [{ label: "Health factor", value: protocol.healthFactor.toFixed(2) }] : []),
    ],
  }));

  const chainNotes = portfolio.chainAllocations.map((chain) => ({
    id: chainId(chain.chainSlug),
    kind: "chain" as const,
    title: chain.chainName,
    subtitle: `${chain.tokenCount} tracked token${chain.tokenCount === 1 ? "" : "s"}`,
    excerpt: `${chain.percentage.toFixed(1)}% of portfolio value currently sits on ${chain.chainName}.`,
    valueUsd: chain.totalUsdValue,
    tags: ["network", chain.chainSlug],
    links: uniqueLinks([
      ...portfolio.aggregated
        .filter((holding) => holding.positions.some((position) => position.chainSlug === chain.chainSlug))
        .map((holding) => holdingId(holding.aggregateKey)),
      ...protocolNotes.filter((protocol) => protocol.links.includes(chainId(chain.chainSlug))).map((protocol) => protocol.id),
      ...txNotes.filter((tx) => tx.links.includes(chainId(chain.chainSlug))).slice(0, 8).map((tx) => tx.id),
    ]),
    facts: [
      { label: "Value", value: formatUSD(chain.totalUsdValue) },
      { label: "Allocation", value: `${chain.percentage.toFixed(1)}%` },
      { label: "Tokens", value: String(chain.tokenCount) },
    ],
  }));

  const perpNotes: VaultNote[] = (perps?.allPositions ?? [])
    .filter((position) => position.status === "open")
    .map((position, index) => ({
      id: `perp:${position.platform}:${position.market}:${index}`,
      kind: "perp",
      title: `${position.coin} ${position.side.toUpperCase()}`,
      subtitle: `${position.platform} / ${position.leverage.toFixed(1)}x leverage`,
      excerpt: `Open leveraged ${position.side} exposure in ${position.market}.`,
      valueUsd: position.positionValue,
      tags: ["perp", position.side, position.riskLevel],
      links: uniqueLinks([holdingIdsBySymbol.get(position.coin.toUpperCase())]),
      facts: [
        { label: "Position value", value: formatUSD(position.positionValue) },
        { label: "PnL", value: formatUSD(position.unrealizedPnl) },
        { label: "Mark price", value: formatUSD(position.markPrice) },
        { label: "Liquidation", value: position.liquidationPrice === null ? "Unavailable" : formatUSD(position.liquidationPrice) },
      ],
    }));

  const home: VaultNote = {
    id: "overview",
    kind: "overview",
    title: "Wallet Vault",
    subtitle: shortenAddress(address),
    excerpt: "A linked workspace for the current wallet, its assets, networks, protocols, trades, and activity history.",
    valueUsd: portfolio.summary.totalUsdValue,
    tags: ["index", "portfolio", "live"],
    links: uniqueLinks([
      ...holdingNotes.slice(0, 6).map((note) => note.id),
      ...protocolNotes.slice(0, 4).map((note) => note.id),
      ...perpNotes.slice(0, 3).map((note) => note.id),
      ...txNotes.slice(0, 5).map((note) => note.id),
    ]),
    facts: [
      { label: "Portfolio value", value: formatUSD(portfolio.summary.totalUsdValue) },
      { label: "Token notes", value: String(holdingNotes.length) },
      { label: "Protocol notes", value: String(protocolNotes.length) },
      { label: "Network notes", value: String(chainNotes.length) },
      { label: "Loaded tx notes", value: String(txNotes.length) },
    ],
  };

  return [home, ...holdingNotes, ...protocolNotes, ...chainNotes, ...perpNotes, ...txNotes];
}

function buildAuthoredNotes(stored: StoredVaultNote[], generated: VaultNote[]): VaultNote[] {
  const titleMap = new Map<string, string>();
  for (const note of generated) titleMap.set(note.title.trim().toLowerCase(), note.id);
  for (const note of stored) titleMap.set(note.title.trim().toLowerCase(), note.id);

  return stored.map((note) => {
    const resolvedLinks = [...note.content.matchAll(/\[\[([^\]]+)\]\]/g)]
      .map((match) => titleMap.get(match[1].trim().toLowerCase()));
    return {
      id: note.id,
      kind: "authored",
      title: note.title,
      subtitle: `Edited ${formatWhen(note.updatedAt)}`,
      excerpt: note.content.trim().slice(0, 180) || "Empty note",
      body: note.content,
      tags: uniqueLinks(["note", ...note.tags]),
      links: uniqueLinks(resolvedLinks),
      facts: [
        { label: "Created", value: formatWhen(note.createdAt) },
        { label: "Updated", value: formatWhen(note.updatedAt) },
        { label: "Wiki links", value: String(resolvedLinks.filter(Boolean).length) },
      ],
    };
  });
}

function NoteRow({
  note,
  selected,
  onSelect,
}: {
  note: VaultNote;
  selected: boolean;
  onSelect: (noteId: string) => void;
}) {
  const Icon = KIND_META[note.kind].icon;
  return (
    <motion.button
      type="button"
      onClick={() => onSelect(note.id)}
      layout
      whileHover={{ x: 2 }}
      transition={{ duration: 0.16 }}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors",
        selected
          ? "border-accent/25 bg-accent/10"
          : "border-transparent text-text-mid hover:border-border hover:bg-text-hi/[0.025]"
      )}
    >
      <Icon className={cn("mt-0.5 h-3.5 w-3.5 flex-shrink-0", selected ? "text-accent" : "text-text-lo")} />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-xs font-medium", selected ? "text-text-hi" : "text-text-mid")}>{note.title}</p>
        <p className="truncate text-[10px] text-text-lo">{note.subtitle}</p>
      </div>
      {note.valueUsd !== undefined ? (
        <span className="num text-[10px] text-text-lo">{formatUSD(note.valueUsd, { compact: true })}</span>
      ) : null}
    </motion.button>
  );
}

function AnimatedGraph({
  notes,
  selected,
  links,
  backlinks,
  onSelect,
  expanded = false,
}: {
  notes: VaultNote[];
  selected: VaultNote;
  links: VaultNote[];
  backlinks: VaultNote[];
  onSelect: (noteId: string) => void;
  expanded?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [scope, setScope] = useState<"local" | "vault">(expanded ? "vault" : "local");

  const graphNotes = useMemo(() => {
    const local = [selected, ...links.slice(0, 6), ...backlinks.slice(0, 5)];
    const broader = [
      selected,
      notes.find((note) => note.id === "overview"),
      ...notes.filter((note) => note.kind === "holding").slice(0, 7),
      ...notes.filter((note) => note.kind === "protocol").slice(0, 5),
      ...notes.filter((note) => note.kind === "chain").slice(0, 4),
      ...notes.filter((note) => note.kind === "perp").slice(0, 3),
      ...notes.filter((note) => note.kind === "authored").slice(0, 5),
      ...notes.filter((note) => note.kind === "transaction").slice(0, 5),
    ];
    return (scope === "local" ? local : broader)
      .filter((note): note is VaultNote => Boolean(note))
      .filter((note, index, all) => all.findIndex((candidate) => candidate.id === note.id) === index)
      .slice(0, scope === "local" ? 12 : 25);
  }, [backlinks, links, notes, scope, selected]);

  const placements: GraphPlacement[] = graphNotes.map((note) => {
    if (note.id === selected.id) return { note, x: 50, y: 50, depth: 64, layer: "focus" };
    const orbitIndex = graphNotes.filter((candidate) => candidate.id !== selected.id).findIndex((candidate) => candidate.id === note.id);
    const innerCount = scope === "local" ? 7 : 9;
    const inner = orbitIndex < innerCount;
    const position = inner ? orbitIndex : orbitIndex - innerCount;
    const count = inner ? Math.min(graphNotes.length - 1, innerCount) : Math.max(graphNotes.length - innerCount - 1, 1);
    const angle = ((position / Math.max(count, 1)) * Math.PI * 2) - Math.PI / 2;
    const radiusX = inner ? 31 : 43;
    const radiusY = inner ? 29 : 42;
    return {
      note,
      x: 50 + Math.cos(angle) * radiusX,
      y: 50 + Math.sin(angle) * radiusY,
      depth: inner ? 34 : 10,
      layer: inner ? "inner" : "outer",
    };
  });
  const coordinates = new Map(placements.map((placement) => [placement.note.id, placement]));
  const visibleIds = new Set(placements.map((placement) => placement.note.id));
  const edges = placements.flatMap(({ note }) => note.links
    .filter((linkedId) => visibleIds.has(linkedId))
    .map((linkedId) => {
      const key = [note.id, linkedId].sort().join("|");
      return { key, from: note.id, to: linkedId };
    }))
    .filter((edge, index, all) => all.findIndex((candidate) => candidate.key === edge.key) === index);

  return (
    <div className="rounded-[12px] border border-border bg-surface p-3 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Network className="h-3.5 w-3.5 text-accent" />
          <p className="text-[10px] uppercase tracking-[0.15em] text-text-lo">Graph view</p>
        </div>
        <div className="flex rounded-lg border border-border bg-surface-raised p-0.5">
          {(["local", "vault"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setScope(option)}
              className={cn(
                "rounded-md px-2 py-1 text-[10px] capitalize transition-colors",
                scope === option ? "bg-accent/12 text-accent" : "text-text-lo hover:text-text-mid"
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      <div className={cn(
        "relative mt-3 overflow-hidden rounded-xl border border-border bg-bg bg-dots",
        expanded ? "h-[min(56vh,560px)] min-h-[400px]" : "h-[300px]"
      )}>
        <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
          {edges.map((edge) => {
            const from = coordinates.get(edge.from);
            const to = coordinates.get(edge.to);
            if (!from || !to) return null;
            const highlighted = edge.from === selected.id || edge.to === selected.id;
            return (
              <motion.line
                key={`${scope}:${edge.key}`}
                x1={`${from.x}%`}
                y1={`${from.y}%`}
                x2={`${to.x}%`}
                y2={`${to.y}%`}
                stroke={highlighted ? "rgb(var(--accent) / 0.5)" : "rgb(var(--text-lo) / 0.14)"}
                strokeWidth={highlighted ? 1.5 : 1}
                initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: reduceMotion ? 0 : 0.35 }}
              />
            );
          })}
        </svg>
        <AnimatePresence mode="popLayout">
          {placements.map(({ note, x, y, layer }, index) => {
            const active = note.id === selected.id;
            const Icon = KIND_META[note.kind].icon;
            return (
              <motion.button
                layout
                key={note.id}
                type="button"
                onClick={() => onSelect(note.id)}
                initial={reduceMotion ? false : { opacity: 0, scale: 0.8, x: "-50%", y: "-50%" }}
                animate={{ opacity: 1, scale: 1, left: `${x}%`, top: `${y}%`, x: "-50%", y: "-50%" }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ type: "spring", damping: 26, stiffness: 240, delay: reduceMotion ? 0 : Math.min(index * 0.015, 0.12) }}
                whileHover={reduceMotion ? undefined : { scale: 1.04 }}
                className={cn(
                  "absolute z-[1] flex items-center gap-1.5 truncate rounded-full border text-[10px] transition-colors",
                  expanded ? "max-w-[150px] px-3 py-1.5" : "max-w-[112px] px-2.5 py-1.5",
                  active
                    ? "border-accent/40 bg-accent/15 text-accent"
                    : layer === "inner"
                      ? "border-border bg-surface text-text-mid hover:border-accent/30 hover:text-accent"
                      : "border-border bg-surface-raised text-text-lo hover:border-border-strong hover:text-text-mid"
                )}
              >
                <Icon className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{note.title}</span>
              </motion.button>
            );
          })}
        </AnimatePresence>
        {scope === "local" && graphNotes.length === 1 ? (
          <p className="absolute bottom-3 left-0 right-0 text-center text-[10px] text-text-lo">No linked notes for this page yet.</p>
        ) : null}
      </div>
    </div>
  );
}

function GraphNoteInspector({
  selected,
  links,
  backlinks,
  onSelect,
}: {
  selected: VaultNote;
  links: VaultNote[];
  backlinks: VaultNote[];
  onSelect: (noteId: string) => void;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={selected.id}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -8 }}
        transition={{ duration: 0.18 }}
        className="space-y-4"
      >
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-accent">{KIND_META[selected.kind].label} note</p>
          <h3 className="mt-1 text-lg font-semibold text-text-hi">{selected.title}</h3>
          <p className="mt-1 text-xs text-text-lo">{selected.subtitle}</p>
        </div>

        {selected.valueUsd !== undefined ? (
          <p className="num rounded-xl border border-accent/18 bg-accent/8 px-3 py-2.5 text-base font-semibold text-text-hi">
            {formatUSD(selected.valueUsd)}
          </p>
        ) : null}

        <p className="rounded-xl border border-border bg-bg/25 p-3 text-xs leading-relaxed text-text-mid">
          {selected.excerpt}
        </p>

        <div className="grid gap-2">
          {selected.facts.slice(0, 4).map((fact) => (
            <div key={fact.label} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
              <span className="text-[10px] uppercase tracking-[0.1em] text-text-lo">{fact.label}</span>
              <span className="num truncate text-xs text-text-hi">{fact.value}</span>
            </div>
          ))}
        </div>

        <section>
          <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-text-lo">Connected notes</p>
          <div className="space-y-1.5">
            {[...links, ...backlinks]
              .filter((note, index, all) => all.findIndex((candidate) => candidate.id === note.id) === index)
              .slice(0, 7)
              .map((note) => (
                <NoteRow key={note.id} note={note} selected={false} onSelect={onSelect} />
              ))}
            {links.length === 0 && backlinks.length === 0 ? (
              <p className="text-xs text-text-lo">No connected notes yet.</p>
            ) : null}
          </div>
        </section>
      </motion.div>
    </AnimatePresence>
  );
}

export function KnowledgeVault({
  address,
  portfolio,
  perps,
}: {
  address: string;
  portfolio: Portfolio;
  perps?: PerpsApiResponse | null;
}) {
  const history = useHistory(address);
  const generatedNotes = useMemo(
    () => buildVaultNotes(address, portfolio, history.events, perps),
    [address, portfolio, history.events, perps]
  );
  const [authoredNotes, setAuthoredNotes] = useState<StoredVaultNote[]>([]);
  const notes = useMemo(
    () => [...generatedNotes, ...buildAuthoredNotes(authoredNotes, generatedNotes)],
    [authoredNotes, generatedNotes]
  );
  const noteMap = useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes]);
  const [selectedId, setSelectedId] = useState("overview");
  const [filter, setFilter] = useState<"all" | VaultKind>("all");
  const [query, setQuery] = useState("");
  const [workspaceMode, setWorkspaceMode] = useState<"graph" | "notes">("graph");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftTags, setDraftTags] = useState("");

  useEffect(() => {
    setAuthoredNotes(loadAuthoredNotes(address));
    setEditorOpen(false);
    setEditingId(null);
  }, [address]);

  useEffect(() => {
    if (!noteMap.has(selectedId)) setSelectedId("overview");
  }, [noteMap, selectedId]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredNotes = notes.filter((note) => {
    if (filter !== "all" && note.kind !== filter) return false;
    if (!normalizedQuery) return true;
    return [note.title, note.subtitle, note.excerpt, ...note.tags]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });
  const selected = noteMap.get(selectedId) ?? notes[0];
  const links = selected.links.map((id) => noteMap.get(id)).filter((note): note is VaultNote => Boolean(note));
  const backlinks = notes.filter((note) => note.links.includes(selected.id));
  const noteCounts = notes.reduce<Record<VaultKind, number>>(
    (counts, note) => ({ ...counts, [note.kind]: counts[note.kind] + 1 }),
    { overview: 0, holding: 0, protocol: 0, chain: 0, perp: 0, transaction: 0, authored: 0 }
  );

  function beginNewNote() {
    setEditingId(null);
    setDraftTitle("");
    setDraftContent("");
    setDraftTags("");
    setEditorOpen(true);
    setWorkspaceMode("notes");
  }

  function beginEditNote(note: VaultNote) {
    const stored = authoredNotes.find((item) => item.id === note.id);
    if (!stored) return;
    setEditingId(stored.id);
    setDraftTitle(stored.title);
    setDraftContent(stored.content);
    setDraftTags(stored.tags.join(", "));
    setEditorOpen(true);
    setWorkspaceMode("notes");
  }

  function saveNote() {
    const title = draftTitle.trim();
    if (!title) return;
    const timestamp = new Date().toISOString();
    const tags = draftTags.split(",").map((tag) => tag.trim()).filter(Boolean);
    let savedId = editingId;
    const updated = editingId
      ? authoredNotes.map((note) => note.id === editingId
        ? { ...note, title, content: draftContent, tags, updatedAt: timestamp }
        : note)
      : [...authoredNotes, {
        id: `authored:${Date.now()}`,
        title,
        content: draftContent,
        tags,
        createdAt: timestamp,
        updatedAt: timestamp,
      }];
    if (!savedId) savedId = updated[updated.length - 1].id;
    setAuthoredNotes(updated);
    saveAuthoredNotes(address, updated);
    setSelectedId(savedId);
    setFilter("authored");
    setEditorOpen(false);
    setEditingId(null);
  }

  function deleteSelectedNote() {
    if (selected.kind !== "authored") return;
    const updated = authoredNotes.filter((note) => note.id !== selected.id);
    setAuthoredNotes(updated);
    saveAuthoredNotes(address, updated);
    setSelectedId("overview");
    setEditorOpen(false);
    setEditingId(null);
  }

  return (
    <div className="overflow-hidden rounded-[12px] border border-border bg-surface shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <FolderTree className="h-4 w-4 text-accent" />
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-hi">Wallet Vault</p>
          <span className="rounded-full border border-accent/15 bg-accent/8 px-2 py-0.5 text-[10px] text-accent">
            {notes.length} notes
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={beginNewNote}
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent/20 bg-accent/8 px-2.5 py-1.5 text-[10px] text-accent transition-colors hover:bg-accent/12"
          >
            <Plus className="h-3 w-3" />
            New note
          </button>
          <div className="flex rounded-lg border border-border bg-bg/30 p-0.5">
            {(["graph", "notes"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setWorkspaceMode(mode)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] capitalize transition-colors",
                  workspaceMode === mode ? "bg-accent/12 text-accent" : "text-text-lo hover:text-text-mid"
                )}
              >
                {mode === "graph" ? <Network className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                {mode}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-text-lo">
            {history.isLoading ? "Loading transaction notes..." : `${history.events.length} history records loaded`}
          </p>
        </div>
      </div>

      {editorOpen ? (
        <div className="border-b border-border bg-surface-raised/30 p-4">
          <div className="mx-auto max-w-3xl space-y-3 rounded-xl border border-accent/14 bg-surface/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-text-hi">{editingId ? "Edit note" : "New note"}</p>
              <p className="text-[10px] text-text-lo">Use [[Token]] or [[Wallet Vault]] for links</p>
            </div>
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder="Note title"
              className="w-full rounded-lg border border-border bg-bg/35 px-3 py-2 text-sm text-text-hi outline-none placeholder:text-text-lo focus:border-accent/30"
            />
            <textarea
              value={draftContent}
              onChange={(event) => setDraftContent(event.target.value)}
              placeholder={"Write your thesis, decision log, or trade note...\n\nLinked context: [[SOL]] [[Wallet Vault]]"}
              rows={6}
              className="w-full resize-y rounded-lg border border-border bg-bg/35 px-3 py-2 text-sm text-text-hi outline-none placeholder:text-text-lo focus:border-accent/30"
            />
            <input
              value={draftTags}
              onChange={(event) => setDraftTags(event.target.value)}
              placeholder="Tags separated by commas"
              className="w-full rounded-lg border border-border bg-bg/35 px-3 py-2 text-xs text-text-hi outline-none placeholder:text-text-lo focus:border-accent/30"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditorOpen(false)} className="rounded-lg border border-border px-3 py-2 text-xs text-text-mid">
                Cancel
              </button>
              <button type="button" onClick={saveNote} disabled={!draftTitle.trim()} className="rounded-lg border border-accent/25 bg-accent/10 px-3 py-2 text-xs text-accent disabled:opacity-40">
                Save note
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {workspaceMode === "graph" ? (
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(460px,1fr)_290px]">
          <AnimatedGraph
            notes={notes}
            selected={selected}
            links={links}
            backlinks={backlinks}
            onSelect={setSelectedId}
            expanded
          />
          <aside className="rounded-xl border border-border bg-surface-raised/30 p-4">
            <GraphNoteInspector selected={selected} links={links} backlinks={backlinks} onSelect={setSelectedId} />
          </aside>
        </div>
      ) : (
      <div className="grid min-h-[610px] lg:grid-cols-[280px_minmax(340px,1fr)_300px]">
        <aside className="border-b border-border/50 p-3 lg:border-b-0 lg:border-r">
          <label className="flex items-center gap-2 rounded-lg border border-border bg-bg/35 px-2.5 py-2">
            <Search className="h-3.5 w-3.5 text-text-lo" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search notes..."
              className="min-w-0 flex-1 bg-transparent text-xs text-text-hi outline-none placeholder:text-text-lo"
            />
          </label>

          <div className="mt-3 space-y-1">
            {FILTERS.map((item) => {
              const count = item.id === "all" ? notes.length : noteCounts[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                    filter === item.id ? "bg-accent/10 text-accent" : "text-text-lo hover:bg-text-hi/[0.025] hover:text-text-mid"
                  )}
                >
                  <span>{item.label}</span>
                  <span className="num text-[10px]">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 border-t border-border/50 pt-3">
            <p className="mb-2 text-[9px] uppercase tracking-[0.16em] text-text-lo">Files</p>
            <div className="max-h-[360px] space-y-1 overflow-y-auto pr-1">
              {filteredNotes.map((note) => (
                <NoteRow key={note.id} note={note} selected={selected.id === note.id} onSelect={setSelectedId} />
              ))}
              {filteredNotes.length === 0 ? (
                <p className="px-2 py-5 text-center text-xs text-text-lo">No matching notes.</p>
              ) : null}
            </div>
          </div>
        </aside>

        <main className="border-b border-border/50 p-4 lg:border-b-0 lg:border-r">
          <AnimatePresence mode="wait">
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
            >
            <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-accent">{KIND_META[selected.kind].label} note</p>
              <h3 className="mt-1 text-xl font-semibold text-text-hi">{selected.title}</h3>
              <p className="mt-1 text-xs text-text-lo">{selected.subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
            {selected.kind === "authored" ? (
              <>
                <button type="button" onClick={() => beginEditNote(selected)} className="rounded-lg border border-border p-2 text-text-mid transition-colors hover:text-accent" aria-label="Edit note">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={deleteSelectedNote} className="rounded-lg border border-border p-2 text-text-mid transition-colors hover:text-danger" aria-label="Delete note">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            ) : null}
            {selected.valueUsd !== undefined ? (
              <p className="num rounded-lg border border-accent/15 bg-accent/6 px-3 py-2 text-sm font-semibold text-text-hi">
                {formatUSD(selected.valueUsd)}
              </p>
            ) : null}
            </div>
          </div>

            <div className="mt-4 rounded-xl border border-border bg-bg/30 p-3.5">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-mid">{selected.body ?? selected.excerpt}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {selected.tags.map((tag) => (
                <span key={tag} className="rounded-md border border-border bg-surface-raised/40 px-2 py-0.5 text-[10px] text-text-lo">
                  #{tag}
                </span>
              ))}
            </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {selected.facts.map((fact) => (
              <div key={fact.label} className="rounded-lg border border-border/70 bg-text-hi/[0.02] px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.12em] text-text-lo">{fact.label}</p>
                <p className="num mt-1 truncate text-xs text-text-hi">{fact.value}</p>
              </div>
            ))}
            </div>

            {selected.explorerUrl ? (
            <a
              href={selected.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-accent/20 bg-accent/8 px-3 py-2 text-xs text-accent transition-colors hover:bg-accent/12"
            >
              Open transaction explorer <ExternalLink className="h-3 w-3" />
            </a>
            ) : null}

            <div className="mt-5 grid gap-4 md:grid-cols-2">
            <section>
              <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-text-lo">Links</p>
              <div className="space-y-1.5">
                {links.length ? links.slice(0, 8).map((note) => (
                  <NoteRow key={note.id} note={note} selected={false} onSelect={setSelectedId} />
                )) : <p className="text-xs text-text-lo">No direct links.</p>}
              </div>
            </section>
            <section>
              <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-text-lo">Backlinks</p>
              <div className="space-y-1.5">
                {backlinks.length ? backlinks.slice(0, 8).map((note) => (
                  <NoteRow key={note.id} note={note} selected={false} onSelect={setSelectedId} />
                )) : <p className="text-xs text-text-lo">No notes reference this page yet.</p>}
              </div>
            </section>
            </div>
            </motion.div>
          </AnimatePresence>
        </main>

        <aside className="order-first border-b border-border/50 p-4 lg:order-none lg:border-b-0">
          <AnimatedGraph notes={notes} selected={selected} links={links} backlinks={backlinks} onSelect={setSelectedId} />

          <div className="mt-4 rounded-xl border border-border bg-surface-raised/30 p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.14em] text-text-lo">Activity index</p>
              {history.isFetching ? <Loader2 className="h-3 w-3 animate-spin text-accent" /> : null}
            </div>
            {history.isError ? (
              <p className="mt-2 text-xs text-warning">Transaction notes could not be loaded.</p>
            ) : txNotesSummary(notes).map((note) => (
              <button
                key={note.id}
                type="button"
                onClick={() => setSelectedId(note.id)}
                className="mt-2 block w-full truncate text-left text-xs text-text-mid transition-colors hover:text-accent"
              >
                <FileText className="mr-1.5 inline h-3 w-3 text-text-lo" />
                {note.title}
              </button>
            ))}
            {!history.isLoading && !history.isError && history.events.length === 0 ? (
              <p className="mt-2 text-xs text-text-lo">No loaded transaction notes.</p>
            ) : null}
            {history.hasMore ? (
              <button
                type="button"
                onClick={history.loadMore}
                disabled={history.isFetching}
                className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-xs text-text-mid transition-colors hover:border-accent/20 hover:text-accent disabled:opacity-50"
              >
                Load more activity notes
              </button>
            ) : null}
          </div>
        </aside>
      </div>
      )}
    </div>
  );
}

function txNotesSummary(notes: VaultNote[]) {
  return notes.filter((note) => note.kind === "transaction").slice(0, 5);
}
