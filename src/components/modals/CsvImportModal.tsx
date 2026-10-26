import React, { useState, useRef } from 'react';
import { Tournament, Pair } from '../../types/tournament';
import {
  parseFftParticipantsCsv,
  SAMPLE_FFT_FILE_CONTENT,
  ParseResult,
} from '../../utils/csvImportParser';
import { rankAndSeedPairs } from '../../utils/padelCalculations';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sparkles,
  ArrowRight,
  Database,
} from 'lucide-react';

interface CsvImportModalProps {
  isOpen: boolean;
  tournament: Tournament;
  onClose: () => void;
  onImportPairs: (pairs: Pair[], replaceExisting: boolean) => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  tournament,
  onClose,
  onImportPairs,
}) => {
  if (!isOpen) return null;

  const [rawText, setRawText] = useState<string>('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [replaceExisting, setReplaceExisting] = useState<boolean>(true);
  const [autoSeed, setAutoSeed] = useState<boolean>(true);
  const [activeInputTab, setActiveInputTab] = useState<'upload' | 'paste'>('upload');
  const [fileName, setFileName] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProcessText = (content: string, name?: string) => {
    setRawText(content);
    if (name) setFileName(name);
    const result = parseFftParticipantsCsv(content, tournament.id);
    setParseResult(result);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) handleProcessText(content, file.name);
      };
      reader.readAsText(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) handleProcessText(content, file.name);
      };
      reader.readAsText(file);
    }
  };

  const handleLoadSampleFile = () => {
    handleProcessText(SAMPLE_FFT_FILE_CONTENT, 'Copie_de_Liste_des_participants__padel');
  };

  const handleConfirmImport = () => {
    if (!parseResult || parseResult.pairs.length === 0) return;

    if (replaceExisting && tournament.pairs.length > 0) {
      if (
        !confirm(
          `Voulez-vous vraiment remplacer les ${tournament.pairs.length} paires existantes par les ${parseResult.pairs.length} nouvelles paires ?`
        )
      ) {
        return;
      }
    }

    let finalPairs = parseResult.pairs;
    if (autoSeed) {
      finalPairs = rankAndSeedPairs(finalPairs, 4);
    }

    onImportPairs(finalPairs, replaceExisting);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Import Fichier FFT & Ten'Up (Liste des participants)
              </h3>
              <p className="text-xs text-slate-500">
                Format officiel FFT avec joueurs, classements, clubs, licences, coordonnées et poids de paire
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Top Options: Dropzone / Paste tab & Sample Loader */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setActiveInputTab('upload')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  activeInputTab === 'upload'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Fichier CSV / Excel
              </button>
              <button
                type="button"
                onClick={() => setActiveInputTab('paste')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  activeInputTab === 'paste'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Coller texte brut CSV
              </button>
            </div>

            <button
              type="button"
              onClick={handleLoadSampleFile}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors shadow-xs"
              title="Charge directement les 9 paires du fichier Liste des participants (ASPTT Fourragère)"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Charger fichier transmis (9 paires)</span>
            </button>
          </div>

          {/* Input Method */}
          {activeInputTab === 'upload' ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/20 rounded-xl p-8 text-center cursor-pointer transition-all space-y-2"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".csv, .txt, text/csv, application/vnd.ms-excel"
                className="hidden"
              />
              <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-emerald-600 mx-auto shadow-xs">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-slate-800">
                {fileName ? (
                  <span className="text-emerald-700 font-bold">{fileName}</span>
                ) : (
                  'Glissez-déposez votre fichier CSV ici, ou cliquez pour parcourir'
                )}
              </p>
              <p className="text-[11px] text-slate-500">
                Prend en charge les séparateurs virgule (,), point-virgule (;) ou tabulation
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <textarea
                rows={6}
                value={rawText}
                onChange={(e) => handleProcessText(e.target.value)}
                placeholder="Collez ici les lignes CSV de votre export FFT / Ten'Up..."
                className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {/* Warnings if any */}
          {parseResult?.warnings && parseResult.warnings.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1 text-xs text-amber-900">
              <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Avertissements d'importation :</span>
              </div>
              <ul className="list-disc pl-5 text-[11px] text-amber-800 space-y-0.5">
                {parseResult.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Parse Result Summary & Preview Table */}
          {parseResult && parseResult.pairs.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{parseResult.validCount} paires détectées avec succès</span>
                  </div>
                  {parseResult.eventName && (
                    <span className="text-slate-600">
                      Épreuve : <strong className="text-slate-900">{parseResult.eventName}</strong>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-[11px] text-slate-700 font-medium">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={replaceExisting}
                      onChange={(e) => setReplaceExisting(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-emerald-600 border-slate-300"
                    />
                    <span>Remplacer les paires actuelles</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoSeed}
                      onChange={(e) => setAutoSeed(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-emerald-600 border-slate-300"
                    />
                    <span>Calculer les Têtes de Série (TS)</span>
                  </label>
                </div>
              </div>

              {/* Data Table Preview */}
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase sticky top-0">
                    <tr>
                      <th className="py-2 px-3 text-center w-12">Pos</th>
                      <th className="py-2 px-3">Joueur 1</th>
                      <th className="py-2 px-3">Club J1</th>
                      <th className="py-2 px-3">Joueur 2</th>
                      <th className="py-2 px-3">Club J2</th>
                      <th className="py-2 px-3 text-right">Poids Paire</th>
                      <th className="py-2 px-3">Téléphone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {parseResult.pairs.map((p, idx) => {
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3 text-center font-mono text-slate-500 font-bold">
                            #{p.entryPosition || idx + 1}
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-semibold text-slate-900">
                              {p.player1.lastName} {p.player1.firstName}
                            </span>
                            <span className="block text-[10px] text-emerald-700 font-mono font-medium">
                              Rang : N° {p.player1.ranking} · Lic: {p.player1.licenseNumber}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-[11px] text-slate-600 truncate max-w-[140px]">
                            {p.player1.club}
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-semibold text-slate-900">
                              {p.player2.lastName} {p.player2.firstName}
                            </span>
                            <span className="block text-[10px] text-emerald-700 font-mono font-medium">
                              Rang : N° {p.player2.ranking} · Lic: {p.player2.licenseNumber}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-[11px] text-slate-600 truncate max-w-[140px]">
                            {p.player2.club}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                            {p.totalWeight}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                            {p.player1.phone || p.player2.phone || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
          <div className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span>Format conforme Ten'Up / Gestion Sportive FFT</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={!parseResult || parseResult.pairs.length === 0}
              onClick={handleConfirmImport}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shadow-xs"
            >
              <span>
                Importer {parseResult ? `${parseResult.validCount} Paires` : 'les Paires'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
