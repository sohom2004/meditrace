import React, { useState } from 'react';
import { Users, Plus, Check, Trash2, X, Shield, Sparkles, UserCheck, AlertCircle, Heart } from 'lucide-react';
import { api } from '../api';

interface AccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  careProfiles: any[];
  activeProfileId: string;
  onSelectProfile: (profileId: string) => void;
  onRefreshProfiles: () => Promise<void>;
  onSignOut: () => void;
}

export const AccountsModal: React.FC<AccountsModalProps> = ({
  isOpen,
  onClose,
  careProfiles,
  activeProfileId,
  onSelectProfile,
  onRefreshProfiles,
  onSignOut,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [fullName, setFullName] = useState('');
  const [relationship, setRelationship] = useState('child');
  const [gender, setGender] = useState('Male');
  const [dob, setDob] = useState('2002-05-18');
  const [bloodGroup, setBloodGroup] = useState('B+');
  const [abhaAddress, setAbhaAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const maxMembers = 3;
  const currentCount = careProfiles.length;
  const canAdd = currentCount < maxMembers;

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Please enter member full name');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const newProfile = await api.createCareProfile({
        full_name: fullName.trim(),
        relationship,
        gender,
        date_of_birth: dob,
        blood_group: bloodGroup,
        abha_address: abhaAddress.trim() || undefined,
      });
      await onRefreshProfiles();
      onSelectProfile(newProfile.id);
      setIsAdding(false);
      setFullName('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProfile = async (profileId: string, profileName: string) => {
    if (!confirm(`Are you sure you want to remove ${profileName}'s profile? Their clinical records will be detached.`)) {
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api.deleteCareProfile(profileId);
      await onRefreshProfiles();
      // If deleted active profile, switch to the first remaining profile
      const remaining = careProfiles.filter(p => p.id !== profileId);
      if (remaining.length > 0) {
        onSelectProfile(remaining[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to remove member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="glass-modal w-full max-w-lg rounded-3xl p-6 sm:p-7 relative border border-slate-700/70 shadow-2xl overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute -top-20 -right-20 w-44 h-44 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-44 h-44 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white tracking-tight">Family Accounts & Members</h2>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                currentCount >= maxMembers
                  ? 'bg-amber-950/60 text-amber-300 border-amber-700/50'
                  : 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50'
              }`}>
                {currentCount}/{maxMembers} Slots Used
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Single Subscription Plan • Isolated Longitudinal Health Records
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Mode: List Members or Add Member */}
        {!isAdding ? (
          <div className="space-y-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Switch Active Account (1 Active at a time)</span>
              <span>Max 3 Members</span>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {careProfiles.map((p) => {
                const isActive = p.id === activeProfileId;
                return (
                  <div
                    key={p.id}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                      isActive
                        ? 'bg-sky-950/40 border-sky-500/60 shadow-lg shadow-sky-500/10'
                        : 'bg-slate-900/60 hover:bg-slate-800/60 border-slate-800 hover:border-slate-700'
                    }`}
                    onClick={() => {
                      onSelectProfile(p.id);
                      onClose();
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                        isActive
                          ? 'bg-gradient-to-tr from-sky-500 to-teal-400 text-white shadow-md'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}>
                        {p.full_name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{p.full_name}</span>
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 capitalize">
                            {p.relationship || 'member'}
                          </span>
                          {p.blood_group && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-950/60 text-rose-300 border border-rose-800/40 font-mono">
                              {p.blood_group}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                          {p.date_of_birth && <span>DOB: {p.date_of_birth}</span>}
                          {p.gender && <span>• {p.gender}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {isActive ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/40 text-xs font-semibold">
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Active</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            onSelectProfile(p.id);
                            onClose();
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-sky-600 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-all"
                        >
                          Select
                        </button>
                      )}

                      {/* Allow deletion only if not the last remaining profile and not "self" */}
                      {careProfiles.length > 1 && p.relationship !== 'self' && (
                        <button
                          onClick={() => handleDeleteProfile(p.id, p.full_name)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                          title="Remove profile"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action buttons */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
              {canAdd ? (
                <button
                  onClick={() => setIsAdding(true)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-400 hover:to-teal-400 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Member Profile ({currentCount}/{maxMembers})</span>
                </button>
              ) : (
                <div className="flex-1 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 text-center">
                  Family Plan Limit Reached (3/3 members max)
                </div>
              )}

              <button
                onClick={onSignOut}
                className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-rose-300 text-xs font-semibold transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          /* Add Profile Form */
          <form onSubmit={handleCreateProfile} className="space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                Add New Family Member ({currentCount + 1}/{maxMembers})
              </span>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Aryan Sharma"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Relationship</label>
                <select
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="child">Child / Dependent</option>
                  <option value="spouse">Spouse</option>
                  <option value="father">Father</option>
                  <option value="mother">Mother</option>
                  <option value="self">Self</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Blood Group</label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">ABHA Address (Optional)</label>
              <input
                type="text"
                value={abhaAddress}
                onChange={(e) => setAbhaAddress(e.target.value)}
                placeholder="e.g. aryan.sharma@abdm"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-400 hover:to-teal-400 text-white font-semibold text-xs shadow-lg shadow-sky-500/20 transition-all flex items-center justify-center gap-2 mt-3"
            >
              {loading ? 'Creating Member Profile...' : 'Save & Set as Active Profile'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
