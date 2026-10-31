import React, { useState, useMemo, useEffect, useLayoutEffect } from 'react';
import { Tournament, Match, Pair, Pool } from '../../types/tournament';
import { formatScore, generateTimeSlots, computeCompleteFinalStandings } from '../../utils/padelCalculations';
import { PairPoolHistoryModal } from '../modals/PairPoolHistoryModal';
import { getPadelMatchFormatDescription } from '../../utils/padelMatchFormats';
import { getCompetitionPoints } from '../../utils/competitionPoints';
import { DEFAULT_TV_PAGES, type TvPageId } from '../../utils/tvPages';
import { QRCodeSVG } from 'qrcode.react';
import { StatsPanel } from './StatsPanel';
import {
  Flame,
  Search,
  Maximize2,
  Calendar,
  Grid3X3,
  GitBranch,
  Trophy,
  Radio,
  History,
  LayoutGrid,
  List,
  Clock,
  Layers,
  CheckCircle2,
  Tv,
  Users,
  X,
  Timer,
  ChevronRight,
  BarChart3,
} from 'lucide-react';

interface PublicLiveModuleProps {
  tournament: Tournament;
  onExitPublic?: () => void;
  participantsPanel?: React.ReactNode;
  qrUrl?: string;
  followedPairIds?: string[];
  initialTvMode?: boolean;
}

const FormatBadge: React.FC<{ format?: Match['matchFormat'] }> = ({ format }) =>
  format ? (
    <span
      className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-700"
      title={getPadelMatchFormatDescription(format)}
    >
      Format {format}
    </span>
  ) : null;

function getMatchDuration(match: Match): string | null {
  if (match.status !== 'completed' || !match.startedAt || !match.completedAt) return null;
  const minutes = Math.round((Date.parse(match.completedAt) - Date.parse(match.startedAt)) / 60000);
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  return minutes >= 60
    ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
    : `${minutes} min`;
}

const DurationBadge: React.FC<{ match: Match }> = ({ match }) => {
  const duration = getMatchDuration(match);
  return duration ? (
    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-slate-500">
      <Timer className="h-3 w-3" />
      Durée {duration}
    </span>
  ) : null;
};

type LiveTab = 'participants' | 'my-matches' | 'courts' | 'schedule' | 'pools' | 'bracket' | 'stats';
type BracketSubTab = 'main' | 'consolante' | 'standings';

const TV_VIEW_SECONDS = 6;

function getScheduledTimestamp(match: Match, tournament: Tournament): number | undefined {
  const scheduledAt = match.scheduledAt ? Date.parse(match.scheduledAt) : NaN;
  if (Number.isFinite(scheduledAt)) return scheduledAt;
  if (!match.scheduledTime) return undefined;
  const date = tournament.dates.start || new Date().toISOString().slice(0, 10);
  const timestamp = Date.parse(`${date}T${match.scheduledTime}:00`);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function formatCountdown(timestamp: number, now: number): string {
  const seconds = Math.max(0, Math.floor((timestamp - now) / 1000));
  if (seconds === 0) return 'Imminent';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) return `dans ${hours} h ${String(minutes).padStart(2, '0')}`;
  if (minutes > 0) return `dans ${minutes} min ${String(remainingSeconds).padStart(2, '0')} s`;
  return `dans ${remainingSeconds} s`;
}

const UpcomingMatchesBanner: React.FC<{
  matches: Array<{ match: Match; timestamp?: number }>;
  tournament: Tournament;
  pairsMap: Map<string, Pair>;
}> = ({ matches, tournament, pairsMap }) => {
  const [now, setNow] = useState(Date.now());
  const countdownKey = matches
    .map(item => `${item.match.id}:${item.timestamp ?? ''}`)
    .join('|');

  useEffect(() => {
    if (!matches.some(item => item.timestamp && item.timestamp > Date.now())) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [countdownKey]);

  if (!matches.length) return null;
  return (
    <section className="fixed bottom-3 left-4 right-4 z-30 rounded-2xl border border-amber-300 bg-amber-50/95 p-2 shadow-xl backdrop-blur-sm sm:p-3">
      <h2 className="mb-1 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-amber-950 sm:text-sm">
        <Clock className="h-5 w-5" />
        Prochains matchs
      </h2>
      <div className="flex gap-2">
        {matches.map(({ match, timestamp }) => {
          const pair1 = match.pair1Id ? pairsMap.get(match.pair1Id) : undefined;
          const pair2 = match.pair2Id ? pairsMap.get(match.pair2Id) : undefined;
          return (
            <div key={match.id} className="min-w-0 flex-1 rounded-xl border border-amber-200 bg-white px-2.5 py-1.5">
              <div className="flex items-center justify-between gap-2 text-xs font-bold text-amber-900">
                <span>{match.roundName}</span>
                <span className="shrink-0">{timestamp && timestamp > now ? formatCountdown(timestamp, now) : match.scheduledTime || 'Horaire à confirmer'}</span>
              </div>
              <p className="mt-0.5 truncate text-xs font-semibold text-slate-800 sm:text-sm">
                {pair1 ? `${pair1.player1.firstName} ${pair1.player1.lastName} / ${pair1.player2.firstName} ${pair1.player2.lastName}` : match.pair1Placeholder || 'Paire à confirmer'}
                {' vs '}
                {pair2 ? `${pair2.player1.firstName} ${pair2.player1.lastName} / ${pair2.player2.firstName} ${pair2.player2.lastName}` : match.pair2Placeholder || 'Paire à confirmer'}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-slate-500 sm:text-xs">
                {match.courtId ? tournament.courts.find(court => court.id === match.courtId)?.name ?? 'Piste à confirmer' : 'Piste à confirmer'}
                {match.scheduledTime ? ` · ${match.scheduledTime}` : ''}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export const PublicLiveModule: React.FC<PublicLiveModuleProps> = ({
  tournament,
  onExitPublic,
  participantsPanel,
  qrUrl,
  followedPairIds = [],
  initialTvMode = false,
}) => {
  const [activeTab, setActiveTab] = useState<LiveTab>(
    initialTvMode ? 'courts' : participantsPanel ? 'participants' : 'courts'
  );
  const [searchPlayer, setSearchPlayer] = useState('');
  const [scheduleViewMode, setScheduleViewMode] = useState<'grid' | 'list'>(
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'list' : 'grid'
  );
  const [bracketSubTab, setBracketSubTab] = useState<BracketSubTab>('main');
  const [classificationFocusMatchIds, setClassificationFocusMatchIds] = useState<string[] | null>(null);
  const [isTvMode, setIsTvMode] = useState(initialTvMode);
  const [tvIndex, setTvIndex] = useState(0);
  const tvScrollRef = React.useRef(0);
  const tvBracketScrollRef = React.useRef(0);
  const tvBracketPhaseRef = React.useRef(0);
  const bracketScrollerRef = React.useRef<HTMLDivElement | null>(null);

  // Pair history modal
  const [selectedPairHistory, setSelectedPairHistory] = useState<Pair | null>(null);
  const [selectedPoolForHistory, setSelectedPoolForHistory] = useState<Pool | undefined>(undefined);

  const pairsMap = new Map<string, Pair>(tournament.pairs.map(p => [p.id, p]));
  const confirmedPairsCount = tournament.pairs.filter(pair => pair.status === 'confirmed').length;

  const allMatches: Match[] = useMemo(() => {
    return [
      ...tournament.pools.flatMap(p => p.matches),
      ...tournament.bracketMatches,
      ...tournament.consolanteMatches,
    ];
  }, [tournament]);

  // Generate standardized time slots
  const timeSlots = useMemo(() => {
    const startTime = tournament.firstMatchTime || '09:00';
    const slotDuration = tournament.slotDurationMinutes || 75;
    const toMinutes = (time: string): number | null => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(time);
      if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
      return Number(m[1]) * 60 + Number(m[2]);
    };
    const scheduledTimes = allMatches
      .map(match => match.scheduledTime)
      .filter((time): time is string => Boolean(time) && toMinutes(time as string) !== null);
    const startMinutes = toMinutes(startTime) ?? 9 * 60;
    const lastScheduledSlot = scheduledTimes.reduce(
      (last, time) => Math.max(last, Math.floor((toMinutes(time)! - startMinutes) / slotDuration)),
      -1
    );
    const regularSlots = generateTimeSlots(startTime, slotDuration, Math.max(10, lastScheduledSlot + 2));
    const offset = (time: string) => ((toMinutes(time) ?? 0) - startMinutes + 1440) % 1440;
    return [...new Set([...regularSlots, ...scheduledTimes])].sort((a, b) => offset(a) - offset(b));
  }, [tournament.firstMatchTime, tournament.slotDurationMinutes, allMatches]);

  const liveMatches = allMatches.filter(m => m.status === 'in_progress');
  const upcomingMatches = allMatches.filter(m => m.status === 'scheduled');
  const tvUpcomingMatches = upcomingMatches
    .map(match => ({ match, timestamp: getScheduledTimestamp(match, tournament) }))
    .sort((a, b) => (a.timestamp ?? Number.POSITIVE_INFINITY) - (b.timestamp ?? Number.POSITIVE_INFINITY))
    .slice(0, 3);
  const scheduledListMatches = allMatches
    .filter(m => m.status === 'scheduled' || m.status === 'in_progress')
    .sort((a, b) => (a.scheduledTime ?? '99:99').localeCompare(b.scheduledTime ?? '99:99') || a.matchNumber - b.matchNumber);
  const finishedMatches = allMatches.filter(m => m.status === 'completed');

  // Strictly filter bracket matches
  const mainBracketMatches = useMemo(() => {
    return tournament.bracketMatches.filter(m => m.type !== 'consolante');
  }, [tournament.bracketMatches]);

  const consolanteMatches = useMemo(() => {
    return tournament.consolanteMatches.filter(m => m.type === 'consolante');
  }, [tournament.consolanteMatches]);

  const myMatches = allMatches
    .filter(match => followedPairIds.includes(match.pair1Id ?? '') || followedPairIds.includes(match.pair2Id ?? ''))
    .sort((a, b) =>
      (getScheduledTimestamp(a, tournament) ?? Number.POSITIVE_INFINITY) -
        (getScheduledTimestamp(b, tournament) ?? Number.POSITIVE_INFINITY) ||
      a.matchNumber - b.matchNumber
    );

  useEffect(() => {
    if (!initialTvMode) return;
    document.documentElement.requestFullscreen?.().catch(error => {
      console.info('Le navigateur n’a pas autorisé le plein écran automatique du mode TV :', error);
    });
  }, [initialTvMode]);

  // Group bracket matches by round
  const activeBracketMatches = bracketSubTab === 'main'
    ? mainBracketMatches
    : classificationFocusMatchIds
      ? consolanteMatches.filter(match => classificationFocusMatchIds.includes(match.id))
      : consolanteMatches;
  const bracketRoundsMap = useMemo(() => {
    const map = new Map<number, Match[]>();
    activeBracketMatches.forEach(m => {
      const r = m.bracketRound || 1;
      if (!map.has(r)) map.set(r, []);
      map.get(r)!.push(m);
    });
    return map;
  }, [activeBracketMatches]);

  const sortedRoundNumbers = Array.from(bracketRoundsMap.keys()).sort((a, b) => a - b);

  const rootRef = React.useRef<HTMLDivElement | null>(null);

  // Give every match card of a view the height of the tallest one
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const equalize = () => {
      const groups = new Map<string, HTMLElement[]>();
      root.querySelectorAll<HTMLElement>('[data-uniform-card]').forEach(card => {
        card.style.minHeight = '';
        const key = card.dataset.uniformCard ?? '';
        groups.set(key, [...(groups.get(key) ?? []), card]);
      });
      groups.forEach(cards => {
        const tallest = Math.max(...cards.map(card => card.offsetHeight));
        cards.forEach(card => {
          card.style.minHeight = `${tallest}px`;
        });
      });
    };
    equalize();
    window.addEventListener('resize', equalize);
    return () => window.removeEventListener('resize', equalize);
  }, [allMatches, tournament.pairs, tournament.courts, timeSlots, activeTab, bracketSubTab, scheduleViewMode, isTvMode, classificationFocusMatchIds]);

  const bracketContainerRef = React.useRef<HTMLDivElement | null>(null);
  const matchCardRefs = React.useRef(new Map<string, HTMLDivElement>());
  const [connectorPaths, setConnectorPaths] = useState<
    { key: string; d: string; loser: boolean }[]
  >([]);
  const [connectorSize, setConnectorSize] = useState({ width: 0, height: 0 });
  const [tvFit, setTvFit] = useState({ scale: 1, width: 0, height: 0, offsetX: 0 });

  // TV mode: scale the whole bracket so it fits the screen without scrolling
  useLayoutEffect(() => {
    const container = bracketContainerRef.current;
    const scroller = bracketScrollerRef.current;
    if (!isTvMode || !container || !scroller || activeTab !== 'bracket' || bracketSubTab === 'standings') {
      setTvFit(previous => (previous.scale === 1 && previous.width === 0 ? previous : { scale: 1, width: 0, offsetX: 0, height: 0 }));
      return;
    }
    const fit = () => {
      const naturalWidth = container.offsetWidth;
      const naturalHeight = container.offsetHeight;
      if (!naturalWidth || !naturalHeight) return;
      const style = window.getComputedStyle(scroller);
      const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const availableWidth = scroller.clientWidth - paddingX;
      const top = scroller.getBoundingClientRect().top + window.scrollY;
      const availableHeight = window.innerHeight - top - paddingY - 190;
      const scale = Math.max(0.3, Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight));
      const next = {
        scale,
        width: naturalWidth * scale,
        height: naturalHeight * scale,
        offsetX: Math.max(0, (availableWidth - naturalWidth * scale) / 2),
      };
      setTvFit(previous =>
        Math.abs(previous.scale - next.scale) < 0.005 &&
        Math.abs(previous.height - next.height) < 1 &&
        Math.abs(previous.offsetX - next.offsetX) < 1
          ? previous
          : next
      );
    };
    fit();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : undefined;
    observer?.observe(container);
    window.addEventListener('resize', fit);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [isTvMode, activeTab, bracketSubTab, activeBracketMatches]);

  useLayoutEffect(() => {
    const container = bracketContainerRef.current;
    if (!container || activeTab !== 'bracket' || bracketSubTab === 'standings') {
      setConnectorPaths(previous => (previous.length ? [] : previous));
      return;
    }
    const compute = () => {
      const origin = container.getBoundingClientRect();
      const zoom = container.offsetWidth ? origin.width / container.offsetWidth : 1;
      const visibleIds = new Set(activeBracketMatches.map(match => match.id));
      const paths: { key: string; d: string; loser: boolean }[] = [];
      const link = (source: Match, targetId: string | undefined, loser: boolean) => {
        if (!targetId || !visibleIds.has(targetId)) return;
        const from = matchCardRefs.current.get(source.id);
        const to = matchCardRefs.current.get(targetId);
        if (!from || !to) return;
        const a = from.getBoundingClientRect();
        const b = to.getBoundingClientRect();
        const x1 = (a.right - origin.left) / zoom;
        const y1 = (a.top + a.height / 2 - origin.top) / zoom;
        const x2 = (b.left - origin.left) / zoom;
        const y2 = (b.top + b.height / 2 - origin.top) / zoom;
        if (x2 <= x1) return;
        const mid = x1 + (x2 - x1) / 2;
        paths.push({
          key: `${source.id}-${targetId}-${loser ? 'l' : 'w'}`,
          d: `M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`,
          loser,
        });
      };
      activeBracketMatches.forEach(match => {
        link(match, match.nextMatchId, false);
        if (bracketSubTab === 'consolante') link(match, match.loserNextMatchId, true);
      });
      setConnectorPaths(previous =>
        JSON.stringify(previous) === JSON.stringify(paths) ? previous : paths
      );
      setConnectorSize(previous => {
        const next = { width: container.scrollWidth, height: container.scrollHeight };
        return previous.width === next.width && previous.height === next.height ? previous : next;
      });
    };
    compute();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(compute) : undefined;
    observer?.observe(container);
    window.addEventListener('resize', compute);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [activeBracketMatches, activeTab, bracketSubTab, tvFit.scale]);

  const openRoundClassification = (round: number) => {
    const sourceMatches = mainBracketMatches.filter(match => (match.bracketRound ?? 1) === round);
    const sourceIds = new Set(sourceMatches.map(match => match.id));
    const relatedIds = new Set<string>();
    const pendingIds = sourceMatches
      .map(match => match.loserNextMatchId)
      .filter((id): id is string => Boolean(id));
    consolanteMatches.forEach(match => {
      if (
        (match.pair1SourceMatchId && sourceIds.has(match.pair1SourceMatchId) && match.pair1SourceOutcome === 'loser') ||
        (match.pair2SourceMatchId && sourceIds.has(match.pair2SourceMatchId) && match.pair2SourceOutcome === 'loser')
      ) {
        pendingIds.push(match.id);
      }
    });

    while (pendingIds.length) {
      const matchId = pendingIds.pop();
      if (!matchId || relatedIds.has(matchId)) continue;
      const match = consolanteMatches.find(item => item.id === matchId);
      if (!match) continue;
      relatedIds.add(matchId);
      if (match.nextMatchId) pendingIds.push(match.nextMatchId);
      if (match.loserNextMatchId) pendingIds.push(match.loserNextMatchId);
    }

    if (relatedIds.size === 0) return;
    setClassificationFocusMatchIds([...relatedIds]);
    setBracketSubTab('consolante');
    setActiveTab('bracket');
    window.scrollTo(0, 0);
  };

  // Sequence of screens cycled in TV mode: only the pages chosen by the referee that have content
  const tvViews = useMemo<Array<{ tab: LiveTab; sub?: BracketSubTab }>>(() => {
    const selected = tournament.tvPages ?? DEFAULT_TV_PAGES;
    const hasContent: Record<TvPageId, boolean> = {
      courts: tournament.courts.length > 0,
      schedule: allMatches.some(m => m.scheduledTime || m.courtId),
      pools: tournament.pools.length > 0,
      'bracket-main': mainBracketMatches.length > 0,
      'bracket-consolante': consolanteMatches.length > 0,
      'bracket-standings': mainBracketMatches.length > 0,
    };
    const views: Array<{ tab: LiveTab; sub?: BracketSubTab }> = [];
    for (const page of DEFAULT_TV_PAGES) {
      if (!selected.includes(page) || !hasContent[page]) continue;
      if (page === 'courts' || page === 'schedule' || page === 'pools') views.push({ tab: page });
      else views.push({ tab: 'bracket', sub: page.replace('bracket-', '') as BracketSubTab });
    }
    return views.length ? views : [{ tab: 'courts' }];
  }, [tournament.tvPages, tournament.courts.length, tournament.pools.length, allMatches, mainBracketMatches.length, consolanteMatches.length]);

  useEffect(() => {
    if (!isTvMode) return;
    const view = tvViews[tvIndex % tvViews.length];
    setActiveTab(view.tab);
    if (view.sub) setBracketSubTab(view.sub);
    tvScrollRef.current = 0;
    tvBracketScrollRef.current = 0;
    tvBracketPhaseRef.current = 0;
    window.scrollTo(0, 0);
  }, [isTvMode, tvIndex, tvViews]);

  // Auto-scroll the current screen, then move to the next one
  useEffect(() => {
    if (!isTvMode) return;
    let frame = 0;
    let last = performance.now();
    let waitingSince: number | null = null;

    const tick = (now: number) => {
      const root = document.scrollingElement ?? document.documentElement;
      const max = root.scrollHeight - root.clientHeight;
      const scroller = bracketScrollerRef.current;
      const dt = now - last;

      if (scroller) {
        // Bracket: sweep the top half left to right, go down to the bottom of the bracket, sweep left to right again
        const maxX = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
        const bottomTarget = Math.min(
          max,
          Math.max(0, scroller.getBoundingClientRect().bottom + root.scrollTop - root.clientHeight + 16)
        );
        const phase = tvBracketPhaseRef.current;
        if (waitingSince === null) {
          if (phase === 0) {
            if (maxX > 4 && tvBracketScrollRef.current < maxX) {
              tvBracketScrollRef.current = Math.min(maxX, tvBracketScrollRef.current + dt * 0.05);
              scroller.scrollLeft = tvBracketScrollRef.current;
            } else {
              tvBracketPhaseRef.current = bottomTarget > 4 ? 1 : 3;
            }
          } else if (phase === 1) {
            if (tvScrollRef.current < bottomTarget) {
              tvScrollRef.current = Math.min(bottomTarget, tvScrollRef.current + dt * 0.03);
              root.scrollTop = tvScrollRef.current;
            } else {
              tvBracketScrollRef.current = 0;
              scroller.scrollLeft = 0;
              tvBracketPhaseRef.current = maxX > 4 ? 2 : 3;
            }
          } else if (phase === 2) {
            if (tvBracketScrollRef.current < maxX) {
              tvBracketScrollRef.current = Math.min(maxX, tvBracketScrollRef.current + dt * 0.05);
              scroller.scrollLeft = tvBracketScrollRef.current;
            } else {
              tvBracketPhaseRef.current = 3;
            }
          } else {
            waitingSince = now;
          }
        } else if (now - waitingSince > TV_VIEW_SECONDS * 1000) {
          setTvIndex(index => (index + 1) % tvViews.length);
          return;
        }
        last = now;
        frame = requestAnimationFrame(tick);
        return;
      }

      const verticalPending = max > 4 && tvScrollRef.current < max;
      if (verticalPending && waitingSince === null) {
        tvScrollRef.current = Math.min(max, tvScrollRef.current + dt * 0.03);
        root.scrollTop = tvScrollRef.current;
      } else if (waitingSince === null) {
        waitingSince = now;
      } else if (now - waitingSince > TV_VIEW_SECONDS * 1000) {
        setTvIndex(index => (index + 1) % tvViews.length);
        return;
      }
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isTvMode, tvIndex, tvViews.length]);

  useEffect(() => {
    if (!isTvMode) return;
    const stopOnExit = () => {
      if (!document.fullscreenElement) setIsTvMode(false);
    };
    document.addEventListener('fullscreenchange', stopOnExit);
    return () => document.removeEventListener('fullscreenchange', stopOnExit);
  }, [isTvMode]);

  const toggleTvMode = () => {
    if (isTvMode) {
      setIsTvMode(false);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      return;
    }
    setTvIndex(0);
    setClassificationFocusMatchIds(null);
    setIsTvMode(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Search filtered matches
  const playerFilteredMatches = searchPlayer.trim()
    ? allMatches.filter((m) => {
        const p1 = m.pair1Id ? pairsMap.get(m.pair1Id) : undefined;
        const p2 = m.pair2Id ? pairsMap.get(m.pair2Id) : undefined;
        const q = searchPlayer.toLowerCase();
        return (
          p1?.player1.firstName.toLowerCase().includes(q) ||
          p1?.player1.lastName.toLowerCase().includes(q) ||
          p1?.player2.firstName.toLowerCase().includes(q) ||
          p1?.player2.lastName.toLowerCase().includes(q) ||
          p2?.player1.firstName.toLowerCase().includes(q) ||
          p2?.player1.lastName.toLowerCase().includes(q) ||
          p2?.player2.firstName.toLowerCase().includes(q) ||
          p2?.player2.lastName.toLowerCase().includes(q)
        );
      })
    : null;

  return (
    <div ref={rootRef} className={`space-y-4 sm:space-y-6 pb-28 md:pb-24 ${isTvMode ? 'tv-mode pb-56' : ''}`}>
      {/* Public Header Banner */}
      <div className="p-4 sm:p-6 bg-white border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 shadow-xs">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500 mb-1">
            <span className="font-mono text-emerald-700 font-bold">LIVE SCORE & TOURNOI</span>
            <span>·</span>
            <span className="text-slate-900 font-semibold">{tournament.category} {tournament.gender}</span>
            <span>·</span>
            <span>{tournament.club}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">{tournament.name}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Multi-screen live indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-mono font-medium shadow-xs">
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-600" />
            <span>Mise à jour instantanée</span>
          </div>

          <button
            onClick={toggleTvMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors font-medium shadow-xs border ${
              isTvMode
                ? 'bg-emerald-600 text-white border-emerald-700'
                : 'text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border-slate-300'
            }`}
            title="Défilement automatique des écrans en plein écran"
          >
            <Tv className="w-3.5 h-3.5" />
            <span>{isTvMode ? 'Arrêter le mode TV' : 'Mode TV'}</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors font-medium shadow-xs"
            title="Activer le mode plein écran"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Plein écran</span>
          </button>
        </div>
      </div>

      {isTvMode && (
        <button
          type="button"
          onClick={toggleTvMode}
          className="fixed right-4 top-4 z-50 flex items-center gap-1.5 rounded-full bg-slate-900/80 px-3 py-2 text-xs font-bold text-white shadow-lg backdrop-blur"
        >
          <X className="h-3.5 w-3.5" />
          Quitter le mode TV
        </button>
      )}

      {isTvMode && (
        <>
          <UpcomingMatchesBanner
            matches={tvUpcomingMatches}
            tournament={tournament}
            pairsMap={pairsMap}
          />
          {qrUrl && (
            <a
              href={qrUrl}
              className="fixed left-4 top-4 z-40 flex flex-col items-center gap-1 rounded-xl bg-white/95 p-2 shadow-xl ring-1 ring-slate-300"
              aria-label="Ouvrir la vue joueurs sur un autre appareil avec le QR code"
            >
              <QRCodeSVG value={qrUrl} size={88} level="M" />
              <span className="text-[10px] font-extrabold text-slate-800">Suivi du tournoi</span>
            </a>
          )}
        </>
      )}

      {/* Quick Player Match Finder Bar */}
      {!isTvMode && activeTab !== 'participants' && (
      <div className="relative">
        <Search className="w-4 h-4 text-emerald-600 absolute left-4 top-3.5" />
        <input
          type="text"
          placeholder="Joueur : tapez votre nom pour trouver immédiatement vos matchs et votre piste..."
          value={searchPlayer}
          onChange={(e) => setSearchPlayer(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-xs"
        />
        {searchPlayer && (
          <button
            onClick={() => setSearchPlayer('')}
            className="absolute right-4 top-3 text-xs text-slate-500 hover:text-slate-800 font-medium"
          >
            Effacer
          </button>
        )}
      </div>
      )}

      {/* If Player searched */}
      {playerFilteredMatches && !isTvMode && activeTab !== 'participants' && (
        <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700">
            Résultats pour &ldquo;{searchPlayer}&rdquo; ({playerFilteredMatches.length} match(s))
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {playerFilteredMatches.map((m) => {
              const p1 = m.pair1Id ? pairsMap.get(m.pair1Id) : undefined;
              const p2 = m.pair2Id ? pairsMap.get(m.pair2Id) : undefined;
              const court = tournament.courts.find(c => c.id === m.courtId);

              return (
                <div
                  key={m.id}
                  className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="font-semibold text-slate-800">{m.roundName}</span>
                    <span className="font-mono text-emerald-700 font-bold">
                      {court ? court.name : 'Piste à confirmer'} · {m.scheduledTime || 'Horaire à confirmer'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    <span
                      onClick={() => p1 && setSelectedPairHistory(p1)}
                      className={p1 ? 'hover:text-emerald-700 hover:underline cursor-pointer' : ''}
                    >
                      {p1 ? `${p1.player1.firstName} ${p1.player1.lastName} / ${p1.player2.firstName} ${p1.player2.lastName}` : m.pair1Placeholder}
                    </span>{' '}
                    vs{' '}
                    <span
                      onClick={() => p2 && setSelectedPairHistory(p2)}
                      className={p2 ? 'hover:text-emerald-700 hover:underline cursor-pointer' : ''}
                    >
                      {p2 ? `${p2.player1.firstName} ${p2.player1.lastName} / ${p2.player2.firstName} ${p2.player2.lastName}` : m.pair2Placeholder}
                    </span>
                  </p>
                  {m.score && (
                    <p className="font-mono text-emerald-700 font-bold">
                      Score : {formatScore(m.score)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation tabs for spectator */}
      <div className="hidden md:flex items-center gap-1 p-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium max-w-full overflow-x-auto whitespace-nowrap">
        {participantsPanel && (
          <button
            onClick={() => setActiveTab('participants')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md transition-colors whitespace-nowrap min-h-[38px] ${
              activeTab === 'participants'
                ? 'bg-white text-emerald-800 font-bold border border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
            <span>Participants ({tournament.pairs.length})</span>
          </button>
        )}

        {followedPairIds.length > 0 && (
          <button
            onClick={() => setActiveTab('my-matches')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md transition-colors whitespace-nowrap min-h-[38px] ${
              activeTab === 'my-matches'
                ? 'bg-white text-emerald-800 font-bold border border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
            <span>Mes matchs ({myMatches.length})</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('courts')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md transition-colors whitespace-nowrap min-h-[38px] ${
            activeTab === 'courts'
              ? 'bg-white text-emerald-800 font-bold border border-slate-200 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Flame className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
          <span>Sur les Terrains ({tournament.courts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('schedule')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md transition-colors whitespace-nowrap min-h-[38px] ${
            activeTab === 'schedule'
              ? 'bg-white text-emerald-800 font-bold border border-slate-200 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
          <span>Programmation des Matchs</span>
        </button>

        <button
          onClick={() => setActiveTab('pools')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md transition-colors whitespace-nowrap min-h-[38px] ${
            activeTab === 'pools'
              ? 'bg-white text-emerald-800 font-bold border border-slate-200 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Grid3X3 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
          <span>Poules & Classements ({tournament.pools.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('bracket')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md transition-colors whitespace-nowrap min-h-[38px] ${
            activeTab === 'bracket'
              ? 'bg-white text-emerald-800 font-bold border border-slate-200 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <GitBranch className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
          <span>Tableau Final & Consolante</span>
        </button>

        <button
          onClick={() => setActiveTab('stats')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md transition-colors whitespace-nowrap min-h-[38px] ${
            activeTab === 'stats'
              ? 'bg-white text-emerald-800 font-bold border border-slate-200 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
          <span>Stats</span>
        </button>
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch gap-1 overflow-x-auto border-t border-slate-200 bg-white/95 px-1 py-1 shadow-lg backdrop-blur-md md:hidden"
        aria-label="Navigation de la vue joueurs"
      >
        {[
          ...(participantsPanel ? [{ id: 'participants' as const, label: 'Joueurs', icon: Users }] : []),
          ...(followedPairIds.length > 0 ? [{ id: 'my-matches' as const, label: 'Mes matchs', icon: Calendar }] : []),
          { id: 'courts' as const, label: 'Terrains', icon: Flame },
          { id: 'schedule' as const, label: 'Programme', icon: Calendar },
          { id: 'pools' as const, label: 'Poules', icon: Grid3X3 },
          { id: 'bracket' as const, label: 'Tableau', icon: GitBranch },
          { id: 'stats' as const, label: 'Stats', icon: BarChart3 },
        ].map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-12 min-w-[68px] flex-1 flex-col items-center justify-center rounded-lg px-1 py-1 text-[10px] font-semibold ${
                isActive ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600'
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? 'text-emerald-700' : 'text-slate-500'}`} />
              <span className="mt-0.5 whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {activeTab === 'my-matches' && (
        <section className="space-y-3">
          <h2 className="text-lg font-extrabold text-slate-900">Mes matchs</h2>
          {myMatches.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {myMatches.map(match => {
                const pair1 = match.pair1Id ? pairsMap.get(match.pair1Id) : undefined;
                const pair2 = match.pair2Id ? pairsMap.get(match.pair2Id) : undefined;
                const court = tournament.courts.find(item => item.id === match.courtId);
                return (
                  <article key={match.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-bold text-slate-900">{match.roundName}</h3>
                      <span className="font-mono text-sm font-bold text-emerald-800">
                        {court?.name ?? 'Piste à confirmer'} · {match.scheduledTime ?? 'Horaire à confirmer'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {pair1 ? `${pair1.player1.firstName} ${pair1.player1.lastName} / ${pair1.player2.firstName} ${pair1.player2.lastName}` : match.pair1Placeholder || 'Paire à confirmer'}
                      {' vs '}
                      {pair2 ? `${pair2.player1.firstName} ${pair2.player1.lastName} / ${pair2.player2.firstName} ${pair2.player2.lastName}` : match.pair2Placeholder || 'Paire à confirmer'}
                    </p>
                    {match.score && <p className="mt-2 font-mono font-bold text-emerald-800">{formatScore(match.score)}</p>}
                    <p className="mt-2 text-xs font-semibold uppercase text-slate-500">
                      {match.status === 'in_progress' ? 'En cours' : match.status === 'completed' ? 'Terminé' : 'À venir'}
                    </p>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
              Aucun match trouvé pour les paires suivies.
            </p>
          )}
        </section>
      )}

      {/* Tab 0: Participants (injected by the player portal) */}
      {activeTab === 'participants' && participantsPanel}

      {activeTab === 'stats' && <StatsPanel tournament={tournament} />}

      {/* Tab 1: Live Courts */}
      {activeTab === 'courts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {tournament.courts.map((court) => {
            const activeMatch = allMatches.find(m => m.courtId === court.id && m.status === 'in_progress');
            const nextMatch = allMatches.find(m => m.courtId === court.id && m.status === 'scheduled');

            const p1 = activeMatch?.pair1Id ? pairsMap.get(activeMatch.pair1Id) : undefined;
            const p2 = activeMatch?.pair2Id ? pairsMap.get(activeMatch.pair2Id) : undefined;

            return (
              <div
                key={court.id}
                className={`p-5 rounded-2xl border transition-all shadow-xs ${
                  activeMatch
                    ? 'bg-white border-emerald-400 shadow-sm ring-1 ring-emerald-300'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <h3 className="font-bold text-slate-900 text-sm">{court.name}</h3>
                  <span
                    className={`font-mono text-[10px] px-2 py-0.5 rounded font-bold ${
                      activeMatch
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {activeMatch ? 'EN DIRECT' : 'DISPONIBLE'}
                  </span>
                </div>

                {activeMatch ? (
                  <div className="space-y-3">
                    <span className="text-xs text-slate-500 font-mono flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>{activeMatch.roundName} · Début {activeMatch.scheduledTime}</span>
                      <FormatBadge format={activeMatch.matchFormat} />
                    </span>

                    {/* Team 1 */}
                    <div className="flex items-center justify-between text-sm">
                      <span
                        onClick={() => p1 && setSelectedPairHistory(p1)}
                        className={`font-bold text-slate-900 truncate ${p1 ? 'hover:text-emerald-700 hover:underline cursor-pointer' : ''}`}
                      >
                        {p1 ? `${p1.player1.firstName} ${p1.player1.lastName} / ${p1.player2.firstName} ${p1.player2.lastName}` : activeMatch.pair1Placeholder}
                      </span>
                    </div>

                    {/* Team 2 */}
                    <div className="flex items-center justify-between text-sm">
                      <span
                        onClick={() => p2 && setSelectedPairHistory(p2)}
                        className={`font-bold text-slate-900 truncate ${p2 ? 'hover:text-emerald-700 hover:underline cursor-pointer' : ''}`}
                      >
                        {p2 ? `${p2.player1.firstName} ${p2.player1.lastName} / ${p2.player2.firstName} ${p2.player2.lastName}` : activeMatch.pair2Placeholder}
                      </span>
                    </div>

                    {/* Score display */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium">Score en direct :</span>
                      <span className="font-mono font-bold text-base text-emerald-700 tabular-nums">
                        {formatScore(activeMatch.score)}
                      </span>
                    </div>
                  </div>
                ) : nextMatch ? (
                  <div className="py-4 text-center space-y-1">
                    <span className="text-xs text-slate-400 uppercase font-mono font-medium">Prochain match</span>
                    <p className="font-mono text-sm font-bold text-emerald-700">{nextMatch.scheduledTime}</p>
                    <p className="text-xs text-slate-700 font-medium truncate">{nextMatch.roundName}</p>
                  </div>
                ) : (
                  <div className="py-6 text-center text-slate-400 text-xs italic">
                    Piste libre pour échauffement
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Programming / Schedule (Tableau par Terrain + Liste) */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          {/* Schedule view toggle & info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>Programmation par terrain ({tournament.courts.length} pistes)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Cliquez sur les noms pour voir les historiques
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setScheduleViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
                  scheduleViewMode === 'grid'
                    ? 'bg-white text-emerald-800 shadow-xs border border-slate-200 font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Tableau par Terrain</span>
              </button>
              <button
                type="button"
                onClick={() => setScheduleViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
                  scheduleViewMode === 'list'
                    ? 'bg-white text-emerald-800 shadow-xs border border-slate-200 font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Liste Chronologique</span>
              </button>
            </div>
          </div>

          {/* VIEW 1: Grid Table by Court */}
          {scheduleViewMode === 'grid' && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className={isTvMode ? 'overflow-hidden' : 'overflow-x-auto'}>
                <table className={`w-full border-collapse text-xs ${isTvMode ? 'tv-schedule-table table-fixed' : 'min-w-[750px]'}`}>
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                      <th className="py-3 px-4 text-left font-mono font-bold text-emerald-800 uppercase tracking-wider w-24">
                        Horaire
                      </th>
                      {tournament.courts.map(court => (
                        <th key={court.id} className="py-3 px-4 text-left font-bold text-slate-900 border-l border-slate-200">
                          <div className="flex items-center justify-between">
                            <span>{court.name}</span>
                            <span className="text-[10px] font-normal text-slate-500 capitalize">
                              {court.surface}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {timeSlots.map(time => (
                      <tr key={time} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-700 align-top bg-slate-50/50 border-r border-slate-200">
                          <span className="inline-block px-2 py-1 rounded bg-slate-100 text-emerald-800">
                            {time}
                          </span>
                        </td>
                        {tournament.courts.map(court => {
                          const match = allMatches.find(
                            m => m.courtId === court.id && m.scheduledTime === time
                          );
                          const p1 = match?.pair1Id ? pairsMap.get(match.pair1Id) : undefined;
                          const p2 = match?.pair2Id ? pairsMap.get(match.pair2Id) : undefined;
                          const isLive = match?.status === 'in_progress';
                          const isFinished = match?.status === 'completed';

                          return (
                            <td
                              key={court.id}
                              className="py-2.5 px-3 border-l border-slate-100 align-top"
                            >
                              {match ? (
                                <div
                                  data-uniform-card="schedule"
                                  className={`p-2.5 rounded-xl border text-xs space-y-1.5 transition-all ${
                                    isLive
                                      ? 'bg-emerald-50 border-emerald-300 shadow-xs ring-1 ring-emerald-300/60'
                                      : isFinished
                                      ? 'bg-slate-50 border-slate-200 text-slate-500'
                                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1 text-[10px]">
                                    <span className={`font-semibold text-slate-500 ${isTvMode ? 'break-words' : 'truncate'}`}>
                                      {match.roundName}
                                    </span>
                                    <FormatBadge format={match.matchFormat} />
                                    {isLive && (
                                      <span className="font-mono font-bold text-emerald-700 animate-pulse flex items-center gap-1">
                                        <Radio className="w-2.5 h-2.5" /> LIVE
                                      </span>
                                    )}
                                    {isFinished && (
                                      <span className="font-mono text-slate-400">Terminé</span>
                                    )}
                                  </div>

                                  <div className="font-semibold space-y-0.5">
                                    <p
                                      onClick={() => p1 && setSelectedPairHistory(p1)}
                                      className={`${isTvMode ? 'break-words [overflow-wrap:anywhere]' : 'truncate'} ${
                                        match.winnerPairId === match.pair1Id
                                          ? 'text-slate-900 font-bold'
                                          : 'text-slate-700'
                                      } ${p1 ? 'hover:text-emerald-700 hover:underline cursor-pointer' : ''}`}
                                      title={p1 ? "Cliquer pour voir l'historique" : undefined}
                                    >
                                      {p1
                                        ? `${p1.player1.firstName} ${p1.player1.lastName} / ${p1.player2.firstName} ${p1.player2.lastName}`
                                        : match.pair1Placeholder}
                                    </p>
                                    <p
                                      onClick={() => p2 && setSelectedPairHistory(p2)}
                                      className={`${isTvMode ? 'break-words [overflow-wrap:anywhere]' : 'truncate'} ${
                                        match.winnerPairId === match.pair2Id
                                          ? 'text-slate-900 font-bold'
                                          : 'text-slate-500'
                                      } ${p2 ? 'hover:text-emerald-700 hover:underline cursor-pointer' : ''}`}
                                      title={p2 ? "Cliquer pour voir l'historique" : undefined}
                                    >
                                      vs{' '}
                                      {p2
                                        ? `${p2.player1.firstName} ${p2.player1.lastName} / ${p2.player2.firstName} ${p2.player2.lastName}`
                                        : match.pair2Placeholder}
                                    </p>
                                  </div>

                                  {match.score && (
                                    <div className="pt-1 border-t border-slate-100 flex items-center justify-between gap-2">
                                      <span className="font-mono font-bold text-[11px] text-emerald-700">
                                        {formatScore(match.score)}
                                      </span>
                                      <DurationBadge match={match} />
                                    </div>
                                  )}
                                  {!match.score && <DurationBadge match={match} />}
                                </div>
                              ) : (
                                <div data-uniform-card="schedule" className="p-3 rounded-lg border border-dashed border-slate-200 text-center text-[11px] text-slate-400 italic flex items-center justify-center">
                                  Piste libre
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 2: Chronological List */}
          {scheduleViewMode === 'list' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 shadow-xs">
              {scheduledListMatches.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-medium">
                  Aucun match à venir programmé.
                </div>
              ) : (
                scheduledListMatches.map((m) => {
                  const p1 = m.pair1Id ? pairsMap.get(m.pair1Id) : undefined;
                  const p2 = m.pair2Id ? pairsMap.get(m.pair2Id) : undefined;
                  const court = tournament.courts.find(c => c.id === m.courtId);

                  return (
                    <div key={m.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4 text-xs hover:bg-slate-50/60 transition-colors">
                      <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                        <span className="font-mono text-sm font-bold text-emerald-700 w-14 sm:w-16 shrink-0">
                          {m.scheduledTime || 'À suivre'}
                        </span>
                        <div className="min-w-0">
                          <span className="text-slate-500 text-[11px] flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span>{m.roundName}</span>
                            <FormatBadge format={m.matchFormat} />
                            {m.status === 'in_progress' && (
                              <span className="font-mono font-bold text-emerald-700">LIVE</span>
                            )}
                          </span>
                          <div className="font-semibold text-slate-900 text-sm">
                            <span
                              onClick={() => p1 && setSelectedPairHistory(p1)}
                              className={p1 ? 'hover:text-emerald-700 hover:underline cursor-pointer' : ''}
                            >
                              {p1 ? `${p1.player1.firstName} ${p1.player1.lastName} / ${p1.player2.firstName} ${p1.player2.lastName}` : m.pair1Placeholder}
                            </span>{' '}
                            vs{' '}
                            <span
                              onClick={() => p2 && setSelectedPairHistory(p2)}
                              className={p2 ? 'hover:text-emerald-700 hover:underline cursor-pointer' : ''}
                            >
                              {p2 ? `${p2.player1.firstName} ${p2.player1.lastName} / ${p2.player2.firstName} ${p2.player2.lastName}` : m.pair2Placeholder}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right font-mono text-slate-700 font-medium">
                        {court ? court.name : 'Terrain à confirmer'}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Pools */}
      {activeTab === 'pools' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {tournament.pools.map((pool) => (
            <div key={pool.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{pool.name}</h3>
                  <span className="text-[11px] text-slate-500">
                    Cliquez sur une équipe pour voir son historique des matchs et scores
                  </span>
                </div>
                <span className="text-xs text-emerald-700 font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Top {pool.qualifiedCount} qualifié(s)
                </span>
              </div>

              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-2 text-center">Rg</th>
                    <th className="py-2.5 px-2">Équipe</th>
                    <th className="py-2.5 px-2 text-center">Pts</th>
                    <th className="py-2.5 px-2 text-center">V/D</th>
                    <th className="py-2.5 px-2 text-center">Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pool.standings.map((st, idx) => {
                    const pair = pairsMap.get(st.pairId);
                    const isQualif = idx < pool.qualifiedCount;

                    return (
                      <tr
                        key={st.pairId}
                        className={`transition-colors cursor-pointer hover:bg-slate-50 ${
                          isQualif ? 'bg-emerald-50/40' : ''
                        }`}
                        onClick={() => {
                          if (pair) {
                            setSelectedPairHistory(pair);
                            setSelectedPoolForHistory(pool);
                          }
                        }}
                      >
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-700">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-2 font-medium text-slate-900">
                          <div className="flex items-center gap-1.5 group">
                            <span className="group-hover:text-emerald-700 group-hover:underline">
                              {pair
                                ? `${pair.player1.firstName} ${pair.player1.lastName} / ${pair.player2.firstName} ${pair.player2.lastName}`
                                : 'Paire'}
                            </span>
                            <History className="w-3 h-3 text-slate-400 opacity-60 group-hover:opacity-100 group-hover:text-emerald-700" />
                            {isQualif && (
                              <span className="ml-1 text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 font-semibold rounded">
                                Qualifié
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-emerald-700">
                          {st.points}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono text-slate-600">
                          {st.won}/{st.lost}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono text-slate-600">
                          {st.setDiff > 0 ? `+${st.setDiff}` : st.setDiff}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Tab 4: Bracket (Strict separation of Main and Consolante) */}
      {activeTab === 'bracket' && (
        <div className="space-y-4">
          {/* Sub-tabs: Tableau Principal vs Tableau Consolante */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs max-w-full overflow-x-auto whitespace-nowrap">
            <button
              type="button"
              onClick={() => {
                setBracketSubTab('main');
                setClassificationFocusMatchIds(null);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md font-semibold transition-colors min-h-[38px] ${
                bracketSubTab === 'main'
                  ? 'bg-white text-emerald-800 border border-slate-200 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
              <span>Tableau Principal ({mainBracketMatches.length} m.)</span>
            </button>

            {consolanteMatches.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setBracketSubTab('consolante');
                  setClassificationFocusMatchIds(null);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md font-semibold transition-colors min-h-[38px] ${
                  bracketSubTab === 'consolante'
                    ? 'bg-white text-amber-800 border border-slate-200 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                <span>Matchs de Classement ({consolanteMatches.length} m.)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setBracketSubTab('standings');
                setClassificationFocusMatchIds(null);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md font-semibold transition-colors min-h-[38px] ${
                bracketSubTab === 'standings'
                  ? 'bg-white text-indigo-800 border border-slate-200 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 shrink-0 text-amber-500" />
              <span>Classement Général</span>
            </button>
          </div>

          {bracketSubTab === 'standings' ? (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4 text-center">Rang · points FFT / joueur</th>
                      <th className="py-3 px-4">Équipe</th>
                      <th className="py-3 px-4 hidden md:table-cell">Club</th>
                      <th className="py-3 px-4">Statut</th>
                      <th className="py-3 px-4 hidden sm:table-cell">Détail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {computeCompleteFinalStandings(tournament).map((item) => {
                      const pair = item.pairId ? pairsMap.get(item.pairId) : undefined;
                      const isPodium = item.rank <= 3;

                      return (
                        <tr
                          key={item.rank}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isPodium ? 'bg-amber-50/30' : ''
                          }`}
                        >
                          <td className="py-3 px-4 font-black text-sm text-center">
                            <span
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-mono ${
                                item.rank === 1
                                  ? 'bg-amber-400 text-amber-950 shadow-xs'
                                  : item.rank === 2
                                  ? 'bg-slate-300 text-slate-900'
                                  : item.rank === 3
                                  ? 'bg-amber-200 text-amber-900'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {item.rank}
                            </span>
                            <span
                              className="ml-2 whitespace-nowrap text-xs font-bold text-indigo-800"
                              title={`Points FFT individuels · ${confirmedPairsCount} paire(s) confirmée(s) · ${tournament.category}`}
                            >
                              {getCompetitionPoints(tournament.category, confirmedPairsCount, item.rank) ?? '—'} pts
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {pair ? (
                              <span>
                                {pair.player1.firstName} {pair.player1.lastName} & {pair.player2.firstName} {pair.player2.lastName}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">En attente de résultat</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600 hidden md:table-cell font-medium">
                            {pair ? pair.player1.club : '—'}
                          </td>
                          <td className="py-3 px-4">
                            {item.status === 'confirmed' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Confirmé</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium">En attente</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600 text-xs hidden sm:table-cell">
                            {item.detail}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <>
              {/* Mobile Swipe Hint */}
              {activeBracketMatches.length > 0 && (
                <div className="md:hidden flex items-center justify-between px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-[11px] text-slate-600">
                  <span>👈 Glissez horizontalement pour naviguer entre les tours 👉</span>
                </div>
              )}

              <div
                ref={bracketScrollerRef}
                className={`bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 touch-pan-x shadow-xs ${isTvMode ? 'overflow-hidden' : 'overflow-x-auto'}`}
                style={isTvMode && tvFit.height ? { height: tvFit.height + 48 } : undefined}
              >
            {activeBracketMatches.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs font-medium">
                Aucun match dans ce tableau pour le moment.
              </div>
            ) : (
              <div
                ref={bracketContainerRef}
                className={`relative flex items-stretch ${isTvMode ? 'gap-8 w-max' : 'gap-10 min-w-[700px]'}`}
                style={
                  isTvMode
                    ? { transform: `scale(${tvFit.scale})`, transformOrigin: 'top left', marginLeft: tvFit.offsetX }
                    : undefined
                }
              >
                <svg
                  className="pointer-events-none absolute inset-0 z-0"
                  width={connectorSize.width}
                  height={connectorSize.height}
                  aria-hidden="true"
                >
                  {connectorPaths.map(path => (
                    <path
                      key={path.key}
                      d={path.d}
                      fill="none"
                      stroke={path.loser ? '#c7d2fe' : '#94a3b8'}
                      strokeWidth={1.5}
                      strokeDasharray={path.loser ? '4 3' : undefined}
                    />
                  ))}
                </svg>
                {sortedRoundNumbers.map((roundNum) => {
                  const roundMatches = bracketRoundsMap.get(roundNum) || [];
                  const sampleMatch = roundMatches[0];
                  const roundFormats = Array.from(
                    new Set(roundMatches.flatMap(match => (match.matchFormat ? [match.matchFormat] : [])))
                  );

                  return (
                    <div key={roundNum} className={`flex-1 flex flex-col space-y-3 ${isTvMode ? 'min-w-[300px]' : 'min-w-[220px]'}`}>
                      <div className="text-center pb-2 border-b border-slate-100">
                        {bracketSubTab === 'main' && consolanteMatches.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => openRoundClassification(roundNum)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-800 hover:text-indigo-950 hover:underline"
                            title={`Voir les matchs de classement liés à ${sampleMatch?.roundName.split(' #')[0] || `Tour ${roundNum}`}`}
                          >
                            {sampleMatch?.roundName.split(' #')[0] || `Tour ${roundNum}`}
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <span className="text-xs font-bold text-slate-800">
                            {sampleMatch?.roundName.split(' #')[0] || `Tour ${roundNum}`}
                          </span>
                        )}
                        <span className="block text-[10px] text-slate-400 font-mono">
                          {roundMatches.length} rencontre(s)
                        </span>
                        {roundFormats.length > 0 && (
                          <span className="mt-1 flex flex-wrap justify-center gap-1">
                            {roundFormats.map(format => (
                              <FormatBadge key={format} format={format} />
                            ))}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col justify-around flex-1 space-y-4">
                        {roundMatches.map((m) => {
                          const p1 = m.pair1Id ? pairsMap.get(m.pair1Id) : undefined;
                          const p2 = m.pair2Id ? pairsMap.get(m.pair2Id) : undefined;

                          return (
                            <div
                              key={m.id}
                              ref={element => {
                                if (element) matchCardRefs.current.set(m.id, element);
                                else matchCardRefs.current.delete(m.id);
                              }}
                              data-uniform-card="bracket"
                              className="relative z-10 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2 hover:border-slate-300 transition-colors shadow-xs"
                            >
                              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                                <span>Match #{m.matchNumber}</span>
                                {m.scheduledTime && (
                                  <span className="text-emerald-700 font-bold">{m.scheduledTime}</span>
                                )}
                              </div>

                              {/* Team 1 */}
                              <div
                                onClick={() => p1 && setSelectedPairHistory(p1)}
                                className={`p-2 rounded-lg flex items-center justify-between transition-colors ${
                                  m.winnerPairId === m.pair1Id
                                    ? 'bg-emerald-100 text-emerald-900 font-bold border border-emerald-200'
                                    : 'text-slate-800'
                                } ${p1 ? 'hover:text-emerald-700 hover:underline cursor-pointer' : ''}`}
                                title={p1 ? "Cliquer pour voir l'historique" : undefined}
                              >
                                <span className="truncate">
                                  {p1 ? `${p1.player1.firstName} ${p1.player1.lastName} / ${p1.player2.firstName} ${p1.player2.lastName}` : m.pair1Placeholder || 'Position 1'}
                                </span>
                                {m.winnerPairId === m.pair1Id && (
                                  <Trophy className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-1" />
                                )}
                              </div>

                              {/* Team 2 */}
                              <div
                                onClick={() => p2 && setSelectedPairHistory(p2)}
                                className={`p-2 rounded-lg flex items-center justify-between transition-colors ${
                                  m.winnerPairId === m.pair2Id
                                    ? 'bg-emerald-100 text-emerald-900 font-bold border border-emerald-200'
                                    : 'text-slate-800'
                                } ${p2 ? 'hover:text-emerald-700 hover:underline cursor-pointer' : ''}`}
                                title={p2 ? "Cliquer pour voir l'historique" : undefined}
                              >
                                <span className="truncate">
                                  {p2 ? `${p2.player1.firstName} ${p2.player1.lastName} / ${p2.player2.firstName} ${p2.player2.lastName}` : m.pair2Placeholder || 'Position 2'}
                                </span>
                                {m.winnerPairId === m.pair2Id && (
                                  <Trophy className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-1" />
                                )}
                              </div>

                              {/* Score */}
                              {m.score && (
                                <div className="text-center pt-1.5 border-t border-slate-200 space-y-0.5">
                                  <div className="font-mono font-bold text-emerald-700 text-xs">
                                    {formatScore(m.score)}
                                  </div>
                                  <DurationBadge match={m} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )}

      {/* Modal Match History for Pair */}
      <PairPoolHistoryModal
        isOpen={Boolean(selectedPairHistory)}
        pair={selectedPairHistory}
        pool={selectedPoolForHistory}
        allMatches={allMatches}
        allPairs={tournament.pairs}
        onClose={() => {
          setSelectedPairHistory(null);
          setSelectedPoolForHistory(undefined);
        }}
      />
    </div>
  );
};
