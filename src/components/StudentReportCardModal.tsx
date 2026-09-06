import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Student, SubjectRule, SubjectScore, StudentSummary, TermType } from '../types';
import { SchoolLogo } from './SchoolLogo';
import { SchoolStamp } from './SchoolStamp';
import { printElementDirectly } from '../utils/printHelper';
import {
  determineClassLevel,
  getGradeAndRemark,
  getAutoReportRemark,
  getNextClassName,
  calculateSubjectTotal,
  calculateStudentOverallAverage,
  computeClassRankings,
  computeSubjectPositionsForStudent,
  computeAnnualCumulativeForStudent,
  getAuthoritativeSubjectsForClass,
  isMatchingClass,
  isMatchingStudentId,
  AFFECTIVE_TRAITS,
  PSYCHOMOTOR_SKILLS,
  DEFAULT_CURRENT_SESSION
} from '../utils/grading';
import {
  Printer,
  X,
  Award,
  CheckCircle2,
  Calendar,
  User,
  BookOpen,
  TrendingUp,
  FileCheck,
  Smartphone,
  LayoutGrid,
  Table as TableIcon,
  Download,
  Share2,
  AlertCircle
} from 'lucide-react';

import { getActiveSchoolConfig, SchoolTemplateConfig } from '../config/schoolConfig';
import { WebsiteConfig } from '../types';

interface StudentReportCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  allClassStudents?: Student[];
  allScores?: SubjectScore[];
  allSummaries?: StudentSummary[];
  subjectsList?: SubjectRule[];
  session?: string;
  term?: TermType;
  publishedDate?: string;
  websiteConfig?: WebsiteConfig;
  schoolConfig?: Partial<SchoolTemplateConfig>;
}

export const StudentReportCardModal: React.FC<StudentReportCardModalProps> = ({
  isOpen,
  onClose,
  student,
  allClassStudents = [],
  allScores = [],
  allSummaries = [],
  subjectsList = [],
  session = DEFAULT_CURRENT_SESSION,
  term = 'First Term',
  publishedDate,
  websiteConfig,
  schoolConfig
}) => {
  const activeSchool = websiteConfig
    ? getActiveSchoolConfig({
        schoolName: websiteConfig.schoolName,
        shortName: websiteConfig.shortName,
        motto: websiteConfig.motto,
        subMotto: websiteConfig.subMotto,
        logoUrl: websiteConfig.logoUrl,
        stampTopText: websiteConfig.stampTopText,
        stampBottomText: websiteConfig.stampBottomText,
        campusAddress: websiteConfig.campusAddress,
        cityState: websiteConfig.cityState,
        phonePrimary: websiteConfig.phonePrimary,
        ...schoolConfig
      })
    : getActiveSchoolConfig(schoolConfig);
  const [mobileDisplayMode, setMobileDisplayMode] = useState<'cards' | 'table'>('cards');

  if (!isOpen || !student) return null;

  // Safe field access
  const safeFullName = student.FullName || 'Pupil';
  const safeStudentId = student.StudentID || '—';
  const safeClass = student.Class || '—';
  const safeGender = student.Gender || 'Pupil';
  const safeSession = session || DEFAULT_CURRENT_SESSION;
  const safeTerm: TermType = (term as TermType) || 'First Term';

  // Authoritative subjects assigned specifically to this student's class
  const authoritativeSubjects = useMemo(() => {
    try {
      return getAuthoritativeSubjectsForClass(safeClass, subjectsList) || [];
    } catch {
      return [];
    }
  }, [safeClass, subjectsList]);

  // Compute subject positions (1st, 2nd, 3rd per subject) across peers in class
  const subjectPositions = useMemo(() => {
    try {
      return computeSubjectPositionsForStudent(
        student,
        allClassStudents,
        allScores,
        safeSession,
        safeTerm
      );
    } catch (e) {
      console.error('Failed to compute subject positions:', e);
      return {};
    }
  }, [student, allClassStudents, allScores, safeSession, safeTerm]);

  // Student specific scores for this term & session
  const studentScores = useMemo(() => {
    return (allScores || []).filter(
      (s) =>
        s &&
        isMatchingStudentId(s.StudentID, safeStudentId) &&
        s.Term === safeTerm &&
        (s.Session === safeSession || !s.Session)
    );
  }, [allScores, safeStudentId, safeTerm, safeSession]);

  // Map subjects with entered scores and calculated subject rank
  const scoreRows = useMemo(() => {
    return authoritativeSubjects.map((subjectName) => {
      const matched = studentScores.find(
        (s) => s && s.Subject && String(s.Subject).trim().toLowerCase() === String(subjectName).trim().toLowerCase()
      );
      const ca1 = matched?.CA1 ?? null;
      const ca2 = matched?.CA2 ?? null;
      const exam = matched?.Exam ?? null;
      const total = matched?.Total ?? calculateSubjectTotal(ca1, ca2, exam);
      const gradeInfo = getGradeAndRemark(total);
      const subjPos = total !== null ? (subjectPositions[String(subjectName).trim().toLowerCase()] || '—') : '—';

      return {
        subject: subjectName,
        ca1,
        ca2,
        exam,
        total,
        grade: gradeInfo.grade,
        remark: gradeInfo.remark,
        position: subjPos,
        badgeBg: gradeInfo.badgeBg,
        badgeColor: gradeInfo.badgeColor
      };
    });
  }, [authoritativeSubjects, studentScores, subjectPositions]);

  const displayRows = scoreRows;

  // Student stats
  const overallStats = useMemo(() => {
    try {
      return calculateStudentOverallAverage(
        displayRows.map((r) => ({ subject: r.subject, total: r.total }))
      );
    } catch {
      return { completedCount: 0, totalMarks: 0, average: null };
    }
  }, [displayRows]);

  // Summary remarks (attendance, teacher & principal remarks)
  const summaryRecord = useMemo(() => {
    return (allSummaries || []).find(
      (s) =>
        s &&
        isMatchingStudentId(s.StudentID, safeStudentId) &&
        s.Term === safeTerm &&
        (s.Session === safeSession || !s.Session)
    );
  }, [allSummaries, safeStudentId, safeTerm, safeSession]);

  // Ranking among peers in same class
  const classPeers = useMemo(() => {
    return (allClassStudents || []).filter((s) =>
      s && isMatchingClass(s.Class, safeClass)
    );
  }, [allClassStudents, safeClass]);

  const classRankings = useMemo(() => {
    try {
      return computeClassRankings(
        classPeers,
        allScores,
        safeSession,
        safeTerm,
        authoritativeSubjects
      );
    } catch {
      return [];
    }
  }, [classPeers, allScores, safeSession, safeTerm, authoritativeSubjects]);

  const studentRanking = useMemo(() => {
    return classRankings.find((r) => r?.student && isMatchingStudentId(r.student.StudentID, safeStudentId));
  }, [classRankings, safeStudentId]);

  // Attendance rate
  const daysPresent = summaryRecord?.DaysPresent ?? null;
  const daysOpened = summaryRecord?.DaysOpened ?? null;
  const attendanceRate =
    daysPresent !== null && daysOpened !== null && daysOpened > 0
      ? Math.min(100, Math.round((Number(daysPresent) / Number(daysOpened)) * 100))
      : null;

  // Annual Cumulative Assessment Across Terms for this Session
  const annualCumulative = useMemo(() => {
    try {
      return computeAnnualCumulativeForStudent(
        safeStudentId,
        safeSession,
        allScores,
        authoritativeSubjects,
        safeClass
      );
    } catch {
      return {
        firstTermAverage: null,
        secondTermAverage: null,
        thirdTermAverage: null,
        annualCumulativeAverage: null,
        annualGrade: '—',
        annualRemark: '—',
        promotionStatus: 'Awaiting Full Assessment',
        promotedToClass: 'Next Class',
        subjectBreakdown: [],
        hasFirstTermData: false,
        hasSecondTermData: false,
        hasThirdTermData: false,
      };
    }
  }, [safeStudentId, safeSession, allScores, authoritativeSubjects, safeClass]);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('report-card-modal-open');
      return () => {
        document.body.classList.remove('report-card-modal-open');
      };
    }
  }, [isOpen]);

  const handlePrint = () => {
    try {
      const docTitle = `Report_Card_${(safeFullName || 'Student').replace(/[^a-zA-Z0-9]/g, '_')}_${(safeClass || '').replace(/[^a-zA-Z0-9]/g, '_')}_${(safeTerm || '').replace(/[^a-zA-Z0-9]/g, '_')}`;
      printElementDirectly('printable-report-sheet', docTitle);
    } catch (e) {
      console.warn('Direct print error, falling back:', e);
      window.print();
    }
  };

  const isThirdTerm =
    safeTerm === 'Third Term' ||
    String(safeTerm).toLowerCase().includes('3rd') ||
    String(safeTerm).toLowerCase().includes('third');

  const effectiveAverage =
    overallStats.average !== null
      ? overallStats.average
      : annualCumulative.annualCumulativeAverage;

  const isPromoted = effectiveAverage !== null ? effectiveAverage >= 50 : false;
  const nextClass = annualCumulative.promotedToClass || getNextClassName(safeClass);

  const autoGeneratedRemark = getAutoReportRemark(
    effectiveAverage,
    isThirdTerm,
    isPromoted
  );

  const displayRemark =
    summaryRecord?.TeacherComment?.trim() && summaryRecord?.PrincipalComment?.trim()
      ? `${summaryRecord.TeacherComment.trim()} ${summaryRecord.PrincipalComment.trim()}`
      : summaryRecord?.TeacherComment?.trim() ||
        summaryRecord?.PrincipalComment?.trim() ||
        autoGeneratedRemark;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return new Date().toLocaleDateString();
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? new Date().toLocaleDateString() : d.toLocaleDateString();
    } catch {
      return new Date().toLocaleDateString();
    }
  };

  return createPortal(
    <div
      id="report-card-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex justify-center items-start overflow-y-auto p-0 sm:p-4 md:p-6"
    >
      <div
        id="report-card-modal-container"
        className="bg-white rounded-none sm:rounded-2xl shadow-2xl max-w-4xl w-full my-0 sm:my-4 overflow-hidden border-0 sm:border border-slate-200 flex flex-col min-h-screen sm:min-h-0"
      >
        {/* Top Control Bar (Hidden on Print) */}
        <div className="no-print bg-slate-950 text-white px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between border-b border-slate-800 shrink-0 sticky top-0 z-30 shadow-md">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <FileCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-black text-white tracking-wide uppercase truncate">
                {safeFullName}
              </h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                {safeStudentId} &bull; {safeClass} &bull; {safeTerm}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* View Mode Switcher for Mobile (Cards vs Table) */}
            <div className="sm:hidden flex bg-slate-900 border border-slate-800 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => setMobileDisplayMode('cards')}
                className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all ${
                  mobileDisplayMode === 'cards'
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Mobile Cards View"
              >
                <LayoutGrid className="w-3 h-3" />
                <span>Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileDisplayMode('table')}
                className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all ${
                  mobileDisplayMode === 'table'
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Table Sheet View"
              >
                <TableIcon className="w-3 h-3" />
                <span>Sheet</span>
              </button>
            </div>

            {/* Print / Save PDF Button */}
            <button
              id="print-report-card-btn"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 transition-all shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Print / PDF</span>
            </button>

            {/* Close Button */}
            <button
              id="close-report-modal-btn"
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 active:scale-90 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Container */}
        <div className="p-2 sm:p-6 md:p-8 overflow-y-auto bg-slate-100/70 print:bg-white print:p-0 print:overflow-visible flex-1 pb-6 sm:pb-8">
          {/* Printable Report Card Sheet */}
          <div
            id="printable-report-sheet"
            className="bg-white border border-slate-200 print:border-none rounded-2xl p-3.5 sm:p-6 md:p-8 shadow-xs print:shadow-none mx-auto max-w-3xl text-slate-900"
          >
            {/* 1. Official School Header */}
            <div className="school-header text-center pb-3.5 sm:pb-5 border-b-2 border-slate-900/80">
              {/* Crest */}
              <div className="flex justify-center mb-2 sm:mb-2.5">
                <SchoolLogo size="xl" src={activeSchool.logoUrl} alt={activeSchool.schoolName} className="w-24 h-24 sm:w-32 sm:h-32 object-contain" />
              </div>

              {/* School Name */}
              <h1 className="school-title text-xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-950 uppercase font-serif break-words leading-tight px-1">
                {activeSchool.schoolName}
              </h1>

              {/* Motto Below School Name */}
              <p className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-widest font-mono mt-1 break-words">
                Motto: {activeSchool.motto}
              </p>
              <p className="text-[11px] sm:text-xs font-semibold text-slate-700 tracking-wide mt-0.5 break-words">
                {activeSchool.campusAddress}{activeSchool.cityState ? `, ${activeSchool.cityState}` : ''}
              </p>

              {/* Terminal Report Title Badge */}
              <div className="mt-3 inline-block bg-slate-900 text-white px-4 sm:px-5 py-1.5 rounded-full text-xs sm:text-sm font-black uppercase tracking-widest shadow-xs">
                Continuous Assessment &amp; Terminal Report Sheet
              </div>
            </div>

            {/* 2. Pupil Bio-Data & Academic Term Summary */}
            <div className="my-3 sm:my-4 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:p-4">
              <div>
                <span className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-semibold block">Pupil's Full Name</span>
                <strong className="text-slate-950 font-bold text-xs sm:text-sm block truncate">
                  {safeFullName}
                </strong>
              </div>

              <div>
                <span className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-semibold block">School ID / Adm No</span>
                <strong className="text-slate-950 font-mono font-bold text-xs sm:text-sm block">
                  {safeStudentId}
                </strong>
              </div>

              <div>
                <span className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-semibold block">Class / Grade</span>
                <strong className="text-slate-950 font-bold text-xs sm:text-sm block">
                  {safeClass}
                </strong>
              </div>

              <div>
                <span className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-semibold block">Sex / Gender</span>
                <strong className="text-slate-950 font-bold text-xs sm:text-sm block">
                  {safeGender}
                </strong>
              </div>

              <div>
                <span className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-semibold block">Academic Session</span>
                <strong className="text-slate-900 font-bold block text-xs">{safeSession}</strong>
              </div>

              <div>
                <span className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-semibold block">Academic Term</span>
                <strong className="text-slate-900 font-bold block text-xs">{safeTerm}</strong>
              </div>

              <div>
                <span className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-semibold block">Class Position</span>
                <strong className="text-amber-800 font-bold block text-xs">
                  {studentRanking ? studentRanking.positionLabel : '—'}
                  {classPeers.length > 0 && <span className="text-slate-500 font-normal"> / {classPeers.length}</span>}
                </strong>
              </div>

              <div>
                <span className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-semibold block">Term Average</span>
                <strong className="text-slate-950 font-mono font-bold block text-xs">
                  {overallStats.average !== null ? `${overallStats.average}%` : '—'}
                </strong>
              </div>
            </div>

            {/* 2.5. THIRD TERM ONLY: Bold Promoted / Repeat Decision Banner */}
            {isThirdTerm && (
              <div
                id="third-term-promotion-banner"
                className={`my-3 p-3 sm:p-4 rounded-xl border-2 flex items-center justify-between gap-3 ${
                  isPromoted
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-950 shadow-xs'
                    : 'bg-rose-50 border-rose-600 text-rose-950 shadow-xs'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-black shrink-0 ${
                      isPromoted ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                    }`}
                  >
                    {isPromoted ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                  </div>
                  <div>
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest block opacity-80">
                      Annual Promotion Decision ({safeSession})
                    </span>
                    <h2
                      className={`text-base sm:text-xl md:text-2xl font-black uppercase tracking-tight font-serif ${
                        isPromoted ? 'text-emerald-900' : 'text-rose-900'
                      }`}
                    >
                      {isPromoted
                        ? `PROMOTED TO ${nextClass.toUpperCase()}`
                        : `TO REPEAT ${safeClass.toUpperCase()}`}
                    </h2>
                  </div>
                </div>

                <div className="shrink-0">
                  <span
                    className={`px-3.5 sm:px-5 py-1.5 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider border-2 shadow-xs inline-block ${
                      isPromoted
                        ? 'bg-emerald-600 text-white border-emerald-700'
                        : 'bg-rose-600 text-white border-rose-700'
                    }`}
                  >
                    {isPromoted ? 'PROMOTED' : 'REPEAT'}
                  </span>
                </div>
              </div>
            )}

            {/* Mobile Summary KPI Strip (Screen only on mobile) */}
            <div className="no-print sm:hidden grid grid-cols-3 gap-2 mb-3">
              <div className="bg-slate-900 text-white rounded-xl p-2 text-center">
                <span className="text-[9px] text-slate-400 block uppercase font-medium">Average</span>
                <strong className="text-sm font-mono font-black text-amber-400">
                  {overallStats.average !== null ? `${overallStats.average}%` : '—'}
                </strong>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-xl p-2 text-center">
                <span className="text-[9px] text-emerald-700 block uppercase font-medium">Position</span>
                <strong className="text-sm font-bold text-emerald-900">
                  {studentRanking?.positionLabel || '—'}
                </strong>
              </div>
              <div className="bg-slate-50 border border-slate-200 text-slate-900 rounded-xl p-2 text-center">
                <span className="text-[9px] text-slate-500 block uppercase font-medium">Graded</span>
                <strong className="text-sm font-mono font-bold">
                  {overallStats.completedCount}/{displayRows.length}
                </strong>
              </div>
            </div>

            {/* MOBILE ONLY: Touch-Friendly Subject Cards (Interactive & Responsive on Phones) */}
            <div className={`no-print sm:hidden ${mobileDisplayMode === 'cards' ? 'block' : 'hidden'} space-y-2.5 mb-4`}>
              <div className="flex items-center justify-between pb-1 px-1">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Subject Performance Breakdown
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {displayRows.length} Subjects
                </span>
              </div>

              {displayRows.map((row, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <h4 className="text-xs font-bold text-slate-950 leading-tight">
                          {row.subject}
                        </h4>
                      </div>
                      <span className="text-[10px] text-slate-500 mt-0.5 ml-6 block">
                        Rank: <strong className="text-amber-800 font-bold">{row.position}</strong> &bull; {row.remark}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`inline-block px-2 py-0.5 rounded-lg font-black text-xs ${row.badgeBg}`}>
                        Grade {row.grade}
                      </span>
                    </div>
                  </div>

                  {/* Score breakdown metrics grid */}
                  <div className="grid grid-cols-4 gap-1.5 text-center bg-slate-50 rounded-lg p-2 font-mono text-xs border border-slate-100">
                    <div>
                      <span className="text-[9px] text-slate-400 block font-sans uppercase">CA 1 (20)</span>
                      <strong className="text-slate-800">{row.ca1 !== null ? row.ca1 : '—'}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block font-sans uppercase">CA 2 (20)</span>
                      <strong className="text-slate-800">{row.ca2 !== null ? row.ca2 : '—'}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block font-sans uppercase">Exam (60)</span>
                      <strong className="text-slate-800">{row.exam !== null ? row.exam : '—'}</strong>
                    </div>
                    <div className="bg-slate-900 text-amber-300 rounded-md py-0.5">
                      <span className="text-[9px] text-slate-300 block font-sans uppercase">Total (100)</span>
                      <strong className="text-amber-300 font-bold">{row.total !== null ? row.total : '—'}</strong>
                    </div>
                  </div>
                </div>
              ))}

              {/* Total Summary Card */}
              <div className="bg-slate-900 text-white rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">Total Aggregate</span>
                  <span className="text-xs text-slate-300">{overallStats.completedCount} Graded Subjects</span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-mono font-black text-amber-400">{overallStats.totalMarks}</span>
                </div>
              </div>
            </div>

            {/* TABLE VIEW (Active on Desktop AND when toggled or printed) */}
            <div className={`mb-4 overflow-x-auto border border-slate-300 rounded-xl shadow-2xs ${
              mobileDisplayMode === 'table' ? 'block' : 'hidden sm:block'
            } print:block`}>
              {/* Mobile Scroll Indicator for Sheet view */}
              <div className="no-print sm:hidden flex items-center justify-between text-[10px] text-slate-500 p-2 bg-slate-50 border-b border-slate-200 font-medium">
                <span>Swipe left/right to view all columns:</span>
                <span className="text-amber-700 font-bold">&larr; Swipe &rarr;</span>
              </div>

              <table className="w-full text-left text-xs border-collapse min-w-[580px] sm:min-w-full">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold text-[10px] sm:text-[11px] uppercase tracking-wider">
                    <th className="py-2 sm:py-2.5 px-2 sm:px-3 border-r border-slate-700 w-7 text-center">S/N</th>
                    <th className="py-2 sm:py-2.5 px-2 sm:px-3 border-r border-slate-700 min-w-[130px]">Subject Name</th>
                    <th className="py-2 sm:py-2.5 px-1.5 sm:px-2 border-r border-slate-700 text-center w-11 sm:w-12">CA 1<br/><span className="text-[8px] sm:text-[9px] font-normal text-slate-300">(20)</span></th>
                    <th className="py-2 sm:py-2.5 px-1.5 sm:px-2 border-r border-slate-700 text-center w-11 sm:w-12">CA 2<br/><span className="text-[8px] sm:text-[9px] font-normal text-slate-300">(20)</span></th>
                    <th className="py-2 sm:py-2.5 px-1.5 sm:px-2 border-r border-slate-700 text-center w-11 sm:w-12">Exam<br/><span className="text-[8px] sm:text-[9px] font-normal text-slate-300">(60)</span></th>
                    <th className="py-2 sm:py-2.5 px-1.5 sm:px-2 border-r border-slate-700 text-center w-14 sm:w-16 bg-slate-800 text-amber-300">Total<br/><span className="text-[8px] sm:text-[9px] font-normal text-amber-200">(100)</span></th>
                    <th className="py-2 sm:py-2.5 px-1.5 sm:px-2 border-r border-slate-700 text-center w-10 sm:w-12">Grade</th>
                    <th className="py-2 sm:py-2.5 px-1.5 sm:px-2 border-r border-slate-700 text-center w-12 sm:w-14 text-amber-300">Pos.</th>
                    <th className="py-2 sm:py-2.5 px-2 sm:px-3 text-left min-w-[90px]">Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[10px] sm:text-[11px]">
                  {displayRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}
                    >
                      <td className="py-1.5 sm:py-2 px-2 sm:px-3 border-r border-slate-200 text-center text-slate-500 font-sans">
                        {idx + 1}
                      </td>
                      <td className="py-1.5 sm:py-2 px-2 sm:px-3 border-r border-slate-200 font-sans font-medium text-slate-900">
                        {row.subject}
                      </td>
                      <td className="py-1.5 sm:py-2 px-1.5 sm:px-2 border-r border-slate-200 text-center text-slate-700">
                        {row.ca1 !== null ? row.ca1 : '—'}
                      </td>
                      <td className="py-1.5 sm:py-2 px-1.5 sm:px-2 border-r border-slate-200 text-center text-slate-700">
                        {row.ca2 !== null ? row.ca2 : '—'}
                      </td>
                      <td className="py-1.5 sm:py-2 px-1.5 sm:px-2 border-r border-slate-200 text-center text-slate-700">
                        {row.exam !== null ? row.exam : '—'}
                      </td>
                      <td className="py-1.5 sm:py-2 px-1.5 sm:px-2 border-r border-slate-200 text-center font-bold text-slate-950 bg-slate-100/60 font-mono">
                        {row.total !== null ? row.total : '—'}
                      </td>
                      <td className="py-1.5 sm:py-2 px-1.5 sm:px-2 border-r border-slate-200 text-center font-sans font-black text-slate-900">
                        {row.grade}
                      </td>
                      <td className="py-1.5 sm:py-2 px-1.5 sm:px-2 border-r border-slate-200 text-center font-sans font-bold text-amber-900 bg-amber-50/40">
                        {row.position}
                      </td>
                      <td className="py-1.5 sm:py-2 px-2 sm:px-3 font-sans text-slate-700 text-[9px] sm:text-[10px]">
                        {row.remark}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-[10px] sm:text-xs">
                    <td colSpan={5} className="py-2 px-2 sm:px-3 text-right font-sans uppercase text-slate-700">
                      Total Marks / Graded Subjects:
                    </td>
                    <td className="py-2 px-1.5 sm:px-2 text-center font-mono text-slate-950 font-black">
                      {overallStats.totalMarks}
                    </td>
                    <td colSpan={3} className="py-2 px-2 sm:px-3 text-left font-sans text-slate-700 text-[10px] sm:text-[11px]">
                      {overallStats.completedCount} Subjects Graded
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 4. Performance Assessment Summary & Grading Key */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 mb-3 sm:mb-4 text-xs">
              {/* Performance Key */}
              <div className="border border-slate-200 rounded-xl p-2.5 sm:p-3 bg-slate-50 shadow-2xs">
                <h4 className="font-bold text-slate-900 uppercase text-[9px] sm:text-[10px] tracking-wider mb-1.5">
                  Official {activeSchool.acronym || activeSchool.shortName || 'School'} Grading System
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[9px] sm:text-[10px] text-slate-700">
                  <div className="bg-white p-1 rounded-md border border-slate-200"><strong>A (70 - 100%):</strong> Excellent</div>
                  <div className="bg-white p-1 rounded-md border border-slate-200"><strong>B (60 - 69%):</strong> Very Good</div>
                  <div className="bg-white p-1 rounded-md border border-slate-200"><strong>C (50 - 59%):</strong> Good / Credit</div>
                  <div className="bg-white p-1 rounded-md border border-slate-200"><strong>D (45 - 49%):</strong> Pass</div>
                  <div className="bg-white p-1 rounded-md border border-slate-200 col-span-2 sm:col-span-1"><strong>F (0 - 44%):</strong> Fail</div>
                </div>
              </div>

              {/* Attendance Card */}
              <div className="border border-slate-200 rounded-xl p-2.5 sm:p-3 bg-slate-50 shadow-2xs flex flex-col justify-between">
                <h4 className="font-bold text-slate-900 uppercase text-[9px] sm:text-[10px] tracking-wider mb-1.5">
                  Attendance Record
                </h4>
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500 text-[10px] sm:text-[11px] block">Days Present</span>
                    <strong className="text-slate-900">{daysPresent !== null ? daysPresent : '—'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] sm:text-[11px] block">Days Opened</span>
                    <strong className="text-slate-900">{daysOpened !== null ? daysOpened : '—'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] sm:text-[11px] block">Attendance Rate</span>
                    <strong className="text-emerald-800 font-mono font-bold">
                      {attendanceRate !== null ? `${attendanceRate}%` : '—'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Affective & Psychomotor Behavioral Assessments Table */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 mb-3 sm:mb-4 text-xs">
              {/* Affective Domain */}
              <div className="border border-slate-200 rounded-xl p-2.5 sm:p-3 bg-white shadow-2xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 mb-1.5">
                  <h4 className="font-bold text-slate-900 uppercase text-[9px] sm:text-[10px] tracking-wider">
                    Affective Domain (Rating 1 - 5)
                  </h4>
                  <span className="text-[9px] text-slate-400">5: Max</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] sm:text-[10px]">
                  {AFFECTIVE_TRAITS.map((trait) => {
                    const aff = summaryRecord?.AffectiveRatings as any;
                    const ratingVal =
                      aff?.[trait.key] ??
                      aff?.[trait.key.charAt(0).toUpperCase() + trait.key.slice(1)] ??
                      aff?.[trait.label] ??
                      5;
                    return (
                      <div key={trait.key} className="flex items-center justify-between py-0.5 border-b border-slate-100/60">
                        <span className="text-slate-700 truncate">{trait.label}</span>
                        <span className="font-bold font-mono text-slate-900 bg-slate-100 px-1.5 py-0.2 rounded text-[9px]">
                          {ratingVal}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Psychomotor Skills */}
              <div className="border border-slate-200 rounded-xl p-2.5 sm:p-3 bg-white shadow-2xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 mb-1.5">
                  <h4 className="font-bold text-slate-900 uppercase text-[9px] sm:text-[10px] tracking-wider">
                    Psychomotor Skills (Rating 1 - 5)
                  </h4>
                  <span className="text-[9px] text-slate-400">5: Max</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] sm:text-[10px]">
                  {PSYCHOMOTOR_SKILLS.map((skill) => {
                    const psy = summaryRecord?.PsychomotorRatings as any;
                    const ratingVal =
                      psy?.[skill.key] ??
                      psy?.[skill.key.charAt(0).toUpperCase() + skill.key.slice(1)] ??
                      psy?.[skill.label] ??
                      4;
                    return (
                      <div key={skill.key} className="flex items-center justify-between py-0.5 border-b border-slate-100/60">
                        <span className="text-slate-700 truncate">{skill.label}</span>
                        <span className="font-bold font-mono text-indigo-950 bg-indigo-50 px-1.5 py-0.2 rounded text-[9px]">
                          {ratingVal}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Annual Cumulative Progress & Promotion Decision (Only shown on Third Term) */}
            {safeTerm === 'Third Term' && (
              <div className="mb-3 sm:mb-4 bg-amber-50/70 border border-amber-300/80 rounded-xl p-2.5 sm:p-3.5 text-xs text-slate-900 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-amber-200/80">
                  <div className="flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-700 shrink-0" />
                    <h4 className="font-black text-amber-950 uppercase text-[10px] sm:text-xs tracking-wider">
                      Annual Cumulative Progress &amp; Promotion ({safeSession})
                    </h4>
                  </div>
                  <span className="bg-amber-600 text-white font-extrabold px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider">
                    End of Session Final
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2.5 text-center">
                  <div className="bg-white/80 border border-amber-200 rounded-lg p-1.5">
                    <span className="text-[9px] text-slate-500 font-semibold block uppercase">1st Term Avg</span>
                    <strong className="text-xs font-mono font-bold text-slate-900">
                      {annualCumulative.firstTermAverage !== null ? `${annualCumulative.firstTermAverage}%` : '—'}
                    </strong>
                  </div>

                  <div className="bg-white/80 border border-amber-200 rounded-lg p-1.5">
                    <span className="text-[9px] text-slate-500 font-semibold block uppercase">2nd Term Avg</span>
                    <strong className="text-xs font-mono font-bold text-slate-900">
                      {annualCumulative.secondTermAverage !== null ? `${annualCumulative.secondTermAverage}%` : '—'}
                    </strong>
                  </div>

                  <div className="bg-white/80 border border-amber-200 rounded-lg p-1.5">
                    <span className="text-[9px] text-slate-500 font-semibold block uppercase">3rd Term Avg</span>
                    <strong className="text-xs font-mono font-bold text-slate-900">
                      {annualCumulative.thirdTermAverage !== null ? `${annualCumulative.thirdTermAverage}%` : '—'}
                    </strong>
                  </div>

                  <div className="bg-slate-900 text-amber-300 rounded-lg p-1.5">
                    <span className="text-[9px] text-slate-300 font-semibold block uppercase">Annual Cum. Avg</span>
                    <strong className="text-xs font-mono font-black text-amber-300">
                      {annualCumulative.annualCumulativeAverage !== null ? `${annualCumulative.annualCumulativeAverage}%` : '—'}
                    </strong>
                  </div>

                  <div className="col-span-2 sm:col-span-1 bg-emerald-800 text-white rounded-lg p-1.5 flex flex-col justify-center">
                    <span className="text-[8px] text-emerald-200 font-bold block uppercase">Promotion Outcome</span>
                    <strong className="text-[10px] font-extrabold truncate">
                      {summaryRecord?.PromotionDecision || annualCumulative.promotionStatus}
                    </strong>
                  </div>
                </div>

                {/* Third Term Full Subject Cumulative Breakdown */}
                {annualCumulative.subjectBreakdown && annualCumulative.subjectBreakdown.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-amber-200">
                    <div className="text-[10px] font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                      Subject Annual Scores Breakdown (1st + 2nd + 3rd Term)
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[10px] border-collapse bg-white rounded-lg border border-amber-200 min-w-[480px]">
                        <thead>
                          <tr className="bg-amber-100/70 text-slate-800 font-bold uppercase text-[9px]">
                            <th className="py-1 px-2 border-r border-amber-200">Subject</th>
                            <th className="py-1 px-1.5 border-r border-amber-200 text-center">1st Term</th>
                            <th className="py-1 px-1.5 border-r border-amber-200 text-center">2nd Term</th>
                            <th className="py-1 px-1.5 border-r border-amber-200 text-center">3rd Term</th>
                            <th className="py-1 px-1.5 border-r border-amber-200 text-center bg-amber-200/50">Annual Total</th>
                            <th className="py-1 px-1.5 border-r border-amber-200 text-center bg-amber-200/80 font-bold">Cum. Avg</th>
                            <th className="py-1 px-1.5 text-center">Grade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100 font-mono">
                          {annualCumulative.subjectBreakdown.map((subj, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-amber-50/30'}>
                              <td className="py-1 px-2 border-r border-amber-100 font-sans font-medium text-slate-900">
                                {subj.subject}
                              </td>
                              <td className="py-1 px-1.5 border-r border-amber-100 text-center text-slate-700">
                                {subj.firstTermTotal !== null ? subj.firstTermTotal : '—'}
                              </td>
                              <td className="py-1 px-1.5 border-r border-amber-100 text-center text-slate-700">
                                {subj.secondTermTotal !== null ? subj.secondTermTotal : '—'}
                              </td>
                              <td className="py-1 px-1.5 border-r border-amber-100 text-center text-slate-700">
                                {subj.thirdTermTotal !== null ? subj.thirdTermTotal : '—'}
                              </td>
                              <td className="py-1 px-1.5 border-r border-amber-100 text-center font-bold text-slate-950 bg-amber-50/50">
                                {subj.cumulativeTotal !== null ? subj.cumulativeTotal : '—'}
                              </td>
                              <td className="py-1 px-1.5 border-r border-amber-100 text-center font-black text-amber-900 bg-amber-100/50">
                                {subj.cumulativeAverage !== null ? `${subj.cumulativeAverage}%` : '—'}
                              </td>
                              <td className="py-1 px-1.5 text-center font-sans font-bold text-slate-900">
                                {subj.grade}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 5. Unified General Remark with Official School Stamp */}
            <div className="mb-3 sm:mb-4 text-xs">
              <div className="border border-slate-200 rounded-xl p-3 sm:p-4 bg-white shadow-2xs relative overflow-hidden">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-slate-900 uppercase text-[9px] sm:text-[10px] tracking-wider">
                    Remark:
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-slate-500 font-mono">
                    Date: {formatDate(publishedDate)}
                  </span>
                </div>
                <p className="text-slate-800 italic text-[11px] sm:text-xs leading-relaxed max-w-2xl">
                  "{displayRemark}"
                </p>

                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-end justify-between gap-2 text-[9px] sm:text-[10px] text-slate-600 relative">
                  <div className="space-y-1">
                    <div className="font-medium">
                      Teacher / Principal Signature: _______________________
                    </div>
                    <div className="text-slate-500">
                      Status: <strong className="text-emerald-700 font-bold">Official &amp; Approved</strong>
                    </div>
                  </div>

                  {/* Official School Stamp overlay placed directly on signature area */}
                  <div className="sm:absolute sm:right-2 sm:-bottom-1 mt-1 sm:mt-0 flex justify-end">
                    <SchoolStamp
                      date={formatDate(publishedDate)}
                      size="md"
                      schoolName={activeSchool.stampTopText || activeSchool.schoolName}
                      bottomText={activeSchool.stampBottomText || activeSchool.motto}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 6. Footer Stamp */}
            <div className="pt-2 text-center text-[9px] sm:text-[10px] text-slate-500 border-t border-slate-200">
              <p>{activeSchool.schoolName} &bull; Continuous Assessment Report</p>
              <p className="text-[8px] sm:text-[9px] text-slate-400 mt-0.5">
                Generated from {activeSchool.shortName || activeSchool.schoolName} Secure Cloud Portal &bull; Verified Academic Document
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};



