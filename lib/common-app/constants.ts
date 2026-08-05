/**
 * The Common App's own option lists and field limits.
 *
 * Deliberately NOT check constraints in the database (see migration 020): these
 * lists change between application cycles, and pinning them in SQL would turn a
 * form update into a migration. They live here so a cycle change is one edit.
 *
 * Plain module, not 'use server' — it exports values, and a server-actions file
 * may only export async functions.
 */

export const ACTIVITY_TYPES = [
  'Academic',
  'Art',
  'Athletics: Club',
  'Athletics: JV/Varsity',
  'Career Oriented',
  'Community Service',
  'Computer/Technology',
  'Cultural',
  'Dance',
  'Debate/Speech',
  'Environmental',
  'Family Responsibilities',
  'Foreign Exchange',
  'Foreign Language',
  'Journalism/Publication',
  'Junior ROTC',
  'LGBT',
  'Music: Instrumental',
  'Music: Vocal',
  'Religious',
  'Research',
  'Robotics',
  'School Spirit',
  'Science/Math',
  'Social Justice',
  'Student Govt/Politics',
  'Theater/Drama',
  'Work (Paid)',
  'Other Club/Activity',
] as const

export const PARTICIPATION_GRADES = ['9', '10', '11', '12', 'Post-graduate'] as const

export const PARTICIPATION_TIMING = [
  'During school year',
  'During school break',
  'All year',
] as const

export const RECOGNITION_LEVELS = [
  'School',
  'State/Regional',
  'National',
  'International',
] as const

/**
 * How many entries the Common App actually accepts.
 *
 * Shown as guidance, never enforced: a student drafts more than they submit and
 * narrows down by ranking, so refusing the eleventh entry would get in the way
 * of the work rather than helping it.
 */
export const COMMON_APP_ACTIVITY_LIMIT = 10
export const COMMON_APP_HONOR_LIMIT = 5

/**
 * The form's character limits.
 *
 * Also guidance rather than enforcement — no `maxLength` on the inputs and no
 * server-side rejection. Silently truncating pasted text would lose a
 * counselor's wording without saying so; the counter turns red instead and the
 * student trims it themselves.
 *
 * honorDescription has no entry: the real form has no such field, so ours is
 * internal notes with nothing to stay under.
 */
export const CHARACTER_LIMITS = {
  positionTitle: 50,
  organizationName: 100,
  activityDescription: 150,
  honorTitle: 100,
} as const

// ---------------------------------------------------------------------------
// Form shapes
// ---------------------------------------------------------------------------

export type CommonAppActivityInput = {
  /** '' means not linked to anything in the working Activities list. */
  sourceActivityId: string
  activityType: string
  positionTitle: string
  organizationName: string
  description: string
  participationGrades: string[]
  participationTiming: string[]
  hoursPerWeek: string
  weeksPerYear: string
  continueInCollege: boolean
}

export const EMPTY_COMMON_APP_ACTIVITY: CommonAppActivityInput = {
  sourceActivityId: '',
  activityType: '',
  positionTitle: '',
  organizationName: '',
  description: '',
  participationGrades: [],
  participationTiming: [],
  hoursPerWeek: '',
  weeksPerYear: '',
  continueInCollege: false,
}

export type CommonAppHonorInput = {
  sourceHonorId: string
  title: string
  gradeLevel: string[]
  levelOfRecognition: string
  description: string
}

export const EMPTY_COMMON_APP_HONOR: CommonAppHonorInput = {
  sourceHonorId: '',
  title: '',
  gradeLevel: [],
  levelOfRecognition: '',
  description: '',
}
