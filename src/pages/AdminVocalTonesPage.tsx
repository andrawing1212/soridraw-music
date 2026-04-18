import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { VocalTone } from '../types';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  Check, 
  ChevronUp, 
  ChevronDown, 
  AlertCircle,
  Loader2,
  Settings
} from 'lucide-react';
import { cn } from '../lib/utils';

import { useNavigate, useLocation } from 'react-router-dom';
import AdminPageLayout from '../components/AdminPageLayout';

export default function AdminVocalTonesPage({ isAdmin: isAdminProp }: { isAdmin?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [vocalTones, setVocalTones] = useState<VocalTone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [isEditing, setIsEditing] = useState<string | null>(null); // id of tone being edited or 'new'
  const [formData, setFormData] = useState<Partial<VocalTone>>({
    label: '',
    description: '',
    genderTarget: 'any',
    toneType: '',
    genreTags: [],
    isActive: true,
    isDefault: false,
    sortOrder: 0,
    promptCore: ''
  });
  const [genreTagInput, setGenreTagInput] = useState('');

  const [isAdmin, setIsAdmin] = useState(isAdminProp || false);

  useEffect(() => {
    if (isAdminProp !== undefined) {
      setIsAdmin(isAdminProp);
    }
  }, [isAdminProp]);

  useEffect(() => {
    if (!auth.currentUser || isAdminProp !== undefined) return;
    
    // Support real-time role check if prop wasn't passed or we want extra safety
    const unsub = onSnapshot(doc(db, 'users', auth.currentUser.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.role === 'admin') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      }
    });
    return () => unsub();
  }, [isAdminProp]);

  useEffect(() => {
    if (!isAdmin) return;

    const q = query(collection(db, 'vocalTones'), orderBy('sortOrder', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tones = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as VocalTone[];
      setVocalTones(tones);
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching vocal tones:", err);
      setError("보컬 톤 데이터를 불러오는 중 오류가 발생했습니다.");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [isAdmin]);

  const handleEdit = (tone: VocalTone) => {
    setIsEditing(tone.id);
    setFormData(tone);
    setGenreTagInput(tone.genreTags.join(', '));
  };

  const handleAddNew = () => {
    setIsEditing('new');
    setFormData({
      label: '',
      description: '',
      genderTarget: 'any',
      toneType: '',
      genreTags: [],
      isActive: true,
      isDefault: false,
      sortOrder: vocalTones.length > 0 ? Math.max(...vocalTones.map(t => t.sortOrder)) + 1 : 0,
      promptCore: ''
    });
    setGenreTagInput('');
  };

  const handleCancel = () => {
    setIsEditing(null);
    setFormData({});
    setGenreTagInput('');
    setError(null);
  };

  const handleSave = async () => {
    if (!formData.label || !formData.description) {
      setError("이름과 설명을 입력해주세요.");
      return;
    }

    setIsSaving(true);
    setError(null);

    const tags = genreTagInput.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
    const finalData = {
      ...formData,
      genreTags: tags,
      updatedAt: Date.now()
    };

    try {
      if (isEditing === 'new') {
        await addDoc(collection(db, 'vocalTones'), {
          ...finalData,
          createdAt: Date.now()
        });
      } else if (isEditing) {
        const toneRef = doc(db, 'vocalTones', isEditing);
        await updateDoc(toneRef, finalData);
      }
      setIsEditing(null);
    } catch (err) {
      console.error("Error saving vocal tone:", err);
      setError("저장 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("정말 삭제하시겠습니까?")) return;
    
    try {
      await deleteDoc(doc(db, 'vocalTones', id));
    } catch (err) {
      console.error("Error deleting vocal tone:", err);
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  const handleToggleActive = async (tone: VocalTone) => {
    try {
      await updateDoc(doc(db, 'vocalTones', tone.id), {
        isActive: !tone.isActive,
        updatedAt: Date.now()
      });
    } catch (err) {
      console.error("Error toggling active state:", err);
    }
  };

  const handleMoveOrder = async (tone: VocalTone, direction: 'up' | 'down') => {
    const index = vocalTones.findIndex(t => t.id === tone.id);
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === vocalTones.length - 1) return;

    const otherTone = direction === 'up' ? vocalTones[index - 1] : vocalTones[index + 1];
    
    try {
      await updateDoc(doc(db, 'vocalTones', tone.id), { sortOrder: otherTone.sortOrder });
      await updateDoc(doc(db, 'vocalTones', otherTone.id), { sortOrder: tone.sortOrder });
    } catch (err) {
      console.error("Error updating sort order:", err);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-color)]">
        <div className="text-center p-8 bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] shadow-xl">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">접근 권한이 없습니다</h1>
          <p className="text-[var(--text-secondary)]">관리자 계정으로 로그인해주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <AdminPageLayout
      title="보컬 관리"
      description="보컬 톤 데이터를 생성, 수정, 삭제하고 순서를 관리합니다."
      actions={
        <button
          onClick={handleAddNew}
          disabled={!!isEditing}
          className="flex items-center gap-2 px-4 py-2 bg-brand-orange text-white rounded-xl font-bold hover:brightness-110 transition-all disabled:opacity-50"
        >
          <Plus className="w-5 h-5" />
          <span>새 보컬 톤 추가</span>
        </button>
      }
    >
      {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {isEditing && (
          <div className="mb-10 p-6 bg-[var(--card-bg)] rounded-2xl border-2 border-brand-orange shadow-xl animate-in fade-in slide-in-from-top-4">
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-6">
              {isEditing === 'new' ? '새 보컬 톤 추가' : '보컬 톤 수정'}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">이름 (Label)</label>
                  <input
                    type="text"
                    value={formData.label}
                    onChange={e => setFormData({ ...formData, label: e.target.value })}
                    className="w-full px-4 py-2 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:ring-2 focus:ring-brand-orange outline-none"
                    placeholder="예: Husky Male"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">설명 (Description)</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:ring-2 focus:ring-brand-orange outline-none h-24"
                    placeholder="사용자에게 보여질 설명"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">대상 성별 (Gender Target)</label>
                  <select
                    value={formData.genderTarget}
                    onChange={e => setFormData({ ...formData, genderTarget: e.target.value as any })}
                    className="w-full px-4 py-2 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:ring-2 focus:ring-brand-orange outline-none"
                  >
                    <option value="male">남성 (Male)</option>
                    <option value="female">여성 (Female)</option>
                    <option value="unisex">공용 (Unisex)</option>
                    <option value="group">그룹 (Group)</option>
                    <option value="any">전체 (Any)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">톤 타입 (Tone Type - 선택)</label>
                  <input
                    type="text"
                    value={formData.toneType}
                    onChange={e => setFormData({ ...formData, toneType: e.target.value })}
                    className="w-full px-4 py-2 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:ring-2 focus:ring-brand-orange outline-none"
                    placeholder="예: husky, soft, powerful"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">장르 태그 (쉼표로 구분)</label>
                  <input
                    type="text"
                    value={genreTagInput}
                    onChange={e => setGenreTagInput(e.target.value)}
                    className="w-full px-4 py-2 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:ring-2 focus:ring-brand-orange outline-none"
                    placeholder="예: rock, pop, rnb"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">프롬프트 핵심 (Prompt Core)</label>
                  <textarea
                    value={formData.promptCore}
                    onChange={e => setFormData({ ...formData, promptCore: e.target.value })}
                    className="w-full px-4 py-2 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:ring-2 focus:ring-brand-orange outline-none h-24"
                    placeholder="Gemini에게 전달될 프롬프트 조각"
                  />
                </div>
                <div className="flex gap-6 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-5 h-5 accent-brand-orange"
                    />
                    <span className="text-sm font-medium text-[var(--text-primary)]">활성화</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isDefault}
                      onChange={e => setFormData({ ...formData, isDefault: e.target.checked })}
                      className="w-5 h-5 accent-brand-orange"
                    />
                    <span className="text-sm font-medium text-[var(--text-primary)]">기본값 설정</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-[var(--border-color)]">
              <button
                onClick={handleCancel}
                className="px-6 py-2 bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl font-bold hover:bg-[var(--hover-bg)] transition-all"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-8 py-2 bg-brand-orange text-white rounded-xl font-bold hover:brightness-110 transition-all disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                저장하기
              </button>
            </div>
          </div>
        )}

        <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--bg-color)] border-b border-[var(--border-color)]">
                  <th className="px-6 py-4 text-sm font-bold text-[var(--text-secondary)] w-16">순서</th>
                  <th className="px-6 py-4 text-sm font-bold text-[var(--text-secondary)]">보컬 톤</th>
                  <th className="px-6 py-4 text-sm font-bold text-[var(--text-secondary)]">성별</th>
                  <th className="px-6 py-4 text-sm font-bold text-[var(--text-secondary)]">장르 태그</th>
                  <th className="px-6 py-4 text-sm font-bold text-[var(--text-secondary)]">상태</th>
                  <th className="px-6 py-4 text-sm font-bold text-[var(--text-secondary)] text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <Loader2 className="w-10 h-10 animate-spin mx-auto text-brand-orange mb-2" />
                      <p className="text-[var(--text-secondary)]">데이터를 불러오는 중...</p>
                    </td>
                  </tr>
                ) : vocalTones.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <p className="text-[var(--text-secondary)]">등록된 보컬 톤이 없습니다.</p>
                    </td>
                  </tr>
                ) : (
                  vocalTones.map((tone, index) => (
                    <tr key={tone.id} className="hover:bg-[var(--hover-bg)]/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-center">
                          <button 
                            onClick={() => handleMoveOrder(tone, 'up')}
                            disabled={index === 0}
                            className="p-0.5 text-[var(--text-secondary)] hover:text-brand-orange disabled:opacity-20"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <span className="text-sm font-bold text-[var(--text-primary)]">{tone.sortOrder}</span>
                          <button 
                            onClick={() => handleMoveOrder(tone, 'down')}
                            disabled={index === vocalTones.length - 1}
                            className="p-0.5 text-[var(--text-secondary)] hover:text-brand-orange disabled:opacity-20"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-[var(--text-primary)]">{tone.label}</div>
                        <div className="text-xs text-[var(--text-secondary)] line-clamp-1">{tone.description}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded-md text-[10px] font-bold uppercase",
                          tone.genderTarget === 'male' ? "bg-blue-500/10 text-blue-500" :
                          tone.genderTarget === 'female' ? "bg-pink-500/10 text-pink-500" :
                          tone.genderTarget === 'group' ? "bg-purple-500/10 text-purple-500" :
                          "bg-gray-500/10 text-gray-500"
                        )}>
                          {tone.genderTarget}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {tone.genreTags.map(tag => (
                            <span key={tag} className="px-1.5 py-0.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded text-[10px] text-[var(--text-secondary)]">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleActive(tone)}
                          className={cn(
                            "flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold transition-all",
                            tone.isActive 
                              ? "bg-green-500/10 text-green-500" 
                              : "bg-red-500/10 text-red-500"
                          )}
                        >
                          {tone.isActive ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          {tone.isActive ? '활성' : '비활성'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(tone)}
                            className="p-2 text-[var(--text-secondary)] hover:text-brand-orange hover:bg-brand-orange/10 rounded-lg transition-all"
                            title="수정"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(tone.id)}
                            className="p-2 text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
    </AdminPageLayout>
  );
}
