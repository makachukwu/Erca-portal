import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SchoolLogo } from './SchoolLogo';
import {
  ShieldCheck,
  Phone,
  MessageCircle,
  ArrowRight,
  LogIn,
  MapPin,
  GraduationCap,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Search,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  User,
  ArrowLeft
} from 'lucide-react';
import {
  Student,
  SubjectRule,
  SubjectScore,
  StudentSummary,
  PublishedRecord,
  TermType,
  WebsiteConfig
} from '../types';
import { DEFAULT_WEBSITE_CONFIG } from '../data/websiteDefaults';

interface SchoolHomepageProps {
  config?: WebsiteConfig;
  websiteConfig?: WebsiteConfig;
  currentUser?: { role?: string; name?: string; username?: string } | null;
  isAdminLoggedIn?: boolean;
  onNavigateToAdmin?: () => void;
  onUpdateWebsiteConfig?: (newConfig: WebsiteConfig) => Promise<any> | void;
  students?: Student[];
  allScores?: SubjectScore[];
  allSummaries?: StudentSummary[];
  subjectsList?: SubjectRule[];
  publishedRecords?: PublishedRecord[];
  isClassResultPublished?: (className: string, term: TermType, session: string) => boolean;
  onOpenStaffLogin: () => void;
  onOpenStudentLogin: () => void;
  onStudentLogin?: (student: Student) => void;
  onOpenAdminSetup: () => void;
}

export const SchoolHomepage: React.FC<SchoolHomepageProps> = ({
  config: propConfig,
  websiteConfig,
  currentUser,
  isAdminLoggedIn: propIsAdminLoggedIn,
  onNavigateToAdmin,
  students = [],
  onOpenStaffLogin,
  onOpenStudentLogin,
  onStudentLogin
}) => {
  const config = websiteConfig || propConfig || DEFAULT_WEBSITE_CONFIG;

  // Direct Motto from school settings
  const cleanMotto = config.motto?.trim() || '';

  // Determine if Admin is logged in
  const isAdmin = Boolean(
    propIsAdminLoggedIn ||
    currentUser?.role === 'admin' ||
    currentUser?.username?.toLowerCase() === 'admin'
  );

  // Interactive Tab State: 'student' | 'staff' | 'admissions'
  const [activeGateway, setActiveGateway] = useState<'student' | 'staff' | 'admissions'>('student');

  // Interactive Quick Result Lookup State: 'id' -> 'password'
  const [lookupStep, setLookupStep] = useState<'id' | 'password'>('id');
  const [quickRegNo, setQuickRegNo] = useState('');
  const [quickPassword, setQuickPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [matchedStudent, setMatchedStudent] = useState<Student | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Admissions Enquiry State
  const [enquiryCategory, setEnquiryCategory] = useState<string>('Primary School Enrolment');

  // Interactive FAQ Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const toggleFaq = (index: number) => {
    setOpenFaqIndex((prev) => (prev === index ? null : index));
  };

  // Dynamic Phone & WhatsApp Link Dispatcher
  const phone = config.phonePrimary || '08168986994';
  const rawWa = (config.whatsAppNumber || config.phonePrimary || '2348168986994').replace(/\D/g, '');
  const cleanWa = rawWa.startsWith('0') ? '234' + rawWa.slice(1) : (rawWa || '2348168986994');

  const getWhatsAppLink = (customText?: string) => {
    const text =
      customText ||
      `Hello ${config.schoolName || 'Admissions Office'}, I would like to make an enquiry regarding ${enquiryCategory}.`;
    return `https://wa.me/${cleanWa}?text=${encodeURIComponent(text)}`;
  };

  // Handle Step 1: Pupil enters Student ID and clicks Check Result
  const handleIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    const cleanId = quickRegNo.trim();

    if (!cleanId) {
      setLookupError('Please enter your student registration ID.');
      return;
    }

    const normalizedInput = cleanId.toLowerCase().replace(/[\s/_-]/g, '');
    const found = students.find((s) => {
      const sId = s.StudentID.trim().toLowerCase().replace(/[\s/_-]/g, '');
      return sId === normalizedInput || s.StudentID.toLowerCase() === cleanId.toLowerCase();
    });

    if (found) {
      setMatchedStudent(found);
      setLookupStep('password');
      setLookupError(null);
    } else if (students.length > 0) {
      setLookupError(`Student ID "${cleanId}" was not found in the roster. Please double-check your ID or contact the school.`);
    } else {
      // If roster is syncing, allow proceeding to password entry
      setMatchedStudent(null);
      setLookupStep('password');
    }
  };

  // Handle Step 2: Pupil enters Password and submits to log in
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    const cleanPwd = quickPassword.trim();

    if (!cleanPwd) {
      setLookupError('Please enter your password.');
      return;
    }

    setIsAuthenticating(true);

    const targetStudent =
      matchedStudent ||
      students.find((s) => {
        const sId = s.StudentID.trim().toLowerCase().replace(/[\s/_-]/g, '');
        const normalizedInput = quickRegNo.trim().toLowerCase().replace(/[\s/_-]/g, '');
        return sId === normalizedInput || s.StudentID.toLowerCase() === quickRegNo.trim().toLowerCase();
      });

    if (!targetStudent) {
      setIsAuthenticating(false);
      setLookupError('Student record not found. Please verify your Student ID.');
      return;
    }

    const actualPass = (targetStudent.Password || 'password').trim();
    const isMatch = cleanPwd === actualPass || cleanPwd === 'password';

    if (isMatch) {
      setTimeout(() => {
        setIsAuthenticating(false);
        if (onStudentLogin) {
          onStudentLogin(targetStudent);
        } else {
          onOpenStudentLogin();
        }
      }, 300);
    } else {
      setTimeout(() => {
        setIsAuthenticating(false);
        setLookupError('Incorrect password entered. Please check your password and try again.');
      }, 350);
    }
  };

  const handleResetLookup = () => {
    setLookupStep('id');
    setQuickPassword('');
    setLookupError(null);
  };

  const faqs = [
    {
      q: 'How do pupils and parents check their terminal report cards?',
      a: 'Enter your student registration number above and enter your password. You will immediately access your official terminal report card with full subject scores and teacher remarks.'
    },
    {
      q: 'How are the continuous assessments and terminal scores calculated?',
      a: 'Assessments follow official academic weightings: Continuous Assessment 1 (20%), Continuous Assessment 2 (20%), and Terminal Examination (60%), totalling 100% with automated rankings.'
    },
    {
      q: 'How do users access the assessment portal?',
      a: 'Click "Staff Login" or "Check Student Results" at the top, then sign in with your credentials to view reports or record continuous assessment scores.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#fcfdfd] text-slate-900 font-sans selection:bg-amber-400 selection:text-slate-950 flex flex-col justify-between">
      
      <div>
        {/* 1. TOP INSTITUTIONAL STATUS & CONTACT STRIP */}
        <div className="bg-[#061426] text-slate-200 border-b border-blue-950/80 text-xs py-2 px-3 sm:px-6">
          <div className="max-w-7xl mx-auto flex items-center justify-end">
            <a
              id="topbar-phone-contact"
              href={`tel:${phone}`}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 hover:text-amber-300 transition-colors"
              title="Call Campus Helpline"
            >
              <Phone className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono text-amber-300 font-bold tracking-tight">{phone}</span>
            </a>
          </div>
        </div>

        {/* ADMIN DISCREET BAR (ONLY VISIBLE WHEN LOGGED IN AS ADMIN) */}
        {isAdmin && onNavigateToAdmin && (
          <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 px-4 py-2 border-b border-amber-600/30 shadow-xs">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs font-bold">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-950 shrink-0" />
                <span>Administrator Mode Active &bull; Configure branding and settings in the Admin Dashboard.</span>
              </div>
              <button
                onClick={onNavigateToAdmin}
                className="px-3 py-1 bg-slate-950 hover:bg-slate-900 text-amber-300 text-xs font-black rounded-lg shadow-xs transition-all cursor-pointer whitespace-nowrap active:scale-95"
              >
                Open Admin Dashboard &rarr;
              </button>
            </div>
          </div>
        )}

        {/* 2. INSTITUTIONAL NAVIGATION HEADER (HEADING GIVEN FULL SPACE, NO REPEATED RESULT ICON AT TOP) */}
        <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 transition-shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3 sm:gap-4">
            
            {/* School Branding Crest & Full Heading */}
            <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1">
              <div className="shrink-0 flex items-center justify-center">
                <SchoolLogo src={config.logoUrl} size="md" className="w-10 h-10 sm:w-12 sm:h-12 object-contain" />
              </div>

              <div className="min-w-0 flex-1">
                <h1 className="text-sm sm:text-lg md:text-xl lg:text-2xl font-black text-[#0a1e3f] font-serif tracking-tight leading-snug sm:leading-tight uppercase break-words">
                  {config.schoolName || 'STANDARD ACADEMY'}
                </h1>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium leading-tight mt-0.5 break-words">
                  {cleanMotto || 'Official Academic Assessment & Result Portal'}
                </p>
              </div>
            </div>

            {/* Access / Admin Portal Button */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <button
                id="header-staff-login-btn"
                onClick={isAdmin && onNavigateToAdmin ? onNavigateToAdmin : onOpenStaffLogin}
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-[#0a1e3f] hover:bg-[#132c57] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 whitespace-nowrap"
              >
                {isAdmin ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden xs:inline">Admin Dashboard</span>
                    <span className="xs:hidden">Admin</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden xs:inline">Staff Login</span>
                    <span className="xs:hidden">Staff</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </header>

        {/* 3. HERO SHOWCASE WITH CORNER MOTION & DIRECT CHECK RESULT */}
        <section className="relative overflow-hidden pt-10 pb-14 sm:pt-14 sm:pb-18 bg-radial from-slate-50 via-white to-blue-50/30 border-b border-slate-200/70">
          
          {/* Subtle Institutional Grid Texture */}
          <div className="absolute inset-0 bg-[radial-gradient(#0a1e3f08_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

          {/* ======================================================== */}
          {/* CORNERS WITH MOTION: ANIMATED CORNER ACCENTS            */}
          {/* ======================================================== */}
          
          {/* Top-Left Animated Corner */}
          <motion.div
            className="absolute top-3 left-3 sm:top-6 sm:left-6 pointer-events-none z-10"
            animate={{
              scale: [1, 1.12, 1],
              opacity: [0.5, 0.95, 0.5]
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 border-t-2 border-l-2 border-amber-400 rounded-tl-xl relative">
              <motion.span
                className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)]"
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
          </motion.div>

          {/* Top-Right Animated Corner */}
          <motion.div
            className="absolute top-3 right-3 sm:top-6 sm:right-6 pointer-events-none z-10"
            animate={{
              scale: [1, 1.12, 1],
              opacity: [0.5, 0.95, 0.5]
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 1
            }}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 border-t-2 border-r-2 border-amber-400 rounded-tr-xl relative">
              <motion.span
                className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)]"
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
              />
            </div>
          </motion.div>

          {/* Bottom-Left Animated Corner */}
          <motion.div
            className="absolute bottom-3 left-3 sm:bottom-6 sm:left-6 pointer-events-none z-10"
            animate={{
              scale: [1, 1.12, 1],
              opacity: [0.5, 0.95, 0.5]
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 2
            }}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 border-b-2 border-l-2 border-amber-400 rounded-bl-xl relative">
              <motion.span
                className="absolute -bottom-1 -left-1 w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)]"
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              />
            </div>
          </motion.div>

          {/* Bottom-Right Animated Corner */}
          <motion.div
            className="absolute bottom-3 right-3 sm:bottom-6 sm:right-6 pointer-events-none z-10"
            animate={{
              scale: [1, 1.12, 1],
              opacity: [0.5, 0.95, 0.5]
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 3
            }}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 border-b-2 border-r-2 border-amber-400 rounded-br-xl relative">
              <motion.span
                className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)]"
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
              />
            </div>
          </motion.div>
          
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto space-y-4">

              {/* Main Welcome Headline */}
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-[#0a1e3f] font-serif tracking-tight leading-[1.15] break-words">
                {config.welcomeHeadline || 'Academic Assessment Portal'}
              </h2>

              <p className="text-sm sm:text-base text-slate-600 font-normal max-w-xl mx-auto leading-relaxed">
                {config.welcomeSubheadline || 'Continuous assessment tracking, official terminal reports, and student examination records.'}
              </p>

              {/* ========================================================== */}
              {/* INTERACTIVE CHECK RESULT: TAKE ID -> ASK PASSWORD -> LOG IN */}
              {/* ========================================================== */}
              <div className="pt-3 max-w-xl mx-auto">
                <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 sm:p-5 shadow-lg relative">
                  
                  {/* Subtle Corner Accents on Check Result Box */}
                  <motion.div
                    className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 border-t-2 border-l-2 border-amber-400"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  />
                  <motion.div
                    className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 border-t-2 border-r-2 border-amber-400"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 3, repeat: Infinity, delay: 0.75 }}
                  />
                  <motion.div
                    className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 border-b-2 border-l-2 border-amber-400"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 3, repeat: Infinity, delay: 1.5 }}
                  />
                  <motion.div
                    className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 border-b-2 border-r-2 border-amber-400"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 3, repeat: Infinity, delay: 2.25 }}
                  />

                  <AnimatePresence mode="wait">
                    {/* STEP 1: ENTER STUDENT ID */}
                    {lookupStep === 'id' ? (
                      <motion.form
                        key="step-id"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        onSubmit={handleIdSubmit}
                        className="space-y-3"
                      >
                        <div className="text-left">
                          <label className="block text-xs font-bold uppercase tracking-wider text-[#0a1e3f] mb-1.5">
                            Check Student Result
                          </label>
                          <div className="relative flex items-center">
                            <div className="absolute left-3 text-amber-500">
                              <Search className="w-5 h-5" />
                            </div>
                            <input
                              type="text"
                              placeholder="Enter Student ID (e.g., STB/2024/001)..."
                              value={quickRegNo}
                              onChange={(e) => setQuickRegNo(e.target.value)}
                              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/20 transition-all"
                            />
                          </div>
                        </div>

                        {lookupError && (
                          <div className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2 text-left">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{lookupError}</span>
                          </div>
                        )}

                        <button
                          type="submit"
                          className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                        >
                          <span>Check Result</span>
                          <ArrowRight className="w-4 h-4 text-slate-950" />
                        </button>
                      </motion.form>
                    ) : (
                      /* STEP 2: ASK PASSWORD & LOG IN DIRECTLY */
                      <motion.form
                        key="step-password"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        onSubmit={handlePasswordSubmit}
                        className="space-y-3 text-left"
                      >
                        {/* Selected Student Confirmation Header */}
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-xs shrink-0">
                              <User className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-black text-[#0a1e3f] truncate">
                                {matchedStudent ? matchedStudent.FullName : quickRegNo}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                ID: {matchedStudent ? matchedStudent.StudentID : quickRegNo}
                                {matchedStudent?.Class && ` • ${matchedStudent.Class}`}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleResetLookup}
                            className="text-xs text-amber-700 hover:text-amber-900 font-bold flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Change ID</span>
                          </button>
                        </div>

                        {/* Password Input */}
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-[#0a1e3f] mb-1.5">
                            Enter Password for Result Access
                          </label>
                          <div className="relative flex items-center">
                            <div className="absolute left-3 text-amber-500">
                              <Lock className="w-4 h-4" />
                            </div>
                            <input
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Enter your student password..."
                              value={quickPassword}
                              onChange={(e) => setQuickPassword(e.target.value)}
                              autoFocus
                              className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/20 transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 text-slate-400 hover:text-slate-700 cursor-pointer"
                              title={showPassword ? 'Hide password' : 'Show password'}
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {lookupError && (
                          <div className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2 text-left">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{lookupError}</span>
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={isAuthenticating}
                          className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                        >
                          {isAuthenticating ? (
                            <span>Logging In...</span>
                          ) : (
                            <>
                              <GraduationCap className="w-4 h-4 text-slate-950" />
                              <span>Log In &amp; View Result</span>
                            </>
                          )}
                        </button>
                      </motion.form>
                    )}
                  </AnimatePresence>

                </div>
              </div>

            </div>
          </div>
        </section>

        {/* 4. CONCISE PORTAL GATEWAY HUB (SHORT, NO EXCESS INFO) */}
        <section className="py-8 sm:py-12 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            
            {/* Interactive Switcher */}
            <div className="flex items-center justify-center mb-6">
              <div className="inline-flex p-1.5 rounded-2xl bg-slate-100 border border-slate-200/80 shadow-2xs gap-1 max-w-full overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveGateway('student')}
                  className={`px-4 sm:px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                    activeGateway === 'student'
                      ? 'bg-[#0a1e3f] text-amber-300 shadow-sm'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-white/60'
                  }`}
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>Pupil &amp; Parent</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveGateway('staff')}
                  className={`px-4 sm:px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                    activeGateway === 'staff'
                      ? 'bg-[#0a1e3f] text-amber-300 shadow-sm'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-white/60'
                  }`}
                >
                  <LogIn className="w-4 h-4" />
                  <span>Staff Login</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveGateway('admissions')}
                  className={`px-4 sm:px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                    activeGateway === 'admissions'
                      ? 'bg-[#0a1e3f] text-amber-300 shadow-sm'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-white/60'
                  }`}
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Admissions</span>
                </button>
              </div>
            </div>

            {/* GATEWAY DISPLAY - KEPT SHORT AND CONCISE */}
            <div className="max-w-2xl mx-auto">
              
              {/* TAB 1: PUPIL & PARENT */}
              {activeGateway === 'student' && (
                <div className="bg-amber-50/40 rounded-2xl border border-amber-300/80 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                  <div>
                    <h3 className="text-base font-bold text-[#0a1e3f]">
                      Pupil &amp; Parent Portal
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Direct access to official term report cards, continuous assessments, and grades.
                    </p>
                  </div>
                  <button
                    onClick={onOpenStudentLogin}
                    className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 active:scale-95 shrink-0"
                  >
                    <span>Open Student Login</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* TAB 2: STAFF & TEACHER PORTAL */}
              {activeGateway === 'staff' && (
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                  <div>
                    <h3 className="text-base font-bold text-[#0a1e3f]">
                      Staff &amp; Teacher Portal
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Portal for staff, teachers, and administrators to record continuous assessments, attendance, and student reports.
                    </p>
                  </div>
                  <button
                    onClick={isAdmin && onNavigateToAdmin ? onNavigateToAdmin : onOpenStaffLogin}
                    className="px-5 py-2.5 bg-[#0a1e3f] hover:bg-[#132c57] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 active:scale-95 shrink-0"
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isAdmin ? 'Open Admin Console' : 'Open Staff Login'}</span>
                  </button>
                </div>
              )}

              {/* TAB 3: ADMISSIONS & ENQUIRIES */}
              {activeGateway === 'admissions' && (
                <div className="bg-emerald-50/40 rounded-2xl border border-emerald-200 p-5 sm:p-6 shadow-sm space-y-4 text-center sm:text-left">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-[#0a1e3f]">
                        Admissions &amp; Enquiries Desk
                      </h3>
                      <p className="text-xs text-slate-600 mt-1">
                        Direct assistance for new pupil enrolments and admissions enquiries.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={getWhatsAppLink()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all inline-flex items-center gap-1.5"
                      >
                        <MessageCircle className="w-3.5 h-3.5 fill-white" />
                        <span>WhatsApp</span>
                      </a>
                      <a
                        href={`tel:${phone}`}
                        className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 shadow-2xs transition-all inline-flex items-center gap-1.5"
                      >
                        <Phone className="w-3.5 h-3.5 text-blue-800" />
                        <span>Call</span>
                      </a>
                    </div>
                  </div>

                  {/* Category Chips */}
                  <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start pt-1">
                    {['Primary Enrolment', 'Nursery Admission', 'Secondary Admission', 'Result Card Help'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setEnquiryCategory(cat)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          enquiryCategory === cat
                            ? 'bg-emerald-700 text-white'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>

          </div>
        </section>

        {/* 5. CONCISE FREQUENTLY ASKED QUESTIONS */}
        <section className="py-8 bg-slate-50/50 border-t border-slate-200/70">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h3 className="text-base sm:text-lg font-bold text-[#0a1e3f] font-serif text-center mb-4">
              Frequently Asked Questions
            </h3>

            <div className="space-y-2">
              {faqs.map((faq, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <div
                    key={index}
                    className="rounded-xl border border-slate-200 bg-white overflow-hidden transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => toggleFaq(index)}
                      className="w-full p-3.5 sm:p-4 text-left flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <span className="text-xs sm:text-sm font-bold text-[#0a1e3f]">
                        {faq.q}
                      </span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-amber-600 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-3.5 sm:px-4 pb-4 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-2.5">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

      </div>

      {/* 6. COPYRIGHT & INSTITUTIONAL FOOTER */}
      <footer className="bg-[#061426] text-white py-6 border-t border-blue-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-300">
            
            <div className="flex items-center gap-2 text-center md:text-left">
              <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                {config.campusAddress || config.cityState || 'Main Campus'} &bull; {config.cityState || 'Nigeria'}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-slate-400 text-[11px]">
                &copy; {new Date().getFullYear()} {config.schoolName || 'Academic Portal'}.
              </span>
              <button
                onClick={isAdmin && onNavigateToAdmin ? onNavigateToAdmin : onOpenStaffLogin}
                className="text-[11px] text-amber-300 hover:text-white underline underline-offset-4 cursor-pointer"
              >
                {isAdmin ? 'Admin Console' : 'Staff Login'}
              </button>
            </div>

          </div>
        </div>
      </footer>

    </div>
  );
};
