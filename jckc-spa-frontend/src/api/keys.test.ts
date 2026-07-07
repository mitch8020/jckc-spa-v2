import { describe, expect, it } from 'vitest'
import { keys } from './keys'

describe('query keys', () => {
  it('builds stable student keys', () => {
    const params = { page: 2, status: 'active' as const, search: 'ada', order: 'asc' as const }

    expect(keys.students.all).toEqual(['students'])
    expect(keys.students.list(params)).toEqual(['students', 'list', params])
    expect(keys.students.detail('s1')).toEqual(['students', 'detail', 's1'])
    expect(keys.students.mine()).toEqual(['students', 'mine'])
    expect(keys.students.guardiansOf('s1')).toEqual([
      'students',
      'detail',
      's1',
      'guardians',
    ])
  })

  it('builds stable classroom, guardian, user and dashboard keys', () => {
    const roster = { addPage: 1, addSearch: '', removePage: 2, removeSearch: 'ben' }
    const userParams = { page: 3, search: 'jane' }

    expect(keys.classrooms.all).toEqual(['classrooms'])
    expect(keys.classrooms.list()).toEqual(['classrooms', 'list'])
    expect(keys.classrooms.detail('c1')).toEqual(['classrooms', 'detail', 'c1'])
    expect(keys.classrooms.roster('c1', roster)).toEqual([
      'classrooms',
      'detail',
      'c1',
      'roster',
      roster,
    ])
    expect(keys.guardians.all).toEqual(['guardians'])
    expect(keys.guardians.list()).toEqual(['guardians', 'list'])
    expect(keys.guardians.detail('g1')).toEqual(['guardians', 'detail', 'g1'])
    expect(keys.users.all).toEqual(['users'])
    expect(keys.users.list(userParams)).toEqual(['users', 'list', userParams])
    expect(keys.users.me()).toEqual(['users', 'me'])
    expect(keys.dashboard.all).toEqual(['dashboard'])
  })
})
