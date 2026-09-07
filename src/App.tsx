import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Student,
  SubjectRule,
  SubjectScore,
  StudentSummary,
  Teacher,
  TermType,
  PublishedRecord,
  ClassRecord,
  WebsiteConfig,
  AffectiveRatings,
  PsychomotorRatings
} from './types';
import {
  FirebaseService,
  INITIAL_MOCK_SUBJECTS,
  INITIAL_DEFAULT_CLASSES,
  ALL_SCHOOL_CLASSES,
  getCachedSchoolData
} from './services/firebaseService';
import { DEFAULT_WEBSITE_CONFIG } from './data/websiteDefaults';
import { Navbar } from './components/Navbar';
import { LoginScreen } from './components/LoginScreen';
import { ClassRoster } from './components/ClassRoster';
import { TeacherDashboard } from './components/TeacherDashboard';
import { ReportCardEntry } from './components/ReportCardEntry';
import { ClassSummary } from './components/ClassSummary';
import { SheetSetupModal } from './components/SheetSetupModal';
import { StudentResultPortal } from './components/StudentResultPortal';
import { SchoolHomepage } from './components/SchoolHomepage';
import { SubjectManagerModal } from './components/SubjectManagerModal';
import { StudentDashboard } from './components/StudentDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { isMatchingClass, normalizeClassIdentifier, DEFAULT_CURRENT_SESSION, DEFAULT_CURRENT_TERM } from './utils/grading';
import { AlertTriangle } from 'lucide-react';
import { safeSessionStorage } from './utils/safeStorage';

const TEACHER_AUTH_STORAGE_KEY = 'school_portal_teacher_auth';
const STUDENT_AUTH_STORAGE_KEY = 'school_portal_student_auth';

export default function App() {
  // Authentication State
  const [currentTeacher, setCurrentTeacher] = useState<Teacher | null>(() => {
    const saved =
      safeSessionStorage.getItem(TEACHER_AUTH_STORAGE_KEY) ||
      safeSessionStorage.getItem('eminent_royal_crown_teacher_auth');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.FullName && parsed.FullName.toLowerCase().includes('administrator')) {
          parsed.FullName = 'Portal Administrator';
          safeSessionStorage.setItem(TEACHER_AUTH_STORAGE_KEY, JSON.stringify(parsed));
        }
        return parsed;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [currentStudent, setCurrentStudent] = useState<Student | null>(() => {
    const saved = safeSessionStorage.getItem(STUDENT_AUTH_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  // Public View Mode: 'home' | 'portal' | 'staff_login' | 'student_login'
  const [publicMode, setPublicMode] = useState<'home' | 'portal' | 'staff_login' | 'student_login'>('home');

  // Teacher/Admin Dashboard View State: 'admin' | 'roster' | 'entry' | 'summary' | 'website'
  const [currentView, setCurrentView] = useState<'admin' | 'roster' | 'entry' | 'summary' | 'website'>(() => {
    const saved = safeSessionStorage.getItem(TEACHER_AUTH_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.Role === 'admin' || parsed.Username?.toLowerCase() === 'admin') {
          return 'admin';
        }
      } catch {
        // ignore
      }
    }
    return 'roster';
  });

  // Academic Configuration State
  const [session, setSession] = useState<string>(DEFAULT_CURRENT_SESSION);
  const [term, setTerm] = useState<TermType>(DEFAULT_CURRENT_TERM);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Modals
  const [isSetupModalOpen, setIsSetupModalOpen] = useState<boolean>(false);
  const [isSubjectManagerOpen, setIsSubjectManagerOpen] = useState<boolean>(false);

  // Dynamic Website CMS Configuration State
  const [websiteConfig, setWebsiteConfig] = useState<WebsiteConfig>(() => {
    return FirebaseService.getCachedWebsiteConfig() || DEFAULT_WEBSITE_CONFIG;
  });

  // Data Store initialized from real cache or empty arrays
  const initialCache = getCachedSchoolData();
  const [teachersList, setTeachersList] = useState<Teacher[]>(() => initialCache?.teachers || []);
  const [studentsList, setStudentsList] = useState<Student[]>(() => initialCache?.students || []);
  const [subjectsList, setSubjectsList] = useState<SubjectRule[]>(
    () => initialCache?.subjects || INITIAL_MOCK_SUBJECTS
  );
  const [allScores, setAllScores] = useState<SubjectScore[]>(() => initialCache?.scores || []);
  const [allSummaries, setAllSummaries] = useState<StudentSummary[]>(
    () => initialCache?.summaries || []
  );
  const [publishedRecords, setPublishedRecords] = useState<PublishedRecord[]>(
    () => initialCache?.published || FirebaseService.getPublishedRecords()
  );
  const [classesList, setClassesList] = useState<string[]>(
    () => initialCache?.classNames || ALL_SCHOOL_CLASSES
  );
  const [classRecords, setClassRecords] = useState<ClassRecord[]>(
    () => initialCache?.classes || INITIAL_DEFAULT_CLASSES
  );

  // System & Connection State
  const [isLiveSheet, setIsLiveSheet] = useState<boolean>(FirebaseService.isConfigured());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active score entry & draft editing tracking (prevents background sync and page reloads from wiping progress)
  const [isEditingScores, setIsEditingScores] = useState<boolean>(false);
  const isEditingScoresRef = useRef<boolean>(false);

  const handleEditingChange = useCallback((editing: boolean) => {
    setIsEditingScores(editing);
    isEditingScoresRef.current = editing;
  }, []);

  // Global browser beforeunload guard to prevent accidental tab closing or reloading while filling scores
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isEditingScoresRef.current) {
        e.preventDefault();
        e.returnValue = 'You have unsaved score progress. If you leave or reload, unsaved inputs might be lost.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Immediate in-memory score updater
  const handleUpdateStudentScores = useCallback(
    (
      studentId: string,
      targetSession: string,
      targetTerm: TermType,
      scores: Array<{
        Subject: string;
        CA1: number | null;
        CA2: number | null;
        Exam: number | null;
        Total: number | null;
      }>,
      summary: {
        DaysPresent: number | null;
        DaysOpened: number | null;
        TeacherComment: string;
        PrincipalComment: string;
        AffectiveRatings?: AffectiveRatings;
        PsychomotorRatings?: PsychomotorRatings;
        PromotionDecision?: string;
      }
    ) => {
      setAllScores((prev) => {
        const filtered = prev.filter(
          (s) =>
            !(
              s.StudentID.toLowerCase() === studentId.toLowerCase() &&
              s.Term === targetTerm &&
              (s.Session === targetSession || !s.Session)
            )
        );
        scores.forEach((sc) => {
          if (sc.Total !== null || sc.CA1 !== null || sc.CA2 !== null || sc.Exam !== null) {
            filtered.push({
              StudentID: studentId,
              Term: targetTerm,
              Session: targetSession,
              Subject: sc.Subject,
              CA1: sc.CA1,
              CA2: sc.CA2,
              Exam: sc.Exam,
              Total: sc.Total
            });
          }
        });
        return filtered;
      });

      setAllSummaries((prev) => {
        const filtered = prev.filter(
          (sm) =>
            !(
              sm.StudentID.toLowerCase() === studentId.toLowerCase() &&
              sm.Term === targetTerm &&
              (sm.Session === targetSession || !sm.Session)
            )
        );
        filtered.push({
          StudentID: studentId,
          Term: targetTerm,
          Session: targetSession,
          DaysPresent: summary.DaysPresent,
          DaysOpened: summary.DaysOpened,
          TeacherComment: summary.TeacherComment,
          PrincipalComment: summary.PrincipalComment,
          AffectiveRatings: summary.AffectiveRatings,
          PsychomotorRatings: summary.PsychomotorRatings,
          PromotionDecision: summary.PromotionDecision,
          UpdatedAt: new Date().toISOString()
        });
        return filtered;
      });
    },
    []
  );

  // Load all data from Firebase Firestore
  const refreshAllData = useCallback(async (silent = false) => {
    // If user is actively editing/entering scores, NEVER reload or wipe their in-progress work!
    if (isEditingScoresRef.current) {
      return;
    }

    if (!silent) {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      const response = await FirebaseService.loadAllData(true);
      // Double check if user started typing while fetch was in flight
      if (isEditingScoresRef.current) {
        return;
      }
      setTeachersList(response.teachers);
      setStudentsList(response.students);
      setSubjectsList(response.subjects);
      if (response.classes) {
        setClassRecords(response.classes);
      }
      if (response.classNames) {
        setClassesList(response.classNames);
      }

      // Synchronize current active teacher or admin profile
      if (response.teachers && response.teachers.length > 0) {
        setCurrentTeacher((prev) => {
          if (!prev) return null;
          const cleanUser = prev.Username?.toLowerCase().trim();
          const match =
            response.teachers.find(
              (t: Teacher) => t.Username?.toLowerCase().trim() === cleanUser
            ) ||
            response.teachers.find((t: Teacher) =>
              t.PreviousUsernames?.some((pu) => pu.toLowerCase().trim() === cleanUser)
            ) ||
            (prev.Role === 'admin'
              ? response.teachers.find(
                  (t: Teacher) => t.Username?.toLowerCase() === 'admin' && t.Role === 'admin'
                ) ||
                response.teachers.find((t: Teacher) => t.Role === 'admin')
              : response.teachers.find(
                  (t: Teacher) => t.Role !== 'admin' && isMatchingClass(t.ClassAssigned, prev.ClassAssigned)
                ));

          if (match) {
            const updated = {
              ...prev,
              ...match,
              FullName:
                match.FullName && !match.FullName.toLowerCase().includes('administrator')
                  ? match.FullName
                  : match.Role === 'admin'
                  ? 'Portal Administrator'
                  : match.FullName
            };
            safeSessionStorage.setItem(TEACHER_AUTH_STORAGE_KEY, JSON.stringify(updated));
            return updated;
          }
          return prev;
        });
      }

      if (response.isLive) {
        setAllScores(response.scores || []);
        setAllSummaries(response.summaries || []);
        setPublishedRecords(response.published || []);
      } else {
        if (response.scores && response.scores.length > 0) {
          setAllScores(response.scores);
        }
        if (response.summaries && response.summaries.length > 0) {
          setAllSummaries(response.summaries);
        }
        setPublishedRecords(response.published || []);
      }
      setIsLiveSheet(response.isLive);

      if (response.isLive) {
        setErrorMessage(null);
      } else if (response.error) {
        setErrorMessage(response.error);
      }

      // Also fetch CMS Website Config
      try {
        const cmsConfig = await FirebaseService.fetchWebsiteConfig();
        if (cmsConfig) {
          setWebsiteConfig(cmsConfig);
        }
      } catch (cmsErr) {
        console.warn('CMS config fetch notice:', cmsErr);
      }
    } catch (err: any) {
      console.error('Failed to load data:', err);
      setErrorMessage(err.message || 'Failed to sync data.');
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, []);

  // Save Website CMS Config
  const handleSaveWebsiteConfig = async (newConfig: WebsiteConfig) => {
    setWebsiteConfig(newConfig);
    const res = await FirebaseService.saveWebsiteConfig(newConfig);
    return res;
  };

  // Reset Website CMS Config to Defaults
  const handleResetWebsiteConfig = async () => {
    const res = await FirebaseService.resetWebsiteConfig();
    if (res.success && res.config) {
      setWebsiteConfig(res.config);
    }
    return res;
  };

  // Initial load on mount
  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  // Secret Admin Access: Ctrl+Shift+S or ?admin=setup or ?sheet=config in URL
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        setIsSetupModalOpen((prev) => !prev);
      }
    };

    const params = new URLSearchParams(window.location.search);
    if (
      params.get('admin') === 'setup' ||
      params.get('sheet') === 'config' ||
      params.get('setup') === '1'
    ) {
      setIsSetupModalOpen(true);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle Teacher / Admin Login
  const handleTeacherLoginSuccess = (teacher: Teacher) => {
    setCurrentTeacher(teacher);
    setCurrentStudent(null);
    safeSessionStorage.setItem(TEACHER_AUTH_STORAGE_KEY, JSON.stringify(teacher));
    safeSessionStorage.removeItem(STUDENT_AUTH_STORAGE_KEY);
    if (teacher.Role === 'admin' || teacher.Username?.toLowerCase() === 'admin') {
      setCurrentView('admin');
    } else {
      setCurrentView('roster');
    }
    setSelectedStudent(null);
  };

  // Update Active Teacher Profile
  const handleUpdateCurrentTeacher = useCallback((updatedTeacher: Teacher) => {
    setCurrentTeacher(updatedTeacher);
    safeSessionStorage.setItem(TEACHER_AUTH_STORAGE_KEY, JSON.stringify(updatedTeacher));
  }, []);

  // Handle Student Login
  const handleStudentLoginSuccess = (student: Student) => {
    setCurrentStudent(student);
    setCurrentTeacher(null);
    safeSessionStorage.setItem(STUDENT_AUTH_STORAGE_KEY, JSON.stringify(student));
    safeSessionStorage.removeItem(TEACHER_AUTH_STORAGE_KEY);
    setSelectedStudent(null);
  };

  // Handle Logout
  const handleLogout = () => {
    setCurrentTeacher(null);
    setCurrentStudent(null);
    safeSessionStorage.removeItem(TEACHER_AUTH_STORAGE_KEY);
    safeSessionStorage.removeItem(STUDENT_AUTH_STORAGE_KEY);
    setSelectedStudent(null);
    setCurrentView('roster');
    setPublicMode('home');
  };

  // Switch Class for Admin
  const handleSwitchClass = (targetClass: string) => {
    if (!currentTeacher) return;
    const updatedTeacher = { ...currentTeacher, ClassAssigned: targetClass };
    setCurrentTeacher(updatedTeacher);
    safeSessionStorage.setItem(TEACHER_AUTH_STORAGE_KEY, JSON.stringify(updatedTeacher));
    setSelectedStudent(null);
    setCurrentView('roster');
  };

  // Handle Adding Student
  const handleAddStudent = async (newStudent: {
    studentId: string;
    fullName: string;
    className: string;
    gender: 'Male' | 'Female';
  }) => {
    await FirebaseService.addStudent(newStudent);
    await refreshAllData();
  };

  // Handle Deleting Student
  const handleDeleteStudent = async (studentId: string) => {
    await FirebaseService.deleteStudent(studentId);
    await refreshAllData();
  };

  // Handle Deleting Report Card Result
  const handleDeleteReportCard = async (
    studentId: string,
    currentSession: string,
    currentTerm: TermType
  ) => {
    await FirebaseService.deleteStudentReportCard({
      studentId,
      session: currentSession,
      term: currentTerm
    });
    setAllScores((prev) =>
      prev.filter(
        (s) =>
          !(
            s.StudentID.toLowerCase() === studentId.toLowerCase() &&
            s.Term === currentTerm &&
            (s.Session === currentSession || !s.Session)
          )
      )
    );
    setAllSummaries((prev) =>
      prev.filter(
        (sm) =>
          !(
            sm.StudentID.toLowerCase() === studentId.toLowerCase() &&
            sm.Term === currentTerm &&
            (sm.Session === currentSession || !sm.Session)
          )
      )
    );
    await refreshAllData();
  };

  // Check if a class/term/session is currently published and approved by Admin
  const isClassPublished = useCallback(
    (className: string, currentTerm: TermType, currentSession: string): boolean => {
      if (!className) return false;
      const cleanTargetClass = normalizeClassIdentifier(className);
      const cleanTargetTerm = (currentTerm || term || '').trim().toLowerCase();
      const cleanTargetSession = (currentSession || session || '').trim().toLowerCase().replace(/academic\s*session/g, '').replace(/session/g, '').trim();

      // Look through published records in reverse order (newest first)
      for (let i = publishedRecords.length - 1; i >= 0; i--) {
        const r = publishedRecords[i];
        const rClass = normalizeClassIdentifier(r.className);
        const rTerm = (r.term || '').trim().toLowerCase();
        const rSession = (r.session || '').trim().toLowerCase().replace(/academic\s*session/g, '').replace(/session/g, '').trim();

        const classMatches = rClass === cleanTargetClass || isMatchingClass(r.className, className);
        const termMatches =
          !rTerm ||
          !cleanTargetTerm ||
          rTerm === cleanTargetTerm ||
          rTerm.includes(cleanTargetTerm) ||
          cleanTargetTerm.includes(rTerm);
        const sessionMatches =
          !rSession ||
          !cleanTargetSession ||
          rSession === cleanTargetSession ||
          rSession.includes(cleanTargetSession) ||
          cleanTargetSession.includes(rSession);

        if (classMatches && termMatches && sessionMatches) {
          return Boolean(r.isPublished);
        }
      }

      return FirebaseService.isClassResultPublished(className, currentTerm, currentSession);
    },
    [publishedRecords, term, session]
  );

  // Toggle publish status for the current teacher's class
  const handleTogglePublish = async (isPublishingNow: boolean) => {
    if (!currentTeacher) return { success: false, isPublished: false, message: 'Teacher not found' };
    const res = await FirebaseService.setClassPublishStatus(
      currentTeacher.ClassAssigned,
      term,
      session,
      isPublishingNow,
      currentTeacher.FullName || currentTeacher.Username,
      isPublishingNow
        ? {
            status: 'approved',
            teacherSubmitted: true,
            teacherSubmittedBy: currentTeacher.FullName || currentTeacher.Username,
            adminApproved: true,
            adminApprovedBy: currentTeacher.FullName || currentTeacher.Username
          }
        : {
            status: 'draft',
            teacherSubmitted: false,
            adminApproved: false
          }
    );
    setPublishedRecords([...FirebaseService.getPublishedRecords()]);
    return res;
  };

  // Real-time Firestore subscription for published status across devices
  useEffect(() => {
    const unsubscribe = FirebaseService.subscribeToPublishedRecords((records) => {
      setPublishedRecords(records);
    });
    return () => unsubscribe();
  }, []);

  // Synchronize document title with active school name
  useEffect(() => {
    if (websiteConfig?.schoolName) {
      document.title = `${websiteConfig.schoolName} Portal`;
    }
  }, [websiteConfig?.schoolName]);

  // Current teacher's class publication status
  const isCurrentClassPublished = useMemo(() => {
    if (!currentTeacher) return false;
    return isClassPublished(currentTeacher.ClassAssigned, term, session);
  }, [currentTeacher, term, session, isClassPublished]);

  // Automatic background live synchronization with Firebase Firestore
  useEffect(() => {
    const interval = setInterval(() => {
      // Do NOT sync or overwrite data in background if teacher is actively entering scores
      if (isEditingScoresRef.current || currentView === 'entry') {
        return;
      }
      if (document.visibilityState === 'visible' && !isLoading) {
        FirebaseService.loadAllData(true)
          .then((response) => {
            if (isEditingScoresRef.current) return;
            if (response.isLive) {
              setTeachersList(response.teachers);
              setStudentsList(response.students);
              setSubjectsList(response.subjects);
              setAllScores(response.scores || []);
              setAllSummaries(response.summaries || []);
              if (response.published && response.published.length > 0) {
                setPublishedRecords(response.published);
              }
              setIsLiveSheet(true);
            }
          })
          .catch(() => {});
      }
    }, 45000);

    const handleVisibilityChange = () => {
      // NEVER reload or cancel progress when teacher is entering data and returns to tab
      if (isEditingScoresRef.current || currentView === 'entry') {
        return;
      }
      if (document.visibilityState === 'visible' && !isLoading) {
        refreshAllData(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshAllData, isLoading, currentView]);

  // Filter students for the current teacher's assigned class
  const classStudents = currentTeacher
    ? studentsList.filter((s) => isMatchingClass(s.Class, currentTeacher.ClassAssigned))
    : [];

  const isAdminUser = Boolean(
    currentTeacher &&
      (currentTeacher.Role === 'admin' ||
        currentTeacher.Username?.toLowerCase() === 'admin')
  );

  // Security guard: ensure non-admin users cannot be in 'admin' view
  useEffect(() => {
    if (currentTeacher && !isAdminUser && currentView === 'admin') {
      setCurrentView('roster');
    }
  }, [currentTeacher, isAdminUser, currentView]);

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors ${
        !currentTeacher && !currentStudent ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* Top Navigation Bar (Active when staff/teacher is signed in) */}
      {currentTeacher && (
        <Navbar
          currentTeacher={currentTeacher}
          currentView={currentView}
          websiteConfig={websiteConfig}
          onSelectView={(view) => {
            if (view === 'admin' && !isAdminUser) {
              return;
            }
            if (view === 'roster') setSelectedStudent(null);
            if (view === 'entry' && !selectedStudent) {
              const myClassStudents = studentsList.filter((s) =>
                isMatchingClass(s.Class, currentTeacher.ClassAssigned)
              );
              if (myClassStudents.length > 0) {
                setSelectedStudent(myClassStudents[0]);
              }
            }
            setCurrentView(view);
          }}
          hasSelectedStudent={
            selectedStudent !== null ||
            studentsList.some((s) => isMatchingClass(s.Class, currentTeacher.ClassAssigned))
          }
          onLogout={handleLogout}
          onOpenSheetGuide={() => setIsSetupModalOpen(true)}
          onRefreshData={refreshAllData}
          isLoading={isLoading}
          isLiveSheet={isLiveSheet}
          onOpenSubjectManager={() => setIsSubjectManagerOpen(true)}
          onSwitchClass={handleSwitchClass}
          classesList={classesList}
        />
      )}

      {/* Main Content Area */}
      <main
        className={`flex-1 w-full ${
          !currentTeacher && !currentStudent && publicMode === 'home'
            ? 'p-0'
            : 'max-w-7xl mx-auto p-2.5 sm:p-6 lg:p-8 ' + (currentTeacher ? 'pb-24 md:pb-8' : 'pb-8')
        }`}
      >
        {/* Error notification banner if any */}
        {errorMessage && (
          <div className="mb-5 bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 rounded-lg text-xs flex flex-wrap items-center justify-between gap-3 shadow-2xs no-print mx-auto max-w-7xl">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => refreshAllData()}
                className="text-xs font-bold px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-950 rounded-md cursor-pointer transition-colors"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-xs text-amber-800 hover:text-amber-950 font-medium cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <ErrorBoundary
          fallbackTitle="Something went wrong"
          fallbackMessage="An unexpected error occurred. Please refresh or return to the main portal."
        >
          {/* 1. STUDENT AUTHENTICATED DASHBOARD */}
          {currentStudent ? (
            <StudentDashboard
              currentStudent={currentStudent}
              studentsList={studentsList}
              teachersList={teachersList}
              subjectsList={subjectsList}
              allScores={allScores}
              allSummaries={allSummaries}
              publishedRecords={publishedRecords}
              isClassResultPublished={isClassPublished}
              onLogout={handleLogout}
              onRefreshData={refreshAllData}
              websiteConfig={websiteConfig}
            />
          ) : !currentTeacher ? (
            /* 2. PUBLIC VIEW (Unauthenticated User: School Homepage, Student Result Portal OR Login Form) */
            publicMode === 'home' ? (
              <SchoolHomepage
                students={studentsList}
                allScores={allScores}
                allSummaries={allSummaries}
                subjectsList={subjectsList}
                publishedRecords={publishedRecords}
                isClassResultPublished={isClassPublished}
                websiteConfig={websiteConfig}
                onUpdateWebsiteConfig={handleSaveWebsiteConfig}
                onOpenStaffLogin={() => setPublicMode('staff_login')}
                onOpenStudentLogin={() => setPublicMode('student_login')}
                onStudentLogin={handleStudentLoginSuccess}
                onOpenAdminSetup={() => setIsSetupModalOpen(true)}
              />
            ) : publicMode === 'portal' ? (
              <StudentResultPortal
                students={studentsList}
                allScores={allScores}
                allSummaries={allSummaries}
                subjectsList={subjectsList}
                publishedRecords={publishedRecords}
                isClassResultPublished={isClassPublished}
                websiteConfig={websiteConfig}
                onOpenStaffLogin={() => setPublicMode('staff_login')}
                onOpenStudentLogin={() => setPublicMode('student_login')}
                onOpenAdminSetup={() => setIsSetupModalOpen(true)}
                onRefreshData={refreshAllData}
                onBackToHome={() => setPublicMode('home')}
                isLiveSheet={isLiveSheet}
                isLoading={isLoading}
              />
            ) : (
              <LoginScreen
                teachers={teachersList}
                students={studentsList}
                onLogin={handleTeacherLoginSuccess}
                onStudentLogin={handleStudentLoginSuccess}
                onOpenSetup={() => setIsSetupModalOpen(true)}
                isLive={isLiveSheet}
                isLoading={isLoading}
                onBackToStudentPortal={() => setPublicMode('home')}
                initialTab={publicMode === 'student_login' ? 'student' : 'staff'}
                websiteConfig={websiteConfig}
              />
            )
          ) : (
            /* 3. AUTHENTICATED STAFF OR ADMIN DASHBOARD */
            <>
              {/* View 0: Admin Comprehensive Dashboard (Only accessible if isAdminUser is true) */}
              {currentView === 'admin' && isAdminUser && (
                <AdminDashboard
                  currentTeacher={currentTeacher}
                  teachersList={teachersList}
                  studentsList={studentsList}
                  subjectsList={subjectsList}
                  allScores={allScores}
                  allSummaries={allSummaries}
                  publishedRecords={publishedRecords}
                  classesList={classesList}
                  classRecords={classRecords}
                  session={session}
                  term={term}
                  websiteConfig={websiteConfig}
                  onSaveWebsiteConfig={async (newCfg) => {
                    await FirebaseService.saveWebsiteConfig(newCfg);
                    setWebsiteConfig(newCfg);
                  }}
                  onSessionChange={setSession}
                  onTermChange={setTerm}
                  onInspectClass={(cls) => {
                    handleSwitchClass(cls);
                    setCurrentView('roster');
                  }}
                  onRefreshData={refreshAllData}
                  onUpdateCurrentTeacher={handleUpdateCurrentTeacher}
                  isLive={isLiveSheet}
                  isLoading={isLoading}
                  onOpenSubjectManager={() => setIsSubjectManagerOpen(true)}
                />
              )}

              {/* View 1: Simple & Intuitive Teacher Dashboard */}
              {currentView === 'roster' && (
                <TeacherDashboard
                  currentTeacher={currentTeacher}
                  students={studentsList}
                  allScores={allScores}
                  subjectsList={subjectsList}
                  allSummaries={allSummaries}
                  publishedRecords={publishedRecords}
                  session={session}
                  term={term}
                  onSessionChange={setSession}
                  onTermChange={setTerm}
                  onRefreshData={refreshAllData}
                  onAddStudent={handleAddStudent}
                  onDeleteStudent={handleDeleteStudent}
                  onUpdateTeacher={handleUpdateCurrentTeacher}
                  isLoading={isLoading}
                  onOpenSubjectManager={() => setIsSubjectManagerOpen(true)}
                  onEditingChange={handleEditingChange}
                  onTogglePublish={handleTogglePublish}
                />
              )}

              {/* View 2: Report Card Score Entry (Easy single sheet score entry) */}
              {currentView === 'entry' && (
                selectedStudent ? (
                  <ReportCardEntry
                    student={selectedStudent}
                    allClassStudents={classStudents}
                    session={session}
                    term={term}
                    subjectsList={subjectsList}
                    allScores={allScores}
                    allSummaries={allSummaries}
                    onSaveScores={handleUpdateStudentScores}
                    onDeleteReportCard={handleDeleteReportCard}
                    onBackToRoster={() => {
                      setSelectedStudent(null);
                      setCurrentView('roster');
                      refreshAllData();
                    }}
                    onNavigateToStudent={(next) => {
                      setSelectedStudent(next);
                      refreshAllData();
                    }}
                    onSaveSuccess={() => {
                      refreshAllData();
                    }}
                    onOpenSubjectManager={() => setIsSubjectManagerOpen(true)}
                    onEditingChange={handleEditingChange}
                  />
                ) : (
                  <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center max-w-md mx-auto my-12 space-y-4 shadow-sm">
                    <div className="w-14 h-14 bg-amber-100 text-amber-800 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                      <AlertTriangle className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">No Pupil Selected</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Please choose a pupil from your class roster to view or record their continuous assessment and terminal examination scores.
                    </p>
                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                      {classStudents.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedStudent(classStudents[0])}
                          className="w-full sm:w-auto px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-xs"
                        >
                          Select {classStudents[0].FullName}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setCurrentView('roster')}
                        className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-xs"
                      >
                        Return to Class Roster
                      </button>
                    </div>
                  </div>
                )
              )}

              {/* View 3: Class Summary Broadsheet & Rankings */}
              {currentView === 'summary' && (
                <ClassSummary
                  currentTeacher={currentTeacher}
                  students={studentsList}
                  allScores={allScores}
                  session={session}
                  term={term}
                  subjectsList={subjectsList}
                  websiteConfig={websiteConfig}
                  onBackToRoster={() => setCurrentView('roster')}
                  onSelectStudent={(student) => {
                    setSelectedStudent(student);
                    setCurrentView('entry');
                  }}
                  isPublished={isCurrentClassPublished}
                  onTogglePublish={handleTogglePublish}
                />
              )}

              {/* View 4: Public School Website with Admin Live Editor Controls */}
              {currentView === 'website' && (
                <SchoolHomepage
                  students={studentsList}
                  allScores={allScores}
                  allSummaries={allSummaries}
                  subjectsList={subjectsList}
                  publishedRecords={publishedRecords}
                  isClassResultPublished={isClassPublished}
                  websiteConfig={websiteConfig}
                  currentUser={{
                    role: currentTeacher.Role,
                    name: currentTeacher.FullName,
                    username: currentTeacher.Username
                  }}
                  isAdminLoggedIn={
                    currentTeacher.Role === 'admin' ||
                    currentTeacher.Username?.toLowerCase() === 'admin'
                  }
                  onNavigateToAdmin={() => setCurrentView('admin')}
                  onUpdateWebsiteConfig={async (newCfg) => {
                    await FirebaseService.saveWebsiteConfig(newCfg);
                    setWebsiteConfig(newCfg);
                  }}
                  onOpenStaffLogin={() => setCurrentView('admin')}
                  onOpenStudentLogin={() => {}}
                  onOpenAdminSetup={() => setIsSetupModalOpen(true)}
                />
              )}
            </>
          )}
        </ErrorBoundary>
      </main>

      {/* Curriculum Subject Manager Modal */}
      <SubjectManagerModal
        isOpen={isSubjectManagerOpen}
        onClose={() => setIsSubjectManagerOpen(false)}
        subjectsList={subjectsList}
        onRefreshData={refreshAllData}
        initialClass={currentTeacher?.ClassAssigned || 'Primary 1'}
      />

      {/* Google Sheet & Firebase Setup Modal */}
      <SheetSetupModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
        onRefreshData={refreshAllData}
        isLive={isLiveSheet}
      />
    </div>
  );
}
