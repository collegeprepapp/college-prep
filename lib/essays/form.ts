/**
 * Form shapes for essays.
 *
 * Outside the server-actions file: a 'use server' module may only export async
 * functions, and exporting a value from one leaves the client import
 * unresolved.
 */

/** The metadata fields; content is handled separately by the editor. */
export type EssayMetaInput = {
  title: string
  prompt: string
  essayType: string
  /** '' means not linked to any school. */
  collegeApplicationId: string
}

export const EMPTY_ESSAY_META: EssayMetaInput = {
  title: '',
  prompt: '',
  essayType: 'common_app',
  collegeApplicationId: '',
}
