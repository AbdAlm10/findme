function matMul(a: number[][], b: number[][]) {
  const rows = a.length
  const cols = b[0].length
  const shared = b.length
  const out = Array.from({ length: rows }, () => Array(cols).fill(0))
  for (let i = 0; i < rows; i += 1) {
    for (let k = 0; k < shared; k += 1) {
      for (let j = 0; j < cols; j += 1) out[i][j] += a[i][k] * b[k][j]
    }
  }
  return out
}

function matVec(a: number[][], x: number[]) {
  return a.map((row) => row.reduce((sum, value, index) => sum + value * x[index], 0))
}

function transpose(a: number[][]) {
  return a[0].map((_, column) => a.map((row) => row[column]))
}

function matAdd(a: number[][], b: number[][]) {
  return a.map((row, i) => row.map((value, j) => value + b[i][j]))
}

function invert2(m: number[][]) {
  const a = m[0][0]
  const b = m[0][1]
  const c = m[1][0]
  const d = m[1][1]
  const det = a * d - b * c
  if (Math.abs(det) < 1e-9) return null
  const inv = 1 / det
  return [
    [d * inv, -b * inv],
    [-c * inv, a * inv],
  ]
}

function symmetrize(m: number[][]) {
  for (let i = 0; i < m.length; i += 1) {
    for (let j = i + 1; j < m.length; j += 1) {
      const value = (m[i][j] + m[j][i]) / 2
      m[i][j] = value
      m[j][i] = value
    }
    m[i][i] = Math.max(m[i][i], 0.25)
  }
  return m
}

/**
 * Constant-velocity Kalman filter in local east/north meters.
 * Rejects jumps that are far outside both the predicted uncertainty and the reported accuracy.
 */
export class Kalman2D {
  x = [0, 0, 0, 0]
  P = [
    [25, 0, 0, 0],
    [0, 25, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ]
  initialized = false

  reset(east: number, north: number, accuracy: number) {
    const variance = Math.max(accuracy, 5) ** 2
    this.x = [east, north, 0, 0]
    this.P = [
      [variance, 0, 0, 0],
      [0, variance, 0, 0],
      [0, 0, 0.8, 0],
      [0, 0, 0, 0.8],
    ]
    this.initialized = true
  }

  predict(dtSeconds: number, control?: { de: number; dn: number }) {
    const dt = Math.max(0.05, Math.min(dtSeconds, 4))
    const damping = control ? 1 : 0.99
    const F = [
      [1, 0, dt, 0],
      [0, 1, 0, dt],
      [0, 0, damping, 0],
      [0, 0, 0, damping],
    ]
    const next = matVec(F, this.x)
    if (control) {
      next[0] += control.de
      next[1] += control.dn
      next[2] = control.de / dt
      next[3] = control.dn / dt
    }
    const q = control ? 0.35 : 0.7
    const dt2 = dt * dt
    const dt3 = dt2 * dt
    const Q = [
      [(dt3 / 3) * q, 0, (dt2 / 2) * q, 0],
      [0, (dt3 / 3) * q, 0, (dt2 / 2) * q],
      [(dt2 / 2) * q, 0, dt * q, 0],
      [0, (dt2 / 2) * q, 0, dt * q],
    ]
    this.x = next
    this.P = symmetrize(matAdd(matMul(matMul(F, this.P), transpose(F)), Q))
  }

  /** Returns false when the measurement is rejected as an outlier. */
  update(east: number, north: number, accuracy: number) {
    const innovationEast = east - this.x[0]
    const innovationNorth = north - this.x[1]
    const jump = Math.hypot(innovationEast, innovationNorth)
    const gate = Math.max(28, Math.max(accuracy, 5) * 3.2, Math.sqrt(this.P[0][0] + this.P[1][1]) * 4)
    if (jump > gate) {
      this.P[0][0] += 4
      this.P[1][1] += 4
      return false
    }

    const r = Math.max(accuracy, 5) ** 2
    const S = [
      [this.P[0][0] + r, this.P[0][1]],
      [this.P[1][0], this.P[1][1] + r],
    ]
    const inverse = invert2(S)
    if (!inverse) return false
    const PHt = [
      [this.P[0][0], this.P[0][1]],
      [this.P[1][0], this.P[1][1]],
      [this.P[2][0], this.P[2][1]],
      [this.P[3][0], this.P[3][1]],
    ]
    const K = matMul(PHt, inverse)
    const correction = matVec(K, [innovationEast, innovationNorth])
    this.x = this.x.map((value, index) => value + correction[index])
    const KH = [
      [K[0][0], K[0][1], 0, 0],
      [K[1][0], K[1][1], 0, 0],
      [K[2][0], K[2][1], 0, 0],
      [K[3][0], K[3][1], 0, 0],
    ]
    const identity = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ]
    const imkh = identity.map((row, i) => row.map((value, j) => value - KH[i][j]))
    this.P = symmetrize(matMul(imkh, this.P))
    return true
  }

  /** Horizontal DRMS in meters. */
  sigma() {
    return Math.sqrt(Math.max(0.25, this.P[0][0] + this.P[1][1]))
  }
}
