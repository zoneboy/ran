// components/RichTextEditor.tsx
import React, { useEffect, useRef } from 'react';
import Quill from 'quill';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number; // px
}

// Inject Quill snow CSS once. We do this from JS so the importmap-based
// build doesn't need a separate stylesheet entry in index.html.
const ensureQuillStyles = () => {
  const id = 'quill-snow-css';
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = 'https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css';
  document.head.appendChild(link);

  // Tiny override so the editor body fits the form aesthetic.
  const styleId = 'quill-overrides';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .ran-rte .ql-toolbar {
        border-top-left-radius: 0.375rem;
        border-top-right-radius: 0.375rem;
        background: #f9fafb;
        border-color: #d1d5db;
      }
      .ran-rte .ql-container {
        border-bottom-left-radius: 0.375rem;
        border-bottom-right-radius: 0.375rem;
        font-size: 0.875rem;
        font-family: 'Inter', sans-serif;
        border-color: #d1d5db;
      }
      .ran-rte .ql-editor {
        min-height: var(--ran-rte-min-height, 160px);
      }
      .ran-rte .ql-editor.ql-blank::before {
        font-style: normal;
        color: #9ca3af;
      }
      .ran-rte:focus-within .ql-toolbar,
      .ran-rte:focus-within .ql-container {
        border-color: #16a34a;
      }
      /* Render of code blocks */
      .ran-rte .ql-syntax {
        background: #1f2937;
        color: #f9fafb;
        padding: 0.5rem 0.75rem;
        border-radius: 0.25rem;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }
    `;
    document.head.appendChild(style);
  }
};

const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ color: [] }, { background: [] }],
  [{ align: [] }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ indent: '-1' }, { indent: '+1' }],
  ['blockquote', 'code-block'],
  ['link'],
  ['clean'],
];

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write something...',
  minHeight = 160,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const onChangeRef = useRef(onChange);

  // Keep latest onChange without re-initializing Quill.
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Initialize Quill once.
  useEffect(() => {
    if (!containerRef.current || quillRef.current) return;
    ensureQuillStyles();

    // Build the editor element fresh each mount.
    const editorEl = document.createElement('div');
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(editorEl);

    const quill = new Quill(editorEl, {
      theme: 'snow',
      placeholder,
      modules: {
        toolbar: TOOLBAR_OPTIONS,
      },
    });

    quillRef.current = quill;

    // Set initial content if provided.
    if (value) {
      // Use clipboard.dangerouslyPasteHTML so existing HTML renders correctly.
      // Sanitization happens at save and render boundaries — Quill itself
      // will also strip tags it doesn't understand.
      quill.clipboard.dangerouslyPasteHTML(value);
    }

    quill.on('text-change', () => {
      const html = quill.root.innerHTML;
      // Quill emits "<p><br></p>" for empty content. Normalize that.
      const normalized =
        html === '<p><br></p>' || html.trim() === '' ? '' : html;
      onChangeRef.current(normalized);
    });

    return () => {
      quillRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External value updates (e.g., reset after submit). Only update if it
  // genuinely differs from what's already in the editor — otherwise the
  // cursor jumps to the start on every keystroke.
  useEffect(() => {
    const q = quillRef.current;
    if (!q) return;
    const current = q.root.innerHTML;
    const incoming = value || '';
    const normalizedCurrent =
      current === '<p><br></p>' || current.trim() === '' ? '' : current;

    if (normalizedCurrent !== incoming) {
      // Preserve selection where possible.
      const sel = q.getSelection();
      if (incoming === '') {
        q.setText('');
      } else {
        q.clipboard.dangerouslyPasteHTML(incoming);
      }
      if (sel) {
        try {
          q.setSelection(sel.index, sel.length);
        } catch {
          /* selection out of range; ignore */
        }
      }
    }
  }, [value]);

  return (
    <div
      className="ran-rte"
      style={{ ['--ran-rte-min-height' as any]: `${minHeight}px` }}
    >
      <div ref={containerRef} />
    </div>
  );
};

export default RichTextEditor;
