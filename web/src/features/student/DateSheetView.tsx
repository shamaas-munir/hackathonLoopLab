"use client";

import { Download, LifeBuoy, Lock, Printer } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { StudentStepper } from "@/components/layout/StudentStepper";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingButton } from "@/components/shared/LoadingButton";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime, formatTimeRange } from "@/lib/format";
import { useDatesheet, type Datesheet } from "./api";
import { useStudentGuard } from "./useStudentGuard";

// Print: A4 page, and every surface forced to black on white whatever the theme.
const PRINT_CSS = "@page { size: A4; margin: 14mm; }";
const PRINT_DOC =
  "print:border-0 print:p-0 print:shadow-none print:[&_*]:border-neutral-400 print:[&_*]:bg-transparent print:[&_*]:text-black";

export function DateSheetView() {
  const guard = useStudentGuard("datesheet");
  const datesheet = useDatesheet(guard.allowed);
  const [downloading, setDownloading] = useState(false);

  if (guard.error) return <ErrorState onRetry={() => void guard.retry()} />;
  if (!guard.allowed || datesheet.isPending) return <PageSkeleton />;
  if (datesheet.isError) return <ErrorState onRetry={() => void datesheet.refetch()} />;

  const data = datesheet.data;

  async function downloadPdf() {
    setDownloading(true);
    try {
      // Loaded only on click so the PDF library never weighs down the page.
      const { downloadDateSheetPdf } = await import("./DateSheetPdf");
      await downloadDateSheetPdf(data);
    } catch {
      toast.error("Could not create the PDF. Please try again or use Print.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <style>{PRINT_CSS}</style>
      <StudentStepper current={3} />

      <div className="no-print mb-4 flex flex-wrap gap-2">
        <Button onClick={() => window.print()}>
          <Printer aria-hidden />
          Print Date Sheet
        </Button>
        <LoadingButton variant="outline" loading={downloading} onClick={downloadPdf}>
          {!downloading && <Download aria-hidden />}
          Download PDF
        </LoadingButton>
        <Button variant="ghost" asChild>
          <Link href="/student/help">
            <LifeBuoy aria-hidden />
            Need help?
          </Link>
        </Button>
      </div>

      <DateSheetDocument data={data} />
    </>
  );
}

function DateSheetDocument({ data }: { data: Datesheet }) {
  const info: [string, string][] = [
    ["Student name", data.full_name],
    ["Registration no", data.registration_no],
    ["Program", `${data.program}, semester ${data.semester}`],
    ["Session", data.session],
    ["Exam branch", data.branch.name],
    ["Branch address", `${data.branch.address}, ${data.branch.city}`],
  ];

  return (
    <article className={`rounded-xl border bg-card p-4 shadow-sm sm:p-6 md:p-8 ${PRINT_DOC}`}>
      <header className="mb-6 flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Virtual University</p>
          <h1 className="text-[clamp(1.25rem,1rem+1vw,1.625rem)] font-semibold tracking-tight">
            Examination Date Sheet
          </h1>
        </div>
        {data.locked && <StatusBadge status="locked" className="print:hidden" />}
      </header>

      <dl className="mb-6 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 print:grid-cols-2">
        {info.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-medium break-words">{value}</dd>
          </div>
        ))}
      </dl>

      <table className="hidden w-full border-collapse text-sm md:table print:table">
        <thead>
          <tr className="border-b bg-muted text-left">
            {["Course code", "Title", "Date", "Day", "Time"].map((h) => (
              <th key={h} scope="col" className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.course_code} className="border-b break-inside-avoid">
              <td className="px-3 py-2 font-medium">{row.course_code}</td>
              <td className="px-3 py-2">{row.course_title}</td>
              <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.start_at)}</td>
              <td className="px-3 py-2">{row.day}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {formatTimeRange(row.start_at, row.end_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="grid gap-3 md:hidden print:hidden">
        {data.rows.map((row) => (
          <li key={row.course_code} className="rounded-lg border p-3 text-sm">
            <p className="font-medium break-words">
              <span className="text-primary">{row.course_code}</span> {row.course_title}
            </p>
            <p className="mt-1 text-muted-foreground">
              {row.day}, {formatDate(row.start_at)}
            </p>
            <p className="text-muted-foreground">{formatTimeRange(row.start_at, row.end_at)}</p>
          </li>
        ))}
      </ul>

      <footer className="mt-6 flex items-center gap-1.5 border-t pt-4 text-xs text-muted-foreground">
        <Lock className="size-3.5" aria-hidden />
        Generated {formatDateTime(new Date())} · Saved {formatDateTime(data.saved_at)}
        {data.locked && " · Locked"}
      </footer>
    </article>
  );
}
