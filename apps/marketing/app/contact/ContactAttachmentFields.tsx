import type { ChangeEventHandler } from 'react';
import { ENQUIRY_ATTACHMENT_ACCEPT } from '../../lib/enquiryAttachments';
import { ENQUIRY_ATTACHMENT_HELP_TEXT } from '../../lib/enquiryFormContract';

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ContactAttachmentFields({ files, error, enhanced, onChange, onRemove }: {
  files: File[];
  error?: string;
  enhanced: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
  onRemove: (index: number) => void;
}) {
  return <div className="contact-form__field contact-form__field--wide">
    <label htmlFor="contact-files">Photos, plans or sketches <span>Optional</span></label>
    <p className="contact-form__help" id="contact-files-help">{ENQUIRY_ATTACHMENT_HELP_TEXT}</p>
    <input id="contact-files" name="files" type="file" accept={ENQUIRY_ATTACHMENT_ACCEPT} multiple disabled={!enhanced}
      aria-invalid={Boolean(error)} aria-describedby={`contact-files-help${error ? ' contact-files-error' : ''}`} onChange={onChange}/>
    <p className="contact-form__help" hidden={enhanced}>File upload needs JavaScript. You can email files to{' '}
      <a href="mailto:info@sanctuarypergolas.co.nz">info@sanctuarypergolas.co.nz</a>.
    </p>
    {files.length > 0 && <ul className="contact-form__files" aria-label="Selected files">{files.map((file, index) =>
      <li key={`${file.name}-${file.lastModified}-${index}`}><span><strong>{file.name}</strong><small>{formatFileSize(file.size)}</small></span>
        <button type="button" onClick={() => onRemove(index)} aria-label={`Remove ${file.name}`}>Remove</button></li>)}</ul>}
    {error && <p className="contact-form__error" id="contact-files-error">{error}</p>}
  </div>;
}
