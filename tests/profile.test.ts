import { describe, expect, it } from 'vitest';
import { parseStudentProfile, serializeSubjectList } from '../lib/profile';

describe('student profile query parsing', () => {
  it('parses grade, interest area, preferred subjects, and weak subjects', () => {
    const profile = parseStudentProfile({
      grade: '2',
      interestArea: 'ai',
      preferredSubjects: '정보, 수학,정보',
      weakSubjects: '물리학Ⅰ'
    });

    expect(profile).toEqual({
      grade: '2',
      interestArea: 'ai',
      preferredSubjects: ['정보', '수학'],
      weakSubjects: ['물리학Ⅰ']
    });
  });

  it('drops unsupported enum values and empty subject entries', () => {
    const profile = parseStudentProfile({
      grade: '5',
      interestArea: 'unknown',
      preferredSubjects: ' , 정보 ,, ',
      weakSubjects: ''
    });

    expect(profile).toEqual({ preferredSubjects: ['정보'] });
  });

  it('serializes subject arrays for stable URLs', () => {
    expect(serializeSubjectList(['정보', '수학', '정보'])).toBe('정보,수학');
  });
});
