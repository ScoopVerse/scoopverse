import React from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style';
import { Bold, Italic, List, ListOrdered, RemoveFormatting, Underline } from 'lucide-react';

// Only the fonts the site already loads, plus two that every device has. The server accepts any font NAME
// (letters and commas only), so adding one here, and loading it in index.html, is all that's needed.
const FONTS = [
  { label: 'Default', value: '' },
  { label: 'Playfair Display', value: '"Playfair Display", Georgia, serif' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Monospace', value: '"Courier New", Courier, monospace' },
];
const SIZES = [
  { label: 'Small', value: '0.75rem' },
  { label: 'Normal', value: '' },
  { label: 'Large', value: '1.125rem' },
  { label: 'Extra large', value: '1.5rem' },
];

// The browser may write a saved font back with different quotes, so compare by the first font name only.
const firstFont = (css: string | undefined) => (css ?? '').split(',')[0].replace(/["']/g, '').trim().toLowerCase();

interface Props {
  // Starting content (HTML). The editor owns the text after that; changes come back through onChange.
  value: string;
  onChange: (html: string) => void;
}

const selectClass =
  'text-sm font-semibold text-[#4a454e] bg-white border border-[#e6e2dc] rounded-full px-3 py-1.5 focus:border-[#9d84b7] focus:outline-hidden';

// onMouseDown keeps the text selection while a toolbar button is clicked.
const Btn = ({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    aria-pressed={active}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
      active ? 'bg-[#695282] text-white' : 'text-[#4a454e] hover:bg-[#efdbff]/60'
    }`}
  >
    {children}
  </button>
);

export const RichTextEditor: React.FC<Props> = ({ value, onChange }) => {
  const editor = useEditor({
    // Only what the server keeps: bold, italic, underline, font, size, lists. (Headings, links, code etc. are off.)
    extensions: [
      StarterKit.configure({ blockquote: false, code: false, codeBlock: false, heading: false, horizontalRule: false, link: false, strike: false }),
      TextStyle,
      FontFamily,
      FontSize,
    ],
    content: value,
    shouldRerenderOnTransaction: true, // keeps the toolbar's pressed buttons in step with the cursor
    editorProps: { attributes: { class: 'rich-text text-sm leading-relaxed text-[#4a454e] min-h-[8rem] max-h-72 overflow-y-auto [scrollbar-gutter:stable] [scrollbar-width:thin] [scrollbar-color:#c9b6dc_transparent] px-4 py-3 outline-hidden', 'aria-label': 'Description' } },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML()),
  });

  if (!editor) return null;
  const style = editor.getAttributes('textStyle');
  const fontValue = FONTS.find((f) => f.value && firstFont(f.value) === firstFont(style.fontFamily))?.value ?? '';
  const sizeValue = SIZES.find((s) => s.value && s.value === style.fontSize)?.value ?? '';

  return (
    <div className="rounded-2xl bg-[#f7f3ed] border border-[#e6e2dc] focus-within:border-[#9d84b7] focus-within:bg-white transition-all overflow-hidden">
      <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-2 border-b border-[#e6e2dc] bg-white/60">
        <select
          aria-label="Font"
          value={fontValue}
          onChange={(e) => (e.target.value ? editor.chain().focus().setFontFamily(e.target.value).run() : editor.chain().focus().unsetFontFamily().run())}
          className={selectClass}
        >
          {FONTS.map((f) => (
            <option key={f.label} value={f.value}>{f.label}</option>
          ))}
        </select>
        <select
          aria-label="Text size"
          value={sizeValue}
          onChange={(e) => (e.target.value ? editor.chain().focus().setFontSize(e.target.value).run() : editor.chain().focus().unsetFontSize().run())}
          className={selectClass}
        >
          {SIZES.map((s) => (
            <option key={s.label} value={s.value}>{s.label}</option>
          ))}
        </select>
        <span className="w-px h-5 bg-[#e6e2dc] mx-1" aria-hidden />
        <Btn label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="w-4 h-4" />
        </Btn>
        <Btn label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="w-4 h-4" />
        </Btn>
        <Btn label="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <Underline className="w-4 h-4" />
        </Btn>
        <span className="w-px h-5 bg-[#e6e2dc] mx-1" aria-hidden />
        <Btn label="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="w-4 h-4" />
        </Btn>
        <Btn label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="w-4 h-4" />
        </Btn>
        <span className="w-px h-5 bg-[#e6e2dc] mx-1" aria-hidden />
        <Btn label="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
          <RemoveFormatting className="w-4 h-4" />
        </Btn>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
};
