/**
 * Firebase Firestore Service
 * School Management Portal
 * Direct Real-Time Communication with Firebase Firestore
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  onSnapshot,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { safeStorage } from '../utils/safeStorage';
import {
  Student,
  SubjectRule,
  SubjectScore,
  StudentSummary,
  Teacher,
  TermType,
  PublishedRecord,
  ClassRecord,
  ClassCategory,
  GradingScaleItem,
  AffectiveRatings,
  PsychomotorRatings,
  DailyAttendanceRecord,
  AttendanceEntry,
  StudentAttendanceTally,
  RolloverStudentDecision,
  RolloverHistoryRecord,
  WebsiteConfig,
  FacilityItem
} from '../types';
import { DEFAULT_WEBSITE_CONFIG } from '../data/websiteDefaults';
import { saveSchoolBrandingLocally } from '../config/schoolConfig';
import {
  DEFAULT_KG_SUBJECTS,
  DEFAULT_NURSERY_SUBJECTS,
  DEFAULT_LOWER_PRIMARY_SUBJECTS,
  DEFAULT_UPPER_PRIMARY_SUBJECTS,
  DEFAULT_JSS_SUBJECTS,
  DEFAULT_SS_SUBJECTS,
  DEFAULT_CURRENT_SESSION,
  DEFAULT_CURRENT_TERM,
  DEFAULT_GENERAL_GRADING_SCALE,
  DEFAULT_SECONDARY_WAEC_SCALE,
  DEFAULT_EARLY_YEARS_SCALE,
  setActiveGradingScales,
  getActiveGradingScales,
  isMatchingClass,
  normalizeClassIdentifier
} from '../utils/grading';

const LIVE_DATA_CACHE_KEY = 'school_portal_firebase_cache';
const WEBSITE_CACHE_KEY = 'school_portal_website_cache';

export function detectClassCategory(className: string): ClassCategory {
  const c = className.trim().toUpperCase();
  if (c.startsWith('KG') || c.includes('KINDERGARTEN') || c.includes('PLAYGROUP') || c.includes('CRECHE')) return 'KG';
  if (c.startsWith('NURSERY') || c.startsWith('NUR')) return 'Nursery';
  if (c.startsWith('PRIMARY') || c.startsWith('BASIC') || c.startsWith('GRADE')) return 'Primary';
  if (c.startsWith('JSS') || c.startsWith('J.S.S') || c.includes('JUNIOR')) return 'Junior Secondary';
  if (c.startsWith('SS') || c.startsWith('S.S') || c.includes('SENIOR')) return 'Senior Secondary';
  return 'Other';
}

export const INITIAL_DEFAULT_CLASSES: ClassRecord[] = [
  { id: 'class_kg_1', name: 'KG 1', category: 'KG', order: 1 },
  { id: 'class_kg_2', name: 'KG 2', category: 'KG', order: 2 },
  { id: 'class_nursery_1', name: 'Nursery 1', category: 'Nursery', order: 3 },
  { id: 'class_nursery_2', name: 'Nursery 2', category: 'Nursery', order: 4 },
  { id: 'class_primary_1', name: 'Primary 1', category: 'Primary', order: 5 },
  { id: 'class_primary_2', name: 'Primary 2', category: 'Primary', order: 6 },
  { id: 'class_primary_3', name: 'Primary 3', category: 'Primary', order: 7 },
  { id: 'class_primary_4', name: 'Primary 4', category: 'Primary', order: 8 },
  { id: 'class_primary_5', name: 'Primary 5', category: 'Primary', order: 9 },
  { id: 'class_primary_6', name: 'Primary 6', category: 'Primary', order: 10 },
  { id: 'class_jss_1', name: 'JSS 1', category: 'Junior Secondary', order: 11 },
  { id: 'class_jss_2', name: 'JSS 2', category: 'Junior Secondary', order: 12 },
  { id: 'class_jss_3', name: 'JSS 3', category: 'Junior Secondary', order: 13 },
  { id: 'class_ss_1', name: 'SS 1', category: 'Senior Secondary', order: 14 },
  { id: 'class_ss_2', name: 'SS 2', category: 'Senior Secondary', order: 15 },
  { id: 'class_ss_3', name: 'SS 3', category: 'Senior Secondary', order: 16 }
];

// Mutable exported array synchronized with Firestore
export let ALL_SCHOOL_CLASSES: string[] = INITIAL_DEFAULT_CLASSES.map((c) => c.name);

export function getSchoolClasses(): string[] {
  return ALL_SCHOOL_CLASSES;
}


export const INITIAL_DEFAULT_TEACHERS: Teacher[] = [
  {
    Username: 'admin',
    Password: 'admin',
    ClassAssigned: 'Admin',
    FullName: 'Portal Administrator',
    Role: 'admin'
  },
  {
    Username: 'teacher_kg1',
    Password: 'password123',
    ClassAssigned: 'KG 1',
    FullName: 'Mrs. Joy Ali',
    Role: 'teacher'
  },
  {
    Username: 'teacher_kg2',
    Password: 'password123',
    ClassAssigned: 'KG 2',
    FullName: 'Mrs. Deborah Attah',
    Role: 'teacher'
  },
  {
    Username: 'teacher_nur1',
    Password: 'password123',
    ClassAssigned: 'Nursery 1',
    FullName: 'Mrs. Grace Adebayo',
    Role: 'teacher'
  },
  {
    Username: 'teacher_nur2',
    Password: 'password123',
    ClassAssigned: 'Nursery 2',
    FullName: 'Mrs. Comfort Daniel',
    Role: 'teacher'
  },
  {
    Username: 'teacher_p1',
    Password: 'password123',
    ClassAssigned: 'Primary 1',
    FullName: 'Mr. Paul Ibrahim',
    Role: 'teacher'
  },
  {
    Username: 'teacher_p2',
    Password: 'password123',
    ClassAssigned: 'Primary 2',
    FullName: 'Mrs. Mary Oche',
    Role: 'teacher'
  },
  {
    Username: 'teacher_p3',
    Password: 'password123',
    ClassAssigned: 'Primary 3',
    FullName: 'Mr. David Okolo',
    Role: 'teacher'
  },
  {
    Username: 'teacher_p4',
    Password: 'password123',
    ClassAssigned: 'Primary 4',
    FullName: 'Mr. Emmanuel Solomon',
    Role: 'teacher'
  },
  {
    Username: 'teacher_p5',
    Password: 'password123',
    ClassAssigned: 'Primary 5',
    FullName: 'Mrs. Esther Audu',
    Role: 'teacher'
  },
  {
    Username: 'teacher_p6',
    Password: 'password123',
    ClassAssigned: 'Primary 6',
    FullName: 'Mr. Samuel Ochigbo',
    Role: 'teacher'
  },
  {
    Username: 'teacher_jss1',
    Password: 'password123',
    ClassAssigned: 'JSS 1',
    FullName: 'Mr. Gabriel Musa',
    Role: 'teacher'
  },
  {
    Username: 'teacher_jss2',
    Password: 'password123',
    ClassAssigned: 'JSS 2',
    FullName: 'Mrs. Ruth Sunday',
    Role: 'teacher'
  },
  {
    Username: 'teacher_jss3',
    Password: 'password123',
    ClassAssigned: 'JSS 3',
    FullName: 'Mr. Timothy Usman',
    Role: 'teacher'
  },
  {
    Username: 'teacher_ss1',
    Password: 'password123',
    ClassAssigned: 'SS 1',
    FullName: 'Mr. Philip Abah',
    Role: 'teacher'
  },
  {
    Username: 'teacher_ss2',
    Password: 'password123',
    ClassAssigned: 'SS 2',
    FullName: 'Mrs. Martha Daniel',
    Role: 'teacher'
  },
  {
    Username: 'teacher_ss3',
    Password: 'password123',
    ClassAssigned: 'SS 3',
    FullName: 'Mr. Joseph Onoja',
    Role: 'teacher'
  }
];

export const INITIAL_DEFAULT_SUBJECTS: SubjectRule[] = [
  ...DEFAULT_KG_SUBJECTS.map((name) => ({ Level: 'Kindergarten' as const, SubjectName: name })),
  ...DEFAULT_NURSERY_SUBJECTS.map((name) => ({ Level: 'Nursery' as const, SubjectName: name })),
  ...DEFAULT_LOWER_PRIMARY_SUBJECTS.map((name) => ({ Level: 'LowerPrimary' as const, SubjectName: name })),
  ...DEFAULT_UPPER_PRIMARY_SUBJECTS.map((name) => ({ Level: 'UpperPrimary' as const, SubjectName: name })),
  ...DEFAULT_JSS_SUBJECTS.map((name) => ({ Level: 'JuniorSecondary' as const, SubjectName: name })),
  ...DEFAULT_SS_SUBJECTS.map((name) => ({ Level: 'SeniorSecondary' as const, SubjectName: name }))
];

export const INITIAL_DEFAULT_STUDENTS: Student[] = [];

export const INITIAL_DEFAULT_SCORES: SubjectScore[] = [];

export const INITIAL_DEFAULT_SUMMARIES: StudentSummary[] = [];

export const INITIAL_DEFAULT_PUBLISHED: PublishedRecord[] = [];

export interface CachedSchoolData {
  teachers: Teacher[];
  students: Student[];
  subjects: SubjectRule[];
  scores: SubjectScore[];
  summaries: StudentSummary[];
  published: PublishedRecord[];
  classes?: ClassRecord[];
  classNames?: string[];
  gradingScales?: GradingScaleItem[];
  timestamp: number;
}

export function getCachedSchoolData(): CachedSchoolData | null {
  try {
    const raw = safeStorage.getItem(LIVE_DATA_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setCachedSchoolData(data: Omit<CachedSchoolData, 'timestamp'>): void {
  try {
    safeStorage.setItem(
      LIVE_DATA_CACHE_KEY,
      JSON.stringify({
        ...data,
        timestamp: Date.now()
      })
    );
  } catch {}
}

// In-memory published cache
let inMemoryPublished: PublishedRecord[] = [];

export function getPublishedRecords(): PublishedRecord[] {
  return inMemoryPublished;
}

export function isClassResultPublished(className: string, term: TermType, session: string): boolean {
  if (!className) return false;
  const cleanTargetClass = normalizeClassIdentifier(className);
  const cleanTargetTerm = (term || '').trim().toLowerCase();
  const cleanTargetSession = (session || '').trim().toLowerCase().replace(/academic\s*session/g, '').replace(/session/g, '').trim();

  // Search in reverse order (newest records first)
  for (let i = inMemoryPublished.length - 1; i >= 0; i--) {
    const r = inMemoryPublished[i];
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
  return false;
}

/**
 * Real-time listener for Published records changes in Firestore
 */
export function subscribeToPublishedRecords(
  callback: (records: PublishedRecord[]) => void
): () => void {
  try {
    const pubCol = collection(db, 'published');
    const unsubscribe = onSnapshot(
      pubCol,
      (snapshot) => {
        const records: PublishedRecord[] = [];
        snapshot.forEach((d) => {
          records.push(d.data() as PublishedRecord);
        });
        if (records.length > 0) {
          inMemoryPublished = records;
          try {
            const currentCache = getCachedSchoolData();
            if (currentCache) {
              setCachedSchoolData({
                ...currentCache,
                published: records
              });
            }
          } catch {}
          callback(records);
        }
      },
      (err) => {
        console.warn('Real-time published listener notice:', err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Failed to subscribe to published records:', err);
    return () => {};
  }
}

/**
 * Generate sanitized deterministic Firestore document IDs
 */
function getClassDocId(className: string): string {
  return 'class_' + className.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
}

function getScoreDocId(studentId: string, session: string, term: string, subject: string): string {
  const cleanStudent = studentId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const cleanSession = session.replace(/[^a-zA-Z0-9]/g, '_');
  const cleanTerm = term.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const cleanSubject = subject.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  return `${cleanStudent}_${cleanSession}_${cleanTerm}_${cleanSubject}`;
}

function getSummaryDocId(studentId: string, session: string, term: string): string {
  const cleanStudent = studentId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const cleanSession = session.replace(/[^a-zA-Z0-9]/g, '_');
  const cleanTerm = term.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  return `${cleanStudent}_${cleanSession}_${cleanTerm}`;
}

function getStudentDocId(studentId: string): string {
  return studentId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
}

function getTeacherDocId(username: string): string {
  return username.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
}

function getPublishDocId(className: string, session: string, term: string): string {
  const cleanClass = normalizeClassIdentifier(className).replace(/[^a-zA-Z0-9]/g, '_');
  const cleanSession = (session || '').toLowerCase().replace(/academic\s*session/g, '').replace(/session/g, '').trim().replace(/[^a-zA-Z0-9]/g, '_');
  const cleanTerm = (term || '').toLowerCase().trim().replace(/[^a-zA-Z0-9]/g, '_');
  return `pub_${cleanClass}_${cleanTerm}_${cleanSession}`;
}

const CATEGORY_WEIGHTS: Record<ClassCategory, number> = {
  'KG': 1,
  'Nursery': 2,
  'Primary': 3,
  'Junior Secondary': 4,
  'Senior Secondary': 5,
  'Other': 6
};

export function sortSchoolClasses(classes: ClassRecord[]): ClassRecord[] {
  return [...classes].sort((a, b) => {
    const catA = a.category || detectClassCategory(a.name);
    const catB = b.category || detectClassCategory(b.name);
    const weightA = CATEGORY_WEIGHTS[catA] || 99;
    const weightB = CATEGORY_WEIGHTS[catB] || 99;
    if (weightA !== weightB) return weightA - weightB;

    if (a.order !== undefined && b.order !== undefined && a.order !== b.order) {
      return a.order - b.order;
    }

    // Extract numerical digits if any
    const numA = parseInt((a.name.match(/\d+/) || ['0'])[0], 10);
    const numB = parseInt((b.name.match(/\d+/) || ['0'])[0], 10);
    if (numA !== numB) return numA - numB;

    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
}

export function sortClassNames(classNames: string[]): string[] {
  const records = classNames.map((name) => ({
    name,
    category: detectClassCategory(name)
  }));
  return sortSchoolClasses(records).map((r) => r.name);
}

/**
 * Seed initial school data if Firestore collections are empty
 */
export async function seedInitialDatabase(force = false): Promise<{ success: boolean; message: string }> {
  try {
    const teachersSnapshot = await getDocs(collection(db, 'teachers'));
    if (!force && !teachersSnapshot.empty) {
      return { success: true, message: 'Database already has data.' };
    }

    const batch = writeBatch(db);

    // 1. Seed Classes
    INITIAL_DEFAULT_CLASSES.forEach((cls) => {
      const docRef = doc(db, 'classes', getClassDocId(cls.name));
      batch.set(docRef, {
        ...cls,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    });

    // 2. Seed Teachers
    INITIAL_DEFAULT_TEACHERS.forEach((teacher) => {
      const docRef = doc(db, 'teachers', getTeacherDocId(teacher.Username));
      batch.set(docRef, teacher, { merge: true });
    });

    // 3. Seed Subjects (Curriculum rules)
    INITIAL_DEFAULT_SUBJECTS.forEach((subj) => {
      const id = `${subj.Level}_${subj.SubjectName.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const docRef = doc(db, 'subjects', id);
      batch.set(docRef, subj, { merge: true });
    });

    await batch.commit();
    return { success: true, message: 'School classes, staff roster, and academic curriculum initialized in Firebase.' };
  } catch (err: any) {
    console.error('Failed to seed database in Firebase:', err);
    return { success: false, message: `Seeding error: ${err.message || 'Firebase permission error'}` };
  }
}

/**
 * Fetch all data from Firebase Firestore in Real Time
 */
export async function loadAllData(forceFresh = false): Promise<{
  teachers: Teacher[];
  students: Student[];
  subjects: SubjectRule[];
  scores: SubjectScore[];
  summaries: StudentSummary[];
  published: PublishedRecord[];
  classes: ClassRecord[];
  classNames: string[];
  gradingScales: GradingScaleItem[];
  isLive: boolean;
  error?: string;
}> {
  try {
    const cached = getCachedSchoolData();

    // Fetch all primary collections in parallel with a timeout guard
    const fetchCollections = Promise.allSettled([
      getDocs(collection(db, 'classes')),
      getDocs(collection(db, 'teachers')),
      getDocs(collection(db, 'students')),
      getDocs(collection(db, 'subjects')),
      getDocs(collection(db, 'scores')),
      getDocs(collection(db, 'summaries')),
      getDocs(collection(db, 'published')),
      getDoc(doc(db, 'settings', 'academic_grading'))
    ]);

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore backend response timed out.')), 25000)
    );

    const [
      clsRes,
      tRes,
      stRes,
      subRes,
      scRes,
      sumRes,
      pubRes,
      gradingRes
    ] = await Promise.race([fetchCollections, timeoutPromise]);

    const isConnected =
      clsRes.status === 'fulfilled' ||
      tRes.status === 'fulfilled' ||
      stRes.status === 'fulfilled' ||
      subRes.status === 'fulfilled';

    if (!isConnected) {
      throw new Error('Firestore connection unavailable.');
    }

    let clsSnap = clsRes.status === 'fulfilled' ? clsRes.value : null;
    let tSnap = tRes.status === 'fulfilled' ? tRes.value : null;
    const stSnap = stRes.status === 'fulfilled' ? stRes.value : null;
    const subSnap = subRes.status === 'fulfilled' ? subRes.value : null;
    const scSnap = scRes.status === 'fulfilled' ? scRes.value : null;
    const sumSnap = sumRes.status === 'fulfilled' ? sumRes.value : null;
    const pubSnap = pubRes.status === 'fulfilled' ? pubRes.value : null;
    const gradingSnap = gradingRes.status === 'fulfilled' ? gradingRes.value : null;

    // If classes and teachers are completely empty in a newly provisioned project, initialize foundation
    if (clsSnap && tSnap && clsSnap.empty && tSnap.empty) {
      await seedInitialDatabase(false);
      try {
        const [refreshedClasses, refreshedTeachers] = await Promise.all([
          getDocs(collection(db, 'classes')),
          getDocs(collection(db, 'teachers'))
        ]);
        clsSnap = refreshedClasses;
        tSnap = refreshedTeachers;
      } catch {}
    }

    let gradingScales: GradingScaleItem[] = cached?.gradingScales || [...DEFAULT_GENERAL_GRADING_SCALE];
    if (gradingSnap && gradingSnap.exists() && gradingSnap.data()?.scales) {
      gradingScales = gradingSnap.data()?.scales as GradingScaleItem[];
    }
    setActiveGradingScales(gradingScales);

    const fetchedClasses: ClassRecord[] = [];
    if (clsSnap) {
      clsSnap.forEach((d) => {
        const data = d.data() as ClassRecord;
        fetchedClasses.push({
          ...data,
          id: d.id,
          category: data.category || detectClassCategory(data.name)
        });
      });
    } else if (cached?.classes) {
      fetchedClasses.push(...cached.classes);
    }

    const teachers: Teacher[] = [];
    if (tSnap) {
      tSnap.forEach((d) => {
        const data = d.data() as Teacher;
        teachers.push({
          ...data,
          Password: data.Password || (data.Username.toLowerCase() === 'admin' ? 'admin' : ''),
          Role: data.Role || (data.Username.toLowerCase() === 'admin' ? 'admin' : 'teacher')
        });
      });
    } else if (cached?.teachers) {
      teachers.push(...cached.teachers);
    }

    // Ensure primary administrator account is present with Username: 'admin' and Password: 'admin'
    let adminAccount = teachers.find(
      (t) => t.Username.toLowerCase() === 'admin' || t.Role === 'admin'
    );
    if (!adminAccount) {
      adminAccount = {
        Username: 'admin',
        Password: 'admin',
        ClassAssigned: 'Admin',
        FullName: 'Portal Administrator',
        Role: 'admin'
      };
      teachers.unshift(adminAccount);
      try {
        await setDoc(doc(db, 'teachers', getTeacherDocId('admin')), adminAccount, { merge: true });
      } catch {}
    } else {
      let needsSync = false;
      if (adminAccount.Username !== 'admin') {
        adminAccount.Username = 'admin';
        needsSync = true;
      }
      if (adminAccount.Password !== 'admin') {
        adminAccount.Password = 'admin';
        needsSync = true;
      }
      if (adminAccount.Role !== 'admin') {
        adminAccount.Role = 'admin';
        needsSync = true;
      }
      if (needsSync) {
        try {
          await setDoc(doc(db, 'teachers', getTeacherDocId('admin')), {
            Username: 'admin',
            Password: 'admin',
            Role: 'admin',
            ClassAssigned: 'Admin',
            FullName: adminAccount.FullName || 'Portal Administrator'
          }, { merge: true });
        } catch {}
      }
    }

    const students: Student[] = [];
    if (stSnap) {
      stSnap.forEach((d) => {
        const data = d.data() as Student;
        students.push({
          ...data,
          Password: data.Password || 'password'
        });
      });
    } else if (cached?.students) {
      students.push(...cached.students);
    }

    const subjects: SubjectRule[] = [];
    if (subSnap) {
      subSnap.forEach((d) => subjects.push(d.data() as SubjectRule));
    } else if (cached?.subjects) {
      subjects.push(...cached.subjects);
    }

    const scores: SubjectScore[] = [];
    if (scSnap) {
      scSnap.forEach((d) => scores.push(d.data() as SubjectScore));
    } else if (cached?.scores) {
      scores.push(...cached.scores);
    }

    const summaries: StudentSummary[] = [];
    if (sumSnap) {
      sumSnap.forEach((d) => summaries.push(d.data() as StudentSummary));
    } else if (cached?.summaries) {
      summaries.push(...cached.summaries);
    }

    const published: PublishedRecord[] = [];
    if (pubSnap) {
      pubSnap.forEach((d) => published.push(d.data() as PublishedRecord));
    } else if (cached?.published) {
      published.push(...cached.published);
    }

    // Consolidate Classes
    let baseClasses = fetchedClasses.length > 0 ? fetchedClasses : INITIAL_DEFAULT_CLASSES;
    
    // Auto-discover any class from students or teachers not in classes collection
    const knownClassNames = new Set(baseClasses.map((c) => c.name.trim().toLowerCase()));
    students.forEach((st) => {
      const cName = (st.Class || '').trim();
      if (cName && !knownClassNames.has(cName.toLowerCase())) {
        knownClassNames.add(cName.toLowerCase());
        baseClasses.push({
          id: getClassDocId(cName),
          name: cName,
          category: detectClassCategory(cName),
          createdAt: new Date().toISOString()
        });
      }
    });

    teachers.forEach((t) => {
      const cName = (t.ClassAssigned || '').trim();
      if (cName && cName.toLowerCase() !== 'admin' && !knownClassNames.has(cName.toLowerCase())) {
        knownClassNames.add(cName.toLowerCase());
        baseClasses.push({
          id: getClassDocId(cName),
          name: cName,
          category: detectClassCategory(cName),
          createdAt: new Date().toISOString()
        });
      }
    });

    const sortedClasses = sortSchoolClasses(baseClasses);
    const sortedClassNames = sortedClasses.map((c) => c.name);

    // Synchronize mutable export ALL_SCHOOL_CLASSES
    ALL_SCHOOL_CLASSES.length = 0;
    ALL_SCHOOL_CLASSES.push(...sortedClassNames);

    const rawTeachers = teachers.length > 0 ? teachers : INITIAL_DEFAULT_TEACHERS;
    let finalTeachers = rawTeachers.map((t) => {
      const isAdmin =
        t.Role === 'admin' ||
        t.Username.toLowerCase() === 'admin';
      return {
        ...t,
        ClassAssigned: isAdmin ? 'Admin' : t.ClassAssigned,
        Password: t.Password || '',
        Role: (isAdmin ? 'admin' : 'teacher') as 'admin' | 'teacher',
        FullName:
          t.FullName ||
          (isAdmin
            ? 'Portal Administrator'
            : `Class Teacher (${t.ClassAssigned})`)
      };
    });

    // Ensure every class in the school has an assigned teacher in finalTeachers
    sortedClassNames.forEach((cls) => {
      const exists = finalTeachers.some(
        (t) => isMatchingClass(t.ClassAssigned, cls) && t.Role !== 'admin'
      );
      if (!exists) {
        const defaultMatch = INITIAL_DEFAULT_TEACHERS.find(
          (dt) => isMatchingClass(dt.ClassAssigned, cls) && dt.Role !== 'admin'
        );
        if (defaultMatch) {
          finalTeachers.push({
            ...defaultMatch,
            Role: (defaultMatch.Role || 'teacher') as 'admin' | 'teacher',
            FullName: defaultMatch.FullName || `Class Teacher (${cls})`
          });
        } else {
          finalTeachers.push({
            Username: `teacher_${cls.toLowerCase().replace(/[\s._-]/g, '')}`,
            Password: 'password123',
            ClassAssigned: cls,
            FullName: `Class Teacher (${cls})`,
            Role: 'teacher'
          });
        }
      }
    });

    const rawStudents = students;
    const finalStudents = rawStudents.map(s => ({
      ...s,
      Password: s.Password || 'password'
    }));

    const finalSubjects = subjects.length > 0 ? subjects : INITIAL_DEFAULT_SUBJECTS;

    // Intelligently merge remote published with in-memory and cached published records
    // so recently approved results in current session are never overwritten by an empty query
    const cachedBefore = getCachedSchoolData();
    const mergedPublishedMap = new Map<string, PublishedRecord>();

    (cachedBefore?.published || []).forEach((r) => {
      const k = `${normalizeClassIdentifier(r.className)}_${(r.term || '').trim().toLowerCase()}_${(r.session || '').trim().toLowerCase().replace(/session/g, '').trim()}`;
      mergedPublishedMap.set(k, r);
    });
    inMemoryPublished.forEach((r) => {
      const k = `${normalizeClassIdentifier(r.className)}_${(r.term || '').trim().toLowerCase()}_${(r.session || '').trim().toLowerCase().replace(/session/g, '').trim()}`;
      mergedPublishedMap.set(k, r);
    });
    published.forEach((r) => {
      const k = `${normalizeClassIdentifier(r.className)}_${(r.term || '').trim().toLowerCase()}_${(r.session || '').trim().toLowerCase().replace(/session/g, '').trim()}`;
      mergedPublishedMap.set(k, r);
    });

    const finalPublished = Array.from(mergedPublishedMap.values());

    inMemoryPublished = finalPublished;

    setCachedSchoolData({
      teachers: finalTeachers,
      students: finalStudents,
      subjects: finalSubjects,
      scores,
      summaries,
      published: finalPublished,
      classes: sortedClasses,
      classNames: sortedClassNames,
      gradingScales
    });

    return {
      teachers: finalTeachers,
      students: finalStudents,
      subjects: finalSubjects,
      scores,
      summaries,
      published: finalPublished,
      classes: sortedClasses,
      classNames: sortedClassNames,
      gradingScales,
      isLive: true
    };
  } catch (err: any) {
    console.warn('Firebase connection notice:', err);
    const cached = getCachedSchoolData();
    if (cached) {
      const cls = cached.classes || INITIAL_DEFAULT_CLASSES;
      const names = cached.classNames || cls.map(c => c.name);
      const scales = cached.gradingScales || DEFAULT_GENERAL_GRADING_SCALE;
      ALL_SCHOOL_CLASSES.length = 0;
      ALL_SCHOOL_CLASSES.push(...names);
      setActiveGradingScales(scales);

      return {
        teachers: cached.teachers || INITIAL_DEFAULT_TEACHERS,
        students: cached.students || [],
        subjects: cached.subjects || INITIAL_DEFAULT_SUBJECTS,
        scores: cached.scores || [],
        summaries: cached.summaries || [],
        published: cached.published || [],
        classes: cls,
        classNames: names,
        gradingScales: scales,
        isLive: false,
        error: undefined
      };
    }

    return {
      teachers: INITIAL_DEFAULT_TEACHERS,
      students: [],
      subjects: INITIAL_DEFAULT_SUBJECTS,
      scores: [],
      summaries: [],
      published: [],
      classes: INITIAL_DEFAULT_CLASSES,
      classNames: INITIAL_DEFAULT_CLASSES.map(c => c.name),
      gradingScales: DEFAULT_GENERAL_GRADING_SCALE,
      isLive: false,
      error: 'Offline: Unable to connect to Firebase. Please check your internet connection.'
    };
  }
}

/**
 * Fetch FRESH single student report data directly from Firebase Firestore in Real Time
 */
export async function fetchFreshStudentData(
  studentId: string,
  session: string,
  term: TermType,
  className?: string
): Promise<{
  scores: SubjectScore[];
  summary: StudentSummary | null;
  isLive: boolean;
}> {
  try {
    const scoresQuery = query(
      collection(db, 'scores'),
      where('StudentID', '==', studentId),
      where('Term', '==', term),
      where('Session', '==', session)
    );
    const scoresSnap = await getDocs(scoresQuery);
    const scores: SubjectScore[] = [];
    scoresSnap.forEach((d) => scores.push(d.data() as SubjectScore));

    const summaryDocRef = doc(db, 'summaries', getSummaryDocId(studentId, session, term));
    const summarySnap = await getDoc(summaryDocRef);
    let summary: StudentSummary | null = null;
    if (summarySnap.exists()) {
      summary = summarySnap.data() as StudentSummary;
    }

    return {
      scores,
      summary,
      isLive: true
    };
  } catch (err: any) {
    console.warn('Fresh fetch from Firebase failed:', err);
    // Robust fallback to cached scores/summary if available
    const cached = getCachedSchoolData();
    const cachedScores = (cached?.scores || []).filter(
      (s) => s.StudentID === studentId && s.Term === term && s.Session === session
    );
    const cachedSummary = (cached?.summaries || []).find(
      (s) => s.StudentID === studentId && s.Term === term && s.Session === session
    ) || null;

    return { scores: cachedScores, summary: cachedSummary, isLive: false };
  }
}

/**
 * Save report card scores & summary directly to Firebase Firestore in Real Time
 */
export async function saveStudentReportCard(payload: {
  studentId: string;
  className?: string;
  session: string;
  term: TermType;
  scores: Array<{
    Subject: string;
    CA1: number | null;
    CA2: number | null;
    Exam: number | null;
    Total: number | null;
  }>;
  summary: {
    DaysPresent: number | null;
    DaysOpened: number | null;
    TeacherComment: string;
    PrincipalComment: string;
    AffectiveRatings?: AffectiveRatings;
    PsychomotorRatings?: PsychomotorRatings;
    PromotionDecision?: string;
  };
  affectiveRatings?: AffectiveRatings;
  psychomotorRatings?: PsychomotorRatings;
  promotionDecision?: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const batch = writeBatch(db);

    // Save individual subject score docs
    for (const sc of payload.scores) {
      const subj = String(sc.Subject || '').trim();
      if (!subj) continue;

      const ca1 = sc.CA1 !== undefined && sc.CA1 !== null ? Number(sc.CA1) : null;
      const ca2 = sc.CA2 !== undefined && sc.CA2 !== null ? Number(sc.CA2) : null;
      const exam = sc.Exam !== undefined && sc.Exam !== null ? Number(sc.Exam) : null;
      let total = sc.Total !== undefined && sc.Total !== null ? Number(sc.Total) : null;

      if (total === null && (ca1 !== null || ca2 !== null || exam !== null)) {
        total = (ca1 || 0) + (ca2 || 0) + (exam || 0);
      }

      const scoreDocId = getScoreDocId(payload.studentId, payload.session, payload.term, subj);
      const scoreRef = doc(db, 'scores', scoreDocId);

      batch.set(
        scoreRef,
        {
          StudentID: payload.studentId,
          Session: payload.session,
          Term: payload.term,
          Subject: subj,
          CA1: ca1,
          CA2: ca2,
          Exam: exam,
          Total: total,
          UpdatedAt: new Date().toISOString()
        },
        { merge: true }
      );
    }

    // Save summary doc with affective, psychomotor, and promotion decision
    const summaryDocId = getSummaryDocId(payload.studentId, payload.session, payload.term);
    const summaryRef = doc(db, 'summaries', summaryDocId);

    const summaryDataToSave: Record<string, any> = {
      StudentID: payload.studentId,
      Session: payload.session,
      Term: payload.term,
      DaysPresent: payload.summary.DaysPresent,
      DaysOpened: payload.summary.DaysOpened,
      TeacherComment: payload.summary.TeacherComment || '',
      PrincipalComment: payload.summary.PrincipalComment || '',
      UpdatedAt: new Date().toISOString()
    };

    if (payload.summary.AffectiveRatings || payload.affectiveRatings) {
      summaryDataToSave.AffectiveRatings = payload.summary.AffectiveRatings || payload.affectiveRatings;
    }
    if (payload.summary.PsychomotorRatings || payload.psychomotorRatings) {
      summaryDataToSave.PsychomotorRatings = payload.summary.PsychomotorRatings || payload.psychomotorRatings;
    }
    if (payload.summary.PromotionDecision || payload.promotionDecision) {
      summaryDataToSave.PromotionDecision = payload.summary.PromotionDecision || payload.promotionDecision;
    }

    batch.set(summaryRef, summaryDataToSave, { merge: true });

    await batch.commit();

    // Immediately reflect in localStorage cache
    try {
      const currentCache = getCachedSchoolData();
      if (currentCache) {
        const existingScores = currentCache.scores || [];
        const scoreMap = new Map<string, SubjectScore>();
        existingScores.forEach((s) => {
          const k = `${s.StudentID}_${s.Session}_${s.Term}_${s.Subject}`.toLowerCase();
          scoreMap.set(k, s);
        });

        for (const sc of payload.scores) {
          const subj = String(sc.Subject || '').trim();
          if (!subj) continue;
          const ca1 = sc.CA1 !== undefined && sc.CA1 !== null ? Number(sc.CA1) : null;
          const ca2 = sc.CA2 !== undefined && sc.CA2 !== null ? Number(sc.CA2) : null;
          const exam = sc.Exam !== undefined && sc.Exam !== null ? Number(sc.Exam) : null;
          let total = sc.Total !== undefined && sc.Total !== null ? Number(sc.Total) : null;
          if (total === null && (ca1 !== null || ca2 !== null || exam !== null)) {
            total = (ca1 || 0) + (ca2 || 0) + (exam || 0);
          }
          const k = `${payload.studentId}_${payload.session}_${payload.term}_${subj}`.toLowerCase();
          scoreMap.set(k, {
            StudentID: payload.studentId,
            Session: payload.session,
            Term: payload.term,
            Subject: subj,
            CA1: ca1,
            CA2: ca2,
            Exam: exam,
            Total: total
          });
        }

        const existingSummaries = currentCache.summaries || [];
        const summaryMap = new Map<string, StudentSummary>();
        existingSummaries.forEach((sm) => {
          const k = `${sm.StudentID}_${sm.Session}_${sm.Term}`.toLowerCase();
          summaryMap.set(k, sm);
        });

        const summKey = `${payload.studentId}_${payload.session}_${payload.term}`.toLowerCase();
        summaryMap.set(summKey, {
          StudentID: payload.studentId,
          Session: payload.session,
          Term: payload.term,
          DaysPresent: payload.summary.DaysPresent,
          DaysOpened: payload.summary.DaysOpened,
          TeacherComment: payload.summary.TeacherComment || '',
          PrincipalComment: payload.summary.PrincipalComment || '',
          AffectiveRatings: payload.summary.AffectiveRatings || payload.affectiveRatings,
          PsychomotorRatings: payload.summary.PsychomotorRatings || payload.psychomotorRatings,
          PromotionDecision: payload.summary.PromotionDecision || payload.promotionDecision
        });

        setCachedSchoolData({
          ...currentCache,
          scores: Array.from(scoreMap.values()),
          summaries: Array.from(summaryMap.values())
        });
      }
    } catch (cacheErr) {
      console.warn('Failed to sync cache in saveStudentReportCard:', cacheErr);
    }

    return {
      success: true,
      message: 'Scores and remarks recorded directly to Firebase Firestore in real time!'
    };
  } catch (err: any) {
    console.error('Failed to save to Firebase Firestore:', err);
    return {
      success: false,
      message: `Failed to save to Firebase: ${err.message || 'Database write error'}`
    };
  }
}

/**
 * Delete a student's report card (scores + summary) for a specific Term & Session
 */
export async function deleteStudentReportCard(payload: {
  studentId: string;
  className?: string;
  session: string;
  term: TermType;
}): Promise<{ success: boolean; message: string }> {
  try {
    const scoresQuery = query(
      collection(db, 'scores'),
      where('StudentID', '==', payload.studentId),
      where('Term', '==', payload.term),
      where('Session', '==', payload.session)
    );
    const scoresSnap = await getDocs(scoresQuery);

    const batch = writeBatch(db);
    scoresSnap.forEach((d) => {
      batch.delete(d.ref);
    });

    const summaryDocId = getSummaryDocId(payload.studentId, payload.session, payload.term);
    batch.delete(doc(db, 'summaries', summaryDocId));

    await batch.commit();

    return {
      success: true,
      message: 'Report card scores and remarks successfully deleted from Firebase.'
    };
  } catch (err: any) {
    console.error('Failed to delete report card from Firebase:', err);
    return {
      success: false,
      message: `Failed to delete from Firebase: ${err.message || 'Network error'}`
    };
  }
}

/**
 * Add or update a student with comprehensive profile fields in Firebase Firestore
 */
export async function saveStudent(student: {
  StudentID: string;
  FullName: string;
  Class: string;
  Gender?: 'Male' | 'Female' | string;
  DOB?: string;
  ParentName?: string;
  ParentPhone?: string;
  Address?: string;
  GuardianEmail?: string;
  Password?: string;
}): Promise<{ success: boolean; message: string; student: Student }> {
  try {
    const studentDocId = getStudentDocId(student.StudentID);
    const docRef = doc(db, 'students', studentDocId);

    const existingSnap = await getDoc(docRef);
    const existing = existingSnap.exists() ? (existingSnap.data() as Student) : null;

    const studentRecord: Student = {
      StudentID: student.StudentID.trim().toUpperCase(),
      FullName: student.FullName.trim(),
      Class: student.Class.trim(),
      Gender: student.Gender || existing?.Gender || 'Male',
      DOB: student.DOB !== undefined ? student.DOB.trim() : existing?.DOB || '',
      ParentName: student.ParentName !== undefined ? student.ParentName.trim() : existing?.ParentName || '',
      ParentPhone: student.ParentPhone !== undefined ? student.ParentPhone.trim() : existing?.ParentPhone || '',
      Address: student.Address !== undefined ? student.Address.trim() : existing?.Address || '',
      GuardianEmail: student.GuardianEmail !== undefined ? student.GuardianEmail.trim() : existing?.GuardianEmail || '',
      Password: student.Password !== undefined && student.Password.trim() ? student.Password.trim() : existing?.Password || 'password',
      UpdatedAt: new Date().toISOString(),
      CreatedAt: existing?.CreatedAt || new Date().toISOString()
    };

    await setDoc(docRef, studentRecord, { merge: true });

    return {
      success: true,
      message: `Student ${studentRecord.FullName} (${studentRecord.StudentID}) profile saved successfully in Firebase!`,
      student: studentRecord
    };
  } catch (err: any) {
    console.error('Failed to save student in Firebase:', err);
    return {
      success: false,
      message: `Failed to save student: ${err.message || 'Firebase error'}`,
      student: {
        StudentID: student.StudentID,
        FullName: student.FullName,
        Class: student.Class
      }
    };
  }
}

/**
 * Update student profile and handle StudentID / Username changes with full migration of scores and summaries
 */
export async function updateStudentProfileAndIdentifier(
  originalStudentId: string,
  updatedData: {
    StudentID: string;
    FullName: string;
    Class: string;
    Gender?: 'Male' | 'Female' | string;
    DOB?: string;
    ParentName?: string;
    ParentPhone?: string;
    Address?: string;
    GuardianEmail?: string;
    Password?: string;
  }
): Promise<{ success: boolean; message: string; student: Student; migratedScoresCount?: number }> {
  try {
    const oldId = originalStudentId.trim().toUpperCase();
    const newId = updatedData.StudentID.trim().toUpperCase();

    if (!oldId || !newId) {
      return {
        success: false,
        message: 'Original Student ID and New Student ID are required.',
        student: {
          StudentID: newId || oldId,
          FullName: updatedData.FullName,
          Class: updatedData.Class
        }
      };
    }

    // If ID hasn't changed, simple save
    if (oldId === newId) {
      const res = await saveStudent(updatedData);
      return {
        success: res.success,
        message: res.message,
        student: res.student,
        migratedScoresCount: 0
      };
    }

    // If ID is changing, check if new ID already exists
    const newDocRef = doc(db, 'students', getStudentDocId(newId));
    const newSnap = await getDoc(newDocRef);
    if (newSnap.exists()) {
      return {
        success: false,
        message: `Student ID "${newId}" is already assigned to another student in the system.`,
        student: {
          StudentID: oldId,
          FullName: updatedData.FullName,
          Class: updatedData.Class
        }
      };
    }

    // Fetch old student doc
    const oldDocRef = doc(db, 'students', getStudentDocId(oldId));
    const oldSnap = await getDoc(oldDocRef);
    const existingOldData = oldSnap.exists() ? (oldSnap.data() as Student) : null;

    const newStudentRecord: Student = {
      StudentID: newId,
      FullName: updatedData.FullName.trim(),
      Class: updatedData.Class.trim(),
      Gender: updatedData.Gender || existingOldData?.Gender || 'Male',
      DOB: updatedData.DOB !== undefined ? updatedData.DOB.trim() : existingOldData?.DOB || '',
      ParentName: updatedData.ParentName !== undefined ? updatedData.ParentName.trim() : existingOldData?.ParentName || '',
      ParentPhone: updatedData.ParentPhone !== undefined ? updatedData.ParentPhone.trim() : existingOldData?.ParentPhone || '',
      Address: updatedData.Address !== undefined ? updatedData.Address.trim() : existingOldData?.Address || '',
      GuardianEmail: updatedData.GuardianEmail !== undefined ? updatedData.GuardianEmail.trim() : existingOldData?.GuardianEmail || '',
      Password: updatedData.Password !== undefined && updatedData.Password.trim() ? updatedData.Password.trim() : existingOldData?.Password || 'password',
      UpdatedAt: new Date().toISOString(),
      CreatedAt: existingOldData?.CreatedAt || new Date().toISOString()
    };

    // Query all scores for old StudentID
    const scoresQuery = query(collection(db, 'scores'), where('StudentID', '==', oldId));
    const scoresSnap = await getDocs(scoresQuery);

    // Query all summaries for old StudentID
    const summariesQuery = query(collection(db, 'summaries'), where('StudentID', '==', oldId));
    const summariesSnap = await getDocs(summariesQuery);

    const batch = writeBatch(db);

    // 1. Set new student doc
    batch.set(newDocRef, newStudentRecord);

    // 2. Delete old student doc
    if (oldSnap.exists()) {
      batch.delete(oldDocRef);
    }

    // 3. Migrate scores
    let migratedScores = 0;
    scoresSnap.forEach((scoreDoc) => {
      const sc = scoreDoc.data() as SubjectScore;
      const newScoreDocId = getScoreDocId(newId, sc.Session, sc.Term, sc.Subject);
      const newScoreRef = doc(db, 'scores', newScoreDocId);
      batch.set(newScoreRef, {
        ...sc,
        StudentID: newId,
        UpdatedAt: new Date().toISOString()
      });
      batch.delete(scoreDoc.ref);
      migratedScores++;
    });

    // 4. Migrate summaries
    let migratedSummaries = 0;
    summariesSnap.forEach((sumDoc) => {
      const sum = sumDoc.data() as StudentSummary;
      const newSummaryDocId = getSummaryDocId(newId, sum.Session, sum.Term);
      const newSummaryRef = doc(db, 'summaries', newSummaryDocId);
      batch.set(newSummaryRef, {
        ...sum,
        StudentID: newId,
        UpdatedAt: new Date().toISOString()
      });
      batch.delete(sumDoc.ref);
      migratedSummaries++;
    });

    await batch.commit();

    return {
      success: true,
      message: `Pupil ID changed from "${oldId}" to "${newId}". Successfully migrated ${migratedScores} assessment score records and ${migratedSummaries} term summaries!`,
      student: newStudentRecord,
      migratedScoresCount: migratedScores
    };
  } catch (err: any) {
    console.error('Failed to update student profile and identifier:', err);
    return {
      success: false,
      message: `Failed to update pupil identifier: ${err.message || 'Firebase error'}`,
      student: {
        StudentID: updatedData.StudentID,
        FullName: updatedData.FullName,
        Class: updatedData.Class
      }
    };
  }
}

/**
 * Promote or Transfer a batch of students from one class to another
 */
export async function promoteClassStudents(
  sourceClass: string,
  targetClass: string,
  selectedStudentIds?: string[]
): Promise<{ success: boolean; message: string; count: number }> {
  try {
    const stSnap = await getDocs(collection(db, 'students'));
    const batch = writeBatch(db);
    let count = 0;

    stSnap.forEach((docSnap) => {
      const data = docSnap.data() as Student;
      const matchesClass = isMatchingClass(data.Class, sourceClass);
      const isSelected = !selectedStudentIds || selectedStudentIds.length === 0 || selectedStudentIds.includes(data.StudentID);

      if (matchesClass && isSelected) {
        batch.update(docSnap.ref, {
          Class: targetClass,
          UpdatedAt: new Date().toISOString()
        });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
    }

    return {
      success: true,
      message: `Successfully moved/promoted ${count} pupil(s) from ${sourceClass} to ${targetClass}!`,
      count
    };
  } catch (err: any) {
    console.error('Failed to promote students:', err);
    return {
      success: false,
      message: `Class promotion error: ${err.message || 'Firebase error'}`,
      count: 0
    };
  }
}

/**
 * Reset all staff/teacher passwords in one click
 */
export async function resetAllStaffPasswords(
  newPassword = 'password123'
): Promise<{ success: boolean; message: string; count: number }> {
  try {
    const tSnap = await getDocs(collection(db, 'teachers'));
    const batch = writeBatch(db);
    let count = 0;

    tSnap.forEach((docSnap) => {
      const data = docSnap.data() as Teacher;
      if (data.Role !== 'admin') {
        batch.update(docSnap.ref, { Password: newPassword });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
    }

    return {
      success: true,
      message: `Reset passwords for ${count} staff teachers to "${newPassword}".`,
      count
    };
  } catch (err: any) {
    console.error('Failed to reset staff passwords:', err);
    return {
      success: false,
      message: `Staff password reset error: ${err.message || 'Firebase error'}`,
      count: 0
    };
  }
}

/**
 * Add a new student to Firebase Firestore (legacy wrapper)
 */
export async function addStudent(student: {
  studentId?: string;
  StudentID?: string;
  fullName?: string;
  FullName?: string;
  className?: string;
  Class?: string;
  gender?: 'Male' | 'Female' | string;
  Gender?: 'Male' | 'Female' | string;
  dob?: string;
  DOB?: string;
  parentName?: string;
  ParentName?: string;
  parentPhone?: string;
  ParentPhone?: string;
  address?: string;
  Address?: string;
  password?: string;
  Password?: string;
}): Promise<{ success: boolean; message: string }> {
  const sId = student.StudentID || student.studentId || '';
  const sName = student.FullName || student.fullName || '';
  const sClass = student.Class || student.className || 'Primary 1';
  const sGender = student.Gender || student.gender || 'Male';

  const res = await saveStudent({
    StudentID: sId,
    FullName: sName,
    Class: sClass,
    Gender: sGender,
    DOB: student.DOB || student.dob,
    ParentName: student.ParentName || student.parentName,
    ParentPhone: student.ParentPhone || student.parentPhone,
    Address: student.Address || student.address,
    Password: student.Password || student.password
  });

  return { success: res.success, message: res.message };
}

/**
 * Bulk upload students from Sheet / CSV into Firebase Firestore
 */
export async function bulkUploadStudents(
  students: Student[]
): Promise<{ success: boolean; count: number; message: string; errors?: string[] }> {
  try {
    if (!students || students.length === 0) {
      return { success: false, count: 0, message: 'No student records provided for upload.' };
    }

    // Firestore batch limit is 500 writes
    const CHUNK_SIZE = 400;
    let totalImported = 0;

    for (let i = 0; i < students.length; i += CHUNK_SIZE) {
      const chunk = students.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      for (const st of chunk) {
        const cleanId = String(st.StudentID || '').trim().toUpperCase();
        const cleanName = String(st.FullName || '').trim();
        const cleanClass = String(st.Class || '').trim();

        if (!cleanId || !cleanName || !cleanClass) continue;

        const docId = getStudentDocId(cleanId);
        const docRef = doc(db, 'students', docId);

        const record: Student = {
          StudentID: cleanId,
          FullName: cleanName,
          Class: cleanClass,
          Gender: st.Gender || 'Male',
          DOB: st.DOB || '',
          ParentName: st.ParentName || '',
          ParentPhone: st.ParentPhone || '',
          Address: st.Address || '',
          GuardianEmail: st.GuardianEmail || '',
          Password: st.Password || 'password',
          UpdatedAt: new Date().toISOString(),
          CreatedAt: st.CreatedAt || new Date().toISOString()
        };

        batch.set(docRef, record, { merge: true });
        totalImported++;
      }

      await batch.commit();
    }

    return {
      success: true,
      count: totalImported,
      message: `Successfully uploaded and synced ${totalImported} students to Firebase Firestore!`
    };
  } catch (err: any) {
    console.error('Failed to bulk upload students to Firebase:', err);
    return {
      success: false,
      count: 0,
      message: `Bulk upload error: ${err.message || 'Database write error'}`
    };
  }
}

/**
 * Restore complete school database from a JSON backup file
 */
export async function restoreSchoolBackup(backupData: {
  teachers?: Teacher[];
  students?: Student[];
  subjects?: SubjectRule[];
  scores?: SubjectScore[];
  summaries?: StudentSummary[];
  published?: PublishedRecord[];
}): Promise<{ success: boolean; message: string; stats: Record<string, number> }> {
  try {
    const stats: Record<string, number> = {
      teachers: 0,
      students: 0,
      subjects: 0,
      scores: 0,
      summaries: 0,
      published: 0
    };

    // Restore Teachers
    if (backupData.teachers && backupData.teachers.length > 0) {
      const batch = writeBatch(db);
      for (const t of backupData.teachers) {
        if (!t.Username) continue;
        const docRef = doc(db, 'teachers', getTeacherDocId(t.Username));
        batch.set(docRef, t, { merge: true });
        stats.teachers++;
      }
      await batch.commit();
    }

    // Restore Students
    if (backupData.students && backupData.students.length > 0) {
      await bulkUploadStudents(backupData.students);
      stats.students = backupData.students.length;
    }

    // Restore Subjects
    if (backupData.subjects && backupData.subjects.length > 0) {
      const batch = writeBatch(db);
      for (const sub of backupData.subjects) {
        if (!sub.SubjectName || !sub.Level) continue;
        const docId = sub.id || `${sub.Level}_${sub.Class ? sub.Class + '_' : ''}${sub.SubjectName.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const docRef = doc(db, 'subjects', docId);
        const subData: Record<string, any> = {
          id: docId,
          SubjectName: sub.SubjectName.trim(),
          Level: sub.Level.trim()
        };
        if (sub.Class && sub.Class.trim()) {
          subData.Class = sub.Class.trim();
        }
        batch.set(docRef, subData, { merge: true });
        stats.subjects++;
      }
      await batch.commit();
    }

    // Restore Scores
    if (backupData.scores && backupData.scores.length > 0) {
      const CHUNK_SIZE = 400;
      for (let i = 0; i < backupData.scores.length; i += CHUNK_SIZE) {
        const chunk = backupData.scores.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        for (const sc of chunk) {
          if (!sc.StudentID || !sc.Subject || !sc.Term || !sc.Session) continue;
          const docId = getScoreDocId(sc.StudentID, sc.Session, sc.Term, sc.Subject);
          const docRef = doc(db, 'scores', docId);
          batch.set(docRef, sc, { merge: true });
          stats.scores++;
        }
        await batch.commit();
      }
    }

    // Restore Summaries
    if (backupData.summaries && backupData.summaries.length > 0) {
      const batch = writeBatch(db);
      for (const sum of backupData.summaries) {
        if (!sum.StudentID || !sum.Term || !sum.Session) continue;
        const docId = getSummaryDocId(sum.StudentID, sum.Session, sum.Term);
        const docRef = doc(db, 'summaries', docId);
        batch.set(docRef, sum, { merge: true });
        stats.summaries++;
      }
      await batch.commit();
    }

    // Restore Published Records
    if (backupData.published && backupData.published.length > 0) {
      const batch = writeBatch(db);
      for (const pub of backupData.published) {
        if (!pub.className || !pub.term || !pub.session) continue;
        const docId = getPublishDocId(pub.className, pub.session, pub.term);
        const docRef = doc(db, 'published', docId);
        batch.set(docRef, pub, { merge: true });
        stats.published++;
      }
      await batch.commit();
    }

    return {
      success: true,
      message: `Database successfully restored and synchronized with Firebase Firestore!`,
      stats
    };
  } catch (err: any) {
    console.error('Restore error:', err);
    return {
      success: false,
      message: `Database restore failed: ${err.message || 'Firebase write error'}`,
      stats: {}
    };
  }
}

/**
 * Delete a student from Firebase Firestore
 */
export async function deleteStudent(studentId: string): Promise<{ success: boolean; message: string }> {
  try {
    const studentDocId = getStudentDocId(studentId);
    await deleteDoc(doc(db, 'students', studentDocId));

    // Also delete any associated scores and summaries
    const scoresQuery = query(collection(db, 'scores'), where('StudentID', '==', studentId));
    const scoresSnap = await getDocs(scoresQuery);

    const batch = writeBatch(db);
    scoresSnap.forEach((d) => batch.delete(d.ref));

    const summariesQuery = query(collection(db, 'summaries'), where('StudentID', '==', studentId));
    const summariesSnap = await getDocs(summariesQuery);
    summariesSnap.forEach((d) => batch.delete(d.ref));

    await batch.commit();

    return {
      success: true,
      message: `Student ${studentId} and all associated records deleted from Firebase.`
    };
  } catch (err: any) {
    console.error('Failed to delete student from Firebase:', err);
    return {
      success: false,
      message: `Failed to delete student: ${err.message || 'Firebase error'}`
    };
  }
}

/**
 * Publish / Unpublish a class result in Real-Time to Firebase Firestore
 */
export async function setClassPublishStatus(
  className: string,
  term: TermType,
  session: string,
  isPublished: boolean,
  publishedBy: string = 'Staff',
  options?: {
    status?: 'draft' | 'pending_approval' | 'approved';
    teacherSubmitted?: boolean;
    teacherSubmittedBy?: string;
    adminApproved?: boolean;
    adminApprovedBy?: string;
  }
): Promise<{ success: boolean; isPublished: boolean; message: string; record?: PublishedRecord }> {
  const publishDocId = getPublishDocId(className, session, term);
  const docRef = doc(db, 'published', publishDocId);

  const status = options?.status || (isPublished ? 'approved' : 'draft');
  const now = new Date().toISOString();

  // Firestore-safe clean payload (strip all undefined fields so Firestore setDoc never rejects)
  const firestoreRecord: Record<string, any> = {
    classKey: `${className}_${term}_${session}`,
    className,
    term,
    session,
    isPublished: Boolean(isPublished),
    publishedBy,
    status,
    teacherSubmitted: options?.teacherSubmitted !== undefined ? Boolean(options.teacherSubmitted) : Boolean(isPublished),
    adminApproved: options?.adminApproved !== undefined ? Boolean(options.adminApproved) : Boolean(isPublished),
    updatedAt: now
  };

  if (isPublished) {
    firestoreRecord.publishedAt = now;
    firestoreRecord.teacherSubmittedAt = now;
    firestoreRecord.teacherSubmittedBy = options?.teacherSubmittedBy || publishedBy;
    firestoreRecord.adminApprovedAt = now;
    firestoreRecord.adminApprovedBy = options?.adminApprovedBy || publishedBy;
  } else {
    firestoreRecord.unpublishedAt = now;
    firestoreRecord.unpublishedBy = publishedBy;
  }

  if (options?.teacherSubmittedBy) {
    firestoreRecord.teacherSubmittedBy = options.teacherSubmittedBy;
  }
  if (options?.adminApprovedBy) {
    firestoreRecord.adminApprovedBy = options.adminApprovedBy;
  }

  const record: PublishedRecord = {
    classKey: `${className}_${term}_${session}`,
    className,
    term,
    session,
    isPublished: Boolean(isPublished),
    publishedAt: isPublished ? now : undefined,
    publishedBy,
    status,
    teacherSubmitted: options?.teacherSubmitted !== undefined ? options.teacherSubmitted : isPublished,
    teacherSubmittedAt: options?.teacherSubmitted ? now : (isPublished ? now : undefined),
    teacherSubmittedBy: options?.teacherSubmittedBy || publishedBy,
    adminApproved: options?.adminApproved !== undefined ? options.adminApproved : isPublished,
    adminApprovedAt: isPublished || options?.adminApproved ? now : undefined,
    adminApprovedBy: options?.adminApprovedBy || (isPublished ? publishedBy : undefined)
  };

  // Update in-memory state immediately
  const cleanTargetClass = normalizeClassIdentifier(className);
  const cleanTargetTerm = (term || '').trim().toLowerCase();
  const cleanTargetSession = (session || '').trim().toLowerCase().replace(/academic\s*session/g, '').replace(/session/g, '').trim();

  const filtered = inMemoryPublished.filter((r) => {
    const rClass = normalizeClassIdentifier(r.className);
    const rTerm = (r.term || '').trim().toLowerCase();
    const rSession = (r.session || '').trim().toLowerCase().replace(/academic\s*session/g, '').replace(/session/g, '').trim();

    const classMatches = rClass === cleanTargetClass || isMatchingClass(r.className, className);
    const termMatches = !rTerm || !cleanTargetTerm || rTerm === cleanTargetTerm;
    const sessionMatches = !rSession || !cleanTargetSession || rSession === cleanTargetSession;

    return !(classMatches && termMatches && sessionMatches);
  });
  filtered.push(record);
  inMemoryPublished = filtered;

  // Persist to local cache immediately so client state is synchronous
  try {
    const currentCache = getCachedSchoolData();
    if (currentCache) {
      setCachedSchoolData({
        ...currentCache,
        published: inMemoryPublished
      });
    }
  } catch (e) {
    console.warn('Failed to update cache in setClassPublishStatus:', e);
  }

  try {
    await setDoc(docRef, firestoreRecord, { merge: false });

    let message = '';
    if (isPublished) {
      message = `Results for ${className} (${term}, ${session}) are PUBLISHED & LIVE for students!`;
    } else {
      message = `Results for ${className} (${term}, ${session}) are UNPUBLISHED (Draft). You can now make score corrections.`;
    }

    return {
      success: true,
      isPublished,
      message,
      record
    };
  } catch (err: any) {
    console.error('Firebase publish error:', err);
    return {
      success: false,
      isPublished: !isPublished,
      message: `Failed to save status to Firebase: ${err.message || 'Firestore error'}`,
      record
    };
  }
}

/**
 * Save batch subject scores directly to Firebase Firestore
 */
export async function saveBatchSubjectScores(payload: {
  session: string;
  term: TermType;
  scores: Array<{
    studentId: string;
    subject: string;
    ca1: number | null;
    ca2: number | null;
    exam: number | null;
    total: number | null;
  }>;
}): Promise<{ success: boolean; message: string }> {
  try {
    const batch = writeBatch(db);

    for (const item of payload.scores) {
      const subj = String(item.subject || '').trim();
      const studentId = String(item.studentId || '').trim();
      if (!subj || !studentId) continue;

      const scoreDocId = getScoreDocId(studentId, payload.session, payload.term, subj);
      const scoreRef = doc(db, 'scores', scoreDocId);

      const ca1 = item.ca1 !== undefined && item.ca1 !== null ? Number(item.ca1) : null;
      const ca2 = item.ca2 !== undefined && item.ca2 !== null ? Number(item.ca2) : null;
      const exam = item.exam !== undefined && item.exam !== null ? Number(item.exam) : null;
      let total = item.total !== undefined && item.total !== null ? Number(item.total) : null;

      if (total === null && (ca1 !== null || ca2 !== null || exam !== null)) {
        total = (ca1 || 0) + (ca2 || 0) + (exam || 0);
      }

      batch.set(
        scoreRef,
        {
          StudentID: studentId,
          Session: payload.session,
          Term: payload.term,
          Subject: subj,
          CA1: ca1,
          CA2: ca2,
          Exam: exam,
          Total: total,
          UpdatedAt: new Date().toISOString()
        },
        { merge: true }
      );
    }

    await batch.commit();

    // Immediately reflect new scores in localStorage cache
    try {
      const currentCache = getCachedSchoolData();
      if (currentCache) {
        const existingScores = currentCache.scores || [];
        const scoreMap = new Map<string, SubjectScore>();
        existingScores.forEach((s) => {
          const k = `${s.StudentID}_${s.Session}_${s.Term}_${s.Subject}`.toLowerCase();
          scoreMap.set(k, s);
        });

        for (const item of payload.scores) {
          const subj = String(item.subject || '').trim();
          const studentId = String(item.studentId || '').trim();
          if (!subj || !studentId) continue;

          const ca1 = item.ca1 !== undefined && item.ca1 !== null ? Number(item.ca1) : null;
          const ca2 = item.ca2 !== undefined && item.ca2 !== null ? Number(item.ca2) : null;
          const exam = item.exam !== undefined && item.exam !== null ? Number(item.exam) : null;
          let total = item.total !== undefined && item.total !== null ? Number(item.total) : null;
          if (total === null && (ca1 !== null || ca2 !== null || exam !== null)) {
            total = (ca1 || 0) + (ca2 || 0) + (exam || 0);
          }

          const k = `${studentId}_${payload.session}_${payload.term}_${subj}`.toLowerCase();
          scoreMap.set(k, {
            StudentID: studentId,
            Session: payload.session,
            Term: payload.term,
            Subject: subj,
            CA1: ca1,
            CA2: ca2,
            Exam: exam,
            Total: total
          });
        }

        setCachedSchoolData({
          ...currentCache,
          scores: Array.from(scoreMap.values())
        });
      }
    } catch (cacheErr) {
      console.warn('Failed to sync cache in saveBatchSubjectScores:', cacheErr);
    }

    return {
      success: true,
      message: 'Scores updated successfully in Firebase Firestore in real time.'
    };
  } catch (err: any) {
    console.error('Failed to batch save scores to Firebase:', err);
    return {
      success: false,
      message: `Failed to save scores: ${err.message || 'Database write error'}`
    };
  }
}

/**
 * Add a new subject to Firebase Firestore
 */
export async function addSubject(subject: {
  SubjectName: string;
  Level: string;
  Class?: string;
}): Promise<{ success: boolean; message: string; subject?: SubjectRule }> {
  try {
    const cleanName = subject.SubjectName.trim();
    const cleanLevel = subject.Level.trim();
    const cleanClass = subject.Class && subject.Class.trim() ? subject.Class.trim() : undefined;

    if (!cleanName) {
      return { success: false, message: 'Subject name is required.' };
    }

    const docId = `${cleanLevel}_${cleanClass ? cleanClass + '_' : ''}${cleanName.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const docRef = doc(db, 'subjects', docId);

    // Build payload without undefined properties (Firestore setDoc rejects objects with undefined values)
    const firestoreData: Record<string, any> = {
      id: docId,
      SubjectName: cleanName,
      Level: cleanLevel
    };

    if (cleanClass) {
      firestoreData.Class = cleanClass;
    }

    await setDoc(docRef, firestoreData, { merge: true });

    const newRule: SubjectRule = {
      id: docId,
      SubjectName: cleanName,
      Level: cleanLevel,
      ...(cleanClass ? { Class: cleanClass } : {})
    };

    // Update in-memory cache if available
    try {
      const currentCache = getCachedSchoolData();
      if (currentCache) {
        const updatedSubjects = currentCache.subjects ? [...currentCache.subjects] : [];
        const existingIdx = updatedSubjects.findIndex(s => s.id === docId);
        if (existingIdx >= 0) {
          updatedSubjects[existingIdx] = newRule;
        } else {
          updatedSubjects.push(newRule);
        }
        setCachedSchoolData({
          ...currentCache,
          subjects: updatedSubjects
        });
      }
    } catch (cacheErr) {
      console.warn('Failed to sync cache for added subject:', cacheErr);
    }

    return {
      success: true,
      message: `Subject "${cleanName}" added successfully to Firebase!`,
      subject: newRule
    };
  } catch (err: any) {
    console.error('Failed to add subject to Firebase:', err);
    return {
      success: false,
      message: `Failed to add subject: ${err.message || 'Database error'}`
    };
  }
}

/**
 * Delete a subject from Firebase Firestore
 */
export async function deleteSubject(
  subjectName: string,
  level?: string,
  className?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const batch = writeBatch(db);
    let count = 0;

    subjectsSnap.forEach((d) => {
      const data = d.data() as SubjectRule;
      const nameMatch = data.SubjectName.trim().toLowerCase() === subjectName.trim().toLowerCase();
      const levelMatch = !level || data.Level.trim().toLowerCase() === level.trim().toLowerCase();
      const classMatch = !className || (data.Class && data.Class.trim().toLowerCase() === className.trim().toLowerCase());

      if (nameMatch && (levelMatch || classMatch)) {
        batch.delete(d.ref);
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();

      // Sync cache
      try {
        const currentCache = getCachedSchoolData();
        if (currentCache && currentCache.subjects) {
          setCachedSchoolData({
            ...currentCache,
            subjects: currentCache.subjects.filter(s => {
              const nameMatch = s.SubjectName.trim().toLowerCase() === subjectName.trim().toLowerCase();
              const levelMatch = !level || s.Level.trim().toLowerCase() === level.trim().toLowerCase();
              const classMatch = !className || (s.Class && s.Class.trim().toLowerCase() === className.trim().toLowerCase());
              return !(nameMatch && (levelMatch || classMatch));
            })
          });
        }
      } catch (cacheErr) {
        console.warn('Failed to sync cache for deleted subject:', cacheErr);
      }

      return {
        success: true,
        message: `Subject "${subjectName}" removed successfully from Firebase (${count} record deleted).`
      };
    } else {
      // If matching by document id directly
      const cleanLevel = level || 'All';
      const docId = `${cleanLevel}_${className ? className + '_' : ''}${subjectName.replace(/[^a-zA-Z0-9]/g, '_')}`;
      await deleteDoc(doc(db, 'subjects', docId));

      try {
        const currentCache = getCachedSchoolData();
        if (currentCache && currentCache.subjects) {
          setCachedSchoolData({
            ...currentCache,
            subjects: currentCache.subjects.filter(s => s.id !== docId)
          });
        }
      } catch (cacheErr) {
        console.warn('Failed to sync cache for deleted subject id:', cacheErr);
      }

      return {
        success: true,
        message: `Subject "${subjectName}" removed from Firebase.`
      };
    }
  } catch (err: any) {
    console.error('Failed to remove subject from Firebase:', err);
    return {
      success: false,
      message: `Failed to remove subject: ${err.message || 'Database error'}`
    };
  }
}

/**
 * Update teacher credentials (username, password, full name, class assigned) in Firebase
 */
export async function updateTeacherCredentials(
  currentUsername: string,
  updates: {
    Username?: string;
    Password?: string;
    FullName?: string;
    ClassAssigned?: string;
    Role?: 'admin' | 'teacher';
    PhotoURL?: string;
    Phone?: string;
  }
): Promise<{ success: boolean; message: string; teacher?: Teacher }> {
  try {
    const oldDocId = getTeacherDocId(currentUsername);
    const oldDocRef = doc(db, 'teachers', oldDocId);
    const oldDocSnap = await getDoc(oldDocRef);

    const existingData = oldDocSnap.exists()
      ? (oldDocSnap.data() as Teacher)
      : INITIAL_DEFAULT_TEACHERS.find(
          (t) => t.Username.toLowerCase() === currentUsername.toLowerCase()
        ) || {
          Username: currentUsername,
          Password: 'password123',
          ClassAssigned: 'Primary 4',
          FullName: 'Staff Teacher'
        };

    const cleanUser = (updates.Username?.trim() || existingData.Username || currentUsername).toLowerCase();
    const isMasterAdmin = cleanUser === 'admin' || updates.Role === 'admin' || existingData.Role === 'admin';

    const previousUsernames = Array.from(
      new Set([
        ...(existingData.PreviousUsernames || []),
        (existingData.Username || '').trim().toLowerCase(),
        currentUsername.trim().toLowerCase()
      ])
    ).filter((u) => u && u !== (updates.Username?.trim() || existingData.Username || currentUsername).toLowerCase());

    const newTeacher: Teacher = {
      ...existingData,
      Username: updates.Username?.trim() || existingData.Username || currentUsername,
      Password: updates.Password !== undefined ? updates.Password.trim() : (existingData.Password || ''),
      FullName: updates.FullName !== undefined ? updates.FullName.trim() : (existingData.FullName || ''),
      ClassAssigned: updates.ClassAssigned?.trim() || existingData.ClassAssigned || (isMasterAdmin ? 'Admin' : ''),
      Role: updates.Role || (isMasterAdmin ? 'admin' : existingData.Role || 'teacher'),
      PhotoURL: updates.PhotoURL !== undefined ? updates.PhotoURL.trim() : (existingData.PhotoURL || ''),
      Phone: updates.Phone !== undefined ? updates.Phone.trim() : (existingData.Phone || ''),
      PreviousUsernames: previousUsernames
    };

    const safeTeacherPayload = cleanFirestorePayload(newTeacher);
    const newDocId = getTeacherDocId(newTeacher.Username);

    if (newDocId !== oldDocId) {
      const batch = writeBatch(db);
      if (oldDocSnap.exists()) {
        batch.delete(oldDocRef);
      }
      batch.set(doc(db, 'teachers', newDocId), safeTeacherPayload);
      // Synchronize class teacher assignment in classes collection
      if (newTeacher.Role !== 'admin' && newTeacher.ClassAssigned && newTeacher.ClassAssigned.toLowerCase() !== 'admin') {
        const clsRef = doc(db, 'classes', getClassDocId(newTeacher.ClassAssigned));
        batch.set(
          clsRef,
          cleanFirestorePayload({
            name: newTeacher.ClassAssigned,
            category: detectClassCategory(newTeacher.ClassAssigned),
            classTeacher: newTeacher.FullName,
            teacherUsername: newTeacher.Username,
            updatedAt: new Date().toISOString()
          }),
          { merge: true }
        );
      }
      await batch.commit();
    } else {
      await setDoc(doc(db, 'teachers', newDocId), safeTeacherPayload, { merge: true });
      if (newTeacher.Role !== 'admin' && newTeacher.ClassAssigned && newTeacher.ClassAssigned.toLowerCase() !== 'admin') {
        const clsRef = doc(db, 'classes', getClassDocId(newTeacher.ClassAssigned));
        await setDoc(
          clsRef,
          cleanFirestorePayload({
            name: newTeacher.ClassAssigned,
            category: detectClassCategory(newTeacher.ClassAssigned),
            classTeacher: newTeacher.FullName,
            teacherUsername: newTeacher.Username,
            updatedAt: new Date().toISOString()
          }),
          { merge: true }
        );
      }
    }

    // Synchronize local cached school data
    const cached = getCachedSchoolData();
    if (cached) {
      const updatedTeachers = (cached.teachers || []).filter(
        (t) =>
          t.Username.toLowerCase() !== currentUsername.toLowerCase() &&
          t.Username.toLowerCase() !== newTeacher.Username.toLowerCase()
      );
      updatedTeachers.push(newTeacher);
      setCachedSchoolData({
        ...cached,
        teachers: updatedTeachers
      });
    }

    return {
      success: true,
      message: `Teacher credentials for ${newTeacher.ClassAssigned} (${newTeacher.Username}) updated successfully!`,
      teacher: newTeacher
    };
  } catch (err: any) {
    console.error('Failed to update teacher credentials in Firebase:', err);
    return {
      success: false,
      message: `Failed to update credentials: ${err.message || 'Firebase error'}`
    };
  }
}

/**
 * Create a brand new teacher/staff account in Firebase Firestore
 */
export async function createTeacher(
  teacher: Teacher
): Promise<{ success: boolean; message: string; teacher?: Teacher }> {
  try {
    const cleanUsername = teacher.Username.trim().toLowerCase();
    if (!cleanUsername) {
      return { success: false, message: 'Username is required.' };
    }

    const docId = getTeacherDocId(cleanUsername);
    const docRef = doc(db, 'teachers', docId);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      return {
        success: false,
        message: `An account with username "${cleanUsername}" already exists.`
      };
    }

    const isMasterAdmin = cleanUsername === 'admin' || teacher.Role === 'admin';

    const newTeacher: Teacher = {
      Username: teacher.Username.trim(),
      Password: teacher.Password ? teacher.Password.trim() : '',
      FullName: teacher.FullName?.trim() || `Teacher (${teacher.ClassAssigned})`,
      ClassAssigned: teacher.ClassAssigned ? teacher.ClassAssigned.trim() : 'Primary 1',
      Role: isMasterAdmin ? 'admin' : 'teacher',
      PhotoURL: teacher.PhotoURL?.trim() || '',
      Phone: teacher.Phone?.trim() || '',
      PreviousUsernames: []
    };

    await setDoc(docRef, cleanFirestorePayload(newTeacher));
    return {
      success: true,
      message: `Staff account "${newTeacher.FullName}" (${newTeacher.Username}) created successfully!`,
      teacher: newTeacher
    };
  } catch (err: any) {
    console.error('Failed to create teacher in Firebase:', err);
    return {
      success: false,
      message: `Failed to create teacher: ${err.message || 'Firebase error'}`
    };
  }
}

/**
 * Delete a teacher account from Firebase Firestore
 */
export async function deleteTeacher(
  username: string
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername === 'admin') {
      return {
        success: false,
        message: 'Cannot delete the primary Administrator account.'
      };
    }
    const docId = getTeacherDocId(cleanUsername);
    await deleteDoc(doc(db, 'teachers', docId));
    return {
      success: true,
      message: `Teacher account "${username}" has been removed.`
    };
  } catch (err: any) {
    console.error('Failed to delete teacher:', err);
    return {
      success: false,
      message: `Failed to delete teacher: ${err.message || 'Firebase error'}`
    };
  }
}

/**
 * Reset all student passwords for an entire class in Firebase
 */
export async function resetClassStudentPasswords(
  className: string,
  newPassword = 'password'
): Promise<{ success: boolean; message: string; count: number }> {
  try {
    const batch = writeBatch(db);
    const stSnap = await getDocs(collection(db, 'students'));
    let matchedCount = 0;

    stSnap.forEach((docSnap) => {
      const data = docSnap.data() as Student;
      if (className === 'all' || isMatchingClass(data.Class, className)) {
        batch.update(docSnap.ref, { Password: newPassword });
        matchedCount++;
      }
    });

    if (matchedCount > 0) {
      await batch.commit();
    }

    return {
      success: true,
      message: `Reset passwords for ${matchedCount} pupil(s) in ${className === 'all' ? 'all classes' : className} to "${newPassword}".`,
      count: matchedCount
    };
  } catch (err: any) {
    console.error('Failed to batch reset student passwords:', err);
    return {
      success: false,
      message: `Failed to reset passwords: ${err.message || 'Firebase error'}`,
      count: 0
    };
  }
}

/**
 * Update student password in Firebase Firestore
 */
export async function updateStudentPassword(
  studentId: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  try {
    const studentDocId = getStudentDocId(studentId);
    const studentDocRef = doc(db, 'students', studentDocId);
    const snap = await getDoc(studentDocRef);

    if (!snap.exists()) {
      // Find in default if not yet created
      const defStudent = INITIAL_DEFAULT_STUDENTS.find((s) => s.StudentID.toLowerCase() === studentId.toLowerCase());
      if (defStudent) {
        await setDoc(studentDocRef, { ...defStudent, Password: newPassword.trim() }, { merge: true });
        return {
          success: true,
          message: 'Password created and updated successfully in Firebase.'
        };
      }
      return { success: false, message: 'Student record not found.' };
    }

    await setDoc(studentDocRef, { Password: newPassword.trim() }, { merge: true });

    return {
      success: true,
      message: 'Your password has been changed successfully in Firebase Firestore.'
    };
  } catch (err: any) {
    console.error('Failed to update student password in Firebase:', err);
    return {
      success: false,
      message: `Failed to change password: ${err.message || 'Firebase error'}`
    };
  }
}

/**
 * Clear all mock students, score records, and pupil summaries from Firestore database
 * Keeps valid curriculum subjects and authentic staff accounts intact.
 */
export async function clearAllMockData(): Promise<{ success: boolean; message: string; counts: { students: number; scores: number; summaries: number } }> {
  try {
    const [stSnap, scSnap, sumSnap, pubSnap] = await Promise.all([
      getDocs(collection(db, 'students')),
      getDocs(collection(db, 'scores')),
      getDocs(collection(db, 'summaries')),
      getDocs(collection(db, 'published'))
    ]);

    const counts = {
      students: stSnap.size,
      scores: scSnap.size,
      summaries: sumSnap.size
    };

    // Delete in batches
    const deleteBatches = async (docs: any[]) => {
      const CHUNK = 400;
      for (let i = 0; i < docs.length; i += CHUNK) {
        const batch = writeBatch(db);
        docs.slice(i, i + CHUNK).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    };

    await Promise.all([
      deleteBatches(stSnap.docs),
      deleteBatches(scSnap.docs),
      deleteBatches(sumSnap.docs),
      deleteBatches(pubSnap.docs)
    ]);

    // Clear local storage cache
    inMemoryPublished = [];
    safeStorage.removeItem(LIVE_DATA_CACHE_KEY);

    return {
      success: true,
      message: `Cleaned out mock data: removed ${counts.students} mock student records, ${counts.scores} test scores, and ${counts.summaries} summaries. The system is ready for live student enrollments.`,
      counts
    };
  } catch (err: any) {
    console.error('Failed to clear mock data from Firestore:', err);
    // Even if firestore offline, clear local storage
    safeStorage.removeItem(LIVE_DATA_CACHE_KEY);
    return {
      success: true,
      message: 'Local mock storage purged. App is ready for live student data.',
      counts: { students: 0, scores: 0, summaries: 0 }
    };
  }
}

/**
 * Get quick count of documents across Firestore collections for Admin Center
 */
export async function getDatabaseStats(): Promise<{
  teachersCount: number;
  studentsCount: number;
  subjectsCount: number;
  scoresCount: number;
  summariesCount: number;
  publishedCount: number;
}> {
  try {
    const [t, st, sub, sc, sum, pub] = await Promise.all([
      getDocs(collection(db, 'teachers')),
      getDocs(collection(db, 'students')),
      getDocs(collection(db, 'subjects')),
      getDocs(collection(db, 'scores')),
      getDocs(collection(db, 'summaries')),
      getDocs(collection(db, 'published'))
    ]);

    return {
      teachersCount: t.size,
      studentsCount: st.size,
      subjectsCount: sub.size,
      scoresCount: sc.size,
      summariesCount: sum.size,
      publishedCount: pub.size
    };
  } catch {
    const cached = getCachedSchoolData();
    return {
      teachersCount: cached?.teachers.length || INITIAL_DEFAULT_TEACHERS.length,
      studentsCount: cached?.students.length || INITIAL_DEFAULT_STUDENTS.length,
      subjectsCount: cached?.subjects.length || INITIAL_DEFAULT_SUBJECTS.length,
      scoresCount: cached?.scores.length || INITIAL_DEFAULT_SCORES.length,
      summariesCount: cached?.summaries.length || INITIAL_DEFAULT_SUMMARIES.length,
      publishedCount: cached?.published.length || INITIAL_DEFAULT_PUBLISHED.length
    };
  }
}

/**
 * Fetch all classes from Firestore
 */
export async function fetchClasses(): Promise<ClassRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'classes'));
    const classes: ClassRecord[] = [];
    snap.forEach((d) => {
      const data = d.data() as ClassRecord;
      classes.push({
        ...data,
        id: d.id,
        category: data.category || detectClassCategory(data.name)
      });
    });

    const sorted = sortSchoolClasses(classes.length > 0 ? classes : INITIAL_DEFAULT_CLASSES);
    return sorted;
  } catch (err) {
    console.error('Failed to fetch classes from Firestore:', err);
    const cached = getCachedSchoolData();
    return cached?.classes || INITIAL_DEFAULT_CLASSES;
  }
}

/**
 * Add / Save a Class to Firestore
 */
export async function saveClass(classData: {
  name: string;
  category?: ClassCategory;
  classTeacher?: string;
  order?: number;
  description?: string;
}): Promise<{ success: boolean; message: string; classRecord?: ClassRecord }> {
  try {
    const trimmedName = classData.name.trim();
    if (!trimmedName) {
      return { success: false, message: 'Class name cannot be empty.' };
    }
    if (trimmedName.toLowerCase() === 'admin') {
      return { success: false, message: '"Admin" is a reserved administrative role, not a class name.' };
    }

    const category = classData.category || detectClassCategory(trimmedName);
    const docId = getClassDocId(trimmedName);
    const classDocRef = doc(db, 'classes', docId);

    const record: ClassRecord = {
      id: docId,
      name: trimmedName,
      category,
      order: classData.order || 99,
      classTeacher: classData.classTeacher || '',
      description: classData.description || '',
      updatedAt: new Date().toISOString()
    };

    const existingDoc = await getDoc(classDocRef);
    if (!existingDoc.exists()) {
      record.createdAt = new Date().toISOString();
    }

    await setDoc(classDocRef, record, { merge: true });

    // If a class teacher username was chosen, assign the teacher to this class
    if (classData.classTeacher) {
      const tSnap = await getDocs(collection(db, 'teachers'));
      tSnap.forEach(async (d) => {
        const t = d.data() as Teacher;
        if (t.Username.toLowerCase() === classData.classTeacher?.toLowerCase() && t.Role !== 'admin') {
          await setDoc(doc(db, 'teachers', d.id), { ClassAssigned: trimmedName }, { merge: true });
        }
      });
    }

    // Refresh dynamic in-memory list and cache
    if (!ALL_SCHOOL_CLASSES.some(c => c.toLowerCase() === trimmedName.toLowerCase())) {
      ALL_SCHOOL_CLASSES.push(trimmedName);
      ALL_SCHOOL_CLASSES = sortClassNames(ALL_SCHOOL_CLASSES);
    }

    const cached = getCachedSchoolData();
    if (cached) {
      const existing = (cached.classes || []).filter(c => c.name.toLowerCase() !== trimmedName.toLowerCase());
      existing.push(record);
      const sorted = sortSchoolClasses(existing);
      setCachedSchoolData({
        ...cached,
        classes: sorted,
        classNames: sorted.map(c => c.name)
      });
    }

    return {
      success: true,
      message: `Class "${trimmedName}" (${category}) has been created successfully.`,
      classRecord: record
    };
  } catch (err: any) {
    console.error('Failed to save class to Firestore:', err);
    return {
      success: false,
      message: `Error creating class: ${err.message || 'Firebase error'}`
    };
  }
}

/**
 * Delete a Class from Firestore with student reassignment or purge options
 */
export async function deleteClass(
  className: string,
  options?: {
    reassignStudentsTo?: string;
    deleteStudents?: boolean;
  }
): Promise<{ success: boolean; message: string }> {
  try {
    const trimmedName = className.trim();
    if (!trimmedName) {
      return { success: false, message: 'Class name is required.' };
    }
    if (trimmedName.toLowerCase() === 'admin') {
      return { success: false, message: 'Cannot delete the "Admin" system role.' };
    }

    // Check enrolled students
    const studentsSnap = await getDocs(
      query(collection(db, 'students'), where('Class', '==', trimmedName))
    );

    // If students are enrolled and no action specified
    if (!studentsSnap.empty && !options?.reassignStudentsTo && !options?.deleteStudents) {
      return {
        success: false,
        message: `Class "${trimmedName}" currently has ${studentsSnap.size} enrolled student(s). Please choose a class to reassign them to or confirm pupil deletion.`
      };
    }

    const batch = writeBatch(db);

    // 1. Reassign or delete students
    if (options?.reassignStudentsTo && options.reassignStudentsTo.trim()) {
      const targetClass = options.reassignStudentsTo.trim();
      studentsSnap.forEach((d) => {
        batch.update(d.ref, {
          Class: targetClass,
          UpdatedAt: new Date().toISOString()
        });
      });
    } else if (options?.deleteStudents) {
      // Delete students and their scores/summaries
      studentsSnap.forEach((d) => {
        batch.delete(d.ref);
      });
      for (const d of studentsSnap.docs) {
        const st = d.data() as Student;
        const [scSnap, sumSnap] = await Promise.all([
          getDocs(query(collection(db, 'scores'), where('StudentID', '==', st.StudentID))),
          getDocs(query(collection(db, 'summaries'), where('StudentID', '==', st.StudentID)))
        ]);
        scSnap.forEach(s => batch.delete(s.ref));
        sumSnap.forEach(s => batch.delete(s.ref));
      }
    }

    // 2. Unassign any teachers currently assigned to this class
    const teachersSnap = await getDocs(collection(db, 'teachers'));
    teachersSnap.forEach((d) => {
      const t = d.data() as Teacher;
      if (isMatchingClass(t.ClassAssigned, trimmedName) && t.Role !== 'admin') {
        batch.update(d.ref, { ClassAssigned: 'Unassigned' });
      }
    });

    // 3. Delete published records for this class
    const pubSnap = await getDocs(collection(db, 'published'));
    pubSnap.forEach((d) => {
      const p = d.data() as PublishedRecord;
      if (isMatchingClass(p.className, trimmedName)) {
        batch.delete(d.ref);
      }
    });

    // 4. Delete the class document from `classes`
    const docId = getClassDocId(trimmedName);
    const classDocRef = doc(db, 'classes', docId);
    batch.delete(classDocRef);

    await batch.commit();

    // Update in-memory ALL_SCHOOL_CLASSES
    const remainingNames = ALL_SCHOOL_CLASSES.filter(c => c.toLowerCase() !== trimmedName.toLowerCase());
    ALL_SCHOOL_CLASSES.length = 0;
    ALL_SCHOOL_CLASSES.push(...remainingNames);

    // Update local cache
    const cached = getCachedSchoolData();
    if (cached) {
      const updatedClasses = (cached.classes || []).filter(c => c.name.toLowerCase() !== trimmedName.toLowerCase());
      setCachedSchoolData({
        ...cached,
        classes: updatedClasses,
        classNames: updatedClasses.map(c => c.name)
      });
    }

    return {
      success: true,
      message: `Class "${trimmedName}" has been successfully deleted from the school registry.`
    };
  } catch (err: any) {
    console.error('Failed to delete class from Firestore:', err);
    return {
      success: false,
      message: `Error deleting class: ${err.message || 'Firebase error'}`
    };
  }
}

/**
 * Update / Rename a Class in Firestore and migrate all references
 */
export async function updateClass(
  originalName: string,
  updatedData: {
    name: string;
    category?: ClassCategory;
    classTeacher?: string;
    description?: string;
  }
): Promise<{ success: boolean; message: string; classRecord?: ClassRecord }> {
  try {
    const oldName = originalName.trim();
    const newName = updatedData.name.trim();

    if (!newName) {
      return { success: false, message: 'Class name cannot be empty.' };
    }
    if (newName.toLowerCase() === 'admin') {
      return { success: false, message: '"Admin" is a reserved administrative role, not a class name.' };
    }

    const category = updatedData.category || detectClassCategory(newName);
    const newDocId = getClassDocId(newName);
    const oldDocId = getClassDocId(oldName);

    const record: ClassRecord = {
      id: newDocId,
      name: newName,
      category,
      classTeacher: updatedData.classTeacher || '',
      description: updatedData.description || '',
      updatedAt: new Date().toISOString()
    };

    const batch = writeBatch(db);

    // If name changed, migrate all references
    if (oldName.toLowerCase() !== newName.toLowerCase()) {
      // 1. Delete old class doc
      batch.delete(doc(db, 'classes', oldDocId));

      // 2. Migrate students
      const studentsSnap = await getDocs(
        query(collection(db, 'students'), where('Class', '==', oldName))
      );
      studentsSnap.forEach((d) => {
        batch.update(d.ref, { Class: newName, UpdatedAt: new Date().toISOString() });
      });

      // 3. Migrate teachers
      const teachersSnap = await getDocs(collection(db, 'teachers'));
      teachersSnap.forEach((d) => {
        const t = d.data() as Teacher;
        if (isMatchingClass(t.ClassAssigned, oldName) && t.Role !== 'admin') {
          batch.update(d.ref, { ClassAssigned: newName });
        }
      });

      // 4. Migrate published records
      const pubSnap = await getDocs(collection(db, 'published'));
      pubSnap.forEach((d) => {
        const p = d.data() as PublishedRecord;
        if (isMatchingClass(p.className, oldName)) {
          batch.update(d.ref, { className: newName, classKey: `${newName}_${p.term}_${p.session}` });
        }
      });
    }

    // Set new class doc
    batch.set(doc(db, 'classes', newDocId), record, { merge: true });

    // If a classTeacher is assigned, update that teacher
    if (updatedData.classTeacher) {
      const teachersSnap = await getDocs(collection(db, 'teachers'));
      teachersSnap.forEach((d) => {
        const t = d.data() as Teacher;
        if (t.Username.toLowerCase() === updatedData.classTeacher?.toLowerCase() && t.Role !== 'admin') {
          batch.update(d.ref, { ClassAssigned: newName });
        }
      });
    }

    await batch.commit();

    // Update in-memory ALL_SCHOOL_CLASSES
    const filtered = ALL_SCHOOL_CLASSES.filter(c => c.toLowerCase() !== oldName.toLowerCase());
    filtered.push(newName);
    ALL_SCHOOL_CLASSES.length = 0;
    ALL_SCHOOL_CLASSES.push(...sortClassNames(filtered));

    // Update local cache
    const cached = getCachedSchoolData();
    if (cached) {
      const existing = (cached.classes || []).filter(c => c.name.toLowerCase() !== oldName.toLowerCase());
      existing.push(record);
      const sorted = sortSchoolClasses(existing);
      setCachedSchoolData({
        ...cached,
        classes: sorted,
        classNames: sorted.map(c => c.name)
      });
    }

    return {
      success: true,
      message: `Class updated successfully from "${oldName}" to "${newName}".`,
      classRecord: record
    };
  } catch (err: any) {
    console.error('Failed to update class in Firestore:', err);
    return {
      success: false,
      message: `Error updating class: ${err.message || 'Firebase error'}`
    };
  }
}

/**
 * Fetch Custom Academic Grading Scales from Firestore Settings
 */
export async function fetchGradingScales(): Promise<GradingScaleItem[]> {
  try {
    const docRef = doc(db, 'settings', 'academic_grading');
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data()?.scales) {
      const scales = snap.data()?.scales as GradingScaleItem[];
      setActiveGradingScales(scales);
      return scales;
    }
    return DEFAULT_GENERAL_GRADING_SCALE;
  } catch (err) {
    console.warn('Failed to fetch grading scales from Firebase:', err);
    return getActiveGradingScales();
  }
}

/**
 * Save / Update Custom Academic Grading Scales to Firestore Settings
 * Accessible by Teachers and School Administrators
 */
export async function saveGradingScales(
  scales: GradingScaleItem[],
  updatedBy?: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (!scales || scales.length === 0) {
      return { success: false, message: 'Grading scale cannot be empty.' };
    }

    // Validate score ranges
    for (const item of scales) {
      if (item.minScore < 0 || item.maxScore > 100 || item.minScore > item.maxScore) {
        return {
          success: false,
          message: `Invalid score range for grade ${item.grade}: ${item.minScore} - ${item.maxScore}.`
        };
      }
      if (!item.grade.trim()) {
        return { success: false, message: 'Grade label is required for all scale tiers.' };
      }
    }

    const docRef = doc(db, 'settings', 'academic_grading');
    await setDoc(
      docRef,
      {
        scales,
        updatedAt: new Date().toISOString(),
        updatedBy: updatedBy || 'Staff / Admin'
      },
      { merge: true }
    );

    setActiveGradingScales(scales);

    // Update cache
    const cached = getCachedSchoolData();
    if (cached) {
      setCachedSchoolData({
        ...cached,
        gradingScales: scales
      });
    }

    return {
      success: true,
      message: `Academic grading scales (${scales.length} tiers) successfully saved to Firebase Firestore!`
    };
  } catch (err: any) {
    console.error('Failed to save grading scales in Firebase:', err);
    return {
      success: false,
      message: `Failed to save grading scales: ${err.message || 'Firebase error'}`
    };
  }
}

/**
 * Format Attendance Doc ID helper
 */
export function getAttendanceDocId(className: string, session: string, term: TermType, date: string): string {
  const cleanClass = className.replace(/[^a-zA-Z0-9]/g, '_');
  const cleanSession = session.replace(/[^a-zA-Z0-9]/g, '_');
  const cleanTerm = term.replace(/[^a-zA-Z0-9]/g, '_');
  const cleanDate = date.replace(/[^a-zA-Z0-9]/g, '_');
  return `${cleanClass}__${cleanSession}__${cleanTerm}__${cleanDate}`;
}

/**
 * Save Daily Attendance Record in Firebase Firestore
 */
export async function saveDailyAttendance(
  record: DailyAttendanceRecord
): Promise<{ success: boolean; message: string; record?: DailyAttendanceRecord }> {
  try {
    const docId = getAttendanceDocId(record.className, record.session, record.term, record.date);
    const docRef = doc(db, 'attendance', docId);

    const dataToSave: DailyAttendanceRecord = {
      ...record,
      id: docId,
      updatedAt: new Date().toISOString()
    };

    await setDoc(docRef, dataToSave, { merge: true });

    return {
      success: true,
      message: `Daily attendance for ${record.className} on ${record.date} saved successfully to Firestore!`,
      record: dataToSave
    };
  } catch (err: any) {
    console.error('Failed to save attendance in Firestore:', err);
    return {
      success: false,
      message: `Failed to save attendance: ${err.message || 'Firebase error'}`
    };
  }
}

/**
 * Fetch Daily Attendance Records for a class, session, and term
 */
export async function fetchAttendanceRecords(
  className: string,
  session: string,
  term: TermType
): Promise<DailyAttendanceRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'attendance'));
    const records: DailyAttendanceRecord[] = [];

    snap.forEach((d) => {
      const data = d.data() as DailyAttendanceRecord;
      if (
        isMatchingClass(data.className, className) &&
        (data.session === session || !data.session) &&
        data.term === term
      ) {
        records.push({
          ...data,
          id: d.id
        });
      }
    });

    // Sort chronologically ascending
    return records.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  } catch (err) {
    console.warn('Failed to fetch attendance records from Firestore:', err);
    return [];
  }
}

/**
 * Sync / Tally Attendance directly onto student report cards (StudentSummary)
 * Computes Days Present & Days Opened and saves them to student summaries in Firestore
 */
export async function syncAttendanceToReportCards(
  className: string,
  session: string,
  term: TermType,
  options?: {
    defaultDaysOpened?: number;
    manualTallies?: Record<string, { daysPresent: number; daysOpened: number }>;
  }
): Promise<{ success: boolean; message: string; count: number }> {
  try {
    // 1. Fetch students for this class
    const stSnap = await getDocs(collection(db, 'students'));
    const classStudents: Student[] = [];
    stSnap.forEach((d) => {
      const st = d.data() as Student;
      if (isMatchingClass(st.Class, className)) {
        classStudents.push(st);
      }
    });

    if (classStudents.length === 0) {
      return { success: false, message: `No students found in ${className}.`, count: 0 };
    }

    // 2. Fetch daily attendance records if no manual override provided
    const dailyRecords = await fetchAttendanceRecords(className, session, term);
    const totalDaysRecorded = dailyRecords.length;
    const defaultDaysOpened = options?.defaultDaysOpened || (totalDaysRecorded > 0 ? totalDaysRecorded : 60);

    const batch = writeBatch(db);
    let updatedCount = 0;

    for (const student of classStudents) {
      let daysPresent = 0;
      let daysOpened = defaultDaysOpened;

      if (options?.manualTallies && options.manualTallies[student.StudentID]) {
        daysPresent = options.manualTallies[student.StudentID].daysPresent;
        daysOpened = options.manualTallies[student.StudentID].daysOpened || defaultDaysOpened;
      } else if (dailyRecords.length > 0) {
        // Tally from daily records
        daysPresent = dailyRecords.filter((rec) => {
          const entry = rec.entries?.find(
            (e) => (e.studentId || '').toLowerCase() === student.StudentID.toLowerCase()
          );
          return entry && (entry.status === 'Present' || entry.status === 'Late');
        }).length;
        daysOpened = Math.max(dailyRecords.length, defaultDaysOpened);
      } else {
        // Fallback default
        daysPresent = defaultDaysOpened;
      }

      const summaryDocId = getSummaryDocId(student.StudentID, session, term);
      const summaryDocRef = doc(db, 'summaries', summaryDocId);

      batch.set(
        summaryDocRef,
        {
          StudentID: student.StudentID,
          Session: session,
          Term: term,
          DaysPresent: daysPresent,
          DaysOpened: daysOpened,
          UpdatedAt: new Date().toISOString()
        },
        { merge: true }
      );
      updatedCount++;
    }

    if (updatedCount > 0) {
      await batch.commit();
    }

    return {
      success: true,
      message: `Successfully tallied attendance (Days Present & Days Opened) for ${updatedCount} pupils in ${className} directly onto their report cards!`,
      count: updatedCount
    };
  } catch (err: any) {
    console.error('Failed to sync attendance to report cards:', err);
    return {
      success: false,
      message: `Failed to tally attendance: ${err.message || 'Firebase error'}`,
      count: 0
    };
  }
}

/**
 * Execute Session Rollover & Promotion Engine
 * Promotes students (e.g. Basic 1 → Basic 2, JSS 3 → SSS 1), archives graduating classes (SSS 3 → Graduated Alumni),
 * updates student classes in Firestore, updates student summary promotion decisions, and logs the execution.
 */
export async function executeSessionRollover(options: {
  currentSession: string;
  nextSession: string;
  studentDecisions: RolloverStudentDecision[];
  executedBy?: string;
  notes?: string;
}): Promise<{
  success: boolean;
  message: string;
  summary: {
    total: number;
    promoted: number;
    repeated: number;
    graduated: number;
  };
}> {
  try {
    const { currentSession, nextSession, studentDecisions, executedBy, notes } = options;
    if (!studentDecisions || studentDecisions.length === 0) {
      return {
        success: false,
        message: 'No student promotion decisions provided for rollover.',
        summary: { total: 0, promoted: 0, repeated: 0, graduated: 0 }
      };
    }

    const stSnap = await getDocs(collection(db, 'students'));
    const studentDocMap = new Map<string, any>();
    stSnap.forEach((d) => {
      const data = d.data() as Student;
      studentDocMap.set(data.StudentID.toUpperCase().trim(), d.ref);
    });

    const batch = writeBatch(db);
    let promoted = 0;
    let repeated = 0;
    let graduated = 0;

    for (const dec of studentDecisions) {
      const cleanId = dec.studentId.toUpperCase().trim();
      const stRef = studentDocMap.get(cleanId);
      if (!stRef) continue;

      let newClass = dec.currentClass;
      let finalDecisionText = dec.promotionDecisionText || 'Promoted';

      if (dec.action === 'Promote' || dec.action === 'PromoteOnTrial' || dec.action === 'Custom') {
        newClass = dec.targetClass;
        finalDecisionText = `Promoted to ${dec.targetClass}`;
        promoted++;
      } else if (dec.action === 'Repeat') {
        newClass = dec.currentClass;
        finalDecisionText = `Advised to Repeat ${dec.currentClass}`;
        repeated++;
      } else if (dec.action === 'Graduate') {
        newClass = 'Graduated (Alumni)';
        finalDecisionText = 'Graduated';
        graduated++;
      }

      // Update Student's enrolled class in students collection
      batch.update(stRef, {
        Class: newClass,
        UpdatedAt: new Date().toISOString()
      });

      // Save promotion decision in currentSession's Third Term StudentSummary
      const summaryDocId = getSummaryDocId(dec.studentId, currentSession, 'Third Term');
      const summaryDocRef = doc(db, 'summaries', summaryDocId);
      batch.set(
        summaryDocRef,
        {
          StudentID: dec.studentId,
          Session: currentSession,
          Term: 'Third Term' as TermType,
          PromotionDecision: finalDecisionText,
          UpdatedAt: new Date().toISOString()
        },
        { merge: true }
      );
    }

    // Save Rollover History Log in settings/rollover_history
    const historyDocId = `rollover_${currentSession.replace(/[^a-zA-Z0-9]/g, '_')}_to_${nextSession.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
    const historyRef = doc(db, 'settings', 'rollover_history');
    const historySnap = await getDoc(historyRef);
    const existingLogs: RolloverHistoryRecord[] = historySnap.exists() ? (historySnap.data()?.logs || []) : [];

    const newLog: RolloverHistoryRecord = {
      id: historyDocId,
      timestamp: new Date().toISOString(),
      fromSession: currentSession,
      toSession: nextSession,
      promotedCount: promoted,
      repeatedCount: repeated,
      graduatedCount: graduated,
      executedBy: executedBy || 'Administrator',
      notes: notes || `Annual Rollover from ${currentSession} to ${nextSession}`
    };

    batch.set(historyRef, {
      logs: [newLog, ...existingLogs],
      lastRollover: newLog,
      currentActiveSession: nextSession,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    await batch.commit();

    return {
      success: true,
      message: `Academic Session Rollover Completed! Successfully transitioned ${promoted} pupils to next grade level, held ${repeated} repeaters, and archived ${graduated} graduating pupils into Alumni.`,
      summary: {
        total: studentDecisions.length,
        promoted,
        repeated,
        graduated
      }
    };
  } catch (err: any) {
    console.error('Failed to execute session rollover:', err);
    return {
      success: false,
      message: `Failed to execute session rollover: ${err.message || 'Firebase error'}`,
      summary: { total: 0, promoted: 0, repeated: 0, graduated: 0 }
    };
  }
}

/**
 * Fetch Session Rollover Logs & History
 */
export async function fetchRolloverHistory(): Promise<RolloverHistoryRecord[]> {
  try {
    const historyRef = doc(db, 'settings', 'rollover_history');
    const snap = await getDoc(historyRef);
    if (snap.exists() && snap.data()?.logs) {
      return snap.data()?.logs as RolloverHistoryRecord[];
    }
    return [];
  } catch (err) {
    console.warn('Failed to fetch rollover history from Firebase:', err);
    return [];
  }
}

/**
 * Get Cached Website Configuration immediately from localStorage
 */
export function getCachedWebsiteConfig(): WebsiteConfig | null {
  try {
    const cached = safeStorage.getItem(WEBSITE_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed) {
        if (parsed.enableFacilities === undefined) {
          parsed.enableFacilities = false;
        }
        if (parsed.enableGallery === undefined) {
          parsed.enableGallery = false;
        }
        if (!parsed.gallery || parsed.gallery.length === 0) {
          parsed.gallery = DEFAULT_WEBSITE_CONFIG.gallery;
        }
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_WEBSITE_CONFIG;
}

/**
 * Recursively strips any undefined values from an object before passing to Firestore setDoc/updateDoc.
 * Firestore strictly rejects undefined field values.
 */
export function cleanFirestorePayload<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return (obj === undefined ? '' : null) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanFirestorePayload(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanFirestorePayload(value);
      } else {
        cleaned[key] = ''; // Convert undefined fields to empty string instead of undefined
      }
    }
    return cleaned as T;
  }
  return obj;
}

/**
 * Fetch Public Website Configuration from Firestore
 */
export async function fetchWebsiteConfig(): Promise<WebsiteConfig> {
  try {
    const websiteDocRef = doc(db, 'settings', 'website_config');
    const snap = await getDoc(websiteDocRef);
    if (snap.exists()) {
      const data = snap.data() as WebsiteConfig;
      // Merge with defaults to ensure all required fields and facilities exist
      const merged: WebsiteConfig = {
        ...DEFAULT_WEBSITE_CONFIG,
        ...data,
        stampLogoUrl: data.stampLogoUrl || DEFAULT_WEBSITE_CONFIG.stampLogoUrl || '',
        enableFacilities: data.enableFacilities === true,
        enableGallery: data.enableGallery === true,
        facilities: data.facilities && data.facilities.length > 0 ? data.facilities : DEFAULT_WEBSITE_CONFIG.facilities,
        gallery: data.gallery && data.gallery.length > 0 ? data.gallery : DEFAULT_WEBSITE_CONFIG.gallery,
        programmes: data.programmes && data.programmes.length > 0 ? data.programmes : DEFAULT_WEBSITE_CONFIG.programmes,
        values: data.values && data.values.length > 0 ? data.values : DEFAULT_WEBSITE_CONFIG.values,
        announcements: data.announcements && data.announcements.length > 0 ? data.announcements : DEFAULT_WEBSITE_CONFIG.announcements
      };

      safeStorage.setItem(WEBSITE_CACHE_KEY, JSON.stringify(merged));
      saveSchoolBrandingLocally(merged);
      return merged;
    }

    // If not yet saved in Firestore, store defaults
    await setDoc(websiteDocRef, cleanFirestorePayload(DEFAULT_WEBSITE_CONFIG), { merge: true });
    safeStorage.setItem(WEBSITE_CACHE_KEY, JSON.stringify(DEFAULT_WEBSITE_CONFIG));
    saveSchoolBrandingLocally(DEFAULT_WEBSITE_CONFIG);
    return DEFAULT_WEBSITE_CONFIG;
  } catch (err) {
    console.warn('Failed to fetch website config from Firestore, loading local cache:', err);
    try {
      const cached = safeStorage.getItem(WEBSITE_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed) {
          saveSchoolBrandingLocally(parsed);
          return parsed;
        }
      }
    } catch {}
    return DEFAULT_WEBSITE_CONFIG;
  }
}

/**
 * Save & Publish Website Configuration to Firestore Live Website
 */
export async function saveWebsiteConfig(
  config: Partial<WebsiteConfig> | WebsiteConfig,
  publishedBy = 'Administrator'
): Promise<{ success: boolean; message: string; config: WebsiteConfig }> {
  try {
    const base = getCachedWebsiteConfig() || DEFAULT_WEBSITE_CONFIG;
    const updatedConfig: WebsiteConfig = {
      ...base,
      ...config,
      stampLogoUrl: config.stampLogoUrl !== undefined ? config.stampLogoUrl : (base.stampLogoUrl || ''),
      lastPublishedAt: new Date().toISOString(),
      lastPublishedBy: publishedBy
    };

    const cleanPayload = cleanFirestorePayload(updatedConfig);
    const websiteDocRef = doc(db, 'settings', 'website_config');
    await setDoc(websiteDocRef, cleanPayload, { merge: true });

    safeStorage.setItem(WEBSITE_CACHE_KEY, JSON.stringify(updatedConfig));
    saveSchoolBrandingLocally(updatedConfig);

    return {
      success: true,
      message: 'Website changes and branding updates successfully published to the live school website!',
      config: updatedConfig
    };
  } catch (err: any) {
    console.error('Failed to publish website config to Firestore:', err);
    const base = getCachedWebsiteConfig() || DEFAULT_WEBSITE_CONFIG;
    const merged: WebsiteConfig = {
      ...base,
      ...config,
      stampLogoUrl: config.stampLogoUrl !== undefined ? config.stampLogoUrl : (base.stampLogoUrl || '')
    };
    safeStorage.setItem(WEBSITE_CACHE_KEY, JSON.stringify(merged));
    saveSchoolBrandingLocally(merged);
    return {
      success: true,
      message: 'Website configuration saved to local cache (Firebase offline).',
      config: merged
    };
  }
}

/**
 * Reset Website Configuration back to default template preset
 */
export async function resetWebsiteConfig(): Promise<{ success: boolean; message: string; config: WebsiteConfig }> {
  try {
    const websiteDocRef = doc(db, 'settings', 'website_config');
    await setDoc(websiteDocRef, cleanFirestorePayload(DEFAULT_WEBSITE_CONFIG), { merge: false });

    safeStorage.setItem(WEBSITE_CACHE_KEY, JSON.stringify(DEFAULT_WEBSITE_CONFIG));

    return {
      success: true,
      message: 'Website content and facilities successfully reset to default template.',
      config: DEFAULT_WEBSITE_CONFIG
    };
  } catch (err: any) {
    console.error('Failed to reset website config in Firestore:', err);
    safeStorage.setItem(WEBSITE_CACHE_KEY, JSON.stringify(DEFAULT_WEBSITE_CONFIG));
    return {
      success: true,
      message: 'Website content reset locally.',
      config: DEFAULT_WEBSITE_CONFIG
    };
  }
}

/**
 * Alias object export for seamless compatibility
 */
export const FirebaseService = {
  isConfigured: () => true,
  loadAllData,
  fetchClasses,
  saveClass,
  deleteClass,
  updateClass,
  fetchFreshStudentData,
  saveStudentReportCard,
  saveBatchSubjectScores,
  deleteStudentReportCard,
  saveStudent,
  updateStudentProfileAndIdentifier,
  promoteClassStudents,
  resetAllStaffPasswords,
  addStudent,
  deleteStudent,
  bulkUploadStudents,
  restoreSchoolBackup,
  addSubject,
  deleteSubject,
  updateTeacherCredentials,
  createTeacher,
  deleteTeacher,
  resetClassStudentPasswords,
  updateStudentPassword,
  getPublishedRecords,
  isClassResultPublished,
  subscribeToPublishedRecords,
  setClassPublishStatus,
  fetchGradingScales,
  saveGradingScales,
  saveDailyAttendance,
  fetchAttendanceRecords,
  syncAttendanceToReportCards,
  executeSessionRollover,
  fetchRolloverHistory,
  getCachedWebsiteConfig,
  fetchWebsiteConfig,
  saveWebsiteConfig,
  resetWebsiteConfig,
  clearAllMockData,
  seedInitialDatabase,
  getDatabaseStats
};

// Also export as SheetService alias so any residual imports resolve cleanly
export const SheetService = FirebaseService;
export const INITIAL_MOCK_SUBJECTS = INITIAL_DEFAULT_SUBJECTS;
