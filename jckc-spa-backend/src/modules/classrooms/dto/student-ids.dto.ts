import { ArrayNotEmpty, IsArray, IsMongoId } from 'class-validator';

/**
 * Explicit `{ studentIds }` body for the roster assign/remove endpoints
 * (replaces the legacy body-keys-as-ids protocol — classrooms.md ledger
 * #6). Min 1 entry, each a valid ObjectId string.
 */
export class StudentIdsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  studentIds: string[];
}
