import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { formatDate, formatDateTime, formatTimeRange } from "@/lib/format";
import type { Datesheet } from "./api";

// Import this module dynamically: @react-pdf/renderer is large and only needed on "Download PDF".

/** Intl puts narrow no-break spaces (U+202F) in times; the built-in PDF fonts cannot draw them. */
const plain = (text: string) => text.replace(/\s/g, " ");

const COLUMNS = [
  { label: "Course code", width: "16%" },
  { label: "Title", width: "36%" },
  { label: "Date", width: "16%" },
  { label: "Day", width: "13%" },
  { label: "Time", width: "19%" },
] as const;

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1E2A3B" },
  university: { fontSize: 11, color: "#3B6FD4", fontFamily: "Helvetica-Bold" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginTop: 2, marginBottom: 16 },
  info: { flexDirection: "row", flexWrap: "wrap", marginBottom: 18 },
  infoItem: { width: "50%", marginBottom: 8, paddingRight: 8 },
  label: { fontSize: 8, color: "#5B6B80", marginBottom: 2 },
  value: { fontFamily: "Helvetica-Bold" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#DCE5F0" },
  head: { backgroundColor: "#EEF3FA", fontFamily: "Helvetica-Bold" },
  cell: { paddingVertical: 6, paddingHorizontal: 4 },
  footer: { marginTop: 18, fontSize: 8, color: "#5B6B80" },
});

function DateSheetPdf({ data }: { data: Datesheet }) {
  const info: [string, string][] = [
    ["Student name", data.full_name],
    ["Registration no", data.registration_no],
    ["Program", `${data.program}, semester ${data.semester}`],
    ["Session", data.session],
    ["Exam branch", data.branch.name],
    ["Branch address", `${data.branch.address}, ${data.branch.city}`],
  ];
  const rows = data.rows.map((row) => [
    row.course_code,
    row.course_title,
    plain(formatDate(row.start_at)),
    row.day,
    plain(formatTimeRange(row.start_at, row.end_at)),
  ]);

  return (
    <Document title={`Date sheet ${data.registration_no}`} author="ExamSlot">
      <Page size="A4" style={styles.page}>
        <Text style={styles.university}>Virtual University</Text>
        <Text style={styles.title}>Examination Date Sheet</Text>
        <View style={styles.info}>
          {info.map(([label, value]) => (
            <View key={label} style={styles.infoItem}>
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.value}>{value}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.row, styles.head]}>
          {COLUMNS.map((col) => (
            <Text key={col.label} style={[styles.cell, { width: col.width }]}>
              {col.label}
            </Text>
          ))}
        </View>
        {rows.map((cells) => (
          <View key={cells[0]} style={styles.row} wrap={false}>
            {cells.map((cell, i) => (
              <Text key={COLUMNS[i].label} style={[styles.cell, { width: COLUMNS[i].width }]}>
                {cell}
              </Text>
            ))}
          </View>
        ))}
        <Text style={styles.footer}>
          Generated {plain(formatDateTime(new Date()))} · Saved {plain(formatDateTime(data.saved_at))}
          {data.locked ? " · Locked" : ""}
        </Text>
      </Page>
    </Document>
  );
}

export async function downloadDateSheetPdf(data: Datesheet) {
  const blob = await pdf(<DateSheetPdf data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `datesheet-${data.registration_no}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
