import { test } from '@japa/runner'
import { calculateConversionRate } from '#services/bayesian_service'

test.group('calculateConversionRate()', () => {
  test('0 successes / 1 trial → rate = 1/3 (not 0)', ({ assert }) => {
    const { rate } = calculateConversionRate(0, 1)
    assert.approximately(rate, 1 / 3, 0.0001)
  })

  test('1 success / 1 trial → rate = 2/3 (not 1)', ({ assert }) => {
    const { rate } = calculateConversionRate(1, 1)
    assert.approximately(rate, 2 / 3, 0.0001)
  })

  test('2 successes / 3 trials → rate = 3/5', ({ assert }) => {
    const { rate } = calculateConversionRate(2, 3)
    assert.approximately(rate, 3 / 5, 0.0001)
  })

  test('rate is always between 0 and 1 exclusive', ({ assert }) => {
    const cases = [
      { s: 0, t: 1 },
      { s: 1, t: 1 },
      { s: 0, t: 100 },
      { s: 100, t: 100 },
    ]
    for (const { s, t } of cases) {
      const { rate } = calculateConversionRate(s, t)
      assert.isAbove(rate, 0, `rate must be > 0 for s=${s}, t=${t}`)
      assert.isBelow(rate, 1, `rate must be < 1 for s=${s}, t=${t}`)
    }
  })

  test('confidenceLevel: low when total < 10', ({ assert }) => {
    assert.equal(calculateConversionRate(0, 1).confidenceLevel, 'low')
    assert.equal(calculateConversionRate(5, 9).confidenceLevel, 'low')
  })

  test('confidenceLevel: medium when 10 ≤ total < 20', ({ assert }) => {
    assert.equal(calculateConversionRate(5, 10).confidenceLevel, 'medium')
    assert.equal(calculateConversionRate(10, 19).confidenceLevel, 'medium')
  })

  test('confidenceLevel: high when total ≥ 20', ({ assert }) => {
    assert.equal(calculateConversionRate(10, 20).confidenceLevel, 'high')
    assert.equal(calculateConversionRate(50, 100).confidenceLevel, 'high')
  })
})
