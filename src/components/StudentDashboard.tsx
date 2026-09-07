import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Student,
  Teacher,
  SubjectRule,
  SubjectScore,
  StudentSummary,
  PublishedRecord,
  TermType,
  WebsiteConfig
} from '../types';
import { FirebaseService } from '../services/firebaseService';
import { getActiveSchoolConfig } from '../config/schoolConfig';
import {
  GraduationCap,
  Award,
  BookOpen,
  Calendar,
  Lock,
  Printer,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  TrendingUp,
  FileText,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  School,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileX2,
  FileCheck,
  Phone,
  User,
  MapPin,
  Filter,
  Layers,
  Check,
  ExternalLink
} from 'lucide-react';
import {
  SESSIONS_LIST,
  TERMS_LIST,
  DEFAULT_CURRENT_SESSION,
  DEFAULT_CURRENT_TERM,
  computeClassRankings,
  calculateStudentOverallAverage,
  getGradeAndRemark,
  getAuthoritativeSubjectsForClass,
  isMatchingClass,
  isMatchingStudentId,
  normalizeClassIdentifier
} from '../utils/grading';
import { StudentReportCardModal } from './StudentReportCardModal';
import { SchoolLogo } from './SchoolLogo';

interface StudentDashboardProps {
  currentStudent: Student;
  studentsList: Student[];
  teachersList?: Teacher[];
  subjectsList: SubjectRule[];
  allScores: SubjectScore[];
  allSummaries: StudentSummary[];
  publishedRecords: PublishedRecord[];
  isClassResultPublished: (className: string, term: TermType, session: string) => boolean;
  onLogout: () => void;
  onRefreshData: () => Promise<void> | void;
  websiteConfig?: WebsiteConfig;
}

export type ResultStatusType = 'ready_to_view' | 'in_progress' | 'not_found';

export interface TermResultItem {
  key: string;
  term: TermType;
  session: string;
  classLevel: string;
  status: ResultStatusType;
  isPublished: boolean;
  hasScores: boolean;
  enteredScoresCount: number;
  totalClassSubjects: number;
  enteredSubjects: string[];
  scores: SubjectScore[];
  summary?: StudentSummary;
  totalMarks: number;
  totalPossible: number;
  average: number | null;
  grade: string;
  remark: string;
  positionLabel: string;
  totalPupils: number;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  currentStudent,
  studentsList,
  teachersList = [],
  subjectsList,
  allScores,
  allSummaries,
  publishedRecords,
  isClassResultPublished,
  onLogout,
  onRefreshData,
  websiteConfig
}) => {
  const activeSchool = websiteConfig
    ? getActiveSchoolConfig({
        schoolName: websiteConfig.schoolName,
        shortName: websiteConfig.shortName,
        motto: websiteConfig.motto,
        logoUrl: websiteConfig.logoUrl,
        campusAddress: websiteConfig.campusAddress,
        cityState: websiteConfig.cityState,
      })
    : getActiveSchoolConfig();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | ResultStatusType>('all');
  const [expandedResultKey, setExpandedResultKey] = useState<string | null>(null);

  // Auto-refresh data on student dashboard mount to catch latest releases
  useEffect(() => {
    if (onRefreshData) {
      Promise.resolve(onRefreshData()).catch((err) =>
        console.warn('Student background refresh notice:', err)
      );
    }
  }, [onRefreshData]);

  // Available Academic Sessions
  const availableSessions = useMemo(() => {
    const sessions = new Set<string>();
    if (DEFAULT_CURRENT_SESSION) sessions.add(DEFAULT_CURRENT_SESSION);
    SESSIONS_LIST.forEach((s) => sessions.add(s));
    allScores.forEach((s) => {
      if (s.Session) sessions.add(s.Session);
    });
    (publishedRecords || []).forEach((p) => {
      if (p.session) sessions.add(p.session);
    });
    return Array.from(sessions).sort().reverse();
  }, [allScores, publishedRecords]);

  // Selected Academic Session
  const [selectedSession, setSelectedSession] = useState<string>(() => {
    const studentScores = allScores.filter((s) =>
      isMatchingStudentId(s.StudentID, currentStudent.StudentID)
    );
    if (studentScores.length > 0 && studentScores[0].Session) {
      return studentScores[0].Session;
    }
    return DEFAULT_CURRENT_SESSION || '2026/2027';
  });

  // Selected Report Card for Modal View & Print
  const [selectedResultModal, setSelectedResultModal] = useState<{
    session: string;
    term: TermType;
  } | null>(null);

  // Password Change Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Notice shown when an open result is unpublished while viewing
  const [unpublishedNotice, setUnpublishedNotice] = useState<string | null>(null);

  // Class classmates for ranking calculation
  const classStudents = useMemo(() => {
    return studentsList.filter((s) => isMatchingClass(s.Class, currentStudent.Class));
  }, [studentsList, currentStudent.Class]);

  // Authoritative subjects for this student's class
  const classSubjects = useMemo(() => {
    return getAuthoritativeSubjectsForClass(currentStudent.Class, subjectsList);
  }, [currentStudent.Class, subjectsList]);

  // Class Teacher Name
  const classTeacherName = useMemo(() => {
    if (teachersList && teachersList.length > 0) {
      const match = teachersList.find((t) =>
        isMatchingClass(t.ClassAssigned, currentStudent.Class)
      );
      if (match) return match.FullName || match.Username;
    }
    return 'Class Teacher';
  }, [teachersList, currentStudent.Class]);

  // =========================================================================
  // COMPILE ALL 3 TERMS FOR SELECTED SESSION
  // Status:
  // 1. "ready_to_view": Published by teacher -> Live for student to view & print
  // 2. "in_progress": Filled by teacher but unpublished (undergoing corrections)
  // 3. "not_found": Unfilled and unpublished (no scores entered yet)
  // =========================================================================
  const termResultsForSession = useMemo<TermResultItem[]>(() => {
    const termsOrder: TermType[] = ['First Term', 'Second Term', 'Third Term'];

    return termsOrder.map((trm) => {
      const sess = selectedSession;
      const cleanTrm = trm.trim().toLowerCase();
      const cleanSess = sess.trim().toLowerCase().replace(/session/g, '').trim();

      // Check if published by teacher
      const cleanClass = normalizeClassIdentifier(currentStudent.Class);
      let matchedRecord: PublishedRecord | undefined;

      // Look through publishedRecords in reverse order (most recent first)
      for (let i = (publishedRecords || []).length - 1; i >= 0; i--) {
        const r = publishedRecords[i];
        const rClass = normalizeClassIdentifier(r.className);
        const rTerm = (r.term || '').trim().toLowerCase();
        const rSess = (r.session || '').trim().toLowerCase().replace(/academic\s*session/g, '').replace(/session/g, '').trim();

        const classMatches = rClass === cleanClass || isMatchingClass(r.className, currentStudent.Class);
        const termMatches = !rTerm || !cleanTrm || rTerm === cleanTrm;
        const sessMatches = !rSess || !cleanSess || rSess === cleanSess;

        if (classMatches && termMatches && sessMatches) {
          matchedRecord = r;
          break;
        }
      }

      let isPublished = false;
      if (matchedRecord !== undefined) {
        isPublished = Boolean(matchedRecord.isPublished);
      } else {
        isPublished = Boolean(isClassResultPublished(currentStudent.Class, trm, sess));
      }

      // Find scores matching this student, session, and term
      const matchingScores = allScores.filter((s) => {
        if (!isMatchingStudentId(s.StudentID, currentStudent.StudentID)) return false;
        const sTerm = (s.Term || '').trim().toLowerCase();
        const sSess = (s.Session || '').trim().toLowerCase().replace(/session/g, '').trim();

        const termMatch = sTerm === cleanTrm || sTerm.includes(cleanTrm) || cleanTrm.includes(sTerm);
        const sessMatch =
          !sSess ||
          !cleanSess ||
          sSess === cleanSess ||
          sSess.includes(cleanSess) ||
          cleanSess.includes(sSess);

        return termMatch && sessMatch;
      });

      // Find terminal summary
      const matchingSummary = allSummaries.find((sm) => {
        if (!isMatchingStudentId(sm.StudentID, currentStudent.StudentID)) return false;
        const smTerm = (sm.Term || '').trim().toLowerCase();
        const smSess = (sm.Session || '').trim().toLowerCase().replace(/session/g, '').trim();

        const termMatch = smTerm === cleanTrm || smTerm.includes(cleanTrm) || cleanTrm.includes(smTerm);
        const sessMatch =
          !smSess ||
          !cleanSess ||
          smSess === cleanSess ||
          smSess.includes(cleanSess) ||
          cleanSess.includes(smSess);

        return termMatch && sessMatch;
      });

      // Normalize subject scores
      const normalizedScores = matchingScores.map((sc) => {
        const ca1 = sc.CA1 !== null && sc.CA1 !== undefined ? Number(sc.CA1) : null;
        const ca2 = sc.CA2 !== null && sc.CA2 !== undefined ? Number(sc.CA2) : null;
        const exam = sc.Exam !== null && sc.Exam !== undefined ? Number(sc.Exam) : null;
        let total =
          sc.Total !== null && sc.Total !== undefined && !isNaN(Number(sc.Total))
            ? Number(sc.Total)
            : null;

        if (total === null && (ca1 !== null || ca2 !== null || exam !== null)) {
          total = (ca1 || 0) + (ca2 || 0) + (exam || 0);
        }

        return {
          ...sc,
          CA1: ca1,
          CA2: ca2,
          Exam: exam,
          Total: total
        };
      });

      // Meaningful scores entered (at least one score component recorded)
      const meaningfulScores = normalizedScores.filter(
        (s) =>
          (typeof s.Total === 'number' && s.Total > 0) ||
          (typeof s.Exam === 'number' && s.Exam > 0) ||
          (typeof s.CA1 === 'number' && s.CA1 > 0) ||
          (typeof s.CA2 === 'number' && s.CA2 > 0) ||
          s.Total !== null ||
          s.Exam !== null ||
          s.CA1 !== null ||
          s.CA2 !== null
      );

      const hasScores = meaningfulScores.length > 0;
      const enteredSubjects = Array.from(new Set(meaningfulScores.map((s) => s.Subject)));

      // Class overall average & rankings
      const avgInfo = calculateStudentOverallAverage(
        normalizedScores.map((sc) => ({ subject: sc.Subject, total: sc.Total }))
      );
      const gradeInfo = getGradeAndRemark(avgInfo.average);

      const rankings = computeClassRankings(
        classStudents,
        allScores,
        sess,
        trm,
        classSubjects
      );
      const studentRank = rankings.find((r) =>
        isMatchingStudentId(r.student.StudentID, currentStudent.StudentID)
      );

      // Status derivation:
      // 1. Published -> ready_to_view
      // 2. Filled but unpublished -> in_progress
      // 3. Unfilled and unpublished -> not_found
      let status: ResultStatusType;
      if (isPublished) {
        status = 'ready_to_view';
      } else if (hasScores) {
        status = 'in_progress';
      } else {
        status = 'not_found';
      }

      return {
        key: `${sess}_${trm}`,
        term: trm,
        session: sess,
        classLevel: currentStudent.Class,
        status,
        isPublished,
        hasScores,
        enteredScoresCount: meaningfulScores.length,
        totalClassSubjects: classSubjects.length || meaningfulScores.length,
        enteredSubjects,
        scores: normalizedScores,
        summary: matchingSummary,
        totalMarks: avgInfo.totalMarks,
        totalPossible:
          classSubjects.length > 0
            ? classSubjects.length * 100
            : avgInfo.completedCount * 100 || 100,
        average: avgInfo.average,
        grade: gradeInfo.grade,
        remark: gradeInfo.remark,
        positionLabel: studentRank ? studentRank.positionLabel : '—',
        totalPupils: classStudents.length
      };
    });
  }, [
    selectedSession,
    currentStudent.Class,
    currentStudent.StudentID,
    isClassResultPublished,
    publishedRecords,
    allScores,
    allSummaries,
    classStudents,
    classSubjects
  ]);

  // Counts by status
  const statusCounts = useMemo(() => {
    const ready = termResultsForSession.filter((r) => r.status === 'ready_to_view').length;
    const progress = termResultsForSession.filter((r) => r.status === 'in_progress').length;
    const notFound = termResultsForSession.filter((r) => r.status === 'not_found').length;
    return { ready, progress, notFound };
  }, [termResultsForSession]);

  // Immediately take down and close report card modal if teacher unpublishes results
  useEffect(() => {
    if (selectedResultModal) {
      const currentMatch = termResultsForSession.find(
        (t) => t.term === selectedResultModal.term && t.session === selectedResultModal.session
      );
      if (currentMatch && !currentMatch.isPublished) {
        setSelectedResultModal(null);
        setUnpublishedNotice(
          `Notice: ${selectedResultModal.term} (${selectedResultModal.session}) result was unpublished by the class teacher and is no longer available on the Student Portal.`
        );
      }
    }
  }, [termResultsForSession, selectedResultModal]);

  // Filtered list according to current tab filter
  const displayedTerms = useMemo(() => {
    if (statusFilter === 'all') return termResultsForSession;
    return termResultsForSession.filter((r) => r.status === statusFilter);
  }, [termResultsForSession, statusFilter]);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (onRefreshData) {
        await onRefreshData();
      }
      await new Promise((res) => setTimeout(res, 400));
    } catch (err) {
      console.error('Error refreshing portal:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefreshData]);

  // Password change handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    const actualCurrentPass = currentStudent.Password || 'password';
    if (currentPasswordInput !== actualCurrentPass) {
      setPasswordFeedback({
        type: 'error',
        message: 'Current password does not match. Please verify and try again.'
      });
      return;
    }

    if (newPasswordInput.length < 4) {
      setPasswordFeedback({
        type: 'error',
        message: 'New password must be at least 4 characters long.'
      });
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordFeedback({
        type: 'error',
        message: 'New password and confirmation do not match.'
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await FirebaseService.updateStudentPassword(
        currentStudent.StudentID,
        newPasswordInput.trim()
      );
      if (res.success) {
        setPasswordFeedback({
          type: 'success',
          message: 'Your password has been changed successfully in Firebase!'
        });
        currentStudent.Password = newPasswordInput.trim();
        setCurrentPasswordInput('');
        setNewPasswordInput('');
        setConfirmPasswordInput('');
        if (onRefreshData) {
          await onRefreshData();
        }
      } else {
        setPasswordFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setPasswordFeedback({
        type: 'error',
        message: err.message || 'Failed to update password.'
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & STUDENT PROFILE CARD */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-700/80 relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-700/60">
          <div className="flex items-center gap-3.5 min-w-0">
            <SchoolLogo size="lg" src={activeSchool.logoUrl} alt={activeSchool.schoolName} className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 object-contain" />
            <div className="min-w-0">
              <p className="text-xs sm:text-sm uppercase font-black tracking-wider sm:tracking-widest text-amber-400 font-mono break-words leading-tight">
                {activeSchool.schoolName}
              </p>
              <h2 className="text-sm sm:text-lg md:text-xl font-black text-white break-words leading-tight mt-0.5">
                Official Student Portal &bull; Continuous Assessment &amp; Results
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              id="student-refresh-btn"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-bold text-slate-200 hover:text-white bg-slate-800/90 hover:bg-slate-700 border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Sync latest live records"
            >
              <RefreshCw className={`w-4 h-4 text-amber-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync Live</span>
            </button>

            <button
              id="student-change-pwd-btn"
              onClick={() => {
                setPasswordFeedback(null);
                setIsPasswordModalOpen(true);
              }}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold text-slate-200 hover:text-white bg-slate-800/90 hover:bg-slate-700 border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <KeyRound className="w-4 h-4 text-amber-400" />
              <span>Change Password</span>
            </button>

            <button
              id="student-logout-btn"
              onClick={onLogout}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Primary Student Identification Details */}
        <div className="mt-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 flex items-center justify-center font-black shadow-xl ring-4 ring-amber-400/20 shrink-0">
              <GraduationCap className="w-9 h-9 sm:w-11 sm:h-11" />
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight uppercase font-serif text-white">
                  {currentStudent.FullName}
                </h1>
                <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold">
                  Active Pupil
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 font-medium">
                <span className="inline-flex items-center gap-1 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
                  <span className="text-slate-400">Student ID:</span>
                  <strong className="font-mono text-amber-300 font-bold">
                    {currentStudent.StudentID}
                  </strong>
                </span>

                <span className="inline-flex items-center gap-1 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
                  <span className="text-slate-400">Class:</span>
                  <strong className="text-white font-bold">{currentStudent.Class}</strong>
                </span>

                <span className="inline-flex items-center gap-1 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
                  <span className="text-slate-400">Gender:</span>
                  <strong className="text-white font-bold">
                    {currentStudent.Gender || 'Pupil'}
                  </strong>
                </span>

                <span className="inline-flex items-center gap-1 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
                  <span className="text-slate-400">Teacher:</span>
                  <strong className="text-amber-200 font-medium truncate max-w-[160px]">
                    {classTeacherName}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Supplementary Profile Grid */}
        <div className="mt-6 pt-5 border-t border-slate-700/60 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs text-slate-300">
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50 flex items-center gap-2.5">
            <User className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="truncate">
              <span className="block text-[10px] text-slate-400 uppercase font-bold">
                Parent / Guardian
              </span>
              <span className="font-semibold text-white truncate">
                {currentStudent.ParentName || 'Parent / Guardian'}
              </span>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50 flex items-center gap-2.5">
            <Phone className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="truncate">
              <span className="block text-[10px] text-slate-400 uppercase font-bold">
                Emergency Contact
              </span>
              <span className="font-mono font-semibold text-white truncate">
                {currentStudent.ParentPhone || 'Registered on file'}
              </span>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50 flex items-center gap-2.5 sm:col-span-2 md:col-span-1">
            <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="truncate">
              <span className="block text-[10px] text-slate-400 uppercase font-bold">
                Campus Location
              </span>
              <span className="font-semibold text-white truncate" title={activeSchool.campusAddress || activeSchool.cityState || 'Main Campus'}>
                {activeSchool.campusAddress || activeSchool.cityState || 'Main Campus'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. REDESIGNED RESULTS SECTION — ALL TERMS OVERVIEW */}
      {/* ========================================================================= */}
      <div className="space-y-5">
        {/* Notice when teacher unpublishes result */}
        {unpublishedNotice && (
          <div
            id="student-unpublished-notice"
            className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 flex items-start sm:items-center justify-between gap-3 text-xs font-semibold animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div className="flex items-center gap-2.5">
              <EyeOff className="w-5 h-5 text-amber-400 shrink-0" />
              <span>{unpublishedNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setUnpublishedNotice(null)}
              className="text-amber-400 hover:text-white px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Results Header with Session Selector & Status Counter Bar */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Award className="w-6 h-6 text-amber-600" />
                <h2 className="text-lg sm:text-xl font-black text-slate-900 font-serif">
                  Academic Results &amp; Termly Performance
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Showing all results entered for all terms in <strong>{currentStudent.Class}</strong>. Direct teacher publishing enabled.
              </p>
            </div>

            {/* Session Selector */}
            <div className="flex items-center gap-2.5 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 shrink-0">
              <Calendar className="w-4 h-4 text-slate-500 ml-2 shrink-0" />
              <span className="text-xs font-bold text-slate-700">Session:</span>
              <select
                id="student-session-selector"
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="bg-white font-mono font-bold text-xs text-slate-900 border border-slate-300 rounded-xl px-3 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                {availableSessions.map((sess) => (
                  <option key={sess} value={sess}>
                    {sess} Session
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3-Term Summary At-A-Glance Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {termResultsForSession.map((termItem) => {
              const isReady = termItem.status === 'ready_to_view';
              const isInProgress = termItem.status === 'in_progress';
              const isNotFound = termItem.status === 'not_found';

              return (
                <div
                  key={termItem.key}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isReady
                      ? 'bg-emerald-50/70 border-emerald-300 shadow-2xs'
                      : isInProgress
                      ? 'bg-amber-50/70 border-amber-300 shadow-2xs'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                      {termItem.term}
                    </span>
                    {isReady && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Ready to View
                      </span>
                    )}
                    {isInProgress && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                        In Progress
                      </span>
                    )}
                    {isNotFound && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-slate-200/80 text-slate-600 border border-slate-300 flex items-center gap-1">
                        <FileX2 className="w-3 h-3 text-slate-500" />
                        Not Found
                      </span>
                    )}
                  </div>

                  <div className="mt-2 text-xs">
                    {isReady && (
                      <div className="text-slate-700 flex items-center justify-between">
                        <span>
                          Average: <strong className="text-emerald-800">{termItem.average !== null ? `${termItem.average.toFixed(1)}%` : '—'}</strong>
                        </span>
                        <span>
                          Pos: <strong className="text-slate-900">{termItem.positionLabel}</strong>
                        </span>
                      </div>
                    )}
                    {isInProgress && (
                      <div className="text-amber-800 flex items-center justify-between">
                        <span>{termItem.enteredScoresCount} Subjects Entered</span>
                        <span className="font-semibold text-[11px]">Unpublished Draft</span>
                      </div>
                    )}
                    {isNotFound && (
                      <div className="text-slate-500 text-[11px]">
                        No scores recorded for this term
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mr-1 hidden sm:inline">
                Filter:
              </span>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200'
                }`}
              >
                All Terms ({termResultsForSession.length})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('ready_to_view')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === 'ready_to_view'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Ready to View ({statusCounts.ready})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('in_progress')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === 'in_progress'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>In Progress ({statusCounts.progress})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('not_found')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === 'not_found'
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                <FileX2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Not Found ({statusCounts.notFound})</span>
              </button>
            </div>

            <span className="text-slate-400 text-[11px]">
              {displayedTerms.length} of {termResultsForSession.length} terms displayed
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. DETAILED TERM CARDS (READY TO VIEW vs IN PROGRESS vs NOT FOUND) */}
        {/* ========================================================================= */}
        <div className="space-y-5">
          {displayedTerms.map((result) => {
            const isReady = result.status === 'ready_to_view';
            const isInProgress = result.status === 'in_progress';
            const isNotFound = result.status === 'not_found';
            const isExpanded = expandedResultKey === result.key;

            return (
              <div
                key={result.key}
                className={`rounded-3xl border transition-all overflow-hidden bg-white ${
                  isReady
                    ? 'border-emerald-300 shadow-md ring-1 ring-emerald-400/20 hover:border-emerald-400'
                    : isInProgress
                    ? 'border-amber-300 shadow-sm ring-1 ring-amber-400/20 hover:border-amber-400'
                    : 'border-slate-200 shadow-2xs hover:border-slate-300'
                }`}
              >
                {/* ------------------------------------------------------------- */}
                {/* CARD HEADER */}
                {/* ------------------------------------------------------------- */}
                <div
                  className={`p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b ${
                    isReady
                      ? 'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border-slate-700'
                      : isInProgress
                      ? 'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border-slate-700'
                      : 'bg-slate-50 text-slate-900 border-slate-200'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold shadow-md shrink-0 ${
                        isReady
                          ? 'bg-emerald-500 text-slate-950'
                          : isInProgress
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isReady ? (
                        <FileCheck className="w-6 h-6 text-slate-950" />
                      ) : isInProgress ? (
                        <Clock className="w-6 h-6 text-slate-950 animate-pulse" />
                      ) : (
                        <FileX2 className="w-6 h-6 text-slate-500" />
                      )}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-full ${
                            isReady
                              ? 'bg-emerald-400 text-slate-950'
                              : isInProgress
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-slate-300 text-slate-800'
                          }`}
                        >
                          {result.term}
                        </span>
                        <span className={`text-xs font-mono font-bold ${isReady || isInProgress ? 'text-amber-200' : 'text-slate-600'}`}>
                          {result.session} Academic Session
                        </span>
                      </div>

                      <h3
                        className={`text-base sm:text-lg font-black mt-1 font-serif ${
                          isReady || isInProgress ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        {result.term} Examination &amp; Assessment Report
                      </h3>
                      <p className={`text-xs ${isReady || isInProgress ? 'text-slate-400' : 'text-slate-500'}`}>
                        Class: {result.classLevel} • Student ID: {currentStudent.StudentID}
                      </p>
                    </div>
                  </div>

                  {/* Top Right Status Badge & Primary Action Button */}
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    {/* Status Badge */}
                    {isReady && (
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-xs font-black">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Ready to View
                      </span>
                    )}

                    {isInProgress && (
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 text-xs font-black">
                        <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                        In Progress
                      </span>
                    )}

                    {isNotFound && (
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-200 text-slate-700 border border-slate-300 text-xs font-black">
                        <FileX2 className="w-4 h-4 text-slate-500" />
                        Not Found
                      </span>
                    )}

                    {/* Action Button for Ready to View */}
                    {isReady && (
                      <button
                        id={`view-print-btn-${result.key}`}
                        onClick={() =>
                          setSelectedResultModal({
                            session: result.session,
                            term: result.term
                          })
                        }
                        className="py-2.5 px-4 rounded-xl text-xs font-black text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-md transition-all flex items-center gap-2 cursor-pointer uppercase tracking-wider shrink-0 transform active:scale-98"
                      >
                        <Printer className="w-4 h-4" />
                        <span>View &amp; Print Report Card</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* ------------------------------------------------------------- */}
                {/* CARD BODY: CASE 1 — READY TO VIEW (PUBLISHED) */}
                {/* ------------------------------------------------------------- */}
                {isReady && (
                  <div>
                    {/* Performance KPIs Grid */}
                    <div className="p-4 sm:p-6 bg-slate-50/70 border-b border-slate-200">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
                          <span className="block text-[10px] uppercase font-bold text-slate-500">
                            Total Score
                          </span>
                          <span className="text-xl font-black text-slate-900 mt-1 block">
                            {result.totalMarks}
                            <span className="text-xs text-slate-400 font-normal">
                              {' '}
                              / {result.totalPossible}
                            </span>
                          </span>
                        </div>

                        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
                          <span className="block text-[10px] uppercase font-bold text-slate-500">
                            Term Average
                          </span>
                          <span className="text-xl font-black text-emerald-700 mt-1 block">
                            {result.average !== null ? `${result.average.toFixed(1)}%` : '—'}
                          </span>
                        </div>

                        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
                          <span className="block text-[10px] uppercase font-bold text-slate-500">
                            Overall Grade
                          </span>
                          <span className="text-xl font-black text-slate-900 mt-1 block">
                            {result.grade || '—'}{' '}
                            <span className="text-xs text-slate-500 font-normal">
                              ({result.remark})
                            </span>
                          </span>
                        </div>

                        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
                          <span className="block text-[10px] uppercase font-bold text-slate-500">
                            Class Position
                          </span>
                          <span className="text-xl font-black text-amber-600 mt-1 block">
                            {result.positionLabel}
                            {result.totalPupils > 0 && (
                              <span className="text-xs text-slate-400 font-normal">
                                {' '}
                                / {result.totalPupils} Pupils
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Accordion Toggle for Detailed Subject Scores */}
                      <div className="mt-4 flex items-center justify-between pt-2">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedResultKey(isExpanded ? null : result.key)
                          }
                          className="text-xs font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <span>
                            {isExpanded
                              ? 'Hide Subject Breakdown'
                              : `View Subject Breakdown (${result.scores.length} Subjects)`}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setSelectedResultModal({
                              session: result.session,
                              term: result.term
                            })
                          }
                          className="text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1 underline cursor-pointer"
                        >
                          <span>Open Full Report Sheet</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Subject Breakdown Table */}
                    {isExpanded && (
                      <div className="p-4 sm:p-6 bg-white border-t border-slate-200 animate-in fade-in duration-200 space-y-4">
                        <div className="overflow-x-auto rounded-2xl border border-slate-200">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-900 text-white font-bold">
                                <th className="p-3">#</th>
                                <th className="p-3">Subject</th>
                                <th className="p-3 text-center">CA 1 (20)</th>
                                <th className="p-3 text-center">CA 2 (20)</th>
                                <th className="p-3 text-center">Exam (60)</th>
                                <th className="p-3 text-center">Total (100)</th>
                                <th className="p-3 text-center">Grade</th>
                                <th className="p-3">Remark</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {result.scores.map((sc, idx) => {
                                const total = sc.Total ?? '-';
                                let grade = '-';
                                let remark = '-';
                                if (typeof total === 'number') {
                                  const g = getGradeAndRemark(total);
                                  grade = g.grade;
                                  remark = g.remark;
                                }

                                return (
                                  <tr key={sc.Subject} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                                    <td className="p-3 font-bold text-slate-900">{sc.Subject}</td>
                                    <td className="p-3 text-center font-mono text-slate-700">
                                      {sc.CA1 ?? '-'}
                                    </td>
                                    <td className="p-3 text-center font-mono text-slate-700">
                                      {sc.CA2 ?? '-'}
                                    </td>
                                    <td className="p-3 text-center font-mono text-slate-700">
                                      {sc.Exam ?? '-'}
                                    </td>
                                    <td className="p-3 text-center font-mono font-black text-slate-900">
                                      {total}
                                    </td>
                                    <td className="p-3 text-center font-bold">
                                      <span
                                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                          grade.startsWith('A')
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : grade.startsWith('B')
                                            ? 'bg-blue-100 text-blue-800'
                                            : grade.startsWith('C')
                                            ? 'bg-amber-100 text-amber-800'
                                            : grade.startsWith('F')
                                            ? 'bg-rose-100 text-rose-800'
                                            : 'bg-slate-100 text-slate-800'
                                        }`}
                                      >
                                        {grade}
                                      </span>
                                    </td>
                                    <td className="p-3 text-slate-600 font-medium">{remark}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Teacher & Principal Remarks */}
                        {result.summary && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2">
                            {result.summary.TeacherComment && (
                              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                                <span className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                  Class Teacher's Remark
                                </span>
                                <p className="italic text-slate-800 font-serif">
                                  "{result.summary.TeacherComment}"
                                </p>
                              </div>
                            )}
                            {result.summary.PrincipalComment && (
                              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                                <span className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                  Principal's Remark
                                </span>
                                <p className="italic text-slate-800 font-serif">
                                  "{result.summary.PrincipalComment}"
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* CARD BODY: CASE 2 — IN PROGRESS (FILLED BUT UNPUBLISHED) */}
                {/* ------------------------------------------------------------- */}
                {isInProgress && (
                  <div className="p-6 sm:p-8 bg-amber-50/30 space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0 shadow-xs">
                        <Clock className="w-6 h-6 animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-base font-black text-slate-900 font-serif">
                          Continuous Assessment Scores In Progress
                        </h4>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Your class teacher has recorded continuous assessment and examination scores for{' '}
                          <strong className="text-amber-900">{result.enteredScoresCount} {result.enteredScoresCount === 1 ? 'subject' : 'subjects'}</strong>. This result is currently saved as an unpublished draft while the teacher completes scoring, verifies records, or makes final corrections.
                        </p>
                      </div>
                    </div>

                    {/* Progress Indicator */}
                    <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-amber-600" />
                          <span>Subjects Graded by Teacher</span>
                        </span>
                        <span className="font-mono font-bold text-amber-800">
                          {result.enteredScoresCount} / {result.totalClassSubjects} Subjects Recorded
                        </span>
                      </div>

                      {/* Subject Chips */}
                      {result.enteredSubjects.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {result.enteredSubjects.map((subName) => (
                            <span
                              key={subName}
                              className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-100/70 text-amber-900 border border-amber-300/80 flex items-center gap-1"
                            >
                              <Check className="w-3 h-3 text-amber-700" />
                              <span>{subName}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Status Notice */}
                    <div className="p-3.5 bg-amber-100/50 rounded-2xl border border-amber-300 text-xs text-amber-900 flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <p className="leading-relaxed">
                        <strong>Ready to View Notice:</strong> Results are kept unpublished while teachers make score corrections. As soon as your teacher clicks <em>Publish Now</em>, this card will automatically switch to <strong>Ready to View</strong> and your official terminal report card will be instantly available.
                      </p>
                    </div>
                  </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* CARD BODY: CASE 3 — NOT FOUND (UNFILLED & UNPUBLISHED) */}
                {/* ------------------------------------------------------------- */}
                {isNotFound && (
                  <div className="p-6 sm:p-8 bg-slate-50/50 space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-300 text-slate-500 flex items-center justify-center shrink-0 shadow-xs">
                        <FileX2 className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-base font-black text-slate-900 font-serif">
                          No Results Recorded Yet
                        </h4>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Continuous assessment (CA1, CA2, CA3, CA4) and examination scores have not been uploaded for{' '}
                          <strong>{result.term} ({result.session})</strong>. Teaching, testing, or grading for this term has either not commenced or scores are pending entry by your teachers.
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 bg-white rounded-2xl border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
                      <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <p className="leading-relaxed">
                        Please check back periodically or contact your class teacher (<strong>{classTeacherName}</strong>) or the school administrative office if you believe scores for this term should already be available.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. CHANGE PASSWORD MODAL */}
      {/* ========================================================================= */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-2xl max-w-md w-full space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-600" />
                <span>Change Portal Password</span>
              </h3>
              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Your password protects your personal student portal and result records.
            </p>

            {passwordFeedback && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  passwordFeedback.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}
              >
                {passwordFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span className="font-semibold">{passwordFeedback.message}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Current Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={currentPasswordInput}
                    onChange={(e) => setCurrentPasswordInput(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-mono pr-10 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  New Password *
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Enter new password (min 4 characters)"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Confirm New Password *
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="w-1/3 py-2.5 px-3 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="w-2/3 py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:from-amber-300 hover:to-amber-500 shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {isChangingPassword ? 'Updating...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. OFFICIAL REPORT CARD VIEW & PRINT MODAL */}
      {/* ========================================================================= */}
      {selectedResultModal && (
        <StudentReportCardModal
          isOpen={true}
          student={currentStudent}
          allClassStudents={classStudents}
          allScores={allScores}
          allSummaries={allSummaries}
          subjectsList={subjectsList}
          session={selectedResultModal.session}
          term={selectedResultModal.term}
          websiteConfig={websiteConfig}
          onClose={() => setSelectedResultModal(null)}
        />
      )}
    </div>
  );
};
