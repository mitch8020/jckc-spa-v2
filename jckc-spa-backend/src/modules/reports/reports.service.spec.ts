import { EventEmitter } from 'node:events';
import { Types } from 'mongoose';
import { ReportsService } from './reports.service';

const mockCreatePdfKitDocument = jest.fn();
const mockPdfPrinter = jest.fn();
const mockUrlResolver = jest.fn().mockImplementation(() => ({}));

jest.mock('pdfmake/js/Printer', () => ({
  __esModule: true,
  default: function MockPdfPrinter(
    this: { createPdfKitDocument: typeof mockCreatePdfKitDocument },
    ...args: unknown[]
  ) {
    mockPdfPrinter(...args);
    this.createPdfKitDocument = mockCreatePdfKitDocument;
  },
}));

jest.mock('pdfmake/js/URLResolver', () => ({
  __esModule: true,
  default: function MockUrlResolver() {
    mockUrlResolver();
    return {};
  },
}));

function exec<T>(value: T) {
  return { exec: jest.fn().mockResolvedValue(value) };
}

function findLean<T>(value: T) {
  return {
    lean: jest.fn().mockReturnValue(exec(value)),
  };
}

function pdfDoc(chunks: Buffer[], error?: Error) {
  const doc = new EventEmitter() as EventEmitter & { end: jest.Mock };
  doc.end = jest.fn(() => {
    if (error) {
      doc.emit('error', error);
      return;
    }
    for (const chunk of chunks) {
      doc.emit('data', chunk);
    }
    doc.emit('end');
  });
  return doc;
}

describe('ReportsService', () => {
  const classroomId = new Types.ObjectId('64c000000000000000000001');
  let classroomModel: { find: jest.Mock };
  let studentModel: { find: jest.Mock };
  let service: ReportsService;

  beforeEach(() => {
    mockCreatePdfKitDocument.mockReset();
    mockPdfPrinter.mockClear();
    mockUrlResolver.mockClear();
    classroomModel = { find: jest.fn() };
    studentModel = { find: jest.fn() };
    service = new ReportsService(
      classroomModel as never,
      studentModel as never,
    );
  });

  it('loads report data, builds the sign-in definition and resolves PDF chunks', async () => {
    classroomModel.find.mockReturnValue(
      findLean([
        {
          _id: classroomId,
          classroomName: 'Infants',
          ageGroup: 'infant',
          teacherName: 'Ms. Kim',
        },
      ]),
    );
    studentModel.find.mockReturnValue(
      findLean([
        {
          studentFirstName: 'Ada',
          studentLastName: 'Lovelace',
          dateOfBirth: '2024-03-15',
          classroom: classroomId,
        },
        {
          studentFirstName: 'Ben',
          studentLastName: 'Bitdiddle',
          dateOfBirth: '2024-04-20',
          classroom: null,
        },
      ]),
    );
    mockCreatePdfKitDocument.mockResolvedValue(
      pdfDoc([Buffer.from('part-1'), Buffer.from('part-2')]),
    );

    const result = await service.generateSignInSheet();

    expect(result.toString()).toBe('part-1part-2');
    expect(classroomModel.find).toHaveBeenCalledTimes(1);
    expect(studentModel.find).toHaveBeenCalledTimes(1);
    expect(mockUrlResolver).toHaveBeenCalledTimes(1);
    const [fonts, virtualFileSystem, urlResolver] = mockPdfPrinter.mock
      .calls[0] as [
      { Roboto: { normal: string; bold: string } },
      unknown,
      unknown,
    ];
    expect(fonts.Roboto.normal).toContain('Roboto-Regular.ttf');
    expect(fonts.Roboto.bold).toContain('Roboto-Medium.ttf');
    expect(virtualFileSystem).toBeUndefined();
    expect(urlResolver).toEqual({});

    const [definition] = mockCreatePdfKitDocument.mock.calls[0] as [
      { content: unknown[] },
    ];
    expect(Array.isArray(definition.content)).toBe(true);
  });

  it('builds the roll-call definition and rejects PDF stream errors', async () => {
    const error = new Error('pdf failed');
    classroomModel.find.mockReturnValue(findLean([]));
    studentModel.find.mockReturnValue(findLean([]));
    mockCreatePdfKitDocument.mockResolvedValue(pdfDoc([], error));

    await expect(service.generateRollCallSheet()).rejects.toBe(error);
  });
});
