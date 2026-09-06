import React, { useState, useEffect } from 'react';
import {
  GradingScaleItem,
  Teacher
} from '../types';
import {
  DEFAULT_GENERAL_GRADING_SCALE,
  DEFAULT_SECONDARY_WAEC_SCALE,
  DEFAULT_EARLY_YEARS_SCALE,
  getActiveGradingScales,
  setActiveGradingScales,
  getGradeAndRemark
} from '../utils/grading';
import { FirebaseService } from '../services/firebaseService';
import {
  X,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Sparkles,
  Calculator,
  Check,
  AlertCircle,
  Shield,
  Layers,
  GraduationCap
} from 'lucide-react';

interface GradingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: Teacher | null;
  onScalesUpdated?: (newScales: GradingScaleItem[]) => void;
}

export const GradingSettingsModal: React.FC<GradingSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onScalesUpdated
}) => {
  const [scales, setScales] = useState<GradingScaleItem[]>(() => getActiveGradingScales());
  const [testScore, setTestScore] = useState<number | string>(75);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedSection, setSelectedSection] = useState<string>('All');

  // Form for adding a new tier
  const [isAddingTier, setIsAddingTier] = useState(false);
  const [newTier, setNewTier] = useState<GradingScaleItem>({
    id: '',
    minScore: 50,
    maxScore: 59.9,
    grade: 'C',
    remark: 'Credit',
    gpaPoint: 3.0,
    section: 'All',
    description: ''
  });

  useEffect(() => {
    if (isOpen) {
      FirebaseService.fetchGradingScales().then((fetched) => {
        if (fetched && fetched.length > 0) {
          setScales(fetched);
        }
      });
      setFeedback(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: 'general' | 'secondary' | 'early_years') => {
    let chosen: GradingScaleItem[] = [];
    if (preset === 'general') chosen = DEFAULT_GENERAL_GRADING_SCALE;
    if (preset === 'secondary') chosen = DEFAULT_SECONDARY_WAEC_SCALE;
    if (preset === 'early_years') chosen = DEFAULT_EARLY_YEARS_SCALE;

    setScales(JSON.parse(JSON.stringify(chosen)));
    setFeedback({
      type: 'success',
      message: `Loaded preset scale template. Click "Save to Firebase" to apply school-wide.`
    });
  };

  const handleUpdateItem = (index: number, field: keyof GradingScaleItem, value: any) => {
    setScales((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleDeleteItem = (index: number) => {
    if (scales.length <= 2) {
      setFeedback({ type: 'error', message: 'You must maintain at least 2 grading tiers.' });
      return;
    }
    setScales((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddTierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTier.grade.trim()) {
      setFeedback({ type: 'error', message: 'Please enter a valid Grade code (e.g., A, A1, B+).' });
      return;
    }
    if (Number(newTier.minScore) > Number(newTier.maxScore)) {
      setFeedback({ type: 'error', message: 'Min Score cannot exceed Max Score.' });
      return;
    }

    const item: GradingScaleItem = {
      ...newTier,
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      minScore: Number(newTier.minScore),
      maxScore: Number(newTier.maxScore),
      gpaPoint: Number(newTier.gpaPoint) || 0,
      section: selectedSection || 'All'
    };

    setScales((prev) => [...prev, item].sort((a, b) => b.minScore - a.minScore));
    setIsAddingTier(false);
    setNewTier({
      id: '',
      minScore: 0,
      maxScore: 39.9,
      grade: 'F',
      remark: 'Fail',
      gpaPoint: 0.0,
      section: 'All',
      description: ''
    });
    setFeedback({ type: 'success', message: `Added tier "${item.grade}". Remember to save changes.` });
  };

  const handleSaveToFirebase = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      // Validate
      const sorted = [...scales].sort((a, b) => b.minScore - a.minScore);
      const res = await FirebaseService.saveGradingScales(
        sorted,
        currentUser?.FullName || currentUser?.Username || 'Teacher/Admin'
      );
      if (res.success) {
        setActiveGradingScales(sorted);
        if (onScalesUpdated) {
          onScalesUpdated(sorted);
        }
        setFeedback({
          type: 'success',
          message: 'Academic grading configuration successfully updated school-wide!'
        });
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Live Test Calculation
  const evaluatedTest = getGradeAndRemark(
    typeof testScore === 'number' ? testScore : parseFloat(testScore as string) || 0,
    scales,
    selectedSection
  );

  const filteredScales = scales.filter(
    (s) => selectedSection === 'All' || !s.section || s.section === 'All' || s.section === selectedSection
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-300">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Academic Grading Scales & Settings</h2>
              <p className="text-xs text-indigo-200">
                Configure score thresholds, grade letters, remarks, and GPA points (Configurable by Teachers & Admins)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback alert */}
        {feedback && (
          <div
            className={`px-6 py-3 text-sm flex items-center justify-between border-b ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <div className="flex items-center space-x-2">
              {feedback.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-xs font-semibold hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          {/* Section 1: Presets & Controls */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Quick Template Presets
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyPreset('general')}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition"
                >
                  Standard 5-Point Scale (A-F)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('secondary')}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg border border-indigo-200 transition"
                >
                  WAEC / NECO 9-Point (A1-F9)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('early_years')}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold rounded-lg border border-amber-200 transition"
                >
                  Early Years / Nursery Scale
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setIsAddingTier(true)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Grade Tier</span>
              </button>
            </div>
          </div>

          {/* Section 2: Live Simulator Box */}
          <div className="bg-gradient-to-br from-indigo-50/80 via-white to-blue-50/80 p-4 rounded-xl border border-indigo-100 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-xs">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Live Grade Simulator</h4>
                <p className="text-xs text-slate-500">Test how any student score is classified under the current rules</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <label className="text-xs font-bold text-slate-600">Test Score (%):</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={testScore}
                  onChange={(e) => setTestScore(e.target.value)}
                  className="w-20 px-2.5 py-1.5 bg-white border border-indigo-200 rounded-lg text-sm font-bold text-slate-800 text-center shadow-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="h-6 w-px bg-indigo-200" />

              <div className="flex items-center space-x-2">
                <span className="text-xs font-medium text-slate-500">Result:</span>
                <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${evaluatedTest.badgeBg}`}>
                  Grade {evaluatedTest.grade} ({evaluatedTest.remark})
                </span>
                {evaluatedTest.gpaPoint !== undefined && (
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                    {evaluatedTest.gpaPoint.toFixed(1)} pts
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Add Tier Form Modal / Card */}
          {isAddingTier && (
            <form
              onSubmit={handleAddTierSubmit}
              className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 space-y-3 animate-in fade-in duration-100"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900">Add New Grading Tier</h4>
                <button
                  type="button"
                  onClick={() => setIsAddingTier(false)}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Grade Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. A1 or A+"
                    value={newTier.grade}
                    onChange={(e) => setNewTier({ ...newTier, grade: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Min Score</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    step="0.1"
                    value={newTier.minScore}
                    onChange={(e) => setNewTier({ ...newTier, minScore: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Max Score</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    step="0.1"
                    value={newTier.maxScore}
                    onChange={(e) => setNewTier({ ...newTier, maxScore: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Remark</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Excellent"
                    value={newTier.remark}
                    onChange={(e) => setNewTier({ ...newTier, remark: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">GPA Point</label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.5"
                    value={newTier.gpaPoint}
                    onChange={(e) => setNewTier({ ...newTier, gpaPoint: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingTier(false)}
                  className="px-3 py-1 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs"
                >
                  Confirm Tier
                </button>
              </div>
            </form>
          )}

          {/* Section 3: Grading Scale Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Active Grading Thresholds ({filteredScales.length} Tiers)
              </span>
              <span className="text-[11px] text-slate-500">
                Highest scores at the top. Ranges must be contiguous.
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/75 text-slate-600 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-4">Grade</th>
                    <th className="py-2.5 px-4">Min Score (%)</th>
                    <th className="py-2.5 px-4">Max Score (%)</th>
                    <th className="py-2.5 px-4">Official Remark</th>
                    <th className="py-2.5 px-4">GPA Point</th>
                    <th className="py-2.5 px-4">Section</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredScales.map((item, index) => (
                    <tr key={item.id || index} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-4">
                        <input
                          type="text"
                          value={item.grade}
                          onChange={(e) => handleUpdateItem(index, 'grade', e.target.value)}
                          className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded font-bold text-slate-800 text-center"
                        />
                      </td>
                      <td className="py-2.5 px-4">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={item.minScore}
                          onChange={(e) =>
                            handleUpdateItem(index, 'minScore', parseFloat(e.target.value) || 0)
                          }
                          className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-800 text-center"
                        />
                      </td>
                      <td className="py-2.5 px-4">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={item.maxScore}
                          onChange={(e) =>
                            handleUpdateItem(index, 'maxScore', parseFloat(e.target.value) || 0)
                          }
                          className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-800 text-center"
                        />
                      </td>
                      <td className="py-2.5 px-4">
                        <input
                          type="text"
                          value={item.remark}
                          onChange={(e) => handleUpdateItem(index, 'remark', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-800"
                        />
                      </td>
                      <td className="py-2.5 px-4">
                        <input
                          type="number"
                          min="0"
                          max="5"
                          step="0.5"
                          value={item.gpaPoint ?? 0}
                          onChange={(e) =>
                            handleUpdateItem(index, 'gpaPoint', parseFloat(e.target.value) || 0)
                          }
                          className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded font-bold text-indigo-700 text-center"
                        />
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 font-medium">
                        {item.section || 'All'}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(index)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Delete tier"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <Shield className="w-4 h-4 text-indigo-600" />
            <span>Changes are synced live to Firebase Firestore and reflect across all report cards.</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSaveToFirebase}
              disabled={isSaving}
              className="inline-flex items-center space-x-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Save to Firebase</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
