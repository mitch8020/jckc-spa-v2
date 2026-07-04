import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import {
  AGE_GROUP_BLANK,
  buildRollCallSheetDefinition,
  buildSignInSheetDefinition,
  DAY_DATE_BLANKS,
  NO_CLASSROOMS_MESSAGE,
  REPORT_ADDRESS,
  REPORT_TITLE,
  WEEK_BLANKS,
} from './reports.documents';
import type { ReportClassroom, ReportStudent } from './reports.documents';

/** Loose structural view of the nodes the builders emit. */
interface Cell {
  text?: string;
  style?: string;
  alignment?: string;
  colSpan?: number;
  rowSpan?: number;
  border?: boolean[];
}

interface Node {
  text?: string;
  style?: string;
  alignment?: string;
  pageBreak?: string;
  table?: {
    widths: Array<string | number>;
    heights?: number;
    body: Cell[][];
  };
}

function nodesOf(definition: TDocumentDefinitions): Node[] {
  return definition.content as unknown as Node[];
}

function pageCount(definition: TDocumentDefinitions): number {
  const breaks = nodesOf(definition).filter(
    (node) => node.pageBreak === 'before',
  ).length;
  return breaks + 1;
}

// Deliberately scrambled input order; rank+name order is
// Anglerfish (infant), Guppies (infant), Turtles (toddler),
// Barracudas (preschool).
const CLASSROOMS: ReportClassroom[] = [
  {
    id: 'room-preschool-b',
    classroomName: 'Barracudas',
    ageGroup: 'preschool',
    teacherName: 'Ms. Pat',
  },
  {
    id: 'room-toddler-t',
    classroomName: 'Turtles',
    ageGroup: 'toddler',
    teacherName: 'Mr. Lee',
  },
  {
    id: 'room-infant-g',
    classroomName: 'Guppies',
    ageGroup: 'infant',
    teacherName: 'Ms. May',
  },
  // No teacher — must render 'Teacher: ', never 'Teacher: undefined'.
  {
    id: 'room-infant-a',
    classroomName: 'Anglerfish',
    ageGroup: 'infant',
  },
];

const STUDENTS: ReportStudent[] = [
  // Guppies, deliberately NOT in last-name order (Young, Abbott, Mills).
  {
    studentFirstName: 'Amy',
    studentLastName: 'Young',
    dateOfBirth: '2025-09-15',
    classroomId: 'room-infant-g',
  },
  {
    studentFirstName: 'Zoe',
    studentLastName: 'Abbott',
    dateOfBirth: '2025-11-02',
    classroomId: 'room-infant-g',
  },
  {
    studentFirstName: 'Ben',
    studentLastName: 'Mills',
    dateOfBirth: '2026-01-05',
    classroomId: 'room-infant-g',
  },
  {
    studentFirstName: 'Cal',
    studentLastName: 'Reed',
    dateOfBirth: '2022-12-31',
    classroomId: 'room-preschool-b',
  },
  // Unassigned — silently excluded from every report (legacy parity).
  {
    studentFirstName: 'Una',
    studentLastName: 'Ford',
    dateOfBirth: '2024-03-09',
    classroomId: null,
  },
  // Dangling classroom ref — matches no room, also excluded.
  {
    studentFirstName: 'Gus',
    studentLastName: 'Hale',
    dateOfBirth: '2024-06-20',
    classroomId: 'room-deleted',
  },
];

describe('buildSignInSheetDefinition', () => {
  const definition = buildSignInSheetDefinition(CLASSROOMS, STUDENTS);
  const nodes = nodesOf(definition);

  it('emits one landscape page block of four nodes per classroom', () => {
    expect(definition.pageOrientation).toBe('landscape');
    expect(nodes).toHaveLength(16);
    expect(pageCount(definition)).toBe(CLASSROOMS.length);

    for (const index of [0, 4, 8, 12]) {
      expect(nodes[index]).toMatchObject({
        text: REPORT_TITLE,
        style: 'header',
        alignment: 'center',
      });
      expect(nodes[index + 1]).toMatchObject({
        text: REPORT_ADDRESS,
        alignment: 'center',
      });
    }
    expect(nodes[0].pageBreak).toBeUndefined();
    expect(nodes[4].pageBreak).toBe('before');
    expect(nodes[8].pageBreak).toBe('before');
    expect(nodes[12].pageBreak).toBe('before');
  });

  it('orders classrooms by age-group rank then name', () => {
    const classroomCells = [2, 6, 10, 14].map(
      (index) => nodes[index].table?.body[0][1].text,
    );
    expect(classroomCells).toEqual([
      'Classroom: Anglerfish',
      'Classroom: Guppies',
      'Classroom: Turtles',
      'Classroom: Barracudas',
    ]);
  });

  it('renders the Day/Date and Age Group blanks in a borderless meta table', () => {
    const meta = nodes[6].table;
    expect(meta?.widths).toEqual(['*', '*']);
    expect(meta?.body[0][0]).toMatchObject({
      text: DAY_DATE_BLANKS,
      style: 'subheader',
      border: [false, false, false, false],
    });
    expect(meta?.body[1][0]).toMatchObject({
      text: AGE_GROUP_BLANK,
      style: 'subheader',
    });
    expect(meta?.body[1][1]).toMatchObject({
      text: 'Teacher: Ms. May',
      alignment: 'right',
    });
  });

  it('renders an empty string — never "undefined" — for a missing teacher', () => {
    const anglerfishMeta = nodes[2].table;
    expect(anglerfishMeta?.body[1][1].text).toBe('Teacher: ');
  });

  it('builds the IN/OUT table with the exact legacy widths and headers', () => {
    const main = nodes[7];
    expect(main.style).toBe('tableExample');
    expect(main.table?.heights).toBe(22);
    expect(main.table?.widths).toEqual(['*', 125, 60, 80, 125, 60, 80]);

    const body = main.table?.body ?? [];
    expect(body[0][0]).toEqual({});
    expect(body[0][1]).toMatchObject({
      text: 'IN',
      style: 'tableHeader',
      colSpan: 3,
      alignment: 'center',
    });
    expect(body[0][4]).toMatchObject({
      text: 'OUT',
      style: 'tableHeader',
      colSpan: 3,
      alignment: 'center',
    });
    expect(body[1].map((cell) => cell.text)).toEqual([
      'STUDENT NAME',
      'PARENT / GUARDIAN PRINTED NAME',
      'TIME',
      'SIGNATURE',
      'PARENT / GUARDIAN PRINTED NAME',
      'TIME',
      'SIGNATURE',
    ]);
  });

  it('adds one 7-cell row per student, sorted by LAST name', () => {
    const body = nodes[7].table?.body ?? [];
    // 2 header rows + the 3 Guppies students.
    expect(body).toHaveLength(5);
    expect(body.slice(2).map((row) => row[0].text)).toEqual([
      'Zoe Abbott',
      'Ben Mills',
      'Amy Young',
    ]);
    for (const row of body.slice(2)) {
      expect(row).toHaveLength(7);
      expect(row[0].style).toBe('studentrow');
      expect(row.slice(1)).toEqual([{}, {}, {}, {}, {}, {}]);
    }
  });

  it('excludes unassigned and dangling-classroom students', () => {
    const names = nodes
      .filter((node) => node.table?.heights === 22)
      .flatMap((node) => node.table?.body.slice(2) ?? [])
      .map((row) => row[0].text);
    expect(names).not.toContain('Una Ford');
    expect(names).not.toContain('Gus Hale');
    // Turtles has no students: header rows only.
    expect(nodes[11].table?.body).toHaveLength(2);
    expect(nodes[15].table?.body).toHaveLength(3); // Barracudas: 2 + Cal Reed
  });

  it('keeps the legacy style quirk: studentrow is NOT defined here', () => {
    expect(definition.styles).toMatchObject({
      header: { fontSize: 18, bold: true, margin: [0, 0, 0, 5] },
      subheader: { fontSize: 16, bold: true, margin: [0, 0, 0, 5] },
      tableExample: { margin: [0, 0, 0, 0] },
      tableHeader: { bold: true, fontSize: 13, color: 'black' },
    });
    expect(definition.styles).not.toHaveProperty('studentrow');
  });

  it('produces a single valid page with a message when there are no classrooms', () => {
    const empty = buildSignInSheetDefinition([], STUDENTS);
    const emptyNodes = nodesOf(empty);
    expect(empty.pageOrientation).toBe('landscape');
    expect(pageCount(empty)).toBe(1);
    expect(emptyNodes.map((node) => node.text)).toEqual([
      REPORT_TITLE,
      REPORT_ADDRESS,
      NO_CLASSROOMS_MESSAGE,
    ]);
  });
});

describe('buildRollCallSheetDefinition', () => {
  const definition = buildRollCallSheetDefinition(CLASSROOMS, STUDENTS);
  const nodes = nodesOf(definition);

  it('emits one portrait page block of three nodes per classroom, no address line', () => {
    expect(definition.pageOrientation).toBeUndefined();
    expect(nodes).toHaveLength(12);
    expect(pageCount(definition)).toBe(CLASSROOMS.length);
    expect(nodes.some((node) => node.text === REPORT_ADDRESS)).toBe(false);

    for (const index of [0, 3, 6, 9]) {
      expect(nodes[index]).toMatchObject({
        text: REPORT_TITLE,
        style: 'header',
        alignment: 'center',
      });
    }
    expect(nodes[0].pageBreak).toBeUndefined();
    expect(nodes[3].pageBreak).toBe('before');
  });

  it('renders the Week-of blanks in the meta table', () => {
    const meta = nodes[4].table; // Guppies block: 3, 4, 5
    expect(meta?.body[0][0]).toMatchObject({
      text: WEEK_BLANKS,
      style: 'subheader',
    });
    expect(meta?.body[0][1].text).toBe('Classroom: Guppies');
    expect(meta?.body[1][0].text).toBe(AGE_GROUP_BLANK);
  });

  it('builds the MON–FRI grid with the exact legacy widths and header row', () => {
    const main = nodes[5];
    expect(main.table?.heights).toBe(22);
    expect(main.table?.widths).toEqual([
      100,
      20,
      28,
      20,
      28,
      20,
      28,
      20,
      28,
      20,
      28,
      'auto',
    ]);

    const header = main.table?.body[0] ?? [];
    expect(header).toHaveLength(12);
    expect(header[0]).toMatchObject({
      text: 'STUDENT NAME',
      alignment: 'center',
    });
    const dayCells = [1, 3, 5, 7, 9].map((index) => header[index]);
    expect(dayCells.map((cell) => cell.text)).toEqual([
      'MON',
      'TUE',
      'WED',
      'THU',
      'FRI',
    ]);
    for (const cell of dayCells) {
      expect(cell.colSpan).toBe(2);
      expect(cell.alignment).toBe('center');
    }
    for (const index of [2, 4, 6, 8, 10]) {
      expect(header[index]).toEqual({});
    }
    expect(header[11]).toMatchObject({
      text: 'COMMENTS',
      alignment: 'center',
    });
  });

  it('adds two 12-cell rows per student with IN/OUT labels and spanning cells', () => {
    const body = nodes[5].table?.body ?? [];
    // 1 header row + 2 rows per Guppies student.
    expect(body).toHaveLength(7);

    const inRow = body[1];
    const outRow = body[2];
    expect(inRow).toHaveLength(12);
    expect(outRow).toHaveLength(12);

    expect(inRow[0]).toMatchObject({
      text: 'Zoe Abbott \n DOB: 11/02/2025',
      style: 'studentrow',
      rowSpan: 2,
    });
    for (const index of [1, 3, 5, 7, 9]) {
      expect(inRow[index]).toMatchObject({
        text: 'IN',
        style: 'subsubheader',
        alignment: 'center',
      });
      expect(outRow[index]).toMatchObject({
        text: 'OUT',
        style: 'subsubheader',
        alignment: 'center',
      });
      expect(inRow[index + 1]).toEqual({});
      expect(outRow[index + 1]).toEqual({});
    }
    expect(inRow[11]).toEqual({ text: '', rowSpan: 2 });
    expect(outRow[0]).toEqual({});
    expect(outRow[11]).toEqual({});

    // Last-name order: Abbott, Mills, Young.
    expect(body[3][0].text).toBe('Ben Mills \n DOB: 01/05/2026');
    expect(body[5][0].text).toBe('Amy Young \n DOB: 09/15/2025');
  });

  it('formats the stored YYYY-MM-DD DOB directly — no timezone shifting', () => {
    // A UTC round-trip in a UTC+ zone would render 12/30/2022; the
    // string reformat must always yield the stored calendar date.
    const barracudasBody = nodes[11].table?.body ?? [];
    expect(barracudasBody[1][0].text).toBe('Cal Reed \n DOB: 12/31/2022');
  });

  it('defines the full legacy style set, including the unused tableHeader', () => {
    expect(definition.styles).toMatchObject({
      header: { fontSize: 18, bold: true, margin: [0, 0, 0, 5] },
      subheader: { fontSize: 16, bold: true, margin: [0, 0, 0, 5] },
      subsubheader: { fontSize: 8, bold: true },
      tableExample: { margin: [0, 0, 0, 0] },
      tableHeader: { bold: true, fontSize: 13, color: 'black' },
      studentrow: { fontSize: 10 },
    });
  });

  it('produces a single valid page with a message when there are no classrooms', () => {
    const empty = buildRollCallSheetDefinition([], []);
    const emptyNodes = nodesOf(empty);
    expect(pageCount(empty)).toBe(1);
    expect(emptyNodes.map((node) => node.text)).toEqual([
      REPORT_TITLE,
      NO_CLASSROOMS_MESSAGE,
    ]);
  });
});
