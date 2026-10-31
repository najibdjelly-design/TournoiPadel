import React, { useMemo, useState } from 'react';
import { Match, Pair, Tournament } from '../../types/tournament';
import { BarChart3, Clock, Flame, Medal, Swords, Timer, Trophy, Users } from 'lucide-react';

const pairName = (pair?: Pair) =>
  pair
    ? `${pair.player1.firstName} ${pair.player1.lastName} / ${pair.player2.firstName} ${pair.player2.lastName}`
    : 'Équipe à confirmer';

const matchWinner = (match: Match) => match.winnerPairId ?? match.score?.winnerPairId;
const isDone = (match: Match) => match.status === 'completed' || (match.status === 'walkover' && Boolean(matchWinner(match)));
const isForfeit = (match: Match) => Boolean(match.score?.isWalkover) || match.status === 'walkover';

const durationOf = (match: Match): number | undefined => {
  const start = match.startedAt ? Date.parse(match.startedAt) : NaN;
  const end = match.completedAt ? Date.parse(match.completedAt) : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return undefined;
  const minutes = (end - start) / 60000;
  return minutes >= 5 && minutes <= 300 ? minutes : undefined;
};

const gamesOf = (match: Match) => {
  const sets = match.score?.sets ?? [];
  return {
    g1: sets.reduce((sum, set) => sum + set.pair1, 0),
    g2: sets.reduce((sum, set) => sum + set.pair2, 0),
  };
};

const scoreText = (match: Match) =>
  match.score?.sets?.length
    ? match.score.sets.map(set => `${set.pair1}-${set.pair2}`).join(' ')
    : isForfeit(match)
      ? 'Forfait'
      : '—';

const formatMinutes = (minutes: number) => {
  const rounded = Math.round(minutes);
  return rounded >= 60 ? `${Math.floor(rounded / 60)} h ${String(rounded % 60).padStart(2, '0')}` : `${rounded} min`;
};

const Card: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
    <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-900">
      {icon}
      {title}
    </h3>
    {children}
  </section>
);

const Empty: React.FC<{ text?: string }> = ({ text = 'Pas encore assez de matchs joués.' }) => (
  <p className="text-xs text-slate-500">{text}</p>
);

interface Record {
  label: string;
  match: Match;
  value: string;
}

export const StatsPanel: React.FC<{ tournament: Tournament }> = ({ tournament }) => {
  const pairsMap = useMemo(() => new Map(tournament.pairs.map(pair => [pair.id, pair])), [tournament.pairs]);
  const [headA, setHeadA] = useState('');
  const [headB, setHeadB] = useState('');

  const stats = useMemo(() => {
    const all: Match[] = [
      ...tournament.pools.flatMap(pool => pool.matches),
      ...tournament.bracketMatches,
      ...tournament.consolanteMatches,
    ];
    // Byes are auto-validated walkovers without score: they are not real matches
    const real = all.filter(match => !(match.status === 'walkover' && !match.score?.sets?.length && !(match.pair1Id && match.pair2Id)));
    const done = real.filter(isDone);
    const played = done.filter(match => !isForfeit(match) || match.score?.sets?.length);
    const live = real.filter(match => match.status === 'in_progress');
    const remaining = real.length - done.length;

    const durations = played.map(durationOf).filter((value): value is number => value !== undefined);
    const avgDuration = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : undefined;
    const courtCount = Math.max(1, tournament.courts.length);
    const slotLength = avgDuration ?? tournament.slotDurationMinutes ?? 75;
    const etaMinutes = remaining > 0 ? Math.ceil(remaining / courtCount) * slotLength : 0;

    const ordered = [...done].sort(
      (a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? '') || a.matchNumber - b.matchNumber
    );

    // Pair and player aggregates
    const pairStats = new Map<string, { played: number; won: number; lost: number; gw: number; gl: number; streak: number; best: number }>();
    const entry = (id: string) => {
      if (!pairStats.has(id)) pairStats.set(id, { played: 0, won: 0, lost: 0, gw: 0, gl: 0, streak: 0, best: 0 });
      return pairStats.get(id)!;
    };

    for (const match of ordered) {
      if (!match.pair1Id || !match.pair2Id) continue;
      const winner = matchWinner(match);
      const { g1, g2 } = isForfeit(match) && !match.score?.sets?.length ? { g1: 0, g2: 0 } : gamesOf(match);
      const sides: Array<[string, number, number]> = [
        [match.pair1Id, g1, g2],
        [match.pair2Id, g2, g1],
      ];
      for (const [pairId, gw, gl] of sides) {
        const item = entry(pairId);
        item.played += 1;
        item.gw += gw;
        item.gl += gl;
        if (winner === pairId) {
          item.won += 1;
          item.streak += 1;
          item.best = Math.max(item.best, item.streak);
        } else {
          item.lost += 1;
          item.streak = 0;
        }
      }
    }

    const ranking = [...pairStats.entries()]
      .map(([pairId, s]) => ({ pairId, ...s, diff: s.gw - s.gl }))
      .sort((a, b) => b.won - a.won || b.diff - a.diff || b.gw - a.gw);
    const topPairs = ranking.slice(0, 10);

    // Records
    const records: Record[] = [];
    const timed = played.filter(match => durationOf(match) !== undefined);
    if (timed.length) {
      const longest = timed.reduce((a, b) => (durationOf(b)! > durationOf(a)! ? b : a));
      const shortest = timed.reduce((a, b) => (durationOf(b)! < durationOf(a)! ? b : a));
      records.push({ label: 'Match le plus long', match: longest, value: formatMinutes(durationOf(longest)!) });
      if (shortest.id !== longest.id) {
        records.push({ label: 'Match le plus court', match: shortest, value: formatMinutes(durationOf(shortest)!) });
      }
    }
    const scored = played.filter(match => match.score?.sets?.length && !isForfeit(match));
    if (scored.length) {
      const gap = (match: Match) => {
        const { g1, g2 } = gamesOf(match);
        return Math.abs(g1 - g2);
      };
      const widest = scored.reduce((a, b) => (gap(b) > gap(a) ? b : a));
      const tightest = scored.reduce((a, b) => {
        const closeness = (match: Match) => gap(match) * 10 - (match.score?.sets.length ?? 0);
        return closeness(b) < closeness(a) ? b : a;
      });
      records.push({ label: 'Plus gros écart', match: widest, value: `${gap(widest)} jeux d'écart` });
      if (tightest.id !== widest.id) {
        records.push({ label: 'Match le plus serré', match: tightest, value: `${gap(tightest)} jeu(x) d'écart` });
      }
    }
    const bestStreak = [...pairStats.entries()].sort((a, b) => b[1].best - a[1].best)[0];

    // Rematches
    const meetings = new Map<string, Match[]>();
    for (const match of done) {
      if (!match.pair1Id || !match.pair2Id) continue;
      const key = [match.pair1Id, match.pair2Id].sort().join('|');
      meetings.set(key, [...(meetings.get(key) ?? []), match]);
    }
    const rematches = [...meetings.entries()].filter(([, list]) => list.length > 1);

    // Courts
    const dayStart = (match: Match) => {
      if (match.scheduledAt && Number.isFinite(Date.parse(match.scheduledAt))) return Date.parse(match.scheduledAt);
      if (!match.scheduledTime) return undefined;
      const stamp = Date.parse(`${tournament.dates.start || new Date().toISOString().slice(0, 10)}T${match.scheduledTime}:00`);
      return Number.isFinite(stamp) ? stamp : undefined;
    };
    const startedMatches = real.filter(match => match.startedAt && match.courtId);
    const firstStart = startedMatches.length ? Math.min(...startedMatches.map(match => Date.parse(match.startedAt!))) : undefined;
    const courts = tournament.courts.map(court => {
      const onCourt = real.filter(match => match.courtId === court.id && (isDone(match) || match.status === 'in_progress') && match.startedAt);
      const busy = onCourt.reduce((sum, match) => sum + (durationOf(match) ?? 0), 0);
      const delays = onCourt
        .map(match => {
          const planned = dayStart(match);
          return planned ? (Date.parse(match.startedAt!) - planned) / 60000 : undefined;
        })
        .filter((value): value is number => value !== undefined && Math.abs(value) < 600);
      const span = firstStart ? (Math.max(Date.now(), firstStart) - firstStart) / 60000 : 0;
      return {
        court,
        count: onCourt.length,
        busy,
        usage: span > 0 ? Math.min(100, Math.round((busy / span) * 100)) : 0,
        delay: delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : undefined,
      };
    });
    const allDelays = courts.flatMap(item => (item.delay !== undefined ? [item.delay] : []));

    return {
      total: real.length,
      doneCount: done.length,
      liveCount: live.length,
      remaining,
      avgDuration,
      etaMinutes,
      alive: tournament.pairs.filter(pair => pair.status === 'confirmed').length,
      records,
      bestStreak: bestStreak && bestStreak[1].best >= 2 ? bestStreak : undefined,
      ranking,
      topPairs,
      rematches,
      courts,
      globalDelay: allDelays.length ? allDelays.reduce((a, b) => a + b, 0) / allDelays.length : undefined,
      done,
    };
  }, [tournament, pairsMap]);

  const headToHead = useMemo(() => {
    if (!headA || !headB || headA === headB) return [];
    return stats.done.filter(
      match =>
        (match.pair1Id === headA && match.pair2Id === headB) || (match.pair1Id === headB && match.pair2Id === headA)
    );
  }, [stats.done, headA, headB]);

  const progress = stats.total ? Math.round((stats.doneCount / stats.total) * 100) : 0;
  const eta = stats.remaining > 0 && stats.doneCount > 0
    ? new Date(Date.now() + stats.etaMinutes * 60000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : undefined;
  const sortedPairs = [...tournament.pairs].sort((a, b) => pairName(a).localeCompare(pairName(b)));
  const winRate = (won: number, played: number) => (played ? `${Math.round((won / played) * 100)} %` : '—');
  const matchLine = (match: Match) => `${pairName(pairsMap.get(match.pair1Id ?? ''))} vs ${pairName(pairsMap.get(match.pair2Id ?? ''))}`;

  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
        <BarChart3 className="h-5 w-5 text-emerald-600" /> Statistiques du tournoi
      </h2>

      <Card icon={<Timer className="h-4 w-4 text-emerald-600" />} title="Chiffres clés">
        <div className="mb-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
        </div>
        <dl className="grid grid-cols-2 gap-3 text-center md:grid-cols-5">
          {[
            ['Avancement', `${progress} %`],
            ['Matchs joués', `${stats.doneCount} / ${stats.total}`],
            ['En cours', String(stats.liveCount)],
            ['Durée moyenne', stats.avgDuration ? formatMinutes(stats.avgDuration) : '—'],
            ['Fin estimée', eta ? `~${eta}` : stats.remaining === 0 && stats.total > 0 ? 'Terminé' : '—'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-slate-50 p-2.5">
              <dt className="text-[11px] font-semibold text-slate-500">{label}</dt>
              <dd className="mt-0.5 text-base font-extrabold text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card icon={<Flame className="h-4 w-4 text-orange-500" />} title="Records">
          {stats.records.length || stats.bestStreak ? (
            <ul className="space-y-2.5 text-xs">
              {stats.records.map(record => (
                <li key={record.label} className="rounded-lg bg-slate-50 p-2.5">
                  <p className="flex justify-between gap-2 font-bold text-slate-900">
                    <span>{record.label}</span>
                    <span className="text-emerald-700">{record.value}</span>
                  </p>
                  <p className="mt-0.5 break-words text-slate-600">{matchLine(record.match)}</p>
                  <p className="font-mono text-slate-500">{scoreText(record.match)}</p>
                </li>
              ))}
              {stats.bestStreak && (
                <li className="rounded-lg bg-slate-50 p-2.5">
                  <p className="flex justify-between gap-2 font-bold text-slate-900">
                    <span>Plus longue série de victoires</span>
                    <span className="text-emerald-700">{stats.bestStreak[1].best} d'affilée</span>
                  </p>
                  <p className="mt-0.5 break-words text-slate-600">{pairName(pairsMap.get(stats.bestStreak[0]))}</p>
                </li>
              )}
            </ul>
          ) : (
            <Empty />
          )}
        </Card>

        <Card icon={<Medal className="h-4 w-4 text-amber-500" />} title="Top paires">
          {stats.topPairs.length ? (
            <ol className="space-y-1.5 text-xs">
              {stats.topPairs.map((row, index) => (
                <li key={row.pairId} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
                  <span className="w-5 shrink-0 font-extrabold text-slate-400">{index + 1}</span>
                  <span className="min-w-0 flex-1 break-words font-semibold text-slate-900">
                    {pairName(pairsMap.get(row.pairId))}
                  </span>
                  <span className="shrink-0 text-slate-600">
                    {row.won}V / {row.lost}D · {row.gw} jeux
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <Empty />
          )}
        </Card>
      </div>

      <Card icon={<Trophy className="h-4 w-4 text-emerald-600" />} title="Classement général des équipes">
        {stats.ranking.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] text-slate-500">
                  <th className="py-1.5 pr-2">#</th>
                  <th className="py-1.5 pr-2">Équipe</th>
                  <th className="px-2 text-center">J</th>
                  <th className="px-2 text-center">V</th>
                  <th className="px-2 text-center">D</th>
                  <th className="px-2 text-center">% V</th>
                  <th className="px-2 text-center">Jeux +/-</th>
                </tr>
              </thead>
              <tbody>
                {stats.ranking.map((row, index) => (
                  <tr key={row.pairId} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2 font-bold text-slate-400">{index + 1}</td>
                    <td className="py-1.5 pr-2 font-semibold text-slate-900">{pairName(pairsMap.get(row.pairId))}</td>
                    <td className="px-2 text-center">{row.played}</td>
                    <td className="px-2 text-center font-bold text-emerald-700">{row.won}</td>
                    <td className="px-2 text-center">{row.lost}</td>
                    <td className="px-2 text-center">{winRate(row.won, row.played)}</td>
                    <td className="px-2 text-center font-mono">
                      {row.diff > 0 ? '+' : ''}
                      {row.diff}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </Card>

      <Card icon={<Swords className="h-4 w-4 text-rose-500" />} title="Face-à-face entre équipes">
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            [headA, setHeadA],
            [headB, setHeadB],
          ].map(([value, setter], index) => (
            <select
              key={index}
              value={value as string}
              onChange={event => (setter as (v: string) => void)(event.target.value)}
              className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs font-semibold"
              aria-label={`Équipe ${index + 1}`}
            >
              <option value="">Équipe {index + 1}…</option>
              {sortedPairs.map(pair => (
                <option key={pair.id} value={pair.id}>
                  {pairName(pair)}
                </option>
              ))}
            </select>
          ))}
        </div>
        {headA && headB && headA !== headB ? (
          headToHead.length ? (
            <ul className="mt-3 space-y-1.5 text-xs">
              {headToHead.map(match => (
                <li key={match.id} className="rounded-lg bg-slate-50 p-2.5">
                  <p className="font-semibold text-slate-700">{match.roundName}</p>
                  <p className="break-words text-slate-900">{matchLine(match)}</p>
                  <p className="font-mono text-slate-500">
                    {scoreText(match)} · Vainqueur : {pairName(pairsMap.get(matchWinner(match) ?? ''))}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Ces deux équipes ne se sont pas encore affrontées.</p>
          )
        ) : stats.rematches.length ? (
          <div className="mt-3 text-xs">
            <p className="mb-1.5 font-bold text-slate-700">Équipes déjà rencontrées plusieurs fois</p>
            <ul className="space-y-1">
              {stats.rematches.map(([key, list]) => (
                <li key={key} className="break-words rounded-lg bg-slate-50 px-2.5 py-1.5 text-slate-700">
                  {matchLine(list[0])} · {list.length} matchs
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-500">Choisissez deux équipes pour comparer leurs confrontations.</p>
        )}
      </Card>

      <Card icon={<Clock className="h-4 w-4 text-sky-600" />} title="Occupation des terrains et retards">
        {stats.courts.some(item => item.count > 0) ? (
          <div className="space-y-3">
            {stats.courts.map(item => (
              <div key={item.court.id} className="text-xs">
                <div className="mb-1 flex flex-wrap justify-between gap-x-3 font-semibold text-slate-800">
                  <span>{item.court.name}</span>
                  <span className="text-slate-500">
                    {item.count} match(s) · {item.busy ? formatMinutes(item.busy) : '—'} de jeu
                    {item.delay !== undefined &&
                      ` · ${item.delay > 0 ? 'retard moyen' : 'avance moyenne'} ${Math.round(Math.abs(item.delay))} min`}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-sky-500" style={{ width: `${item.usage}%` }} />
                </div>
                <p className="mt-0.5 text-[10px] text-slate-400">{item.usage} % d'occupation</p>
              </div>
            ))}
            {stats.globalDelay !== undefined && (
              <p className="flex items-center gap-1.5 rounded-lg bg-slate-50 p-2.5 text-xs font-bold text-slate-700">
                <Users className="h-3.5 w-3.5" />
                {stats.globalDelay > 0 ? 'Retard' : 'Avance'} moyen sur le planning : {Math.round(Math.abs(stats.globalDelay))} min
              </p>
            )}
          </div>
        ) : (
          <Empty text="Les données apparaîtront dès que des matchs auront été lancés." />
        )}
      </Card>
    </div>
  );
};
