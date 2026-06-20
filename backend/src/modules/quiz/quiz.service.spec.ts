import { gradeAnswers, type GradeInputQuestion } from './quiz.service';

/**
 * Quiz grading is the single most business-critical pure-logic block
 * in the backend — every quiz report HR sees is built from its output.
 * Lock down the rules.
 */

const q = (overrides: Partial<GradeInputQuestion>): GradeInputQuestion => ({
  id: overrides.id || 'q1',
  domain: overrides.domain || 'General',
  difficulty: overrides.difficulty || 'EASY',
  content: overrides.content || { text: '?' },
  options: overrides.options || [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }],
  correctAnswer: overrides.correctAnswer ?? ['A'],
});

describe('gradeAnswers', () => {
  it('returns zero for empty input', () => {
    const out = gradeAnswers([], []);
    expect(out.totalScore).toBe(0);
    expect(out.maxTotal).toBe(0);
    expect(out.domainStats).toEqual({});
    expect(out.answerRows).toEqual([]);
  });

  it('marks a single-correct answer as correct', () => {
    const out = gradeAnswers(
      [{ questionId: 'q1', selected: ['A'] }],
      [q({ id: 'q1', correctAnswer: ['A'] })],
    );
    expect(out.totalScore).toBe(1);
    expect(out.maxTotal).toBe(1);
    expect(out.answerRows[0].isCorrect).toBe(true);
    expect(out.answerRows[0].marks).toBe(1);
  });

  it('marks a single-wrong answer as incorrect', () => {
    const out = gradeAnswers(
      [{ questionId: 'q1', selected: ['B'] }],
      [q({ id: 'q1', correctAnswer: ['A'] })],
    );
    expect(out.totalScore).toBe(0);
    expect(out.answerRows[0].isCorrect).toBe(false);
  });

  it('treats empty selection as incorrect', () => {
    const out = gradeAnswers(
      [{ questionId: 'q1', selected: [] }],
      [q({ correctAnswer: ['A'] })],
    );
    expect(out.totalScore).toBe(0);
    expect(out.answerRows[0].isCorrect).toBe(false);
  });

  it('exact-set match: multi-select needs all correct, no extras', () => {
    const question = q({ correctAnswer: ['A', 'C'] });

    expect(gradeAnswers([{ questionId: 'q1', selected: ['A', 'C'] }], [question]).answerRows[0].isCorrect).toBe(true);
    expect(gradeAnswers([{ questionId: 'q1', selected: ['C', 'A'] }], [question]).answerRows[0].isCorrect).toBe(true);
    // Subset: A only — wrong
    expect(gradeAnswers([{ questionId: 'q1', selected: ['A'] }], [question]).answerRows[0].isCorrect).toBe(false);
    // Superset: A, B, C — wrong
    expect(gradeAnswers([{ questionId: 'q1', selected: ['A', 'B', 'C'] }], [question]).answerRows[0].isCorrect).toBe(false);
    // Wrong subset: B only — wrong
    expect(gradeAnswers([{ questionId: 'q1', selected: ['B'] }], [question]).answerRows[0].isCorrect).toBe(false);
  });

  it('aggregates per-domain stats', () => {
    const questions = [
      q({ id: 'q1', domain: 'JS', correctAnswer: ['A'] }),
      q({ id: 'q2', domain: 'JS', correctAnswer: ['B'] }),
      q({ id: 'q3', domain: 'CSS', correctAnswer: ['A'] }),
    ];
    const out = gradeAnswers(
      [
        { questionId: 'q1', selected: ['A'] }, // JS correct
        { questionId: 'q2', selected: ['A'] }, // JS wrong
        { questionId: 'q3', selected: ['A'] }, // CSS correct
      ],
      questions,
    );
    expect(out.totalScore).toBe(2);
    expect(out.maxTotal).toBe(3);
    expect(out.domainStats.JS).toEqual({ correct: 1, total: 2, score: 1, maxScore: 2 });
    expect(out.domainStats.CSS).toEqual({ correct: 1, total: 1, score: 1, maxScore: 1 });
  });

  it('skips an answer whose questionId is not in the bank (deleted question, stale form)', () => {
    const out = gradeAnswers(
      [
        { questionId: 'q1', selected: ['A'] },
        { questionId: 'q-deleted', selected: ['A'] }, // not in questions[]
      ],
      [q({ id: 'q1', correctAnswer: ['A'] })],
    );
    expect(out.totalScore).toBe(1);
    expect(out.maxTotal).toBe(1);   // missing question doesn't inflate the denominator
    expect(out.answerRows.length).toBe(1);
  });

  it('preserves the order of answers via the position field', () => {
    const out = gradeAnswers(
      [
        { questionId: 'q2', selected: ['A'] },
        { questionId: 'q1', selected: ['A'] },
      ],
      [q({ id: 'q1', correctAnswer: ['A'] }), q({ id: 'q2', correctAnswer: ['A'] })],
    );
    expect(out.answerRows[0].questionId).toBe('q2');
    expect(out.answerRows[0].position).toBe(1);
    expect(out.answerRows[1].questionId).toBe('q1');
    expect(out.answerRows[1].position).toBe(2);
  });

  it('falls back to "General" when domain is missing', () => {
    const out = gradeAnswers(
      [{ questionId: 'q1', selected: ['A'] }],
      [q({ id: 'q1', domain: '' as any, correctAnswer: ['A'] })],
    );
    expect(out.domainStats.General).toEqual({ correct: 1, total: 1, score: 1, maxScore: 1 });
  });

  it('captures timeSpentSeconds on the answer row (defaults to 0)', () => {
    const out = gradeAnswers(
      [
        { questionId: 'q1', selected: ['A'], timeSpentSeconds: 17 },
        { questionId: 'q2', selected: ['A'] },
      ],
      [q({ id: 'q1', correctAnswer: ['A'] }), q({ id: 'q2', correctAnswer: ['A'] })],
    );
    expect(out.answerRows[0].timeSpentSeconds).toBe(17);
    expect(out.answerRows[1].timeSpentSeconds).toBe(0);
  });

  it('snapshots the question content so a later edit does not change historical reports', () => {
    const out = gradeAnswers(
      [{ questionId: 'q1', selected: ['A'] }],
      [q({ id: 'q1', content: { text: 'What is 2+2?' } })],
    );
    expect(out.answerRows[0].questionSnapshot.content).toEqual({ text: 'What is 2+2?' });
  });
});
