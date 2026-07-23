export type EnquiryAttachmentDescriptor = {
  path?: string;
  name: string;
  size: number;
  type: string;
};

export const ENQUIRY_ATTACHMENT_LIMITS = {
  maxFiles: 8,
  maxFileBytes: 20 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
} as const;

const ALLOWED_EXTENSIONS_BY_TYPE: Readonly<Record<string, readonly string[]>> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};

export const ENQUIRY_ATTACHMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp';

function extensionOf(name: string): string {
  const index = name.lastIndexOf('.');
  return index >= 0 ? name.slice(index).toLowerCase() : '';
}

function isAllowedEnquiryAttachment(descriptor: EnquiryAttachmentDescriptor): boolean {
  const extensions = ALLOWED_EXTENSIONS_BY_TYPE[descriptor.type.toLowerCase()];
  return Boolean(
    extensions
    && extensions.includes(extensionOf(descriptor.name))
    && descriptor.size > 0
    && descriptor.size <= ENQUIRY_ATTACHMENT_LIMITS.maxFileBytes,
  );
}

export function validateEnquiryAttachmentDescriptors(
  files: readonly EnquiryAttachmentDescriptor[],
): string | null {
  if (files.length > ENQUIRY_ATTACHMENT_LIMITS.maxFiles) {
    return `Add no more than ${ENQUIRY_ATTACHMENT_LIMITS.maxFiles} files.`;
  }
  if (files.some((file) => file.size <= 0 || file.size > ENQUIRY_ATTACHMENT_LIMITS.maxFileBytes)) {
    return 'Each file must be larger than 0 bytes and no larger than 20 MB.';
  }
  if (files.some((file) => !isAllowedEnquiryAttachment(file))) {
    return 'Attachments must be PDF, JPG, PNG, or WebP files with matching file extensions.';
  }
  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  if (totalBytes > ENQUIRY_ATTACHMENT_LIMITS.maxTotalBytes) {
    return 'Attachments must be no larger than 20 MB in total.';
  }
  return null;
}

export function sniffEnquiryAttachmentType(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 5
    && bytes[0] === 0x25
    && bytes[1] === 0x50
    && bytes[2] === 0x44
    && bytes[3] === 0x46
    && bytes[4] === 0x2d
  ) return 'application/pdf';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) return 'image/png';
  if (
    bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) return 'image/webp';
  return null;
}
