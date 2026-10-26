"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchProjectEnquiryAttachments,
  projectEnquiryAttachmentOpenHref,
} from "@/lib/projects/enquiryAttachments/client";
import { qk } from "@/lib/queries/keys";
import {
  Button,
  ButtonLink,
  DataStatePanel,
  LoadingSkeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/foundation";
import type { ProjectEnquiryAttachment } from "@/lib/projects/enquiryAttachments/types";
import styles from "./ProjectEnquiryFilesPanel.module.css";
import {EnquiryFilesSurface} from "../ProjectFilesSurface";

const submittedDate = new Intl.DateTimeFormat("en-NZ", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Pacific/Auckland",
});

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
function formatSubmittedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : submittedDate.format(date);
}

export default function ProjectEnquiryFilesPanel({
  projectId,
  host,
  initialAttachments,
  disableActions = false,
}: {
  projectId: string;
  host: string;
  initialAttachments?: ProjectEnquiryAttachment[];
  disableActions?: boolean;
}) {
  const query = useQuery({
    queryKey: qk.projects.enquiryAttachments(host, projectId),
    queryFn: () => fetchProjectEnquiryAttachments(projectId),
    staleTime: 60_000,
    retry: false,
    enabled: initialAttachments === undefined,
    ...(initialAttachments !== undefined
      ? {
          initialData: {
            attachments: initialAttachments,
            generatedAt: "2026-08-27T00:00:00.000Z",
          },
        }
      : null),
  });

  const attachments=query.data?.attachments;
  const status=query.isPending?<LoadingSkeleton rows={3} columns={3} label="Loading enquiry files"/>:query.isError?<DataStatePanel state="error" title="Enquiry files could not be loaded" description="No file access was granted. Retry the staff-only request." onRetry={()=>void query.refetch()}/>:!attachments?.length?<DataStatePanel state="empty" title="No website enquiry files" description="Files submitted with the website enquiry will appear here automatically."/>:null;
  return <EnquiryFilesSurface evidence={{status,pending:query.isPending,statusTitle:query.isError?'Enquiry files could not be loaded':!query.isPending&&!attachments?.length?'No website enquiry files':undefined,retry:query.isError?()=>void query.refetch():undefined,rows:attachments?<>{attachments.map((attachment) => (
            <TableRow key={attachment.id}>
              <TableCell>
                <strong className={styles.filename}>{attachment.filename}</strong>
              </TableCell>
              <TableCell>{formatSubmittedAt(attachment.submittedAt)}</TableCell>
              <TableCell>{formatBytes(attachment.sizeBytes)}</TableCell>
              <TableCell>
                <div className={styles.actions}>
                  {disableActions ? (
                    <>
                      <Button variant="secondary" size="small" disabled>
                        View
                      </Button>
                      <Button variant="tertiary" size="small" disabled>
                        Download
                      </Button>
                    </>
                  ) : (
                    <>
                      <ButtonLink
                        href={projectEnquiryAttachmentOpenHref(
                          projectId,
                          attachment.id,
                          "view",
                        )}
                        variant="secondary"
                        size="small"
                        prefetch={false}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View
                      </ButtonLink>
                      <ButtonLink
                        href={projectEnquiryAttachmentOpenHref(
                          projectId,
                          attachment.id,
                          "download",
                        )}
                        variant="tertiary"
                        size="small"
                        prefetch={false}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Download
                      </ButtonLink>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}</>:null}}/>;
}
