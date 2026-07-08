import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Connection } from 'mongoose';
import request from 'supertest';
import type { Response } from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from './../src/app.setup';
import type { Paginated } from './../src/common/utils/pagination';
import type { ClassroomWithCountDto } from './../src/common/dto/classroom.dto';
import type { StudentDto } from './../src/common/dto/student.dto';
import type {
  ParentDashboardDto,
  StaffDashboardDto,
} from './../src/modules/dashboard/dto/dashboard.dto';
import type { UserDto } from './../src/modules/users/dto/user.dto';
import { startTestEnvironment } from './e2e-env';

// First run may download a MongoDB binary.
jest.setTimeout(120_000);

/** Joins every Set-Cookie of a response into a single Cookie header value. */
function sessionCookie(res: Response): string {
  const setCookies: string[] = res.get('Set-Cookie') ?? [];
  return setCookies.map((entry) => entry.split(';')[0]).join('; ');
}

/** Collects a streamed (PDF) response body into a Buffer. */
function binaryParser(
  res: Response,
  callback: (err: Error | null, body: Buffer) => void,
): void {
  const stream = res as unknown as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  stream.on('end', () => callback(null, Buffer.concat(chunks)));
}

/** YYYY-MM-DD for a date `days` days in the past (student DOB fixture). */
function dobDaysAgo(days: number): string {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

const STUDENT_BODY = {
  studentFirstName: 'Finn',
  studentLastName: 'Waters',
  dateOfBirth: '2023-04-15',
  studentStreetAddress: '12 Harbor Ln',
  studentCity: 'Johnson City',
  studentState: 'TN',
  studentZIP: '37604',
};

const GUARDIAN_BODY = {
  guardianFirstName: 'Pat',
  guardianLastName: 'Parent',
  phoneNumber: '423-555-1212',
  guardianStreetAddress: '99 Parent Ave',
  guardianCity: 'Johnson City',
  guardianState: 'TN',
  guardianZIP: '37604',
};

describe('JCKC backend (e2e)', () => {
  let app: INestApplication<App>;
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let server: App;

  let parentCookie = '';
  let adminCookie = '';

  beforeAll(async () => {
    mongod = await startTestEnvironment();

    // AppModule must load AFTER startTestEnvironment(): ConfigModule.forRoot
    // evaluates eagerly at module-import time and its validated config (which
    // outranks later process.env changes) would otherwise capture the
    // developer's real .env MONGO_URI instead of the in-memory server.
    const { AppModule } = await import('./../src/app.module.js');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // Same wiring as src/main.ts: bodyParser off + configureApp (better-auth
    // mount, body parsers, /api prefix, ValidationPipe, exception filter).
    app = moduleFixture.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });
    configureApp(app as NestExpressApplication);
    await app.init();

    connection = app.get<Connection>(getConnectionToken());
    server = app.getHttpServer();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (mongod) {
      await mongod.stop();
    }
  });

  async function signUp(name: string, email: string): Promise<string> {
    const res = await request(server)
      .post('/api/auth/sign-up/email')
      .send({ name, email, password: 'Sup3r-secret-pw!' })
      .expect(200);
    const cookie = sessionCookie(res);
    expect(cookie).toContain('better-auth.session_token');
    return cookie;
  }

  async function getMe(cookie: string): Promise<UserDto> {
    const res = await request(server)
      .get('/api/users/me')
      .set('Cookie', cookie)
      .expect(200);
    return res.body as UserDto;
  }

  describe('health & auth boundary', () => {
    it('GET /api/health responds 200 { status: "ok" } without a session (@Public)', () => {
      return request(server)
        .get('/api/health')
        .expect(200)
        .expect({ status: 'ok' });
    });

    it.each([
      ['localhost:3001', 'http://localhost:3000/dashboard'],
      ['127.0.0.1:3001', 'http://127.0.0.1:3000/dashboard'],
    ])(
      'starts Google OAuth with state cookie and matching redirect host for %s',
      async (host, callbackURL) => {
        const res = await request(server)
          .post('/api/auth/sign-in/social')
          .set('Host', host)
          .set('Origin', new URL(callbackURL).origin)
          .send({
            provider: 'google',
            callbackURL,
            disableRedirect: true,
          })
          .expect(200);

        const body = res.body as Record<string, unknown>;
        if (typeof body.url !== 'string') {
          throw new Error('Expected OAuth start response to include url');
        }
        const redirectUrl = new URL(body.url);
        expect(redirectUrl.searchParams.get('redirect_uri')).toBe(
          `http://${host}/api/auth/callback/google`,
        );
        expect(redirectUrl.searchParams.get('state')).toEqual(
          expect.any(String),
        );

        const setCookies: string[] = res.get('Set-Cookie') ?? [];
        expect(
          setCookies.some((cookie) => cookie.startsWith('better-auth.state=')),
        ).toBe(true);
      },
    );

    it('rejects unauthenticated requests with 401', async () => {
      await request(server).get('/api/users/me').expect(401);
      await request(server).get('/api/students').expect(401);
      await request(server).get('/api/dashboard').expect(401);
      await request(server).get('/api/reports/sign-in-sheet').expect(401);
    });
  });

  describe('email signup -> registration -> /users/me', () => {
    it('signs up via better-auth and starts unregistered', async () => {
      parentCookie = await signUp('Pat Parent', 'pat.parent@example.com');

      const me = await getMe(parentCookie);
      expect(me).toMatchObject({
        email: 'pat.parent@example.com',
        name: 'Pat Parent',
        role: '',
        registrationStatus: false,
      });
      expect(typeof me.id).toBe('string');
    });

    it('completes registration and reflects role + registrationStatus', async () => {
      const res = await request(server)
        .post('/api/users/register')
        .set('Cookie', parentCookie)
        .send({
          firstName: 'Pat',
          lastName: 'Parent',
          role: 'parent',
          dateOfBirth: '1990-05-04',
          phoneNumber: '4235550100',
        })
        .expect(201);
      expect(res.body as UserDto).toMatchObject({
        role: 'parent',
        registrationStatus: true,
        firstName: 'Pat',
        lastName: 'Parent',
      });

      const me = await getMe(parentCookie);
      expect(me).toMatchObject({ role: 'parent', registrationStatus: true });
    });

    it('409s when registering twice', () => {
      return request(server)
        .post('/api/users/register')
        .set('Cookie', parentCookie)
        .send({
          firstName: 'Pat',
          lastName: 'Parent',
          role: 'parent',
          dateOfBirth: '1990-05-04',
          phoneNumber: '4235550100',
        })
        .expect(409);
    });

    it('ignores privileged additionalFields injected at signup (input: false)', async () => {
      const res = await request(server)
        .post('/api/auth/sign-up/email')
        .send({
          name: 'Mallory Intruder',
          email: 'mallory@example.com',
          password: 'Sup3r-secret-pw!',
          role: 'admin',
          registrationStatus: true,
          adminPermission: true,
        })
        .expect(200);

      const me = await getMe(sessionCookie(res));
      expect(me).toMatchObject({ role: '', registrationStatus: false });
    });
  });

  describe('admin bootstrap + role enforcement', () => {
    it('flips a user to admin via direct DB write (bootstrap)', async () => {
      adminCookie = await signUp('Ada Admin', 'ada.admin@example.com');

      await connection.collection('users').updateOne(
        { email: 'ada.admin@example.com' },
        {
          $set: {
            role: 'admin',
            registrationStatus: true,
            adminPermission: true,
          },
        },
      );

      const me = await getMe(adminCookie);
      expect(me).toMatchObject({ role: 'admin', registrationStatus: true });
    });

    it('403s a parent on admin/teacher routes', async () => {
      await request(server)
        .get('/api/students')
        .set('Cookie', parentCookie)
        .expect(403);
      await request(server)
        .get('/api/reports/sign-in-sheet')
        .set('Cookie', parentCookie)
        .expect(403);
    });
  });

  describe('student CRUD (admin)', () => {
    let studentId = '';

    it('400s invalid payloads (ZIP / state / future DOB)', async () => {
      await request(server)
        .post('/api/students')
        .set('Cookie', adminCookie)
        .send({ ...STUDENT_BODY, studentZIP: 'abcde' })
        .expect(400);
      await request(server)
        .post('/api/students')
        .set('Cookie', adminCookie)
        .send({ ...STUDENT_BODY, studentState: 'ZZ' })
        .expect(400);
      await request(server)
        .post('/api/students')
        .set('Cookie', adminCookie)
        .send({ ...STUDENT_BODY, dateOfBirth: '2999-01-01' })
        .expect(400);
    });

    it('creates a student (201, approved when admin-created)', async () => {
      const res = await request(server)
        .post('/api/students')
        .set('Cookie', adminCookie)
        .send(STUDENT_BODY)
        .expect(201);
      const created = res.body as StudentDto;
      expect(created).toMatchObject({
        ...STUDENT_BODY,
        applicationApprovalStatus: true,
        classroom: null,
        ageGroup: null,
      });
      expect(typeof created.id).toBe('string');
      studentId = created.id;
    });

    it('lists the student (status=all) with pagination shape', async () => {
      const res = await request(server)
        .get('/api/students?status=all')
        .set('Cookie', adminCookie)
        .expect(200);
      const page = res.body as Paginated<StudentDto>;
      expect(page.items.map((item) => item.id)).toContain(studentId);
      expect(page.pagination).toEqual({
        currentPage: 1,
        totalPages: 1,
        totalCount: 1,
        pageSize: 10,
        startIndex: 1,
        endIndex: 1,
        hasPrevious: false,
        hasNext: false,
      });
    });

    it('reads a single student', async () => {
      const res = await request(server)
        .get(`/api/students/${studentId}`)
        .set('Cookie', adminCookie)
        .expect(200);
      const student = res.body as StudentDto;
      expect(student.id).toBe(studentId);
      expect(student.studentFirstName).toBe('Finn');
    });

    it('404s unknown and malformed ids', async () => {
      await request(server)
        .get('/api/students/64b000000000000000000000')
        .set('Cookie', adminCookie)
        .expect(404);
      await request(server)
        .get('/api/students/not-an-object-id')
        .set('Cookie', adminCookie)
        .expect(404);
    });

    it('updates a student via PATCH', async () => {
      const res = await request(server)
        .patch(`/api/students/${studentId}`)
        .set('Cookie', adminCookie)
        .send({ studentFirstName: 'Finnegan', studentCity: 'Erwin' })
        .expect(200);
      expect(res.body as StudentDto).toMatchObject({
        studentFirstName: 'Finnegan',
        studentCity: 'Erwin',
        studentLastName: 'Waters',
      });
    });

    it('deletes a student (204) and then 404s', async () => {
      await request(server)
        .delete(`/api/students/${studentId}`)
        .set('Cookie', adminCookie)
        .expect(204);
      await request(server)
        .get(`/api/students/${studentId}`)
        .set('Cookie', adminCookie)
        .expect(404);
      await request(server)
        .delete(`/api/students/${studentId}`)
        .set('Cookie', adminCookie)
        .expect(404);
    });
  });

  describe('classrooms + roster (recomputes ageGroup)', () => {
    let classroomId = '';
    let infantId = '';

    it('creates a classroom (201)', async () => {
      const res = await request(server)
        .post('/api/classrooms')
        .set('Cookie', adminCookie)
        .send({
          classroomName: 'Guppy Room',
          ageGroup: 'infant',
          teacherName: 'Ms. Reef',
        })
        .expect(201);
      const classroom = res.body as ClassroomWithCountDto;
      expect(classroom).toMatchObject({
        classroomName: 'Guppy Room',
        ageGroup: 'infant',
        teacherName: 'Ms. Reef',
      });
      classroomId = classroom.id;
    });

    it('assigns a student and recomputes ageGroup from DOB', async () => {
      const createRes = await request(server)
        .post('/api/students')
        .set('Cookie', adminCookie)
        .send({
          ...STUDENT_BODY,
          studentFirstName: 'Isla',
          // ~5 months old -> infant (< 11 months, 365-day-year math).
          dateOfBirth: dobDaysAgo(150),
        })
        .expect(201);
      const created = createRes.body as StudentDto;
      infantId = created.id;
      expect(created.ageGroup).toBeNull();

      const assigned = await request(server)
        .post(`/api/classrooms/${classroomId}/students`)
        .set('Cookie', adminCookie)
        .send({ studentIds: [infantId] })
        .expect(200);
      expect(assigned.body).toEqual({ added: 1, notFound: [] });

      const studentRes = await request(server)
        .get(`/api/students/${infantId}`)
        .set('Cookie', adminCookie)
        .expect(200);
      const student = studentRes.body as StudentDto;
      expect(student.ageGroup).toBe('infant');
      expect(student.classroom).toMatchObject({
        id: classroomId,
        classroomName: 'Guppy Room',
      });
    });

    it('reports the student count on GET /api/classrooms', async () => {
      const res = await request(server)
        .get('/api/classrooms')
        .set('Cookie', adminCookie)
        .expect(200);
      const classrooms = res.body as ClassroomWithCountDto[];
      const room = classrooms.find((entry) => entry.id === classroomId);
      expect(room).toMatchObject({ studentCount: 1, ageGroup: 'infant' });
    });
  });

  describe('dashboard', () => {
    it('returns staff stats for admins', async () => {
      const res = await request(server)
        .get('/api/dashboard')
        .set('Cookie', adminCookie)
        .expect(200);
      const dashboard = res.body as StaffDashboardDto;
      expect(dashboard.role).toBe('admin');
      // Exactly one student remains (Isla), assigned to the infant room.
      expect(dashboard.stats).toEqual({
        infantsInRooms: 1,
        toddlersInRooms: 0,
        preschoolersInRooms: 0,
        activeStudents: 1,
        inactiveStudents: 0,
      });
      expect(Array.isArray(dashboard.classrooms)).toBe(true);
      expect(dashboard.classrooms).toHaveLength(1);
    });

    it('returns the students split for parents', async () => {
      const res = await request(server)
        .get('/api/dashboard')
        .set('Cookie', parentCookie)
        .expect(200);
      expect(res.body as ParentDashboardDto).toEqual({
        role: 'parent',
        students: { registered: [], pending: [] },
      });
    });

    it('403s REGISTRATION_REQUIRED for unregistered users', async () => {
      const cookie = await signUp('Newt User', 'newt.user@example.com');
      const res = await request(server)
        .get('/api/dashboard')
        .set('Cookie', cookie)
        .expect(403);
      expect((res.body as { message: string }).message).toBe(
        'REGISTRATION_REQUIRED',
      );
    });
  });

  describe('student applications', () => {
    it('creates a pending application with an initial parent guardian link', async () => {
      const parent = await getMe(parentCookie);

      const res = await request(server)
        .post('/api/students')
        .set('Cookie', parentCookie)
        .send({
          ...STUDENT_BODY,
          studentFirstName: 'Penny',
          studentLastName: 'Parented',
          guardian: GUARDIAN_BODY,
          relationshipToStudent: 'Mother',
          authorizedToPickUp: false,
        })
        .expect(201);
      const created = res.body as StudentDto;
      expect(created).toMatchObject({
        studentFirstName: 'Penny',
        studentLastName: 'Parented',
        applicationApprovalStatus: false,
      });

      const guardian = await connection
        .collection<{
          userId?: string;
          guardianFirstName?: string;
          students?: Array<{
            student?: unknown;
            relationshipToStudent?: string;
            authorizedToPickUp?: boolean;
          }>;
        }>('guardians')
        .findOne({
          userId: parent.id,
          guardianFirstName: GUARDIAN_BODY.guardianFirstName,
        });
      expect(guardian).not.toBeNull();
      const link = guardian?.students?.[0];
      expect(String(link?.student)).toBe(created.id);
      expect(link?.relationshipToStudent).toBe('Mother');
      expect(link?.authorizedToPickUp).toBe(false);

      const dashboardRes = await request(server)
        .get('/api/dashboard')
        .set('Cookie', parentCookie)
        .expect(200);
      const dashboard = dashboardRes.body as ParentDashboardDto;
      expect(dashboard.students.registered).toEqual([]);
      expect(dashboard.students.pending.map((student) => student.id)).toContain(
        created.id,
      );
    });

    it('lets admins create a student linked to an existing guardian', async () => {
      const inserted = await connection.collection('guardians').insertOne({
        ...GUARDIAN_BODY,
        guardianFirstName: 'Existing',
        guardianLastName: 'Guardian',
        students: [],
        createdAt: new Date(),
      });

      const res = await request(server)
        .post('/api/students')
        .set('Cookie', adminCookie)
        .send({
          ...STUDENT_BODY,
          studentFirstName: 'Ellis',
          studentLastName: 'Linked',
          guardianId: inserted.insertedId.toString(),
          relationshipToStudent: 'Aunt',
          authorizedToPickUp: true,
        })
        .expect(201);
      const created = res.body as StudentDto;
      expect(created).toMatchObject({
        studentFirstName: 'Ellis',
        studentLastName: 'Linked',
        applicationApprovalStatus: true,
      });

      const guardian = await connection
        .collection<{
          students?: Array<{
            student?: unknown;
            relationshipToStudent?: string;
            authorizedToPickUp?: boolean;
          }>;
        }>('guardians')
        .findOne({ _id: inserted.insertedId });
      const link = guardian?.students?.find(
        (entry) => String(entry.student) === created.id,
      );
      expect(link).toMatchObject({
        relationshipToStudent: 'Aunt',
        authorizedToPickUp: true,
      });
    });
  });

  describe('reports', () => {
    it('streams the sign-in sheet PDF for admins', async () => {
      const res = await request(server)
        .get('/api/reports/sign-in-sheet')
        .set('Cookie', adminCookie)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="sign-in-sheet.pdf"',
      );
      expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    });

    it('streams the roll-call sheet PDF for admins', async () => {
      const res = await request(server)
        .get('/api/reports/roll-call-sheet')
        .set('Cookie', adminCookie)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="roll-call-sheet.pdf"',
      );
      expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    });
  });
});
