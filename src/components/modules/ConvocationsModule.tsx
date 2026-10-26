import React, { useEffect, useState } from 'react';
import { Tournament, Convocation, ConvocationMessageTemplate, Pair, Match } from '../../types/tournament';
import { buildWhatsAppLink, buildSmsLink } from '../../utils/padelCalculations';
import {
  MessageSquare,
  Phone,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  Edit3,
} from 'lucide-react';

const DEFAULT_MESSAGE_TEMPLATES: ConvocationMessageTemplate[] = [
  {
    id: 'standard',
    name: 'Convocation standard',
    text: 'Bonjour {nom} ! Vous êtes convoqué(e) avec {partenaire} pour le tournoi "{tournoi}".\nPremier match planifié à {heure} sur le {terrain}.\nMerci de vous présenter à la table du juge-arbitre 15 min avant l\'heure de convocation.',
  },
  {
    id: 'short',
    name: 'Message court',
    text: 'Bonjour {nom}, votre premier match du tournoi "{tournoi}" avec {partenaire} est prévu à {heure} sur le {terrain}. Merci d\'arriver 15 min avant.',
  },
  {
    id: 'friendly',
    name: 'Message convivial',
    text: 'Bonjour {nom} ! Prêt(e) pour le tournoi "{tournoi}" ? Votre premier match avec {partenaire} commence à {heure} sur le {terrain}. À très vite !',
  },
];

interface ConvocationsModuleProps {
  tournament: Tournament;
  onUpdateTournament: (updated: Tournament) => void;
}

export const ConvocationsModule: React.FC<ConvocationsModuleProps> = ({
  tournament,
  onUpdateTournament,
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'ready' | 'sent'>('all');
  const [selectedTemplateId, setSelectedTemplateId] = useState('standard');
  const [templateText, setTemplateText] = useState(DEFAULT_MESSAGE_TEMPLATES[0].text);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [isEditingTemplate, setIsEditingTemplate] = useState<boolean>(false);

  useEffect(() => {
    setSelectedTemplateId(DEFAULT_MESSAGE_TEMPLATES[0].id);
    setTemplateText(DEFAULT_MESSAGE_TEMPLATES[0].text);
    setNewTemplateName('');
  }, [tournament.id]);

  const pairsMap = new Map<string, Pair>(tournament.pairs.map(p => [p.id, p]));
  const courtsMap = new Map(tournament.courts.map(c => [c.id, c.name]));
  const customTemplates = tournament.convocationMessageTemplates || [];
  const availableTemplates = [...DEFAULT_MESSAGE_TEMPLATES, ...customTemplates];

  const handleSaveTemplate = () => {
    const name = newTemplateName.trim();
    if (!name || !templateText.trim()) return;

    const template: ConvocationMessageTemplate = {
      id: `custom-${Date.now()}`,
      name,
      text: templateText,
    };
    onUpdateTournament({
      ...tournament,
      convocationMessageTemplates: [...customTemplates, template],
    });
    setSelectedTemplateId(template.id);
    setNewTemplateName('');
  };

  // Create one convocation per player, using their earliest scheduled match.
  const handleGenerateConvocations = () => {
    if (tournament.convocations.length > 0) {
      if (
        !confirm(
          'Voulez-vous regénérer les convocations du premier match de chaque paire ? Les statuts d\'envoi actuels seront réinitialisés.'
        )
      ) {
        return;
      }
    }

    const allMatches: Match[] = [
      ...tournament.pools.flatMap(p => p.matches),
      ...tournament.bracketMatches,
      ...tournament.consolanteMatches,
    ];

    const scheduled = allMatches
      .filter(m => m.scheduledTime && (m.pair1Id || m.pair2Id))
      .sort((a, b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || '', undefined, { numeric: true }));

    const newConvocations: Convocation[] = [];
    const firstMatchByPair = new Map<string, Match>();

    scheduled.forEach((match) => {
      [match.pair1Id, match.pair2Id].forEach(pairId => {
        if (pairId && !firstMatchByPair.has(pairId)) {
          firstMatchByPair.set(pairId, match);
        }
      });
    });

    firstMatchByPair.forEach((match, pairId) => {
      const pair = pairsMap.get(pairId);
      if (!pair) return;

      const courtName = match.courtId ? courtsMap.get(match.courtId) || 'Terrain à définir' : 'Terrain à définir';
      const time = match.scheduledTime || '09:00';

      [pair.player1, pair.player2].forEach(player => {
        newConvocations.push({
          id: `conv_${pairId}_${player.id}`,
          pairId,
          playerId: player.id,
          tournamentId: tournament.id,
          matchId: match.id,
          time,
          courtName,
          status: 'ready',
        });
      });
    });

    onUpdateTournament({
      ...tournament,
      convocations: newConvocations,
    });
  };

  // Mark convocation as sent
  const handleMarkSent = (convId: string, channel: 'whatsapp' | 'sms') => {
    const updated = tournament.convocations.map(c => {
      if (c.id === convId) {
        return {
          ...c,
          status: 'sent' as const,
          lastSentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          channel,
        };
      }
      return c;
    });

    onUpdateTournament({
      ...tournament,
      convocations: updated,
    });
  };

  // Format message from template
  const getCompiledMessage = (playerName: string, partnerName: string, time: string, court: string) => {
    const variables: Record<string, string> = {
      nom: playerName,
      partenaire: partnerName,
      tournoi: tournament.name,
      heure: time,
      terrain: court,
    };
    return Object.entries(variables).reduce(
      (message, [key, value]) => message.split(`{${key}}`).join(value),
      templateText
    );
  };

  const filteredConvocations = tournament.convocations.filter(c => {
    if (filterStatus === 'ready') return c.status === 'ready';
    if (filterStatus === 'sent') return c.status === 'sent';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Convocations & Alertes Joueurs
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Une convocation par joueur pour son premier match, avec envoi via WhatsApp et SMS
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditingTemplate(!isEditingTemplate)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{isEditingTemplate ? 'Fermer Modèle' : 'Personnaliser Modèle'}</span>
          </button>

          <button
            onClick={handleGenerateConvocations}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Générer d'après le Programme</span>
          </button>
        </div>
      </div>

      {/* Template Editor Drawer */}
      {isEditingTemplate && (
        <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Modèle de message convocation (Variables dynamiques)
            </span>
            <span className="text-[11px] text-slate-400">
              Variables disponibles : {'{nom}'}, {'{partenaire}'}, {'{tournoi}'}, {'{heure}'}, {'{terrain}'}
            </span>
          </div>
          <textarea
            rows={3}
            value={templateText}
            onChange={(e) => setTemplateText(e.target.value)}
            className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
          />
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={selectedTemplateId}
              onChange={e => {
                const selected = availableTemplates.find(template => template.id === e.target.value);
                if (selected) {
                  setSelectedTemplateId(selected.id);
                  setTemplateText(selected.text);
                }
              }}
              className="flex-1 p-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-700"
              aria-label="Choisir un message préenregistré"
            >
              {availableTemplates.map(template => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
            <input
              value={newTemplateName}
              onChange={e => setNewTemplateName(e.target.value)}
              placeholder="Nom du nouveau modèle"
              className="flex-1 p-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-700"
              aria-label="Nom du nouveau modèle"
            />
            <button
              onClick={handleSaveTemplate}
              disabled={!newTemplateName.trim() || !templateText.trim()}
              className="px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
            >
              Enregistrer le modèle
            </button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg w-fit text-xs">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-3 py-1.5 rounded transition-colors ${
            filterStatus === 'all' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Toutes ({tournament.convocations.length})
        </button>
        <button
          onClick={() => setFilterStatus('ready')}
          className={`px-3 py-1.5 rounded transition-colors ${
            filterStatus === 'ready' ? 'bg-white text-amber-700 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          À envoyer ({tournament.convocations.filter(c => c.status === 'ready').length})
        </button>
        <button
          onClick={() => setFilterStatus('sent')}
          className={`px-3 py-1.5 rounded transition-colors ${
            filterStatus === 'sent' ? 'bg-white text-emerald-700 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Envoyées ({tournament.convocations.filter(c => c.status === 'sent').length})
        </button>
      </div>

      {/* Convocations Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Joueur convoqué</th>
                <th className="py-3 px-4">Horaire</th>
                <th className="py-3 px-4">Piste Assignée</th>
                <th className="py-3 px-4 text-center">Statut</th>
                <th className="py-3 px-4 text-center">Canal WhatsApp</th>
                <th className="py-3 px-4 text-center">Canal SMS</th>
                <th className="py-3 px-4 text-right">Dernier Envoi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredConvocations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    Aucune convocation dans cette vue. Cliquez sur &ldquo;Générer d'après le Programme&rdquo;.
                  </td>
                </tr>
              ) : (
                filteredConvocations.map((conv) => {
                  const pair = pairsMap.get(conv.pairId);
                  if (!pair) return null;

                  const player = conv.playerId === pair.player2.id ? pair.player2 : pair.player1;
                  const partner = player.id === pair.player1.id ? pair.player2 : pair.player1;
                  const message = getCompiledMessage(
                    `${player.firstName} ${player.lastName}`,
                    `${partner.firstName} ${partner.lastName}`,
                    conv.time,
                    conv.courtName
                  );
                  const waLink = buildWhatsAppLink(player.phone, message);
                  const smsLink = buildSmsLink(player.phone, message);

                  return (
                    <tr key={conv.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {player.firstName} {player.lastName}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Avec {partner.firstName} {partner.lastName} · {player.phone}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono font-bold text-slate-900 text-sm">
                        {conv.time}
                      </td>

                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {conv.courtName}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {conv.status === 'sent' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Envoyée
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <Clock className="w-3.5 h-3.5" /> En attente
                          </span>
                        )}
                      </td>

                      {/* WhatsApp 1-click button */}
                      <td className="py-3 px-4 text-center">
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => handleMarkSent(conv.id, 'whatsapp')}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold transition-colors shadow-xs"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                          <span>WhatsApp</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </td>

                      {/* SMS 1-click button */}
                      <td className="py-3 px-4 text-center">
                        <a
                          href={smsLink}
                          onClick={() => handleMarkSent(conv.id, 'sms')}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 rounded-lg text-xs font-semibold transition-colors shadow-xs"
                        >
                          <Phone className="w-3.5 h-3.5 text-sky-600" />
                          <span>SMS</span>
                        </a>
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-slate-500 text-xs">
                        {conv.lastSentAt || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
