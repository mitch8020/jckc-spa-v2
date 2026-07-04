import type {
  Content,
  StyleDictionary,
  TableCell,
  TDocumentDefinitions,
} from 'pdfmake/interfaces';
import { formatDateString, sortClassrooms } from '../../common/utils/age';

/**
 * Pure pdfmake document-definition builders for the two legacy reports
 * (reports.md §4). Layouts reproduce the legacy output byte-for-byte in
 * structure — same headers, blank lines, table widths/heights, styles and
 * per-classroom page breaks — with only the specced fixes applied:
 * - classrooms ordered with the rank map (legacy comparator was
 *   non-transitive), students ordered by LAST name (legacy parity),
 * - missing teacher renders as an empty string (legacy printed
 *   'Teacher: undefined'),
 * - DOB formatted straight from the stored `YYYY-MM-DD` string (legacy
 *   moment().utc() could shift a day in UTC+ timezones),
 * - zero classrooms produces a valid one-page PDF instead of crashing
 *   (legacy `reduce` without an initial value threw).
 */

/** Classroom fields the reports consume, id pre-stringified. */
export interface ReportClassroom {
  id: string;
  classroomName: string;
  ageGroup: string;
  teacherName?: string | null;
}

/** Student fields the reports consume, classroom ref pre-stringified. */
export interface ReportStudent {
  studentFirstName: string;
  studentLastName: string;
  /** Stored `YYYY-MM-DD` string (never a Date). */
  dateOfBirth: string;
  /** Classroom id as a string, or null when unassigned. */
  classroomId: string | null;
}

export const REPORT_TITLE = 'JC KIDZ CLUBHOUSE';
export const REPORT_ADDRESS = '408 W Market St, Johnson City, TN 37604';
export const NO_CLASSROOMS_MESSAGE = 'No classrooms found.';

/** Exact legacy blank lines (15/15, 10 and 3×3 underscores). */
export const DAY_DATE_BLANKS = 'Day: _______________   Date: _______________';
export const AGE_GROUP_BLANK = 'Age Group: __________';
export const WEEK_BLANKS = 'Week of ___ /___ to ___ /___';

const NO_BORDER: [boolean, boolean, boolean, boolean] = [
  false,
  false,
  false,
  false,
];

/**
 * NOTE: 'studentrow' is intentionally absent (legacy quirk 6) — the
 * sign-in student cells reference it, pdfmake silently ignores the
 * unknown style and names render at the default 12pt, matching legacy
 * output exactly.
 */
const SIGN_IN_STYLES: StyleDictionary = {
  header: { fontSize: 18, bold: true, margin: [0, 0, 0, 5] },
  subheader: { fontSize: 16, bold: true, margin: [0, 0, 0, 5] },
  tableExample: { margin: [0, 0, 0, 0] },
  tableHeader: { bold: true, fontSize: 13, color: 'black' },
};

/** 'tableHeader' is defined but never referenced — legacy quirk 7 kept. */
const ROLL_CALL_STYLES: StyleDictionary = {
  header: { fontSize: 18, bold: true, margin: [0, 0, 0, 5] },
  subheader: { fontSize: 16, bold: true, margin: [0, 0, 0, 5] },
  subsubheader: { fontSize: 8, bold: true },
  tableExample: { margin: [0, 0, 0, 0] },
  tableHeader: { bold: true, fontSize: 13, color: 'black' },
  studentrow: { fontSize: 10 },
};

/** First page carries no break; every later classroom starts a new page. */
function titleNode(first: boolean): Content {
  return first
    ? { text: REPORT_TITLE, style: 'header', alignment: 'center' }
    : {
        text: REPORT_TITLE,
        pageBreak: 'before',
        style: 'header',
        alignment: 'center',
      };
}

/**
 * Borderless two-row meta table: blanks top-left, Classroom/Teacher
 * right-aligned. Missing teacher becomes '' — never 'undefined'.
 */
function metaTable(topLeft: string, room: ReportClassroom): Content {
  return {
    style: 'tableExample',
    table: {
      widths: ['*', '*'],
      body: [
        [
          { text: topLeft, style: 'subheader', border: NO_BORDER },
          {
            text: `Classroom: ${room.classroomName}`,
            style: 'subheader',
            alignment: 'right',
            border: NO_BORDER,
          },
        ],
        [
          { text: AGE_GROUP_BLANK, style: 'subheader', border: NO_BORDER },
          {
            text: `Teacher: ${room.teacherName ?? ''}`,
            style: 'subheader',
            alignment: 'right',
            border: NO_BORDER,
          },
        ],
      ],
    },
  };
}

/** Legacy global sort: LAST name localeCompare (first-name pages differ). */
function sortByLastName(students: readonly ReportStudent[]): ReportStudent[] {
  return [...students].sort((a, b) =>
    a.studentLastName.localeCompare(b.studentLastName),
  );
}

/**
 * Explicit string-compare replacement for the legacy loose
 * `e.classroom == room.id`; unassigned students stay silently excluded
 * from every report (legacy behavior preserved).
 */
function studentsOf(
  room: ReportClassroom,
  sortedStudents: readonly ReportStudent[],
): ReportStudent[] {
  return sortedStudents.filter((s) => s.classroomId === room.id);
}

function signInTableBody(students: readonly ReportStudent[]): TableCell[][] {
  const rows: TableCell[][] = [
    [
      {},
      { text: 'IN', style: 'tableHeader', colSpan: 3, alignment: 'center' },
      {},
      {},
      { text: 'OUT', style: 'tableHeader', colSpan: 3, alignment: 'center' },
      {},
      {},
    ],
    [
      { text: 'STUDENT NAME', style: 'tableHeader', alignment: 'center' },
      {
        text: 'PARENT / GUARDIAN PRINTED NAME',
        style: 'tableHeader',
        alignment: 'center',
      },
      { text: 'TIME', style: 'tableHeader', alignment: 'center' },
      { text: 'SIGNATURE', style: 'tableHeader', alignment: 'center' },
      {
        text: 'PARENT / GUARDIAN PRINTED NAME',
        style: 'tableHeader',
        alignment: 'center',
      },
      { text: 'TIME', style: 'tableHeader', alignment: 'center' },
      { text: 'SIGNATURE', style: 'tableHeader', alignment: 'center' },
    ],
  ];
  for (const s of students) {
    rows.push([
      {
        text: `${s.studentFirstName} ${s.studentLastName}`,
        style: 'studentrow',
      },
      {},
      {},
      {},
      {},
      {},
      {},
    ]);
  }
  return rows;
}

function rollCallTableBody(students: readonly ReportStudent[]): TableCell[][] {
  const rows: TableCell[][] = [
    [
      { text: 'STUDENT NAME', alignment: 'center' },
      { text: 'MON', alignment: 'center', colSpan: 2 },
      {},
      { text: 'TUE', alignment: 'center', colSpan: 2 },
      {},
      { text: 'WED', alignment: 'center', colSpan: 2 },
      {},
      { text: 'THU', alignment: 'center', colSpan: 2 },
      {},
      { text: 'FRI', alignment: 'center', colSpan: 2 },
      {},
      { text: 'COMMENTS', alignment: 'center' },
    ],
  ];
  for (const s of students) {
    const inRow: TableCell[] = [
      {
        // Literal spaces around \n are legacy parity; the DOB is the
        // stored YYYY-MM-DD string reformatted directly — no Date math.
        text: `${s.studentFirstName} ${s.studentLastName} \n DOB: ${formatDateString(
          s.dateOfBirth,
        )}`,
        style: 'studentrow',
        rowSpan: 2,
      },
    ];
    const outRow: TableCell[] = [{}];
    for (let day = 0; day < 5; day += 1) {
      inRow.push({ text: 'IN', style: 'subsubheader', alignment: 'center' });
      inRow.push({});
      outRow.push({ text: 'OUT', style: 'subsubheader', alignment: 'center' });
      outRow.push({});
    }
    inRow.push({ text: '', rowSpan: 2 });
    outRow.push({});
    rows.push(inRow, outRow);
  }
  return rows;
}

/**
 * Sign-in sheet (reports.md §4.1): landscape, one page per classroom,
 * title + facility address, Day/Date + Age Group blanks, IN/OUT
 * signature table with a 22pt row height for handwriting.
 */
export function buildSignInSheetDefinition(
  classrooms: readonly ReportClassroom[],
  students: readonly ReportStudent[],
): TDocumentDefinitions {
  const rooms = sortClassrooms(classrooms);
  const sorted = sortByLastName(students);

  const content: Content[] =
    rooms.length === 0
      ? [
          titleNode(true),
          { text: REPORT_ADDRESS, alignment: 'center' },
          { text: NO_CLASSROOMS_MESSAGE, alignment: 'center' },
        ]
      : rooms.flatMap((room, index): Content[] => [
          titleNode(index === 0),
          { text: REPORT_ADDRESS, alignment: 'center' },
          metaTable(DAY_DATE_BLANKS, room),
          {
            style: 'tableExample',
            table: {
              heights: 22,
              widths: ['*', 125, 60, 80, 125, 60, 80],
              body: signInTableBody(studentsOf(room, sorted)),
            },
          },
        ]);

  return {
    pageOrientation: 'landscape',
    content,
    styles: SIGN_IN_STYLES,
  };
}

/**
 * Roll-call sheet (reports.md §4.2): portrait, one page per classroom,
 * Week-of blanks, MON–FRI IN/OUT double rows per student with a
 * rowSpan-2 name cell (name + DOB) and comments column.
 */
export function buildRollCallSheetDefinition(
  classrooms: readonly ReportClassroom[],
  students: readonly ReportStudent[],
): TDocumentDefinitions {
  const rooms = sortClassrooms(classrooms);
  const sorted = sortByLastName(students);

  const content: Content[] =
    rooms.length === 0
      ? [titleNode(true), { text: NO_CLASSROOMS_MESSAGE, alignment: 'center' }]
      : rooms.flatMap((room, index): Content[] => [
          titleNode(index === 0),
          metaTable(WEEK_BLANKS, room),
          {
            style: 'tableExample',
            table: {
              heights: 22,
              widths: [100, 20, 28, 20, 28, 20, 28, 20, 28, 20, 28, 'auto'],
              body: rollCallTableBody(studentsOf(room, sorted)),
            },
          },
        ]);

  return {
    content,
    styles: ROLL_CALL_STYLES,
  };
}
