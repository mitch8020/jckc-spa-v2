import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { Error as MongooseError } from 'mongoose';
import { GlobalExceptionFilter } from './global-exception.filter';

function makeHost() {
  const response = {
    status: jest.fn(),
    json: jest.fn(),
  };
  response.status.mockReturnValue(response);

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return { host, response };
}

describe('GlobalExceptionFilter', () => {
  let loggerSpy: jest.SpyInstance;

  beforeEach(() => {
    loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    loggerSpy.mockRestore();
  });

  it('serializes string HttpException responses', () => {
    const { host, response } = makeHost();

    new GlobalExceptionFilter().catch(new HttpException('Nope', 418), host);

    expect(response.status).toHaveBeenCalledWith(418);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 418,
      message: 'Nope',
      error: 'HttpException',
    });
  });

  it('passes object HttpException responses through unchanged', () => {
    const { host, response } = makeHost();
    const exception = new BadRequestException({
      statusCode: 400,
      message: ['firstName should not be empty'],
      error: 'Bad Request',
    });

    new GlobalExceptionFilter().catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(exception.getResponse());
  });

  it('maps mongoose CastError to the API 404 body', () => {
    const { host, response } = makeHost();
    const exception = new MongooseError.CastError('ObjectId', 'bad', '_id');

    new GlobalExceptionFilter().catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.NOT_FOUND,
      message: 'Not Found',
      error: 'Not Found',
    });
  });

  it('logs Error instances and returns a 500 JSON body', () => {
    const { host, response } = makeHost();
    const exception = new Error('boom');

    new GlobalExceptionFilter().catch(exception, host);

    expect(loggerSpy).toHaveBeenCalledWith(
      'Unhandled exception',
      exception.stack,
    );
    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
  });

  it('logs non-Error throwables using String()', () => {
    const { host } = makeHost();

    new GlobalExceptionFilter().catch('plain failure', host);

    expect(loggerSpy).toHaveBeenCalledWith(
      'Unhandled exception',
      'plain failure',
    );
  });
});
