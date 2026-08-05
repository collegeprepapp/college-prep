'use client'

import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { countWords } from '@/lib/essays/types'

const TOOLBAR_BUTTON =
  'rounded px-2 py-1 text-xs font-medium transition-opacity hover:opacity-70'
const TOOLBAR_ACTIVE = 'bg-black/10 dark:bg-white/15'

/**
 * Tiptap editor for essay content.
 *
 * `immediatelyRender: false` is required under the App Router: rendering the
 * editor during SSR produces markup the client then rebuilds, which React
 * reports as a hydration mismatch.
 *
 * The parent owns the HTML string. onChange fires on every keystroke, so the
 * Save button can tell whether there is anything to save and the live word
 * count stays honest — it uses the same countWords() the server recomputes
 * with, so the number shown is the number stored.
 */
export function RichTextEditor({
  content,
  onChange,
  editable = true,
}: {
  content: string
  onChange?: (html: string) => void
  editable?: boolean
}) {
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [StarterKit],
    content,
    editorProps: {
      attributes: {
        class:
          'prose-sm min-h-64 max-w-none rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2',
      },
    },
    onUpdate: ({ editor: instance }) => {
      onChange?.(instance.getHTML())
    },
  })

  // Swapping essays (or restoring a version) replaces the document wholesale.
  // Without this the editor would keep showing the previous essay, since
  // Tiptap only reads `content` when it initialises.
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false })
    }
    // Intentionally keyed on content only: reacting to `editor` alone would
    // reset the document on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])

  useEffect(() => {
    editor?.setEditable(editable)
  }, [editor, editable])

  if (!editor) {
    // Matches the editor's own min-height so the panel does not jump when the
    // editor mounts on the client.
    return (
      <div className="min-h-64 rounded-md border border-black/15 px-3 py-2 text-sm opacity-50 dark:border-white/20">
        Loading editor…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {editable && (
        <div className="flex flex-wrap gap-1" role="toolbar" aria-label="Formatting">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            aria-pressed={editor.isActive('bold')}
            className={`${TOOLBAR_BUTTON} ${editor.isActive('bold') ? TOOLBAR_ACTIVE : 'opacity-70'}`}
          >
            Bold
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            aria-pressed={editor.isActive('italic')}
            className={`${TOOLBAR_BUTTON} ${editor.isActive('italic') ? TOOLBAR_ACTIVE : 'opacity-70'}`}
          >
            Italic
          </button>
          <button
            type="button"
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            aria-pressed={editor.isActive('heading', { level: 2 })}
            className={`${TOOLBAR_BUTTON} ${
              editor.isActive('heading', { level: 2 })
                ? TOOLBAR_ACTIVE
                : 'opacity-70'
            }`}
          >
            Heading
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            aria-pressed={editor.isActive('bulletList')}
            className={`${TOOLBAR_BUTTON} ${editor.isActive('bulletList') ? TOOLBAR_ACTIVE : 'opacity-70'}`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            className={`${TOOLBAR_BUTTON} opacity-70`}
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            className={`${TOOLBAR_BUTTON} opacity-70`}
          >
            Redo
          </button>
        </div>
      )}

      <EditorContent editor={editor} />

      <span className="text-xs opacity-60">
        {countWords(editor.getHTML())} words
      </span>
    </div>
  )
}
